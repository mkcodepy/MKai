# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.

## [2.0.0] — Assistente nível agente

### Núcleo de IA
- Prompt de sistema reestruturado no padrão de agente: identidade e missão, princípios operacionais priorizados, playbook de conversa, habilidades declaradas, estilo por canal, regras/guardrails (incl. proteção a prompt injection), política de escalonamento, fidelidade, coleta de dados, exemplos few-shot, memória, perfil do cliente, checklist silencioso e contrato de saída `[[META:{...}]]`.
- Histórico enviado como mensagens reais (multi-turn nativo) com janela configurável; mensagens de atendente humano marcadas.
- Memória longa: resumo automático a cada 10 mensagens, injetado no prompt.
- Perfil do cliente capturado automaticamente pela IA e reaproveitado (não pergunta de novo).
- Retrieval híbrido BM25 + TF-IDF; normalização PT-BR (acentos, stemming leve, stopwords); dicionário de sinônimos de atendimento; expansão de follow-ups curtos; chunking com sobreposição; título da fonte indexado; **base inteira quando pequena** (`kb_full_context_chars`).
- Metadados por resposta: intenção, sentimento, confiança, uso da base, tags, perfil, fontes, latência, provedor/modelo.
- Handoff por palavras-chave (determinístico) além da decisão da IA; motivo do handoff registrado.
- Parâmetros do modelo aplicados (temperatura quando suportada, `max_tokens`); retry sem parâmetros; **provedor de fallback**; resposta segura com handoff em falha total.
- Streaming sem vazamento do bloco de controle.
- Novos utilitários LLM: geração de configuração de assistente, sugestão de resposta (copiloto), briefing para atendente, resumo de conversa.

### Backend
- Novos campos do assistente: `company_name`, `company_description`, `mission`, `skills`, `fallback_provider`, `max_tokens`, `response_length`, `formality`, `use_emojis`, `whatsapp_style`, `proactive_followup`, `forbidden_topics`, `few_shot_examples`, `escalation_keywords`, `business_hours`, `off_hours_message`, `collect_lead_info`, `lead_fields`, `retrieval_top_k`, `kb_min_score`, `kb_full_context_chars`, `memory_window`, `template_key`.
- Rotas: `GET /assistants/templates[/{key}]`, `POST /assistants/generate`, `POST /assistants/{id}/duplicate`, `GET /assistants/{id}/prompt`, `POST /assistants/{id}/evaluate`, `GET /assistants/{id}/stats`; `POST /knowledge/url`, `POST /knowledge/search`, `GET/PUT /knowledge/{id}`, `POST /knowledge/{id}/reindex`; `POST /conversations/{id}/suggest`, `POST /conversations/{id}/briefing`, `PATCH /conversations/{id}/notes`, filtros `channel`/`assistant_id`; `GET /whatsapp/settings` e settings operacionais (`auto_reply`, `debounce_ms`, `reply_delay_ms`, `split_long_messages`, `ignore_groups`); `GET /health`.
- Mensagens humanas em conversas WhatsApp são enviadas ao cliente via `WHATSAPP_SERVICE_URL/send`.
- Dashboard: `ai_messages`, `ai_resolution_rate`, `avg_latency_ms`, `avg_confidence`, `sentiment`, `intents`, `timeline` (7 dias), `per_assistant`.
- Upload aceita MD/CSV/HTML (15 MB); DOCX extrai tabelas; Q&A indexado por par.
- Seed de demonstração enriquecido (missão, skills, exemplos, fallback de provedor); migração leve idempotente para dados antigos.

### Frontend
- Editor de assistente: templates, **Gerar com IA**, 10 abas, editor de chips, slider de temperatura, exemplos few-shot, **prompt compilado**, **avaliação em lote**, preview com metadados.
- Playground: painel de inspeção (intenção, sentimento, confiança, fontes com score, latência, motivo de handoff, dados capturados) e chips de cenários de teste.
- Base de Conhecimento: aba URL, **Testar busca**, reindexar, contagem de caracteres/trechos.
- Central de Conversas: fila humana, não lidos, filtro por canal, metadados sob respostas da IA, painel de insights (sentimento, intenção, confiança, perfil, briefing, memória, tags, notas), copiloto, horário nas mensagens, indicador de entrega.
- Dashboard v2 com timeline, sentimento, intenções e por assistente; skeleton de carregamento.
- Canal WhatsApp: configurações operacionais, QR real quando em modo live, instruções de ativação.
- Componentes reutilizáveis `AIMeta.js` (MetaRow, SentimentBadge, ConfidenceBadge, ChipListEditor).

### Microserviço WhatsApp
- Debounce por contato, presença “digitando…”, divisão de mensagens longas, marcação de lidas, ignorar status/grupos, placeholders de mídia, `POST /send`, heartbeat, leitura de settings do console, `markOnlineOnConnect=false`.

### Documentação
- `README.md` reescrito; novos `ARCHITECTURE.md` e `CHANGELOG.md`; `DELIVERY.md` e `plan.md` atualizados; `.env.example` com `WHATSAPP_SERVICE_URL` e `HEARTBEAT_MS`.

## [1.0.0] — MVP
- POC do núcleo (3 provedores), CRUD de assistentes, base de conhecimento (texto/Q&A/arquivos), Playground SSE, Central de Conversas com handoff/pausa/retomada, canal WhatsApp (simulador + bridge), dashboard, microserviço Baileys, Docker/Compose, documentação inicial.
