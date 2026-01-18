import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid, Puzzle, Brain, Users } from 'lucide-react';
import logo from '../assets/logo.png';

const Sidebar = () => {
    const location = useLocation();

    const isActive = (path) => location.pathname === path;
    const isActivePrefix = (prefix) => location.pathname.startsWith(prefix);

    return (
        <aside className="app-shell__sidebar" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
            {/* Brand */}
            <div style={{ marginBottom: '32px', paddingLeft: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src={logo} alt="Dooza Logo" style={{ width: '28px', height: '28px' }} />
                <span style={{ fontWeight: '700', fontSize: '18px' }}>Dooza <span style={{ color: 'var(--primary-600)' }}>Workforce</span></span>
            </div>

            {/* Main Nav */}
            <nav style={{ flex: 1, overflowY: 'auto' }}>
                <p style={{ 
                    fontSize: '11px', 
                    fontWeight: '700', 
                    color: 'var(--gray-500)', 
                    marginBottom: '12px', 
                    paddingLeft: '8px', 
                    letterSpacing: '0.05em' 
                }}>
                    WORKSPACE
                </p>

                <Link to="/" style={{
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px',
                    padding: '8px 12px', 
                    borderRadius: '8px', 
                    textDecoration: 'none',
                    marginBottom: '4px',
                    background: isActive('/') ? 'white' : 'transparent',
                    color: isActive('/') ? 'var(--primary-700)' : 'var(--gray-600)',
                    boxShadow: isActive('/') ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    fontWeight: isActive('/') ? '600' : '500',
                    transition: 'all 0.1s'
                }}>
                    <LayoutGrid size={18} />
                    <span>Dashboard</span>
                </Link>

                <Link to="/integrations" style={{
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px',
                    padding: '8px 12px', 
                    borderRadius: '8px', 
                    textDecoration: 'none',
                    marginBottom: '4px',
                    background: isActivePrefix('/integrations') ? 'white' : 'transparent',
                    color: isActivePrefix('/integrations') ? 'var(--primary-700)' : 'var(--gray-600)',
                    boxShadow: isActivePrefix('/integrations') ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    fontWeight: isActivePrefix('/integrations') ? '600' : '500',
                    transition: 'all 0.1s'
                }}>
                    <Puzzle size={18} />
                    <span>Integrations</span>
                </Link>

                <Link to="/knowledge" style={{
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px',
                    padding: '8px 12px', 
                    borderRadius: '8px', 
                    textDecoration: 'none',
                    marginBottom: '4px',
                    background: isActivePrefix('/knowledge') ? 'white' : 'transparent',
                    color: isActivePrefix('/knowledge') ? 'var(--primary-700)' : 'var(--gray-600)',
                    boxShadow: isActivePrefix('/knowledge') ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    fontWeight: isActivePrefix('/knowledge') ? '600' : '500',
                    transition: 'all 0.1s'
                }}>
                    <Brain size={18} />
                    <span>Knowledge Base</span>
                </Link>

                <Link to="/gallery" style={{
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px',
                    padding: '8px 12px', 
                    borderRadius: '8px', 
                    textDecoration: 'none',
                    marginBottom: '4px',
                    background: isActivePrefix('/gallery') ? 'white' : 'transparent',
                    color: isActivePrefix('/gallery') ? 'var(--primary-700)' : 'var(--gray-600)',
                    boxShadow: isActivePrefix('/gallery') ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    fontWeight: isActivePrefix('/gallery') ? '600' : '500',
                    transition: 'all 0.1s'
                }}>
                    <Users size={18} />
                    <span>Workforce Gallery</span>
                </Link>
            </nav>
        </aside>
    );
};

export default Sidebar;
