/**
 * SocialPreview
 * 
 * Platform-specific preview components that render content
 * as it would appear on each social platform.
 * 
 * Helps users visualize the final post before publishing.
 */

import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Bookmark, 
  ThumbsUp,
  Send,
  MoreHorizontal,
  Play,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface PreviewProps {
  content: Record<string, any>;
  accountName?: string;
}

// =============================================================================
// INSTAGRAM PREVIEW
// =============================================================================

export function InstagramPreview({ content, accountName = 'your_account' }: PreviewProps) {
  const caption = content.caption || content.text || '';
  const hashtags = content.hashtags || [];
  const mediaUrl = content.media_urls?.[0] || content.media_url;
  
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      border: '1px solid #dbdbdb',
      maxWidth: '400px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px',
        gap: '10px',
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '12px',
          fontWeight: 600,
        }}>
          {accountName.charAt(0).toUpperCase()}
        </div>
        <span style={{ fontWeight: 600, fontSize: '14px' }}>{accountName}</span>
        <MoreHorizontal size={16} style={{ marginLeft: 'auto', color: '#262626' }} />
      </div>
      
      {/* Media */}
      <div style={{
        aspectRatio: '1',
        backgroundColor: '#fafafa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {mediaUrl ? (
          <img 
            src={mediaUrl} 
            alt="Post preview"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div style={{ color: '#8e8e8e', fontSize: '13px' }}>
            📸 Image preview
          </div>
        )}
      </div>
      
      {/* Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px',
        gap: '16px',
      }}>
        <Heart size={24} color="#262626" />
        <MessageCircle size={24} color="#262626" />
        <Send size={24} color="#262626" />
        <Bookmark size={24} color="#262626" style={{ marginLeft: 'auto' }} />
      </div>
      
      {/* Caption */}
      <div style={{ padding: '0 12px 12px' }}>
        <div style={{ fontSize: '14px', lineHeight: 1.5 }}>
          <span style={{ fontWeight: 600 }}>{accountName}</span>{' '}
          {caption}
          {hashtags.length > 0 && (
            <span style={{ color: '#00376b' }}>
              {' '}{hashtags.map((tag: string) => `#${tag}`).join(' ')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// FACEBOOK PREVIEW
// =============================================================================

export function FacebookPreview({ content, accountName = 'Your Page' }: PreviewProps) {
  const text = content.text || content.caption || '';
  const mediaUrl = content.media_urls?.[0] || content.media_url;
  const linkUrl = content.link_url;
  
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
      maxWidth: '500px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px',
        gap: '10px',
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          backgroundColor: '#1877F2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '14px',
          fontWeight: 600,
        }}>
          {accountName.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '14px' }}>{accountName}</div>
          <div style={{ fontSize: '12px', color: '#65676b' }}>Just now · 🌍</div>
        </div>
        <MoreHorizontal size={20} style={{ marginLeft: 'auto', color: '#65676b' }} />
      </div>
      
      {/* Text */}
      <div style={{ padding: '0 12px 12px', fontSize: '15px', lineHeight: 1.5 }}>
        {text}
      </div>
      
      {/* Media or Link Preview */}
      {(mediaUrl || linkUrl) && (
        <div style={{
          backgroundColor: '#f0f2f5',
          aspectRatio: '16/9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {mediaUrl ? (
            <img 
              src={mediaUrl} 
              alt="Post preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : linkUrl ? (
            <div style={{ 
              textAlign: 'center',
              padding: '20px',
              color: '#65676b',
            }}>
              🔗 Link preview: {linkUrl}
            </div>
          ) : null}
        </div>
      )}
      
      {/* Engagement Stats */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: '1px solid #e4e6eb',
        fontSize: '13px',
        color: '#65676b',
      }}>
        <span>👍 0</span>
        <span style={{ marginLeft: 'auto' }}>0 comments · 0 shares</span>
      </div>
      
      {/* Actions */}
      <div style={{
        display: 'flex',
        padding: '4px',
      }}>
        {[
          { icon: <ThumbsUp size={18} />, label: 'Like' },
          { icon: <MessageCircle size={18} />, label: 'Comment' },
          { icon: <Share2 size={18} />, label: 'Share' },
        ].map(({ icon, label }) => (
          <button
            key={label}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '8px',
              border: 'none',
              background: 'none',
              color: '#65676b',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'default',
            }}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// LINKEDIN PREVIEW
// =============================================================================

export function LinkedInPreview({ content, accountName = 'Your Name' }: PreviewProps) {
  const text = content.text || content.caption || '';
  const mediaUrl = content.media_url || content.media_urls?.[0];
  const articleUrl = content.article_url;
  
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      border: '1px solid #e0e0e0',
      maxWidth: '550px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        padding: '12px',
        gap: '12px',
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: '#0A66C2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '16px',
          fontWeight: 600,
        }}>
          {accountName.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '14px', color: '#000' }}>{accountName}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>Professional Title</div>
          <div style={{ fontSize: '12px', color: '#666' }}>Just now · 🌍</div>
        </div>
        <MoreHorizontal size={20} style={{ color: '#666' }} />
      </div>
      
      {/* Text */}
      <div style={{ 
        padding: '0 12px 12px', 
        fontSize: '14px', 
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
      }}>
        {text}
      </div>
      
      {/* Media or Article */}
      {(mediaUrl || articleUrl) && (
        <div style={{
          backgroundColor: '#f3f2ef',
          aspectRatio: '16/9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {mediaUrl ? (
            <img 
              src={mediaUrl} 
              alt="Post preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : articleUrl ? (
            <div style={{ 
              textAlign: 'center',
              padding: '20px',
              color: '#666',
            }}>
              📄 Article: {articleUrl}
            </div>
          ) : null}
        </div>
      )}
      
      {/* Engagement */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        borderTop: '1px solid #e0e0e0',
        borderBottom: '1px solid #e0e0e0',
        fontSize: '12px',
        color: '#666',
      }}>
        <span>👍 0 reactions</span>
        <span style={{ marginLeft: 'auto' }}>0 comments</span>
      </div>
      
      {/* Actions */}
      <div style={{
        display: 'flex',
        padding: '4px 12px',
      }}>
        {['Like', 'Comment', 'Repost', 'Send'].map((label) => (
          <button
            key={label}
            style={{
              flex: 1,
              padding: '12px 8px',
              border: 'none',
              background: 'none',
              color: '#666',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'default',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// TIKTOK PREVIEW
// =============================================================================

export function TikTokPreview({ content, accountName = '@your_account' }: PreviewProps) {
  const caption = content.caption || content.text || '';
  const hashtags = content.hashtags || [];
  
  return (
    <div style={{
      backgroundColor: '#000',
      borderRadius: '12px',
      maxWidth: '320px',
      aspectRatio: '9/16',
      position: 'relative',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Video placeholder */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: '40px',
      }}>
        <Play size={60} />
      </div>
      
      {/* Bottom overlay */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '60px 12px 12px',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
        color: 'white',
      }}>
        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
          {accountName}
        </div>
        <div style={{ fontSize: '13px', lineHeight: 1.4 }}>
          {caption}
          {hashtags.length > 0 && (
            <span style={{ color: '#fff' }}>
              {' '}{hashtags.map((tag: string) => `#${tag}`).join(' ')}
            </span>
          )}
        </div>
        <div style={{ 
          marginTop: '8px', 
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          🎵 Original Sound - {accountName}
        </div>
      </div>
      
      {/* Side actions */}
      <div style={{
        position: 'absolute',
        right: '8px',
        bottom: '100px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
        color: 'white',
      }}>
        {[
          { icon: <Heart size={28} />, count: '0' },
          { icon: <MessageCircle size={28} />, count: '0' },
          { icon: <Bookmark size={28} />, count: '0' },
          { icon: <Share2 size={28} />, count: '0' },
        ].map(({ icon, count }, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            {icon}
            <div style={{ fontSize: '11px', marginTop: '2px' }}>{count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// YOUTUBE PREVIEW
// =============================================================================

export function YouTubePreview({ content, accountName = 'Your Channel' }: PreviewProps) {
  const title = content.title || '';
  const description = content.description || '';
  
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      maxWidth: '400px',
      fontFamily: 'Roboto, Arial, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Thumbnail */}
      <div style={{
        aspectRatio: '16/9',
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        <Play size={60} color="#fff" />
        <div style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          backgroundColor: 'rgba(0,0,0,0.8)',
          color: '#fff',
          padding: '2px 4px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 500,
        }}>
          0:00
        </div>
      </div>
      
      {/* Info */}
      <div style={{
        display: 'flex',
        padding: '12px',
        gap: '12px',
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          backgroundColor: '#FF0000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '14px',
          fontWeight: 600,
          flexShrink: 0,
        }}>
          {accountName.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{
            fontWeight: 500,
            fontSize: '14px',
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {title || 'Video Title'}
          </div>
          <div style={{
            fontSize: '12px',
            color: '#606060',
            marginTop: '4px',
          }}>
            {accountName} · 0 views · Just now
          </div>
        </div>
        <MoreHorizontal size={20} style={{ color: '#606060', flexShrink: 0 }} />
      </div>
    </div>
  );
}

// =============================================================================
// UNIFIED PREVIEW COMPONENT
// =============================================================================

interface SocialPreviewProps {
  platform: string;
  content: Record<string, any>;
  accountName?: string;
}

export default function SocialPreview({ 
  platform, 
  content, 
  accountName 
}: SocialPreviewProps) {
  const previews: Record<string, React.ComponentType<PreviewProps>> = {
    instagram: InstagramPreview,
    facebook: FacebookPreview,
    linkedin: LinkedInPreview,
    tiktok: TikTokPreview,
    youtube: YouTubePreview,
  };
  
  const PreviewComponent = previews[platform.toLowerCase()];
  
  if (!PreviewComponent) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: 'var(--gray-500)',
        backgroundColor: 'var(--gray-50)',
        borderRadius: '8px',
      }}>
        Preview not available for {platform}
      </div>
    );
  }
  
  return <PreviewComponent content={content} accountName={accountName} />;
}
