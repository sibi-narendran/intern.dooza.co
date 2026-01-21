-- Migration 008: Publish Pipeline
-- Adds fields for social media publishing workflow with Composio
-- Includes APScheduler job store table for scheduled posts

-- ============================================================================
-- TASK STATUS: Remove constraint to allow new status values
-- ============================================================================
-- Note: We use text field for status, not enum, so we just need to update
-- the application-level validation in tasks.py

-- ============================================================================
-- PUBLISH TRACKING COLUMNS
-- ============================================================================

-- Target platforms for publishing (e.g., ['instagram', 'linkedin'])
ALTER TABLE workspace_tasks ADD COLUMN IF NOT EXISTS 
    target_platforms text[] DEFAULT '{}';

-- Connection IDs mapping: {"instagram": "conn_123", "linkedin": "conn_456"}
ALTER TABLE workspace_tasks ADD COLUMN IF NOT EXISTS 
    connection_ids jsonb DEFAULT '{}';

-- Publish results per platform: {"instagram": {"success": true, "post_url": "..."}}
ALTER TABLE workspace_tasks ADD COLUMN IF NOT EXISTS 
    publish_results jsonb DEFAULT '{}';

-- Scheduled publish time (when task should be published)
ALTER TABLE workspace_tasks ADD COLUMN IF NOT EXISTS 
    scheduled_for timestamptz;

-- Retry count for failed publishes
ALTER TABLE workspace_tasks ADD COLUMN IF NOT EXISTS 
    retry_count int DEFAULT 0;

-- LangGraph checkpoint state for resumable publishing
-- Stores workflow state so publishing can resume after crashes
ALTER TABLE workspace_tasks ADD COLUMN IF NOT EXISTS 
    publish_checkpoint jsonb;

-- ============================================================================
-- INDEXES FOR PUBLISH QUERIES
-- ============================================================================

-- Index for finding scheduled tasks that are due
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_scheduled_for 
    ON workspace_tasks (scheduled_for) 
    WHERE scheduled_for IS NOT NULL AND status = 'scheduled';

-- Index for finding tasks by status (for dashboard queries)
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_status 
    ON workspace_tasks (status);

-- ============================================================================
-- APSCHEDULER JOB STORE TABLE
-- Required for APScheduler with SQLAlchemy job store
-- Jobs persist across restarts - critical for scheduled posts
-- ============================================================================

CREATE TABLE IF NOT EXISTS apscheduler_jobs (
    id VARCHAR(191) NOT NULL PRIMARY KEY,
    next_run_time DOUBLE PRECISION,
    job_state BYTEA NOT NULL
);

-- Index for efficient job retrieval by next run time
CREATE INDEX IF NOT EXISTS ix_apscheduler_jobs_next_run_time 
    ON apscheduler_jobs (next_run_time);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN workspace_tasks.target_platforms IS 
    'Array of platforms to publish to: instagram, facebook, linkedin, tiktok, youtube';

COMMENT ON COLUMN workspace_tasks.connection_ids IS 
    'JSON mapping platform to Composio connection_id for the user';

COMMENT ON COLUMN workspace_tasks.publish_results IS 
    'JSON with per-platform publish results including post URLs and IDs';

COMMENT ON COLUMN workspace_tasks.scheduled_for IS 
    'Timestamp when the task should be automatically published';

COMMENT ON COLUMN workspace_tasks.retry_count IS 
    'Number of publish retry attempts (for failed publishes)';

COMMENT ON COLUMN workspace_tasks.publish_checkpoint IS 
    'LangGraph workflow checkpoint for resumable publishing';

COMMENT ON TABLE apscheduler_jobs IS 
    'APScheduler job store for scheduled publish tasks';
