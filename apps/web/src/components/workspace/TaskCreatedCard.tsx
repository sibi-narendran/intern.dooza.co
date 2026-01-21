/**
 * TaskCreatedCard
 * 
 * Inline card shown in chat when an agent creates a task.
 * Provides a link to view the task in the Workspace.
 */

import { Link } from 'react-router-dom';
import { Calendar, CheckCircle, ExternalLink, AlertTriangle } from 'lucide-react';

interface TaskCreatedResult {
  success: boolean;
  task_id?: string;
  status?: string;
  message?: string;
  view_url?: string;
  error?: string;
}

interface TaskCreatedCardProps {
  result: TaskCreatedResult;
}

export default function TaskCreatedCard({ result }: TaskCreatedCardProps) {
  if (!result.success) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '16px',
        backgroundColor: '#fef2f2',
        borderRadius: '12px',
        border: '1px solid #fecaca',
      }}>
        <AlertTriangle size={20} style={{ color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <div style={{ fontWeight: 600, color: '#991b1b', marginBottom: '4px' }}>
            Task Creation Failed
          </div>
          <div style={{ fontSize: '13px', color: '#b91c1c' }}>
            {result.error || 'An error occurred while creating the task.'}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div style={{
      padding: '16px',
      backgroundColor: '#f0fdf4',
      borderRadius: '12px',
      border: '1px solid #bbf7d0',
    }}>
      {/* Success Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '12px',
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: '#10b981',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <CheckCircle size={18} style={{ color: 'white' }} />
        </div>
        <div>
          <div style={{ fontWeight: 600, color: '#166534' }}>
            Task Created
          </div>
          <div style={{ fontSize: '12px', color: '#15803d' }}>
            {result.status === 'pending_approval' ? 'Pending your approval' : result.status}
          </div>
        </div>
      </div>
      
      {/* Message */}
      {result.message && (
        <p style={{
          margin: '0 0 16px 0',
          fontSize: '14px',
          color: '#166534',
          lineHeight: 1.5,
        }}>
          {result.message}
        </p>
      )}
      
      {/* View in Workspace Link */}
      {result.task_id && (
        <Link
          to={`/workspace?task=${result.task_id}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            backgroundColor: '#10b981',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 500,
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
        >
          <Calendar size={16} />
          View in Workspace
          <ExternalLink size={14} style={{ marginLeft: '4px' }} />
        </Link>
      )}
    </div>
  );
}
