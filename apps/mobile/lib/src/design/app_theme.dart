import 'package:flutter/material.dart';

abstract final class AppSpace {
  static const double xxs = 4, xs = 8, sm = 12, md = 16;
  static const double lg = 22, xl = 30, xxl = 42, page = 20, radius = 22;
}

abstract final class AppColors {
  static const canvas = Color(0xffeef1f0);
  static const elevated = Color(0xfff8faf9);
  static const surface = Color(0xfff7f9f8);
  static const glass = Color(0xcceef3f1);
  static const ink = Color(0xff17201d);
  static const secondary = Color(0xff5f6b67);
  static const tertiary = Color(0xff8a9490);
  static const line = Color(0xffd7dfdc);
  static const highlight = Color(0xe6ffffff);
  static const accent = Color(0xff147259);
  static const accentSoft = Color(0xffd7ebe3);
  static const danger = Color(0xffa63d40);
  static const warning = Color(0xff8b6419);
}

abstract final class AppTheme {
  static ThemeData light() {
    const colors = ColorScheme.light(
      primary: AppColors.accent,
      onPrimary: Colors.white,
      primaryContainer: AppColors.accentSoft,
      onPrimaryContainer: Color(0xff113f32),
      secondary: Color(0xff52665e),
      surface: AppColors.surface,
      onSurface: AppColors.ink,
      error: AppColors.danger,
      outline: AppColors.line,
      outlineVariant: Color(0xffe8ebe7),
    );
    final type = Typography.material2021(platform: TargetPlatform.iOS)
        .black
        .apply(bodyColor: AppColors.ink, displayColor: AppColors.ink);
    return ThemeData(
      useMaterial3: true,
      colorScheme: colors,
      scaffoldBackgroundColor: Colors.transparent,
      splashFactory: InkSparkle.splashFactory,
      textTheme: type.copyWith(
        displaySmall: type.displaySmall?.copyWith(
          fontSize: 36,
          height: 1.04,
          fontWeight: FontWeight.w600,
          letterSpacing: -1.4,
        ),
        headlineLarge: type.headlineLarge?.copyWith(
          fontSize: 28,
          height: 1.08,
          fontWeight: FontWeight.w600,
          letterSpacing: -1.1,
        ),
        headlineMedium: type.headlineMedium?.copyWith(
          fontSize: 24,
          height: 1.12,
          fontWeight: FontWeight.w600,
          letterSpacing: -.7,
        ),
        titleLarge: type.titleLarge?.copyWith(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          letterSpacing: -.25,
        ),
        titleMedium: type.titleMedium?.copyWith(fontWeight: FontWeight.w600),
        bodyLarge: type.bodyLarge?.copyWith(fontSize: 15.5, height: 1.4),
        bodyMedium: type.bodyMedium?.copyWith(fontSize: 14, height: 1.4),
        labelLarge: type.labelLarge?.copyWith(fontWeight: FontWeight.w600),
        labelMedium: type.labelMedium?.copyWith(
          color: AppColors.secondary,
          fontWeight: FontWeight.w600,
          letterSpacing: .2,
        ),
      ),
      appBarTheme: const AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: TextStyle(
          color: AppColors.ink,
          fontSize: 18,
          fontWeight: FontWeight.w600,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white.withValues(alpha: .72),
        labelStyle: const TextStyle(color: AppColors.secondary),
        hintStyle: const TextStyle(color: AppColors.secondary),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.accent, width: 1.5),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(48, 50),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(48, 48),
          side: const BorderSide(color: AppColors.line),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        elevation: 2,
        focusElevation: 2,
        hoverElevation: 2,
        backgroundColor: AppColors.ink,
        foregroundColor: Colors.white,
        shape: StadiumBorder(),
      ),
      dividerTheme:
          const DividerThemeData(color: AppColors.line, thickness: .7),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppColors.ink,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      dialogTheme: DialogThemeData(
        elevation: 8,
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surface,
        modalBackgroundColor: AppColors.surface,
        showDragHandle: true,
        surfaceTintColor: Colors.transparent,
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? Colors.white
              : AppColors.secondary,
        ),
        trackColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? AppColors.accent
              : AppColors.line,
        ),
      ),
    );
  }
}
