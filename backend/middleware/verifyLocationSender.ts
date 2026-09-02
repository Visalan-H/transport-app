import type { BunRequest } from 'bun';
import { decodeBearer } from '../services/cookieService';
import { createLog } from '../utils/log';
import { env } from '../config/env';

/**
 * Optional on purpose, and unset in production. There is no GPS hardware; the only sender that
 * cannot authenticate as a driver is `simulation/`, which posts for a hundred buses at once and so
 * could never hold a single driver's token. Leaving the variable unset removes the key path
 * entirely rather than leaving a static credential that can move any bus on the map.
 */
const SIM_API_KEY = env.SIM_API_KEY;

const log = createLog('backend/location');

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
                // Logged because the sender cannot see why it failed: the driver app treats any
                // 401 as "token dead" and signs out, and sim.ts never inspects the status at all.
                // Without this line an expired token or a key mismatch is silent on both ends.
                log('warn', 'update_rejected_unauthorized', { reason: driver ? 'not_a_driver' : 'no_valid_token' });
                return new Response('Unauthorized', { status: 401 });
            }

            return await handler(req);
        } catch (error) {
            console.error('Location sender auth middleware error:', error);
            return new Response('Authentication failed', { status: 500 });
        }
    };
};
