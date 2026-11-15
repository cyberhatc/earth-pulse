FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    MODEL_ID=Qwen/Qwen2.5-0.5B-Instruct \
    KB_TOP_K=4 \
    RAG_PRELOAD=1

WORKDIR /app

COPY requirements.txt .
# CPU-only torch keeps the image small enough for the free CPU Space tier.
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

COPY . .

EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
