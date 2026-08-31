import 'dart:async';
import 'dart:convert';
import 'package:daily_life_manager/src/auth/token_store.dart';
import 'package:daily_life_manager/src/auth/account.dart';
import 'package:daily_life_manager/src/network/api_client.dart';
import 'package:daily_life_manager/src/push/push_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

class Store implements TokenStore {
  @override
  Future<void> clear() async {}
  @override
  Future<AuthTokens?> read() async => null;
  @override
  Future<void> write(AuthTokens value) async {}
}

class Provider implements PushProvider {
  Provider(this.permission);
  final PushPermission permission;
  final refresh = StreamController<String>();
  final taps = StreamController<Map<String, dynamic>>();
  @override
  Future<PushPermission> requestPermission() async => permission;
  @override
  Future<String?> token() async => 'a-valid-firebase-token-that-is-long';
  @override
  Stream<String> get tokenRefreshes => refresh.stream;
  @override
  Stream<Map<String, dynamic>> get notificationTaps => taps.stream;
}

void main() {
  test('registers token and deactivates device on logout', () async {
    final calls = <http.Request>[];
    final api = ApiClient(
        tokenStore: Store(),
        client: MockClient((request) async {
          calls.add(request);
          return http.Response(
              request.method == 'POST' ? jsonEncode({'id': 'device-1'}) : '',
              request.method == 'POST' ? 200 : 204);
        }));
    final push =
        PushService(api, Provider(PushPermission.granted), platform: 'ANDROID');
    await push.authenticated();
    await push.logout();
    expect(jsonDecode(calls.first.body), {
      'platform': 'ANDROID',
      'pushToken': 'a-valid-firebase-token-that-is-long'
    });
    expect(calls.last.url.path, endsWith('/push/devices/device-1'));
  });
  test('permission denial is safe and malformed taps are ignored', () async {
    var opened = false;
    final api = ApiClient(
        tokenStore: Store(),
        client: MockClient((_) async => throw StateError('must not call')));
    final push = PushService(api, Provider(PushPermission.denied),
        platform: 'IOS', onGoldAlertTap: () => opened = true);
    await push.authenticated();
    push.handleTap({'type': 'OTHER', 'route': '/gold'});
    expect(opened, isFalse);
    push.handleTap({'type': 'GOLD_ALERT', 'route': '/gold'});
    expect(opened, isTrue);
  });
}
