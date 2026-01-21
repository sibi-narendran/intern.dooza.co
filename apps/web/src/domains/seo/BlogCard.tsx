/**
 * BlogCard
 * 
 * View component for blog_post task type.
 * Displays blog post content with SEO metadata.
 */

import { FileText, Tag, Link as LinkIcon } from 'lucide-react';
import { TaskViewProps } from '../../registry';
import MarkdownRenderer from '../../components/MarkdownRenderer';

interface BlogPostContent {
  title: string;
  body: string;
  keywords?: string[];
  meta_description?: string;
  featured_image_url?: string;
  slug?: string;
}

export default function BlogCard({ task, data }: TaskViewProps) {
  const content = data as BlogPostContent;
  
  return (
    <div style={{ padding: '20px' }}>
      {/* Featured Image */}
      {content.featured_image_url && (
        <div style={{
          marginBottom: '20px',
          borderRadius: '8px',
          overflow: 'hidden',
        }}>
          <img
            src={content.featured_image_url}
            alt={content.title}
            style={{
              width: '100%',
              height: '200px',
              objectFit: 'cover',
            }}
          />
        </div>
      )}
      
      {/* Title */}
      <h2 style={{
        margin: '0 0 16px 0',
        fontSize: '24px',
        fontWeight: 700,
        color: 'var(--gray-900)',
        lineHeight: 1.3,
      }}>
        {content.title}
      </h2>
      
      {/* SEO Metadata */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        marginBottom: '20px',
        padding: '16px',
        backgroundColor: 'var(--gray-50)',
        borderRadius: '8px',
        border: '1px solid var(--gray-200)',
      }}>
        {/* Meta Description */}
        {content.meta_description && (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '4px',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--gray-500)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              <FileText size={12} />
              Meta Description
            </div>
            <div style={{
              fontSize: '13px',
              color: 'var(--gray-700)',
              lineHeight: 1.5,
            }}>
              {content.meta_description}
              <span style={{
                marginLeft: '8px',
                fontSize: '11px',
                color: content.meta_description.length > 160 ? '#ef4444' : '#10b981',
              }}>
                ({content.meta_description.length}/160)
              </span>
            </div>
          </div>
        )}
        
        {/* Keywords */}
        {content.keywords && content.keywords.length > 0 && (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '8px',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--gray-500)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              <Tag size={12} />
              Keywords
            </div>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
            }}>
              {content.keywords.map((keyword, idx) => (
                <span
                  key={idx}
                  style={{
                    padding: '4px 10px',
                    backgroundColor: '#10b98120',
                    color: '#059669',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {/* Slug */}
        {content.slug && (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '4px',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--gray-500)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              <LinkIcon size={12} />
              URL Slug
            </div>
            <code style={{
              fontSize: '13px',
              color: 'var(--gray-700)',
              backgroundColor: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid var(--gray-200)',
            }}>
              /{content.slug}
            </code>
          </div>
        )}
      </div>
      
      {/* Body Content */}
      <div style={{
        padding: '20px',
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid var(--gray-200)',
      }}>
        <div style={{
          fontSize: '15px',
          lineHeight: 1.7,
          color: 'var(--gray-800)',
        }}>
          <MarkdownRenderer content={content.body} />
        </div>
      </div>
      
      {/* Word Count */}
      <div style={{
        marginTop: '12px',
        fontSize: '12px',
        color: 'var(--gray-500)',
        textAlign: 'right',
      }}>
        ~{content.body.split(/\s+/).length} words
      </div>
    </div>
  );
}
