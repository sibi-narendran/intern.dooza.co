import { useState, useRef, useEffect } from 'react'
import { LogOut, Settings, ExternalLink, ChevronDown, Building2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const UserMenu = () => {
  const { user, profile, currentOrg, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAccountSettings = () => {
    const accountsUrl = import.meta.env.VITE_ACCOUNTS_URL || 'https://accounts.dooza.ai'
    window.open(`${accountsUrl}/settings`, '_blank')
    setIsOpen(false)
  }

  const handleLogout = async () => {
    setIsOpen(false)
    await signOut()
  }

  // Get user initials for avatar fallback - prioritize profile data
  const getInitials = () => {
    // First try profile data (from public.users table)
    if (profile?.first_name) {
      const first = profile.first_name[0] || ''
      const last = profile.last_name?.[0] || ''
      return (first + last).toUpperCase() || '?'
    }
    // Fallback to user_metadata from auth
    if (user?.user_metadata?.first_name) {
      const first = user.user_metadata.first_name[0] || ''
      const last = user.user_metadata.last_name?.[0] || ''
      return (first + last).toUpperCase() || '?'
    }
    // Final fallback to email
    if (user?.email) {
      return user.email[0].toUpperCase()
    }
    return '?'
  }

  // Get display name - prioritize profile data
  const getUserDisplayName = () => {
    // First try profile data
    if (profile?.first_name) {
      return `${profile.first_name}${profile.last_name ? ' ' + profile.last_name : ''}`
    }
    // Fallback to user_metadata
    if (user?.user_metadata?.first_name) {
      return `${user.user_metadata.first_name}${user.user_metadata.last_name ? ' ' + user.user_metadata.last_name : ''}`
    }
    // Final fallback
    return user?.email?.split('@')[0] || 'User'
  }

  const getUserEmail = () => {
    return profile?.email || user?.email || ''
  }

  const getAvatarUrl = () => {
    return user?.user_metadata?.avatar_url || null
  }

  const getOrgName = () => {
    return currentOrg?.name || null
  }

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      {/* User Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 12px',
          width: '100%',
          border: 'none',
          background: isOpen ? 'white' : 'transparent',
          color: 'var(--gray-700)',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          borderRadius: '8px',
          transition: 'all 0.15s ease',
          boxShadow: isOpen ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
        }}
        onMouseEnter={(e) => {
          if (!isOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.6)'
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.background = 'transparent'
        }}
      >
        {/* Avatar */}
        {getAvatarUrl() ? (
          <img
            src={getAvatarUrl()}
            alt="Profile"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary-500), var(--primary-700))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '11px',
            fontWeight: '600',
          }}>
            {getInitials()}
          </div>
        )}
        
        <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
          <div style={{
            fontWeight: '600',
            color: 'var(--gray-800)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {getUserDisplayName()}
          </div>
        </div>
        
        <ChevronDown 
          size={16} 
          style={{ 
            color: 'var(--gray-400)',
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '0',
          right: '0',
          marginBottom: '8px',
          background: 'white',
          borderRadius: '10px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
          overflow: 'hidden',
          zIndex: 1000,
          animation: 'slideUp 0.15s ease-out',
        }}>
          <style>{`
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateY(8px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>

          {/* User Info Header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--gray-100)',
          }}>
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--gray-800)',
              marginBottom: '2px',
            }}>
              {getUserDisplayName()}
            </div>
            <div style={{
              fontSize: '12px',
              color: 'var(--gray-500)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginBottom: getOrgName() ? '8px' : '0',
            }}>
              {getUserEmail()}
            </div>
            {getOrgName() && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                color: 'var(--gray-500)',
                background: 'var(--gray-50)',
                padding: '6px 8px',
                borderRadius: '6px',
                marginTop: '4px',
              }}>
                <Building2 size={12} />
                <span style={{ fontWeight: '500' }}>{getOrgName()}</span>
              </div>
            )}
          </div>

          {/* Menu Items */}
          <div style={{ padding: '6px' }}>
            <button
              onClick={handleAccountSettings}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                width: '100%',
                border: 'none',
                background: 'transparent',
                color: 'var(--gray-700)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                borderRadius: '6px',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-50)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Settings size={16} style={{ color: 'var(--gray-500)' }} />
              Account Settings
              <ExternalLink size={12} style={{ marginLeft: 'auto', color: 'var(--gray-400)' }} />
            </button>

            <div style={{
              height: '1px',
              background: 'var(--gray-100)',
              margin: '6px 0',
            }} />

            <button
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                width: '100%',
                border: 'none',
                background: 'transparent',
                color: '#dc2626',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                borderRadius: '6px',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserMenu
