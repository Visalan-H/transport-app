import type { BunRequest } from 'bun';
import type { BusDetails } from '../../types';
import { parseBusText } from '../utils/validations';
import { createLog } from '../utils/log';

const busLocations = new Map<number, { lat: number; lng: number; timestamp: number }>();
const controllers = new Set<ReadableStreamDefaultController>();

let totalRequests = 0;

const SSE_INTERVAL = parseInt(Bun.env.SSE_INTERVAL || '5000');

/**
 * How long a bus stays in the snapshot after its last fix.
 *
 * Nothing used to remove a bus once it stopped broadcasting, so a driver who closed the app, lost
 * signal or simply finished their route left a marker on the map until the next backend restart.
 * They accumulate: every test run and every completed route adds one more.
 *
 * An hour is deliberately far longer than the 30s after which the map already greys a bus out
 * (STALE_AFTER_MS in the frontend, Config.staleAfter in the driver app). Staleness is therefore
 * communicated long before eviction, and this only clears markers nobody could mistake for live.
 * Eviction is the cleanup, not the warning — which is why it can afford to be slow, and why it
 * must never be short enough to delete a bus that is merely in a tunnel.
 */
const EVICT_AFTER = parseInt(Bun.env.BUS_EVICT_AFTER_MS || '3600000');

const log = createLog('backend/location');

let intervalId: ReturnType<typeof setInterval> | null = null;

const startGlobalInterval = () => {
    if (intervalId) return; // Already running

    intervalId = setInterval(() => {
        const currentState: BusDetails[] = [];
        const cutoff = Date.now() - EVICT_AFTER;
        let evicted = 0;

        // Swept here rather than on a timer of its own: this is the only place the whole map is
        // already being walked, and a bus nobody is watching costs nothing to leave in memory.
        // Deleting the current key mid-forEach is well defined for a Map.
        busLocations.forEach((loc, id) => {
            if (loc.timestamp < cutoff) {
                busLocations.delete(id);
                evicted++;
                return;
            }
            currentState.push({ id, lat: loc.lat, lng: loc.lng, timestamp: loc.timestamp });
        });

        if (evicted > 0) {
            log('info', 'buses_evicted', { evicted, evictAfterMs: EVICT_AFTER, trackedBuses: busLocations.size });
        }

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
