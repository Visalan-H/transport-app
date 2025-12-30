import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import axios, { isAxiosError } from 'axios';

interface User {
    id: string;
    username: string;
    email: string;
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

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
    withCredentials: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(() => {
        if (typeof window !== 'undefined') {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                try {
                    return JSON.parse(storedUser);
                } catch {
                    localStorage.removeItem('user');
                }
            }
        }
        return null;
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/auth/me')
            .then((res) => {
                const data = res.data;
                if (data?.authenticated && data.user) {
                    setUser(data.user);
                    localStorage.setItem('user', JSON.stringify(data.user));
                } else {
                    setUser(null);
                    localStorage.removeItem('user');
                }
            })
            .catch(() => {
                setUser(null);
                localStorage.removeItem('user');
            })
            .finally(() => setLoading(false));
    }, []);

    const sendOtp = async (email: string): Promise<{ ok: boolean; message?: string }> => {
        try {
            const res = await api.post('/auth/send-otp', { email });
            return { ok: res.status >= 200 && res.status < 300, message: res.data?.message };
        } catch (err) {
            console.log(err);
            if (isAxiosError(err)) {
                return { ok: false, message: err.response?.data?.error || err.message };
            }
            return { ok: false, message: 'Network error' };
        }
    };

    const login = async (email: string, password: string): Promise<{ ok: boolean; message?: string }> => {
        try {
            const res = await api.post('/auth/login', { email, password });
            const data = res.data || {};
            if (res.status >= 200 && res.status < 300 && data.success) {
                setUser(data.user);
                localStorage.setItem('user', JSON.stringify(data.user));
                return { ok: true };
            }
            return { ok: false, message: data.error || 'Login failed' };
        } catch (err) {
            if (isAxiosError(err)) {
                return { ok: false, message: err.response?.data?.error || 'Login failed' };
            }
            return { ok: false, message: 'Network error' };
        }
    };

    const register = async (
        username: string,
        email: string,
        password: string,
        otp: string,
    ): Promise<{ ok: boolean; message?: string }> => {
        try {
            console.log(username, email, password, otp);
            const res = await api.post('/auth/register', { username, email, password, otp });
            const data = res.data || {};
            if (res.status >= 200 && res.status < 300 && data.success) {
                setUser(data.user);
                localStorage.setItem('user', JSON.stringify(data.user));
                return { ok: true };
            }
            return { ok: false, message: data.error || 'Registration failed' };
        } catch (err) {
            if (isAxiosError(err)) {
                return { ok: false, message: err.response?.data?.error || 'Registration failed' };
            }
            return { ok: false, message: 'Network error' };
        }
    };

    const logout = async (): Promise<{ ok: boolean; message?: string }> => {
        try {
            await api.post('/auth/logout');
            setUser(null);
            localStorage.removeItem('user');
            return { ok: true };
        } catch (err) {
            setUser(null);
            localStorage.removeItem('user');
            if (isAxiosError(err)) {
                return { ok: false, message: err.response?.data?.error || 'Network error' };
            }
            return { ok: false, message: 'Network error' };
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
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
