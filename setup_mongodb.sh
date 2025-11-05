#!/bin/bash

# Script para configurar e executar MongoDB localmente para desenvolvimento
# Uso: ./setup_mongodb.sh

echo "===================================================="
echo "🛠️  Configurando MongoDB Local para Desenvolvimento"
echo "===================================================="

# Criar diretório para MongoDB
mkdir -p mongodb
cd mongodb

# Verificar se o MongoDB já foi baixado
if [ -d "mongodb-macos-x86_64-7.0.12" ]; then
    echo "✅ MongoDB já foi baixado anteriormente"
else
    # Baixar MongoDB Community Edition (versão para macOS)
    echo "📦 Baixando MongoDB Community Edition..."
    
    # Detectar arquitetura
    ARCH=$(uname -m)
    if [ "$ARCH" = "arm64" ]; then
        # Apple Silicon
        MONGODB_URL="https://fastdl.mongodb.org/osx/mongodb-macos-arm64-7.0.12.tgz"
    else
        # Intel
        MONGODB_URL="https://fastdl.mongodb.org/osx/mongodb-macos-x86_64-7.0.12.tgz"
    fi
    
    curl -O $MONGODB_URL
    if [ $? -ne 0 ]; then
        echo "❌ Falha ao baixar MongoDB"
        cd ..
        exit 1
    fi
    
    # Extrair o arquivo
    echo "📦 Extraindo MongoDB..."
    tar -zxvf mongodb-macos-*.tgz
    if [ $? -ne 0 ]; then
        echo "❌ Falha ao extrair MongoDB"
        cd ..
        exit 1
    fi
    
    echo "✅ MongoDB baixado e extraído com sucesso"
fi

# Criar diretório de dados se não existir
mkdir -p data

# Iniciar MongoDB
echo "🚀 Iniciando MongoDB..."
mongodb-macos-*/bin/mongod --dbpath data --port 27017 --bind_ip 127.0.0.1 &

echo ""
echo "===================================================="
echo "✅ MongoDB iniciado com sucesso!"
echo "===================================================="
echo "Hotéis de acesso:"
echo "  MongoDB: mongodb://127.0.0.1:27017"
echo ""
echo "Para encerrar o MongoDB, execute: kill $!"
echo "===================================================="

cd ..