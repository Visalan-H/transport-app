# Polaris Frontend

Frontend client for the Saveetha Transport Tracker.

## Stack

- React + TypeScript + Vite
- MapLibre via react-map-gl
- Tailwind CSS

## Run

```bash
bun install
bun dev
```

## Build

```bash
bun run build
bun run preview
```

## Runtime Notes

- Auth uses cookie-based sessions (`withCredentials` enabled in API client).
- Real-time location updates are consumed from SSE `/stream`.
- Map icon/image registration is resilient across route navigation.
- Nearby bus calculation is bounded for better performance.
