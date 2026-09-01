import 'package:flutter/material.dart';

import 'app_theme.dart';

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
                  color: positive ? AppColors.accent : AppColors.warning)),
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
        body: SafeArea(
            child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(
              AppSpace.page,
              AppSpace.xxl,
              AppSpace.page,
              MediaQuery.viewInsetsOf(context).bottom + AppSpace.lg),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(title, style: Theme.of(context).textTheme.headlineLarge),
            const SizedBox(height: AppSpace.sm),
            Text(subtitle,
                style: Theme.of(context)
                    .textTheme
                    .bodyLarge
                    ?.copyWith(color: AppColors.secondary)),
            const SizedBox(height: AppSpace.xl),
            ...children,
          ]),
        )),
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
