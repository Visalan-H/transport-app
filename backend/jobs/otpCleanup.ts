import { Otp } from '../services/otpService';
import { env } from '../config/env';

const CLEANUP_INTERVAL = env.OTP_EXPIRATION_MINUTES * 60 * 1000;

export function startOtpCleanupJob() {
    cleanupExpiredOtps();
    setInterval(cleanupExpiredOtps, CLEANUP_INTERVAL);
}

async function cleanupExpiredOtps() {
    try {
        await Otp.deleteExpired();
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error cleaning up expired OTPs:`, error);
    }
}
