/**
 * ContentWriter Component
 * 
 * Rich text editor for creating social media content with:
 * - Platform-specific formatting
 * - Character count with limits
 * - Hashtag suggestions
 * - Media attachment support
 * - Multi-platform preview
 */

import { useState, useEffect } from 'react';
import {
  Edit3,
  Hash,
  Image as ImageIcon,
  Link,
  AtSign,
  Smile,
  Send,
  Save,
  X,
  Check,
  AlertCircle,
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  Clock,
} from 'lucide-react';
import { Task } from '../../registry';

interface ContentWriterProps {
  task?: Task;
  initialContent?: string;
  platform?: string;
  onSave: (content: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
}

interface PlatformConfig {
  name: string;
  icon: React.ComponentType<{ size?: number }>;
  maxChars: number;
  color: string;
  bgColor: string;
  features: string[];
}

const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  instagram: {
    name: 'Instagram',
    icon: Instagram,
    maxChars: 2200,
    color: '#E1306C',
    bgColor: '#fce7f3',
    features: ['media_required', 'hashtags', 'mentions'],
  },
  facebook: {
    name: 'Facebook',
    icon: Facebook,
    maxChars: 63206,
    color: '#1877F2',
    bgColor: '#dbeafe',
    features: ['text', 'media', 'links'],
  },
  linkedin: {
    name: 'LinkedIn',
    icon: Linkedin,
    maxChars: 3000,
    color: '#0A66C2',
    bgColor: '#dbeafe',
    features: ['text', 'media', 'articles'],
  },
  tiktok: {
    name: 'TikTok',
    icon: Clock,
    maxChars: 2200,
    color: '#000000',
    bgColor: '#f3f4f6',
    features: ['video_required', 'hashtags', 'sounds'],
  },
  youtube: {
    name: 'YouTube',
    icon: Youtube,
    maxChars: 5000,
    color: '#FF0000',
    bgColor: '#fee2e2',
    features: ['video_required', 'title', 'tags'],
  },
  twitter: {
    name: 'Twitter/X',
    icon: AtSign,
    maxChars: 280,
    color: '#1DA1F2',
    bgColor: '#dbeafe',
    features: ['text', 'media', 'links', 'threads'],
  },
};

const SUGGESTED_HASHTAGS = [
  'trending', 'viral', 'foryou', 'explore', 'socialmedia',
  'marketing', 'business', 'entrepreneur', 'startup', 'growth',
];

