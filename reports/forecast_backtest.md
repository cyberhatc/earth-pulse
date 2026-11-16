# Forecast backtest — REAL data

Store: `data/processed/earth_pulse_real.npz` (synthetic=False)
Grid: 2.5 deg global, 24 cells sampled (lat band x land/ocean)
Origins: train on prefix only; origins every 24 months from 2005; horizon 60 months

**Reading this table**: models are ranked per variable (units differ; pooled MASE is not meaningful).

| horizon | persistence | seasonal_naive | climatology_trend | direct_ridge |
|---|---|---|---|---|
| 1 | 1.5943 | 0.961 | 0.8593 | 0.8762 |
| 3 | 1.6284 | 0.9302 | 0.8318 | 0.9075 |
| 6 | 1.8651 | 0.7913 | 0.7044 | 0.8145 |
| 12 | 1.0552 | 0.9406 | 0.8525 | 0.9691 |
| 24 | 1.1832 | 0.9729 | 0.8806 | 1.063 |
| 36 | 1.0642 | 0.9749 | 0.8803 | 1.0021 |
| 48 | 1.1029 | 0.9664 | 0.8723 | 1.0204 |
| 60 | 1.1821 | 1.0193 | 0.9149 | 1.0913 |

Per-variable MASE by horizon (the honest scoreboard):

### temperature
| horizon | climatology_trend | direct_ridge |
|---|---|---|
| 1 | 0.7774 | 0.7649 |
| 6 | 0.6877 | 0.7408 |
| 12 | 0.7859 | 0.8776 |
| 24 | 0.7839 | 0.9002 |
| 60 | 0.8515 | 0.9509 |

### precipitation
| horizon | climatology_trend | direct_ridge |
|---|---|---|
| 1 | 0.8231 | 0.9162 |
| 6 | 0.7475 | 0.8564 |
| 12 | 0.7168 | 0.8041 |
| 24 | 0.814 | 0.9048 |
| 60 | 0.7399 | 0.855 |

### sst
| horizon | climatology_trend | direct_ridge |
|---|---|---|
| 1 | 1.0952 | 1.0188 |
| 6 | 0.6516 | 0.8781 |
| 12 | 1.2568 | 1.4821 |
| 24 | 1.2075 | 1.7051 |
| 60 | 1.3914 | 1.8449 |


Per variable: temperature climatology_trend MASE<1 through h=60 (best skill to ~60m); precipitation marginal (0.71-0.82) through h=60; SST unskillful beyond ~6 months (1.0-1.4 at h>=12 for every model). Skill horizon is therefore variable-specific: do not present SST forecasts as trustworthy past h=6.
Full numbers: `reports/forecast_backtest.json`. Subsampling is documented, not hidden.
