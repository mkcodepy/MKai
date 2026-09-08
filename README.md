# AtendeAI Console

Plataforma web para **configurar e gerenciar assistentes de IA para atendimento ao cliente**, com conversas naturais, continuidade de contexto e fidelidade à base de conhecimento de cada negócio. Primeiro canal: **WhatsApp via QR Code** (sem API oficial), com **simulador interno** para testar todo o fluxo.

> Stack: **FastAPI + MongoDB** (backend) · **React + Tailwind + shadcn/ui** (frontend) · **Baileys** (microserviço WhatsApp em Node) · LLMs via **Emergent Universal Key** (OpenAI / Anthropic / Google Gemini).

---

## ✨ Recursos
- **Assistentes de IA** totalmente configuráveis: provedor/modelo, personalidade, tom, idioma, instruções, **regras/guardrails**, objetivos comerciais, mensagens de saudação/fallback e **regras de handoff**.
- **Base de Conhecimento**: cole textos/Q&A **ou** faça upload de **PDF/DOCX/TXT** (indexação automática em trechos, retrieval TF-IDF para *grounding*).
- **Playground**: teste o assistente em tempo real com **respostas em streaming**.
- **Central de Conversas (Inbox)**: acompanhe atendimentos, **transfira para humano**, **pause/retorne a IA**, responda como atendente e marque como resolvido.
- **Canal WhatsApp**: conexão por QR (microserviço Baileys) + **simulador** para teste ponta a ponta.
- **Dashboard** com métricas (assistentes, conversas, taxa de handoff, mensagens).
- **Multi-provedor por assistente**: escolha OpenAI, Anthropic ou Gemini individualmente.

---

## 🗂 Estrutura do projeto
```
/
├─ backend/            # API FastAPI + MongoDB (motor)
│  ├─ server.py        # app + seed inicial
│  ├─ ai_core.py       # extração de arquivos, retrieval, prompt, LLM (streaming)
│  ├─ routers/         # assistants, knowledge, playground, conversations, whatsapp, dashboard, meta
│  ├─ requirements.txt
│  └─ .env.example
├─ frontend/           # React (CRA) + Tailwind + shadcn/ui
│  ├─ src/pages/       # Dashboard, Assistentes, Base de Conhecimento, Playground, Conversas, WhatsApp
│  ├─ src/lib/api.js
│  └─ .env.example
├─ whatsapp-service/   # Microserviço Node (Baileys) para WhatsApp via QR (ativação externa)
├─ poc/                # POC do core validado (multi-provedor, grounding, handoff)
├─ docker-compose.yml
└─ DELIVERY.md         # O que está testado vs preparado vs depende de config externa
```

---

## 🚀 Rodando localmente (sem Emergent)

### Pré-requisitos
- Python 3.11+, Node.js 20+, MongoDB 6+ (local ou Atlas), Yarn.

### 1) Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # configure MONGO_URL, DB_NAME, EMERGENT_LLM_KEY
uvicorn server:app --host 0.0.0.0 --port 8001
```

### 2) Frontend
```bash
cd frontend
yarn install
cp .env.example .env      # REACT_APP_BACKEND_URL=http://localhost:8001
yarn start                # http://localhost:3000
```

### 3) WhatsApp (opcional, conexão real)
```bash
cd whatsapp-service
cp .env.example .env      # BACKEND_URL=http://localhost:8001
npm install && npm start  # escaneie o QR gerado
```

### Ou tudo via Docker
```bash
cp backend/.env.example backend/.env       # ajuste EMERGENT_LLM_KEY
docker compose up --build
# frontend: http://localhost:3000 | backend: http://localhost:8001
# whatsapp-service (perfil opcional): docker compose --profile whatsapp up --build
```

---

## 🔑 Variáveis de ambiente

**backend/.env**
| Variável | Descrição |
|---|---|
| `MONGO_URL` | URL do MongoDB (ex.: `mongodb://localhost:27017`) |
| `DB_NAME` | Nome do banco (ex.: `atendeai`) |
| `CORS_ORIGINS` | Origens permitidas (`*` em dev) |
| `EMERGENT_LLM_KEY` | Chave universal Emergent (OpenAI/Anthropic/Gemini). Pode ser trocada por chaves próprias. |

**frontend/.env**
| Variável | Descrição |
|---|---|
| `REACT_APP_BACKEND_URL` | URL base do backend (com as rotas `/api`) |

**whatsapp-service/.env** — veja `whatsapp-service/README.md`.

### Trocar a chave da IA pela sua própria
O backend usa a lib `emergentintegrations` com `EMERGENT_LLM_KEY`. Para usar chaves próprias (OpenAI/Anthropic/Google), substitua a integração em `backend/ai_core.py` (função `_make_chat`) pelos SDKs oficiais de cada provedor — a arquitetura já separa provedor/modelo por assistente.

---

## 🧠 Como o “core” funciona
1. A base de conhecimento é dividida em **trechos** e recuperada por similaridade (TF-IDF) na hora da pergunta.
2. Um **system prompt rico** é composto com personalidade, regras, objetivos, histórico recente e os trechos relevantes.
3. O LLM responde em **streaming** e sinaliza **handoff** por uma etiqueta interna `[[HANDOFF:SIM/NAO]]` (removida antes de exibir). Em caso de handoff, a conversa é **pausada** e marcada para o humano assumir.

---

## 🧪 Continuidade com Claude Code
O projeto é autocontido e roda fora do Emergent. Para continuar o desenvolvimento com Claude Code em servidor/local, clone o repositório, configure os `.env` a partir dos `.env.example` e siga as instruções acima. Consulte `DELIVERY.md` para o estado exato de cada parte.
