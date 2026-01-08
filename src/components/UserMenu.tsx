import { useState, useRef, useEffect } from 'react'
import { LogOut, Settings, ExternalLink, ChevronDown, Building2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const UserMenu = () => {
  const { user, profile, currentOrg, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
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
    <div className="user-menu" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`user-menu__trigger ${isOpen ? 'user-menu__trigger--active' : ''}`}
      >
        {getAvatarUrl() ? (
          <img src={getAvatarUrl()!} alt="Profile" className="user-menu__avatar" />
        ) : (
          <div className="user-menu__avatar user-menu__avatar--initials">
            {getInitials()}
          </div>
        )}
        
        <span className="user-menu__name">{getUserDisplayName()}</span>
        
        <ChevronDown 
          size={16} 
          className={`user-menu__chevron ${isOpen ? 'user-menu__chevron--open' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="user-menu__dropdown">
          <div className="user-menu__header">
            <div className="user-menu__header-name">{getUserDisplayName()}</div>
            <div className="user-menu__header-email">{getUserEmail()}</div>
            {currentOrg?.name && (
              <div className="user-menu__org">
                <Building2 size={12} />
                <span className="user-menu__org-name">{currentOrg.name}</span>
              </div>
            )}
          </div>

          <div className="user-menu__items">
            <button onClick={handleAccountSettings} className="user-menu__item">
              <Settings size={16} className="user-menu__item-icon" />
              Account Settings
              <ExternalLink size={12} className="user-menu__item-external" />
            </button>

            <div className="user-menu__divider" />

            <button onClick={handleLogout} className="user-menu__item user-menu__item--danger">
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
