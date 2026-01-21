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
import WorkspacePage from './pages/WorkspacePage'
import ChatPage from './pages/ChatPage'
import SettingsPage from './pages/SettingsPage'
import OAuthCallbackPage from './pages/OAuthCallbackPage'

/**
 * Standard layout for non-chat pages
 * Uses collapsed sidebar + main content area
 */
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

/**
 * Chat layout with collapsed sidebar + agent panel + chat content
 * AgentPanel is rendered inside ChatPage for state management
 */
function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <AgentModalProvider>
      <div className="chat-layout">
        <Sidebar />
        {children}
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
              {/* Chat pages - special layout with AgentPanel */}
              <Route path="/chat/:agentSlug" element={
                <ChatLayout>
                  <ChatPage />
                </ChatLayout>
              } />
              
              {/* Standard pages with collapsed sidebar */}
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
              <Route path="/workspace" element={
                <AppLayout>
                  <WorkspacePage />
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
