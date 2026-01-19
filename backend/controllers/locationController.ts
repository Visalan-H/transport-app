import type { BunRequest } from 'bun';
import type { BusDetails } from '../../types';
import { isBus } from '../utils/validations';

const busLocations = new Map<number, { lat: number; lng: number; timestamp: number }>();
const controllers = new Set<ReadableStreamDefaultController>();

let totalRequests = 0;

const SSE_INTERVAL = parseInt(Bun.env.INTERVAL || '5000');

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
                console.log(e);
                controllers.delete(controller);
            }
        }
    }, SSE_INTERVAL);

    console.log('[SSE] Interval started');
};

const stopGlobalInterval = () => {
    if (intervalId && controllers.size === 0) {
        clearInterval(intervalId);
        intervalId = null;
        console.log('[SSE] Interval stopped - no clients connected');
    }
};

export const handleUpdate = async (req: BunRequest) => {
    totalRequests++;
    const data = (await req.json()) as BusDetails | BusDetails[];
    const updates = Array.isArray(data) ? data : [data];

    for (const bus of updates) {
        if (bus && isBus(bus)) {
            const prev = busLocations.get(bus.id);
            if (!prev || bus.timestamp > prev.timestamp) {
                busLocations.set(bus.id, { lat: bus.lat, lng: bus.lng, timestamp: bus.timestamp });
            }
        }
    }
    console.log('So far got ' + totalRequests + ' requests');

    return new Response('OK');
};

export const handleStream = (req: BunRequest) => {
    const signal = req.signal;
    return new Response(
        new ReadableStream({
            start: (controller) => {
                controllers.add(controller);
                startGlobalInterval();

                signal.addEventListener('abort', () => {
                    controllers.delete(controller);
                    stopGlobalInterval();
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
                'Access-Control-Allow-Origin': '*',
            },
        },
    );
};
