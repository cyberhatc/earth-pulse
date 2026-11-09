# Submission checklist — NASA Space Apps Challenge 2026

Challenge: **Be An Earth System Trend Detective** · Project: **Earth Pulse** ·
Working tree lives at `/home/mike/Desktop/mikedevil/hackthon/nasa`.

Deadlines (from README §8): submission opens **Sat Nov 14, 9:00 AM**, closes
**Sun Nov 15, 11:59 PM** (verify on the Space Apps portal — it always wins).

## 1) Repo & code
- [ ] Public GitHub repository with
  - [ ] MIT `LICENSE` (already in repo)
  - [ ] README.md with the dated "What's implemented" section + quickstart
  - [ ] Project title, team name and the selected challenge in the README header
  - [ ] `.env` **not** committed (`.gitignore` covers it); no keys ever in code
  - [ ] Commit history tells the build story (screenshot for judges, optional)
- [ ] `make sample-data engine train test` exits green locally
- [ ] `python3 -m pytest tests/ -q` green (honest counts, skips allowed & labeled)
- [ ] `docker compose config` parses and `docker compose build api` succeeds
- [ ] CI green: `.github/workflows/ci.yml`; Pages deploy: `deploy-web.yml`

## 2) Working demo
- [ ] **Deployed API URL** — Hugging Face Space (Docker SDK) or Render, built from
  `api/Dockerfile`; `/health` returns `schema_version`
- [ ] **Deployed frontend URL** — Vercel / Netlify / GitHub Pages from `web/dist`,
  with `VITE_API_BASE` pointing at the deployed API; map + click → `/place` works
- [ ] Offline fallback verified: bundled synthetic sample drives the whole demo
  with no keys and no network (git-cloneable → runnable in minutes)
- [ ] Demo-day laptop plan: `make api` + `ngrok http 8000` as backup tunnel
- [ ] Screenshot/short capture of: map click → panel → Charts (uncertainty
  ribbon) → Imagery → Opposite Trends case file → Why (explainer)

## 3) Demo video (30–60 s, judges skim — Front-load the hook)
- [ ] 0–5 s: the one-line pitch ("Click anywhere on Earth — see 40 years of
  change, forecast the next five, honestly")
- [ ] Scripted beat list (keep visible): click → chart w/ p10–p90 band →
  significance marker → opposite-trend case file → plain-English explainer →
  **coverage badge honesty moment** (synthetic demo label + per-parameter years)
- [ ] Narration mentions what is real vs synthetic ("deterministic synthetic
  store; swap in MERRA-2/MODIS for real analysis")
- [ ] Language: English (+ optionally one sentence each in हिंदी / ಕನ್ನಡ for the
  multilingual claim)
- [ ] Hosted (unlisted YouTube) and linked from the Space Apps project page

## 4) Space Apps portal fields
- [ ] Team name + members + roles (README §9 has roles)
- [ ] Challenge selected: *Be An Earth System Trend Detective*
- [ ] GitHub repo URL + demo URL + video URL all pasted and open in incognito
- [ ] "What it does / How we built it / Challenges / Accomplishments /
  What we learned / What's next" drafts written (reuse docs/architecture.md
  + docs/ml.md phrasing)
- [ ] Space/region rules double-checked (eligibility, team count)

## 5) Data & citations
- [ ] NASA Earthdata credited prominently (README §3 table already lists sources)
- [ ] Per-product citations for anything actually fetched in the demo:
  GIBS/Worldview layers, NASA POWER point series (docs/data-sources.md §3, §8)
- [ ] Label **synthetic** demo data in the UI (coverage badge already does it)
- [ ] Imagery usage complies with GIBS/OSM terms (attribution layer visible on map)

## 6) Honesty & accuracy guardrails (Space Apps rewards this)
- [ ] Observed / Forecast (p10–p90) / Synthetic demo / AI-generated labels kept
  visually distinct (docs/ui-ux.md "What to show and what not to claim")
- [ ] Never claim "40 years" for NDVI/SST/sea level in copy or video
  (docs/data-sources.md §13 "40-year check")
- [ ] Limitations surfaced: `docs/limitations.md` linked from the README
- [ ] No fabricated numbers in the AI explainer (facts-only prompt, templated
  fallback works offline — verified in `docs/ml.md` §6)

## 7) Accessibility & polish
- [ ] Keyboard navigation closes the panel (Esc), focus ring visible
- [ ] Contrast ≥ 4.5:1 text in light & dark themes
- [ ] Low-bandwidth toggle works; app still renders with imagery stripped
- [ ] EN / HI / KN strings render (no placeholders on the shipped UI)

## 8) Final 30 minutes
- [ ] `curl <deployed-api>/health` → `{"status":"ok"...}`
- [ ] `curl <deployed-api>/place?lat=12.97&lon=77.59` → `schema_version` present
- [ ] Hit submit **before** 23:59, then screenshot the confirmation page
