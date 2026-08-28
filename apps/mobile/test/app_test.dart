import 'package:daily_life_manager/src/app.dart';
import 'package:daily_life_manager/src/auth/account.dart';
import 'package:daily_life_manager/src/auth/auth_controller.dart';
import 'package:daily_life_manager/src/auth/token_store.dart';
import 'package:daily_life_manager/src/network/api_client.dart';
import 'package:flutter_test/flutter_test.dart';
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
}
