"""
StoneLinked Klantenservice — FastAPI backend.

Start de server:
    cd /home/user/Ai-agent
    uvicorn web.app:app --reload --port 8000

Of vanuit de web/ map:
    cd web
    uvicorn app:app --reload --port 8000

Endpoints:
    GET  /          → Chatwidget HTML pagina
    POST /chat      → Verwerk klantbericht, retourneer agent antwoord
    GET  /health    → Health check
"""

from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Zorg dat de projectroot op het pad staat zodat imports werken
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from agents.orchestrator import OrchestratorAgent
from agents.specialists import (
    PakketAdviseur,
    BestellingAgent,
    GedenkpaginaAgent,
    PartnerAgent,
    EscalatieAgent,
)
from session.manager import SessionManager

load_dotenv(ROOT / ".env")

# ── App setup ──────────────────────────────────────────────────────────────
app = FastAPI(title="StoneLinked Klantenservice", version="1.0.0")

STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# ── Agent initialisatie ────────────────────────────────────────────────────
api_key = os.environ.get("ANTHROPIC_API_KEY")
if not api_key:
    raise RuntimeError(
        "ANTHROPIC_API_KEY is niet ingesteld. "
        "Kopieer .env.example naar .env en voeg uw sleutel toe."
    )

_client = anthropic.Anthropic(api_key=api_key)
_specialists = {
    "pakket_adviseur": PakketAdviseur(_client),
    "bestelling_agent": BestellingAgent(_client),
    "gedenkpagina_agent": GedenkpaginaAgent(_client),
    "partner_agent": PartnerAgent(_client),
    "escalatie_agent": EscalatieAgent(_client),
}
_orchestrator = OrchestratorAgent(specialists=_specialists, client=_client)

# Sessies per session_id (in-memory; voor productie: Redis of database)
_sessions: dict[str, SessionManager] = {}


# ── Request/response schemas ───────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    session_id: str = ""


class ChatResponse(BaseModel):
    response: str
    session_id: str


# ── Routes ─────────────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
async def index():
    """Laad de chatwidget HTML pagina."""
    html_path = STATIC_DIR / "index.html"
    if not html_path.exists():
        raise HTTPException(status_code=404, detail="index.html niet gevonden")
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Verwerk een klantbericht en retourneer het agent antwoord."""
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Bericht mag niet leeg zijn.")

    # Haal bestaande sessie op of maak een nieuwe aan
    session_id = req.session_id.strip() or str(uuid.uuid4())
    if session_id not in _sessions:
        _sessions[session_id] = SessionManager(max_turns=20)

    session = _sessions[session_id]
    session.add_user_message(req.message)

    try:
        response_text = _orchestrator.process(session=session)
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=401, detail="Ongeldige API-sleutel.")
    except anthropic.RateLimitError:
        raise HTTPException(status_code=429, detail="Limiet bereikt. Even wachten.")
    except anthropic.APIConnectionError:
        raise HTTPException(status_code=503, detail="Verbinding met AI mislukt.")
    except anthropic.APIStatusError as exc:
        raise HTTPException(status_code=502, detail=f"API-fout: {exc.message}")

    return ChatResponse(response=response_text, session_id=session_id)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "StoneLinked Klantenservice"}
