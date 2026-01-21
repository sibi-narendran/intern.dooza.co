/**
 * WorkflowProgress Component
 * 
 * Visual pipeline showing the content workflow stages:
 * Draft → Review → Approved → Scheduled → Published
 * 
 * Shows current status, completed steps, and next actions.
 */

import { 
  FileText, 
  Eye, 
  CheckCircle, 
  Calendar, 
  Globe, 
  XCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { Task, TaskStatus, STATUS_CONFIG } from '../../registry';

interface WorkflowProgressProps {
  task: Task;
  compact?: boolean;
}

interface WorkflowStep {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  statuses: TaskStatus[];
  description: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'draft',
    label: 'Draft',
    icon: FileText,
    statuses: ['draft'],
    description: 'Content is being created',
  },
  {
    id: 'review',
    label: 'Review',
    icon: Eye,
    statuses: ['pending_approval'],
    description: 'Waiting for your approval',
  },
  {
    id: 'approved',
    label: 'Approved',
    icon: CheckCircle,
    statuses: ['approved'],
    description: 'Ready to publish',
  },
  {
    id: 'scheduled',
    label: 'Scheduled',
    icon: Calendar,
    statuses: ['scheduled'],
    description: 'Scheduled for later',
  },
  {
    id: 'published',
    label: 'Published',
    icon: Globe,
    statuses: ['published', 'publishing', 'partially_published'],
    description: 'Live on platform(s)',
  },
];

// Terminal states that don't follow normal workflow
const TERMINAL_STATES: Record<TaskStatus, { label: string; color: string; icon: React.ComponentType<{ size?: number }> }> = {
  rejected: { label: 'Changes Requested', color: '#f97316', icon: AlertTriangle },
  cancelled: { label: 'Cancelled', color: '#6b7280', icon: XCircle },
  failed: { label: 'Publish Failed', color: '#ef4444', icon: XCircle },
  publishing: { label: 'Publishing...', color: '#6366f1', icon: Loader2 },
  partially_published: { label: 'Partial Success', color: '#f97316', icon: AlertTriangle },
  // These are included in normal flow
  draft: { label: 'Draft', color: '#6b7280', icon: FileText },
  pending_approval: { label: 'Review', color: '#eab308', icon: Eye },
  approved: { label: 'Approved', color: '#22c55e', icon: CheckCircle },
  scheduled: { label: 'Scheduled', color: '#3b82f6', icon: Calendar },
  published: { label: 'Published', color: '#8b5cf6', icon: Globe },
};

function getStepStatus(step: WorkflowStep, currentStatus: TaskStatus): 'completed' | 'current' | 'upcoming' | 'skipped' {
  const stepIndex = WORKFLOW_STEPS.findIndex(s => s.id === step.id);
  const currentStepIndex = WORKFLOW_STEPS.findIndex(s => s.statuses.includes(currentStatus));
  
  // Handle terminal states
  if (['rejected', 'cancelled', 'failed'].includes(currentStatus)) {
    if (stepIndex < currentStepIndex) return 'completed';
    if (stepIndex === currentStepIndex) return 'current';
    return 'skipped';
  }
  
  // Handle in-progress states
  if (currentStatus === 'publishing') {
    // Publishing is between approved/scheduled and published
    if (step.id === 'published') return 'current';
    if (stepIndex <= 3) return 'completed';
    return 'upcoming';
  }
  
  // Normal flow
  if (step.statuses.includes(currentStatus)) return 'current';
  if (stepIndex < currentStepIndex) return 'completed';
  
  // Skip scheduled step if going directly to published
  if (step.id === 'scheduled' && currentStatus === 'published') return 'skipped';
  
  return 'upcoming';
}

function CompactProgress({ task }: { task: Task }) {
  const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.draft;
  const Icon = TERMINAL_STATES[task.status]?.icon || CheckCircle;
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      backgroundColor: config.bgColor,
      borderRadius: '8px',
      fontSize: '13px',
    }}>
      <Icon 
        size={16} 
        className={task.status === 'publishing' ? 'animate-spin' : ''}
        style={{ color: config.color }} 
      />
      <span style={{ fontWeight: 500, color: config.color }}>
        {config.label}
      </span>
      
      {task.status === 'scheduled' && task.scheduled_at && (
        <span style={{ color: 'var(--gray-600)', fontSize: '12px' }}>
          • {new Date(task.scheduled_at).toLocaleDateString()}
        </span>
      )}
      
      {task.status === 'partially_published' && task.publish_results && (
        <span style={{ color: 'var(--gray-600)', fontSize: '12px' }}>
          • {Object.values(task.publish_results).filter((r: any) => r.success).length}/{Object.keys(task.publish_results).length} platforms
        </span>
      )}
    </div>
  );
}

