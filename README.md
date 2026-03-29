# 📰 AI Assistant Bot

Assistente de IA para Telegram com resumo diário de notícias, chat inteligente e agentes de pesquisa.

## Stack

| Camada         | Tecnologia                         |
| -------------- | ---------------------------------- |
| Linguagem      | TypeScript (ES Modules)            |
| Runtime        | Node.js 20                         |
| Mensageria     | RabbitMQ                           |
| Busca          | Ollama Web Search API              |
| LLM            | Ollama (local + cloud)             |
| Banco de dados | MongoDB 7                          |
| Mensagens      | Telegram Bot API                   |
| Agendamento    | node-cron                          |
| Container      | Docker Compose (multi-stage build) |

---

## Pré-requisitos

- Node.js 20+
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

### 5. Variáveis de ambiente

```env
TELEGRAM_BOT_TOKEN=seu_token
OLLAMA_API_KEY=sua_chave           # opcional — ativa modelos cloud
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CLOUD_URL=https://ollama.com
OLLAMA_MODEL=qwen2.5:3b            # modelo local
OLLAMA_MODEL_REASONING=gpt-oss:20b-cloud
OLLAMA_MODEL_CHAT=qwen3.5:4b-cloud
MONGODB_URI=mongodb://localhost:27017/ai-assistant
RABBITMQ_URL=amqp://guest:guest@localhost:5672
CRON_SCHEDULE=0 8 * * *
TIMEZONE=America/Sao_Paulo
```

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

### Localmente (desenvolvimento)

```bash
# Build do TypeScript
npm run build

# Iniciar app principal (polling + cron)
npm start

# Ou em modo dev com tsx (hot reload)
npm run dev

# Enviar digest agora
npm start -- --now

# Iniciar workers individualmente (em terminais separados)
npm run queue:message-handler
npm run queue:intent
npm run queue:search
npm run queue:response
npm run queue:sender
```

---

## Arquitetura

### Estrutura do Projeto

```
src/
├── index.ts                       # Entry point — polling Telegram + cron scheduler
├── chat.ts                        # Chat inteligente com LLM + memória
├── ai/
│   ├── agents.ts                  # Pipeline de agentes (Researcher → Analyst → Writer)
│   ├── analysis.ts                # Análise aprofundada de tópicos
│   ├── llm.ts                     # Conexões Ollama (local + cloud)
│   └── model-router.ts            # Seleção automática de modelo por tarefa
├── core/
│   ├── db.ts                      # Conexão MongoDB
│   ├── memory.ts                  # Histórico de conversas persistido
│   └── queue.ts                   # Conexão e helpers RabbitMQ
├── features/
│   ├── core/
│   │   └── search.ts              # Ollama Web Search API
│   └── news/
│       └── summary.ts             # Orquestrador: busca → LLM → Telegram
├── models/
│   └── UserPreferences.ts         # CRUD de preferências do usuário (MongoDB)
├── queue-workers/
│   ├── message-handler.ts         # Processa mensagens e callbacks do Telegram
│   ├── intent.ts                  # Classifica intent (search/chat/digest)
│   ├── search.ts                  # Realiza buscas na web
│   ├── response.ts                # Gera respostas com LLM
│   └── telegram-sender.ts         # Envia mensagens ao Telegram
├── telegram/
│   ├── polling.ts                 # Long polling do Telegram
│   ├── telegram-api.ts            # Wrapper da Telegram Bot API
│   └── telegram-menus.ts          # Menus inline do bot
└── types/
    ├── index.ts                   # Tipos do domínio (Analysis, SearchResult, etc.)
    ├── queue.ts                   # Payloads das filas RabbitMQ
    └── telegram.ts                # Tipos Telegram (InlineButton, etc.)
```

---

## Arquitetura de Filas (RabbitMQ)

```
Telegram Polling
       │
       ▼
  telegram.incoming ──▶ Message Handler (classifica + roteia)
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
  web.search           intent.classify      response.generate
  (intent=search)      (classificação)      (intent=chat)
         │                    │                    │
         ▼                    ▼                    ▼
  Search Worker        Intent Worker        Response Worker
         │                    │                    │
         └────────────────────┼────────────────────┘
                              ▼
                     telegram.outgoing
                              │
                              ▼
                      Telegram Sender
```

### Filas

| Fila                | Descrição                         |
| ------------------- | --------------------------------- |
| `telegram.incoming` | Mensagens e callbacks recebidos   |
| `intent.classify`   | Classificação de intent           |
| `web.search`        | Buscas na web                     |
| `response.generate` | Geração de resposta com LLM       |
| `telegram.outgoing` | Mensagens para enviar ao Telegram |

### Workers

| Worker            | Comando                         | Função                                 |
| ----------------- | ------------------------------- | -------------------------------------- |
| `message-handler` | `npm run queue:message-handler` | Processa mensagens, menus e callbacks  |
| `intent`          | `npm run queue:intent`          | Classifica intent (search/chat/digest) |
| `search`          | `npm run queue:search`          | Realiza buscas na web via Ollama       |
| `response`        | `npm run queue:response`        | Gera respostas com LLM                 |
| `sender`          | `npm run queue:sender`          | Envia mensagens ao Telegram            |

---

## Recursos

### Model Router

Sistema inteligente que seleciona o melhor modelo baseado na tarefa:

- **Raciocínio** (agentes, briefings): `gpt-oss:20b-cloud` → `qwen3.5` → local
- **Chat/Digest** (tarefas simples): `qwen3.5:4b-cloud` → `gpt-oss` → local

Modelos cloud ficam em cache por 5 minutos. Se indisponíveis, o fallback local é usado automaticamente.

### Agentes de Pesquisa

Pipeline de 3 estágios para investigação profunda:

1. **Researcher** — busca fontes diversas sobre o tópico (3 queries paralelas)
2. **Analyst** — analisa e sintetiza as fontes em JSON estruturado (pontos, impacto, ângulos de vídeo)
3. **Writer** — gera o conteúdo final formatado para Telegram

### Memória Persistente

Histórico de conversas salvo no MongoDB (janela de 10 mensagens por usuário).

### Menus Interativos

Bot com menus inline para configuração de interesses, estilo de resumo, horário e geração de roteiros.

---

## Docker Compose — Serviços

| Serviço                  | Descrição                      | Porta       |
| ------------------------ | ------------------------------ | ----------- |
| `mongodb`                | Banco de dados (Mongo 7)       | 27017       |
| `rabbitmq`               | Message broker (management UI) | 5672, 15672 |
| `app`                    | Entry point — polling + cron   | —           |
| `worker-message-handler` | Processa mensagens/callbacks   | —           |
| `worker-intent`          | Classifica intents             | —           |
| `worker-search`          | Busca na web                   | —           |
| `worker-response`        | Gera respostas                 | —           |
| `worker-sender`          | Envia mensagens                | —           |

---

## Scripts npm

| Script            | Descrição                             |
| ----------------- | ------------------------------------- |
| `npm run build`   | Compila TypeScript para `dist/`       |
| `npm start`       | Inicia app compilado (polling + cron) |
| `npm run dev`     | Inicia com `tsx` (dev, sem build)     |
| `npm run polling` | Apenas polling do Telegram (dev)      |
| `npm run queue:*` | Inicia workers individuais            |

---

## Dicas

- **Testar sem esperar cron**: `npm start -- --now`
- **Trocar modelo LLM**: edite `OLLAMA_MODEL` no `.env`
- **Dev com hot reload**: `npm run dev`
- **RabbitMQ UI**: http://localhost:15672 (guest/guest)
