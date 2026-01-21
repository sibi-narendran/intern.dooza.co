/**
 * LinkedInPostEditor
 */
import { useState } from 'react';
import { Save, X } from 'lucide-react';
import { TaskEditProps } from '../../registry';

export default function LinkedInPostEditor({ task, data, onSave, onCancel, isSaving }: TaskEditProps) {
  const initial = data as Record<string, unknown>;
  const [text, setText] = useState((initial.text as string) || '');
  const [hashtags, setHashtags] = useState((initial.hashtags as string[])?.join(', ') || '');
  
  const handleSave = () => onSave({ text, hashtags: hashtags.split(',').map(h => h.trim()).filter(Boolean) });
  const charCount = text.length;
  
  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>
          Post Text <span style={{ color: charCount > 3000 ? '#ef4444' : 'var(--gray-500)', fontWeight: 400 }}>{charCount}/3000</span>
        </label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} style={{
          width: '100%', padding: '12px', border: '1px solid var(--gray-300)', borderRadius: '6px', resize: 'vertical',
        }} />
      </div>
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>Hashtags</label>
        <input type="text" value={hashtags} onChange={(e) => setHashtags(e.target.value)} style={{
          width: '100%', padding: '10px', border: '1px solid var(--gray-300)', borderRadius: '6px',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button onClick={onCancel} style={{ padding: '10px 16px', backgroundColor: 'white', border: '1px solid var(--gray-300)', borderRadius: '8px', cursor: 'pointer' }}>
          <X size={16} /> Cancel
        </button>
        <button onClick={handleSave} disabled={isSaving || !text} style={{ padding: '10px 16px', backgroundColor: '#0077b5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', opacity: isSaving || !text ? 0.6 : 1 }}>
          <Save size={16} /> Save
        </button>
      </div>
    </div>
  );
}
