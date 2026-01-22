/**
 * IntegrationActionCard
 * 
 * Renders an in-chat connect button when social_publisher detects
 * that a platform is not connected. This provides a seamless UX
 * where users can connect without leaving the chat.
 * 
 * Triggered by the `request_connect_integration` tool output.
 */

import { useState } from 'react';
import { Loader2, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';
import { openOAuthPopup } from '../../lib/api';
import { PLATFORM_INFO, type SocialPlatform } from '../../config/social-platforms';
import PlatformIcon from './PlatformIcon';

// ============================================================================
// Types
// ============================================================================

export interface IntegrationActionData {
  action: 'connect_integration';
  platform: string;
  reason?: string;
  message?: string;
}

interface IntegrationActionCardProps {
  data: IntegrationActionData;
  onConnected?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export default function IntegrationActionCard({ 
  data, 
  onConnected 
}: IntegrationActionCardProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const platform = data.platform.toLowerCase() as SocialPlatform;
  const info = PLATFORM_INFO[platform];
  
  // If platform not recognized, show generic card
  if (!info) {
    return (
      <div style={{
        padding: '16px',
        backgroundColor: 'var(--gray-50)',
        borderRadius: '12px',
        border: '1px solid var(--gray-200)',
      }}>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--gray-700)' }}>
          {data.message || `Please connect your ${data.platform} account.`}
        </p>
      </div>
    );
  }
  
  const handleConnect = () => {
    setIsConnecting(true);
    setError(null);
    
    openOAuthPopup(
      platform,
      () => {
        setIsConnecting(false);
        setIsConnected(true);
        onConnected?.();
      },
      (errorMsg) => {
        setIsConnecting(false);
        setError(errorMsg);
      }
    );
  };
  
  // Success state
  if (isConnected) {
    return (
      <div style={{
        padding: '20px',
        backgroundColor: '#f0fdf4',
        borderRadius: '14px',
        border: '1px solid #bbf7d0',
        boxShadow: '0 0 0 1px #10b98120',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}>
          {/* Platform icon with checkmark overlay */}
          <div style={{
            position: 'relative',
            width: '52px',
            height: '52px',
          }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 0 2px ${info.color}30, 0 4px 12px rgba(0,0,0,0.08)`,
              border: `1px solid ${info.color}30`,
            }}>
              <PlatformIcon platform={platform} size={28} color={info.color} />
            </div>
            {/* Success badge */}
            <div style={{
              position: 'absolute',
              bottom: '-4px',
              right: '-4px',
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}>
              <CheckCircle2 size={14} style={{ color: 'white' }} />
            </div>
          </div>
          <div>
            <div style={{
              fontWeight: 700,
              fontSize: '16px',
              color: '#166534',
              marginBottom: '2px',
            }}>
              {info.name} Connected!
            </div>
            <div style={{
              fontSize: '14px',
              color: '#15803d',
            }}>
              You can now publish to {info.name}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div style={{
      padding: '20px',
      backgroundColor: info.bgColor,
      borderRadius: '14px',
      border: `1px solid ${info.color}25`,
      boxShadow: `0 0 0 1px ${info.color}10`,
    }}>
      {/* Header with icon and message */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '14px',
        marginBottom: '18px',
      }}>
        {/* Platform Icon - white background with brand-colored logo */}
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '14px',
          background: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: `0 0 0 2px ${info.color}25, 0 4px 12px rgba(0,0,0,0.08)`,
          border: `1px solid ${info.color}30`,
        }}>
          <PlatformIcon platform={platform} size={28} color={info.color} />
        </div>
        
        {/* Message */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontWeight: 700,
            fontSize: '16px',
            color: 'var(--gray-900)',
            marginBottom: '4px',
          }}>
            Connect {info.name}
          </div>
          <div style={{
            fontSize: '14px',
            color: 'var(--gray-600)',
            lineHeight: 1.5,
          }}>
            {data.message || data.reason || `Connect your ${info.name} account to publish content.`}
          </div>
        </div>
      </div>
      
      {/* Error message */}
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 14px',
          marginBottom: '14px',
          backgroundColor: '#fef2f2',
          borderRadius: '10px',
          border: '1px solid #fecaca',
          fontSize: '13px',
          color: '#dc2626',
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}
      
      {/* Connect Button */}
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          width: '100%',
          padding: '14px 20px',
          backgroundColor: 'var(--primary-600)',
          color: 'white',
          border: 'none',
          borderRadius: '10px',
          fontSize: '15px',
          fontWeight: 700,
          cursor: isConnecting ? 'not-allowed' : 'pointer',
          opacity: isConnecting ? 0.85 : 1,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          if (!isConnecting) {
            e.currentTarget.style.backgroundColor = 'var(--primary-700)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--primary-600)';
        }}
      >
        {isConnecting ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <PlatformIcon platform={platform} size={20} color="white" />
            Connect {info.name}
            <ExternalLink size={16} style={{ opacity: 0.85 }} />
          </>
        )}
      </button>
      
      {/* Help text */}
      <p style={{
        margin: '14px 0 0 0',
        fontSize: '12px',
        color: 'var(--gray-500)',
        textAlign: 'center',
      }}>
        Secure OAuth authentication via popup
      </p>
      
      {/* Animation styles */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Helper to check if tool output is an integration action
// ============================================================================

export function isIntegrationAction(data: unknown): data is IntegrationActionData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return d.action === 'connect_integration' && typeof d.platform === 'string';
}
