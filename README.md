# Sec techsociety transport app

A simple bus tracking app.

## API

- `GET /` - serves the frontend `index.html`.
- `GET /stream` - Server-Sent Events (SSE) endpoint. Connect with `EventSource('/stream')` to receive JSON messages in the format: `{ name, lat, lng, timestamp }`.
- `POST /update` - publish a location update. Accepts JSON body `{ name, lat, lng, timestamp }` and returns a 200 response on success.
    - The `timestamp` field (number, ms since epoch) is required and used to ensure only the latest update for each bus is processed.

## Frontend

- The map displays each bus with its name and the time of the latest update (from the `timestamp` field).

## Scripts

- `bun dev` - starts the Bun server (runs `index.ts`) with watch mode.
- `bun sim` - runs the simulation script `simulation/sim.ts` which POSTs random location updates (including `timestamp`) to `/update` every 2 seconds.
- `bun batch` - runs the batcher script `batcher/batcher.ts`.
- `bun vite` - starts the frontend development server (Vite in `frontend/`).
- `bun run format` - formats code using Prettier.
