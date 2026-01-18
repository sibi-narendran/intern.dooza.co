import { useEffect, useMemo } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { agents } from '../data/agents';
import { useAgentModal } from '../context/AgentModalContext';
import { useAuth } from '../context/AuthContext';

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
};

const Dashboard = () => {
    const { openAgentModal } = useAgentModal();
    const { profile, user } = useAuth();

    const greeting = useMemo(() => getGreeting(), []);
    
    const displayName = useMemo(() => {
        if (profile?.first_name) return profile.first_name;
        if (user?.user_metadata?.first_name) return user.user_metadata.first_name;
        return 'there';
    }, [profile, user]);

    useEffect(() => {
        document.title = 'Dashboard | Dooza agent';
    }, []);

    return (
        <div className="page-scrollable" style={{ padding: '32px', background: 'var(--gray-50)' }}>
            <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
                        {greeting}, {displayName}
                    </h1>
                    <p style={{ color: 'var(--gray-500)' }}>Your AI staff is ready to work.</p>
                </div>
                <button className="btn btn-primary">
                    + New Custom agent
                </button>
            </header>

            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px', color: 'var(--gray-700)' }}>Your Team</h2>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '24px'
            }}>
                {agents.map((agent) => (
                    <div key={agent.id} style={{
                        background: 'white',
                        borderRadius: '16px',
                        padding: '24px',
                        border: '1px solid var(--border-color)',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        height: '100%'
                    }}
                        onClick={() => openAgentModal(agent)}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.boxShadow = '0 10px 20px -5px rgba(0,0,0,0.05)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <div style={{ position: 'relative' }}>
                                    <img
                                        src={agent.avatar}
                                        alt={agent.name}
                                        style={{
                                            width: '64px', height: '64px',
                                            borderRadius: '16px',
                                            objectFit: 'cover',
                                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                                        }}
                                    />
                                    <div style={{
                                        position: 'absolute', bottom: '-4px', right: '-4px',
                                        background: 'white', borderRadius: '50%', padding: '2px'
                                    }}>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e', border: '2px solid white' }}></div>
                                    </div>
                                </div>
                                <button 
                                    type="button"
                                    style={{
                                        background: 'transparent', border: 'none', padding: '4px',
                                        color: 'var(--gray-400)', cursor: 'pointer'
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label="More options"
                                >
                                    <MoreHorizontal size={20} />
                                </button>
                            </div>

                            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>{agent.name}</h3>
                            <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary-600)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>{agent.role}</p>
                            <p style={{ fontSize: '14px', color: 'var(--gray-500)', lineHeight: '1.5' }}>{agent.desc}</p>
                        </div>

                        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--gray-100)' }}>
                            <span style={{ 
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '13px', 
                                color: 'var(--primary-600)',
                                fontWeight: '500'
                            }}>
                                Click to see what {agent.name} can do →
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Dashboard;
