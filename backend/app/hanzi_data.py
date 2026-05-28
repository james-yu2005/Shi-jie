"""Local Chinese character radical + decomposition lookup.

Backed by makemeahanzi's ``dictionary.txt`` (one JSON record per
character) which we download once with
``python -m app.data.download_hanzi_dict``. The data covers the
~9000-character common set and gives, for each character:

  - ``radical`` — the canonical (mostly simplified) radical glyph
  - ``decomposition`` — an IDS string like ``⿰扌立`` for 拉
  - ``definition`` — short english gloss
  - ``pinyin`` — list of pinyin readings

We expose simple helpers used by the knowledge-graph analyzer so it can
build per-character breakdowns and radical sets without round-tripping
through the LLM.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Optional

DATA_FILE = Path(__file__).resolve().parent / "data" / "hanzi_dictionary.txt"

# Ideographic Description Characters: U+2FF0..U+2FFB describe how
# sub-glyphs are spatially combined (left-right, above-below, ...).
# Strip these to recover the leaf components in a decomposition.
_IDS_OPERATORS = {chr(c) for c in range(0x2FF0, 0x2FFC)}


@lru_cache(maxsize=1)
def _index() -> dict[str, dict]:
    if not DATA_FILE.exists():
        return {}
    out: dict[str, dict] = {}
    with DATA_FILE.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except Exception:
                continue
            ch = rec.get("character")
            if isinstance(ch, str) and len(ch) == 1:
                out[ch] = rec
    return out


def is_loaded() -> bool:
    return DATA_FILE.exists()


def lookup(ch: str) -> Optional[dict]:
    return _index().get(ch)


def decomposition_components(decomp: str) -> list[str]:
    """Leaf-ish sub-components of an IDS decomposition string.

    We strip the layout operators (⿰⿱⿲...) and the placeholder ``？``
    that makemeahanzi uses for unknown pieces.
    """
    if not isinstance(decomp, str):
        return []
    return [c for c in decomp if c not in _IDS_OPERATORS and c != "？"]


def radical(ch: str) -> Optional[str]:
    rec = lookup(ch)
    return rec.get("radical") if rec else None


def short_definition(ch: str) -> str:
    rec = lookup(ch)
    if not rec:
        return ""
    raw = str(rec.get("definition", "") or "")
    # makemeahanzi uses semicolons to separate senses; keep just the first.
    return raw.split(";")[0].strip()


def components(ch: str) -> list[str]:
    rec = lookup(ch)
    if not rec:
        return []
    return decomposition_components(str(rec.get("decomposition", "")))
