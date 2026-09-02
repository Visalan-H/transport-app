# Saveetha Transport Tracker - Polaris

Polaris is a real-time bus tracking platform for Saveetha transport operations.

## What It Provides

- Live map with SSE updates for all tracked buses.
- Authenticated student access with OTP onboarding, gated on a paid-transport allowlist.
- Driver location updates accepted, validated and applied on arrival.
- An admin page (`/admin`) for the allowlist, registered students and driver accounts.
- Lightweight architecture optimized for low operational cost.

## Architecture

| Service    | Role                                                                            |
| ---------- | ------------------------------------------------------------------------------- |
| Frontend   | React app, map UI, auth flows                                                   |
| Backend    | Auth, SSE stream, bus state store, OTP + users                                  |
| Driver app | Native Android client drivers use to broadcast location (see `driver_app/`)     |
| Simulation | Generates synthetic bus updates for testing                                     |
| Postgres   | Stores users, drivers, paid-transport list + OTP hashes (hosted, not on the VM) |

## Current Project Layout

```text
transport/
  backend/
    controllers/
    middleware/
    routes/
    services/
    utils/
    jobs/
    config/
    models/
    db/
    server.ts
  frontend/
    src/
  driver_app/
    lib/
      data/
      screens/
      services/
      widgets/
    android/
  simulation/
    sim.ts
  scripts/
    generate-bus-routes.ts
  loadtest/
    stream-load.ts
  types/
    index.d.ts
```

`scripts/generate-bus-routes.ts` generates `driver_app/lib/data/bus_routes.dart`
from `frontend/src/constants/BusIdMap.ts`, so the two copies of the bus-ID to
route-name mapping cannot drift. CI runs it with `--check` and fails on a
mismatch — drift has no runtime symptom, it just shows students one route name
and the driver another.

## Runtime Behavior

### Backend

- `GET /stream` is protected by session auth middleware. A new subscriber gets
  the current snapshot immediately, then one per `SSE_INTERVAL`; the broadcast
  timer starts on the first subscriber and stops with the last.
- `POST /update` accepts one plain-text location fix from a driver.
- `GET /health` is unauthenticated liveness for an uptime monitor.
- `/admin/*` (reached as `/api/admin/*`) requires a session cookie **and** an
  email in `ADMIN_EMAILS`. Not an admin is a `403`, not a `401` — the frontend
  distinguishes the two.
- CORS origin handling is allowlist-based and request-aware.
- OTP expiry is enforced during register verification.

### Location ingest (`POST /update`)

- Body is plain text: `busId,lat,lng,timestampMillis`.
- Request must authenticate as either:
    - Driver sender via `Authorization: Bearer <jwt>` carrying `role: 'driver'`
    - Simulation sender via `x-api-key`, and only when `SIM_API_KEY` is set (it is not, in production)
- Rejects payloads that are not four finite, in-range numbers, or whose timestamp is far from now.
- An update is applied only if its timestamp beats the one already stored for that bus.
- A bus with no fix for `BUS_EVICT_AFTER_MS` is dropped from the snapshot, so a driver who stops
  broadcasting does not leave a marker behind for the life of the process. The map already greys a
  bus out after 30s, so eviction is cleanup well after the fact, not the staleness signal itself.

This used to be a separate `batcher` service that buffered fixes and flushed them
to the backend in batches. It was removed: the work being batched was a single
in-memory map write, so all the buffering bought was up to 5s of extra latency on
a live map. Drivers now post straight to the backend on the same path, with the
same body and the same auth, so no driver app rebuild was needed.

## Security Summary

- HTTP-only session cookies (`SameSite=Strict`, `Secure` in production).
- Rate limiting on auth endpoints, in the backend and again in nginx.
- OTP hashes only, never plain OTP storage.
- Origin allowlist CORS.
- Location ingest requires a driver token carrying `role: 'driver'`.
- TLS to the origin with a Cloudflare Origin CA certificate, so Cloudflare runs
  in Full (strict) — see Origin TLS below.
