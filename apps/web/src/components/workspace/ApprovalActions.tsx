/**
 * ApprovalActions
 * 
 * Buttons for approving, rejecting, scheduling, and publishing tasks.
 * Shows context-appropriate actions based on current task status.
 * 
 * For approved/scheduled tasks, shows platform selector for publishing.
 */

import { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Calendar, 
  Send,
  Loader2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Task, TaskStatus, STATUS_CONFIG } from '../../registry';
import FeedbackModal from './FeedbackModal';
import ScheduleModal from './ScheduleModal';
import PlatformSelector from './PlatformSelector';
import { api } from '../../lib/api';

interface ApprovalActionsProps {
  task: Task;
  onStatusChange: (status: string, feedback?: string, scheduledAt?: Date) => Promise<void>;
  onPublish?: (platforms: string[]) => Promise<void>;
  onSchedule?: (platforms: string[], scheduledFor: Date) => Promise<void>;
  onRetry?: () => Promise<void>;
  isUpdating?: boolean;
}

// Which actions are available for each status
const AVAILABLE_ACTIONS: Record<TaskStatus, string[]> = {
  draft: ['pending_approval', 'cancelled'],
  pending_approval: ['approved', 'rejected', 'cancelled'],
  approved: ['scheduled', 'publish', 'cancelled'],
  rejected: [], // Agent handles revision
  scheduled: ['publish', 'cancel_schedule'],
  publishing: [], // In progress
  published: [],
  partially_published: ['retry'],
  failed: ['retry', 'cancelled'],
  cancelled: [],
};

// Social task types that can be published
const SOCIAL_TASK_TYPES = [
  'instagram_post',
  'facebook_post',
  'linkedin_post',
  'tiktok_post',
  'youtube_video',
  'tweet',
  'social_post',
];

interface SocialConnection {
  platform: string;
  connection_id: string;
  connected: boolean;
  account_name?: string;
}

