import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const otps = pgTable('otps', {
    id: serial('id').primaryKey(),
    email: text('email').notNull(),
    otpHash: text('otp_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
