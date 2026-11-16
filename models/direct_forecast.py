"""Direct multi-horizon ridge regression, one model PER VARIABLE PER HORIZON.

Avoids the error compounding of autoregressive rollouts. Features: flattened
24-month lag window of ALL usable variables + sin/cos of month + rolling
3- and 12-month means of the target variable. Lambda is chosen per variable by
time-series cross-validation on the last `cv_months` of the training data.
"""
from __future__ import annotations

import numpy as np

from pipeline.clean import fill_missing_linear

SEQ_LEN = 24
LAM_GRID = (1e-2, 1e-1, 1.0, 10.0, 100.0)


def build_windows(matrix: np.ndarray, seq_len: int = SEQ_LEN):
    """matrix: (T, F) — interior-filled values + time sin/cos appended by caller.

    Returns (X, Y) where X is (T-seq, seq*F + 2) and Y is (T-seq, F) — next step.
    For direct multi-horizon we instead return X and the index mapping so the
    caller can slice horizon h.
    """
    T, F = matrix.shape
    t = np.arange(T)
    sin_m = np.sin(2 * np.pi * t / 12.0)
    cos_m = np.cos(2 * np.pi * t / 12.0)
    xs = []
    for i in range(T - seq_len):
        window = matrix[i:i + seq_len]
        roll3 = window[-3:].mean(axis=0)
        roll12 = window.mean(axis=0)
        xs.append(np.concatenate([window.reshape(-1), roll3, roll12, [sin_m[i + seq_len - 1], cos_m[i + seq_len - 1]]]))
    X = np.array(xs)
    idx = np.arange(T - seq_len)
    return X, idx, matrix


def _fit_ridge(X, y, lam):
    x_mean = X.mean(axis=0); x_std = X.std(axis=0)
    x_std = np.where(x_std == 0, 1.0, x_std)
    Xs = (X - x_mean) / x_std
    A = np.column_stack([np.ones(len(Xs)), Xs])
    gram = A.T @ A + lam * np.eye(A.shape[1])
    gram[0, 0] -= lam
    W = np.linalg.solve(gram, A.T @ y)
    return W, x_mean, x_std


class DirectRidge:
    """One ridge per (variable, horizon). Unusable variables are skipped."""

    def __init__(self, horizon: int = 60, lam_grid=LAM_GRID, cv_months: int = 24, seq_len: int = SEQ_LEN):
        self.horizon = horizon
        self.lam_grid = lam_grid
        self.cv_months = cv_months
        self.seq_len = seq_len
        self.models: dict[tuple[str, int], tuple[np.ndarray, np.ndarray, np.ndarray, float]] = {}
        self.variables: list[str] = []
        self.source_matrix: np.ndarray | None = None

    def fit(self, matrix: np.ndarray, variables: list[str]) -> "DirectRidge":
        """matrix: (T, F) — already interior-filled. variables: column names."""
        self.variables = list(variables)
        X, idx, mat = build_windows(np.asarray(matrix, dtype=np.float64), self.seq_len)
        self.source_matrix = mat
        T = mat.shape[0]
        for fi, var in enumerate(self.variables):
            for h in range(1, self.horizon + 1):
                target_idx = idx + self.seq_len + h - 1  # predict value at absolute position
                valid = target_idx < T
                if valid.sum() < 30:
                    continue
                Xh, yh = X[valid], mat[target_idx[valid], fi]
                # drop remaining non-finite rows (shouldn't happen post-fill)
                finite = np.isfinite(yh)
                Xh, yh = Xh[finite], yh[finite]
                if len(yh) < 30:
                    continue
                best = self._fit_lam(Xh, yh)
                self.models[(var, h)] = best
        return self

    def _fit_lam(self, X, y):
        n = len(y)
        split = n - self.cv_months
        best = None
        best_err = np.inf
        for lam in self.lam_grid:
            W, x_mean, x_std = _fit_ridge(X[:split], y[:split], lam)
            preds = (np.column_stack([np.ones(len(X[split:])), (X[split:] - x_mean) / x_std]) @ W)
            err = float(np.mean((preds - y[split:]) ** 2))
            if err < best_err:
                best_err = err
                best = (W, x_mean, x_std, lam)
        return best

    def predict(self, matrix: np.ndarray) -> dict[str, list[float]]:
        """matrix: the FULL historical matrix (will use the last seq_len rows)."""
        out: dict[str, list[float]] = {v: [] for v in self.variables}
        mat = np.asarray(matrix, dtype=np.float64)
        t = np.arange(mat.shape[0])
        sin_m = np.sin(2 * np.pi * (mat.shape[0] - 1) / 12.0)
        cos_m = np.cos(2 * np.pi * (mat.shape[0] - 1) / 12.0)
        window = mat[-self.seq_len:]
        roll3 = window[-3:].mean(axis=0)
        roll12 = window.mean(axis=0)
        feat = np.concatenate([window.reshape(-1), roll3, roll12, [sin_m, cos_m]])
        for fi, var in enumerate(self.variables):
            for h in range(1, self.horizon + 1):
                key = (var, h)
                if key not in self.models:
                    out[var].append(np.nan)
                    continue
                W, x_mean, x_std, _ = self.models[key]
                xs = np.concatenate([[1.0], (feat - x_mean) / x_std])
                out[var].append(float(xs @ W))
        return out

    def save(self, path) -> None:
        parts: dict[str, np.ndarray] = {}
        for (var, h), (W, x_mean, x_std, lam) in self.models.items():
            parts[f"W__{var}__{h}"] = W
            parts[f"x_mean__{var}__{h}"] = x_mean
            parts[f"x_std__{var}__{h}"] = x_std
            parts[f"lam__{var}__{h}"] = np.array([lam])
        parts["variables"] = np.array(self.variables)
        np.savez(path, **parts)

    @classmethod
    def load(cls, path, horizon: int = 60, seq_len: int = SEQ_LEN) -> "DirectRidge":
        m = cls(horizon=horizon, seq_len=seq_len)
        with np.load(path, allow_pickle=False) as z:
            m.variables = [str(v) for v in z["variables"]]
            keys = set(z.files)
            for var in m.variables:
                for h in range(1, horizon + 1):
                    if f"W__{var}__{h}" in keys:
                        m.models[(var, h)] = (z[f"W__{var}__{h}"], z[f"x_mean__{var}__{h}"],
                                               z[f"x_std__{var}__{h}"], float(z[f"lam__{var}__{h}"][0]))
        return m
