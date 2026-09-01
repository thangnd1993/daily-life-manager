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
  test(
      'refreshes once, rotates secure tokens, and retries the protected request',
      () async {
    final store = MemoryStore()
      ..tokens =
          const AuthTokens(accessToken: 'expired', refreshToken: 'refresh-1');
    var profileCalls = 0;
    final client = MockClient((request) async {
      if (request.url.path.endsWith('/auth/refresh')) {
        return http.Response(
          jsonEncode({
            'accessToken': 'access-2',
            'refreshToken': 'refresh-2',
            'user': {
              'id': '1',
              'email': 'u@example.com',
              'displayName': 'User',
              'role': 'USER',
              'status': 'ACTIVE'
            },
          }),
          200,
        );
      }
      profileCalls++;
      if (profileCalls == 1) return http.Response('', 401);
      expect(request.headers['Authorization'], 'Bearer access-2');
      return http.Response(
        jsonEncode({
          'id': '1',
          'email': 'u@example.com',
          'displayName': 'User',
          'role': 'USER',
          'status': 'ACTIVE'
        }),
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

  test('clears persisted credentials when refresh is rejected', () async {
    final store = MemoryStore()
      ..tokens = const AuthTokens(
        accessToken: 'expired',
        refreshToken: 'revoked-refresh',
      );
    final api = ApiClient(
      tokenStore: store,
      client: MockClient((request) async {
        if (request.url.path.endsWith('/auth/refresh')) {
          return http.Response('', 401);
        }
        return http.Response('', 401);
      }),
    );
    await api.restoreTokens();
    await expectLater(api.me(), throwsA(isA<ApiException>()));
    expect(store.tokens, isNull);
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
          return http.Response(
              jsonEncode({'checkedIn': false, 'record': null}), 200);
        }
        return http.Response(
            jsonEncode({'items': [], 'checkedInDays': 0}), 200);
      }),
    );
    expect((await api.attendanceToday('Asia/Ho_Chi_Minh'))['checkedIn'], false);
    expect((await api.checkIn('Asia/Ho_Chi_Minh'))['id'], 'attendance-1');
    expect((await api.attendanceMonth(2026, 8))['checkedInDays'], 0);
    expect(requests.first.url.queryParameters['timezone'], 'Asia/Ho_Chi_Minh');
    expect(jsonDecode(requests[1].body)['timezone'], 'Asia/Ho_Chi_Minh');
  });

  test('maps finance summary, categories, transaction CRUD, and BigInt strings',
      () async {
    final requests = <http.Request>[];
    final api = ApiClient(
        tokenStore: MemoryStore(),
        client: MockClient((request) async {
          requests.add(request);
          if (request.url.path.endsWith('/categories')) {
            return http.Response(
                request.method == 'GET'
                    ? jsonEncode([
                        {'id': 'food', 'name': 'Food', 'type': 'EXPENSE'}
                      ])
                    : jsonEncode({'id': 'personal'}),
                200);
          }
          if (request.url.path.endsWith('/summary')) {
            return http.Response(
                jsonEncode({
                  'totalIncome': '1000000000000000',
                  'totalExpense': '1',
                  'netBalance': '999999999999999'
                }),
                200);
          }
          if (request.method == 'DELETE') return http.Response('', 204);
          if (request.method == 'GET') {
            return http.Response(jsonEncode({'items': []}), 200);
          }
          return http.Response(
              jsonEncode({'id': 'tx-1', 'amount': '150000'}), 200);
        }));
    expect(
        (await api.financeSummary(2026, 8))['totalIncome'], '1000000000000000');
    expect((await api.financeCategories()).first['name'], 'Food');
    await api.financeTransactions(2026, 8);
    await api.createFinanceTransaction({'amount': '150000'});
    await api.updateFinanceTransaction('tx-1', {'amount': '160000'});
    await api.deleteFinanceTransaction('tx-1');
    expect(requests[2].url.queryParameters['month'], '8');
    expect(jsonDecode(requests[3].body)['amount'], '150000');
    expect(requests.last.method, 'DELETE');
  });

  test('maps budget and analytics endpoints with string money', () async {
    final requests = <http.Request>[];
    final api = ApiClient(
        tokenStore: MemoryStore(),
        client: MockClient((request) async {
          requests.add(request);
          if (request.url.path.endsWith('/analytics')) {
            return http.Response(
                jsonEncode({'trend': [], 'expenseByCategory': []}), 200);
          }
          if (request.method == 'GET') {
            return http.Response(
                jsonEncode([
                  {
                    'id': 'budget-1',
                    'amount': '5000000',
                    'spentAmount': '1000000'
                  }
                ]),
                200);
          }
          if (request.method == 'DELETE') return http.Response('', 204);
          return http.Response(
              jsonEncode({'id': 'budget-1', 'amount': '5000000'}), 200);
        }));
    expect((await api.financeBudgets(2026, 8)).first['amount'], '5000000');
    await api.financeAnalytics(2026, 8);
    await api.upsertFinanceBudget(
        {'year': 2026, 'month': 8, 'amount': '5000000', 'currency': 'VND'});
    await api.updateFinanceBudget('budget-1', '6000000');
    await api.deleteFinanceBudget('budget-1');
    expect(requests.first.url.queryParameters['month'], '8');
    expect(jsonDecode(requests[2].body)['amount'], '5000000');
    expect(requests.last.method, 'DELETE');
  });

  test('maps latest gold prices and bounded history', () async {
    final requests = <http.Request>[];
    final api = ApiClient(
        tokenStore: MemoryStore(),
        client: MockClient((request) async {
          requests.add(request);
          if (request.url.path.endsWith('/history')) {
            return http.Response(
                jsonEncode({'productCode': 'SJC', 'days': 7, 'items': []}),
                200);
          }
          return http.Response(
              jsonEncode([
                {
                  'productCode': 'SJC',
                  'buyPrice': '88500000',
                  'sellPrice': '90500000'
                }
              ]),
              200);
        }));
    expect((await api.goldPrices()).first['buyPrice'], '88500000');
    expect((await api.goldHistory('SJC', 7))['days'], 7);
    expect(requests.last.url.queryParameters['days'], '7');
    expect(requests.last.url.queryParameters['limit'], '200');
  });

  test('maps gold alert CRUD, toggle, and trigger history', () async {
    final requests = <http.Request>[];
    final api = ApiClient(
        tokenStore: MemoryStore(),
        client: MockClient((request) async {
          requests.add(request);
          if (request.url.path.endsWith('/triggers')) {
            return http.Response(
                jsonEncode([
                  {'id': 'trigger-1', 'observedBuyPrice': '90000000'}
                ]),
                200);
          }
          if (request.method == 'GET') {
            return http.Response(
                jsonEncode([
                  {
                    'id': 'alert-1',
                    'condition': 'ABOVE',
                    'thresholdAmount': '90000000'
                  }
                ]),
                200);
          }
          if (request.method == 'DELETE') return http.Response('', 204);
          return http.Response(
              jsonEncode({'id': 'alert-1', 'isEnabled': true}), 200);
        }));
    expect((await api.goldAlerts()).first['thresholdAmount'], '90000000');
    expect(
        (await api.goldAlertTriggers()).first['observedBuyPrice'], '90000000');
    await api
        .createGoldAlert({'productCode': 'SJC', 'thresholdAmount': '90000000'});
    await api.updateGoldAlert('alert-1', {'thresholdAmount': '91000000'});
    await api.setGoldAlertEnabled('alert-1', false);
    await api.deleteGoldAlert('alert-1');
    expect(requests[2].method, 'POST');
    expect(jsonDecode(requests[4].body)['isEnabled'], false);
    expect(requests.last.method, 'DELETE');
  });
}
