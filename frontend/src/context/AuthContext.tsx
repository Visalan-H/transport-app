import { useState, useEffect, type ReactNode } from 'react';
import api from '@/utils/axiosInstance';
import { AuthContext, type AuthResult, type RegisterPayload, type User } from '@/hooks/useAuth';
import { errorMessage, errorStatus } from '@/utils/errorMessage';

interface AuthResponse {
    success?: boolean;
    authenticated?: boolean;
    user?: User;
    error?: string;
    message?: string;
}

const fail = (err: unknown, fallback: string): AuthResult => ({
    ok: false,
    message: errorMessage(err, fallback),
    status: errorStatus(err),
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(() => {
        if (typeof window !== 'undefined') {
            const storedUser = localStorage.getItem('user:v1');
            if (storedUser) {
                try {
                    // isAdmin is user-editable in localStorage, so it's dropped here and
                    // only trusted once /auth/me (or login/register) confirms it server-side.
                    const parsed = JSON.parse(storedUser) as User;
                    return { ...parsed, isAdmin: false };
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

    const sendOtp = async (email: string): Promise<AuthResult> => {
        try {
            const res = await api.post<AuthResponse>('/auth/send-otp', { email });
            return { ok: res.status >= 200 && res.status < 300, message: res.data?.message };
        } catch (err) {
            return fail(err, "Couldn't send the code. Try again.");
        }
    };

    const requestAccess = async (email: string): Promise<AuthResult> => {
        try {
            const res = await api.post<AuthResponse>('/auth/request-access', { email });
            return { ok: res.status >= 200 && res.status < 300, message: res.data?.message };
        } catch (err) {
            return fail(err, "Couldn't send the request. Try again.");
        }
    };

    const login = async (email: string, password: string): Promise<AuthResult> => {
        try {
            const res = await api.post<AuthResponse>('/auth/login', { email, password });
            if (res.status >= 200 && res.status < 300 && res.data?.success) {
                setUser(res.data.user!);
                localStorage.setItem('user:v1', JSON.stringify(res.data.user));
                return { ok: true };
            }
            return { ok: false, message: res.data?.error || 'Login failed' };
        } catch (err) {
            return fail(err, 'Login failed. Try again.');
        }
    };

    const register = async (payload: RegisterPayload): Promise<AuthResult> => {
        try {
            const res = await api.post<AuthResponse>('/auth/register', payload);
            if (res.status >= 200 && res.status < 300 && res.data?.success) {
                setUser(res.data.user!);
                localStorage.setItem('user:v1', JSON.stringify(res.data.user));
                return { ok: true };
            }
            return { ok: false, message: res.data?.error || 'Registration failed' };
        } catch (err) {
            return fail(err, 'Registration failed. Try again.');
        }
    };

    const logout = async (): Promise<AuthResult> => {
        try {
            await api.post('/auth/logout');
            setUser(null);
            localStorage.removeItem('user:v1');
            return { ok: true };
        } catch (err) {
            setUser(null);
            localStorage.removeItem('user:v1');
            return fail(err, 'Sign-out failed. Try again.');
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, sendOtp, requestAccess, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}
