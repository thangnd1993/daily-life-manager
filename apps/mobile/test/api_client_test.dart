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

  test('loads today, checks in, and loads monthly attendance', () async {
    final requests = <http.Request>[];
    final api = ApiClient(
      tokenStore: MemoryStore(),
      client: MockClient((request) async {
        requests.add(request);
        if (request.url.path.endsWith('/check-in')) {
          return http.Response(jsonEncode({'id': 'attendance-1'}), 201);
        }
        if (request.url.path.endsWith('/today')) {
          return http.Response(jsonEncode({'checkedIn': false, 'record': null}), 200);
        }
        return http.Response(jsonEncode({'items': [], 'checkedInDays': 0}), 200);
      }),
    );
    expect((await api.attendanceToday('Asia/Ho_Chi_Minh'))['checkedIn'], false);
    expect((await api.checkIn('Asia/Ho_Chi_Minh'))['id'], 'attendance-1');
    expect((await api.attendanceMonth(2026, 8))['checkedInDays'], 0);
    expect(requests.first.url.queryParameters['timezone'], 'Asia/Ho_Chi_Minh');
    expect(jsonDecode(requests[1].body)['timezone'], 'Asia/Ho_Chi_Minh');
  });
}
