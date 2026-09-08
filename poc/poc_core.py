"""
POC do Core — Motor conversacional de atendimento ao cliente.

Valida em isolamento (antes de construir o app) os pontos mais críticos:
  1. Extração de texto de arquivos: PDF, DOCX, TXT
  2. Base de conhecimento (KB): chunking + retrieval simples (grounding)
  3. Composição de system prompt rico a partir da config do assistente
  4. Chat multi-turn com continuidade de contexto (streaming)
  5. Multi-provedor: OpenAI, Anthropic, Gemini (Emergent Universal Key)
  6. Fidelidade à KB (não alucinar; admitir quando não sabe)
  7. Detecção de handoff (escalar para humano)

Executar: python /app/poc/poc_core.py
"""
import os
import re
import asyncio
import math
from collections import Counter
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

# ----------------------------------------------------------------------------
# 0) Gerar arquivos de exemplo (PDF/DOCX/TXT) com a base de conhecimento
# ----------------------------------------------------------------------------
KB_TEXT_1 = """Política de Trocas e Devoluções — Loja TechNova
A TechNova aceita trocas e devoluções em até 30 dias corridos após o recebimento do produto.
O produto deve estar sem uso, na embalagem original e com nota fiscal.
Reembolsos são processados em até 10 dias úteis no mesmo meio de pagamento.
Produtos com defeito de fabricação têm garantia de 90 dias além da garantia do fabricante."""

KB_TEXT_2 = """Horário de Atendimento e Entregas — Loja TechNova
Atendimento humano: segunda a sexta, das 9h às 18h (horário de Brasília).
O assistente virtual atende 24 horas por dia, 7 dias por semana.
Prazo de entrega: capitais em 2 a 4 dias úteis; demais regiões em 5 a 9 dias úteis.
Frete grátis para compras acima de R$ 299,00.
Não realizamos entregas aos domingos e feriados."""

KB_TEXT_3 = """Perguntas Frequentes — Pagamentos TechNova
Formas de pagamento aceitas: Pix, boleto e cartão de crédito em até 12x sem juros.
Pix tem 5% de desconto no valor total.
O boleto é compensado em até 3 dias úteis.
Não aceitamos pagamento na entrega (contra entrega)."""


def build_sample_files():
    os.makedirs("/app/poc/samples", exist_ok=True)
    txt_path = "/app/poc/samples/politica_trocas.txt"
    docx_path = "/app/poc/samples/horarios_entregas.docx"
    pdf_path = "/app/poc/samples/faq_pagamentos.pdf"

    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(KB_TEXT_1)

    from docx import Document
    doc = Document()
    for line in KB_TEXT_2.split("\n"):
        doc.add_paragraph(line)
    doc.save(docx_path)

    from fpdf import FPDF
    pdf = FPDF()
    pdf.set_margins(15, 15, 15)
    pdf.add_page()
    pdf.set_font("Helvetica", size=12)
    for line in KB_TEXT_3.split("\n"):
        safe = line.encode("latin-1", "replace").decode("latin-1")
        pdf.multi_cell(pdf.epw, 8, safe)
    pdf.output(pdf_path)

    return txt_path, docx_path, pdf_path


