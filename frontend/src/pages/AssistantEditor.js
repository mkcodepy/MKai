import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Send, Bot, Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { getAssistant, createAssistant, updateAssistant, getModels, streamPlayground } from "@/lib/api";
import { toast } from "sonner";

const EMPTY = {
  name: "", description: "", avatar_color: "#0d9488", provider: "openai", model: "gpt-5.4",
  language: "Português (Brasil)", personality: "", tone: "", role_instructions: "",
  rules: [], business_objectives: "", greeting: "", fallback: "", handoff_rules: "",
  kb_strict: true, temperature: 0.5,
};

export default function AssistantEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;
  const [form, setForm] = useState(EMPTY);
  const [models, setModels] = useState({ providers: {}, defaults: {} });
  const [saving, setSaving] = useState(false);
  const [newRule, setNewRule] = useState("");

  // mini preview
  const [preview, setPreview] = useState([]);
  const [previewInput, setPreviewInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const previewSession = useRef(`preview-${Math.random().toString(36).slice(2)}`);
  const bottomRef = useRef(null);

  useEffect(() => { getModels().then(setModels).catch(() => {}); }, []);
  useEffect(() => {
    if (id) getAssistant(id).then((d) => setForm({ ...EMPTY, ...d })).catch(() => toast.error("Erro ao carregar"));
  }, [id]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [preview, streaming]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const onProviderChange = (p) => {
    const first = (models.providers[p] || [])[0] || form.model;
    setForm((f) => ({ ...f, provider: p, model: first }));
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Informe um nome para o assistente"); return; }
    setSaving(true);
    try {
      if (isNew) {
        const created = await createAssistant(form);
        toast.success("Assistente criado");
        navigate(`/assistentes/${created.id}`);
      } else {
        await updateAssistant(id, form);
        toast.success("Alterações salvas");
      }
    } catch { toast.error("Erro ao salvar"); }
    setSaving(false);
  };

  const addRule = () => { if (newRule.trim()) { set("rules", [...form.rules, newRule.trim()]); setNewRule(""); } };
  const removeRule = (i) => set("rules", form.rules.filter((_, idx) => idx !== i));

  const sendPreview = async () => {
    if (!id) { toast.info("Salve o assistente antes de testar o preview"); return; }
    if (!previewInput.trim() || streaming) return;
    const msg = previewInput.trim();
    setPreview((p) => [...p, { role: "customer", text: msg }, { role: "assistant", text: "" }]);
    setPreviewInput("");
    setStreaming(true);
    await streamPlayground({
      assistantId: id, sessionId: previewSession.current, message: msg,
      onDelta: (d) => setPreview((p) => { const n = [...p]; n[n.length - 1].text += d; return n; }),
      onDone: (info) => { setStreaming(false); if (info.handoff) toast.warning("Handoff sugerido pela IA"); if (info.clean) setPreview((p) => { const n=[...p]; n[n.length-1].text = info.clean; return n; }); },
      onError: (e) => { setStreaming(false); toast.error("Erro: " + e); },
    });
  };

  const providers = Object.keys(models.providers || {});

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/assistentes")} data-testid="editor-back"><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{isNew ? "Novo Assistente" : form.name || "Editar Assistente"}</h1>
            <p className="text-sm text-muted-foreground">Personalidade, regras, modelo e objetivos</p>
          </div>
        </div>
        <Button onClick={save} disabled={saving} data-testid="assistant-editor-save-button">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="modelo">
            <TabsList className="flex w-full flex-wrap justify-start gap-1">
              <TabsTrigger value="modelo" data-testid="tab-modelo">Modelo</TabsTrigger>
              <TabsTrigger value="personalidade" data-testid="tab-personalidade">Personalidade & Tom</TabsTrigger>
              <TabsTrigger value="regras" data-testid="tab-regras">Regras & Guardrails</TabsTrigger>
              <TabsTrigger value="objetivos" data-testid="tab-objetivos">Objetivos</TabsTrigger>
              <TabsTrigger value="handoff" data-testid="tab-handoff">Handoff</TabsTrigger>
              <TabsTrigger value="mensagens" data-testid="tab-mensagens">Mensagens padrão</TabsTrigger>
            </TabsList>

            <TabsContent value="modelo" className="mt-4 space-y-4">
              <Card><CardContent className="grid gap-4 p-5 sm:grid-cols-2">
                <div className="sm:col-span-2"><Label>Nome do assistente</Label>
                  <Input className="mt-1.5" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Nova — Atendimento" data-testid="input-name" /></div>
                <div className="sm:col-span-2"><Label>Descrição</Label>
                  <Input className="mt-1.5" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Breve descrição interna" data-testid="input-description" /></div>
                <div><Label>Provedor de IA</Label>
                  <Select value={form.provider} onValueChange={onProviderChange}>
                    <SelectTrigger className="mt-1.5" data-testid="select-provider"><SelectValue /></SelectTrigger>
                    <SelectContent>{providers.map((p) => <SelectItem key={p} value={p}>{p === "openai" ? "OpenAI" : p === "anthropic" ? "Anthropic" : "Google Gemini"}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div><Label>Modelo</Label>
                  <Select value={form.model} onValueChange={(v) => set("model", v)}>
                    <SelectTrigger className="mt-1.5" data-testid="select-model"><SelectValue /></SelectTrigger>
                    <SelectContent>{(models.providers[form.provider] || []).map((m) => <SelectItem key={m} value={m} className="font-mono text-xs">{m}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div><Label>Idioma</Label>
                  <Input className="mt-1.5" value={form.language} onChange={(e) => set("language", e.target.value)} data-testid="input-language" /></div>
                <div><Label>Cor do avatar</Label>
                  <input type="color" className="mt-1.5 h-10 w-full cursor-pointer rounded-lg border bg-background" value={form.avatar_color} onChange={(e) => set("avatar_color", e.target.value)} data-testid="input-color" /></div>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="personalidade" className="mt-4 space-y-4">
              <Card><CardContent className="space-y-4 p-5">
                <div><Label>Personalidade</Label><Textarea className="mt-1.5" rows={3} value={form.personality} onChange={(e) => set("personality", e.target.value)} placeholder="Ex.: Simpática, prestativa e objetiva." data-testid="input-personality" /></div>
                <div><Label>Tom de voz</Label><Textarea className="mt-1.5" rows={2} value={form.tone} onChange={(e) => set("tone", e.target.value)} placeholder="Ex.: Cordial e profissional, emojis com moderação." data-testid="input-tone" /></div>
                <div><Label>Papel e instruções</Label><Textarea className="mt-1.5" rows={4} value={form.role_instructions} onChange={(e) => set("role_instructions", e.target.value)} placeholder="O que o assistente faz e como deve agir." data-testid="input-role" /></div>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="regras" className="mt-4 space-y-4">
              <Card><CardContent className="space-y-4 p-5">
                <div>
                  <Label>Regras e guardrails</Label>
                  <div className="mt-1.5 flex gap-2">
                    <Input value={newRule} onChange={(e) => setNewRule(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRule())} placeholder="Adicionar uma regra…" data-testid="input-new-rule" />
                    <Button type="button" variant="secondary" onClick={addRule} data-testid="add-rule-button"><Plus className="h-4 w-4" /></Button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {form.rules.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma regra adicionada.</p>}
                    {form.rules.map((r, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border bg-secondary/40 px-3 py-2 text-sm" data-testid="rule-item">
                        <span>{r}</span>
                        <button onClick={() => removeRule(i)} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div><div className="font-medium">Responder somente com base na KB</div><p className="text-xs text-muted-foreground">Evita alucinações: usa apenas a base de conhecimento.</p></div>
                  <Switch checked={form.kb_strict} onCheckedChange={(v) => set("kb_strict", v)} data-testid="switch-kb-strict" />
                </div>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="objetivos" className="mt-4 space-y-4">
              <Card><CardContent className="p-5">
                <Label>Objetivos comerciais</Label>
                <Textarea className="mt-1.5" rows={5} value={form.business_objectives} onChange={(e) => set("business_objectives", e.target.value)} placeholder="Ex.: Resolver a dúvida com precisão, reduzir devoluções e incentivar a compra." data-testid="input-objectives" />
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="handoff" className="mt-4 space-y-4">
              <Card><CardContent className="p-5">
                <Label>Regras de transferência para humano</Label>
                <Textarea className="mt-1.5" rows={5} value={form.handoff_rules} onChange={(e) => set("handoff_rules", e.target.value)} placeholder="Quando escalar para um atendente humano." data-testid="input-handoff" />
                <p className="mt-2 text-xs text-muted-foreground">A IA sinaliza handoff automaticamente e a conversa é pausada para o atendente assumir.</p>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="mensagens" className="mt-4 space-y-4">
              <Card><CardContent className="space-y-4 p-5">
                <div><Label>Mensagem de saudação</Label><Textarea className="mt-1.5" rows={2} value={form.greeting} onChange={(e) => set("greeting", e.target.value)} placeholder="Primeira mensagem ao cliente." data-testid="input-greeting" /></div>
                <div><Label>Mensagem de fallback</Label><Textarea className="mt-1.5" rows={2} value={form.fallback} onChange={(e) => set("fallback", e.target.value)} placeholder="Quando não souber responder." data-testid="input-fallback" /></div>
              </CardContent></Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Mini preview */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20 flex h-[560px] flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b py-3">
              <CardTitle className="flex items-center gap-2 text-sm"><Bot className="h-4 w-4 text-primary" /> Teste rápido</CardTitle>
              <Badge variant="outline" className="rounded-full font-mono text-[10px]">{form.model}</Badge>
            </CardHeader>
            <CardContent className="flex-1 space-y-3 overflow-y-auto p-4 scroll-thin">
              {preview.length === 0 && <p className="pt-10 text-center text-sm text-muted-foreground">{isNew ? "Salve para testar o assistente." : "Envie uma mensagem para testar."}</p>}
              {preview.map((m, i) => (
                <div key={i} className={`flex ${m.role === "customer" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.role === "customer" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border bg-card"}`}>
                    {m.text || (streaming && i === preview.length - 1 ? <span className="inline-flex gap-1"><span className="typing-dot">●</span><span className="typing-dot">●</span><span className="typing-dot">●</span></span> : "")}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </CardContent>
            <div className="flex items-center gap-2 border-t p-3">
              <Input value={previewInput} onChange={(e) => setPreviewInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendPreview()} placeholder="Mensagem do cliente…" disabled={isNew} data-testid="preview-input" />
              <Button size="icon" onClick={sendPreview} disabled={streaming || isNew} data-testid="preview-send"><Send className="h-4 w-4" /></Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
