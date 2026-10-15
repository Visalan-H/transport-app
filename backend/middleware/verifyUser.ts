import type { BunRequest } from 'bun';
import { decodeCookie } from '../services/cookieService';

export const verifyUser = (handler: Function) => {
    return async (req: BunRequest) => {
        // No try here: decodeCookie returns null rather than throwing, so a catch around this could
        // only ever catch the handler's own errors and mislabel them "Authentication failed".
        // Handler errors are caught once for every route in corsService's withCors.
        const user = await decodeCookie(req);

        if (!user) {
            return Response.json({ success: false, error: 'Not authorized' }, { status: 401 });
        }

        return handler(req);
    };
};
