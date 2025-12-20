import { handleStream, handleUpdate } from './controllers/locationController';
import { serveIndex } from './controllers/mainController';

Bun.serve({
    port: 3000,
    idleTimeout: 255,
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

console.log('Server running successfully at http://localhost:3000');
