# whatsapp-service — Microserviço WhatsApp (Baileys) do AtendeAI

Conecta um número de WhatsApp ao AtendeAI Console via **QR Code (multi-device)**, sem API oficial e sem Chromium, e faz a ponte HTTP com o backend FastAPI.

> Este serviço foi projetado para rodar **no seu servidor/computador** (Node ≥ 20). Ele **não** roda no sandbox de desenvolvimento.

## O que ele faz
| Recurso | Detalhe |
|---|---|
| QR e sessão | Emite QR (envia ao backend e expõe em `GET /qr`), salva a sessão em `AUTH_DIR`, reconecta sozinho |
| Agrupamento (debounce) | Junta mensagens seguidas do mesmo contato por `debounce_ms` (configurado no console) e responde **uma vez** |
| Naturalidade | Marca como lida, mostra **“digitando…”** proporcional ao tamanho do texto (máx 6s), divide respostas longas em parágrafos |
| Filtros | Ignora status e (opcionalmente) grupos; mídia sem texto vira placeholder (`[áudio recebido — ...]`) |
| Envio humano | `POST /send {phone, text}` — usado pelo backend quando o atendente responde no inbox |
| Configurações | Lê `GET {BACKEND_URL}/api/whatsapp/settings` no start e a cada heartbeat |
| Heartbeat | Reporta `connected` periodicamente para o console mostrar o status real |

## Instalação e execução
```bash
cd whatsapp-service
cp .env.example .env         # ajuste BACKEND_URL
yarn install                 # ou npm install
yarn start                   # ou npm start
```
Escaneie o QR no console (Canal WhatsApp) ou abra `http://localhost:3100/qr` e use o `dataUrl`.

### Docker
O `docker-compose.yml` da raiz já inclui este serviço com volume `whatsapp_auth` para a sessão. Isolado:
```bash
docker build -t atendeai-whatsapp .
docker run -d --name atendeai-whatsapp -p 3100:3100 -e BACKEND_URL=http://host.docker.internal:8001 -v whatsapp_auth:/app/auth_info atendeai-whatsapp
```

## Endpoints HTTP
| Método | Rota | Uso |
|---|---|---|
| GET | `/health` | `{ok, status, pending}` |
| GET | `/status` | status + settings em uso |
| GET | `/qr` | `{qr, dataUrl}` (404 se não houver QR pendente) |
| POST | `/send` | `{phone: "+55...", text, split?}` → envia ao contato (503 se desconectado) |
| POST | `/settings/refresh` | Força recarga das configurações do console |
| POST | `/logout` | Encerra a sessão (será necessário novo QR) |

## Fluxo de uma mensagem
1. `messages.upsert` → extrai texto → `enqueue()` por telefone (debounce).
2. `flushPending()` → `readMessages` → `POST {BACKEND_URL}/api/whatsapp/inbound {phone, name, text}`.
3. Backend cria/reusa a conversa, roda a IA (se não pausada) e retorna `{reply, handoff, split, reply_delay_ms}`.
4. Serviço mostra “digitando…”, divide (se `split`) e envia. Se `reply` for `null` (IA pausada / handoff / auto_reply off), nada é enviado — o atendente responde pelo inbox e o backend chama `/send`.

## Troubleshooting
- **QR não aparece no console**: confira `BACKEND_URL` e se o backend responde em `/api/health`. O QR sempre está em `GET /qr`.
- **`loggedOut` nos logs**: a sessão foi encerrada no celular. Apague `AUTH_DIR` e reinicie para um novo QR.
- **Mensagens não respondidas**: veja no console se a conversa está com IA pausada/handoff, se `auto_reply` está ligado e os logs do serviço (`LOG_LEVEL=debug`).
- **Mensagens do atendente não chegam**: o backend precisa alcançar `WHATSAPP_SERVICE_URL` (em compose: `http://whatsapp-service:3100`).
- **Versão do WhatsApp Web**: `fetchLatestBaileysVersion()` é chamado no start; atualize a dependência `@whiskeysockets/baileys` se a conexão começar a falhar.

## Avisos
- Uso de WhatsApp Web não oficial está sujeito aos Termos do WhatsApp; evite envios em massa e use um número dedicado. Para escala/compliance, a arquitetura por bridge HTTP permite migrar para a Cloud API oficial sem mudar o console.
- Nunca versione `auth_info/` (já ignorado).
