import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AgentModalProvider } from './context/AgentModalContext'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import Sidebar from './components/Sidebar'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import IntegrationsPage from './pages/IntegrationsPage'
import KnowledgeBasePage from './pages/KnowledgeBasePage'
import WorkforceGalleryPage from './pages/WorkforceGalleryPage'
import ChatPage from './pages/ChatPage'

// Layout wrapper for main app pages (with sidebar and navbar)
function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AgentModalProvider>
      <div className="app-shell">
        <Sidebar />
        <div className="app-shell__main">
          <Navbar />
          <main className="app-shell__content">
            {children}
          </main>
        </div>
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
              {/* Chat page - full screen without sidebar/navbar */}
              <Route path="/chat/:agentSlug" element={<ChatPage />} />
              
              {/* Main app pages with sidebar/navbar */}
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
