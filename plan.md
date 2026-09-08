# plan.md (atualizado)

## 1) Objectives
- Entregar uma V1 **profissional e utilizável** de console web para configurar e operar **assistentes de IA de atendimento**, com:
  - **continuidade de contexto** (multi-turn),
  - **fidelidade** à base de conhecimento (grounding/RAG leve),
  - **handoff** (escalonamento para humano) + **pausa/retomada** da IA,
  - **multi-provedor por assistente** (OpenAI/Anthropic/Gemini) via `emergentintegrations` e `EMERGENT_LLM_KEY`.
- Entregar canal WhatsApp via QR Code em duas camadas:
  - **Simulador interno** (funcional e testado no ambiente)
  - **Integração real** via **microserviço Node (Baileys v7)** pronta para ativação externa (sem reconstrução do app).
- Preparar exportação GitHub e execução independente: `README`, `.env.example`, `docker-compose`, `Dockerfile`s, `.gitignore` e `DELIVERY.md` indicando claramente **testado vs preparado vs depende de ativação externa**.

## 2) Implementation Steps

### Phase 1 — POC do Core (isolado; não avançar sem passar) ✅ CONCLUÍDA
**User stories (validadas)**
1. Como operador, quero enviar uma pergunta e receber resposta **streaming** para validar a integração LLM.
2. Como operador, quero alternar **OpenAI/Anthropic/Gemini** por “assistente” para comparar qualidade/custo.
3. Como operador, quero anexar PDF/DOCX/TXT e ver o texto extraído para validar ingestão.
4. Como operador, quero que a IA responda **somente com base** na KB e admita quando não souber.
5. Como operador, quero que a IA gere um **sinal de handoff** quando detectar pedido humano/insatisfação.

**Steps (executados e aprovados)**
- Implementado `poc/poc_core.py`:
  - Extração de texto de PDF/DOCX/TXT.
  - Chunking + retrieval TF-IDF (cosine) para grounding.
  - Prompt de sistema rico (personalidade/tom/regras/objetivos + política anti-alucinação).
  - Multi-turn com continuidade de contexto.
  - Multi-provedor via `LlmChat.stream_message()`.
  - Handoff via etiqueta `[[HANDOFF:SIM/NAO]]`.
- Critério de “passou” atingido: 3/3 provedores aprovados (OpenAI, Anthropic, Gemini) com grounding correto e handoff detectado.


### Phase 2 — V1 App (MVP completo em torno do core) ✅ CONCLUÍDA
**User stories (implementadas)**
1. Criar/editar um assistente (modelo, personalidade, regras, objetivos) e salvar.
2. Subir arquivos e colar textos/Q&A na KB e vincular a um assistente.
3. Testar o assistente no Playground com respostas streaming e histórico por sessão.
4. Ver lista de conversas e abrir thread para acompanhar o atendimento.
5. **Pausar a IA**, responder como humano e depois **retomar** a IA.

**Backend (FastAPI + MongoDB) — implementado e testado (28/28)**
- Módulos/routers:
  - `/api/assistants` (CRUD)
  - `/api/meta/models` (lista de providers/modelos e defaults)
  - `/api/knowledge` (texto/Q&A + upload PDF/DOCX/TXT + list/delete)
  - `/api/playground/stream` (SSE streaming)
  - `/api/conversations` (inbox, mensagens inbound/humano, pause/resume/status)
  - `/api/whatsapp`:
    - `/status`, `/connect`, `/disconnect` (estado do canal)
    - `/bridge/qr`, `/bridge/status` (ponte do microserviço)
    - `/settings` (selecionar assistente responsável)
    - `/inbound` (inbound real do WhatsApp — cria/encontra conversa e retorna reply)
  - `/api/dashboard/stats` (métricas)
- Recursos chave:
  - Grounding TF-IDF por assistant_id.
  - Handoff: ao detectar `HANDOFF:SIM` → status `human`, `ai_paused=true`, `handoff=true`.
  - Regra operacional: se `ai_paused=true` ou `status=human`, inbound do cliente **não** dispara IA.
  - Seed de demonstração (assistente + KB) para primeira execução.

**Frontend (React + shadcn/ui) — implementado e testado (~99%)**
- AppShell com sidebar + topbar; tokens/tema teal/ocean.
- Páginas:
  - Dashboard
  - Assistentes (lista)
  - Editor de Assistente (abas + preview rápido streaming)
  - Base de Conhecimento (texto/Q&A + upload)
  - Playground (chat streaming SSE)
  - Conversas (Inbox 3 colunas + simulador + pause/resume/handoff)
  - Canal WhatsApp (status + QR demonstrativo + seletor de assistente)
- Acessibilidade: ajuste aplicado em Dialog (DialogDescription).

