"""Anomaly detection: rolling robust z-score (MAD-based) + optional Isolation Forest."""
from __future__ import annotations

import numpy as np

from pipeline.clean import fill_missing_linear, rolling_median, rolling_mad


def rolling_robust_z(series: np.ndarray, window: int = 61, threshold: float = 3.5) -> list[dict]:
    y = fill_missing_linear(series)
    med = rolling_median(y, window)
    mad = rolling_mad(y, window) * 1.4826  # consistent with std under normality
    mad = np.where(mad == 0, 1e-6, mad)
    z = (y - med) / mad
    out = []
    half = window // 2
    for i in range(len(y)):
        if not np.isfinite(z[i]):
            continue
        if abs(z[i]) >= threshold:
            out.append({
                "index": i,
                "z": float(z[i]),
                "severity": "high" if abs(z[i]) >= threshold + 1.5 else "moderate",
                "kind": "high" if z[i] > 0 else "low",
            })
    return out


def anomalies_for_cell(store: dict, cell: int, variables=None,
                       window: int = 61, threshold: float = 3.5) -> list[dict]:
    variables = variables or ["temperature", "precipitation", "ndvi", "wind", "humidity"]
    dates = list(store["dates"])
    results = []
    for var in variables:
        for flag in rolling_robust_z(store[var][:, cell], window, threshold):
            flag = dict(flag)
            flag["parameter"] = var
            flag["date"] = dates[flag.pop("index")]
            results.append(flag)
    results.sort(key=lambda r: r["date"])
    return results


def isolation_forest_flags(X: np.ndarray, contamination: float = 0.02):  # pragma: no cover
    """Optional multivariate flags. Returns integer label per row (-1 = anomaly)."""
    try:
        from sklearn.ensemble import IsolationForest
    except ImportError as exc:
        raise RuntimeError("scikit-learn not installed. pip install scikit-learn") from exc
    clf = IsolationForest(contamination=contamination, random_state=42)
    return clf.fit_predict(X)
