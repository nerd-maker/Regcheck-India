# ---- Build Stage ----
FROM python:3.11-slim AS builder

WORKDIR /app

# Install system dependencies for building
RUN apt-get update && apt-get install -y \
    build-essential \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt
RUN /install/bin/python -m spacy download en_core_web_sm

# ---- Runtime Stage ----
FROM python:3.11-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Create non-root user
RUN groupadd -r regcheck && useradd -r -g regcheck -d /app -s /sbin/nologin regcheck

# Copy application code
COPY . .

# Create necessary directories with correct permissions
RUN mkdir -p /app/uploads /app/data/chromadb /app/logs \
    && chown -R regcheck:regcheck /app

# Switch to non-root user
USER regcheck

# Expose port
EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Default port (Render overrides via $PORT env var)
ENV PORT=8000

# Run with gunicorn for production
CMD gunicorn app.main:app \
    --bind 0.0.0.0:$PORT \
    --workers 2 \
    --worker-class uvicorn.workers.UvicornWorker \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
