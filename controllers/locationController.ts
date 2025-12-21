import type { BunRequest } from 'bun';
import type { BusDetails } from '../types';

const busLocations = new Map<string, { lat: number; lng: number; timestamp: number }>();
const controllers = new Set<ReadableStreamDefaultController>();

let totalRequests = 0;

const startGlobalInterval = () => {
    setInterval(() => {
        const currentState: BusDetails[] = [];

        busLocations.forEach((loc, name) => {
            currentState.push({ name, lat: loc.lat, lng: loc.lng, timestamp: loc.timestamp });
        });

        const message = `data: ${JSON.stringify(currentState)}\n\n`;

        // Send to ALL connected clients
        for (const controller of Array.from(controllers)) {
            try {
                controller.enqueue(message);
            } catch (e) {
                console.log(e);
                controllers.delete(controller);
            }
        }
    }, 2000);
};

let intervalStarted = false;

export const handleUpdate = async (req: BunRequest) => {
    totalRequests++;
    const data = (await req.json()) as BusDetails | BusDetails[];
    const updates = Array.isArray(data) ? data : [data];

    for (const bus of updates) {
        if (
            bus.name &&
            typeof bus.lat === 'number' &&
            typeof bus.lng === 'number' &&
            typeof bus.timestamp === 'number'
        ) {
            const prev = busLocations.get(bus.name);
            if (!prev || bus.timestamp > prev.timestamp) {
                busLocations.set(bus.name, { lat: bus.lat, lng: bus.lng, timestamp: bus.timestamp });
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

                // Start global interval on first client
                if (!intervalStarted) {
                    startGlobalInterval();
                    intervalStarted = true;
                }

                signal.addEventListener('abort', () => {
                    controllers.delete(controller);
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
