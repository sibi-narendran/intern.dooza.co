import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AgentModalProvider } from './context/AgentModalContext'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import IntegrationsPage from './pages/IntegrationsPage'
import KnowledgeBasePage from './pages/KnowledgeBasePage'
import WorkforceGalleryPage from './pages/WorkforceGalleryPage'
import ChatPage from './pages/ChatPage'
import SettingsPage from './pages/SettingsPage'
import OAuthCallbackPage from './pages/OAuthCallbackPage'

// Layout wrapper for main app pages (with sidebar)
function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AgentModalProvider>
      <div className="app-shell">
        <Sidebar />
        <main className="app-shell__main">
          {children}
        </main>
      </div>
    </AgentModalProvider>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ProtectedRoute>
            <Routes>
              {/* Main app pages with sidebar/navbar */}
              <Route path="/chat/:agentSlug" element={
                <AppLayout>
                  <ChatPage />
                </AppLayout>
              } />
              <Route path="/" element={
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              } />
              <Route path="/integrations" element={
                <AppLayout>
                  <IntegrationsPage />
                </AppLayout>
              } />
              <Route path="/knowledge" element={
                <AppLayout>
                  <KnowledgeBasePage />
                </AppLayout>
              } />
              <Route path="/gallery" element={
                <AppLayout>
                  <WorkforceGalleryPage />
                </AppLayout>
              } />
              <Route path="/settings" element={
                <AppLayout>
                  <SettingsPage />
                </AppLayout>
              } />
              
              {/* OAuth callback - lightweight page, no sidebar */}
              <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
              
              {/* Fallback */}
              <Route path="*" element={
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              } />
            </Routes>
          </ProtectedRoute>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
