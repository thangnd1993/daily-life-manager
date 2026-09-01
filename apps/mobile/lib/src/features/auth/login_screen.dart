import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../auth/auth_controller.dart';
import '../../design/app_theme.dart';
import '../../design/app_widgets.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({required this.auth, super.key});
  final AuthController auth;
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final email = TextEditingController();
  final password = TextEditingController();
  String? error;
  bool busy = false;
  bool obscurePassword = true;

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.auth.login(email.text, password.text);
    } catch (_) {
      if (mounted) setState(() => error = 'Invalid email or password.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => AuthLayout(
        title: 'Welcome back',
        subtitle:
            'Your day, money, and the signals that matter—kept in one calm place.',
        children: [
          TextField(
              controller: email,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              decoration: const InputDecoration(labelText: 'Email')),
          const SizedBox(height: AppSpace.md),
          TextField(
              controller: password,
              obscureText: obscurePassword,
              autofillHints: const [AutofillHints.password],
              onSubmitted: (_) => busy ? null : submit(),
              decoration: InputDecoration(
                  labelText: 'Password',
                  suffixIcon: IconButton(
                      tooltip:
                          obscurePassword ? 'Show password' : 'Hide password',
                      onPressed: () =>
                          setState(() => obscurePassword = !obscurePassword),
                      icon: Icon(obscurePassword
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined)))),
          if (error != null) ...[
            const SizedBox(height: AppSpace.sm),
            Text(error!, style: const TextStyle(color: AppColors.danger))
          ],
          const SizedBox(height: AppSpace.lg),
          FilledButton(
              onPressed: busy ? null : submit, child: const Text('Sign in')),
          const SizedBox(height: AppSpace.sm),
          TextButton(
              onPressed: () => context.go('/register'),
              child: const Text('Create account')),
          TextButton(
              onPressed: () => context.go('/forgot-password'),
              child: const Text('Forgot password?')),
          TextButton(
              onPressed: () => context.go('/reset-password'),
              child: const Text('Have a reset token?')),
        ],
      );
}
