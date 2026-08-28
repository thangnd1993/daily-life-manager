import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'features/home/home_screen.dart';

class DailyLifeManagerApp extends StatelessWidget {
  const DailyLifeManagerApp({super.key});
  static final _router = GoRouter(routes: [
    GoRoute(path: '/', builder: (context, state) => const HomeScreen()),
  ]);
  @override
  Widget build(BuildContext context) => MaterialApp.router(
        title: 'Daily Life Manager',
        theme: ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff102a43))),
        routerConfig: _router,
      );
}
