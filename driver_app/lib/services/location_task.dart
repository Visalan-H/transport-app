import 'dart:async';
import 'dart:convert';

import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:geolocator/geolocator.dart';

import '../config.dart';
import '../data/api.dart';
import '../data/store.dart';

/// Entry point for the background isolate. Must be top-level and annotated so
/// it survives tree-shaking in release builds.
@pragma('vm:entry-point')
void startLocationTask() {
    FlutterForegroundTask.setTaskHandler(LocationTaskHandler());
}

/// Snapshot of the task's state, sent to the UI isolate after every tick.
class TaskStatus {
    static const kSent = 'sent';
    static const kLastSuccessMs = 'lastSuccessMs';
    static const kHasPending = 'hasPending';
    static const kAuthFailed = 'authFailed';
    static const kFixAcquired = 'fixAcquired';
    static const kServiceOff = 'serviceOff';
}

/// Runs inside the foreground service's own Flutter engine, so it keeps going
/// when the activity is destroyed (app swiped away, screen off, device dozing).
///
/// Delivery model: hold only the NEWEST unsent fix and retry it every tick.
/// A backlog replay would be worthless for live tracking — when the network
/// comes back, what matters is where the bus is *now*, not where it was during
/// the tunnel. Superseding also means the queue can never grow unbounded.
class LocationTaskHandler extends TaskHandler {
    StreamSubscription<Position>? _sub;

    Position? _pending;
    String? _busId;
    String? _token;
    String? _updateUrl;

    int _sent = 0;
    int? _lastSuccessMs;
    bool _authFailed = false;
    bool _fixAcquired = false;
    bool _sending = false;

    @override
    Future<void> onStart(DateTime timestamp, TaskStarter starter) async {
        _busId = await FlutterForegroundTask.getData<String>(key: TaskKeys.busId);
        _token = await FlutterForegroundTask.getData<String>(key: TaskKeys.token);
        _updateUrl = await FlutterForegroundTask.getData<String>(key: TaskKeys.updateUrl);

        await _startStream();
        _emit();
    }

    Future<void> _startStream() async {
        await _sub?.cancel();

        // forceLocationManager stays false: geolocator already falls back to
        // the legacy LocationManager automatically when Play Services is
        // missing, and the fused provider is better on battery and accuracy
        // when it is present.
        final settings = AndroidSettings(
            accuracy: LocationAccuracy.high,
            distanceFilter: 0,
            intervalDuration: Config.sendInterval,
        );

        _sub = Geolocator.getPositionStream(locationSettings: settings).listen(
            (pos) {
                _fixAcquired = true;
                _pending = pos; // newest wins
                _flush();
            },
            onError: (Object e) {
                // Location services switched off mid-trip, or the provider
                // died. Keep the service alive and keep retrying — do NOT let
                // the task end, or tracking would stop silently.
                _fixAcquired = false;
                _emit();
                Future.delayed(const Duration(seconds: 10), _startStream);
            },
            cancelOnError: false,
        );
    }

    /// Called every [Config.sendInterval]. Acts as the retry heartbeat: if the
    /// GPS stream goes quiet or the network was down, this keeps trying.
    @override
    void onRepeatEvent(DateTime timestamp) {
        _flush();
    }

    Future<void> _flush() async {
        if (_sending || _authFailed) return;
        final pos = _pending;
        final busId = _busId;
        final token = _token;
        final url = _updateUrl;
        if (pos == null || busId == null || token == null || url == null) {
            _emit();
            return;
        }

        _sending = true;
        try {
            // Guard against providers reporting a bogus epoch timestamp.
            final ts = pos.timestamp.millisecondsSinceEpoch;
            final now = DateTime.now().millisecondsSinceEpoch;
            final stamp = ts < 946684800000 ? now : ts;

            final result = await Api.sendLocation(
                updateUrl: url,
                token: token,
                busId: busId,
                lat: pos.latitude,
                lng: pos.longitude,
                timestampMillis: stamp,
            );

            switch (result) {
                case SendResult.ok:
                    // Only clear if a newer fix hasn't replaced it meanwhile.
                    if (identical(_pending, pos)) _pending = null;
                    _sent++;
                    _lastSuccessMs = DateTime.now().millisecondsSinceEpoch;
                case SendResult.authFailed:
                    _authFailed = true;
                case SendResult.failed:
                    break; // keep _pending, retry next tick
            }
        } finally {
            _sending = false;
            _updateNotification();
            _emit();
        }
    }

    void _updateNotification() {
        final stale = _isStale;
        final String text;
        if (_authFailed) {
            text = 'Signed out — open Polaris to sign in again';
        } else if (!_fixAcquired) {
            text = 'Waiting for GPS...';
        } else if (stale) {
            text = 'No network — retrying';
        } else {
            text = 'Live · $_sent updates sent';
        }
        FlutterForegroundTask.updateService(
            notificationTitle: 'Polaris — sharing location',
            notificationText: text,
        );
    }

    bool get _isStale {
        if (_lastSuccessMs == null) return true;
        return DateTime.now().millisecondsSinceEpoch - _lastSuccessMs! >
            Config.staleAfter.inMilliseconds;
    }

    void _emit() {
        FlutterForegroundTask.sendDataToMain(jsonEncode({
            TaskStatus.kSent: _sent,
            TaskStatus.kLastSuccessMs: _lastSuccessMs,
            TaskStatus.kHasPending: _pending != null,
            TaskStatus.kAuthFailed: _authFailed,
            TaskStatus.kFixAcquired: _fixAcquired,
        }));
    }

    /// The UI sends a refreshed JWT here after a re-login, so a long shift can
    /// recover without the driver having to stop and restart broadcasting.
    @override
    void onReceiveData(Object data) {
        if (data is String) {
            try {
                final map = jsonDecode(data) as Map<String, dynamic>;
                final token = map[TaskKeys.token] as String?;
                if (token != null && token.isNotEmpty) {
                    _token = token;
                    _authFailed = false;
                    _flush();
                }
            } catch (_) {}
        }
    }

    @override
    void onNotificationPressed() => FlutterForegroundTask.launchApp('/');

    @override
    Future<void> onDestroy(DateTime timestamp, bool isTimeout) async {
        await _sub?.cancel();
        _sub = null;
    }
}
