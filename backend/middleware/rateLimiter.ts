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
 * Only headers our own nginx writes are trusted here.
 *
 * X-Real-IP is set with `proxy_set_header X-Real-IP $remote_addr`, which replaces whatever the
 * client sent, so it cannot be forged from outside. X-Forwarded-For is set with
 * `$proxy_add_x_forwarded_for`, which *appends* the real peer to the client's own value — the
 * last entry is nginx's, every earlier one is attacker-controlled. Reading the first entry, as
 * this used to, let anyone rotate `X-Forwarded-For: <anything>` per request and get a fresh
 * bucket every time, which is to say no rate limiting at all on OTP or login.
 *
 * Falling back to a single shared bucket rather than a per-request one is deliberate: if these
 * headers are ever missing the failure should be over-limiting, never under-limiting.
 */
const getClientId = (req: BunRequest): string => {
    const realIp = req.headers.get('x-real-ip')?.trim();
    if (realIp) return realIp;

    const forwarded = req.headers.get('x-forwarded-for');
    const lastHop = forwarded?.split(',').pop()?.trim();
    return lastHop || 'unknown';
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
