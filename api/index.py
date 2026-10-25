"""Vercel Serverless Function entrypoint for FastAPI backend.

This file exposes the FastAPI application instance `app` to Vercel's Python runtime.
Ensures sys.path includes backend/ directory for modular imports.
"""

import sys
from pathlib import Path

# Add backend directory to path so `import app.*` resolves cleanly in serverless context
BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = BASE_DIR / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app
