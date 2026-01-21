/**
 * Tasks API Client
 * 
 * Functions for interacting with the workspace tasks API.
 */

import { supabase } from './supabase';
import { Task, TaskStatus } from '../registry';

// =============================================================================
// CONFIG
// =============================================================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  };
}

// =============================================================================
// TYPES
// =============================================================================

export interface TaskCreatePayload {
  task_type: string;
  title: string;
  content: Record<string, unknown>;
  due_date?: string;
}

export interface TaskUpdatePayload {
  content: Record<string, unknown>;
  version: number;
  title?: string;
}

export interface TaskStatusPayload {
  status: string;
  version: number;
  feedback?: string;
  scheduled_at?: string;
}

export interface TaskListResponse {
  tasks: Task[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface CalendarResponse {
  tasks: Task[];
  count: number;
}

export interface BulkUpdateResponse {
  updated: number;
  failed: Array<{ task_id: string; reason: string }>;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Create a new task
 */
export async function createTask(payload: TaskCreatePayload): Promise<Task> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/v1/tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw { response: { status: response.status, data: error } };
  }
  
  return response.json();
}

/**
 * List tasks with optional filters
 */
export async function listTasks(params?: {
  status?: string;
  agent_slug?: string;
  task_type?: string;
  page?: number;
  page_size?: number;
}): Promise<TaskListResponse> {
  const headers = await getAuthHeaders();
  const searchParams = new URLSearchParams();
  
  if (params?.status) searchParams.set('status', params.status);
  if (params?.agent_slug) searchParams.set('agent_slug', params.agent_slug);
  if (params?.task_type) searchParams.set('task_type', params.task_type);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  
  const query = searchParams.toString();
  const response = await fetch(`${API_BASE}/v1/tasks${query ? `?${query}` : ''}`, { headers });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw { response: { status: response.status, data: error } };
  }
  
  return response.json();
}

/**
 * Get a single task by ID
 */
export async function getTask(taskId: string): Promise<Task> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/v1/tasks/${taskId}`, { headers });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw { response: { status: response.status, data: error } };
  }
  
  return response.json();
}

/**
 * Update task content
 */
export async function updateTask(
  taskId: string, 
  payload: TaskUpdatePayload
): Promise<Task> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/v1/tasks/${taskId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw { response: { status: response.status, data: error } };
  }
  
  return response.json();
}

/**
 * Update task status (approve, reject, schedule, etc.)
 */
export async function updateTaskStatus(
  taskId: string,
  payload: TaskStatusPayload
): Promise<Task> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/v1/tasks/${taskId}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw { response: { status: response.status, data: error } };
  }
  
  return response.json();
}

/**
 * Cancel (soft delete) a task
 */
export async function cancelTask(taskId: string, version: number): Promise<Task> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/v1/tasks/${taskId}?version=${version}`, {
    method: 'DELETE',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw { response: { status: response.status, data: error } };
  }
  
  return response.json();
}

/**
 * Get tasks for calendar view
 */
export async function getCalendarTasks(params: {
  start_date: string;
  end_date: string;
  status?: string;
  agent_slug?: string;
}): Promise<CalendarResponse> {
  const headers = await getAuthHeaders();
  const searchParams = new URLSearchParams();
  searchParams.set('start_date', params.start_date);
  searchParams.set('end_date', params.end_date);
  if (params.status) searchParams.set('status', params.status);
  if (params.agent_slug) searchParams.set('agent_slug', params.agent_slug);
  
  const response = await fetch(`${API_BASE}/v1/tasks/calendar?${searchParams.toString()}`, { headers });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw { response: { status: response.status, data: error } };
  }
  
  return response.json();
}

/**
 * Get count of pending approval tasks
 */
export async function getPendingCount(): Promise<number> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/v1/tasks/pending/count`, { headers });
  
  if (!response.ok) {
    // Return 0 on error to avoid breaking UI
    console.error('Failed to get pending count');
    return 0;
  }
  
  const data = await response.json();
  return data.count;
}

/**
 * Bulk update task status
 */
export async function bulkUpdateStatus(
  taskIds: string[],
  status: string
): Promise<BulkUpdateResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/v1/tasks/bulk/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ task_ids: taskIds, status }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw { response: { status: response.status, data: error } };
  }
  
  return response.json();
}

// =============================================================================
// HOOKS-FRIENDLY HELPERS
// =============================================================================

/**
 * Check if an error is a conflict error (version mismatch)
 */
export function isConflictError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    (error as { response?: { status?: number } }).response?.status === 409
  );
}

/**
 * Check if an error is a validation error
 */
export function isValidationError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    (error as { response?: { status?: number } }).response?.status === 422
  );
}

/**
 * Check if an error is an invalid transition error
 */
export function isTransitionError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    (error as { response?: { status?: number } }).response?.status === 400
  );
}

/**
 * Get error message from API error
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const e = error as { response?: { data?: { detail?: string | { message?: string } } } };
    const detail = e.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (typeof detail === 'object' && detail?.message) return detail.message;
  }
  return 'An unexpected error occurred';
}