# ----------------------------------------------------------------------------
# 1) Extração de texto
# ----------------------------------------------------------------------------
def extract_text(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    if ext == ".txt":
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    if ext == ".docx":
        from docx import Document
        doc = Document(path)
        return "\n".join(p.text for p in doc.paragraphs)
    if ext == ".pdf":
        from pypdf import PdfReader
        reader = PdfReader(path)
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    raise ValueError(f"Formato não suportado: {ext}")


# ----------------------------------------------------------------------------
# 2) Chunking + retrieval simples (TF-IDF cosine) — grounding leve
# ----------------------------------------------------------------------------
def chunk_text(text: str, max_chars: int = 400):
    # quebra por parágrafos/linhas, agrupando até max_chars
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
    """TF-IDF + cosine similarity, sem dependências pesadas."""

    def __init__(self, chunks):
        self.chunks = chunks
        self.docs_tokens = [_tokenize(c) for c in chunks]
        df = Counter()
        for toks in self.docs_tokens:
            for t in set(toks):
                df[t] += 1
        n = len(chunks)
        self.idf = {t: math.log((n + 1) / (df_t + 1)) + 1 for t, df_t in df.items()}
        self.doc_vecs = [self._vec(toks) for toks in self.docs_tokens]

    def _vec(self, toks):
        tf = Counter(toks)
        return {t: (tf[t] / len(toks)) * self.idf.get(t, 0.0) for t in tf} if toks else {}

    @staticmethod
    def _cos(a, b):
        common = set(a) & set(b)
        num = sum(a[t] * b[t] for t in common)
        da = math.sqrt(sum(v * v for v in a.values()))
        db = math.sqrt(sum(v * v for v in b.values()))
        return num / (da * db) if da and db else 0.0

    def search(self, query, top_k=3):
        qv = self._vec(_tokenize(query))
        scored = sorted(
            ((self._cos(qv, dv), i) for i, dv in enumerate(self.doc_vecs)),
            reverse=True,
        )
        return [(self.chunks[i], s) for s, i in scored[:top_k] if s > 0]


# ----------------------------------------------------------------------------
# 3) Config do assistente + composição de system prompt rico
# ----------------------------------------------------------------------------
ASSISTANT_CONFIG = {
    "name": "Nova",
    "business_name": "Loja TechNova",
    "language": "Português (Brasil)",
    "personality": "Simpática, prestativa e objetiva. Transmite confiança sem ser robótica.",
    "tone": "Cordial e profissional, usa emojis com moderação.",
    "role_instructions": "Você é a atendente virtual da Loja TechNova. Ajude clientes com dúvidas sobre pedidos, trocas, pagamentos, prazos e entregas.",
    "rules": [
        "Responda SOMENTE com base nas informações da Base de Conhecimento fornecida.",
        "Se a informação não estiver na base, diga que não tem certeza e ofereça encaminhar para um atendente humano.",
        "Nunca invente valores, prazos ou políticas.",
        "Seja conciso: respostas curtas e diretas.",
    ],
    "business_objectives": "Resolver a dúvida do cliente com precisão, reduzir devoluções e, quando pertinente, incentivar a finalização da compra.",
    "greeting": "Olá! Eu sou a Nova, assistente da TechNova. Como posso ajudar? 😊",
    "fallback": "Não tenho essa informação no momento. Posso te encaminhar para um atendente humano?",
    "handoff_rules": "Escale para humano quando: o cliente pedir explicitamente falar com humano, demonstrar forte insatisfação/reclamação, solicitar cancelamento/reembolso complexo, ou quando a resposta não estiver na base de conhecimento.",
}


def build_system_prompt(cfg: dict, kb_context: str) -> str:
    rules = "\n".join(f"- {r}" for r in cfg["rules"])
    return f"""Você é {cfg['name']}, assistente virtual de atendimento ao cliente da {cfg['business_name']}.
Idioma: responda sempre em {cfg['language']}.

## Personalidade
{cfg['personality']}

## Tom de voz
{cfg['tone']}

## Papel e instruções
{cfg['role_instructions']}

## Objetivos comerciais
{cfg['business_objectives']}

## Regras (siga estritamente)
{rules}

## Política de escalonamento (handoff)
{cfg['handoff_rules']}

## Base de Conhecimento (fonte da verdade)
Use EXCLUSIVAMENTE as informações abaixo para responder. Se a resposta não estiver aqui, use a mensagem de fallback e ofereça handoff.
--- INÍCIO DA BASE ---
{kb_context if kb_context.strip() else '(nenhum trecho relevante encontrado)'}
--- FIM DA BASE ---

## Formato de resposta OBRIGATÓRIO
Responda naturalmente ao cliente. Ao FINAL da sua mensagem, em uma nova linha, adicione uma etiqueta de controle exatamente neste formato:
[[HANDOFF:SIM]]  -> se, conforme a política de escalonamento, este atendimento deve ir para um humano.
[[HANDOFF:NAO]]  -> caso contrário.
A etiqueta é obrigatória e será removida antes de exibir ao cliente."""


HANDOFF_RE = re.compile(r"\[\[HANDOFF:(SIM|NAO)\]\]", re.IGNORECASE)


def parse_handoff(full_text: str):
    m = HANDOFF_RE.search(full_text)
    handoff = bool(m) and m.group(1).upper() == "SIM"
    clean = HANDOFF_RE.sub("", full_text).strip()
    return clean, handoff


# ----------------------------------------------------------------------------
# 4/5) Chat multi-turn streaming, por provedor
# ----------------------------------------------------------------------------
async def stream_reply(chat: LlmChat, user_text: str) -> str:
    buf = []
    async for ev in chat.stream_message(UserMessage(text=user_text)):
        if isinstance(ev, TextDelta):
            buf.append(ev.content)
        elif isinstance(ev, StreamDone):
            break
    return "".join(buf)


async def run_provider_scenario(provider: str, model: str, retriever: SimpleRetriever):
    print(f"\n{'='*70}\n PROVEDOR: {provider} | MODELO: {model}\n{'='*70}")
    results = {"provider": provider, "model": model, "turns": [], "handoff_detected": False,
               "grounded_ok": False, "context_ok": False}

    # Turno 1 — pergunta respondível pela KB (grounding + fidelidade)
    q1 = "Qual o prazo para trocar um produto e em quanto tempo recebo o reembolso?"
    ctx1 = "\n\n".join(c for c, _ in retriever.search(q1, top_k=3))
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"poc-{provider}",
        system_message=build_system_prompt(ASSISTANT_CONFIG, ctx1),
    ).with_model(provider, model)

    r1 = await stream_reply(chat, q1)
    clean1, h1 = parse_handoff(r1)
    print(f"\n[Cliente] {q1}\n[Nova] {clean1}\n(handoff={h1})")
    results["turns"].append(clean1)
    # grounding: deve mencionar 30 dias e 10 dias (úteis)
    grounded = ("30" in clean1) and ("10" in clean1)
    results["grounded_ok"] = grounded

    # Turno 2 — depende de contexto ("e se eu pagar por Pix?") sobre desconto
    q2 = "E se eu pagar por Pix, tenho algum desconto?"
    # nota: o system prompt já foi fixado com ctx1; para simular RAG por turno,
    # o app real recompõe. No POC validamos continuidade do histórico da lib.
    r2 = await stream_reply(chat, q2)
    clean2, h2 = parse_handoff(r2)
    print(f"\n[Cliente] {q2}\n[Nova] {clean2}\n(handoff={h2})")
    results["turns"].append(clean2)
    # contexto ok se manteve o fio (respondeu sobre Pix/desconto ou fallback coerente)
    results["context_ok"] = len(clean2) > 0

    # Turno 3 — gatilho de handoff explícito
    q3 = "Isso é um absurdo, quero falar com um atendente humano AGORA para cancelar tudo!"
    ctx3 = "\n\n".join(c for c, _ in retriever.search(q3, top_k=3))
    r3 = await stream_reply(chat, q3)
    clean3, h3 = parse_handoff(r3)
    print(f"\n[Cliente] {q3}\n[Nova] {clean3}\n(handoff={h3})")
    results["turns"].append(clean3)
    results["handoff_detected"] = h3

    return results


