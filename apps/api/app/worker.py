"""
Singleton Scheduler Worker

Run as a SEPARATE PROCESS to prevent duplicate scheduled posts.
DO NOT run scheduler.start() in main.py!

Usage:
    python -m app.worker

This process ONLY runs the scheduler. It is designed to be:
1. Singleton - only one instance should run
2. Long-lived - runs until explicitly stopped
3. Separate - not part of the API server

Architecture:
    ┌─────────────────────────────┐
    │  API Server (main.py)       │
    │  - Handles HTTP requests    │
    │  - Schedules jobs           │
    │  - Can scale horizontally   │
    └─────────────────────────────┘
                 │
                 │ Add/remove jobs
                 ▼
    ┌─────────────────────────────┐
    │  PostgreSQL                 │
    │  - apscheduler_jobs table   │
    │  - Shared between API and   │
    │    Worker                   │
    └─────────────────────────────┘
                 │
                 │ Read jobs
                 ▼
    ┌─────────────────────────────┐
    │  Scheduler Worker (this)    │ ◄── SINGLETON
    │  - Executes scheduled jobs  │
    │  - Must be single instance  │
    │  - Prevents duplicate posts │
    └─────────────────────────────┘
                 │
                 │ Calls
                 ▼
    ┌─────────────────────────────┐
    │  PublishService.execute()   │
    │  - Same service as API uses │
    │  - Zero Regret pattern      │
    └─────────────────────────────┘

Deployment:
    # Production: Two separate processes
    
    # 1. API Server (can scale horizontally)
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
    
    # 2. Scheduler Worker (SINGLETON - only one instance!)
    python -m app.worker

Docker Compose example:
    services:
      api:
        command: uvicorn app.main:app --host 0.0.0.0 --port 8000
        deploy:
          replicas: 2  # Can scale
      
      scheduler:
        command: python -m app.worker
        deploy:
          replicas: 1  # MUST be 1 - singleton!
"""

import asyncio
import signal
import sys
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)


async def startup_check():
    """Verify database connection and job store."""
    from app.core.database import get_supabase_client
    from app.scheduler.jobs import get_scheduled_jobs
    
    # Check database
    supabase = get_supabase_client()
    if not supabase:
        logger.error("❌ Database not available - cannot start scheduler")
        return False
    
    logger.info("✅ Database connection OK")
    
    # List existing jobs
    jobs = get_scheduled_jobs()
    logger.info(f"📋 Found {len(jobs)} scheduled jobs in database")
    for job in jobs[:5]:  # Show first 5
        logger.info(f"   - Task {job['task_id']} scheduled for {job['next_run_time']}")
    if len(jobs) > 5:
        logger.info(f"   ... and {len(jobs) - 5} more")
    
    return True


async def run_scheduler():
    """Async entry point that runs the scheduler within an event loop."""
    from app.scheduler.scheduler import scheduler
    
    # Run startup check
    if not await startup_check():
        logger.error("Startup check failed, exiting")
        sys.exit(1)
    
    # Start the scheduler (now within a running event loop)
    logger.info("=" * 60)
    logger.info("🟢 Starting scheduler...")
    scheduler.start()
    logger.info("✅ Scheduler is now running")
    logger.info("   Waiting for scheduled jobs...")
    logger.info("=" * 60)
    logger.info("")
    
    # Keep running until interrupted
    stop_event = asyncio.Event()
    
    def handle_stop():
        logger.info("🛑 Received shutdown signal...")
        stop_event.set()
    
    # Register signal handlers for graceful shutdown
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, handle_stop)
    
    try:
        await stop_event.wait()
    finally:
        logger.info("Shutting down scheduler...")
        scheduler.shutdown(wait=True)
        logger.info("✅ Scheduler stopped cleanly")


def main():
    """Main entry point for the scheduler worker."""
    logger.info("=" * 60)
    logger.info("🚀 Starting Dooza Scheduler Worker")
    logger.info("=" * 60)
    logger.info("")
    logger.info("📌 IMPORTANT: This is a SINGLETON process.")
    logger.info("   Only ONE instance should run at a time.")
    logger.info("   Do NOT scale this horizontally!")
    logger.info("")
    logger.info(f"⏰ Started at: {datetime.utcnow().isoformat()}Z")
    logger.info("")
    logger.info("Supported platforms:")
    logger.info("   • Instagram")
    logger.info("   • Facebook")
    logger.info("   • LinkedIn")
    logger.info("   • TikTok")
    logger.info("   • YouTube")
    logger.info("")
    
    try:
        asyncio.run(run_scheduler())
    except KeyboardInterrupt:
        logger.info("Scheduler stopped by user")


if __name__ == "__main__":
    main()
