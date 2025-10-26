@echo off
echo ====================================================
echo 🚀 Iniciando Ambiente de Desenvolvimento Completo
echo ====================================================

REM Verificar se MongoDB está instalado como serviço
net start MongoDB >nul 2>&1
if %errorlevel% == 0 (
    echo ✅ MongoDB já está em execução
) else (
    echo 🔄 Verificando MongoDB local...
    
    REM Verificar se o MongoDB local já foi configurado
    if exist "mongodb\mongodb-windows-x86_64-7.0.12\bin\mongod.exe" (
        echo 🚀 Iniciando MongoDB local...
        start "MongoDB Local" /D "%~dp0mongodb" cmd /c "mongodb-windows-x86_64-7.0.12\bin\mongod.exe --dbpath data --port 27017 --bind_ip 127.0.0.1"
        echo ✅ MongoDB local iniciado
    ) else (
        echo 🛠️  Configurando MongoDB local...
        call "%~dp0setup_mongodb.bat"
    )
)

REM Aguardar alguns segundos para o MongoDB iniciar
timeout /t 5 /nobreak >nul

REM Iniciar backend em uma nova janela
echo 🚀 Iniciando Backend...
start "Backend - Hiperautomação Academy" /D "%~dp0" cmd /c "%~dp0start_backend.bat"

REM Aguardar alguns segundos para o backend iniciar
timeout /t 10 /nobreak >nul

REM Iniciar frontend em uma nova janela
echo 🌐 Iniciando Frontend...
start "Frontend - Hiperautomação Academy" /D "%~dp0" cmd /c "%~dp0start_frontend.bat"

echo.
echo ====================================================
echo ✅ Ambiente de desenvolvimento iniciado!
echo ====================================================
echoHotéis de acesso:
echo   Backend API:     http://localhost:8000
echo   Frontend:        http://localhost:3000
echo   Documentação:    http://localhost:8000/docs
echo   MongoDB:         mongodb://127.0.0.1:27017
echo.
echo Para encerrar, feche as janelas dos servidores.
echo ====================================================

pause