import { isAxiosError } from 'axios';

/**
 * Turns a failed request into a sentence a student can act on. The backend puts
 * its reason in `{ error }` on the response body; axios's own `err.message`
 * ("Request failed with status code 400") is never shown, because it tells the
 * reader nothing about what to fix.
 */
export const errorMessage = (err: unknown, fallback: string): string => {
    if (!isAxiosError(err)) return fallback;

    // No response at all: offline, DNS failure, or the server is down.
    if (!err.response) return "Can't reach the server. Check your connection and try again.";

    const { status, data } = err.response;
    if (status === 429) return 'Too many attempts. Wait a minute and try again.';

    const serverError = (data as { error?: unknown } | undefined)?.error;
    if (typeof serverError === 'string' && serverError) return serverError;

    if (status >= 500) return 'Something went wrong on our end. Try again in a minute.';
    return fallback;
};

/** HTTP status of a failed request, or undefined when none came back. */
export const errorStatus = (err: unknown): number | undefined => (isAxiosError(err) ? err.response?.status : undefined);
