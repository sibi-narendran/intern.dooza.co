import UserMenu from './UserMenu';

const Navbar = () => {
    return (
        <header className="navbar">
            <div className="navbar__left">
                {/* Space for breadcrumbs or page title if needed */}
            </div>
            
            <div className="navbar__right">
                <UserMenu />
            </div>
        </header>
    );
};

export default Navbar;
