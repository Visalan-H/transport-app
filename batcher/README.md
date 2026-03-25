# Batcher

Batcher is the update aggregation service for Polaris.

## Responsibilities

- Accept high-frequency plain-text bus updates.
- Authenticate update source (`x-api-key` for GPS, JWT cookie for driver).
- Apply source-priority rules (GPS precedence window).
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
- `GPS_API_KEY`
- `JOSE_SECRET_KEY`
- `LOG_LEVEL`

See `BATCHER.md` for full details.
