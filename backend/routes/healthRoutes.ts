/**
 * `GET /health` — liveness for an external uptime monitor.
 *
 * Unauthenticated on purpose: a monitor cannot log in. It returns 200 so a plain ping check counts
 * it as up, which matters because the free tiers that allow frequent checks only do ping monitors.
 *
 * Deliberately shallow -- it does not touch Postgres. The backend refuses to boot if Neon is
 * unreachable, so a live process already implies the database was reachable at startup, and a
 * database blip afterwards does not stop bus tracking: locations are held in memory and the map
 * keeps working. Failing this check on that would page someone about an outage the users never see.
 * A deeper check belongs on its own endpoint, alerting differently.
 *
 * Not rate limited, and not behind nginx's limit_req either: a throttled health check returns 429,
 * which the monitor reports as an outage. The check would then page you about itself.
 */
const startedAt = Date.now();

export const healthRoutes = {
    '/health': {
        GET: () =>
            Response.json({
                status: 'ok',
                uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
            }),
    },
};
