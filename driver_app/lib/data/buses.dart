import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../config.dart';
import 'api.dart';
import 'bus_routes.dart';
import 'store.dart';

/// Bus id -> route name, as the server has it.
///
/// The list is edited on the website's /admin page, so a new or renamed route
/// reaches drivers without an app release. It is fetched at app start and
/// whenever the bus picker opens, and every successful fetch is cached on the
/// phone. When a fetch fails the cache is used; the bundled [secBusRoutes] is
/// only used before the first successful fetch ever.
class Buses {
    static final ValueNotifier<Map<int, String>> names = ValueNotifier(secBusRoutes);

    // Memoised so concurrent callers share one read, and a slow cache read can
    // never land after a fresh fetch and overwrite it.
    static Future<void>? _cacheLoad;

    // The storage read is caught inside: this future is memoised, so if it
    // could fail, every later refresh() would rethrow the same error and never
    // reach the server until the app was restarted.
    static Future<void> _loadCache() => _cacheLoad ??= () async {
            try {
                final cached = decode(await Store.busList());
                if (cached != null && cached.isNotEmpty) names.value = cached;
            } catch (_) {}
        }();

    /// Never throws. On any failure the current list (cache or bundled) stays.
    static Future<void> refresh() async {
        await _loadCache();
        final fetched = await Api.fetchBuses(baseUrl: Config.authBaseUrl);
        if (fetched == null || fetched.isEmpty) return;
        names.value = fetched;
        try {
            await Store.setBusList(encode(fetched));
        } catch (_) {
            // Not saved, so the next start shows the old list until it fetches again.
        }
    }

    static String encode(Map<int, String> buses) =>
        jsonEncode([for (final e in buses.entries) {'id': e.key, 'name': e.value}]);

    /// Null for a missing or unreadable cache, so the caller keeps what it has.
    static Map<int, String>? decode(String? raw) {
        if (raw == null || raw.isEmpty) return null;
        try {
            return parseList(jsonDecode(raw));
        } catch (_) {
            return null;
        }
    }

    /// Reads `[{ "id": 1, "name": "MMC 2A" }, ...]`, skipping malformed rows.
    static Map<int, String> parseList(Object? list) {
        final out = <int, String>{};
        if (list is! List) return out;
        for (final row in list) {
            if (row is! Map) continue;
            final id = row['id'];
            final name = row['name'];
            if (id is int && name is String && name.isNotEmpty) out[id] = name;
        }
        return out;
    }
}
