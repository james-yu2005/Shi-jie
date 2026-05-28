"""FastAPI entry point for the Shijie backend.

Exposes:
    GET  /health
    POST /dictionary/segment   { text }              -> tokens with entries
    GET  /dictionary/lookup    ?word=&context=       -> entries + stroke + audio
    POST /ai/explain           { word, context }     -> markdown explanation
    POST /ai/paragraph         { words: [..] }       -> chinese paragraph
    POST /daily/grade          { ... }               -> LangGraph image agent
    POST /kg/analyze           { hanzi }             -> radicals + tags + pinyin
    POST /kg/connection        { word_a, word_b, edges } -> short explanation
    POST /kg/suggest           { focus, existing }   -> related word suggestions

Authentication is delegated to the Next.js frontend; this service trusts
its caller. In production you'd put it behind the same network or add a
shared secret header. For local dev that's overkill.
"""
from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import dictionary as dct
from . import hanzi_data
from .agents import (
    image_describer,
    kg_analyzer,
    paragraph_generator,
    word_explainer,
)

load_dotenv()

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


# ---------- health ----------
@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "cedict_loaded": dct.CEDICT_FILE.exists(),
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
        entries = dct.lookup(tok) if any(dct._is_hanzi(c) for c in tok) else []
        out.append({
            "token": tok,
            "is_hanzi": bool(entries) or (len(tok) == 1 and dct._is_hanzi(tok)),
            "entries": [e.to_dict() for e in entries],
        })
    return {"tokens": out}


@app.get("/dictionary/lookup")
def lookup(word: str, context: str | None = None) -> dict[str, Any]:
    if not word:
        raise HTTPException(400, "word is required")
    entries = dct.lookup(word)
    # character-level stroke order links for each hanzi in the word
    chars = []
    for ch in word:
        if dct._is_hanzi(ch):
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
        "audio_url": dct.audio_url(word),
    }


# ---------- AI ----------
class ExplainRequest(BaseModel):
    word: str
    context: str | None = None


@app.post("/ai/explain")
def ai_explain(req: ExplainRequest) -> dict[str, str]:
    try:
        text = word_explainer.explain(req.word, req.context)
    except Exception as e:  # pragma: no cover
        raise HTTPException(502, f"LLM error: {e}")
    return {"markdown": text}


class ParagraphRequest(BaseModel):
    words: list[str] = Field(default_factory=list)


@app.post("/ai/paragraph")
def ai_paragraph(req: ParagraphRequest) -> dict[str, str]:
    if not req.words:
        raise HTTPException(400, "words must be non-empty")
    try:
        text = paragraph_generator.generate(req.words)
    except Exception as e:  # pragma: no cover
        raise HTTPException(502, f"LLM error: {e}")
    return {"paragraph": text}


# ---------- daily image game ----------
class DailyGradeRequest(BaseModel):
    image_url: str
    attempt_text: str
    attempt_number: int = Field(ge=1, le=3)
    target_desc: str | None = None
    target_elements: list[str] = Field(default_factory=list)
    max_attempts: int = 3


@app.post("/daily/grade")
def daily_grade(req: DailyGradeRequest) -> dict[str, Any]:
    try:
        result = image_describer.run(
            image_url=req.image_url,
            attempt_text=req.attempt_text,
            attempt_number=req.attempt_number,
            target_desc=req.target_desc,
            target_elements=req.target_elements,
            max_attempts=req.max_attempts,
        )
    except Exception as e:  # pragma: no cover
        raise HTTPException(502, f"agent error: {e}")
    return result


# ---------- knowledge graph ----------
class KgAnalyzeRequest(BaseModel):
    hanzi: str = Field(..., min_length=1, max_length=32)
    existing_tags: list[str] = Field(default_factory=list)


@app.post("/kg/analyze")
def kg_analyze(req: KgAnalyzeRequest) -> dict[str, Any]:
    try:
        return kg_analyzer.analyze(req.hanzi, req.existing_tags)
    except Exception as e:  # pragma: no cover
        raise HTTPException(502, f"analyze error: {e}")


class KgConnectionRequest(BaseModel):
    word_a: str
    word_b: str
    edges: list[dict] = Field(default_factory=list)


@app.post("/kg/connection")
def kg_connection(req: KgConnectionRequest) -> dict[str, str]:
    try:
        text = kg_analyzer.explain_connection(req.word_a, req.word_b, req.edges)
    except Exception as e:  # pragma: no cover
        raise HTTPException(502, f"LLM error: {e}")
    return {"explanation": text}


class KgSuggestRequest(BaseModel):
    focus: str
    existing: list[str] = Field(default_factory=list)
    existing_tags: list[str] = Field(default_factory=list)
    existing_radicals: list[str] = Field(default_factory=list)


@app.post("/kg/suggest")
def kg_suggest(req: KgSuggestRequest) -> dict[str, Any]:
    try:
        suggestions = kg_analyzer.suggest_related(
            req.focus,
            req.existing,
            req.existing_tags,
            req.existing_radicals,
        )
    except Exception as e:  # pragma: no cover
        raise HTTPException(502, f"LLM error: {e}")
    return {"suggestions": suggestions}
