# High-resolution, real-data path — any place on Earth (Belgaum case study)

This document describes how Earth Pulse goes from the bundled 15° synthetic demo
to a **sub-kilometre, real-data** analysis for a single place, using
**Belgaum (Belagavi), Karnataka (15.8497 N, 74.4977 E)** as the showcase.

## Works for any place on Earth

The `/point` endpoint and `pipeline/fetch_highres_point.py` accept **any** lat/lon
(-90..90, -180..180). The frontend has a global place search (OpenStreetMap
Nominatim) plus a 📍 Belgaum shortcut; clicking anywhere on the map in
🛰 Hi-Res mode also triggers a high-res point build. Ocean points are handled
honestly (NDVI masked, SST/sea level reported as unavailable from POWER).

## Resolution ladder

| Product | Resolution | Period | Used for |
|---|---|---|---|
| NASA POWER (point API) | ~0.5° source, interpolated to point | 1981–present | temperature, precipitation, humidity, wind, solar |
| MODIS MOD13Q1 NDVI | 250 m, 16-day | 2000–present | vegetation greenness (via AppEEARS, Earthdata login) |
| GPM IMERG | 0.1°, 30-min | 2000–present | high-res precipitation (optional, Earthdata login) |
| Sentinel-2 L2A | 10 m | 2015–present | true-colour + NDVI imagery (Planetary Computer, no login) |
| Landsat 8/9 | 30 m | 2013–present | longer imagery archive (Planetary Computer, no login) |
| GIBS MODIS tiles | 250 m–1 km | 2000–present | map backdrop tiles |

No single product gives 40 years at 0.5 km. Earth Pulse is honest about this:
POWER provides the 40-year climate record at point level; MODIS adds 250 m
vegetation since 2000; Sentinel-2 adds 10 m imagery since 2015. Forecasts are
probabilistic (p10–p90) and labeled as model outlooks, never as certain futures.

## Build the Belgaum store

```bash
# 1. (optional) Earthdata login for 250 m NDVI
export EARTHDATA_USERNAME=... EARTHDATA_PASSWORD=...

# 2. Build the high-res point store + analysis
python3 scripts/build_belgaum.py

# 3. Serve
EP_STORE_PATH is ignored for /point (it uses data/processed/points/...)
uvicorn api.main:app --port 8000
# then: curl "http://localhost:8000/point?lat=15.8497&lon=74.4977&horizon_months=60"
```

Probe only (no write):
```bash
python3 scripts/build_belgaum.py --probe
python3 pipeline/fetch_highres_point.py --lat 15.8497 --lon 74.4977 --probe
```

## API

- `GET /point?lat&lon&horizon_months=60` — high-res point payload (real NASA
  data, point-level trends, forecast, anomalies, next-move summary).
- `GET /point/imagery?lat&lon` — Sentinel-2 / Landsat scene list from
  Planetary Computer (free, no login).
- `GET /imagery/scenario?lat&lon&parameter=ndvi` — AI scenario-card
  conditioning (generation stays offline, GPU only).

## AI image generation (scenarios)

Scenario cards are AI-generated illustrations, never observations:

```bash
EP_SCENARIO_IMAGES=1 python3 models/scenario_cards.py --generate \
  --lat 15.8497 --lon 74.4977 --parameter ndvi
```

Requires `pip install diffusers transformers accelerate pillow torch`. Output
lands in `models/artifacts/scenarios/`. The UI always labels these as
"AI-generated scenario — not an observation".

## Frontend

The web app has a **🛰 Hi-Res** toggle and a **📍 Belgaum** shortcut button.
With Hi-Res on, clicking (or the Belgaum button) queries `/point` instead of
`/place`, showing the real point series, the 5-year predicted move, and
satellite scene links.

## Honest limits

- POWER is satellite+model agroclimatology, not native 0.5 km.
- NDVI needs Earthdata login for 250 m; otherwise unavailable (never faked).
- SST/sea level are ocean variables; for an inland place like Belgaum they are
  masked (NaN) and reported as unavailable.
- Forecasts are probabilistic p10–p90; the "next move" summary is a
  direction/magnitude hint, not a prediction of discrete events.
- Scenario images are illustrative only.
