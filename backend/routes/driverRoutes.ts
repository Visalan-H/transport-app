import { handleDriverLogin, handleDriverGetMe } from '../controllers/driverController';
import { verifyDriver } from '../middleware/verifyDriver';
import { withRateLimit } from '../middleware/rateLimiter';

export const driverRoutes = {
    '/driver/login': { POST: withRateLimit(handleDriverLogin, { points: 10, duration: 300 }) },
    '/driver/me': { GET: verifyDriver(handleDriverGetMe) },
};
