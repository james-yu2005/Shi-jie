"""'Ask AI' explainer for a Chinese word/phrase in context.

Used by the Reader page's optional AI button. Returns a richer
English-language explanation than the bare dictionary entry.
"""
from __future__ import annotations

from typing import Iterable

from langchain_core.messages import HumanMessage, SystemMessage

from ..llm import text_llm
from ..locale import romanization_note, script_label, tutor_role

def _system(script: str, locale: str) -> str:
    rom = "Jyutping" if locale == "cantonese" else "Pinyin"
    return (
        f"You are an expert {tutor_role(locale)}. The user is reading a Chinese text and "
        f"wants a deeper explanation of a specific word or phrase they highlighted. "
        "Reply in clear English using short markdown sections:\n"
        "**Meaning** – nuanced English gloss\n"
        f"**{rom}** – with tone marks/numbers\n"
        "**Breakdown** – per-character meaning if multi-character\n"
        "**Usage** – how/when natives use it, register, common collocations\n"
        f"**Examples** – 2 example sentences in {script_label(script)} with "
        f"{rom.lower()} + English\n"
        f"{romanization_note(locale)}\n"
        "Keep it under 250 words."
    )


def explain(
    word: str,
    context: str | None = None,
    script: str = "simplified",
    locale: str = "mandarin",
) -> str:
    user = f"Word/phrase: {word}"
    if context:
        user += f"\nContext sentence: {context}"
    msgs: Iterable = [
        SystemMessage(content=_system(script, locale)),
        HumanMessage(content=user),
    ]
    return text_llm(0.3).invoke(msgs).content  # type: ignore[return-value]
