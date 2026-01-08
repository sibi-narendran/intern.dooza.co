import UserMenu from './UserMenu';

const Navbar = () => {
    return (
        <header style={{
            height: '64px',
            background: 'white',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 24px',
            flexShrink: 0
        }}>
            <div style={{ width: '200px' }}>
                <UserMenu />
            </div>
        </header>
    );
};

export default Navbar;
