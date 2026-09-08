/**
 * AtendeAI — Microserviço WhatsApp (Baileys) v2
 * ------------------------------------------------------------
 * Conecta ao WhatsApp via QR Code (multi-device, sem API oficial e sem Chromium)
 * e faz a ponte HTTP com o backend FastAPI do AtendeAI Console.
 *
 * Fluxo:
 *   - Ao iniciar, abre sessão Baileys e emite QR (envia ao backend + expõe em /qr).
 *   - Ao conectar, reporta status "connected" ao backend (e heartbeat periódico).
 *   - Mensagens recebidas são AGRUPADAS por contato (debounce) para responder a várias
 *     mensagens seguidas de uma só vez -> POST {BACKEND_URL}/api/whatsapp/inbound.
 *   - O backend roda a IA e devolve {reply}. O serviço marca como lida, mostra
 *     "digitando...", divide respostas longas em partes naturais e envia.
 *   - POST /send {phone,text} permite ao backend enviar mensagens do atendente humano.
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
const HEARTBEAT_MS = Number(process.env.HEARTBEAT_MS || 60000);

const logger = pino({ level: process.env.LOG_LEVEL || "info" });
let sock = null;
let lastQR = null;
let connectionStatus = "disconnected";
let settings = { auto_reply: true, reply_delay_ms: 1500, debounce_ms: 2500, ignore_groups: true, split_long_messages: true };

// buffer de mensagens por contato (debounce)
const pending = new Map(); // phone -> { jid, name, texts: [], timer }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function refreshSettings() {
  try {
    const { data } = await axios.get(`${BACKEND_URL}/api/whatsapp/settings`, { timeout: 8000 });
    settings = { ...settings, ...data };
  } catch (e) {
    logger.debug(`Não foi possível ler settings do backend: ${e.message}`);
  }
}

async function reportStatus(status, phone = "") {
  connectionStatus = status;
  try {
    await axios.post(`${BACKEND_URL}/api/whatsapp/bridge/status`, { status, phone }, { timeout: 8000 });
  } catch (e) {
    logger.warn(`Falha ao reportar status ao backend: ${e.message}`);
  }
}

async function reportQR(qr) {
  lastQR = qr;
  try {
    await axios.post(`${BACKEND_URL}/api/whatsapp/bridge/qr`, { qr }, { timeout: 8000 });
  } catch (e) {
    logger.warn(`Falha ao enviar QR ao backend: ${e.message}`);
  }
}

function jidToPhone(jid) {
  // exemplo: 5511999999999@s.whatsapp.net -> +5511999999999
  const num = (jid || "").split("@")[0].split(":")[0];
  return num ? `+${num}` : jid;
}

function phoneToJid(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
}

/** Divide respostas longas em blocos naturais (por parágrafo), máx ~600 chars cada. */
function splitMessage(text, max = 600) {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const parts = [];
  let cur = "";
  for (const p of paras) {
    if ((cur + "\n\n" + p).trim().length <= max) cur = (cur ? cur + "\n\n" : "") + p;
    else {
      if (cur) parts.push(cur);
      cur = p;
    }
  }
  if (cur) parts.push(cur);
  return parts.length ? parts : [text];
}

async function sendText(jid, text, { typingMs = 0, split = true } = {}) {
  if (!sock) throw new Error("Socket não inicializado");
  const parts = split ? splitMessage(text) : [text];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    try {
      await sock.sendPresenceUpdate("composing", jid);
      // tempo de digitação proporcional ao tamanho (limitado), para parecer natural
      const delay = Math.min(Math.max(typingMs, part.length * 15), 6000);
      if (delay) await sleep(delay);
      await sock.sendPresenceUpdate("paused", jid);
    } catch (_) {
      /* presença é opcional */
    }
    await sock.sendMessage(jid, { text: part });
    if (i < parts.length - 1) await sleep(600);
  }
}

