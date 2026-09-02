import 'dart:convert';

import 'package:daily_life_manager/src/app.dart';
import 'package:daily_life_manager/src/auth/account.dart';
import 'package:daily_life_manager/src/auth/auth_controller.dart';
import 'package:daily_life_manager/src/auth/token_store.dart';
import 'package:daily_life_manager/src/network/api_client.dart';
import 'package:flutter/material.dart';
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
    final api = ApiClient(
        tokenStore: MemoryTokenStore(),
        client: MockClient((request) async => throw UnimplementedError()));
    final auth = AuthController(api)..status = AuthStatus.signedOut;
    await tester.pumpWidget(DailyLifeManagerApp(authController: auth));
    await tester.pumpAndSettle();
    expect(find.text('Sign in'), findsWidgets);
  });

  testWidgets('renders attendance loading and checked-in state',
      (tester) async {
    final api = ApiClient(
      tokenStore: MemoryTokenStore(),
      client: MockClient(
        (request) async => http.Response(
          jsonEncode(
            request.url.path.endsWith('/today')
                ? {
                    'checkedIn': true,
                    'record': {'checkedInAt': '2026-08-29T01:00:00Z'},
                  }
                : {
                    'items': [
                      {
                        'attendanceDate': '2026-08-29',
                        'timezone': 'Asia/Ho_Chi_Minh',
                        'source': 'MOBILE',
                      },
                    ],
                  },
          ),
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
    await tester.pump();
    await tester.tap(find.text('Attendance'));
    await tester.pumpAndSettle();
    expect(find.text('THIS MONTH'), findsOneWidget);
    expect(find.text('4 h'), findsWidgets);
    expect(find.text('29 Aug 2026'), findsOneWidget);
  });

  testWidgets('opens finance overview with string VND totals and transactions',
      (tester) async {
    final api = ApiClient(
      tokenStore: MemoryTokenStore(),
      client: MockClient((request) async {
        if (request.url.path.endsWith('/attendance/today')) {
          return http.Response(
              jsonEncode({'checkedIn': false, 'record': null}), 200);
        }
        if (request.url.path.endsWith('/attendance')) {
          return http.Response(jsonEncode({'items': []}), 200);
        }
        if (request.url.path.endsWith('/finance/summary')) {
          return http.Response(
              jsonEncode({
                'totalIncome': '1000000',
                'totalExpense': '150000',
                'netBalance': '850000'
              }),
              200);
        }
        if (request.url.path.endsWith('/finance/categories')) {
          return http.Response(
              jsonEncode([
                {
                  'id': 'food',
                  'name': 'Food',
                  'type': 'EXPENSE',
                  'userId': null
                }
              ]),
              200);
        }
        if (request.url.path.endsWith('/finance/budgets')) {
          return http.Response(
              jsonEncode([
                {
                  'id': 'budget-1',
                  'categoryId': null,
                  'category': null,
                  'amount': '1000000',
                  'spentAmount': '150000',
                  'remainingAmount': '850000',
                  'percentageUsed': 15,
                  'exceeded': false
                }
              ]),
              200);
        }
        if (request.url.path.endsWith('/finance/analytics')) {
          return http.Response(
              jsonEncode({
                'expenseByCategory': [
                  {
                    'category': {'id': 'food', 'name': 'Food'},
                    'amount': '150000',
                    'percentage': 100
                  }
                ],
                'trend': [
                  {
                    'year': 2026,
                    'month': 8,
                    'totalIncome': '1000000',
                    'totalExpense': '150000',
                    'netBalance': '850000'
                  }
                ]
              }),
              200);
        }
        return http.Response(
            jsonEncode({
              'items': [
                {
                  'id': 'tx-1',
                  'type': 'EXPENSE',
                  'amount': '150000',
                  'categoryId': 'food',
                  'description': 'Lunch',
                  'occurredAt': '2026-08-30T05:00:00Z',
                  'category': {'id': 'food', 'name': 'Food'}
                }
              ]
            }),
            200);
      }),
    );
    final auth = AuthController(api)
      ..status = AuthStatus.signedIn
      ..account = const Account(
          id: '1',
          email: 'u@example.com',
          displayName: 'User',
          role: 'USER',
          status: 'ACTIVE');
    await tester.pumpWidget(DailyLifeManagerApp(authController: auth));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Finance'));
    await tester.pumpAndSettle();
    expect(find.text('1.000.000 ₫'), findsOneWidget);
    expect(find.text('Budget overview'), findsOneWidget);
    expect(find.text('Recent transactions'), findsOneWidget);
    expect(find.text('Food'), findsWidgets);
  });

  testWidgets('renders gold buy sell history range and stale state',
      (tester) async {
    final api = ApiClient(
        tokenStore: MemoryTokenStore(),
        client: MockClient((request) async {
          if (request.url.path.endsWith('/attendance/today')) {
            return http.Response(
                jsonEncode({'checkedIn': false, 'record': null}), 200);
          }
          if (request.url.path.endsWith('/attendance')) {
            return http.Response(jsonEncode({'items': []}), 200);
          }
          if (request.url.path.endsWith('/gold/alerts/triggers')) {
            return http.Response(
                jsonEncode([
                  {
                    'id': 'trigger-1',
                    'productCode': 'SJC',
                    'triggeredAt': '2026-08-30T02:00:00Z'
                  }
                ]),
                200);
          }
          if (request.url.path.endsWith('/gold/alerts')) {
            return http.Response(
                jsonEncode([
                  {
                    'id': 'absolute',
                    'productCode': 'SJC',
                    'priceSide': 'BUY',
                    'condition': 'ABOVE',
                    'thresholdAmount': '90000000',
                    'thresholdBasisPoints': null,
                    'isEnabled': true,
                    'cooldownMinutes': 60,
                    'lastTriggeredAt': null
                  },
                  {
                    'id': 'percent',
                    'productCode': 'PNJ',
                    'priceSide': 'SELL',
                    'condition': 'PERCENT_CHANGE',
                    'thresholdAmount': null,
                    'thresholdBasisPoints': 250,
                    'isEnabled': false,
                    'cooldownMinutes': 60,
                    'lastTriggeredAt': '2026-08-30T02:00:00Z'
                  }
                ]),
                200);
          }
          if (request.url.path.endsWith('/history')) {
            return http.Response(
                jsonEncode({
                  'items': [
                    {
                      'buyPrice': '88000000',
                      'sellPrice': '90000000',
                      'sourceTimestamp': '2026-08-29T00:00:00Z'
                    }
                  ]
                }),
                200);
          }
          return http.Response(
              jsonEncode([
                {
                  'provider': 'pha',
                  'productCode': 'SJC',
                  'productName': 'SJC Gold',
                  'buyPrice': '88500000',
                  'sellPrice': '90500000',
                  'currency': 'VND',
                  'unit': 'LUONG',
                  'sourceTimestamp': '2026-08-30T00:00:00Z',
                  'stale': true
                }
              ]),
              200);
        }));
    final auth = AuthController(api)
      ..status = AuthStatus.signedIn
      ..account = const Account(
          id: '1',
          email: 'u@example.com',
          displayName: 'User',
          role: 'USER',
          status: 'ACTIVE');
    await tester.pumpWidget(DailyLifeManagerApp(authController: auth));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Gold'));
    await tester.pumpAndSettle();
    expect(find.text('SJC Gold'), findsOneWidget);
    expect(find.text('88.500.000 ₫'), findsOneWidget);
    expect(find.text('90.500.000 ₫'), findsOneWidget);
    expect(find.textContaining('may be delayed'), findsWidgets);
    expect(find.text('7D'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Gold alerts'), 250);
    await tester.scrollUntilVisible(find.textContaining('BUY ABOVE'), 200);
    expect(find.textContaining('BUY ABOVE 90.000.000'), findsOneWidget);
    await tester.scrollUntilVisible(find.textContaining('2.50% movement'), 200);
    expect(find.textContaining('2.50% movement'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Recent alert activity'), 200);
    expect(find.text('Recent alert activity'), findsOneWidget);
  });

  testWidgets(
      'home composes cross-feature summaries and exposes primary navigation',
      (tester) async {
    final api = ApiClient(
        tokenStore: MemoryTokenStore(),
        client: MockClient((request) async {
          final path = request.url.path;
          if (path.endsWith('/attendance/today')) {
            return http.Response(
                jsonEncode({'checkedIn': true, 'record': {}}), 200);
          }
          if (path.endsWith('/finance/summary')) {
            return http.Response(
                jsonEncode({
                  'totalIncome': '1000000',
                  'totalExpense': '250000',
                  'netBalance': '750000'
                }),
                200);
          }
          if (path.endsWith('/finance/budgets')) {
            return http.Response(
                jsonEncode([
                  {'id': 'budget-1'}
                ]),
                200);
          }
          if (path.endsWith('/gold/prices')) {
            return http.Response(
                jsonEncode([
                  {
                    'productName': 'SJC Gold',
                    'buyPrice': '90000000',
                    'sellPrice': '92000000',
                    'stale': false
                  }
                ]),
                200);
          }
          return http.Response(
              jsonEncode([
                {'id': 'alert-1', 'isEnabled': true}
              ]),
              200);
        }));
    final auth = AuthController(api)
      ..status = AuthStatus.signedIn
      ..account = const Account(
          id: '1',
          email: 'u@example.com',
          displayName: 'User',
          role: 'USER',
          status: 'ACTIVE');
    await tester.pumpWidget(DailyLifeManagerApp(authController: auth));
    await tester.pumpAndSettle();
    expect(find.text("Today's work"), findsOneWidget);
    expect(find.text('4 h recorded'), findsOneWidget);
    expect(find.text('750.000 ₫'), findsOneWidget);
    expect(find.text('1 active'), findsOneWidget);
    expect(find.text('SJC Gold'), findsOneWidget);
    for (final destination in [
      'Home',
      'Attendance',
      'Finance',
      'Gold',
      'Account'
    ]) {
      expect(find.text(destination), findsOneWidget);
    }
  });

  testWidgets('home error is retryable and account logout returns to sign in',
      (tester) async {
    final api = ApiClient(
        tokenStore: MemoryTokenStore(),
        client: MockClient((request) async {
          if (request.url.path.endsWith('/auth/logout')) {
            return http.Response('', 204);
          }
          return http.Response('{}', 503);
        }));
    final auth = AuthController(api)
      ..status = AuthStatus.signedIn
      ..account = const Account(
          id: '1',
          email: 'u@example.com',
          displayName: 'User',
          role: 'USER',
          status: 'ACTIVE');
    await tester.pumpWidget(DailyLifeManagerApp(authController: auth));
    await tester.pumpAndSettle();
    expect(find.text('Overview unavailable'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
    await tester.tap(find.text('Account'));
    await tester.pumpAndSettle();
    expect(find.text('u@example.com'), findsOneWidget);
    expect(find.text('Change password'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Sign out'), 250);
    await tester.drag(find.byType(Scrollable).last, const Offset(0, -100));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sign out'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Sign out'));
    await tester.pumpAndSettle();
    expect(find.text('Sign in'), findsWidgets);
  });
}
