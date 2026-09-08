# Nota de Entrega — AtendeAI Console

Este documento descreve **com transparência** o que está funcional e testado, o que foi preparado estruturalmente e o que depende de configuração/validação externa.

---

## ✅ Funcional e TESTADO (neste ambiente)

Validado por testes automatizados de backend (28/28 aprovados, 100%) e de frontend (fluxos principais, ~99%), além do POC de núcleo isolado com os 3 provedores.

**Núcleo de IA (POC validado com OpenAI, Anthropic e Gemini)**
- Conversa multi-turn com **continuidade de contexto**.
- **Grounding** fiel à base de conhecimento (não inventa dados).
- **Detecção de handoff** (escala para humano) via etiqueta interna.
- **Extração de texto** de PDF, DOCX e TXT.

**Assistentes**
- CRUD completo (criar, listar, editar, excluir).
- Configuração de provedor/modelo, personalidade, tom, idioma, instruções, regras/guardrails, objetivos, mensagens padrão e regras de handoff.
- Seleção de provedor **por assistente** (OpenAI / Anthropic / Gemini).

**Base de Conhecimento**
- Adição por **texto** e por **Q&A**.
- **Upload de arquivos** (PDF/DOCX/TXT) com indexação automática em trechos.
- Listagem e exclusão de fontes.

**Playground**
- Teste do assistente com **respostas em streaming (SSE)** e reset de sessão.

**Central de Conversas (Inbox)**
- Criar/listar/abrir conversas; thread com bolhas por papel (cliente/IA/atendente).
- **Simulador**: enviar como cliente → IA responde automaticamente.
- **Pausar/Retomar IA**, **Transferir para humano**, **Responder como atendente**, **Marcar como resolvido**.
- Handoff automático: quando a IA sinaliza, a conversa é pausada e marcada como "Humano".
- Quando a IA está pausada, novas mensagens do cliente **não** são respondidas pela IA.

**Dashboard**
- Métricas: assistentes, conversas, com humano, taxa de handoff, mensagens, fontes, resolvidas + conversas recentes.

**Canal WhatsApp (dentro do console)**
- Estados de conexão (Desconectado/Conectando/Conectado), geração de QR ilustrativo, seleção do assistente responsável.
- **Bridge HTTP** e endpoint de **inbound real** (`/api/whatsapp/inbound`) testados: recebem telefone/nome/texto, criam/encontram a conversa, rodam a IA e retornam a resposta.

---

## 🧩 PREPARADO estruturalmente (pronto para ativar, sem reconstruir o app)

**Microserviço WhatsApp real (`/whatsapp-service`, Node + Baileys v7)**
- Implementação **completa**: conexão por QR (multi-device, sem API oficial e sem Chromium), reconexão automática, sessão persistente (`useMultiFileAuthState`), recebimento de mensagens e envio de respostas.
- Ponte HTTP com o backend já implementada nos dois lados (QR, status, inbound/outbound).
- **Por que não roda no preview do Emergent:** o sandbox não mantém a sessão WebSocket persistente exigida pelo WhatsApp Web. Por isso o serviço foi projetado para rodar **no seu servidor/computador**.
- **Não foi executado/validado neste ambiente** — requer ativação externa (ver abaixo).

**Empacotamento para GitHub / execução independente**
- `README.md`, `docker-compose.yml`, `Dockerfile`s (backend/frontend/whatsapp-service), `.env.example` de cada serviço e `.gitignore` prontos.
- Projeto autocontido para continuidade com **Claude Code** em servidor/local.

---

## ⚙️ Depende de CONFIGURAÇÃO / VALIDAÇÃO EXTERNA

1. **Conexão real do WhatsApp**: rodar `whatsapp-service` no seu ambiente (Node 20+), escanear o QR e validar troca de mensagens ponta a ponta com o backend. Passo a passo em `whatsapp-service/README.md`.
2. **Chave de IA em produção**: o app usa a `EMERGENT_LLM_KEY`. Para produção própria, mantenha a chave Emergent **ou** substitua pelos SDKs oficiais em `backend/ai_core.py` (`_make_chat`).
3. **Banco de dados**: apontar `MONGO_URL` para seu MongoDB (local/Atlas).
4. **CORS/URLs**: ajustar `CORS_ORIGINS` e `REACT_APP_BACKEND_URL` para seus domínios.

---

## 🔎 Observações de qualidade e evolução futura (sugestões)
- **Retrieval**: hoje é TF-IDF em memória (ótimo para começar). Evolua para embeddings + busca vetorial (ex.: Mongo Atlas Vector Search) para bases grandes.
- **Citações**: expor os trechos usados em cada resposta para auditoria/confiança.
- **Multiusuário/Auth**: adicionar login e workspaces por negócio (v1 é single-user por escolha do projeto).
- **Multicanal**: a arquitetura de canais permite adicionar Instagram/Telegram/webchat futuramente.
- **Horário de atendimento**, respostas rápidas (templates), tags e SLA na inbox.
- **Observabilidade**: logs estruturados e página de eventos.

> Nenhum dado é mockado: todas as respostas de IA são geradas em tempo real pelos provedores via `EMERGENT_LLM_KEY`.
