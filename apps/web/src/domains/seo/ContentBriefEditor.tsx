/**
 * ContentBriefEditor
 * 
 * Edit component for content_brief task type.
 */

import { useState } from 'react';
import { Save, X, Plus, Trash2 } from 'lucide-react';
import { TaskEditProps } from '../../registry';

interface ContentBriefContent {
  topic: string;
  target_keyword: string;
  secondary_keywords?: string[];
  target_word_count?: number;
  outline?: string[];
  competitor_urls?: string[];
  notes?: string;
}

export default function ContentBriefEditor({ 
  task, 
  data, 
  onSave, 
  onCancel,
  isSaving = false,
}: TaskEditProps) {
  const initial = data as ContentBriefContent;
  
  const [topic, setTopic] = useState(initial.topic || '');
  const [targetKeyword, setTargetKeyword] = useState(initial.target_keyword || '');
  const [secondaryKeywords, setSecondaryKeywords] = useState(initial.secondary_keywords?.join(', ') || '');
  const [targetWordCount, setTargetWordCount] = useState(initial.target_word_count?.toString() || '1500');
  const [outline, setOutline] = useState(initial.outline || ['']);
  const [notes, setNotes] = useState(initial.notes || '');
  
  const handleSave = () => {
    const content: ContentBriefContent = {
      topic,
      target_keyword: targetKeyword,
      secondary_keywords: secondaryKeywords.split(',').map(k => k.trim()).filter(Boolean),
      target_word_count: parseInt(targetWordCount) || 1500,
      outline: outline.filter(Boolean),
      notes: notes || undefined,
    };
    onSave(content);
  };
  
  const addOutlineItem = () => setOutline([...outline, '']);
  const removeOutlineItem = (idx: number) => setOutline(outline.filter((_, i) => i !== idx));
  const updateOutlineItem = (idx: number, value: string) => {
    const newOutline = [...outline];
    newOutline[idx] = value;
    setOutline(newOutline);
  };
  
  return (
    <div style={{ padding: '20px' }}>
      {/* Topic */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          marginBottom: '6px',
          fontSize: '13px',
          fontWeight: 500,
        }}>
          Topic <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '14px',
            border: '1px solid var(--gray-300)',
            borderRadius: '6px',
          }}
        />
      </div>
      
      {/* Keywords */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '13px',
            fontWeight: 500,
          }}>
            Target Keyword <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            value={targetKeyword}
            onChange={(e) => setTargetKeyword(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '14px',
              border: '1px solid var(--gray-300)',
              borderRadius: '6px',
            }}
          />
        </div>
        <div>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '13px',
            fontWeight: 500,
          }}>
            Target Word Count
          </label>
          <input
            type="number"
            value={targetWordCount}
            onChange={(e) => setTargetWordCount(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '14px',
              border: '1px solid var(--gray-300)',
              borderRadius: '6px',
            }}
          />
        </div>
      </div>
      
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          marginBottom: '6px',
          fontSize: '13px',
          fontWeight: 500,
        }}>
          Secondary Keywords (comma-separated)
        </label>
        <input
          type="text"
          value={secondaryKeywords}
          onChange={(e) => setSecondaryKeywords(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '14px',
            border: '1px solid var(--gray-300)',
            borderRadius: '6px',
          }}
        />
      </div>
      
      {/* Outline */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '6px',
          fontSize: '13px',
          fontWeight: 500,
        }}>
          Suggested Outline
          <button onClick={addOutlineItem} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            backgroundColor: 'var(--gray-100)',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer',
          }}>
            <Plus size={12} /> Add
          </button>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {outline.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={item}
                onChange={(e) => updateOutlineItem(idx, e.target.value)}
                placeholder={`Section ${idx + 1}`}
                style={{
                  flex: 1,
                  padding: '8px',
                  fontSize: '13px',
                  border: '1px solid var(--gray-300)',
                  borderRadius: '6px',
                }}
              />
              {outline.length > 1 && (
                <button onClick={() => removeOutlineItem(idx)} style={{
                  padding: '8px',
                  backgroundColor: '#fee2e2',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: '#dc2626',
                }}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Notes */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{
          display: 'block',
          marginBottom: '6px',
          fontSize: '13px',
          fontWeight: 500,
        }}>
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '14px',
            border: '1px solid var(--gray-300)',
            borderRadius: '6px',
            resize: 'vertical',
          }}
        />
      </div>
      
      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button onClick={onCancel} disabled={isSaving} style={{
          padding: '10px 16px',
          backgroundColor: 'white',
          border: '1px solid var(--gray-300)',
          borderRadius: '8px',
          cursor: 'pointer',
        }}>
          <X size={16} style={{ marginRight: '6px' }} />
          Cancel
        </button>
        <button onClick={handleSave} disabled={isSaving || !topic || !targetKeyword} style={{
          padding: '10px 16px',
          backgroundColor: 'var(--primary-600)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          opacity: isSaving || !topic || !targetKeyword ? 0.6 : 1,
        }}>
          <Save size={16} style={{ marginRight: '6px' }} />
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