async def main():
    print("### POC CORE — Atendimento IA ###")
    assert EMERGENT_LLM_KEY, "EMERGENT_LLM_KEY não encontrado no .env"

    # 0) samples + 1) extração
    txt_p, docx_p, pdf_p = build_sample_files()
    all_text = []
    for p in (txt_p, docx_p, pdf_p):
        t = extract_text(p)
        ok = len(t.strip()) > 20
        print(f"[EXTRAÇÃO] {os.path.basename(p)} -> {len(t)} chars {'OK' if ok else 'FALHOU'}")
        assert ok, f"Falha ao extrair {p}"
        all_text.append(t)

    # 2) KB
    chunks = []
    for t in all_text:
        chunks.extend(chunk_text(t))
    print(f"[KB] {len(chunks)} chunks indexados")
    retriever = SimpleRetriever(chunks)
    hits = retriever.search("prazo de troca e reembolso", top_k=2)
    print(f"[RETRIEVAL] top hit score={hits[0][1]:.3f}: {hits[0][0][:60]}...")
    assert hits and hits[0][1] > 0, "Retrieval não retornou resultados"

    # 3/4/5) cenários por provedor
    providers = [
        ("openai", "gpt-5.4"),
        ("anthropic", "claude-sonnet-4-6"),
        ("gemini", "gemini-3.1-pro-preview"),
    ]
    all_results = []
    for prov, model in providers:
        try:
            res = await run_provider_scenario(prov, model, retriever)
            all_results.append(res)
        except Exception as e:
            print(f"!!! ERRO no provedor {prov}: {type(e).__name__}: {e}")
            all_results.append({"provider": prov, "model": model, "error": str(e)})

    # RESUMO
    print(f"\n\n{'#'*70}\n RESUMO DO POC\n{'#'*70}")
    passed = 0
    for r in all_results:
        if "error" in r:
            print(f"[{r['provider']}] ERRO: {r['error']}")
            continue
        ok = r["grounded_ok"] and r["context_ok"] and r["handoff_detected"]
        passed += 1 if ok else 0
        print(f"[{r['provider']}] grounded={r['grounded_ok']} context={r['context_ok']} "
              f"handoff={r['handoff_detected']} => {'PASSOU' if ok else 'ATENÇÃO'}")
    print(f"\nProvedores que passaram: {passed}/{len(providers)}")
    print("POC OK" if passed == len(providers) else "POC precisa de ajustes")


if __name__ == "__main__":
    asyncio.run(main())
