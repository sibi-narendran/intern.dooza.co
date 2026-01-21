/**
 * TaskDetailPanel
 * 
 * Slide-out panel for viewing and editing task details.
 * Shows task metadata, content, approval actions, and publish results.
 */

import { useState } from 'react';
import { 
  X, 
  Edit2, 
  Calendar, 
  Clock, 
  User, 
  MessageSquare,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Task, STATUS_CONFIG, getTaskConfigWithFallback } from '../../registry';
import TaskRenderer from './TaskRenderer';
import TaskStatusBadge from './TaskStatusBadge';
import ApprovalActions from './ApprovalActions';
import SocialPreview from './SocialPreview';

interface TaskDetailPanelProps {
  task: Task;
  onClose: () => void;
  onStatusChange: (status: string, feedback?: string, scheduledAt?: Date) => Promise<void>;
  onContentChange: (content: Record<string, unknown>) => Promise<void>;
  isUpdating?: boolean;
}

export default function TaskDetailPanel({
  task,
  onClose,
  onStatusChange,
  onContentChange,
  isUpdating = false,
}: TaskDetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showFeedbackHistory, setShowFeedbackHistory] = useState(false);
  
  const taskConfig = getTaskConfigWithFallback(task.agent_slug, task.task_type);
  const hasFeedback = task.feedback_history && task.feedback_history.length > 0;
  
  const handleSave = async (content: Record<string, unknown>) => {
    await onContentChange(content);
    setIsEditing(false);
  };
  
  const handleCancel = () => {
    setIsEditing(false);
  };
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };
  
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'white',
      borderLeft: '1px solid var(--gray-200)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid var(--gray-200)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: taskConfig.color,
            }}
          />
          <span style={{
            fontSize: '12px',
            color: 'var(--gray-500)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {taskConfig.label}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderRadius: '6px',
            color: 'var(--gray-500)',
          }}
        >
          <X size={20} />
        </button>
      </div>
      
      {/* Title and Status */}
      <div style={{ padding: '20px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--gray-900)',
            margin: 0,
            flex: 1,
          }}>
            {task.title}
          </h2>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: 'var(--gray-100)',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                color: 'var(--gray-700)',
                cursor: 'pointer',
              }}
            >
              <Edit2 size={14} />
              Edit
            </button>
          )}
        </div>
        
        <TaskStatusBadge status={task.status} />
        
        {/* Metadata */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginTop: '20px',
          padding: '16px',
          backgroundColor: 'var(--gray-50)',
          borderRadius: '8px',
          fontSize: '13px',
        }}>
          <div>
            <div style={{ color: 'var(--gray-500)', marginBottom: '4px' }}>
              <Calendar size={12} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Due Date
            </div>
            <div style={{ color: 'var(--gray-900)', fontWeight: 500 }}>
              {formatDate(task.due_date)}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--gray-500)', marginBottom: '4px' }}>
              <Clock size={12} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Created
            </div>
            <div style={{ color: 'var(--gray-900)', fontWeight: 500 }}>
              {formatDateTime(task.created_at)}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--gray-500)', marginBottom: '4px' }}>
              <User size={12} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Agent
            </div>
            <div style={{ color: 'var(--gray-900)', fontWeight: 500 }}>
              {task.agent_slug}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--gray-500)', marginBottom: '4px' }}>
              Version
            </div>
            <div style={{ color: 'var(--gray-900)', fontWeight: 500 }}>
              v{task.version}
            </div>
          </div>
        </div>
        
        {/* Scheduled For */}
        {task.scheduled_for && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              color: '#1e40af',
            }}>
              <Calendar size={14} />
              Scheduled for {formatDateTime(task.scheduled_for)}
            </div>
          </div>
        )}
        
        {/* Publish Results */}
        {task.publish_results && Object.keys(task.publish_results).length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--gray-700)',
              marginBottom: '8px',
            }}>
              Publish Results
            </div>
            <PublishResultsDisplay 
              results={task.publish_results.results || {}}
              errors={task.publish_results.errors || {}}
              platformsCompleted={task.publish_results.platforms_completed || []}
              targetPlatforms={task.target_platforms || []}
            />
          </div>
        )}
        
        {/* Feedback History */}
        {hasFeedback && (
          <div style={{ marginTop: '16px' }}>
            <button
              onClick={() => setShowFeedbackHistory(!showFeedbackHistory)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '12px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#991b1b',
              }}
            >
              <MessageSquare size={14} />
              <span style={{ flex: 1, textAlign: 'left' }}>
                {task.feedback_history.length} revision{task.feedback_history.length > 1 ? 's' : ''} requested
              </span>
              {showFeedbackHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            
            {showFeedbackHistory && (
              <div style={{
                marginTop: '8px',
                padding: '12px',
                backgroundColor: '#fef2f2',
                borderRadius: '8px',
                border: '1px solid #fecaca',
              }}>
                {task.feedback_history.map((entry, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px',
                      marginBottom: idx < task.feedback_history.length - 1 ? '8px' : 0,
                      backgroundColor: 'white',
                      borderRadius: '6px',
                    }}
                  >
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--gray-500)',
                      marginBottom: '4px',
                    }}>
                      {formatDateTime(entry.rejected_at)}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: 'var(--gray-900)',
                    }}>
                      {entry.feedback}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        borderTop: '1px solid var(--gray-200)',
      }}>
        <TaskRenderer
          task={task}
          mode={isEditing ? 'edit' : 'view'}
          onSave={handleSave}
          onCancel={handleCancel}
          isSaving={isUpdating}
        />
      </div>
      
      {/* Approval Actions */}
      {!isEditing && (
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--gray-200)',
          backgroundColor: 'var(--gray-50)',
        }}>
          <ApprovalActions
            task={task}
            onStatusChange={onStatusChange}
            isUpdating={isUpdating}
          />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// PUBLISH RESULTS COMPONENT
