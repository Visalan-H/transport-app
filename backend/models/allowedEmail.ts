import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const allowedEmails = pgTable('allowed_emails', {
    id: serial('id').primaryKey(),
    email: text('email').notNull().unique(),
    addedBy: text('added_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
