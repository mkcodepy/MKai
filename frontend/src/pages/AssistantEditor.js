import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Save, Send, Bot, Plus, X, Loader2, Sparkles, LayoutTemplate, Wand2, FileCode2, Copy,
  ShoppingBag, Stethoscope, Building2, MonitorSmartphone, UtensilsCrossed, CalendarCheck, Trash2, ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getAssistant, createAssistant, updateAssistant, getModels, streamPlayground, listTemplates, getTemplate,
  generateAssistant, getAssistantPrompt, evaluateAssistant,
} from "@/lib/api";
import { MetaRow, ChipListEditor } from "@/components/AIMeta";
import { toast } from "sonner";

const TEMPLATE_ICONS = { ShoppingBag, Stethoscope, Building2, MonitorSmartphone, UtensilsCrossed, CalendarCheck };

export const EMPTY = {
  name: "", description: "", avatar_color: "#0d9488", company_name: "", company_description: "", mission: "", skills: [],
  provider: "openai", model: "gpt-5.4", fallback_provider: null, temperature: 0.5, max_tokens: 700, language: "Português (Brasil)",
  personality: "", tone: "", response_length: "media", formality: "neutro", use_emojis: true, whatsapp_style: true, proactive_followup: true,
  role_instructions: "", rules: [], forbidden_topics: [], business_objectives: "", few_shot_examples: [],
  greeting: "", fallback: "", handoff_rules: "", escalation_keywords: [], business_hours: "", off_hours_message: "",
  collect_lead_info: false, lead_fields: ["nome", "e-mail"],
  kb_strict: true, retrieval_top_k: 5, kb_min_score: 0.05, kb_full_context_chars: 12000, memory_window: 16, template_key: null,
};

const LENGTH_LABEL = { curta: "Curta (1–3 frases)", media: "Média (2–5 frases)", longa: "Completa" };
const FORMALITY_LABEL = { informal: "Informal", neutro: "Neutro", formal: "Formal" };
const PROVIDER_LABEL = { openai: "OpenAI", anthropic: "Anthropic", gemini: "Google Gemini" };

