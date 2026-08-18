import 'package:flutter/material.dart';

/// Colors ported verbatim from the web app's design tokens
/// (`frontend/src/index.css`) so the app matches the student/driver web UI.
class P {
    // Light
    static const background = Color(0xFFFFFFFF);
    static const foreground = Color(0xFF282A37);
    static const card = Color(0xFFFFFFFF);
    static const primary = Color(0xFF282A37);
    static const primaryFg = Color(0xFFFFFFFF);
    static const secondary = Color(0xFFF5F5F5);
    static const mutedFg = Color(0xFF666666);
    static const border = Color(0xFFE0E0E0);

    // Dark
    static const backgroundDark = Color(0xFF282A37);
    static const foregroundDark = Color(0xFFFFFFFF);
    static const cardDark = Color(0xFF323546);
    static const primaryDark = Color(0xFFFFFFFF);
    static const primaryFgDark = Color(0xFF282A37);
    static const secondaryDark = Color(0xFF323546);
    static const mutedFgDark = Color(0xFF999999);
    static const borderDark = Color(0xFF3D3F4D);

    // Shared status colors (literal Tailwind values used by the web StatusBadge)
    static const destructive = Color(0xFFEF4444);
    static const green = Color(0xFF22C55E);
    static const amber = Color(0xFFFBBF24);
    static const chartBlue = Color(0xFF3B82F6);

    static ThemeData light() => _build(Brightness.light);
    static ThemeData dark() => _build(Brightness.dark);

    static ThemeData _build(Brightness b) {
        final isDark = b == Brightness.dark;
        final bg = isDark ? backgroundDark : background;
        final fg = isDark ? foregroundDark : foreground;
        final pri = isDark ? primaryDark : primary;
        final priFg = isDark ? primaryFgDark : primaryFg;

        return ThemeData(
            useMaterial3: true,
            brightness: b,
            scaffoldBackgroundColor: bg,
            colorScheme: ColorScheme(
                brightness: b,
                primary: pri,
                onPrimary: priFg,
                secondary: isDark ? secondaryDark : secondary,
                onSecondary: fg,
                error: destructive,
                onError: Colors.white,
                surface: isDark ? cardDark : card,
                onSurface: fg,
                outline: isDark ? borderDark : border,
            ),
            textTheme: (isDark ? Typography.whiteMountainView : Typography.blackMountainView)
                .apply(bodyColor: fg, displayColor: fg),
        );
    }
}

/// Theme-aware token lookup, so widgets can read the same names as the web CSS.
class Tk {
    Tk(this.ctx);
    final BuildContext ctx;

    bool get isDark => Theme.of(ctx).brightness == Brightness.dark;

    Color get background => isDark ? P.backgroundDark : P.background;
    Color get foreground => isDark ? P.foregroundDark : P.foreground;
    Color get card => isDark ? P.cardDark : P.card;
    Color get primary => isDark ? P.primaryDark : P.primary;
    Color get primaryFg => isDark ? P.primaryFgDark : P.primaryFg;
    Color get secondary => isDark ? P.secondaryDark : P.secondary;
    Color get mutedFg => isDark ? P.mutedFgDark : P.mutedFg;
    Color get border => isDark ? P.borderDark : P.border;
    Color get destructive => P.destructive;
}
