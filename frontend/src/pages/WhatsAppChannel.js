import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { QrCode, PlugZap, Power, RefreshCw, Smartphone, CheckCircle2, Info, MessagesSquare, Settings2, Server } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getWhatsappStatus, connectWhatsapp, disconnectWhatsapp, setWhatsappAssistant, updateWhatsappSettings, listAssistants } from "@/lib/api";
import { toast } from "sonner";

const STATUS = {
  connected: { label: "Conectado", c: "bg-success/12 text-success border-success/25", dot: "bg-success" },
  connecting: { label: "Conectando", c: "bg-info/12 text-info border-info/25", dot: "bg-info" },
  disconnected: { label: "Desconectado", c: "bg-muted text-muted-foreground border", dot: "bg-muted-foreground" },
};

function FakeQR({ seed }) {
  const cells = [];
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const rand = () => { h = (h * 1103515245 + 12345) >>> 0; return (h >>> 16) & 1; };
  for (let i = 0; i < 21 * 21; i++) cells.push(rand());
  return (
    <div className="grid gap-[2px] rounded-lg bg-white p-3" style={{ gridTemplateColumns: "repeat(21, 1fr)", width: 260, height: 260 }} data-testid="whatsapp-qr-grid">
      {cells.map((v, i) => <div key={i} style={{ background: v ? "#0b3b39" : "transparent" }} className="aspect-square rounded-[1px]" />)}
    </div>
  );
}

const SettingRow = ({ title, desc, children }) => (
  <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
    <div><div className="text-sm font-medium">{title}</div><p className="text-xs text-muted-foreground">{desc}</p></div>
    {children}
  </div>
);

