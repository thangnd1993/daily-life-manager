import 'dart:convert';
import 'package:http/http.dart' as http;
import '../auth/account.dart';
import '../auth/token_store.dart';
import '../config/app_config.dart';

class ApiException implements Exception {
  const ApiException(this.statusCode, [this.message = 'Request failed']);
  final int statusCode;
  final String message;
}

class ApiClient {
  ApiClient({required TokenStore tokenStore, http.Client? client})
      : _tokenStore = tokenStore,
        _client = client ?? http.Client();
  final TokenStore _tokenStore;
  final http.Client _client;
  AuthTokens? _tokens;
  Future<bool>? _refreshRequest;

  Future<void> restoreTokens() async => _tokens = await _tokenStore.read();
  Future<AuthResult> login(String email, String password) => _authenticate(
        'auth/login',
        {'email': email, 'password': password, 'deviceName': 'Mobile'},
      );
  Future<AuthResult> register(
          String email, String displayName, String password) =>
      _authenticate(
        'auth/register',
        {
          'email': email,
          'displayName': displayName,
          'password': password,
          'deviceName': 'Mobile'
        },
      );
  Future<Account> me() async =>
      Account.fromJson(await request('GET', 'auth/me') as Map<String, dynamic>);
  Future<Map<String, dynamic>> attendanceToday(String timezone) async =>
      await request('GET',
              'attendance/today?timezone=${Uri.encodeQueryComponent(timezone)}')
          as Map<String, dynamic>;
  Future<Map<String, dynamic>> checkIn(String timezone) async =>
      await request('POST', 'attendance/check-in', body: {'timezone': timezone})
          as Map<String, dynamic>;
  Future<Map<String, dynamic>> attendanceMonth(int year, int month) async =>
      await request('GET', 'attendance?year=$year&month=$month&pageSize=31')
          as Map<String, dynamic>;
  Future<Map<String, dynamic>> updateAttendanceDay(
          String date, int workedMinutes, String timezone,
          {String? offReason}) async =>
      await request('PATCH', 'attendance/$date', body: {
        'workedMinutes': workedMinutes,
        'timezone': timezone,
        if (offReason != null) 'offReason': offReason,
      }) as Map<String, dynamic>;
  Future<Map<String, dynamic>> setAttendanceLeaveMode(bool enabled,
          {String? reason}) async =>
      await request('PATCH', 'attendance/leave-mode', body: {
        'enabled': enabled,
        if (reason != null) 'reason': reason,
      }) as Map<String, dynamic>;
  Future<List<Map<String, dynamic>>> financeCategories() async =>
      (await request('GET', 'finance/categories') as List<dynamic>)
          .cast<Map<String, dynamic>>();
  Future<Map<String, dynamic>> financeSummary(int year, int month) async =>
      await request('GET', 'finance/summary?year=$year&month=$month')
          as Map<String, dynamic>;
  Future<Map<String, dynamic>> financeTransactions(int year, int month,
          {int page = 1}) async =>
      await request('GET',
              'finance/transactions?year=$year&month=$month&page=$page&pageSize=20')
          as Map<String, dynamic>;
  Future<List<Map<String, dynamic>>> financeBudgets(
          int year, int month) async =>
      (await request('GET', 'finance/budgets?year=$year&month=$month')
              as List<dynamic>)
          .cast<Map<String, dynamic>>();
  Future<Map<String, dynamic>> financeAnalytics(int year, int month) async =>
      await request('GET', 'finance/analytics?year=$year&month=$month')
          as Map<String, dynamic>;
  Future<Map<String, dynamic>> upsertFinanceBudget(
          Map<String, dynamic> body) async =>
      await request('POST', 'finance/budgets', body: body)
          as Map<String, dynamic>;
  Future<Map<String, dynamic>> updateFinanceBudget(
          String id, String amount) async =>
      await request('PATCH', 'finance/budgets/$id', body: {'amount': amount})
          as Map<String, dynamic>;
  Future<void> deleteFinanceBudget(String id) async {
    await request('DELETE', 'finance/budgets/$id');
  }

  Future<Map<String, dynamic>> createFinanceTransaction(
          Map<String, dynamic> body) async =>
      await request('POST', 'finance/transactions', body: body)
          as Map<String, dynamic>;
  Future<Map<String, dynamic>> updateFinanceTransaction(
          String id, Map<String, dynamic> body) async =>
      await request('PATCH', 'finance/transactions/$id', body: body)
          as Map<String, dynamic>;
  Future<void> deleteFinanceTransaction(String id) async {
    await request('DELETE', 'finance/transactions/$id');
  }

  Future<Map<String, dynamic>> createFinanceCategory(
          String name, String type) async =>
      await request('POST', 'finance/categories',
          body: {'name': name, 'type': type}) as Map<String, dynamic>;
  Future<Map<String, dynamic>> updateFinanceCategory(
          String id, String name) async =>
      await request('PATCH', 'finance/categories/$id', body: {'name': name})
          as Map<String, dynamic>;
  Future<void> deleteFinanceCategory(String id) async {
    await request('DELETE', 'finance/categories/$id');
  }

