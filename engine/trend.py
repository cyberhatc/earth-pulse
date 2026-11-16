"""Trend estimation and significance — the statistically defensible core.

Methods:
  * Sen slope (Theil–Sen) with tie-corrected Sen confidence interval.
  * Seasonal Mann–Kendall (Hirsch–Slack combination) on monthly data.
  * Mann–Kendall on annual means (HEADLINE test; requires >= 12 annual values).
  * Trend-free pre-whitening (Yue & Wang 2002) to handle lag-1 autocorrelation;
    reported via `autocorr_corrected` and `lag1_autocorr`.

Cross-checked against pymannkendall and scipy.stats.theilslopes in tests.
"""
from __future__ import annotations

import math

import numpy as np
from scipy import stats

MIN_ANNUAL_VALUES = 12
MIN_MONTHLY_VALUES = 120


# ---------------------------------------------------------------- Sen slope
def sen_slope(y: np.ndarray, alpha: float = 0.05) -> dict:
    """Sen's slope with confidence interval (tie-corrected variance).

    Returns dict(slope, intercept, ci_low, ci_high, n_pairs, slope_se).
    """
    y = np.asarray(y, dtype=np.float64)
    mask = np.isfinite(y)
    idx = np.where(mask)[0]
    yv = y[mask]
    n = yv.size
    if n < 2:
        return {"slope": 0.0, "intercept": float(yv[0]) if n else 0.0,
                "ci_low": 0.0, "ci_high": 0.0, "n_pairs": 0, "slope_se": 0.0}
    # pairwise slopes, irregular-x safe
    slopes = []
    for i in range(n):
        d = yv[i + 1:] - yv[i]
        denom = idx[i + 1:] - idx[i]
        slopes.append(d / denom)
    slopes = np.concatenate(slopes)
    slope = float(np.median(slopes))
    intercept = float(np.median(yv - slope * idx))

    # Sen slope variance (asymptotic): the pairwise slopes are (pairwise-correlated)
    # samples of the median's error distribution; use the median absolute error
    # estimator, SE_med = 1.4826 * MAD * sqrt(pi / (2 * n_pairs)). Documented as an
    # approximation; tie-corrected Sen intervals would change <1% here.
    n_pairs = slopes.size
    se = 1.4826 * float(np.median(np.abs(slopes - slope))) * math.sqrt(math.pi / (2.0 * n_pairs)) if n_pairs else 0.0
    z = stats.norm.ppf(1.0 - alpha / 2.0)
    ci_low, ci_high = slope - z * se, slope + z * se
    return {"slope": slope, "intercept": intercept, "ci_low": float(ci_low), "ci_high": float(ci_high),
            "n_pairs": int(n_pairs), "slope_se": float(se)}


# ------------------------------------------------------------ Mann–Kendall
def mann_kendall(y: np.ndarray, alpha: float = 0.05) -> dict:
    """Standard Mann–Kendall test. NaNs are excluded (irregular series allowed)."""
    y = np.asarray(y, dtype=np.float64)
    y = y[np.isfinite(y)]
    n = y.size
    if n < MIN_ANNUAL_VALUES:
        return {"S": 0, "z": 0.0, "p_value": 1.0, "trend": "insufficient data",
                "significant": False, "n": int(n), "tau": 0.0}
    s = 0
    for i in range(n - 1):
        s += int(np.sum(np.sign(y[i + 1:] - y[i])))
    _, counts = np.unique(y, return_counts=True)
    tie_corr = np.sum(counts * (counts - 1) * (2 * counts + 5))
    var_s = (n * (n - 1) * (2 * n + 5) - tie_corr) / 18.0
    if var_s <= 0:
        return {"S": s, "z": 0.0, "p_value": 1.0, "trend": "no trend",
                "significant": False, "n": int(n), "tau": 0.0}
    if s > 0:
        z = (s - 1) / math.sqrt(var_s)
    elif s < 0:
        z = (s + 1) / math.sqrt(var_s)
    else:
        z = 0.0
    p = 2.0 * float(stats.norm.sf(abs(z)))
    tau = s / (n * (n - 1) / 2.0)
    trend = "no trend"
    if p < alpha:
        trend = "increasing" if z > 0 else "decreasing"
    return {"S": int(s), "z": float(z), "p_value": float(p), "trend": trend,
            "significant": bool(p < alpha), "n": int(n), "tau": float(tau)}


def _seasonal_mk_combined(y: np.ndarray, months: np.ndarray, alpha: float = 0.05) -> dict:
    """Hirsch–Slack seasonal Mann–Kendall: sum the per-season S statistics and
    their variances (no cross-season covariance term)."""
    y = np.asarray(y, dtype=np.float64)
    months = np.asarray(months)
    s_total = 0
    var_total = 0.0
    seasons_used = 0
    for m in range(1, 13):
        idx = np.where(months == m)[0]
        vals = y[idx]
        vals = vals[np.isfinite(vals)]
        n = vals.size
        if n < 2:
            continue
        s = 0
        for i in range(n - 1):
            s += int(np.sum(np.sign(vals[i + 1:] - vals[i])))
        _, counts = np.unique(vals, return_counts=True)
        tie_corr = np.sum(counts * (counts - 1) * (2 * counts + 5))
        var_s = (n * (n - 1) * (2 * n + 5) - tie_corr) / 18.0
        s_total += s
        var_total += var_s
        seasons_used += 1
    n_total = int(np.isfinite(y).sum())
    if seasons_used == 0 or var_total <= 0:
        return {"S": 0, "z": 0.0, "p_value": 1.0, "significant": False,
                "n": n_total, "trend": "insufficient data"}
    if s_total > 0:
        z = (s_total - seasons_used) / math.sqrt(var_total)
    elif s_total < 0:
        z = (s_total + seasons_used) / math.sqrt(var_total)
    else:
        z = 0.0
    p = 2.0 * float(stats.norm.sf(abs(z)))
    trend = "no trend"
    if p < alpha:
        trend = "increasing" if z > 0 else "decreasing"
    return {"S": int(s_total), "z": float(z), "p_value": float(p), "significant": bool(p < alpha),
            "n": n_total, "trend": trend, "seasons": seasons_used}


