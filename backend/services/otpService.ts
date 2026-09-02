import { db } from '../config/db';
import { otps } from '../models/otp';
import { eq, lte } from 'drizzle-orm';
import { env } from '../config/env';

// The single definition of how long an OTP lives. This was one of three, alongside sendOtp (which
// tells the user the number) and otpCleanup (which deletes on it) -- all agreeing only because their
// defaults happened to match, so changing one would have quietly made the email advertise an expiry
// the server did not enforce.
const expirationMs = () => env.OTP_EXPIRATION_MINUTES * 60 * 1000;

export const isOtpExpired = (createdAt: Date | null | undefined): boolean => {
    if (!createdAt) return true;

    const createdAtMs = createdAt.getTime();
    if (Number.isNaN(createdAtMs)) return true;

    return Date.now() - createdAtMs > expirationMs();
};

export const Otp = {
    // One statement, not delete-then-insert. Two round trips to a hosted
    // Postgres cost real latency, and between them a concurrent resend could
    // leave two rows for one email -- after which findByEmail's unordered
    // limit(1) could hand back the stale code and reject the one just emailed.
    // createdAt is reset explicitly, otherwise a resend would inherit the
    // original row's timestamp and expire on the old schedule.
    async create(email: string, otpHash: string) {
        await db
            .insert(otps)
            .values({ email: email.toLowerCase(), otpHash })
            .onConflictDoUpdate({ target: otps.email, set: { otpHash, createdAt: new Date() } });
    },

    async findByEmail(email: string) {
        const [otp] = await db.select().from(otps).where(eq(otps.email, email.toLowerCase())).limit(1);
        return otp || null;
    },

    async delete(email: string) {
        await db.delete(otps).where(eq(otps.email, email.toLowerCase()));
    },

    async deleteExpired() {
        // created_at is a real timestamp column, so this is a timestamp
        // comparison. It used to be TEXT compared against an ISO string, which
        // differed in format ('2026-01-01 10:00:00' vs '2026-01-01T10:00:00Z')
        // and so compared as strings byte by byte -- the space sorts before the
        // 'T', making every OTP from the current day look expired and deleting
        // valid codes out from under people mid-signup.
        const cutoff = new Date(Date.now() - expirationMs());
        await db.delete(otps).where(lte(otps.createdAt, cutoff));
    },
};
