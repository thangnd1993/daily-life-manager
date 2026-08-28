import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../auth/auth_controller.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({required this.auth, super.key});
  final AuthController auth;
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Daily Life Manager')),
        body: Center(child: Text('Welcome, ${auth.account?.displayName ?? 'User'}')),
        persistentFooterButtons: [
          TextButton(onPressed: () => context.go('/change-password'), child: const Text('Change password')),
          TextButton(onPressed: auth.logout, child: const Text('Sign out')),
        ],
      );
}
