import type { BusDetails, BusText } from '../types';
import { jwtVerify } from 'jose';

type SourceRecord = { source: 'gps' | 'driver'; lastSeen: number };
type LogLevel = 'info' | 'debug' | 'warn' | 'error';

const buffer: BusText[] = [];
const sourceMap = new Map<string, SourceRecord>();

const INTERVAL = parseInt(Bun.env.INTERVAL || '5000');
const TARGET_URL = Bun.env.TARGET_URL || 'http://localhost:3000/update';
const BATCHER_PORT = parseInt(Bun.env.BATCHER_PORT || '4000');
const GPS_API_KEY = Bun.env.GPS_API_KEY!;
const JOSE_SECRET_KEY = Bun.env.JOSE_SECRET_KEY!;
const UPDATE_API_KEY = Bun.env.UPDATE_API_KEY!;
const GPS_PRIORITY_WINDOW = 2 * 60 * 1000;
const LOG_LEVEL = (Bun.env.LOG_LEVEL || 'info').toLowerCase();
const DEBUG_ENABLED = LOG_LEVEL === 'debug';

let totalRequests = 0;

if (!GPS_API_KEY) throw new Error('GPS_API_KEY is not set');
if (!JOSE_SECRET_KEY) throw new Error('JOSE_SECRET_KEY is not set');
if (!UPDATE_API_KEY) throw new Error('UPDATE_API_KEY is not set');

const JWT_SECRET = new TextEncoder().encode(JOSE_SECRET_KEY);

const log = (level: LogLevel, event: string, meta?: Record<string, unknown>) => {
    if (level === 'debug' && !DEBUG_ENABLED) return;

    const timestamp = new Date().toISOString();
    const payload = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    const output = `[${timestamp}] [batcher] [${level.toUpperCase()}] ${event}${payload}`;

    if (level === 'error' || level === 'warn') {
        console.error(output);
        return;
    }

    console.log(output);
};

// ── Auth helpers ────────────────────────────────────────────────

const isValidGpsKey = (req: Request): boolean => {
    return req.headers.get('x-api-key') === GPS_API_KEY;
};

const isValidDriverJwt = async (req: Request): Promise<boolean> => {
    try {
        let token: string | undefined;

        // 1. Check Authorization: Bearer header (for native/mobile app)
        const authHeader = req.headers.get('authorization');
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.slice(7);
        }

        // 2. Fall back to session cookie (for web app)
        if (!token) {
            const cookie = req.headers.get('cookie') ?? '';
            token = cookie
                .split(';')
                .find((c) => c.trim().startsWith('sessionToken='))
                ?.split('=')[1]
                ?.trim();
        }

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
                    log('warn', 'update_rejected_unauthorized');
                    return new Response('Unauthorized', { status: 401 });
                }

                const source = gpsAuth ? 'gps' : 'driver';
                const text = (await req.text()) as BusText;
                const busId = text.split(',')[0];

                if (!busId) {
                    log('warn', 'update_rejected_bad_request', { reason: 'missing_bus_id' });
                    return new Response('Bad Request', { status: 400 });
                }

                if (source === 'driver' && isDriverBlocked(busId)) {
                    log('debug', 'driver_update_dropped_due_to_gps_priority', { busId });
                    return new Response('OK');
                }

                sourceMap.set(busId, { source, lastSeen: Date.now() });
                buffer.push(text);
                totalRequests++;

                if (totalRequests % 200 === 0) {
                    log('debug', 'update_checkpoint', {
                        totalRequests,
                        source,
                        bufferSize: buffer.length,
                        trackedSources: sourceMap.size,
                    });
                }
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

    const payload: BusDetails[] = batch.map((bus) => {
        const [id, lat, lng, timestamp] = bus.split(',').map(Number) as [number, number, number, number];
        return { id, lat, lng, timestamp };
    });

    try {
        await fetch(TARGET_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-update-api-key': UPDATE_API_KEY,
            },
            body: JSON.stringify(payload),
        });
        log('info', 'batch_forwarded', { size: batch.length, remainingBuffer: buffer.length });
    } catch {
        buffer.unshift(...batch);
        log('warn', 'batch_forward_failed_requeued', { size: batch.length, bufferSize: buffer.length });
    }
}, INTERVAL);

log('info', 'service_started', { port: BATCHER_PORT, intervalMs: INTERVAL, targetUrl: TARGET_URL });
