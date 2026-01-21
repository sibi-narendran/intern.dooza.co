/**
 * SocialPostEditor - Generic social post editor
 */
import { useState } from 'react';
import { Save, X } from 'lucide-react';
import { TaskEditProps } from '../../registry';

export default function SocialPostEditor({ task, data, onSave, onCancel, isSaving }: TaskEditProps) {
  const initial = data as Record<string, unknown>;
  const [text, setText] = useState((initial.text as string) || '');
  const [platform, setPlatform] = useState((initial.platform as string) || 'twitter');
  const [hashtags, setHashtags] = useState((initial.hashtags as string[])?.join(', ') || '');
  
  const handleSave = () => {
    onSave({
      text,
      platform,
      hashtags: hashtags.split(',').map(h => h.trim()).filter(Boolean),
    });
  };
  
  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>Platform</label>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={{
          width: '100%', padding: '10px', border: '1px solid var(--gray-300)', borderRadius: '6px',
        }}>
          <option value="twitter">Twitter/X</option>
          <option value="linkedin">LinkedIn</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
        </select>
      </div>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>Text</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} style={{
          width: '100%', padding: '12px', border: '1px solid var(--gray-300)', borderRadius: '6px', resize: 'vertical',
        }} />
      </div>
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>Hashtags</label>
        <input type="text" value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="ai, tech" style={{
          width: '100%', padding: '10px', border: '1px solid var(--gray-300)', borderRadius: '6px',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button onClick={onCancel} style={{ padding: '10px 16px', backgroundColor: 'white', border: '1px solid var(--gray-300)', borderRadius: '8px', cursor: 'pointer' }}>
          <X size={16} /> Cancel
        </button>
        <button onClick={handleSave} disabled={isSaving || !text} style={{ padding: '10px 16px', backgroundColor: 'var(--primary-600)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', opacity: isSaving || !text ? 0.6 : 1 }}>
          <Save size={16} /> Save
        </button>
      </div>
    </div>
  );
}
