"""
Dooza AI API - Main Application

Standard LangGraph production setup:
- PostgreSQL checkpointer for conversation memory
- Custom FastAPI routes for HTTP handling
- Native LangGraph event streaming for full visibility
- Memory persists across requests via thread_id
"""

from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import health, integrations, gallery
from app.routers.langgraph_api import setup_langgraph_routes
from app.core.database import init_checkpointer, close_checkpointer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manage application lifecycle - startup and shutdown.
    
    Standard LangGraph production pattern:
    1. Initialize checkpointer FIRST (for memory)
    2. Setup LangGraph routes AFTER (so they have checkpointer)
    """
    logger.info("Starting Dooza AI API...")
    
    # Step 1: Initialize PostgreSQL checkpointer for conversation memory
    try:
        await init_checkpointer()
        logger.info("Checkpointer initialized - memory persistence enabled")
    except Exception as e:
        logger.warning(f"Database init failed (memory will not persist): {e}")
    
    # Step 2: Setup LangGraph routes AFTER checkpointer is ready
    # This ensures the supervisor is compiled WITH the checkpointer
    setup_langgraph_routes(app)
    
    yield
    
    # Shutdown
    await close_checkpointer()
    logger.info("Dooza AI API shutdown complete")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()
    
    app = FastAPI(
        title="Dooza AI API",
        description="AI Agent Backend powered by LangGraph",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )
    
    @app.get("/")
    async def root():
        """Root endpoint - API information."""
        return {
            "service": "Dooza AI API",
            "version": "1.0.0",
            "status": "running",
            "docs": "/docs",
            "health": "/health"
        }
    
    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Standard routers
    app.include_router(health.router, tags=["Health"])
    app.include_router(integrations.router, prefix="/v1/integrations", tags=["Integrations"])
    app.include_router(gallery.router, prefix="/v1", tags=["Gallery"])
    
    # Note: LangGraph routes are added in lifespan AFTER checkpointer init
    
    return app


app = create_app()
