import { db } from '../config/db';
import { users } from '../models/user';
import { eq } from 'drizzle-orm';

export const User = {
    async findByEmail(email: string) {
        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        return user || null;
    },

    async findById(id: number) {
        const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
        return user || null;
    },

    async create(username: string, email: string, passwordHash: string) {
        const [user] = await db.insert(users).values({ username, email, passwordHash }).returning();
        return user;
    },

    async updatePassword(email: string, newPasswordHash: string) {
        await db.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.email, email));
    },

    async delete(email: string) {
        await db.delete(users).where(eq(users.email, email));
    },
};
