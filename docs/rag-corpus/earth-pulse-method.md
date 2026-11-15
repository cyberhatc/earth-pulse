# Earth Pulse methodology (method notes)

How the numbers shown in Earth Pulse are produced. Written for the chatbot's
knowledge base; grounded in this repository's code (`engine/trends.py`,
`models/anomaly.py`, `models/forecast.py`, `engine/climate_twins.py`,
`engine/opposite.py`, `api/services/explainer.py`).

## Trend estimation: Theil–Sen + Mann–Kendall
- Slope per decade is the Theil–Sen median-of-pairwise-slopes estimator — robust to outliers.
- Significance is the Mann–Kendall p-value on the monthly record. p < 0.05 is the conventional threshold for calling a trend "statistically significant".
- A non-significant p-value does NOT prove there is no change — it means the data cannot confirm one at that threshold.
- A p-value is not a confidence level, probability, or certainty. Never state "100% certain" or convert p into a percentage of confidence.
- Roughly 40–45 years of monthly data (~500 points) is what each cell carries; shorter records widen p-values.

## Anomalies: rolling robust z-score
- Each month is compared against a rolling seasonal window (61 months) using a modified robust z-score (median/MAD-based).
- |z| ≥ 3.5 flags an "unusual month". Anomalies are temporary departures from the seasonal cycle, not proof of a permanent regime shift or a disaster.
- Earth Pulse reports the count and the largest departures; it does not attribute causes.

## Forecasting: ridge rollout with p10–p90 bands
- Features: per-parameter lags + month harmonics (sin/cos) + a year index; a ridge model rolls forward month by month.
- Forecasts are probabilistic outlooks with p10–p90 bands. The band widens with horizon (√h growth of residual σ).
- The reported "delta" in `/chat` facts is the TOTAL NET CHANGE from the first to the last forecast month — it is NOT a per-decade rate.
- Backtest skill (MAE/RMSE/PICP) is reported per parameter in the /place payload when a trained artifact is available. PICP = prediction interval coverage probability (should sit near 80% for a calibrated p10–p90 band).
- Regime shifts (volcanoes, abrupt ENSO flips, land-use change) are outside the training distribution and are not anticipated.

## Climate twins: K-Means over cell fingerprints
- Cells are clustered (k=8) on z-scored multivariate features. Clusters are a didactic similarity view, not a recognized climate classification; different k reassigns cells.
- A "twin" is a hypothesis for cross-region comparison, not proof of shared causes. Compare dataset resolution and coverage before claims.

## Opposite trends: statistical dipoles, not causation
- Pairs of neighbouring cells with opposite-sign slopes; marked "strong" only when both Mann–Kendall tests are significant.
- This is a detective lead. Mechanisms (irrigation, land use, orography, microclimate) need local evidence.

## Facts-locked narration (why the chatbot is careful)
- The LLM never computes or changes numbers. Backend code assembles a FACTS dict (trends, forecast deltas, anomalies, coverage); the LLM only re-words it.
- Post-generation guards reject: certainty claims, p-values framed as probabilities/confidence, p10–p90 bands described as a "10–90% chance", non-significant trends called significant, and numbers that do not appear in the facts (no model arithmetic allowed).
- Failing any guard substitutes deterministic templated prose (generator `templated-guard`) instead of publishing a false claim.

## RAG design (what retrieval adds)
- Retrieval adds CONTEXT (domain docs, method notes, data-coverage facts) next to FACTS (the cell's actual numbers).
- Facts still win on conflict: the prompt instructs the model that FACTS SUMMARY overrides CONTEXT; guards still run on the output.
- Citations: sources used are returned as [S1], [S2] … and shown in the chat UI as a "Sources" line.
