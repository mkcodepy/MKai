import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Send, RotateCcw, Bot, FlaskConical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listAssistants, streamPlayground } from "@/lib/api";
import { toast } from "sonner";

export default function Playground() {
  const location = useLocation();
  const [assistants, setAssistants] = useState([]);
  const [assistantId, setAssistantId] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const session = useRef(`pg-${Math.random().toString(36).slice(2)}`);
  const bottomRef = useRef(null);

  useEffect(() => {
    listAssistants().then((d) => {
      setAssistants(d);
      const q = new URLSearchParams(location.search).get("assistant");
      setAssistantId(q && d.find((a) => a.id === q) ? q : d[0]?.id || "");
    });
  }, [location.search]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streaming]);

  const current = assistants.find((a) => a.id === assistantId);

  const reset = () => { setMessages([]); session.current = `pg-${Math.random().toString(36).slice(2)}`; };

  const send = async () => {
    if (!assistantId) { toast.error("Selecione um assistente"); return; }
    if (!input.trim() || streaming) return;
    const msg = input.trim();
    setMessages((m) => [...m, { role: "customer", text: msg }, { role: "assistant", text: "" }]);
    setInput("");
    setStreaming(true);
    await streamPlayground({
      assistantId, sessionId: session.current, message: msg,
      onDelta: (d) => setMessages((m) => { const n = [...m]; n[n.length - 1].text += d; return n; }),
      onDone: (info) => { setStreaming(false); if (info.clean) setMessages((m) => { const n=[...m]; n[n.length-1].text = info.clean; n[n.length-1].handoff = info.handoff; return n; }); if (info.handoff) toast.warning("A IA sugeriu transferir para um humano"); },
      onError: (e) => { setStreaming(false); toast.error("Erro: " + e); },
    });
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-[1000px] flex-col px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Playground</h1>
          <p className="text-sm text-muted-foreground">Teste seu assistente em tempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={assistantId} onValueChange={(v) => { setAssistantId(v); reset(); }}>
            <SelectTrigger className="w-56" data-testid="playground-assistant-select"><SelectValue placeholder="Assistente" /></SelectTrigger>
            <SelectContent>{assistants.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="secondary" onClick={reset} data-testid="playground-reset"><RotateCcw className="mr-2 h-4 w-4" />Reiniciar</Button>
        </div>
      </div>

      <Card className="mt-4 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <div className="flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /><span className="text-sm font-medium">{current?.name || "—"}</span></div>
          {current && <Badge variant="outline" className="rounded-full font-mono text-[10px]">{current.provider} · {current.model}</Badge>}
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 scroll-thin">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <FlaskConical className="mb-2 h-8 w-8" />
              <p className="text-sm">Envie uma mensagem para iniciar o teste.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "customer" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${m.role === "customer" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border bg-card"}`}>
                {m.text || (streaming && i === messages.length - 1 ? <span className="inline-flex gap-1"><span className="typing-dot">●</span><span className="typing-dot">●</span><span className="typing-dot">●</span></span> : "")}
                {m.handoff && <div className="mt-1.5 text-[11px] font-medium text-warning">⚑ handoff sugerido</div>}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="flex items-center gap-2 border-t p-3">
          <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Digite como o cliente…" data-testid="playground-input" />
          <Button onClick={send} disabled={streaming} data-testid="playground-send-button"><Send className="h-4 w-4" /></Button>
        </div>
      </Card>
    </div>
  );
}
