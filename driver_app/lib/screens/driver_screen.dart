import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:geolocator/geolocator.dart';

import '../config.dart';
import '../data/bus_routes.dart';
import '../data/store.dart';
import '../l10n.dart';
import '../services/location_task.dart';
import '../theme.dart';
import '../widgets/lang_toggle.dart';

enum _ErrKind { none, permission, locationOff, generic }

class DriverScreen extends StatefulWidget {
    const DriverScreen({
        super.key,
        required this.t,
        required this.isTamil,
        required this.onToggleLang,
        required this.onSignOut,
    });

    final T t;
    final bool isTamil;
    final VoidCallback onToggleLang;
    final Future<void> Function() onSignOut;

    @override
    State<DriverScreen> createState() => _DriverScreenState();
}

class _DriverScreenState extends State<DriverScreen> {
    String _busId = '';
    bool _running = false;
    bool _starting = false;
    _ErrKind _err = _ErrKind.none;
    String _validationError = '';

    // Mirrored from the background task.
    int _sent = 0;
    int? _lastSuccessMs;
    bool _authFailed = false;
    bool _fixAcquired = false;
    bool _signingOutForcibly = false;

    // When the current broadcasting session began — used to give the first
    // connection attempt a grace period before treating it as "stale" (see
    // [_isStale]), so startup doesn't flash a "can't connect" state.
    int? _startedAtMs;

    Timer? _ticker;

