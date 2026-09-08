"""Núcleo de IA: extração de arquivos, base de conhecimento (chunk + retrieval),
composição de prompt e geração de resposta com continuidade de contexto.

Validado em isolamento no POC (poc/poc_core.py) com OpenAI, Anthropic e Gemini.
"""
import os
import re
import math
from collections import Counter
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

PROVIDER_MODELS = {
    "openai": ["gpt-5.4", "gpt-5.4-mini", "gpt-5.2", "gpt-4o", "gpt-4o-mini", "o3"],
    "anthropic": ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5-20251001"],
    "gemini": ["gemini-3.1-pro-preview", "gemini-2.5-pro", "gemini-2.5-flash"],
}
DEFAULT_MODEL = {"openai": "gpt-5.4", "anthropic": "claude-sonnet-4-6", "gemini": "gemini-3.1-pro-preview"}


# ---------------------------------------------------------------------------
# 1) Extração de texto
# ---------------------------------------------------------------------------
def extract_text_from_bytes(filename: str, data: bytes) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".txt":
        return data.decode("utf-8", errors="replace")
    if ext == ".docx":
        import io
        from docx import Document
        doc = Document(io.BytesIO(data))
        return "\n".join(p.text for p in doc.paragraphs)
    if ext == ".pdf":
        import io
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data))
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    raise ValueError(f"Formato não suportado: {ext}. Use PDF, DOCX ou TXT.")


SUPPORTED_EXT = {".txt", ".pdf", ".docx"}


# ---------------------------------------------------------------------------
# 2) Chunking + retrieval (TF-IDF cosine, leve, sem dependências pesadas)
# ---------------------------------------------------------------------------
def chunk_text(text: str, max_chars: int = 500):
    raw = [p.strip() for p in re.split(r"\n{1,}", text) if p.strip()]
    chunks, cur = [], ""
    for p in raw:
        if len(cur) + len(p) + 1 <= max_chars:
            cur = (cur + " " + p).strip()
        else:
            if cur:
                chunks.append(cur)
            cur = p
    if cur:
        chunks.append(cur)
    return chunks


_WORD = re.compile(r"[a-zà-ú0-9]+", re.IGNORECASE)


def _tokenize(s: str):
    return [w.lower() for w in _WORD.findall(s)]


class SimpleRetriever:
    def __init__(self, chunks):
        self.chunks = chunks
        self.docs_tokens = [_tokenize(c) for c in chunks]
        df = Counter()
        for toks in self.docs_tokens:
            for t in set(toks):
                df[t] += 1
        n = max(len(chunks), 1)
        self.idf = {t: math.log((n + 1) / (df_t + 1)) + 1 for t, df_t in df.items()}
        self.doc_vecs = [self._vec(toks) for toks in self.docs_tokens]

    def _vec(self, toks):
        if not toks:
            return {}
        tf = Counter(toks)
        return {t: (tf[t] / len(toks)) * self.idf.get(t, 0.0) for t in tf}

    @staticmethod
    def _cos(a, b):
        common = set(a) & set(b)
        num = sum(a[t] * b[t] for t in common)
        da = math.sqrt(sum(v * v for v in a.values()))
        db = math.sqrt(sum(v * v for v in b.values()))
        return num / (da * db) if da and db else 0.0

    def search(self, query, top_k=4):
        if not self.chunks:
            return []
        qv = self._vec(_tokenize(query))
        scored = sorted(((self._cos(qv, dv), i) for i, dv in enumerate(self.doc_vecs)), reverse=True)
        return [(self.chunks[i], s) for s, i in scored[:top_k] if s > 0]


