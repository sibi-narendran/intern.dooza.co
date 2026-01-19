"""
Database Module

Manages database connections:
- Supabase client for direct queries
- LangGraph checkpointer for conversation persistence

Production-ready with:
- Thread-safe singleton initialization
- Graceful fallback on connection failures
- Proper connection pool management
"""

from __future__ import annotations
import asyncio
import logging
import threading
from typing import Any, Optional

from app.config import get_settings

logger = logging.getLogger(__name__)

# Global state with thread locks
_checkpointer: Any = None
_pool: Any = None
_init_lock = asyncio.Lock() if hasattr(asyncio, 'Lock') else None
_init_attempted = False

# Supabase client (thread-safe with lock)
_supabase_client: Any = None
_supabase_lock = threading.Lock()


def get_supabase_client() -> Any:
    """
    Get or create Supabase client for direct database queries.
    Uses service role key for backend operations.
    
    Thread-safe singleton implementation.
    
    Returns:
        Supabase client or None if initialization fails
    """
    global _supabase_client
    
    if _supabase_client is not None:
        return _supabase_client
    
    with _supabase_lock:
        # Double-check after acquiring lock
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
    
    Standard LangGraph production pattern:
    - Creates connection pool
    - Initializes checkpointer
    - Runs setup() to ensure tables exist and are up-to-date
    
    Thread-safe async initialization.
    """
    global _checkpointer, _pool, _init_attempted, _init_lock
    
    # Early return if already attempted (avoids acquiring lock)
    if _init_attempted:
        return
    
    # Create lock if not exists (handles module import scenarios)
    if _init_lock is None:
        _init_lock = asyncio.Lock()
    
    async with _init_lock:
        # Double-check after acquiring lock
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
            
            # Create checkpointer
            _checkpointer = AsyncPostgresSaver(_pool)
            
            # Standard LangGraph pattern: ensure tables exist and are up-to-date
            await _checkpointer.setup()
            
            logger.info("Database checkpointer initialized successfully")
            
        except ImportError as e:
            logger.warning(f"Missing dependency for checkpointer: {e}")
            logger.warning("Chat will work but conversations won't persist")
            _checkpointer = None
        except Exception as e:
            logger.warning(f"Failed to initialize database checkpointer: {e}")
            logger.warning("Chat will work but conversations won't persist")
            _checkpointer = None
            if _pool:
                try:
                    await _pool.close()
                except Exception:
                    pass
            _pool = None


async def close_checkpointer() -> None:
    """Close the database connection pool."""
    global _pool, _checkpointer, _init_attempted
    
    if _pool:
        try:
            await _pool.close()
            logger.info("Database connection pool closed")
        except Exception as e:
            logger.warning(f"Error closing pool: {e}")
        finally:
            _pool = None
            _checkpointer = None
            _init_attempted = False


async def get_checkpointer_async() -> Any:
    """
    Get the LangGraph checkpointer instance (async version with lazy init).
    
    Returns:
        Checkpointer instance or None if database is not available
    """
    global _checkpointer, _init_attempted
    
    if _checkpointer is None and not _init_attempted:
        await init_checkpointer()
    
    return _checkpointer


def get_checkpointer() -> Any:
    """
    Get the LangGraph checkpointer instance (sync version).
    
    Note: Does NOT initialize if not already done. Call init_checkpointer()
    at app startup or use get_checkpointer_async() for lazy init.
    
    Returns:
        Checkpointer instance or None if not initialized/available
    """
    return _checkpointer
