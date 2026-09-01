# Polaris Driver

The Android app drivers use to broadcast their bus's location to Polaris.

This exists because a browser cannot do the job. Once the phone locks or the tab
goes to the background, the web page stops sending — silently, with the driver
believing they are still being tracked. This app runs the tracker in a genuine
Android foreground service instead, so it keeps broadcasting with the screen
off, and it makes failure visible when it does happen.

Android is the only supported platform. The iOS, web and desktop directories are
unused Flutter scaffolding.

## How it works

The driver signs in, picks their bus once, and presses start. From then on the
app pushes a location fix every 5 seconds until they press stop.

Two services are involved, and they are not the same host in development:

| Traffic          | Goes to | Endpoint         | Auth               |
| ---------------- | ------- | ---------------- | ------------------ |
| Sign-in          | backend | `POST /driver/login` | email + password |
| Location updates | batcher | `POST /update`   | Bearer JWT, `role: 'driver'` |

In production nginx fronts both on one origin and splits by path, so both base
URLs are the same domain. See `lib/config.dart`.

### The foreground service

Location tracking runs on its **own isolate** via `flutter_foreground_task`. The
UI isolate cannot read that isolate's memory directly, so state crosses the
boundary explicitly:

- **UI → task**: `FlutterForegroundTask.saveData` / `getData`, one-shot at service
  start (token, bus ID, update URL).
- **task → UI**: `sendDataToMain` / `addTaskDataCallback`, a stream of status
  snapshots — sent count, last success, auth-failed flag, GPS-fix-acquired flag.

The task holds only the **newest** unsent fix and retries it each tick. It does
not queue a backlog: replaying a five-minute-old position onto a live map is
worse than skipping it, and this bounds memory.

If the server rejects the JWT, the task stops sending and raises `authFailed`.
The UI watches for that and signs the driver out — this is the auto-logout path
when a token expires, separate from the manual sign-out button.

### Staleness is surfaced, never hidden

If nothing has been delivered for 30 seconds while broadcasting, both the UI and
the persistent notification say so. Silent failure is the specific problem this
app was built to eliminate, so it is never allowed to look like success.

## Layout

```text
lib/
  config.dart              endpoints, intervals — build-time overridable
  main.dart
  l10n.dart                English / Tamil strings
  theme.dart
  data/
    api.dart               login + update calls
    bus_routes.dart        bus ID -> route name
    store.dart             SharedPreferences: JWT, bus ID, name, language
  screens/
    login_screen.dart
    driver_screen.dart     start/stop, status, bus picker
  services/
    location_task.dart     foreground-service isolate
  widgets/
    lang_toggle.dart
```

`bus_routes.dart` is a verbatim port of `frontend/src/constants/BusIdMap.ts`.
**Keep the two in sync** — there is no shared source for them.

## Running locally

```bash
flutter run -d <device-id> \
  --dart-define=AUTH_BASE_URL=http://10.0.2.2:3000 \
  --dart-define=UPDATE_BASE_URL=http://10.0.2.2:4000
```

`10.0.2.2` is the emulator's alias for the host's localhost. On a **physical
device over USB**, reverse-proxy the ports first — this does not survive a
disconnect:

```bash
adb reverse tcp:3000 tcp:3000 && adb reverse tcp:4000 tcp:4000
```

## Building a release

Signing config comes from `android/key.properties` (gitignored). Copy
`android/key.properties.example` and fill it in; without that file the build
falls back to the debug key, which is fine for testing but not for anything
handed to a driver — Android permanently binds an install to its signing key,
so switching keys later forces every user to uninstall first.

```bash
flutter build apk --split-per-abi --target-platform android-arm64 \
  --dart-define=AUTH_BASE_URL=https://polaris.visalan.me \
  --dart-define=UPDATE_BASE_URL=https://polaris.visalan.me
```

Drop `--target-platform` to also produce the 32-bit `armeabi-v7a` build for
older hardware. Releases carry only the arm64 APK; see the root README.

Base URLs are compiled in, so moving the server means issuing a new APK.

## Permissions

Both are required and the app is useless without them:

- **Location, "Allow all the time"** — not "While using the app", or background
  broadcasting stops.
- **Notifications** — the persistent notification *is* the foreground service.
  Blocking it stops location updates.
