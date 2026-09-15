import { env } from '../config/env';

/**
 * Public base URL of the app, for links in outbound email.
 *
 * Prefers APP_URL when set. Otherwise it is derived from ALLOWED_ORIGINS so a
 * working deployment needs no new variable: the first https origin is picked
 * (that is the real site under Cloudflare), falling back to the first origin
 * listed, and finally to localhost for a bare dev run. Any trailing slash is
 * trimmed so callers can append a path directly.
 */
export function appBaseUrl(): string {
    const explicit = env.APP_URL?.trim();
    if (explicit) return explicit.replace(/\/+$/, '');

    const origins = env.ALLOWED_ORIGINS.split(',')
        .map((o) => o.trim())
        .filter(Boolean);
    const chosen = origins.find((o) => o.startsWith('https://')) ?? origins[0] ?? 'http://localhost:5173';
    return chosen.replace(/\/+$/, '');
}

/** Signup link that pre-fills the invited address. */
export function signupUrl(email: string): string {
    return `${appBaseUrl()}/signup?email=${encodeURIComponent(email)}`;
}
