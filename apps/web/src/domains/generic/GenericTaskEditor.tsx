/**
 * GenericTaskEditor
 * 
 * Fallback edit component for unregistered task types.
 * Provides a JSON editor for the content payload.
 */

import { useState } from 'react';
import { Save, X, AlertTriangle } from 'lucide-react';
import { TaskEditProps } from '../../registry';

export default function GenericTaskEditor({ 
  task, 
  data, 
  onSave, 
  onCancel,
  isSaving = false,
}: TaskEditProps) {
  const [jsonValue, setJsonValue] = useState(JSON.stringify(data, null, 2));
  const [error, setError] = useState<string | null>(null);
  
  const handleSave = () => {
    try {
      const parsed = JSON.parse(jsonValue);
      setError(null);
      onSave(parsed);
    } catch (e) {
      setError('Invalid JSON. Please check your syntax.');
    }
  };
  
  return (
    <div style={{ padding: '16px' }}>
      <div style={{
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: '#fef3c7',
        borderRadius: '8px',
        border: '1px solid #fde68a',
        fontSize: '13px',
        color: '#92400e',
      }}>
        <strong>Unknown task type:</strong> {task.task_type}
        <br />
        <span style={{ fontSize: '12px' }}>
          Using generic JSON editor. Register this task type for a custom editor.
        </span>
      </div>
      
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '14px',
          fontWeight: 500,
          color: 'var(--gray-700)',
        }}>
          Content (JSON)
        </label>
        <textarea
          value={jsonValue}
          onChange={(e) => {
            setJsonValue(e.target.value);
            setError(null);
          }}
          style={{
            width: '100%',
            minHeight: '300px',
            padding: '12px',
            fontFamily: 'monospace',
            fontSize: '13px',
            border: `1px solid ${error ? '#ef4444' : 'var(--gray-300)'}`,
            borderRadius: '8px',
            resize: 'vertical',
          }}
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
      
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px',
      }}>
        <button
          onClick={onCancel}
          disabled={isSaving}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            backgroundColor: 'white',
            color: 'var(--gray-700)',
            border: '1px solid var(--gray-300)',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          <X size={16} />
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || !!error}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            backgroundColor: 'var(--primary-600)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: isSaving ? 'wait' : 'pointer',
            fontSize: '14px',
            opacity: isSaving || error ? 0.6 : 1,
          }}
        >
          <Save size={16} />
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
