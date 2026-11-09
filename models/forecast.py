"""Forecasting models.

Two honest paths:
- RidgeRollout (default): closed-form ridge on lag features, autoregressive rollout,
  residual-based p10/p50/p90 bands. Trains in seconds, runs offline.
- LSTMForecaster (optional, PyTorch): sequence model with quantile head; see
  models/train.py --torch and notebooks/02_train_forecast.ipynb (free Colab GPU).
- LinearTrendSeasonal: transparent fallback used when no trained artifact exists —
  Theil–Sen trend + monthly climatology, residual-inflated bands.
"""
from __future__ import annotations

import math
from datetime import date

import numpy as np

from pipeline.clean import monthly_climatology, fill_missing_linear
from pipeline.build_features import time_features
from engine.trends import theil_sen_slope


def future_dates(last_date: str, horizon_months: int) -> list[str]:
    y, m = int(last_date[:4]), int(last_date[5:7])
    out = []
    for _ in range(horizon_months):
        m += 1
        if m > 12:
            m = 1
            y += 1
        out.append(f"{y:04d}-{m:02d}")
    return out


# ---------------------------------------------------------------- Ridge rollout
class RidgeRollout:
    """Predict next month (all parameters jointly) from a flattened lag window."""

    def __init__(self, lam: float = 1e-2):
        self.lam = lam
        self.W: np.ndarray | None = None       # (1 + n_features, n_targets)
        self.x_mean: np.ndarray | None = None
        self.x_std: np.ndarray | None = None
        self.y_mean: np.ndarray | None = None
        self.y_std: np.ndarray | None = None
        self.resid_std: np.ndarray | None = None  # per target, 1-step residual (raw units)

    def fit(self, X: np.ndarray, Y: np.ndarray) -> "RidgeRollout":
        X = np.asarray(X, dtype=np.float64)
        Y = np.asarray(Y, dtype=np.float64)
        if X.ndim != 2 or Y.ndim != 2 or X.shape[0] != Y.shape[0]:
            raise ValueError(f"fit expects 2-D X/Y with equal rows, got {X.shape} and {Y.shape}")
        # Fail loudly instead of silently fitting NaNs: one NaN propagates through
        # the means/gram matrix and poisons every prediction and band.
        if not np.isfinite(X).all() or not np.isfinite(Y).all():
            raise ValueError(
                "RidgeRollout.fit received non-finite values; impute or drop them "
                "(pipeline.clean.fill_missing_linear) before training."
            )
        # standardize features and targets
        self.x_mean = X.mean(axis=0)
        self.x_std = X.std(axis=0)
        self.x_std = np.where(self.x_std == 0, 1.0, self.x_std)
        Xs = (X - self.x_mean) / self.x_std
        self.y_mean = Y.mean(axis=0)
        self.y_std = Y.std(axis=0)
        self.y_std = np.where(self.y_std == 0, 1.0, self.y_std)
        Ys = (Y - self.y_mean) / self.y_std
        A = np.column_stack([np.ones(len(Xs)), Xs])
        gram = A.T @ A + self.lam * np.eye(A.shape[1])
        gram[0, 0] -= self.lam  # don't regularize the intercept
        self.W = np.linalg.solve(gram, A.T @ Ys)
        # residuals in raw units (1-step)
        pred = np.column_stack([np.ones(len(Xs)), Xs]) @ self.W
        resid = (pred - Ys) * self.y_std
        self.resid_std = resid.std(axis=0)
        return self

    def predict_next(self, window_flat: np.ndarray) -> np.ndarray:
        assert self.W is not None and self.x_mean is not None
        xs = (window_flat - self.x_mean) / self.x_std
        a = np.concatenate([[1.0], xs])
        ys = a @ self.W
        return ys * self.y_std + self.y_mean

    def rollout(self, init_window: np.ndarray, horizon: int) -> np.ndarray:
        """Autoregressive rollout. init_window: (seq_len, n_targets) → returns (horizon, n_targets)."""
        window = init_window.copy().astype(np.float64)
        out = []
        for _ in range(horizon):
            flat = window.reshape(-1)
            nxt = self.predict_next(flat)
            out.append(nxt)
            window = np.vstack([window[1:], nxt.reshape(1, -1)])
        return np.array(out)

    def save(self, path) -> None:
        np.savez(
            path,
            W=self.W,
            x_mean=self.x_mean,
            x_std=self.x_std,
            y_mean=self.y_mean,
            y_std=self.y_std,
            resid_std=self.resid_std,
            lam=np.array([self.lam]),
        )

    @classmethod
    def load(cls, path) -> "RidgeRollout":
        z = np.load(path)
        m = cls(lam=float(z["lam"][0]))
        m.W, m.x_mean, m.x_std = z["W"], z["x_mean"], z["x_std"]
        m.y_mean, m.y_std, m.resid_std = z["y_mean"], z["y_std"], z["resid_std"]
        return m


