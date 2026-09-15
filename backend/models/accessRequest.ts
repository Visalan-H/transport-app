import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * People who asked to be let in but are not on the allowlist yet. An admin
 * approves a row (which moves the address to allowed_emails and emails them a
 * signup link) or rejects it. Stored and compared lowercased, like every other
 * email table.
 */
export const accessRequests = pgTable('access_requests', {
    id: serial('id').primaryKey(),
    email: text('email').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
