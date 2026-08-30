import { createContext, useContext } from 'react';

// The context object and its hook live here rather than beside AuthProvider so that
// AuthContext.tsx exports nothing but the component — a module mixing the two loses
// Fast Refresh, which is what react-refresh/only-export-components is guarding.

export interface User {
    id: string;
    username: string;
    email: string;
    // Derived server-side from ADMIN_EMAILS on every auth response, so it
    // reflects current config rather than whatever was true at signup. Gates UI
    // only — every admin route re-checks it server-side.
    isAdmin?: boolean;
}

export interface AuthContextValue {
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

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}
