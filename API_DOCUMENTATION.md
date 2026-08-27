# Transport App API Documentation

## Overview

- Base server runtime: Bun.
- Route registration: `backend/server.ts`.
- Controllers: `backend/controllers/*`.
- Default payload format: JSON (except `batcher /update` plain text payload).

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

- Purpose: Update one or more bus positions in backend memory.
- Auth: Not enforced at backend route level; expected caller is internal batcher service.
- Request content type: `application/json`.
- Accepts either one `BusDetails` object or an array of `BusDetails`.
- Response: `200 OK`, body `OK`.
- Rule: A bus update is applied only if incoming `timestamp` is newer.

### POST /auth/send-otp

- Purpose: Generate OTP, store hash, and send email.
- Rate limit: 5 requests / 300 seconds per IP.
- Request body:

```json
{ "email": "user@example.com" }
```

- Success: `200` `{ "success": true }`
- Errors:
    - `403` email not allowlisted
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
- Claims: `id`, `email`, `username`
- TTL: controlled by `SESSION_MAX_AGE` (seconds)
- Cookie flags: `HttpOnly`, `SameSite=Strict`, `Secure` in production
- Driver token claims: `id`, `email`, `username`
- Driver tokens are Bearer tokens, not cookies — intended for mobile (Flutter) clients.

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
- `INTERVAL` (SSE interval in ms, default `5000`)
- `CORS_ORIGIN` (comma-separated allowlist)
- `JOSE_SECRET_KEY`
- `SESSION_MAX_AGE`
- `OTP_EXPIRATION_MINUTES`
- `NODE_ENV`
