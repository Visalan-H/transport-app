import type { BusDetails } from '../types';

let buffer: BusDetails[] = [];

const BATCH_INTERVAL = 5000;
const TARGET_URL = 'http://localhost:3000/update';
let totalRequests = 0;

Bun.serve({
    port: 4000,

    routes: {
        '/update': {
            async POST(req: Request): Promise<Response> {
                const data = (await req.json()) as BusDetails;
                buffer.push(data);
                totalRequests++;
                console.log('So far got ' + totalRequests + ' requests');
                return new Response('OK');
            },
        },
    },
});

// batch + forward
setInterval(async () => {
    if (buffer.length === 0) return;

    const batch: BusDetails[] = [...buffer];
    buffer = [];

    try {
        await fetch(TARGET_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(batch),
        });

        console.log(`[BATCH] sent ${batch.length}`);
    } catch {
        // retry on failure
        buffer.unshift(...batch);
    }
}, BATCH_INTERVAL);

console.log('Batcher running on http://localhost:4000');
