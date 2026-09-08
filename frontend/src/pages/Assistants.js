import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Bot, Plus, Pencil, Trash2, FlaskConical, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { listAssistants, deleteAssistant } from "@/lib/api";
import { toast } from "sonner";

const PROVIDER_LABEL = { openai: "OpenAI", anthropic: "Anthropic", gemini: "Gemini" };

export default function Assistants() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = () => listAssistants().then((d) => { setItems(d); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const onDelete = async (id) => {
    try { await deleteAssistant(id); toast.success("Assistente excluído"); load(); }
    catch { toast.error("Erro ao excluir"); }
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Assistentes</h1>
          <p className="text-sm text-muted-foreground">Configure a personalidade, regras e modelo de cada assistente</p>
        </div>
        <Button data-testid="assistants-new-button" onClick={() => navigate("/assistentes/novo")}>
          <Plus className="mr-2 h-4 w-4" /> Novo Assistente
        </Button>
      </div>

      {loading ? (
        <div className="mt-10 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : items.length === 0 ? (
        <Card className="mt-8"><CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary"><Bot className="h-6 w-6" /></div>
          <div className="font-medium">Nenhum assistente ainda</div>
          <p className="max-w-sm text-sm text-muted-foreground">Crie seu primeiro assistente para começar a atender clientes com IA.</p>
          <Button data-testid="assistants-empty-new" onClick={() => navigate("/assistentes/novo")}><Plus className="mr-2 h-4 w-4" /> Criar assistente</Button>
        </CardContent></Card>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((a, i) => (
            <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: i * 0.03 }}>
              <Card className="h-full" data-testid="assistant-card">
                <CardContent className="flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ backgroundColor: a.avatar_color || "#0d9488" }}>
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-heading font-semibold">{a.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{a.description || "Sem descrição"}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-full">{PROVIDER_LABEL[a.provider] || a.provider}</Badge>
                    <Badge variant="outline" className="rounded-full font-mono text-[11px]">{a.model}</Badge>
                    <Badge variant="outline" className="rounded-full"><BookOpen className="mr-1 h-3 w-3" />{a.knowledge_count} fontes</Badge>
                  </div>
                  <div className="mt-auto flex items-center gap-2">
                    <Button size="sm" variant="secondary" className="flex-1" data-testid="assistant-edit-button" onClick={() => navigate(`/assistentes/${a.id}`)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button size="sm" variant="ghost" data-testid="assistant-test-button" onClick={() => navigate(`/playground?assistant=${a.id}`)}>
                      <FlaskConical className="mr-1.5 h-3.5 w-3.5" /> Testar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="text-destructive" data-testid="assistant-delete-button"><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir assistente?</AlertDialogTitle>
                          <AlertDialogDescription>Isso também remove a base de conhecimento vinculada. Ação irreversível.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction data-testid="assistant-delete-confirm" onClick={() => onDelete(a.id)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
