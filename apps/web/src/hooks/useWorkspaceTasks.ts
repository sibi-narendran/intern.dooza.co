/**
 * useWorkspaceTasks
 * 
 * Custom hook for workspace task management.
 * Handles loading, updating, and status changes for tasks.
 * 
 * Used by both WorkspacePage and WorkspaceEmbed to avoid code duplication.
 */

import { useState, useEffect, useCallback } from 'react';
import { Task, TaskStatus, STATUS_CONFIG } from '../registry';
import {
  getCalendarTasks,
  updateTask,
  updateTaskStatus,
  getPendingCount,
  isConflictError,
  getErrorMessage,
} from '../lib/tasks-api';

interface UseWorkspaceTasksOptions {
  agentSlug?: string;
  statusFilter?: string;
}

interface UseWorkspaceTasksReturn {
  // State
  tasks: Task[];
  selectedTask: Task | null;
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;
  successMessage: string | null;
  pendingCount: number;
  
  // Actions
  loadTasks: () => Promise<void>;
  selectTask: (task: Task | null) => void;
  handleStatusChange: (status: string, feedback?: string, scheduledAt?: Date) => Promise<void>;
  handleContentChange: (content: Record<string, unknown>) => Promise<void>;
  clearMessages: () => void;
}

/**
 * Get date range for calendar (current month + next month)
 */
function getDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  return {
    start_date: start.toISOString(),
    end_date: end.toISOString(),
  };
}

export function useWorkspaceTasks(options: UseWorkspaceTasksOptions = {}): UseWorkspaceTasksReturn {
  const { agentSlug, statusFilter } = options;
  
  // State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  
  // Load tasks
  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const dateRange = getDateRange();
      const response = await getCalendarTasks({
        ...dateRange,
        status: statusFilter || undefined,
        agent_slug: agentSlug || undefined,
      });
      setTasks(response.tasks);
      
      const count = await getPendingCount();
      setPendingCount(count);
    } catch (err) {
      console.error('Failed to load tasks:', err);
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [agentSlug, statusFilter]);
  
  // Initial load
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);
  
  // Select task
  const selectTask = useCallback((task: Task | null) => {
    setSelectedTask(task);
  }, []);
  
  // Handle status change
  const handleStatusChange = useCallback(async (
    status: string, 
    feedback?: string,
    scheduledAt?: Date
  ) => {
    if (!selectedTask) return;
    
    setIsUpdating(true);
    setError(null);
    
    try {
      const updated = await updateTaskStatus(selectedTask.id, {
        status,
        version: selectedTask.version,
        feedback,
        scheduled_at: scheduledAt?.toISOString(),
      });
      
      setSelectedTask(updated);
      setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
      
      const statusLabel = STATUS_CONFIG[status as TaskStatus]?.label || status;
      setSuccessMessage(`Task ${statusLabel.toLowerCase()}`);
      setTimeout(() => setSuccessMessage(null), 3000);
      
      // Reload to get fresh counts
      loadTasks();
    } catch (err) {
      console.error('Failed to update status:', err);
      if (isConflictError(err)) {
        setError('This task was modified. Please refresh and try again.');
        loadTasks();
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setIsUpdating(false);
    }
  }, [selectedTask, loadTasks]);
  
  // Handle content change
  const handleContentChange = useCallback(async (content: Record<string, unknown>) => {
    if (!selectedTask) return;
    
    setIsUpdating(true);
    setError(null);
    
    try {
      const updated = await updateTask(selectedTask.id, {
        content,
        version: selectedTask.version,
      });
      
      setSelectedTask(updated);
      setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
      
      setSuccessMessage('Changes saved');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Failed to update task:', err);
      if (isConflictError(err)) {
        setError('This task was modified. Please refresh and try again.');
        loadTasks();
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setIsUpdating(false);
    }
  }, [selectedTask, loadTasks]);
  
  // Clear messages
  const clearMessages = useCallback(() => {
    setError(null);
    setSuccessMessage(null);
  }, []);
  
  return {
    tasks,
    selectedTask,
    isLoading,
    isUpdating,
    error,
    successMessage,
    pendingCount,
    loadTasks,
    selectTask,
    handleStatusChange,
    handleContentChange,
    clearMessages,
  };
}
