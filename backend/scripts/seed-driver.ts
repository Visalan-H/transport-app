/**
 * Creates or updates a driver login.
 *
 * Credentials come from the environment, never from this file — a password
 * committed to the repo is a password on a public GitHub. Run it as:
 *
 *   DRIVER_EMAIL=someone@example.com \
 *   DRIVER_USERNAME='Route 12 Driver' \
 *   DRIVER_PASSWORD='...' \
 *   bun backend/scripts/seed-driver.ts
 *
 * On the production VM the backend image is bare Alpine with no bun, so run it
 * in a throwaway container against the mounted db instead:
 *
 *   sudo docker run --rm -v ~/polaris/backend/db:/db \
 *     -e DB_PATH=/db/polaris.db \
 *     -e DRIVER_EMAIL=... -e DRIVER_USERNAME=... -e DRIVER_PASSWORD=... \
 *     -v ~/polaris/backend/scripts:/scripts \
 *     oven/bun:1-alpine bun /scripts/seed-driver.ts
 *
 * Re-running with an existing email resets that driver's password rather than
 * failing, so this doubles as password reset.
 */
import { Database } from 'bun:sqlite';

const dbPath = process.env.DB_PATH ?? './backend/db/polaris.db';
const email = process.env.DRIVER_EMAIL;
const username = process.env.DRIVER_USERNAME;
const password = process.env.DRIVER_PASSWORD;

if (!email || !username || !password) {
    console.error('Missing required env vars: DRIVER_EMAIL, DRIVER_USERNAME, DRIVER_PASSWORD');
    process.exit(1);
}

const sqlite = new Database(dbPath);

sqlite.run(`
  CREATE TABLE IF NOT EXISTS drivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

// Default algorithm (argon2id) — matches how user passwords are hashed in
// authController. Bun.password.verify reads the algorithm off the hash prefix,
// so existing bcrypt rows keep working.
const hash = await Bun.password.hash(password);

const existing = sqlite.query('SELECT id FROM drivers WHERE email = ?').get(email) as { id: number } | null;

if (existing) {
    sqlite.run('UPDATE drivers SET username = ?, password_hash = ? WHERE email = ?', [username, hash, email]);
    console.log(`✓ Updated existing driver: ${email}`);
} else {
    sqlite.run('INSERT INTO drivers (username, email, password_hash) VALUES (?, ?, ?)', [username, email, hash]);
    console.log(`✓ Created driver: ${email}`);
}
