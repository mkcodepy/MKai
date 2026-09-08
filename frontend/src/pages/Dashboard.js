import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Bot, MessagesSquare, UserCog, BookOpen, ArrowUpRight, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStats } from "@/lib/api";

const KPI = ({ icon: Icon, label, value, testid, suffix }) => (
  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
    <Card data-testid={testid}>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-1 font-heading text-3xl font-semibold tabular-nums">
            {value}{suffix || ""}
          </div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

const STATUS_LABEL = { bot: { t: "IA ativa", c: "bg-secondary text-secondary-foreground" }, human: { t: "Humano", c: "bg-warning/15 text-warning border border-warning/25" }, resolved: { t: "Resolvida", c: "bg-secondary text-secondary-foreground" } };

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();
  useEffect(() => { getStats().then(setStats).catch(() => {}); }, []);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral do seu atendimento com IA</p>
        </div>
        <Button data-testid="dashboard-new-assistant" onClick={() => navigate("/assistentes/novo")}>
          <Bot className="mr-2 h-4 w-4" /> Novo Assistente
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI icon={Bot} label="Assistentes" value={stats?.assistants ?? "–"} testid="dashboard-kpi-assistentes" />
        <KPI icon={MessagesSquare} label="Conversas" value={stats?.conversations ?? "–"} testid="dashboard-kpi-conversas" />
        <KPI icon={UserCog} label="Com humano" value={stats?.human_conversations ?? "–"} testid="dashboard-kpi-humano" />
        <KPI icon={Activity} label="Taxa de handoff" value={stats?.handoff_rate ?? "–"} suffix="%" testid="dashboard-kpi-handoff" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <KPI icon={MessagesSquare} label="Mensagens trocadas" value={stats?.messages ?? "–"} testid="dashboard-kpi-mensagens" />
        <KPI icon={BookOpen} label="Fontes de conhecimento" value={stats?.knowledge_sources ?? "–"} testid="dashboard-kpi-fontes" />
        <KPI icon={Activity} label="Resolvidas" value={stats?.resolved_conversations ?? "–"} testid="dashboard-kpi-resolvidas" />
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Conversas recentes</CardTitle>
          <Button variant="ghost" size="sm" data-testid="dashboard-goto-conversas" onClick={() => navigate("/conversas")}>
            Ver todas <ArrowUpRight className="ml-1 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {(stats?.recent || []).length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma conversa ainda. Crie uma no Playground ou em Conversas.</div>
          )}
          {(stats?.recent || []).map((c) => {
            const s = STATUS_LABEL[c.status] || STATUS_LABEL.bot;
            return (
              <div key={c.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/40" data-testid="dashboard-recent-item">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.contact_name}</span>
                    <Badge className={`${s.c} rounded-full text-[11px]`} variant="outline">{s.t}</Badge>
                    {c.handoff && <Badge variant="outline" className="rounded-full border-warning/25 bg-warning/15 text-[11px] text-warning">handoff</Badge>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{c.last_message || "—"}</div>
                </div>
                <div className="ml-3 shrink-0 text-xs text-muted-foreground">{c.assistant_name}</div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
