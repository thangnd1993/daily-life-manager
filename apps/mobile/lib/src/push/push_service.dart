import 'dart:async';

import '../network/api_client.dart';

enum PushPermission { granted, denied, unavailable }

abstract interface class PushProvider {
  Future<PushPermission> requestPermission();
  Future<String?> token();
  Stream<String> get tokenRefreshes;
  Stream<Map<String, dynamic>> get notificationTaps;
}

class UnavailablePushProvider implements PushProvider {
  @override
  Future<PushPermission> requestPermission() async =>
      PushPermission.unavailable;
  @override
  Future<String?> token() async => null;
  @override
  Stream<String> get tokenRefreshes => const Stream.empty();
  @override
  Stream<Map<String, dynamic>> get notificationTaps => const Stream.empty();
}

class PushService {
  PushService(this.api, this.provider,
      {required this.platform, this.onGoldAlertTap});
  final ApiClient api;
  final PushProvider provider;
  final String platform;
  final void Function()? onGoldAlertTap;
  StreamSubscription<String>? _refresh;
  StreamSubscription<Map<String, dynamic>>? _taps;
  String? _deviceId;

  Future<void> authenticated() async {
    try {
      if (await provider.requestPermission() != PushPermission.granted) return;
      final value = await provider.token();
      if (value != null) await _register(value);
      _refresh ??= provider.tokenRefreshes.listen((token) async {
        try {
          await _register(token);
        } catch (_) {}
      });
      _taps ??= provider.notificationTaps.listen(handleTap);
    } catch (_) {}
  }

  void handleTap(Map<String, dynamic> data) {
    if (data['type'] == 'GOLD_ALERT' && data['route'] == '/gold') {
      onGoldAlertTap?.call();
    }
  }

  Future<void> logout() async {
    final id = _deviceId;
    _deviceId = null;
    if (id != null) {
      try {
        await api.deactivatePushDevice(id);
      } catch (_) {}
    }
  }

  Future<void> _register(String token) async {
    final result = await api.registerPushDevice(platform, token);
    _deviceId = result['id'] as String?;
  }

  Future<void> dispose() async {
    await _refresh?.cancel();
    await _taps?.cancel();
  }
}
