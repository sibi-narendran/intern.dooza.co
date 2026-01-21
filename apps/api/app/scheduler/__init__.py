"""
Scheduler Module

APScheduler-based job scheduling for the publish pipeline.
Uses PostgreSQL for job persistence - jobs survive restarts.

Important: The scheduler should run as a SINGLETON worker process,
separate from the API server. See worker.py for entry point.
"""

from app.scheduler.scheduler import scheduler, create_scheduler
from app.scheduler.jobs import (
    schedule_publish,
    cancel_scheduled,
    get_scheduled_jobs,
)

__all__ = [
    "scheduler",
    "create_scheduler",
    "schedule_publish",
    "cancel_scheduled",
    "get_scheduled_jobs",
]