# ---------------------------------------------------------------------------
# 3) Composição de prompt
# ---------------------------------------------------------------------------
def build_system_prompt(cfg: dict, kb_context: str, history_context: str = "") -> str:
    rules = cfg.get("rules") or []
    rules_txt = "\n".join(f"- {r}" for r in rules) if rules else "- (sem regras adicionais)"
    strict = cfg.get("kb_strict", True)
    kb_policy = (
        "Use EXCLUSIVAMENTE as informações da Base de Conhecimento abaixo. Se a resposta não estiver lá, "
        "NÃO invente: use a mensagem de fallback e ofereça encaminhar para um humano."
        if strict else
        "Priorize a Base de Conhecimento abaixo. Você pode complementar com conhecimento geral apenas quando seguro, "
        "sem contradizer a base e sem inventar dados específicos do negócio (preços, prazos, políticas)."
    )
    kb_block = kb_context.strip() or "(nenhum trecho relevante encontrado na base)"
    hist_block = f"\n## Histórico recente da conversa\n{history_context}\n" if history_context.strip() else ""

    return f"""Você é {cfg.get('name','Assistente')}, um assistente virtual de atendimento ao cliente.
Idioma: responda SEMPRE em {cfg.get('language','Português (Brasil)')}.

## Personalidade
{cfg.get('personality') or 'Prestativo, claro e cordial.'}

## Tom de voz
{cfg.get('tone') or 'Profissional e amigável.'}

## Papel e instruções
{cfg.get('role_instructions') or 'Ajude o cliente com suas dúvidas de forma precisa.'}

## Objetivos comerciais
{cfg.get('business_objectives') or 'Resolver a dúvida do cliente com eficiência e gerar uma boa experiência.'}

## Regras (siga estritamente)
{rules_txt}

## Política de escalonamento (handoff para humano)
{cfg.get('handoff_rules') or 'Escale para um humano quando o cliente pedir explicitamente, demonstrar forte insatisfação, ou quando a resposta não estiver na base de conhecimento.'}

## Fidelidade à informação
{kb_policy}
Se precisar usar fallback, use uma mensagem próxima a: "{cfg.get('fallback') or 'Não tenho essa informação no momento. Posso te encaminhar para um atendente humano?'}"

## Base de Conhecimento (fonte da verdade)
--- INÍCIO DA BASE ---
{kb_block}
--- FIM DA BASE ---
{hist_block}
## Formato de resposta OBRIGATÓRIO
Responda de forma natural e concisa ao cliente. Ao FINAL da sua mensagem, em uma nova linha, adicione uma etiqueta de controle EXATAMENTE neste formato:
[[HANDOFF:SIM]]  -> se este atendimento deve ir para um humano (conforme a política de escalonamento).
[[HANDOFF:NAO]]  -> caso contrário.
Essa etiqueta é obrigatória e será removida antes de exibir ao cliente."""


HANDOFF_RE = re.compile(r"\[\[HANDOFF:(SIM|NAO)\]\]", re.IGNORECASE)


def parse_handoff(full_text: str):
    m = HANDOFF_RE.search(full_text or "")
    handoff = bool(m) and m.group(1).upper() == "SIM"
    clean = HANDOFF_RE.sub("", full_text or "").strip()
    return clean, handoff


def build_history_context(history, limit=12):
    role_map = {"customer": "Cliente", "assistant": "Assistente", "human": "Atendente humano"}
    lines = []
    for m in history[-limit:]:
        who = role_map.get(m.get("role"), "Cliente")
        lines.append(f"{who}: {m.get('text','')}")
    return "\n".join(lines)


def _make_chat(cfg: dict, system_message: str, session_id: str) -> LlmChat:
    provider = cfg.get("provider", "openai")
    model = cfg.get("model") or DEFAULT_MODEL.get(provider, "gpt-5.4")
    if provider not in PROVIDER_MODELS:
        provider = "openai"
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=system_message)
    return chat.with_model(provider, model)


# ---------------------------------------------------------------------------
# 4) Geração de resposta
# ---------------------------------------------------------------------------
async def generate_reply(cfg: dict, chunks, history, user_text: str, session_id: str):
    """Não-streaming: usado pela Central de Conversas / inbound. Retorna (texto, handoff)."""
    retriever = SimpleRetriever(chunks)
    ctx = "\n\n".join(c for c, _ in retriever.search(user_text, top_k=4))
    hist_ctx = build_history_context(history)
    system = build_system_prompt(cfg, ctx, hist_ctx)
    chat = _make_chat(cfg, system, session_id)
    resp = await chat.send_message(UserMessage(text=user_text))
    text = resp if isinstance(resp, str) else str(resp)
    return parse_handoff(text)


async def stream_reply(cfg: dict, chunks, history, user_text: str, session_id: str):
    """Streaming (SSE): usado pelo Playground. Yields tokens; retorna handoff via buffer parse no fim."""
    retriever = SimpleRetriever(chunks)
    ctx = "\n\n".join(c for c, _ in retriever.search(user_text, top_k=4))
    hist_ctx = build_history_context(history)
    system = build_system_prompt(cfg, ctx, hist_ctx)
    chat = _make_chat(cfg, system, session_id)
    async for ev in chat.stream_message(UserMessage(text=user_text)):
        if isinstance(ev, TextDelta):
            yield ev.content
        elif isinstance(ev, StreamDone):
            break
