import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Plug, Plus, Building2, User, ExternalLink, Check, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { 
  getOrgIntegrations, 
  getUserIntegrations,
  type Integration 
} from '../lib/api'

// Available integration providers
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

export default function IntegrationsPage() {
  const { scope } = useParams<{ scope: 'organization' | 'personal' }>()
  const { user, currentOrg } = useAuth()
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isOrgScope = scope === 'organization'
  const scopeTitle = isOrgScope ? currentOrg?.name || 'Organization' : 'Personal'
  const ScopeIcon = isOrgScope ? Building2 : User

  useEffect(() => {
    async function loadIntegrations() {
      if (!user) return
      
      setLoading(true)
      setError(null)

      try {
        const result = isOrgScope && currentOrg
          ? await getOrgIntegrations(currentOrg.id)
          : await getUserIntegrations(user.id)

        if (result.error) {
          setError(result.error.message)
        } else {
          setIntegrations(result.data || [])
        }
      } catch (err) {
        setError('Failed to load integrations')
      } finally {
        setLoading(false)
      }
    }

    loadIntegrations()
  }, [user, currentOrg, isOrgScope])

  const connectedProviders = new Set(integrations.map(i => i.provider))

  return (
    <div className="page-scrollable" style={{ padding: '32px 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
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
            <Plug size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--gray-900)', margin: 0 }}>
              Integrations
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <ScopeIcon size={14} style={{ color: 'var(--gray-400)' }} />
              <span style={{ fontSize: '14px', color: 'var(--gray-500)' }}>{scopeTitle}</span>
            </div>
          </div>
        </div>
        <p style={{ fontSize: '15px', color: 'var(--gray-600)', marginTop: '12px', maxWidth: '600px' }}>
          {isOrgScope 
            ? 'Connect apps and services for your entire organization. All team members will have access to these integrations.'
            : 'Connect your personal apps and services. These integrations are private to you.'}
        </p>
      </div>

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
                onMouseEnter={(e) => {
                  if (!isConnected) {
                    e.currentTarget.style.borderColor = 'var(--primary-300)'
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(13, 148, 136, 0.1)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--gray-200)'
                  e.currentTarget.style.boxShadow = 'none'
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

      {/* Error state */}
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px',
          background: '#fef2f2',
          borderRadius: '8px',
          color: '#dc2626',
          marginTop: '24px'
        }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px'
        }}>
          <div className="auth-loading__spinner" />
        </div>
      )}
    </div>
  )
}