async function flushPending(phone) {
  const entry = pending.get(phone);
  if (!entry) return;
  pending.delete(phone);
  const text = entry.texts.join("\n").trim();
  if (!text) return;
  logger.info(`Processando ${entry.texts.length} msg(s) de ${phone}`);
  try {
    try { await sock.readMessages(entry.keys); } catch (_) { /* opcional */ }
    const { data } = await axios.post(
      `${BACKEND_URL}/api/whatsapp/inbound`,
      { phone, name: entry.name, text },
      { timeout: 120000 }
    );
    if (data?.reply) {
      await sendText(entry.jid, data.reply, {
        typingMs: Number(data.reply_delay_ms ?? settings.reply_delay_ms ?? 0),
        split: data.split ?? settings.split_long_messages,
      });
      logger.info(`Resposta enviada para ${phone}${data.handoff ? " (handoff sinalizado)" : ""}`);
    } else {
      logger.info(`Sem resposta automática (IA pausada/handoff/auto_reply off) para ${phone}`);
    }
  } catch (e) {
    logger.error(`Erro ao processar inbound de ${phone}: ${e.message}`);
  }
}

function enqueue(jid, phone, name, text, key) {
  const entry = pending.get(phone) || { jid, name, texts: [], keys: [], timer: null };
  entry.texts.push(text);
  entry.keys.push(key);
  if (name) entry.name = name;
  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = setTimeout(() => flushPending(phone), Number(settings.debounce_ms || 0));
  pending.set(phone, entry);
}

function extractText(msg) {
  const m = msg.message || {};
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.listResponseMessage?.title ||
    (m.audioMessage ? "[áudio recebido — o cliente enviou uma mensagem de voz]" : "") ||
    (m.imageMessage ? "[imagem recebida]" : "") ||
    (m.documentMessage ? "[documento recebido]" : "") ||
    (m.stickerMessage ? "[figurinha]" : "") ||
    ""
  );
}

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    browser: ["AtendeAI", "Chrome", "2.0.0"],
    markOnlineOnConnect: false, // não "rouba" as notificações do celular
    syncFullHistory: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      logger.info("Novo QR gerado. Abra o console ou GET /qr para escanear.");
      await reportQR(qr);
    }
    if (connection === "connecting") await reportStatus("connecting");
    if (connection === "open") {
      const phone = jidToPhone(sock.user?.id || "");
      logger.info(`WhatsApp conectado: ${phone}`);
      lastQR = null;
      await reportStatus("connected", phone);
      await refreshSettings();
    }
    if (connection === "close") {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      logger.warn(`Conexão fechada (code=${code}). ${loggedOut ? "Sessão encerrada: apague auth_info e reinicie para novo QR." : "Reconectando em 3s..."}`);
      await reportStatus("disconnected");
      if (!loggedOut) setTimeout(() => startSock().catch((e) => logger.error(e.message)), 3000);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const remoteJid = msg.key.remoteJid || "";
      if (remoteJid === "status@broadcast") continue;
      if (settings.ignore_groups && remoteJid.endsWith("@g.us")) continue;
      const text = extractText(msg);
      if (!text.trim()) continue;
      const phone = jidToPhone(remoteJid);
      logger.info(`Mensagem de ${phone}: ${text.slice(0, 80)}`);
      enqueue(remoteJid, phone, msg.pushName || "", text, msg.key);
    }
  });
}

// ---- HTTP server (status/QR, envio e healthcheck) ----
const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, status: connectionStatus, pending: pending.size }));
app.get("/status", (_req, res) => res.json({ status: connectionStatus, settings }));

app.get("/qr", async (_req, res) => {
  if (!lastQR) return res.status(404).json({ error: "QR não disponível" });
  const dataUrl = await QRCode.toDataURL(lastQR);
  res.json({ qr: lastQR, dataUrl });
});

/** Envio de mensagem (usado pelo backend para mensagens do atendente humano). */
app.post("/send", async (req, res) => {
  const { phone, text, split } = req.body || {};
  if (!phone || !text) return res.status(400).json({ error: "phone e text são obrigatórios" });
  if (connectionStatus !== "connected") return res.status(503).json({ error: "WhatsApp não conectado" });
  try {
    await sendText(phoneToJid(phone), text, { typingMs: 400, split: split ?? false });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/settings/refresh", async (_req, res) => {
  await refreshSettings();
  res.json(settings);
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

app.listen(PORT, () => logger.info(`whatsapp-service HTTP em :${PORT} (backend: ${BACKEND_URL})`));
refreshSettings();
setInterval(async () => {
  await refreshSettings();
  if (connectionStatus === "connected") await reportStatus("connected", jidToPhone(sock?.user?.id || ""));
}, HEARTBEAT_MS);
startSock().catch((e) => logger.error(`Falha ao iniciar Baileys: ${e.message}`));
