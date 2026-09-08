"""AtendeAI Console — API principal (FastAPI + MongoDB)."""
import logging
import uuid
from datetime import datetime, timezone

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from database import (
    assistants, knowledge_sources, knowledge_chunks, conversations, messages,
    create_indexes,
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

app = FastAPI(title="AtendeAI Console API")


@app.get("/api/")
async def root():
    return {"message": "AtendeAI Console API", "status": "ok"}


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
]


async def _seed():
    if await assistants.count_documents({}) > 0:
        return
    logger.info("Semeando assistente de demonstração...")
    aid = str(uuid.uuid4())
    doc = {
        "id": aid, "name": "Nova — TechNova", "description": "Assistente de atendimento da loja TechNova (exemplo).",
        "avatar_color": "#0d9488", "provider": "openai", "model": "gpt-5.4",
        "language": "Português (Brasil)",
        "personality": "Simpática, prestativa e objetiva. Transmite confiança sem ser robótica.",
        "tone": "Cordial e profissional, usa emojis com moderação.",
        "role_instructions": "Você é a atendente virtual da Loja TechNova. Ajude clientes com dúvidas sobre pedidos, trocas, pagamentos, prazos e entregas.",
        "rules": [
            "Responda de forma concisa e direta.",
            "Nunca invente valores, prazos ou políticas.",
            "Se não souber, ofereça encaminhar para um atendente humano.",
        ],
        "business_objectives": "Resolver a dúvida com precisão, reduzir devoluções e incentivar a finalização da compra quando pertinente.",
        "greeting": "Olá! Eu sou a Nova, assistente da TechNova. Como posso ajudar?",
        "fallback": "Não tenho essa informação no momento. Posso te encaminhar para um atendente humano?",
        "handoff_rules": "Escale para humano quando: o cliente pedir explicitamente, demonstrar forte insatisfação, solicitar cancelamento/reembolso complexo, ou quando a resposta não estiver na base de conhecimento.",
        "kb_strict": True, "temperature": 0.5,
        "created_at": _now(), "updated_at": _now(),
    }
    await assistants.insert_one(dict(doc))
    for title, content in SEED_KB:
        sid = str(uuid.uuid4())
        chunks = chunk_text(content)
        await knowledge_chunks.insert_many([
            {"id": str(uuid.uuid4()), "assistant_id": aid, "source_id": sid, "text": c, "order": i}
            for i, c in enumerate(chunks)
        ])
        await knowledge_sources.insert_one({
            "id": sid, "assistant_id": aid, "type": "text", "title": title,
            "content": content, "filename": None, "status": "indexed",
            "chunk_count": len(chunks), "created_at": _now(),
        })
    logger.info("Seed concluído.")


@app.on_event("startup")
async def startup():
    await create_indexes()
    await _seed()


@app.on_event("shutdown")
async def shutdown():
    from database import client
    client.close()
