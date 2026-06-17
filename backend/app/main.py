"""FastAPI entry point for the Shijie backend.

Exposes:
    GET  /health
    POST /dictionary/segment   { text }              -> tokens with entries
    GET  /dictionary/lookup    ?word=                -> entries + stroke + audio
    POST /ai/explain           { word, context }     -> markdown explanation
    POST /ai/translate         { text }              -> segmented + aligned English
    POST /ai/paragraph         { words: [..] }       -> chinese paragraph
    POST /daily/grade          { ... }               -> LangGraph image agent
    POST /kg/analyze           { hanzi }             -> radicals + tags + pinyin
    POST /kg/connection        { word_a, word_b, edges } -> short explanation
    POST /kg/suggest           { focus, existing }   -> related word suggestions

Authentication is delegated to the Next.js frontend. All backend calls
are made server-side by Next.js (the browser never reaches this service
directly). Set ``BACKEND_SHARED_SECRET`` to require a matching
``X-Backend-Secret`` header so a leaked URL can't be used to burn OpenAI
quota; when it's unset (local dev) the check is skipped.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Callable, TypeVar

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from . import dictionary as dct
from . import hanzi_data
from .agents import (
    image_describer,
    kg_analyzer,
    paragraph_generator,
    text_translator,
    word_explainer,
)

load_dotenv()

logger = logging.getLogger("shijie")

T = TypeVar("T")


def run_agent(label: str, fn: Callable[..., T], *args: Any, **kwargs: Any) -> T:
    """Run an LLM/agent call, logging the real error and returning a clean 502.

    Avoids repeating the same try/except in every route and stops internal
    exception details (keys, stack traces) from leaking to clients.
    """
    try:
        return fn(*args, **kwargs)
    except Exception:
        logger.exception("%s failed", label)
        raise HTTPException(502, f"{label} is temporarily unavailable")


app = FastAPI(title="Shijie backend", version="0.1.0")

origins = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

_SHARED_SECRET = os.environ.get("BACKEND_SHARED_SECRET")


@app.middleware("http")
async def require_shared_secret(request: Request, call_next):
    """Reject calls without the shared secret (when one is configured).

    ``/health`` and CORS preflight (OPTIONS) are always allowed.
    """
    if (
        _SHARED_SECRET
        and request.method != "OPTIONS"
        and request.url.path != "/health"
        and request.headers.get("x-backend-secret") != _SHARED_SECRET
    ):
        return JSONResponse({"error": "forbidden"}, status_code=403)
    return await call_next(request)


# ---------- health ----------
@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "cedict_loaded": dct.CEDICT_FILE.exists(),
        "canto_loaded": dct.CEDICT_CANTO_FILE.exists(),
        "hanzi_dictionary_loaded": hanzi_data.is_loaded(),
        "openai_key_present": bool(os.environ.get("OPENAI_API_KEY")),
    }


# ---------- dictionary ----------
class SegmentRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=20_000)


@app.post("/dictionary/segment")
def segment(req: SegmentRequest) -> dict[str, Any]:
    tokens = dct.segment(req.text)
    out = []
    for tok in tokens:
        entries = dct.lookup(tok) if any(dct.is_hanzi(c) for c in tok) else []
        out.append({
            "token": tok,
            "is_hanzi": bool(entries) or (len(tok) == 1 and dct.is_hanzi(tok)),
            "entries": [e.to_dict() for e in entries],
        })
    return {"tokens": out}


@app.get("/dictionary/lookup")
def lookup(word: str, audio: str = "mandarin") -> dict[str, Any]:
    if not word:
        raise HTTPException(400, "word is required")
    if audio not in ("mandarin", "cantonese"):
        audio = "mandarin"
    entries = dct.lookup(word)
    # character-level stroke order links for each hanzi in the word
    chars = []
    for ch in word:
        if dct.is_hanzi(ch):
            chars.append({
                "char": ch,
                "stroke_animated_svg": dct.stroke_svg_url(ch),
                "stroke_still_svg": dct.stroke_still_url(ch),
                "stroke_data_json": dct.stroke_data_url(ch),
            })
    return {
        "word": word,
        "entries": [e.to_dict() for e in entries],
        "characters": chars,
        "audio_url": dct.audio_url(word, audio),  # type: ignore[arg-type]
    }


# ---------- AI ----------
class LearningPrefs(BaseModel):
    script: str = "simplified"
    locale: str = "mandarin"


class ExplainRequest(LearningPrefs):
    word: str
    context: str | None = None


@app.post("/ai/explain")
def ai_explain(req: ExplainRequest) -> dict[str, str]:
    text = run_agent(
        "explain",
        word_explainer.explain,
        req.word,
        req.context,
        req.script,
        req.locale,
    )
    return {"markdown": text}


class TranslateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=20_000)


@app.post("/ai/translate")
def ai_translate(req: TranslateRequest) -> dict[str, Any]:
    hanzi_count = dct.count_hanzi(req.text)
    if hanzi_count > dct.TRANSLATE_HANZI_LIMIT:
        raise HTTPException(
            400,
            f"Text has {hanzi_count} Chinese characters; "
            f"maximum is {dct.TRANSLATE_HANZI_LIMIT}",
        )
    return run_agent("translate", text_translator.translate, req.text)


class ParagraphRequest(LearningPrefs):
    words: list[str] = Field(default_factory=list)


@app.post("/ai/paragraph")
def ai_paragraph(req: ParagraphRequest) -> dict[str, str]:
    if not req.words:
        raise HTTPException(400, "words must be non-empty")
    text = run_agent(
        "paragraph",
        paragraph_generator.generate,
        req.words,
        req.script,
        req.locale,
    )
    return {"paragraph": text}


# ---------- daily image game ----------
class DailyGradeRequest(LearningPrefs):
    image_url: str
    attempt_text: str
    attempt_number: int = Field(ge=1, le=3)
    target_desc: str | None = None
    target_elements: list[str] = Field(default_factory=list)
    max_attempts: int = 3
    difficulty: str = "easy"


@app.post("/daily/grade")
def daily_grade(req: DailyGradeRequest) -> dict[str, Any]:
    return run_agent(
        "daily grade",
        image_describer.run,
        image_url=req.image_url,
        attempt_text=req.attempt_text,
        attempt_number=req.attempt_number,
        target_desc=req.target_desc,
        target_elements=req.target_elements,
        max_attempts=req.max_attempts,
        difficulty=req.difficulty,
        script=req.script,
        locale=req.locale,
    )


# ---------- knowledge graph ----------
class KgAnalyzeRequest(BaseModel):
    hanzi: str = Field(..., min_length=1, max_length=32)
    existing_tags: list[str] = Field(default_factory=list)


@app.post("/kg/analyze")
def kg_analyze(req: KgAnalyzeRequest) -> dict[str, Any]:
    return run_agent("analyze", kg_analyzer.analyze, req.hanzi, req.existing_tags)


class KgConnectionRequest(LearningPrefs):
    word_a: str
    word_b: str
    edges: list[dict] = Field(default_factory=list)


@app.post("/kg/connection")
def kg_connection(req: KgConnectionRequest) -> dict[str, str]:
    text = run_agent(
        "connection",
        kg_analyzer.explain_connection,
        req.word_a,
        req.word_b,
        req.edges,
        req.locale,
    )
    return {"explanation": text}


class KgSuggestRequest(LearningPrefs):
    focus: str
    existing: list[str] = Field(default_factory=list)
    existing_tags: list[str] = Field(default_factory=list)
    existing_radicals: list[str] = Field(default_factory=list)


@app.post("/kg/suggest")
def kg_suggest(req: KgSuggestRequest) -> dict[str, Any]:
    suggestions = run_agent(
        "suggest",
        kg_analyzer.suggest_related,
        req.focus,
        req.existing,
        req.existing_tags,
        req.existing_radicals,
        req.script,
        req.locale,
    )
    return {"suggestions": suggestions}
