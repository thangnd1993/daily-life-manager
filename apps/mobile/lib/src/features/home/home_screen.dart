import 'package:flutter/material.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Daily Life Manager')),
        body: const Center(child: Text('Your personal management foundation is ready.')),
      );
}
