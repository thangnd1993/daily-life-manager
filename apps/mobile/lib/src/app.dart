import 'package:flutter/foundation.dart' show defaultTargetPlatform;
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'auth/auth_controller.dart';
import 'auth/token_store.dart';
import 'design/app_theme.dart';
import 'features/account/account_screen.dart';
import 'features/attendance/attendance_screen.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/password_screens.dart';
import 'features/auth/register_screen.dart';
import 'features/finance/finance_screen.dart';
import 'features/gold/gold_screen.dart';
import 'features/home/home_screen.dart';
import 'network/api_client.dart';
import 'push/push_service.dart';
import 'shell/app_shell.dart';

class DailyLifeManagerApp extends StatefulWidget {
  const DailyLifeManagerApp({this.authController, super.key});
  final AuthController? authController;
  @override
  State<DailyLifeManagerApp> createState() => _DailyLifeManagerAppState();
}

class _DailyLifeManagerAppState extends State<DailyLifeManagerApp> {
  late final AuthController auth;
  late final GoRouter router;

  @override
  void initState() {
    super.initState();
    if (widget.authController != null) {
      auth = widget.authController!;
    } else {
      final api = ApiClient(tokenStore: SecureTokenStore());
      final push = PushService(
        api,
        UnavailablePushProvider(),
        platform:
            defaultTargetPlatform == TargetPlatform.iOS ? 'IOS' : 'ANDROID',
        onGoldAlertTap: () => router.go('/gold'),
      );
      auth = AuthController(api, push: push);
    }
    router = GoRouter(
      refreshListenable: auth,
      initialLocation: '/',
      redirect: (context, state) {
        if (auth.status == AuthStatus.restoring) {
          return state.matchedLocation == '/restoring' ? null : '/restoring';
        }
        final publicRoute = {
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password'
        }.contains(state.matchedLocation);
        if (auth.status == AuthStatus.signedOut) {
          return publicRoute ? null : '/login';
        }
        return publicRoute || state.matchedLocation == '/restoring'
            ? '/'
            : null;
      },
      routes: [
        GoRoute(
            path: '/restoring',
            builder: (_, __) => const Scaffold(
                body: Center(child: CircularProgressIndicator()))),
        GoRoute(path: '/login', builder: (_, __) => LoginScreen(auth: auth)),
        GoRoute(
            path: '/register', builder: (_, __) => RegisterScreen(auth: auth)),
        GoRoute(
            path: '/forgot-password',
            builder: (_, __) => ForgotPasswordScreen(api: auth.api)),
        GoRoute(
            path: '/reset-password',
            builder: (_, __) => ResetPasswordScreen(api: auth.api)),
        GoRoute(
            path: '/change-password',
            builder: (_, __) => ChangePasswordScreen(api: auth.api)),
        StatefulShellRoute.indexedStack(
          builder: (_, __, navigationShell) =>
              AppShell(navigationShell: navigationShell),
          branches: [
            StatefulShellBranch(routes: [
              GoRoute(path: '/', builder: (_, __) => HomeScreen(auth: auth))
            ]),
            StatefulShellBranch(routes: [
              GoRoute(
                  path: '/attendance',
                  builder: (_, __) => AttendanceScreen(api: auth.api))
            ]),
            StatefulShellBranch(routes: [
              GoRoute(
                  path: '/finance',
                  builder: (_, __) => FinanceScreen(api: auth.api))
            ]),
            StatefulShellBranch(routes: [
              GoRoute(
                  path: '/gold', builder: (_, __) => GoldScreen(api: auth.api))
            ]),
            StatefulShellBranch(routes: [
              GoRoute(
                  path: '/account',
                  builder: (_, __) => AccountScreen(auth: auth))
            ]),
          ],
        ),
      ],
    );
    if (widget.authController == null) auth.restore();
  }

  @override
  void dispose() {
    router.dispose();
    if (widget.authController == null) auth.api.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp.router(
        title: 'Daily Life Manager',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        routerConfig: router,
      );
}