    @override
    void initState() {
        super.initState();
        FlutterForegroundTask.addTaskDataCallback(_onTaskData);
        _restore().then((_) {
            // Only prompt for a bus on first-ever launch — once one is
            // picked and persisted, respect it on every subsequent login.
            if (!mounted || _busId.isNotEmpty) return;
            WidgetsBinding.instance.addPostFrameCallback((_) {
                Future.delayed(const Duration(milliseconds: 500), () async {
                    if (!mounted) return;
                    final picked = await showModalBottomSheet<String>(
                        context: context,
                        isScrollControlled: true,
                        backgroundColor: Tk(context).card,
                        shape: const RoundedRectangleBorder(
                            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                        ),
                        builder: (_) => _BusPickerSheet(t: widget.t, selected: _busId),
                    );
                    if (picked == null) return;
                    await Store.setBusId(picked);
                    if (!mounted) return;
                    setState(() => _busId = picked);
                });
            });
        });
        // Drives the staleness indicator — the driver must be able to see at a
        // glance that updates have stopped reaching the server.
        _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
            if (mounted && _running) setState(() {});
        });
    }

    @override
    void dispose() {
        _ticker?.cancel();
        FlutterForegroundTask.removeTaskDataCallback(_onTaskData);
        super.dispose();
    }

    Future<void> _restore() async {
        final busId = await Store.busId() ?? '';
        final running = await FlutterForegroundTask.isRunningService;
        if (!mounted) return;
        setState(() {
            _busId = busId;
            _running = running;
            // Unknown true start time on restore — grant a fresh grace period
            // rather than immediately flashing a stale/error state.
            if (running) _startedAtMs = DateTime.now().millisecondsSinceEpoch;
        });
    }

    void _onTaskData(Object data) {
        if (data is! String) return;
        try {
            final m = jsonDecode(data) as Map<String, dynamic>;
            if (!mounted) return;
            final authFailed = (m[TaskStatus.kAuthFailed] as bool?) ?? false;
            setState(() {
                _sent = (m[TaskStatus.kSent] as int?) ?? _sent;
                _lastSuccessMs = m[TaskStatus.kLastSuccessMs] as int?;
                _authFailed = authFailed;
                _fixAcquired = (m[TaskStatus.kFixAcquired] as bool?) ?? false;
            });
            // The stored token is expired/invalid — stop broadcasting and
            // drop back to the login screen instead of stranding the driver
            // on a "session expired" banner they can't act on.
            if (authFailed) _forceSignOut();
        } catch (_) {}
    }

    Future<void> _forceSignOut() async {
        if (_signingOutForcibly) return;
        _signingOutForcibly = true;
        await FlutterForegroundTask.stopService();
        await widget.onSignOut();
    }

    bool get _isStale {
        if (!_running) return false;
        // Before the first successful send, judge staleness from when
        // broadcasting started rather than treating "no success yet" as
        // instantly stale — the very first attempt needs time to land.
        final referenceMs = _lastSuccessMs ?? _startedAtMs;
        if (referenceMs == null) return false;
        return DateTime.now().millisecondsSinceEpoch - referenceMs >
            Config.staleAfter.inMilliseconds;
    }

    // ── Permissions ───────────────────────────────────────────────────────────

    /// Returns true when we hold at least "while in use" location permission
    /// and location services are on. Sets [_err] otherwise.
    Future<bool> _ensureLocationReady() async {
        if (!await Geolocator.isLocationServiceEnabled()) {
            setState(() => _err = _ErrKind.locationOff);
            return false;
        }

        var perm = await Geolocator.checkPermission();
        if (perm == LocationPermission.denied) {
            perm = await Geolocator.requestPermission();
        }
        if (perm == LocationPermission.denied ||
            perm == LocationPermission.deniedForever) {
            setState(() => _err = _ErrKind.permission);
            return false;
        }
        return true;
    }

    /// Asked once broadcasting is already working, so the driver has context.
    /// Android 11+ will not grant "Allow all the time" from a dialog — it has
    /// to be chosen in system settings, so we explain why and send them there.
    Future<void> _promptBackgroundIfNeeded() async {
        final perm = await Geolocator.checkPermission();
        if (perm == LocationPermission.always) return;
        if (!mounted) return;

        final t = widget.t;
        final go = await _ask(t.backgroundTitle, t.backgroundBody, t.backgroundBtn);
        if (go == true) await Geolocator.openAppSettings();
    }

    Future<void> _promptBatteryIfNeeded() async {
        if (await FlutterForegroundTask.isIgnoringBatteryOptimizations) return;
        if (!mounted) return;

        final t = widget.t;
        final go = await _ask(t.batteryTitle, t.batteryBody, t.batteryBtn);
        if (go == true) await FlutterForegroundTask.requestIgnoreBatteryOptimization();
    }

    Future<bool?> _ask(String title, String body, String confirm) {
        final k = Tk(context);
        return showDialog<bool>(
            context: context,
            builder: (ctx) => AlertDialog(
                backgroundColor: k.card,
                title: Text(title, style: TextStyle(color: k.foreground, fontWeight: FontWeight.w800)),
                content: Text(body, style: TextStyle(color: k.mutedFg)),
                actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        child: Text(widget.t.later, style: TextStyle(color: k.mutedFg)),
                    ),
                    TextButton(
                        onPressed: () => Navigator.pop(ctx, true),
                        child: Text(confirm, style: TextStyle(color: k.primary, fontWeight: FontWeight.w800)),
                    ),
                ],
            ),
        );
    }

    // ── Service control ───────────────────────────────────────────────────────

    void _initForegroundTask() {
        FlutterForegroundTask.init(
            androidNotificationOptions: AndroidNotificationOptions(
                channelId: 'polaris_location',
                channelName: 'Location sharing',
                channelDescription: 'Shown while your location is being shared.',
                onlyAlertOnce: true,
            ),
            iosNotificationOptions: const IOSNotificationOptions(),
            foregroundTaskOptions: ForegroundTaskOptions(
                eventAction: ForegroundTaskEventAction.repeat(
                    Config.sendInterval.inMilliseconds,
                ),
                // Everything below exists so a shift survives reboots, OEM
                // task killers and low-memory kills.
                autoRunOnBoot: true,
                autoRunOnMyPackageReplaced: true,
                allowWakeLock: true,
                allowWifiLock: true,
                allowAutoRestart: true,
                stopWithTask: false,
            ),
        );
    }

    Future<void> _start() async {
        try {
            await _startInner();
        } catch (_) {
            // Never leave the driver stuck on a spinner with no explanation.
            if (mounted) {
                setState(() {
                    _err = _ErrKind.generic;
                    _starting = false;
                });
            }
        }
    }

    Future<void> _startInner() async {
        final busId = _busId.trim();
        if (busId.isEmpty) {
            setState(() => _validationError = widget.t.errorNoBus);
            return;
        }

        setState(() {
            _validationError = '';
            _starting = true;
            _err = _ErrKind.none;
        });

        final notif = await FlutterForegroundTask.checkNotificationPermission();
        if (notif != NotificationPermission.granted) {
            await FlutterForegroundTask.requestNotificationPermission();
        }

        if (!await _ensureLocationReady()) {
            if (mounted) setState(() => _starting = false);
            return;
        }

        final token = await Store.token();
        if (token == null || token.isEmpty) {
            await widget.onSignOut();
            return;
        }

        // Hand the task everything it needs — it runs in its own isolate and
        // cannot read this one's state.
        await FlutterForegroundTask.saveData(key: TaskKeys.token, value: token);
        await FlutterForegroundTask.saveData(key: TaskKeys.busId, value: busId);
        await FlutterForegroundTask.saveData(
            key: TaskKeys.updateUrl,
            value: Config.updateBaseUrl,
        );
        await Store.setBusId(busId);

        _initForegroundTask();

        if (await FlutterForegroundTask.isRunningService) {
            await FlutterForegroundTask.restartService();
        } else {
            await FlutterForegroundTask.startService(
                serviceId: 2501,
                serviceTypes: [ForegroundServiceTypes.location],
                notificationTitle: widget.t.notifTitle,
                notificationText: widget.t.notifIdle,
                callback: startLocationTask,
            );
        }

        if (!mounted) return;
        setState(() {
            _running = true;
            _starting = false;
            _sent = 0;
            _lastSuccessMs = null;
            _authFailed = false;
            _fixAcquired = false;
            _startedAtMs = DateTime.now().millisecondsSinceEpoch;
        });

        await _promptBackgroundIfNeeded();
        if (!mounted) return;
        await _promptBatteryIfNeeded();
    }

    Future<void> _stop() async {
        await FlutterForegroundTask.stopService();
        if (!mounted) return;
        setState(() {
            _running = false;
            _starting = false;
            _sent = 0;
            _lastSuccessMs = null;
            _authFailed = false;
            _fixAcquired = false;
            _startedAtMs = null;
        });
    }

    Future<void> _retry() async {
        setState(() => _err = _ErrKind.none);
        await _start();
    }

    Future<void> _signOut() async {
        if (_running) {
            final t = widget.t;
            final confirmed = await _ask(t.logoutConfirmTitle, t.logoutConfirmBody, t.logout);
            if (confirmed != true) return;
        }
        await FlutterForegroundTask.stopService();
        await widget.onSignOut();
    }

    // ── UI ────────────────────────────────────────────────────────────────────

    @override
    Widget build(BuildContext context) {
        final k = Tk(context);
        final t = widget.t;
        final tamil = widget.isTamil;

        return Scaffold(
            body: SafeArea(
                child: Center(
                    child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 440),
                        child: Padding(
                            padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                    _header(k, t, tamil),
                                    const SizedBox(height: 24),
                                    Container(
                                        padding: const EdgeInsets.all(16),
                                        decoration: BoxDecoration(
                                            color: k.secondary,
                                            borderRadius: BorderRadius.circular(16),
                                        ),
                                        child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                                _BusSelector(
                                                    busId: _busId,
                                                    disabled: _running || _starting,
                                                    t: t,
                                                    onChanged: (id) => setState(() {
                                                        _busId = id;
                                                        _validationError = '';
                                                    }),
                                                ),
                                                const SizedBox(height: 16),
                                                _statusBadge(k, t),
                                            ],
                                        ),
                                    ),
                                    _animatedBlock(
                                        _validationError.isEmpty
                                            ? null
                                            : Padding(
                                                padding: const EdgeInsets.only(top: 8),
                                                child: Text(
                                                    _validationError,
                                                    style: TextStyle(
                                                        color: k.destructive,
                                                        fontWeight: FontWeight.w700,
                                                        fontSize: 14,
                                                    ),
                                                ),
                                              ),
                                    ),
                                    _animatedBlock(
                                        _authFailed
                                            ? Padding(
                                                padding: const EdgeInsets.only(top: 12),
                                                child: _banner(k, t.sessionExpired, k.destructive),
                                              )
                                            : (_isStale && _running)
                                                ? Padding(
                                                    padding: const EdgeInsets.only(top: 12),
                                                    child: _banner(k, t.staleWarning, P.amber),
                                                  )
                                                : null,
                                    ),
                                    Expanded(
                                        child: Center(
                                            child: _err != _ErrKind.none
                                                ? _errorPrompt(k, t, tamil)
                                                : _trackingButton(k, t, tamil),
                                        ),
                                    ),
                                    if (_running) _liveStats(k, t, tamil),
                                ],
                            ),
                        ),
                    ),
                ),
            ),
        );
    }

    Widget _animatedBlock(Widget? child) => AnimatedSize(
        duration: const Duration(milliseconds: 200),
        alignment: Alignment.topCenter,
        curve: Curves.easeOut,
        child: child ?? const SizedBox(width: double.infinity),
    );

    Widget _header(Tk k, T t, bool tamil) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                        Text(
                            t.title,
                            style: TextStyle(
                                fontSize: tamil ? 24 : 32,
                                fontWeight: FontWeight.w800,
                                height: 1.1,
                                color: k.foreground,
                            ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                            t.subtitle,
                            style: TextStyle(fontSize: tamil ? 12 : 14, color: k.mutedFg),
                        ),
                    ],
                ),
            ),
            const SizedBox(width: 12),
            Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                    LangToggle(isTamil: widget.isTamil, onToggle: widget.onToggleLang),
                    const SizedBox(width: 8),
                    Container(width: 1, height: 20, color: k.border),
                    const SizedBox(width: 4),
                    IconButton(
                        onPressed: _signOut,
                        tooltip: t.logout,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                        icon: Icon(Icons.logout_rounded, size: 20, color: k.mutedFg),
                    ),
                ],
            ),
        ],
    );

    Widget _statusBadge(Tk k, T t) {
        final String label;
        final Color color;

        if (_authFailed) {
            label = t.statusError;
            color = k.destructive;
        } else if (_starting) {
            label = t.statusGetting;
            color = P.amber;
        } else if (_running && _isStale) {
            label = t.statusRetrying;
            color = P.amber;
        } else if (_running && !_fixAcquired) {
            label = t.statusGetting;
            color = P.amber;
        } else if (_running) {
            label = t.statusBroadcasting;
            color = P.green;
        } else if (_err != _ErrKind.none) {
            label = t.statusError;
            color = k.destructive;
        } else {
            label = t.statusIdle;
            color = k.mutedFg;
        }

        return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
                Padding(
                    padding: const EdgeInsets.only(top: 5),
                    child: Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                    ),
                ),
                const SizedBox(width: 8),
                Expanded(
                    child: Text(
                        label,
                        style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: color,
                        ),
                    ),
                ),
            ],
        );
    }

    Widget _banner(Tk k, String text, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withValues(alpha: 0.4)),
        ),
        child: Row(
            children: [
                Icon(Icons.warning_amber_rounded, size: 18, color: color),
                const SizedBox(width: 8),
                Expanded(
                    child: Text(
                        text,
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: color,
                        ),
                    ),
                ),
            ],
        ),
    );

    Widget _trackingButton(Tk k, T t, bool tamil) {
        final label = _running ? t.btnStop : (_starting ? t.btnPending : t.btnStart);
        final bg = _running ? k.destructive : k.primary;
        final fg = _running ? Colors.white : k.primaryFg;

        return Column(
            mainAxisSize: MainAxisSize.min,
            children: [
                GestureDetector(
                    onTap: _starting ? null : (_running ? _stop : _start),
                    child: Opacity(
                        opacity: _starting ? 0.6 : 1,
                        child: Container(
                            width: 210,
                            height: 210,
                            decoration: BoxDecoration(
                                color: bg,
                                shape: BoxShape.circle,
                                boxShadow: [
                                    BoxShadow(
                                        color: bg.withValues(alpha: 0.3),
                                        blurRadius: 28,
                                        offset: const Offset(0, 10),
                                    ),
                                ],
                            ),
                            alignment: Alignment.center,
                            padding: const EdgeInsets.symmetric(horizontal: 24),
                            child: Text(
                                label,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                    fontSize: tamil ? 17 : 20,
                                    fontWeight: FontWeight.w800,
                                    height: 1.3,
                                    color: fg,
                                ),
                            ),
                        ),
                    ),
                ),
                if (_starting) ...[
                    const SizedBox(height: 16),
                    GestureDetector(
                        onTap: () => setState(() => _starting = false),
                        child: Text(
                            t.btnCancel,
                            style: TextStyle(
                                fontSize: tamil ? 12 : 14,
                                color: k.mutedFg,
                                decoration: TextDecoration.underline,
                            ),
                        ),
                    ),
                ],
            ],
        );
    }

    Widget _errorPrompt(Tk k, T t, bool tamil) {
        final isPerm = _err == _ErrKind.permission;
        final isOff = _err == _ErrKind.locationOff;

        final title = isPerm
            ? t.permissionTitle
            : isOff
                ? t.locationOffTitle
                : t.genericErrorTitle;
        final body = isPerm
            ? t.permissionBody
            : isOff
                ? t.locationOffBody
                : t.genericErrorBody;
        final actionLabel = isPerm ? t.permissionBtn : (isOff ? t.locationOffBtn : null);

        return SingleChildScrollView(
            child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                    Container(
                        width: 64,
                        height: 64,
                        decoration: BoxDecoration(
                            color: (isOff ? P.chartBlue : P.amber).withValues(alpha: 0.15),
                            shape: BoxShape.circle,
                        ),
                        child: Icon(
                            isOff ? Icons.location_disabled_rounded : Icons.location_on_rounded,
                            size: 32,
                            color: isOff ? P.chartBlue : P.amber,
                        ),
                    ),
                    const SizedBox(height: 20),
                    Text(
                        title,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            fontSize: tamil ? 16 : 18,
                            fontWeight: FontWeight.w800,
                            color: k.foreground,
                        ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                        body,
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: tamil ? 12 : 14, color: k.mutedFg),
                    ),
                    const SizedBox(height: 20),
                    if (actionLabel != null)
                        SizedBox(
                            width: 260,
                            height: 48,
                            child: FilledButton(
                                onPressed: () async {
                                    if (isOff) {
                                        await Geolocator.openLocationSettings();
                                    } else {
                                        await Geolocator.openAppSettings();
                                    }
                                },
                                style: FilledButton.styleFrom(
                                    backgroundColor: k.primary,
                                    foregroundColor: k.primaryFg,
                                    shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(14),
                                    ),
                                ),
                                child: Text(
                                    actionLabel,
                                    style: const TextStyle(fontWeight: FontWeight.w800),
                                ),
                            ),
                        ),
                    const SizedBox(height: 8),
                    SizedBox(
                        width: 260,
                        height: 48,
                        child: OutlinedButton(
                            onPressed: _retry,
                            style: OutlinedButton.styleFrom(
                                foregroundColor: k.foreground,
                                side: BorderSide(color: k.border),
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(14),
                                ),
                            ),
                            child: Text(
                                t.btnRetry,
                                style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                        ),
                    ),
                ],
            ),
        );
    }

    Widget _liveStats(Tk k, T t, bool tamil) {
        final last = _lastSuccessMs == null
            ? '—'
            : TimeOfDay.fromDateTime(
                DateTime.fromMillisecondsSinceEpoch(_lastSuccessMs!),
              ).format(context);

        return Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
                color: k.secondary,
                borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
                children: [
                    _statRow(k, t.updatesSent, '$_sent', tamil),
                    const SizedBox(height: 10),
                    _statRow(k, t.lastSent, last, tamil, warn: _isStale),
                ],
            ),
        );
    }

    Widget _statRow(Tk k, String label, String value, bool tamil, {bool warn = false}) => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
            Text(
                label,
                style: TextStyle(fontSize: tamil ? 12 : 14, color: k.mutedFg),
            ),
            Text(
                value,
                style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: warn ? P.amber : k.foreground,
                ),
            ),
        ],
    );
}

