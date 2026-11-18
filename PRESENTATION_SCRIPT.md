# Earth Pulse — Presentation Script (Share-Screen Demo)

Use this script while sharing your screen. Times are approximate for a 5–7 minute demo.

---

## 0. Before you start (30 sec prep)

- Open **http://localhost:8000/** in a full-screen browser (Chrome, no bookmarks bar).
- Close extra tabs. Zoom to 100%.
- Have the terminal hidden; only the browser visible.
- Optional: open a second monitor with these notes.

---

## 1. Hook (45 sec)

> "Every place on Earth has changed over the last 40 years — but the data is locked in satellite archives that only experts can read. Earth Pulse turns that into a click."

- Show the **landing page** hero (dark cinematic).
- Scroll slowly to show the storytelling sections.
- Point out: *"Built for the NASA Space Apps Challenge 2026 — Be An Earth System Trend Detective."*

---

## 2. Data collection points (60 sec)

> "Where does the data come from? Real NASA and open Earth data, not synthetic."

Mention 4–5 sources while pointing at the page's source notes:

1. **NASA POWER** — weather & solar (temperature, precipitation, humidity, wind, solar radiation) from 1981 to present.
2. **NASA GISS / GISTEMP** — global temperature anomalies for validation.
3. **MODIS NDVI** (via AppEEARS) — vegetation greenness at 250 m.
4. **GPM IMERG** — high-resolution precipitation (optional).
5. **Sentinel-2 / Landsat** (Microsoft Planetary Computer) — 10 m imagery, no login.
6. **Open-Meteo, NOAA, Copernicus CDS** — cross-check weather records.
7. **OpenAQ** — air quality (PM2.5, AOD).

> "The grid store is real NASA POWER monthly data (1981→present). NDVI/SST/sea level are intentionally marked unavailable rather than faked — that's our honesty rule."

---

## 3. Live demo: click a location (90 sec)

1. Click **"Explore Earth Pulse locations"** / map.
2. Pick **Western Ghats + Arabian Sea** (or North China Plain).
3. Show the **chip bar**: region, variable, period, data status, pin.
4. Point out **"LIVE BACKEND"** badge — proves real data, not demo.
5. Scroll to **Historical observed series & trend**: monthly chart + Theil-Sen slope + p-value.
6. Show **Forecast** card: 60-month projection with p10–p90 band, backtest MAE/PICP.
7. Show **Anomaly Detective**: flagged unusual months with z-scores.
8. Show **Opposite Trend Detector**: neighbouring cells trending opposite directions.
9. Show **Earth Trend Fingerprint**: per-parameter slopes & significance.
10. Show **Data Coverage & Provenance**: which params available/unavailable.
11. Show **Imagery** panel: observed GIBS tiles, labeled "Observed/reference".

---

## 4. Chat with the data (45 sec)

1. Open **Chat** tab.
2. Ask: *"Give me a grounded summary of this region."*
3. Show the reply: templated facts + LLM rewording (qwen2.5:1.5b via Ollama).
4. Highlight: **"LLM narration: templated. Numbers are computed by the backend; the LLM only rewords them."** — no hallucinated numbers.

---

## 5. Other features (60 sec)

- **Videos & timelapse**: observed past frames + projected future frames, clearly labeled.
- **Map inspection**: pin any coordinate, carry it into chat.
- **Notebook / Report**: exportable investigation record + visual report with KPIs, fingerprint, backtest, coverage.
- **Visualizations**: charts, forecast bands, anomalies, comparisons in one view.
- **Climate twins**: K-Means clustering of similar regions.
- **Multilingual**: English / Hindi / Kannada stories.

---

## 6. Architecture & ML layers (45 sec)

- **Data layer:** NASA POWER monthly grid + point stores (NPZ).
- **Analysis:** NumPy/SciPy, Theil-Sen + Mann-Kendall, Ridge rollout forecaster.
- **API:** FastAPI (single service; frontend + API same origin).
- **Frontend:** React + Vite + Leaflet, Tailwind-free custom CSS.
- **LLM:** local Ollama (qwen2.5:1.5b) with templated fallback.
- **Deployment:** one Render Docker web service (`render.yaml`).

ML table:
| Layer | Model | Purpose |
|---|---|---|
| Trend | Theil-Sen + Mann-Kendall | Robust long-term trend |
| Forecast | Ridge rollout | Next 5 years with p10–p90 bands |
| Anomaly | Rolling robust-z (61-month window) | Flag unusual months |
| Clustering | K-Means | Climate twins |
| Explainer | Ollama LLM + template | Plain English, no invented numbers |

---

## 7. Honesty & limitations (30 sec)

- NDVI/SST/sea level are **not** available from POWER → shown as unavailable, never faked.
- Forecasts are probabilistic (p10–p90), not certainties.
- Opposite trends are statistical pairs, not causal claims.
- All numbers come from the backend; the LLM only rewords.

---

## 8. Closing (20 sec)

> "Earth Pulse makes 40 years of Earth data clickable, explainable, and honest. Every number is traceable to a NASA source. Thank you."

- Show the **Opposite Trend Detector** one last time as the signature feature.
- End on the landing page hero.

---

## Quick demo checklist

- [ ] Backend up: `http://localhost:8000/api/health`
- [ ] Frontend up: `http://localhost:8000/`
- [ ] Hard-refresh browser (Ctrl+Shift+R)
- [ ] Test chat: "Give me a grounded summary"
- [ ] Test forecast card loads
- [ ] Test anomaly list loads
- [ ] Test imagery tiles load

---

## One-line pitch

"Click anywhere on Earth and instantly see how that place has changed over 40 years — with honest, traceable, AI-explained trends, forecasts, and anomalies."