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
 * Only headers written by a proxy we control are trusted here, and the order matters.
 *
 * Cloudflare proxies this origin, so it sets CF-Connecting-IP to the real client and overwrites
 * any value the client tried to send. That is the only header carrying per-user granularity:
 * nginx's X-Real-IP is `$remote_addr`, which behind Cloudflare is the *edge* address, so keying
 * on it would lump everyone behind one edge into a single bucket.
 *
 * X-Forwarded-For is deliberately not used. nginx sets it with `$proxy_add_x_forwarded_for`,
 * which appends the peer to whatever the client sent, so its first entry is attacker-controlled
 * — reading that entry, as this once did, let anyone rotate the header per request for a fresh
 * bucket every time, i.e. no limit at all on OTP or login. Its last entry is trustworthy but is
 * only the edge, and the real client's position depends on a hop count that changes if the proxy
 * chain does.
 *
 * This holds only while the origin cannot be reached directly: anything that bypasses Cloudflare
 * can forge CF-Connecting-IP freely. The origin firewall must therefore accept traffic only from
 * Cloudflare's ranges (or the origin should be published solely through a tunnel).
 *
 * Falling back to one shared bucket rather than a per-request one is deliberate — if the headers
 * are ever missing, the failure should be over-limiting, never under-limiting.
 */
const getClientId = (req: BunRequest): string => {
    const cfIp = req.headers.get('cf-connecting-ip')?.trim();
    if (cfIp) return cfIp;

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
