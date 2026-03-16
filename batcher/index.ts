import type { BusDetails, BusText } from '../types';
import { jwtVerify } from 'jose';

type SourceRecord = { source: 'gps' | 'driver'; lastSeen: number };

const buffer: BusText[] = [];
const sourceMap = new Map<string, SourceRecord>();

const INTERVAL = parseInt(Bun.env.INTERVAL || '5000');
const TARGET_URL = Bun.env.TARGET_URL || 'http://localhost:3000/update';
const BATCHER_PORT = parseInt(Bun.env.BATCHER_PORT || '4000');
const GPS_API_KEY = Bun.env.GPS_API_KEY!;
const JOSE_SECRET_KEY = Bun.env.JOSE_SECRET_KEY!;
const GPS_PRIORITY_WINDOW = 2 * 60 * 1000;

let totalRequests = 0;

if (!GPS_API_KEY) throw new Error('GPS_API_KEY is not set');
if (!JOSE_SECRET_KEY) throw new Error('JOSE_SECRET_KEY is not set');

const JWT_SECRET = new TextEncoder().encode(JOSE_SECRET_KEY);

// ── Auth helpers ────────────────────────────────────────────────

const isValidGpsKey = (req: Request): boolean => {
    return req.headers.get('x-api-key') === GPS_API_KEY;
};

const isValidDriverJwt = async (req: Request): Promise<boolean> => {
    try {
        const cookie = req.headers.get('cookie') ?? '';
        const token = cookie
            .split(';')
            .find(c => c.trim().startsWith('sessionToken='))
            ?.split('=')[1]
            ?.trim();

        if (!token) return false;

        await jwtVerify(token, JWT_SECRET, { algorithms: ['HS256'] });
        return true;
    } catch {
        return false;
    }
};

// ── Priority logic ──────────────────────────────────────────────

const isDriverBlocked = (busId: string): boolean => {
    const record = sourceMap.get(busId);
    if (!record) return false;
    if (record.source !== 'gps') return false;
    return Date.now() - record.lastSeen < GPS_PRIORITY_WINDOW;
};

// ── Server ──────────────────────────────────────────────────────

Bun.serve({
    port: BATCHER_PORT,

    routes: {
        '/update': {
            async POST(req: Request): Promise<Response> {
                const gpsAuth = isValidGpsKey(req);
                const driverAuth = gpsAuth ? false : await isValidDriverJwt(req);

                if (!gpsAuth && !driverAuth) {
                    return new Response('Unauthorized', { status: 401 });
                }

                const source = gpsAuth ? 'gps' : 'driver';
                const text = (await req.text()) as BusText;
                const busId = text.split(',')[0];

                if(!busId) return new Response('Bad Request', { status: 400 });

                if (source === 'driver' && isDriverBlocked(busId)) {
                    console.log(`[PRIORITY] dropped driver update for bus ${busId} — GPS is active`);
                    return new Response('OK');
                }

                sourceMap.set(busId, { source, lastSeen: Date.now() });
                buffer.push(text);
                totalRequests++;

                console.log(`[UPDATE] source=${source} bus=${busId} total=${totalRequests}`);
                return new Response('OK');
            },
        },

        '/health': {
            GET(): Response {
                return new Response(
                    JSON.stringify({
                        status: 'OK',
                        buffer: buffer.length,
                        totalRequests,
                        activeSources: Object.fromEntries(sourceMap),
                    }),
                );
            },
        },
    },
});

// ── Batch flush ─────────────────────────────────────────────────

setInterval(async () => {
    if (buffer.length === 0) return;

    const batch = [...buffer];
    buffer.length = 0;

    const payload: BusDetails[] = batch.map(bus => {
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
        buffer.unshift(...batch);
        console.log(`[BATCH] failed, requeued ${batch.length}`);
    }
}, INTERVAL);

console.log(`Batcher running on http://localhost:${BATCHER_PORT}`);