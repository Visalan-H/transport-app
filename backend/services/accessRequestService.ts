import { db } from '../config/db';
import { accessRequests } from '../models/accessRequest';
import { eq } from 'drizzle-orm';

/**
 * The pending "let me in" queue. Distinct from allowed_emails on purpose:
 * being here grants nothing, it only surfaces the address for an admin to
 * approve. Approval is what inserts into allowed_emails.
 */
export const AccessRequest = {
    async list() {
        return db.select().from(accessRequests).orderBy(accessRequests.createdAt);
    },

    /** Queue an address. Already-queued is a no-op (returns null), so a student
     *  tapping "request access" twice never errors or stacks duplicates. */
    async add(email: string) {
        const [row] = await db
            .insert(accessRequests)
            .values({ email: email.toLowerCase() })
            .onConflictDoNothing()
            .returning();
        return row ?? null;
    },

    async remove(email: string) {
        const removed = await db
            .delete(accessRequests)
            .where(eq(accessRequests.email, email.toLowerCase()))
            .returning();
        return removed.length > 0;
    },
};
