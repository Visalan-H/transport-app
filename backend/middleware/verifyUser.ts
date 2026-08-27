import type { BunRequest } from 'bun';
import { decodeCookie } from '../services/cookieService';

export const verifyUser = (handler: Function) => {
    return async (req: BunRequest) => {
        try {
            const user = await decodeCookie(req);

            if (!user) {
                return Response.json({ success: false, error: 'Not authorized' }, { status: 401 });
            }

            return await handler(req);
        } catch (error) {
            console.error('Auth middleware error:', error);
            return Response.json({ success: false, error: 'Authentication failed' }, { status: 500 });
        }
    };
};
