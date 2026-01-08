import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import Sidebar from './components/Sidebar'
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
              <main style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/chat/:id" element={<Chat />} />
                </Routes>
              </main>
            </AppLayout>
          </ProtectedRoute>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
