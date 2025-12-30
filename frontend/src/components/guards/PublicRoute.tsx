import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner } from '../LoadingSpinner';
import { Navigate } from 'react-router-dom';

export default function PublicRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <LoadingSpinner text="Loading..." size="lg" />
            </div>
        );
    }

    if (user) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}
