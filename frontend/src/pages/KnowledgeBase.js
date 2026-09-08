import React, { useEffect, useState } from "react";
import { BookOpen, Upload, FileText, Trash2, Plus, Loader2, MessageSquareText, Link2, Search, RefreshCw, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listAssistants, listKnowledge, createKnowledgeText, createKnowledgeUrl, uploadKnowledgeFile, deleteKnowledge, searchKnowledge, reindexKnowledge } from "@/lib/api";
import { toast } from "sonner";

const TYPE_LABEL = { text: "Texto", qna: "Q&A", file: "Arquivo", url: "URL" };

export default function KnowledgeBase() {
  const [assistants, setAssistants] = useState([]);
  const [assistantId, setAssistantId] = useState("");
  const [sources, setSources] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState("text");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [searchRes, setSearchRes] = useState(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => { listAssistants().then((d) => { setAssistants(d); if (d[0]) setAssistantId(d[0].id); }); }, []);
  const loadSources = (aid) => listKnowledge(aid).then(setSources).catch(() => {});
  useEffect(() => { if (assistantId) { loadSources(assistantId); setSearchRes(null); } }, [assistantId]);

  const addText = async () => {
    if (!assistantId) { toast.error("Selecione um assistente"); return; }
    if (!title.trim() || !content.trim()) { toast.error("Preencha título e conteúdo"); return; }
    setBusy(true);
    try { const r = await createKnowledgeText({ assistant_id: assistantId, title, content, type }); toast.success(`Conhecimento adicionado (${r.chunk_count} trechos)`); setTitle(""); setContent(""); loadSources(assistantId); }
    catch (e) { toast.error(e?.response?.data?.detail || "Erro ao adicionar"); }
    setBusy(false);
  };

  const addUrl = async () => {
    if (!assistantId) { toast.error("Selecione um assistente"); return; }
    if (!url.trim()) { toast.error("Informe a URL"); return; }
    setBusy(true);
    try { const r = await createKnowledgeUrl({ assistant_id: assistantId, url, title: title || undefined }); toast.success(`Página importada (${r.chunk_count} trechos)`); setUrl(""); setTitle(""); loadSources(assistantId); }
    catch (e) { toast.error(e?.response?.data?.detail || "Erro ao importar URL"); }
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
  const reindex = async (id) => { try { const r = await reindexKnowledge(id); toast.success(`Reindexado (${r.chunk_count} trechos)`); loadSources(assistantId); } catch { toast.error("Erro ao reindexar"); } };

  const runSearch = async () => {
    if (!query.trim() || !assistantId) return;
    setSearching(true);
    try { setSearchRes(await searchKnowledge(assistantId, query, 5)); } catch { toast.error("Erro na busca"); }
    setSearching(false);
  };

  const totalChunks = sources.reduce((a, s) => a + (s.chunk_count || 0), 0);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Base de Conhecimento</h1>
          <p className="text-sm text-muted-foreground">Textos, Q&A, páginas web e arquivos (PDF, DOCX, TXT, MD, CSV, HTML). É a fonte da verdade do assistente.</p>
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
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Adicionar conhecimento</CardTitle></CardHeader>
            <CardContent>
              <Tabs value={type} onValueChange={setType}>
                <TabsList className="flex w-full flex-wrap justify-start">
                  <TabsTrigger value="text" data-testid="kb-tab-text"><MessageSquareText className="mr-1.5 h-4 w-4" />Texto</TabsTrigger>
                  <TabsTrigger value="qna" data-testid="kb-tab-qna">Q&A</TabsTrigger>
                  <TabsTrigger value="url" data-testid="kb-tab-url"><Link2 className="mr-1.5 h-4 w-4" />URL</TabsTrigger>
                  <TabsTrigger value="file" data-testid="kb-tab-file"><Upload className="mr-1.5 h-4 w-4" />Arquivo</TabsTrigger>
                </TabsList>
                <TabsContent value="text" className="mt-4 space-y-3">
                  <div><Label>Título</Label><Input className="mt-1.5" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Política de trocas" data-testid="kb-text-title" /></div>
                  <div><Label>Conteúdo</Label><Textarea className="mt-1.5" rows={7} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Cole aqui o texto… Dica: um parágrafo por assunto melhora a busca." data-testid="kb-text-content" /></div>
                  <Button onClick={addText} disabled={busy} data-testid="kb-add-text">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Adicionar</Button>
                </TabsContent>
                <TabsContent value="qna" className="mt-4 space-y-3">
                  <div><Label>Título</Label><Input className="mt-1.5" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: FAQ pagamentos" data-testid="kb-qna-title" /></div>
                  <div><Label>Perguntas e respostas</Label><Textarea className="mt-1.5" rows={7} value={content} onChange={(e) => setContent(e.target.value)} placeholder={"P: Vocês parcelam?\nR: Sim, em até 12x sem juros.\n\nP: Qual o prazo?\nR: 2 a 4 dias úteis em capitais."} data-testid="kb-qna-content" />
                    <p className="mt-1 text-xs text-muted-foreground">Cada par P/R vira um trecho independente — retrieval mais preciso.</p></div>
                  <Button onClick={addText} disabled={busy} data-testid="kb-add-qna">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Adicionar Q&A</Button>
                </TabsContent>
                <TabsContent value="url" className="mt-4 space-y-3">
                  <div><Label>URL pública</Label><Input className="mt-1.5" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://suaempresa.com.br/faq" data-testid="kb-url-input" /></div>
                  <div><Label>Título (opcional)</Label><Input className="mt-1.5" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: FAQ do site" data-testid="kb-url-title" /></div>
                  <Button onClick={addUrl} disabled={busy} data-testid="kb-add-url">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}Importar página</Button>
                </TabsContent>
                <TabsContent value="file" className="mt-4">
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-12 text-center hover:bg-accent/40" data-testid="kb-upload-label">
                    {uploading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Upload className="h-8 w-8 text-primary" />}
                    <span className="font-medium">{uploading ? "Enviando e indexando…" : "Clique para enviar um arquivo"}</span>
                    <span className="text-xs text-muted-foreground">PDF, DOCX, TXT, MD, CSV ou HTML (até 15MB)</span>
                    <input type="file" accept=".pdf,.docx,.txt,.md,.csv,.html,.htm" className="hidden" onChange={onUpload} disabled={uploading || !assistantId} data-testid="knowledge-upload-input" />
                  </label>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card data-testid="kb-search-card">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Search className="h-4 w-4 text-primary" />Testar busca (o que a IA enxerga)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runSearch()} placeholder="Ex.: vcs parcelam?" data-testid="kb-search-input" />
                <Button onClick={runSearch} disabled={searching} data-testid="kb-search-button">{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button>
              </div>
              {searchRes && (
                <div className="space-y-2" data-testid="kb-search-results">
                  <p className="text-xs text-muted-foreground">{searchRes.total_chunks} trechos na base · {searchRes.total_chars} caracteres · {searchRes.full_context ? <span className="text-success">base pequena: enviada INTEIRA ao modelo</span> : "base grande: retrieval por relevância"}</p>
                  {searchRes.results.length === 0 && <p className="text-sm text-muted-foreground">Nenhum trecho relevante. {searchRes.full_context ? "Mesmo assim, a base inteira irá ao modelo." : "A IA usará o fallback."}</p>}
                  {searchRes.results.map((r, i) => (
                    <div key={i} className="rounded-lg border p-2.5 text-sm">
                      <div className="flex items-center justify-between"><span className="font-medium">{r.source_title}</span><Badge variant="outline" className="rounded-full font-mono text-[10px]">score {r.score}</Badge></div>
                      <div className="mt-1 line-clamp-3 text-xs text-muted-foreground">{r.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Fontes indexadas ({sources.length})</CardTitle>
            <Badge variant="outline" className="rounded-full text-[11px]">{totalChunks} trechos</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {sources.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground"><BookOpen className="mx-auto mb-2 h-6 w-6" />Nenhuma fonte ainda. Comece pelas políticas mais perguntadas (pagamento, prazos, trocas, horários).</div>}
            {sources.map((s) => (
              <div key={s.id} className="flex items-start justify-between gap-3 rounded-lg border p-3" data-testid="kb-source-item">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {s.type === "url" ? <Globe className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-primary" />}
                    <span className="truncate font-medium">{s.title}</span>
                    <Badge variant="outline" className="rounded-full text-[10px]">{TYPE_LABEL[s.type] || s.type}</Badge>
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.content}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{s.chunk_count} trechos · {s.full_length || s.content?.length || 0} caracteres · <span className="text-success">{s.status}</span></div>
                </div>
                <div className="flex shrink-0 items-center">
                  <Button size="icon" variant="ghost" onClick={() => reindex(s.id)} title="Reindexar" data-testid="kb-reindex-source"><RefreshCw className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(s.id)} data-testid="kb-delete-source"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
