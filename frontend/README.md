# Polaris Frontend

Frontend client for the Saveetha Transport Tracker.

## Stack

- React 19 + TypeScript + Vite
- MapLibre via `react-map-gl`
- Tailwind CSS v4
- PWA via `vite-plugin-pwa`, `injectManifest` strategy — the service worker
  source is `src/sw.ts`, not auto-generated

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

`bun run typecheck` and `bun run lint` both run in CI, and the build is gated on
them.

## Runtime Notes

- Auth uses cookie-based sessions (`withCredentials` enabled in the API client).
  `src/utils/axiosInstance.ts` is the sole HTTP client.
- Real-time location updates are consumed from SSE `/stream`
  (`src/hooks/useLocationStream.ts`), which diffs snapshots to avoid needless
  re-renders.
- Auth state lives in `AuthProvider` (`src/context/AuthContext.tsx`), persisted
  optimistically to `localStorage` and reconciled against `GET /auth/me` on
  mount. `isAdmin` is deliberately dropped when hydrating from storage —
  localStorage is user-editable, so admin status only ever comes from a server
  response.
- Context objects and their hooks live in `src/hooks/`, not beside the providers
  in `src/context/`. That split is required: `react-refresh/only-export-components`
  is enforced in CI and fails any file exporting both a component and a
  non-component.
- Path alias `@` → `src`.
- Map icon/image registration is resilient across route navigation.
- Nearby bus calculation is bounded for better performance.

## Map Tiles

Tiles come from [VersaTiles](https://versatiles.org) (`tiles.versatiles.org`),
which is free and unmetered — no API key, no account, no per-load billing.

The style is **generated at runtime** by `@versatiles/style` rather than fetched
as a `style.json`, so the map can be recoloured to match the app's own light and
dark themes instead of shipping two hand-edited style files. Both themes are
built from the same `shadow` base with a `recolor` pass; light mode is the dark
palette with `invertBrightness`.

`baseUrl` must be passed explicitly — in a browser the library defaults it to
`document.location.origin`, which would point tile requests at this app.

Adding another tile host means adding it to `connect-src` in
`frontend/security-headers.conf`, or the CSP will block it with no visible error.

## nginx

`nginx.conf` is the production server and does more than serve static files:
path-based routing to the backend, gzip, cache headers, `limit_req` zones, and
Cloudflare `real_ip` handling. `security-headers.conf` is `include`d into every
location block — nginx's `add_header` only inherits when the current level
defines none, so one stray `add_header` in a location would silently drop the
CSP.
