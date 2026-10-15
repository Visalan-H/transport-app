import { db } from '../config/db';
import { buses } from '../models/bus';
import { eq, sql } from 'drizzle-orm';

// Postgres unique_violation. The lower(name) index is the duplicate check, not a preceding lookup,
// so two admins adding the same name at once cannot both succeed.
const UNIQUE_VIOLATION = '23505';

// Drizzle wraps driver errors in a DrizzleQueryError whose cause holds the postgres error, so the
// code is looked for on both.
const isUniqueViolation = (error: unknown): boolean => {
    const codeOf = (e: unknown) => (typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined);
    return codeOf(error) === UNIQUE_VIOLATION || codeOf((error as { cause?: unknown })?.cause) === UNIQUE_VIOLATION;
};

/**
 * There is deliberately no delete. A driver who still has a removed id selected would keep
 * broadcasting it, and every map would show a marker with no name.
 */
export const Bus = {
    async list() {
        return db
            .select({ id: buses.id, name: buses.name })
            .from(buses)
            .orderBy(sql`lower(${buses.name})`);
    },

    /** Returns 'duplicate' when another bus already has this name, ignoring case. */
    async create(name: string) {
        try {
            const [bus] = await db.insert(buses).values({ name }).returning({ id: buses.id, name: buses.name });
            return bus!;
        } catch (error) {
            if (isUniqueViolation(error)) return 'duplicate' as const;
            throw error;
        }
    },

    /** Returns null for an unknown id and 'duplicate' when another bus already has the name. */
    async rename(id: number, name: string) {
        try {
            const [bus] = await db
                .update(buses)
                .set({ name })
                .where(eq(buses.id, id))
                .returning({ id: buses.id, name: buses.name });
            return bus ?? null;
        } catch (error) {
            if (isUniqueViolation(error)) return 'duplicate' as const;
            throw error;
        }
    },
};
