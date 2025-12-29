import { handleStream, handleUpdate } from './controllers/locationController';
import { handleSendOtp, handleRegister, handleLogin, handleGetMe, handleLogout } from './controllers/authController';
import { serveIndex } from './controllers/mainController';

const SERVER_PORT = parseInt(Bun.env.SERVER_PORT || '3000');

Bun.serve({
    port: SERVER_PORT,
    routes: {
        '/': serveIndex,
        '/stream': handleStream,
        '/update': {
            POST: handleUpdate,
        },
        '/auth/send-otp': {
            POST: handleSendOtp,
        },
        '/auth/register': {
            POST: handleRegister,
        },
        '/auth/login': {
            POST: handleLogin,
        },
        '/auth/me': {
            GET: handleGetMe,
        },
        '/auth/logout': {
            POST: handleLogout,
        },
    },
    fetch() {
        return new Response('Not Found', { status: 404 });
    },
});

console.log('Server running successfully at http://localhost:' + SERVER_PORT);
