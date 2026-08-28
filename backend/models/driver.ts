import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const drivers = pgTable('drivers', {
    id: serial('id').primaryKey(),
    username: text('username').notNull(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
