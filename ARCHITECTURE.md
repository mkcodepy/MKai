# Arquitetura — AtendeAI Console v2

## Visão geral
```
┌────────────────────────────────────┐      ┌───────────────────────────────────────┐
│  Frontend React (console)          │ /api │  Backend FastAPI                        │
│  Dashboard · Assistentes · KB      │─────►│  routers/* · ai_core.py · templates.py  │
│  Playground (SSE) · Inbox · WA     │      │  MongoDB (motor) · emergentintegrations │
└────────────────────────────────────┘      └───────────────────────────────────────┘
                                                     ▲  /api/whatsapp/inbound, /bridge/*     │ POST /send
                                                     │  GET /api/whatsapp/settings           ▼
                                              ┌──────────────────────────────────────────┐
                                              │  whatsapp-service (Node + Baileys)         │
                                              │  QR · sessão · debounce · typing · split     │
                                              └──────────────────────────────────────────┘
                                                                  ▲ WhatsApp Web (multi-device)
```

## Backend

### `ai_core.py` — núcleo de IA
| Bloco | Função | Notas |
|---|---|---|
| Extração | `extract_text_from_bytes`, `html_to_text` | PDF (pypdf), DOCX incl. tabelas (python-docx), TXT/MD/CSV, HTML (lxml) |
| Normalização PT-BR | `_tokenize` | remove acentos, stopwords, stemmer leve por sufixos |
| Chunking | `chunk_text(max_chars=600, overlap=80)`, `parse_qna_pairs` | parágrafos agrupados com sobreposição; Q&A vira 1 chunk por par |
| Retrieval | `HybridRetriever.search` | 0.6·BM25 normalizado + 0.4·cosseno TF-IDF; bônus implícito ao título da fonte (tokenizado junto) |
| Expansão | `expand_query` | follow-ups curtos herdam última pergunta/resposta; dicionário `_SYNONYMS` do domínio |
| Contexto | `prepare_context` | se `sum(len(chunks)) <= kb_full_context_chars` → base inteira agrupada por fonte; senão top-k |
| Prompt | `build_system_prompt` | seções de agente; `first_turn` injeta saudação; `channel="whatsapp"` força formato |
| Histórico | `history_to_messages` | roles reais (user/assistant), humano como assistant prefixado, alternação garantida |
| Geração | `generate_reply`, `stream_reply` | `_attempt_plan`: (provider, model, params) → (sem params) → (fallback_provider) |
| Contrato | `parse_meta` | `[[META:{...}]]` → `handoff, handoff_reason, intent, sentiment, confidence, kb_used, tags, profile`; compatível com legado `[[HANDOFF:SIM]]` |
| Gatilho | `keyword_handoff` | palavras-chave forçam `handoff=true` |
| Utilitários | `summarize_conversation`, `handoff_briefing`, `suggest_agent_reply`, `generate_assistant_config` | usam `UTILITY_MODEL` (barato) do mesmo provedor |

**Streaming seguro**: no `stream_reply` os últimos 8 caracteres são retidos e qualquer `[[` interrompe a emissão, para o bloco META nunca vazar ao cliente. O evento final `done` traz o texto limpo e os metadados.

**Parâmetros do modelo**: `temperature` é ignorada para `gpt-5*` e `o*` (não suportam); `max_tokens` sempre aplicado quando definido.

### Routers
- `assistants.py` — CRUD, templates, `generate` (IA), `duplicate`, `prompt` (compilado), `evaluate` (paralelo com `asyncio.gather`), `stats`. Rotas estáticas declaradas **antes** de `/{assistant_id}`.
- `knowledge.py` — texto/Q&A/URL/upload, `search` (mesma expansão do pipeline), get/put/reindex/delete. Chunks guardam `source_title`.
- `conversations.py` — inbox; `_run_ai_reply` persiste meta/fontes/latência, atualiza conversa (sentimento, intenção, tags, perfil, handoff) e agenda resumo a cada `SUMMARY_EVERY=10` mensagens; `human` envia ao WhatsApp via `push_to_whatsapp`; `suggest`, `briefing`, `notes`.
- `whatsapp.py` — estado do canal + settings operacionais; `inbound` cria/reusa conversa por telefone (ignora resolvidas), respeita `auto_reply`/pausa, retorna `reply, split, reply_delay_ms`.
- `dashboard.py` — agregações Mongo (sentimento, intenções, latência/confiança, timeline 7 dias, por assistente).
- `playground.py` — SSE; histórico em memória por sessão (efêmero, só para testes).
- `meta.py` — provedores, modelos, dicas, opções de estilo.

### Modelo de dados (MongoDB, ids UUID)
- `assistants` — toda a configuração (ver `models.AssistantBase`).
- `knowledge_sources` — `{id, assistant_id, type(text|qna|url|file), title, content(≤8k), full_length, filename, url, status, chunk_count}`.
- `knowledge_chunks` — `{id, assistant_id, source_id, source_title, text, order}`.
- `conversations` — `{id, channel, contact_name, contact_phone, assistant_id, status(bot|human|resolved), ai_paused, handoff, handoff_reason, unread, notes, tags, ai_tags, summary, sentiment, last_intent, last_confidence, customer_profile, briefing}`.
- `messages` — `{id, conversation_id, role(customer|assistant|human), text, handoff, meta, sources, provider, model, latency_ms, delivered, created_at}`.
- `channels` — documento `whatsapp` com `status, qr, phone, mode(simulator|live), assistant_id, auto_reply, debounce_ms, reply_delay_ms, split_long_messages, ignore_groups`.

## Frontend
- `lib/api.js` — axios + leitor SSE (`streamPlayground` emite `sources`, `delta`, `done`, `error`).
- `components/AIMeta.js` — `MetaRow`, `SentimentBadge`, `ConfidenceBadge`, `ChipListEditor` (reutilizados no editor, playground e inbox).
- Páginas em `pages/`; `AssistantEditor` é o centro: templates, Gerar com IA, 10 abas, preview com metadados.
- Tokens de design em `index.css`/`tailwind.config.js` (paleta teal/ocean; classes `text-success`, `text-warning`, `text-info`).

## Microserviço WhatsApp (`whatsapp-service/index.js`)
- `useMultiFileAuthState(AUTH_DIR)` para sessão persistente; `fetchLatestBaileysVersion`.
- Fila `pending` por telefone com debounce (`debounce_ms` vindo do console) → `POST /api/whatsapp/inbound` com as mensagens concatenadas.
- Envio: `sendPresenceUpdate(composing)` por tempo proporcional (máx 6s), `splitMessage` por parágrafos (~600 chars), pausa entre partes.
- `POST /send` para o backend entregar mensagens humanas; `/health`, `/status`, `/qr`, `/logout`, `/settings/refresh`.
- Heartbeat: reporta status e recarrega settings a cada `HEARTBEAT_MS`.

## Decisões técnicas
- **Sem dependências de embeddings**: retrieval lexical híbrido + base inteira para bases pequenas cobre o caso real de PMEs sem custo/latência extra; fácil trocar por embeddings depois (`HybridRetriever` é isolado).
- **Contrato de saída em texto** (não *function calling*) para funcionar de forma idêntica nos 3 provedores e em streaming.
- **Histórico como mensagens reais** em vez de texto no prompt — melhora coerência multi-turn e permite `few-shot` no system.
- **WhatsApp desacoplado** em Node: Baileys precisa de processo persistente e armazenamento local de sessão; o backend permanece stateless.
