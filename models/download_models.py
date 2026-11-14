"""Download/upload model weights from Hugging Face Hub (free).

Usage:
  python3 models/download_models.py             # pull artifact into models/artifacts/
  python3 models/download_models.py --push      # upload local artifact to EP_MODEL_REPO

Set EP_MODEL_REPO=<user>/<repo> and (for push) HF_TOKEN. If the Hub is unreachable the
script exits non-zero with instructions; the API still works via the linear baseline.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS = REPO_ROOT / "models" / "artifacts"
FILENAME = "forecaster.npz"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()

    repo = os.environ.get("EP_MODEL_REPO")
    token = os.environ.get("HF_TOKEN")
    if not repo:
        print("[models] EP_MODEL_REPO not set (expected <user>/<repo>). See docs/deploy.md §4.")
        return 2
    try:
        from huggingface_hub import hf_hub_download, upload_file
    except ImportError:
        print("[models] huggingface_hub not installed. pip install huggingface_hub")
        return 2

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    if args.push:
        src = ARTIFACTS / FILENAME
        if not src.exists():
            print(f"[models] nothing to push: {src} missing (run models/train.py first)")
            return 2
        url = upload_file(path_or_fileobj=str(src), path_in_repo=FILENAME, repo_id=repo, token=token)
        print(f"[models] pushed -> {url}")
        return 0

    dest = hf_hub_download(repo_id=repo, filename=FILENAME, token=token,
                           local_dir=str(ARTIFACTS))
    print(f"[models] downloaded -> {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
