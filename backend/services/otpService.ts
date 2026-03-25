import { db } from '../config/db';
import { otps } from '../models/otp';
import { eq, lte } from 'drizzle-orm';

const DEFAULT_OTP_EXPIRATION_MINUTES = 15;

const parseSqliteTimestamp = (value: string) => {
    // SQLite datetime('now') is typically YYYY-MM-DD HH:mm:ss (UTC-like), normalize to ISO.
    return Date.parse(`${value.replace(' ', 'T')}Z`);
};

export const isOtpExpired = (createdAt: string | null | undefined): boolean => {
    if (!createdAt) return true;

    const createdAtMs = parseSqliteTimestamp(createdAt);
    if (Number.isNaN(createdAtMs)) return true;

    const expirationMinutes = Number(Bun.env.OTP_EXPIRATION_MINUTES || DEFAULT_OTP_EXPIRATION_MINUTES);
    const expirationMs = expirationMinutes * 60 * 1000;

    return Date.now() - createdAtMs > expirationMs;
};

export const Otp = {
    async create(email: string, otpHash: string) {
        await db.delete(otps).where(eq(otps.email, email));
        await db.insert(otps).values({ email, otpHash });
    },

    async findByEmail(email: string) {
        const [otp] = await db.select().from(otps).where(eq(otps.email, email)).limit(1);
        return otp || null;
    },

    async delete(email: string) {
        await db.delete(otps).where(eq(otps.email, email));
    },

    async deleteExpired() {
        const expirationMinutes = Number(Bun.env.OTP_EXPIRATION_MINUTES);
        const expirationTime = new Date(Date.now() - expirationMinutes * 60 * 1000);

        await db.delete(otps).where(lte(otps.createdAt, expirationTime.toISOString()));
    },
};
