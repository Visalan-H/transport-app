import { db } from '../config/db';
import { allowedEmails } from '../models/allowedEmail';
import { eq } from 'drizzle-orm';

/**
 * The signup allowlist. Addresses are stored and compared lowercased, so
 * casing in an invite never causes a confusing "Email not authorized".
 */
export const AllowedEmail = {
    async list() {
        return db.select().from(allowedEmails).orderBy(allowedEmails.email);
    },

    async has(email: string) {
        const [row] = await db
            .select()
            .from(allowedEmails)
            .where(eq(allowedEmails.email, email.toLowerCase()))
            .limit(1);
        return Boolean(row);
    },

    async add(email: string, addedBy: string) {
        const [row] = await db
            .insert(allowedEmails)
            .values({ email: email.toLowerCase(), addedBy })
            .onConflictDoNothing()
            .returning();
        // Undefined when the address was already present — the caller reports
        // that as a no-op rather than an error, so re-adding is harmless.
        return row ?? null;
    },

    async remove(email: string) {
        const removed = await db.delete(allowedEmails).where(eq(allowedEmails.email, email.toLowerCase())).returning();
        return removed.length > 0;
    },
};
