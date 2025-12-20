import type { BunRequest } from 'bun';

export const serveIndex = async (req: BunRequest) => {
    return new Response(Bun.file('index.html'), { headers: { 'Content-Type': 'text/html' } });
};
