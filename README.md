# Saveetha Transport Tracker - Polaris

Polaris is a real-time bus tracking platform for Saveetha transport operations.

## What It Provides

- Live map with SSE updates for all tracked buses.
- Authenticated student access with OTP onboarding.
- Driver location updates accepted, validated and applied on arrival.
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
  types/
    index.d.ts
```

## Runtime Behavior

### Backend

- `GET /stream` is protected by session auth middleware.
- `POST /update` accepts one plain-text location fix from a driver.
- CORS origin handling is allowlist-based and request-aware.
- OTP expiry is enforced during register verification.

### Location ingest (`POST /update`)

- Body is plain text: `busId,lat,lng,timestampMillis`.
- Request must authenticate as either:
    - Driver sender via `Authorization: Bearer <jwt>` carrying `role: 'driver'`
    - Simulation sender via `x-api-key`, and only when `SIM_API_KEY` is set (it is not, in production)
- Rejects payloads that are not four finite, in-range numbers, or whose timestamp is far from now.
- An update is applied only if its timestamp beats the one already stored for that bus.

This used to be a separate `batcher` service that buffered fixes and flushed them
to the backend in batches. It was removed: the work being batched was a single
in-memory map write, so all the buffering bought was up to 5s of extra latency on
a live map. Drivers now post straight to the backend on the same path, with the
same body and the same auth, so no driver app rebuild was needed.

## Security Summary

- HTTP-only session cookies.
- Rate limiting on auth endpoints.
- OTP hashes only, never plain OTP storage.
- Origin allowlist CORS.
- Location ingest requires a driver token.

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

The backend requires `NEON_POSTGRES_URI` and `ADMIN_EMAILS` in `backend/.env` --
it throws at startup if either is missing.

The three GHCR packages inherit this repo's public visibility, so the server
pulls anonymously and needs no registry login. If a package ever shows up
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
for by default — if the arm64 APK refuses to install with a generic *App not
installed* error, that is the case, and the 32-bit build can be produced from
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

- Compose includes per-service CPU and memory limits.
- Structured logs include timestamp, service tag, level, and event name.
- To increase log verbosity, set `LOG_LEVEL=debug`.

## Documentation Index

- API details: `API_DOCUMENTATION.md`
- Driver app details: `driver_app/README.md`
- Frontend quick notes: `frontend/README.md`

## Environment Variables

### Backend (`backend/.env`)

```env
SERVER_PORT=3000
JOSE_SECRET_KEY=your-super-secret-jwt-key-here
SESSION_MAX_AGE=604800          # 7 days in seconds
SSE_INTERVAL=5000               # SSE broadcast interval (ms)
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com
OTP_EXPIRATION_MINUTES=15
LOG_LEVEL=info

# Optional, and deliberately unset in production. Enables the `x-api-key` path on
# POST /update so `simulation/` can post for many buses at once, which it could
# never do holding a single driver's token. Set it in BOTH backend/.env and
# simulation/.env, to the same value, when you want synthetic traffic locally.
# SIM_API_KEY=any-shared-local-value

# Email Configuration (Gmail app password)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:3000
```

---

## Additional Documentation

- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) — Complete endpoint reference with request/response examples
- [driver_app/README.md](./driver_app/README.md) — The Android driver client

---

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
