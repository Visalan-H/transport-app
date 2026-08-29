import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const otps = pgTable('otps', {
    id: serial('id').primaryKey(),
    // Unique so a resend can upsert in one statement rather than delete+insert;
    // one live OTP per email is the intended state anyway.
    email: text('email').notNull().unique(),
    otpHash: text('otp_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
