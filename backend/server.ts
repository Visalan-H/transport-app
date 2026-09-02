import { authRoutes } from './routes/authRoutes';
import { locationRoutes } from './routes/locationRoutes';
import { driverRoutes } from './routes/driverRoutes';
import { adminRoutes } from './routes/adminRoutes';
import { healthRoutes } from './routes/healthRoutes';
import { handlePreflight, wrapRoutes } from './services/corsService';
import { startOtpCleanupJob } from './jobs/otpCleanup';
import { env } from './config/env';

// Start background jobs
startOtpCleanupJob();

Bun.serve({
    port: env.SERVER_PORT,
    routes: {
        ...wrapRoutes(authRoutes),
        ...wrapRoutes(locationRoutes),
        ...wrapRoutes(driverRoutes),
        ...wrapRoutes(adminRoutes),
        ...wrapRoutes(healthRoutes),
    },
    fetch(req) {
        if (req.method === 'OPTIONS') return handlePreflight(req);
        return new Response('Not Found', { status: 404 });
    },
});

console.log(`Server running at http://localhost:${env.SERVER_PORT}`);
