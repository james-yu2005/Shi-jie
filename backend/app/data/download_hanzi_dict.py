"""One-shot helper to download makemeahanzi dictionary.txt.

Usage:
    python -m app.data.download_hanzi_dict

The file is ~7 MB of newline-delimited JSON, one record per character with
its canonical radical, decomposition (Ideographic Description Sequence
string), english definition, and pinyin. We use it to derive Knowledge-
Graph radicals and per-character breakdowns locally, which is both far
faster than an LLM call and far more accurate (the LLM regularly
hallucinated wrong sub-components like "到 = 到 (arrive)" or "遇 = 辶 + 余").
"""
from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

URL = "https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt"
DEST = Path(__file__).resolve().parent / "hanzi_dictionary.txt"


def download() -> Path:
    print(f"Downloading makemeahanzi dictionary from {URL} ...", file=sys.stderr)
    req = urllib.request.Request(
        URL, headers={"User-Agent": "shijie-app/0.1 (+https://example.com)"}
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = resp.read()
    DEST.write_bytes(data)
    print(f"  wrote {DEST} ({len(data):,} bytes)", file=sys.stderr)
    return DEST


if __name__ == "__main__":
    download()
