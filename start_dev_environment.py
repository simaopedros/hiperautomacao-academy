#!/usr/bin/env python3
"""
Script para iniciar automaticamente o ambiente de desenvolvimento do Hiperautomação Academy
"""

import os
import sys
import subprocess
import time
import platform
import shutil
import socket
from pathlib import Path
from typing import Optional

# Ensure Windows consoles handle Unicode symbols used for status output
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def resolve_command(base_name: str) -> Optional[str]:
    """Resolve a CLI executable across platforms (handles .cmd on Windows)."""
    candidates = [base_name]
    if platform.system() == "Windows":
        candidates = [f"{base_name}.cmd", f"{base_name}.exe", base_name]
    for candidate in candidates:
        path = shutil.which(candidate)
        if path:
            return path
    return None


def find_windows_mongodb_bin(mongodb_dir: Path) -> Optional[Path]:
    """Return the /bin directory of a locally extracted MongoDB on Windows."""
    for candidate in mongodb_dir.glob("mongodb*windows*"):
        bin_dir = candidate / "bin"
        if (bin_dir / "mongod.exe").exists():
            return bin_dir
    return None

def check_prerequisites():
    """Verifica se as dependências necessárias estão instaladas"""
    print("Verificando pré-requisitos...")
    
    # Verificar Python
    try:
        python_version = sys.version_info
        if python_version < (3, 8):
            print("❌ Python 3.8 ou superior é necessário")
            return False
        print(f"✅ Python {sys.version.split()[0]} encontrado")
    except Exception as e:
        print(f"❌ Python não encontrado: {e}")
        return False
    
    # Verificar Node.js
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ Node.js {result.stdout.strip()} encontrado")
        else:
            print("❌ Node.js não encontrado")
            return False
    except FileNotFoundError:
        print("❌ Node.js não encontrado")
        return False
    
    # Verificar MongoDB
    try:
        result = subprocess.run(['mongod', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ MongoDB encontrado")
        else:
            print("⚠️  MongoDB não encontrado no sistema, será configurado localmente")
    except FileNotFoundError:
        print("⚠️  MongoDB não encontrado no sistema, será configurado localmente")
    
    return True

def setup_local_mongodb():
    """Configura e inicia o MongoDB localmente"""
    print("Configurando MongoDB local...")
    system = platform.system()
    
    try:
        # Criar diretório para MongoDB
        mongodb_dir = Path("mongodb")
        mongodb_dir.mkdir(exist_ok=True)
        
        # Criar diretório de dados
        data_dir = mongodb_dir / "data"
        data_dir.mkdir(exist_ok=True)
        
        if system == "Windows":
            from zipfile import ZipFile, BadZipFile
            import urllib.request

            mongodb_bin_dir = find_windows_mongodb_bin(mongodb_dir)
            zip_url = "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.12.zip"
            zip_path = mongodb_dir / "mongodb-windows-x86_64-7.0.12.zip"

            if mongodb_bin_dir is None:
                print("📥 Baixando MongoDB para Windows...")

                def download_zip():
                    urllib.request.urlretrieve(zip_url, zip_path)

                if not zip_path.exists():
                    download_zip()

                # Extrair o arquivo ZIP com verificação de corrupção
                print("📦 Extraindo MongoDB...")
                try:
                    with ZipFile(zip_path, "r") as zip_ref:
                        zip_ref.extractall(mongodb_dir)
                except BadZipFile:
                    print("⚠️  Arquivo ZIP corrompido, baixando novamente...")
                    if zip_path.exists():
                        zip_path.unlink()
                    download_zip()
                    with ZipFile(zip_path, "r") as zip_ref:
                        zip_ref.extractall(mongodb_dir)
                finally:
                    if zip_path.exists():
                        zip_path.unlink()

                mongodb_bin_dir = find_windows_mongodb_bin(mongodb_dir)

            if mongodb_bin_dir is None:
                print("❌ Não foi possível localizar o binário do MongoDB após a extração")
                return None

            # Iniciar MongoDB
            print("🚀 Iniciando MongoDB local...")
            mongod_path = mongodb_bin_dir / "mongod.exe"
            mongodb_process = subprocess.Popen([
                str(mongod_path),
                "--dbpath", str(data_dir),
                "--port", "27017",
                "--bind_ip", "127.0.0.1"
            ], cwd=mongodb_dir)
            
            print("✅ MongoDB local iniciado (PID: {})".format(mongodb_process.pid))
            return mongodb_process
            
        else:  # macOS/Linux
            # Verificar se o MongoDB já foi baixado
            mongodb_extracted = list(mongodb_dir.glob("mongodb-macos-*")) or list(mongodb_dir.glob("mongodb-linux-*"))
            if not mongodb_extracted:
                print("📥 Baixando MongoDB...")
                import urllib.request
                import tarfile
                
                # Detectar arquitetura e sistema operacional
                if system == "Darwin":  # macOS
                    ARCH = platform.machine()
                    if ARCH == "arm64":
                        url = "https://fastdl.mongodb.org/osx/mongodb-macos-arm64-7.0.12.tgz"
                    else:
                        url = "https://fastdl.mongodb.org/osx/mongodb-macos-x86_64-7.0.12.tgz"
                else:  # Linux
                    url = "https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-7.0.12.tgz"
                
                tgz_path = mongodb_dir / "mongodb.tgz"
                urllib.request.urlretrieve(url, tgz_path)
                
                # Extrair o arquivo
                print("📦 Extraindo MongoDB...")
                with tarfile.open(tgz_path, 'r:gz') as tar_ref:
                    tar_ref.extractall(mongodb_dir)
                
                # Remover arquivo TGZ após extração
                tgz_path.unlink()
            
            # Encontrar o diretório do MongoDB extraído
            mongodb_extracted = list(mongodb_dir.glob("mongodb-*"))
            if mongodb_extracted:
                mongodb_bin_dir = mongodb_extracted[0] / "bin"
                
                # Iniciar MongoDB
                print("🚀 Iniciando MongoDB local...")
                mongod_path = mongodb_bin_dir / "mongod"
                mongodb_process = subprocess.Popen([
                    str(mongod_path),
                    "--dbpath", str(data_dir),
                    "--port", "27017",
                    "--bind_ip", "127.0.0.1"
                ], cwd=mongodb_dir)
                
                print("✅ MongoDB local iniciado (PID: {})".format(mongodb_process.pid))
                return mongodb_process
            else:
                print("❌ Não foi possível encontrar o MongoDB extraído")
                return None
    
    except Exception as e:
        print(f"❌ Erro ao configurar MongoDB local: {e}")
        return None

def start_system_mongodb():
    """Inicia o serviço MongoDB do sistema"""
    print("Iniciando MongoDB do sistema...")
    system = platform.system()
    
    try:
        if system == "Windows":
            # No Windows, o MongoDB geralmente é instalado como serviço
            result = subprocess.run(['net', 'start', 'MongoDB'], capture_output=True, text=True)
            if result.returncode == 0 or "já está em execução" in result.stdout:
                print("✅ MongoDB iniciado com sucesso")
                return True
            else:
                print("❌ Falha ao iniciar MongoDB:", result.stderr)
                return False
        elif system == "Darwin":  # macOS
            result = subprocess.run(['brew', 'services', 'start', 'mongodb/brew/mongodb-community'], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                print("✅ MongoDB iniciado com sucesso")
                return True
            else:
                print("❌ Falha ao iniciar MongoDB:", result.stderr)
                return False
        else:  # Linux
            result = subprocess.run(['sudo', 'systemctl', 'start', 'mongod'], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                print("✅ MongoDB iniciado com sucesso")
                return True
            else:
                print("❌ Falha ao iniciar MongoDB:", result.stderr)
                return False
    except Exception as e:
        print(f"❌ Erro ao iniciar MongoDB: {e}")
        return False

def check_mongodb_connection(host: str = "127.0.0.1", port: int = 27017) -> bool:
    """Verifica se o MongoDB está acessível abrindo um socket diretamente."""
    print("Verificando conexão com MongoDB...")
    try:
        with socket.create_connection((host, port), timeout=5):
            print("✅ Conexão com MongoDB estabelecida")
            return True
    except OSError as exc:
        print(f"⚠️  Não foi possível conectar ao MongoDB: {exc}")
        return False

def start_mongodb():
    """Inicia o serviço MongoDB"""
    print("Iniciando MongoDB...")
    
    # Primeiro, tentar conectar ao MongoDB existente
    if check_mongodb_connection():
        print("✅ MongoDB já está em execução")
        return None  # Nenhum processo novo foi iniciado
    
    # Tentar iniciar o MongoDB do sistema
    if start_system_mongodb():
        # Verificar conexão novamente
        if check_mongodb_connection():
            return None  # MongoDB do sistema iniciado
    
    # Se não conseguir iniciar o MongoDB do sistema, configurar MongoDB local
    print("🔄 Configurando MongoDB local...")
    return setup_local_mongodb()

def setup_backend_env():
    """Configura o ambiente do backend"""
    print("Configurando ambiente do backend...")
    
    backend_dir = Path("backend")
    if not backend_dir.exists():
        print("❌ Diretório 'backend' não encontrado")
        return False
    
    # Criar ambiente virtual se não existir
    venv_dir = backend_dir / "venv"
    if not venv_dir.exists():
        print("Criando ambiente virtual...")
        try:
            subprocess.run([sys.executable, "-m", "venv", str(venv_dir)], check=True)
            print("✅ Ambiente virtual criado")
        except subprocess.CalledProcessError as e:
            print(f"❌ Falha ao criar ambiente virtual: {e}")
            return False
    
    # Criar arquivo .env se não existir
    env_file = backend_dir / ".env"
    if not env_file.exists():
        env_content = """# Configuração do MongoDB
MONGO_URL=mongodb://127.0.0.1:27017
DB_NAME=hiperautomacao_academy

# Configuração de Segurança
SECRET_KEY=hiperautomacao_secret_key_2023
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Configuração da Aplicação
FRONTEND_URL=http://localhost:3000

# Configuração de Pagamento (opcional para testes locais)

# Configuração CORS
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
"""
        with open(env_file, "w") as f:
            f.write(env_content)
        print("✅ Arquivo .env do backend criado")
    
    # Instalar dependências
    print("Instalando dependências do backend...")
    try:
        if platform.system() == "Windows":
            pip_cmd = [str(venv_dir / "Scripts" / "pip"), "install", "-r", "requirements.txt"]
        else:
            pip_cmd = [str(venv_dir / "bin" / "pip"), "install", "-r", "requirements.txt"]
        
        subprocess.run(pip_cmd, cwd=backend_dir, check=True)
        print("✅ Dependências do backend instaladas")
    except subprocess.CalledProcessError as e:
        print(f"❌ Falha ao instalar dependências do backend: {e}")
        return False
    
    return True

def setup_frontend_env():
    """Configura o ambiente do frontend"""
    print("Configurando ambiente do frontend...")
    
    frontend_dir = Path("frontend")
    if not frontend_dir.exists():
        print("❌ Diretório 'frontend' não encontrado")
        return False
    
    # Criar arquivo .env se não existir
    env_file = frontend_dir / ".env"
    if not env_file.exists():
        env_content = """# URL da API Backend
REACT_APP_BACKEND_URL=http://localhost:8000

# URL de Suporte Padrão
REACT_APP_DEFAULT_SUPPORT_URL=https://wa.me/5511999999999
"""
        with open(env_file, "w") as f:
            f.write(env_content)
        print("✅ Arquivo .env do frontend criado")
    
    # Instalar dependências
    print("Instalando dependências do frontend...")
    try:
        yarn_cmd = resolve_command("yarn")
        if yarn_cmd:
            subprocess.run([yarn_cmd, 'install'], cwd=frontend_dir, check=True)
            print("✅ Dependências do frontend instaladas com yarn")
        else:
            npm_cmd = resolve_command("npm")
            if not npm_cmd:
                print("❌ npm/yarn não encontrados no PATH. Instale Node.js novamente ou atualize o PATH.")
                return False
            subprocess.run([npm_cmd, 'install'], cwd=frontend_dir, check=True)
            print("✅ Dependências do frontend instaladas com npm")
    except subprocess.CalledProcessError as e:
        print(f"❌ Falha ao instalar dependências do frontend: {e}")
        return False
    
    return True

def start_backend():
    """Inicia o servidor backend"""
    print("Iniciando servidor backend...")
    
    backend_dir = Path("backend")
    
    try:
        if platform.system() == "Windows":
            python_cmd = str(backend_dir / "venv" / "Scripts" / "python")
        else:
            python_cmd = str(backend_dir / "venv" / "bin" / "python")
        
        # Iniciar backend em processo separado
        backend_process = subprocess.Popen([
            python_cmd, "-m", "uvicorn", "server:app", 
            "--reload", "--host", "0.0.0.0", "--port", "8000"
        ], cwd=backend_dir)
        
        print("✅ Servidor backend iniciado (PID: {})".format(backend_process.pid))
        return backend_process
    except Exception as e:
        print(f"❌ Falha ao iniciar servidor backend: {e}")
        return None

def start_frontend():
    """Inicia o servidor frontend"""
    print("Iniciando servidor frontend...")
    
    frontend_dir = Path("frontend")
    
    try:
        yarn_cmd = resolve_command("yarn")
        npm_cmd = resolve_command("npm")

        if yarn_cmd:
            frontend_process = subprocess.Popen([yarn_cmd, 'start'], cwd=frontend_dir)
            print("✅ Servidor frontend iniciado com yarn (PID: {})".format(frontend_process.pid))
        elif npm_cmd:
            frontend_process = subprocess.Popen([npm_cmd, 'start'], cwd=frontend_dir)
            print("✅ Servidor frontend iniciado com npm (PID: {})".format(frontend_process.pid))
        else:
            print("❌ Não foi possível encontrar npm ou yarn para iniciar o frontend.")
            return None

        return frontend_process
    except Exception as e:
        print(f"❌ Falha ao iniciar servidor frontend: {e}")
        return None

def main():
    """Função principal"""
    print("=" * 60)
    print("🚀 Script de Inicialização do Hiperautomação Academy")
    print("=" * 60)
    
    # Verificar pré-requisitos
    if not check_prerequisites():
        print("\n❌ Pré-requisitos não atendidos. Por favor, instale as dependências necessárias.")
        return
    
    # Iniciar MongoDB
    mongodb_process = start_mongodb()
    if mongodb_process is False:
        print("\n❌ Falha ao iniciar MongoDB.")
        return
    
    # Aguardar um momento para o MongoDB iniciar
    time.sleep(5)
    
    # Configurar backend
    if not setup_backend_env():
        print("\n❌ Falha ao configurar ambiente do backend.")
        if mongodb_process:
            mongodb_process.terminate()
        return
    
    # Configurar frontend
    if not setup_frontend_env():
        print("\n❌ Falha ao configurar ambiente do frontend.")
        if mongodb_process:
            mongodb_process.terminate()
        return
    
    # Iniciar servidores
    print("\n" + "=" * 60)
    print("🔧 Iniciando servidores...")
    print("=" * 60)
    
    backend_process = start_backend()
    if not backend_process:
        print("\n❌ Falha ao iniciar servidor backend.")
        if mongodb_process:
            mongodb_process.terminate()
        return
    
    # Aguardar um momento para o backend iniciar
    time.sleep(5)
    
    frontend_process = start_frontend()
    if not frontend_process:
        print("\n❌ Falha ao iniciar servidor frontend.")
        # Terminar os processos
        if mongodb_process:
            mongodb_process.terminate()
        backend_process.terminate()
        return
    
    # Informações de acesso
    print("\n" + "=" * 60)
    print("✅ Ambiente de desenvolvimento iniciado com sucesso!")
    print("=" * 60)
    print("Hotéis de acesso:")
    print("   Backend API:     http://localhost:8000")
    print("  🌐 Frontend:       http://localhost:3000")
    print("  📚 Documentação:   http://localhost:8000/docs")
    print("  🗄️  MongoDB:       mongodb://127.0.0.1:27017")
    print("\nPressione Ctrl+C para encerrar todos os servidores.")
    
    try:
        # Aguardar os processos
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\n🛑 Encerrando servidores...")
        if mongodb_process:
            mongodb_process.terminate()
        backend_process.terminate()
        frontend_process.terminate()
        print("✅ Servidores encerrados.")
    except Exception as e:
        print(f"\n❌ Erro: {e}")
        if mongodb_process:
            mongodb_process.terminate()
        backend_process.terminate()
        frontend_process.terminate()

if __name__ == "__main__":
    main()
