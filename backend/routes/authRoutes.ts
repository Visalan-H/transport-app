import { handleSendOtp, handleRegister, handleLogin, handleGetMe, handleLogout } from '../controllers/authController';
import { withRateLimit } from '../middleware/rateLimiter';

export const authRoutes = {
    '/auth/send-otp': { POST: withRateLimit(handleSendOtp) },
    '/auth/register': { POST: withRateLimit(handleRegister) },
    '/auth/login': { POST: withRateLimit(handleLogin) },
    '/auth/me': { GET: handleGetMe },
    '/auth/logout': { POST: handleLogout },
};
