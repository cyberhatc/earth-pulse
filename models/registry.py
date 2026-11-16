"""Model registry: artifacts versioned with provenance metadata.

Layout: models/artifacts/<name>/<version>/
    weights.npz + meta.json (git commit, store manifest hash, config, metrics, calibrated coverage).

Selection: API/inference loads the default artifact for the active store by
metrics pinball loss on the validation fold (best-by-backtest), falling back
to the transparent linear-trend baseline if the artifact is missing.
"""
from __future__ import annotations

import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ARTIFACT_ROOT = REPO_ROOT / "models" / "artifacts"


def git_commit() -> str | None:
    try:
        out = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=REPO_ROOT, timeout=10)
        return out.decode("utf-8").strip()
    except Exception:
        return None


def manifest_hash(manifest_path: Path | None = None) -> str | None:
    import hashlib
    fp = manifest_path or (REPO_ROOT / "data" / "processed" / "manifest.json")
    if not fp.exists():
        return None
    return hashlib.sha256(fp.read_bytes()).hexdigest()[:16]


def save_artifact(name: str, version: str, weights: dict, meta: dict) -> Path:
    """weights: dict[str, np.ndarray] -> weights.npz; meta augmented with provenance."""
    import numpy as np
    d = ARTIFACT_ROOT / name / version
    d.mkdir(parents=True, exist_ok=True)
    np.savez(d / "weights.npz", **weights)
    meta = {
        **meta,
        "name": name,
        "version": version,
        "git_commit": git_commit(),
        "data_manifest_hash": manifest_hash(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    (d / "meta.json").write_text(json.dumps(meta, indent=2, default=str), encoding="utf-8")
    return d


def load_artifact(name: str, version: str | None = None) -> tuple[dict, dict] | None:
    """If version is None, pick the newest (sorted) directory."""
    import numpy as np
    base = ARTIFACT_ROOT / name
    if not base.exists():
        return None
    versions = sorted([d for d in base.iterdir() if d.is_dir()])
    if not versions:
        return None
    d = base / version if version else versions[-1]
    weights_path, meta_path = d / "weights.npz", d / "meta.json"
    if not (weights_path.exists() and meta_path.exists()):
        return None
    with np.load(weights_path, allow_pickle=False) as z:
        weights = {k: z[k] for k in z.files}
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    return weights, meta
