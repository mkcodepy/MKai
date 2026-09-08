# Microserviço WhatsApp (Baileys) — AtendeAI

Conecta ao WhatsApp via **QR Code** (multi-device, **sem API oficial** e **sem Chromium/Selenium**) usando a biblioteca [`@whiskeysockets/baileys`](https://baileys.wiki/) v7, e faz a ponte HTTP com o backend do AtendeAI.

> **Por que um serviço separado?** O ambiente de preview do Emergent (sandbox) não mantém uma sessão WebSocket persistente com o WhatsApp Web. Por isso a conexão real roda aqui, no **seu servidor/computador**. No AtendeAI Console, use o **Simulador** (Central de Conversas) para testar todo o fluxo de IA sem o WhatsApp real.

## Requisitos
- Node.js **>= 20**
- Backend do AtendeAI rodando e acessível (variável `BACKEND_URL`)

## Instalação e execução
```bash
cd whatsapp-service
cp .env.example .env      # ajuste BACKEND_URL se necessário
npm install
npm start
```
Ao iniciar, um **QR Code** será gerado. Escaneie em: WhatsApp → *Aparelhos conectados* → *Conectar um aparelho*.

- O QR também fica disponível em `GET http://localhost:3100/qr` (retorna `dataUrl` PNG) e é enviado ao backend, aparecendo na página **Canal WhatsApp** do console.
- As credenciais são salvas em `AUTH_DIR` (`./auth_info`), permitindo reconexão sem novo QR.

## Como funciona a ponte
| Evento | Ação |
|---|---|
| QR gerado | `POST {BACKEND_URL}/api/whatsapp/bridge/qr { qr }` |
| Conectado/Desconectado | `POST {BACKEND_URL}/api/whatsapp/bridge/status { status, phone }` |
| Mensagem recebida | `POST {BACKEND_URL}/api/whatsapp/inbound { phone, name, text }` → recebe `{ reply }` e envia de volta ao cliente |

Quando a conversa está com a **IA pausada** ou foi **transferida para humano**, o backend retorna `reply: null` e o serviço **não** responde automaticamente — o atendimento segue pela Central de Conversas.

## Endpoints do serviço
- `GET /health` — status do serviço
- `GET /status` — status da conexão
- `GET /qr` — QR atual (`{ qr, dataUrl }`)
- `POST /logout` — encerra a sessão

## Aviso de uso
Este projeto usa uma biblioteca não oficial que automatiza o WhatsApp Web. Use de acordo com os Termos de Serviço do WhatsApp. Recomenda-se um número dedicado para automação.
