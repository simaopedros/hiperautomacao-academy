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

Hiperautomação Academy is a full-stack educational platform that allows administrators to create and manage courses while students can enroll, learn, and interact with the community. The platform features a credit-based economy, multiple payment gateways, and social learning features.

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

O backend fornece APIs para autenticação com JWT, convites, recuperação de senha, gestão de cursos/matrículas e relatórios administrativos utilizando MongoDB como banco de dados principal.【F:backend/server.py†L35-L344】【F:backend/server.py†L437-L843】 Além do catálogo de cursos, a aplicação traz feed social, gamificação e um sistema de créditos que permite comprar pacotes via Abacate Pay ou liberar acesso direto a cursos.【F:backend/server.py†L1084-L1712】【F:backend/server.py†L1721-L2119】【F:backend/server.py†L3034-L3114】 O frontend criado com React, React Router e Tailwind CSS consome essas APIs para entregar experiências diferenciadas para administradores e estudantes, incluindo dashboards, player de aulas, comunidade e fluxo de pagamento.【F:frontend/src/App.js†L1-L200】【F:frontend/tailwind.config.js†L1-L82】

## Principais funcionalidades

- **Autenticação completa**: registro público, login, reset de senha via e-mail e convites com criação de senha, todos protegidos por tokens JWT.【F:backend/server.py†L437-L597】【F:backend/server.py†L1320-L1542】
- **Gestão de conteúdo educacional**: CRUD de cursos, módulos e lições, controle de publicação e checagem de acesso retrocompatível com dados legados.【F:backend/server.py†L600-L976】
- **Progresso e engajamento**: rastreamento de progresso por lição, feed social com posts/comentários, curtidas e recompensas de gamificação configuráveis.【F:backend/server.py†L985-L1234】【F:backend/server.py†L1544-L1597】【F:backend/server.py†L3068-L3114】
- **Sistema de créditos**: saldo individual, histórico de transações, compra de pacotes e matrícula com créditos.【F:backend/server.py†L1602-L2094】【F:backend/server.py†L3034-L3064】
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

---

# 🎨 Guia de Estilo UI/UX - Hiperautomação Academy

Este guia define os padrões visuais e de experiência do usuário da plataforma Hiperautomação Academy, baseado no design da tela de login e componentes existentes.

## 🎯 Filosofia de Design

A plataforma adota um **design moderno e premium** com foco em:
- **Elegância minimalista** com elementos glassmorphism
- **Experiência imersiva** através de gradientes e efeitos visuais
- **Acessibilidade** com contrastes adequados e hierarquia clara
- **Responsividade** para todos os dispositivos

## 🎨 Fundamentos Visuais

### Paleta de Cores

#### Cores Primárias
```css
/* Backgrounds */
--bg-primary: #01030a;        /* Fundo principal - azul escuro profundo */
--bg-secondary: #050b16;      /* Fundo secundário */
--bg-tertiary: #02060f;       /* Fundo da tela de login */

/* Superfícies */
--surface-dark: rgba(4, 16, 27, 0.85);     /* Cards e painéis */
--surface-muted: rgba(8, 22, 35, 0.6);     /* Elementos secundários */
--surface-glass: rgba(15, 23, 42, 0.7);    /* Efeito glassmorphism */
```

#### Cores de Destaque
```css
/* Accent Colors */
--accent: #10b981;            /* Verde esmeralda - ação primária */
--accent-strong: #34d399;     /* Verde claro - hover states */
--accent-secondary: #0ea5e9;  /* Azul - ação secundária */

/* Gradientes Principais */
background: linear-gradient(130deg, #10b981 0%, #0ea5e9 100%);
background: linear-gradient(135deg, #10b981 0%, #0ea5e9 100%);
```

#### Cores de Texto
```css
--text-primary: #f8fafc;      /* Texto principal - branco suave */
--text-muted: #94a3b8;        /* Texto secundário - cinza */
--text-accent: #10b981;       /* Texto de destaque */
```

#### Cores de Estado
```css
/* Estados */
--success: #10b981;           /* Sucesso */
--error: #ef4444;             /* Erro */
--warning: #f59e0b;           /* Aviso */
--info: #3b82f6;              /* Informação */
```

