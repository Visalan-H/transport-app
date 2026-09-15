import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Home from './pages/Home';
import { Header } from './components/Header';
import ProtectedRoute from './components/guards/ProtectedRoute';
import PublicRoute from './components/guards/PublicRoute';
import AdminRoute from './components/guards/AdminRoute';
import { Loader2 } from 'lucide-react';

// Home is the landing route for a signed-in student and is kept eager so the
// map shows with no extra round trip. Everything else is split off the initial
// bundle: /login and /signup only matter before sign-in, and /admin is reached
// by a handful of people and carries its own on-demand spreadsheet reader.
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Admin = lazy(() => import('./pages/Admin'));

const PageFallback = () => (
    <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
);

function AppRoutes() {
    return (
        <div className="flex flex-col w-screen h-svh md:h-dvh overflow-hidden font-sans pb-[env(safe-area-inset-bottom)]">
            <Header />

            <Suspense fallback={<PageFallback />}>
                <Routes>
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                <Home />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/admin"
                        element={
                            <AdminRoute>
                                <Admin />
                            </AdminRoute>
                        }
                    />

                    <Route
                        path="/login"
                        element={
                            <PublicRoute>
                                <Login />
                            </PublicRoute>
                        }
                    />
                    <Route
                        path="/signup"
                        element={
                            <PublicRoute>
                                <Signup />
                            </PublicRoute>
                        }
                    />
                </Routes>
            </Suspense>
        </div>
    );
}

function App() {
    return (
        <AuthProvider>
            <AppRoutes />
        </AuthProvider>
    );
}

export default App;
