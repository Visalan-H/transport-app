import { env } from '../config/env';

export type LogLevel = 'info' | 'debug' | 'warn';

const LOG_LEVEL = env.LOG_LEVEL;
const DEBUG_ENABLED = LOG_LEVEL === 'debug';

/**
 * Structured logger: `[ISO timestamp] [tag] [LEVEL] event_name {json metadata}`.
 *
 * `warn` goes to stderr so `docker compose logs` separates real problems from routine chatter.
 * Debug lines are dropped unless LOG_LEVEL=debug, which keeps the per-request checkpoint noise out
 * of production without needing a second code path.
 */
export const createLog = (tag: string) => (level: LogLevel, event: string, meta?: Record<string, unknown>) => {
    if (level === 'debug' && !DEBUG_ENABLED) return;

    const timestamp = new Date().toISOString();
    const payload = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    const output = `[${timestamp}] [${tag}] [${level.toUpperCase()}] ${event}${payload}`;

    if (level === 'warn') {
        console.error(output);
        return;
    }

    console.log(output);
};
