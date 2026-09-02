import type { BunRequest } from 'bun';

const raw = Bun.env.ALLOWED_ORIGINS;
if (!raw) throw new Error('ALLOWED_ORIGINS env var is not set');
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

export const withCors =
    (handler: RouteHandler): RouteHandler =>
    async (req) => {
        const res = await handler(req);
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
