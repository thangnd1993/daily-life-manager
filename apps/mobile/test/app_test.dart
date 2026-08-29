import 'dart:convert';

import 'package:daily_life_manager/src/app.dart';
import 'package:daily_life_manager/src/auth/account.dart';
import 'package:daily_life_manager/src/auth/auth_controller.dart';
import 'package:daily_life_manager/src/auth/token_store.dart';
import 'package:daily_life_manager/src/network/api_client.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

class MemoryTokenStore implements TokenStore {
  AuthTokens? tokens;
  @override
  Future<void> clear() async => tokens = null;
  @override
  Future<AuthTokens?> read() async => tokens;
  @override
  Future<void> write(AuthTokens value) async => tokens = value;
}

void main() {
  testWidgets('routes signed-out users to login', (tester) async {
    final api = ApiClient(tokenStore: MemoryTokenStore(), client: MockClient((request) async => throw UnimplementedError()));
    final auth = AuthController(api)..status = AuthStatus.signedOut;
    await tester.pumpWidget(DailyLifeManagerApp(authController: auth));
    await tester.pumpAndSettle();
    expect(find.text('Sign in'), findsWidgets);
  });

  testWidgets('renders attendance loading and checked-in state', (tester) async {
    final api = ApiClient(
      tokenStore: MemoryTokenStore(),
      client: MockClient(
        (request) async => http.Response(
          jsonEncode({
            'checkedIn': true,
            'record': {'checkedInAt': '2026-08-29T01:00:00Z'},
          }),
          200,
        ),
      ),
    );
    final auth = AuthController(api)
      ..status = AuthStatus.signedIn
      ..account = const Account(
        id: '1',
        email: 'u@example.com',
        displayName: 'User',
        role: 'USER',
        status: 'ACTIVE',
      );
    await tester.pumpWidget(DailyLifeManagerApp(authController: auth));
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    await tester.pumpAndSettle();
    expect(find.text('Checked in today'), findsOneWidget);
    expect(find.text('Complete'), findsOneWidget);
  });
}