// ── Bus selector ──────────────────────────────────────────────────────────────

class _BusSelector extends StatelessWidget {
    const _BusSelector({
        required this.busId,
        required this.disabled,
        required this.t,
        required this.onChanged,
    });

    final String busId;
    final bool disabled;
    final T t;
    final ValueChanged<String> onChanged;

    @override
    Widget build(BuildContext context) {
        final k = Tk(context);
        final selectedName = busId.isEmpty ? null : secBusRoutes[int.tryParse(busId)];

        return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
                Text(
                    t.busName.toUpperCase(),
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.4,
                        color: k.mutedFg,
                    ),
                ),
                const SizedBox(height: 8),
                GestureDetector(
                    onTap: disabled
                        ? null
                        : () async {
                            final picked = await showModalBottomSheet<String>(
                                context: context,
                                isScrollControlled: true,
                                useSafeArea: true,
                                backgroundColor: k.card,
                                shape: const RoundedRectangleBorder(
                                    borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                                ),
                                builder: (_) => _BusPickerSheet(t: t, selected: busId),
                            );
                            if (picked != null) onChanged(picked);
                        },
                    child: Opacity(
                        opacity: disabled ? 0.5 : 1,
                        child: Container(
                            height: 56,
                            decoration: BoxDecoration(
                                border: Border(bottom: BorderSide(color: k.border, width: 2)),
                            ),
                            child: Row(
                                children: [
                                    Expanded(
                                        child: Text(
                                            selectedName ?? t.selectBus,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                                fontSize: selectedName != null ? 18 : 16,
                                                fontWeight: selectedName != null
                                                    ? FontWeight.w800
                                                    : FontWeight.w400,
                                                color: selectedName != null
                                                    ? k.foreground
                                                    : k.mutedFg,
                                            ),
                                        ),
                                    ),
                                    Icon(Icons.keyboard_arrow_down_rounded, color: k.mutedFg),
                                ],
                            ),
                        ),
                    ),
                ),
            ],
        );
    }
}

