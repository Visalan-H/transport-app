# Transport App API Documentation

## Overview

- Base server runtime: Bun.
- Route registration: `backend/server.ts`.
- Controllers: `backend/controllers/*`.
- Default payload format: JSON (except `POST /update`, which takes a plain-text payload).

## Types

- `BusDetails`
    - `id`: number
    - `lat`: number
    - `lng`: number
    - `timestamp`: number

## CORS Behavior

- CORS is applied in middleware wrappers for all route handlers.
- Allowed origins are read from `CORS_ORIGIN` and support comma-separated values.
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
- Not rate limited at the route level — drivers behind one carrier NAT would share a bucket.
  nginx's `limit_req` zone fronts this path instead.

### POST /auth/send-otp

- Purpose: Generate OTP, store hash, and send email.
- Rate limit: 5 requests / 300 seconds per IP.
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
- Rate limit: 20 requests / 300 seconds per IP.
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
- Rate limit: 10 requests / 300 seconds per IP.
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

### POST /auth/logout

- Purpose: Clear auth cookie.
- Success: `200` `{ "success": true }`

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

## OTP Expiration

- OTP hash is stored in DB with `created_at`.
- Expiry window is controlled by `OTP_EXPIRATION_MINUTES`.
- Expiry is enforced at verification time in register flow.
- Cleanup job also deletes old OTP rows periodically.

## Rate Limiting Summary

- `/auth/send-otp`: 5 requests / 300s
- `/auth/register`: 20 requests / 300s
- `/auth/login`: 10 requests / 300s
- `/driver/login`: 10 requests / 300s

## Key Environment Variables

- `SERVER_PORT` (default `3000`)
- `SSE_INTERVAL` (SSE broadcast interval in ms, default `5000`)
- `CORS_ORIGIN` (comma-separated allowlist)
- `JOSE_SECRET_KEY`
- `SESSION_MAX_AGE`
- `OTP_EXPIRATION_MINUTES`
- `NODE_ENV`
