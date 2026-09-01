import 'package:flutter/material.dart';
import '../../network/api_client.dart';
import '../../design/app_theme.dart';
import '../../design/app_widgets.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({required this.api, super.key});
  final ApiClient api;
  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final email = TextEditingController();
  String? message;
  Future<void> submit() async {
    await widget.api.forgotPassword(email.text);
    if (mounted) {
      setState(() => message =
          'If that account exists, reset instructions have been requested.');
    }
  }

  @override
  Widget build(BuildContext context) => AuthLayout(
        title: 'Forgot password',
        subtitle:
            'Enter your email and we’ll request secure reset instructions.',
        children: [
          TextField(
              controller: email,
              decoration: const InputDecoration(labelText: 'Email')),
          const SizedBox(height: AppSpace.lg),
          FilledButton(onPressed: submit, child: const Text('Request reset')),
          if (message != null) ...[
            const SizedBox(height: AppSpace.md),
            Text(message!)
          ],
        ],
      );
}

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({required this.api, super.key});
  final ApiClient api;
  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({required this.api, super.key});
  final ApiClient api;
  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final token = TextEditingController();
  final password = TextEditingController();
  String? message;
  Future<void> submit() async {
    await widget.api.resetPassword(token.text, password.text);
    if (mounted) {
      setState(() => message = 'Password reset. You can now sign in.');
    }
  }

  @override
  Widget build(BuildContext context) => AuthLayout(
        title: 'Reset password',
        subtitle: 'Use the secure token from your reset instructions.',
        children: [
          TextField(
              controller: token,
              decoration: const InputDecoration(labelText: 'Reset token')),
          const SizedBox(height: AppSpace.md),
          TextField(
              controller: password,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'New password')),
          const SizedBox(height: AppSpace.lg),
          FilledButton(onPressed: submit, child: const Text('Reset password')),
          if (message != null) ...[
            const SizedBox(height: AppSpace.md),
            Text(message!)
          ],
        ],
      );
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final current = TextEditingController();
  final next = TextEditingController();
  String? message;
  Future<void> submit() async {
    await widget.api.changePassword(current.text, next.text);
    if (mounted) {
      setState(
          () => message = 'Password changed. Other sessions were signed out.');
    }
  }

  @override
  Widget build(BuildContext context) => AuthLayout(
        title: 'Change password',
        subtitle:
            'Choose a new password and securely close your other sessions.',
        children: [
          TextField(
              controller: current,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Current password')),
          const SizedBox(height: AppSpace.md),
          TextField(
              controller: next,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'New password')),
          const SizedBox(height: AppSpace.lg),
          FilledButton(onPressed: submit, child: const Text('Change password')),
          if (message != null) ...[
            const SizedBox(height: AppSpace.md),
            Text(message!)
          ],
        ],
      );
}
