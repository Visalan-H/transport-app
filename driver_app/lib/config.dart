/// Endpoint configuration.
///
/// Auth and location-update traffic go to two DIFFERENT services:
///   - `authBaseUrl`   -> backend  (POST /driver/login)
///   - `updateBaseUrl` -> batcher  (POST /update)
/// In production nginx fronts both on one origin and splits by path, so both
/// can be set to the same domain. Locally they are separate ports.
///
/// Override at build time, e.g.:
///   flutter build apk --dart-define=AUTH_BASE_URL=https://polaris.example.com \
///                     --dart-define=UPDATE_BASE_URL=https://polaris.example.com
class Config {
    /// 10.0.2.2 is the Android emulator's alias for the host machine's localhost.
    static const authBaseUrl = String.fromEnvironment(
        'AUTH_BASE_URL',
        defaultValue: 'http://10.0.2.2:3000',
    );

    static const updateBaseUrl = String.fromEnvironment(
        'UPDATE_BASE_URL',
        defaultValue: 'http://10.0.2.2:4000',
    );

    /// How often a location fix is pushed. Matches the web driver page and the
    /// batcher's flush interval.
    static const sendInterval = Duration(seconds: 5);

    /// If nothing has been delivered for this long while broadcasting, the UI
    /// and the notification both surface a warning. Silent failure is the exact
    /// problem this app exists to fix, so staleness must always be visible.
    static const staleAfter = Duration(seconds: 30);
}
