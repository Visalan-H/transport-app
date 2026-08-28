/**
 * Creates or updates a driver login, straight against Postgres.
 *
 * The admin page (/admin -> Drivers) does this from the browser now and is the
 * expected route. This script stays for bootstrapping: a fresh database with
 * no admin account yet, or a recovery when the site itself is down.
 *
 * Credentials come from the environment, never from this file — a password
 * committed to the repo is a password on a public GitHub. Run it as:
 *
 *   DRIVER_EMAIL=someone@example.com \
 *   DRIVER_USERNAME='Route 12 Driver' \
 *   DRIVER_PASSWORD='...' \
 *   bun backend/scripts/seed-driver.ts
 *
 * The database is no longer a file on the server, so this runs from anywhere
 * with NEON_POSTGRES_URI set — no docker, no ssh, no mounted volume.
 *
 * Re-running with an existing email resets that driver's password rather than
 * failing, so this doubles as password reset.
 */
import postgres from 'postgres';
// config/db.ts creates the tables as a side effect of loading, so this works
// against a database the server has never booted against. Its pool is imported
// only so it can be closed at the end, otherwise the process never exits.
import { client as schemaClient } from '../config/db';

const connectionString = process.env.NEON_POSTGRES_URI;
const email = process.env.DRIVER_EMAIL;
const username = process.env.DRIVER_USERNAME;
const password = process.env.DRIVER_PASSWORD;

if (!connectionString) {
    console.error('NEON_POSTGRES_URI is not set');
    process.exit(1);
}

if (!email || !username || !password) {
    console.error('Missing required env vars: DRIVER_EMAIL, DRIVER_USERNAME, DRIVER_PASSWORD');
    process.exit(1);
}

const sql = postgres(connectionString, { onnotice: () => {} });

// Default algorithm (argon2id) — matches how user passwords are hashed in
// authController. Bun.password.verify reads the algorithm off the hash prefix,
// so existing bcrypt rows keep working.
const hash = await Bun.password.hash(password);

// Upsert leans on the unique constraint on email rather than a
// read-then-write, so two concurrent runs cannot both decide the driver is new.
// xmax = 0 is the standard way to tell an INSERT from an UPDATE in RETURNING.
const [row] = await sql<{ inserted: boolean }[]>`
    INSERT INTO drivers (username, email, password_hash)
    VALUES (${username}, ${email}, ${hash})
    ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username, password_hash = EXCLUDED.password_hash
    RETURNING (xmax = 0) AS inserted
`;

console.log(`✓ ${row?.inserted ? 'Created' : 'Updated'} driver: ${email}`);

await sql.end();
await schemaClient.end();
