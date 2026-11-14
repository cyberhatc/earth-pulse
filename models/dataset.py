"""Supervised windowing for model training."""
from __future__ import annotations

import numpy as np


def make_supervised(X: np.ndarray, seq_len: int) -> tuple[np.ndarray, np.ndarray]:
    """X: (T, F) -> (samples, seq_len*F), (samples, F) of next-step targets."""
    T, F = X.shape
    xs, ys = [], []
    for t in range(T - seq_len):
        xs.append(X[t:t + seq_len].reshape(-1))
        ys.append(X[t + seq_len])
    return np.array(xs), np.array(ys)


def time_split(n_samples: int, val_fraction: float = 0.15) -> tuple[slice, slice]:
    cut = max(1, int(n_samples * (1.0 - val_fraction)))
    return slice(0, cut), slice(cut, n_samples)


def scale_fit(X: np.ndarray):
    mean = X.mean(axis=0)
    std = X.std(axis=0)
    std = np.where(std == 0, 1.0, std)
    return mean, std
