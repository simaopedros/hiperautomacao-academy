# Hiperautomação Academy

A comprehensive online learning platform built with modern web technologies for delivering educational content with integrated payment systems, social features, and gamification.

## Table of Contents
- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Key Features](#key-features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Environment Configuration](#environment-configuration)
- [Local Deployment Guide](#local-deployment-guide)
  - [Step 1: Install System Dependencies](#step-1-install-system-dependencies)
  - [Step 2: Set Up MongoDB](#step-2-set-up-mongodb)
  - [Step 3: Configure Backend Environment](#step-3-configure-backend-environment)
  - [Step 4: Install Backend Dependencies](#step-4-install-backend-dependencies)
  - [Step 5: Run Backend Server](#step-5-run-backend-server)
  - [Step 6: Configure Frontend Environment](#step-6-configure-frontend-environment)
  - [Step 7: Install Frontend Dependencies](#step-7-install-frontend-dependencies)
  - [Step 8: Run Frontend Application](#step-8-run-frontend-application)
  - [Step 9: Access the Application](#step-9-access-the-application)
- [Automated Deployment Scripts](#automated-deployment-scripts)
  - [Python Automation Script](#python-automation-script)
  - [Platform-Specific Scripts](#platform-specific-scripts)
- [MongoDB Local Development](#mongodb-local-development)
  - [Automatic MongoDB Setup](#automatic-mongodb-setup)
  - [Manual MongoDB Setup](#manual-mongodb-setup)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [License](#license)

## Overview

Hiperautomação Academy is a full-stack educational platform that allows administrators to create and manage courses while students can enroll, learn, and interact with the community. The platform features a credit-based economy, multiple payment gateways, referral system, and social learning features.

## Technology Stack

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) - High-performance Python web framework
- **Database**: [MongoDB](https://www.mongodb.com/) with [Motor](https://motor.readthedocs.io/) async driver
- **Authentication**: JWT tokens with [bcrypt](https://github.com/pyca/bcrypt/) password hashing
- **Payment Processing**: Integration with Abacate Pay and Hotmart
- **Email Service**: SMTP-based using Brevo

### Frontend
- **Framework**: [React](https://reactjs.org/) with [React Router](https://reactrouter.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with custom components
- **UI Components**: [Radix UI](https://www.radix-ui.com/) primitives
- **State Management**: React hooks
- **HTTP Client**: [Axios](https://axios-http.com/)
- **Build Tool**: [Craco](https://github.com/gsoft-inc/craco) (Create React App Configuration Override)

## Key Features

### User Management
- Role-based access control (Admin/Student)
- Secure authentication with JWT
- Password reset functionality
- Bulk user import via CSV

### Course System
- Course creation and management
- Modular content organization (Courses → Modules → Lessons)
- Multiple lesson types (video, text, file)
- Progress tracking and completion

### Credits & Payments
- Credit-based economy system
- Multiple payment gateways (Abacate Pay PIX, Hotmart)
- Configurable credit packages
- Transaction history

### Social Features
- Community discussion feed
- Lesson and course commenting system
- Like/comment functionality
- Gamification with credit rewards

### Referral Program
- Unique referral codes for each user
- Credit bonuses for successful referrals
- Referral tracking dashboard

### Administrative Tools
- Admin dashboard with analytics
- User and enrollment management
- Course content management
- Payment and transaction monitoring
- Email configuration
- Support settings

## Project Structure

```
hiperautomacao-academy/
├── backend/
│   ├── server.py          # Main FastAPI application
│   ├── requirements.txt   # Python dependencies
│   └── ...                # Environment configs
├── frontend/
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable UI components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utility functions
│   ├── package.json       # Frontend dependencies
│   └── ...                # Config files (tailwind, craco, etc.)
├── mongodb/               # Local MongoDB installation (created automatically)
│   └── data/             # MongoDB data directory
├── README.md              # This file
└── ...                    # Test files and documentation
```

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed on your system:
- Python 3.8 or higher
- Node.js 14 or higher
- npm or yarn package manager
- Git (optional, for version control)

Note: MongoDB installation is optional - our scripts can automatically set up a local MongoDB instance if needed.

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up environment variables:
   Create a `.env` file with the following variables:
   ```env
   MONGO_URL=mongodb://127.0.0.1:27017
   DB_NAME=hiperautomacao_db
   SECRET_KEY=your-secret-key
   ABACATEPAY_API_KEY=your-api-key
   FRONTEND_URL=http://localhost:3000
   ```

5. Run the server:
   ```bash
   uvicorn server:app --reload
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Start the development server:
   ```bash
   npm start
   # or
   yarn start
   ```

4. Build for production:
   ```bash
   npm run build
   # or
   yarn build
   ```

## Environment Configuration

The repository now ships with curated `.env.<environment>.sample` files so that every environment (local dev, staging, production) can share the same variable names while keeping sensitive values out of version control.

### Backend
1. Copy `backend/.env.development.sample` to `backend/.env.development` and adjust only if you are not using the default local stack.
2. Copy `backend/.env.production.sample` to `backend/.env.production` and replace the placeholders (MongoDB URI, AbacatePay keys, `FRONTEND_URL`, etc.) with your secure production values. Store the filled file in a secrets manager or deployment vault.
3. When the API boots it first loads `backend/.env` (legacy compatibility) and then overlays `backend/.env.<APP_ENV>`. Set `APP_ENV` to `development`, `staging`, or `production` via your process manager (Docker, systemd, etc.) to pick the right file.

### Frontend
1. Copy `frontend/.env.development.sample` to `frontend/.env.development` to define the backend URL the React dev server should proxy to.
2. Copy `frontend/.env.production.sample` to `frontend/.env.production`. These values are baked into the static bundle during `npm run build`, so double‑check them before deploying.
3. The CRA build pipeline automatically reads `.env.development`/`.env.production` depending on the script you are running; no extra tooling is required.

With these files in place you can either continue using the manual scripts from `LOCAL_DEPLOYMENT.md` or switch to the standardized Docker workflows described below.

## Local Deployment Guide

Follow these steps to deploy the Hiperautomação Academy platform locally on your machine.

### Step 1: Install System Dependencies

#### Windows:
1. Download and install Python from [python.org](https://www.python.org/downloads/)
2. Download and install Node.js from [nodejs.org](https://nodejs.org/)

#### macOS (with Homebrew):
```bash
# Install Python
brew install python

# Install Node.js
brew install node
```

#### Ubuntu/Debian:
```bash
# Update package list
sudo apt update

# Install Python and pip
sudo apt install python3 python3-pip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Step 2: Set Up MongoDB

You have two options for MongoDB:

#### Option A: Use System MongoDB (Recommended if already installed)
Install MongoDB Community Edition:
- [Windows](https://www.mongodb.com/try/download/community)
- [macOS](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-os-x/)
- [Linux](https://docs.mongodb.com/manual/administration/install-on-linux/)

#### Option B: Automatic Local MongoDB (No installation required)
Our automation scripts can automatically download and configure a local MongoDB instance.

### Step 3: Configure Backend Environment

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:
   ```bash
   # Windows
   venv\Scripts\activate
   
   # macOS/Linux
   source venv/bin/activate
   ```

4. Create a `.env` file in the backend directory with the following content:
   ```env
   # MongoDB Configuration
   MONGO_URL=mongodb://127.0.0.1:27017
   DB_NAME=hiperautomacao_academy
   
   # Security Configuration
   SECRET_KEY=hiperautomacao_secret_key_2023
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=10080
   
   # Application Configuration
   FRONTEND_URL=http://localhost:3000
   
   # Payment Configuration (optional for local testing)
   ABACATEPAY_API_KEY=your_abacatepay_api_key_here
   ABACATEPAY_ENVIRONMENT=sandbox
   
   # CORS Configuration
   CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
   ```

### Step 4: Install Backend Dependencies

1. Ensure your virtual environment is activated, then install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Verify installation:
   ```bash
   pip list
   ```

### Step 5: Run Backend Server

1. Start the FastAPI development server:
   ```bash
   uvicorn server:app --reload --host 0.0.0.0 --port 8000
   ```

2. Verify the backend is running by accessing the API documentation:
   Open your browser and go to `http://localhost:8000/docs`

### Step 6: Configure Frontend Environment

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Create a `.env` file in the frontend directory with the following content:
   ```env
   # Backend API URL
   REACT_APP_BACKEND_URL=http://localhost:8000
   
   # Default Support URL
   REACT_APP_DEFAULT_SUPPORT_URL=https://wa.me/5511999999999
   ```

### Step 7: Install Frontend Dependencies

1. Install frontend dependencies using npm or yarn:
   ```bash
   # Using npm
   npm install
   
   # Using yarn (if preferred)
   yarn install
   ```

2. Verify installation:
   ```bash
   # Check installed packages
   npm list
   ```

### Step 8: Run Frontend Application

1. Start the React development server:
   ```bash
   # Using npm
   npm start
   
   # Using yarn
   yarn start
   ```

2. The frontend development server will automatically open your browser at `http://localhost:3000`

### Step 9: Access the Application

1. Once both servers are running:
   - Backend API: `http://localhost:8000`
   - Frontend Application: `http://localhost:3000`
   - API Documentation: `http://localhost:8000/docs`
   - MongoDB: `mongodb://127.0.0.1:27017`

2. Create your first admin user:
   - Use the API documentation at `http://localhost:8000/docs` to register a new user
   - Update the user's role to "admin" in the database:
     ```bash
     mongo hiperautomacao_academy
     db.users.updateOne({email: "your-admin-email@example.com"}, {$set: {role: "admin"}})
     ```

3. Log in to the application using your admin credentials

## Automated Deployment Scripts

To simplify the deployment process, we've provided several automated scripts that handle the setup and startup of the development environment.

### Python Automation Script

The `start_dev_environment.py` script provides a cross-platform way to automatically set up and start the entire development environment:

```bash
python start_dev_environment.py
```

This script will:
1. Check all prerequisites
2. Set up and start MongoDB locally (if not available system-wide)
3. Set up backend environment (virtual environment, dependencies, .env file)
4. Set up frontend environment (dependencies, .env file)
5. Start both backend and frontend servers
6. Provide access URLs

### Platform-Specific Scripts

For Windows users, we've provided batch files:
- `start_dev_environment.bat` - Starts the complete development environment
- `start_backend.bat` - Starts only the backend server
- `start_frontend.bat` - Starts only the frontend server
- `setup_mongodb.bat` - Sets up and starts local MongoDB

For macOS/Linux users, we've provided shell scripts:
- `start_dev.sh` - Starts the complete development environment
- `setup_mongodb.sh` - Sets up and starts local MongoDB

To use these scripts, simply make them executable (on macOS/Linux) and run:

```bash
# Make script executable (macOS/Linux only)
chmod +x start_dev.sh

# Run the script
./start_dev.sh  # macOS/Linux
# or
start_dev_environment.bat  # Windows
```

## MongoDB Local Development

Our platform includes scripts to automatically set up a local MongoDB instance for development, eliminating the need to install MongoDB system-wide.

### Automatic MongoDB Setup

When using our automation scripts (`start_dev_environment.py`, `start_dev.sh`, or `start_dev_environment.bat`), MongoDB will be automatically:

1. Downloaded (if not already present)
2. Extracted to the `mongodb/` directory
3. Configured to store data in `mongodb/data/`
4. Started on `127.0.0.1:27017`

This local MongoDB instance is completely isolated from any system MongoDB installation and will not interfere with other projects.

### Manual MongoDB Setup

If you prefer to set up MongoDB manually:

#### Windows:
```cmd
setup_mongodb.bat
```

#### macOS/Linux:
```bash
chmod +x setup_mongodb.sh
./setup_mongodb.sh
```

These scripts will:
1. Create the `mongodb/` directory
2. Download the appropriate MongoDB version for your platform
3. Extract MongoDB to the `mongodb/` directory
4. Create the `mongodb/data/` directory for data storage
5. Start MongoDB with the local data directory

The MongoDB local setup will:
- Use port 27017 (default MongoDB port)
- Bind only to 127.0.0.1 (localhost only)
- Store data in `mongodb/data/` within your project directory
- Not require administrator privileges after initial setup

## Deployment

### Standardized Docker Workflow
- **Multi-stage images**: `backend/Dockerfile` (FastAPI + Gunicorn) and `frontend/Dockerfile` (CRA + Nginx) share a base layer for faster builds and smaller runtime images.
- **Environment parity**: Both compose files rely on the same variable names you configured earlier, so dev mirrors prod.
- **Mongo persistence**: A named `mongo-data` volume keeps data between container restarts in both modes.
- **Health targets**: FastAPI stays on `http://localhost:8000`, React dev server on `http://localhost:3000`, and the production Nginx container publishes port `3000`.

#### Development (`docker-compose.dev.yml`)
1. Install Docker Desktop (or another Docker Engine) and ensure it is running.
2. From the repo root, run:
   ```bash
   docker compose -f docker-compose.dev.yml up --build
   ```
3. This stack starts MongoDB, a hot-reload FastAPI server, and the React dev server with your local source mounted into each container. Changes to the `backend/` or `frontend/` folders are reflected immediately.
4. Visit `http://localhost:8000/docs` for the API and `http://localhost:3000` for the UI.
5. When you finish, press `Ctrl+C` and optionally prune state with `docker compose -f docker-compose.dev.yml down -v`.

#### Production (`docker-compose.prod.yml`)
1. Ensure `backend/.env.production` and `frontend/.env.production` exist (copy them from the `*.sample` files and fill in real values).
2. Build and start the optimized stack:
   ```bash
   docker compose -f docker-compose.prod.yml up --build -d
   ```
3. The backend image runs Gunicorn + Uvicorn workers without reload, while the frontend image bakes a static bundle that Nginx serves on port `3000`. MongoDB is not exposed publicly.
4. Use `docker compose -f docker-compose.prod.yml logs -f <service>` to follow logs and `docker compose -f docker-compose.prod.yml down` for controlled shutdowns. Add `-v` only if you want to drop the Mongo volume.

> Prefer a managed platform instead of Docker Compose? Point your orchestrator at the same Dockerfiles and supply the environment variables listed earlier; no additional changes are needed.

## API Documentation

The FastAPI backend automatically generates interactive API documentation:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is proprietary and confidential. All rights reserved.
Plataforma de ensino com foco em automação que combina um backend em FastAPI e um frontend em React para entregar gestão de cursos, engajamento social e um robusto sistema de créditos com integrações de pagamento.

## Visão geral

O backend fornece APIs para autenticação com JWT, convites, recuperação de senha, gestão de cursos/matrículas e relatórios administrativos utilizando MongoDB como banco de dados principal.【F:backend/server.py†L35-L344】【F:backend/server.py†L437-L843】 Além do catálogo de cursos, a aplicação traz feed social, gamificação, programa de indicação e um sistema de créditos que permite comprar pacotes via Abacate Pay ou liberar acesso direto a cursos.【F:backend/server.py†L1084-L1712】【F:backend/server.py†L1721-L2119】【F:backend/server.py†L3034-L3114】 O frontend criado com React, React Router e Tailwind CSS consome essas APIs para entregar experiências diferenciadas para administradores e estudantes, incluindo dashboards, player de aulas, comunidade e fluxo de pagamento.【F:frontend/src/App.js†L1-L200】【F:frontend/tailwind.config.js†L1-L82】

## Principais funcionalidades

- **Autenticação completa**: registro público, login, reset de senha via e-mail e convites com criação de senha, todos protegidos por tokens JWT.【F:backend/server.py†L437-L597】【F:backend/server.py†L1320-L1542】
- **Gestão de conteúdo educacional**: CRUD de cursos, módulos e lições, controle de publicação e checagem de acesso retrocompatível com dados legados.【F:backend/server.py†L600-L976】
- **Progresso e engajamento**: rastreamento de progresso por lição, feed social com posts/comentários, curtidas e recompensas de gamificação configuráveis.【F:backend/server.py†L985-L1234】【F:backend/server.py†L1544-L1597】【F:backend/server.py†L3068-L3114】
- **Sistema de créditos**: saldo individual, histórico de transações, compra de pacotes, matrícula com créditos e bonificação automática para indicações.【F:backend/server.py†L1602-L2094】【F:backend/server.py†L3034-L3064】
- **Integrações de pagamento**: criação e conciliação de cobranças via Abacate Pay, configuração de gateway ativo (Abacate Pay ou Hotmart) e importação de webhooks da Hotmart.【F:backend/server.py†L1774-L2083】【F:backend/server.py†L2330-L2520】
- **Configurações administrativas**: ajustes de e-mail SMTP, gamificação, pacotes de créditos, botões de suporte e estatísticas consolidadas para gestão financeira.【F:backend/server.py†L1235-L1399】【F:backend/server.py†L2150-L2405】
- **Frontend responsivo**: roteamento com áreas protegidas para admin e estudante, páginas de login/registro, dashboards, player de aulas, histórico de créditos e configurações de pagamento.【F:frontend/src/App.js†L1-L200】

## Estrutura do repositório

```
backend/           # API FastAPI, modelos e integrações
frontend/          # Aplicação React com Tailwind e componentes Radix
check_admin_access.py, *.py  # Scripts utilitários e testes de regressão
README.md          # Este documento
```

## Pré-requisitos

- Python 3.11+
- Node.js 18+ e Yarn 1.x
- MongoDB acessível para a API

## Configuração do backend

1. Crie um ambiente virtual e instale as dependências:
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```
2. Crie um arquivo `.env` em `backend/` com as variáveis necessárias (exemplo abaixo). Ajuste valores conforme seu ambiente e credenciais.
   ```dotenv
   MONGO_URL=mongodb://localhost:27017
   DB_NAME=hiperautomacao_db
   SECRET_KEY=change-me
   FRONTEND_URL=http://localhost:3000
   CORS_ORIGINS=http://localhost:3000
   ABACATEPAY_API_KEY=seu-token
   ABACATEPAY_ENVIRONMENT=sandbox
   ```
   Estas variáveis controlam a conexão com o MongoDB, assinatura JWT, URLs do frontend e integrações com Abacate Pay e CORS.【F:backend/server.py†L35-L90】【F:backend/server.py†L3230-L3235】 Configure também credenciais SMTP e chaves adicionais conforme necessário para envio de e-mails administrativos.【F:backend/server.py†L200-L208】【F:backend/server.py†L532-L559】
3. Inicie o servidor de desenvolvimento:
   ```bash
   uvicorn backend.server:app --reload --host 0.0.0.0 --port 8001
   ```
   A API expõe os endpoints sob `/api`, com autenticação Bearer baseada no token retornado pelo login.【F:backend/server.py†L92-L135】【F:backend/server.py†L379-L408】

## Configuração do frontend

1. Instale dependências e configure a URL do backend:
   ```bash
   cd frontend
   yarn install
   ```
   Crie um arquivo `.env` na pasta `frontend/` definindo `REACT_APP_BACKEND_URL=http://localhost:8001` (ou a URL pública da API). Os componentes utilizam essa variável para montar as requisições axios.【F:frontend/src/pages/LoginPage.js†L5-L54】【F:frontend/src/pages/StudentDashboard.js†L6-L92】
2. Execute o modo de desenvolvimento:
   ```bash
   yarn start
   ```
   A aplicação ficará disponível em `http://localhost:3000` com suporte a temas escuros, animações Tailwind e componentes Radix conforme a configuração de `tailwind.config.js`.【F:frontend/tailwind.config.js†L1-L82】

## Testes e scripts auxiliares

- A suíte Python utiliza `pytest`. Execute `pytest` na raiz ou dentro de `backend/` para validar o backend após configurar variáveis de ambiente e o banco de dados.【F:backend/requirements.txt†L1-L71】
- Arquivos como `enrollment_data_test.py`, `security_test.py` e `backend_test.py` fornecem checagens adicionais focadas em fluxos críticos; execute-os conforme necessário para garantir regressão mínima.

## Próximos passos

- Configure usuários administrativos via banco ou scripts utilitários para acessar o painel `/admin`.
- Personalize pacotes de créditos, recompensas de gamificação e botões de suporte pelo próprio painel administrativo após autenticação.【F:backend/server.py†L1698-L1772】【F:backend/server.py†L3068-L3114】【F:backend/server.py†L2361-L2405】
- Caso utilize gateways de pagamento em produção, substitua as chaves sandbox por credenciais reais e valide webhooks externos.【F:backend/server.py†L1774-L2083】【F:backend/server.py†L2462-L2520】

Com isso o ambiente estará pronto para evoluir novas funcionalidades, integrar conteúdo e publicar a plataforma Hiperautomação Academy.
