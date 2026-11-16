#!/usr/bin/env python3
"""Build the RAG knowledge base: `data/rag/kb.json`.

Usage:
  python3 scripts/build_rag_kb.py                 # build data/rag/kb.json
  python3 scripts/build_rag_kb.py --sync-space    # also copy kb.json + rag_core.py into hf-space/
  python3 scripts/build_rag_kb.py --out /tmp/kb.json
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default=str(REPO_ROOT / "data" / "rag" / "kb.json"))
    parser.add_argument("--sync-space", action="store_true",
                        help="copy kb.json and api/services/rag_core.py into hf-space/")
    args = parser.parse_args()

    from api.services.rag_kb import build_kb  # imported lazily so --help works without deps

    kb = build_kb()
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(kb, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {out} — {len(kb['chunks'])} chunks from {len(kb['sources'])} sources")

    if args.sync_space:
        space = REPO_ROOT / "hf-space"
        if not space.is_dir():
            raise SystemExit("hf-space/ does not exist; create it first")
        shutil.copyfile(out, space / "kb.json")
        shutil.copyfile(REPO_ROOT / "api" / "services" / "rag_core.py", space / "rag_core.py")
        print(f"synced kb.json and rag_core.py into {space}")


if __name__ == "__main__":
    main()
