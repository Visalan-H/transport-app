import type { BunRequest } from 'bun';
import { z } from 'zod';

export async function validate<T extends z.ZodType>(schema: T, req: BunRequest) {
    const body = await req.json().catch(() => null);

    if (!body) {
        return {
            ok: false as const,
            response: Response.json({ success: false, error: 'Invalid request body' }, { status: 400 }),
        };
    }

    const result = schema.safeParse(body);

    if (!result.success) {
        const error = result.error.issues[0]?.message ?? 'Invalid request body';
        return { ok: false as const, response: Response.json({ success: false, error }, { status: 400 }) };
    }

    return { ok: true as const, data: result.data as z.infer<T> };
}
