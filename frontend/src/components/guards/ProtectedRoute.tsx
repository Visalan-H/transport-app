import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { LoadingSpinner } from '../LoadingSpinner';

type RouteGuardProps = {
    children: React.ReactNode;
};

export default function ProtectedRoute({ children }: RouteGuardProps) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <LoadingSpinner text="Loading..." size="lg" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}
