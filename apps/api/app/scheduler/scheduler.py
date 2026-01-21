"""
Scheduler Setup

APScheduler with PostgreSQL persistence for scheduled publish jobs.
Jobs are persisted in the database - survives restarts.

IMPORTANT: Do NOT call scheduler.start() in main.py!
The scheduler should run as a separate singleton process.
See worker.py for the proper entry point.

Configuration:
- Uses SQLAlchemy job store with PostgreSQL
- Coalesce: true (combine missed runs)
- Max instances: 1 (prevent duplicate execution)
- Misfire grace time: 1 hour (catch up on missed jobs)
"""

from __future__ import annotations

import logging
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.executors.asyncio import AsyncIOExecutor

logger = logging.getLogger(__name__)


# =============================================================================
# SCHEDULER FACTORY
# =============================================================================

def create_scheduler(database_url: Optional[str] = None) -> AsyncIOScheduler:
    """
    Create APScheduler with PostgreSQL persistence.
    
    Args:
        database_url: PostgreSQL connection string.
                     If not provided, uses in-memory job store.
    
    Returns:
        Configured AsyncIOScheduler instance.
    """
    # Configure job stores
    jobstores = {}
    
    if database_url:
        # Convert async URL to sync for SQLAlchemy
        sync_url = database_url.replace(
            "postgresql+asyncpg://", "postgresql://"
        ).replace(
            "postgres://", "postgresql://"
        )
        
        jobstores['default'] = SQLAlchemyJobStore(
            url=sync_url,
            tablename='apscheduler_jobs',
        )
        logger.info("Scheduler configured with PostgreSQL job store")
    else:
        # In-memory fallback for development
        logger.warning("No database URL - using in-memory job store (jobs won't survive restart)")
    
    # Configure executors
    executors = {
        'default': AsyncIOExecutor(),
    }
    
    # Job defaults
    job_defaults = {
        'coalesce': True,  # Combine missed runs into single execution
        'max_instances': 1,  # Prevent duplicate execution
        'misfire_grace_time': 3600,  # 1 hour grace for missed jobs
    }
    
    # Create scheduler
    scheduler = AsyncIOScheduler(
        jobstores=jobstores,
        executors=executors,
        job_defaults=job_defaults,
        timezone='UTC',
    )
    
    return scheduler


# =============================================================================
# SINGLETON SCHEDULER
# =============================================================================

_scheduler: Optional[AsyncIOScheduler] = None


def get_scheduler() -> AsyncIOScheduler:
    """
    Get the scheduler singleton.
    
    Creates the scheduler on first call using settings from config.
    """
    global _scheduler
    
    if _scheduler is None:
        from app.config import get_settings
        settings = get_settings()
        _scheduler = create_scheduler(settings.database_url)
    
    return _scheduler


# Module-level scheduler for convenience
# Note: This is NOT started automatically - use worker.py
scheduler = get_scheduler()
