import type { BusDetails, BusText } from '../types';

let buffer: BusText[] = [];

const INTERVAL = parseInt(Bun.env.INTERVAL || '5000');
const TARGET_URL = Bun.env.TARGET_URL || 'http://localhost:3000/update';
const BATCHER_PORT = parseInt(Bun.env.BATCHER_PORT || '4000');
let totalRequests = 0;

Bun.serve({
    port: BATCHER_PORT,

    routes: {
        '/update': {
            async POST(req: Request): Promise<Response> {
                const text = (await req.text()) as BusText;
                buffer.push(text);
                totalRequests++;
                console.log('So far got ' + totalRequests + ' requests');
                return new Response('OK');
            },
        },
        '/health': {
            async GET(req: Request): Promise<Response> {
                return new Response(
                    JSON.stringify({
                        status: 'OK',
                        buffer: buffer.length,
                        totalRequests,
                    }),
                );
            },
        },
    },
});

// batch + forward
setInterval(async () => {
    if (buffer.length === 0) return;

    const batch = [...buffer];
    buffer = [];

    const payload: BusDetails[] = batch.map((bus) => {
        const [id, lat, lng, timestamp] = bus.split(',').map(Number) as [number, number, number, number];
        return { id, lat, lng, timestamp };
    });

    try {
        await fetch(TARGET_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        console.log(`[BATCH] sent ${batch.length}`);
    } catch {
        // retry on failure
        buffer.unshift(...batch);
    }
}, INTERVAL);

console.log('Batcher running on http://localhost:' + BATCHER_PORT);
