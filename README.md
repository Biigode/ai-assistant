# 📰 Daily Digest Bot

Receba um resumo diário personalizado de notícias no Telegram, gerado com IA local (Ollama) e buscado via Ollama Web Search.

## Stack

| Camada | Tecnologia |
|---|---|
| Linguagem | Node.js (ES Modules) |
| Busca | Ollama Web Search API |
| LLM Local | Ollama (`llama3.2:1b`) |
| Banco de dados | MongoDB Atlas (NoSQL) |
| Mensagens | Telegram Bot |
| Agendamento | node-cron |

---

## Pré-requisitos

- Node.js 18+
- [Ollama](https://ollama.com/) instalado e rodando localmente
- Conta gratuita no [MongoDB Atlas](https://www.mongodb.com/atlas)
- Conta no Telegram

---

## 1. Instalação

```bash
git clone <repo>
cd daily-digest
npm install
cp .env.example .env
```

---

## 2. Configurar o Ollama (LLM + Busca Local)

```bash
# Instalar Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Baixar modelo pequeno e eficiente (apenas ~1GB)
ollama pull llama3.2:1b

# Alternativas ainda menores:
# ollama pull qwen2.5:1.5b   (~1GB)
# ollama pull phi3.5:mini    (~2.2GB)

# Iniciar o servidor Ollama
ollama serve
```

---

## 3. Configurar MongoDB Atlas

1. Crie conta gratuita em https://www.mongodb.com/atlas
2. Crie um cluster **M0 Free Tier**
3. Em **Database Access**: crie usuário com senha
4. Em **Network Access**: adicione `0.0.0.0/0` (acesso de qualquer IP)
5. Clique em **Connect → Drivers** e copie a URI
6. Cole no `.env`:
```
MONGODB_URI=mongodb+srv://usuario:senha@cluster.mongodb.net/daily-digest
```

---

## 4. Configurar Telegram Bot

1. No Telegram, inicie uma conversa com [@BotFather](https://t.me/BotFather)
2. Use o comando `/newbot` para criar um novo bot
3. Siga as instruções e copie o **Bot Token**
4. Inicie uma conversa com seu novo bot
5. Descubra seu **Chat ID** enviando uma mensagem para [@userinfobot](https://t.me/userinfobot)
6. Cole no `.env`:
```
TELEGRAM_BOT_TOKEN=seu_bot_token_aqui
TELEGRAM_CHAT_ID=seu_chat_id_aqui
```

---

## 5. Configurar seus interesses

```bash
npm run setup
```

O script vai:
1. Perguntar seu número e nome
2. Deixar você descrever seus interesses livremente em português
3. Usar o LLM local para extrair os tópicos
4. Confirmar os tópicos e salvar no MongoDB Atlas

---

## 6. Executar

```bash
# Iniciar o bot (aguarda o horário agendado)
npm start

# Enviar digest imediatamente (para testar)
npm start -- --now
```

---

## Estrutura do Projeto

```
daily-digest/
├── src/
│   ├── index.js            # Entry point + cron scheduler
│   ├── setup.js            # CLI interativo para configurar interesses
│   ├── digest.js           # Orquestrador: busca → LLM → Telegram
│   ├── search.js           # Ollama Web Search API
│   ├── llm.js              # Ollama: extração de interesses + geração de digest
│   ├── telegram.js         # Envio via Telegram Bot
│   ├── telegram-polling.js # Polling do Telegram
│   ├── telegram-commands.js # Comandos do bot
│   ├── chat.js             # Chat com o bot via LLM
│   ├── db.js               # Conexão MongoDB Atlas
│   └── test-telegram.js    # Script de teste
├── models/
│   └── UserPreferences.js  # Schema Mongoose
├── .env.example
├── package.json
└── README.md
```

---

## Fluxo de Funcionamento

```
[node-cron — horário configurado]
          ↓
[Busca usuários ativos no MongoDB Atlas]
          ↓
[Para cada usuário:]
  → Pega interesses do MongoDB
  → Busca artigos via Ollama Web Search
  → LLM local (Ollama) gera resumo personalizado
  → Envia via Telegram Bot
  → Atualiza lastDigestSentAt no MongoDB
```

---

## Dicas

- **Múltiplos usuários**: rode `npm run setup` várias vezes com telefones diferentes
- **Testar sem esperar o cron**: `npm start -- --now`
- **Trocar modelo LLM**: edite `OLLAMA_MODEL` no `.env` (ex: `phi3.5:mini` para PCs com menos RAM)
- **Chat com o bot**: converse diretamente com o bot no Telegram para fazer perguntas
