import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const otps = sqliteTable('otps', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull(),
    otpHash: text('otp_hash').notNull(),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
});
