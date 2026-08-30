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
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    await tester.pumpAndSettle();
    expect(find.text('Checked in today'), findsOneWidget);
    expect(find.text('Complete'), findsOneWidget);
    await tester.scrollUntilVisible(find.textContaining('This month · 1 days'), 250);
    expect(find.textContaining('This month · 1 days'), findsOneWidget);
  });

  testWidgets('opens finance overview with string VND totals and transactions', (tester) async {
    final api = ApiClient(
      tokenStore: MemoryTokenStore(),
      client: MockClient((request) async {
        if (request.url.path.endsWith('/attendance/today')) {
          return http.Response(jsonEncode({'checkedIn': false, 'record': null}), 200);
        }
        if (request.url.path.endsWith('/attendance')) {
          return http.Response(jsonEncode({'items': []}), 200);
        }
        if (request.url.path.endsWith('/finance/summary')) {
          return http.Response(jsonEncode({'totalIncome': '1000000', 'totalExpense': '150000', 'netBalance': '850000'}), 200);
        }
        if (request.url.path.endsWith('/finance/categories')) {
          return http.Response(jsonEncode([{'id': 'food', 'name': 'Food', 'type': 'EXPENSE', 'userId': null}]), 200);
        }
        if (request.url.path.endsWith('/finance/budgets')) {
          return http.Response(jsonEncode([{'id': 'budget-1', 'categoryId': null, 'category': null, 'amount': '1000000', 'spentAmount': '150000', 'remainingAmount': '850000', 'percentageUsed': 15, 'exceeded': false}]), 200);
        }
        if (request.url.path.endsWith('/finance/analytics')) {
          return http.Response(jsonEncode({'expenseByCategory': [{'category': {'id': 'food', 'name': 'Food'}, 'amount': '150000', 'percentage': 100}], 'trend': [{'year': 2026, 'month': 8, 'totalIncome': '1000000', 'totalExpense': '150000', 'netBalance': '850000'}]}), 200);
        }
        return http.Response(jsonEncode({'items': [{'id': 'tx-1', 'type': 'EXPENSE', 'amount': '150000', 'categoryId': 'food', 'description': 'Lunch', 'occurredAt': '2026-08-30T05:00:00Z', 'category': {'id': 'food', 'name': 'Food'}}]}), 200);
      }),
    );
    final auth = AuthController(api)
      ..status = AuthStatus.signedIn
      ..account = const Account(id: '1', email: 'u@example.com', displayName: 'User', role: 'USER', status: 'ACTIVE');
    await tester.pumpWidget(DailyLifeManagerApp(authController: auth));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Personal finance'));
    await tester.pumpAndSettle();
    expect(find.text('1.000.000 ₫'), findsOneWidget);
    expect(find.text('Overall expenses'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Expense breakdown'), 250);
    expect(find.text('Expense breakdown'), findsOneWidget);
    expect(find.text('Food'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Six-month trend'), 250);
    expect(find.text('Six-month trend'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Transactions'), 250);
    expect(find.text('Transactions'), findsOneWidget);
    expect(find.text('Food'), findsWidgets);
  });

  testWidgets('renders gold buy sell history range and stale state', (tester) async {
    final api = ApiClient(tokenStore: MemoryTokenStore(), client: MockClient((request) async {
      if (request.url.path.endsWith('/attendance/today')) return http.Response(jsonEncode({'checkedIn': false, 'record': null}), 200);
      if (request.url.path.endsWith('/attendance')) return http.Response(jsonEncode({'items': []}), 200);
      if (request.url.path.endsWith('/gold/alerts/triggers')) return http.Response(jsonEncode([{'id': 'trigger-1', 'productCode': 'SJC', 'triggeredAt': '2026-08-30T02:00:00Z'}]), 200);
      if (request.url.path.endsWith('/gold/alerts')) {
        return http.Response(jsonEncode([
          {'id': 'absolute', 'productCode': 'SJC', 'priceSide': 'BUY', 'condition': 'ABOVE', 'thresholdAmount': '90000000', 'thresholdBasisPoints': null, 'isEnabled': true, 'cooldownMinutes': 60, 'lastTriggeredAt': null},
          {'id': 'percent', 'productCode': 'PNJ', 'priceSide': 'SELL', 'condition': 'PERCENT_CHANGE', 'thresholdAmount': null, 'thresholdBasisPoints': 250, 'isEnabled': false, 'cooldownMinutes': 60, 'lastTriggeredAt': '2026-08-30T02:00:00Z'}
        ]), 200);
      }
      if (request.url.path.endsWith('/history')) return http.Response(jsonEncode({'items': [{'buyPrice': '88000000', 'sellPrice': '90000000', 'sourceTimestamp': '2026-08-29T00:00:00Z'}]}), 200);
      return http.Response(jsonEncode([{'provider': 'pha', 'productCode': 'SJC', 'productName': 'SJC Gold', 'buyPrice': '88500000', 'sellPrice': '90500000', 'currency': 'VND', 'unit': 'LUONG', 'sourceTimestamp': '2026-08-30T00:00:00Z', 'stale': true}]), 200);
    }));
    final auth = AuthController(api)..status = AuthStatus.signedIn..account = const Account(id: '1', email: 'u@example.com', displayName: 'User', role: 'USER', status: 'ACTIVE');
    await tester.pumpWidget(DailyLifeManagerApp(authController: auth));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Gold prices'), 250);
    await tester.tap(find.text('Gold prices'));
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
}
