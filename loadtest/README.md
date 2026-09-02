# Load testing

One script, no dependencies. Answers a question nobody has measured: **how many students can watch
the map at once before the backend degrades.**

That number matters because the SSE stream is not request/response. Every viewer holds a connection
open for as long as their tab is, against a container capped at 512MB on a 1GB VM. Ordinary HTTP
benchmarks do not tell you anything about it.

## Running it

```bash
# unauthenticated baseline -- proves nginx and the proxy path are healthy
bun loadtest/stream-load.ts --target https://polaris.visalan.me --path /health --no-stream -n 50

# the real test -- concurrent SSE viewers
bun loadtest/stream-load.ts --target https://polaris.visalan.me --cookie "sessionToken=..." -n 50
```

| flag | default | meaning |
| --- | --- | --- |
| `--target` | `http://localhost:3000` | base URL, no trailing slash |
| `--path` | `/stream` | what to hit |
| `--cookie` | — | required for `/stream`; or set `POLARIS_COOKIE` |
| `-n` | `10` | concurrent connections |
| `--duration` | `30` | seconds to hold them open |
| `--no-stream` | off | fetch and close instead of holding the stream |

### Getting a cookie

`/stream` is behind `verifyUser`. Log in as a normal student, open devtools →
Application → Cookies → copy `sessionToken`.

It is a credential. Prefer `POLARIS_COOKIE=...` in the environment over `--cookie`, which your shell
may write to history.

### On Git Bash / Windows

MSYS rewrites arguments that look like Unix paths, so `--path /stream` becomes a Windows path and the
URL comes out malformed. Export `MSYS_NO_PATHCONV=1` first. Not an issue on the server.

## Reading the output

The script only sees the client side. Watch the server at the same time:

```bash
sudo docker stats --no-stream transport_backend
```

What each number is telling you:

- **connected** below `-n` — the server refused connections. Check `failed` for whether that was a
  429 (rate limiting, a config problem) or a network error (capacity, a real limit).
- **connect p95 climbing** as `-n` rises — the first sign of saturation, and it shows up well before
  anything actually fails.
- **first event p50** — should be near-instant since the backend sends a snapshot on connect. If it
  drifts toward `SSE_INTERVAL` (5s), that immediate send is not happening.
- **connected but silent** — connections held open that never received data. This is the failure mode
  worth caring about: from a student's side the map simply stays empty, with no error anywhere.
- **memory in `docker stats`** — against the 512MB cap. Watch whether it returns to baseline after
  the run; if it does not, connections are not being cleaned up on disconnect.

## Step up gradually

Do not open with the biggest number. Run 10, then 50, then 100, checking `docker stats` between each.
The useful result is *where latency starts climbing*, and that is invisible if the first attempt is
already past it. The script refuses more than 100 connections against production in one go for this
reason.

Also worth knowing: the SSE broadcast interval only runs while at least one client is connected, and
it serialises one snapshot for all of them. So cost should scale with connection count rather than
with work per connection — the test is really checking whether that holds.

## What this does not cover

- Login and signup under load. Those hit Postgres and send email, and hammering them means real OTP
  emails and real Neon usage.
- Sustained load over hours. This holds connections for seconds, so it will not surface a slow leak.
- Anything about the driver app's ingest path.
