@echo off
echo ====================================================
echo 🌐 Iniciando Frontend do Hiperautomação Academy
echo ====================================================

REM Navegar para o diretório frontend
cd /d "%~dp0frontend"

REM Verificar se o diretório node_modules existe
if not exist "node_modules" (
    echo 🛠️  Instalando dependências do frontend...
    
    REM Verificar se yarn está disponível
    yarn --version >nul 2>&1
    if %errorlevel% == 0 (
        echo Usando yarn para instalar dependências...
        yarn install
        if errorlevel 1 (
            echo ❌ Falha ao instalar dependências com yarn
            pause
            exit /b 1
        )
    ) else (
        echo Usando npm para instalar dependências...
        npm install
        if errorlevel 1 (
            echo ❌ Falha ao instalar dependências com npm
            pause
            exit /b 1
        )
    )
    echo ✅ Dependências instaladas
)

REM Verificar se o arquivo .env existe
if not exist ".env" (
    echo 🛠️  Criando arquivo .env...
    echo # URL da API Backend>.env
    echo REACT_APP_BACKEND_URL=http://localhost:8001>>.env
    echo.>>.env
    echo # URL de Suporte Padrão>>.env
    echo REACT_APP_DEFAULT_SUPPORT_URL=https://wa.me/5511999999999>>.env
    echo ✅ Arquivo .env criado
)

REM Iniciar o servidor frontend
echo 🚀 Iniciando servidor frontend...

REM Verificar se yarn está disponível
yarn --version >nul 2>&1
if %errorlevel% == 0 (
    echo Usando yarn para iniciar...
    yarn start
) else (
    echo Usando npm para iniciar...
    npm start
)

pause