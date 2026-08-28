import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../auth/auth_controller.dart';

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

  Future<void> submit() async {
    try {
      await widget.auth.register(email.text, name.text, password.text);
    } catch (_) {
      if (mounted) setState(() => error = 'Unable to create account. Check the supplied details.');
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Create account')),
        body: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            TextField(controller: name, decoration: const InputDecoration(labelText: 'Display name')),
            TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email')),
            TextField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: 'Password')),
            if (error != null) Text(error!, style: const TextStyle(color: Colors.red)),
            FilledButton(onPressed: submit, child: const Text('Create account')),
            TextButton(onPressed: () => context.go('/login'), child: const Text('Back to sign in')),
          ],
        ),
      );
}
