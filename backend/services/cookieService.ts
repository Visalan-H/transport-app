import type { BunRequest } from 'bun';
import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(Bun.env.JOSE_SECRET_KEY);
const MAX_AGE = parseInt(Bun.env.SESSION_MAX_AGE || '604800');

const cookieOptions = {
    httpOnly: true,
    secure: Bun.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: MAX_AGE,
};

export async function generateToken(userId: number, email: string, username: string): Promise<string> {
    return new SignJWT({ id: userId, email, username })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(`${MAX_AGE}s`)
        .sign(SECRET);
}

export async function generateAndSetCookie(req: BunRequest, userId: number, email: string, username: string) {
    const token = await generateToken(userId, email, username);
    req.cookies.set('sessionToken', token, cookieOptions);
}

export function clearCookie(req: BunRequest) {
    req.cookies.delete('sessionToken', {
        path: cookieOptions.path,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
    });
}

export async function decodeBearer(req: BunRequest) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);

    try {
        const { payload } = await jwtVerify(token, SECRET);
        return payload;
    } catch {
        return null;
    }
}

export async function decodeCookie(req: BunRequest) {
    const token = req.cookies.get('sessionToken');
    if (!token) return null;

    try {
        const { payload } = await jwtVerify(token, SECRET);
        return payload;
    } catch {
        return null;
    }
}
