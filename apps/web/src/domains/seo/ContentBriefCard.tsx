/**
 * ContentBriefCard
 * 
 * View component for content_brief task type.
 */

import { FileSearch, Target, ListOrdered } from 'lucide-react';
import { TaskViewProps } from '../../registry';

interface ContentBriefContent {
  topic: string;
  target_keyword: string;
  secondary_keywords?: string[];
  target_word_count?: number;
  outline?: string[];
  competitor_urls?: string[];
  notes?: string;
}

export default function ContentBriefCard({ task, data }: TaskViewProps) {
  const content = data as ContentBriefContent;
  
  return (
    <div style={{ padding: '20px' }}>
      {/* Topic */}
      <h2 style={{
        margin: '0 0 20px 0',
        fontSize: '22px',
        fontWeight: 700,
        color: 'var(--gray-900)',
      }}>
        {content.topic}
      </h2>
      
      {/* Keywords */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '20px',
      }}>
        <span style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          backgroundColor: '#10b98120',
          color: '#059669',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: 600,
        }}>
          <Target size={14} />
          {content.target_keyword}
        </span>
        {content.secondary_keywords?.map((kw, idx) => (
          <span
            key={idx}
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--gray-100)',
              color: 'var(--gray-700)',
              borderRadius: '6px',
              fontSize: '13px',
            }}
          >
            {kw}
          </span>
        ))}
      </div>
      
      {/* Target Word Count */}
      {content.target_word_count && (
        <div style={{
          marginBottom: '20px',
          padding: '12px 16px',
          backgroundColor: 'var(--gray-50)',
          borderRadius: '8px',
          fontSize: '14px',
        }}>
          <strong>Target:</strong> {content.target_word_count.toLocaleString()} words
        </div>
      )}
      
      {/* Outline */}
      {content.outline && content.outline.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            margin: '0 0 12px 0',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--gray-700)',
          }}>
            <ListOrdered size={16} />
            Suggested Outline
          </h3>
          <ol style={{
            margin: 0,
            paddingLeft: '24px',
            fontSize: '14px',
            lineHeight: 1.8,
          }}>
            {content.outline.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ol>
        </div>
      )}
      
      {/* Notes */}
      {content.notes && (
        <div style={{
          padding: '16px',
          backgroundColor: '#fef3c7',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#92400e',
        }}>
          <strong>Notes:</strong> {content.notes}
        </div>
      )}
    </div>
  );
}
