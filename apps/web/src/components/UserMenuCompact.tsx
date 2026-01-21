import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Settings, Building2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

/**
 * Compact user menu for collapsed sidebar
 * Shows avatar only, expands to dropdown on click
 */
const UserMenuCompact = () => {
  const { user, profile, currentOrg, signOut } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const closeMenu = useCallback(() => setIsOpen(false), [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenu()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, closeMenu])

  const handleSettings = () => {
    closeMenu()
    navigate('/settings')
  }

  const handleLogout = async () => {
    closeMenu()
    await signOut()
  }

  const getInitials = (): string => {
    if (profile?.first_name) {
      return profile.first_name[0].toUpperCase()
    }
    if (user?.user_metadata?.first_name) {
      return (user.user_metadata.first_name as string)[0].toUpperCase()
    }
    if (user?.email) {
      return user.email[0].toUpperCase()
    }
    return '?'
  }

  const getUserDisplayName = (): string => {
    if (profile?.first_name) {
      return `${profile.first_name}${profile.last_name ? ' ' + profile.last_name : ''}`
    }
    if (user?.user_metadata?.first_name) {
      return `${user.user_metadata.first_name}${user.user_metadata.last_name ? ' ' + user.user_metadata.last_name : ''}`
    }
    return user?.email?.split('@')[0] || 'User'
  }

  const getUserEmail = (): string => {
    return profile?.email || user?.email || ''
  }

  const getAvatarUrl = (): string | null => {
    return (user?.user_metadata?.avatar_url as string) || null
  }

  return (
    <div className="user-menu-compact" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`user-menu-compact__trigger ${isOpen ? 'user-menu-compact__trigger--active' : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Profile menu"
        title={getUserDisplayName()}
      >
        {getAvatarUrl() ? (
          <img src={getAvatarUrl()!} alt="" className="user-menu-compact__avatar" />
        ) : (
          <span className="user-menu-compact__initials">
            {getInitials()}
          </span>
        )}
        <span className="user-menu-compact__status" />
      </button>

      {isOpen && (
        <>
          <div className="user-menu-compact__backdrop" onClick={closeMenu} />
          <div className="user-menu-compact__dropdown" role="menu">
            <div className="user-menu-compact__header">
              <div className="user-menu-compact__header-avatar">
                {getAvatarUrl() ? (
                  <img src={getAvatarUrl()!} alt="" />
                ) : (
                  <span>{getInitials()}</span>
                )}
              </div>
              <div className="user-menu-compact__header-info">
                <span className="user-menu-compact__name">{getUserDisplayName()}</span>
                <span className="user-menu-compact__email">{getUserEmail()}</span>
              </div>
            </div>

            {currentOrg && (
              <div className="user-menu-compact__org">
                <Building2 size={16} />
                <span>{currentOrg.name}</span>
              </div>
            )}

            <div className="user-menu-compact__divider" />

            <div className="user-menu-compact__items" role="group">
              <button 
                onClick={handleSettings} 
                className="user-menu-compact__item"
                role="menuitem"
              >
                <Settings size={18} />
                <span>Settings</span>
              </button>
            </div>

            <div className="user-menu-compact__divider" />

            <div className="user-menu-compact__items" role="group">
              <button 
                onClick={handleLogout} 
                className="user-menu-compact__item user-menu-compact__item--danger"
                role="menuitem"
              >
                <LogOut size={18} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default UserMenuCompact
