# Mobile release preparation

## Shared release configuration

The Android application ID and intended iOS bundle ID are `com.thangnd1993.dailylifemanager`; the user-facing name is
**Daily Life Manager**. Flutter currently declares `version: 0.1.0+1`: `0.1.0` maps to Android `versionName` and iOS
`CFBundleShortVersionString`, while `1` maps to Android `versionCode` and iOS `CFBundleVersion`. Increment the semantic version
for user-visible releases and always increase the build number for each store upload.

Release builds require the existing compile-time `API_URL` setting. The application rejects a missing release value, rejects
credentials/query strings/fragments, and requires HTTPS. Local debug builds retain the localhost default. Build against the
operator-owned API without placing secrets in the app:

```powershell
flutter build appbundle --release --dart-define=API_URL=https://YOUR_API_HOST/api
```

Never put JWT secrets, Gold provider keys, Firebase Admin credentials, passwords, or signing secrets in Dart defines or mobile
assets. HTTPS certificates must be valid on real devices. The release Android manifest disallows cleartext traffic; only the
debug manifest permits it for local development.

## Android

### Signing and build

Production signing is external to Git and never falls back to Flutter's debug key. Keep the upload keystore outside the
repository (or in an ignored location), copy `android/key.properties.example` to ignored `android/key.properties`, and replace
all four values. `storeFile` may be absolute or relative to `android/app`. Protect and back up the upload key and passwords.
With valid signing configuration, create the Play artifact from `apps/mobile`:

```powershell
flutter pub get
flutter analyze
flutter test
flutter build appbundle --release --dart-define=API_URL=https://YOUR_API_HOST/api
```

Without `key.properties`, Gradle intentionally produces only unsigned release output. It is useful for compilation inspection
but cannot be uploaded as a production-signed Play release. Verify the AAB with `bundletool` or Play's internal testing track,
install/test the generated APK on supported devices, and confirm version, API connectivity, authentication, secure token
storage, Attendance, Finance, Gold, and Account behavior before promotion.

### Firebase and Play Console

Register an Android Firebase app using the exact package ID, download its real `google-services.json`, and place it at
`android/app/google-services.json`; Git ignores that file. The current app intentionally uses `UnavailablePushProvider` until a
real Firebase Messaging client adapter and standard Google Services Gradle plugin are configured with the actual Firebase app.
At that time verify FCM token registration/refresh, logout deactivation, Gold Alert routing, Android 13+ notification permission,
and foreground/background delivery. Do not use or embed the server-side Firebase service account in the mobile app.

Before Play upload, an account owner must supply the signed AAB, final adaptive/launcher icon and splash assets, screenshots,
store text, support contact, privacy-policy URL, content rating, target-audience declarations, and truthful Data safety answers.
The app processes account identity, authentication/session data, Attendance, personal Finance, Gold Alerts, device push tokens,
and notification data; legal/product owners must determine collection, retention, sharing, and deletion declarations. Start with
an internal testing track and complete Play pre-launch checks before wider release.

## iOS

The standard iOS Flutter host exists with bundle ID `com.thangnd1993.dailylifemanager`, display name **Daily Life Manager**,
iOS deployment target 15.0, and Flutter-managed version/build values. Windows can inspect these files but cannot validate CocoaPods,
Xcode compilation, code signing, archiving, or App Store submission.

On macOS with a supported Xcode version, the Apple account owner must:

1. Open `ios/Runner.xcworkspace`, select the correct Apple team, and register the exact bundle ID.
2. Create/manage Apple Development and Distribution certificates plus provisioning profiles; do not commit them.
3. Register the matching Firebase iOS app and place the real, ignored `GoogleService-Info.plist` at
   `ios/Runner/GoogleService-Info.plist`.
4. Configure APNs authentication in Firebase, then enable the Runner **Push Notifications** capability and **Background Modes →
   Remote notifications** when the Firebase Messaging adapter is integrated.
5. Run CocoaPods through Flutter, build/archive with the production `API_URL`, and test notification permission, foreground,
   background, and tap-routing behavior on a physical device.

An App Store Connect owner must then create the app record, provide privacy-policy/support URLs, screenshots, final icons,
description, age rating, App Privacy answers, export-compliance answers, review details, and any required account-deletion
instructions. Upload only a correctly signed Xcode archive after TestFlight verification. No Apple certificate, provisioning
profile, APNs key, Firebase plist, App Store record, or archive is created by this repository.

## Final engineering checklist

- Confirm `pubspec.yaml` version/build is greater than every prior store upload.
- Build with the real HTTPS API origin and inspect the artifact for local URLs and secrets.
- Supply platform Firebase client files outside Git and test push only after the native adapter is integrated.
- Replace the current generated placeholder icon/splash artwork with approved repository-owned assets.
- Run analyze/tests and physical-device smoke tests on supported Android and iOS versions.
- Verify signing identity, package/bundle ID, permissions, privacy declarations, and store listing assets.
- Retain signing-key backups and release artifacts according to the operator's secure release process.
- Publish only through an explicitly authorized Google Play or App Store operation.
