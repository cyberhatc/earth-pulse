# Earth Pulse — Demo Script (5 minutes)

Run order: start backend → start frontend → walk the 5 steps below.
All numbers in this script were pulled live from the running API — no dummy data.

```bash
# terminal 1 — API
uvicorn api.main:app --reload --port 8000

# terminal 2 — UI
npm --prefix web run dev        # http://localhost:3000
```

Sanity check before you present (must say `real_data: true`):

```bash
curl -s localhost:8000/health | python3 -m json.tool | grep -E 'real_data|artifact|time_range'
```

---

## Step 0 — Opening line (15 sec)

> "Earth Pulse ingests **45 years of NASA POWER monthly data — 1981 to 2026,
> 551 months, 240 grid cells, 14 climate parameters** — detects real trends in it,
> and forecasts the next 5 years with a validated ML model. Everything you're about
> to see is computed from that store. The API's `/health` proves it: `real_data: true`."

---

## Step 1 — Prove the data is real (30 sec)

Open **http://localhost:3000/** → watch the top bar say live backend status.

Show terminal:

```bash
curl -s localhost:8000/health
```

Point at:

| Field | Value to highlight |
|---|---|
| `store.name` | `earth_pulse_power_full.npz` |
| `store.synthetic` | `false` / `real_data: true` |
| `store.time_range` | `["1981-01", "2026-11"]` |
| `store.n_months` | `551` |
| `models.artifact` | `forecaster_power_real.npz` |
| `models.samples` | `126480` |
| `models.lambda` | `1000.0` |

> "This is the real store. The synthetic demo is only a fallback if the backend is down —
> and the UI labels it loudly when that happens."

---

## Step 2 — The trend detector: how the Earth is changing (60 sec)

Open **http://localhost:3000/trend** (also linked as **Global Trend** in the top bar).

What to say:

> "This is not a model guess. For each of the 240 cells we remove the seasonal cycle
> with a 1991–2020 climatology, take annual means, compute a **Theil–Sen slope per decade**,
> and test significance with **Mann–Kendall + trend-free pre-whitening**, then apply
> Benjamini–Hochberg FDR across the grid. Red = warming, blue = cooling, grey = not significant."

Live numbers for **temperature** (verify while presenting):

- **240 cells, 162 significant** (154 increasing, 8 decreasing)
- Strongest rise: **75°N, 75°E → +0.886 °C/decade**
- Strongest fall: **60°S, 15°E → −0.353 °C/decade**
- Switch the dropdown to `precipitation` / `wind` to show the grid recompute live.

> "Arctic amplification showing up as the strongest warming, Antarctic cells cooling —
> that's the real signal in the data, drawn straight from the observed record."

---

## Step 3 — Region report: trend + 5-year forecast (90 sec)

Open **http://localhost:3000/region/california-coast/report**

Walk down the page:

1. **Header** — `Temperature · 1981-01–2026-11 · Live backend · NASA POWER`
   - Note the honest label: *"Case-file Vegetation Index is not provided by NASA POWER;
     showing live Temperature instead."*
   > "We refuse to fake NDVI. POWER doesn't carry it, so we substitute a real
   > available parameter and say so on the page."
2. **KPI strip** — Theil–Sen slope, p-value, direction for the nearest cell
   (30.0°N, −120.0°W).
3. **Observed series + trend line** — 551 months of actual observations.
4. **Forecast ribbon** — the money shot:
   - model `ridge_rollout`, artifact `forecaster_power_real.npz`
   - **issued 2026-12, 60-month horizon**, p10–p90 bands widening with √h
   - temperature path: **19.12 °C → 20.08 °C over 5 years**
5. **Backtest card** — the accuracy proof:
   | Parameter | MAE | p10–p90 coverage |
   |---|---|---|
   | Temperature | 1.496 °C | 0.917 |
   | Precipitation | 3.754 mm | 1.000 |
   | Solar radiation | 0.515 | 1.000 |
   | Humidity | 2.292 % | 1.000 |
   | Wind | 0.550 m/s | 0.917 |
6. **Opposite trends** — 4 parameters moving the other way (the "dipole" story).
7. **Anomalies + evidence record** — provenance stamped on every claim.

---

## Step 4 — The prediction flow, spoken in 4 sentences (30 sec)

> 1. "We snap the location to the nearest real grid cell — here 30°N, 120°W."
> 2. "We take the **last 24 months × 14 parameters** as the input window — 336 features."
> 3. "**RidgeRollout** predicts the next month, appends it to the window, and repeats
>    60 times to roll out 5 years. Bands are `prediction ± 1.28 × residual_std × √step`."
> 4. "The same model is backtested at rolling origins: trained on the past, tested on
>    the next 12 months it never saw — and it beats the persistence baseline on every
>    major variable."

If asked about accuracy percentages:

> "Temperature ~96%, humidity ~95%, solar ~95%, wind ~89%, precipitation ~58% —
> expressed as `100 × (1 − MAE / mean)`. Skill vs persistence: temperature +27%,
> precipitation +39%, humidity +47%, wind +33%, solar +82%. Coverage of our
> uncertainty bands is 92–100%."

---

## Step 5 — Point-level deep dive (optional, 60 sec)

Open a case file from **http://localhost:3000/regions** → e.g. Bangalore point page:

- exact-point series (1981–2026), per-parameter trend, 5-year forecast, "next move"
- same artifact, point-specific rolling backtest with skill-vs-persistence

---

## Backup: one-command API demo (if the UI fails)

```bash
python3 - <<'PY'
from fastapi.testclient import TestClient
from api.main import app
c = TestClient(app)

h = c.get("/health").json()
print("real store:", h["store"]["real_data"], h["store"]["time_range"])
print("artifact  :", h["models"]["artifact"], h["models"]["samples"], "samples")

g = c.get("/trends/grid", params={"variable": "temperature"}).json()
sig = sum(1 for x in g["cells"] if x["significant"])
print(f"trend grid: {g['n_cells']} cells, {sig} significant")

d = c.get("/place", params={"lat": 37.0, "lon": -119.5, "horizon_months": 60}).json()
f = d["forecast"]["timeseries"]["temperature"]
print("forecast  :", d["forecast"]["model"], d["forecast"]["issued"],
      f"temp {f['mean'][0]:.2f} -> {f['mean'][-1]:.2f} C over 60 months")
for k, v in d["forecast"]["backtest"]["per_parameter"].items():
    print(f"  backtest {k:18s} MAE={v['mae']:<8} PICP={v['picp_p10_p90']}")
PY
```

---

## Anticipated judge questions

| Question | Answer |
|---|---|
| Is this real data? | Yes — `/health` → `real_data: true`, provenance `nasa_power_monthly_full_1981_present`, 551 months. |
| What model? | Multivariate `RidgeRollout` (closed-form ridge, λ=1000) trained on 126,480 windows, plus Theil–Sen + climatology baseline for blending. |
| How do you validate? | Temporal holdout / rolling origins: train on past, predict next 12 months, compare to actuals. MAE, RMSE, pinball, PICP, skill vs persistence. |
| Why is rain only ~58%? | Rainfall is near-zero-inflated and highly variable; we report it honestly instead of hiding it. |
| Why no LSTM? | Implemented but not shipped — we only serve validated, reproducible artifacts. |
| What about NDVI? | NASA POWER doesn't provide it; the page substitutes a real parameter and labels the substitution. |
