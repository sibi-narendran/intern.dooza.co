import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import Sidebar from './components/Sidebar'
import Navbar from './components/Navbar'
import AppLayout from './components/AppLayout'
import Dashboard from './pages/Dashboard'
import Chat from './pages/Chat'

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <ProtectedRoute>
            <AppLayout>
              <Sidebar />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                <Navbar />
                <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/chat/:id" element={<Chat />} />
                  </Routes>
                </main>
              </div>
            </AppLayout>
          </ProtectedRoute>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
