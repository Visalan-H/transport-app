import 'package:shared_preferences/shared_preferences.dart';

/// Persistent state for the UI isolate.
///
/// The background task isolate cannot read these — it gets what it needs via
/// `FlutterForegroundTask.saveData/getData`, which is explicitly designed for
/// cross-isolate access. Anything the task needs must be mirrored there before
/// the service starts (see [DriverScreen]).
class Store {
    static const _kToken = 'polaris_driver_jwt';
    static const _kBusId = 'polaris_bus_id';
    static const _kLang = 'polaris_lang';
    static const _kDriverName = 'polaris_driver_name';

    static Future<SharedPreferences> get _p => SharedPreferences.getInstance();

    static Future<String?> token() async => (await _p).getString(_kToken);
    static Future<void> setToken(String v) async => (await _p).setString(_kToken, v);
    static Future<void> clearToken() async => (await _p).remove(_kToken);

    static Future<String?> busId() async => (await _p).getString(_kBusId);
    static Future<void> setBusId(String v) async => (await _p).setString(_kBusId, v);

    static Future<String?> driverName() async => (await _p).getString(_kDriverName);
    static Future<void> setDriverName(String v) async => (await _p).setString(_kDriverName, v);

    static Future<bool> isTamil() async => (await _p).getBool(_kLang) ?? false;
    static Future<void> setTamil(bool v) async => (await _p).setBool(_kLang, v);
}

/// Keys shared with the background task isolate via FlutterForegroundTask's
/// own data store.
class TaskKeys {
    static const token = 'token';
    static const busId = 'busId';
    static const updateUrl = 'updateUrl';
}
