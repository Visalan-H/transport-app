import { Database } from 'bun:sqlite';

const sqlite = new Database('./backend/db/polaris.db');

// Create drivers table if it doesn't exist
sqlite.run(`
  CREATE TABLE IF NOT EXISTS drivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

const email = 'driver@test.com';
const password = 'password123';
const username = 'Test Driver';

// Check if driver already exists
const existing = sqlite.query('SELECT id FROM drivers WHERE email = ?').get(email);
if (existing) {
    console.log(`Driver already exists: ${email}`);
    process.exit(0);
}

const hash = await Bun.password.hash(password, { algorithm: 'bcrypt', cost: 10 });

sqlite.run('INSERT INTO drivers (username, email, password_hash) VALUES (?, ?, ?)', [username, email, hash]);

console.log('✓ Dummy driver created successfully');
console.log(`  Email:    ${email}`);
console.log(`  Password: ${password}`);
