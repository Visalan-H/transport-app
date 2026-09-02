import type { BunRequest } from 'bun';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env';

const SECRET = new TextEncoder().encode(env.JOSE_SECRET_KEY);
const MAX_AGE = env.SESSION_MAX_AGE;

const cookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: MAX_AGE,
};

/**
 * Student sessions and driver logins are both signed with JOSE_SECRET_KEY, so without a role claim
 * the two are byte-for-byte indistinguishable — and a student can read their own sessionToken out of
 * devtools and replay it as a driver Bearer token. The role is what lets /update tell a bus
 * broadcasting its position from a passenger watching one. Callers must state it; there is no
 * default, so a new call site cannot mint a driver token by omission.
 */
export type TokenRole = 'student' | 'driver';

export async function generateToken(userId: number, email: string, username: string, role: TokenRole): Promise<string> {
    return new SignJWT({ id: userId, email, username, role })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(`${MAX_AGE}s`)
        .sign(SECRET);
}

export async function generateAndSetCookie(req: BunRequest, userId: number, email: string, username: string) {
    const token = await generateToken(userId, email, username, 'student');
    req.cookies.set('sessionToken', token, cookieOptions);
}

export function clearCookie(req: BunRequest) {
    // Only path is passed: a cookie is identified by name/domain/path, so secure and sameSite play
    // no part in matching the one to expire, and Bun's delete options accordingly do not accept them.
    req.cookies.delete('sessionToken', { path: cookieOptions.path });
}

export async function decodeBearer(req: BunRequest) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);

    try {
        // Pinned rather than left to defaults: this is the one entry point a driver's phone
        // authenticates on, and every token this app mints is HS256.
        const { payload } = await jwtVerify(token, SECRET, { algorithms: ['HS256'] });
        return payload;
    } catch {
        return null;
    }
}

export async function decodeCookie(req: BunRequest) {
    const token = req.cookies.get('sessionToken');
    if (!token) return null;

    try {
        // Pinned for the same reason as decodeBearer: every token this app
        // mints, student or driver, is HS256, so there is nothing to gain from
        // leaving the algorithm to jose's defaults and a JWT "none"/alg-confusion
        // attempt to lose.
        const { payload } = await jwtVerify(token, SECRET, { algorithms: ['HS256'] });
        return payload;
    } catch {
        return null;
    }
}