### Bordas e Sombras

#### Bordas
```css
--border-color: rgba(255, 255, 255, 0.08);    /* Borda padrão */
--border-strong: rgba(255, 255, 255, 0.18);   /* Borda enfatizada */
--border-accent: rgba(16, 185, 129, 0.4);     /* Borda com accent */
```

#### Sombras
```css
--shadow-strong: 0 30px 120px rgba(2, 6, 23, 0.75);
--shadow-soft: 0 14px 45px rgba(15, 118, 110, 0.25);
--shadow-card: 0 25px 90px rgba(0, 0, 0, 0.55);
--shadow-button: 0 12px 30px rgba(16, 185, 129, 0.35);
```

#### Raios de Borda
```css
--radius-sm: 8px;             /* Pequeno */
--radius-md: 16px;            /* Médio */
--radius-lg: 24px;            /* Grande */
--radius-xl: 32px;            /* Extra grande */
--radius-full: 999px;         /* Circular */
```

## 📝 Tipografia

### Família de Fontes
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
```

### Hierarquia Tipográfica

#### Títulos
```css
/* H1 - Título Principal */
.title-primary {
  font-size: 3rem;           /* 48px */
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

/* H2 - Título Secundário */
.title-secondary {
  font-size: 2rem;           /* 32px */
  font-weight: 600;
  line-height: 1.2;
}

/* H3 - Subtítulo */
.title-tertiary {
  font-size: 1.5rem;         /* 24px */
  font-weight: 600;
  line-height: 1.3;
}
```

#### Texto Corpo
```css
/* Texto Principal */
.text-body {
  font-size: 1rem;           /* 16px */
  font-weight: 400;
  line-height: 1.6;
}

/* Texto Pequeno */
.text-small {
  font-size: 0.875rem;       /* 14px */
  font-weight: 400;
  line-height: 1.5;
}

/* Texto Micro */
.text-micro {
  font-size: 0.75rem;        /* 12px */
  font-weight: 500;
  line-height: 1.4;
  text-transform: uppercase;
  letter-spacing: 0.4em;
}
```

#### Texto Especial
```css
/* Texto com Gradiente */
.gradient-text {
  background: linear-gradient(135deg, #10b981 0%, #0ea5e9 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

## 🧩 Componentes

### Botões

#### Botão Primário
```css
.btn-primary {
  background: linear-gradient(130deg, #10b981 0%, #0ea5e9 100%);
  color: #f8fafc;
  padding: 14px 36px;
  border-radius: 16px;
  border: none;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
  box-shadow: 0 14px 45px rgba(15, 118, 110, 0.25);
}

.btn-primary:hover {
  transform: translateY(-2px) scale(1.01);
  box-shadow: 0 18px 35px rgba(16, 185, 129, 0.35);
}
```

#### Botão Secundário
```css
.btn-secondary {
  background: rgba(15, 23, 42, 0.65);
  color: #f8fafc;
  padding: 12px 32px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: transform 0.25s ease, border-color 0.25s ease;
}

.btn-secondary:hover {
  background: rgba(15, 23, 42, 0.85);
  border-color: rgba(255, 255, 255, 0.18);
  transform: translateY(-1px);
}
```

### Campos de Entrada

#### Input Padrão
```css
.input-field {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #f8fafc;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 16px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  width: 100%;
}

.input-field:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
}

.input-field::placeholder {
  color: #94a3b8;
}
```

### Cards e Superfícies

#### Card Principal
```css
.card {
  background: rgba(4, 16, 27, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  padding: 24px;
  box-shadow: 0 30px 120px rgba(2, 6, 23, 0.75);
  transition: transform 0.3s ease, border-color 0.3s ease;
}

.card:hover {
  border-color: rgba(255, 255, 255, 0.18);
  transform: translateY(-4px);
}
```

#### Glass Panel
```css
.glass-panel {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 32px;
  backdrop-filter: blur(18px);
  box-shadow: 0 25px 90px rgba(0, 0, 0, 0.55);
}
```

### Elementos de Feedback

#### Mensagem de Erro
```css
.error-message {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.5);
  color: #fca5a5;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
}
```

#### Mensagem de Sucesso
```css
.success-message {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.5);
  color: #6ee7b7;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
}
```

## 📐 Layout e Espaçamento

### Sistema de Espaçamento
```css
/* Escala de espaçamento baseada em 4px */
--space-1: 4px;     /* 0.25rem */
--space-2: 8px;     /* 0.5rem */
--space-3: 12px;    /* 0.75rem */
--space-4: 16px;    /* 1rem */
--space-6: 24px;    /* 1.5rem */
--space-8: 32px;    /* 2rem */
--space-12: 48px;   /* 3rem */
--space-16: 64px;   /* 4rem */
--space-20: 80px;   /* 5rem */
--space-24: 96px;   /* 6rem */
```

### Grid System
```css
/* Container Principal */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

/* Grid Responsivo */
.grid {
  display: grid;
  gap: 24px;
}

.grid-cols-1 { grid-template-columns: repeat(1, 1fr); }
.grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
.grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
.grid-cols-4 { grid-template-columns: repeat(4, 1fr); }
```

### Breakpoints
```css
/* Mobile First */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
@media (min-width: 1536px) { /* 2xl */ }
```

## ✨ Animações e Transições

### Animações Padrão
```css
/* Fade In */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fadeIn 0.5s ease-out;
}

/* Slide In */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.animate-slide-in {
  animation: slideIn 0.4s ease-out;
}
```

### Transições
```css
/* Transições Suaves */
.transition-smooth {
  transition: all 0.25s ease;
}

.transition-colors {
  transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
}

.transition-transform {
  transition: transform 0.25s ease;
}
```

## 🎭 Estados Interativos

### Estados de Hover
```css
/* Elevação suave */
.hover-lift:hover {
  transform: translateY(-2px);
}

/* Escala sutil */
.hover-scale:hover {
  transform: scale(1.02);
}

/* Brilho */
.hover-glow:hover {
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.3);
}
```

### Estados de Foco
```css
.focus-ring:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
}
```

## 📱 Responsividade

### Princípios Mobile-First
1. **Design para mobile primeiro**, depois adapte para desktop
2. **Touch targets** mínimos de 44px
3. **Espaçamento adequado** entre elementos interativos
4. **Tipografia legível** em todos os tamanhos de tela

### Adaptações por Dispositivo
```css
/* Mobile (até 640px) */
.mobile-padding { padding: 16px; }
.mobile-text { font-size: 14px; }

/* Tablet (640px - 1024px) */
@media (min-width: 640px) {
  .tablet-padding { padding: 24px; }
  .tablet-text { font-size: 16px; }
}

/* Desktop (1024px+) */
@media (min-width: 1024px) {
  .desktop-padding { padding: 32px; }
  .desktop-text { font-size: 18px; }
}
```

## 🔧 Implementação

### Estrutura CSS Recomendada
```css
/* 1. Reset e Base */
@import 'reset.css';
@import 'base.css';

/* 2. Variáveis e Tokens */
@import 'tokens.css';

/* 3. Componentes */
@import 'components/buttons.css';
@import 'components/forms.css';
@import 'components/cards.css';

/* 4. Layouts */
@import 'layouts/grid.css';
@import 'layouts/containers.css';

/* 5. Utilitários */
@import 'utilities.css';
```

### Boas Práticas

#### Nomenclatura
- Use **BEM** para classes CSS complexas
- Prefira **utility classes** para espaçamentos e cores
- Mantenha **consistência** na nomenclatura

#### Performance
- Use **CSS custom properties** para temas
- Minimize **reflows** com transform em vez de position
- Otimize **animações** com will-change quando necessário

#### Acessibilidade
- Mantenha **contraste mínimo** de 4.5:1 para texto
- Use **focus indicators** visíveis
- Teste com **leitores de tela**

---

Este guia deve ser seguido para manter a consistência visual e a qualidade da experiência do usuário em toda a plataforma Hiperautomação Academy.
