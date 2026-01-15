import { type ReactNode, useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

interface ProtectedRouteProps {
  children: ReactNode
}

const ACCOUNTS_URL = import.meta.env.VITE_ACCOUNTS_URL || 'https://accounts.dooza.ai'

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, loading } = useAuth()
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Memoized login handler
  const handleLogin = useCallback(() => {
    const currentUrl = encodeURIComponent(window.location.href)
    window.location.href = `${ACCOUNTS_URL}/signin?redirect=${currentUrl}`
  }, [])

  // Retry handler for offline state
  const handleRetry = useCallback(() => {
    window.location.reload()
  }, [])

  // Show offline banner if user is authenticated but offline
  if (isOffline && !loading) {
    return (
      <div className="offline-banner">
        <div className="offline-banner__content">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          <div>
            <h2 className="offline-banner__title">You're offline</h2>
            <p className="offline-banner__text">
              Please check your internet connection and try again.
            </p>
          </div>
          <button onClick={handleRetry} className="offline-banner__btn">
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading__content">
          <div className="auth-loading__spinner" />
          <span className="auth-loading__text">Loading...</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="login-prompt">
        <div className="login-prompt__card">
          <div className="login-prompt__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div>
            <h2 className="login-prompt__title">Sign in required</h2>
            <p className="login-prompt__text">
              Please sign in to your Dooza account to continue.
            </p>
          </div>
          <button onClick={handleLogin} className="login-prompt__btn">
            Sign in with Dooza
          </button>
          <p className="login-prompt__hint">
            You'll be redirected to accounts.dooza.ai
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export default ProtectedRoute