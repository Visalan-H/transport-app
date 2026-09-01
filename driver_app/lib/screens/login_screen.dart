import 'package:flutter/material.dart';

import '../config.dart';
import '../data/api.dart';
import '../data/store.dart';
import '../l10n.dart';
import '../theme.dart';
import '../widgets/lang_toggle.dart';

class LoginScreen extends StatefulWidget {
    const LoginScreen({
        super.key,
        required this.t,
        required this.isTamil,
        required this.onToggleLang,
        required this.onSignedIn,
    });

    final T t;
    final bool isTamil;
    final VoidCallback onToggleLang;
    final VoidCallback onSignedIn;

    @override
    State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
    final _email = TextEditingController();
    final _password = TextEditingController();
    bool _busy = false;
    String? _error;

    @override
    void dispose() {
        _email.dispose();
        _password.dispose();
        super.dispose();
    }

    Future<void> _submit() async {
        final email = _email.text.trim().toLowerCase();
        final password = _password.text;
        if (email.isEmpty || password.isEmpty) {
            setState(() => _error = widget.t.loginFailed);
            return;
        }

        setState(() {
            _busy = true;
            _error = null;
        });

        final res = await Api.login(
            baseUrl: Config.authBaseUrl,
            email: email,
            password: password,
        );

        if (!mounted) return;

        if (res.success) {
            await Store.setToken(res.token!);
            await Store.setDriverName(res.username ?? '');
            if (!mounted) return;
            widget.onSignedIn();
            return;
        }

        setState(() {
            _busy = false;
            _error = res.error;
        });
    }

    @override
    Widget build(BuildContext context) {
        final k = Tk(context);
        final t = widget.t;
        final tamil = widget.isTamil;

        return Scaffold(
            body: SafeArea(
                child: Center(
                    child: SingleChildScrollView(
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                        child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 420),
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                    Row(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                            Expanded(
                                                child: Column(
                                                    crossAxisAlignment: CrossAxisAlignment.start,
                                                    children: [
                                                        Text(
                                                            t.loginTitle,
                                                            style: TextStyle(
                                                                fontSize: tamil ? 24 : 30,
                                                                fontWeight: FontWeight.w800,
                                                                height: 1.15,
                                                                color: k.foreground,
                                                            ),
                                                        ),
                                                        const SizedBox(height: 4),
                                                        Text(
                                                            t.loginSubtitle,
                                                            style: TextStyle(
                                                                fontSize: tamil ? 12 : 14,
                                                                color: k.mutedFg,
                                                            ),
                                                        ),
                                                    ],
                                                ),
                                            ),
                                            const SizedBox(width: 16),
                                            LangToggle(isTamil: tamil, onToggle: widget.onToggleLang),
                                        ],
                                    ),
                                    const SizedBox(height: 32),
                                    _Field(
                                        label: t.email,
                                        controller: _email,
                                        enabled: !_busy,
                                        keyboardType: TextInputType.emailAddress,
                                    ),
                                    const SizedBox(height: 20),
                                    _Field(
                                        label: t.password,
                                        controller: _password,
                                        enabled: !_busy,
                                        obscure: true,
                                        onSubmitted: (_) => _submit(),
                                    ),
                                    AnimatedSize(
                                        duration: const Duration(milliseconds: 200),
                                        alignment: Alignment.topCenter,
                                        curve: Curves.easeOut,
                                        child: _error == null
                                            ? const SizedBox(width: double.infinity)
                                            : Padding(
                                                padding: const EdgeInsets.only(top: 16),
                                                child: Text(
                                                    _error!,
                                                    style: TextStyle(
                                                        color: k.destructive,
                                                        fontWeight: FontWeight.w600,
                                                        fontSize: 14,
                                                    ),
                                                ),
                                              ),
                                    ),
                                    const SizedBox(height: 32),
                                    SizedBox(
                                        height: 52,
                                        child: FilledButton(
                                            onPressed: _busy ? null : _submit,
                                            style: FilledButton.styleFrom(
                                                backgroundColor: k.primary,
                                                foregroundColor: k.primaryFg,
                                                disabledBackgroundColor: k.primary.withValues(alpha: 0.5),
                                                shape: RoundedRectangleBorder(
                                                    borderRadius: BorderRadius.circular(14),
                                                ),
                                            ),
                                            child: Text(
                                                _busy ? t.signingIn : t.signIn,
                                                style: const TextStyle(
                                                    fontSize: 16,
                                                    fontWeight: FontWeight.w800,
                                                ),
                                            ),
                                        ),
                                    ),
                                ],
                            ),
                        ),
                    ),
                ),
            ),
        );
    }
}

class _Field extends StatelessWidget {
    const _Field({
        required this.label,
        required this.controller,
        required this.enabled,
        this.obscure = false,
        this.keyboardType,
        this.onSubmitted,
    });

    final String label;
    final TextEditingController controller;
    final bool enabled;
    final bool obscure;
    final TextInputType? keyboardType;
    final ValueChanged<String>? onSubmitted;

    @override
    Widget build(BuildContext context) {
        final k = Tk(context);
        return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
                Text(
                    label.toUpperCase(),
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.4,
                        color: k.mutedFg,
                    ),
                ),
                const SizedBox(height: 8),
                TextField(
                    controller: controller,
                    enabled: enabled,
                    obscureText: obscure,
                    keyboardType: keyboardType,
                    textInputAction: obscure ? TextInputAction.done : TextInputAction.next,
                    onSubmitted: onSubmitted,
                    style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: k.foreground,
                    ),
                    decoration: InputDecoration(
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(vertical: 12),
                        enabledBorder: UnderlineInputBorder(
                            borderSide: BorderSide(color: k.border, width: 2),
                        ),
                        focusedBorder: UnderlineInputBorder(
                            borderSide: BorderSide(color: k.primary, width: 2),
                        ),
                    ),
                ),
            ],
        );
    }
}
