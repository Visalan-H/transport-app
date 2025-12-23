import { handleStream, handleUpdate } from './controllers/locationController';
import { serveIndex } from './controllers/mainController';

const SERVER_PORT = parseInt(Bun.env.SERVER_PORT || '3000');

Bun.serve({
    port: SERVER_PORT,
    // idleTimeout: 255,
    routes: {
        '/': serveIndex,
        '/stream': handleStream,
        '/update': {
            POST: handleUpdate,
        },
    },
    fetch() {
        return new Response('Not Found', { status: 404 });
    },
});

console.log('Server running successfully at http://localhost:' + SERVER_PORT);
