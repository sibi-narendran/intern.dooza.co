/**
 * TweetEditor
 * 
 * Edit component for tweet task type.
 */

import { useState } from 'react';
import { Save, X, Hash } from 'lucide-react';
import { TaskEditProps } from '../../registry';

interface TweetContent {
  text: string;
  hashtags?: string[];
  media_url?: string;
  thread_position?: number;
}

export default function TweetEditor({ 
  task, 
  data, 
  onSave, 
  onCancel,
  isSaving = false,
}: TaskEditProps) {
  const initial = data as TweetContent;
  
  const [text, setText] = useState(initial.text || '');
  const [hashtags, setHashtags] = useState(initial.hashtags?.join(', ') || '');
  const [mediaUrl, setMediaUrl] = useState(initial.media_url || '');
  
  const charCount = text.length;
  const isOverLimit = charCount > 280;
  
  const handleSave = () => {
    const content: TweetContent = {
      text,
      hashtags: hashtags.split(',').map(h => h.trim().replace(/^#/, '')).filter(Boolean),
      media_url: mediaUrl || undefined,
    };
    onSave(content);
  };
  
  return (
    <div style={{ padding: '20px' }}>
      {/* Text */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '8px',
          fontSize: '13px',
          fontWeight: 500,
        }}>
          Tweet Text <span style={{ color: '#ef4444' }}>*</span>
          <span style={{ color: isOverLimit ? '#ef4444' : 'var(--gray-500)', fontWeight: 400 }}>
            {charCount}/280
          </span>
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's happening?"
          rows={4}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '15px',
            lineHeight: 1.5,
            border: `1px solid ${isOverLimit ? '#ef4444' : 'var(--gray-300)'}`,
            borderRadius: '8px',
            resize: 'vertical',
          }}
        />
      </div>
      
      {/* Hashtags */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '8px',
          fontSize: '13px',
          fontWeight: 500,
        }}>
          <Hash size={14} />
          Hashtags (comma-separated)
        </label>
        <input
          type="text"
          value={hashtags}
          onChange={(e) => setHashtags(e.target.value)}
          placeholder="ai, tech, future"
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '14px',
            border: '1px solid var(--gray-300)',
            borderRadius: '6px',
          }}
        />
      </div>
      
      {/* Media URL */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '13px',
          fontWeight: 500,
        }}>
          Media URL (optional)
        </label>
        <input
          type="url"
          value={mediaUrl}
          onChange={(e) => setMediaUrl(e.target.value)}
          placeholder="https://..."
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '14px',
            border: '1px solid var(--gray-300)',
            borderRadius: '6px',
          }}
        />
      </div>
      
      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button onClick={onCancel} disabled={isSaving} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '10px 16px',
          backgroundColor: 'white',
          border: '1px solid var(--gray-300)',
          borderRadius: '8px',
          cursor: 'pointer',
        }}>
          <X size={16} />
          Cancel
        </button>
        <button onClick={handleSave} disabled={isSaving || !text || isOverLimit} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '10px 16px',
          backgroundColor: '#1d9bf0',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          opacity: isSaving || !text || isOverLimit ? 0.6 : 1,
        }}>
          <Save size={16} />
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
