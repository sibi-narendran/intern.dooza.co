import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  const [showRetry, setShowRetry] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  // Show retry button after 5 seconds of loading
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setShowRetry(true), 5000)
      return () => clearTimeout(timer)
    }
    setShowRetry(false)
  }, [loading])

  const handleRetry = () => {
    window.location.reload()
  }

  const handleLogin = () => {
    setRedirecting(true)
    const accountsUrl = import.meta.env.VITE_ACCOUNTS_URL || 'https://accounts.dooza.ai'
    const currentUrl = encodeURIComponent(window.location.href)
    window.location.href = `${accountsUrl}/signin?redirect=${currentUrl}`
  }

  // Show loading state while checking auth
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: 'var(--bg-app)',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--gray-200)',
            borderTopColor: 'var(--primary-600)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ color: 'var(--gray-500)', fontSize: '14px' }}>
            Checking authentication...
          </span>
          {showRetry && (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '12px',
              marginTop: '8px' 
            }}>
              <span style={{ color: 'var(--gray-400)', fontSize: '13px' }}>
                Taking longer than expected...
              </span>
              <button
                onClick={handleRetry}
                style={{
                  padding: '8px 20px',
                  background: 'var(--primary-600)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                Retry
              </button>
            </div>
          )}
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    )
  }

  // Show login prompt if not authenticated (don't auto-redirect to prevent loops)
  if (!user) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: 'var(--bg-app)',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          padding: '40px',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          maxWidth: '400px',
          textAlign: 'center',
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            background: 'var(--gray-100)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div>
            <h2 style={{ 
              margin: '0 0 8px 0', 
              fontSize: '20px', 
              fontWeight: '600',
              color: 'var(--gray-900)' 
            }}>
              Sign in required
            </h2>
            <p style={{ 
              margin: 0, 
              color: 'var(--gray-500)', 
              fontSize: '14px',
              lineHeight: '1.5'
            }}>
              Please sign in to your Dooza account to access the Agent workspace.
            </p>
          </div>
          <button
            onClick={handleLogin}
            disabled={redirecting}
            style={{
              padding: '12px 32px',
              background: 'var(--primary-600)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: redirecting ? 'wait' : 'pointer',
              fontSize: '15px',
              fontWeight: '600',
              width: '100%',
              opacity: redirecting ? 0.7 : 1,
            }}
          >
            {redirecting ? 'Redirecting...' : 'Sign in with Dooza'}
          </button>
          <p style={{ 
            margin: 0, 
            color: 'var(--gray-400)', 
            fontSize: '12px' 
          }}>
            You'll be redirected to accounts.dooza.ai
          </p>
        </div>
      </div>
    )
  }

  return children
}

export default ProtectedRoute
