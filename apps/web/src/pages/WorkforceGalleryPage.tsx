import { useState } from 'react'
import { Users, Building2, User, Search, Plus, Download, Star, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

type TabType = 'organization' | 'public'

interface GalleryAgent {
  id: string
  name: string
  role: string
  description: string
  avatar: string
  creator: string
  installs: number
  rating: number
  tags: string[]
  isInstalled: boolean
}

const SAMPLE_ORG_AGENTS: GalleryAgent[] = [
  {
    id: '1',
    name: 'Max',
    role: 'Sales Assistant',
    description: 'Handles lead qualification, follow-ups, and CRM updates automatically.',
    avatar: '🤝',
    creator: 'Sales Team',
    installs: 12,
    rating: 4.8,
    tags: ['Sales', 'CRM', 'Leads'],
    isInstalled: false
  },
  {
    id: '2',
    name: 'Nina',
    role: 'HR Onboarding',
    description: 'Guides new employees through onboarding checklists and documentation.',
    avatar: '📋',
    creator: 'HR Department',
    installs: 8,
    rating: 4.9,
    tags: ['HR', 'Onboarding', 'Documentation'],
    isInstalled: true
  }
]

const SAMPLE_PUBLIC_AGENTS: GalleryAgent[] = [
  {
    id: '3',
    name: 'CodeBot',
    role: 'Code Reviewer',
    description: 'Reviews pull requests and suggests improvements following best practices.',
    avatar: '💻',
    creator: 'Dooza',
    installs: 2340,
    rating: 4.7,
    tags: ['Development', 'Code Review', 'Quality'],
    isInstalled: false
  },
  {
    id: '4',
    name: 'Bloggy',
    role: 'Content Writer',
    description: 'Creates SEO-optimized blog posts and articles for your brand voice.',
    avatar: '✍️',
    creator: 'Dooza',
    installs: 1856,
    rating: 4.6,
    tags: ['Content', 'SEO', 'Marketing'],
    isInstalled: false
  },
  {
    id: '5',
    name: 'Finley',
    role: 'Financial Analyst',
    description: 'Analyzes financial data and generates comprehensive reports.',
    avatar: '📊',
    creator: 'Dooza',
    installs: 982,
    rating: 4.5,
    tags: ['Finance', 'Analytics', 'Reports'],
    isInstalled: true
  },
  {
    id: '6',
    name: 'Recruiter Rex',
    role: 'Talent Scout',
    description: 'Screens resumes, schedules interviews, and manages candidate pipelines.',
    avatar: '🔍',
    creator: 'Community',
    installs: 645,
    rating: 4.4,
    tags: ['HR', 'Recruiting', 'Hiring'],
    isInstalled: false
  }
]

export default function WorkforceGalleryPage() {
  const { currentOrg } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('organization')
  const [searchQuery, setSearchQuery] = useState('')

  const agents = activeTab === 'organization' ? SAMPLE_ORG_AGENTS : SAMPLE_PUBLIC_AGENTS

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
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

      {/* Agents Grid */}
      {filteredAgents.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {filteredAgents.map(agent => (
            <div
              key={agent.id}
              style={{
                padding: '24px',
                background: 'white',
                borderRadius: '12px',
                border: '1px solid var(--gray-200)',
                transition: 'all 0.15s',
                position: 'relative'
              }}
            >
              {agent.isInstalled && (
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
                  letterSpacing: '0.05em'
                }}>
                  Installed
                </div>
              )}
              
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px'
                }}>
                  {agent.avatar}
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '16px' }}>
                {agent.tags.map(tag => (
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Star size={14} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
                    <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--gray-700)' }}>
                      {agent.rating}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Download size={14} style={{ color: 'var(--gray-400)' }} />
                    <span style={{ fontSize: '13px', color: 'var(--gray-500)' }}>
                      {agent.installs.toLocaleString()}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>
                    by {agent.creator}
                  </span>
                </div>
                
                {!agent.isInstalled && (
                  <button style={{
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
                    cursor: 'pointer'
                  }}>
                    <Download size={14} />
                    Install
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {filteredAgents.length === 0 && (
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
    </div>
  )
}
