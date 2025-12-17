import { useNavigate } from 'react-router-dom';
import { MessageSquare, MoreHorizontal } from 'lucide-react';
import { interns } from '../data/interns';

const Dashboard = () => {
    const navigate = useNavigate();

    return (
        <div style={{ flex: 1, padding: '32px', overflowY: 'auto', background: 'var(--gray-50)' }}>
            <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>Good afternoon, User</h1>
                    <p style={{ color: 'var(--gray-500)' }}>Your AI staff is ready to work.</p>
                </div>
                <button className="btn btn-primary">
                    + New Custom Intern
                </button>
            </header>

            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px', color: 'var(--gray-700)' }}>Your Team</h2>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '24px'
            }}>
                {interns.map((intern) => (
                    <div key={intern.id} style={{
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
                        onClick={() => navigate(`/chat/${intern.id}`)}
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
                                        src={intern.avatar}
                                        alt={intern.name}
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
                                <button style={{
                                    background: 'transparent', border: 'none', padding: '4px',
                                    color: 'var(--gray-400)', cursor: 'pointer'
                                }}>
                                    <MoreHorizontal size={20} />
                                </button>
                            </div>

                            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>{intern.name}</h3>
                            <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary-600)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>{intern.role}</p>
                            <p style={{ fontSize: '14px', color: 'var(--gray-500)', lineHeight: '1.5' }}>{intern.desc}</p>
                        </div>

                        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--gray-100)' }}>
                            <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', paddingLeft: 0, color: 'var(--primary-600)' }}>
                                <MessageSquare size={16} /> Chat with {intern.name}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Dashboard;
