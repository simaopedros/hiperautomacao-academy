@echo off
echo ====================================================
echo 🚀 Iniciando Backend do Hiperautomação Academy
echo ====================================================

REM Navegar para o diretório backend
cd /d "%~dp0backend"

REM Verificar se o ambiente virtual existe
if not exist "venv" (
    echo 🛠️  Criando ambiente virtual...
    python -m venv venv
    if errorlevel 1 (
        echo ❌ Falha ao criar ambiente virtual
        pause
        exit /b 1
    )
    echo ✅ Ambiente virtual criado
)

REM Ativar ambiente virtual
echo 🛠️  Ativando ambiente virtual...
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo ❌ Falha ao ativar ambiente virtual
    pause
    exit /b 1
)

REM Verificar se requirements.txt existe
if not exist "requirements.txt" (
    echo ❌ Arquivo requirements.txt não encontrado
    pause
    exit /b 1
)

REM Instalar/atualizar dependências
echo 🛠️  Instalando dependências...
pip install -r requirements.txt
if errorlevel 1 (
    echo ❌ Falha ao instalar dependências
    pause
    exit /b 1
)

REM Verificar se o arquivo .env existe
if not exist ".env" (
    echo 🛠️  Criando arquivo .env...
    echo # Configuração do MongoDB>MONGO_URL=mongodb://localhost:27017
    echo DB_NAME=hiperautomacao_academy>>.env
    echo.>>.env
    echo # Configuração de Segurança>>.env
    echo SECRET_KEY=hiperautomacao_secret_key_2023>>.env
    echo ALGORITHM=HS256>>.env
    echo ACCESS_TOKEN_EXPIRE_MINUTES=10080>>.env
    echo.>>.env
    echo # Configuração da Aplicação>>.env
    echo FRONTEND_URL=http://localhost:3000>>.env
    echo.>>.env
    echo # Configuração de Pagamento (opcional para testes locais)>>.env
    echo ABACATEPAY_API_KEY=your_abacatepay_api_key_here>>.env
    echo ABACATEPAY_ENVIRONMENT=sandbox>>.env
    echo.>>.env
    echo # Configuração CORS>>.env
    echo CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000>>.env
    echo ✅ Arquivo .env criado
)

REM Iniciar o servidor
echo 🚀 Iniciando servidor backend...
uvicorn server:app --reload --host 0.0.0.0 --port 8000

pause