  Future<List<Map<String, dynamic>>> goldPrices() async =>
      (await request('GET', 'gold/prices') as List<dynamic>)
          .cast<Map<String, dynamic>>();
  Future<Map<String, dynamic>> goldHistory(
          String productCode, int days) async =>
      await request('GET',
              'gold/prices/${Uri.encodeComponent(productCode)}/history?days=$days&limit=200')
          as Map<String, dynamic>;
  Future<List<Map<String, dynamic>>> goldAlerts() async =>
      (await request('GET', 'gold/alerts') as List<dynamic>)
          .cast<Map<String, dynamic>>();
  Future<List<Map<String, dynamic>>> goldAlertTriggers() async =>
      (await request('GET', 'gold/alerts/triggers') as List<dynamic>)
          .cast<Map<String, dynamic>>();
  Future<Map<String, dynamic>> createGoldAlert(
          Map<String, dynamic> body) async =>
      await request('POST', 'gold/alerts', body: body) as Map<String, dynamic>;
  Future<Map<String, dynamic>> updateGoldAlert(
          String id, Map<String, dynamic> body) async =>
      await request('PATCH', 'gold/alerts/$id', body: body)
          as Map<String, dynamic>;
  Future<Map<String, dynamic>> setGoldAlertEnabled(
          String id, bool isEnabled) async =>
      await request('PATCH', 'gold/alerts/$id/enabled',
          body: {'isEnabled': isEnabled}) as Map<String, dynamic>;
  Future<void> deleteGoldAlert(String id) async {
    await request('DELETE', 'gold/alerts/$id');
  }

  Future<Map<String, dynamic>> registerPushDevice(
          String platform, String pushToken) async =>
      await request('POST', 'push/devices',
              body: {'platform': platform, 'pushToken': pushToken})
          as Map<String, dynamic>;
  Future<void> deactivatePushDevice(String id) async {
    await request('DELETE', 'push/devices/$id');
  }

  Future<void> logout() async {
    try {
      await request('POST', 'auth/logout');
    } finally {
      await clearTokens();
    }
  }

  Future<void> changePassword(
      String currentPassword, String newPassword) async {
    await request(
      'POST',
      'auth/change-password',
      body: {'currentPassword': currentPassword, 'newPassword': newPassword},
    );
  }

  Future<void> forgotPassword(String email) async {
    await request('POST', 'auth/forgot-password',
        body: {'email': email}, authenticated: false);
  }

  Future<void> resetPassword(String token, String newPassword) async {
    await request(
      'POST',
      'auth/reset-password',
      body: {'token': token, 'newPassword': newPassword},
      authenticated: false,
    );
  }

  Future<dynamic> request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    bool authenticated = true,
    bool retry = true,
  }) async {
    final response = await _send(method, path, body, authenticated);
    if (response.statusCode == 401 &&
        authenticated &&
        retry &&
        await _refresh()) {
      return request(method, path,
          body: body, authenticated: true, retry: false);
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(response.statusCode);
    }
    return response.body.isEmpty ? null : jsonDecode(response.body);
  }

  Future<http.Response> _send(String method, String path,
      Map<String, dynamic>? body, bool authenticated) {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (authenticated && _tokens != null) {
      headers['Authorization'] = 'Bearer ${_tokens!.accessToken}';
    }
    final request = http.Request(method, Uri.parse('${AppConfig.apiUrl}/$path'))
      ..headers.addAll(headers)
      ..body = body == null ? '' : jsonEncode(body);
    return _client.send(request).then(http.Response.fromStream);
  }

  Future<AuthResult> _authenticate(
      String path, Map<String, dynamic> body) async {
    final json = await request('POST', path, body: body, authenticated: false)
        as Map<String, dynamic>;
    final result = AuthResult.fromJson(json);
    await _acceptTokens(result.tokens);
    return result;
  }

  Future<bool> _refresh() {
    if (_refreshRequest != null) return _refreshRequest!;
    _refreshRequest =
        _performRefresh().whenComplete(() => _refreshRequest = null);
    return _refreshRequest!;
  }

  Future<bool> _performRefresh() async {
    if (_tokens == null) return false;
    final response = await _send(
        'POST', 'auth/refresh', {'refreshToken': _tokens!.refreshToken}, false);
    if (response.statusCode != 200) {
      await clearTokens();
      return false;
    }
    final result =
        AuthResult.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
    await _acceptTokens(result.tokens);
    return true;
  }

  Future<void> _acceptTokens(AuthTokens tokens) async {
    _tokens = tokens;
    await _tokenStore.write(tokens);
  }

  Future<void> clearTokens() async {
    _tokens = null;
    await _tokenStore.clear();
  }

  void close() => _client.close();
}
