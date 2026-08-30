import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'auth/auth_controller.dart';
import 'auth/token_store.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/password_screens.dart';
import 'features/auth/register_screen.dart';
import 'features/home/home_screen.dart';
import 'features/finance/finance_screen.dart';
import 'features/gold/gold_screen.dart';
import 'network/api_client.dart';

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
    auth = widget.authController ?? AuthController(ApiClient(tokenStore: SecureTokenStore()));
    router = GoRouter(
      refreshListenable: auth,
      initialLocation: '/',
      redirect: (context, state) {
        if (auth.status == AuthStatus.restoring) return '/restoring';
        final publicRoute = state.matchedLocation == '/login' ||
            state.matchedLocation == '/register' ||
            state.matchedLocation == '/forgot-password' ||
            state.matchedLocation == '/reset-password';
        if (auth.status == AuthStatus.signedOut) return publicRoute ? null : '/login';
        return publicRoute || state.matchedLocation == '/restoring' ? '/' : null;
      },
      routes: [
        GoRoute(
          path: '/restoring',
          builder: (context, state) => const Scaffold(body: Center(child: CircularProgressIndicator())),
        ),
        GoRoute(path: '/login', builder: (context, state) => LoginScreen(auth: auth)),
        GoRoute(path: '/register', builder: (context, state) => RegisterScreen(auth: auth)),
        GoRoute(
          path: '/forgot-password',
          builder: (context, state) => ForgotPasswordScreen(api: auth.api),
        ),
        GoRoute(
          path: '/reset-password',
          builder: (context, state) => ResetPasswordScreen(api: auth.api),
        ),
        GoRoute(path: '/', builder: (context, state) => HomeScreen(auth: auth)),
        GoRoute(path: '/finance', builder: (context, state) => FinanceScreen(api: auth.api)),
        GoRoute(path: '/gold', builder: (context, state) => GoldScreen(api: auth.api)),
        GoRoute(
          path: '/change-password',
          builder: (context, state) => ChangePasswordScreen(api: auth.api),
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
        theme: ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff102a43))),
        routerConfig: router,
      );
}
