import { createContext, useContext, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Plug } from 'lucide-react';
import { agents } from '../data/agents';

const AgentModalContext = createContext(null);

export const useAgentModal = () => {
    const context = useContext(AgentModalContext);
    if (!context) {
        throw new Error('useAgentModal must be used within AgentModalProvider');
    }
    return context;
};

const AgentModal = ({ agent, onClose }) => {
    if (!agent) return null;

    const handleClose = () => {
        onClose();
    };

    const modalContent = (
        <div 
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            {/* Backdrop */}
            <div 
                onClick={handleClose}
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(4px)',
                    animation: 'fadeIn 0.2s ease-out'
                }}
            />
            
            {/* Modal */}
            <div 
                style={{
                    position: 'relative',
                    background: 'white',
                    borderRadius: '20px',
                    width: '90%',
                    maxWidth: '480px',
                    maxHeight: '90vh',
                    overflow: 'hidden',
                    animation: 'modalSlideIn 0.3s ease-out',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }}
            >
                {/* Header with gradient */}
                <div style={{
                    background: agent.gradient,
                    padding: '24px 24px 48px',
                    position: 'relative'
                }}>
                    <button
                        type="button"
                        onClick={handleClose}
                        style={{
                            position: 'absolute',
                            top: '16px',
                            right: '16px',
                            background: 'rgba(255, 255, 255, 0.2)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'white',
                            transition: 'background 0.2s',
                            zIndex: 10
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                    >
                        <X size={20} />
                    </button>
                </div>
                
                {/* Avatar overlapping header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginTop: '-48px',
                    position: 'relative',
                    zIndex: 1
                }}>
                    <div style={{ position: 'relative' }}>
                        <img
                            src={agent.avatar}
                            alt={agent.name}
                            style={{
                                width: '96px',
                                height: '96px',
                                borderRadius: '24px',
                                border: '4px solid white',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                            }}
                        />
                        <div style={{
                            position: 'absolute',
                            bottom: '-2px',
                            right: '-2px',
                            background: 'white',
                            borderRadius: '50%',
                            padding: '4px'
                        }}>
                            <div style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                background: '#22c55e',
                                border: '2px solid white'
                            }} />
                        </div>
                    </div>
                </div>
                
                {/* Content - Scrollable */}
                <div style={{ padding: '16px 24px 24px', maxHeight: 'calc(90vh - 150px)', overflowY: 'auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>
                            {agent.name}
                        </h2>
                        <p style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: 'var(--primary-600)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            {agent.role}
                        </p>
                    </div>
                    
                    <p style={{
                        fontSize: '15px',
                        color: 'var(--gray-600)',
                        lineHeight: '1.6',
                        textAlign: 'center',
                        marginBottom: '20px'
                    }}>
                        {agent.desc}
                    </p>

                    {/* Integrations */}
                    {agent.integrations && agent.integrations.length > 0 && (
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                marginBottom: '10px',
                                justifyContent: 'center'
                            }}>
                                <Plug size={14} style={{ color: 'var(--gray-400)' }} />
                                <span style={{
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    color: 'var(--gray-500)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    Connects with
                                </span>
                            </div>
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '8px',
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}>
                                {agent.integrations.map((integration, index) => (
                                    <span
                                        key={index}
                                        style={{
                                            padding: '6px 12px',
                                            background: 'var(--gray-100)',
                                            borderRadius: '20px',
                                            fontSize: '13px',
                                            fontWeight: '500',
                                            color: 'var(--gray-700)',
                                            border: '1px solid var(--gray-200)'
                                        }}
                                    >
                                        {integration}
                                    </span>
                                ))}
                                <span style={{
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    color: 'var(--gray-500)',
                                    fontStyle: 'italic'
                                }}>
                                    etc..
                                </span>
                            </div>
                        </div>
                    )}
                    
                    {/* Capabilities */}
                    <div style={{
                        background: 'var(--gray-50)',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '20px'
                    }}>
                        <h3 style={{
                            fontSize: '13px',
                            fontWeight: '600',
                            color: 'var(--gray-500)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: '12px'
                        }}>
                            Autonomous Actions
                        </h3>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {agent.capabilities?.map((capability, index) => (
                                <li 
                                    key={index}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '10px',
                                        padding: '8px 0',
                                        fontSize: '14px',
                                        color: 'var(--gray-700)',
                                        lineHeight: '1.4'
                                    }}
                                >
                                    <div style={{
                                        flexShrink: 0,
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        background: 'var(--primary-100)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginTop: '1px'
                                    }}>
                                        <Check size={12} style={{ color: 'var(--primary-600)' }} />
                                    </div>
                                    {capability}
                                </li>
                            ))}
                        </ul>
                    </div>
                    
                </div>
            </div>
            
            {/* Animations */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes modalSlideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export const AgentModalProvider = ({ children }) => {
    const [selectedAgent, setSelectedAgent] = useState(null);

    const openAgentModal = (agentOrId) => {
        if (typeof agentOrId === 'string') {
            const agent = agents.find(a => a.id === agentOrId);
            setSelectedAgent(agent || null);
        } else {
            setSelectedAgent(agentOrId);
        }
    };

    const closeAgentModal = () => {
        setSelectedAgent(null);
    };

    // Close modal on escape key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') setSelectedAgent(null);
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, []);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (selectedAgent) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [selectedAgent]);

    return (
        <AgentModalContext.Provider value={{ selectedAgent, openAgentModal, closeAgentModal }}>
            {children}
            {selectedAgent && (
                <AgentModal agent={selectedAgent} onClose={closeAgentModal} />
            )}
        </AgentModalContext.Provider>
    );
};
