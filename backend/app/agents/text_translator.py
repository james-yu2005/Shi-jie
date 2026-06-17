"""Beginner-friendly translation with per-token English alignment.

Two-step flow:
  1. Natural English translation
  2. Token-level alignment — each token gets either:
     • english_phrase: verbatim span in the translation, OR
     • is_filler=true: grammar/particle word with a short grammatical label
"""
from __future__ import annotations

import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from .. import dictionary as dct
from ..llm import safe_json, text_llm

_SENT_END = re.compile(r"[。！？!?\n]$")

# Common Chinese particles / grammar words that rarely map to visible English
_FILLER_TOKENS = {
    "的", "了", "着", "过", "地", "得",           # aspect/structural
    "吗", "呢", "吧", "啊", "哦", "嘛", "呀",     # sentence-final particles
    "把", "被", "叫", "让", "使",                   # ba/bei constructions
}

_FILLER_GLOSSES = {
    "的": "possessive/structural particle",
    "了": "completed action marker",
    "着": "ongoing action marker",
    "过": "past experience marker",
    "地": "adverb particle",
    "得": "result/degree particle",
    "吗": "yes/no question particle",
    "呢": "question/continuation particle",
    "吧": "suggestion/assumption particle",
    "啊": "exclamation particle",
    "把": "object-fronting particle",
    "被": "passive marker",
    "是": "to be",
    "在": "at / in (progressive)",
    "都": "all / always",
    "会": "can / will",
    "就": "then / right away",
    "也": "also / too",
    "还": "still / also",
    "很": "very",
    "不": "not",
    "没": "have not",
    "有": "have / there is",
    "和": "and",
    "或": "or",
    "但": "but",
    "而": "but / and",
    "所以": "therefore",
    "因为": "because",
    "虽然": "although",
    "如果": "if",
    "一": "one / a",
    "这": "this",
    "那": "that",
    "什么": "what",
    "怎么": "how",
}


def _translate_system() -> str:
    return (
        "You are translating Chinese for a language learning app where each word will later "
        "be linked to some part of your English translation.\n\n"
        "Each sentence includes chinese, tokens (fixed segmentation), and glossary "
        "[{token, candidates}] with dictionary senses.\n\n"
        "Write ONE fluent English sentence per chinese sentence. Natural paraphrases are fine "
        "(e.g. glossary \"car\" → English \"vehicle\") — use whatever reads naturally, as long as "
        "each content token's meaning is expressed by a verbatim English word or phrase in your output.\n\n"
        'Respond with STRICT JSON: {"sentences": [{"english": "<English translation>"}]}'
    )