export default function WhatsAppChannel() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [assistants, setAssistants] = useState([]);
  const navigate = useNavigate();

  const load = () => getWhatsappStatus().then(setState).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, []);
  useEffect(() => { listAssistants().then(setAssistants).catch(() => {}); }, []);

  const connect = async () => { setLoading(true); try { const s = await connectWhatsapp(); setState(s); toast.success("Sessão iniciada — escaneie o QR"); } catch { toast.error("Erro ao conectar"); } setLoading(false); };
  const disconnect = async () => { setLoading(true); try { const s = await disconnectWhatsapp(); setState(s); toast.success("Desconectado"); } catch { toast.error("Erro"); } setLoading(false); };
  const chooseAssistant = async (id) => { try { const s = await setWhatsappAssistant(id); setState(s); toast.success("Assistente do WhatsApp definido"); } catch { toast.error("Erro ao definir assistente"); } };
  const setSetting = async (patch) => { try { const s = await updateWhatsappSettings(patch); setState(s); toast.success("Configuração salva"); } catch { toast.error("Erro ao salvar"); } };

  const st = STATUS[state?.status] || STATUS.disconnected;
  const live = state?.mode === "live";

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Canal WhatsApp</h1>
          <p className="text-sm text-muted-foreground">Conecte via QR Code (sem API oficial) e atenda pela Central de Conversas</p>
        </div>
        <div className="flex items-center gap-2">
          {live && <Badge variant="outline" className="rounded-full text-[10px]" data-testid="whatsapp-mode-badge"><Server className="mr-1 h-3 w-3" />microserviço ativo</Badge>}
          <Badge variant="outline" className={`${st.c} rounded-full`} data-testid="whatsapp-status-badge">
            <span className={`mr-1.5 h-2 w-2 rounded-full ${st.dot}`} />{st.label}
          </Badge>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><QrCode className="h-4 w-4 text-primary" />Conexão por QR Code</CardTitle></CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              {state?.status === "connected" ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/12 text-success"><CheckCircle2 className="h-8 w-8" /></div>
                  <div className="font-medium">WhatsApp conectado</div>
                  {state.phone && <div className="font-mono text-sm text-muted-foreground">{state.phone}</div>}
                </div>
              ) : state?.status === "connecting" && state?.qr ? (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-2">
                  {live ? <img alt="QR Code do WhatsApp" width={260} height={260} className="rounded-lg bg-white p-2" src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(state.qr)}`} data-testid="whatsapp-qr-image" /> : <FakeQR seed={state.qr} />}
                  <span className="text-xs text-muted-foreground">{live ? "QR real emitido pelo microserviço — escaneie em até 60s" : "QR ilustrativo (modo demonstração)"}</span>
                </motion.div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
                  <Smartphone className="h-10 w-10" />
                  <p className="max-w-xs text-sm">Clique em “Iniciar conexão” para gerar o QR Code.</p>
                </div>
              )}
              <div className="flex gap-2">
                {state?.status === "disconnected" && <Button onClick={connect} disabled={loading} data-testid="whatsapp-connect-button"><PlugZap className="mr-2 h-4 w-4" />Iniciar conexão</Button>}
                {state?.status === "connecting" && <Button variant="secondary" onClick={connect} disabled={loading} data-testid="whatsapp-qr-refresh-button"><RefreshCw className="mr-2 h-4 w-4" />Atualizar QR</Button>}
                {state?.status !== "disconnected" && <Button variant="secondary" onClick={disconnect} disabled={loading} data-testid="whatsapp-disconnect-button"><Power className="mr-2 h-4 w-4" />Desconectar</Button>}
              </div>
            </CardContent>
          </Card>

          <Card className="border-info/30 bg-info/5">
            <CardContent className="flex gap-3 p-4">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-info" />
              <div className="text-sm">
                <div className="font-medium">{live ? "Microserviço WhatsApp conectado a este backend" : "Modo de demonstração neste ambiente"}</div>
                <p className="mt-1 text-muted-foreground">A conexão real (Baileys) roda no microserviço Node <code className="font-mono text-xs">whatsapp-service</code>, no seu servidor. Ele agrupa mensagens seguidas, mostra “digitando…”, divide respostas longas e entrega as mensagens do atendente humano. Para testar o fluxo de IA aqui, use o <b>Simulador</b>.</p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={() => navigate("/conversas")} data-testid="whatsapp-goto-simulator"><MessagesSquare className="mr-2 h-4 w-4" />Abrir Central de Conversas</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base">Assistente responsável</CardTitle></CardHeader>
            <CardContent>
              <Label className="text-xs">Qual assistente responde no WhatsApp</Label>
              <Select value={state?.assistant_id || ""} onValueChange={chooseAssistant}>
                <SelectTrigger className="mt-1.5" data-testid="whatsapp-assistant-select"><SelectValue placeholder="Selecione um assistente…" /></SelectTrigger>
                <SelectContent>{assistants.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
              <p className="mt-2 text-xs text-muted-foreground">Novas conversas do WhatsApp usarão este assistente por padrão.</p>
            </CardContent>
          </Card>

          <Card data-testid="whatsapp-settings-card">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Settings2 className="h-4 w-4 text-primary" />Comportamento no WhatsApp</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <SettingRow title="Resposta automática da IA" desc="Desligue para apenas registrar mensagens (modo somente humano).">
                <Switch checked={state?.auto_reply ?? true} onCheckedChange={(v) => setSetting({ auto_reply: v })} data-testid="wa-auto-reply" /></SettingRow>
              <SettingRow title="Agrupar mensagens seguidas" desc="Espera (ms) antes de responder, para juntar várias mensagens curtas do cliente em uma só resposta.">
                <Input type="number" min={0} max={15000} step={500} className="w-28" defaultValue={state?.debounce_ms ?? 2500} onBlur={(e) => setSetting({ debounce_ms: Number(e.target.value) })} data-testid="wa-debounce" /></SettingRow>
              <SettingRow title="Tempo de digitação simulado" desc="Mostra “digitando…” por este tempo mínimo (ms) antes de enviar — mais natural.">
                <Input type="number" min={0} max={10000} step={500} className="w-28" defaultValue={state?.reply_delay_ms ?? 1500} onBlur={(e) => setSetting({ reply_delay_ms: Number(e.target.value) })} data-testid="wa-delay" /></SettingRow>
              <SettingRow title="Dividir respostas longas" desc="Envia parágrafos como mensagens separadas, como uma pessoa faria.">
                <Switch checked={state?.split_long_messages ?? true} onCheckedChange={(v) => setSetting({ split_long_messages: v })} data-testid="wa-split" /></SettingRow>
              <SettingRow title="Ignorar grupos" desc="Não responde em conversas de grupo.">
                <Switch checked={state?.ignore_groups ?? true} onCheckedChange={(v) => setSetting({ ignore_groups: v })} data-testid="wa-groups" /></SettingRow>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base">Como conectar (servidor externo)</CardTitle></CardHeader>
            <CardContent>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>No seu servidor: <code className="font-mono text-xs">cd whatsapp-service && cp .env.example .env && yarn install && yarn start</code></li>
                <li>Configure <code className="font-mono text-xs">BACKEND_URL</code> apontando para esta API.</li>
                <li>No WhatsApp do celular: <b>Aparelhos conectados</b> → <b>Conectar um aparelho</b> e escaneie o QR (aparece aqui ou em <code className="font-mono text-xs">/qr</code> do serviço).</li>
                <li>Pronto! As mensagens chegam na Central de Conversas com IA, handoff e copiloto.</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
