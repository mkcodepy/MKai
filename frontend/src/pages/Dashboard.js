import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Bot, MessagesSquare, UserCog, BookOpen, ArrowUpRight, Activity, ShieldCheck, Clock, Smile, Meh, Frown, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getStats } from "@/lib/api";

const KPI = ({ icon: Icon, label, value, testid, suffix, hint }) => (
  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
    <Card data-testid={testid} className="h-full">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-1 font-heading text-3xl font-semibold tabular-nums">{value}{suffix || ""}</div>
          {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="h-5 w-5" /></div>
      </CardContent>
    </Card>
  </motion.div>
);

const STATUS_LABEL = { bot: { t: "IA ativa", c: "bg-secondary text-secondary-foreground" }, human: { t: "Humano", c: "bg-warning/15 text-warning border border-warning/25" }, resolved: { t: "Resolvida", c: "bg-success/12 text-success border border-success/25" } };
const DAY = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();
  useEffect(() => { getStats().then(setStats).catch(() => {}); }, []);

  const timeline = stats?.timeline || [];
  const maxDay = Math.max(1, ...timeline.map((d) => d.customer + d.assistant + d.human));
  const sent = stats?.sentiment || { positivo: 0, neutro: 0, negativo: 0 };
  const sentTotal = Math.max(1, sent.positivo + sent.neutro + sent.negativo);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral do seu atendimento com IA</p>
        </div>
        <Button data-testid="dashboard-new-assistant" onClick={() => navigate("/assistentes/novo")}><Bot className="mr-2 h-4 w-4" /> Novo Assistente</Button>
      </div>

      {!stats ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPI icon={MessagesSquare} label="Conversas" value={stats.conversations} hint={`${stats.active_conversations} ativas`} testid="dashboard-kpi-conversas" />
            <KPI icon={UserCog} label="Na fila humana" value={stats.human_conversations} testid="dashboard-kpi-humano" />
            <KPI icon={Activity} label="Taxa de handoff" value={stats.handoff_rate} suffix="%" hint="conversas escaladas" testid="dashboard-kpi-handoff" />
            <KPI icon={ShieldCheck} label="Resolvidas só pela IA" value={stats.ai_resolution_rate} suffix="%" hint="das resolvidas" testid="dashboard-kpi-ai-resolution" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPI icon={Bot} label="Assistentes" value={stats.assistants} testid="dashboard-kpi-assistentes" />
            <KPI icon={MessagesSquare} label="Respostas da IA" value={stats.ai_messages} hint={`${stats.messages} mensagens no total`} testid="dashboard-kpi-mensagens" />
            <KPI icon={Clock} label="Latência média" value={(stats.avg_latency_ms / 1000).toFixed(1)} suffix="s" testid="dashboard-kpi-latencia" />
            <KPI icon={ShieldCheck} label="Confiança média" value={Math.round((stats.avg_confidence || 0) * 100)} suffix="%" hint="fidelidade à base" testid="dashboard-kpi-confianca" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2" data-testid="dashboard-timeline">
              <CardHeader className="pb-2"><CardTitle className="text-base">Mensagens nos últimos 7 dias</CardTitle></CardHeader>
              <CardContent>
                <div className="flex h-40 items-end gap-2">
                  {timeline.map((d) => {
                    const total = d.customer + d.assistant + d.human;
                    const h = (v) => `${Math.round((v / maxDay) * 100)}%`;
                    return (
                      <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                        <div className="flex h-32 w-full flex-col-reverse overflow-hidden rounded-md bg-secondary/40" title={`${total} mensagens`}>
                          <div className="w-full bg-primary/40" style={{ height: h(d.customer) }} />
                          <div className="w-full bg-primary" style={{ height: h(d.assistant) }} />
                          <div className="w-full bg-warning" style={{ height: h(d.human) }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{DAY[new Date(d.date + "T12:00:00").getDay()]}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex gap-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary/40" />Cliente</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary" />IA</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-warning" />Atendente</span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card data-testid="dashboard-sentiment">
                <CardHeader className="pb-2"><CardTitle className="text-base">Sentimento dos clientes</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {[["positivo", Smile, "bg-success"], ["neutro", Meh, "bg-muted-foreground/50"], ["negativo", Frown, "bg-destructive"]].map(([k, Icon, c]) => (
                    <div key={k} className="flex items-center gap-2 text-sm">
                      <Icon className="h-4 w-4 text-muted-foreground" /><span className="w-16 capitalize">{k}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary"><div className={`h-full ${c}`} style={{ width: `${Math.round((sent[k] / sentTotal) * 100)}%` }} /></div>
                      <span className="w-8 text-right tabular-nums text-xs text-muted-foreground">{sent[k]}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card data-testid="dashboard-intents">
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" />Principais intenções</CardTitle></CardHeader>
                <CardContent className="space-y-1.5">
                  {(stats.intents || []).length === 0 && <p className="text-xs text-muted-foreground">Sem dados ainda.</p>}
                  {(stats.intents || []).map((it) => (
                    <div key={it.intent} className="flex items-center justify-between text-sm"><span className="truncate">{it.intent}</span><Badge variant="outline" className="rounded-full text-[10px]">{it.count}</Badge></div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Conversas recentes</CardTitle>
                <Button variant="ghost" size="sm" data-testid="dashboard-goto-conversas" onClick={() => navigate("/conversas")}>Ver todas <ArrowUpRight className="ml-1 h-4 w-4" /></Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {(stats.recent || []).length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma conversa ainda. Crie uma no Playground ou em Conversas.</div>}
                {(stats.recent || []).map((c) => {
                  const s = STATUS_LABEL[c.status] || STATUS_LABEL.bot;
                  return (
                    <div key={c.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/40" data-testid="dashboard-recent-item">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{c.contact_name}</span>
                          <Badge className={`${s.c} rounded-full text-[11px]`} variant="outline">{s.t}</Badge>
                          {c.handoff && <Badge variant="outline" className="rounded-full border-warning/25 bg-warning/15 text-[11px] text-warning">handoff</Badge>}
                          {c.last_intent && <Badge variant="outline" className="rounded-full text-[10px]">{c.last_intent}</Badge>}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{c.last_message || "—"}</div>
                      </div>
                      <div className="ml-3 shrink-0 text-xs text-muted-foreground">{c.assistant_name}</div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
            <Card data-testid="dashboard-per-assistant">
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4 text-primary" />Por assistente</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(stats.per_assistant || []).map((a) => (
                  <button key={a.id} onClick={() => navigate(`/assistentes/${a.id}`)} className="flex w-full items-center gap-3 rounded-lg border p-2.5 text-left hover:bg-accent/40">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: a.avatar_color || "#0d9488" }}><Bot className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{a.name}</div><div className="truncate font-mono text-[10px] text-muted-foreground">{a.provider}/{a.model}</div></div>
                    <div className="text-right text-xs"><div className="font-medium tabular-nums">{a.conversations}</div><div className="text-muted-foreground">{a.handoffs} handoff</div></div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
