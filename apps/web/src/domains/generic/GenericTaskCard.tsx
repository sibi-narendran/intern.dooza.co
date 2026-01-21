/**
 * GenericTaskCard
 * 
 * Fallback view component for unregistered task types.
 * Displays task content as formatted JSON.
 */

import { TaskViewProps } from '../../registry';
import { RawJSON } from '../../components/tools';

export default function GenericTaskCard({ task, data }: TaskViewProps) {
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
          Register this task type in workspace-components.ts for a custom view.
        </span>
      </div>
      
      <h3 style={{ 
        fontSize: '18px', 
        fontWeight: 600, 
        marginBottom: '16px',
        color: 'var(--gray-900)',
      }}>
        {task.title}
      </h3>
      
      <RawJSON data={data} />
    </div>
  );
}
