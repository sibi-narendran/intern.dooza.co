/**
 * Message Persistence Utilities
 * 
 * Provides resilient message saving with retry queue.
 * Messages that fail to save are queued in localStorage and
 * automatically retried on next page load.
 * 
 * Also includes tool data compression to keep storage efficient.
 */

// ============================================================================
// Types
// ============================================================================

export interface ToolCallSummary {
  name: string;
  args?: { url?: string };  // Only essential args
  status: 'pending' | 'running' | 'complete' | 'error';
  summary?: {
    score?: number;       // For SEO
    issueCount?: number;
    success?: boolean;
  };
}

export interface QueuedMessage {
  id: string;
  threadId: string;
  agentSlug: string;
  role: 'user' | 'assistant';
  content: string;
  toolCallsSummary?: ToolCallSummary[];
  timestamp: number;
  retryCount: number;
}

interface RetryQueue {
  messages: QueuedMessage[];
  lastAttempt: number;
}

// ============================================================================
// Constants
// ============================================================================

const RETRY_QUEUE_KEY = 'dooza_message_retry_queue';
const MAX_RETRY_COUNT = 5;
const MAX_QUEUE_SIZE = 100;  // Prevent localStorage from growing too large
const MAX_CONTENT_LENGTH = 50000;  // 50KB max per message content

// ============================================================================
// Tool Data Compression
// ============================================================================

/**
 * Compress full tool call data to a lightweight summary.
 * Reduces 50KB+ SEO results to ~200 bytes.
 * 
 * @param toolCalls - Full tool call data from streaming
 * @returns Compressed summaries suitable for storage
 */
export function compressToolCalls(toolCalls: Array<{
  name: string;
  args?: Record<string, unknown>;
  result?: unknown;
  status: string;
}>): ToolCallSummary[] {
  return toolCalls.map(tool => {
    // Preserve actual status - only map unknown statuses to 'error'
    const validStatuses = ['pending', 'running', 'complete', 'error'] as const;
    const status: ToolCallSummary['status'] = validStatuses.includes(tool.status as typeof validStatuses[number])
      ? (tool.status as ToolCallSummary['status'])
      : 'error';
    
    const summary: ToolCallSummary = {
      name: tool.name,
      status,
    };
    
    // Only keep essential args (e.g., URL for SEO tools)
    if (tool.args) {
      const essentialArgs: { url?: string } = {};
      if (typeof tool.args.url === 'string') {
        essentialArgs.url = tool.args.url;
      }
      if (Object.keys(essentialArgs).length > 0) {
        summary.args = essentialArgs;
      }
    }
    
    // Extract summary from result
    if (tool.result && typeof tool.result === 'object') {
      const result = tool.result as Record<string, unknown>;
      const resultSummary: ToolCallSummary['summary'] = {};
      
      // SEO results
      if (typeof result.overall_score === 'number') {
        resultSummary.score = result.overall_score;
      }
      if (typeof result.issues_count === 'number') {
        resultSummary.issueCount = result.issues_count;
      }
      
      // Generic success/failure
      if (typeof result.success === 'boolean') {
        resultSummary.success = result.success;
      }
      
      if (Object.keys(resultSummary).length > 0) {
        summary.summary = resultSummary;
      }
    }
    
    return summary;
  });
}

// ============================================================================
// Retry Queue Management
// ============================================================================

/**
 * Get the current retry queue from localStorage.
 */
export function getRetryQueue(): RetryQueue {
  try {
    const stored = localStorage.getItem(RETRY_QUEUE_KEY);
    if (stored) {
      return JSON.parse(stored) as RetryQueue;
    }
  } catch (e) {
    console.warn('Failed to parse retry queue:', e);
  }
  return { messages: [], lastAttempt: 0 };
}

/**
 * Save the retry queue to localStorage.
 */
function saveRetryQueue(queue: RetryQueue): void {
  try {
    localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to save retry queue:', e);
    // If localStorage is full, try to clear old messages
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      const trimmedQueue = {
        ...queue,
        messages: queue.messages.slice(-20),  // Keep only last 20
      };
      try {
        localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(trimmedQueue));
      } catch {
        // Give up - localStorage is really full
        console.error('localStorage quota exceeded, cannot save retry queue');
      }
    }
  }
}

/**
 * Add a message to the retry queue.
 * Called when a save request fails.
 * 
 * @param message - The message that failed to save
 */
export function queueMessageForRetry(message: Omit<QueuedMessage, 'timestamp' | 'retryCount'>): void {
  const queue = getRetryQueue();
  
  // Check if already queued (by id)
  if (queue.messages.some(m => m.id === message.id)) {
    return;
  }
  
  // Truncate content if too long
  const truncatedContent = message.content.length > MAX_CONTENT_LENGTH
    ? message.content.slice(0, MAX_CONTENT_LENGTH) + '...[truncated]'
    : message.content;
  
  const queuedMessage: QueuedMessage = {
    ...message,
    content: truncatedContent,
    timestamp: Date.now(),
    retryCount: 0,
  };
  
  queue.messages.push(queuedMessage);
  
  // Trim queue if too large
  if (queue.messages.length > MAX_QUEUE_SIZE) {
    queue.messages = queue.messages.slice(-MAX_QUEUE_SIZE);
  }
  
  saveRetryQueue(queue);
}

/**
 * Get messages from retry queue for a specific thread.
 * 
 * @param threadId - The thread to get queued messages for
 */
export function getQueuedMessagesForThread(threadId: string): QueuedMessage[] {
  const queue = getRetryQueue();
  return queue.messages.filter(m => m.threadId === threadId);
}

/**
 * Remove specific messages from the retry queue.
 * Called after successful save.
 * 
 * @param messageIds - IDs of messages to remove
 */
export function removeFromRetryQueue(messageIds: string[]): void {
  const queue = getRetryQueue();
  queue.messages = queue.messages.filter(m => !messageIds.includes(m.id));
  saveRetryQueue(queue);
}

/**
 * Clear all messages for a thread from the retry queue.
 * Called after successfully loading thread history.
 * 
 * @param threadId - The thread to clear
 */
export function clearRetryQueueForThread(threadId: string): void {
  const queue = getRetryQueue();
  queue.messages = queue.messages.filter(m => m.threadId !== threadId);
  saveRetryQueue(queue);
}

/**
 * Get all queued messages that should be retried.
 * Filters out messages that have exceeded max retry count.
 */
export function getMessagesToRetry(): QueuedMessage[] {
  const queue = getRetryQueue();
  return queue.messages.filter(m => m.retryCount < MAX_RETRY_COUNT);
}

/**
 * Mark messages as retried (increment retry count).
 * Called after a retry attempt fails.
 * 
 * @param messageIds - IDs of messages that were retried
 */
export function markMessagesRetried(messageIds: string[]): void {
  const queue = getRetryQueue();
  queue.messages = queue.messages.map(m => {
    if (messageIds.includes(m.id)) {
      return { ...m, retryCount: m.retryCount + 1 };
    }
    return m;
  });
  queue.lastAttempt = Date.now();
  
  // Remove messages that exceeded max retry count
  queue.messages = queue.messages.filter(m => m.retryCount < MAX_RETRY_COUNT);
  
  saveRetryQueue(queue);
}

/**
 * Check if there are any messages pending in the retry queue.
 */
export function hasQueuedMessages(): boolean {
  const queue = getRetryQueue();
  return queue.messages.length > 0;
}

/**
 * Get count of queued messages.
 */
export function getQueuedMessageCount(): number {
  const queue = getRetryQueue();
  return queue.messages.length;
}
