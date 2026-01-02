# Transport App API Documentation

**Overview:**

-   Base server: Bun. Routes are defined in `server.ts` and handlers live in `controllers/`.
-   JSON is the primary request/response format unless otherwise noted.

**Types**

-   `BusDetails`:
    -   `id` (number)
    -   `lat` (number)
    -   `lng` (number)
    -   `timestamp` (number)

---

**Routes**

-   **GET /** : Serve frontend

    -   Description: Returns the application HTML.
    -   Response: `200 OK` HTML content (`index.html`).

-   **GET /stream** : Server-Sent Events (SSE) stream of current bus locations _(requires authentication)_

    -   Description: Keeps a persistent SSE connection and periodically pushes the current array of `BusDetails` for all tracked buses.
    -   Request: No payload. Connection should set `Accept: text/event-stream` (clients typically use `EventSource`). Must include `sessionToken` cookie.
    -   Authentication: Requires valid session cookie (`sessionToken`). Returns `401` if not authenticated.
    -   Response headers:
        -   `Content-Type: text/event-stream`
        -   `Cache-Control: no-cache`
        -   `Connection: keep-alive`
        -   `Access-Control-Allow-Origin: *`
    -   Event format: Each event body is a single `data:` line containing a JSON array of `BusDetails`, followed by a blank line. Example chunk:

        data: [{"id":1,"lat":12.34,"lng":56.78,"timestamp":1690000000000}]

    -   Notes: Interval is controlled by `INTERVAL` env (ms). Clients should reconnect on disconnect.

-   **POST /update** : Update one or more bus locations _(requires authentication)_

    -   Description: Accepts a single `BusDetails` object or an array of them and updates the server's in-memory state. Requires authentication.
    -   Authentication: Requires valid session cookie (`sessionToken`). Returns `401` if not authenticated.
    -   Request headers: `Content-Type: application/json`
    -   Request payload (single):
        ```json
        { "id": 1, "lat": 12.34, "lng": 56.78, "timestamp": 1690000000000 }
        ```
    -   Request payload (batch):
        ```json
        [
            { "id": 1, "lat": 12.34, "lng": 56.78, "timestamp": 1690000000000 },
            { "id": 2, "lat": 11.11, "lng": 22.22, "timestamp": 1690000001000 }
        ]
        ```
    -   Response: `200 OK` with plain text body `OK`.
    -   Behavior: The server only updates a bus's stored location if the incoming `timestamp` is newer than the stored one.

-   **POST /auth/send-otp** : Request OTP email _(rate limited)_

    -   Description: Sends a verification OTP to supplied email and stores a hashed OTP in DB.
    -   Rate Limiting: Maximum 5 requests per 60 seconds per IP address.
    -   Request headers: `Content-Type: application/json`
    -   Request payload:
        ```json
        { "email": "user@example.com" }
        ```
    -   Success response: `200 OK`
        ```json
        { "success": true }
        ```
    -   Error response (email send failure): `500`
        ```json
        { "success": false, "error": "Failed to send email" }
        ```
    -   Rate limit error: `429`
        ```json
        { "error": "Too many requests" }
        ```
    -   Notes: OTPs are stored hashed and expire logically after 10 minutes (cleanup via `Otp.deleteExpired`).

-   **POST /auth/register** : Register new user using OTP _(rate limited)_

    -   Description: Verifies OTP, creates user, sets a session cookie on success.
    -   Rate Limiting: Maximum 5 requests per 60 seconds per IP address.
    -   Request headers: `Content-Type: application/json`
    -   Request payload:
        ```json
        { "username": "alice", "email": "alice@example.com", "password": "s3cr3t", "otp": "123456" }
        ```
    -   Success response: `200 OK` and sets cookie `sessionToken` (HTTP-only). Body:
        ```json
        { "success": true, "user": { "id": 42, "username": "alice", "email": "alice@example.com" } }
        ```
    -   Possible error responses:
        -   `400` `{ "error": "Username must be 3-20 characters (letters, numbers, underscores)" }` (invalid username)
        -   `400` `{ "error": "Invalid email format" }` (invalid email)
        -   `400` `{ "error": "Password must be at least 8 characters" }` (weak password)
        -   `400` `{ "error": "OTP must be 6 digits" }` (invalid OTP format)
        -   `400` `{ "error": "Send OTP first" }` (no OTP record)
        -   `401` `{ "error": "Invalid OTP" }` (OTP mismatch)
        -   `400` `{ "error": "Email already exists" }` (duplicate email)
        -   `403` `{ "error": "Email not authorized" }` (email not in allowed list)
        -   `429` `{ "error": "Too many requests" }` (rate limit exceeded)
        -   `500` `{ "error": "Registration failed" }` (DB/other failure)

-   **POST /auth/login** : Login existing user _(rate limited)_

    -   Description: Validates credentials and sets session cookie on success.
    -   Rate Limiting: Maximum 5 requests per 60 seconds per IP address.
    -   Request headers: `Content-Type: application/json`
    -   Request payload:
        ```json
        { "email": "alice@example.com", "password": "s3cr3t" }
        ```
    -   Success response: `200 OK` (cookie `sessionToken` set)
        ```json
        { "success": true, "user": { "id": 42, "username": "alice", "email": "alice@example.com" } }
        ```
    -   Failure responses:
        -   `400` `{ "error": "Invalid email format" }` (invalid email)
        -   `400` `{ "error": "Password is required" }` (missing password)
        -   `401` `{ "error": "Invalid credentials" }` (wrong email/password)
        -   `429` `{ "error": "Too many requests" }` (rate limit exceeded)

-   **GET /auth/me** : Get authenticated user

    -   Description: Returns the current user decoded from the `sessionToken` cookie.
    -   Request: Cookie `sessionToken` must be present.
    -   Success response: `200 OK`
        ```json
        { "authenticated": true, "user": { "id": 42, "email": "alice@example.com", "username": "alice" } }
        ```
    -   Failure response: `401` `{ "authenticated": false }` (no/invalid token)

-   **POST /auth/logout** : Logout
    -   Description: Clears the `sessionToken` cookie.
    -   Request: No payload required.
    -   Response: `200 OK`
        ```json
        { "success": true }
        ```

---

**Database Schemas (summary)**

-   `users` table:

    -   `id` (integer, pk, autoincrement)
    -   `username` (text)
    -   `email` (text, unique)
    -   `password_hash` (text)
    -   `created_at` (text)

-   `otps` table:
    -   `id` (integer, pk, autoincrement)
    -   `email` (text)
    -   `otp_hash` (text)
    -   `created_at` (text)

**Authentication / Sessions**

-   Cookie name: `sessionToken` (HTTP-only cookie)
-   Token: Signed JWT (HS256) containing `{ id, email, username }` and expiration set according to `SESSION_MAX_AGE` (env).
-   Protected endpoints: `/stream` and `/update` require valid session cookie.

**Rate Limiting**

-   Endpoints with rate limiting: `/auth/send-otp`, `/auth/register`, `/auth/login`
-   Limit: 5 requests per 60 seconds per IP address
-   Rate limit applied per IP (using `x-forwarded-for`, `cf-connecting-ip`, or direct IP)
-   Response when exceeded: `429 Too Many Requests` with `{ "error": "Too many requests" }`

**Notes & Implementation details**

-   `send-otp` stores a hashed OTP and sends a plain numeric code by email; OTP verification compares provided code against stored hash.
-   `update` accepts both single and batch updates; older timestamps are ignored.
-   SSE stream pushes `BusDetails[]` as the `data:` JSON payload. Clients should parse the JSON from each event data string.
-   Environment variables that affect behavior:
    -   `SERVER_PORT` (default 3000)
    -   `INTERVAL` (SSE broadcast interval, ms, default 5000)
    -   `JOSE_SECRET_KEY` (JWT signing key)
    -   `SESSION_MAX_AGE` (session cookie TTL in seconds, default 604800 = 7 days)
    -   `CORS_ORIGIN` (allowed origin for CORS, default http://localhost:5173)
    -   `NODE_ENV` (set to 'production' to enable secure cookies)

If you want, I can add example curl commands and sample client code for SSE consumption and session-authenticated requests.
