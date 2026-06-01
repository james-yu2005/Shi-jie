"""'Ask AI' explainer for a Chinese word/phrase in context.

Used by the Reader page's optional AI button. Returns a richer
English-language explanation than the bare dictionary entry.
"""
from __future__ import annotations

from typing import Iterable

from langchain_core.messages import HumanMessage, SystemMessage

from ..llm import text_llm

_SYSTEM = (
    "You are an expert Mandarin tutor. The user is reading a Chinese text and "
    "wants a deeper explanation of a specific word or phrase they highlighted. "
    "Reply in clear English using short markdown sections:\n"
    "**Meaning** – nuanced English gloss\n"
    "**Pinyin** – with tone marks\n"
    "**Breakdown** – per-character meaning if multi-character\n"
    "**Usage** – how/when natives use it, register, common collocations\n"
    "**Examples** – 2 example sentences in Chinese with pinyin + English\n"
    "Keep it under 250 words."
)


def explain(word: str, context: str | None = None) -> str:
    user = f"Word/phrase: {word}"
    if context:
        user += f"\nContext sentence: {context}"
    msgs: Iterable = [SystemMessage(content=_SYSTEM), HumanMessage(content=user)]
    return text_llm(0.3).invoke(msgs).content  # type: ignore[return-value]
