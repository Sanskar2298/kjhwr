# syntax=docker/dockerfile:1
# ------------------------------------------------------------------------------
# Production Dockerfile for UK Wind Day-Ahead Forecast FastAPI Backend
# Slim, non-root user execution, strict healthcheck, minimal attack surface.
# ------------------------------------------------------------------------------

FROM python:3.11-slim AS base

# Prevent Python from writing bytecode and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

# Install minimal OS dependencies for healthchecks & security updates
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies in isolated layer
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Create a dedicated non-root user and group
RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -s /bin/bash -m appuser

# Copy application source code and pre-seed processed data directory
COPY . /app

# Ensure correct permissions for non-root user
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

# Health check checking the FastAPI /api/health endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Launch uvicorn production server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--log-level", "info"]
