/**
 * ScheduleModal
 * 
 * Modal for scheduling a task to be published at a specific time.
 */

import { useState } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import { Task } from '../../registry';

interface ScheduleModalProps {
  task: Task;
  onSchedule: (scheduledAt: Date) => void;
  onClose: () => void;
}

export default function ScheduleModal({ task, onSchedule, onClose }: ScheduleModalProps) {
  // Default to tomorrow at 9am or the task's due date
  const getDefaultDate = () => {
    if (task.due_date) {
      return new Date(task.due_date);
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow;
  };
  
  const defaultDate = getDefaultDate();
  const [date, setDate] = useState(defaultDate.toISOString().split('T')[0]);
  const [time, setTime] = useState(
    `${String(defaultDate.getHours()).padStart(2, '0')}:${String(defaultDate.getMinutes()).padStart(2, '0')}`
  );
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = () => {
    const scheduledAt = new Date(`${date}T${time}`);
    
    if (isNaN(scheduledAt.getTime())) {
      setError('Please enter a valid date and time.');
      return;
    }
    
    if (scheduledAt <= new Date()) {
      setError('Scheduled time must be in the future.');
      return;
    }
    
    onSchedule(scheduledAt);
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
          maxWidth: '400px',
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
            Schedule Task
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
            margin: '0 0 20px 0',
            fontSize: '14px',
            color: 'var(--gray-600)',
          }}>
            Choose when to publish "<strong>{task.title}</strong>"
          </p>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }}>
            {/* Date Input */}
            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '8px',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--gray-700)',
              }}>
                <Calendar size={14} />
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setError(null);
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: '1px solid var(--gray-300)',
                  borderRadius: '8px',
                }}
              />
            </div>
            
            {/* Time Input */}
            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '8px',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--gray-700)',
              }}>
                <Clock size={14} />
                Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => {
                  setTime(e.target.value);
                  setError(null);
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: '1px solid var(--gray-300)',
                  borderRadius: '8px',
                }}
              />
            </div>
          </div>
          
          {error && (
            <div style={{
              marginTop: '12px',
              padding: '10px 12px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#dc2626',
            }}>
              {error}
            </div>
          )}
          
          {/* Quick Options */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginTop: '16px',
          }}>
            {[
              { label: 'Tomorrow 9am', days: 1, hours: 9 },
              { label: 'In 3 days', days: 3, hours: 9 },
              { label: 'Next Monday', days: 7 - new Date().getDay() + 1, hours: 9 },
            ].map((option) => {
              const optionDate = new Date();
              optionDate.setDate(optionDate.getDate() + option.days);
              optionDate.setHours(option.hours, 0, 0, 0);
              
              return (
                <button
                  key={option.label}
                  onClick={() => {
                    setDate(optionDate.toISOString().split('T')[0]);
                    setTime(`${String(option.hours).padStart(2, '0')}:00`);
                    setError(null);
                  }}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'var(--gray-100)',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: 'var(--gray-700)',
                    cursor: 'pointer',
                  }}
                >
                  {option.label}
                </button>
              );
            })}
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
              backgroundColor: 'var(--primary-600)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Calendar size={14} />
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
