import 'package:flutter/foundation.dart';

class AppConfig {
  const AppConfig._();

  static const _configuredApiUrl = String.fromEnvironment('API_URL');
  static String get apiUrl =>
      resolveApiUrl(_configuredApiUrl, isRelease: kReleaseMode);

  static String resolveApiUrl(String configured, {required bool isRelease}) {
    final value = configured.trim();
    if (value.isEmpty) {
      if (isRelease) {
        throw StateError('API_URL is required for release builds');
      }
      return 'http://localhost:3000/api';
    }

    final uri = Uri.tryParse(value);
    if (uri == null ||
        !uri.hasScheme ||
        !uri.hasAuthority ||
        !{'http', 'https'}.contains(uri.scheme) ||
        uri.userInfo.isNotEmpty ||
        uri.query.isNotEmpty ||
        uri.fragment.isNotEmpty) {
      throw StateError('API_URL must be an absolute HTTP(S) URL');
    }
    if (isRelease && uri.scheme != 'https') {
      throw StateError('API_URL must use HTTPS in release builds');
    }
    return value.replaceFirst(RegExp(r'/+$'), '');
  }

  static const timezone =
      String.fromEnvironment('TIMEZONE', defaultValue: 'Asia/Ho_Chi_Minh');
}
