/**
 * WorkspacePage
 * 
 * Main workspace view with calendar and task detail panel.
 * Split-screen layout: Calendar on left, task details on right.
 */

import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Calendar, 
  Filter, 
  RefreshCw, 
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Task, STATUS_CONFIG } from '../registry';
import { WorkspaceCalendar, TaskDetailPanel } from '../components/workspace';
import { useWorkspaceTasks } from '../hooks/useWorkspaceTasks';

export default function WorkspacePage() {
  useAuth(); // Ensure authenticated
  
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Agent filter from URL
  const agentFilter = searchParams.get('agent') || '';
  
  // Use shared hook for task management
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
  } = useWorkspaceTasks({ 
    agentSlug: agentFilter || undefined, 
    statusFilter: statusFilter || undefined,
  });
  
  // Handle task selection from URL param
  useEffect(() => {
    const taskId = searchParams.get('task');
    if (taskId && tasks.length > 0) {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        selectTask(task);
      }
    }
  }, [searchParams, tasks, selectTask]);
  
  // Handle task click - also update URL
  const handleTaskClick = (task: Task) => {
    selectTask(task);
    setSearchParams({ task: task.id });
  };
  
  // Handle close detail panel - also clear URL
  const handleCloseDetail = () => {
    selectTask(null);
    setSearchParams({});
  };
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: 'var(--gray-50)',
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        backgroundColor: 'white',
        borderBottom: '1px solid var(--gray-200)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Calendar size={24} style={{ color: 'var(--primary-600)' }} />
          <h1 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--gray-900)',
          }}>
            Workspace
          </h1>
          {agentFilter && (
            <Link
              to="/workspace"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                backgroundColor: 'var(--primary-100)',
                color: 'var(--primary-700)',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              {agentFilter}
              <X size={12} />
            </Link>
          )}
          {pendingCount > 0 && (
            <span style={{
              padding: '4px 10px',
              backgroundColor: '#fef3c7',
              color: '#92400e',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
            }}>
              {pendingCount} pending
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Filter button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: showFilters ? 'var(--primary-50)' : 'white',
              border: `1px solid ${showFilters ? 'var(--primary-300)' : 'var(--gray-300)'}`,
              borderRadius: '8px',
              fontSize: '13px',
              color: showFilters ? 'var(--primary-700)' : 'var(--gray-700)',
              cursor: 'pointer',
            }}
          >
            <Filter size={14} />
            Filter
          </button>
          
          {/* Refresh button */}
          <button
            onClick={loadTasks}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              backgroundColor: 'white',
              border: '1px solid var(--gray-300)',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>
      
      {/* Filter bar */}
      {showFilters && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 24px',
          backgroundColor: 'white',
          borderBottom: '1px solid var(--gray-200)',
        }}>
          <span style={{ fontSize: '13px', color: 'var(--gray-600)' }}>Status:</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setStatusFilter('')}
              style={{
                padding: '4px 12px',
                backgroundColor: !statusFilter ? 'var(--primary-600)' : 'var(--gray-100)',
                color: !statusFilter ? 'white' : 'var(--gray-700)',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              All
            </button>
            {Object.entries(STATUS_CONFIG).map(([status, config]) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                style={{
                  padding: '4px 12px',
                  backgroundColor: statusFilter === status ? config.color : 'var(--gray-100)',
                  color: statusFilter === status ? 'white' : 'var(--gray-700)',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {config.label}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Messages */}
      {(error || successMessage) && (
        <div style={{
          padding: '12px 24px',
          backgroundColor: error ? '#fef2f2' : '#ecfdf5',
          borderBottom: `1px solid ${error ? '#fecaca' : '#a7f3d0'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          color: error ? '#dc2626' : '#059669',
        }}>
          {error ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
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
          flex: selectedTask ? '0 0 60%' : 1,
          padding: '24px',
          overflow: 'auto',
          transition: 'flex 0.2s ease',
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid var(--gray-200)',
            height: '100%',
            padding: '16px',
          }}>
            <WorkspaceCalendar
              tasks={tasks}
              onTaskClick={handleTaskClick}
              isLoading={isLoading}
            />
          </div>
        </div>
        
        {/* Task Detail Panel */}
        {selectedTask && (
          <div style={{
            flex: '0 0 40%',
            minWidth: '400px',
            maxWidth: '600px',
            overflow: 'auto',
          }}>
            <TaskDetailPanel
              task={selectedTask}
              onClose={handleCloseDetail}
              onStatusChange={handleStatusChange}
              onContentChange={handleContentChange}
              isUpdating={isUpdating}
            />
          </div>
        )}
      </div>
      
      {/* Loading overlay for initial load */}
      {isLoading && tasks.length === 0 && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary-600)' }} />
          <span style={{ color: 'var(--gray-600)' }}>Loading workspace...</span>
        </div>
      )}
      
      {/* Animation styles */}
      <style>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
