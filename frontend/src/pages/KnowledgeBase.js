import React, { useEffect, useState } from "react";
import { BookOpen, Upload, FileText, Trash2, Plus, Loader2, MessageSquareText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listAssistants, listKnowledge, createKnowledgeText, uploadKnowledgeFile, deleteKnowledge } from "@/lib/api";
import { toast } from "sonner";

export default function KnowledgeBase() {
  const [assistants, setAssistants] = useState([]);
  const [assistantId, setAssistantId] = useState("");
  const [sources, setSources] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState("text");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { listAssistants().then((d) => { setAssistants(d); if (d[0]) setAssistantId(d[0].id); }); }, []);
  const loadSources = (aid) => listKnowledge(aid).then(setSources).catch(() => {});
  useEffect(() => { if (assistantId) loadSources(assistantId); }, [assistantId]);

  const addText = async () => {
    if (!assistantId) { toast.error("Selecione um assistente"); return; }
    if (!title.trim() || !content.trim()) { toast.error("Preencha título e conteúdo"); return; }
    setBusy(true);
    try { await createKnowledgeText({ assistant_id: assistantId, title, content, type }); toast.success("Conhecimento adicionado"); setTitle(""); setContent(""); loadSources(assistantId); }
    catch { toast.error("Erro ao adicionar"); }
    setBusy(false);
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !assistantId) return;
    setUploading(true);
    try { const r = await uploadKnowledgeFile(assistantId, file); toast.success(`Arquivo indexado (${r.chunk_count} trechos)`); loadSources(assistantId); }
    catch (err) { toast.error(err?.response?.data?.detail || "Erro no upload"); }
    setUploading(false); e.target.value = "";
  };

  const remove = async (id) => { try { await deleteKnowledge(id); toast.success("Removido"); loadSources(assistantId); } catch { toast.error("Erro ao remover"); } };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Base de Conhecimento</h1>
          <p className="text-sm text-muted-foreground">Alimente o assistente com textos, Q&A e arquivos (PDF, DOCX, TXT)</p>
        </div>
        <div className="w-64">
          <Label className="text-xs">Assistente</Label>
          <Select value={assistantId} onValueChange={setAssistantId}>
            <SelectTrigger className="mt-1" data-testid="kb-assistant-select"><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>{assistants.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Adicionar conhecimento</CardTitle></CardHeader>
          <CardContent>
            <Tabs value={type} onValueChange={setType}>
              <TabsList>
                <TabsTrigger value="text" data-testid="kb-tab-text"><MessageSquareText className="mr-1.5 h-4 w-4" />Texto</TabsTrigger>
                <TabsTrigger value="qna" data-testid="kb-tab-qna">Q&A</TabsTrigger>
                <TabsTrigger value="file" data-testid="kb-tab-file"><Upload className="mr-1.5 h-4 w-4" />Arquivo</TabsTrigger>
              </TabsList>
              <TabsContent value="text" className="mt-4 space-y-3">
                <div><Label>Título</Label><Input className="mt-1.5" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Política de trocas" data-testid="kb-text-title" /></div>
                <div><Label>Conteúdo</Label><Textarea className="mt-1.5" rows={7} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Cole aqui o texto…" data-testid="kb-text-content" /></div>
                <Button onClick={addText} disabled={busy} data-testid="kb-add-text">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Adicionar</Button>
              </TabsContent>
              <TabsContent value="qna" className="mt-4 space-y-3">
                <div><Label>Título</Label><Input className="mt-1.5" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: FAQ pagamentos" data-testid="kb-qna-title" /></div>
                <div><Label>Perguntas e respostas</Label><Textarea className="mt-1.5" rows={7} value={content} onChange={(e) => setContent(e.target.value)} placeholder={"P: Vocês parcelam?\nR: Sim, em até 12x sem juros."} data-testid="kb-qna-content" /></div>
                <Button onClick={addText} disabled={busy} data-testid="kb-add-qna">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Adicionar Q&A</Button>
              </TabsContent>
              <TabsContent value="file" className="mt-4">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-12 text-center hover:bg-accent/40" data-testid="kb-upload-label">
                  {uploading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Upload className="h-8 w-8 text-primary" />}
                  <span className="font-medium">{uploading ? "Enviando e indexando…" : "Clique para enviar um arquivo"}</span>
                  <span className="text-xs text-muted-foreground">PDF, DOCX ou TXT (até 10MB)</span>
                  <input type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={onUpload} disabled={uploading || !assistantId} data-testid="knowledge-upload-input" />
                </label>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Fontes indexadas ({sources.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {sources.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground"><BookOpen className="mx-auto mb-2 h-6 w-6" />Nenhuma fonte ainda.</div>}
            {sources.map((s) => (
              <div key={s.id} className="flex items-start justify-between gap-3 rounded-lg border p-3" data-testid="kb-source-item">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="truncate font-medium">{s.title}</span>
                    <Badge variant="outline" className="rounded-full text-[10px]">{s.type}</Badge>
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.content}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{s.chunk_count} trechos · <span className="text-success">{s.status}</span></div>
                </div>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(s.id)} data-testid="kb-delete-source"><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
