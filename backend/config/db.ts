import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { users } from '../models/user';
import { otps } from '../models/otp';
import { drivers } from '../models/driver';

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

try {
    sqlite.run(`ALTER TABLE drivers RENAME COLUMN name TO username`);
} catch {
    // column already named username, nothing to do
}

export const db = drizzle(sqlite, {
    schema: { users, otps, drivers },
});
