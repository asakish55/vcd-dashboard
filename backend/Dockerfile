# ─────────────────────────────────────────────
# VCD Dashboard – Backend Dockerfile
# Base: Python 3.11 slim
# ─────────────────────────────────────────────

FROM python:3.11-slim

# Metadata
LABEL maintainer="asakish55"
LABEL description="VCD Dashboard Backend – FastAPI"

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Expose API port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Run the application
# Use --workers 2 for small deployments (adjust for production)
# Single worker - sessions are stored in memory, multiple workers would lose sessions
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
