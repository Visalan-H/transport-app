import { handleSendOtp, handleRegister, handleLogin, handleGetMe, handleLogout } from '../controllers/authController';
import { withRateLimit } from '../middleware/rateLimiter';

/**
 * These limits are keyed on client IP, and a campus behind one NAT address is one IP -- so every
 * number here is shared by every student on that wifi at once, not granted to each of them. The old
 * values (5 OTP, 10 logins per 5 min) were sized as if per person: the sixth student to request a
 * code during registration got a 429, with nothing to tell them why.
 *
 * Raising them is a blunt fix and worth naming as such. The right one is keying OTP and login on the
 * submitted email rather than the IP, since spamming one address and brute-forcing one account are
 * the abuses that actually matter, and neither is what a shared NAT looks like. That needs the body
 * parsed before the limiter runs, so it is a real change rather than a number swap.
 */
export const authRoutes = {
    '/auth/send-otp': { POST: withRateLimit(handleSendOtp, { points: 60, duration: 300 }) },
    '/auth/register': { POST: withRateLimit(handleRegister, { points: 100, duration: 300 }) },
    '/auth/login': { POST: withRateLimit(handleLogin, { points: 100, duration: 300 }) },
    '/auth/me': { GET: handleGetMe },
    '/auth/logout': { POST: handleLogout },
};
