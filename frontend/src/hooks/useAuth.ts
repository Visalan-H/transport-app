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

/** Mirrors the backend's registerSchema: prove the address with an OTP or an invite token. */
export type RegisterPayload =
    | { method: 'otp'; username: string; email: string; password: string; otp: string }
    | { method: 'invite'; username: string; password: string; inviteToken: string };

/** `status` is the HTTP status of a failed request, so callers can branch without matching on message text. */
export interface AuthResult {
    ok: boolean;
    message?: string;
    status?: number;
}

export interface AuthContextValue {
    user: User | null;
    loading: boolean;
    sendOtp: (email: string) => Promise<AuthResult>;
    requestAccess: (email: string) => Promise<AuthResult>;
    login: (email: string, password: string) => Promise<AuthResult>;
    register: (payload: RegisterPayload) => Promise<AuthResult>;
    logout: () => Promise<AuthResult>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}
