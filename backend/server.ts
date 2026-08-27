import { authRoutes } from './routes/authRoutes';
import { locationRoutes } from './routes/locationRoutes';
import { driverRoutes } from './routes/driverRoutes';
import { adminRoutes } from './routes/adminRoutes';
import { handlePreflight, wrapRoutes } from './services/corsService';
import { startOtpCleanupJob } from './jobs/otpCleanup';

// Start background jobs
startOtpCleanupJob();

Bun.serve({
    port: Number(Bun.env.SERVER_PORT || 3000),
    routes: {
        ...wrapRoutes(authRoutes),
        ...wrapRoutes(locationRoutes),
        ...wrapRoutes(driverRoutes),
        ...wrapRoutes(adminRoutes),
    },
    fetch(req) {
        if (req.method === 'OPTIONS') return handlePreflight(req);
        return new Response('Not Found', { status: 404 });
    },
});

console.log(`Server running at http://localhost:${Bun.env.SERVER_PORT || 3000}`);
