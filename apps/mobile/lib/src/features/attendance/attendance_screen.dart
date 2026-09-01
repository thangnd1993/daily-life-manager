import 'package:flutter/material.dart';
import '../../config/app_config.dart';
import '../../design/app_theme.dart';
import '../../design/app_widgets.dart';
import '../../network/api_client.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({required this.api, super.key});
  final ApiClient api;
  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen>
    with AutomaticKeepAliveClientMixin {
  bool loading = true;
  bool checkedIn = false;
  String? checkedInAt;
  String? error;
  List<Map<String, dynamic>> records = const [];
  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final now = DateTime.now();
      final results = await Future.wait([
        widget.api.attendanceToday(AppConfig.timezone),
        widget.api.attendanceMonth(now.year, now.month)
      ]);
      if (!mounted) return;
      setState(() {
        checkedIn = results[0]['checkedIn'] == true;
        checkedInAt = results[0]['record']?['checkedInAt'] as String?;
        records = (results[1]['items'] as List<dynamic>? ?? const [])
            .cast<Map<String, dynamic>>();
        loading = false;
        error = null;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          loading = false;
          error = 'Attendance could not be loaded.';
        });
      }
    }
  }

  Future<void> _checkIn() async {
    setState(() => loading = true);
    try {
      await widget.api.checkIn(AppConfig.timezone);
      await _load();
    } catch (_) {
      if (mounted) {
        setState(() {
          loading = false;
          error = 'Check-in was not completed. Pull down or retry.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final now = DateTime.now();
    final time = TimeOfDay.fromDateTime(now).format(context);
    return Scaffold(
      body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
              padding: const EdgeInsets.fromLTRB(
                  AppSpace.page, 20, AppSpace.page, 120),
              children: [
                const PageHeader(eyebrow: 'Daily rhythm', title: 'Attendance'),
                const SizedBox(height: AppSpace.xl),
                if (loading)
                  const Center(
                      child: Padding(
                          padding: EdgeInsets.all(48),
                          child: CircularProgressIndicator()))
                else if (error != null)
                  AppStateCard(
                      icon: Icons.cloud_off_outlined,
                      title: 'Attendance unavailable',
                      message: error!,
                      onRetry: _load)
                else
                  Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(time,
                            style: Theme.of(context).textTheme.displaySmall),
                        const SizedBox(height: AppSpace.xs),
                        Text('${now.day}/${now.month}/${now.year}',
                            style: const TextStyle(color: AppColors.secondary)),
                        const SizedBox(height: AppSpace.lg),
                        StatusMark(
                            label: checkedIn
                                ? 'Checked in today'
                                : 'Not checked in yet',
                            positive: checkedIn),
                        const SizedBox(height: AppSpace.md),
                        Text(checkedIn ? 'You are all set' : 'Ready for today?',
                            style: Theme.of(context).textTheme.headlineSmall),
                        const SizedBox(height: AppSpace.xs),
                        Text(checkedIn
                            ? 'Recorded at ${checkedInAt ?? 'today'}.'
                            : 'One tap records attendance using ${AppConfig.timezone}.'),
                        const SizedBox(height: AppSpace.lg),
                        SizedBox(
                            width: double.infinity,
                            child: FilledButton.icon(
                                onPressed: checkedIn ? null : _checkIn,
                                icon: const Icon(Icons.touch_app_outlined),
                                label: Text(
                                    checkedIn ? 'Complete' : 'Check in now'))),
                      ]),
                const SizedBox(height: AppSpace.xl),
                const SectionHeader(title: 'This month'),
                const SizedBox(height: AppSpace.sm),
                if (!loading && error == null && records.isEmpty)
                  const AppStateCard(
                      icon: Icons.calendar_month_outlined,
                      title: 'No earlier check-ins',
                      message: 'Your attendance history will appear here.')
                else
                  GroupedSurface(
                      children: records
                          .take(31)
                          .map((record) => AppRow(
                                leading: const Icon(
                                    Icons.check_circle_outline_rounded,
                                    color: AppColors.accent),
                                title: record['attendanceDate'] as String,
                                subtitle:
                                    '${record['timezone']} · ${record['source']}',
                              ))
                          .toList()),
              ])),
    );
  }
}
