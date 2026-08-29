import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../auth/auth_controller.dart';
import '../../config/app_config.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({required this.auth, super.key});
  final AuthController auth;
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool loading = true;
  bool checkedIn = false;
  String? checkedInAt;
  String? error;
  List<Map<String, dynamic>> monthRecords = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final now = DateTime.now();
      final results = await Future.wait([
        widget.auth.api.attendanceToday(AppConfig.timezone),
        widget.auth.api.attendanceMonth(now.year, now.month),
      ]);
      final items = results[1]['items'] as List<dynamic>? ?? const [];
      if (mounted) setState(() { checkedIn = results[0]['checkedIn'] == true; checkedInAt = results[0]['record']?['checkedInAt'] as String?; monthRecords = items.cast<Map<String, dynamic>>(); loading = false; error = null; });
    } catch (_) {
      if (mounted) setState(() { loading = false; error = 'Attendance could not be loaded.'; });
    }
  }

  Future<void> _checkIn() async {
    setState(() => loading = true);
    try {
      await widget.auth.api.checkIn(AppConfig.timezone);
      await _load();
    } catch (_) {
      if (mounted) setState(() { loading = false; error = 'Check-in was not completed.'; });
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: const Color(0xffeef4fb),
        appBar: AppBar(backgroundColor: Colors.transparent, title: const Text('Daily Life Manager')),
        body: ListView(padding: const EdgeInsets.all(20), children: [
          Text('Hello, ${widget.auth.account?.displayName ?? 'User'}', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 20),
          Card(
            elevation: 0,
            color: Colors.white.withValues(alpha: .74),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28), side: const BorderSide(color: Colors.white)),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: loading
                  ? const Center(child: CircularProgressIndicator())
                  : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(checkedIn ? 'Checked in today' : 'Ready for today?', style: Theme.of(context).textTheme.headlineSmall),
                      const SizedBox(height: 8),
                      Text(checkedIn ? 'Recorded at ${checkedInAt ?? ''}' : 'One tap records your local attendance.'),
                      const SizedBox(height: 18),
                      FilledButton.icon(onPressed: checkedIn ? null : _checkIn, icon: const Icon(Icons.touch_app), label: Text(checkedIn ? 'Complete' : 'Check In')),
                      const SizedBox(height: 8),
                      const Text(AppConfig.timezone),
                    ]),
            ),
          ),
          if (error != null) Padding(padding: const EdgeInsets.all(12), child: Text(error!, style: const TextStyle(color: Colors.red))),
          const SizedBox(height: 20),
          Text('This month · ${monthRecords.length} days', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          if (!loading && monthRecords.isEmpty)
            const Text('No earlier check-ins this month.')
          else
            ...monthRecords.take(7).map(
                  (record) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.check_circle_outline),
                    title: Text(record['attendanceDate'] as String),
                    subtitle: Text('${record['timezone']} · ${record['source']}'),
                  ),
                ),
        ]),
        persistentFooterButtons: [
          TextButton(onPressed: () => context.go('/change-password'), child: const Text('Change password')),
          TextButton(onPressed: widget.auth.logout, child: const Text('Sign out')),
        ],
      );
}
