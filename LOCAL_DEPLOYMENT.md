# Guia de Implantação Local - Hiperautomação Academy

Este guia fornece instruções detalhadas para implantar o projeto Hiperautomação Academy localmente em seu ambiente de desenvolvimento.

## Pré-requisitos do Sistema

Antes de começar, certifique-se de ter os seguintes softwares instalados:

1. **Python 3.8 ou superior**
2. **Node.js 14 ou superior**
3. **MongoDB Community Edition**
4. **Git (opcional)**

## Passo 1: Clonar o Repositório

```bash
git clone <url-do-repositorio>
cd hiperautomacao-academy
```

## Passo 2: Instalar Dependências do Sistema

### Windows

1. Baixe e instale o Python em [python.org](https://www.python.org/downloads/)
2. Baixe e instale o Node.js em [nodejs.org](https://nodejs.org/)
3. Baixe e instale o MongoDB Community Server em [mongodb.com](https://www.mongodb.com/try/download/community)

### macOS (com Homebrew)

```bash
# Instalar Python
brew install python

# Instalar Node.js
brew install node

# Instalar MongoDB
brew tap mongodb/brew
brew install mongodb-community
```

### Ubuntu/Debian

```bash
# Atualizar lista de pacotes
sudo apt update

# Instalar Python e pip
sudo apt install python3 python3-pip

# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
```

## Passo 3: Configurar e Iniciar MongoDB

### Iniciar o serviço MongoDB

```bash
# Windows (como Administrador)
net start MongoDB

# macOS
brew services start mongodb/brew/mongodb-community

# Ubuntu
sudo systemctl start mongod
```

### Verificar se o MongoDB está em execução

```bash
mongo --eval "db.runCommand({ connectionStatus: 1 })"
```

## Passo 4: Configurar o Backend

### Navegar até o diretório backend

```bash
cd backend
```

### Criar e ativar ambiente virtual

```bash
# Criar ambiente virtual
python -m venv venv

# Ativar ambiente virtual
# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

### Criar arquivo de variáveis de ambiente

Crie um arquivo `.env` no diretório `backend` com o seguinte conteúdo:

```env
# Configuração do MongoDB
MONGO_URL=mongodb://localhost:27017
DB_NAME=hiperautomacao_academy

# Configuração de Segurança
SECRET_KEY=hiperautomacao_secret_key_2023
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Configuração da Aplicação
FRONTEND_URL=http://localhost:3000

# Configuração de Pagamento (opcional para testes locais)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Configuração CORS
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### Instalar dependências do backend

```bash
pip install -r requirements.txt
```

### Iniciar o servidor backend

```bash
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

Verifique se o backend está funcionando acessando `http://localhost:8000/docs` no seu navegador.

## Passo 5: Configurar o Frontend

### Navegar até o diretório frontend

Em um novo terminal (mantenha o backend em execução):

```bash
cd frontend
```

### Criar arquivo de variáveis de ambiente

Crie um arquivo `.env` no diretório `frontend` com o seguinte conteúdo:

```env
# URL da API Backend
REACT_APP_BACKEND_URL=http://localhost:8000

# URL de Suporte Padrão
REACT_APP_DEFAULT_SUPPORT_URL=https://wa.me/5511999999999
```

### Instalar dependências do frontend

```bash
# Usando npm
npm install

# Ou usando yarn (se preferir)
yarn install
```

### Iniciar o servidor frontend

```bash
# Usando npm
npm start

# Ou usando yarn
yarn start
```

O servidor frontend será iniciado e abrirá automaticamente o navegador em `http://localhost:3000`.

## Passo 6: Criar Usuário Administrador

1. Acesse a documentação da API em `http://localhost:8000/docs`

2. Use o endpoint `/auth/register` para criar um novo usuário:
   - Preencha os campos necessários (email, nome, senha)
   - Execute a requisição

3. Atualize o papel do usuário para administrador no MongoDB:
   ```bash
   mongo hiperautomacao_academy
   db.users.updateOne({email: "seu-email@example.com"}, {$set: {role: "admin"}})
   ```

## Passo 7: Acessar a Aplicação

Com ambos os servidores em execução:

- **Backend API**: `http://localhost:8000`
- **Frontend Application**: `http://localhost:3000`
- **Documentação da API**: `http://localhost:8000/docs`

Faça login com as credenciais do usuário administrador que você criou.

## Solução de Problemas

### Problemas Comuns

1. **Porta já em uso**:
   - Altere a porta no comando uvicorn: `--port 8001`

2. **Erros de dependência**:
   - Certifique-se de que o ambiente virtual está ativado
   - Reinstale as dependências: `pip install -r requirements.txt --force-reinstall`

3. **MongoDB não conectando**:
   - Verifique se o serviço MongoDB está em execução
   - Confirme as credenciais no arquivo `.env`

4. **Erros no frontend**:
   - Verifique se o backend está acessível em `http://localhost:8000`
   - Confirme as variáveis de ambiente no arquivo `.env` do frontend

### Logs e Debugging

- **Backend**: Os logs são exibidos no terminal onde o servidor está em execução
- **Frontend**: Os logs são exibidos no terminal onde o servidor está em execução
- **MongoDB**: Verifique os logs do MongoDB em `/var/log/mongodb/` (Linux/macOS) ou no diretório de instalação (Windows)

## Estrutura de Diretórios

```
hiperautomacao-academy/
├── backend/
│   ├── server.py          # Aplicação principal FastAPI
│   ├── requirements.txt   # Dependências Python
│   └── .env              # Variáveis de ambiente (criar)
├── frontend/
│   ├── src/              # Código fonte React
│   ├── package.json      # Dependências Node.js
│   └── .env              # Variáveis de ambiente (criar)
├── README.md             # Documentação principal
└── LOCAL_DEPLOYMENT.md   # Este guia
```

## Comandos Úteis

### Gerenciar MongoDB

```bash
# Iniciar MongoDB
sudo systemctl start mongod        # Linux
brew services start mongodb-community # macOS
net start MongoDB                  # Windows

# Parar MongoDB
sudo systemctl stop mongod         # Linux
brew services stop mongodb-community  # macOS
net stop MongoDB                   # Windows

# Reiniciar MongoDB
sudo systemctl restart mongod      # Linux
brew services restart mongodb-community # macOS
net restart MongoDB                # Windows
```

### Gerenciar Ambiente Virtual Python

```bash
# Ativar ambiente virtual
source venv/bin/activate    # Linux/macOS
venv\Scripts\activate       # Windows

# Desativar ambiente virtual
deactivate

# Listar pacotes instalados
pip list

# Atualizar pip
pip install --upgrade pip
```

### Gerenciar Dependências Node.js

```bash
# Instalar todas as dependências
npm install
yarn install

# Adicionar nova dependência
npm install nome-do-pacote
yarn add nome-do-pacote

# Remover dependência
npm uninstall nome-do-pacote
yarn remove nome-do-pacote
```

## Recursos Adicionais

- [Documentação FastAPI](https://fastapi.tiangolo.com/)
- [Documentação React](https://reactjs.org/docs/getting-started.html)
- [Documentação MongoDB](https://docs.mongodb.com/)
- [Documentação Tailwind CSS](https://tailwindcss.com/docs)

Este guia deve permitir que você configure e execute com sucesso o Hiperautomação Academy localmente para desenvolvimento e testes.