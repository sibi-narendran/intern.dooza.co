import { useState, useEffect } from 'react'
import { Puzzle, Plus, Building2, User, Check } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { 
  getOrgIntegrations, 
  getUserIntegrations,
  type Integration 
} from '../lib/api'

const INTEGRATION_PROVIDERS = [
  { id: 'slack', name: 'Slack', description: 'Team messaging and notifications', icon: '💬' },
  { id: 'google', name: 'Google Workspace', description: 'Gmail, Drive, Calendar', icon: '🔵' },
  { id: 'notion', name: 'Notion', description: 'Docs and knowledge management', icon: '📝' },
  { id: 'github', name: 'GitHub', description: 'Code repositories and issues', icon: '🐙' },
  { id: 'linear', name: 'Linear', description: 'Issue tracking and projects', icon: '🎯' },
  { id: 'salesforce', name: 'Salesforce', description: 'CRM and sales data', icon: '☁️' },
  { id: 'hubspot', name: 'HubSpot', description: 'Marketing and sales', icon: '🟠' },
  { id: 'zendesk', name: 'Zendesk', description: 'Customer support', icon: '💚' },
]

type TabType = 'organization' | 'personal'

export default function IntegrationsPage() {
  const { user, currentOrg } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('organization')
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadIntegrations() {
      if (!user) return
      
      setLoading(true)

      try {
        const result = activeTab === 'organization' && currentOrg
          ? await getOrgIntegrations(currentOrg.id)
          : await getUserIntegrations(user.id)

        setIntegrations(result.data || [])
      } catch {
        setIntegrations([])
      } finally {
        setLoading(false)
      }
    }

    loadIntegrations()
  }, [user, currentOrg, activeTab])

  const connectedProviders = new Set(integrations.map(i => i.provider))

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

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '4px', 
        marginBottom: '24px',
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

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
          <div className="auth-loading__spinner" />
        </div>
      )}

      {/* Content */}
      {!loading && (
        <>
          {/* Connected Integrations */}
          {integrations.length > 0 && (
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--gray-800)', marginBottom: '16px' }}>
                Connected ({integrations.length})
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                {integrations.map(integration => {
                  const provider = INTEGRATION_PROVIDERS.find(p => p.id === integration.provider)
                  return (
                    <div
                      key={integration.id}
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
                        {provider?.icon || '🔗'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '600', color: 'var(--gray-900)' }}>
                            {integration.name}
                          </span>
                          {integration.is_active && (
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
                        <p style={{ fontSize: '13px', color: 'var(--gray-500)', marginTop: '4px' }}>
                          {provider?.description || integration.provider}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Available Integrations */}
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--gray-800)', marginBottom: '16px' }}>
              Available Integrations
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {INTEGRATION_PROVIDERS.map(provider => {
                const isConnected = connectedProviders.has(provider.id)
                return (
                  <div
                    key={provider.id}
                    style={{
                      padding: '20px',
                      background: 'white',
                      borderRadius: '12px',
                      border: '1px solid var(--gray-200)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '16px',
                      opacity: isConnected ? 0.6 : 1,
                      cursor: isConnected ? 'default' : 'pointer',
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
                      {provider.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: '600', color: 'var(--gray-900)' }}>
                          {provider.name}
                        </span>
                        {isConnected ? (
                          <Check size={18} style={{ color: '#16a34a' }} />
                        ) : (
                          <button style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 12px',
                            background: 'var(--primary-600)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: '500',
                            cursor: 'pointer'
                          }}>
                            <Plus size={14} />
                            Connect
                          </button>
                        )}
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--gray-500)', marginTop: '4px' }}>
                        {provider.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
