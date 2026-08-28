/**
 * One-shot copy of the old SQLite database into Postgres.
 *
 * Password hashes are moved verbatim, so everyone keeps their existing
 * password -- Bun.password.verify reads the algorithm from the hash prefix, so
 * both the older bcrypt rows and the newer argon2id ones keep working.
 *
 * Safe to re-run: every insert is ON CONFLICT DO NOTHING, so rows already in
 * Postgres are left untouched rather than duplicated or overwritten.
 *
 * Run from backend/, which is where NEON_POSTGRES_URI is picked up from .env:
 *   cd backend && bun scripts/migrate-sqlite-to-postgres.ts
 *
 * Against the server's database, copy polaris.db down first and point
 * SQLITE_PATH at it. The deployed image has no bun on it, so this is a
 * run-it-from-your-machine script:
 *   scp -i ~/polaris-key.pem azureuser@<host>:~/polaris/backend/db/polaris.db /tmp/prod.db
 *   cd backend && SQLITE_PATH=/tmp/prod.db bun scripts/migrate-sqlite-to-postgres.ts
 */
import { Database } from 'bun:sqlite';
// config/db.ts creates the tables as a side effect of loading, so this script
// works against a brand new empty Postgres database, and reusing its pool keeps
// connection settings in one place. Note that drizzle() replaces the client's
// date serializers to do its own type mapping, so a raw Date passed as a
// parameter on this client throws -- timestamps below go over as ISO strings
// with an explicit cast instead.
import { client } from '../config/db';

const sqlitePath = Bun.env.SQLITE_PATH || './db/polaris.db';

// SQLite wrote created_at as 'YYYY-MM-DD HH:mm:ss' in UTC with no zone marker.
// Postgres would read that as local time, so pin it to UTC on the way over.
const toIso = (value: string | null): string => {
    const parsed = value ? new Date(`${value.replace(' ', 'T')}Z`) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
};

const sqlite = new Database(sqlitePath, { readonly: true });

interface AccountRow {
    username: string;
    email: string;
    password_hash: string;
    created_at: string | null;
}

interface AllowedRow {
    email: string;
    added_by: string | null;
    created_at: string | null;
}

const read = <T>(table: string): T[] => {
    try {
        return sqlite.query(`SELECT * FROM ${table}`).all() as T[];
    } catch {
        return []; // table never existed in this database file
    }
};

let copied = 0;
let skipped = 0;

const report = (inserted: unknown[], label: string, email: string) => {
    if (inserted.length) copied++;
    else skipped++;
    console.log(`${inserted.length ? 'copied ' : 'skipped'} ${label}: ${email}`);
};

for (const row of read<AccountRow>('users')) {
    const inserted = await client`
        INSERT INTO users (username, email, password_hash, created_at)
        VALUES (${row.username}, ${row.email}, ${row.password_hash}, ${toIso(row.created_at)}::timestamptz)
        ON CONFLICT (email) DO NOTHING
        RETURNING id
    `;
    report(inserted, 'user', row.email);
}

for (const row of read<AccountRow>('drivers')) {
    const inserted = await client`
        INSERT INTO drivers (username, email, password_hash, created_at)
        VALUES (${row.username}, ${row.email}, ${row.password_hash}, ${toIso(row.created_at)}::timestamptz)
        ON CONFLICT (email) DO NOTHING
        RETURNING id
    `;
    report(inserted, 'driver', row.email);
}

for (const row of read<AllowedRow>('allowed_emails')) {
    const inserted = await client`
        INSERT INTO allowed_emails (email, added_by, created_at)
        VALUES (${row.email}, ${row.added_by}, ${toIso(row.created_at)}::timestamptz)
        ON CONFLICT (email) DO NOTHING
        RETURNING id
    `;
    report(inserted, 'allowed_email', row.email);
}

// otps are deliberately not copied: they expire in minutes and any in flight
// during a cutover are worthless by the time the new database is serving.

console.log(`\ndone -- ${copied} row(s) copied, ${skipped} already present`);

sqlite.close();
await client.end();
