import type { BunRequest } from 'bun';
import { decodeCookie } from '../services/cookieService';
import { isAdmin } from '../config/admins';

/**
 * Admin routes sit behind the normal user session cookie, then additionally
 * require the session's email to be in ADMIN_EMAILS. A non-admin gets 403
 * rather than 401 — they are authenticated, just not permitted, and the
 * frontend distinguishes the two.
 */
export const verifyAdmin = (handler: Function) => {
    return async (req: BunRequest) => {
        try {
            const user = await decodeCookie(req);

            if (!user) {
                return Response.json({ success: false, error: 'Not authorized' }, { status: 401 });
            }

            if (!isAdmin(user.email as string)) {
                return Response.json({ success: false, error: 'Admin access required' }, { status: 403 });
            }

            return await handler(req);
        } catch (error) {
            console.error('Admin auth middleware error:', error);
            return Response.json({ success: false, error: 'Authentication failed' }, { status: 500 });
        }
    };
};
