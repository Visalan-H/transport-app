import { db } from '../config/db';
import { allowedEmails } from '../models/allowedEmail';
import { eq } from 'drizzle-orm';

/**
 * Students who have paid for the transport facility. Being on this list is
 * what entitles an address to create an account and track a bus — it has
 * nothing to do with who administers the system (see config/admins.ts).
 * Addresses are stored and compared lowercased, so casing in how an address
 * was entered never causes a confusing "Email not authorized".
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

    /**
     * One insert for the whole batch rather than N round trips. Rows already
     * present are silently skipped (same onConflictDoNothing as add()) and
     * simply absent from the returned rows -- the caller diffs the input
     * against this to report what was actually new.
     */
    async addMany(emails: string[], addedBy: string) {
        if (emails.length === 0) return [];
        return db
            .insert(allowedEmails)
            .values(emails.map((email) => ({ email: email.toLowerCase(), addedBy })))
            .onConflictDoNothing()
            .returning();
    },
};
