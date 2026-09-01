import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../auth/auth_controller.dart';
import '../../design/app_theme.dart';
import '../../design/app_widgets.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({required this.auth, super.key});
  final AuthController auth;
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final email = TextEditingController();
  final name = TextEditingController();
  final password = TextEditingController();
  String? error;

  @override
  void dispose() {
    email.dispose();
    name.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    try {
      await widget.auth.register(email.text, name.text, password.text);
    } catch (_) {
      if (mounted) {
        setState(() =>
            error = 'Unable to create account. Check the supplied details.');
      }
    }
  }

  @override
  Widget build(BuildContext context) => AuthLayout(
        title: 'Create account',
        subtitle:
            'A private home for the routines and numbers that shape your day.',
        children: [
          TextField(
              controller: name,
              decoration: const InputDecoration(labelText: 'Display name')),
          const SizedBox(height: AppSpace.md),
          TextField(
              controller: email,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Email')),
          const SizedBox(height: AppSpace.md),
          TextField(
              controller: password,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Password')),
          if (error != null) ...[
            const SizedBox(height: AppSpace.sm),
            Text(error!, style: const TextStyle(color: AppColors.danger))
          ],
          const SizedBox(height: AppSpace.lg),
          FilledButton(onPressed: submit, child: const Text('Create account')),
          const SizedBox(height: AppSpace.sm),
          TextButton(
              onPressed: () => context.go('/login'),
              child: const Text('Back to sign in')),
        ],
      );
}
