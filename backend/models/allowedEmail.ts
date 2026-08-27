import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const allowedEmails = sqliteTable('allowed_emails', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull().unique(),
    addedBy: text('added_by'),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
});
