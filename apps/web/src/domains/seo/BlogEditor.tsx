/**
 * BlogEditor
 * 
 * Edit component for blog_post task type.
 * Provides form fields for editing blog post content.
 */

import { useState, useEffect } from 'react';
import { Save, X, FileText, Tag, Link as LinkIcon, Image } from 'lucide-react';
import { TaskEditProps } from '../../registry';

interface BlogPostContent {
  title: string;
  body: string;
  keywords?: string[];
  meta_description?: string;
  featured_image_url?: string;
  slug?: string;
}

export default function BlogEditor({ 
  task, 
  data, 
  onSave, 
  onCancel,
  isSaving = false,
}: TaskEditProps) {
  const initialContent = data as BlogPostContent;
  
  const [title, setTitle] = useState(initialContent.title || '');
  const [body, setBody] = useState(initialContent.body || '');
  const [keywords, setKeywords] = useState(initialContent.keywords?.join(', ') || '');
  const [metaDescription, setMetaDescription] = useState(initialContent.meta_description || '');
  const [featuredImageUrl, setFeaturedImageUrl] = useState(initialContent.featured_image_url || '');
  const [slug, setSlug] = useState(initialContent.slug || '');
  
  // Auto-generate slug from title
  useEffect(() => {
    if (!slug && title) {
      const generatedSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setSlug(generatedSlug);
    }
  }, [title, slug]);
  
  const handleSave = () => {
    const content: BlogPostContent = {
      title,
      body,
      keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
      meta_description: metaDescription || undefined,
      featured_image_url: featuredImageUrl || undefined,
      slug: slug || undefined,
    };
    onSave(content);
  };
  
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  const metaDescLength = metaDescription.length;
  
  return (
    <div style={{ padding: '20px' }}>
      {/* Title */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--gray-700)',
        }}>
          Title <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter blog post title..."
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '16px',
            fontWeight: 600,
            border: '1px solid var(--gray-300)',
            borderRadius: '8px',
          }}
        />
      </div>
      
      {/* SEO Fields */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        marginBottom: '20px',
        padding: '16px',
        backgroundColor: 'var(--gray-50)',
        borderRadius: '8px',
        border: '1px solid var(--gray-200)',
      }}>
        {/* Meta Description */}
        <div style={{ gridColumn: 'span 2' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '8px',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--gray-700)',
          }}>
            <FileText size={14} />
            Meta Description
            <span style={{
              marginLeft: 'auto',
              fontSize: '11px',
              color: metaDescLength > 160 ? '#ef4444' : 'var(--gray-500)',
            }}>
              {metaDescLength}/160
            </span>
          </label>
          <textarea
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            placeholder="Enter meta description for search results..."
            rows={2}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '13px',
              border: `1px solid ${metaDescLength > 160 ? '#ef4444' : 'var(--gray-300)'}`,
              borderRadius: '6px',
              resize: 'vertical',
            }}
          />
        </div>
        
        {/* Keywords */}
        <div>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '8px',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--gray-700)',
          }}>
            <Tag size={14} />
            Keywords
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="SEO, blog, keywords (comma-separated)"
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '13px',
              border: '1px solid var(--gray-300)',
              borderRadius: '6px',
            }}
          />
        </div>
        
        {/* Slug */}
        <div>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '8px',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--gray-700)',
          }}>
            <LinkIcon size={14} />
            URL Slug
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="url-slug"
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '13px',
              border: '1px solid var(--gray-300)',
              borderRadius: '6px',
            }}
          />
        </div>
        
        {/* Featured Image */}
        <div style={{ gridColumn: 'span 2' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '8px',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--gray-700)',
          }}>
            <Image size={14} />
            Featured Image URL
          </label>
          <input
            type="url"
            value={featuredImageUrl}
            onChange={(e) => setFeaturedImageUrl(e.target.value)}
            placeholder="https://..."
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '13px',
              border: '1px solid var(--gray-300)',
              borderRadius: '6px',
            }}
          />
        </div>
      </div>
      
      {/* Body */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--gray-700)',
        }}>
          <span>Content (Markdown) <span style={{ color: '#ef4444' }}>*</span></span>
          <span style={{ fontWeight: 400, color: 'var(--gray-500)' }}>
            ~{wordCount} words
          </span>
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your blog post content in Markdown..."
          rows={15}
          style={{
            width: '100%',
            padding: '16px',
            fontSize: '14px',
            fontFamily: 'monospace',
            lineHeight: 1.6,
            border: '1px solid var(--gray-300)',
            borderRadius: '8px',
            resize: 'vertical',
          }}
        />
      </div>
      
      {/* Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px',
        paddingTop: '16px',
        borderTop: '1px solid var(--gray-200)',
      }}>
        <button
          onClick={onCancel}
          disabled={isSaving}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 16px',
            backgroundColor: 'white',
            color: 'var(--gray-700)',
            border: '1px solid var(--gray-300)',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <X size={16} />
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || !title || !body}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 16px',
            backgroundColor: 'var(--primary-600)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: isSaving ? 'wait' : 'pointer',
            opacity: isSaving || !title || !body ? 0.6 : 1,
          }}
        >
          <Save size={16} />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
