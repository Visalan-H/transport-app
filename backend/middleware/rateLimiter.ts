import type { BunRequest } from 'bun';
import { RateLimiterMemory } from 'rate-limiter-flexible';

const limiter = new RateLimiterMemory({
    points: 5,
    duration: 60,
});

export const withRateLimit = (handler: Function) => {
    return async (req: BunRequest) => {
        const ip = req.headers.get('x-forwarded-for') || 'unknown';
        try {
            await limiter.consume(ip);
            return await handler(req);
        } catch {
            return Response.json({ error: 'Too many requests' }, { status: 429 });
        }
    };
};
