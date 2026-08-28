import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '@/utils/axiosInstance';

interface User {
    id: string;
    username: string;
    email: string;
    // Derived server-side from ADMIN_EMAILS on every auth response, so it
    // reflects current config rather than whatever was true at signup. Gates UI
    // only — every admin route re-checks it server-side.
    isAdmin?: boolean;
}

interface AuthContextValue {
    user: User | null;
    loading: boolean;
    sendOtp: (email: string) => Promise<{ ok: boolean; message?: string }>;
    login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
    register: (
        username: string,
        email: string,
        password: string,
        otp: string,
    ) => Promise<{ ok: boolean; message?: string }>;
    logout: () => Promise<{ ok: boolean; message?: string }>;
}

interface AuthResponse {
    success?: boolean;
    authenticated?: boolean;
    user?: User;
    error?: string;
    message?: string;
}

interface ApiError {
    status?: number;
    data?: AuthResponse;
    message?: string;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const getErrMessage = (err: ApiError, fallback: string): string => err?.data?.error ?? err?.message ?? fallback;

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(() => {
        if (typeof window !== 'undefined') {
            const storedUser = localStorage.getItem('user:v1');
            if (storedUser) {
                try {
                    return JSON.parse(storedUser) as User;
                } catch {
                    localStorage.removeItem('user:v1');
                }
            }
        }
        return null;
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get<AuthResponse>('/auth/me')
            .then((res) => {
                if (res.data?.authenticated && res.data.user) {
                    setUser(res.data.user);
                    localStorage.setItem('user:v1', JSON.stringify(res.data.user));
                } else {
                    setUser(null);
                    localStorage.removeItem('user:v1');
                }
            })
            .catch(() => {
                setUser(null);
                localStorage.removeItem('user:v1');
            })
            .finally(() => setLoading(false));
    }, []);

    const sendOtp = async (email: string): Promise<{ ok: boolean; message?: string }> => {
        try {
            const res = await api.post<AuthResponse>('/auth/send-otp', { email });
            return { ok: res.status >= 200 && res.status < 300, message: res.data?.message };
        } catch (err) {
            return { ok: false, message: getErrMessage(err as ApiError, 'Network error') };
        }
    };

    const login = async (email: string, password: string): Promise<{ ok: boolean; message?: string }> => {
        try {
            const res = await api.post<AuthResponse>('/auth/login', { email, password });
            if (res.status >= 200 && res.status < 300 && res.data?.success) {
                setUser(res.data.user!);
                localStorage.setItem('user:v1', JSON.stringify(res.data.user));
                return { ok: true };
            }
            return { ok: false, message: res.data?.error || 'Login failed' };
        } catch (err) {
            return { ok: false, message: getErrMessage(err as ApiError, 'Login failed') };
        }
    };

    const register = async (
        username: string,
        email: string,
        password: string,
        otp: string,
    ): Promise<{ ok: boolean; message?: string }> => {
        try {
            const res = await api.post<AuthResponse>('/auth/register', { username, email, password, otp });
            if (res.status >= 200 && res.status < 300 && res.data?.success) {
                setUser(res.data.user!);
                localStorage.setItem('user:v1', JSON.stringify(res.data.user));
                return { ok: true };
            }
            return { ok: false, message: res.data?.error || 'Registration failed' };
        } catch (err) {
            return { ok: false, message: getErrMessage(err as ApiError, 'Registration failed') };
        }
    };

    const logout = async (): Promise<{ ok: boolean; message?: string }> => {
        try {
            await api.post('/auth/logout');
            setUser(null);
            localStorage.removeItem('user:v1');
            return { ok: true };
        } catch (err) {
            setUser(null);
            localStorage.removeItem('user:v1');
            return { ok: false, message: getErrMessage(err as ApiError, 'Network error') };
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, sendOtp, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}
