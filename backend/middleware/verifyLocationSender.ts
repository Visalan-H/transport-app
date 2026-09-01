import type { BunRequest } from 'bun';
import { decodeBearer } from '../services/cookieService';

/**
 * Optional on purpose, and unset in production. There is no GPS hardware; the only sender that
 * cannot authenticate as a driver is `simulation/`, which posts for a hundred buses at once and so
 * could never hold a single driver's token. Leaving the variable unset removes the key path
 * entirely rather than leaving a static credential that can move any bus on the map.
 */
const SIM_API_KEY = Bun.env.SIM_API_KEY;

const isValidSimKey = (req: BunRequest): boolean => {
    if (!SIM_API_KEY) return false;
    return req.headers.get('x-api-key') === SIM_API_KEY;
};

/**
 * Auth for `POST /update`, the only route a driver's phone writes to.
 *
 * Bearer only, and only a driver token. A student's session cookie is signed with the same secret,
 * so a valid signature alone is not enough — the `role` claim is what separates a bus from a
 * passenger. Without that check any logged-in student could post a fake position for any bus.
 *
 * This used to live in the batcher, which sat in front of the backend on this path. The batcher is
 * gone; the check is not.
 */
export const verifyLocationSender = (handler: Function) => {
    return async (req: BunRequest) => {
        try {
            if (isValidSimKey(req)) return await handler(req);

            const driver = await decodeBearer(req);
            if (!driver || driver.role !== 'driver') {
                return new Response('Unauthorized', { status: 401 });
            }

            return await handler(req);
        } catch (error) {
            console.error('Location sender auth middleware error:', error);
            return new Response('Authentication failed', { status: 500 });
        }
    };
};
