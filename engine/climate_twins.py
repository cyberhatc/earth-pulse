"""Climate twins: cluster grid cells with similar multivariate climate signatures.

Standalone NumPy K-Means (seeded, deterministic). HDBSCAN is optional via config.
"""
from __future__ import annotations

import numpy as np


def zscore(X: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    X = np.asarray(X, dtype=np.float64)
    col_mean = np.nanmean(X, axis=0, keepdims=True)
    col_mean = np.where(np.isfinite(col_mean), col_mean, 0.0)
    # fill any residual NaN/inf so clustering can never emit NaN distances
    X = np.where(np.isfinite(X), X, col_mean)
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


def _hdbscan_labels(Xs, min_cluster_size=10):
    try:
        import hdbscan
    except ImportError:
        return None
    clusterer = hdbscan.HDBSCAN(min_cluster_size=min_cluster_size)
    return clusterer.fit_predict(Xs)


def cluster_cells(feature_matrix, k: int = 8, seed: int = 42, algorithm: str = 'kmeans'):
    Xs, mean, std = zscore(feature_matrix)
    if algorithm == 'hdbscan':
        labels = _hdbscan_labels(Xs, min_cluster_size=min(10, max(5, len(Xs) // 5)))
        if labels is not None:
            mapped = np.array([l if l != -1 else -1 for l in labels], dtype=np.int64)
            # remap noise (-1) to its own cluster id per cell order
            noise_idx = np.where(mapped == -1)[0]
            mapped[noise_idx] = len(set(mapped)) + np.arange(len(noise_idx))
            centers = np.array([Xs[mapped == i].mean(axis=0) for i in range(mapped.max() + 1)])
            return mapped, Xs, centers, {'mean': mean.ravel().tolist(), 'std': std.ravel().tolist(),
                                          'algorithm': 'hdbscan', 'noise_labels': int((labels == -1).sum())}
    labels, centers = kmeans(Xs, k=k, seed=seed)
    return labels, Xs, centers, {'mean': mean.ravel().tolist(), 'std': std.ravel().tolist(), 'algorithm': 'kmeans'}
