# 📰 Daily Digest Bot

Receba um resumo diário personalizado de notícias no WhatsApp, gerado com IA local (Ollama) e buscado no Google.

## Stack

| Camada | Tecnologia |
|---|---|
| Linguagem | Node.js (ES Modules) |
| Busca | Google Custom Search API |
| LLM Local | Ollama (`llama3.2:1b`) |
| Banco de dados | MongoDB Atlas (NoSQL) |
| WhatsApp | CallMeBot (gratuito) |
| Agendamento | node-cron |

---

## Pré-requisitos

- Node.js 18+
- [Ollama](https://ollama.com/) instalado e rodando localmente
- Conta gratuita no [MongoDB Atlas](https://www.mongodb.com/atlas)
- Conta no [Google Cloud](https://console.cloud.google.com/) para a API de busca
- WhatsApp para receber as mensagens

---

## 1. Instalação

```bash
git clone <repo>
cd daily-digest
npm install
cp .env.example .env
```

---

## 2. Configurar o Ollama (LLM Local)

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

## 4. Configurar Google Custom Search API

1. Acesse https://console.cloud.google.com/
2. Crie um projeto novo
3. Ative a **Custom Search API**
4. Crie uma **API Key** em Credenciais
5. Acesse https://programmablesearchengine.google.com/
6. Crie um mecanismo de busca (marque "Pesquisar na Web inteira")
7. Copie o **Search Engine ID (cx)**
8. Cole no `.env`:
```
GOOGLE_API_KEY=sua_key
GOOGLE_CX=seu_cx_id
```

> ⚠️ Limite gratuito: 100 consultas/dia. Com 5 tópicos = 20 dias por mês.

---

## 5. Configurar CallMeBot (WhatsApp)

1. Adicione o número **+34 644 59 87 47** nos seus contatos do WhatsApp
2. Envie a mensagem: `I allow callmebot to send me messages`
3. Aguarde a resposta com sua **API Key**
4. Cole no `.env`:
```
CALLMEBOT_PHONE=5511999999999   # seu número com DDI, sem +
CALLMEBOT_APIKEY=1234567
```

---

## 6. Configurar seus interesses

```bash
npm run setup
```

O script vai:
1. Perguntar seu número e nome
2. Deixar você descrever seus interesses livremente em português
3. Usar o LLM local para extrair os tópicos
4. Confirmar os tópicos e salvar no MongoDB Atlas

---

## 7. Executar

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
│   ├── index.js      # Entry point + cron scheduler
│   ├── setup.js      # CLI interativo para configurar interesses
│   ├── digest.js     # Orquestrador: busca → LLM → WhatsApp
│   ├── search.js     # Google Custom Search API
│   ├── llm.js        # Ollama: extração de interesses + geração de digest
│   ├── whatsapp.js   # Envio via CallMeBot
│   └── db.js         # Conexão MongoDB Atlas
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
  → Busca artigos no Google Custom Search API
  → LLM local (Ollama) gera resumo personalizado
  → Envia via CallMeBot → WhatsApp
  → Atualiza lastDigestSentAt no MongoDB
```

---

## Dicas

- **Múltiplos usuários**: rode `npm run setup` várias vezes com telefones diferentes
- **Testar sem esperar o cron**: `npm start -- --now`
- **Trocar modelo LLM**: edite `OLLAMA_MODEL` no `.env` (ex: `phi3.5:mini` para PCs com menos RAM)
- **Consumo de API**: cada execução usa ~1 req de busca por tópico de interesse
