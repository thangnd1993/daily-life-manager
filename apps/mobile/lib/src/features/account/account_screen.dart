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
      appBar: AppBar(
          title: const Text('Account'), automaticallyImplyLeading: false),
      body: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            GlassCard(
              child: Row(children: [
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
                      Text(account?.email ?? '',
                          overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 8),
                      StatusPill(
                          label: account?.status ?? 'ACTIVE',
                          icon: Icons.verified_user_outlined,
                          positive: account?.status == 'ACTIVE'),
                    ])),
              ]),
            ),
            const SizedBox(height: AppSpace.lg),
            Text('Security', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: AppSpace.sm),
            GlassCard(
              padding: EdgeInsets.zero,
              child: ListTile(
                minTileHeight: 64,
                leading: const Icon(Icons.lock_outline),
                title: const Text('Change password'),
                subtitle: const Text(
                    'Update your password and revoke other sessions'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.push('/change-password'),
              ),
            ),
            const SizedBox(height: AppSpace.lg),
            Text('Notifications',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: AppSpace.sm),
            const GlassCard(
                child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Icon(Icons.notifications_outlined),
                  SizedBox(width: AppSpace.md),
                  Expanded(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                        Text('Gold Alert push foundation',
                            style: TextStyle(fontWeight: FontWeight.w700)),
                        SizedBox(height: 4),
                        Text(
                            'Push registration is enabled when device support and permission are available. App use never depends on push access.')
                      ])),
                ])),
            const SizedBox(height: AppSpace.xl),
            OutlinedButton.icon(
                onPressed: () => _logout(context),
                icon: const Icon(Icons.logout),
                label: const Text('Sign out')),
          ]),
    );
  }
}
