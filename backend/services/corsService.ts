const CORS_ORIGIN = Bun.env.CORS_ORIGIN || 'http://localhost:5173';

export const corsHeaders = {
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    Vary: 'Origin',
};

export const withCors = (handler: any) => async (req: Request) => {
    const res = await handler(req);
    Object.entries(corsHeaders).forEach(([k, v]) => res.headers.set(k, v));
    return res;
};

export const wrapRoutes = (routes: Record<string, any>) => {
    const wrapped: Record<string, any> = {};
    for (const [path, handler] of Object.entries(routes)) {
        wrapped[path] =
            typeof handler === 'function'
                ? withCors(handler)
                : Object.fromEntries(Object.entries(handler).map(([m, h]) => [m, withCors(h)]));
    }
    return wrapped;
};

export const handlePreflight = () => new Response(null, { status: 204, headers: corsHeaders });
