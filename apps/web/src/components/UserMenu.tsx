import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Settings, Building2, ChevronUp } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const UserMenu = () => {
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
    <div className="sidebar-user" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`sidebar-user__trigger ${isOpen ? 'sidebar-user__trigger--active' : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Profile menu"
      >
        <div className="sidebar-user__avatar">
          {getAvatarUrl() ? (
            <img src={getAvatarUrl()!} alt="" />
          ) : (
            <span className="sidebar-user__avatar-initials">
              {getInitials()}
            </span>
          )}
          <span className="sidebar-user__status" />
        </div>
        <div className="sidebar-user__info">
          <span className="sidebar-user__name">{getUserDisplayName()}</span>
          {currentOrg && (
            <span className="sidebar-user__org">{currentOrg.name}</span>
          )}
        </div>
        <ChevronUp 
          size={18} 
          className={`sidebar-user__chevron ${isOpen ? 'sidebar-user__chevron--open' : ''}`} 
        />
      </button>

      {isOpen && (
        <>
          <div className="sidebar-user__backdrop" onClick={closeMenu} />
          <div className="sidebar-user__dropdown" role="menu">
            <div className="sidebar-user__dropdown-header">
              <div className="sidebar-user__dropdown-avatar">
                {getAvatarUrl() ? (
                  <img src={getAvatarUrl()!} alt="" />
                ) : (
                  <span>{getInitials()}</span>
                )}
              </div>
              <div className="sidebar-user__dropdown-info">
                <span className="sidebar-user__dropdown-name">{getUserDisplayName()}</span>
                <span className="sidebar-user__dropdown-email">{getUserEmail()}</span>
              </div>
            </div>

            {currentOrg && (
              <div className="sidebar-user__dropdown-org">
                <Building2 size={16} />
                <span>{currentOrg.name}</span>
              </div>
            )}

            <div className="sidebar-user__divider" />

            <div className="sidebar-user__menu-items" role="group">
              <button 
                onClick={handleSettings} 
                className="sidebar-user__menu-item"
                role="menuitem"
              >
                <Settings size={18} />
                <span>Settings</span>
              </button>
            </div>

            <div className="sidebar-user__divider" />

            <div className="sidebar-user__menu-items" role="group">
              <button 
                onClick={handleLogout} 
                className="sidebar-user__menu-item sidebar-user__menu-item--danger"
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

export default UserMenu
