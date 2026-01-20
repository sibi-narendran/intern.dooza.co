import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'

/**
 * Lightweight OAuth callback page.
 * This page handles the redirect after OAuth completes.
 * 
 * It will:
 * 1. Notify the parent window via postMessage (most reliable)
 * 2. Attempt to close itself
 * 3. Show fallback UI if close fails
 */
export default function OAuthCallbackPage() {
  const [closeFailed, setCloseFailed] = useState(false)
  const params = new URLSearchParams(window.location.search)
  const status = params.get('connection_status')
  const isSuccess = status === 'success'

  useEffect(() => {
    // Notify parent window via postMessage (works cross-origin safely)
    if (window.opener) {
      try {
        window.opener.postMessage(
          { type: 'oauth_callback', status: status || 'unknown' },
          window.location.origin
        )
      } catch {
        // postMessage failed, parent will still detect via polling
      }
    }

    // Attempt to close the popup
    // Small delay ensures postMessage is sent first
    const closeTimer = setTimeout(() => {
      window.close()
      
      // If we're still here after 500ms, close failed
      setTimeout(() => {
        setCloseFailed(true)
      }, 500)
    }, 100)

    return () => clearTimeout(closeTimer)
  }, [status])

  // Minimal UI - shows briefly or as fallback
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#fafafa',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '40px',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        maxWidth: '360px'
      }}>
        {isSuccess ? (
          <>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#dcfce7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <Check size={24} color="#16a34a" />
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: '18px', color: '#111' }}>
              Connected Successfully
            </h2>
          </>
        ) : (
          <>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <X size={24} color="#dc2626" />
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: '18px', color: '#111' }}>
              Connection Failed
            </h2>
          </>
        )}
        
        {closeFailed ? (
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
            You can close this window now.
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
            Closing automatically...
          </p>
        )}
      </div>
    </div>
  )
}
