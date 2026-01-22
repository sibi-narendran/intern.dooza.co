/**
 * Chat Types
 * 
 * Structured types for the simplified chat architecture.
 * Frontend renders UI actions directly from backend - no reconstruction needed.
 */

// ============================================================================
// UI Action Types (Server-Driven UI)
// ============================================================================

/**
 * UI Action to prompt user to connect social platforms.
 * Frontend renders this as a card with connect buttons.
 */
export interface ConnectionPromptAction {
  type: 'connection_prompt'
  platforms: string[]
  message: string
}

/**
 * UI Action when a task is created in workspace.
 * Frontend renders this as a clickable card linking to the task.
 */
export interface TaskCreatedAction {
  type: 'task_created'
  task_id: string
  title: string
  platform: string
}

/**
 * UI Action for publish results.
 * Frontend renders this as a success/error card with optional link.
 */
export interface PublishResultAction {
  type: 'publish_result'
  platform: string
  success: boolean
  post_url?: string | null
  error?: string | null
}

/**
 * Union of all UI action types.
 * Add new action types here as the product expands.
 */
export type UIAction = 
  | ConnectionPromptAction 
  | TaskCreatedAction 
  | PublishResultAction

/**
 * Type guard for ConnectionPromptAction
 */
export function isConnectionPromptAction(action: UIAction): action is ConnectionPromptAction {
  return action.type === 'connection_prompt'
}

/**
 * Type guard for TaskCreatedAction
 */
export function isTaskCreatedAction(action: UIAction): action is TaskCreatedAction {
  return action.type === 'task_created'
}

/**
 * Type guard for PublishResultAction
 */
export function isPublishResultAction(action: UIAction): action is PublishResultAction {
  return action.type === 'publish_result'
}

// ============================================================================
// Connection State
// ============================================================================

/**
 * User's social platform connection status.
 * Provided by backend at conversation start.
 */
export interface ConnectionState {
  connected: string[]
  disconnected: string[]
}

// ============================================================================
// Structured Response (from backend)
// ============================================================================

/**
 * Structured response event from LangGraph backend.
 * Emitted at end of stream with all UI-relevant data.
 */
export interface StructuredResponse {
  event: 'structured_response'
  ui_actions: UIAction[]
  connections?: ConnectionState | null
  workflow_result?: WorkflowResult | null
  error?: string | null
}

/**
 * Workflow result from content_workflow or other specialists.
 */
export interface WorkflowResult {
  task_id?: string
  final_content?: {
    content?: string
    hashtags?: string[]
    title?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

// ============================================================================
// Tool Types (existing, kept for compatibility)
// ============================================================================

/**
 * A tool call during agent execution.
 */
export interface ToolCall {
  name: string
  args?: Record<string, unknown>
  result?: unknown
  status: 'pending' | 'running' | 'complete' | 'error'
  ui_schema?: Record<string, unknown>
}

/**
 * Structured tool data for specialized rendering.
 */
export interface ToolData {
  tool: string
  data: Record<string, unknown>
  category: string
}

// ============================================================================
// Message Types
// ============================================================================

/**
 * A chat message in the conversation.
 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  
  /** Tool calls made during this message */
  toolCalls?: ToolCall[]
  
  /** Structured UI actions from backend */
  uiActions?: UIAction[]
  
  /** Connection state at time of message */
  connections?: ConnectionState | null
  
  /** Whether this message is still streaming */
  isStreaming?: boolean
  
  /** Agent that generated this message */
  agentSlug?: string
}

// ============================================================================
// Event Callbacks
// ============================================================================

/**
 * Callbacks for chat streaming events.
 * Simplified - no segment/delegation tracking needed.
 */
export interface ChatStreamCallbacks {
  /** Token received from LLM */
  onToken?: (content: string) => void
  
  /** Tool execution started */
  onToolStart?: (toolName: string, args?: Record<string, unknown>) => void
  
  /** Tool execution completed */
  onToolEnd?: (toolName: string, result?: unknown, uiSchema?: Record<string, unknown>) => void
  
  /** Workflow node started (for progress display) */
  onNodeStart?: (nodeName: string) => void
  
  /** Workflow node completed */
  onNodeEnd?: (nodeName: string) => void
  
  /** Structured response received (at stream end) */
  onStructuredResponse?: (response: StructuredResponse) => void
  
  /** Thread ID received */
  onThreadId?: (threadId: string) => void
  
  /** Error occurred */
  onError?: (error: string) => void
  
  /** Stream completed */
  onEnd?: () => void
}
