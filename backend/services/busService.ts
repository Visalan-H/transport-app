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

type BusRow = { id: number; name: string };

// Every map load and every driver app start reads the list, and only an admin add or rename changes
// it. Holding it here keeps Neon out of the map's path: viewing the map touched no database before
// this table existed, and a sleeping Neon should not turn route names into bare numbers. There is one
// backend instance, so clearing the cache on write is enough. `version` stops a read that started
// before a write from storing the list as it was before that write.
let cache: BusRow[] | null = null;
let version = 0;

const invalidate = () => {
    cache = null;
    version++;
};

/**
 * There is deliberately no delete. A driver who still has a removed id selected would keep
 * broadcasting it, and every map would show a marker with no name.
 */
export const Bus = {
    async list(): Promise<BusRow[]> {
        if (cache) return cache;
        const started = version;
        const rows = await db
            .select({ id: buses.id, name: buses.name })
            .from(buses)
            .orderBy(sql`lower(${buses.name})`);
        if (started === version) cache = rows;
        return rows;
    },

    /** Returns 'duplicate' when another bus already has this name, ignoring case. */
    async create(name: string) {
        try {
            const [bus] = await db.insert(buses).values({ name }).returning({ id: buses.id, name: buses.name });
            invalidate();
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
            if (bus) invalidate();
            return bus ?? null;
        } catch (error) {
            if (isUniqueViolation(error)) return 'duplicate' as const;
            throw error;
        }
    },
};
