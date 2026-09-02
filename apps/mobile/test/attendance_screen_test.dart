import 'dart:convert';

import 'package:daily_life_manager/src/auth/account.dart';
import 'package:daily_life_manager/src/auth/token_store.dart';
import 'package:daily_life_manager/src/features/attendance/attendance_screen.dart';
import 'package:daily_life_manager/src/network/api_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

class _Store implements TokenStore {
  @override
  Future<void> clear() async {}
  @override
  Future<AuthTokens?> read() async => null;
  @override
  Future<void> write(AuthTokens value) async {}
}

void main() {
  testWidgets(
      'shows elapsed no-record dates and supports past-month navigation',
      (tester) async {
    final requests = <Uri>[];
    final api = ApiClient(
        tokenStore: _Store(),
        client: MockClient((request) async {
          requests.add(request.url);
          if (request.url.path.endsWith('/today')) {
            return http.Response(jsonEncode(_today()), 200);
          }
          return http.Response(jsonEncode(_month()), 200);
        }));
    await tester.pumpWidget(MaterialApp(home: AttendanceScreen(api: api)));
    await tester.pumpAndSettle();

    expect(find.textContaining('No record'), findsWidgets);
    expect(find.byTooltip('Next month'), findsOneWidget);
    final next = tester.widget<IconButton>(find.byWidgetPredicate(
        (widget) => widget is IconButton && widget.tooltip == 'Next month'));
    expect(next.onPressed, isNull);
    await tester.tap(find.byTooltip('Previous month'));
    await tester.pumpAndSettle();
    final previous = DateTime(DateTime.now().year, DateTime.now().month - 1);
    expect(
        requests.any((uri) =>
            uri.queryParameters['year'] == '${previous.year}' &&
            uri.queryParameters['month'] == '${previous.month}'),
        isTrue);
  });

  testWidgets('adds a six-hour historical work record and refreshes totals',
      (tester) async {
    Map<String, dynamic>? saved;
    final today = DateTime.now();
    final key = _key(today);
    final api = ApiClient(
        tokenStore: _Store(),
        client: MockClient((request) async {
          if (request.method == 'PUT') {
            saved = jsonDecode(request.body) as Map<String, dynamic>;
            return http.Response(jsonEncode({'id': 'manual-1'}), 200);
          }
          if (request.url.path.endsWith('/today')) {
            return http.Response(
                jsonEncode(
                    _today(record: saved == null ? null : _record(key, 360))),
                200);
          }
          return http.Response(
              jsonEncode(_month(
                  records: saved == null ? [] : [_record(key, 360)],
                  workedDays: saved == null ? 0 : 1,
                  totalMinutes: saved == null ? 0 : 360)),
              200);
        }));
    await tester.pumpWidget(MaterialApp(home: AttendanceScreen(api: api)));
    await tester.pumpAndSettle();
    await tester.tap(find.text('No record yet'));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(DropdownButtonFormField<int>).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('6').last);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Save work record'));
    await tester.pumpAndSettle();

    expect(saved?['workedMinutes'], 360);
    expect(find.text('6 h'), findsWidgets);
    expect(find.text('Edited · 6 h'), findsOneWidget);
  });

  testWidgets('adds an OFF record with a human-readable reason',
      (tester) async {
    Map<String, dynamic>? saved;
    final api = ApiClient(
        tokenStore: _Store(),
        client: MockClient((request) async {
          if (request.method == 'PUT') {
            saved = jsonDecode(request.body) as Map<String, dynamic>;
            return http.Response(jsonEncode({'id': 'off-1'}), 200);
          }
          if (request.url.path.endsWith('/today')) {
            return http.Response(jsonEncode(_today()), 200);
          }
          return http.Response(jsonEncode(_month()), 200);
        }));
    await tester.pumpWidget(MaterialApp(home: AttendanceScreen(api: api)));
    await tester.pumpAndSettle();
    await tester.tap(find.text('No record yet'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Off').last);
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Sick leave');
    await tester.tap(find.widgetWithText(FilledButton, 'Save work record'));
    await tester.pumpAndSettle();
    expect(saved, containsPair('workedMinutes', 0));
    expect(saved, containsPair('offReason', 'Sick leave'));
  });
}

Map<String, dynamic> _today({Map<String, dynamic>? record}) => {
      'featureEnabled': true,
      'leaveModeEnabled': false,
      'record': record,
    };

Map<String, dynamic> _month({
  List<Map<String, dynamic>> records = const [],
  int workedDays = 0,
  int totalMinutes = 0,
}) =>
    {
      'items': records,
      'workedDays': workedDays,
      'totalWorkedMinutes': totalMinutes,
      'offDays': 0,
    };

Map<String, dynamic> _record(String date, int minutes) => {
      'id': 'manual-1',
      'attendanceDate': date,
      'workedMinutes': minutes,
      'source': 'MOBILE',
      'status': 'WORKED',
    };

String _key(DateTime date) =>
    '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
