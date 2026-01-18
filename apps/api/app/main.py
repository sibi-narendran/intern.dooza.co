from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import health, chat
from app.core.database import init_checkpointer, close_checkpointer

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle - startup and shutdown."""
    # Startup - try to init DB but don't fail if it's not available
    logger.info("Starting Dooza AI API...")
    try:
        await init_checkpointer()
    except Exception as e:
        logger.warning(f"Database init failed (will retry on first request): {e}")
    
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
    
    # Routers
    app.include_router(health.router, tags=["Health"])
    app.include_router(chat.router, prefix="/v1", tags=["Chat"])
    
    return app


app = create_app()
