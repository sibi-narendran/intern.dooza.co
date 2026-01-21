/**
 * VideoScriptEditor
 */
import { useState } from 'react';
import { Save, X, Plus, Trash2 } from 'lucide-react';
import { TaskEditProps } from '../../registry';

interface Scene {
  timestamp?: string;
  visual?: string;
  narration?: string;
}

export default function VideoScriptEditor({ task, data, onSave, onCancel, isSaving }: TaskEditProps) {
  const initial = data as Record<string, unknown>;
  const [title, setTitle] = useState((initial.title as string) || '');
  const [hook, setHook] = useState((initial.hook as string) || '');
  const [scenes, setScenes] = useState<Scene[]>((initial.scenes as Scene[]) || [{ timestamp: '0:00', visual: '', narration: '' }]);
  const [durationSeconds, setDurationSeconds] = useState(initial.duration_seconds?.toString() || '60');
  const [cta, setCta] = useState((initial.cta as string) || '');
  
  const handleSave = () => onSave({
    title,
    hook,
    scenes: scenes.filter(s => s.visual || s.narration),
    duration_seconds: parseInt(durationSeconds) || 60,
    cta: cta || undefined,
  });
  
  const addScene = () => setScenes([...scenes, { timestamp: '', visual: '', narration: '' }]);
  const removeScene = (idx: number) => setScenes(scenes.filter((_, i) => i !== idx));
  const updateScene = (idx: number, field: keyof Scene, value: string) => {
    const newScenes = [...scenes];
    newScenes[idx] = { ...newScenes[idx], [field]: value };
    setScenes(newScenes);
  };
  
  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: '16px', marginBottom: '16px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>Title *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={{
            width: '100%', padding: '10px', border: '1px solid var(--gray-300)', borderRadius: '6px',
          }} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>Duration (sec)</label>
          <input type="number" value={durationSeconds} onChange={(e) => setDurationSeconds(e.target.value)} style={{
            width: '100%', padding: '10px', border: '1px solid var(--gray-300)', borderRadius: '6px',
          }} />
        </div>
      </div>
      
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>Hook (First 5 seconds) *</label>
        <textarea value={hook} onChange={(e) => setHook(e.target.value)} rows={2} style={{
          width: '100%', padding: '10px', border: '1px solid var(--gray-300)', borderRadius: '6px',
        }} />
      </div>
      
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 500 }}>Scenes *</label>
          <button onClick={addScene} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', backgroundColor: 'var(--gray-100)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
            <Plus size={12} /> Add Scene
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {scenes.map((scene, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr auto', gap: '8px', alignItems: 'start' }}>
              <input type="text" placeholder="0:00" value={scene.timestamp || ''} onChange={(e) => updateScene(idx, 'timestamp', e.target.value)} style={{
                padding: '8px', border: '1px solid var(--gray-300)', borderRadius: '4px', fontSize: '12px',
              }} />
              <textarea placeholder="Visual" value={scene.visual || ''} onChange={(e) => updateScene(idx, 'visual', e.target.value)} rows={2} style={{
                padding: '8px', border: '1px solid var(--gray-300)', borderRadius: '4px', fontSize: '12px', resize: 'vertical',
              }} />
              <textarea placeholder="Narration" value={scene.narration || ''} onChange={(e) => updateScene(idx, 'narration', e.target.value)} rows={2} style={{
                padding: '8px', border: '1px solid var(--gray-300)', borderRadius: '4px', fontSize: '12px', fontStyle: 'italic', resize: 'vertical',
              }} />
              {scenes.length > 1 && (
                <button onClick={() => removeScene(idx)} style={{ padding: '8px', backgroundColor: '#fee2e2', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#dc2626' }}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>Call to Action</label>
        <input type="text" value={cta} onChange={(e) => setCta(e.target.value)} placeholder="Subscribe for more..." style={{
          width: '100%', padding: '10px', border: '1px solid var(--gray-300)', borderRadius: '6px',
        }} />
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button onClick={onCancel} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', backgroundColor: 'white', border: '1px solid var(--gray-300)', borderRadius: '8px', cursor: 'pointer' }}>
          <X size={16} /> Cancel
        </button>
        <button onClick={handleSave} disabled={isSaving || !title || !hook || scenes.length === 0} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', opacity: isSaving || !title || !hook ? 0.6 : 1 }}>
          <Save size={16} /> {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
