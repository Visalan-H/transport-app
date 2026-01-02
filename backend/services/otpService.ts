import { db } from '../config/db';
import { otps } from '../models/otp';
import { eq, lte } from 'drizzle-orm';

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
