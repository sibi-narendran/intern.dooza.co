import { Link } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';

const AppLayout = ({ children }) => {
    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
            {children}
        </div>
    );
};

export default AppLayout;
