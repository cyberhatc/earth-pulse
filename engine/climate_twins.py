"""Climate twins: cluster grid cells with similar multivariate climate signatures.

Standalone NumPy K-Means (seeded, deterministic). HDBSCAN is optional via config.
"""
from __future__ import annotations

import numpy as np


def zscore(X: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    mean = X.mean(axis=0, keepdims=True)
    std = X.std(axis=0, keepdims=True)
    std = np.where(std == 0, 1.0, std)
    return (X - mean) / std, mean, std


def kmeans(X: np.ndarray, k: int = 8, iters: int = 100, seed: int = 42):
    rng = np.random.default_rng(seed)
    n = X.shape[0]
    k = min(k, n)
    # k-means++ style init: first center uniform, rest farthest-point greedy
    centers = [X[rng.integers(n)]]
    for _ in range(k - 1):
        d2 = np.min(((X[:, None, :] - np.array(centers)[None, :, :]) ** 2).sum(-1), axis=1)
        centers.append(X[np.argmax(d2)])
    C = np.array(centers)
    labels = np.zeros(n, dtype=np.int64)
    for _ in range(iters):
        d = ((X[:, None, :] - C[None, :, :]) ** 2).sum(-1)
        new_labels = d.argmin(axis=1)
        new_C = C.copy()
        for j in range(k):
            sel = new_labels == j
            if sel.any():
                new_C[j] = X[sel].mean(axis=0)
            else:
                new_C[j] = X[rng.integers(n)]  # re-seed empty cluster
        if np.array_equal(new_labels, labels) and np.allclose(new_C, C):
            labels, C = new_labels, new_C
            break
        labels, C = new_labels, new_C
    return labels, C


def cluster_cells(feature_matrix: np.ndarray, k: int = 8, seed: int = 42):
    """feature_matrix: (n_cells, n_features) → (labels, standardized, centers)."""
    Xs, mean, std = zscore(feature_matrix)
    labels, centers = kmeans(Xs, k=k, seed=seed)
    return labels, Xs, centers, {"mean": mean.ravel().tolist(), "std": std.ravel().tolist()}
