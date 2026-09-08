"""AtendeAI Console — API principal (FastAPI + MongoDB)."""
import logging
import uuid
from datetime import datetime, timezone

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from database import (
    assistants, knowledge_sources, knowledge_chunks, conversations, create_indexes,
)
from ai_core import chunk_text
from routers import assistants as r_assistants
from routers import knowledge as r_knowledge
from routers import playground as r_playground
from routers import conversations as r_conversations
from routers import whatsapp as r_whatsapp
from routers import dashboard as r_dashboard
from routers import meta as r_meta

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("atendeai")

app = FastAPI(title="AtendeAI Console API", version="2.0.0")


@app.get("/api/")
async def root():
    return {"message": "AtendeAI Console API", "status": "ok", "version": "2.0.0"}


@app.get("/api/health")
async def health():
    try:
        await assistants.estimated_document_count()
        db_ok = True
    except Exception:  # noqa: BLE001
        db_ok = False
    return {"ok": db_ok, "db": db_ok}


app.include_router(r_assistants.router)
app.include_router(r_knowledge.router)
app.include_router(r_playground.router)
app.include_router(r_conversations.router)
app.include_router(r_whatsapp.router)
app.include_router(r_dashboard.router)
app.include_router(r_meta.router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _now():
    return datetime.now(timezone.utc).isoformat()


SEED_KB = [
    ("Política de Trocas e Devoluções",
     "A TechNova aceita trocas e devoluções em até 30 dias corridos após o recebimento do produto. "
     "O produto deve estar sem uso, na embalagem original e com nota fiscal. "
     "Reembolsos são processados em até 10 dias úteis no mesmo meio de pagamento. "
     "Produtos com defeito de fabricação têm garantia de 90 dias além da garantia do fabricante."),
    ("Horários e Entregas",
     "Atendimento humano: segunda a sexta, das 9h às 18h (horário de Brasília). "
     "O assistente virtual atende 24h por dia, 7 dias por semana. "
     "Prazo de entrega: capitais em 2 a 4 dias úteis; demais regiões em 5 a 9 dias úteis. "
     "Frete grátis para compras acima de R$ 299,00. Não entregamos aos domingos e feriados."),
    ("Pagamentos",
     "Formas de pagamento: Pix, boleto e cartão de crédito em até 12x sem juros. "
     "Pix tem 5% de desconto no valor total. O boleto compensa em até 3 dias úteis. "
     "Não aceitamos pagamento na entrega (contra entrega)."),
    ("Rastreamento de pedidos",
     "O código de rastreio é enviado por e-mail e WhatsApp em até 24h após a postagem. "
     "Para consultar um pedido, o cliente deve informar o número do pedido (formato TN-XXXXXX). "
     "Se o pedido não chegar no prazo, abrimos uma ocorrência com a transportadora em até 1 dia útil."),
]

SEED_ASSISTANT = {
    "name": "Nova — TechNova", "description": "Assistente de atendimento da loja TechNova (exemplo).",
    "avatar_color": "#0d9488", "provider": "openai", "model": "gpt-5.4", "fallback_provider": "anthropic",
    "temperature": 0.5, "max_tokens": 700, "language": "Português (Brasil)",
    "company_name": "TechNova",
    "company_description": "Loja virtual de eletrônicos e acessórios com entrega para todo o Brasil.",
    "mission": "Resolver dúvidas de pedidos, entregas, pagamentos e trocas no primeiro contato, e ajudar o cliente a concluir a compra com segurança.",
    "skills": [
        "Explicar prazos de entrega e frete por região",
        "Informar formas de pagamento, parcelamento e descontos vigentes",
        "Orientar trocas, devoluções e garantia",
        "Coletar o número do pedido para consulta de status",
        "Reconhecer insatisfação e escalar para humano com contexto",
    ],
    "personality": "Simpática, prestativa e objetiva. Transmite confiança sem ser robótica.",
    "tone": "Cordial e profissional, usa emojis com moderação.",
    "response_length": "curta", "formality": "informal", "use_emojis": True, "whatsapp_style": True, "proactive_followup": True,
    "role_instructions": "Você é a atendente virtual da Loja TechNova. Ajude clientes com dúvidas sobre pedidos, trocas, pagamentos, prazos e entregas. Para status de pedido, peça o número do pedido.",
    "rules": [
        "Responda de forma concisa e direta.",
        "Nunca invente valores, prazos ou políticas.",
        "Se não souber, ofereça encaminhar para um atendente humano.",
    ],
    "forbidden_topics": ["política", "concorrentes"],
    "business_objectives": "Resolver a dúvida com precisão, reduzir devoluções e incentivar a finalização da compra quando pertinente.",
    "few_shot_examples": [
        {"user": "Vocês parcelam?", "assistant": "Sim! Parcelamos em até 12x sem juros no cartão. E no Pix você ganha 5% de desconto. Quer ajuda para finalizar? 😊"},
        {"user": "meu pedido atrasou", "assistant": "Sinto muito pelo atraso! Me passa o número do pedido (TN-XXXXXX) que eu verifico o que aconteceu."},
    ],
    "greeting": "Olá! Eu sou a Nova, assistente da TechNova. Como posso ajudar?",
    "fallback": "Não tenho essa informação no momento. Posso te encaminhar para um atendente humano?",
    "handoff_rules": "Escale para humano quando: o cliente pedir explicitamente, demonstrar forte insatisfação, solicitar cancelamento/reembolso, ou quando a resposta não estiver na base de conhecimento.",
    "escalation_keywords": ["falar com atendente", "falar com humano", "procon", "cancelar pedido", "reembolso"],
    "business_hours": "Segunda a sexta, 9h às 18h (horário de Brasília).",
    "off_hours_message": "Nosso time humano atende de segunda a sexta, das 9h às 18h. Sua mensagem ficou registrada e responderemos assim que possível.",
    "collect_lead_info": False, "lead_fields": ["nome", "e-mail"],
    "kb_strict": True, "retrieval_top_k": 5, "kb_min_score": 0.05, "memory_window": 16, "template_key": "ecommerce",
}


async def _seed():
    if await assistants.count_documents({}) > 0:
        return
    logger.info("Semeando assistente de demonstração...")
    aid = str(uuid.uuid4())
    doc = {"id": aid, **SEED_ASSISTANT, "created_at": _now(), "updated_at": _now()}
    await assistants.insert_one(dict(doc))
    for title, content in SEED_KB:
        sid = str(uuid.uuid4())
        chunks = chunk_text(content)
        await knowledge_chunks.insert_many([
            {"id": str(uuid.uuid4()), "assistant_id": aid, "source_id": sid, "source_title": title, "text": c, "order": i}
            for i, c in enumerate(chunks)
        ])
        await knowledge_sources.insert_one({
            "id": sid, "assistant_id": aid, "type": "text", "title": title,
            "content": content, "filename": None, "status": "indexed",
            "chunk_count": len(chunks), "created_at": _now(), "updated_at": _now(),
        })
    logger.info("Seed concluído.")


async def _migrate():
    """Migrações leves e idempotentes para dados criados em versões anteriores."""
    # chunks sem título de fonte -> preencher a partir da fonte
    async for src in knowledge_sources.find({}, {"_id": 0, "id": 1, "title": 1}):
        await knowledge_chunks.update_many({"source_id": src["id"], "source_title": {"$exists": False}},
                                           {"$set": {"source_title": src["title"]}})
    await conversations.update_many({"sentiment": {"$exists": False}}, {"$set": {"sentiment": "neutro", "ai_tags": [], "tags": [], "notes": "", "summary": ""}})


@app.on_event("startup")
async def startup():
    await create_indexes()
    await _seed()
    await _migrate()


@app.on_event("shutdown")
async def shutdown():
    from database import client
    client.close()
