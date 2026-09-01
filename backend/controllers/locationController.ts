import type { BunRequest } from 'bun';
import type { BusDetails } from '../../types';
import { parseBusText } from '../utils/validations';
import { createLog } from '../utils/log';

const busLocations = new Map<number, { lat: number; lng: number; timestamp: number }>();
const controllers = new Set<ReadableStreamDefaultController>();

let totalRequests = 0;

const SSE_INTERVAL = parseInt(Bun.env.SSE_INTERVAL || '5000');

const log = createLog('backend/location');

let intervalId: ReturnType<typeof setInterval> | null = null;

const startGlobalInterval = () => {
    if (intervalId) return; // Already running

    intervalId = setInterval(() => {
        const currentState: BusDetails[] = [];

        busLocations.forEach((loc, id) => {
            currentState.push({ id, lat: loc.lat, lng: loc.lng, timestamp: loc.timestamp });
        });

        const message = `data: ${JSON.stringify(currentState)}\n\n`;

        for (const controller of Array.from(controllers)) {
            try {
                controller.enqueue(message);
            } catch (e) {
                // console.log(e);
                controllers.delete(controller);
            }
        }
    }, SSE_INTERVAL);

    log('info', 'sse_interval_started', { intervalMs: SSE_INTERVAL });
};

const stopGlobalInterval = () => {
    if (intervalId && controllers.size === 0) {
        clearInterval(intervalId);
        intervalId = null;
        log('info', 'sse_interval_stopped', { reason: 'no_clients' });
    }
};

/**
 * `POST /update` — one location fix from one driver, as plain text.
 *
 * Drivers post here directly. This used to go through the batcher, which buffered updates and
 * flushed them as a JSON array every few seconds; that added up to 5s of latency to a live map for
 * no benefit, since the work being batched is a single Map write. The batcher was removed and its
 * ingest contract — plain-text body, driver Bearer JWT — moved here unchanged, so the driver app
 * did not need rebuilding.
 */
export const handleUpdate = async (req: BunRequest) => {
    totalRequests++;

    // A body that is not readable at all is a 400, not an unhandled throw turning into a 500.
    let text: string;
    try {
        text = await req.text();
    } catch {
        log('warn', 'update_rejected_bad_request', { reason: 'unreadable_body' });
        return new Response('Bad Request', { status: 400 });
    }

    const bus = parseBusText(text);
    if (!bus) {
        log('warn', 'update_rejected_bad_request', { reason: 'invalid_payload' });
        return new Response('Bad Request', { status: 400 });
    }

    // Newest wins. An out-of-order arrival must never move a bus backwards.
    const prev = busLocations.get(bus.id);
    if (!prev || bus.timestamp > prev.timestamp) {
        busLocations.set(bus.id, { lat: bus.lat, lng: bus.lng, timestamp: bus.timestamp });
    }

    if (totalRequests % 200 === 0) {
        log('debug', 'update_checkpoint', {
            totalRequests,
            trackedBuses: busLocations.size,
            activeStreamClients: controllers.size,
        });
    }

    return new Response('OK');
};

export const handleStream = (req: BunRequest) => {
    const signal = req.signal;
    return new Response(
        new ReadableStream({
            start: (controller) => {
                controllers.add(controller);
                startGlobalInterval();
                log('info', 'sse_client_connected', { activeClients: controllers.size });

                signal.addEventListener('abort', () => {
                    controllers.delete(controller);
                    stopGlobalInterval();
                    log('info', 'sse_client_disconnected', { activeClients: controllers.size });
                    try {
                        controller.close();
                    } catch {}
                });
            },
        }),
        {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        },
    );
};
