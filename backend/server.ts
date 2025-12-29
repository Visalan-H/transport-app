import { serveIndex } from './controllers/mainController';
import { authRoutes } from './routes/authRoutes';
import { locationRoutes } from './routes/locationRoutes';

const SERVER_PORT = parseInt(Bun.env.SERVER_PORT || '3000');

Bun.serve({
    port: SERVER_PORT,
    routes: {
        '/': serveIndex,
        ...authRoutes,
        ...locationRoutes,
    },
    fetch() {
        return new Response('Not Found', { status: 404 });
    },
});

console.log('Server running successfully at http://localhost:' + SERVER_PORT);
