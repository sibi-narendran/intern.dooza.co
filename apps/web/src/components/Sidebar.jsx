import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid, Plug, BookOpen, Building2, User, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';

const Sidebar = () => {
    const location = useLocation();
    const { currentOrg } = useAuth();
    const [expandedSections, setExpandedSections] = useState({
        integrations: true,
        knowledgeBase: true
    });

    const isActive = (path) => location.pathname === path;
    const isActivePrefix = (prefix) => location.pathname.startsWith(prefix);

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const NavLink = ({ to, icon: Icon, children, indent = false }) => (
        <Link to={to} style={{
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
            padding: indent ? '6px 12px 6px 36px' : '8px 12px', 
            borderRadius: '8px', 
            textDecoration: 'none',
            marginBottom: '2px',
            background: isActive(to) ? 'white' : 'transparent',
            color: isActive(to) ? 'var(--primary-700)' : 'var(--gray-600)',
            boxShadow: isActive(to) ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            fontWeight: isActive(to) ? '600' : '500',
            fontSize: indent ? '13px' : '14px',
            transition: 'all 0.1s'
        }}>
            {Icon && <Icon size={indent ? 16 : 18} />}
            <span>{children}</span>
        </Link>
    );

    const SectionHeader = ({ title, section, icon: Icon }) => (
        <button
            onClick={() => toggleSection(section)}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '8px',
                marginBottom: '4px',
                transition: 'background 0.1s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-100)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Icon size={18} style={{ color: 'var(--gray-500)' }} />
                <span style={{ 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    color: 'var(--gray-700)' 
                }}>
                    {title}
                </span>
            </div>
            {expandedSections[section] ? (
                <ChevronDown size={16} style={{ color: 'var(--gray-400)' }} />
            ) : (
                <ChevronRight size={16} style={{ color: 'var(--gray-400)' }} />
            )}
        </button>
    );

    const SubNavItem = ({ to, icon: Icon, children }) => (
        <Link to={to} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px 6px 40px',
            borderRadius: '6px',
            textDecoration: 'none',
            marginBottom: '1px',
            background: isActive(to) ? 'var(--primary-50)' : 'transparent',
            color: isActive(to) ? 'var(--primary-700)' : 'var(--gray-600)',
            fontSize: '13px',
            fontWeight: isActive(to) ? '600' : '500',
            transition: 'all 0.1s'
        }}
        onMouseEnter={(e) => {
            if (!isActive(to)) e.currentTarget.style.background = 'var(--gray-50)';
        }}
        onMouseLeave={(e) => {
            if (!isActive(to)) e.currentTarget.style.background = 'transparent';
        }}
        >
            <Icon size={14} style={{ color: isActive(to) ? 'var(--primary-600)' : 'var(--gray-400)' }} />
            <span>{children}</span>
        </Link>
    );

    return (
        <aside className="app-shell__sidebar" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
            {/* Brand */}
            <div style={{ marginBottom: '32px', paddingLeft: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src={logo} alt="Dooza Logo" style={{ width: '28px', height: '28px' }} />
                <span style={{ fontWeight: '700', fontSize: '18px' }}>Dooza <span style={{ color: 'var(--primary-600)' }}>Workforce</span></span>
            </div>

            {/* Main Nav */}
            <nav style={{ flex: 1, overflowY: 'auto' }}>
                {/* Workspace Section */}
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

                <NavLink to="/" icon={LayoutGrid}>Dashboard</NavLink>

                {/* Integrations Section */}
                <div style={{ marginTop: '24px' }}>
                    <SectionHeader title="Integrations" section="integrations" icon={Plug} />
                    
                    {expandedSections.integrations && (
                        <div style={{ marginLeft: '0px' }}>
                            <SubNavItem to="/integrations/organization" icon={Building2}>
                                {currentOrg?.name || 'Organization'}
                            </SubNavItem>
                            <SubNavItem to="/integrations/personal" icon={User}>
                                Personal
                            </SubNavItem>
                        </div>
                    )}
                </div>

                {/* Knowledge Base Section */}
                <div style={{ marginTop: '16px' }}>
                    <SectionHeader title="Knowledge Base" section="knowledgeBase" icon={BookOpen} />
                    
                    {expandedSections.knowledgeBase && (
                        <div style={{ marginLeft: '0px' }}>
                            <SubNavItem to="/knowledge/organization" icon={Building2}>
                                {currentOrg?.name || 'Organization'}
                            </SubNavItem>
                            <SubNavItem to="/knowledge/personal" icon={User}>
                                Personal
                            </SubNavItem>
                        </div>
                    )}
                </div>
            </nav>

            {/* Organization indicator at bottom */}
            {currentOrg && (
                <div style={{
                    marginTop: 'auto',
                    paddingTop: '16px',
                    borderTop: '1px solid var(--border-color)'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        background: 'var(--gray-50)',
                        borderRadius: '8px'
                    }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, var(--primary-500), var(--primary-600))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: '600'
                        }}>
                            {currentOrg.name?.charAt(0).toUpperCase() || 'O'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                fontSize: '13px',
                                fontWeight: '600',
                                color: 'var(--gray-800)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}>
                                {currentOrg.name}
                            </div>
                            <div style={{
                                fontSize: '11px',
                                color: 'var(--gray-500)',
                                textTransform: 'capitalize'
                            }}>
                                {currentOrg.role || 'Owner'}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
};

export default Sidebar;
