import { handleSendOtp, handleRegister, handleLogin, handleGetMe, handleLogout } from '../controllers/authController';
import { withRateLimit } from '../middleware/rateLimiter';

export const authRoutes = {
    '/auth/send-otp': { POST: withRateLimit(handleSendOtp, { points: 5, duration: 300 }) },
    '/auth/register': { POST: withRateLimit(handleRegister, { points: 20, duration: 300 }) },
    '/auth/login': { POST: withRateLimit(handleLogin, { points: 10, duration: 300 }) },
    '/auth/me': { GET: handleGetMe },
    '/auth/logout': { POST: handleLogout },
};
