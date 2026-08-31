/**
 * ADMIN_EMAILS are the operators who run the system (currently the repo
 * owner and the college Dean) — unrelated to `allowed_emails`, which is the
 * separate, DB-backed list of students who paid for transport and may sign
 * up. Admin identity lives in the environment, not the database, so there is
 * no bootstrap problem — the first admin exists the moment the server
 * starts, with no "who creates the creator" step. Admins are a handful of
 * operators and change rarely; the lists they *manage* are what live in the
 * DB.
 *
 * ADMIN_EMAILS is comma-separated, matching the ALLOWED_ORIGINS convention.
 */
const raw = Bun.env.ADMIN_EMAILS;

if (!raw) {
    throw new Error('ADMIN_EMAILS is not set');
}

export const adminEmails: Set<string> = new Set(
    raw
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
);

if (adminEmails.size === 0) {
    throw new Error('ADMIN_EMAILS is set but contains no usable addresses');
}

export const isAdmin = (email: string | undefined | null): boolean =>
    typeof email === 'string' && adminEmails.has(email.toLowerCase());
