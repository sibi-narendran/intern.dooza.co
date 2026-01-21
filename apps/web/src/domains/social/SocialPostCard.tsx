/**
 * SocialPostCard - Generic social post view
 */
import { Share2 } from 'lucide-react';
import { TaskViewProps } from '../../registry';

export default function SocialPostCard({ task, data }: TaskViewProps) {
  const content = data as Record<string, unknown>;
  
  return (
    <div style={{ padding: '20px' }}>
      <div style={{
        padding: '16px',
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid var(--gray-200)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
          color: 'var(--gray-500)',
          fontSize: '12px',
          textTransform: 'uppercase',
        }}>
          <Share2 size={14} />
          {(content.platform as string) || 'Social Post'}
        </div>
        <p style={{
          margin: 0,
          fontSize: '15px',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
        }}>
          {content.text as string}
        </p>
        {(content.hashtags as string[])?.length > 0 && (
          <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {(content.hashtags as string[]).map((tag, i) => (
              <span key={i} style={{ color: 'var(--primary-600)', fontSize: '14px' }}>#{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
