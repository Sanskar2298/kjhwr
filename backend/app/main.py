"""FastAPI application entrypoint.

Configures structured logging, CORS middleware, lifespan events for data loading,
and registers REST API routers.
"""

import logging
import sys
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.models.api import HealthResponse
from app.routers.api import router as api_router
from app.services.data_manager import DataManager

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='{"time": "%(asctime)s", "level": "%(levelname)s", "logger": "%(name)s", "message": "%(message)s"}',
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("app.main")
settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Lifespan event to load datasets into memory once on server startup."""
    logger.info("Initializing DataManager and pre-loading processed datasets...")
    dm = DataManager.get_instance()
    logger.info(
        f"Data pre-loaded successfully. Date range: {dm.min_date} to {dm.max_date} ({len(dm.fuelhh_df)} actuals, {len(dm.windfor_df)} forecasts)"
    )
    yield
    logger.info("Shutting down API server...")


app = FastAPI(
    title="UK Wind Generation Forecast Evaluation API",
    description="Evaluation of BMRS WINDFOR forecasts against FUELHH actuals for Day-Ahead trading decisions",
    version="0.1.0",
    lifespan=lifespan,
)

# Cross-Origin Resource Sharing (CORS) configured via env vars
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Structured request logging middleware measuring execution time."""
    start_time = time.time()
    try:
        response = await call_next(request)
        process_time = round((time.time() - start_time) * 1000, 2)
        logger.info(
            f"Method: {request.method} Path: {request.url.path} Status: {response.status_code} Duration: {process_time}ms"
        )
        return response
    except Exception as exc:
        process_time = round((time.time() - start_time) * 1000, 2)
        logger.error(
            f"Method: {request.method} Path: {request.url.path} Error: {exc} Duration: {process_time}ms"
        )
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal server error occurred while processing request."
            },
        )


# Register API routers
app.include_router(api_router)


@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check() -> HealthResponse:
    """Service health check endpoint."""
    return HealthResponse(
        status="healthy",
        environment=settings.ENVIRONMENT,
        version="0.1.0",
    )
