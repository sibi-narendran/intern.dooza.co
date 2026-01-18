from typing import Optional
import logging

from app.config import get_settings

logger = logging.getLogger(__name__)

# Global checkpointer - initialized lazily
_checkpointer = None
_pool = None
_init_attempted = False

# Supabase client for direct queries
_supabase_client = None


def get_supabase_client():
    """
    Get or create Supabase client for direct database queries.
    Uses service role key for backend operations.
    """
    global _supabase_client
    
    if _supabase_client is not None:
        return _supabase_client
    
    settings = get_settings()
    
    try:
        from supabase import create_client
        _supabase_client = create_client(
            settings.supabase_url,
            settings.supabase_service_key
        )
        logger.info("Supabase client initialized")
        return _supabase_client
    except ImportError:
        logger.error("supabase-py not installed. Run: pip install supabase")
        return None
    except Exception as e:
        logger.error(f"Failed to init Supabase client: {e}")
        return None


async def init_checkpointer() -> None:
    """
    Initialize the database connection pool and LangGraph checkpointer.
    Tables are created manually - we skip auto-setup.
    """
    global _checkpointer, _pool, _init_attempted
    
    if _init_attempted:
        return
    
    _init_attempted = True
    settings = get_settings()
    
    try:
        from psycopg_pool import AsyncConnectionPool
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
        
        # Create connection pool
        _pool = AsyncConnectionPool(
            conninfo=settings.database_url,
            max_size=10,
            min_size=1,
            open=False,
        )
        await _pool.open()
        
        # Create checkpointer - tables already exist, skip setup
        _checkpointer = AsyncPostgresSaver(_pool)
        
        logger.info("Database checkpointer initialized successfully")
        
    except Exception as e:
        logger.warning(f"Failed to initialize database checkpointer: {e}")
        logger.warning("Chat will work but conversations won't persist")
        _checkpointer = None
        if _pool:
            try:
                await _pool.close()
            except:
                pass
        _pool = None


async def close_checkpointer() -> None:
    """Close the database connection pool."""
    global _pool
    
    if _pool:
        try:
            await _pool.close()
        except Exception as e:
            logger.warning(f"Error closing pool: {e}")


async def get_checkpointer_async():
    """
    Get the LangGraph checkpointer instance (async version with lazy init).
    Returns None if database is not available.
    """
    global _checkpointer, _init_attempted
    
    if _checkpointer is None and not _init_attempted:
        await init_checkpointer()
    
    return _checkpointer


def get_checkpointer():
    """
    Get the LangGraph checkpointer instance (sync version).
    Returns None if database is not available.
    """
    return _checkpointer
