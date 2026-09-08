import React from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Smile, Meh, Frown, Target, ShieldCheck, BookOpen, Clock, UserRound } from "lucide-react";

const SENTIMENT = {
  positivo: { icon: Smile, c: "text-success border-success/25 bg-success/10", label: "Positivo" },
  neutro: { icon: Meh, c: "text-muted-foreground border", label: "Neutro" },
  negativo: { icon: Frown, c: "text-destructive border-destructive/25 bg-destructive/10", label: "Negativo" },
};

export const SentimentBadge = ({ value, className = "" }) => {
  const s = SENTIMENT[value] || SENTIMENT.neutro;
  const Icon = s.icon;
  return (
    <Badge variant="outline" className={`rounded-full text-[10px] ${s.c} ${className}`} data-testid="sentiment-badge">
      <Icon className="mr-1 h-3 w-3" />{s.label}
    </Badge>
  );
};

export const ConfidenceBadge = ({ value }) => {
  if (value === undefined || value === null) return null;
  const pct = Math.round(value * 100);
  const c = pct >= 80 ? "text-success border-success/25 bg-success/10" : pct >= 50 ? "text-warning border-warning/25 bg-warning/10" : "text-destructive border-destructive/25 bg-destructive/10";
  return (
    <Badge variant="outline" className={`rounded-full text-[10px] ${c}`} data-testid="confidence-badge">
      <ShieldCheck className="mr-1 h-3 w-3" />{pct}% confiança
    </Badge>
  );
};

/** Linha compacta de metadados de uma resposta da IA (intenção, sentimento, confiança, KB, latência). */
export const MetaRow = ({ meta, latency, sources, model, className = "" }) => {
  if (!meta) return null;
  return (
    <TooltipProvider delayDuration={200}>
      <div className={`flex flex-wrap items-center gap-1.5 ${className}`} data-testid="meta-row">
        {meta.intent && (
          <Badge variant="outline" className="rounded-full text-[10px]" data-testid="intent-badge"><Target className="mr-1 h-3 w-3" />{meta.intent}</Badge>
        )}
        <SentimentBadge value={meta.sentiment} />
        <ConfidenceBadge value={meta.confidence} />
        {sources && sources.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="cursor-help rounded-full text-[10px]" data-testid="sources-badge"><BookOpen className="mr-1 h-3 w-3" />{sources.length} fonte{sources.length > 1 ? "s" : ""}</Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><ul className="list-disc space-y-0.5 pl-4 text-xs">{sources.slice(0, 5).map((s, i) => <li key={i}>{s.title}</li>)}</ul></TooltipContent>
          </Tooltip>
        )}
        {meta.kb_used === false && !meta.handoff && <Badge variant="outline" className="rounded-full border-warning/25 bg-warning/10 text-[10px] text-warning">sem base</Badge>}
        {latency ? <Badge variant="outline" className="rounded-full font-mono text-[10px]"><Clock className="mr-1 h-3 w-3" />{(latency / 1000).toFixed(1)}s</Badge> : null}
        {model && <Badge variant="outline" className="rounded-full font-mono text-[10px]">{model}</Badge>}
        {meta.profile && Object.keys(meta.profile).length > 0 && (
          <Badge variant="outline" className="rounded-full text-[10px] text-primary"><UserRound className="mr-1 h-3 w-3" />dados capturados</Badge>
        )}
      </div>
    </TooltipProvider>
  );
};

/** Editor simples de lista de strings (chips). */
export const ChipListEditor = ({ items = [], onChange, placeholder, testid }) => {
  const [val, setVal] = React.useState("");
  const add = () => { const v = val.trim(); if (!v) return; onChange([...(items || []), v]); setVal(""); };
  return (
    <div>
      <div className="flex gap-2">
        <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder} data-testid={testid}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <button type="button" onClick={add} data-testid={testid ? `${testid}-add` : undefined}
          className="inline-flex h-10 items-center justify-center rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:bg-secondary/80">Adicionar</button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(items || []).map((it, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full border bg-secondary/40 px-2.5 py-1 text-xs" data-testid={testid ? `${testid}-item` : undefined}>
            {it}
            <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive" aria-label="Remover">×</button>
          </span>
        ))}
        {(items || []).length === 0 && <span className="text-xs text-muted-foreground">Nenhum item.</span>}
      </div>
    </div>
  );
};
