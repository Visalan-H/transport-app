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

const getClientId = (req: BunRequest): string => {
    const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const cfIp = req.headers.get('cf-connecting-ip')?.trim();
    const realIp = req.headers.get('x-real-ip')?.trim();
    return forwarded ?? cfIp ?? realIp ?? 'unknown';
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
