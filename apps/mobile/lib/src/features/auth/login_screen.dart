import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../auth/auth_controller.dart';

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

  Future<void> submit() async {
    setState(() { busy = true; error = null; });
    try {
      await widget.auth.login(email.text, password.text);
    } catch (_) {
      if (mounted) setState(() => error = 'Invalid email or password.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Sign in')),
        body: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email')),
            TextField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: 'Password')),
            if (error != null) Text(error!, style: const TextStyle(color: Colors.red)),
            FilledButton(onPressed: busy ? null : submit, child: const Text('Sign in')),
            TextButton(onPressed: () => context.go('/register'), child: const Text('Create account')),
            TextButton(onPressed: () => context.go('/forgot-password'), child: const Text('Forgot password?')),
            TextButton(onPressed: () => context.go('/reset-password'), child: const Text('Have a reset token?')),
          ],
        ),
      );
}
