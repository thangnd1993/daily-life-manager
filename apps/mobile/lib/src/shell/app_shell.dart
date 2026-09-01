import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../design/app_theme.dart';
import '../design/app_widgets.dart';

class AppShell extends StatelessWidget {
  const AppShell({required this.navigationShell, super.key});
  final StatefulNavigationShell navigationShell;

  void _select(int index) => navigationShell.goBranch(index,
      initialLocation: index == navigationShell.currentIndex);

  static const _items = [
    (0, Icons.home_outlined, Icons.home_rounded, 'Home'),
    (1, Icons.how_to_reg_outlined, Icons.how_to_reg_rounded, 'Attendance'),
    (3, Icons.auto_awesome_outlined, Icons.auto_awesome_rounded, 'Gold'),
    (
      2,
      Icons.account_balance_wallet_outlined,
      Icons.account_balance_wallet_rounded,
      'Finance'
    ),
    (4, Icons.person_outline_rounded, Icons.person_rounded, 'Account'),
  ];

  @override
  Widget build(BuildContext context) => Scaffold(
        extendBody: true,
        body: AppBackground(child: navigationShell),
        bottomNavigationBar: SafeArea(
          minimum: const EdgeInsets.fromLTRB(20, 0, 20, 12),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(28),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
              child: Container(
                height: 60,
                decoration: BoxDecoration(
                  color: AppColors.glass.withValues(alpha: .78),
                  borderRadius: BorderRadius.circular(28),
                  border:
                      Border.all(color: Colors.white.withValues(alpha: .75)),
                  boxShadow: const [
                    BoxShadow(
                        color: Color(0x18000000),
                        blurRadius: 30,
                        offset: Offset(0, 12))
                  ],
                ),
                child: Row(
                    children: List.generate(_items.length, (index) {
                  final item = _items[index];
                  final selected = item.$1 == navigationShell.currentIndex;
                  return Expanded(
                      child: Semantics(
                    selected: selected,
                    button: true,
                    label: item.$4,
                    child: InkWell(
                      onTap: () => _select(item.$1),
                      child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 180),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 5),
                              decoration: index == 2
                                  ? const BoxDecoration(
                                      shape: BoxShape.circle,
                                      gradient: SweepGradient(colors: [
                                        Color(0xffffbd2e),
                                        Color(0xffff3b57),
                                        Color(0xffac48ff),
                                        Color(0xff24b7ff),
                                        Color(0xffffbd2e)
                                      ]),
                                      boxShadow: [
                                          BoxShadow(
                                              color: Color(0x44246bfd),
                                              blurRadius: 12)
                                        ])
                                  : BoxDecoration(
                                      color: selected
                                          ? AppColors.accentSoft
                                          : Colors.transparent,
                                      borderRadius: BorderRadius.circular(12)),
                              child: Icon(selected ? item.$3 : item.$2,
                                  size: index == 2 ? 23 : 21,
                                  color: index == 2
                                      ? Colors.white
                                      : selected
                                          ? AppColors.accent
                                          : AppColors.secondary),
                            ),
                            const SizedBox(height: 1),
                            Text(item.$4,
                                maxLines: 1,
                                style: TextStyle(
                                    fontSize: 9,
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
