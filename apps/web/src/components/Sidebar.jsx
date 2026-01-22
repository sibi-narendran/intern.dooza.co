import { Link, useLocation } from 'react-router-dom';
import { Home, Puzzle, Brain, Users, Settings } from 'lucide-react';
import logo from '../assets/logo.png';
import UserMenuCompact from './UserMenuCompact';

/**
 * Collapsed icon-only sidebar (60px width)
 * Shows navigation icons with tooltips on hover
 */
const Sidebar = () => {
    const location = useLocation();

    const isActive = (path) => location.pathname === path;
    const isActivePrefix = (prefix) => location.pathname.startsWith(prefix);

    const navItems = [
        { path: '/', icon: Home, label: 'Home', exact: true },
        { path: '/integrations', icon: Puzzle, label: 'Integrations' },
        { path: '/knowledge', icon: Brain, label: 'Brain' },
        { path: '/gallery', icon: Users, label: 'Workforce Gallery' },
    ];

    return (
        <aside className="sidebar-collapsed">
            {/* Logo */}
            <Link to="/" className="sidebar-collapsed__logo" title="Dooza Workforce">
                <img src={logo} alt="Dooza" />
            </Link>

            {/* Navigation */}
            <nav className="sidebar-collapsed__nav">
                {navItems.map(({ path, icon: Icon, label, exact }) => {
                    const active = exact ? isActive(path) : isActivePrefix(path);
                    return (
                        <Link
                            key={path}
                            to={path}
                            className={`sidebar-collapsed__item ${active ? 'sidebar-collapsed__item--active' : ''}`}
                            title={label}
                        >
                            <Icon size={20} />
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom section */}
            <div className="sidebar-collapsed__bottom">
                <Link
                    to="/settings"
                    className={`sidebar-collapsed__item ${isActivePrefix('/settings') ? 'sidebar-collapsed__item--active' : ''}`}
                    title="Settings"
                >
                    <Settings size={20} />
                </Link>
                <UserMenuCompact />
            </div>
        </aside>
    );
};

export default Sidebar;
