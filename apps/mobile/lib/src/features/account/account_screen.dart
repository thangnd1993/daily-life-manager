import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../auth/auth_controller.dart';
import '../../design/app_theme.dart';
import '../../design/app_widgets.dart';

class AccountScreen extends StatelessWidget {
  const AccountScreen({required this.auth, super.key});
  final AuthController auth;

  Future<void> _logout(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Sign out?'),
        content: const Text(
            'You will need to sign in again to access your personal data.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Sign out')),
        ],
      ),
    );
    if (confirmed == true) await auth.logout();
  }

  @override
  Widget build(BuildContext context) {
    final account = auth.account;
    return Scaffold(
      body: ListView(
          padding:
              const EdgeInsets.fromLTRB(AppSpace.page, 20, AppSpace.page, 120),
          children: [
            const PageHeader(eyebrow: 'Profile', title: 'Account'),
            const SizedBox(height: AppSpace.xl),
            Row(children: [
              CircleAvatar(
                  radius: 30,
                  child: Text(
                      (account?.displayName ?? 'U')
                          .characters
                          .first
                          .toUpperCase(),
                      style: Theme.of(context).textTheme.headlineSmall)),
              const SizedBox(width: AppSpace.md),
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Text(account?.displayName ?? 'User',
                        style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 4),
                    Text(account?.email ?? '', overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 8),
                    StatusMark(
                        label: account?.status ?? 'ACTIVE',
                        positive: account?.status == 'ACTIVE'),
                  ])),
            ]),
            const SizedBox(height: AppSpace.lg),
            const SectionHeader(title: 'Security'),
            const SizedBox(height: AppSpace.sm),
            GroupedSurface(children: [
              AppRow(
                leading: const Icon(Icons.lock_outline),
                title: 'Change password',
                subtitle: 'Update your password and revoke other sessions',
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.push('/change-password'),
              )
            ]),
            const SizedBox(height: AppSpace.lg),
            const SectionHeader(title: 'Notifications'),
            const SizedBox(height: AppSpace.sm),
            const GroupedSurface(children: [
              AppRow(
                  leading: Icon(Icons.notifications_outlined),
                  title: 'Gold Alert push foundation',
                  subtitle:
                      'Available when device support and permission are enabled.')
            ]),
            const SizedBox(height: AppSpace.xl),
            TextButton.icon(
                onPressed: () => _logout(context),
                icon: const Icon(Icons.logout),
                label: const Text('Sign out')),
          ]),
    );
  }
}
