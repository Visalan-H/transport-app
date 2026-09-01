# Saveetha Transport Tracker - Polaris

Polaris is a real-time bus tracking platform for Saveetha transport operations.

## What It Provides

- Live map with SSE updates for all tracked buses.
- Authenticated student access with OTP onboarding.
- Driver location updates buffered and batched before they reach the backend.
- Lightweight architecture optimized for low operational cost.

## Architecture

| Service    | Role                                                                            |
| ---------- | ------------------------------------------------------------------------------- |
| Frontend   | React app, map UI, auth flows                                                   |
| Backend    | Auth, SSE stream, bus state store, OTP + users                                  |
| Batcher    | Receives frequent updates, authenticates and validates them, forwards batched JSON |
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
  batcher/
    index.ts
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
- `POST /update` accepts backend-facing batch updates.
- CORS origin handling is allowlist-based and request-aware.
- OTP expiry is enforced during register verification.

### Batcher

- Accepts driver updates on `POST /update`.
- Request must authenticate as either:
    - Driver sender via `Authorization: Bearer <jwt>` carrying `role: 'driver'`
    - Simulation sender via `x-api-key`, and only when `SIM_API_KEY` is set (it is not, in production)
- Rejects payloads that are not four finite, in-range numbers, or whose timestamp is far from now.
- Forwards buffered updates to backend `TARGET_URL` every `INTERVAL`.

## Security Summary

- HTTP-only session cookies.
- Rate limiting on auth endpoints.
- OTP hashes only, never plain OTP storage.
- Origin allowlist CORS.
- Batcher endpoint authentication.

## Quick Start

### Docker

```bash
docker compose up --build
```

That starts the backend, batcher and frontend. The simulation is behind a `dev`
profile so it can never put synthetic buses on a live map by accident -- add it
only when you want fake traffic:

```bash
docker compose --profile dev up --build
```

### Production deploy

GitHub Actions builds and publishes the backend, batcher and frontend images to
GHCR on every push to `main`, so the server pulls prebuilt images instead of
compiling them itself:

```bash
git pull
sudo docker compose pull
sudo docker compose up -d
```

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

# batcher
cd ../batcher
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
- Batcher service details: `batcher/BATCHER.md`
- Driver app details: `driver_app/README.md`
- Frontend quick notes: `frontend/README.md`

## Environment Variables

### Backend (`backend/.env`)

```env
SERVER_PORT=3000
JOSE_SECRET_KEY=your-super-secret-jwt-key-here
SESSION_MAX_AGE=604800          # 7 days in seconds
SSE_INTERVAL=5000               # SSE broadcast interval (ms)
UPDATE_API_KEY=your-internal-update-key
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com
OTP_EXPIRATION_MINUTES=15
LOG_LEVEL=info

# Email Configuration (Gmail app password)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:3000
```

### Batcher (`batcher/.env`)

```env
BATCHER_PORT=4000
TARGET_URL=http://localhost:3000/update
INTERVAL=5000                   # Batch flush interval (ms)
```

---

## Additional Documentation

- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) — Complete endpoint reference with request/response examples
- [BATCHER.md](./batcher/BATCHER.md) — Deep dive into the batching service architecture

---

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
