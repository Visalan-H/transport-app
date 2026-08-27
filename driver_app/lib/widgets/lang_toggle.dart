import 'package:flutter/material.dart';

import '../theme.dart';

/// EN | TA pill, mirroring the toggle on the web driver page.
class LangToggle extends StatelessWidget {
    const LangToggle({super.key, required this.isTamil, required this.onToggle});

    final bool isTamil;
    final VoidCallback onToggle;

    @override
    Widget build(BuildContext context) {
        final k = Tk(context);
        return GestureDetector(
            onTap: onToggle,
            child: Container(
                height: 36,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                    color: k.secondary,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: k.border),
                ),
                child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                        Text(
                            'EN',
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                color: isTamil ? k.mutedFg : k.primary,
                            ),
                        ),
                        Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            child: Text('|', style: TextStyle(color: k.border)),
                        ),
                        Text(
                            'TA',
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                color: isTamil ? k.primary : k.mutedFg,
                            ),
                        ),
                    ],
                ),
            ),
        );
    }
}
