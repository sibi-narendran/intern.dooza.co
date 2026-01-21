/**
 * FeedbackModal
 * 
 * Modal for providing feedback when rejecting a task.
 * Requires a reason to be entered before rejection.
 */

import { useState } from 'react';
import { X, Send, AlertTriangle } from 'lucide-react';

interface FeedbackModalProps {
  onSubmit: (feedback: string) => void;
  onClose: () => void;
}

export default function FeedbackModal({ onSubmit, onClose }: FeedbackModalProps) {
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = () => {
    if (!feedback.trim()) {
      setError('Please provide feedback for the revision request.');
      return;
    }
    onSubmit(feedback.trim());
  };
  
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '500px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--gray-200)',
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--gray-900)',
          }}>
            Request Changes
          </h3>
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
        
        {/* Content */}
        <div style={{ padding: '20px' }}>
          <p style={{
            margin: '0 0 16px 0',
            fontSize: '14px',
            color: 'var(--gray-600)',
          }}>
            Explain what changes you'd like the agent to make. The agent will use this feedback to create a revised version.
          </p>
          
          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--gray-700)',
            }}>
              Feedback <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              value={feedback}
              onChange={(e) => {
                setFeedback(e.target.value);
                setError(null);
              }}
              placeholder="e.g., The title should be more engaging. Please also add a section about..."
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '12px',
                fontSize: '14px',
                border: `1px solid ${error ? '#ef4444' : 'var(--gray-300)'}`,
                borderRadius: '8px',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
              autoFocus
            />
            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '8px',
                color: '#ef4444',
                fontSize: '13px',
              }}>
                <AlertTriangle size={14} />
                {error}
              </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          padding: '16px 20px',
          borderTop: '1px solid var(--gray-200)',
          backgroundColor: 'var(--gray-50)',
          borderRadius: '0 0 12px 12px',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 16px',
              backgroundColor: 'white',
              color: 'var(--gray-700)',
              border: '1px solid var(--gray-300)',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Send size={14} />
            Request Changes
          </button>
        </div>
      </div>
    </div>
  );
}
