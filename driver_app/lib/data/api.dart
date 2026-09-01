import 'dart:convert';

import 'package:http/http.dart' as http;

/// Outcome of a location push. The caller MUST treat [authFailed] and
/// [failed] differently: an auth failure will never recover on its own and has
/// to be surfaced to the driver, whereas a network failure should be retried
/// silently with the newest fix.
enum SendResult { ok, authFailed, failed }

class LoginResult {
    LoginResult.ok(this.token, this.username)
        : success = true,
          error = null;
    LoginResult.err(this.error)
        : success = false,
          token = null,
          username = null;

    final bool success;
    final String? token;
    final String? username;
    final String? error;
}

class Api {
    /// One shared client so connections are pooled/kept alive — reconnecting
    /// from scratch every 5s on a moving bus wastes time and battery.
    static final http.Client _client = http.Client();

    /// POST {authBaseUrl}/driver/login -> { success, token, driver }
    static Future<LoginResult> login({
        required String baseUrl,
        required String email,
        required String password,
    }) async {
        try {
            final res = await _client
                .post(
                    Uri.parse('$baseUrl/driver/login'),
                    headers: {'Content-Type': 'application/json'},
                    body: jsonEncode({'email': email, 'password': password}),
                )
                .timeout(const Duration(seconds: 20));

            final body = jsonDecode(res.body) as Map<String, dynamic>;
            if (res.statusCode == 200 && body['success'] == true) {
                final driver = body['driver'] as Map<String, dynamic>?;
                return LoginResult.ok(
                    body['token'] as String,
                    (driver?['username'] as String?) ?? '',
                );
            }
            return LoginResult.err((body['error'] as String?) ?? 'Sign in failed');
        } on FormatException {
            return LoginResult.err('Unexpected server response');
        } catch (_) {
            return LoginResult.err('Cannot reach the server');
        }
    }

    /// POST {updateBaseUrl}/update — plain text `busId,lat,lng,timestampMillis`.
    /// Response body is just "OK".
    static Future<SendResult> sendLocation({
        required String updateUrl,
        required String token,
        required String busId,
        required double lat,
        required double lng,
        required int timestampMillis,
    }) async {
        try {
            final res = await _client
                .post(
                    Uri.parse('$updateUrl/update'),
                    headers: {
                        'Content-Type': 'text/plain',
                        'Authorization': 'Bearer $token',
                    },
                    body: '$busId,$lat,$lng,$timestampMillis',
                )
                .timeout(const Duration(seconds: 15));

            if (res.statusCode == 200) return SendResult.ok;
            // 401 => JWT expired or invalid. Retrying cannot fix this.
            if (res.statusCode == 401 || res.statusCode == 403) {
                return SendResult.authFailed;
            }
            return SendResult.failed;
        } catch (_) {
            // Timeout, DNS, no route, TLS — all retryable.
            return SendResult.failed;
        }
    }
}
