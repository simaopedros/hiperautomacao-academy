import platform
import socket
import subprocess
import time
from pathlib import Path


def wait_for_port(host: str, port: int, timeout_seconds: int = 45) -> bool:
    """Tenta por até timeout_seconds detectar a porta aberta."""
    start = time.time()
    while time.time() - start < timeout_seconds:
        if is_port_open(host, port):
            return True
        time.sleep(1)
    return False


def is_port_open(host: str, port: int, timeout: float = 2.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def find_mongod_exe(mongodb_root: Path) -> Path | None:
    # Procura por mongod.exe dentro de "mongodb/" (versão portable já baixada)
    for exe in mongodb_root.glob("**/mongod.exe"):
        return exe
    return None


def start_mongodb() -> subprocess.Popen | None:
    print("[MongoDB] Verificando serviço na porta 27017...")
    if is_port_open("127.0.0.1", 27017):
        print("[MongoDB] Já está em execução em 127.0.0.1:27017")
        return None

    system = platform.system()
    repo_root = Path(__file__).resolve().parent
    mongodb_dir = repo_root / "mongodb"
    mongodb_dir.mkdir(exist_ok=True)
    data_dir = mongodb_dir / "data"
    data_dir.mkdir(exist_ok=True)

    # Primeiro, tenta serviço do sistema (Windows)
    if system == "Windows":
        print("[MongoDB] Tentando iniciar serviço do sistema (net start MongoDB)...")
        try:
            result = subprocess.run(["net", "start", "MongoDB"], capture_output=True, text=True)
            if result.returncode == 0 or "já está em execução" in result.stdout:
                print("[MongoDB] Serviço do sistema iniciado.")
                # Esperar um pouco e validar porta
                time.sleep(2)
                if is_port_open("127.0.0.1", 27017):
                    return None
            else:
                print(f"[MongoDB] Falha ao iniciar serviço: {result.stderr or result.stdout}")
        except Exception as exc:
            print(f"[MongoDB] Erro ao iniciar serviço: {exc}")

    # Se não deu, inicia versão local (portable) já presente no projeto
    print("[MongoDB] Iniciando MongoDB local (portable)...")
    mongod_exe = find_mongod_exe(mongodb_dir)
    if mongod_exe is None:
        print("[MongoDB] mongod.exe não encontrado em 'mongodb/'. Execute 'setup_mongodb.bat' se necessário.")
        return None

    proc = subprocess.Popen([
        str(mongod_exe),
        "--dbpath", str(data_dir),
        "--port", "27017",
        "--bind_ip", "127.0.0.1",
    ], cwd=str(mongodb_dir))

    if wait_for_port("127.0.0.1", 27017, timeout_seconds=60):
        print(f"[MongoDB] Local iniciado (PID: {proc.pid}).")
    else:
        print("[MongoDB] Ainda não respondeu na porta 27017. Verifique os logs.")
    return proc


def start_backend() -> None:
    print("[Backend] Verificando serviço na porta 8000...")
    if is_port_open("127.0.0.1", 8000):
        print("[Backend] Já está em execução em http://localhost:8000")
        return

    repo_root = Path(__file__).resolve().parent
    script = repo_root / "start_backend.bat"
    if not script.exists():
        print("[Backend] Script 'start_backend.bat' não encontrado.")
        return

    # 'start' abre uma nova janela de terminal no Windows
    subprocess.Popen(["cmd", "/c", "start", "Backend", str(script)], cwd=str(repo_root))
    if wait_for_port("127.0.0.1", 8000, timeout_seconds=45):
        print("[Backend] Iniciado em http://localhost:8000")
    else:
        print("[Backend] Ainda não respondeu na porta 8000.")


def start_frontend() -> None:
    print("[Frontend] Verificando serviço na porta 3000...")
    if is_port_open("127.0.0.1", 3000):
        print("[Frontend] Já está em execução em http://localhost:3000")
        return

    repo_root = Path(__file__).resolve().parent
    script = repo_root / "start_frontend.bat"
    if not script.exists():
        print("[Frontend] Script 'start_frontend.bat' não encontrado.")
        return

    subprocess.Popen(["cmd", "/c", "start", "Frontend", str(script)], cwd=str(repo_root))
    if wait_for_port("127.0.0.1", 3000, timeout_seconds=60):
        print("[Frontend] Iniciado em http://localhost:3000")
    else:
        print("[Frontend] Ainda não respondeu na porta 3000. Se estiver usando Cloudflare, acesse a URL do túnel.")


def main() -> None:
    print("====================================================")
    print("🚀 Iniciando serviços: MongoDB, Backend, Frontend")
    print("====================================================")

    start_mongodb()
    start_backend()
    start_frontend()

    print("\nURLs de acesso:")
    print("  Backend API:     http://localhost:8000")
    print("  Frontend:        http://localhost:3000")
    print("  MongoDB:         mongodb://127.0.0.1:27017")
    print("\nPara encerrar, feche as janelas dos servidores ou pare o serviço correspondente.")


if __name__ == "__main__":
    main()