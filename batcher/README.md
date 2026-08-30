# Batcher

Batcher is the update aggregation service for Polaris.

## Responsibilities

- Accept high-frequency plain-text bus updates.
- Authenticate update source (driver Bearer JWT; `x-api-key` only if `SIM_API_KEY` is set).
- Reject payloads whose numbers are malformed, out of range, or timestamped outside the accepted window.
- Forward buffered updates to backend as `BusDetails[]` JSON.

## Run

```bash
bun install
bun dev
```

## Environment

- `BATCHER_PORT`
- `TARGET_URL`
- `INTERVAL`
- `SIM_API_KEY` (optional; unset in production)
- `JOSE_SECRET_KEY`
- `LOG_LEVEL`

See `BATCHER.md` for full details.
