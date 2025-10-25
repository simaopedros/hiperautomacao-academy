# Hiperautomação Academy

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
