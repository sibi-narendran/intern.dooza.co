import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AgentModalProvider } from './context/AgentModalContext'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import Sidebar from './components/Sidebar'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <ProtectedRoute>
            <AgentModalProvider>
              <div className="app-shell">
                <Sidebar />
                <div className="app-shell__main">
                  <Navbar />
                  <main className="app-shell__content">
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="*" element={<Dashboard />} />
                    </Routes>
                  </main>
                </div>
              </div>
            </AgentModalProvider>
          </ProtectedRoute>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
