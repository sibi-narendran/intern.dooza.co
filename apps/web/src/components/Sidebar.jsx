import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid, Plus } from 'lucide-react';
import { agents } from '../data/agents';
import { useAgentModal } from '../context/AgentModalContext';
import logo from '../assets/logo.png';

const Sidebar = () => {
    const location = useLocation();
    const { openAgentModal } = useAgentModal();

    const isActive = (path) => location.pathname === path;

    return (
        <aside className="app-shell__sidebar" style={{ padding: '20px' }}>
            {/* Brand */}
            <div style={{ marginBottom: '32px', paddingLeft: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src={logo} alt="Dooza Logo" style={{ width: '28px', height: '28px' }} />
                <span style={{ fontWeight: '700', fontSize: '18px' }}>Dooza <span style={{ color: 'var(--primary-600)' }}>agent</span></span>
            </div>

            {/* Main Nav */}
            <nav style={{ flex: 1, overflowY: 'auto' }}>
                <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--gray-500)', marginBottom: '12px', paddingLeft: '8px', letterSpacing: '0.05em' }}>WORKSPACE</p>

                <Link to="/" style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px', borderRadius: '8px', textDecoration: 'none',
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

                <div style={{ marginTop: '28px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '8px', marginBottom: '8px' }}>
                        <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--gray-500)', paddingLeft: '8px', letterSpacing: '0.05em' }}>YOUR TEAM</p>
                        <Plus size={14} color="var(--gray-400)" cursor="pointer" />
                    </div>

                    {agents.map(agent => (
                        <button
                            key={agent.id}
                            onClick={() => openAgentModal(agent)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                marginBottom: '2px',
                                background: 'transparent',
                                color: 'var(--gray-600)',
                                border: 'none',
                                cursor: 'pointer',
                                width: '100%',
                                textAlign: 'left',
                                transition: 'all 0.1s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--gray-100)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                            }}
                        >
                            <img
                                src={agent.avatar}
                                alt={agent.name}
                                style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                            />
                            <span style={{ fontSize: '14px', fontWeight: '500' }}>{agent.name}</span>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', marginLeft: 'auto' }}></div>
                        </button>
                    ))}
                </div>
            </nav>
        </aside>
    );
};

export default Sidebar;
