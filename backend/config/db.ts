import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { users } from '../models/user';
import { otps } from '../models/otp';
import { drivers } from '../models/driver';
import { allowedEmails } from '../models/allowedEmail';

const sqlite = new Database('./db/polaris.db');

sqlite.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

sqlite.run(`
  CREATE TABLE IF NOT EXISTS otps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

sqlite.run(`
  CREATE TABLE IF NOT EXISTS drivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

sqlite.run(`
  CREATE TABLE IF NOT EXISTS allowed_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    added_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

try {
    sqlite.run(`ALTER TABLE drivers RENAME COLUMN name TO username`);
} catch {
    // column already named username, nothing to do
}

// The signup allowlist used to be a hardcoded Set in config/validEmails.ts,
// which meant adding one student required a rebuild and redeploy. It now lives
// in allowed_emails. Seed the old list on first run so an existing deployment
// does not suddenly reject the people it already accepted. Only runs while the
// table is empty, so removing a seeded address stays removed.
{
    const [{ count }] = sqlite.query('SELECT COUNT(*) AS count FROM allowed_emails').all() as { count: number }[];
    if (count === 0) {
        const seed = sqlite.prepare('INSERT OR IGNORE INTO allowed_emails (email, added_by) VALUES (?, ?)');
        for (const email of ['visalanprivate@gmail.com', 'csroopak333@gmail.com']) {
            seed.run(email, 'seed:migration');
        }
    }
}

export const db = drizzle(sqlite, {
    schema: { users, otps, drivers, allowedEmails },
});
