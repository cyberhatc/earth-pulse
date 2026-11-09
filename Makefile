.PHONY: help venv install sample-data engine test api web web-install build clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

venv: ## Create a virtualenv in .venv
	python3 -m venv .venv
	. .venv/bin/activate && pip install --upgrade pip

install: venv ## Install Python deps (pipeline, engine, models, api, tests)
	. .venv/bin/activate && pip install numpy scipy fastapi uvicorn pydantic httpx pytest

sample-data: ## Generate the bundled synthetic sample store (offline demo)
	python3 pipeline/run_pipeline.py --sample

engine: sample-data ## Precompute trends, opposite-trend pairs, climate twins
	python3 engine/run_engine.py --input data/samples/earth_pulse_sample.npz --output data/processed/analysis.json

train: sample-data ## Train the multivariate forecaster on the sample store
	python3 models/train.py --input data/samples/earth_pulse_sample.npz --output models/artifacts/forecaster.npz

test: sample-data ## Run the Python test suite
	EP_SAMPLE=data/samples/earth_pulse_sample.npz python3 -m pytest tests/ -q

api: engine ## Run the FastAPI server (http://localhost:8000)
	. .venv/bin/activate && uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

web-install: ## Install web dependencies
	cd web && npm install

web: web-install ## Build & preview the frontend (http://localhost:4173)
	cd web && npm run build && npm run preview

build: ## Build the frontend for production (outputs web/dist)
	cd web && npm install && npm run build

clean: ## Remove caches and build output
	rm -rf web/dist web/node_modules .pytest_cache **/__pycache__
