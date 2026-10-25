"""FastAPI application entrypoint.

Exposes REST API endpoints for wind generation forecasts and quantitative evaluation.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="UK Wind Generation Forecast Evaluation API",
    description="Evaluation of BMRS WINDFOR forecasts against FUELHH actuals for Day-Ahead trading decisions",
    version="0.1.0",
)

# Configure Cross-Origin Resource Sharing (CORS) for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
async def health_check() -> dict:
    """Service health check endpoint.

    Returns:
        dict: Service status and active environment.
    """
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "version": "0.1.0",
    }
