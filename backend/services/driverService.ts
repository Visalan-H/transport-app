import { db } from '../config/db';
import { drivers } from '../models/driver';
import { eq } from 'drizzle-orm';

export const Driver = {
    async findByEmail(email: string) {
        const [driver] = await db.select().from(drivers).where(eq(drivers.email, email)).limit(1);
        return driver || null;
    },

    async findById(id: number) {
        const [driver] = await db.select().from(drivers).where(eq(drivers.id, id)).limit(1);
        return driver || null;
    },

    async create(username: string, email: string, passwordHash: string) {
        const [driver] = await db.insert(drivers).values({ username, email, passwordHash }).returning();
        return driver;
    },

    async updatePassword(email: string, passwordHash: string) {
        const updated = await db.update(drivers).set({ passwordHash }).where(eq(drivers.email, email)).returning();
        return updated.length > 0;
    },

    /** Password hashes must never leave the server, so admin listings select explicitly. */
    async listSafe() {
        return db
            .select({
                id: drivers.id,
                username: drivers.username,
                email: drivers.email,
                createdAt: drivers.createdAt,
            })
            .from(drivers)
            .orderBy(drivers.username);
    },

    async delete(email: string) {
        const removed = await db.delete(drivers).where(eq(drivers.email, email)).returning();
        return removed.length > 0;
    },
};
