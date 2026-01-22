/**
 * IntegrationsPanel
 * 
 * Displays the 5 social media platforms with their connection status.
 * Users can connect/disconnect platforms directly from this panel.
 * Shown inside the Workspace view.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle2, 
  Loader2, 
  RefreshCw,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import {
  getSocialConnections,
  disconnectIntegration,
  openOAuthPopup,
  type SocialConnection,
} from '../../lib/api';
import {
  SOCIAL_PLATFORMS,
  PLATFORM_INFO,
  type SocialPlatform,
} from '../../config/social-platforms';
import PlatformIcon from './PlatformIcon';

// ============================================================================
// Platform Card Component
// ============================================================================

interface PlatformCardProps {
  platform: SocialPlatform;
  connection: SocialConnection | null;
  onConnect: (platform: SocialPlatform) => void;
  onDisconnect: (connectionId: string, platform: string) => void;
  isConnecting: boolean;
  isDisconnecting: boolean;
}

function PlatformCard({
  platform,
  connection,
  onConnect,
  onDisconnect,
  isConnecting,
  isDisconnecting,
}: PlatformCardProps) {
  const info = PLATFORM_INFO[platform];
  const isConnected = connection?.connected ?? false;
  const isLoading = isConnecting || isDisconnecting;
  
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px',
        backgroundColor: 'white',
        borderRadius: '12px',
        border: `1px solid ${isConnected ? info.color + '40' : 'var(--gray-200)'}`,
        transition: 'all 0.2s ease',
        boxShadow: isConnected 
          ? `0 0 0 1px ${info.color}20, 0 2px 8px ${info.color}10` 
          : '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {/* Platform Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Icon with white background, brand-colored logo */}
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            boxShadow: isConnected 
              ? `0 0 0 2px ${info.color}30, 0 4px 12px rgba(0,0,0,0.08)` 
              : '0 1px 3px rgba(0,0,0,0.08)',
            border: `1px solid ${isConnected ? info.color + '40' : 'var(--gray-200)'}`,
          }}
        >
          <PlatformIcon 
            platform={platform} 
            size={26} 
            color={info.color} 
          />
        </div>
        
        {/* Name and Status */}
        <div>
          <div style={{ 
            fontWeight: 600, 
            fontSize: '15px',
            color: 'var(--gray-900)',
            marginBottom: '2px',
          }}>
            {info.name}
          </div>
          <div style={{ 
            fontSize: '13px', 
            color: isConnected ? '#059669' : 'var(--gray-500)',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}>
            {isConnected ? (
              <>
                <CheckCircle2 size={14} style={{ color: '#059669' }} />
                <span>{connection?.account_name || 'Connected'}</span>
              </>
            ) : (
              <span>Not connected</span>
            )}
          </div>
        </div>
      </div>
      
      {/* Action Button */}
      <button
        onClick={() => {
          if (isConnected && connection?.connection_id) {
            onDisconnect(connection.connection_id, platform);
          } else {
            onConnect(platform);
          }
        }}
        disabled={isLoading}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: '10px 18px',
          backgroundColor: isConnected ? 'var(--gray-100)' : 'var(--primary-600)',
          color: isConnected ? 'var(--gray-700)' : 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.7 : 1,
          transition: 'all 0.15s ease',
          minWidth: '100px',
        }}
        onMouseEnter={(e) => {
          if (!isLoading) {
            e.currentTarget.style.backgroundColor = isConnected 
              ? 'var(--gray-200)' 
              : 'var(--primary-700)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = isConnected 
            ? 'var(--gray-100)' 
            : 'var(--primary-600)';
        }}
      >
        {isLoading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : isConnected ? (
          'Disconnect'
        ) : (
          <>
            Connect
            <ExternalLink size={14} style={{ opacity: 0.8 }} />
          </>
        )}
      </button>
    </div>
  );
}

// ============================================================================
// Main Panel Component
// ============================================================================

interface IntegrationsPanelProps {
  compact?: boolean;
}

export default function IntegrationsPanel({ compact = false }: IntegrationsPanelProps) {
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  
  // Fetch connections
  const fetchConnections = useCallback(async () => {
    try {
      setError(null);
      const data = await getSocialConnections();
      setConnections(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connections');
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);
  
  // Handle connect
  const handleConnect = useCallback((platform: SocialPlatform) => {
    setConnectingPlatform(platform);
    
    openOAuthPopup(
      platform,
      () => {
        // Success - refresh connections
        setConnectingPlatform(null);
        fetchConnections();
      },
      (errorMsg) => {
        setConnectingPlatform(null);
        setError(errorMsg);
      }
    );
  }, [fetchConnections]);
  
  // Handle disconnect
  const handleDisconnect = useCallback(async (connectionId: string, platform: string) => {
    try {
      setDisconnectingId(connectionId);
      await disconnectIntegration(connectionId, platform);
      await fetchConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setDisconnectingId(null);
    }
  }, [fetchConnections]);
  
  // Get connection for a platform
  const getConnection = (platform: SocialPlatform): SocialConnection | null => {
    return connections.find(c => c.platform === platform) || null;
  };
  
  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
      }}>
        <div>
          <h3 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 700,
            color: 'var(--gray-900)',
          }}>
            Social Integrations
          </h3>
          <p style={{
            margin: '6px 0 0 0',
            fontSize: '14px',
            color: 'var(--gray-500)',
          }}>
            Connect your accounts to publish content directly
          </p>
        </div>
        
        <button
          onClick={fetchConnections}
          disabled={isLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px 14px',
            backgroundColor: 'var(--gray-100)',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--gray-700)',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="Refresh connections"
        >
          <RefreshCw 
            size={14} 
            style={{ 
              animation: isLoading ? 'spin 1s linear infinite' : 'none',
            }} 
          />
          Refresh
        </button>
      </div>
      
      {/* Error Message */}
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '14px 16px',
          marginBottom: '16px',
          backgroundColor: '#fef2f2',
          borderRadius: '10px',
          border: '1px solid #fecaca',
          fontSize: '13px',
          color: '#dc2626',
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      
      {/* Loading State */}
      {isLoading && connections.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px',
          color: 'var(--gray-500)',
          gap: '12px',
        }}>
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--primary-600)' }} />
          <span style={{ fontSize: '14px' }}>Loading integrations...</span>
        </div>
      ) : (
        /* Platform List */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {SOCIAL_PLATFORMS.map((platform) => (
            <PlatformCard
              key={platform}
              platform={platform}
              connection={getConnection(platform)}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              isConnecting={connectingPlatform === platform}
              isDisconnecting={disconnectingId === getConnection(platform)?.connection_id}
            />
          ))}
        </div>
      )}
      
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
