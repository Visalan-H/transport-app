import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from '../models/user';
import { otps } from '../models/otp';
import { drivers } from '../models/driver';
import { allowedEmails } from '../models/allowedEmail';
import { env } from './env';

const connectionString = env.NEON_POSTGRES_URI;

// Deliberately the stock postgres-js driver rather than a provider-specific
// one, and no hardcoded ssl setting: nothing here knows or cares that Neon is
// the host, so moving to another Postgres (Supabase, RDS, a plain container
// with no TLS) stays a connection-string change. sslmode travels in the URI.
//
// max is low because the app runs as a single instance on a small VM and
// serverless Postgres bills for idle connections. onnotice is silenced because
// the CREATE ... IF NOT EXISTS below raise a NOTICE on every boot once the
// tables exist, which would bury the real startup logs.
//
// Exported so one-shot scripts can close the pool and exit; the server keeps
// it open for the process lifetime.
export const client = postgres(connectionString, { max: 5, onnotice: () => {} });

// Schema bootstrap runs at import time, matching how this app has always
// worked. There is no migration framework in the loop on purpose: the deployed
// image is bare Alpine with a compiled binary (see Dockerfile), so drizzle-kit
// is not available at runtime to apply migrations on boot.
await client`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  )
`;

await client`
  CREATE TABLE IF NOT EXISTS otps (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  )
`;

await client`
  CREATE TABLE IF NOT EXISTS drivers (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  )
`;

await client`
  CREATE TABLE IF NOT EXISTS allowed_emails (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    added_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  )
`;

// Emails used to be stored in whatever case a request sent them in, while
// AllowedEmail.has() (and now every service method) compares lowercased.
// That mismatch is how a single allowlisted address could mint unlimited
// accounts -- alice@sec.edu, Alice@sec.edu and ALICE@sec.edu all passed the
// (lowercased) allowlist check but each landed in the case-sensitive UNIQUE
// column as a distinct row. Dedupe has to run before the lowercasing UPDATE,
// not after: two rows that only differ by case are about to collide on the
// same lowercase value, and doing the UPDATE first would hit the very UNIQUE
// constraint we're trying to satisfy. users/drivers/allowed_emails keep the
// lowest id -- the oldest, presumably legitimate, row; otps keeps the highest
// id, matching the case-sensitive dedupe already below (the newest code is
// the one worth keeping). Both statements are no-ops once everything is
// already lowercase and deduped, so this is safe to run on every boot.
{
    const normalize = async (table: string) => {
        const dupes = await client.unsafe(
            `DELETE FROM ${table} a USING ${table} b WHERE lower(a.email) = lower(b.email) AND a.id > b.id`,
        );
        const cased = await client.unsafe(`UPDATE ${table} SET email = lower(email) WHERE email <> lower(email)`);
        if (dupes.count || cased.count) {
            console.log(
                `[db] [INFO] email_case_normalized {"table":"${table}","duplicatesRemoved":${dupes.count},"rowsLowercased":${cased.count}}`,
            );
        }
    };

    await normalize('users');
    await normalize('drivers');
    await normalize('allowed_emails');

    const otpDupes =
        await client`DELETE FROM otps a USING otps b WHERE lower(a.email) = lower(b.email) AND a.id < b.id`;
    const otpCased = await client`UPDATE otps SET email = lower(email) WHERE email <> lower(email)`;
    if (otpDupes.count || otpCased.count) {
        console.log(
            `[db] [INFO] email_case_normalized {"table":"otps","duplicatesRemoved":${otpDupes.count},"rowsLowercased":${otpCased.count}}`,
        );
    }
}

// OTP lookup and cleanup both scan by email/created_at on every signup attempt.
// One live OTP per email. Older rows are dropped first because a unique index
// cannot be built over duplicates, and any duplicate here is a leftover from
// when Otp.create was a non-atomic delete-then-insert.
await client`DELETE FROM otps a USING otps b WHERE a.email = b.email AND a.id < b.id`;
await client`CREATE UNIQUE INDEX IF NOT EXISTS otps_email_key ON otps (email)`;
await client`DROP INDEX IF EXISTS otps_email_idx`;
await client`CREATE INDEX IF NOT EXISTS otps_created_at_idx ON otps (created_at)`;

// The signup allowlist used to be a hardcoded Set in config/validEmails.ts,
// which meant adding one student required a rebuild and redeploy. It now lives
// in allowed_emails. Seed the old list on first run so an existing deployment
// does not suddenly reject the people it already accepted. Only runs while the
// table is empty, so removing a seeded address stays removed.
{
    const rows = await client<{ count: string }[]>`SELECT COUNT(*) AS count FROM allowed_emails`;
    if (Number(rows[0]?.count ?? 0) === 0) {
        await client`
            INSERT INTO allowed_emails (email, added_by)
            VALUES ('visalanprivate@gmail.com', 'seed:migration'),
                   ('csroopak333@gmail.com', 'seed:migration')
            ON CONFLICT (email) DO NOTHING
        `;
    }
}

export const db = drizzle(client, {
    schema: { users, otps, drivers, allowedEmails },
});
