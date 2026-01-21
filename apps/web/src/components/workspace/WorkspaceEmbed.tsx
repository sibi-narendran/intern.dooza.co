/**
 * WorkspaceEmbed
 * 
 * Embedded workspace view for showing within agent chat pages.
 * Displays calendar and task management without leaving the chat context.
 */

import { 
  RefreshCw, 
  Loader2,
  AlertCircle,
  CheckCircle,
  MessageSquare,
} from 'lucide-react';
import { useWorkspaceTasks } from '../../hooks/useWorkspaceTasks';
import { WorkspaceCalendar, TaskDetailPanel } from './index';

interface WorkspaceEmbedProps {
  agentSlug: string;
  onBackToChat: () => void;
}

export default function WorkspaceEmbed({ agentSlug, onBackToChat }: WorkspaceEmbedProps) {
  const {
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
  } = useWorkspaceTasks({ agentSlug });
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'var(--gray-50)',
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        backgroundColor: 'white',
        borderBottom: '1px solid var(--gray-200)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--gray-900)',
          }}>
            Workspace
          </h2>
          {pendingCount > 0 && (
            <span style={{
              padding: '2px 8px',
              backgroundColor: '#fef3c7',
              color: '#92400e',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 600,
            }}>
              {pendingCount} pending
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={loadTasks}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              backgroundColor: 'white',
              border: '1px solid var(--gray-300)',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
            title="Refresh"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onBackToChat}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: 'var(--primary-600)',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <MessageSquare size={14} />
            Back to Chat
          </button>
        </div>
      </header>
      
      {/* Messages */}
      {(error || successMessage) && (
        <div style={{
          padding: '8px 20px',
          backgroundColor: error ? '#fef2f2' : '#ecfdf5',
          borderBottom: `1px solid ${error ? '#fecaca' : '#a7f3d0'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          color: error ? '#dc2626' : '#059669',
        }}>
          {error ? <AlertCircle size={14} /> : <CheckCircle size={14} />}
          {error || successMessage}
        </div>
      )}
      
      {/* Main content */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
      }}>
        {/* Calendar */}
        <div style={{
          flex: selectedTask ? '0 0 55%' : 1,
          padding: '16px',
          overflow: 'auto',
          transition: 'flex 0.2s ease',
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '10px',
            border: '1px solid var(--gray-200)',
            height: '100%',
            padding: '12px',
          }}>
            {tasks.length === 0 && !isLoading ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--gray-500)',
                gap: '12px',
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--gray-100)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  📅
                </div>
                <p style={{ margin: 0, fontSize: '14px' }}>No scheduled tasks yet</p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--gray-400)' }}>
                  Ask me to create social posts and they'll appear here
                </p>
              </div>
            ) : (
              <WorkspaceCalendar
                tasks={tasks}
                onTaskClick={selectTask}
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
        
        {/* Task Detail Panel */}
        {selectedTask && (
          <div style={{
            flex: '0 0 45%',
            minWidth: '350px',
            maxWidth: '500px',
            overflow: 'auto',
          }}>
            <TaskDetailPanel
              task={selectedTask}
              onClose={() => selectTask(null)}
              onStatusChange={handleStatusChange}
              onContentChange={handleContentChange}
              isUpdating={isUpdating}
            />
          </div>
        )}
      </div>
      
      {/* Loading overlay */}
      {isLoading && tasks.length === 0 && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '12px',
        }}>
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--primary-600)' }} />
          <span style={{ color: 'var(--gray-600)', fontSize: '13px' }}>Loading workspace...</span>
        </div>
      )}
    </div>
  );
}
