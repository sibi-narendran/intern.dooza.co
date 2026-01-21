/**
 * TaskRenderer
 * 
 * Dynamic component renderer for workspace tasks.
 * Resolves the correct view/edit component from the registry
 * based on agent_slug:task_type.
 * 
 * Falls back to a generic component for unregistered task types.
 */

import { Suspense } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { 
  Task, 
  getTaskConfigWithFallback,
} from '../../registry';
import ErrorBoundary from '../ErrorBoundary';

interface TaskRendererProps {
  task: Task;
  mode?: 'view' | 'edit';
  onSave?: (content: Record<string, unknown>) => void;
  onCancel?: () => void;
  isSaving?: boolean;
}

/**
 * Loading placeholder for lazy-loaded components
 */
function LoadingPlaceholder() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px',
      color: 'var(--gray-500)',
    }}>
      <Loader2 size={24} className="animate-spin" style={{ marginRight: '12px' }} />
      <span>Loading...</span>
    </div>
  );
}

/**
 * Error fallback for failed component loads
 */
function ErrorFallback({ task }: { task: Task }) {
  return (
    <div style={{
      padding: '20px',
      borderRadius: '8px',
      backgroundColor: '#fef2f2',
      border: '1px solid #fecaca',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
        color: '#dc2626',
      }}>
        <AlertTriangle size={20} />
        <span style={{ fontWeight: 500 }}>Failed to load task view</span>
      </div>
      <pre style={{
        fontSize: '12px',
        backgroundColor: '#fee2e2',
        padding: '12px',
        borderRadius: '4px',
        overflow: 'auto',
        maxHeight: '200px',
      }}>
        {JSON.stringify(task.content_payload, null, 2)}
      </pre>
    </div>
  );
}

/**
 * TaskRenderer Component
 * 
 * Renders the appropriate view or edit component for a task.
 */
export default function TaskRenderer({ 
  task, 
  mode = 'view',
  onSave,
  onCancel,
  isSaving = false,
}: TaskRendererProps) {
  // Get component config (with fallback for unknown types)
  const config = getTaskConfigWithFallback(task.agent_slug, task.task_type);
  
  // Select view or edit component
  const Component = mode === 'edit' ? config.edit : config.view;
  
  return (
    <ErrorBoundary
      fallback={<ErrorFallback task={task} />}
    >
      <Suspense fallback={<LoadingPlaceholder />}>
        {mode === 'edit' ? (
          <Component
            task={task}
            data={task.content_payload}
            onSave={onSave || (() => {})}
            onCancel={onCancel || (() => {})}
            isSaving={isSaving}
          />
        ) : (
          <Component
            task={task}
            data={task.content_payload}
          />
        )}
      </Suspense>
    </ErrorBoundary>
  );
}

/**
 * Compact task preview for calendar events and lists
 */
export function TaskPreview({ task }: { task: Task }) {
  const config = getTaskConfigWithFallback(task.agent_slug, task.task_type);
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      borderRadius: '6px',
      backgroundColor: 'var(--gray-50)',
      border: '1px solid var(--gray-200)',
    }}>
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: config.color,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--gray-900)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {task.title}
        </div>
        <div style={{
          fontSize: '11px',
          color: 'var(--gray-500)',
        }}>
          {config.label}
        </div>
      </div>
    </div>
  );
}
