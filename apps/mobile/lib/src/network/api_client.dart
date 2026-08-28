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
  Future<AuthResult> register(String email, String displayName, String password) => _authenticate(
        'auth/register',
        {'email': email, 'displayName': displayName, 'password': password, 'deviceName': 'Mobile'},
      );
  Future<Account> me() async => Account.fromJson(await request('GET', 'auth/me') as Map<String, dynamic>);

  Future<void> logout() async {
    try {
      await request('POST', 'auth/logout');
    } finally {
      await clearTokens();
    }
  }

  Future<void> changePassword(String currentPassword, String newPassword) async {
    await request(
      'POST',
      'auth/change-password',
      body: {'currentPassword': currentPassword, 'newPassword': newPassword},
    );
  }
  Future<void> forgotPassword(String email) async {
    await request('POST', 'auth/forgot-password', body: {'email': email}, authenticated: false);
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
    if (response.statusCode == 401 && authenticated && retry && await _refresh()) {
      return request(method, path, body: body, authenticated: true, retry: false);
    }
    if (response.statusCode < 200 || response.statusCode >= 300) throw ApiException(response.statusCode);
    return response.body.isEmpty ? null : jsonDecode(response.body);
  }

  Future<http.Response> _send(String method, String path, Map<String, dynamic>? body, bool authenticated) {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (authenticated && _tokens != null) headers['Authorization'] = 'Bearer ${_tokens!.accessToken}';
    final request = http.Request(method, Uri.parse('${AppConfig.apiUrl}/$path'))
      ..headers.addAll(headers)
      ..body = body == null ? '' : jsonEncode(body);
    return _client.send(request).then(http.Response.fromStream);
  }

  Future<AuthResult> _authenticate(String path, Map<String, dynamic> body) async {
    final json = await request('POST', path, body: body, authenticated: false) as Map<String, dynamic>;
    final result = AuthResult.fromJson(json);
    await _acceptTokens(result.tokens);
    return result;
  }

  Future<bool> _refresh() {
    if (_refreshRequest != null) return _refreshRequest!;
    _refreshRequest = _performRefresh().whenComplete(() => _refreshRequest = null);
    return _refreshRequest!;
  }

  Future<bool> _performRefresh() async {
    if (_tokens == null) return false;
    final response = await _send('POST', 'auth/refresh', {'refreshToken': _tokens!.refreshToken}, false);
    if (response.statusCode != 200) {
      await clearTokens();
      return false;
    }
    final result = AuthResult.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
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
