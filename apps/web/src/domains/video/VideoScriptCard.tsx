/**
 * VideoScriptCard
 */
import { Video, Clock, Play } from 'lucide-react';
import { TaskViewProps } from '../../registry';

interface VideoScriptContent {
  title: string;
  hook: string;
  scenes: Array<{ timestamp?: string; visual?: string; narration?: string; notes?: string }>;
  duration_seconds: number;
  cta?: string;
  thumbnail_concept?: string;
}

export default function VideoScriptCard({ task, data }: TaskViewProps) {
  const content = data as VideoScriptContent;
  const minutes = Math.floor(content.duration_seconds / 60);
  const seconds = content.duration_seconds % 60;
  
  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '20px',
        padding: '16px',
        backgroundColor: '#fef3c7',
        borderRadius: '12px',
      }}>
        <Video size={24} style={{ color: '#f59e0b' }} />
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{content.title}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', color: '#92400e', fontSize: '13px' }}>
            <Clock size={14} />
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
        </div>
      </div>
      
      {/* Hook */}
      <div style={{
        marginBottom: '20px',
        padding: '16px',
        backgroundColor: '#fef3c7',
        borderRadius: '8px',
        borderLeft: '4px solid #f59e0b',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#92400e', marginBottom: '4px' }}>
          <Play size={12} style={{ marginRight: '4px' }} />
          HOOK (First 5 seconds)
        </div>
        <p style={{ margin: 0, fontSize: '15px', color: '#78350f' }}>{content.hook}</p>
      </div>
      
      {/* Scenes */}
      <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: 'var(--gray-700)' }}>Scenes</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {content.scenes.map((scene, idx) => (
          <div key={idx} style={{
            padding: '12px',
            backgroundColor: 'var(--gray-50)',
            borderRadius: '8px',
            border: '1px solid var(--gray-200)',
          }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#f59e0b', minWidth: '50px' }}>
                {scene.timestamp || `#${idx + 1}`}
              </span>
            </div>
            {scene.visual && (
              <div style={{ marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--gray-500)' }}>VISUAL:</span>
                <p style={{ margin: '2px 0 0', fontSize: '13px' }}>{scene.visual}</p>
              </div>
            )}
            {scene.narration && (
              <div style={{ marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--gray-500)' }}>NARRATION:</span>
                <p style={{ margin: '2px 0 0', fontSize: '13px', fontStyle: 'italic' }}>{scene.narration}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* CTA */}
      {content.cta && (
        <div style={{
          marginTop: '20px',
          padding: '12px',
          backgroundColor: '#dbeafe',
          borderRadius: '8px',
        }}>
          <strong style={{ fontSize: '12px', color: '#1e40af' }}>CALL TO ACTION:</strong>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#1e3a8a' }}>{content.cta}</p>
        </div>
      )}
    </div>
  );
}
