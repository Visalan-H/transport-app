import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

/** Uniqueness is case-insensitive, via the `buses_name_lower_key` index on lower(name) in config/db.ts. */
export const buses = pgTable('buses', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
