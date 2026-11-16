# Conformal calibration — REAL data

Model: `climatology_trend` · method: absolute-residual split conformal on rolling-origin backtest residuals.

## temperature
| nominal | empirical coverage (calibration folds) | max-h width |
|---|---|---|
| 0.50 | 0.5 | 0.782 |
| 0.80 | 0.7969 | 2.078 |
| 0.90 | 0.8958 | 3.390 |

## precipitation
| nominal | empirical coverage (calibration folds) | max-h width |
|---|---|---|
| 0.50 | 0.5 | 13.987 |
| 0.80 | 0.7969 | 54.542 |
| 0.90 | 0.8958 | 82.481 |

## sst
| nominal | empirical coverage (calibration folds) | max-h width |
|---|---|---|
| 0.50 | 0.5 | 0.408 |
| 0.80 | 0.8021 | 0.909 |
| 0.90 | 0.8958 | 1.566 |

Calibration coverage is measured on the backtest calibration folds; the honest
estimate for deployment is the rolling-origin coverage, which is reported in the payload.

If coverage cannot hit target on held-out folds, the report says so — no tuning to the target is allowed.
