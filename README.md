# AtendeAI Console

Plataforma web (PT-BR) para **criar, configurar e operar assistentes de IA de atendimento ao cliente** com qualidade de **agente bem projetado**: identidade e missão claras, habilidades declaradas, playbook de conversa, guardrails, handoff inteligente para humano, memória e fidelidade total à base de conhecimento do negócio.

Primeiro canal: **WhatsApp via QR Code** (sem API oficial, microserviço Baileys) com **simulador interno** para testar todo o fluxo no próprio console.

> Stack: **FastAPI + MongoDB** (backend) · **React + Tailwind + shadcn/ui** (frontend) · **Node + Baileys** (microserviço WhatsApp) · LLMs via **Emergent Universal Key** (OpenAI / Anthropic / Google Gemini, selecionáveis por assistente).

---

## Índice
1. [Recursos](#recursos)
2. [Como o assistente é projetado (arquitetura de agente)](#como-o-assistente-é-projetado)
3. [Estrutura do projeto](#estrutura-do-projeto)
4. [Rodando localmente](#rodando-localmente)
5. [Rodando com Docker Compose](#rodando-com-docker-compose)
6. [Ativando o WhatsApp real](#ativando-o-whatsapp-real)
7. [Variáveis de ambiente](#variáveis-de-ambiente)
8. [API (resumo)](#api-resumo)
9. [Guia rápido: criando um assistente excelente](#guia-rápido-criando-um-assistente-excelente)
10. [Testes](#testes)
11. [Documentos relacionados](#documentos-relacionados)

---

## Recursos

### Criação do assistente
- **Gerar com IA**: descreva o negócio em um parágrafo e a IA monta a configuração completa (nome, missão, habilidades, personalidade, tom, instruções, regras, objetivos, exemplos few-shot, handoff, palavras-chave de escalonamento, horários e **conteúdos sugeridos para a base**).
- **6 templates por segmento** prontos e revisáveis: E-commerce, Clínica, Imobiliária, SaaS/Suporte, Restaurante/Delivery, Serviços/Agendamento.
- **Editor por abas**: Identidade · Modelo · Personalidade & Estilo · Instruções & Regras · Exemplos · Handoff & Horários · Conhecimento & Memória · Mensagens · **Prompt compilado** (transparência total) · **Avaliação** (bateria de perguntas com métricas).
- **Multi-provedor por assistente** (OpenAI, Anthropic, Gemini) com **provedor de fallback**, temperatura e limite de tokens.
- Duplicar assistente (com base de conhecimento).

### Qualidade de resposta
- **Prompt de sistema estruturado** (identidade/missão → princípios → playbook → skills → estilo → regras → handoff → fidelidade → base → memória → checklist silencioso → contrato de saída).
- **Histórico como mensagens reais** (multi-turn nativo) + **memória longa** (resumo automático a cada 10 mensagens) + **perfil do cliente** capturado automaticamente (nome, e-mail etc.).
- **Retrieval híbrido** BM25 + TF-IDF com normalização PT-BR (acentos, stemming leve, stopwords), **sinônimos de atendimento** ("parcelam" → "12x sem juros") e **expansão de follow-ups curtos** ("e o prazo?"). Bases pequenas (< 12k caracteres, configurável) vão **inteiras** ao modelo — zero falha de retrieval.
- **Metadados por resposta**: intenção, sentimento, confiança, uso da base, tags, dados capturados, fontes usadas, latência, modelo.
- **Handoff duplo**: decisão da IA (política) **ou** gatilho determinístico por palavras-chave. Proteção contra prompt injection.
- **Estilo de canal**: formato WhatsApp (*negrito*, sem markdown), tamanho da resposta, formalidade, emojis, próximo passo proativo.
- Retry sem parâmetros e **fallback de provedor** em caso de falha; resposta segura + handoff se tudo falhar.

### Base de Conhecimento
- Texto, **Q&A** (1 trecho por par P/R), **importação de URL** e arquivos **PDF, DOCX, TXT, MD, CSV, HTML** (até 15 MB).
- **Testar busca**: veja exatamente quais trechos a IA receberia para uma pergunta e se a base vai inteira.
- Reindexação, edição e chunking com sobreposição.

### Operação (Central de Conversas)
- Inbox com filtros por status e canal, fila humana, não lidos, sentimento e intenção por conversa.
- **Handoff** → IA pausada → atendente assume → **retomar IA**.
- **Copiloto**: sugestão de resposta para o atendente com base na KB e no histórico.
- **Briefing** para assumir (resumo, objetivo, pendências, próximo passo), **memória** da conversa, **perfil do cliente**, tags e **notas internas**.
- Mensagens do atendente em conversas WhatsApp são **enviadas ao cliente** via microserviço.

### WhatsApp (microserviço Baileys)
- QR Code multi-device, sessão persistente, reconexão automática e heartbeat.
- **Agrupamento de mensagens seguidas** (debounce), **“digitando…”** proporcional ao texto, **divisão de respostas longas**, marcação de lidas, ignora grupos/status, trata áudio/imagem/documento com placeholder.
- Endpoint `/send` para mensagens humanas; configurações lidas do console (auto-resposta, debounce, delay, split, grupos).

### Dashboard
- Conversas, fila humana, taxa de handoff, **resolvidas só pela IA**, latência e confiança médias, **sentimento**, **principais intenções**, mensagens por dia (7 dias), desempenho por assistente.

---

## Como o assistente é projetado

Cada resposta é produzida por um *pipeline* determinístico + LLM:

```
mensagem do cliente
  │
  ├─ 1. Gatilhos determinísticos: palavras-chave de escalonamento
  ├─ 2. Expansão da pergunta: follow-up curto herda contexto + sinônimos PT-BR
  ├─ 3. Retrieval híbrido (BM25 + TF-IDF) — ou base inteira se pequena
  ├─ 4. Prompt de sistema estruturado (ver abaixo) + memória/resumo + perfil do cliente
  ├─ 5. Histórico como mensagens reais (janela configurável)
  ├─ 6. LLM do assistente (temperatura/max_tokens) → retry → provedor de fallback
  ├─ 7. Parse do contrato de saída [[META:{...}]] → texto limpo + metadados
  └─ 8. Persistência: mensagem + meta + fontes; conversa recebe sentimento/intenção/tags/perfil;
        handoff → status human + IA pausada; a cada 10 msgs → resumo (memória longa)
```

**Seções do prompt de sistema** (visíveis na aba *Prompt* do editor):
`# IDENTIDADE E MISSÃO` · `# PRINCÍPIOS OPERACIONAIS` · `# PLAYBOOK DA CONVERSA` · `## Habilidades` · `# PERSONALIDADE` · `# TOM DE VOZ` · `# ESTILO DE ESCRITA` · `# PAPEL E INSTRUÇÕES` · `# OBJETIVOS COMERCIAIS` · `# REGRAS E GUARDRAILS` · `# POLÍTICA DE ESCALONAMENTO` · `# FIDELIDADE À INFORMAÇÃO` · `## Coleta de dados` · `## Exemplos` · `# BASE DE CONHECIMENTO` · `## Memória` · `## Perfil do cliente` · `# CHECKLIST SILENCIOSO` · `# CONTRATO DE SAÍDA`.

Detalhes técnicos em [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## Estrutura do projeto
```
/
├─ backend/                  # API FastAPI + MongoDB (motor)
│  ├─ server.py              # app, CORS, seed de demonstração, migrações leves, /api/health
│  ├─ ai_core.py             # extração, chunking, retrieval híbrido, prompt v2, geração, utilitários LLM
│  ├─ templates.py           # templates de assistente por segmento
│  ├─ models.py              # Pydantic (payloads)
│  ├─ database.py            # conexão Mongo + índices
│  ├─ routers/               # assistants, knowledge, playground, conversations, whatsapp, dashboard, meta
│  ├─ backend_test.py        # suíte de testes de API (requests)
│  ├─ requirements.txt · Dockerfile · .env.example
├─ frontend/                 # React (CRA) + Tailwind + shadcn/ui
│  ├─ src/pages/             # Dashboard, Assistants, AssistantEditor, KnowledgeBase, Playground, Conversations, WhatsAppChannel
│  ├─ src/components/        # AppShell, AIMeta (badges de metadados, editor de chips), ui/ (shadcn)
│  ├─ src/lib/api.js         # cliente HTTP + SSE
│  ├─ Dockerfile · .env.example
├─ whatsapp-service/         # Microserviço Node (Baileys) — roda no SEU servidor
│  ├─ index.js · package.json · README.md · Dockerfile · .env.example
├─ poc/poc_core.py           # POC do núcleo validado nos 3 provedores
├─ docker-compose.yml        # mongo + backend + frontend + whatsapp-service
├─ ARCHITECTURE.md           # arquitetura, pipeline de IA, modelo de dados
├─ DELIVERY.md               # testado vs preparado vs depende de ativação externa
├─ CHANGELOG.md              # histórico de versões
└─ plan.md                   # plano e status por fase
```

---

## Rodando localmente

### Pré-requisitos
- Python 3.11+, Node 20+, Yarn, MongoDB 6+ (local ou Atlas)
- Uma **Emergent Universal Key** (`EMERGENT_LLM_KEY`) — ou adapte `ai_core.py` para chaves diretas dos provedores.

### Backend
```bash
cd backend
cp .env.example .env            # edite MONGO_URL, DB_NAME, EMERGENT_LLM_KEY
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
Na primeira execução o backend cria um assistente de demonstração (**Nova — TechNova**) com base de conhecimento.

### Frontend
```bash
cd frontend
cp .env.example .env            # REACT_APP_BACKEND_URL=http://localhost:8001
yarn install
yarn start                      # http://localhost:3000
```

---

## Rodando com Docker Compose
```bash
cp backend/.env.example backend/.env          # preencha EMERGENT_LLM_KEY
cp whatsapp-service/.env.example whatsapp-service/.env
docker compose up -d --build
```
- Frontend: http://localhost:3000 · Backend: http://localhost:8001/api · WhatsApp service: http://localhost:3100/health
- A sessão do WhatsApp fica no volume `whatsapp_auth` (não precisa reescanear após restart).

---

## Ativando o WhatsApp real
O microserviço **não roda no sandbox** de desenvolvimento; ele foi feito para o seu servidor/computador.

```bash
cd whatsapp-service
cp .env.example .env            # BACKEND_URL=http://<host-do-backend>:8001
yarn install
yarn start
```
1. No console, em **Canal WhatsApp**, escolha o **assistente responsável** e ajuste o comportamento (agrupar mensagens, “digitando…”, dividir respostas, ignorar grupos).
2. Escaneie o QR (aparece no console assim que o serviço o emite, e também em `GET http://localhost:3100/qr`).
3. As mensagens chegam na **Central de Conversas** com IA, handoff, copiloto e briefing. Respostas do atendente são entregues no WhatsApp do cliente.

Detalhes, troubleshooting e observações sobre Termos de Uso em [`whatsapp-service/README.md`](whatsapp-service/README.md).

---

## Variáveis de ambiente

| Onde | Variável | Descrição |
|---|---|---|
| backend | `MONGO_URL` | String de conexão MongoDB |
| backend | `DB_NAME` | Nome do banco (padrão `atendeai`) |
| backend | `CORS_ORIGINS` | Origens permitidas (`*` em dev) |
| backend | `EMERGENT_LLM_KEY` | Chave universal Emergent para OpenAI/Anthropic/Gemini |
| backend | `WHATSAPP_SERVICE_URL` | URL do microserviço para envio de mensagens humanas (padrão `http://localhost:3100`) |
| frontend | `REACT_APP_BACKEND_URL` | URL pública do backend (sem `/api`) |
| whatsapp-service | `BACKEND_URL` | URL do backend FastAPI |
| whatsapp-service | `WHATSAPP_SERVICE_PORT` | Porta HTTP (padrão 3100) |
| whatsapp-service | `AUTH_DIR` | Pasta da sessão (persistente) |
| whatsapp-service | `HEARTBEAT_MS` | Intervalo de heartbeat/refresh de settings (padrão 60000) |
| whatsapp-service | `LOG_LEVEL` | info \| debug \| warn \| error |

> Nunca versione arquivos `.env` (já ignorados no `.gitignore`).

---

## API (resumo)
Todas as rotas sob `/api`. Documentação interativa em `/docs` (Swagger).

| Grupo | Rotas principais |
|---|---|
| Saúde/meta | `GET /health` · `GET /meta/models` |
| Assistentes | `GET/POST /assistants` · `GET/PUT/DELETE /assistants/{id}` · `GET /assistants/templates[/{key}]` · `POST /assistants/generate` · `POST /assistants/{id}/duplicate` · `GET /assistants/{id}/prompt` · `POST /assistants/{id}/evaluate` · `GET /assistants/{id}/stats` |
| Conhecimento | `GET /knowledge?assistant_id=` · `POST /knowledge/text` · `POST /knowledge/url` · `POST /knowledge/upload` · `POST /knowledge/search` · `GET/PUT/DELETE /knowledge/{id}` · `POST /knowledge/{id}/reindex` |
| Playground | `POST /playground/stream` (SSE) · `POST /playground/reset` |
| Conversas | `GET/POST /conversations` · `GET/DELETE /conversations/{id}` · `POST .../inbound` · `POST .../human` · `PATCH .../status` · `PATCH .../notes` · `POST .../suggest` · `POST .../briefing` |
| WhatsApp | `GET /whatsapp/status` · `GET/PATCH /whatsapp/settings` · `POST /whatsapp/connect|disconnect` · `POST /whatsapp/inbound` · `POST /whatsapp/bridge/qr|status` |
| Dashboard | `GET /dashboard/stats` |

---

## Guia rápido: criando um assistente excelente
1. **Assistentes → Novo** → clique em **Gerar com IA** e descreva o negócio (o que vende, público, canais, o que a IA pode/não pode fazer). Ou escolha um **template**.
2. Revise **Identidade** (missão e habilidades), **Personalidade & Estilo** (tamanho curto para WhatsApp) e **Handoff** (palavras-chave). Salve.
3. **Base de Conhecimento**: adicione os conteúdos sugeridos (políticas, preços, prazos, horários, FAQ). Use **Q&A** para perguntas frequentes e **URL** para páginas do site. Valide com **Testar busca**.
4. **Playground**: rode os cenários (pergunta na base, follow-up, fora da base, pedido de humano, cliente irritado, prompt injection) e observe intenção/confiança/fontes no painel de inspeção.
5. Aba **Avaliação**: rode sua bateria de perguntas e ajuste até obter confiança alta e “usou a base” próximo de 100% nas perguntas cobertas.
6. **Canal WhatsApp**: defina o assistente responsável, ajuste debounce/“digitando…” e conecte o microserviço.

---

## Testes
- **API**: `cd backend && python backend_test.py` (usa `REACT_APP_BACKEND_URL` do frontend ou `http://localhost:8001`).
- Relatórios das rodadas automatizadas em `test_reports/` (última: `iteration_3.json` — backend 59/59, frontend 100% dos fluxos).
- Lint backend: `cd backend && ruff check .` · Build frontend: `cd frontend && yarn build`.

---

## Documentos relacionados
- [`DELIVERY.md`](DELIVERY.md) — o que está **testado**, **preparado** e o que **depende de ativação externa**.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — pipeline de IA, modelo de dados, decisões técnicas.
- [`CHANGELOG.md`](CHANGELOG.md) — histórico de versões.
- [`whatsapp-service/README.md`](whatsapp-service/README.md) — operação do microserviço.
- [`plan.md`](plan.md) — plano de fases e status.
