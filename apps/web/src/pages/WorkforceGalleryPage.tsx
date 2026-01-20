import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Users, Building2, Search, Star, Sparkles, 
  Download, Loader2, Check, AlertCircle, Plus, X, MessageSquare
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { 
  getGalleryAgents,
  hireAgent,
  releaseAgent,
  getHiredAgentIds,
  type GalleryAgent
} from '../lib/agent-api'

type TabType = 'organization' | 'public'

export default function WorkforceGalleryPage() {
  const { currentOrg } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('public')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Data states
  const [orgAgents, setOrgAgents] = useState<GalleryAgent[]>([])
  const [publicAgents, setPublicAgents] = useState<GalleryAgent[]>([])
  const [hiredAgentIds, setHiredAgentIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Action states
  const [hiringAgentId, setHiringAgentId] = useState<string | null>(null)
  const [removingAgentId, setRemovingAgentId] = useState<string | null>(null)

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Fetch agents and hired IDs in parallel (2 requests instead of N+1)
      const [allAgents, hiredIds] = await Promise.all([
        getGalleryAgents(),
        getHiredAgentIds()
      ])
      
      // Split agents by creator
      // Organization agents: created_by is set (user-created) - for now empty until users can create
      // Public agents: created_by is null (Dooza-created) or marked as public
      const org: GalleryAgent[] = []
      const pub: GalleryAgent[] = []
      
      for (const agent of allAgents) {
        if (agent.created_by) {
          // TODO: Filter by current org when org-based creation is implemented
          org.push(agent)
        } else {
          pub.push(agent)
        }
      }
      
      setOrgAgents(org)
      setPublicAgents(pub)
      setHiredAgentIds(new Set(hiredIds))
      
    } catch (err) {
      setError('Failed to load agents. Please try again.')
      console.error('Failed to fetch agents:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handle hire
  const handleHire = async (agentId: string) => {
    setHiringAgentId(agentId)
    try {
      await hireAgent(agentId)
      // Update hired status locally
      setHiredAgentIds(prev => new Set([...prev, agentId]))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to hire agent')
    } finally {
      setHiringAgentId(null)
    }
  }

  // Handle remove
  const handleRemove = async (agentId: string) => {
    if (!confirm('Remove this agent from your team?')) return
    
    setRemovingAgentId(agentId)
    try {
      await releaseAgent(agentId)
      // Update hired status locally
      setHiredAgentIds(prev => {
        const next = new Set(prev)
        next.delete(agentId)
        return next
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove agent')
    } finally {
      setRemovingAgentId(null)
    }
  }

  // Filter agents based on search
  const filterAgents = (agents: GalleryAgent[]) => {
    if (!searchQuery) return agents
    const q = searchQuery.toLowerCase()
    return agents.filter(agent =>
      agent.name.toLowerCase().includes(q) ||
      agent.role.toLowerCase().includes(q) ||
      agent.description.toLowerCase().includes(q) ||
      agent.tags.some(tag => tag.toLowerCase().includes(q))
    )
  }

  const displayAgents = activeTab === 'organization' 
    ? filterAgents(orgAgents) 
    : filterAgents(publicAgents)

  return (
    <div className="page-scrollable" style={{ padding: '32px 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Users size={20} color="white" />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--gray-900)', margin: 0 }}>
            Workforce Gallery
          </h1>
        </div>
        <p style={{ fontSize: '15px', color: 'var(--gray-600)', marginTop: '8px', maxWidth: '600px' }}>
          Discover and install AI agents created by your organization or the Dooza community.
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
          onClick={() => setActiveTab('public')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'public' ? 'white' : 'transparent',
            color: activeTab === 'public' ? 'var(--gray-900)' : 'var(--gray-600)',
            fontWeight: activeTab === 'public' ? '600' : '500',
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: activeTab === 'public' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.15s'
          }}
        >
          <Sparkles size={16} />
          Public Gallery
        </button>
      </div>

      {/* Search and Actions */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '16px', 
        marginBottom: '24px' 
      }}>
        <div style={{ flex: 1, maxWidth: '400px', position: 'relative' }}>
          <Search 
            size={18} 
            style={{ 
              position: 'absolute', 
              left: '14px', 
              top: '50%', 
              transform: 'translateY(-50%)',
              color: 'var(--gray-400)'
            }} 
          />
          <input
            type="text"
            placeholder="Search agents by name, role, or skill..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 42px',
              border: '1px solid var(--gray-200)',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        </div>
        {activeTab === 'organization' && (
          <button style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            background: 'var(--primary-600)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer'
          }}>
            <Plus size={18} />
            Create Custom Agent
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '64px 24px',
          color: 'var(--gray-500)'
        }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Loading agents...</span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '64px 24px',
          color: '#dc2626',
          background: '#fef2f2',
          borderRadius: '12px'
        }}>
          <AlertCircle size={24} />
          <span>{error}</span>
          <button
            onClick={fetchData}
            style={{
              marginLeft: '12px',
              padding: '8px 16px',
              background: 'white',
              border: '1px solid #dc2626',
              borderRadius: '6px',
              color: '#dc2626',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Agents Grid */}
      {!loading && !error && displayAgents.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {displayAgents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isHired={hiredAgentIds.has(agent.id)}
              onHire={() => handleHire(agent.id)}
              onRemove={() => handleRemove(agent.id)}
              isHiring={hiringAgentId === agent.id}
              isRemoving={removingAgentId === agent.id}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && displayAgents.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '64px 24px',
          background: 'var(--gray-50)',
          borderRadius: '16px',
          border: '2px dashed var(--gray-200)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
          }}>
            <Users size={28} style={{ color: 'var(--gray-400)' }} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--gray-800)', marginBottom: '8px' }}>
            {searchQuery ? 'No agents found' : 'No custom agents yet'}
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--gray-500)', maxWidth: '400px', margin: '0 auto 24px' }}>
            {searchQuery 
              ? `No agents match "${searchQuery}"`
              : activeTab === 'organization'
                ? 'Create your first custom agent to share with your team.'
                : 'Check back soon for new agents from the community.'}
          </p>
          {!searchQuery && activeTab === 'organization' && (
            <button style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: 'var(--primary-600)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>
              <Plus size={18} />
              Create Custom Agent
            </button>
          )}
        </div>
      )}

      {/* Spin animation for loader */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// ============================================================================
// Agent Card Component
// ============================================================================

interface AgentCardProps {
  agent: GalleryAgent
  isHired: boolean
  onHire: () => void
  onRemove: () => void
  isHiring: boolean
  isRemoving: boolean
}

function AgentCard({ agent, isHired, onHire, onRemove, isHiring, isRemoving }: AgentCardProps) {
  const navigate = useNavigate()
  // Chat capability now comes from API (no hardcoded list)
  const isChatEnabled = agent.chat_enabled ?? false
  return (
    <div
      style={{
        padding: '24px',
        background: 'white',
        borderRadius: '12px',
        border: '1px solid var(--gray-200)',
        transition: 'all 0.15s',
        position: 'relative'
      }}
    >
      {isHired && (
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          fontSize: '11px',
          fontWeight: '600',
          color: '#16a34a',
          background: '#f0fdf4',
          padding: '4px 10px',
          borderRadius: '6px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <Check size={12} />
          Installed
        </div>
      )}
      
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '12px',
          background: agent.gradient || 'linear-gradient(135deg, #f3f4f6, #e5e7eb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          {agent.avatar_url ? (
            <img 
              src={agent.avatar_url} 
              alt={agent.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ fontSize: '24px' }}>🤖</span>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '17px', fontWeight: '600', color: 'var(--gray-900)', margin: '0 0 4px' }}>
            {agent.name}
          </h3>
          <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--primary-600)', margin: 0 }}>
            {agent.role}
          </p>
        </div>
      </div>

      <p style={{
        fontSize: '14px',
        color: 'var(--gray-600)',
        marginTop: '16px',
        lineHeight: '1.6',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden'
      }}>
        {agent.description}
      </p>

      {/* Tags */}
      {agent.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '16px' }}>
          {agent.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              style={{
                fontSize: '12px',
                fontWeight: '500',
                color: 'var(--gray-600)',
                background: 'var(--gray-100)',
                padding: '4px 10px',
                borderRadius: '6px'
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '20px',
        paddingTop: '16px',
        borderTop: '1px solid var(--gray-100)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {agent.rating_avg > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Star size={14} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
              <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--gray-700)' }}>
                {agent.rating_avg.toFixed(1)}
              </span>
            </div>
          )}
          {agent.install_count > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Download size={14} style={{ color: 'var(--gray-400)' }} />
              <span style={{ fontSize: '13px', color: 'var(--gray-500)' }}>
                {agent.install_count.toLocaleString()}
              </span>
            </div>
          )}
          <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>
            by {agent.created_by ? 'Your Org' : 'Dooza'}
          </span>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          {isHired && isChatEnabled && (
            <button 
              onClick={() => navigate(`/chat/${agent.slug}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                background: 'var(--primary-600)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              <MessageSquare size={14} />
              Chat
            </button>
          )}
          
          {!isHired ? (
            <button 
              onClick={onHire}
              disabled={isHiring}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                background: 'var(--primary-600)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: isHiring ? 'not-allowed' : 'pointer',
                opacity: isHiring ? 0.6 : 1
              }}
            >
              {isHiring ? (
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Download size={14} />
              )}
              Install
            </button>
          ) : (
            <button 
              onClick={onRemove}
              disabled={isRemoving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                background: 'transparent',
                color: 'var(--gray-600)',
                border: '1px solid var(--gray-300)',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: isRemoving ? 'not-allowed' : 'pointer',
                opacity: isRemoving ? 0.6 : 1
              }}
            >
              {isRemoving ? (
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <X size={14} />
              )}
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
