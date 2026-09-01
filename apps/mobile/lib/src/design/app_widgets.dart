import 'package:flutter/material.dart';
import 'dart:ui';

import 'app_theme.dart';

class AppBackground extends StatelessWidget {
  const AppBackground({required this.child, super.key});
  final Widget child;
  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xfff8faf9), Color(0xffedf2f0), Color(0xfff4f1eb)],
            stops: [0, .58, 1],
          ),
        ),
        child: Stack(fit: StackFit.expand, children: [
          const Positioned(
              top: -110,
              right: -90,
              child: _AmbientOrb(color: Color(0x2244a88a), size: 270)),
          const Positioned(
              bottom: 80,
              left: -120,
              child: _AmbientOrb(color: Color(0x18d4a65c), size: 290)),
          child,
        ]),
      );
}

class _AmbientOrb extends StatelessWidget {
  const _AmbientOrb({required this.color, required this.size});
  final Color color;
  final double size;
  @override
  Widget build(BuildContext context) => ImageFiltered(
        imageFilter: ImageFilter.blur(sigmaX: 42, sigmaY: 42),
        child: Container(
            width: size,
            height: size,
            decoration: BoxDecoration(shape: BoxShape.circle, color: color)),
      );
}

class GlassSurface extends StatelessWidget {
  const GlassSurface(
      {required this.child,
      this.padding = const EdgeInsets.all(20),
      this.onTap,
      this.radius = 26,
      super.key});
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final double radius;
  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
          child: Material(
            color: AppColors.glass.withValues(alpha: .72),
            child: InkWell(
              onTap: onTap,
              child: Container(
                padding: padding,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(radius),
                  border: Border.all(
                      color: AppColors.highlight.withValues(alpha: .88)),
                  boxShadow: const [
                    BoxShadow(
                        color: Color(0x140b2820),
                        blurRadius: 28,
                        offset: Offset(0, 12))
                  ],
                ),
                child: child,
              ),
            ),
          ),
        ),
      );
}

class TrendLine extends StatelessWidget {
  const TrendLine(
      {required this.values,
      this.height = 64,
      this.color = AppColors.accent,
      super.key});
  final List<double> values;
  final double height;
  final Color color;
  @override
  Widget build(BuildContext context) => SizedBox(
      height: height,
      width: double.infinity,
      child: CustomPaint(painter: _TrendPainter(values, color)));
}

class _TrendPainter extends CustomPainter {
  const _TrendPainter(this.values, this.color);
  final List<double> values;
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    if (values.length < 2) return;
    final minValue = values.reduce((a, b) => a < b ? a : b);
    final maxValue = values.reduce((a, b) => a > b ? a : b);
    final range = maxValue == minValue ? 1 : maxValue - minValue;
    final path = Path();
    for (var i = 0; i < values.length; i++) {
      final x = size.width * i / (values.length - 1);
      final y = size.height -
          8 -
          ((values[i] - minValue) / range) * (size.height - 16);
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    final glow = Paint()
      ..color = color.withValues(alpha: .16)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 8
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6);
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(path, glow);
    canvas.drawPath(path, stroke);
  }

  @override
  bool shouldRepaint(covariant _TrendPainter oldDelegate) =>
      oldDelegate.values != values || oldDelegate.color != color;
}

class PageHeader extends StatelessWidget {
  const PageHeader(
      {required this.title,
      this.eyebrow,
      this.subtitle,
      this.trailing,
      super.key});
  final String title;
  final String? eyebrow;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (eyebrow != null) ...[
                Text(eyebrow!.toUpperCase(),
                    style: Theme.of(context).textTheme.labelMedium),
                const SizedBox(height: AppSpace.xs),
              ],
              Text(title, style: Theme.of(context).textTheme.headlineLarge),
              if (subtitle != null) ...[
                const SizedBox(height: AppSpace.xs),
                Text(subtitle!,
                    style: Theme.of(context)
                        .textTheme
                        .bodyLarge
                        ?.copyWith(color: AppColors.secondary)),
              ],
            ]),
          ),
          if (trailing != null) ...[
            const SizedBox(width: AppSpace.md),
            trailing!
          ],
        ],
      );
}

class SectionHeader extends StatelessWidget {
  const SectionHeader(
      {required this.title, this.action, this.onAction, super.key});
  final String title;
  final String? action;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) => Row(children: [
        Expanded(
            child: Text(title, style: Theme.of(context).textTheme.titleLarge)),
        if (action != null)
          TextButton(onPressed: onAction, child: Text(action!)),
      ]);
}

class GroupedSurface extends StatelessWidget {
  const GroupedSurface({required this.children, super.key});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpace.radius),
        clipBehavior: Clip.antiAlias,
        child: DecoratedBox(
            decoration: const BoxDecoration(color: Colors.transparent),
            child: Column(children: [
              for (var i = 0; i < children.length; i++) ...[
                children[i],
                if (i != children.length - 1)
                  const Divider(height: 1, indent: 18),
              ],
            ])),
      );
}

