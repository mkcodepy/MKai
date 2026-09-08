/**
 * AtendeAI — Microserviço WhatsApp (Baileys)
 * ------------------------------------------------------------
 * Conecta ao WhatsApp via QR Code (multi-device, sem API oficial e sem Chromium)
 * e faz a ponte HTTP com o backend FastAPI do AtendeAI Console.
 *
 * Fluxo:
 *   - Ao iniciar, abre sessão Baileys e emite QR (envia ao backend + expõe em /qr).
 *   - Ao conectar, reporta status "connected" ao backend.
 *   - Mensagens recebidas -> POST {BACKEND_URL}/api/whatsapp/inbound {phone,name,text}
 *     -> backend roda a IA e devolve {reply}. Se houver reply e a IA não estiver
 *        pausada, o serviço envia a resposta de volta ao cliente no WhatsApp.
 *
 * Este serviço foi feito para rodar no SEU servidor/computador (Node >= 20).
 * Não requer reconstruir a aplicação: basta configurar o .env e `npm start`.
 */
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import express from "express";
import axios from "axios";
import pino from "pino";
import QRCode from "qrcode";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8001";
const PORT = process.env.WHATSAPP_SERVICE_PORT || 3100;
const AUTH_DIR = process.env.AUTH_DIR || "./auth_info";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });
let sock = null;
let lastQR = null;
let connectionStatus = "disconnected";

async function reportStatus(status, phone = "") {
  connectionStatus = status;
  try {
    await axios.post(`${BACKEND_URL}/api/whatsapp/bridge/status`, { status, phone });
  } catch (e) {
    logger.warn(`Falha ao reportar status ao backend: ${e.message}`);
  }
}

async function reportQR(qr) {
  lastQR = qr;
  try {
    await axios.post(`${BACKEND_URL}/api/whatsapp/bridge/qr`, { qr });
  } catch (e) {
    logger.warn(`Falha ao enviar QR ao backend: ${e.message}`);
  }
}

function jidToPhone(jid) {
  // exemplo: 5511999999999@s.whatsapp.net -> +5511999999999
  const num = (jid || "").split("@")[0].split(":")[0];
  return num ? `+${num}` : jid;
}

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser: ["AtendeAI", "Chrome", "1.0.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      logger.info("Novo QR gerado.");
      await reportQR(qr);
    }
    if (connection === "connecting") await reportStatus("connecting");
    if (connection === "open") {
      const phone = jidToPhone(sock.user?.id || "");
      logger.info(`WhatsApp conectado: ${phone}`);
      lastQR = null;
      await reportStatus("connected", phone);
    }
    if (connection === "close") {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      logger.warn(`Conexão fechada (code=${code}). Reconectar: ${shouldReconnect}`);
      await reportStatus("disconnected");
      if (shouldReconnect) startSock();
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const remoteJid = msg.key.remoteJid;
      if (remoteJid?.endsWith("@g.us")) continue; // ignora grupos
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        "";
      if (!text.trim()) continue;

      const phone = jidToPhone(remoteJid);
      const name = msg.pushName || "";
      logger.info(`Mensagem de ${phone}: ${text}`);

      try {
        const { data } = await axios.post(`${BACKEND_URL}/api/whatsapp/inbound`, {
          phone,
          name,
          text,
        });
        if (data?.reply) {
          await sock.sendMessage(remoteJid, { text: data.reply });
          logger.info(`Resposta enviada para ${phone}`);
        } else {
          logger.info(`Sem resposta automática (IA pausada ou handoff) para ${phone}`);
        }
      } catch (e) {
        logger.error(`Erro ao processar inbound: ${e.message}`);
      }
    }
  });
}

// ---- HTTP server (status/QR e healthcheck) ----
const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, status: connectionStatus }));

app.get("/status", (_req, res) => res.json({ status: connectionStatus }));

app.get("/qr", async (_req, res) => {
  if (!lastQR) return res.status(404).json({ error: "QR não disponível" });
  const dataUrl = await QRCode.toDataURL(lastQR);
  res.json({ qr: lastQR, dataUrl });
});

app.post("/logout", async (_req, res) => {
  try {
    await sock?.logout();
    await reportStatus("disconnected");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => logger.info(`whatsapp-service HTTP em :${PORT}`));
startSock().catch((e) => logger.error(`Falha ao iniciar Baileys: ${e.message}`));
