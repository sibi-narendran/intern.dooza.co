/**
 * KnowledgeBasePage (Brain)
 * 
 * Main brain/knowledge page with tabbed interface.
 * Follows the codebase pattern: lean page component that orchestrates layout
 * and imports specialized tab components from components/knowledge/.
 */

import { useState } from 'react'
import { Brain, Palette, Cpu } from 'lucide-react'
import { BrandIdentityTab, MemoryTab } from '../components/knowledge'

type TabKey = 'brand' | 'memory'

export default function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('brand')

  return (
    <div className="page-scrollable" style={{ 
      background: 'var(--gray-50)',
      padding: '32px 40px',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', maxWidth: '1100px', margin: '0 auto 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, var(--primary-500), var(--primary-600))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(13, 148, 136, 0.3)',
          }}>
            <Brain size={24} color="white" />
          </div>
          <div>
            <h1 style={{ 
              fontSize: '28px', 
              fontWeight: '700', 
              color: 'var(--gray-900)', 
              margin: 0,
              letterSpacing: '-0.02em'
            }}>
              Brain
            </h1>
            <p style={{ 
              fontSize: '15px', 
              color: 'var(--gray-500)', 
              margin: '4px 0 0 0',
            }}>
              Configure your brand identity and AI memory
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ maxWidth: '1100px', margin: '0 auto 28px' }}>
        <div style={{ 
          display: 'inline-flex', 
          background: 'white',
          padding: '4px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <TabButton 
            active={activeTab === 'brand'}
            onClick={() => setActiveTab('brand')}
            icon={<Palette size={16} />}
            label="Brand Identity"
          />
          <TabButton 
            active={activeTab === 'memory'}
            onClick={() => setActiveTab('memory')}
            icon={<Cpu size={16} />}
            label="Memory"
          />
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {activeTab === 'brand' && <BrandIdentityTab />}
        {activeTab === 'memory' && <MemoryTab />}
      </div>
      
      {/* Global animation styles */}
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
// Sub-components (small, page-specific)
// ============================================================================

interface TabButtonProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 20px',
        background: active 
          ? 'linear-gradient(135deg, var(--primary-500), var(--primary-600))' 
          : 'transparent',
        color: active ? 'white' : 'var(--gray-500)',
        border: 'none',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      {icon}
      {label}
    </button>
  )
}
