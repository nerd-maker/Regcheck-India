# ---- Build Stage ----
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DEBIAN_FRONTEND=noninteractive \
    PIP_CONSTRAINT=/app/constraints.txt

WORKDIR /app

ARG SPACY_MODEL_URL=https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.7.1/en_core_web_sm-3.7.1-py3-none-any.whl

# Build dependencies for Python wheels and AI/audio libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
COPY constraints.txt .
RUN python -m pip install --upgrade pip wheel "setuptools<82"
RUN pip install -r requirements.txt
RUN pip install "${SPACY_MODEL_URL}"

# ---- Runtime Stage ----
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DEBIAN_FRONTEND=noninteractive \
    PORT=8000

WORKDIR /app

# Runtime packages for Whisper/ffmpeg and scientific dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python environment from builder
COPY --from=builder /usr/local /usr/local

# Create non-root user
RUN groupadd -r regcheck && useradd -r -g regcheck -d /app -s /usr/sbin/nologin regcheck

# Copy application code
COPY . .

# Create necessary directories with correct permissions
RUN mkdir -p /app/uploads /app/data/chromadb /app/data/runtime /app/logs \
    && chown -R regcheck:regcheck /app

# Switch to non-root user
USER regcheck

# Expose port
EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run with gunicorn for production
CMD gunicorn app.main:app \
    --bind 0.0.0.0:$PORT \
    --workers 1 \
    --worker-class uvicorn.workers.UvicornWorker \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
