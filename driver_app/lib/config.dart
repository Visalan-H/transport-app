/// Endpoint configuration.
///
/// Both of these now point at the backend — `POST /driver/login` for the token,
/// `POST /update` for location. They stayed as two separate values because the
/// published APK is built with both defined; collapsing them would need a new
/// build for no behavioural gain.
///
/// They used to differ: `/update` was served by a separate batcher service on
/// port 4000. That service was removed — it buffered each fix for up to 5s
/// before forwarding, which only added latency to a live map.
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
        defaultValue: 'http://10.0.2.2:3000',
    );

    /// How often a location fix is pushed. Matches the backend's SSE broadcast
    /// interval, so a fix lands roughly one broadcast before students see it.
    static const sendInterval = Duration(seconds: 5);

    /// If nothing has been delivered for this long while broadcasting, the UI
    /// and the notification both surface a warning. Silent failure is the exact
    /// problem this app exists to fix, so staleness must always be visible.
    static const staleAfter = Duration(seconds: 30);
}
