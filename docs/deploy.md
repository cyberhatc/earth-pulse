# Deployment — free, open, reproducible

Everything below stays at **$0**. Free-tier limits change; verify current terms before submission.

## Prerequisites
- GitHub repo (public) — code, issues, CI, GitHub Pages.
- Python ≥ 3.10, Node ≥ 18.
- (Optional) NASA Earthdata login — only for **real** data downloads, not for the bundled demo.
- (Optional) Google Colab / Kaggle — free GPU for training the LSTM.
- (Optional) Hugging Face account — free hosting for model weights + Docker Spaces.

## 1) Run locally (5 minutes)
```bash
python3 -m venv .venv && . .venv/bin/activate
pip install numpy scipy fastapi uvicorn httpx pytest
make sample-data      # deterministic synthetic store (offline)
make engine           # precompute trends / opposite / twins → data/processed/analysis.json
make test             # pytest suite
make api              # http://localhost:8000  (docs at /docs)
                     # second terminal:
cd web && npm install && npm run dev   # http://localhost:5173
```
`docker compose up` alternative (see `docker-compose.yml`) — API + web together.

## 2) Host the API for free
**Option A — Hugging Face Spaces (recommended)**
1. Create Space → SDK **Docker**. 2. Copy `api/Dockerfile` + repo (or make Space root = repo root).
3. Space secrets: none required for demo; add `EARTHDATA_USERNAME/PASSWORD` for real pipeline, `HF_TOKEN` if pulling weights.
4. On boot: `make sample-data && make engine` then `uvicorn api.main:app --host 0.0.0.0 --port 7860`.
5. The Space URL becomes your `VITE_API_BASE`.

**Option B — Render (free web service)**: same Dockerfile; set `PORT=10000` (Render injects `PORT`); free instance sleeps — cold starts ~1 min.
**Option C — Local/on-stage laptop** (demo day): `make api` + `ngrok http 8000` (free tunnel) for remote judges.

## 3) Host the frontend for free
**Option A — Vercel** (`vercel` CLI or Git import): build command `npm run build`, output `web/dist`, env `VITE_API_BASE=https://<your-space>.hf.space`.
**Option B — Netlify**: identical (publish `web/dist`); drag-drop `web/dist` works too.
**Option C — GitHub Pages** (via `.github/workflows/deploy-web.yml`): set `VITE_API_BASE` as a repo variable; pushes to `main` publish `web/dist` to `https://<user>.github.io/<repo>/`.

## 4) Model weights on Hugging Face Hub (free)
```bash
# after training (Colab/Kaggle/laptop):
python3 models/download_models.py --push   # or manual hf_hub upload
```
- `models/train.py` saves `models/artifacts/forecaster.npz` (small, NumPy ridge) — safe to commit via Git LFS-free, or keep in repo (<2 MB).
- For the LSTM path, push `lstm_forecaster.pt` to Hub with `huggingface_hub.upload_file`, set `EP_MODEL_REPO=<user>/<repo>`; `models/download_models.py` fetches it at deploy time.
- Spaces may force-pull on rebuild; keep weights < 50 MB for CPU basic tier.

## 5) Training on free GPUs (Colab / Kaggle)
- Open `notebooks/02_train_forecast.ipynb` in Colab → Runtime → Change runtime type → GPU.
- Cells install deps, mount/load store, call `models.train.main()`, run rolling-origin backtest, upload artifact to HF Hub.
- Kaggle: add datasets or the repo as a notebook; same commands. Save versions → artifact in notebook output.

## 6) CI (GitHub Actions, free for public repos)
`.github/workflows/ci.yml` runs on PRs: install Python deps → `make sample-data engine` → `pytest`.
`deploy-web.yml` on `main`: builds `web/`, deploys Pages. Private Spaces deploy via Space's own Git push if preferred.

## 7) Secrets & config
| Var | Needed for | Default |
|---|---|---|
| `EARTHDATA_USERNAME/PASSWORD` | Real NASA downloads | unset → synthetic demo only |
| `FIRMS_MAP_KEY` | Fire hotspot fetch | unset → reported unavailable |
| `HF_TOKEN` | Push/pull weights, HF Inference | unset → templated explainer |
| `GEMINI_API_KEY` | Optional Gemini explainer | unset → templated |
| `VITE_API_BASE` | Web → API wiring | `http://localhost:8000` |

**Never commit `.env`.** Use Render/Space/Vercel secret stores.

## 8) Going from demo → real data (post-hackathon)
1. `python3 pipeline/run_pipeline.py --gridded --start 2000-01` (needs Earthdata login; subset OPeNDAP, consolidate to Zarr).
2. Re-run `make engine` and retrain LSTM on the real overlap period.
3. Point `api/services/store.py` at the Zarr path instead of the sample `.npz` (same dict layout; set `EP_STORE_PATH`).
4. Ship; `data_coverage` will automatically reflect actual sources/years.

## 9) Submission checklist (NASA Space Apps)
- Public GitHub repo (MIT license) · working demo URL · README quick-start · 30-sec demo video · citations (`docs/data-sources.md`) · honest limitations (`docs/ml.md`).