export default function ApprovalActions({
  task,
  onStatusChange,
  onPublish,
  onSchedule,
  onRetry,
  isUpdating = false,
}: ApprovalActionsProps) {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  
  const availableActions = AVAILABLE_ACTIONS[task.status as TaskStatus] || [];
  const isSocialTask = SOCIAL_TASK_TYPES.includes(task.task_type);
  const showPlatformSelector = isSocialTask && 
    (availableActions.includes('publish') || availableActions.includes('scheduled'));
  
  // Fetch social connections when component mounts
  useEffect(() => {
    if (showPlatformSelector) {
      fetchConnections();
    }
  }, [showPlatformSelector]);
  
  const fetchConnections = async () => {
    setLoadingConnections(true);
    try {
      const response = await api.get('/integrations/social');
      setConnections(response.data);
      // Auto-select connected platforms
      const connected = response.data
        .filter((c: SocialConnection) => c.connected)
        .map((c: SocialConnection) => c.platform);
      setSelectedPlatforms(connected);
    } catch (error) {
      console.error('Failed to fetch social connections:', error);
    } finally {
      setLoadingConnections(false);
    }
  };
  
  // Status-specific messages
  if (availableActions.length === 0) {
    const statusMessages: Record<string, string> = {
      published: 'This task has been published.',
      cancelled: 'This task has been cancelled.',
      rejected: 'Waiting for agent to revise this task.',
      publishing: 'Publishing in progress...',
    };
    
    return (
      <div style={{
        textAlign: 'center',
        color: 'var(--gray-500)',
        fontSize: '13px',
        padding: '8px',
      }}>
        {task.status === 'publishing' && <Loader2 size={16} className="animate-spin" style={{ marginRight: '8px' }} />}
        {statusMessages[task.status] || `Status: ${task.status}`}
      </div>
    );
  }
  
  const handleAction = async (action: string) => {
    if (action === 'rejected') {
      setShowFeedbackModal(true);
      return;
    }
    
    if (action === 'scheduled') {
      if (isSocialTask && selectedPlatforms.length === 0) {
        setPublishError('Please select at least one platform');
        return;
      }
      setShowScheduleModal(true);
      return;
    }
    
    if (action === 'publish') {
      if (selectedPlatforms.length === 0) {
        setPublishError('Please select at least one platform');
        return;
      }
      setPublishError(null);
      setPendingAction('publish');
      try {
        if (onPublish) {
          await onPublish(selectedPlatforms);
        } else {
          // Direct API call as fallback
          await api.post(`/tasks/${task.id}/publish`, { platforms: selectedPlatforms });
        }
      } catch (error: any) {
        setPublishError(error.response?.data?.detail || 'Publish failed');
      } finally {
        setPendingAction(null);
      }
      return;
    }
    
    if (action === 'retry') {
      setPendingAction('retry');
      try {
        if (onRetry) {
          await onRetry();
        } else {
          await api.post(`/tasks/${task.id}/retry`);
        }
      } catch (error: any) {
        setPublishError(error.response?.data?.detail || 'Retry failed');
      } finally {
        setPendingAction(null);
      }
      return;
    }
    
    if (action === 'cancel_schedule') {
      setPendingAction('cancel_schedule');
      try {
        await api.delete(`/tasks/${task.id}/schedule`);
        await onStatusChange('approved');
      } catch (error: any) {
        setPublishError(error.response?.data?.detail || 'Failed to cancel schedule');
      } finally {
        setPendingAction(null);
      }
      return;
    }
    
    setPendingAction(action);
    try {
      await onStatusChange(action);
    } finally {
      setPendingAction(null);
    }
  };
  
  const handleReject = async (feedback: string) => {
    setShowFeedbackModal(false);
    setPendingAction('rejected');
    try {
      await onStatusChange('rejected', feedback);
    } finally {
      setPendingAction(null);
    }
  };
  
  const handleSchedule = async (scheduledAt: Date) => {
    setShowScheduleModal(false);
    setPendingAction('scheduled');
    try {
      if (isSocialTask && onSchedule) {
        await onSchedule(selectedPlatforms, scheduledAt);
      } else if (isSocialTask) {
        // Direct API call for scheduling with platforms
        await api.post(`/tasks/${task.id}/schedule`, {
          platforms: selectedPlatforms,
          scheduled_for: scheduledAt.toISOString(),
        });
      } else {
        await onStatusChange('scheduled', undefined, scheduledAt);
      }
    } catch (error: any) {
      setPublishError(error.response?.data?.detail || 'Failed to schedule');
    } finally {
      setPendingAction(null);
    }
  };
  
  const renderButton = (
    action: string,
    icon: React.ReactNode,
    label: string,
    variant: 'primary' | 'success' | 'danger' | 'secondary'
  ) => {
    const isLoading = pendingAction === action || (isUpdating && pendingAction === action);
    const isDisabled = (isUpdating && pendingAction !== action) || 
      (action === 'publish' && selectedPlatforms.length === 0);
    
    const variantStyles = {
      primary: {
        backgroundColor: 'var(--primary-600)',
        color: 'white',
        border: 'none',
      },
      success: {
        backgroundColor: '#10b981',
        color: 'white',
        border: 'none',
      },
      danger: {
        backgroundColor: 'white',
        color: '#ef4444',
        border: '1px solid #ef4444',
      },
      secondary: {
        backgroundColor: 'white',
        color: 'var(--gray-700)',
        border: '1px solid var(--gray-300)',
      },
    };
    
    return (
      <button
        key={action}
        onClick={() => handleAction(action)}
        disabled={isDisabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '10px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 500,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.5 : 1,
          transition: 'all 0.15s ease',
          ...variantStyles[variant],
        }}
      >
        {isLoading ? <Loader2 size={16} className="animate-spin" /> : icon}
        {label}
      </button>
    );
  };
  
  return (
    <>
      {/* Platform Selector for Social Tasks */}
      {showPlatformSelector && (
        <div style={{ marginBottom: '16px' }}>
          <PlatformSelector
            connections={connections}
            selectedPlatforms={selectedPlatforms}
            onSelectionChange={setSelectedPlatforms}
            loading={loadingConnections}
          />
        </div>
      )}
      
      {/* Error Message */}
      {publishError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#dc2626',
          fontSize: '13px',
          marginBottom: '12px',
        }}>
          <AlertCircle size={16} />
          {publishError}
        </div>
      )}
      
      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        {availableActions.includes('approved') && 
          renderButton('approved', <CheckCircle size={16} />, 'Approve', 'success')}
        
        {availableActions.includes('rejected') && 
          renderButton('rejected', <XCircle size={16} />, 'Request Changes', 'danger')}
        
        {availableActions.includes('scheduled') && 
          renderButton('scheduled', <Calendar size={16} />, 'Schedule', 'secondary')}
        
        {availableActions.includes('publish') && 
          renderButton('publish', <Send size={16} />, 'Publish Now', 'primary')}
        
        {availableActions.includes('retry') && 
          renderButton('retry', <RefreshCw size={16} />, 'Retry', 'primary')}
        
        {availableActions.includes('cancel_schedule') && 
          renderButton('cancel_schedule', <XCircle size={16} />, 'Cancel Schedule', 'secondary')}
        
        {availableActions.includes('pending_approval') && 
          renderButton('pending_approval', <Send size={16} />, 'Submit for Approval', 'primary')}
        
        {availableActions.includes('cancelled') && 
          renderButton('cancelled', <XCircle size={16} />, 'Cancel', 'secondary')}
      </div>
      
      {/* Feedback Modal for Rejection */}
      {showFeedbackModal && (
        <FeedbackModal
          onSubmit={handleReject}
          onClose={() => setShowFeedbackModal(false)}
        />
      )}
      
      {/* Schedule Modal */}
      {showScheduleModal && (
        <ScheduleModal
          task={task}
          onSchedule={handleSchedule}
          onClose={() => setShowScheduleModal(false)}
        />
      )}
    </>
  );
}
