import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  MessagesSquare, Plus, Send, Pause, Play, UserCog, CheckCircle2, Bot, User, Phone, Trash2, Search,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  listAssistants, listConversations, getConversation, createConversation,
  sendInbound, sendHuman, updateConvStatus, deleteConversation,
} from "@/lib/api";
import { toast } from "sonner";

const STATUS_BADGE = {
  bot: { t: "IA ativa", c: "bg-secondary text-secondary-foreground" },
  human: { t: "Humano", c: "bg-warning/15 text-warning border border-warning/25" },
  resolved: { t: "Resolvida", c: "bg-success/12 text-success border border-success/25" },
};

const ROLE_META = {
  customer: { align: "justify-start", bubble: "rounded-bl-md bg-secondary text-secondary-foreground", icon: User, label: "Cliente" },
  assistant: { align: "justify-end", bubble: "rounded-br-md border bg-card", icon: Bot, label: "IA" },
  human: { align: "justify-end", bubble: "rounded-br-md bg-primary text-primary-foreground", icon: UserCog, label: "Atendente" },
};

export default function Conversations() {
  const [assistants, setAssistants] = useState([]);
  const [convs, setConvs] = useState([]);
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [mode, setMode] = useState("customer"); // customer | human
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  // new conversation form
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAssistant, setNewAssistant] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const bottomRef = useRef(null);

  const loadList = () => listConversations(filter === "all" ? undefined : filter).then(setConvs).catch(() => {});
  const loadDetail = (id) => getConversation(id).then((d) => { setDetail(d); }).catch(() => {});

  useEffect(() => { listAssistants().then((d) => { setAssistants(d); if (d[0]) setNewAssistant(d[0].id); }); }, []);
  useEffect(() => { loadList(); }, [filter]);
  useEffect(() => {
    if (!selectedId) return;
    loadDetail(selectedId);
    const t = setInterval(() => loadDetail(selectedId), 4000);
    return () => clearInterval(t);
  }, [selectedId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [detail?.messages?.length]);

  const open = (id) => { setSelectedId(id); setMode("customer"); };

  const createNew = async () => {
    if (!newName.trim() || !newAssistant) { toast.error("Informe nome e assistente"); return; }
    try {
      const c = await createConversation({ channel: "simulator", contact_name: newName, contact_phone: newPhone, assistant_id: newAssistant });
      toast.success("Conversa criada");
      setNewName(""); setNewPhone(""); setDialogOpen(false);
      await loadList(); open(c.id);
    } catch { toast.error("Erro ao criar conversa"); }
  };

  const send = async () => {
    if (!input.trim() || !selectedId || sending) return;
    const text = input.trim(); setInput(""); setSending(true);
    try {
      if (mode === "customer") await sendInbound(selectedId, text);
      else await sendHuman(selectedId, text);
      await loadDetail(selectedId); loadList();
    } catch { toast.error("Erro ao enviar"); }
    setSending(false);
  };

  const setStatus = async (data) => {
    try { const c = await updateConvStatus(selectedId, data); setDetail((d) => ({ ...d, ...c })); loadList(); }
    catch { toast.error("Erro ao atualizar"); }
  };

  const remove = async (id) => {
    try { await deleteConversation(id); toast.success("Conversa excluída"); if (selectedId === id) { setSelectedId(null); setDetail(null); } loadList(); }
    catch { toast.error("Erro ao excluir"); }
  };

  const filtered = convs.filter((c) => !search || c.contact_name.toLowerCase().includes(search.toLowerCase()) || (c.contact_phone || "").includes(search));

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0">
      {/* LEFT: list */}
      <div className="flex w-full max-w-[340px] shrink-0 flex-col border-r bg-card">
        <div className="space-y-3 border-b p-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">Conversas</h2>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild><Button size="sm" data-testid="conversations-new-button"><Plus className="mr-1.5 h-4 w-4" />Nova</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova conversa (simulador)</DialogTitle>
                  <DialogDescription>Crie uma conversa de teste para simular o atendimento com a IA.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div><Label>Nome do contato</Label><Input className="mt-1.5" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex.: João Silva" data-testid="new-conv-name" /></div>
                  <div><Label>Telefone (opcional)</Label><Input className="mt-1.5" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+55 11 99999-9999" data-testid="new-conv-phone" /></div>
                  <div><Label>Assistente</Label>
                    <Select value={newAssistant} onValueChange={setNewAssistant}>
                      <SelectTrigger className="mt-1.5" data-testid="new-conv-assistant"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                      <SelectContent>{assistants.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                    </Select></div>
                </div>
                <DialogFooter><Button onClick={createNew} data-testid="new-conv-create">Criar conversa</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" data-testid="conversations-search" />
          </div>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all" className="text-xs" data-testid="filter-all">Todas</TabsTrigger>
              <TabsTrigger value="bot" className="text-xs" data-testid="filter-bot">IA</TabsTrigger>
              <TabsTrigger value="human" className="text-xs" data-testid="filter-human">Humano</TabsTrigger>
              <TabsTrigger value="resolved" className="text-xs" data-testid="filter-resolved">Resolv.</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
          {filtered.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma conversa.</div>}
          {filtered.map((c) => {
            const s = STATUS_BADGE[c.status] || STATUS_BADGE.bot;
            const active = c.id === selectedId;
            return (
              <button key={c.id} onClick={() => open(c.id)} data-testid="inbox-conversation-list-item"
                className={`flex w-full flex-col gap-1 border-b px-3 py-3 text-left transition-colors ${active ? "border-l-2 border-l-primary bg-secondary" : "hover:bg-accent/50"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{c.contact_name}</span>
                  <Badge variant="outline" className={`${s.c} shrink-0 rounded-full text-[10px]`}>{s.t}</Badge>
                </div>
                <span className="truncate text-xs text-muted-foreground">{c.last_message || "Sem mensagens"}</span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="rounded-full text-[10px]">{c.channel}</Badge>
                  {c.handoff && <Badge variant="outline" className="rounded-full border-warning/25 bg-warning/15 text-[10px] text-warning">handoff</Badge>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* CENTER: thread */}
      <div className="flex min-w-0 flex-1 flex-col">
        {!detail ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <MessagesSquare className="mb-2 h-10 w-10" /><p className="text-sm">Selecione uma conversa</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-heading font-semibold">{detail.contact_name}</span>
                  {detail.ai_paused ? <Badge variant="outline" className="rounded-full border-warning/25 bg-warning/15 text-[10px] text-warning">IA pausada</Badge>
                    : <Badge variant="outline" className="rounded-full text-[10px]">IA ativa</Badge>}
                </div>
                {detail.contact_phone && <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground"><Phone className="h-3 w-3" />{detail.contact_phone}</div>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {detail.ai_paused
                  ? <Button size="sm" variant="secondary" onClick={() => setStatus({ ai_paused: false, status: "bot" })} data-testid="inbox-toggle-ai-pause"><Play className="mr-1.5 h-4 w-4" />Retomar IA</Button>
                  : <Button size="sm" variant="secondary" onClick={() => setStatus({ ai_paused: true, status: "human" })} data-testid="inbox-toggle-ai-pause"><Pause className="mr-1.5 h-4 w-4" />Pausar IA</Button>}
                <Button size="sm" variant="secondary" onClick={() => setStatus({ status: "human" })} data-testid="inbox-transfer-human"><UserCog className="mr-1.5 h-4 w-4" />Humano</Button>
                <Button size="sm" variant="secondary" onClick={() => setStatus({ status: "resolved" })} data-testid="inbox-resolve"><CheckCircle2 className="mr-1.5 h-4 w-4" />Resolver</Button>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(detail.id)} data-testid="inbox-delete"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-background p-4 scroll-thin">
              {(detail.messages || []).map((m) => {
                const meta = ROLE_META[m.role] || ROLE_META.customer;
                const Icon = meta.icon;
                return (
                  <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={`flex ${meta.align}`}>
                    <div className="max-w-[75%]">
                      <div className={`flex items-center gap-1.5 text-[11px] text-muted-foreground ${m.role === "customer" ? "justify-start" : "justify-end"}`}>
                        <Icon className="h-3 w-3" />{meta.label}
                      </div>
                      <div className={`mt-1 whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${meta.bubble}`}>{m.text}
                        {m.handoff && <div className="mt-1.5 text-[11px] font-medium text-warning">⚑ handoff sinalizado</div>}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="border-t p-3">
              <div className="mb-2 flex items-center gap-2">
                <Button size="sm" variant={mode === "customer" ? "default" : "secondary"} onClick={() => setMode("customer")} data-testid="composer-mode-customer"><User className="mr-1.5 h-3.5 w-3.5" />Como Cliente</Button>
                <Button size="sm" variant={mode === "human" ? "default" : "secondary"} onClick={() => setMode("human")} data-testid="composer-mode-human"><UserCog className="mr-1.5 h-3.5 w-3.5" />Como Atendente</Button>
                {mode === "customer" && !detail.ai_paused && <span className="text-xs text-muted-foreground">A IA responderá automaticamente</span>}
                {mode === "customer" && detail.ai_paused && <span className="text-xs text-warning">IA pausada — a mensagem não será respondida pela IA</span>}
              </div>
              <div className="flex items-center gap-2">
                <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder={mode === "customer" ? "Simular mensagem do cliente…" : "Responder como atendente humano…"} disabled={sending} data-testid="inbox-composer-input" />
                <Button onClick={send} disabled={sending} data-testid="inbox-composer-send"><Send className="h-4 w-4" /></Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* RIGHT: details */}
      {detail && (
        <div className="hidden w-[300px] shrink-0 flex-col border-l bg-card p-4 xl:flex">
          <h3 className="font-heading text-sm font-semibold">Detalhes</h3>
          <div className="mt-3 space-y-3 text-sm">
            <div><div className="text-xs text-muted-foreground">Contato</div><div className="font-medium">{detail.contact_name}</div></div>
            {detail.contact_phone && <div><div className="text-xs text-muted-foreground">Telefone</div><div className="font-mono text-xs">{detail.contact_phone}</div></div>}
            <div><div className="text-xs text-muted-foreground">Canal</div><Badge variant="outline" className="mt-1 rounded-full">{detail.channel}</Badge></div>
            <div><div className="text-xs text-muted-foreground">Assistente</div><div className="font-medium">{detail.assistant_name || assistants.find(a=>a.id===detail.assistant_id)?.name || "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Status da IA</div>
              <div className="mt-1 flex items-center gap-2">
                {detail.ai_paused ? <Badge variant="outline" className="rounded-full border-warning/25 bg-warning/15 text-warning">Pausada</Badge> : <Badge variant="outline" className="rounded-full border-success/25 bg-success/12 text-success">Ativa</Badge>}
              </div>
            </div>
            <div><div className="text-xs text-muted-foreground">Mensagens</div><div className="font-medium">{detail.messages?.length || 0}</div></div>
          </div>
        </div>
      )}
    </div>
  );
}
