"""Shared LLM helpers.

Centralises the ``ChatOpenAI`` factory and the lenient JSON parser that
every agent module used to re-implement. Clients are cached per
(model, temperature) so we don't rebuild a client (and its HTTP pool) on
every request, and they carry a sane timeout + retry budget for
production load.
"""
from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Any

from langchain_openai import ChatOpenAI

_TIMEOUT = float(os.environ.get("OPENAI_TIMEOUT", "30"))
_MAX_RETRIES = int(os.environ.get("OPENAI_MAX_RETRIES", "2"))

DEFAULT_TEXT_MODEL = "gpt-4o-mini"
DEFAULT_VISION_MODEL = "gpt-4o-mini"


def text_model_name() -> str:
    return os.environ.get("OPENAI_MODEL", DEFAULT_TEXT_MODEL)


def vision_model_name() -> str:
    return os.environ.get("OPENAI_VISION_MODEL", DEFAULT_VISION_MODEL)


@lru_cache(maxsize=16)
def _client(model: str, temperature: float) -> ChatOpenAI:
    return ChatOpenAI(
        model=model,
        temperature=temperature,
        timeout=_TIMEOUT,
        max_retries=_MAX_RETRIES,
    )


def text_llm(temperature: float = 0.0) -> ChatOpenAI:
    """Cached text model (``OPENAI_MODEL``, default ``gpt-4o-mini``)."""
    return _client(text_model_name(), temperature)


def vision_llm(temperature: float = 0.2) -> ChatOpenAI:
    """Cached vision model (``OPENAI_VISION_MODEL``, default ``gpt-4o-mini``)."""
    return _client(vision_model_name(), temperature)


def safe_json(raw: Any) -> dict:
    """Parse model output into a dict, tolerating code fences and prose.

    Returns ``{}`` if nothing JSON-like can be recovered.
    """
    if isinstance(raw, list):
        raw = "".join(p.get("text", "") for p in raw if isinstance(p, dict))
    raw = (raw or "").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].lstrip()
    try:
        return json.loads(raw)
    except Exception:
        start, end = raw.find("{"), raw.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(raw[start : end + 1])
            except Exception:
                pass
    return {}
