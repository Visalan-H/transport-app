import { z } from 'zod';

/**
 * Every environment variable the backend reads, validated once at import time.
 *
 * Before this, 14 variables were read across 12 files, each with its own inline fallback. Two
 * concrete problems came out of that:
 *
 * - OTP_EXPIRATION_MINUTES was read in three places (otpService, sendOtp, otpCleanup) with three
 *   separate defaults. They agreed only because the constants happened to match; changing one would
 *   have silently desynced the expiry the email advertises from the one the server enforces.
 * - JOSE_SECRET_KEY was never validated at all. `new TextEncoder().encode(undefined)` returns an
 *   empty array rather than throwing, so a deploy missing it would start cleanly, pass a health
 *   check, and then fail every single login with a 500 when jose rejected the zero-length key.
 *   Refusing to boot is the better failure: it is loud, immediate, and names the cause.
 *
 * Required here means "the app cannot function without it", so anything already deployed and
 * working necessarily has these set — this cannot break a running deployment by tightening.
 */
const schema = z.object({
    // Secrets and connections. No defaults on purpose: a fallback for any of these would mean
    // booting into a broken or insecure state instead of saying what is missing.
    NEON_POSTGRES_URI: z.string().min(1, 'NEON_POSTGRES_URI is required (Postgres connection string)'),
    JOSE_SECRET_KEY: z.string().min(1, 'JOSE_SECRET_KEY is required (signs all session and driver tokens)'),
    ALLOWED_ORIGINS: z.string().min(1, 'ALLOWED_ORIGINS is required (comma-separated origins for CORS)'),
    EMAIL_USER: z.string().min(1, 'EMAIL_USER is required (sender account for OTP mail)'),
    EMAIL_PASS: z.string().min(1, 'EMAIL_PASS is required (app password for EMAIL_USER)'),

    // Optional. ADMIN_EMAILS empty means nobody is exempt from the allowed_emails gate, which on a
    // fresh database deadlocks signup — but that is a valid state for a deployment that has not
    // been bootstrapped yet, so it is not an error here.
    ADMIN_EMAILS: z.string().default(''),
    SIM_API_KEY: z.string().optional(),

    NODE_ENV: z.string().default('development'),
    LOG_LEVEL: z
        .string()
        .default('info')
        .transform((value) => value.toLowerCase())
        .pipe(z.enum(['info', 'debug', 'warn'])),

    // Numbers arrive as strings. coerce keeps the parsing in one place instead of a parseInt at each
    // call site, and .positive() catches a typo'd 0 or -1 at boot rather than as an interval that
    // never fires or a token that is already expired.
    SERVER_PORT: z.coerce.number().int().positive().default(3000),
    SESSION_MAX_AGE: z.coerce.number().int().positive().default(604800),
    SSE_INTERVAL: z.coerce.number().int().positive().default(5000),
    BUS_EVICT_AFTER_MS: z.coerce.number().int().positive().default(3600000),
    OTP_EXPIRATION_MINUTES: z.coerce.number().int().positive().default(15),
});

const parsed = schema.safeParse(Bun.env);

if (!parsed.success) {
    // Every problem at once. Reporting only the first means a misconfigured deploy takes as many
    // restarts to fix as it has missing variables.
    console.error('[env] [ERROR] invalid environment, refusing to start:');
    for (const issue of parsed.error.issues) {
        console.error(`  - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    process.exit(1);
}

export const env = parsed.data;

// A short HMAC key is weak rather than invalid, so jose accepts it and nothing would otherwise say
// so. Warning instead of throwing is deliberate: refusing to boot here would take a running
// deployment offline over a key that already works.
if (env.JOSE_SECRET_KEY.length < 32) {
    console.error(
        `[env] [WARN] JOSE_SECRET_KEY is ${env.JOSE_SECRET_KEY.length} characters. HS256 wants at least 32 — consider rotating to a longer one.`,
    );
}
