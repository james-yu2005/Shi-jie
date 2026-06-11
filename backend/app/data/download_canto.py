"""One-shot helper to download CC-CEDICT Cantonese readings into backend/app/data/.

Usage:
    python -m app.data.download_canto

Fetches the CC-CEDICT Cantonese readings file from cccanto.org and writes
``cedict_canto.u8``. Run after ``download_cedict``.
"""
from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

# CC-CEDICT Cantonese readings (Jyutping in {} brackets).
# Mirror of Pleco's CC-CEDICT Cantonese readings file (CC BY-SA 3.0).
URL = (
    "https://raw.githubusercontent.com/amadeusine/cc-canto-data/master/"
    "cccedict-canto-readings.txt"
)
DEST = Path(__file__).resolve().parent / "cedict_canto.u8"


def download() -> Path:
    print(f"Downloading CC-CEDICT Cantonese readings from {URL} ...", file=sys.stderr)
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