**Checkpoint E2E (executado)**
- Fluxo completo via Simulador:
  - criar assistente/KB → Playground streaming OK → criar conversa → inbound auto-reply → handoff → pause → humano responde → retomar IA.


### Phase 3 — Hardening + Export GitHub + Qualidade de Atendimento ✅ CONCLUÍDA (com pendência de validação externa do WhatsApp real)
**User stories (entregues)**
1. Exportar/rodar via `docker-compose` localmente sem Emergent.
2. Canal WhatsApp real via QR pronto para ativação externa.
3. Documentação de entrega clara (testado vs preparado vs externo).

**Entregas (executadas)**
- Microserviço WhatsApp real:
  - Pasta `/whatsapp-service` com `@whiskeysockets/baileys` v7 (Node >= 20).
  - QR + status → bridge para backend.
  - Recebe mensagem → chama `/api/whatsapp/inbound` → envia reply de volta.
  - `README.md`, `.env.example`, `Dockerfile`, `.gitignore`.
- Pacote GitHub:
  - `README.md` (setup local, Docker, envs)
  - `.env.example` (backend/frontend)
  - `docker-compose.yml`
  - `Dockerfile`s (backend/frontend/whatsapp-service)
  - `.gitignore`
  - `DELIVERY.md`

### Phase 4 — Assistente nível agente (v2.0.0) ✅ CONCLUÍDA
**Objetivo**: elevar a qualidade do assistente ao padrão de um agente bem projetado e tornar o console a melhor ferramenta para gerá-lo.

**Núcleo de IA (`ai_core.py`)**
- Prompt de sistema estruturado: identidade/missão → princípios → playbook → skills → estilo → regras (+anti prompt injection) → handoff → fidelidade → coleta de dados → exemplos few-shot → base → memória → perfil do cliente → checklist silencioso → contrato de saída `[[META:{...}]]`.
- Histórico como mensagens reais (multi-turn nativo), janela configurável; resumo automático a cada 10 mensagens; perfil do cliente capturado pela IA.
- Retrieval híbrido BM25 + TF-IDF com normalização PT-BR, sinônimos, expansão de follow-ups, chunk overlap; base inteira quando pequena.
- Metadados por resposta (intenção, sentimento, confiança, kb_used, tags, perfil, fontes, latência, modelo).
- Handoff por palavras-chave + decisão da IA; temperatura/max_tokens; retry + fallback de provedor.
- Utilitários: geração de configuração por IA, copiloto, briefing, resumo.

**Backend**: novos campos e rotas (templates, generate, duplicate, prompt, evaluate, stats, knowledge url/search/reindex/put, suggest, briefing, notes, whatsapp settings, health), dashboard v2, envio de mensagens humanas ao WhatsApp, seed enriquecido + migração leve.

**Frontend**: Editor com templates + Gerar com IA + 10 abas (prompt compilado, avaliação); Playground com inspeção e cenários; KB com URL e Testar busca; Inbox com insights/copiloto/briefing/notas; Dashboard v2; WhatsApp settings; `AIMeta.js`.

**WhatsApp service**: debounce, “digitando…”, split, lidas, `/send`, heartbeat, settings do console.

**Testes**: `test_reports/iteration_3.json` — backend 59/59 (100%), frontend 100% dos fluxos, 0 bugs.

**Docs**: README reescrito, ARCHITECTURE.md, CHANGELOG.md, DELIVERY.md e READMEs atualizados; `.env.example` com `WHATSAPP_SERVICE_URL`/`HEARTBEAT_MS`.

## 3) Next Actions
1. **Validação externa (pendente):** rodar `whatsapp-service` em servidor/computador (Node 20+), escanear QR e validar troca real de mensagens com o backend.
2. (Opcional) Ajustes pós-validação:
   - Rate limiting / retries na ponte WhatsApp.
   - Logs/observabilidade mais robustos.
   - Evolução do retrieval para embeddings (quando base crescer).

## 4) Success Criteria
- **POC** ✅: streaming OK; 3 provedores OK; extração PDF/DOCX/TXT OK; grounding correto; handoff detectado.
- **V1 App** ✅: CRUD assistentes + KB (texto+upload) + Playground streaming + Inbox com pause/resume + simulador end-to-end.
- **WhatsApp real (externo)** 🟡: microserviço Baileys implementado e documentado; falta apenas ativação/validação no ambiente do usuário.
- **Export** ✅: projeto roda fora do Emergent com `README`, `.env.example`, `docker-compose` e `DELIVERY.md` claros.
- **v2 (agente)** ✅: prompt estruturado, retrieval híbrido, metadados, memória, geração por IA, templates, avaliação, copiloto, briefing — testados (59/59 backend, frontend 100%).