// =============================================================================

const PLATFORM_NAMES: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸',
  facebook: '📘',
  linkedin: '💼',
  tiktok: '🎵',
  youtube: '▶️',
};

interface PublishResult {
  success: boolean;
  platform: string;
  post_id?: string;
  post_url?: string;
  error?: string;
}

interface PublishResultsDisplayProps {
  results: Record<string, PublishResult>;
  errors: Record<string, string>;
  platformsCompleted: string[];
  targetPlatforms: string[];
}

function PublishResultsDisplay({
  results,
  errors,
  platformsCompleted,
  targetPlatforms,
}: PublishResultsDisplayProps) {
  const allPlatforms = targetPlatforms.length > 0 
    ? targetPlatforms 
    : Object.keys(results);
  
  if (allPlatforms.length === 0) {
    return null;
  }
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      {allPlatforms.map((platform) => {
        const result = results[platform];
        const error = errors[platform];
        const isCompleted = platformsCompleted.includes(platform);
        const isSuccess = result?.success || isCompleted;
        const isFailed = error || (result && !result.success);
        const isPending = !isSuccess && !isFailed;
        
        return (
          <div
            key={platform}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              backgroundColor: isSuccess 
                ? '#f0fdf4' 
                : isFailed 
                  ? '#fef2f2' 
                  : 'var(--gray-50)',
              border: `1px solid ${
                isSuccess 
                  ? '#bbf7d0' 
                  : isFailed 
                    ? '#fecaca' 
                    : 'var(--gray-200)'
              }`,
              borderRadius: '8px',
            }}
          >
            {/* Platform Icon */}
            <span style={{ fontSize: '18px' }}>
              {PLATFORM_ICONS[platform] || '🔗'}
            </span>
            
            {/* Platform Name */}
            <span style={{
              flex: 1,
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--gray-700)',
            }}>
              {PLATFORM_NAMES[platform] || platform}
            </span>
            
            {/* Status */}
            {isPending && (
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                color: 'var(--gray-500)',
              }}>
                <Loader2 size={14} className="animate-spin" />
                Pending
              </span>
            )}
            
            {isSuccess && (
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                color: '#15803d',
              }}>
                <CheckCircle size={14} />
                Published
              </span>
            )}
            
            {isFailed && (
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                color: '#dc2626',
              }}>
                <XCircle size={14} />
                Failed
              </span>
            )}
            
            {/* Link to post */}
            {result?.post_url && (
              <a
                href={result.post_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  color: 'var(--primary-600)',
                  textDecoration: 'none',
                }}
              >
                View
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        );
      })}
      
      {/* Error details */}
      {Object.keys(errors).length > 0 && (
        <div style={{
          marginTop: '8px',
          padding: '12px',
          backgroundColor: '#fef2f2',
          borderRadius: '8px',
          border: '1px solid #fecaca',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: '#dc2626',
            marginBottom: '8px',
          }}>
            <AlertCircle size={14} />
            Error Details
          </div>
          {Object.entries(errors).map(([platform, errorMsg]) => (
            <div
              key={platform}
              style={{
                fontSize: '12px',
                color: '#7f1d1d',
                marginBottom: '4px',
              }}
            >
              <strong>{PLATFORM_NAMES[platform] || platform}:</strong> {errorMsg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