- A Content-Security-Policy and the usual hardening headers, served from
  `frontend/security-headers.conf` and `include`d into every nginx location.
  The `include` is not decoration: nginx's `add_header` only inherits from an
  outer level when the current level defines _none_, so a single `add_header` in
  a location silently drops every inherited header.
- Backend and frontend containers run as a non-root user.

There is no token revocation. Logging out, deleting a user or resetting a
driver's password all leave already-issued tokens valid until `SESSION_MAX_AGE`
elapses. Rotating `JOSE_SECRET_KEY` invalidates every session at once and is the
only way to cut one short.

## Quick Start

### Docker

```bash
docker compose up --build
```

That starts the backend and frontend. The simulation is behind a `dev`
profile so it can never put synthetic buses on a live map by accident -- add it
only when you want fake traffic:

```bash
docker compose --profile dev up --build
```

### Production deploy

GitHub Actions builds and publishes the backend and frontend images to
GHCR on every push to `main`, so the server pulls prebuilt images instead of
compiling them itself:

```bash
git pull
sudo docker compose pull
sudo docker compose up -d --remove-orphans
```

`--remove-orphans` matters whenever a service is deleted from the compose file:
without it Docker leaves the old container running, since it no longer belongs
to any service compose knows about. It is harmless to pass every time.

The backend validates its whole environment at startup (`backend/config/env.ts`)
and refuses to boot if anything required is missing, printing every problem at
once rather than one per restart. `NEON_POSTGRES_URI`, `JOSE_SECRET_KEY`,
`ALLOWED_ORIGINS`, `EMAIL_USER` and `EMAIL_PASS` have no defaults; everything
else does. See the Environment Variables section below.

#### Origin TLS

The frontend serves 443 with a **Cloudflare Origin CA certificate**, so Cloudflare's
SSL/TLS mode can be **Full (strict)**. On Flexible -- the default, and what this ran
on originally -- Cloudflare terminates TLS at the edge and then speaks plain HTTP to
this origin across the public internet, so session cookies, driver passwords and
driver JWTs travel in cleartext while the browser still shows a padlock. Full without
`strict` encrypts that hop but accepts any certificate, including an attacker's.

The certificate is not in the repo or the image -- the frontend image is public on
GHCR, so a key inside it would be a published key. It is mounted from the server:

```bash
mkdir -p ~/polaris/certs
# paste the certificate and private key from
# Cloudflare -> SSL/TLS -> Origin Server -> Create Certificate
nano ~/polaris/certs/origin.pem
nano ~/polaris/certs/origin.key
chmod 600 ~/polaris/certs/origin.key
```

Then set SSL/TLS -> Overview -> **Full (strict)** in the Cloudflare dashboard, and
open 443 to Cloudflare's ranges in the Azure NSG. Port 80 can be closed once 443
serves: Cloudflare connects to the origin on 443 under Full (strict), and browser
HTTP is redirected at the edge by "Always Use HTTPS".

Nothing is mounted locally, which is why `docker compose up --build` on a laptop
still works: the container entrypoint writes a throwaway self-signed pair when the
directory is empty. That certificate is worthless by design and Full (strict) will
correctly refuse it, so it can never be mistaken for a production setup.

Both GHCR packages (`transport-app-backend`, `transport-app-frontend`) inherit
this repo's public visibility, so the server pulls anonymously and needs no
registry login. If a package ever shows up
private (GitHub profile -> Packages -> package -> Package settings), a
`docker compose pull` on the server fails with a 401 until it is made public.

### Manual

```bash
# backend
cd backend
bun install
bun run dev

# frontend
cd ../frontend
bun install
bun run dev
```

## Driver App (Android)

Drivers use a native Android app, not the website. A browser stops broadcasting
location the moment the phone locks, so the app runs the tracker in an Android
foreground service instead.

