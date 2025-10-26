# Scripts de Automação do Hiperautomação Academy

Este documento descreve os scripts de automação disponíveis para facilitar o desenvolvimento e implantação do projeto Hiperautomação Academy.

## Índice

1. [Scripts Python](#scripts-python)
2. [Scripts Batch (Windows)](#scripts-batch-windows)
3. [Scripts Shell (macOS/Linux)](#scripts-shell-macoslinux)
4. [Scripts de Configuração do MongoDB](#scripts-de-configuração-do-mongodb)
5. [Como Usar](#como-usar)

## Scripts Python

### `start_dev_environment.py`

Script Python multiplataforma que automatiza todo o processo de configuração e inicialização do ambiente de desenvolvimento.

**Características:**
- Verifica pré-requisitos (Python, Node.js)
- Configura e inicia o MongoDB localmente (se não estiver disponível no sistema)
- Configura o ambiente do backend (ambiente virtual, dependências, arquivo .env)
- Configura o ambiente do frontend (dependências, arquivo .env)
- Inicia ambos os servidores (backend e frontend)
- Fornece URLs de acesso
- Trata interrupções (Ctrl+C) para encerrar os processos adequadamente

**Uso:**
```bash
python start_dev_environment.py
```

## Scripts Batch (Windows)

### `start_dev_environment.bat`

Script principal para Windows que inicia todo o ambiente de desenvolvimento.

**Características:**
- Verifica e inicia o MongoDB (sistema ou local)
- Inicia o backend em uma nova janela
- Aguarda a inicialização do backend
- Inicia o frontend em uma nova janela
- Fornece informações de acesso

**Uso:**
```cmd
start_dev_environment.bat
```

### `start_backend.bat`

Script para iniciar apenas o servidor backend no Windows.

**Características:**
- Navega para o diretório backend
- Cria e ativa o ambiente virtual se necessário
- Instala/atualiza dependências
- Cria o arquivo .env se necessário
- Inicia o servidor uvicorn

**Uso:**
```cmd
start_backend.bat
```

### `start_frontend.bat`

Script para iniciar apenas o servidor frontend no Windows.

**Características:**
- Navega para o diretório frontend
- Instala dependências usando yarn ou npm
- Cria o arquivo .env se necessário
- Inicia o servidor de desenvolvimento

**Uso:**
```cmd
start_frontend.bat
```

### `setup_mongodb.bat`

Script para configurar e iniciar o MongoDB localmente no Windows.

**Características:**
- Baixa o MongoDB Community Edition portable
- Extrai os arquivos
- Inicia o MongoDB com os dados armazenados localmente
- Configura o MongoDB para escutar na porta 27017

**Uso:**
```cmd
setup_mongodb.bat
```

## Scripts Shell (macOS/Linux)

### `start_dev.sh`

Script shell para macOS e Linux que inicia todo o ambiente de desenvolvimento.

**Características:**
- Verifica pré-requisitos
- Inicia o MongoDB (sistema ou local)
- Configura e inicia o backend
- Configura e inicia o frontend
- Fornece URLs de acesso
- Trata sinais de interrupção para encerrar os processos adequadamente

**Uso:**
```bash
# Tornar o script executável
chmod +x start_dev.sh

# Executar o script
./start_dev.sh
```

### `setup_mongodb.sh`

Script para configurar e iniciar o MongoDB localmente no macOS/Linux.

**Características:**
- Detecta a arquitetura do sistema (Intel/Apple Silicon)
- Baixa a versão apropriada do MongoDB
- Extrai os arquivos
- Inicia o MongoDB com os dados armazenados localmente
- Configura o MongoDB para escutar na porta 27017

**Uso:**
```bash
# Tornar o script executável
chmod +x setup_mongodb.sh

# Executar o script
./setup_mongodb.sh
```

## Scripts de Configuração do MongoDB

### Funcionalidades do MongoDB Local

Os scripts de configuração do MongoDB fornecem:

1. **Download Automático**: Baixa a versão mais recente do MongoDB Community Edition
2. **Armazenamento Local**: Armazena os dados do banco em `mongodb/data/` dentro do projeto
3. **Configuração Padrão**: Configura o MongoDB para escutar em `127.0.0.1:27017`
4. **Isolamento**: Não interfere com instalações do MongoDB no sistema

### Estrutura de Diretórios

```
hiperautomação-academy/
├── mongodb/
│   ├── data/              # Dados do MongoDB (criado automaticamente)
│   ├── mongodb-*/         # MongoDB extraído (criado automaticamente)
│   └── mongodb*.zip/tgz   # Arquivo baixado (removido após extração)
├── setup_mongodb.bat      # Script Windows
└── setup_mongodb.sh       # Script macOS/Linux
```

## Como Usar

### Método 1: Script Python (Recomendado - Multiplataforma)

1. Certifique-se de ter Python 3.8+ instalado
2. Execute o script principal:
   ```bash
   python start_dev_environment.py
   ```

### Método 2: Scripts Windows

1. Certifique-se de ter todas as dependências instaladas
2. Execute o script principal:
   ```cmd
   start_dev_environment.bat
   ```

### Método 3: Scripts macOS/Linux

1. Certifique-se de ter todas as dependências instaladas
2. Tornar o script executável:
   ```bash
   chmod +x start_dev.sh
   ```
3. Execute o script:
   ```bash
   ./start_dev.sh
   ```

## Personalização

Todos os scripts podem ser personalizados conforme necessário:

### Variáveis de Ambiente

Os scripts criam automaticamente arquivos `.env` com configurações padrão. Você pode modificar esses arquivos após a criação para atender às suas necessidades específicas.

### Configurações de Porta

Por padrão, os scripts usam:
- MongoDB: porta 27017
- Backend: porta 8000
- Frontend: porta 3000

Você pode modificar essas portas diretamente nos scripts se necessário.

## Solução de Problemas

### Problemas Comuns

1. **Permissões insuficientes:**
   - No Windows, execute os scripts como administrador se necessário
   - No macOS/Linux, certifique-se de ter permissões adequadas para iniciar serviços

2. **Dependências ausentes:**
   - Certifique-se de ter instalado todas as dependências do sistema antes de executar os scripts

3. **Serviços já em execução:**
   - Os scripts tratam casos onde os serviços já estão em execução

4. **Problemas com ambientes virtuais:**
   - Os scripts criam automaticamente ambientes virtuais se necessário

5. **Problemas com download do MongoDB:**
   - Verifique sua conexão com a internet
   - O download do MongoDB é de aproximadamente 100MB

### Logs e Debugging

- Todos os scripts exibem informações detalhadas durante a execução
- Em caso de falhas, as mensagens de erro ajudam a identificar o problema
- Os servidores backend e frontend continuam exibindo seus logs normais
- O MongoDB exibe seus logs na janela onde foi iniciado

## Contribuindo

Se você criar scripts adicionais ou melhorar os existentes:

1. Siga as convenções de nomenclatura existentes
2. Adicione comentários explicativos
3. Teste em múltiplas plataformas quando apropriado
4. Atualize esta documentação conforme necessário