import { useState, useEffect, useCallback, useMemo } from 'react'
import { Puzzle, Check, Loader2, AlertCircle, Unplug, Search, X, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { 
  getAvailableApps,
  getConnections,
  initiateConnection,
  disconnectIntegration,
  getIntegrationStatus,
  type ComposioApp,
  type ComposioConnection
} from '../lib/api'

// Primary apps to show by default (case-insensitive matching)
const PRIMARY_APP_KEYS = new Set([
  'facebook',
  'instagram', 
  'linkedin',
  'youtube',
  'tiktok',
  'gmail'
])

// App icons mapping - fallback emojis
const APP_ICONS: Record<string, string> = {
  gmail: '📧',
  linkedin: '💼',
  instagram: '📷',
  facebook: '📘',
  youtube: '▶️',
  tiktok: '🎵',
  twitter: '𝕏',
  slack: '💬',
  google_calendar: '📅',
  notion: '📝',
  google_sheets: '📊',
  google_drive: '📁',
}

// Reusable App Logo component with proper fallback handling
function AppLogo({ 
  src, 
  alt, 
  appKey, 
  size = 26 
}: { 
  src?: string
  alt: string
  appKey: string
  size?: number 
}) {
  const [hasError, setHasError] = useState(false)
  const fallbackIcon = APP_ICONS[appKey.toLowerCase()] || '🔗'

  if (!src || hasError) {
    return <span>{fallbackIcon}</span>
  }

  return (
    <img 
      src={src} 
      alt={alt} 
      style={{ width: size, height: size, borderRadius: '4px' }}
      onError={() => setHasError(true)}
    />
  )
}

// Skeleton component for loading states
function IntegrationSkeleton() {
  return (
    <div 
      className="animate-pulse"
      style={{
        padding: '20px',
        background: 'white',
        borderRadius: '12px',
        border: '1px solid var(--gray-200)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px'
      }}
    >
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '10px',
        background: 'var(--gray-200)'
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ 
          width: '120px', 
          height: '16px', 
          background: 'var(--gray-200)', 
          borderRadius: '4px',
          marginBottom: '8px'
        }} />
        <div style={{ 
          width: '200px', 
          height: '12px', 
          background: 'var(--gray-100)', 
          borderRadius: '4px' 
        }} />
      </div>
    </div>
  )
}