def _align_system() -> str:
    return (
        "You are aligning Chinese tokens to an already-written English translation for a language learning app.\n\n"
        "Each sentence has:\n"
        "  - chinese: the full Chinese sentence\n"
        "  - tokens: segmented Chinese words (fixed order — do not re-segment)\n"
        "  - glossary: [{token, candidates}] — dictionary sense options per token\n"
        "  - english: the complete English translation (already final — do not change it)\n\n"
        "For each token in `tokens`, return one alignment object:\n"
        "  - local: 0-based index into the tokens list\n"
        "  - english_phrase: substring with similar meaning from `english` (same case/spacing), or '' "
        "for grammar particles with no surface form\n"
        "  - gloss: MUST be copied exactly from that token's `candidates` list (a dictionary sense). "
        "Never invent glosses and never use the English paraphrase as gloss.\n"
        "  - is_filler: true only for grammar/structural particles with no English surface form\n\n"
        "Semantic matching (important):\n"
        "- english_phrase and gloss MAY use different words when the translation paraphrases the dictionary.\n"
        "  Example: candidates [\"car\"], english contains \"vehicle\" → english_phrase: \"vehicle\", "
        "gloss: \"car\".\n"
        "- Another: candidates [\"to meet\"], english has \"encounter\" → english_phrase: \"encounter\", "
        "gloss: \"to meet\".\n"
        "- Still link them when the meaning clearly matches, even without shared letters.\n"
        "- english_phrase MUST be copied verbatim from english; gloss comes from candidates.\n"
        "- Multiple tokens may share the same english_phrase.\n"
        "- Always return one alignment per token (same count as tokens list).\n\n"
        'Respond with STRICT JSON: {"sentences":[{"alignments":[{"local":0,"english_phrase":"...",'
        '"gloss":"...","is_filler":false}]}]}'
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
    defs = _wordpanel_definitions(entries)
    if not defs:
        return None
    g = defs[0].split(";")[0].split("(")[0].strip()
    return g[:48] if g else None


def _wordpanel_definitions(entries: list[dict]) -> list[str]:
    """Full CC-CEDICT definition strings (same items shown in WordPanel)."""
    out: list[str] = []
    seen: set[str] = set()
    for entry in entries:
        for d in entry.get("definitions") or []:
            d = str(d).strip()
            if d and d not in seen:
                seen.add(d)
                out.append(d)
    return out


def _coerce_dictionary_gloss(
    gloss: str,
    entries: list[dict],
    tok_text: str,
    english_phrase: str = "",
) -> str:
    """Ensure gloss is always a real dictionary sense from WordPanel."""
    defs = _wordpanel_definitions(entries)
    if not defs:
        fb = _FILLER_GLOSSES.get(tok_text)
        return fb or gloss.strip() or tok_text

    g = gloss.strip()
    g_lower = g.lower() if g else ""

    if g:
        for d in defs:
            if d.lower() == g_lower:
                return d
        for d in defs:
            short = d.split(";")[0].split("(")[0].strip()
            if short.lower() == g_lower:
                return d
        for d in defs:
            short = d.split(";")[0].split("(")[0].strip().lower()
            if g_lower in d.lower() or short.startswith(g_lower) or g_lower.startswith(short):
                return d

    if english_phrase and g_lower == english_phrase.strip().lower():
        g = ""
        g_lower = ""

    return defs[0]


def _find_phrase(english: str, phrase: str, used: set[tuple[int, int]], start: int = 0) -> tuple[int, int] | None:
    """Find first unused occurrence of phrase (case-insensitive fallback) after start."""
    phrase = phrase.strip()
    if not phrase:
        return None
    # try exact match first, then case-insensitive
    for test_en, test_ph in [(english, phrase), (english.lower(), phrase.lower())]:
        pos = start
        while pos <= len(test_en) - len(test_ph):
            idx = test_en.find(test_ph, pos)
            if idx < 0:
                break
            span = (idx, idx + len(test_ph))
            # reject if overlapping with already-used span
            if not any(s < span[1] and span[0] < e for s, e in used):
                return span
            pos = idx + 1
    return None


def _resolve_spans(english: str, raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Turn english_phrase strings into character-level spans, allowing reuse."""
    resolved: list[dict[str, Any]] = []
    used: set[tuple[int, int]] = set()
    cursor = 0

    for a in raw:
        phrase = str(a.get("english_phrase") or "").strip()
        gloss = str(a.get("gloss") or "").strip()
        is_filler = bool(a.get("is_filler", False))
        token_index = a["token_index"]
        entries = a.get("entries") or []
        tok_text = str(a.get("token") or "")

        if is_filler or not phrase:
            resolved.append({
                "token_index": token_index,
                "gloss": gloss or a.get("token", ""),
                "is_filler": True,
                "english_phrase": "",
                "english_start": -1,
                "english_end": -1,
            })
            continue

        # Try from cursor forward first, then from beginning (for shared phrases)
        span = _find_phrase(english, phrase, used, cursor)
        if span is None:
            span = _find_phrase(english, phrase, used, 0)

        if span is None:
            # phrase not found — treat as filler
            resolved.append({
                "token_index": token_index,
                "gloss": _coerce_dictionary_gloss(gloss, entries, tok_text, phrase),
                "is_filler": True,
                "english_phrase": "",
                "english_start": -1,
                "english_end": -1,
            })
            continue

        used.add(span)
        cursor = span[1]
        final_phrase = english[span[0]:span[1]]
        resolved.append({
            "token_index": token_index,
            "gloss": _coerce_dictionary_gloss(gloss, entries, tok_text, final_phrase),
            "is_filler": False,
            "english_phrase": final_phrase,
            "english_start": span[0],
            "english_end": span[1],
        })
    return resolved


def _token_candidates(entries: list[dict], tok_text: str) -> list[str]:
    """Return up to 3 concise definition candidates for a token."""
    candidates: list[str] = []
    for entry in entries[:4]:
        for d in (entry.get("definitions") or [])[:2]:
            short = d.split(";")[0].split("(")[0].strip()[:60]
            if short and short not in candidates:
                candidates.append(short)
            if len(candidates) >= 3:
                break
        if len(candidates) >= 3:
            break
    if not candidates:
        fb = _FILLER_GLOSSES.get(tok_text)
        if fb:
            candidates.append(fb)
    return candidates


def _build_glossary(ordered_tokens: list[tuple[int, str]], all_tokens: list[dict[str, Any]]) -> list[dict]:
    """Return [{token, candidates}] — multiple def candidates so LLM can pick by context."""
    glossary = []
    for global_i, tok_text in ordered_tokens:
        candidates = _token_candidates(all_tokens[global_i]["entries"], tok_text)
        glossary.append({"token": tok_text, "candidates": candidates})
    return glossary


def _llm_translate(
    sentences_payload: list[dict[str, Any]],
    full_chinese: str = "",
) -> list[str]:
    """Translate with segment + glossary context for easier later alignment."""
    import json as _json
    payload: dict[str, Any] = {"sentences": sentences_payload}
    if full_chinese:
        payload["full_chinese"] = full_chinese
    msgs = [
        SystemMessage(content=_translate_system()),
        HumanMessage(content=_json.dumps(payload, ensure_ascii=False)),
    ]
    raw = text_llm(0.3).invoke(msgs).content
    data = safe_json(raw)
    out: list[str] = []
    for s in data.get("sentences") or []:
        if isinstance(s, dict):
            out.append(str(s.get("english") or "").strip())
        else:
            out.append("")
    return out


def _llm_align(payload: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    import json as _json
    msgs = [
        SystemMessage(content=_align_system()),
        HumanMessage(content=_json.dumps(payload, ensure_ascii=False)),
    ]
    raw = text_llm(0.0).invoke(msgs).content
    data = safe_json(raw)
    result: list[list[dict[str, Any]]] = []
    for s in data.get("sentences") or []:
        if isinstance(s, dict):
            result.append(list(s.get("alignments") or []))
        else:
            result.append([])
    return result


def translate(text: str) -> dict[str, Any]:
    tokens = _segment_tokens(text)
    groups = _group_indices(tokens)

    llm_input: list[dict[str, Any]] = []
    sentence_groups: list[list[int]] = []
    sentence_ordered: list[list[tuple[int, str]]] = []

    for group in groups:
        ordered = [(i, tokens[i]["token"]) for i in group if tokens[i]["is_hanzi"]]
        if not ordered:
            continue
        sentence_groups.append(group)
        sentence_ordered.append(ordered)
        glossary = _build_glossary(ordered, tokens)
        llm_input.append({
            "chinese": "".join(tokens[i]["token"] for i in group),
            "tokens": [tok for _, tok in ordered],
            "glossary": glossary,
        })

    english_lines: list[str] = []
    alignment_rows: list[list[dict[str, Any]]] = []

    if llm_input:
        try:
            english_lines = _llm_translate(llm_input, text)
        except Exception:
            english_lines = []

        align_payload = []
        for i, p in enumerate(llm_input):
            english = english_lines[i] if i < len(english_lines) else ""
            align_payload.append({
                "chinese": p["chinese"],
                "tokens": p["tokens"],
                "glossary": p["glossary"],
                "english": english,
            })
        try:
            alignment_rows = _llm_align(align_payload)
        except Exception:
            alignment_rows = []

    sentences_out: list[dict[str, Any]] = []
    for si, group in enumerate(sentence_groups):
        ordered = sentence_ordered[si]
        if not ordered:
            continue

        english = english_lines[si] if si < len(english_lines) else ""
        if not english:
            english = " ".join(
                _dict_gloss(tokens[i]["entries"]) or tokens[i]["token"]
                for i, _ in ordered
            )

        by_local: dict[int, dict[str, Any]] = {}
        for a in (alignment_rows[si] if si < len(alignment_rows) else []):
            if not isinstance(a, dict):
                continue
            local = int(a.get("local", -1))
            if local < 0:
                continue
            by_local[local] = a

        raw_alignments: list[dict[str, Any]] = []
        for local, (global_i, tok_text) in enumerate(ordered):
            a = by_local.get(local, {})
            phrase = str(a.get("english_phrase") or "").strip()
            gloss = str(a.get("gloss") or "").strip()
            is_filler = bool(a.get("is_filler", False))

            # auto-detect known particles even if LLM missed them
            if not is_filler and tok_text in _FILLER_TOKENS:
                is_filler = True
            # also treat single-char function words that have a known filler gloss
            if not is_filler and len(tok_text) <= 2 and tok_text in _FILLER_GLOSSES and not phrase:
                is_filler = True
            entries = tokens[global_i]["entries"]
            if not gloss:
                cands = _token_candidates(entries, tok_text)
                gloss = (
                    _FILLER_GLOSSES.get(tok_text)
                    or (cands[0] if cands else None)
                    or tok_text
                )

            gloss = _coerce_dictionary_gloss(
                gloss,
                entries,
                tok_text,
                "" if is_filler else phrase,
            ) if not is_filler else (
                gloss
                or _FILLER_GLOSSES.get(tok_text)
                or tok_text
            )

            raw_alignments.append({
                "token_index": global_i,
                "token": tok_text,
                "entries": entries,
                "english_phrase": "" if is_filler else phrase,
                "gloss": gloss,
                "is_filler": is_filler,
            })

        alignments = _resolve_spans(english, raw_alignments)

        sentences_out.append({
            "token_indices": group,
            "english": english,
            "alignments": alignments,
        })

    return {"tokens": tokens, "sentences": sentences_out}
