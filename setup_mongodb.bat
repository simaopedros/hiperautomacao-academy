@echo off
echo ====================================================
echo 🛠️  Configurando MongoDB Local para Desenvolvimento
echo ====================================================

REM Criar diretório para MongoDB
if not exist "mongodb" mkdir mongodb
cd mongodb

REM Verificar se o MongoDB já foi baixado
if exist "mongodb-windows-x86_64-7.0.12" (
    echo ✅ MongoDB já foi baixado anteriormente
    goto start_mongodb
)

REM Baixar MongoDB Community Edition (versão portable)
echo 📦 Baixando MongoDB Community Edition...
powershell -Command "Invoke-WebRequest -Uri 'https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.12.zip' -OutFile 'mongodb-windows-x86_64-7.0.12.zip'"
if errorlevel 1 (
    echo ❌ Falha ao baixar MongoDB
    cd ..
    pause
    exit /b 1
)

REM Extrair o arquivo ZIP
echo 📦 Extraindo MongoDB...
powershell -Command "Expand-Archive -Path 'mongodb-windows-x86_64-7.0.12.zip' -DestinationPath '.'"
if errorlevel 1 (
    echo ❌ Falha ao extrair MongoDB
    cd ..
    pause
    exit /b 1
)

echo ✅ MongoDB baixado e extraído com sucesso

:start_mongodb
echo 🚀 Iniciando MongoDB...
start "MongoDB" /D "%~dp0mongodb" cmd /c "mongodb-windows-x86_64-7.0.12\bin\mongod.exe --dbpath data --port 27017 --bind_ip 127.0.0.1"

echo.
echo ====================================================
echo ✅ MongoDB iniciado com sucesso!
echo ====================================================
echoHotéis de acesso:
echo   MongoDB: mongodb://127.0.0.1:27017
echo.
echo Para encerrar o MongoDB, feche a janela do terminal.
echo ====================================================

cd ..
pause