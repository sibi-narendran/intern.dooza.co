import { useAuth } from '../context/AuthContext'

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()

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
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    )
  }

  // Redirect to accounts app if not authenticated
  if (!user) {
    const accountsUrl = import.meta.env.VITE_ACCOUNTS_URL || 'https://accounts.dooza.ai'
    const currentUrl = encodeURIComponent(window.location.href)
    window.location.href = `${accountsUrl}/signin?redirect=${currentUrl}`
    return null
  }

  return children
}

export default ProtectedRoute
