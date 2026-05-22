"""One-shot helper to download CC-CEDICT into backend/app/data/.

Usage:
    python -m app.data.download_cedict

The dictionary is ~5 MB compressed. We fetch the latest release from
MDBG's mirror and write the unzipped UTF-8 file as `cedict_ts.u8`.
"""
from __future__ import annotations

import gzip
import io
import sys
import urllib.request
from pathlib import Path

URL = "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz"
DEST = Path(__file__).resolve().parent / "cedict_ts.u8"


def download() -> Path:
    print(f"Downloading CC-CEDICT from {URL} ...", file=sys.stderr)
    req = urllib.request.Request(
        URL, headers={"User-Agent": "shijie-app/0.1 (+https://example.com)"}
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read()
    print(f"  downloaded {len(raw):,} bytes; decompressing...", file=sys.stderr)
    with gzip.GzipFile(fileobj=io.BytesIO(raw)) as gz:
        data = gz.read()
    DEST.write_bytes(data)
    print(f"  wrote {DEST} ({len(data):,} bytes)", file=sys.stderr)
    return DEST


if __name__ == "__main__":
    download()