class AppRow extends StatelessWidget {
  const AppRow(
      {required this.title,
      this.subtitle,
      this.leading,
      this.trailing,
      this.onTap,
      this.onLongPress,
      super.key});
  final String title;
  final String? subtitle;
  final Widget? leading;
  final Widget? trailing;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  @override
  Widget build(BuildContext context) => ListTile(
        minTileHeight: 62,
        contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 3),
        leading: leading,
        title: Text(title),
        subtitle: subtitle == null
            ? null
            : Text(subtitle!,
                style: const TextStyle(color: AppColors.secondary)),
        trailing: trailing,
        onTap: onTap,
        onLongPress: onLongPress,
      );
}

class StatusMark extends StatelessWidget {
  const StatusMark({required this.label, this.positive = false, super.key});
  final String label;
  final bool positive;
  @override
  Widget build(BuildContext context) => Semantics(
        label: label,
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: positive ? AppColors.success : AppColors.warning)),
          const SizedBox(width: AppSpace.xs),
          Flexible(
              child: Text(label,
                  style: Theme.of(context)
                      .textTheme
                      .bodyMedium
                      ?.copyWith(color: AppColors.secondary))),
        ]),
      );
}

class AppStateView extends StatelessWidget {
  const AppStateView(
      {required this.icon,
      required this.title,
      required this.message,
      this.onRetry,
      super.key});
  final IconData icon;
  final String title;
  final String message;
  final Future<void> Function()? onRetry;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpace.xxl),
        child: Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 34, color: AppColors.secondary),
          const SizedBox(height: AppSpace.md),
          Text(title,
              style: Theme.of(context).textTheme.titleLarge,
              textAlign: TextAlign.center),
          const SizedBox(height: AppSpace.xs),
          Text(message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.secondary)),
          if (onRetry != null) ...[
            const SizedBox(height: AppSpace.md),
            OutlinedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Try again')),
          ],
        ])),
      );
}

class CompactSegmented<T> extends StatelessWidget {
  const CompactSegmented(
      {required this.values,
      required this.selected,
      required this.onSelected,
      super.key});
  final Map<T, String> values;
  final T selected;
  final ValueChanged<T> onSelected;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
            color: AppColors.line.withValues(alpha: .55),
            borderRadius: BorderRadius.circular(14)),
        child: Row(
            children: values.entries.map((entry) {
          final active = entry.key == selected;
          return Expanded(
              child: Semantics(
            selected: active,
            button: true,
            child: InkWell(
              borderRadius: BorderRadius.circular(11),
              onTap: () => onSelected(entry.key),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 160),
                padding: const EdgeInsets.symmetric(vertical: 9),
                decoration: BoxDecoration(
                    color: active ? AppColors.surface : Colors.transparent,
                    borderRadius: BorderRadius.circular(11),
                    boxShadow: active
                        ? const [
                            BoxShadow(color: Color(0x12000000), blurRadius: 8)
                          ]
                        : null),
                child: Text(entry.value,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontWeight:
                            active ? FontWeight.w600 : FontWeight.w500)),
              ),
            ),
          ));
        }).toList()),
      );
}

class SheetFrame extends StatelessWidget {
  const SheetFrame({required this.title, required this.child, super.key});
  final String title;
  final Widget child;
  @override
  Widget build(BuildContext context) => SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(AppSpace.page, 0, AppSpace.page,
              MediaQuery.viewInsetsOf(context).bottom + AppSpace.lg),
          child: SingleChildScrollView(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(title, style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: AppSpace.lg),
                child,
              ])),
        ),
      );
}

class AuthLayout extends StatelessWidget {
  const AuthLayout(
      {required this.title,
      required this.subtitle,
      required this.children,
      super.key});
  final String title;
  final String subtitle;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Scaffold(
        body: AppBackground(
            child: SafeArea(
                child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(
              AppSpace.page,
              AppSpace.xl,
              AppSpace.page,
              MediaQuery.viewInsetsOf(context).bottom + AppSpace.lg),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Align(
                alignment: Alignment.centerLeft,
                child: Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                        color: AppColors.ink,
                        borderRadius: BorderRadius.circular(15)),
                    child: const Icon(Icons.blur_on_rounded,
                        color: Colors.white))),
            const SizedBox(height: AppSpace.xl),
            Text(title, style: Theme.of(context).textTheme.headlineLarge),
            const SizedBox(height: AppSpace.sm),
            Text(subtitle,
                style: Theme.of(context)
                    .textTheme
                    .bodyLarge
                    ?.copyWith(color: AppColors.secondary)),
            const SizedBox(height: AppSpace.lg),
            GlassSurface(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: children)),
          ]),
        ))),
      );
}

// Compatibility aliases while feature screens migrate to the lighter primitives.
class GlassCard extends StatelessWidget {
  const GlassCard(
      {required this.child,
      this.onTap,
      this.padding = const EdgeInsets.all(AppSpace.lg),
      super.key});
  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  @override
  Widget build(BuildContext context) => GroupedSurface(children: [
        InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(AppSpace.radius),
            child: Padding(padding: padding, child: child))
      ]);
}

class AppStateCard extends AppStateView {
  const AppStateCard(
      {required super.icon,
      required super.title,
      required super.message,
      super.onRetry,
      super.key});
}

class StatusPill extends StatusMark {
  const StatusPill(
      {required super.label,
      required IconData icon,
      super.positive,
      super.key});
}
