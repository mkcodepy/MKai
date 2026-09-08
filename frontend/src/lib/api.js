import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const http = axios.create({ baseURL: API });

// Assistants
export const listAssistants = () => http.get("/assistants").then((r) => r.data);
export const getAssistant = (id) => http.get(`/assistants/${id}`).then((r) => r.data);
export const createAssistant = (data) => http.post("/assistants", data).then((r) => r.data);
export const updateAssistant = (id, data) => http.put(`/assistants/${id}`, data).then((r) => r.data);
export const deleteAssistant = (id) => http.delete(`/assistants/${id}`).then((r) => r.data);

// Meta
export const getModels = () => http.get("/meta/models").then((r) => r.data);

// Knowledge
export const listKnowledge = (assistantId) =>
  http.get("/knowledge", { params: { assistant_id: assistantId } }).then((r) => r.data);
export const createKnowledgeText = (data) => http.post("/knowledge/text", data).then((r) => r.data);
export const uploadKnowledgeFile = (assistantId, file) => {
  const fd = new FormData();
  fd.append("assistant_id", assistantId);
  fd.append("file", file);
  return http.post("/knowledge/upload", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};
export const deleteKnowledge = (id) => http.delete(`/knowledge/${id}`).then((r) => r.data);

// Conversations
export const listConversations = (status) =>
  http.get("/conversations", { params: status ? { status } : {} }).then((r) => r.data);
export const getConversation = (id) => http.get(`/conversations/${id}`).then((r) => r.data);
export const createConversation = (data) => http.post("/conversations", data).then((r) => r.data);
export const sendInbound = (id, text) => http.post(`/conversations/${id}/inbound`, { text }).then((r) => r.data);
export const sendHuman = (id, text) => http.post(`/conversations/${id}/human`, { text }).then((r) => r.data);
export const updateConvStatus = (id, data) => http.patch(`/conversations/${id}/status`, data).then((r) => r.data);
export const deleteConversation = (id) => http.delete(`/conversations/${id}`).then((r) => r.data);

// WhatsApp
export const getWhatsappStatus = () => http.get("/whatsapp/status").then((r) => r.data);
export const connectWhatsapp = () => http.post("/whatsapp/connect").then((r) => r.data);
export const disconnectWhatsapp = () => http.post("/whatsapp/disconnect").then((r) => r.data);
export const setWhatsappAssistant = (assistantId) =>
  http.patch("/whatsapp/settings", { assistant_id: assistantId }).then((r) => r.data);

// Dashboard
export const getStats = () => http.get("/dashboard/stats").then((r) => r.data);

// Playground streaming (SSE via fetch)
export async function streamPlayground({ assistantId, sessionId, message, onDelta, onDone, onError }) {
  try {
    const resp = await fetch(`${API}/playground/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assistant_id: assistantId, session_id: sessionId, message }),
    });
    if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop();
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        const json = JSON.parse(line.slice(5).trim());
        if (json.delta) onDelta && onDelta(json.delta);
        else if (json.done) onDone && onDone(json);
        else if (json.error) onError && onError(json.error);
      }
    }
  } catch (e) {
    onError && onError(e.message || String(e));
  }
}
