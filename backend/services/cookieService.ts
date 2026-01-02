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

export async function generateAndSetCookie(req: BunRequest, userId: number, email: string, username: string) {
    const token = await new SignJWT({ id: userId, email, username })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(`${MAX_AGE}s`)
        .sign(SECRET);

    req.cookies.set('sessionToken', token, cookieOptions);
}

export function clearCookie(req: BunRequest) {
    req.cookies.delete('sessionToken');
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
