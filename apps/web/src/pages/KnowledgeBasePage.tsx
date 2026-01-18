import { useState, useEffect } from 'react'
import { Brain, Plus, Building2, User, FileText, Folder, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { 
  getOrgKnowledgeBases, 
  getUserKnowledgeBases,
  type KnowledgeBase 
} from '../lib/api'

const KB_TYPE_CONFIG = {
  general: { label: 'General', color: '#6366f1', bg: '#eef2ff' },
  docs: { label: 'Documentation', color: '#0891b2', bg: '#ecfeff' },
  wiki: { label: 'Wiki', color: '#16a34a', bg: '#f0fdf4' },
  faq: { label: 'FAQ', color: '#ea580c', bg: '#fff7ed' },
  custom: { label: 'Custom', color: '#7c3aed', bg: '#f5f3ff' },
}

type TabType = 'organization' | 'personal'

export default function KnowledgeBasePage() {
  const { user, currentOrg } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('organization')
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    async function loadKnowledgeBases() {
      if (!user) return
      
      setLoading(true)

      try {
        const result = activeTab === 'organization' && currentOrg
          ? await getOrgKnowledgeBases(currentOrg.id)
          : await getUserKnowledgeBases(user.id)

        setKnowledgeBases(result.data || [])
      } catch {
        setKnowledgeBases([])
      } finally {
        setLoading(false)
      }
    }

    loadKnowledgeBases()
  }, [user, currentOrg, activeTab])

  const filteredKBs = knowledgeBases.filter(kb =>
    kb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    kb.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
            <Brain size={20} color="white" />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--gray-900)', margin: 0 }}>
            Knowledge Base
          </h1>
        </div>
        <p style={{ fontSize: '15px', color: 'var(--gray-600)', marginTop: '8px', maxWidth: '600px' }}>
          Store information that your AI agents can access for accurate, context-aware responses.
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
            placeholder="Search knowledge bases..."
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
          New Knowledge Base
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
          <div className="auth-loading__spinner" />
        </div>
      )}

      {/* Knowledge Bases Grid */}
      {!loading && filteredKBs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {filteredKBs.map(kb => {
            const typeConfig = KB_TYPE_CONFIG[kb.type] || KB_TYPE_CONFIG.general
            return (
              <div
                key={kb.id}
                style={{
                  padding: '24px',
                  background: 'white',
                  borderRadius: '12px',
                  border: '1px solid var(--gray-200)',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '10px',
                    background: typeConfig.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Folder size={24} style={{ color: typeConfig.color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontWeight: '600', fontSize: '16px', color: 'var(--gray-900)' }}>
                        {kb.name}
                      </span>
                    </div>
                    <span style={{
                      display: 'inline-block',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: typeConfig.color,
                      background: typeConfig.bg,
                      padding: '3px 8px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {typeConfig.label}
                    </span>
                  </div>
                </div>
                {kb.description && (
                  <p style={{
                    fontSize: '14px',
                    color: 'var(--gray-600)',
                    marginTop: '16px',
                    lineHeight: '1.5',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {kb.description}
                  </p>
                )}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  marginTop: '16px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--gray-100)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} style={{ color: 'var(--gray-400)' }} />
                    <span style={{ fontSize: '13px', color: 'var(--gray-500)' }}>
                      0 documents
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>
                    Updated {new Date(kb.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredKBs.length === 0 && (
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
            <Brain size={28} style={{ color: 'var(--gray-400)' }} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--gray-800)', marginBottom: '8px' }}>
            {searchQuery ? 'No results found' : 'No knowledge bases yet'}
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--gray-500)', maxWidth: '400px', margin: '0 auto 24px' }}>
            {searchQuery 
              ? `No knowledge bases match "${searchQuery}"`
              : 'Create your first knowledge base to give your agents access to important information.'}
          </p>
          {!searchQuery && (
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
              Create Knowledge Base
            </button>
          )}
        </div>
      )}
    </div>
  )
}
