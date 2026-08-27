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

    async delete(email: string) {
        await db.delete(drivers).where(eq(drivers.email, email));
    },
};
