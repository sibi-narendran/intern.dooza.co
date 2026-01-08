import { useState, useRef, useEffect, useCallback } from 'react'
import { LogOut, Settings, ExternalLink, Building2, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const UserMenu = () => {
  const { user, profile, currentOrg, signOut } = useAuth()
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

  const handleAccountSettings = () => {
    const accountsUrl = import.meta.env.VITE_ACCOUNTS_URL || 'https://accounts.dooza.ai'
    window.open(`${accountsUrl}/settings`, '_blank')
    closeMenu()
  }

  const handleLogout = async () => {
    closeMenu()
    await signOut()
  }

  const getInitials = (): string => {
    if (profile?.first_name) {
      const first = profile.first_name[0] || ''
      const last = profile.last_name?.[0] || ''
      return (first + last).toUpperCase() || '?'
    }
    if (user?.user_metadata?.first_name) {
      const first = (user.user_metadata.first_name as string)[0] || ''
      const last = (user.user_metadata.last_name as string)?.[0] || ''
      return (first + last).toUpperCase() || '?'
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
    <div className="profile-menu" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`profile-menu__trigger ${isOpen ? 'profile-menu__trigger--active' : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Profile menu"
      >
        <div className="profile-menu__avatar-wrapper">
          {getAvatarUrl() ? (
            <img src={getAvatarUrl()!} alt="" className="profile-menu__avatar" />
          ) : (
            <div className="profile-menu__avatar profile-menu__avatar--initials">
              {getInitials()}
            </div>
          )}
          <span className="profile-menu__status" />
        </div>
      </button>

      {isOpen && (
        <>
          <div className="profile-menu__backdrop" onClick={closeMenu} />
          <div className="profile-menu__dropdown" role="menu">
            <div className="profile-menu__header">
              <div className="profile-menu__header-avatar">
                {getAvatarUrl() ? (
                  <img src={getAvatarUrl()!} alt="" />
                ) : (
                  <div className="profile-menu__header-avatar-initials">
                    {getInitials()}
                  </div>
                )}
              </div>
              <div className="profile-menu__header-info">
                <div className="profile-menu__header-name">{getUserDisplayName()}</div>
                <div className="profile-menu__header-email">{getUserEmail()}</div>
              </div>
            </div>

            {currentOrg?.name && (
              <div className="profile-menu__org-section">
                <Building2 size={14} />
                <span>{currentOrg.name}</span>
              </div>
            )}

            <div className="profile-menu__divider" />

            <div className="profile-menu__items" role="group">
              <button 
                onClick={handleAccountSettings} 
                className="profile-menu__item"
                role="menuitem"
              >
                <User size={16} />
                <span>My Profile</span>
              </button>

              <button 
                onClick={handleAccountSettings} 
                className="profile-menu__item"
                role="menuitem"
              >
                <Settings size={16} />
                <span>Account Settings</span>
                <ExternalLink size={12} className="profile-menu__item-external" />
              </button>
            </div>

            <div className="profile-menu__divider" />

            <div className="profile-menu__items" role="group">
              <button 
                onClick={handleLogout} 
                className="profile-menu__item profile-menu__item--danger"
                role="menuitem"
              >
                <LogOut size={16} />
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
