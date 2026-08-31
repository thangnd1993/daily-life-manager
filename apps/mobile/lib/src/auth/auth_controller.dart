import 'package:flutter/foundation.dart';
import '../network/api_client.dart';
import 'account.dart';
import '../push/push_service.dart';

enum AuthStatus { restoring, signedOut, signedIn }

class AuthController extends ChangeNotifier {
  AuthController(this.api, {this.push});
  final ApiClient api;
  final PushService? push;
  AuthStatus status = AuthStatus.restoring;
  Account? account;

  Future<void> restore() async {
    await api.restoreTokens();
    try {
      account = await api.me();
      status = AuthStatus.signedIn;
      await push?.authenticated();
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
    await push?.authenticated();
  }

  Future<void> register(
      String email, String displayName, String password) async {
    final result = await api.register(email, displayName, password);
    account = result.account;
    status = AuthStatus.signedIn;
    notifyListeners();
    await push?.authenticated();
  }

  Future<void> logout() async {
    await push?.logout();
    await api.logout();
    account = null;
    status = AuthStatus.signedOut;
    notifyListeners();
  }
}
