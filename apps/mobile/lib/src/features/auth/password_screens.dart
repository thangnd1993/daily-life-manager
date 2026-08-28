import 'package:flutter/material.dart';
import '../../network/api_client.dart';

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
    if (mounted) setState(() => message = 'If that account exists, reset instructions have been requested.');
  }
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Forgot password')),
        body: ListView(padding: const EdgeInsets.all(24), children: [
          TextField(controller: email, decoration: const InputDecoration(labelText: 'Email')),
          FilledButton(onPressed: submit, child: const Text('Request reset')),
          if (message != null) Text(message!),
        ]),
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
    if (mounted) setState(() => message = 'Password reset. You can now sign in.');
  }
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Reset password')),
        body: ListView(padding: const EdgeInsets.all(24), children: [
          TextField(controller: token, decoration: const InputDecoration(labelText: 'Reset token')),
          TextField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: 'New password')),
          FilledButton(onPressed: submit, child: const Text('Reset password')),
          if (message != null) Text(message!),
        ]),
      );
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final current = TextEditingController();
  final next = TextEditingController();
  String? message;
  Future<void> submit() async {
    await widget.api.changePassword(current.text, next.text);
    if (mounted) setState(() => message = 'Password changed. Other sessions were signed out.');
  }
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Change password')),
        body: ListView(padding: const EdgeInsets.all(24), children: [
          TextField(controller: current, obscureText: true, decoration: const InputDecoration(labelText: 'Current password')),
          TextField(controller: next, obscureText: true, decoration: const InputDecoration(labelText: 'New password')),
          FilledButton(onPressed: submit, child: const Text('Change password')),
          if (message != null) Text(message!),
        ]),
      );
}
