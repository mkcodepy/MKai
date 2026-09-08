# DELIVERY — Estado da entrega (v2.0.0)

Este documento separa com clareza o que está **funcional e testado**, o que está **implementado e preparado** (mas só pode ser validado fora do sandbox) e o que **depende de configuração/validação externa**.

Última rodada de testes automatizados: `test_reports/iteration_3.json` — **backend 59/59 (100%)**, **frontend: todos os fluxos aprovados, 0 bugs**.

---

## 1) Funcional e testado neste ambiente ✅

### Núcleo de IA
- Multi-provedor por assistente (OpenAI / Anthropic / Gemini) via `emergentintegrations` + `EMERGENT_LLM_KEY`; POC 3/3 provedores.
- Prompt de sistema estruturado no padrão de agente (identidade/missão, princípios, playbook, skills, estilo, regras, handoff, fidelidade, base, memória, checklist, contrato de saída).
- Histórico multi-turn como mensagens reais; janela configurável; resumo automático a cada 10 mensagens (memória longa).
- Retrieval híbrido BM25 + TF-IDF com normalização PT-BR, sinônimos e expansão de follow-ups; base inteira quando pequena. Verificado: “vcs parcelam?” → resposta correta “12x sem juros / Pix 5%”; “e o prazo pra Salvador?” → “2 a 4 dias úteis (capitais)”.
- Metadados por resposta (intenção, sentimento, confiança, kb_used, tags, perfil do cliente, fontes, latência, modelo) persistidos e exibidos.
- Handoff pela IA **e** por palavras-chave; pausa da IA; retomada; fora da base → fallback honesto.
- Retry sem parâmetros e fallback de provedor; resposta segura + handoff em falha total.
- Geração de configuração completa por IA (`/assistants/generate`), templates (6), prompt compilado, avaliação em lote, duplicação.
- Copiloto (sugestão de resposta), briefing para atendente, notas/tags, perfil do cliente.

### Base de Conhecimento
- Texto, Q&A (1 chunk por par), upload PDF/DOCX/TXT/MD/CSV/HTML, importação por URL (validação de URL testada; importação real depende de acesso à internet do servidor), busca de teste, reindexação, edição, exclusão.

### Console (frontend)
- Dashboard v2 (KPIs, timeline 7 dias, sentimento, intenções, por assistente).
- Assistentes (lista com skills/contadores, duplicar, excluir) e Editor (templates, Gerar com IA, 10 abas, preview com metadados).
- Base de Conhecimento (4 tipos + Testar busca).
- Playground (streaming SSE, cenários de teste, painel de inspeção).
- Central de Conversas (filtros, fila humana, não lidos, simulador cliente/atendente, handoff/pausa/retomar/resolver, copiloto, briefing, notas, perfil, memória).
- Canal WhatsApp (status, QR ilustrativo em modo demo / QR real em modo live, assistente responsável, configurações operacionais persistidas).

### Bridge WhatsApp (lado backend)
- `POST /api/whatsapp/inbound` cria/reusa conversa por telefone, roda IA, retorna `reply/split/reply_delay_ms`; respeita `auto_reply` e pausa. Testado por HTTP (simulando o microserviço).
- `GET /api/whatsapp/settings`, `bridge/qr`, `bridge/status` testados.
- Mensagens humanas em conversas `whatsapp` tentam `POST {WHATSAPP_SERVICE_URL}/send` e registram `delivered` (false aqui, pois o serviço não roda no sandbox — comportamento esperado).

---

## 2) Implementado e preparado — validação só fora do sandbox 🟡

### Microserviço `whatsapp-service` (Node + Baileys v7)
- Código completo: QR/sessão persistente, reconexão, heartbeat, debounce por contato, “digitando…”, divisão de mensagens longas, marcação de lidas, ignorar grupos/status, placeholders para mídia, `POST /send`, `/qr`, `/health`, `/logout`, leitura de settings do console.
- **Não executado aqui**: o sandbox não mantém processo Node persistente com sessão WhatsApp Web. `yarn install` e a conexão real precisam ser feitos no seu servidor.
- Checklist de validação externa: (1) `yarn install` sem erros com Node ≥ 20; (2) QR aparece no console e em `/qr`; (3) sessão persiste após restart; (4) mensagem recebida cria conversa no inbox e recebe resposta da IA; (5) várias mensagens seguidas geram **uma** resposta; (6) handoff pausa a IA; (7) resposta do atendente chega ao WhatsApp; (8) retomar IA volta a responder.

### Execução independente (GitHub / Docker)
- `docker-compose.yml`, Dockerfiles (backend, frontend, whatsapp-service), `.env.example` de cada serviço, `.gitignore`.
- **Não executado aqui**: `docker compose up` não foi rodado no sandbox. Valide build e conectividade no seu ambiente.

---

## 3) Depende de configuração/validação externa 🔵
- **Chave LLM**: `EMERGENT_LLM_KEY` válida no `backend/.env` (ou adaptação para chaves diretas dos provedores). Custos/limites conforme seu plano.
- **MongoDB** próprio (local, Docker ou Atlas) em `MONGO_URL`.
- **WhatsApp**: número dedicado, celular com internet para a sessão multi-device; uso de WhatsApp Web não oficial está sujeito aos Termos do WhatsApp (risco de bloqueio em uso abusivo). Para escala/compliance, considere migrar depois para a API oficial (Cloud API) — a arquitetura por bridge HTTP facilita isso.
- **Importação por URL** exige que o servidor do backend acesse a internet.
- **Frontend em produção**: `REACT_APP_BACKEND_URL` deve apontar para a URL pública do backend; ajuste `CORS_ORIGINS`.

---

## 4) Limitações conhecidas e próximos passos sugeridos
- Sem autenticação (decisão de V1: usuário único). Antes de expor publicamente, adicione login.
- Retrieval lexical (sem embeddings). Excelente para bases pequenas/médias em PT-BR; para bases muito grandes, plugar embeddings em `HybridRetriever`.
- Histórico do Playground é em memória (reinicia com o backend) — intencional, só para testes.
- Áudio/imagem do WhatsApp chegam como placeholder textual (sem transcrição/visão).
- Sugestões: transcrição de áudio, respostas rápidas/atalhos para atendentes, múltiplos números WhatsApp, agendamento real (Google Calendar), CSAT ao resolver, exportação de leads (CSV/CRM).

---

## 5) Continuidade com Claude Code / outro agente
- Comece por `README.md` → `ARCHITECTURE.md` → `plan.md`.
- Pontos de extensão: `ai_core.py::build_system_prompt` (prompt), `HybridRetriever` (retrieval), `templates.py` (novos segmentos), `routers/whatsapp.py` + `whatsapp-service/index.js` (canal), `frontend/src/pages/AssistantEditor.js` (novos campos: adicionar em `models.py`, `EMPTY` e na aba correspondente).
- Testes de API: `backend/backend_test.py`.
