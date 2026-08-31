import type { BunRequest } from 'bun';
import { RateLimiterMemory } from 'rate-limiter-flexible';

type RateLimitOptions = {
    points: number;
    duration: number;
};

const limiterCache = new Map<string, RateLimiterMemory>();

const getLimiter = ({ points, duration }: RateLimitOptions) => {
    const key = `${points}:${duration}`;
    const existing = limiterCache.get(key);
    if (existing) return existing;

    const limiter = new RateLimiterMemory({ points, duration });
    limiterCache.set(key, limiter);
    return limiter;
};

/**
 * X-Real-IP is the only header trusted here, and it is trustworthy because nginx overwrites it
 * unconditionally with `$remote_addr` — a value the client cannot influence.
 *
 * That it identifies the *visitor* rather than a Cloudflare edge is nginx's doing: `real_ip_header
 * CF-Connecting-IP` plus the `set_real_ip_from` list in nginx.conf resolves $remote_addr to the
 * real client, but only for connections that actually came from Cloudflare.
 *
 * Reading CF-Connecting-IP directly here, as this once did, was weaker: nginx forwards that header
 * verbatim, so anything reaching the origin without going through Cloudflare could set it freely
 * and mint a new bucket per request. Deferring to nginx means a forged header is discarded before
 * this code ever runs, and the origin firewall becomes a second line of defence, not the only one.
 *
 * X-Forwarded-For is deliberately not used. nginx sets it with `$proxy_add_x_forwarded_for`,
 * which appends the peer to whatever the client sent, so its first entry is attacker-controlled
 * — reading that entry, as this also once did, let anyone rotate the header per request for a
 * fresh bucket every time, i.e. no limit at all on OTP or login. Its last entry is trustworthy
 * but the real client's position depends on a hop count that changes if the proxy chain does.
 *
 * The backend must therefore sit behind this nginx. Reachable directly, it sees no X-Real-IP at
 * all and falls back to the shared bucket below.
 *
 * Falling back to one shared bucket rather than a per-request one is deliberate — if the headers
 * are ever missing, the failure should be over-limiting, never under-limiting.
 */
const getClientId = (req: BunRequest): string => {
    const realIp = req.headers.get('x-real-ip')?.trim();
    return realIp || 'unknown';
};

export const withRateLimit = (handler: Function, options: RateLimitOptions = { points: 80, duration: 60 }) => {
    const limiter = getLimiter(options);

    return async (req: BunRequest) => {
        const clientId = getClientId(req);
        const routeKey = `${req.method}:${new URL(req.url).pathname}:${clientId}`;

        try {
            await limiter.consume(routeKey);
            return await handler(req);
        } catch {
            return Response.json({ error: 'Too many requests' }, { status: 429 });
        }
    };
};
