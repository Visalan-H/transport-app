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
 *
 * `/api/buses` is the same handler for local dev, where the driver app talks to the backend with no
 * nginx in front to strip the prefix. Without it the app's fetch 404s and it quietly falls back to
 * its bundled list, which hides any bus added on /admin. In production nginx never forwards that
 * path, so it is unreachable there.
 */
const listBuses = { GET: withRateLimit(handleListBuses, { points: 600, duration: 60 }) };

export const busRoutes = {
    '/buses': listBuses,
    '/api/buses': listBuses,
};
