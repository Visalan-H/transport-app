# Sec techsociety transport app

A simple bus tracking app.

## API

- `GET /` - serves the frontend `index.html`.
- `GET /stream` - Server-Sent Events (SSE) endpoint. Connect with `EventSource('/stream')` to receive JSON messages in the format: `{ name, lat, lng }`.
- `POST /update` - publish a location update. Accepts JSON body `{ name, lat, lng }` and returns a 200 response on success.

## Scripts

- `bun dev` - starts the Bun server (runs `index.ts`).
- `bun sim` - runs the simulation script `simulation/sim.ts` which POSTs random location updates to `/update` every 2 seconds.
