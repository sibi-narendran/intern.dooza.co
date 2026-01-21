/**
 * Registry Module
 * 
 * Exports all registry functions and types for the workspace.
 */

export {
  // Types
  type Task,
  type TaskStatus,
  type FeedbackEntry,
  type TaskViewProps,
  type TaskEditProps,
  type WorkspaceConfig,
  // Status config
  STATUS_CONFIG,
  // Registry
  WORKSPACE_REGISTRY,
  getTaskConfig,
  getTaskConfigWithFallback,
  getCalendarColor,
  getRegisteredTaskTypes,
  isTaskTypeRegistered,
} from './workspace-components';