def make_windows(X: np.ndarray, seq_len: int) -> tuple[np.ndarray, np.ndarray]:
    """X: (T, F) → windows (T-seq_len, seq_len*F), targets (T-seq_len, F)."""
    T, F = X.shape
    xs, ys = [], []
    for t in range(T - seq_len):
        xs.append(X[t:t + seq_len].reshape(-1))
        ys.append(X[t + seq_len])
    return np.array(xs), np.array(ys)


# ------------------------------------------------------- Linear trend + season
def ridge_bands(mean: np.ndarray, resid_std: np.ndarray, step_index: int) -> tuple[np.ndarray, np.ndarray]:
    scale = 1.645 * resid_std * math.sqrt(step_index + 1)
    return mean - scale, mean + scale


def linear_trend_seasonal_forecast(series: np.ndarray, dates: list[str], horizon: int) -> dict:
    """Transparent baseline: Theil–Sen trend + monthly climatology of residuals."""
    y = fill_missing_linear(series)
    slope, intercept = theil_sen_slope(y)          # per month
    n = len(y)
    trend_fitted = slope * np.arange(n) + intercept
    anomaly = y - trend_fitted
    clim = monthly_climatology(list(dates), anomaly)          # (12,)
    resid = anomaly - clim[np.array([int(d.split("-")[1]) - 1 for d in dates])]
    sigma = float(resid.std()) if resid.size else 0.0
    x_future = np.arange(n, n + horizon)
    months_future = []
    y_, m_ = int(dates[-1][:4]), int(dates[-1][5:7])
    for _ in range(horizon):
        m_ += 1
        if m_ > 12:
            m_ = 1
            y_ += 1
        months_future.append(m_ - 1)
    mean = slope * x_future + intercept + clim[np.array(months_future)]
    spread = 1.645 * sigma * np.sqrt(np.arange(1, horizon + 1))
    return {
        "mean": mean.tolist(),
        "lower": (mean - spread).tolist(),
        "upper": (mean + spread).tolist(),
        "model": "linear_trend_seasonal",
        "slope_per_month": float(slope),
        "resid_sigma": sigma,
    }


# ------------------------------------------------------------- LSTM (optional)
class LSTMForecaster:  # pragma: no cover - requires torch + trained weights
    def __init__(self, n_features: int, hidden: int = 64, layers: int = 2,
                 dropout: float = 0.15, quantiles=(0.1, 0.5, 0.9)):
        try:
            import torch
            import torch.nn as nn
        except ImportError as exc:
            raise RuntimeError("PyTorch not installed. pip install torch --index-url https://download.pytorch.org/whl/cpu") from exc
        self.torch = torch
        self.quantiles = quantiles

        class _Net(nn.Module):
            def __init__(self):
                super().__init__()
                self.lstm = nn.LSTM(n_features, hidden, layers, batch_first=True, dropout=dropout)
                self.head = nn.Linear(hidden, n_features * len(quantiles))

            def forward(self, x):
                out, _ = self.lstm(x)
                return self.head(out[:, -1, :]).view(x.size(0), len(quantiles), n_features)

        self.net = _Net()

    def predict_next(self, window):
        import torch
        with torch.no_grad():
            out = self.net(torch.tensor(window, dtype=torch.float32).unsqueeze(0))
        return out.squeeze(0).numpy()  # (n_quantiles, n_features)
