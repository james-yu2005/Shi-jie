"""Beginner-friendly translation with per-token English alignment.

Segments Chinese text, translates sentence-by-sentence, and maps each
dictionary token to the English word(s) it corresponds to so the Reader
can highlight links on hover.
"""
from __future__ import annotations

import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from .. import dictionary as dct
from ..llm import safe_json, text_llm

_SENT_END = re.compile(r"[。！？!?\n]$")
_EN_WORD = re.compile(r"\S+")


def _system() -> str:
    return (
        "You help Mandarin learners read Chinese text. You receive one or more "
        "Chinese sentences with numbered vocabulary tokens (already segmented).\n\n"
        "For EACH sentence return:\n"
        "  - english: a natural, beginner-friendly English translation\n"
        "  - alignments: for EVERY numbered token, the English word(s) from "
        "your translation that express that token's meaning (use the exact "
        "spelling/capitalization as in english; omit punctuation tokens)\n\n"
        "Respond with STRICT JSON only:\n"
        "{\n"
        '  "sentences": [\n'
        "    {\n"
        '      "english": "<translation>",\n'
        '      "alignments": [\n'
        '        {"local": 0, "english_words": ["Today"]},\n'
        "        ...\n"
        "      ]\n"
        "    }\n"
        "  ]\n"
        "}\n"
        "local is the 0-based index of the token in that sentence's token list. "
        "english_words may be 1-3 words for phrases like 非常 -> [\"really\", \"very\"]. "
        "Skip alignments only for tokens that are pure punctuation in Chinese."
    )


def _segment_tokens(text: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for tok in dct.segment(text):
        entries = dct.lookup(tok) if any(dct.is_hanzi(c) for c in tok) else []
        out.append({
            "token": tok,
            "is_hanzi": bool(entries) or (len(tok) == 1 and dct.is_hanzi(tok)),
            "entries": [e.to_dict() for e in entries],
        })
    return out


def _group_indices(tokens: list[dict[str, Any]]) -> list[list[int]]:
    groups: list[list[int]] = []
    current: list[int] = []
    for i, t in enumerate(tokens):
        current.append(i)
        if _SENT_END.search(t["token"]) or t["token"] == "\n":
            if any(tokens[j]["is_hanzi"] for j in current):
                groups.append(current)
            current = []
    if current and any(tokens[j]["is_hanzi"] for j in current):
        groups.append(current)
    return groups


def _dict_gloss(entries: list[dict]) -> str | None:
    if not entries:
        return None
    defs = entries[0].get("definitions") or []
    if not defs:
        return None
    gloss = defs[0].split(";")[0].split("(")[0].strip()
    return gloss[:48] if gloss else None


def _english_word_indices(english: str, words: list[str]) -> list[int]:
    if not words:
        return []
    tokens = _EN_WORD.findall(english)
    norm = [re.sub(r"[^\w']", "", w).lower() for w in tokens]
    found: list[int] = []
    for raw in words:
        target = re.sub(r"[^\w']", "", raw).lower()
        if not target:
            continue
        for i, t in enumerate(norm):
            if i in found:
                continue
            if t == target or target in t or t in target:
                found.append(i)
                break
    return found


def _align_sentences(
    payload: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    msgs = [
        SystemMessage(content=_system()),
        HumanMessage(content=str(payload)),
    ]
    raw = text_llm(0.2).invoke(msgs).content
    data = safe_json(raw)
    return list(data.get("sentences") or [])


def translate(text: str) -> dict[str, Any]:
    tokens = _segment_tokens(text)
    groups = _group_indices(tokens)

    llm_input: list[dict[str, Any]] = []
    sentence_groups: list[list[int]] = []

    for group in groups:
        ordered = [(i, tokens[i]["token"]) for i in group if tokens[i]["is_hanzi"]]
        if not ordered:
            continue
        sentence_groups.append(group)
        chinese = "".join(tokens[i]["token"] for i in group)
        llm_input.append({
            "chinese": chinese,
            "tokens": [tok for _, tok in ordered],
        })

    llm_sentences: list[dict[str, Any]] = []
    if llm_input:
        try:
            llm_sentences = _align_sentences(llm_input)
        except Exception:
            llm_sentences = []

    sentences_out: list[dict[str, Any]] = []
    for si, group in enumerate(sentence_groups):
        ordered = [(i, tokens[i]["token"]) for i in group if tokens[i]["is_hanzi"]]
        if not ordered:
            continue

        llm = llm_sentences[si] if si < len(llm_sentences) else {}
        english = str(llm.get("english") or "").strip()
        if not english:
            english = " ".join(
                _dict_gloss(tokens[i]["entries"]) or tokens[i]["token"]
                for i, _ in ordered
            )

        by_local = {
            int(a.get("local", -1)): list(a.get("english_words") or [])
            for a in (llm.get("alignments") or [])
            if isinstance(a, dict)
        }

        alignments: list[dict[str, Any]] = []
        for local, (global_i, _tok) in enumerate(ordered):
            words = by_local.get(local) or []
            gloss = " ".join(words).strip() if words else None
            if not gloss:
                gloss = _dict_gloss(tokens[global_i]["entries"])
            if not gloss:
                continue
            if not words:
                words = gloss.split()
            alignments.append({
                "token_index": global_i,
                "gloss": gloss,
                "english_words": words,
                "english_word_indices": _english_word_indices(english, words),
            })

        sentences_out.append({
            "token_indices": group,
            "english": english,
            "alignments": alignments,
        })

    return {"tokens": tokens, "sentences": sentences_out}
