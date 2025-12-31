# Batcher Service — README

## Purpose

The batcher service receives many small textual bus updates, buffers them in memory, groups them into batches on a fixed interval, and forwards each batch as a JSON array of `BusDetails` to the main service `POST /update` endpoint.

This reduces the number of requests the main service must handle and allows senders to push lightweight text payloads.

## Where the code lives

-   Implementation: [batcher/index.ts](batcher/index.ts#L1-L200)

## Routes

-   `POST /update`

    -   Accepts a plain text body in the `BusText` format: `"{id},{lat},{lng},{timestamp}"` (e.g. `"1,12.34,56.78,1690000000000"`).
    -   Each request appends the `BusText` string to an in-memory buffer and returns a plain text `OK` response.
    -   No authentication.

-   `GET /health`
    -   Returns a JSON object summarizing the service status:
        -   `status`: always `'OK'` when the process is running
        -   `buffer`: number of queued items currently waiting to be batched
        -   `totalRequests`: total `POST /update` requests received since start

Example `GET /health` response:

```json
{ "status": "OK", "buffer": 12, "totalRequests": 1234 }
```

## Internal behavior

-   In-memory `buffer` collects `BusText` strings. The buffer is not persisted — process restart will lose buffered items.
-   Every `INTERVAL` milliseconds (default 5000), the service:
    1. Copies the current buffer to a `batch` and clears `buffer`.
    2. Converts each `BusText` entry to a `BusDetails` object: `{ id, lat, lng, timestamp }`.
    3. POSTs the JSON array `BusDetails[]` to `TARGET_URL`.
    4. If the forwarding `fetch` fails, the batch is requeued at the front of the buffer for retry.

## Payload formats

-   BusText (single update, plain text body):

    1. Format: `${number},${number},${number},${number}`
    2. Example: `1,12.3456,78.9012,1690000000000`

-   BusDetails (forwarded JSON object):

```json
[{ "id": 1, "lat": 12.3456, "lng": 78.9012, "timestamp": 1690000000000 }]
```

## Environment variables / configuration

-   `INTERVAL` — batching interval in milliseconds (default `5000`).
-   `TARGET_URL` — where batches are forwarded (default `http://localhost:3000/update`).
-   `BATCHER_PORT` — port the batcher listens on for incoming `POST /update` (default `4000`).

Set these in the environment or in a process manager before starting the batcher.

## Running locally

Start the batcher (same way as in the repo):

```bash
# from repo root
bun batcher/index.ts
```

Or run from the `batcher` folder (installs and dev script available there):

```bash
cd batcher
bun install
bun dev
```

## Examples

-   Send a single BusText update using `curl`:

```bash
curl -X POST http://localhost:4000/update -d '1,12.34,56.78,1690000000000'
```

-   Check health:

```bash
curl http://localhost:4000/health
```

-   What the batcher forwards (example):

```json
[
    { "id": 1, "lat": 12.34, "lng": 56.78, "timestamp": 1690000000000 },
    { "id": 2, "lat": 11.11, "lng": 22.22, "timestamp": 1690000001000 }
]
```

## Operational notes & caveats

-   The buffer is in-memory only — consider durable queuing if losing data on restart is unacceptable.
-   The batcher requeues failed batches by unshifting them back into the buffer; this may cause repeated immediate retries if the target is down. Consider exponential backoff for production.
-   Monitor the `buffer` size (via `/health`) to detect blocked forwarding to `TARGET_URL`.
-   Logging: the service logs received request count and each `[BATCH] sent N` event.

---
