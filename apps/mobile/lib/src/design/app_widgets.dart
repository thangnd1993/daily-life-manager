import 'package:flutter/material.dart';
import 'app_theme.dart';

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
  Widget build(BuildContext context) => Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(AppSpace.radius),
          onTap: onTap,
          child: Padding(padding: padding, child: child),
        ),
      );
}

class AppStateCard extends StatelessWidget {
  const AppStateCard(
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
  Widget build(BuildContext context) => GlassCard(
        child: Column(children: [
          Icon(icon, size: 34, color: Theme.of(context).colorScheme.primary),
          const SizedBox(height: AppSpace.sm),
          Text(title,
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center),
          const SizedBox(height: AppSpace.xs),
          Text(message, textAlign: TextAlign.center),
          if (onRetry != null) ...[
            const SizedBox(height: AppSpace.md),
            OutlinedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Try again')),
          ],
        ]),
      );
}

class StatusPill extends StatelessWidget {
  const StatusPill(
      {required this.label,
      required this.icon,
      this.positive = false,
      super.key});
  final String label;
  final IconData icon;
  final bool positive;
  @override
  Widget build(BuildContext context) {
    final color = positive
        ? Colors.green.shade800
        : Theme.of(context).colorScheme.primary;
    return Semantics(
      label: label,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
            color: color.withValues(alpha: .1),
            borderRadius: BorderRadius.circular(99)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 6),
          Text(label,
              style: TextStyle(color: color, fontWeight: FontWeight.w700))
        ]),
      ),
    );
  }
}
