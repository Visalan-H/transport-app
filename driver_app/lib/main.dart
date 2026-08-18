import 'package:flutter/material.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';

import 'data/store.dart';
import 'l10n.dart';
import 'screens/driver_screen.dart';
import 'screens/login_screen.dart';
import 'theme.dart';

void main() {
    WidgetsFlutterBinding.ensureInitialized();
    // Required before the UI can exchange data with the background task.
    FlutterForegroundTask.initCommunicationPort();
    runApp(const PolarisApp());
}

class PolarisApp extends StatefulWidget {
    const PolarisApp({super.key});

    @override
    State<PolarisApp> createState() => _PolarisAppState();
}

class _PolarisAppState extends State<PolarisApp> {
    bool _loading = true;
    bool _signedIn = false;
    bool _tamil = false;

    @override
    void initState() {
        super.initState();
        _load();
    }

    Future<void> _load() async {
        final token = await Store.token();
        final tamil = await Store.isTamil();
        if (!mounted) return;
        setState(() {
            _signedIn = token != null && token.isNotEmpty;
            _tamil = tamil;
            _loading = false;
        });
    }

    void _toggleLang() {
        setState(() => _tamil = !_tamil);
        Store.setTamil(_tamil);
    }

    void _onSignedIn() => setState(() => _signedIn = true);

    Future<void> _onSignedOut() async {
        await Store.clearToken();
        if (!mounted) return;
        setState(() => _signedIn = false);
    }

    @override
    Widget build(BuildContext context) {
        final t = _tamil ? T.ta : T.en;

        return MaterialApp(
            title: 'Polaris Driver',
            debugShowCheckedModeBanner: false,
            theme: P.light(),
            darkTheme: P.dark(),
            themeMode: ThemeMode.system,
            home: _loading
                ? const Scaffold(body: Center(child: CircularProgressIndicator()))
                : _signedIn
                    ? DriverScreen(
                        t: t,
                        isTamil: _tamil,
                        onToggleLang: _toggleLang,
                        onSignOut: _onSignedOut,
                      )
                    : LoginScreen(
                        t: t,
                        isTamil: _tamil,
                        onToggleLang: _toggleLang,
                        onSignedIn: _onSignedIn,
                      ),
        );
    }
}
