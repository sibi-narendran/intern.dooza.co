/**
 * Workspace Component Registry
 * 
 * Maps task types to their view and edit components.
 * Uses lazy loading for code splitting.
 * 
 * This is the "plugin system" - adding a new task type only requires:
 * 1. Adding a new entry here
 * 2. Creating the view/edit components
 */

import { lazy, ComponentType, LazyExoticComponent } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface Task {
  id: string;
  agent_slug: string;
  task_type: string;
  title: string;
  status: TaskStatus;
  content_payload: Record<string, unknown>;
  due_date: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  feedback_history: FeedbackEntry[];
  version: number;
  thread_id: string | null;
  created_at: string;
  updated_at: string;
  // Publish pipeline fields
  target_platforms?: string[];
  connection_ids?: Record<string, string>;
  publish_results?: {
    results?: Record<string, {
      success: boolean;
      platform: string;
      post_id?: string;
      post_url?: string;
      error?: string;
    }>;
    errors?: Record<string, string>;
    platforms_completed?: string[];
  };
  scheduled_for?: string | null;
  retry_count?: number;
}

export type TaskStatus = 
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'partially_published'
  | 'failed'
  | 'rejected'
  | 'cancelled';

export interface FeedbackEntry {
  feedback: string;
  rejected_at: string;
  rejected_by?: string;
}

export interface TaskViewProps {
  task: Task;
  data: Record<string, unknown>;
}

export interface TaskEditProps {
  task: Task;
  data: Record<string, unknown>;
  onSave: (content: Record<string, unknown>) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export interface WorkspaceConfig {
  /** Component for viewing the task */
  view: LazyExoticComponent<ComponentType<TaskViewProps>>;
  /** Component for editing the task */
  edit: LazyExoticComponent<ComponentType<TaskEditProps>>;
  /** Color for calendar events */
  color: string;
  /** Lucide icon name */
  icon: string;
  /** Human-readable label */
  label: string;
}

// =============================================================================
// STATUS CONFIGURATION
// =============================================================================

export const STATUS_CONFIG: Record<TaskStatus, {
  color: string;
  bgColor: string;
  label: string;
  icon: string;
}> = {
  draft: {
    color: '#6b7280',
    bgColor: '#f3f4f6',
    label: 'Draft',
    icon: 'FileEdit',
  },
  pending_approval: {
    color: '#f59e0b',
    bgColor: '#fef3c7',
    label: 'Pending Approval',
    icon: 'Clock',
  },
  approved: {
    color: '#10b981',
    bgColor: '#d1fae5',
    label: 'Approved',
    icon: 'CheckCircle',
  },
  scheduled: {
    color: '#3b82f6',
    bgColor: '#dbeafe',
    label: 'Scheduled',
    icon: 'Calendar',
  },
  publishing: {
    color: '#0ea5e9',
    bgColor: '#e0f2fe',
    label: 'Publishing',
    icon: 'Loader2',
  },
  published: {
    color: '#8b5cf6',
    bgColor: '#ede9fe',
    label: 'Published',
    icon: 'Globe',
  },
  partially_published: {
    color: '#f97316',
    bgColor: '#ffedd5',
    label: 'Partially Published',
    icon: 'AlertTriangle',
  },
  failed: {
    color: '#dc2626',
    bgColor: '#fee2e2',
    label: 'Failed',
    icon: 'XCircle',
  },
  rejected: {
    color: '#ef4444',
    bgColor: '#fee2e2',
    label: 'Rejected',
    icon: 'XCircle',
  },
  cancelled: {
    color: '#9ca3af',
    bgColor: '#f3f4f6',
    label: 'Cancelled',
    icon: 'Ban',
  },
};

// =============================================================================
// COMPONENT REGISTRY
// =============================================================================

/**
 * Registry mapping agent:task_type to components.
 * 
 * Adding a new task type:
 * 1. Create view component in domains/{domain}/
 * 2. Create edit component in domains/{domain}/
 * 3. Add entry here with lazy imports
 */
export const WORKSPACE_REGISTRY: Record<string, WorkspaceConfig> = {
  // SEO Domain
  'seomi:blog_post': {
    view: lazy(() => import('../domains/seo/BlogCard')),
    edit: lazy(() => import('../domains/seo/BlogEditor')),
    color: '#10b981',
    icon: 'FileText',
    label: 'Blog Post',
  },
  'seomi:content_brief': {
    view: lazy(() => import('../domains/seo/ContentBriefCard')),
    edit: lazy(() => import('../domains/seo/ContentBriefEditor')),
    color: '#059669',
    icon: 'FileSearch',
    label: 'Content Brief',
  },
  
  // Social Domain
  'soshie:tweet': {
    view: lazy(() => import('../domains/social/TweetCard')),
    edit: lazy(() => import('../domains/social/TweetEditor')),
    color: '#8b5cf6',
    icon: 'Twitter',
    label: 'Tweet',
  },
  'soshie:social_post': {
    view: lazy(() => import('../domains/social/SocialPostCard')),
    edit: lazy(() => import('../domains/social/SocialPostEditor')),
    color: '#7c3aed',
    icon: 'Share2',
    label: 'Social Post',
  },
  'soshie:linkedin_post': {
    view: lazy(() => import('../domains/social/LinkedInPostCard')),
    edit: lazy(() => import('../domains/social/LinkedInPostEditor')),
    color: '#0077b5',
    icon: 'Linkedin',
    label: 'LinkedIn Post',
  },
  
  // Video Domain
  'vidi:video_script': {
    view: lazy(() => import('../domains/video/VideoScriptCard')),
    edit: lazy(() => import('../domains/video/VideoScriptEditor')),
    color: '#f59e0b',
    icon: 'Video',
    label: 'Video Script',
  },
};

// =============================================================================
// REGISTRY HELPERS
// =============================================================================

/**
 * Get component config for a task.
 * Returns null if task type is not registered.
 */
export function getTaskConfig(agentSlug: string, taskType: string): WorkspaceConfig | null {
  const key = `${agentSlug}:${taskType}`;
  return WORKSPACE_REGISTRY[key] || null;
}

/**
 * Get component config with fallback for unknown types.
 * Uses a generic fallback component for unregistered task types.
 */
export function getTaskConfigWithFallback(agentSlug: string, taskType: string): WorkspaceConfig {
  const config = getTaskConfig(agentSlug, taskType);
  if (config) return config;
  
  // Fallback for unknown task types
  return {
    view: lazy(() => import('../domains/generic/GenericTaskCard')),
    edit: lazy(() => import('../domains/generic/GenericTaskEditor')),
    color: '#6b7280',
    icon: 'File',
    label: taskType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
  };
}

/**
 * Get calendar color for a task based on status.
 */
export function getCalendarColor(task: Task): string {
  // Use status color as primary (user cares more about status than type)
  return STATUS_CONFIG[task.status]?.color || '#6b7280';
}

/**
 * Get all registered task types.
 */
export function getRegisteredTaskTypes(): string[] {
  return Object.keys(WORKSPACE_REGISTRY);
}

/**
 * Check if a task type is registered.
 */
export function isTaskTypeRegistered(agentSlug: string, taskType: string): boolean {
  return `${agentSlug}:${taskType}` in WORKSPACE_REGISTRY;
}
