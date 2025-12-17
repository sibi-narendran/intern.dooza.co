import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Send, Paperclip, MoreVertical, Phone } from 'lucide-react';
import { interns } from '../data/interns';

const Chat = () => {
    const { id } = useParams();
    const intern = interns.find(i => i.id === id);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const endRef = useRef(null);

    useEffect(() => {
        if (intern) {
            setMessages([{
                id: 1,
                sender: 'ai',
                text: `Hi there! I'm ${intern.name}. How can I help you with your ${intern.role.toLowerCase()} needs today?`
            }]);
        }
    }, [id, intern]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    if (!intern) return <div>Intern not found</div>;

    const handleSend = (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: input }]);
        setInput('');

        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                sender: 'ai',
                text: "I'm on it! I'll get that done for you right away."
            }]);
        }, 1000);
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', background: 'white' }}>
            {/* Header */}
            <header style={{
                padding: '12px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ position: 'relative' }}>
                        <img
                            src={intern.avatar}
                            alt={intern.name}
                            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <div style={{
                            position: 'absolute', bottom: 0, right: 0,
                            width: '10px', height: '10px', borderRadius: '50%',
                            background: '#22c55e', border: '2px solid white'
                        }}></div>
                    </div>
                    <div>
                        <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--gray-900)' }}>{intern.name}</h2>
                        <p style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{intern.role} • <span style={{ color: '#22c55e' }}>Online</span></p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-500)' }}>
                        <Phone size={20} />
                    </button>
                    <button style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-500)' }}>
                        <MoreVertical size={20} />
                    </button>
                </div>
            </header>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', background: 'var(--gray-50)' }}>
                {messages.map(msg => (
                    <div key={msg.id} style={{
                        display: 'flex',
                        gap: '12px',
                        flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row'
                    }}>
                        {msg.sender === 'ai' && (
                            <img
                                src={intern.avatar}
                                alt={intern.name}
                                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                            />
                        )}

                        <div style={{
                            maxWidth: '70%',
                            padding: '12px 16px',
                            borderRadius: '16px',
                            fontSize: '15px',
                            lineHeight: '1.5',
                            background: msg.sender === 'user' ? 'var(--primary-600)' : 'white',
                            color: msg.sender === 'user' ? 'white' : 'var(--gray-800)',
                            boxShadow: msg.sender === 'ai' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                            borderTopLeftRadius: msg.sender === 'ai' ? '4px' : '16px',
                            borderTopRightRadius: msg.sender === 'user' ? '4px' : '16px'
                        }}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                <div ref={endRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '24px', background: 'white', borderTop: '1px solid var(--border-color)' }}>
                <form onSubmit={handleSend} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    background: 'white', padding: '6px', borderRadius: '16px',
                    border: '1px solid var(--gray-200)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}>
                    <button type="button" style={{
                        padding: '10px', background: 'transparent', border: 'none',
                        color: 'var(--gray-400)', cursor: 'pointer', borderRadius: '50%'
                    }} className="hover:bg-gray-100"><Paperclip size={20} /></button>

                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={`Message ${intern.name}...`}
                        style={{
                            flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '15px'
                        }}
                    />

                    <button type="submit" disabled={!input} style={{
                        width: '40px', height: '40px',
                        background: input ? 'var(--primary-600)' : 'var(--gray-100)',
                        color: input ? 'white' : 'var(--gray-400)', border: 'none', borderRadius: '12px',
                        cursor: input ? 'pointer' : 'default',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s'
                    }}><Send size={18} /></button>
                </form>
            </div>
        </div>
    );
};

export default Chat;
