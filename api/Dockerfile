# Earth Pulse API image — Hugging Face Spaces (Docker SDK) / Render free tier.
# Serves the bundled synthetic sample so the demo is real and reproducible.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    EP_STORE_PATH=/app/data/samples/earth_pulse_sample.npz \
    EP_ANALYSIS_PATH=/app/data/processed/analysis.json \
    PORT=7860

WORKDIR /app

# install Python deps first (better layer caching)
COPY api/requirements.txt api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt

# copy the rest of the repo
COPY . .

# build the sample store, precomputed analysis and the forecaster artifact
# at image build time — the image then serves the full demo with zero boot work
RUN python pipeline/run_pipeline.py --sample \
 && python engine/run_engine.py \
 && python models/train.py

EXPOSE 7860
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT}"]
