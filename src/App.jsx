import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import AppLayout from './components/AppLayout';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';

function App() {
    return (
        <Router>
            <AppLayout>
                <Sidebar />
                <main style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/chat/:id" element={<Chat />} />
                    </Routes>
                </main>
            </AppLayout>
        </Router>
    );
}

export default App;