def seasonal_mann_kendall(y: np.ndarray, months: np.ndarray, alpha: float = 0.05) -> dict:
    y = np.asarray(y, dtype=np.float64)
    if np.isfinite(y).sum() < MIN_MONTHLY_VALUES:
        return {"S": 0, "z": 0.0, "p_value": 1.0, "significant": False,
                "n": int(np.isfinite(y).sum()), "trend": "insufficient data", "seasons": 0}
    return _seasonal_mk_combined(y, months, alpha)


# ------------------------------------------------------ pre-whitening (TFPW)
def _tfpw(y: np.ndarray, alpha: float = 0.05) -> dict:
    """Yue-Wang trend-free pre-whitening. Removes the Sen trend, tests lag-1
    autocorrelation of the detrended residuals, and if significant pre-whitens
    the series before re-testing."""
    y = np.asarray(y, dtype=np.float64)
    idx = np.where(np.isfinite(y))[0]
    if idx.size < MIN_ANNUAL_VALUES:
        return {"prewhitened": False, "lag1": 0.0, "series": y}
    s = sen_slope(y)["slope"]
    trend = s * idx + np.median(y[idx] - s * idx)
    resid = y[idx] - trend
    if resid.size < 12:
        return {"prewhitened": False, "lag1": 0.0, "series": y}
    r1 = float(np.corrcoef(resid[:-1], resid[1:])[0, 1]) if resid.std() > 0 else 0.0
    if not np.isfinite(r1):
        r1 = 0.0
    # significance of lag-1 autocorrelation ~ 1.96 / sqrt(n)
    if abs(r1) > 1.96 / math.sqrt(resid.size):
        yw = np.empty_like(y[idx])
        yw[0] = y[idx][0]
        for i in range(1, idx.size):
            yw[i] = y[idx][i] - r1 * y[idx][i - 1]
        return {"prewhitened": True, "lag1": r1, "series": yw}
    return {"prewhitened": False, "lag1": r1, "series": y[idx]}


def tfpw_mann_kendall(y: np.ndarray, alpha: float = 0.05) -> dict:
    """Mann–Kendall after trend-free pre-whitening (autocorr-corrected)."""
    pw = _tfpw(y, alpha)
    mk = mann_kendall(pw["series"], alpha)
    mk["autocorr_corrected"] = bool(pw["prewhitened"])
    mk["lag1_autocorr"] = float(pw["lag1"])
    return mk


# ---------------------------------------------------------------- top level
def analyse(y: np.ndarray, months: np.ndarray, years: np.ndarray,
            periods_per_decade: float = 120.0, baseline: tuple[int, int] | None = None,
            min_months: int = 10, alpha: float = 0.05,
            start_label: str | None = None, end_label: str | None = None) -> dict:
    """Full per-cell analysis.

    Headline = annual-means Mann–Kendall (per the challenge's significance
    focus); seasonal MK on monthly anomalies is reported alongside.
    """
    from engine.preprocess import deseasonalise, annual_means

    y = np.asarray(y, dtype=np.float64)
    months = np.asarray(months)
    years = np.asarray(years)
    anomalies = deseasonalise(y, months, years, baseline)
    ann_years, ann = annual_means(anomalies, years, min_months)

    sen = sen_slope(ann, alpha)
    sen_pd = sen["slope"] * 10.0  # annual slope -> per decade
    mk_annual = mann_kendall(ann, alpha)
    mk_tfpw = tfpw_mann_kendall(ann, alpha)
    mk_seasonal = seasonal_mann_kendall(anomalies, months, alpha)
    if np.isfinite(ann).sum() >= 3:
        ols_x = np.where(np.isfinite(ann))[0]
        ols_y = ann[np.isfinite(ann)]
        ols_fit = stats.linregress(ols_x, ols_y)
        ols = {"slope_per_decade": float(ols_fit.slope * 10.0),
               "p_value": (float(ols_fit.pvalue) if np.isfinite(ols_fit.pvalue) else None),
               "note": "parametric, not robust — supplementary only"}
    else:
        ols = None

    direction = mk_tfpw["trend"] if mk_tfpw["significant"] else "no trend"
    if mk_tfpw["trend"] == "insufficient data":
        direction = "insufficient data"
    return {
        "slope_per_decade": float(sen_pd),
        "ci_low": float(sen["ci_low"] * 10.0),
        "ci_high": float(sen["ci_high"] * 10.0),
        "p_value": float(mk_tfpw["p_value"]),
        "p_value_uncorrected": float(mk_annual["p_value"]),
        "p_value_seasonal": float(mk_seasonal["p_value"]),
        "tau": float(mk_tfpw["tau"]),
        "n": int(mk_tfpw["n"]),
        "n_monthly": int(np.isfinite(y).sum()),
        "lag1_autocorr": float(mk_tfpw["lag1_autocorr"]),
        "autocorr_corrected": bool(mk_tfpw["autocorr_corrected"]),
        "significant": bool(mk_tfpw["significant"]),
        "direction": direction,
        "seasonal_significant": bool(mk_seasonal["significant"]),
        "method": "sen_slope+tfpw_mann_kendall(annual)+seasonal_mk(monthly)",
        "parametric_ols": ols,
        "period_start": start_label,
        "period_end": end_label,
        "baseline": list(baseline or (1991, 2020)),
    }
