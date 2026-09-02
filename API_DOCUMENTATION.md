# Transport App API Documentation

## Overview

- Base server runtime: Bun.
- Route registration: `backend/server.ts` (Bun's native router — no Express/Hono).
- Controllers: `backend/controllers/*`.
- Default payload format: JSON (except `POST /update`, which takes a plain-text payload).

In production a single origin fronts everything and nginx (`frontend/nginx.conf`) dispatches by
path: `/auth/*`, `/stream`, `/update`, `/health` and `/api/*` all proxy to the backend on `:3000`.
The `/api` prefix is stripped before proxying, which is why the admin routes below are registered as
`/admin/*` in the backend but called as `/api/admin/*` from the browser.

## Types

- `BusDetails`
    - `id`: number
    - `lat`: number
    - `lng`: number
    - `timestamp`: number

## CORS Behavior

- CORS is applied in middleware wrappers for all route handlers (`backend/services/corsService.ts`,
  applied via `wrapRoutes` in `server.ts`).
- Allowed origins are read from `ALLOWED_ORIGINS` and support comma-separated values.
- Preflight (`OPTIONS`) rejects disallowed origins with `403`.
- Credentials are enabled (`Access-Control-Allow-Credentials: true`).

## Routes

### GET /stream

- Purpose: SSE stream with latest tracked buses.
- Auth: Required (`sessionToken` cookie, validated by middleware).
- Response headers include:
    - `Content-Type: text/event-stream`
    - `Cache-Control: no-cache`
    - `Connection: keep-alive`
    - CORS headers based on request origin.
- A newly connected client is sent the current snapshot immediately, then one snapshot per
  `SSE_INTERVAL` from the shared broadcast timer. Without the immediate send a client that connected
  just after a tick sat on an empty map for a full interval.
- The broadcast interval is started on the first subscriber and torn down when the last one
  disconnects.
- Payload format:

```text
data: [{"id":1,"lat":12.34,"lng":56.78,"timestamp":1690000000000}]

```

### POST /update

- Purpose: Record one bus position in backend memory. Posted directly by the driver app.
- Auth: `Authorization: Bearer <jwt>` carrying `role: 'driver'`, or `x-api-key` matching
  `SIM_API_KEY` when that variable is set (it is not, in production).
- Request content type: `text/plain`.
- Body: `busId,lat,lng,timestampMillis` — e.g. `12,13.0827,80.2707,1690000000000`.
- Response: `200 OK`, body `OK`. `400` on a malformed payload, `401` when unauthenticated.
- Validation: four finite numbers, `lat`/`lng` in range, `id` a positive integer, and a timestamp
  no more than 2 minutes ahead of now or 24 hours behind it.
- Rule: A bus update is applied only if incoming `timestamp` is newer.
- A bus with no fix for `BUS_EVICT_AFTER_MS` (default 1h) is dropped from the snapshot.
- Not rate limited at the route level — drivers behind one carrier NAT would share a bucket.
  nginx's `limit_req` zone fronts this path instead.

### GET /health

- Purpose: Liveness for an external uptime monitor.
- Auth: None. A monitor cannot log in.
- Success: `200` `{ "status": "ok", "uptimeSeconds": 1234 }`
- Deliberately shallow — it does not touch Postgres. The backend refuses to boot if Neon is
  unreachable, so a live process already implies the database was reachable at startup, and a
  database blip afterwards does not stop bus tracking (locations are in memory).
- Not rate limited, and excluded from nginx's `limit_req` zones: a throttled health check returns
  `429`, which a monitor reports as an outage, so the check would page you about itself.

### POST /auth/send-otp

- Purpose: Generate OTP, store hash, and send email.
- Rate limit: 60 requests / 300 seconds per IP.
- Request body:

```json
{ "email": "user@example.com" }
```

- Success: `200` `{ "success": true }`
- Errors:
    - `403` email not on the paid-transport allowlist (`ADMIN_EMAILS` addresses are exempt)
    - `500` mail failure
    - `429` rate limit exceeded

### POST /auth/register

- Purpose: Verify OTP, create user, issue session cookie.
- Rate limit: 100 requests / 300 seconds per IP.
- Request body:

```json
{ "username": "alice", "email": "alice@example.com", "password": "s3cr3t123", "otp": "123456" }
```

- Success: `200` with `{ success: true, user }` and `sessionToken` cookie.
- Notable errors:
    - `401` invalid OTP
    - `401` OTP expired (`OTP expired. Please request a new one.`)
    - `400` duplicate email
    - `429` rate limit exceeded

### POST /auth/login

- Purpose: Validate credentials and issue session cookie.
- Rate limit: 100 requests / 300 seconds per IP.
- Request body:

```json
{ "email": "alice@example.com", "password": "s3cr3t123" }
```

- Success: `200` with `{ success: true, user }` and `sessionToken` cookie.
- Errors: `400`, `401`, `429`.

### GET /auth/me

- Purpose: Validate current session and return current user payload.
- Auth: Required (`sessionToken` cookie).
- Success: `200` `{ "success": true, "authenticated": true, "user": { ... } }`
- Failure: `401` `{ "success": false, "authenticated": false }`
- Not rate limited in the backend. nginx gives it its own higher-rate zone, separate from the rest
  of `/auth/`, because the frontend calls it on every mount.

### POST /auth/logout

- Purpose: Clear auth cookie.
- Success: `200` `{ "success": true }`
- Clearing the cookie does not invalidate the token. There is no revocation list — a copied
  `sessionToken` stays valid until `SESSION_MAX_AGE` elapses. Rotating `JOSE_SECRET_KEY` is the only
  way to invalidate issued tokens, and it invalidates all of them.

### POST /driver/login

- Purpose: Authenticate a driver and return a JWT bearer token.
- Rate limit: 10 requests / 300 seconds per IP.
- Request body:

```json
{ "email": "driver@example.com", "password": "s3cr3t123" }
```

- Success: `200` `{ "success": true, "token": "<jwt>", "driver": { "id", "username", "email" } }`
- Errors:
    - `400` validation failure
    - `401` invalid credentials
    - `429` rate limit exceeded

### GET /driver/me

- Purpose: Validate bearer token and return driver payload.
- Auth: Required (`Authorization: Bearer <token>` header).
- Success: `200` `{ "success": true, "authenticated": true, "driver": { ... } }`
- Failure: `401` `{ "success": false, "authenticated": false }`

## Admin Routes

Registered as `/admin/*`; reached from the browser as `/api/admin/*`, since nginx strips the `/api`
prefix before proxying.

All of them go through `verifyAdmin` (`backend/middleware/verifyAdmin.ts`): a valid `sessionToken`
cookie **and** an email listed in `ADMIN_EMAILS`. The two failures are distinguished so the frontend
can tell them apart:

- `401` `{ "success": false, "error": "Not authorized" }` — no valid session
- `403` `{ "success": false, "error": "Admin access required" }` — authenticated, not an admin

Request bodies are validated with zod (`backend/validations/adminValidations.ts`). Emails are
trimmed and lowercased at the boundary, so mixed-case input resolves to the same row the service
layer stores. A malformed body or a failed rule returns `400` with the first message.

None of these routes are rate limited.

### GET /api/admin/allowed-emails

- Purpose: List the signup allowlist (students who have paid for the transport facility).
- Success: `200` `{ "success": true, "emails": [ ... ] }`

### POST /api/admin/allowed-emails

- Purpose: Add an email to the allowlist.
- Body: `{ "email": "student@example.com" }`
- Success: `200` `{ "success": true, "added": true, "email": "student@example.com" }`
- `added` is `false` when the email was already present. Re-inviting someone is a no-op, not an
  error.

### DELETE /api/admin/allowed-emails

- Purpose: Remove an email from the allowlist.
- Body: `{ "email": "student@example.com" }`
- Success: `200` `{ "success": true }`
- `404` `{ "success": false, "error": "Email not in the list" }`
- This only blocks **future** signups. Anyone who already registered keeps their account — remove
  them via `DELETE /api/admin/users`.

### GET /api/admin/users

- Purpose: List registered students (without password hashes).
- Success: `200` `{ "success": true, "users": [ ... ] }`

### DELETE /api/admin/users

- Purpose: Delete a registered student.
- Body: `{ "email": "student@example.com" }`
- Success: `200` `{ "success": true }`
- `400` when the email matches the acting admin's own session — removing yourself would lock you out
  of the page you are standing on.
- `404` `{ "success": false, "error": "No such user" }`

### GET /api/admin/drivers

- Purpose: List drivers (without password hashes).
- Success: `200` `{ "success": true, "drivers": [ ... ] }`

### POST /api/admin/drivers

- Purpose: Create a driver login. This is the expected way to add a driver — there is no driver
  signup endpoint.
- Body: `{ "email": "...", "username": "...", "password": "..." }`
- Rules: valid email, username 1–60 characters, password at least 8 characters.
- Success: `200` `{ "success": true, "driver": { "id", "username", "email" } }`
- `409` `{ "success": false, "error": "A driver with that email exists" }`. The insert itself is the
  uniqueness check; asking first would let two concurrent admins both pass it.

### DELETE /api/admin/drivers

- Purpose: Delete a driver.
- Body: `{ "email": "driver@example.com" }`
- Success: `200` `{ "success": true }`
- `404` `{ "success": false, "error": "No such driver" }`

### POST /api/admin/drivers/password

- Purpose: Reset a driver's password.
- Body: `{ "email": "...", "password": "..." }` (password at least 8 characters)
- Success: `200` `{ "success": true }`
- `404` `{ "success": false, "error": "No such driver" }`
- This does **not** revoke tokens already issued. `verifyLocationSender` checks only the signature
  and the `role` claim and never touches the database, so a token minted before the reset keeps
  working — for `/update` and `/driver/me` — until `SESSION_MAX_AGE` elapses.

## Auth and Session Details

- Cookie name: `sessionToken`
- Token type: JWT (HS256)
- Claims: `id`, `email`, `username`, `role`
- TTL: controlled by `SESSION_MAX_AGE` (seconds)
- Cookie flags: `HttpOnly`, `SameSite=Strict`, `Secure` in production
- Driver token claims: `id`, `email`, `username`, `role`
- Driver tokens are Bearer tokens, not cookies — intended for mobile (Flutter) clients.
- `role` is `student` for session cookies and `driver` for `/driver/login` tokens. Both are signed
  with the same `JOSE_SECRET_KEY`, so a valid signature alone does not establish which kind of token
  it is — `verifyDriver` and `/update` both require `role: 'driver'` explicitly.
  A session cookie is readable from devtools, so without this a student could replay their own token
  as a driver Bearer token and post a fake position for any bus.
- There is no revocation anywhere. Logging out, deleting a user and resetting a driver password all
  leave existing tokens valid until they expire.

## OTP Expiration

- OTP hash is stored in DB with `created_at`.
- Expiry window is controlled by `OTP_EXPIRATION_MINUTES`.
- Expiry is enforced at verification time in register flow.
- Cleanup job also deletes old OTP rows periodically, on an interval derived from the same variable.

## Rate Limiting Summary

Backend limits are in-memory (`rate-limiter-flexible`'s `RateLimiterMemory`), keyed by
`(method, path, client-ip)` where the IP comes from `X-Real-IP`. They are per-instance and do not
share state across replicas.

| Route            | Limit               |
| ---------------- | ------------------- |
| `/auth/send-otp` | 60 requests / 300s  |
| `/auth/register` | 100 requests / 300s |
| `/auth/login`    | 100 requests / 300s |
| `/driver/login`  | 10 requests / 300s  |

Everything else (`/stream`, `/update`, `/health`, `/auth/me`, `/auth/logout`, `/admin/*`) is
unlimited in the backend and fronted by nginx's `limit_req` zones instead.

These numbers are keyed on client IP, and a campus behind one NAT address is **one IP** — so each
limit is shared by every student on that wifi at once, not granted to each of them. That is why they
look generous. The better fix is keying OTP and login on the submitted email, which needs the body
parsed before the limiter runs.

## Environment Variables

All of them are parsed and validated once at startup by `backend/config/env.ts` (zod). No module
reads `Bun.env` directly. A missing or invalid variable prints every problem at once and exits
rather than booting into a broken state.

### Required — no defaults

| Variable            | Purpose                             |
| ------------------- | ----------------------------------- |
| `NEON_POSTGRES_URI` | Postgres connection string          |
| `JOSE_SECRET_KEY`   | Signs all session and driver tokens |
| `ALLOWED_ORIGINS`   | Comma-separated CORS allowlist      |
| `EMAIL_USER`        | Sender account for OTP mail         |
| `EMAIL_PASS`        | App password for `EMAIL_USER`       |

A `JOSE_SECRET_KEY` shorter than 32 characters warns but does not block boot — refusing to start
over a key that already works would take a running deployment offline to make a point.

### Optional — with defaults

| Variable                 | Default       | Purpose                                           |
| ------------------------ | ------------- | ------------------------------------------------- |
| `ADMIN_EMAILS`           | `''`          | Comma-separated admins; exempt from the allowlist |
| `SIM_API_KEY`            | unset         | Enables the `x-api-key` path on `POST /update`    |
| `NODE_ENV`               | `development` | `production` sets `Secure` on the session cookie  |
| `LOG_LEVEL`              | `info`        | One of `info`, `debug`, `warn`                    |
| `SERVER_PORT`            | `3000`        | Listen port                                       |
| `SESSION_MAX_AGE`        | `604800`      | Token TTL in seconds (7 days)                     |
| `SSE_INTERVAL`           | `5000`        | SSE broadcast interval in ms                      |
| `BUS_EVICT_AFTER_MS`     | `3600000`     | Drop a bus from the snapshot after this long      |
| `OTP_EXPIRATION_MINUTES` | `15`          | OTP validity, and the cleanup job's interval      |

Numeric variables are coerced and range-checked, so a typo'd `SSE_INTERVAL=0` is caught at boot
rather than becoming an interval that never fires.
