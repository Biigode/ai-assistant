# 📰 AI Assistant Bot

Assistente de IA para Telegram com resumo diário de notícias, chat inteligente e agentes de pesquisa.

## Stack

| Camada | Tecnologia |
|---|---|
| Linguagem | Node.js (ES Modules) |
| Mensageria | RabbitMQ |
| Busca | Ollama Web Search API |
| LLM | Ollama (local + cloud) |
| Banco de dados | MongoDB |
| Mensagens | Telegram Bot |
| Agendamento | node-cron |
| Container | Docker Compose |

---

## Pré-requisitos

- Node.js 18+
- [Ollama](https://ollama.com/) instalado e rodando localmente
- Docker e Docker Compose
- Conta no Telegram

---

## Instalação

```bash
git clone <repo>
cd ai-assistant
npm install
cp .env.example .env
```

---

## Configuração

### 1. Ollama (LLM Local)

```bash
# Instalar Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Baixar modelo
ollama pull qwen2.5:3b

# Iniciar servidor
ollama serve
```

### 2. Docker Compose (MongoDB + RabbitMQ)

```bash
docker-compose up -d mongodb rabbitmq
```

- **MongoDB**: porta 27017
- **RabbitMQ**: porta 5672 (management: http://localhost:15672)

### 3. Telegram Bot

1. Fale com [@BotFather](https://t.me/BotFather)
2. Use `/newbot` para criar o bot
3. Copie o **Bot Token**
4. Cole no `.env`:
```
TELEGRAM_BOT_TOKEN=seu_token_aqui
```

### 4. Ollama Cloud (Opcional)

Para tarefas de raciocínio profundo:

1. Crie conta em https://ollama.com
2. Gere uma API Key em **Settings → API Keys**
3. Adicione no `.env`:
```
OLLAMA_API_KEY=sua_chave_aqui
```

O sistema escolhe automaticamente:
- **Modelos cloud**: para raciocínio profundo (agentes, análise)
- **Modelos locais**: fallback quando offline

### 5. Configurar Interesses

```bash
npm run setup
```

O script pergunta seus interesses e salva no MongoDB.

---

## Executar

### Com Docker Compose (Recomendado)

```bash
# Iniciar todos os serviços
docker-compose up -d

# Ver logs
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f worker-intent
```

### Localmente

```bash
# Iniciar workers (em terminais separados)
node src/workers/intent.js
node src/workers/search.js
node src/workers/response.js
node src/workers/telegram-sender.js

# Iniciar o Telegram producer
node src/telegram-producer.js

# Iniciar o app principal (cron)
npm start

# Enviar digest agora
npm start -- --now
```

---

## Arquitetura

### Estrutura do Projeto

```
src/
├── index.js              # Entry point + cron scheduler
├── setup.js              # CLI interativo para configurar interesses
├── digest.js             # Orquestrador: busca → LLM → Telegram
├── search.js             # Ollama Web Search API
├── llm.js                # Conexões Ollama
├── agents.js             # Agentes de pesquisa (Researcher, Analyst, Writer)
├── model-router.js       # Seleciona modelo cloud/local
├── memory.js             # Histórico de conversas persistido
├── queue.js              # Conexão RabbitMQ
├── telegram.js           # Envio via Telegram Bot
├── telegram-producer.js  # Recebe mensagens → fila
├── telegram-polling.js    # Polling do Telegram
├── telegram-commands.js   # Comandos do bot
├── chat.js               # Chat inteligente com LLM
├── db.js                 # Conexão MongoDB
├── workers/
│   ├── intent.js         # Classifica intents
│   ├── search.js         # Realiza buscas na web
│   ├── response.js       # Gera respostas com LLM
│   └── telegram-sender.js # Envia mensagens ao Telegram
```

---

## Arquitetura de Filas (RabbitMQ)

```
Telegram ──▶ Intent Queue ──▶ Intent Worker (classifica)
                              │
         ┌────────────────────┴────────────────────┐
         ▼                                         ▼
  Search Queue                              Response Queue
  (intent=search)                           (intent=chat)
         │                                         │
         ▼                                         ▼
  Search Worker                              Response Worker
         │                                         │
         └────────────────────┬────────────────────┘
                               ▼
                        Telegram Sender
```

### Filas
| Fila | Descrição |
|------|-----------|
| `telegram.incoming` | Mensagens recebidas |
| `intent.classify` | Classificação de intent |
| `web.search` | Buscas na web |
| `response.generate` | Geração de resposta |
| `telegram.outgoing` | Mensagens para enviar |

### Workers
| Worker | Função |
|--------|--------|
| `telegram-producer` | Recebe mensagens do Telegram |
| `worker-intent` | Classifica intent (search/chat/digest) |
| `worker-search` | Realiza buscas na web |
| `worker-response` | Gera respostas com LLM |
| `worker-sender` | Envia mensagens ao Telegram |

---

## Recursos

### Model Router

Sistema inteligente que seleciona o melhor modelo baseado na tarefa:
- **Raciocínio**: `gpt-oss:20b-cloud` → `qwen3.5` → local
- **Chat/Digest**: `qwen3.5:4b-cloud` → local

### Agentes de Pesquisa

- **Researcher**: Coleta fontes sobre o tópico
- **Analyst**: Analisa e sintetiza informações
- **Writer**: Gera o conteúdo final

### Memória Persistente

Histórico de conversas salvo no MongoDB (janela de 10 mensagens).

---

## Docker Compose - Serviços

| Serviço | Descrição | Porta |
|---------|-----------|-------|
| `mongodb` | Banco de dados | 27017 |
| `rabbitmq` | Message broker | 5672, 15672 |
| `app` | Digest diário (cron) | - |
| `worker-intent` | Classifica intents | - |
| `worker-search` | Busca na web | - |
| `worker-response` | Gera respostas | - |
| `worker-sender` | Envia mensagens | - |

---

## Dicas

- **Testar sem esperar cron**: `npm start -- --now`
- **Trocar modelo LLM**: edite `OLLAMA_MODEL` no `.env`
- **Multiple users**: rode `npm run setup` várias vezes
- **RabbitMQ UI**: http://localhost:15672 (guest/guest)