class _BusPickerSheet extends StatefulWidget {
    const _BusPickerSheet({required this.t, required this.selected});

    final T t;
    final String selected;

    @override
    State<_BusPickerSheet> createState() => _BusPickerSheetState();
}

class _BusPickerSheetState extends State<_BusPickerSheet> {
    String _search = '';

    @override
    Widget build(BuildContext context) {
        final k = Tk(context);
        final q = _search.toLowerCase();
        final entries = secBusRoutes.entries
            .where((e) => e.value.toLowerCase().contains(q))
            .toList()
          ..sort((a, b) => a.key.compareTo(b.key));

        final media = MediaQuery.of(context);
        final keyboardHeight = media.viewInsets.bottom;

        final maxSheetHeight = ((media.size.height - media.padding.top - keyboardHeight) * 0.8)
            .clamp(140.0, math.max(140.0, media.size.height * 0.6))
            .toDouble();

        return Padding(
            padding: EdgeInsets.only(bottom: keyboardHeight),
            child: Container(
                constraints: BoxConstraints(maxHeight: maxSheetHeight),
                child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                        Container(
                            margin: const EdgeInsets.only(top: 8, bottom: 4),
                            width: 36,
                            height: 4,
                            decoration: BoxDecoration(
                                color: k.border,
                                borderRadius: BorderRadius.circular(2),
                            ),
                        ),
                        Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            child: TextField(
                                autofocus: true,
                                onChanged: (v) => setState(() => _search = v),
                                style: TextStyle(color: k.foreground),
                                decoration: InputDecoration(
                                    hintText: widget.t.busSearch,
                                    hintStyle: TextStyle(color: k.mutedFg),
                                    filled: true,
                                    fillColor: k.secondary,
                                    contentPadding:
                                        const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                    border: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(12),
                                        borderSide: BorderSide(color: k.border),
                                    ),
                                    enabledBorder: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(12),
                                        borderSide: BorderSide(color: k.border),
                                    ),
                                ),
                            ),
                        ),
                        Flexible(
                            child: entries.isEmpty
                                ? Center(
                                    child: Padding(
                                        padding: const EdgeInsets.all(24),
                                        child: Text(
                                            widget.t.noRoutes,
                                            style: TextStyle(color: k.mutedFg),
                                        ),
                                    ),
                                  )
                                : ListView.separated(
                                    shrinkWrap: true,
                                    itemCount: entries.length,
                                    separatorBuilder: (_, _) =>
                                        Divider(height: 1, color: k.border.withValues(alpha: 0.4)),
                                    itemBuilder: (_, i) {
                                        final e = entries[i];
                                        final isSel = e.key.toString() == widget.selected;
                                        return ListTile(
                                            title: Text(
                                                e.value,
                                                style: TextStyle(
                                                    fontSize: 15,
                                                    fontWeight:
                                                        isSel ? FontWeight.w800 : FontWeight.w500,
                                                    color: isSel ? k.primary : k.foreground,
                                                ),
                                            ),
                                            onTap: () => Navigator.pop(context, e.key.toString()),
                                        );
                                    },
                                  ),
                        ),
                    ],
                ),
            ),
        );
    }
}
