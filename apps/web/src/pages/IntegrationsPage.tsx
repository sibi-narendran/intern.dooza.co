import { useState, useEffect, useCallback, useMemo } from 'react'
import { Puzzle, Plus, Building2, User, Check, Loader2, AlertCircle, Unplug, Search, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { 
  getAvailableApps,
  getConnections,
  initiateConnection,
  disconnectIntegration,
  getIntegrationStatus,
  type ComposioApp,
  type ComposioConnection,
  type ConnectionScope
} from '../lib/api'

// App icons mapping - fallback emojis for common apps
const APP_ICONS: Record<string, string> = {
  gmail: '📧',
  slack: '💬',
  google_calendar: '📅',
  notion: '📝',
  hubspot: '🟠',
  twitter: '𝕏',
  linkedin: '💼',
  instagram: '📷',
  facebook: '👤',
  zendesk: '💚',
  intercom: '💙',
  google_sheets: '📊',
  stripe: '💳',
  google_analytics: '📈',
  google_ads: '📢',
  mailchimp: '🐵',
  buffer: '📤',
  wordpress: '🔵',
  ahrefs: '🔗',
  google_drive: '📁',
  twilio: '📞',
  salesforce: '☁️',
}

// Priority integrations - shown first (most commonly used)
const PRIORITY_APPS = new Set([
  // Communication
  'gmail', 'slack', 'discord', 'microsoft_teams', 'twilio',
  // Social Media
  'twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'youtube', 'buffer',
  // CRM & Sales
  'hubspot', 'salesforce', 'pipedrive', 'zoho_crm',
  // Productivity
  'google_calendar', 'google_drive', 'google_sheets', 'notion', 'airtable', 'trello', 'asana', 'monday',
  // Support
  'zendesk', 'intercom', 'freshdesk',
  // Marketing
  'mailchimp', 'google_ads', 'meta_ads', 'google_analytics',
  // Dev & Data
  'github', 'stripe', 'shopify', 'wordpress',
  // Storage
  'dropbox', 'onedrive',
])

const INITIAL_DISPLAY_COUNT = 50

// Skeleton component for loading states
function IntegrationSkeleton() {
  return (
    <div style={{
      padding: '20px',
      background: 'white',
      borderRadius: '12px',
      border: '1px solid var(--gray-200)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '16px',
      animation: 'pulse 1.5s ease-in-out infinite'
    }}>
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

type TabType = 'organization' | 'personal'

export default function IntegrationsPage() {
  const { user, currentOrg } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('organization')
  const [apps, setApps] = useState<ComposioApp[]>([])
  const [connections, setConnections] = useState<ComposioConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [serviceStatus, setServiceStatus] = useState<{ enabled: boolean; message: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAll, setShowAll] = useState(false)

  const scope: ConnectionScope = activeTab === 'organization' ? 'organization' : 'personal'
  const orgId = activeTab === 'organization' ? currentOrg?.id : undefined

  // Load apps once (they don't change)
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

  // Load connections when tab changes
  const loadConnections = useCallback(async () => {
    if (!user) return
    
    setLoading(true)
    setError(null)

    try {
      const connectionsData = await getConnections(scope, orgId)
      setConnections(connectionsData)
    } catch (err) {
      console.error('Failed to load connections:', err)
      setError('Failed to load connections. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [user, scope, orgId])

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
        scope,
        orgId,
        `${window.location.origin}/integrations?connection_status=success`
      )
      window.open(result.redirect_url, '_blank', 'width=600,height=700')
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

  const connectedAppKeys = new Set(connections.map(c => c.app_key))

  const getAppIcon = (appKey: string): string => {
    return APP_ICONS[appKey.toLowerCase()] || '🔗'
  }

  // Sort apps by priority, then filter by search
  const sortedAndFilteredApps = useMemo(() => {
    // First, sort by priority
    const sorted = [...apps].sort((a, b) => {
      const aPriority = PRIORITY_APPS.has(a.key.toLowerCase()) ? 0 : 1
      const bPriority = PRIORITY_APPS.has(b.key.toLowerCase()) ? 0 : 1
      return aPriority - bPriority
    })
    
    // If searching, filter and show all matches
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      return sorted.filter(app => 
        app.name.toLowerCase().includes(query) ||
        app.description.toLowerCase().includes(query) ||
        app.key.toLowerCase().includes(query) ||
        app.categories.some(cat => cat.toLowerCase().includes(query))
      )
    }
    
    return sorted
  }, [apps, searchQuery])

  // Determine what to display
  const isSearching = searchQuery.trim().length > 0
  const totalApps = sortedAndFilteredApps.length
  const displayedApps = isSearching || showAll 
    ? sortedAndFilteredApps 
    : sortedAndFilteredApps.slice(0, INITIAL_DISPLAY_COUNT)
  const hiddenCount = totalApps - INITIAL_DISPLAY_COUNT

  // Filter connections by search query
  const filteredConnections = useMemo(() => {
    if (!searchQuery.trim()) return connections
    
    const query = searchQuery.toLowerCase()
    return connections.filter(conn => 
      conn.app_name.toLowerCase().includes(query) ||
      conn.app_key.toLowerCase().includes(query)
    )
  }, [connections, searchQuery])

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
            ✕
          </button>
        </div>
      )}

      {/* Search + Tabs Row */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '24px',
        flexWrap: 'wrap'
      }}>
        {/* Tabs */}
        <div style={{ 
          display: 'flex', 
          gap: '4px', 
          background: 'var(--gray-100)',
          padding: '4px',
          borderRadius: '10px',
          width: 'fit-content'
        }}>
          <button
            onClick={() => setActiveTab('organization')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'organization' ? 'white' : 'transparent',
              color: activeTab === 'organization' ? 'var(--gray-900)' : 'var(--gray-600)',
              fontWeight: activeTab === 'organization' ? '600' : '500',
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: activeTab === 'organization' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s'
            }}
          >
            <Building2 size={16} />
            {currentOrg?.name || 'Organization'}
          </button>
          <button
            onClick={() => setActiveTab('personal')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'personal' ? 'white' : 'transparent',
              color: activeTab === 'personal' ? 'var(--gray-900)' : 'var(--gray-600)',
              fontWeight: activeTab === 'personal' ? '600' : '500',
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: activeTab === 'personal' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s'
            }}
          >
            <User size={16} />
            Personal
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', minWidth: '280px' }}>
          <Search 
            size={18} 
            style={{ 
              position: 'absolute', 
              left: '12px', 
              top: '50%', 
              transform: 'translateY(-50%)',
              color: 'var(--gray-400)'
            }} 
          />
          <input
            type="text"
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 36px',
              borderRadius: '8px',
              border: '1px solid var(--gray-200)',
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--primary-500)'
              e.target.style.boxShadow = '0 0 0 3px var(--primary-100)'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--gray-200)'
              e.target.style.boxShadow = 'none'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                color: 'var(--gray-400)'
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Scope Description */}
      <p style={{ fontSize: '13px', color: 'var(--gray-500)', marginBottom: '24px' }}>
        {activeTab === 'organization' 
          ? 'Organization integrations are shared with all team members.'
          : 'Personal integrations are only accessible by you.'
        }
      </p>

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
          {/* Connected Integrations */}
          {filteredConnections.length > 0 && (
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--gray-800)', marginBottom: '16px' }}>
                Connected ({filteredConnections.length})
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {filteredConnections.map(connection => (
                  <div
                    key={connection.id}
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
                      background: 'var(--gray-100)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px'
                    }}>
                      {getAppIcon(connection.app_key)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '600', color: 'var(--gray-900)' }}>
                          {connection.app_name}
                        </span>
                        {connection.status === 'ACTIVE' && (
                          <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px',
                            color: '#16a34a',
                            background: '#f0fdf4',
                            padding: '2px 8px',
                            borderRadius: '4px'
                          }}>
                            <Check size={12} />
                            Active
                          </span>
                        )}
                      </div>
                      {connection.account_display && (
                        <p style={{ fontSize: '13px', color: 'var(--gray-500)', margin: 0 }}>
                          {connection.account_display}
                        </p>
                      )}
                      <button
                        onClick={() => handleDisconnect(connection.id)}
                        disabled={disconnecting === connection.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginTop: '12px',
                          padding: '6px 12px',
                          background: 'transparent',
                          color: 'var(--gray-500)',
                          border: '1px solid var(--gray-200)',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: disconnecting === connection.id ? 'wait' : 'pointer',
                          opacity: disconnecting === connection.id ? 0.6 : 1,
                          transition: 'all 0.15s'
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
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available Integrations */}
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--gray-800)', marginBottom: '16px' }}>
              Available Integrations {isSearching && `(${totalApps} results)`}
            </h2>
            
            {displayedApps.length === 0 && isSearching && (
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {displayedApps.map(app => {
                const isConnected = connectedAppKeys.has(app.key)
                const isConnecting = connecting === app.key
                
                return (
                  <div
                    key={app.key}
                    style={{
                      padding: '20px',
                      background: 'white',
                      borderRadius: '12px',
                      border: '1px solid var(--gray-200)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '16px',
                      opacity: isConnected ? 0.6 : 1,
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '10px',
                      background: 'var(--gray-100)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px'
                    }}>
                      {app.logo ? (
                        <img 
                          src={app.logo} 
                          alt={app.name} 
                          style={{ width: '28px', height: '28px', borderRadius: '4px' }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        getAppIcon(app.key)
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: '600', color: 'var(--gray-900)' }}>
                          {app.name}
                        </span>
                        {isConnected ? (
                          <Check size={18} style={{ color: '#16a34a' }} />
                        ) : (
                          <button 
                            onClick={() => handleConnect(app.key)}
                            disabled={isConnecting || !serviceStatus?.enabled}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 12px',
                              background: serviceStatus?.enabled ? 'var(--primary-600)' : 'var(--gray-300)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: '500',
                              cursor: isConnecting || !serviceStatus?.enabled ? 'not-allowed' : 'pointer',
                              opacity: isConnecting ? 0.7 : 1,
                              transition: 'all 0.15s'
                            }}
                          >
                            {isConnecting ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <>
                                <Plus size={14} />
                                Connect
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--gray-500)', marginTop: '4px' }}>
                        {app.description}
                      </p>
                      {app.categories.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                          {app.categories.slice(0, 3).map(cat => (
                            <span
                              key={cat}
                              style={{
                                fontSize: '11px',
                                padding: '2px 8px',
                                background: 'var(--gray-100)',
                                color: 'var(--gray-600)',
                                borderRadius: '4px'
                              }}
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Show More Button */}
            {!isSearching && !showAll && hiddenCount > 0 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                marginTop: '32px',
                paddingBottom: '16px'
              }}>
                <button
                  onClick={() => setShowAll(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    background: 'white',
                    border: '1px solid var(--gray-300)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'var(--gray-700)',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--gray-50)'
                    e.currentTarget.style.borderColor = 'var(--gray-400)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'white'
                    e.currentTarget.style.borderColor = 'var(--gray-300)'
                  }}
                >
                  Show {hiddenCount} more integrations
                </button>
              </div>
            )}

            {/* Collapse Button */}
            {!isSearching && showAll && totalApps > INITIAL_DISPLAY_COUNT && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                marginTop: '32px',
                paddingBottom: '16px'
              }}>
                <button
                  onClick={() => setShowAll(false)}
                  style={{
                    padding: '12px 24px',
                    background: 'var(--gray-100)',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'var(--gray-600)',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  Show less
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
