import type { BunRequest } from 'bun';
import { decodeBearer } from '../services/cookieService';

export const verifyDriver = (handler: Function) => {
    return async (req: BunRequest) => {
        try {
            const driver = await decodeBearer(req);

            if (!driver) {
                return Response.json({ success: false, error: 'Not authorized' }, { status: 401 });
            }

            return await handler(req);
        } catch (error) {
            console.error('Driver auth middleware error:', error);
            return Response.json({ success: false, error: 'Authentication failed' }, { status: 500 });
        }
    };
};
