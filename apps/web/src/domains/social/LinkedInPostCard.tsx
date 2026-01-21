/**
 * LinkedInPostCard
 */
import { Linkedin } from 'lucide-react';
import { TaskViewProps } from '../../registry';

export default function LinkedInPostCard({ task, data }: TaskViewProps) {
  const content = data as Record<string, unknown>;
  
  return (
    <div style={{ padding: '20px' }}>
      <div style={{
        padding: '16px',
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#0077b5' }}>
          <Linkedin size={18} />
          <span style={{ fontSize: '13px', fontWeight: 500 }}>LinkedIn Post</span>
        </div>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {content.text as string}
        </p>
        {(content.hashtags as string[])?.length > 0 && (
          <div style={{ marginTop: '12px', color: '#0077b5', fontSize: '13px' }}>
            {(content.hashtags as string[]).map((t, i) => <span key={i}>#{t} </span>)}
          </div>
        )}
      </div>
    </div>
  );
}
