"""Load test for the Earth Pulse API (scripts/load_test.py).

Hits a running API with N requests, then reports min/p50/p95/p99/max latency.
Usage:
  uvicorn api.main:app --port 8000 &
  python scripts/load_test.py --url http://localhost:8000 --path "/place?lat=12.97&lon=77.59" --n 200 --concurrency 10
  python scripts/load_test.py --url http://localhost:8000 --path /health --n 200

Note: the API rate-limits per IP (default 120 req/min). For benchmark runs,
start the server with EP_RATE_LIMIT_PER_MIN=0 to disable it, otherwise bursts
above 120 requests will see 429s (this is the limiter working, not a bug).
"""
from __future__ import annotations

import argparse
import statistics
import time

import httpx


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:8000")
    ap.add_argument("--path", default="/health")
    ap.add_argument("--n", type=int, default=200)
    ap.add_argument("--concurrency", type=int, default=10)
    ap.add_argument("--timeout", type=float, default=60.0)
    args = ap.parse_args()

    url = args.url.rstrip("/") + args.path
    latencies: list[float] = []
    errors = 0
    start = time.time()
    with httpx.Client(timeout=args.timeout, limits=httpx.Limits(max_connections=args.concurrency * 2)) as client:
        from concurrent.futures import ThreadPoolExecutor

        def _one(_):
            t0 = time.time()
            try:
                r = client.get(url)
                return (time.time() - t0) * 1000.0, r.status_code
            except Exception:
                return (time.time() - t0) * 1000.0, 0

        with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
            for elapsed, status in pool.map(_one, range(args.n)):
                latencies.append(elapsed)
                if status and 200 <= status < 400:
                    pass
                else:
                    errors += 1
    total_s = time.time() - start

    latencies.sort()
    def pct(p: float) -> float:
        idx = min(len(latencies) - 1, max(0, int(round((p / 100.0) * (len(latencies) - 1)))))
        return latencies[idx]

    print(f"url: {url}")
    print(f"requests: {args.n}  errors: {errors}  wall: {total_s:.1f}s  rps: {args.n / total_s:.1f}")
    print(f"min {latencies[0]:.0f}ms  p50 {pct(50):.0f}ms  p90 {pct(90):.0f}ms  p95 {pct(95):.0f}ms  p99 {pct(99):.0f}ms  max {latencies[-1]:.0f}ms")
    print(f"mean {statistics.fmean(latencies):.0f}ms  median {statistics.median(latencies):.0f}ms")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
