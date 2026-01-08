import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'

interface ProtectedRouteProps {
  children: ReactNode
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, loading } = useAuth()

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
    const handleLogin = () => {
      const accountsUrl = import.meta.env.VITE_ACCOUNTS_URL || 'https://accounts.dooza.ai'
      const currentUrl = encodeURIComponent(window.location.href)
      window.location.href = `${accountsUrl}/signin?redirect=${currentUrl}`
    }

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
