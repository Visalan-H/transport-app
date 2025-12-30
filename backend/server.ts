import { authRoutes } from './routes/authRoutes';
import { locationRoutes } from './routes/locationRoutes';
import { handlePreflight, wrapRoutes } from './services/corsService';
import { startOtpCleanupJob } from './jobs/otpCleanup';

// Start background jobs
startOtpCleanupJob();

Bun.serve({
    port: Bun.env.PORT ? Number(Bun.env.PORT) : 3000,
    routes: {
        ...wrapRoutes(authRoutes),
        ...wrapRoutes(locationRoutes),
    },
    fetch(req) {
        if (req.method === 'OPTIONS') return handlePreflight();
        return new Response('Not Found', { status: 404 });
    },
});

console.log(`Server running at http://localhost:${Bun.env.PORT || 3000}`);
