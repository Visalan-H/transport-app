import type { BunRequest } from 'bun';
import { env } from '../config/env';
import { createLog } from '../utils/log';

const log = createLog('backend');

const raw = env.ALLOWED_ORIGINS;
const ALLOWED_ORIGINS = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const baseCorsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    Vary: 'Origin',
};

const resolveAllowedOrigin = (req: Request): string | null => {
    const requestOrigin = req.headers.get('origin');

    if (ALLOWED_ORIGINS.includes('*')) {
        return requestOrigin || '*';
    }

    if (!requestOrigin) {
        return ALLOWED_ORIGINS[0] || null;
    }

    return ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : null;
};

const applyCorsHeaders = (req: Request, headers: Headers) => {
    const allowedOrigin = resolveAllowedOrigin(req);
    if (allowedOrigin) {
        headers.set('Access-Control-Allow-Origin', allowedOrigin);
    }

    Object.entries(baseCorsHeaders).forEach(([key, value]) => headers.set(key, value));
};

/**
 * A route is either one handler for every method, or a map of method to handler -- the two shapes
 * Bun.serve accepts, and the reason wrapRoutes has to branch on typeof below.
 */
type RouteHandler = (req: BunRequest) => Response | Promise<Response>;
type MethodHandlers = Record<string, RouteHandler>;
type RouteTable = Record<string, RouteHandler | MethodHandlers>;

// Drizzle's error message is the whole query plus its parameters -- emails, in the auth routes -- so
// the log takes the underlying driver error instead, and only its first line.
const describe = (error: unknown): string => {
    const root = error instanceof Error && error.cause instanceof Error ? error.cause : error;
    return root instanceof Error ? (root.message.split('\n')[0] ?? '') : String(root);
};

/**
 * Also the one place a route's unexpected error is caught. The middleware used to catch it each on
 * its own and relabel it -- the rate limiter as 429 "Too many requests", the auth wrappers as
 * "Authentication failed" -- so a database outage told students to slow down or log in again. Here
 * it is a plain 500, logged with the path, and it still carries CORS headers so the browser lets
 * the frontend read the error instead of reporting a CORS failure.
 */
export const withCors =
    (handler: RouteHandler): RouteHandler =>
    async (req) => {
        let res: Response;
        try {
            res = await handler(req);
        } catch (error) {
            log('warn', 'route_error', {
                method: req.method,
                path: new URL(req.url).pathname,
                error: describe(error),
            });
            res = Response.json({ success: false, error: 'Something went wrong. Try again.' }, { status: 500 });
        }
        applyCorsHeaders(req, res.headers);
        return res;
    };

export const wrapRoutes = (routes: RouteTable): RouteTable => {
    const wrapped: RouteTable = {};
    for (const [path, handler] of Object.entries(routes)) {
        wrapped[path] =
            typeof handler === 'function'
                ? withCors(handler)
                : Object.fromEntries(Object.entries(handler).map(([method, h]) => [method, withCors(h)]));
    }
    return wrapped;
};

export const handlePreflight = (req: Request) => {
    const allowedOrigin = resolveAllowedOrigin(req);
    const requestOrigin = req.headers.get('origin');

    if (requestOrigin && !allowedOrigin) {
        return Response.json({ error: 'Origin not allowed' }, { status: 403, headers: { Vary: 'Origin' } });
    }

    const headers = new Headers();
    applyCorsHeaders(req, headers);

    return new Response(null, { status: 204, headers });
};
