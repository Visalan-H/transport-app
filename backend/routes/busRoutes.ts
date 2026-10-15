import { handleListBuses } from '../controllers/busController';
import { withRateLimit } from '../middleware/rateLimiter';

/**
 * `GET /buses` -- the bus id -> name list, read by the website and the driver app.
 *
 * Public: route names are not secret, and the driver app fetches this before anyone has signed in.
 * Reached as /api/buses in production through its own nginx block, which strips the /api prefix.
 *
 * The limit is per IP and every page load calls this, so like /auth/me it has to carry a whole
 * campus behind one NAT address. It is a flood guard, not a quota.
 */
export const busRoutes = {
    '/buses': { GET: withRateLimit(handleListBuses, { points: 600, duration: 60 }) },
};
