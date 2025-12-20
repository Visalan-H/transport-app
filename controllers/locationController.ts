import { redis, RedisClient, type BunRequest } from 'bun';

const controllers = new Set<ReadableStreamDefaultController>();
const pubClient = new RedisClient();
const subClient = await redis.duplicate();

await pubClient.connect();
await subClient.connect();

const streamHeaders = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
};

await subClient.subscribe('bus_updates', (msg) => {
    const data = `data: ${msg}\n\n`;
    for (const controller of controllers) {
        try {
            controller.enqueue(data);
        } catch (e) {
            controllers.delete(controller);
        }
    }
});

export const handleStream = (req: BunRequest) => {
    const signal = req.signal;
    return new Response(
        new ReadableStream({
            start: (controller) => {
                controllers.add(controller);
                signal.addEventListener('abort', () => {
                    controllers.delete(controller);
                    try {
                        controller.close();
                    } catch (e) {}
                });
            },
        }),
        { headers: streamHeaders },
    );
};

export const handleUpdate = async (req: BunRequest) => {
    const data = await req.json();
    await pubClient.publish('bus_updates', JSON.stringify(data));
    return new Response('Update Received');
};
