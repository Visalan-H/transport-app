import type { BunRequest } from 'bun';

const UPDATE_API_KEY = Bun.env.UPDATE_API_KEY;

export const verifyUpdateApiKey = (handler: Function) => {
    return async (req: BunRequest) => {
        if (!UPDATE_API_KEY) {
            return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
        }

        const providedApiKey = req.headers.get('x-update-api-key');
        if (!providedApiKey || providedApiKey !== UPDATE_API_KEY) {
            return Response.json({ error: 'Not authorized' }, { status: 401 });
        }

        return await handler(req);
    };
};