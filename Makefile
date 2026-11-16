.PHONY: help venv install sample-data engine test api web web-install build clean real-store real-analysis backtest conform validate-trend load-test contract-test

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

venv: ## Create a virtualenv in .venv
	python3 -m venv .venv
	. .venv/bin/activate && pip install --upgrade pip

install: venv ## Install Python deps (pinned; mirrors requirements.txt)
	. .venv/bin/activate && pip install -r requirements.txt

real-store: ## Build the REAL 2.5deg multi-variable store (--fast: GISTEMP+GPCP+ERSST, no login; ~2 min, network)
	python3 pipeline/build_store.py --fast $(ARGS)

real-analysis: ## Engine on the real store -> data/processed/analysis_real.json
	python3 engine/run_engine.py --input data/processed/earth_pulse_real.npz --output data/processed/analysis_real.json

backtest: ## Rolling-origin forecast backtest on the real store (writes reports/forecast_backtest.{json,md})
	python3 models/evaluate.py --npz data/processed/earth_pulse_real.npz --cells 24

conform: backtest ## Conformal calibration report + /place fallback JSON (writes reports/calibration.{json,md}, data/processed/conformal.json)
	python3 -m models.conformal report --residuals reports/forecast_backtest.npz --model climatology_trend
	python3 -m models.conformal fallback-json --residuals reports/forecast_backtest.npz --model climatology_trend

validate-trend: ## Validate global-mean trend vs NASA GISTEMP -> reports/trend_validation.md
	python3 engine/validate.py --npz data/processed/earth_pulse_real.npz --report reports/trend_validation.md

sample-data: ## Generate the bundled synthetic sample store (offline demo)
	python3 pipeline/run_pipeline.py --sample

engine: sample-data ## Precompute trends, opposite-trend pairs, climate twins
	python3 engine/run_engine.py --input data/samples/earth_pulse_sample.npz --output data/processed/analysis.json

train: sample-data ## Train the multivariate forecaster on the sample store
	python3 models/train.py --input data/samples/earth_pulse_sample.npz --output models/artifacts/forecaster.npz

test: sample-data ## Run the Python test suite
	EP_SAMPLE=data/samples/earth_pulse_sample.npz python3 -m pytest tests/ -q

real-power: ## Build the REAL NASA POWER store (240 cells, 1981→present; ~5 min, network)
	python3 pipeline/build_real_power_store.py
	EP_STORE_PATH=data/processed/earth_pulse_power_real.npz python3 engine/run_engine.py \
	    --input data/processed/earth_pulse_power_real.npz \
	    --output data/processed/analysis_power_real.json
	@echo "Set EP_STORE_PATH=data/processed/earth_pulse_power_real.npz EP_ANALYSIS_PATH=data/processed/analysis_power_real.json to serve the real store"

api: engine ## Run the FastAPI server (http://localhost:8000)
	. .venv/bin/activate && uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

web-install: ## Install web dependencies
	cd web && npm install

web: web-install ## Build & preview the frontend (http://localhost:4173)
	cd web && npm run build && npm run preview

build: ## Build the frontend for production (outputs web/dist)
	cd web && npm install && npm run build

load-test: ## Benchmark the API (server must already run on :8000; see docs/performance.md — start server with EP_RATE_LIMIT_PER_MIN=0)
	python3 scripts/load_test.py --url http://127.0.0.1:8000 --path /health --n 500 --concurrency 10
	python3 scripts/load_test.py --url http://127.0.0.1:8000 --path "/place?lat=12.97&lon=77.59&horizon_months=60" --n 50 --concurrency 1

contract-test: ## API contract-snapshot tests (key-presence pins for 12 endpoints)
	python3 -m pytest tests/test_contract_snapshots.py -q

clean: ## Remove caches and build output
	rm -rf web/dist web/node_modules .pytest_cache **/__pycache__
