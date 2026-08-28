import 'package:flutter/foundation.dart';
import '../network/api_client.dart';
import 'account.dart';

enum AuthStatus { restoring, signedOut, signedIn }

class AuthController extends ChangeNotifier {
  AuthController(this.api);
  final ApiClient api;
  AuthStatus status = AuthStatus.restoring;
  Account? account;

  Future<void> restore() async {
    await api.restoreTokens();
    try {
      account = await api.me();
      status = AuthStatus.signedIn;
    } catch (_) {
      await api.clearTokens();
      status = AuthStatus.signedOut;
    }
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    final result = await api.login(email, password);
    account = result.account;
    status = AuthStatus.signedIn;
    notifyListeners();
  }

  Future<void> register(String email, String displayName, String password) async {
    final result = await api.register(email, displayName, password);
    account = result.account;
    status = AuthStatus.signedIn;
    notifyListeners();
  }

  Future<void> logout() async {
    await api.logout();
    account = null;
    status = AuthStatus.signedOut;
    notifyListeners();
  }
}
