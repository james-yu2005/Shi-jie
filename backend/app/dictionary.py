"""CC-CEDICT loader + lookup helpers.

Parses the CC-CEDICT text file once on import and exposes:
    - lookup(word) -> list[Entry]   exact match on simplified or traditional
    - segment(text) -> list[str]    greedy longest-match segmentation
    - stroke_url(char) -> str       jsDelivr URL to the animated SVG
    - audio_url(text) -> str        Google Translate TTS URL (no key)

If the dictionary file is missing, a tiny built-in fallback of common
words is used so the API still returns something useful during dev.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from functools import lru_cache
from pathlib import Path
from typing import Iterable
from urllib.parse import quote

DATA_DIR = Path(__file__).resolve().parent / "data"
CEDICT_FILE = DATA_DIR / "cedict_ts.u8"

# Pinyin tone-mark conversion (numbered -> diacritics)
_TONE_MARKS = {
    "a": "āáǎà", "e": "ēéěè", "i": "īíǐì",
    "o": "ōóǒò", "u": "ūúǔù", "ü": "ǖǘǚǜ",
    "A": "ĀÁǍÀ", "E": "ĒÉĚÈ", "I": "ĪÍǏÌ",
    "O": "ŌÓǑÒ", "U": "ŪÚǓÙ", "Ü": "ǕǗǙǛ",
}
_VOWEL_PRIORITY = ["a", "e", "o", "A", "E", "O"]


def _numbered_to_marks(syllable: str) -> str:
    """Convert one pinyin syllable like 'ni3' -> 'nǐ'. Returns input on failure."""
    m = re.match(r"^([A-Za-zü:]+)([0-5])$", syllable)
    if not m:
        return syllable.replace("u:", "ü").replace("U:", "Ü")
    body, tone = m.group(1).replace("u:", "ü").replace("U:", "Ü"), int(m.group(2))
    if tone == 0 or tone == 5:  # neutral tone
        return body
    # find the vowel that gets the diacritic
    target_idx = -1
    for v in _VOWEL_PRIORITY:
        idx = body.find(v)
        if idx != -1:
            target_idx = idx
            break
    if target_idx == -1:
        # 'iu' / 'ui' rule: mark the *last* vowel
        for i, ch in enumerate(body):
            if ch.lower() in "iuü":
                target_idx = i  # keep updating -> ends on last
    if target_idx == -1:
        return body
    ch = body[target_idx]
    marks = _TONE_MARKS.get(ch)
    if not marks:
        return body
    return body[:target_idx] + marks[tone - 1] + body[target_idx + 1 :]


def numbered_to_marks(pinyin: str) -> str:
    """'ni3 hao3' -> 'nǐ hǎo'"""
    return " ".join(_numbered_to_marks(syl) for syl in pinyin.split())


@dataclass
class Entry:
    traditional: str
    simplified: str
    pinyin_numbered: str  # e.g. "ni3 hao3"
    pinyin: str           # e.g. "nǐ hǎo"
    definitions: list[str]

    def to_dict(self) -> dict:
        return asdict(self)


# ---- minimal fallback so dev works before user runs download script ----
_FALLBACK: list[Entry] = []


def _fallback_entry(t: str, s: str, p: str, defs: list[str]) -> Entry:
    return Entry(
        traditional=t, simplified=s,
        pinyin_numbered=p, pinyin=numbered_to_marks(p),
        definitions=defs,
    )


for t, s, p, d in [
    ("你", "你", "ni3", ["you (informal, as opposed to courteous 您)"]),
    ("好", "好", "hao3", ["good", "well", "proper", "OK", "fine"]),
    ("你好", "你好", "ni3 hao3", ["hello", "hi"]),
    ("世界", "世界", "shi4 jie4", ["world", "CL:個|个"]),
    ("我", "我", "wo3", ["I", "me", "my"]),
    ("是", "是", "shi4", ["to be", "yes", "is", "are"]),
    ("中文", "中文", "Zhong1 wen2", ["the Chinese language"]),
    ("學習", "学习", "xue2 xi2", ["to learn", "to study"]),
    ("謝謝", "谢谢", "xie4 xie5", ["to thank", "thanks"]),
    ("漢字", "汉字", "Han4 zi4", ["Chinese character", "CL:個|个,塊|块"]),
]:
    _FALLBACK.append(_fallback_entry(t, s, p, d))


# ---- main parse ----
_LINE_RE = re.compile(r"^(\S+) (\S+) \[([^\]]+)\] /(.+)/\s*$")


def _parse_line(line: str) -> Entry | None:
    m = _LINE_RE.match(line)
    if not m:
        return None
    trad, simp, pin, defs = m.groups()
    return Entry(
        traditional=trad,
        simplified=simp,
        pinyin_numbered=pin,
        pinyin=numbered_to_marks(pin),
        definitions=[d for d in defs.split("/") if d.strip()],
    )


@lru_cache(maxsize=1)
def _load() -> tuple[dict[str, list[Entry]], list[str]]:
    """Returns ({word -> entries}, [all_keys_sorted_by_len_desc])."""
    table: dict[str, list[Entry]] = {}
    if CEDICT_FILE.exists():
        with CEDICT_FILE.open("r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("#") or not line.strip():
                    continue
                e = _parse_line(line)
                if not e:
                    continue
                for key in {e.simplified, e.traditional}:
                    table.setdefault(key, []).append(e)
    else:
        for e in _FALLBACK:
            for key in {e.simplified, e.traditional}:
                table.setdefault(key, []).append(e)

    keys = sorted(table.keys(), key=len, reverse=True)
    return table, keys


def lookup(word: str) -> list[Entry]:
    table, _ = _load()
    return list(table.get(word, []))


_HAN_RE = re.compile(r"[\u3400-\u9fff\uf900-\ufaff]")


def _is_hanzi(ch: str) -> bool:
    return bool(_HAN_RE.match(ch))


def segment(text: str, max_word_len: int = 6) -> list[str]:
    """Greedy longest-match segmentation against the loaded dictionary."""
    table, _ = _load()
    out: list[str] = []
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        if not _is_hanzi(ch):
            out.append(ch)
            i += 1
            continue
        # try longest possible word at position i
        matched = None
        for L in range(min(max_word_len, n - i), 0, -1):
            candidate = text[i : i + L]
            if candidate in table:
                matched = candidate
                break
        if matched:
            out.append(matched)
            i += len(matched)
        else:
            out.append(ch)
            i += 1
    return out


# ---- stroke order + audio helpers ----
# makemeahanzi exposes per-character animated SVGs via jsDelivr.
# Filenames are the unicode code point in DECIMAL.
_STROKE_BASE = (
    "https://cdn.jsdelivr.net/gh/chanind/hanzi-writer-data@2.0/{cp}.json"
)
_STROKE_SVG_BASE = (
    "https://cdn.jsdelivr.net/gh/skishore/makemeahanzi@master/svgs/{cp}.svg"
)
_STROKE_ANIM_BASE = (
    "https://cdn.jsdelivr.net/gh/skishore/makemeahanzi@master/svgs-still/{cp}-still.svg"
)


def stroke_data_url(char: str) -> str | None:
    if len(char) != 1 or not _is_hanzi(char):
        return None
    return _STROKE_BASE.format(cp=ord(char))


def stroke_svg_url(char: str) -> str | None:
    """Animated stroke-order SVG URL for a single hanzi (None for non-hanzi)."""
    if len(char) != 1 or not _is_hanzi(char):
        return None
    return _STROKE_SVG_BASE.format(cp=ord(char))


def stroke_still_url(char: str) -> str | None:
    if len(char) != 1 or not _is_hanzi(char):
        return None
    return _STROKE_ANIM_BASE.format(cp=ord(char))


def audio_url(text: str) -> str:
    """Browser-playable TTS via Google Translate (no key needed)."""
    return (
        "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob"
        f"&tl=zh-CN&q={quote(text)}"
    )
