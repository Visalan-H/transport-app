import { db } from '../config/db';
import { otps } from '../models/otp';
import { eq, sql } from 'drizzle-orm';

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
        await db.delete(otps).where(sql`${otps.createdAt} < datetime('now', '-10 minutes')`);
    },
};