Builds are published on the [Releases page](https://github.com/Visalan-H/transport-app/releases).

| Build         | Size   | Who it is for                                                      |
| ------------- | ------ | ------------------------------------------------------------------ |
| `arm64-v8a`   | ~17 MB | Every phone made in roughly the last decade. This is the download. |
| `armeabi-v7a` | ~15 MB | Older 32-bit devices only.                                         |

Only the `arm64-v8a` build is attached to releases. The 32-bit build is a
fallback for hardware old enough that it is not worth carrying an extra asset
for by default — if the arm64 APK refuses to install with a generic _App not
installed_ error, that is the case, and the 32-bit build can be produced from
source:

```bash
cd driver_app
flutter build apk --split-per-abi \
  --dart-define=AUTH_BASE_URL=https://polaris.visalan.me \
  --dart-define=UPDATE_BASE_URL=https://polaris.visalan.me
```

Both server addresses are baked in at build time, so moving the server means
issuing a new APK.

## Operational Notes

- Compose includes per-service CPU, memory and PID limits.
- Container logs are rotated (`max-size: 10m`, `max-file: 3`). Docker's default
  `json-file` driver never rotates, which on a 1 GB VM eventually fills the disk
  and takes the site down in a way that looks like a mystery.
- Structured logs include timestamp, service tag, level, and event name.
- To increase log verbosity, set `LOG_LEVEL=debug`.
- `GET /health` is unauthenticated and returns `{ status, uptimeSeconds }`, for
  an external uptime monitor. It is deliberately shallow — it does not touch
  Postgres, since a database blip does not stop bus tracking and should not page
  anyone. It is excluded from every rate-limit zone, because a throttled health
  check returns 429 and the monitor reports that as an outage.
- `loadtest/stream-load.ts` is a dependency-free probe for SSE concurrency. It
  is excluded from the Docker build context and never ships in an image. See
  `loadtest/README.md`.
- None of the bus location state is persisted. A backend restart loses it and
  the map rebuilds itself within one `SSE_INTERVAL`, since every driver
  re-announces every 5s.

## Documentation Index

- API details: `API_DOCUMENTATION.md`
- Driver app details: `driver_app/README.md`
- Frontend quick notes: `frontend/README.md`

## Environment Variables

### Backend (`backend/.env`)

Parsed and validated once at startup by `backend/config/env.ts`. Nothing else in
the backend reads `Bun.env`. The five variables with no default below are
required; the rest fall back to the values shown.

```env
# Required -- the backend exits at startup if any of these is missing
NEON_POSTGRES_URI=postgresql://...        # hosted Neon Postgres
JOSE_SECRET_KEY=your-super-secret-jwt-key-here   # 32+ chars; shorter only warns
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com

# Comma-separated admins. Exempt from the allowed_emails gate -- without at
# least one, a fresh database deadlocks: signup needs the allowlist, the
# allowlist needs an admin session, and a session needs an account.
ADMIN_EMAILS=you@example.com

SERVER_PORT=3000
SESSION_MAX_AGE=604800          # 7 days in seconds
SSE_INTERVAL=5000               # SSE broadcast interval (ms)
BUS_EVICT_AFTER_MS=3600000      # drop a bus from the map after this long with no fix (1h)
OTP_EXPIRATION_MINUTES=15       # also sets the OTP cleanup job's interval
LOG_LEVEL=info

# Optional, and deliberately unset in production. Enables the `x-api-key` path on
# POST /update so `simulation/` can post for many buses at once, which it could
# never do holding a single driver's token. Set it in BOTH backend/.env and
# simulation/.env, to the same value, when you want synthetic traffic locally.
# SIM_API_KEY=any-shared-local-value

# Required. Gmail app password -- OTP mail is how anyone signs up at all.
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:3000
```

### Origin certificate (`certs/`, server only)

```text
certs/origin.pem    Cloudflare Origin CA certificate
certs/origin.key    its private key (chmod 600)
```

Gitignored. Absent locally -- see Origin TLS above.

---

## Additional Documentation

- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) — Complete endpoint reference with request/response examples
- [driver_app/README.md](./driver_app/README.md) — The Android driver client

---

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
