"""Generate a short Chinese paragraph using every word in the user's bucket.

Used by the flashcards page's "AI paragraph" game mode. The returned text
is sent back to the Reader so the user can study it the same way they
study any pasted Chinese text.
"""
from __future__ import annotations

from typing import Iterable

from langchain_core.messages import HumanMessage, SystemMessage

from ..llm import text_llm

_SYSTEM = (
    "You are a Mandarin teacher. Given a list of Chinese words, write ONE "
    "coherent paragraph (3-6 sentences, ~80-150 Chinese characters) in "
    "Simplified Chinese that uses every word at least once naturally. "
    "Do not list the words. Do not include pinyin or English. Do not add "
    "headings. Output only the paragraph."
)


def generate(words: list[str]) -> str:
    if not words:
        return ""
    user = "Words: " + ", ".join(words)
    msgs: Iterable = [SystemMessage(content=_SYSTEM), HumanMessage(content=user)]
    return text_llm(0.7).invoke(msgs).content  # type: ignore[return-value]
