#!/bin/bash

# Script para iniciar o ambiente de desenvolvimento do Hiperautomação Academy
# Uso: ./start_dev.sh

echo "===================================================="
echo "🚀 Iniciando Ambiente de Desenvolvimento Completo"
echo "===================================================="

# Verificar se estamos no diretório correto
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ Erro: Diretórios backend e/ou frontend não encontrados."
    echo "Por favor, execute este script na raiz do projeto."
    exit 1
fi

# Função para verificar se um comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Verificar pré-requisitos
echo "🔍 Verificando pré-requisitos..."

# Verificar Python
if ! command_exists python3; then
    echo "❌ Python 3 não encontrado"
    exit 1
fi

# Verificar Node.js
if ! command_exists node; then
    echo "❌ Node.js não encontrado"
    exit 1
fi

echo "✅ Todos os pré-requisitos encontrados"

# Iniciar MongoDB
echo "🔄 Iniciando MongoDB..."
if [ -d "mongodb" ] && [ -d "mongodb/data" ]; then
    # Verificar se o MongoDB local já foi configurado
    if ls mongodb/mongodb-* >/dev/null 2>&1; then
        echo "🚀 Iniciando MongoDB local..."
        mongodb/mongodb-*/bin/mongod --dbpath mongodb/data --port 27017 --bind_ip 127.0.0.1 &
        MONGODB_PID=$!
        echo "✅ MongoDB local iniciado (PID: $MONGODB_PID)"
    else
        echo "🛠️  Configurando MongoDB local..."
        ./setup_mongodb.sh
        MONGODB_PID=$!
    fi
else
    # Verificar se MongoDB está instalado no sistema
    if command_exists mongod; then
        if ! pgrep -x mongod > /dev/null; then
            if command_exists brew; then
                # macOS com Homebrew
                brew services start mongodb/brew/mongodb-community
            else
                # Linux
                sudo systemctl start mongod
            fi
            
            if [ $? -eq 0 ]; then
                echo "✅ MongoDB iniciado com sucesso"
            else
                echo "⚠️  Não foi possível iniciar MongoDB. Configurando MongoDB local..."
                ./setup_mongodb.sh
                MONGODB_PID=$!
            fi
        else
            echo "✅ MongoDB já está em execução"
        fi
    else
        echo "🛠️  Configurando MongoDB local..."
        ./setup_mongodb.sh
        MONGODB_PID=$!
    fi
fi

# Aguardar alguns segundos para o MongoDB iniciar
sleep 5

# Configurar e iniciar backend
echo "🚀 Configurando e iniciando Backend..."
cd backend

# Criar ambiente virtual se não existir
if [ ! -d "venv" ]; then
    echo "🛠️  Criando ambiente virtual..."
    python3 -m venv venv
    if [ $? -eq 0 ]; then
        echo "✅ Ambiente virtual criado"
    else
        echo "❌ Falha ao criar ambiente virtual"
        exit 1
    fi
fi

# Ativar ambiente virtual
source venv/bin/activate

# Criar arquivo .env se não existir
if [ ! -f ".env" ]; then
    echo "🛠️  Criando arquivo .env..."
    cat > .env << EOF
# Configuração do MongoDB
MONGO_URL=mongodb://127.0.0.1:27017
DB_NAME=hiperautomacao_academy

# Configuração de Segurança
SECRET_KEY=hiperautomacao_secret_key_2023
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Configuração da Aplicação
FRONTEND_URL=http://localhost:3000

# Configuração de Pagamento (opcional para testes locais)
ABACATEPAY_API_KEY=your_abacatepay_api_key_here
ABACATEPAY_ENVIRONMENT=sandbox

# Configuração CORS
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
EOF
    echo "✅ Arquivo .env criado"
fi

# Instalar dependências
echo "🛠️  Instalando dependências do backend..."
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "❌ Falha ao instalar dependências do backend"
    kill $MONGODB_PID 2>/dev/null
    exit 1
fi
echo "✅ Dependências do backend instaladas"

# Iniciar backend em background
echo "🚀 Iniciando servidor backend..."
uvicorn server:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# Aguardar alguns segundos para o backend iniciar
sleep 5

# Configurar e iniciar frontend
echo "🌐 Configurando e iniciando Frontend..."
cd frontend

# Criar arquivo .env se não existir
if [ ! -f ".env" ]; then
    echo "🛠️  Criando arquivo .env..."
    cat > .env << EOF
# URL da API Backend
REACT_APP_BACKEND_URL=http://localhost:8000

# URL de Suporte Padrão
REACT_APP_DEFAULT_SUPPORT_URL=https://wa.me/5511999999999
EOF
    echo "✅ Arquivo .env criado"
fi

# Instalar dependências
echo "🛠️  Instalando dependências do frontend..."
if command_exists yarn; then
    yarn install
    YARN_USED=true
else
    npm install
    YARN_USED=false
fi

if [ $? -ne 0 ]; then
    echo "❌ Falha ao instalar dependências do frontend"
    kill $BACKEND_PID 2>/dev/null
    kill $MONGODB_PID 2>/dev/null
    exit 1
fi
echo "✅ Dependências do frontend instaladas"

# Iniciar frontend
echo "🌐 Iniciando servidor frontend..."
if [ "$YARN_USED" = true ]; then
    yarn start &
else
    npm start &
fi
FRONTEND_PID=$!
cd ..

# Informações de acesso
echo ""
echo "===================================================="
echo "✅ Ambiente de desenvolvimento iniciado com sucesso!"
echo "===================================================="
echo "Hotéis de acesso:"
echo "   Backend API:     http://localhost:8000"
echo "   Frontend:        http://localhost:3000"
echo "   Documentação:    http://localhost:8000/docs"
echo "   MongoDB:         mongodb://127.0.0.1:27017"
echo ""
echo "Para encerrar, pressione Ctrl+C"
echo "===================================================="

# Função para encerrar processos ao receber sinal de interrupção
cleanup() {
    echo ""
    echo "🛑 Encerrando servidores..."
    kill $MONGODB_PID 2>/dev/null
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ Servidores encerrados."
    exit 0
}

# Capturar sinal de interrupção (Ctrl+C)
trap cleanup INT

# Aguardar processos em background
wait $BACKEND_PID $FRONTEND_PID