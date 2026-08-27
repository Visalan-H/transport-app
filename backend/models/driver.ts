import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const drivers = sqliteTable('drivers', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    username: text('username').notNull(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
});
