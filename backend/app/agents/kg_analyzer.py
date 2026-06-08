"""Knowledge-graph helpers.

Three operations, all designed to be **fast and deterministic where
possible**:

- ``analyze(hanzi, existing_tags)`` returns the data the Next.js layer
  needs to insert a new node: pinyin, short definition, the meaningful
  radicals other characters often share, a per-character breakdown for
  the UI, and broad english semantic tags. Pinyin + definition come from
  CC-CEDICT and radicals/components from the local makemeahanzi
  dictionary; semantic tags from the LLM, biased toward the user's
  existing tag vocabulary so new words cluster naturally. GPT is also
  used for connection explanations in review mode (not for components).

- ``explain_connection(a, b, edges)`` produces a short english
  explanation of why two words are linked. Used by the quiz mode.

- ``suggest_related(focus, existing, existing_tags, existing_radicals)``
  proposes a few new words that would create rich new edges with the
  user's current graph.

Edge construction itself is deterministic and lives in the Next.js
route: two nodes get a ``character`` edge if they share any radical,
and a ``meaning`` edge if they share any semantic tag.
"""
from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from .. import dictionary as cedict
from .. import hanzi_data
from ..dictionary import is_hanzi as _is_hanzi
from ..llm import safe_json, text_llm


# ---------- local lookups ----------
def _cedict_pinyin_definition(hanzi: str) -> tuple[str, str]:
    """Take the best CEDICT entry's pinyin and a compact english definition."""
    entries = cedict.lookup(hanzi)
    if not entries:
        return "", ""
    e = entries[0]
    defs = [d for d in e.definitions if d.strip()][:3]
    return e.pinyin, "; ".join(defs)


def _components_for_word(hanzi: str) -> tuple[list[str], list[str]]:
    """Return ``(radicals, components_lines)`` for a word.

    radicals: unique canonical radicals across the word's characters.
    components_lines: one human-readable line per character, e.g.
        "拉 = 扌(hand) + 立(stand)"
    """
    radicals: list[str] = []
    lines: list[str] = []
    for ch in hanzi:
        if not _is_hanzi(ch):
            continue
        rec = hanzi_data.lookup(ch)
        if not rec:
            continue
        r = rec.get("radical")
        if isinstance(r, str) and r and r not in radicals:
            radicals.append(r)
        parts = hanzi_data.decomposition_components(
            str(rec.get("decomposition", "") or "")
        )
        # Skip self-references so we don't render '到 = 到(arrive)'.
        parts = [c for c in parts if c != ch]
        labelled = []
        for c in parts:
            d = hanzi_data.short_definition(c)
            labelled.append(f"{c}({d})" if d else c)
        if labelled:
            lines.append(f"{ch} = " + " + ".join(labelled))
        else:
            d = hanzi_data.short_definition(ch)
            if d:
                lines.append(f"{ch} — {d}")
    return radicals[:6], lines[:6]


# ---------- analyze ----------
_TAG_SYSTEM = (
    "You assign 3-6 broad lowercase English topic tags to a Chinese word "
    "for a learner's vocabulary knowledge graph. Tags are short single-"
    "word nouns (e.g. 'motion', 'communication', 'emotion', 'food', "
    "'time', 'body', 'weather', 'travel', 'family', 'work'). When a tag "
    "from the provided existing_tags list fits the meaning, REUSE it "
    "instead of inventing a synonym — this lets words cluster together. "
    "Return STRICT JSON only:\n"
    '{"tags": ["...", "..."]}'
)


def _semantic_tags(
    hanzi: str,
    pinyin: str,
    definition: str,
    existing_tags: list[str],
) -> list[str]:
    payload = {
        "hanzi": hanzi,
        "pinyin": pinyin,
        "definition": definition,
        # Cap the prompt so a giant graph doesn't blow the context.
        "existing_tags": sorted(set(t for t in existing_tags if t))[:60],
    }
    msgs = [
        SystemMessage(content=_TAG_SYSTEM),
        HumanMessage(content=json.dumps(payload, ensure_ascii=False)),
    ]
    data = safe_json(text_llm(0.0).invoke(msgs).content)
    raw = data.get("tags") or []
    cleaned: list[str] = []
    for item in raw:
        if not isinstance(item, str):
            continue
        t = item.strip().lower()
        if t and t not in cleaned:
            cleaned.append(t)
    return cleaned[:8]


def analyze(hanzi: str, existing_tags: list[str] | None = None) -> dict[str, Any]:
    pinyin, definition = _cedict_pinyin_definition(hanzi)
    radicals, components = _components_for_word(hanzi)
    try:
        tags = _semantic_tags(hanzi, pinyin, definition, existing_tags or [])
    except Exception:
        tags = []
    return {
        "pinyin": pinyin,
        "definition": definition,
        "radicals": radicals,
        "components": components,
        "semantic_tags": tags,
    }


# ---------- connection ----------
_CONNECTION_SYSTEM = (
    "You are a Mandarin teacher. Two Chinese words are linked in a "
    "learner's knowledge graph because they share either a semantic "
    "theme, a character radical, or both. Given the words and the "
    "stored edge reasons, write a SHORT english explanation (1-2 "
    "sentences, under 50 words) that confirms why they are linked. "
    "Name the shared radical or meaning explicitly. Plain text, no "
    "markdown."
)


def explain_connection(word_a: str, word_b: str, edges: list[dict]) -> str:
    payload = {"word_a": word_a, "word_b": word_b, "edges": edges}
    msgs = [
        SystemMessage(content=_CONNECTION_SYSTEM),
        HumanMessage(content=json.dumps(payload, ensure_ascii=False)),
    ]
    return str(text_llm(0.0).invoke(msgs).content or "").strip()


# ---------- suggest ----------
_SUGGEST_SYSTEM = (
    "You are a Mandarin teacher building a learner's vocabulary "
    "knowledge graph. Given a focus word and the existing graph, "
    "suggest 3-5 NEW Simplified Chinese words that would create rich "
    "new connections.\n\n"
    "Strong preference rules:\n"
    "- At least 2 suggestions should share one of the existing_radicals "
    "with the focus word (so they form character edges).\n"
    "- At least 2 suggestions should match one of the existing_tags "
    "(so they form meaning edges).\n"
    "- Avoid words already in 'existing'. Keep at HSK 2-5 level.\n\n"
    "Return STRICT JSON only:\n"
    '{ "suggestions": [\n'
    '   { "hanzi": "..", "pinyin": "..", "definition": "..", '
    '"reason": "<1-sentence why it connects, naming the shared radical '
    'or tag>" }\n'
    "] }"
)


def suggest_related(
    focus: str,
    existing: list[str],
    existing_tags: list[str] | None = None,
    existing_radicals: list[str] | None = None,
) -> list[dict]:
    payload = {
        "focus": focus,
        "existing": existing,
        "existing_tags": sorted(set(t for t in (existing_tags or []) if t))[:60],
        "existing_radicals": sorted(
            set(r for r in (existing_radicals or []) if r)
        )[:60],
    }
    msgs = [
        SystemMessage(content=_SUGGEST_SYSTEM),
        HumanMessage(content=json.dumps(payload, ensure_ascii=False)),
    ]
    data = safe_json(text_llm(0.0).invoke(msgs).content)
    items = data.get("suggestions") or []
    out: list[dict] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        h = str(item.get("hanzi", "")).strip()
        if not h or h in existing:
            continue
        out.append(
            {
                "hanzi": h,
                "pinyin": str(item.get("pinyin", "") or ""),
                "definition": str(item.get("definition", "") or ""),
                "reason": str(item.get("reason", "") or ""),
            }
        )
    return out[:5]