const Field = ({ label, hint, children, className = "" }) => (
  <div className={className}>
    <Label>{label}</Label>
    {children}
    {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
  </div>
);

const SwitchRow = ({ title, desc, checked, onChange, testid }) => (
  <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
    <div><div className="text-sm font-medium">{title}</div><p className="text-xs text-muted-foreground">{desc}</p></div>
    <Switch checked={!!checked} onCheckedChange={onChange} data-testid={testid} />
  </div>
);

export default function AssistantEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;
  const [form, setForm] = useState(EMPTY);
  const [models, setModels] = useState({ providers: {}, defaults: {}, hints: {} });
  const [saving, setSaving] = useState(false);
  const [newRule, setNewRule] = useState("");
  const [templates, setTemplates] = useState([]);
  const [suggestedKb, setSuggestedKb] = useState([]);
  // gerar com IA
  const [genOpen, setGenOpen] = useState(false);
  const [genDesc, setGenDesc] = useState("");
  const [genProvider, setGenProvider] = useState("openai");
  const [generating, setGenerating] = useState(false);
  // prompt compilado
  const [promptInfo, setPromptInfo] = useState(null);
  const [promptLoading, setPromptLoading] = useState(false);
  // avaliação
  const [evalQs, setEvalQs] = useState("Quais são as formas de pagamento?\nQual o prazo de entrega?\nQuero falar com um atendente\nVocês vendem carros?");
  const [evalRes, setEvalRes] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  // mini preview
  const [preview, setPreview] = useState([]);
  const [previewInput, setPreviewInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const previewSession = useRef(`preview-${Math.random().toString(36).slice(2)}`);
  const bottomRef = useRef(null);

  useEffect(() => { getModels().then(setModels).catch(() => {}); listTemplates().then(setTemplates).catch(() => {}); }, []);
  useEffect(() => {
    if (id) getAssistant(id).then((d) => setForm({ ...EMPTY, ...d })).catch(() => toast.error("Erro ao carregar"));
  }, [id]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [preview, streaming]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const onProviderChange = (p) => {
    const first = (models.providers[p] || [])[0] || form.model;
    setForm((f) => ({ ...f, provider: p, model: first }));
  };

  const applyConfig = (cfg, label) => {
    setForm((f) => ({ ...EMPTY, ...f, ...cfg, provider: cfg.provider || f.provider, model: cfg.model || f.model }));
    if (cfg.suggested_knowledge) setSuggestedKb(cfg.suggested_knowledge);
    toast.success(label);
  };

  const applyTemplate = async (key) => {
    try { const t = await getTemplate(key); applyConfig(t.config, `Template "${t.label}" aplicado — ajuste e salve`); setSuggestedKb(t.suggested_knowledge || []); }
    catch { toast.error("Erro ao carregar template"); }
  };

  const generate = async () => {
    if (genDesc.trim().length < 15) { toast.error("Descreva o negócio com mais detalhes"); return; }
    setGenerating(true);
    try {
      const cfg = await generateAssistant(genDesc, genProvider, form.language);
      applyConfig(cfg, "Configuração gerada pela IA — revise, ajuste e salve");
      setGenOpen(false);
    } catch (e) { toast.error(e?.response?.data?.detail || "Falha ao gerar configuração"); }
    setGenerating(false);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Informe um nome para o assistente"); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      delete payload.id; delete payload.created_at; delete payload.updated_at; delete payload.knowledge_count; delete payload.conversation_count; delete payload.suggested_knowledge;
      if (isNew) {
        const created = await createAssistant(payload);
        toast.success("Assistente criado");
        navigate(`/assistentes/${created.id}`);
      } else {
        await updateAssistant(id, payload);
        toast.success("Alterações salvas");
      }
    } catch (e) { toast.error(e?.response?.data?.detail || "Erro ao salvar"); }
    setSaving(false);
  };

  const addRule = () => { if (newRule.trim()) { set("rules", [...form.rules, newRule.trim()]); setNewRule(""); } };
  const removeRule = (i) => set("rules", form.rules.filter((_, idx) => idx !== i));

  const loadPrompt = async () => {
    if (!id) { toast.info("Salve o assistente para ver o prompt compilado"); return; }
    setPromptLoading(true);
    try { setPromptInfo(await getAssistantPrompt(id)); } catch { toast.error("Erro ao compilar prompt"); }
    setPromptLoading(false);
  };

  const runEval = async () => {
    if (!id) { toast.info("Salve o assistente antes de avaliar"); return; }
    const qs = evalQs.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!qs.length) return;
    setEvaluating(true); setEvalRes(null);
    try { setEvalRes(await evaluateAssistant(id, qs)); toast.success("Avaliação concluída"); }
    catch { toast.error("Falha na avaliação"); }
    setEvaluating(false);
  };

  const sendPreview = async () => {
    if (!id) { toast.info("Salve o assistente antes de testar o preview"); return; }
    if (!previewInput.trim() || streaming) return;
    const msg = previewInput.trim();
    setPreview((p) => [...p, { role: "customer", text: msg }, { role: "assistant", text: "" }]);
    setPreviewInput("");
    setStreaming(true);
    await streamPlayground({
      assistantId: id, sessionId: previewSession.current, message: msg,
      onDelta: (d) => setPreview((p) => { const n = [...p]; n[n.length - 1] = { ...n[n.length - 1], text: n[n.length - 1].text + d }; return n; }),
      onDone: (info) => {
        setStreaming(false);
        if (info.handoff) toast.warning("Handoff sugerido pela IA");
        setPreview((p) => { const n = [...p]; n[n.length - 1] = { ...n[n.length - 1], text: info.clean || n[n.length - 1].text, meta: info.meta, latency: info.latency_ms, sources: info.sources }; return n; });
      },
      onError: (e) => { setStreaming(false); toast.error("Erro: " + e); },
    });
  };

  const providers = Object.keys(models.providers || {});

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/assistentes")} data-testid="editor-back"><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{isNew ? "Novo Assistente" : form.name || "Editar Assistente"}</h1>
            <p className="text-sm text-muted-foreground">Identidade, habilidades, estilo, regras, handoff e conhecimento — no padrão de um agente bem projetado</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setGenOpen(true)} data-testid="generate-ai-button"><Sparkles className="mr-2 h-4 w-4 text-primary" />Gerar com IA</Button>
          <Button onClick={save} disabled={saving} data-testid="assistant-editor-save-button">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>

      {/* Templates (destaque para novo assistente) */}
      {isNew && templates.length > 0 && (
        <Card className="mt-6 border-primary/20 bg-secondary/30">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><LayoutTemplate className="h-4 w-4 text-primary" />Comece por um template de alta qualidade</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {templates.map((t) => {
              const Icon = TEMPLATE_ICONS[t.icon] || Bot;
              return (
                <button key={t.key} type="button" onClick={() => applyTemplate(t.key)} data-testid={`template-${t.key}`}
                  className={`flex flex-col items-start gap-1.5 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/40 ${form.template_key === t.key ? "border-primary ring-1 ring-primary/30" : ""}`}>
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium leading-tight">{t.label}</span>
                  <span className="text-[11px] leading-snug text-muted-foreground">{t.summary}</span>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {suggestedKb.length > 0 && (
        <div className="mt-4 rounded-lg border border-info/30 bg-info/5 p-3 text-sm" data-testid="suggested-kb">
          <div className="font-medium">Conteúdos recomendados para a Base de Conhecimento</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">{suggestedKb.map((s, i) => <Badge key={i} variant="outline" className="rounded-full">{s}</Badge>)}</div>
          <p className="mt-1.5 text-xs text-muted-foreground">Após salvar, adicione esses conteúdos em <b>Base de Conhecimento</b> — a qualidade das respostas depende disso.</p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="identidade">
            <TabsList className="flex w-full flex-wrap justify-start gap-1">
              <TabsTrigger value="identidade" data-testid="tab-identidade">Identidade</TabsTrigger>
              <TabsTrigger value="modelo" data-testid="tab-modelo">Modelo</TabsTrigger>
              <TabsTrigger value="personalidade" data-testid="tab-personalidade">Personalidade & Estilo</TabsTrigger>
              <TabsTrigger value="regras" data-testid="tab-regras">Instruções & Regras</TabsTrigger>
              <TabsTrigger value="exemplos" data-testid="tab-exemplos">Exemplos</TabsTrigger>
              <TabsTrigger value="handoff" data-testid="tab-handoff">Handoff & Horários</TabsTrigger>
              <TabsTrigger value="conhecimento" data-testid="tab-conhecimento">Conhecimento & Memória</TabsTrigger>
              <TabsTrigger value="mensagens" data-testid="tab-mensagens">Mensagens</TabsTrigger>
              <TabsTrigger value="prompt" data-testid="tab-prompt" onClick={loadPrompt}>Prompt</TabsTrigger>
              <TabsTrigger value="avaliacao" data-testid="tab-avaliacao">Avaliação</TabsTrigger>
            </TabsList>

            {/* IDENTIDADE */}
            <TabsContent value="identidade" className="mt-4 space-y-4">
              <Card><CardContent className="grid gap-4 p-5 sm:grid-cols-2">
                <Field label="Nome do assistente" className="sm:col-span-2">
                  <Input className="mt-1.5" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Nova — Atendimento" data-testid="input-name" /></Field>
                <Field label="Descrição interna" className="sm:col-span-2">
                  <Input className="mt-1.5" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Para que serve este assistente" data-testid="input-description" /></Field>
                <Field label="Nome da empresa">
                  <Input className="mt-1.5" value={form.company_name} onChange={(e) => set("company_name", e.target.value)} placeholder="Ex.: TechNova" data-testid="input-company" /></Field>
                <Field label="Cor do avatar">
                  <input type="color" className="mt-1.5 h-10 w-full cursor-pointer rounded-lg border bg-background" value={form.avatar_color} onChange={(e) => set("avatar_color", e.target.value)} data-testid="input-color" /></Field>
                <Field label="Sobre a empresa" className="sm:col-span-2" hint="O que a empresa faz, vende ou oferece. Dá contexto para respostas mais específicas.">
                  <Textarea className="mt-1.5" rows={2} value={form.company_description} onChange={(e) => set("company_description", e.target.value)} data-testid="input-company-desc" /></Field>
                <Field label="Missão do assistente" className="sm:col-span-2" hint="O resultado que ele deve gerar em cada conversa. Ex.: resolver no primeiro contato e conduzir ao agendamento.">
                  <Textarea className="mt-1.5" rows={2} value={form.mission} onChange={(e) => set("mission", e.target.value)} data-testid="input-mission" /></Field>
                <Field label="Habilidades (skills)" className="sm:col-span-2" hint="O que o assistente sabe fazer nesta operação. Fora disso, ele redireciona com gentileza.">
                  <div className="mt-1.5"><ChipListEditor items={form.skills} onChange={(v) => set("skills", v)} placeholder="Ex.: Informar prazos e frete por região" testid="input-skill" /></div></Field>
              </CardContent></Card>
            </TabsContent>

            {/* MODELO */}
            <TabsContent value="modelo" className="mt-4 space-y-4">
              <Card><CardContent className="grid gap-4 p-5 sm:grid-cols-2">
                <Field label="Provedor de IA">
                  <Select value={form.provider} onValueChange={onProviderChange}>
                    <SelectTrigger className="mt-1.5" data-testid="select-provider"><SelectValue /></SelectTrigger>
                    <SelectContent>{providers.map((p) => <SelectItem key={p} value={p}>{PROVIDER_LABEL[p] || p}</SelectItem>)}</SelectContent>
                  </Select></Field>
                <Field label="Modelo" hint={models.hints?.[form.model]}>
                  <Select value={form.model} onValueChange={(v) => set("model", v)}>
                    <SelectTrigger className="mt-1.5" data-testid="select-model"><SelectValue /></SelectTrigger>
                    <SelectContent>{(models.providers[form.provider] || []).map((m) => <SelectItem key={m} value={m}><span className="font-mono text-xs">{m}</span>{models.hints?.[m] && <span className="ml-2 text-xs text-muted-foreground">· {models.hints[m]}</span>}</SelectItem>)}</SelectContent>
                  </Select></Field>
                <Field label="Provedor de fallback" hint="Se o provedor principal falhar, a resposta é gerada por este (resiliência).">
                  <Select value={form.fallback_provider || "none"} onValueChange={(v) => set("fallback_provider", v === "none" ? null : v)}>
                    <SelectTrigger className="mt-1.5" data-testid="select-fallback-provider"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Nenhum</SelectItem>{providers.filter((p) => p !== form.provider).map((p) => <SelectItem key={p} value={p}>{PROVIDER_LABEL[p] || p}</SelectItem>)}</SelectContent>
                  </Select></Field>
                <Field label="Idioma">
                  <Input className="mt-1.5" value={form.language} onChange={(e) => set("language", e.target.value)} data-testid="input-language" /></Field>
                <Field label={`Criatividade (temperatura): ${Number(form.temperature).toFixed(1)}`} hint="Baixa = mais fiel e previsível (recomendado para atendimento). Modelos GPT-5/o-series ignoram este parâmetro.">
                  <div className="mt-3 px-1"><Slider value={[Number(form.temperature)]} min={0} max={1} step={0.1} onValueChange={([v]) => set("temperature", v)} data-testid="slider-temperature" /></div></Field>
                <Field label="Máximo de tokens por resposta" hint="Limita o tamanho da resposta (700 ≈ 500 palavras).">
                  <Input className="mt-1.5" type="number" min={100} max={4000} value={form.max_tokens ?? ""} onChange={(e) => set("max_tokens", e.target.value ? Number(e.target.value) : null)} data-testid="input-max-tokens" /></Field>
              </CardContent></Card>
            </TabsContent>

            {/* PERSONALIDADE & ESTILO */}
            <TabsContent value="personalidade" className="mt-4 space-y-4">
              <Card><CardContent className="space-y-4 p-5">
                <Field label="Personalidade"><Textarea className="mt-1.5" rows={3} value={form.personality} onChange={(e) => set("personality", e.target.value)} placeholder="Ex.: Simpática, prestativa e objetiva. Transmite confiança sem ser robótica." data-testid="input-personality" /></Field>
                <Field label="Tom de voz"><Textarea className="mt-1.5" rows={2} value={form.tone} onChange={(e) => set("tone", e.target.value)} placeholder="Ex.: Cordial e profissional, emojis com moderação." data-testid="input-tone" /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Tamanho das respostas">
                    <Select value={form.response_length} onValueChange={(v) => set("response_length", v)}>
                      <SelectTrigger className="mt-1.5" data-testid="select-length"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(LENGTH_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                    </Select></Field>
                  <Field label="Formalidade">
                    <Select value={form.formality} onValueChange={(v) => set("formality", v)}>
                      <SelectTrigger className="mt-1.5" data-testid="select-formality"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(FORMALITY_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                    </Select></Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <SwitchRow title="Emojis" desc="Até 1 por mensagem" checked={form.use_emojis} onChange={(v) => set("use_emojis", v)} testid="switch-emojis" />
                  <SwitchRow title="Formato WhatsApp" desc="*negrito*, sem markdown" checked={form.whatsapp_style} onChange={(v) => set("whatsapp_style", v)} testid="switch-whatsapp-style" />
                  <SwitchRow title="Próximo passo" desc="Fecha com pergunta/ação" checked={form.proactive_followup} onChange={(v) => set("proactive_followup", v)} testid="switch-followup" />
                </div>
              </CardContent></Card>
            </TabsContent>

            {/* INSTRUÇÕES & REGRAS */}
            <TabsContent value="regras" className="mt-4 space-y-4">
              <Card><CardContent className="space-y-4 p-5">
                <Field label="Papel e instruções específicas" hint="Como ele conduz o atendimento, o que pede ao cliente, o que faz em cada situação."><Textarea className="mt-1.5" rows={5} value={form.role_instructions} onChange={(e) => set("role_instructions", e.target.value)} data-testid="input-role" /></Field>
                <Field label="Objetivos comerciais" hint="Guiam sugestões sem forçar venda."><Textarea className="mt-1.5" rows={3} value={form.business_objectives} onChange={(e) => set("business_objectives", e.target.value)} data-testid="input-objectives" /></Field>
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
                        <button onClick={() => removeRule(i)} className="text-muted-foreground hover:text-destructive" aria-label="Remover regra"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
                <Field label="Tópicos proibidos" hint="O assistente redireciona educadamente quando o cliente puxar esses assuntos.">
                  <div className="mt-1.5"><ChipListEditor items={form.forbidden_topics} onChange={(v) => set("forbidden_topics", v)} placeholder="Ex.: política, concorrentes" testid="input-forbidden" /></div></Field>
              </CardContent></Card>
            </TabsContent>

            {/* EXEMPLOS */}
            <TabsContent value="exemplos" className="mt-4 space-y-4">
              <Card><CardContent className="space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <div><div className="font-medium">Exemplos de conversa (few-shot)</div><p className="text-xs text-muted-foreground">Mostre ao modelo como responder. 2 a 5 exemplos realistas elevam muito a consistência do estilo.</p></div>
                  <Button size="sm" variant="secondary" onClick={() => set("few_shot_examples", [...form.few_shot_examples, { user: "", assistant: "" }])} data-testid="add-example-button"><Plus className="mr-1.5 h-4 w-4" />Exemplo</Button>
                </div>
                {form.few_shot_examples.length === 0 && <p className="text-sm text-muted-foreground">Nenhum exemplo ainda.</p>}
                {form.few_shot_examples.map((ex, i) => (
                  <div key={i} className="space-y-2 rounded-lg border p-3" data-testid="example-item">
                    <div className="flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">Exemplo {i + 1}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => set("few_shot_examples", form.few_shot_examples.filter((_, idx) => idx !== i))} aria-label="Remover exemplo"><Trash2 className="h-3.5 w-3.5" /></Button></div>
                    <Input value={ex.user} placeholder="Cliente: …" onChange={(e) => { const n = [...form.few_shot_examples]; n[i] = { ...n[i], user: e.target.value }; set("few_shot_examples", n); }} data-testid="example-user" />
                    <Textarea rows={2} value={ex.assistant} placeholder="Assistente: …" onChange={(e) => { const n = [...form.few_shot_examples]; n[i] = { ...n[i], assistant: e.target.value }; set("few_shot_examples", n); }} data-testid="example-assistant" />
                  </div>
                ))}
              </CardContent></Card>
            </TabsContent>

            {/* HANDOFF & HORÁRIOS */}
            <TabsContent value="handoff" className="mt-4 space-y-4">
              <Card><CardContent className="space-y-4 p-5">
                <Field label="Política de transferência para humano" hint="A IA sinaliza handoff automaticamente; a conversa é pausada e vai para a fila humana com briefing."><Textarea className="mt-1.5" rows={4} value={form.handoff_rules} onChange={(e) => set("handoff_rules", e.target.value)} data-testid="input-handoff" /></Field>
                <Field label="Palavras-chave de escalonamento imediato" hint="Gatilho determinístico: se aparecerem na mensagem do cliente, o handoff é forçado.">
                  <div className="mt-1.5"><ChipListEditor items={form.escalation_keywords} onChange={(v) => set("escalation_keywords", v)} placeholder="Ex.: falar com atendente, procon, reembolso" testid="input-escalation" /></div></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Horário de atendimento humano"><Input className="mt-1.5" value={form.business_hours} onChange={(e) => set("business_hours", e.target.value)} placeholder="Seg–Sex, 9h às 18h" data-testid="input-hours" /></Field>
                  <Field label="Mensagem fora do horário"><Input className="mt-1.5" value={form.off_hours_message} onChange={(e) => set("off_hours_message", e.target.value)} placeholder="Informada ao encaminhar fora do horário" data-testid="input-off-hours" /></Field>
                </div>
                <SwitchRow title="Coletar dados do cliente (lead)" desc="Pede de forma natural os dados abaixo quando houver interesse. Dados capturados aparecem no perfil da conversa." checked={form.collect_lead_info} onChange={(v) => set("collect_lead_info", v)} testid="switch-lead" />
                {form.collect_lead_info && <ChipListEditor items={form.lead_fields} onChange={(v) => set("lead_fields", v)} placeholder="Ex.: nome, telefone, e-mail" testid="input-lead-field" />}
              </CardContent></Card>
            </TabsContent>

            {/* CONHECIMENTO & MEMÓRIA */}
            <TabsContent value="conhecimento" className="mt-4 space-y-4">
              <Card><CardContent className="space-y-4 p-5">
                <SwitchRow title="Responder somente com base na KB (modo estrito)" desc="Evita alucinações: sem dados na base, usa o fallback e oferece humano." checked={form.kb_strict} onChange={(v) => set("kb_strict", v)} testid="switch-kb-strict" />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Trechos recuperados (top-k)" hint="Quantos trechos da base entram no contexto (bases grandes)."><Input className="mt-1.5" type="number" min={1} max={12} value={form.retrieval_top_k} onChange={(e) => set("retrieval_top_k", Number(e.target.value))} data-testid="input-topk" /></Field>
                  <Field label="Base completa até (caracteres)" hint="Bases menores que isso vão inteiras ao modelo — máxima precisão."><Input className="mt-1.5" type="number" min={0} max={60000} step={1000} value={form.kb_full_context_chars} onChange={(e) => set("kb_full_context_chars", Number(e.target.value))} data-testid="input-full-context" /></Field>
                  <Field label="Janela de memória (mensagens)" hint="Mensagens recentes enviadas como histórico. Conversas longas ganham resumo automático."><Input className="mt-1.5" type="number" min={4} max={60} value={form.memory_window} onChange={(e) => set("memory_window", Number(e.target.value))} data-testid="input-memory" /></Field>
                </div>
                <p className="text-xs text-muted-foreground">Retrieval híbrido (BM25 + TF‑IDF) com normalização PT‑BR, sinônimos de atendimento e expansão de perguntas curtas ("e o prazo?"). Teste em <b>Base de Conhecimento → Testar busca</b>.</p>
              </CardContent></Card>
            </TabsContent>

            {/* MENSAGENS */}
            <TabsContent value="mensagens" className="mt-4 space-y-4">
              <Card><CardContent className="space-y-4 p-5">
                <Field label="Saudação (primeira interação)" hint="Usada como inspiração na primeira resposta — o assistente se apresenta e já responde."><Textarea className="mt-1.5" rows={2} value={form.greeting} onChange={(e) => set("greeting", e.target.value)} data-testid="input-greeting" /></Field>
                <Field label="Fallback (quando não souber)"><Textarea className="mt-1.5" rows={2} value={form.fallback} onChange={(e) => set("fallback", e.target.value)} data-testid="input-fallback" /></Field>
              </CardContent></Card>
            </TabsContent>

            {/* PROMPT */}
            <TabsContent value="prompt" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between py-3">
                  <CardTitle className="flex items-center gap-2 text-sm"><FileCode2 className="h-4 w-4 text-primary" />Prompt de sistema compilado</CardTitle>
                  <div className="flex items-center gap-2">
                    {promptInfo && <Badge variant="outline" className="rounded-full font-mono text-[10px]">~{promptInfo.approx_tokens} tokens</Badge>}
                    <Button size="sm" variant="secondary" onClick={loadPrompt} disabled={promptLoading} data-testid="prompt-refresh">{promptLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}</Button>
                    {promptInfo && <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(promptInfo.prompt); toast.success("Prompt copiado"); }} data-testid="prompt-copy"><Copy className="h-4 w-4" /></Button>}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-xs text-muted-foreground">Transparência total: é exatamente isto que o modelo recebe (com um exemplo de retrieval). Use para ajuste fino e auditoria.</p>
                  {!promptInfo ? <div className="py-8 text-center text-sm text-muted-foreground">{isNew ? "Salve o assistente para compilar o prompt." : "Clique em Atualizar."}</div>
                    : <ScrollArea className="h-[480px] rounded-lg border bg-secondary/30 p-4"><pre className="whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed" data-testid="compiled-prompt">{promptInfo.prompt}</pre></ScrollArea>}
                </CardContent>
              </Card>
            </TabsContent>

            {/* AVALIAÇÃO */}
            <TabsContent value="avaliacao" className="mt-4 space-y-4">
              <Card><CardContent className="space-y-4 p-5">
                <div><div className="flex items-center gap-2 font-medium"><ClipboardCheck className="h-4 w-4 text-primary" />Bateria de testes de qualidade</div>
                  <p className="text-xs text-muted-foreground">Uma pergunta por linha (até 10). Rode após alterar a base ou as regras para medir fidelidade, handoff e latência.</p></div>
                <Textarea rows={5} value={evalQs} onChange={(e) => setEvalQs(e.target.value)} data-testid="eval-questions" />
                <Button onClick={runEval} disabled={evaluating || isNew} data-testid="eval-run">{evaluating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}{evaluating ? "Avaliando…" : "Rodar avaliação"}</Button>
                {evalRes && (
                  <div className="space-y-3" data-testid="eval-results">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[["Confiança média", `${Math.round(evalRes.summary.avg_confidence * 100)}%`], ["Usou a base", `${evalRes.summary.kb_used_rate}%`], ["Handoff", `${evalRes.summary.handoff_rate}%`], ["Latência média", `${(evalRes.summary.avg_latency_ms / 1000).toFixed(1)}s`]].map(([l, v]) => (
                        <div key={l} className="rounded-lg border bg-secondary/30 p-3"><div className="text-[11px] text-muted-foreground">{l}</div><div className="font-heading text-xl font-semibold">{v}</div></div>
                      ))}
                    </div>
                    {evalRes.results.map((r, i) => (
                      <div key={i} className="rounded-lg border p-3 text-sm">
                        <div className="font-medium">{r.question}</div>
                        {r.error ? <div className="mt-1 text-destructive">{r.error}</div> : <>
                          <div className="mt-1 whitespace-pre-wrap text-muted-foreground">{r.answer}</div>
                          <MetaRow meta={r.meta} latency={r.latency_ms} sources={r.sources} className="mt-2" />
                        </>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent></Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Mini preview */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20 flex h-[640px] flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b py-3">
              <CardTitle className="flex items-center gap-2 text-sm"><Bot className="h-4 w-4 text-primary" /> Teste rápido</CardTitle>
              <Badge variant="outline" className="rounded-full font-mono text-[10px]">{form.model}</Badge>
            </CardHeader>
            <CardContent className="flex-1 space-y-3 overflow-y-auto p-4 scroll-thin">
              {preview.length === 0 && <p className="pt-10 text-center text-sm text-muted-foreground">{isNew ? "Salve para testar o assistente." : "Envie uma mensagem para testar. Metadados (intenção, sentimento, confiança) aparecem sob cada resposta."}</p>}
              {preview.map((m, i) => (
                <div key={i} className={`flex ${m.role === "customer" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[90%]">
                    <div className={`whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.role === "customer" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border bg-card"}`}>
                      {m.text || (streaming && i === preview.length - 1 ? <span className="inline-flex gap-1"><span className="typing-dot">●</span><span className="typing-dot">●</span><span className="typing-dot">●</span></span> : "")}
                    </div>
                    {m.meta && <MetaRow meta={m.meta} latency={m.latency} sources={m.sources} className="mt-1" />}
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

      {/* Dialog: Gerar com IA */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Gerar assistente com IA</DialogTitle>
            <DialogDescription>Descreva o negócio e o atendimento desejado. A IA monta identidade, missão, habilidades, personalidade, regras, exemplos, handoff e sugere a base de conhecimento. Você revisa tudo antes de salvar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea rows={6} value={genDesc} onChange={(e) => setGenDesc(e.target.value)} placeholder="Ex.: Clínica odontológica em Curitiba com 3 dentistas. Atendemos convênios Amil e Bradesco, fazemos clareamento, implantes e ortodontia. Quero agendar consultas pelo WhatsApp, tirar dúvidas de preços e evitar dar orientação médica." data-testid="generate-description" />
            <div>
              <Label className="text-xs">Provedor usado para gerar</Label>
              <Select value={genProvider} onValueChange={setGenProvider}>
                <SelectTrigger className="mt-1" data-testid="generate-provider"><SelectValue /></SelectTrigger>
                <SelectContent>{providers.map((p) => <SelectItem key={p} value={p}>{PROVIDER_LABEL[p] || p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setGenOpen(false)}>Cancelar</Button>
            <Button onClick={generate} disabled={generating} data-testid="generate-submit">{generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}{generating ? "Gerando…" : "Gerar configuração"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
