/**
 * TweetCard
 * 
 * View component for tweet task type.
 * Displays tweet preview with character count and hashtags.
 */

import { Twitter, Hash, Image } from 'lucide-react';
import { TaskViewProps } from '../../registry';

interface TweetContent {
  text: string;
  hashtags?: string[];
  media_url?: string;
  thread_position?: number;
}

export default function TweetCard({ task, data }: TaskViewProps) {
  const content = data as TweetContent;
  const charCount = content.text.length;
  
  return (
    <div style={{ padding: '20px' }}>
      {/* Tweet Preview Card */}
      <div style={{
        padding: '16px',
        backgroundColor: 'white',
        borderRadius: '16px',
        border: '1px solid #cfd9de',
        maxWidth: '500px',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '12px',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary-600)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
          }}>
            <Twitter size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '15px' }}>Your Account</div>
            <div style={{ color: '#536471', fontSize: '14px' }}>@handle</div>
          </div>
        </div>
        
        {/* Text */}
        <div style={{
          fontSize: '15px',
          lineHeight: 1.5,
          color: '#0f1419',
          marginBottom: '12px',
          whiteSpace: 'pre-wrap',
        }}>
          {content.text}
        </div>
        
        {/* Hashtags */}
        {content.hashtags && content.hashtags.length > 0 && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginBottom: '12px',
          }}>
            {content.hashtags.map((tag, idx) => (
              <span
                key={idx}
                style={{
                  color: '#1d9bf0',
                  fontSize: '14px',
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
        
        {/* Media */}
        {content.media_url && (
          <div style={{
            marginBottom: '12px',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid #cfd9de',
          }}>
            <img
              src={content.media_url}
              alt="Tweet media"
              style={{
                width: '100%',
                maxHeight: '300px',
                objectFit: 'cover',
              }}
            />
          </div>
        )}
        
        {/* Character Count */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '12px',
          borderTop: '1px solid #eff3f4',
          fontSize: '13px',
          color: '#536471',
        }}>
          <span>
            {content.thread_position && `Part ${content.thread_position} of thread`}
          </span>
          <span style={{ color: charCount > 280 ? '#ef4444' : '#536471' }}>
            {charCount}/280
          </span>
        </div>
      </div>
    </div>
  );
}
