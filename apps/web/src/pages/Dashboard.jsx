import { useEffect, useMemo, useState, useCallback } from 'react';
import { MoreHorizontal, Sparkles, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAgentModal } from '../context/AgentModalContext';
import { useAuth } from '../context/AuthContext';
import { getMyTeam } from '../lib/agent-api';

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
};

const Dashboard = () => {
    const { openAgentModal } = useAgentModal();
    const { profile, user } = useAuth();
    const navigate = useNavigate();
    
    // State for hired agents
    const [myTeam, setMyTeam] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const greeting = useMemo(() => getGreeting(), []);
    
    const displayName = useMemo(() => {
        if (profile?.first_name) return profile.first_name;
        if (user?.user_metadata?.first_name) return user.user_metadata.first_name;
        return 'there';
    }, [profile, user]);

    // Fetch hired agents
    const fetchTeam = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const team = await getMyTeam();
            setMyTeam(team);
        } catch (err) {
            console.error('Failed to fetch team:', err);
            setError('Failed to load your team');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        document.title = 'Dashboard | Dooza Workforce';
        fetchTeam();
    }, [fetchTeam]);

    // Agents that have chat capability (tool-enabled)
    const CHAT_ENABLED_AGENTS = ['seomi'];

    // Handle agent click - navigate to chat for enabled agents, otherwise open modal
    const handleAgentClick = (agent) => {
        if (CHAT_ENABLED_AGENTS.includes(agent.slug)) {
            // Navigate to chat page
            navigate(`/chat/${agent.slug}`);
        } else {
            // Transform hired agent to modal format
            openAgentModal({
                id: agent.slug,
                name: agent.name,
                role: agent.role,
                desc: agent.description,
                avatar: agent.avatar_url,
                gradient: agent.gradient,
                capabilities: agent.capabilities,
                integrations: agent.integrations
            });
        }
    };

    return (
        <div className="page-scrollable" style={{ padding: '32px', background: 'var(--gray-50)' }}>
            <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
                        {greeting}, {displayName}
                    </h1>
                    <p style={{ color: 'var(--gray-500)' }}>Your AI staff is ready to work.</p>
                </div>
                <button 
                    className="btn btn-primary"
                    onClick={() => navigate('/gallery')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <Sparkles size={18} />
                    Hire New Agent
                </button>
            </header>

            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px', color: 'var(--gray-700)' }}>
                Your Team {!loading && `(${myTeam.length})`}
            </h2>

            {/* Loading State */}
            {loading && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    padding: '64px 24px',
                    color: 'var(--gray-500)'
                }}>
                    <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Loading your team...</span>
                </div>
            )}

            {/* Error State */}
            {error && !loading && (
                <div style={{
                    textAlign: 'center',
                    padding: '40px 24px',
                    background: '#fef2f2',
                    borderRadius: '12px',
                    color: '#dc2626'
                }}>
                    <p style={{ marginBottom: '16px' }}>{error}</p>
                    <button
                        onClick={fetchTeam}
                        style={{
                            padding: '8px 16px',
                            background: 'white',
                            border: '1px solid #dc2626',
                            borderRadius: '6px',
                            color: '#dc2626',
                            cursor: 'pointer',
                            fontWeight: '500'
                        }}
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Empty State */}
            {!loading && !error && myTeam.length === 0 && (
                <div style={{
                    textAlign: 'center',
                    padding: '64px 24px',
                    background: 'white',
                    borderRadius: '16px',
                    border: '2px dashed var(--gray-200)'
                }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px'
                    }}>
                        <Sparkles size={28} color="white" />
                    </div>
                    <h3 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--gray-800)', marginBottom: '8px' }}>
                        Build Your AI Team
                    </h3>
                    <p style={{ fontSize: '15px', color: 'var(--gray-500)', maxWidth: '400px', margin: '0 auto 24px' }}>
                        Hire AI agents from our gallery to automate your work. Each agent specializes in different tasks.
                    </p>
                    <button
                        onClick={() => navigate('/gallery')}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '14px 28px',
                            background: 'var(--primary-600)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '15px',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        <Sparkles size={18} />
                        Browse Agent Gallery
                    </button>
                </div>
            )}

            {/* Agent Cards */}
            {!loading && !error && myTeam.length > 0 && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '24px'
                }}>
                    {myTeam.map((agent) => (
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
                            onClick={() => handleAgentClick(agent)}
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
                                        <div style={{
                                            width: '64px',
                                            height: '64px',
                                            borderRadius: '16px',
                                            background: agent.gradient || 'linear-gradient(135deg, #f3f4f6, #e5e7eb)',
                                            overflow: 'hidden',
                                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                                        }}>
                                            {agent.avatar_url ? (
                                                <img
                                                    src={agent.avatar_url}
                                                    alt={agent.name}
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: 'cover'
                                                    }}
                                                />
                                            ) : (
                                                <div style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '28px'
                                                }}>
                                                    🤖
                                                </div>
                                            )}
                                        </div>
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
                                <p style={{ fontSize: '14px', color: 'var(--gray-500)', lineHeight: '1.5' }}>{agent.description}</p>
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
            )}

            {/* Spin animation */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default Dashboard;
