import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { LoadingSpinner } from '../LoadingSpinner';

type RouteGuardProps = {
    children: React.ReactNode;
};

/**
 * Convenience only — it keeps non-admins from seeing a broken page. The real
 * enforcement is verifyAdmin on the backend, which re-checks every request.
 * A signed-in non-admin goes home rather than to /login, since sending them to
 * a login form they are already past reads as a bug.
 */
export default function AdminRoute({ children }: RouteGuardProps) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <LoadingSpinner text="Loading..." size="lg" />
            </div>
        );
    }

    if (!user) return <Navigate to="/login" replace />;
    if (!user.isAdmin) return <Navigate to="/" replace />;

    return <>{children}</>;
}
