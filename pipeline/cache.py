"""Tiny file cache for Tier B fetches (data/cache/).

Usage:
    from pipeline.cache import cached_json
    data = cached_json("power:12.97,77.59", ttl_seconds=3600,
                       producer=lambda: fetch_power_point(12.97, 77.59))

Files: data/cache/<slug>.json  with {"cached_at": epoch, "payload": ...}
Delete data/cache/ to flush. Cache is intentionally simple; swap for Redis later.
"""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Callable

CACHE_DIR = Path(__file__).resolve().parent.parent / "data" / "cache"


def _slug(key: str) -> str:
    return hashlib.sha1(key.encode()).hexdigest()[:16] + "_" + "".join(c if c.isalnum() else "_" for c in key[:48])


def cached_json(key: str, ttl_seconds: int, producer: Callable[[], dict]) -> dict:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    fp = CACHE_DIR / f"{_slug(key)}.json"
    if fp.exists():
        try:
            body = json.loads(fp.read_text(encoding="utf-8"))
            if time.time() - body.get("cached_at", 0) < ttl_seconds:
                body["payload"]["_cache"] = "hit"
                return body["payload"]
        except Exception:
            pass  # corrupt cache entry -> refetch
    payload = producer()
    try:
        fp.write_text(json.dumps({"cached_at": time.time(), "payload": payload}), encoding="utf-8")
    except Exception:
        pass  # cache write failure never breaks the request
    payload["_cache"] = "miss"
    return payload
