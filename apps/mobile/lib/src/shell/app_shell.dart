import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../design/app_theme.dart';

class AppShell extends StatelessWidget {
  const AppShell({required this.navigationShell, super.key});
  final StatefulNavigationShell navigationShell;

  void _select(int index) => navigationShell.goBranch(index,
      initialLocation: index == navigationShell.currentIndex);

  static const _items = [
    (Icons.home_outlined, Icons.home_rounded, 'Home'),
    (Icons.how_to_reg_outlined, Icons.how_to_reg_rounded, 'Attendance'),
    (
      Icons.account_balance_wallet_outlined,
      Icons.account_balance_wallet_rounded,
      'Finance'
    ),
    (Icons.auto_awesome_outlined, Icons.auto_awesome_rounded, 'Gold'),
    (Icons.person_outline_rounded, Icons.person_rounded, 'Account'),
  ];

  @override
  Widget build(BuildContext context) => Scaffold(
        extendBody: true,
        body: navigationShell,
        bottomNavigationBar: SafeArea(
          minimum: const EdgeInsets.fromLTRB(14, 0, 14, 10),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
              child: Container(
                height: 66,
                decoration: BoxDecoration(
                  color: AppColors.surface.withValues(alpha: .88),
                  borderRadius: BorderRadius.circular(24),
                  border:
                      Border.all(color: Colors.white.withValues(alpha: .75)),
                  boxShadow: const [
                    BoxShadow(
                        color: Color(0x18000000),
                        blurRadius: 24,
                        offset: Offset(0, 8))
                  ],
                ),
                child: Row(
                    children: List.generate(_items.length, (index) {
                  final selected = index == navigationShell.currentIndex;
                  final item = _items[index];
                  return Expanded(
                      child: Semantics(
                    selected: selected,
                    button: true,
                    label: item.$3,
                    child: InkWell(
                      onTap: () => _select(index),
                      child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 180),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 4),
                              decoration: BoxDecoration(
                                  color: selected
                                      ? AppColors.accentSoft
                                      : Colors.transparent,
                                  borderRadius: BorderRadius.circular(12)),
                              child: Icon(selected ? item.$2 : item.$1,
                                  size: 21,
                                  color: selected
                                      ? AppColors.accent
                                      : AppColors.secondary),
                            ),
                            const SizedBox(height: 2),
                            Text(item.$3,
                                maxLines: 1,
                                style: TextStyle(
                                    fontSize: 9.5,
                                    height: 1.1,
                                    fontWeight: selected
                                        ? FontWeight.w600
                                        : FontWeight.w500,
                                    color: selected
                                        ? AppColors.accent
                                        : AppColors.secondary)),
                          ]),
                    ),
                  ));
                })),
              ),
            ),
          ),
        ),
      );
}
