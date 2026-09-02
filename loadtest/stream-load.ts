/**
 * Concurrency probe for the SSE stream.
 *
 * The open question this exists to answer: how many students can watch the map at once before the
 * backend degrades. Every viewer holds a connection open for as long as their tab is, against a
 * container capped at 512MB, and nobody has measured where that falls over. Finding out during a
 * launch is the expensive way to learn it.
 *
 * Dependency-free on purpose -- Bun's fetch streams responses, so there is no k6 or autocannon to
 * install on a machine that may not have them, and nothing to keep updated.
 *
 * Usage:
 *   bun loadtest/stream-load.ts --target https://polaris.visalan.me --cookie "sessionToken=..." -n 50
 *   bun loadtest/stream-load.ts --target https://polaris.visalan.me --path /health --no-stream -n 100
 *
 * /stream sits behind verifyUser, so it needs a session cookie. Copy sessionToken from a logged-in
 * browser (devtools -> Application -> Cookies). It is a credential: prefer POLARIS_COOKIE in the
 * environment over the command line, which your shell may write to history.
 *
 * This only shows the client's view. Watch the other side at the same time:
 *   sudo docker stats --no-stream transport_backend
 */

type Args = Record<string, string | boolean>;

const parseArgs = (argv: string[]): Args => {
    const out: Args = {};
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (!token.startsWith('-')) continue;
        const key = token.replace(/^-+/, '');
        const next = argv[i + 1];
        if (next && !next.startsWith('-')) {
            out[key] = next;
            i++;
        } else {
            out[key] = true;
        }
    }
    return out;
};

const args = parseArgs(process.argv.slice(2));

const TARGET = String(args.target || Bun.env.POLARIS_TARGET || 'http://localhost:3000').replace(/\/+$/, '');
const PATHNAME = String(args.path || '/stream');
const COOKIE = String(args.cookie || Bun.env.POLARIS_COOKIE || '');
const CONNECTIONS = Number(args.n || args.connections || 10);
const DURATION_S = Number(args.duration || 30);
const STREAMING = args['no-stream'] !== true;

if (PATHNAME === '/stream' && !COOKIE) {
    console.error('/stream is behind verifyUser and needs a session cookie.');
    console.error('Pass --cookie "sessionToken=..." or set POLARIS_COOKIE.');
    console.error('To probe without auth instead: --path /health --no-stream');
    process.exit(1);
}

// A first run against production should be small enough to abort safely. Stepping up in stages is
// the point -- the number worth knowing is where latency starts climbing, and that is invisible if
// the first attempt is already past it.
if (TARGET.includes('polaris.visalan.me') && CONNECTIONS > 100) {
    console.error(`Refusing ${CONNECTIONS} connections against production on a single run.`);
    console.error('Step up gradually -- 10, 50, 100 -- checking docker stats between each.');
    process.exit(1);
}

type Result = {
    ok: boolean;
    status?: number;
    connectMs?: number;
    firstEventMs?: number;
    events: number;
    error?: string;
};

const percentile = (sorted: number[], p: number): number => {
    if (sorted.length === 0) return 0;
    const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[index];
};

const runOne = async (signal: AbortSignal): Promise<Result> => {
    const started = performance.now();
    const result: Result = { ok: false, events: 0 };

    try {
        const headers: Record<string, string> = { accept: 'text/event-stream' };
        if (COOKIE) headers.cookie = COOKIE;

        const response = await fetch(`${TARGET}${PATHNAME}`, { headers, signal });
        result.connectMs = performance.now() - started;
        result.status = response.status;
        result.ok = response.ok;

        if (!response.ok || !STREAMING || !response.body) {
            // Drain rather than abandon, so the socket is not left half-open on the server.
            await response.text().catch(() => {});
            return result;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (!signal.aborted) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            // Only data frames count. Comment frames are liveness, not payload -- counting them
            // would make a stalled stream look healthy, which is the failure this is looking for.
            const frames = chunk.split('\n\n').filter((frame) => frame.trim().startsWith('data:')).length;

            if (frames > 0) {
                if (result.events === 0) result.firstEventMs = performance.now() - started;
                result.events += frames;
            }
        }
    } catch (error) {
        // An abort at the end of the run is expected, not a failure.
        if (!signal.aborted) result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
};

console.log(`target       ${TARGET}${PATHNAME}`);
console.log(`connections  ${CONNECTIONS}`);
console.log(`duration     ${DURATION_S}s`);
console.log(`streaming    ${STREAMING}`);
console.log(`cookie       ${COOKIE ? 'provided' : 'none'}`);
console.log('');
console.log('running... meanwhile: sudo docker stats --no-stream transport_backend');

const controller = new AbortController();
const startedAll = performance.now();
const timer = setTimeout(() => controller.abort(), DURATION_S * 1000);

const results = await Promise.all(Array.from({ length: CONNECTIONS }, () => runOne(controller.signal)));
clearTimeout(timer);

const elapsedS = (performance.now() - startedAll) / 1000;
const connected = results.filter((r) => r.ok);
const failed = results.filter((r) => !r.ok);
const rateLimited = results.filter((r) => r.status === 429);
const errored = results.filter((r) => r.error);

const connectTimes = connected.map((r) => r.connectMs ?? 0).sort((a, b) => a - b);
const firstEventTimes = connected
    .map((r) => r.firstEventMs)
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b);

const totalEvents = results.reduce((sum, r) => sum + r.events, 0);
const silent = connected.filter((r) => r.events === 0).length;
const ms = (value: number) => `${value.toFixed(0)}ms`;

console.log('');
console.log(`elapsed               ${elapsedS.toFixed(1)}s`);
console.log(`connected             ${connected.length}/${CONNECTIONS}`);
console.log(`failed                ${failed.length}`);
console.log(`  429 rate limited    ${rateLimited.length}`);
console.log(`  network errors      ${errored.length}`);
console.log('');
console.log(
    `connect       p50 ${ms(percentile(connectTimes, 50))}  p95 ${ms(percentile(connectTimes, 95))}  max ${ms(connectTimes.at(-1) ?? 0)}`,
);

if (STREAMING) {
    console.log(
        `first event   p50 ${ms(percentile(firstEventTimes, 50))}  p95 ${ms(percentile(firstEventTimes, 95))}  max ${ms(firstEventTimes.at(-1) ?? 0)}`,
    );
    console.log('');
    console.log(`events total          ${totalEvents}`);
    console.log(`events per connection ${connected.length ? (totalEvents / connected.length).toFixed(1) : '0'}`);
    console.log(`connected but silent  ${silent}${silent > 0 ? '   <-- held open, never delivered' : ''}`);
}

const statuses = [...new Set(results.map((r) => r.status).filter(Boolean))];
if (statuses.length > 0) console.log(`\nstatus codes seen     ${statuses.join(', ')}`);
if (errored.length > 0) console.log(`sample error          ${errored[0].error}`);

// Non-zero exit if a meaningful share failed, so this can gate a script later if that is ever wanted.
process.exit(failed.length > CONNECTIONS * 0.05 ? 1 : 0);
