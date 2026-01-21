/**
 * PlatformSelector
 * 
 * Checkbox selector for social media platforms.
 * Shows connection status for each platform.
 */

import { CheckCircle, Circle, AlertCircle, Loader2, Link } from 'lucide-react';

// Platform display configuration
const PLATFORM_CONFIG: Record<string, { name: string; color: string; icon: string }> = {
  instagram: { name: 'Instagram', color: '#E4405F', icon: '📸' },
  facebook: { name: 'Facebook', color: '#1877F2', icon: '📘' },
  linkedin: { name: 'LinkedIn', color: '#0A66C2', icon: '💼' },
  tiktok: { name: 'TikTok', color: '#000000', icon: '🎵' },
  youtube: { name: 'YouTube', color: '#FF0000', icon: '▶️' },
};

interface SocialConnection {
  platform: string;
  connection_id: string;
  connected: boolean;
  account_name?: string;
}

interface PlatformSelectorProps {
  connections: SocialConnection[];
  selectedPlatforms: string[];
  onSelectionChange: (platforms: string[]) => void;
  loading?: boolean;
}

export default function PlatformSelector({
  connections,
  selectedPlatforms,
  onSelectionChange,
  loading = false,
}: PlatformSelectorProps) {
  const togglePlatform = (platform: string) => {
    if (selectedPlatforms.includes(platform)) {
      onSelectionChange(selectedPlatforms.filter(p => p !== platform));
    } else {
      onSelectionChange([...selectedPlatforms, platform]);
    }
  };
  
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px',
        color: 'var(--gray-500)',
        fontSize: '13px',
      }}>
        <Loader2 size={16} className="animate-spin" />
        Loading connected platforms...
      </div>
    );
  }
  
  const connectedPlatforms = connections.filter(c => c.connected);
  const disconnectedPlatforms = connections.filter(c => !c.connected);
  
  if (connectedPlatforms.length === 0) {
    return (
      <div style={{
        padding: '16px',
        backgroundColor: 'var(--gray-50)',
        borderRadius: '8px',
        border: '1px solid var(--gray-200)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: 'var(--gray-600)',
          marginBottom: '8px',
        }}>
          <AlertCircle size={16} />
          <span style={{ fontWeight: 500 }}>No platforms connected</span>
        </div>
        <p style={{ 
          fontSize: '13px', 
          color: 'var(--gray-500)',
          margin: 0,
        }}>
          Connect your social accounts in Settings → Integrations to publish.
        </p>
      </div>
    );
  }
  
  return (
    <div>
      <div style={{
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--gray-700)',
        marginBottom: '12px',
      }}>
        Select platforms to publish:
      </div>
      
      {/* Connected Platforms */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: disconnectedPlatforms.length > 0 ? '12px' : 0,
      }}>
        {connectedPlatforms.map((conn) => {
          const config = PLATFORM_CONFIG[conn.platform] || { 
            name: conn.platform, 
            color: '#6b7280',
            icon: '🔗',
          };
          const isSelected = selectedPlatforms.includes(conn.platform);
          
          return (
            <button
              key={conn.platform}
              onClick={() => togglePlatform(conn.platform)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: isSelected 
                  ? `2px solid ${config.color}` 
                  : '2px solid var(--gray-200)',
                backgroundColor: isSelected 
                  ? `${config.color}10` 
                  : 'white',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: '16px' }}>{config.icon}</span>
              <span style={{
                fontSize: '13px',
                fontWeight: 500,
                color: isSelected ? config.color : 'var(--gray-700)',
              }}>
                {config.name}
              </span>
              {isSelected ? (
                <CheckCircle size={14} color={config.color} />
              ) : (
                <Circle size={14} color="var(--gray-300)" />
              )}
            </button>
          );
        })}
      </div>
      
      {/* Disconnected Platforms (shown but disabled) */}
      {disconnectedPlatforms.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          opacity: 0.5,
        }}>
          {disconnectedPlatforms.map((conn) => {
            const config = PLATFORM_CONFIG[conn.platform] || { 
              name: conn.platform, 
              color: '#6b7280',
              icon: '🔗',
            };
            
            return (
              <div
                key={conn.platform}
                title={`Connect ${config.name} in Settings → Integrations`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '2px dashed var(--gray-200)',
                  backgroundColor: 'var(--gray-50)',
                  cursor: 'not-allowed',
                }}
              >
                <span style={{ fontSize: '16px' }}>{config.icon}</span>
                <span style={{
                  fontSize: '13px',
                  color: 'var(--gray-400)',
                }}>
                  {config.name}
                </span>
                <Link size={12} color="var(--gray-300)" />
              </div>
            );
          })}
        </div>
      )}
      
      {/* Selection Count */}
      <div style={{
        marginTop: '12px',
        fontSize: '12px',
        color: 'var(--gray-500)',
      }}>
        {selectedPlatforms.length} of {connectedPlatforms.length} platform{connectedPlatforms.length !== 1 ? 's' : ''} selected
      </div>
    </div>
  );
}
