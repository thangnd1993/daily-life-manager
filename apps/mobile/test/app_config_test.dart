import 'package:daily_life_manager/src/config/app_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('keeps the local API default only outside release mode', () {
    expect(
      AppConfig.resolveApiUrl('', isRelease: false),
      'http://localhost:3000/api',
    );
    expect(
      () => AppConfig.resolveApiUrl('', isRelease: true),
      throwsStateError,
    );
  });

  test('requires a credential-free HTTPS endpoint for release', () {
    expect(
      AppConfig.resolveApiUrl(
        'https://mobile.example.invalid/api/',
        isRelease: true,
      ),
      'https://mobile.example.invalid/api',
    );
    expect(
      () => AppConfig.resolveApiUrl(
        'http://10.0.2.2:3000/api',
        isRelease: true,
      ),
      throwsStateError,
    );
    expect(
      () => AppConfig.resolveApiUrl(
        'https://user:password@example.invalid/api',
        isRelease: true,
      ),
      throwsStateError,
    );
  });
}
