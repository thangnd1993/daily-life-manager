import 'dart:convert';
import 'package:daily_life_manager/src/auth/account.dart';
import 'package:daily_life_manager/src/auth/token_store.dart';
import 'package:daily_life_manager/src/network/api_client.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

class MemoryStore implements TokenStore {
  AuthTokens? tokens;
  @override
  Future<void> clear() async => tokens = null;
  @override
  Future<AuthTokens?> read() async => tokens;
  @override
  Future<void> write(AuthTokens value) async => tokens = value;
}

void main() {
  test('refreshes once, rotates secure tokens, and retries the protected request', () async {
    final store = MemoryStore()..tokens = const AuthTokens(accessToken: 'expired', refreshToken: 'refresh-1');
    var profileCalls = 0;
    final client = MockClient((request) async {
      if (request.url.path.endsWith('/auth/refresh')) {
        return http.Response(
          jsonEncode({
            'accessToken': 'access-2',
            'refreshToken': 'refresh-2',
            'user': {'id': '1', 'email': 'u@example.com', 'displayName': 'User', 'role': 'USER', 'status': 'ACTIVE'},
          }),
          200,
        );
      }
      profileCalls++;
      if (profileCalls == 1) return http.Response('', 401);
      expect(request.headers['Authorization'], 'Bearer access-2');
      return http.Response(
        jsonEncode({'id': '1', 'email': 'u@example.com', 'displayName': 'User', 'role': 'USER', 'status': 'ACTIVE'}),
        200,
      );
    });
    final api = ApiClient(tokenStore: store, client: client);
    await api.restoreTokens();
    final profile = await api.me();
    expect(profile.email, 'u@example.com');
    expect(store.tokens?.refreshToken, 'refresh-2');
    expect(profileCalls, 2);
  });
}