export default function WorkflowProgress({ task, compact = false }: WorkflowProgressProps) {
  if (compact) {
    return <CompactProgress task={task} />;
  }

  const isTerminalState = ['rejected', 'cancelled', 'failed'].includes(task.status);

  return (
    <div style={{
      padding: '20px',
      backgroundColor: 'var(--gray-50)',
      borderRadius: '12px',
      border: '1px solid var(--gray-200)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
      }}>
        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--gray-800)' }}>
          Content Pipeline
        </h4>
        
        {/* Current Status Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          backgroundColor: STATUS_CONFIG[task.status]?.bgColor || 'var(--gray-100)',
          color: STATUS_CONFIG[task.status]?.color || 'var(--gray-600)',
          borderRadius: '16px',
          fontSize: '12px',
          fontWeight: 500,
        }}>
          {task.status === 'publishing' && (
            <Loader2 size={12} className="animate-spin" />
          )}
          {STATUS_CONFIG[task.status]?.label || task.status}
        </div>
      </div>

      {/* Progress Steps */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
      }}>
        {/* Background Line */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          right: '20px',
          height: '2px',
          backgroundColor: 'var(--gray-200)',
          zIndex: 0,
        }} />
        
        {/* Progress Line (filled) */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          width: `${(WORKFLOW_STEPS.findIndex(s => s.statuses.includes(task.status)) / (WORKFLOW_STEPS.length - 1)) * 100}%`,
          height: '2px',
          backgroundColor: isTerminalState ? 'var(--red-400)' : 'var(--green-500)',
          zIndex: 1,
          transition: 'width 0.3s ease',
        }} />

        {/* Step Circles */}
        {WORKFLOW_STEPS.map((step, index) => {
          const status = getStepStatus(step, task.status);
          const StepIcon = step.icon;
          
          const colors = {
            completed: { bg: 'var(--green-500)', text: 'white', border: 'var(--green-500)' },
            current: { bg: 'var(--primary-600)', text: 'white', border: 'var(--primary-600)' },
            upcoming: { bg: 'white', text: 'var(--gray-400)', border: 'var(--gray-300)' },
            skipped: { bg: 'var(--gray-100)', text: 'var(--gray-400)', border: 'var(--gray-200)' },
          };
          
          const color = colors[status];
          
          return (
            <div
              key={step.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                zIndex: 2,
                flex: 1,
              }}
            >
              {/* Circle */}
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: color.bg,
                border: `2px solid ${color.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: color.text,
                transition: 'all 0.3s ease',
              }}>
                {status === 'completed' ? (
                  <CheckCircle size={20} />
                ) : status === 'current' && task.status === 'publishing' ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <StepIcon size={18} />
                )}
              </div>
              
              {/* Label */}
              <span style={{
                fontSize: '12px',
                fontWeight: status === 'current' ? 600 : 500,
                color: status === 'current' ? 'var(--gray-900)' : 
                       status === 'completed' ? 'var(--gray-700)' : 'var(--gray-400)',
                textAlign: 'center',
              }}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Terminal State Message */}
      {isTerminalState && (
        <div style={{
          marginTop: '20px',
          padding: '12px 16px',
          backgroundColor: task.status === 'rejected' ? 'var(--yellow-50)' : 
                           task.status === 'failed' ? 'var(--red-50)' : 'var(--gray-100)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          border: `1px solid ${task.status === 'rejected' ? 'var(--yellow-200)' : 
                               task.status === 'failed' ? 'var(--red-200)' : 'var(--gray-200)'}`,
        }}>
          {task.status === 'rejected' && <AlertTriangle size={18} color="#f97316" />}
          {task.status === 'failed' && <XCircle size={18} color="#ef4444" />}
          {task.status === 'cancelled' && <XCircle size={18} color="#6b7280" />}
          
          <div>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--gray-800)' }}>
              {task.status === 'rejected' && 'Changes requested'}
              {task.status === 'failed' && 'Publishing failed'}
              {task.status === 'cancelled' && 'Task cancelled'}
            </p>
            {task.feedback_history && task.feedback_history.length > 0 && (
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--gray-600)' }}>
                "{task.feedback_history[task.feedback_history.length - 1].feedback}"
              </p>
            )}
          </div>
        </div>
      )}

      {/* Publish Results */}
      {(task.status === 'published' || task.status === 'partially_published') && task.publish_results && (
        <div style={{ marginTop: '20px' }}>
          <h5 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 600, color: 'var(--gray-700)' }}>
            Publish Results
          </h5>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {Object.entries(task.publish_results).map(([platform, result]: [string, any]) => (
              <a
                key={platform}
                href={result.post_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  backgroundColor: result.success ? 'var(--green-50)' : 'var(--red-50)',
                  color: result.success ? 'var(--green-700)' : 'var(--red-700)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  textDecoration: 'none',
                  border: `1px solid ${result.success ? 'var(--green-200)' : 'var(--red-200)'}`,
                }}
              >
                {result.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {platform.charAt(0).toUpperCase() + platform.slice(1)}
                {result.success && <ArrowRight size={12} />}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Scheduled Info */}
      {task.status === 'scheduled' && task.scheduled_at && (
        <div style={{
          marginTop: '20px',
          padding: '12px 16px',
          backgroundColor: 'var(--blue-50)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          border: '1px solid var(--blue-200)',
        }}>
          <Clock size={18} color="#3b82f6" />
          <div>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--gray-800)' }}>
              Scheduled for publication
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--gray-600)' }}>
              {new Date(task.scheduled_at).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
