# Saveetha Transport Tracker - Polaris

Polaris is a real-time bus tracking platform for Saveetha transport operations.

## What It Provides

- Live map with SSE updates for all tracked buses.
- Authenticated student access with OTP onboarding.
- Driver update flow via batcher with source-priority handling.
- Lightweight architecture optimized for low operational cost.

## Architecture

| Service    | Role                                                                            |
| ---------- | ------------------------------------------------------------------------------- |
| Frontend   | React app, map UI, auth flows                                                   |
| Backend    | Auth, SSE stream, bus state store, OTP + users                                  |
| Batcher    | Receives frequent updates, enforces source auth/priority, forwards batched JSON |
| Simulation | Generates synthetic bus updates for testing                                     |
| Postgres   | Stores users, drivers, signup allowlist + OTP hashes (hosted, not on the VM)    |

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

- Accepts driver and GPS updates on `POST /update`.
- Request must authenticate as either:
    - GPS sender via `x-api-key`
    - Driver sender via valid `sessionToken` JWT
- Applies GPS priority window before accepting conflicting driver updates.
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

## Operational Notes

- Compose includes per-service CPU and memory limits.
- Structured logs include timestamp, service tag, level, and event name.
- To increase log verbosity, set `LOG_LEVEL=debug`.

## Documentation Index

- API details: `API_DOCUMENTATION.md`
- Batcher service details: `batcher/BATCHER.md`
- Frontend quick notes: `frontend/README.md`

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

## Built By

**Sec TechSociety** — A real-time tracking solution for Saveetha Engineering College.

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
