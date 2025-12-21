import type { BunRequest } from 'bun';

const busLocations = new Map<string, { lat: number; lng: number }>();
const controllers = new Set<ReadableStreamDefaultController>();

interface BusUpdate {
    name: string;
    lat: number;
    lng: number;
}

export const handleUpdate = async (req: BunRequest) => {
    const data = (await req.json()) as BusUpdate | BusUpdate[];

    const updates = Array.isArray(data) ? data : [data];

    for (const bus of updates) {
        if (bus.name && typeof bus.lat === 'number' && typeof bus.lng === 'number') {
            busLocations.set(bus.name, { lat: bus.lat, lng: bus.lng });
        }
    }

    return new Response('OK');
};

export const handleStream = (req: BunRequest) => {
    const signal = req.signal;
    return new Response(
        new ReadableStream({
            start: (controller) => {
                controllers.add(controller);

                const interval = setInterval(() => {
                    const currentState = Array.from(busLocations.entries()).map(([name, loc]) => ({
                        name: name,
                        lat: loc.lat,
                        lng: loc.lng,
                    }));
                    const message = `data: ${JSON.stringify(currentState)}\n\n`;

                    try {
                        controller.enqueue(message);
                    } catch (e) {
                        clearInterval(interval);
                        controllers.delete(controller);
                    }
                }, 2000);

                signal.addEventListener('abort', () => {
                    clearInterval(interval);
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