export default function IntegrationsPage() {
  const { user } = useAuth()
  const [apps, setApps] = useState<ComposioApp[]>([])
  const [connections, setConnections] = useState<ComposioConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [serviceStatus, setServiceStatus] = useState<{ enabled: boolean; message: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showMoreApps, setShowMoreApps] = useState(false)

  // Load apps from API
  useEffect(() => {
    async function loadApps() {
      const [appsData, status] = await Promise.all([
        getAvailableApps(),
        getIntegrationStatus()
      ])
      setApps(appsData)
      setServiceStatus(status)
    }
    loadApps()
  }, [])

  // Load personal connections
  const loadConnections = useCallback(async () => {
    if (!user) return
    
    setLoading(true)
    setError(null)

    try {
      const connectionsData = await getConnections('personal')
      setConnections(connectionsData)
    } catch (err) {
      console.error('Failed to load connections:', err)
      setError('Failed to load connections. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadConnections()
  }, [loadConnections])

  // Check for OAuth callback on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('connection_status') === 'success') {
      window.history.replaceState({}, '', window.location.pathname)
      loadConnections()
    }
  }, [loadConnections])

  const handleConnect = async (appKey: string) => {
    setConnecting(appKey)
    setError(null)

    try {
      const result = await initiateConnection(
        appKey,
        'personal',
        undefined,
        `${window.location.origin}/integrations?connection_status=success`
      )
      
      if (!result.redirect_url) {
        throw new Error('No redirect URL received. The integration may need configuration.')
      }
      
      const popup = window.open(
        result.redirect_url, 
        `connect_${appKey}`,
        'width=600,height=700,scrollbars=yes,resizable=yes'
      )
      
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        setError('Popup was blocked. Please enable popups for this site.')
      } else {
        const checkPopup = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkPopup)
            loadConnections()
          }
        }, 1000)
        setTimeout(() => clearInterval(checkPopup), 5 * 60 * 1000)
      }
    } catch (err) {
      console.error('Failed to initiate connection:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect. Please try again.')
    } finally {
      setConnecting(null)
    }
  }

  const handleDisconnect = async (connectionId: string) => {
    if (!confirm('Are you sure you want to disconnect this integration?')) {
      return
    }

    setDisconnecting(connectionId)
    setError(null)

    try {
      await disconnectIntegration(connectionId)
      setConnections(prev => prev.filter(c => c.id !== connectionId))
    } catch (err) {
      console.error('Failed to disconnect:', err)
      setError(err instanceof Error ? err.message : 'Failed to disconnect. Please try again.')
    } finally {
      setDisconnecting(null)
    }
  }

  // Build a map of connected apps: normalized key -> connection
  // Standard approach: lowercase both sides for comparison
  const connectedAppsMap = useMemo(() => {
    const map = new Map<string, ComposioConnection>()
    for (const conn of connections) {
      // Store with lowercased key for case-insensitive lookup
      map.set(conn.app_key.toLowerCase(), conn)
    }
    return map
  }, [connections])

  // Simple case-insensitive check
  const isAppConnected = (appKey: string): boolean => {
    return connectedAppsMap.has(appKey.toLowerCase())
  }

  // Lookup app data by key (for getting logo, etc.)
  const appsLookup = useMemo(() => {
    const map = new Map<string, ComposioApp>()
    for (const app of apps) {
      map.set(app.key.toLowerCase(), app)
    }
    return map
  }, [apps])

  const getAppData = (appKey: string): ComposioApp | undefined => {
    return appsLookup.get(appKey.toLowerCase())
  }

  // Separate apps into primary and other
  const { primaryApps, otherApps } = useMemo(() => {
    const primary: ComposioApp[] = []
    const other: ComposioApp[] = []

    for (const app of apps) {
      const keyLower = app.key.toLowerCase()
      if (PRIMARY_APP_KEYS.has(keyLower)) {
        primary.push(app)
      } else {
        other.push(app)
      }
    }

    // Sort primary apps in the order defined
    const order = ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'gmail']
    primary.sort((a, b) => {
      const aIdx = order.indexOf(a.key.toLowerCase())
      const bIdx = order.indexOf(b.key.toLowerCase())
      return aIdx - bIdx
    })

    return { primaryApps: primary, otherApps: other }
  }, [apps])

  // Filter by search query
  const filteredPrimaryApps = useMemo(() => {
    if (!searchQuery.trim()) return primaryApps
    const query = searchQuery.toLowerCase()
    return primaryApps.filter(app => 
      app.name.toLowerCase().includes(query) ||
      app.key.toLowerCase().includes(query)
    )
  }, [primaryApps, searchQuery])

  const filteredOtherApps = useMemo(() => {
    if (!searchQuery.trim()) return otherApps
    const query = searchQuery.toLowerCase()
    return otherApps.filter(app => 
      app.name.toLowerCase().includes(query) ||
      app.key.toLowerCase().includes(query) ||
      app.categories.some(cat => cat.toLowerCase().includes(query))
    )
  }, [otherApps, searchQuery])

  const filteredConnections = useMemo(() => {
    if (!searchQuery.trim()) return connections
    const query = searchQuery.toLowerCase()
    return connections.filter(conn => 
      conn.app_name.toLowerCase().includes(query) ||
      conn.app_key.toLowerCase().includes(query)
    )
  }, [connections, searchQuery])

  const isSearching = searchQuery.trim().length > 0

  // Render an app card
  const renderAppCard = (app: ComposioApp) => {
    const isConnected = isAppConnected(app.key)
    const isConnecting = connecting === app.key

    // Truncate description to ~80 chars
    const shortDesc = app.description.length > 80 
      ? app.description.substring(0, 80).trim() + '...'
      : app.description

    return (
      <div
        key={app.key}
        style={{
          padding: '16px',
          background: isConnected ? '#f0fdf4' : 'white',
          borderRadius: '12px',
          border: isConnected ? '1px solid #bbf7d0' : '1px solid var(--gray-200)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          transition: 'all 0.15s',
          minHeight: '72px'
        }}
      >
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '10px',
          background: 'var(--gray-100)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
          overflow: 'hidden',
          flexShrink: 0
        }}>
          <AppLogo src={app.logo} alt={app.name} appKey={app.key} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: '600', color: 'var(--gray-900)', fontSize: '14px' }}>
            {app.name}
          </div>
          <p style={{ 
            fontSize: '12px', 
            color: 'var(--gray-500)', 
            margin: '2px 0 0',
            lineHeight: '1.4',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {shortDesc}
          </p>
        </div>
        <div style={{ flexShrink: 0 }}>
          {isConnected ? (
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              color: '#16a34a',
              fontWeight: '600'
            }}>
              <Check size={14} />
              Connected
            </span>
          ) : (
            <button 
              onClick={() => handleConnect(app.key)}
              disabled={isConnecting || !serviceStatus?.enabled}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 14px',
                background: serviceStatus?.enabled ? 'var(--primary-600)' : 'var(--gray-300)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: isConnecting || !serviceStatus?.enabled ? 'not-allowed' : 'pointer',
                opacity: isConnecting ? 0.7 : 1,
                transition: 'all 0.15s'
              }}
            >
              {isConnecting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                'Connect'
              )}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="page-scrollable" style={{ padding: '32px 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--primary-500), var(--primary-600))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Puzzle size={20} color="white" />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--gray-900)', margin: 0 }}>
            Integrations
          </h1>
        </div>
        <p style={{ fontSize: '15px', color: 'var(--gray-600)', marginTop: '8px', maxWidth: '600px' }}>
          Connect your apps and services to supercharge your AI agents.
        </p>
      </div>

      {/* Service Status Banner */}
      {serviceStatus && !serviceStatus.enabled && (
        <div style={{
          padding: '12px 16px',
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={18} color="#d97706" />
          <span style={{ fontSize: '14px', color: '#92400e' }}>
            {serviceStatus.message}
          </span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div style={{
          padding: '12px 16px',
          background: '#fef2f2',
          border: '1px solid #ef4444',
          borderRadius: '8px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={18} color="#dc2626" />
          <span style={{ fontSize: '14px', color: '#991b1b' }}>{error}</span>
          <button 
            onClick={() => setError(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ 
          position: 'relative', 
          maxWidth: '560px',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)'
        }}>
          <Search 
            size={20} 
            style={{ 
              position: 'absolute', 
              left: '16px', 
              top: '50%', 
              transform: 'translateY(-50%)',
              color: 'var(--gray-400)'
            }} 
          />
          <input
            type="text"
            placeholder="Search all integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="integrations-search"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'var(--gray-100)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                color: 'var(--gray-500)',
                transition: 'all 0.15s'
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Loading Skeletons */}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <IntegrationSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Content */}
      {!loading && (
        <>
          {/* Connected Apps Section */}
          {filteredConnections.length > 0 && (
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--gray-800)', marginBottom: '16px' }}>
                Connected Apps ({filteredConnections.length})
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {filteredConnections.map(connection => {
                  const appData = getAppData(connection.app_key)
                  return (
                    <div
                      key={connection.id}
                      style={{
                        padding: '16px',
                        background: '#f0fdf4',
                        borderRadius: '12px',
                        border: '1px solid #bbf7d0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        minHeight: '72px'
                      }}
                    >
                      <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '10px',
                        background: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '22px',
                        overflow: 'hidden',
                        flexShrink: 0
                      }}>
                        <AppLogo 
                          src={appData?.logo} 
                          alt={connection.app_name} 
                          appKey={connection.app_key} 
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '600', color: 'var(--gray-900)', fontSize: '14px' }}>
                            {connection.app_name}
                          </span>
                          {connection.status === 'ACTIVE' && (
                            <span style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              color: '#16a34a',
                              fontWeight: '600'
                            }}>
                              <Check size={12} />
                              Active
                            </span>
                          )}
                        </div>
                        {connection.account_display && (
                          <p style={{ fontSize: '12px', color: 'var(--gray-500)', margin: '2px 0 0' }}>
                            {connection.account_display}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDisconnect(connection.id)}
                        disabled={disconnecting === connection.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '8px 12px',
                          background: 'white',
                          color: 'var(--gray-600)',
                          border: '1px solid var(--gray-200)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: disconnecting === connection.id ? 'wait' : 'pointer',
                          opacity: disconnecting === connection.id ? 0.6 : 1,
                          transition: 'all 0.15s',
                          flexShrink: 0
                        }}
                      >
                        {disconnecting === connection.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Unplug size={12} />
                        )}
                        Disconnect
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Primary Apps Section */}
          {filteredPrimaryApps.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--gray-800)', marginBottom: '16px' }}>
                Popular Integrations
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {filteredPrimaryApps.map(app => renderAppCard(app))}
              </div>
            </div>
          )}

          {/* All Integrations - Collapsible Section */}
          {(filteredOtherApps.length > 0 || (!isSearching && otherApps.length > 0)) && (
            <div style={{ marginBottom: '32px' }}>
              {/* Collapsible Header */}
              <button
                onClick={() => !isSearching && setShowMoreApps(!showMoreApps)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '16px 20px',
                  background: 'var(--gray-50)',
                  border: '1px solid var(--gray-200)',
                  borderRadius: showMoreApps || isSearching ? '12px 12px 0 0' : '12px',
                  cursor: isSearching ? 'default' : 'pointer',
                  transition: 'all 0.15s',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--gray-800)' }}>
                    All Integrations
                  </span>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    color: 'var(--gray-500)',
                    background: 'var(--gray-200)',
                    padding: '2px 8px',
                    borderRadius: '10px'
                  }}>
                    {isSearching ? filteredOtherApps.length : otherApps.length}
                  </span>
                </div>
                {!isSearching && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--gray-500)'
                  }}>
                    <span style={{ fontSize: '13px', fontWeight: '500' }}>
                      {showMoreApps ? 'Hide' : 'Show'}
                    </span>
                    <ChevronDown 
                      size={18} 
                      style={{ 
                        transition: 'transform 0.2s ease',
                        transform: showMoreApps ? 'rotate(180deg)' : 'rotate(0deg)'
                      }} 
                    />
                  </div>
                )}
              </button>

              {/* Collapsible Content */}
              {(isSearching || showMoreApps) && (
                <div style={{
                  padding: '20px',
                  background: 'white',
                  border: '1px solid var(--gray-200)',
                  borderTop: 'none',
                  borderRadius: '0 0 12px 12px'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                    {(isSearching ? filteredOtherApps : otherApps).map(app => renderAppCard(app))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No Results */}
          {isSearching && filteredPrimaryApps.length === 0 && filteredOtherApps.length === 0 && filteredConnections.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              padding: '48px 24px',
              color: 'var(--gray-500)'
            }}>
              <Search size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
              <p style={{ fontSize: '15px', marginBottom: '8px' }}>
                No integrations found for "{searchQuery}"
              </p>
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  padding: '8px 16px',
                  background: 'var(--gray-100)',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  color: 'var(--gray-600)'
                }}
              >
                Clear search
              </button>
            </div>
          )}
        </>
      )}

    </div>
  )
}
