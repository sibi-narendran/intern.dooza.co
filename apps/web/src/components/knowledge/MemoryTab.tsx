/**
 * MemoryTab
 * 
 * Coming soon placeholder for AI Memory feature.
 * Used in KnowledgeBasePage (Brain).
 */

import { Cpu, Clock } from 'lucide-react'

export default function MemoryTab() {
  return (
    <div style={{
      background: 'white',
      borderRadius: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
      padding: '80px 40px',
      textAlign: 'center',
    }}>
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '20px',
        background: 'var(--primary-100)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 24px',
      }}>
        <Cpu size={40} style={{ color: 'var(--primary-600)' }} />
      </div>
      
      <h2 style={{ 
        fontSize: '24px', 
        fontWeight: '700', 
        color: 'var(--gray-900)', 
        margin: '0 0 12px 0',
        letterSpacing: '-0.02em'
      }}>
        AI Memory
      </h2>
      
      <p style={{ 
        fontSize: '16px', 
        color: 'var(--gray-500)', 
        margin: '0 0 24px 0',
        maxWidth: '400px',
        marginLeft: 'auto',
        marginRight: 'auto',
        lineHeight: '1.6',
      }}>
        Train your AI agents with custom knowledge, documents, and context to generate even more personalized content.
      </p>
      
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 24px',
        background: 'var(--primary-50)',
        border: '1px solid var(--primary-200)',
        borderRadius: '100px',
        color: 'var(--primary-700)',
        fontWeight: '600',
        fontSize: '14px',
      }}>
        <Clock size={18} />
        Coming Soon
      </div>
    </div>
  )
}