export default function ContentWriter({
  task,
  initialContent = '',
  platform = 'instagram',
  onSave,
  onCancel,
  isSaving = false,
}: ContentWriterProps) {
  const [content, setContent] = useState(initialContent);
  const [caption, setCaption] = useState(task?.content_payload?.caption as string || '');
  const [text, setText] = useState(task?.content_payload?.text as string || '');
  const [title, setTitle] = useState(task?.content_payload?.title as string || '');
  const [description, setDescription] = useState(task?.content_payload?.description as string || '');
  const [hashtags, setHashtags] = useState<string[]>(task?.content_payload?.hashtags as string[] || []);
  const [newHashtag, setNewHashtag] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>(task?.content_payload?.media_urls as string[] || []);
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState(platform);
  const [showHashtagSuggestions, setShowHashtagSuggestions] = useState(false);

  const platformConfig = PLATFORM_CONFIGS[selectedPlatform] || PLATFORM_CONFIGS.instagram;
  const PlatformIcon = platformConfig.icon;

  // Get the main text content based on platform
  const mainContent = selectedPlatform === 'youtube' ? description : 
                      selectedPlatform === 'linkedin' || selectedPlatform === 'facebook' || selectedPlatform === 'twitter' ? text : caption;
  const setMainContent = selectedPlatform === 'youtube' ? setDescription :
                         selectedPlatform === 'linkedin' || selectedPlatform === 'facebook' || selectedPlatform === 'twitter' ? setText : setCaption;
  const charCount = mainContent.length;
  const isOverLimit = charCount > platformConfig.maxChars;

  const addHashtag = (tag: string) => {
    const cleanTag = tag.replace(/^#/, '').trim();
    if (cleanTag && !hashtags.includes(cleanTag)) {
      setHashtags([...hashtags, cleanTag]);
    }
    setNewHashtag('');
  };

  const removeHashtag = (tag: string) => {
    setHashtags(hashtags.filter(h => h !== tag));
  };

  const addMediaUrl = () => {
    if (newMediaUrl.trim()) {
      setMediaUrls([...mediaUrls, newMediaUrl.trim()]);
      setNewMediaUrl('');
    }
  };

  const removeMediaUrl = (url: string) => {
    setMediaUrls(mediaUrls.filter(u => u !== url));
  };

  const handleSave = async () => {
    const payload: Record<string, unknown> = {};
    
    // Set content based on platform
    if (selectedPlatform === 'instagram') {
      payload.caption = caption;
      payload.hashtags = hashtags;
      payload.media_urls = mediaUrls;
    } else if (selectedPlatform === 'facebook') {
      payload.text = text;
      payload.media_urls = mediaUrls;
    } else if (selectedPlatform === 'linkedin') {
      payload.text = text;
      payload.media_url = mediaUrls[0] || null;
    } else if (selectedPlatform === 'tiktok') {
      payload.caption = caption;
      payload.hashtags = hashtags;
      payload.video_url = mediaUrls[0] || '';
    } else if (selectedPlatform === 'youtube') {
      payload.title = title;
      payload.description = description;
      payload.tags = hashtags;
      payload.video_url = mediaUrls[0] || '';
      payload.visibility = 'private';
    } else if (selectedPlatform === 'twitter') {
      payload.text = text;
      payload.media_urls = mediaUrls;
    }
    
    await onSave(payload);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'white',
      borderRadius: '12px',
      border: '1px solid var(--gray-200)',
      overflow: 'hidden',
    }}>
      {/* Header with Platform Selector */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '16px 20px',
        borderBottom: '1px solid var(--gray-200)',
        backgroundColor: platformConfig.bgColor,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: platformConfig.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
          }}>
            <PlatformIcon size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
              Create {platformConfig.name} Post
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--gray-600)' }}>
              Max {platformConfig.maxChars.toLocaleString()} characters
            </p>
          </div>
        </div>
        
        {/* Platform Tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginLeft: 'auto',
        }}>
          {Object.entries(PLATFORM_CONFIGS).slice(0, 5).map(([key, config]) => {
            const Icon = config.icon;
            const isSelected = key === selectedPlatform;
            return (
              <button
                key={key}
                onClick={() => setSelectedPlatform(key)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  border: isSelected ? `2px solid ${config.color}` : '1px solid var(--gray-300)',
                  backgroundColor: isSelected ? config.bgColor : 'white',
                  color: isSelected ? config.color : 'var(--gray-500)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title={config.name}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Editor Area */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {/* Title (YouTube only) */}
        {selectedPlatform === 'youtube' && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--gray-700)',
              marginBottom: '6px',
            }}>
              Video Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter video title..."
              maxLength={100}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid var(--gray-300)',
                borderRadius: '8px',
                fontSize: '15px',
              }}
            />
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--gray-500)' }}>
              {title.length}/100 characters
            </p>
          </div>
        )}

        {/* Main Content Area */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--gray-700)',
            marginBottom: '6px',
          }}>
            {selectedPlatform === 'youtube' ? 'Description' : 
             selectedPlatform === 'instagram' || selectedPlatform === 'tiktok' ? 'Caption' : 'Content'}
          </label>
          <div style={{ position: 'relative' }}>
            <textarea
              value={mainContent}
              onChange={(e) => setMainContent(e.target.value)}
              placeholder={`Write your ${platformConfig.name} ${selectedPlatform === 'youtube' ? 'description' : 'post'}...`}
              style={{
                width: '100%',
                minHeight: '180px',
                padding: '12px',
                border: `1px solid ${isOverLimit ? 'var(--red-500)' : 'var(--gray-300)'}`,
                borderRadius: '8px',
                fontSize: '15px',
                lineHeight: 1.6,
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
            
            {/* Character Count */}
            <div style={{
              position: 'absolute',
              bottom: '10px',
              right: '10px',
              fontSize: '12px',
              color: isOverLimit ? 'var(--red-500)' : 'var(--gray-500)',
              backgroundColor: 'rgba(255,255,255,0.9)',
              padding: '2px 6px',
              borderRadius: '4px',
            }}>
              {charCount.toLocaleString()}/{platformConfig.maxChars.toLocaleString()}
              {isOverLimit && <AlertCircle size={12} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />}
            </div>
          </div>
        </div>

        {/* Hashtags */}
        {(selectedPlatform === 'instagram' || selectedPlatform === 'tiktok' || selectedPlatform === 'youtube') && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--gray-700)',
              marginBottom: '6px',
            }}>
              <Hash size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              {selectedPlatform === 'youtube' ? 'Tags' : 'Hashtags'}
            </label>
            
            {/* Current Hashtags */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              marginBottom: '10px',
            }}>
              {hashtags.map(tag => (
                <span
                  key={tag}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    backgroundColor: platformConfig.bgColor,
                    color: platformConfig.color,
                    borderRadius: '16px',
                    fontSize: '13px',
                    fontWeight: 500,
                  }}
                >
                  #{tag}
                  <button
                    onClick={() => removeHashtag(tag)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0 2px',
                      color: 'inherit',
                      opacity: 0.7,
                    }}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            
            {/* Add Hashtag Input */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={newHashtag}
                onChange={(e) => setNewHashtag(e.target.value.replace(/\s/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addHashtag(newHashtag);
                  }
                }}
                placeholder="Add hashtag..."
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '1px solid var(--gray-300)',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
              <button
                onClick={() => addHashtag(newHashtag)}
                disabled={!newHashtag.trim()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: platformConfig.color,
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: newHashtag.trim() ? 'pointer' : 'not-allowed',
                  opacity: newHashtag.trim() ? 1 : 0.5,
                  fontSize: '14px',
                }}
              >
                Add
              </button>
            </div>
            
            {/* Suggested Hashtags */}
            <div style={{ marginTop: '10px' }}>
              <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: '6px' }}>
                Suggestions:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {SUGGESTED_HASHTAGS.filter(t => !hashtags.includes(t)).slice(0, 6).map(tag => (
                  <button
                    key={tag}
                    onClick={() => addHashtag(tag)}
                    style={{
                      padding: '4px 10px',
                      backgroundColor: 'var(--gray-100)',
                      color: 'var(--gray-600)',
                      border: '1px solid var(--gray-200)',
                      borderRadius: '16px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Media URLs */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--gray-700)',
            marginBottom: '6px',
          }}>
            <ImageIcon size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            {selectedPlatform === 'youtube' || selectedPlatform === 'tiktok' ? 'Video URL' : 'Media URLs'}
          </label>
          
          {/* Current Media */}
          {mediaUrls.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              {mediaUrls.map((url, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px',
                    backgroundColor: 'var(--gray-50)',
                    borderRadius: '6px',
                    marginBottom: '6px',
                  }}
                >
                  <Link size={14} color="var(--gray-400)" />
                  <span style={{
                    flex: 1,
                    fontSize: '13px',
                    color: 'var(--gray-700)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {url}
                  </span>
                  <button
                    onClick={() => removeMediaUrl(url)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--red-500)',
                      padding: '4px',
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Add Media Input */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="url"
              value={newMediaUrl}
              onChange={(e) => setNewMediaUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addMediaUrl();
                }
              }}
              placeholder="https://example.com/image.jpg"
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid var(--gray-300)',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            />
            <button
              onClick={addMediaUrl}
              disabled={!newMediaUrl.trim()}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--gray-700)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: newMediaUrl.trim() ? 'pointer' : 'not-allowed',
                opacity: newMediaUrl.trim() ? 1 : 0.5,
                fontSize: '14px',
              }}
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px',
        padding: '16px 20px',
        borderTop: '1px solid var(--gray-200)',
        backgroundColor: 'var(--gray-50)',
      }}>
        <button
          onClick={onCancel}
          disabled={isSaving}
          style={{
            padding: '10px 20px',
            backgroundColor: 'white',
            color: 'var(--gray-700)',
            border: '1px solid var(--gray-300)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <X size={16} />
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || isOverLimit}
          style={{
            padding: '10px 20px',
            backgroundColor: isOverLimit ? 'var(--gray-300)' : platformConfig.color,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: isSaving || isOverLimit ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {isSaving ? (
            <>
              <span className="animate-spin" style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white',
                borderRadius: '50%',
              }} />
              Saving...
            </>
          ) : (
            <>
              <Save size={16} />
              Save Content
            </>
          )}
        </button>
      </div>
    </div>
  );
}
