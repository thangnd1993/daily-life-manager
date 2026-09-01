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

  String _friendlyCheckInTime() {
    final parsed = DateTime.tryParse(checkedInAt ?? '')?.toLocal();
    return parsed == null
        ? 'today'
        : TimeOfDay.fromDateTime(parsed).format(context);
  }

  String _shortDate(DateTime date) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];
    return '${date.day.toString().padLeft(2, '0')} ${months[date.month - 1]}';
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
                  GlassSurface(
                    child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 260),
                        child: Column(
                            key: ValueKey(checkedIn),
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(children: [
                                Expanded(
                                    child: Text(time,
                                        style: Theme.of(context)
                                            .textTheme
                                            .displaySmall)),
                                Container(
                                    width: 52,
                                    height: 52,
                                    decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: checkedIn
                                            ? AppColors.accent
                                            : AppColors.ink),
                                    child: Icon(
                                        checkedIn
                                            ? Icons.check_rounded
                                            : Icons.fingerprint_rounded,
                                        color: Colors.white,
                                        size: 27)),
                              ]),
                              const SizedBox(height: AppSpace.xs),
                              Text(_shortDate(now),
                                  style: const TextStyle(
                                      color: AppColors.secondary)),
                              const SizedBox(height: AppSpace.lg),
                              StatusMark(
                                  label: checkedIn
                                      ? 'Checked in today'
                                      : 'Not checked in yet',
                                  positive: checkedIn),
                              const SizedBox(height: AppSpace.md),
                              Text(
                                  checkedIn
                                      ? 'You are all set'
                                      : 'Ready for today?',
                                  style: Theme.of(context)
                                      .textTheme
                                      .headlineSmall),
                              const SizedBox(height: AppSpace.xs),
                              Text(checkedIn
                                  ? 'Checked in at ${_friendlyCheckInTime()}.'
                                  : 'One tap records attendance using ${AppConfig.timezone}.'),
                              const SizedBox(height: AppSpace.lg),
                              if (!checkedIn)
                                SizedBox(
                                    width: double.infinity,
                                    child: FilledButton.icon(
                                        onPressed: _checkIn,
                                        icon: const Icon(
                                            Icons.touch_app_outlined),
                                        label: const Text('Check in now')))
                              else
                                Row(children: [
                                  const Icon(Icons.verified_rounded,
                                      color: AppColors.accent, size: 19),
                                  const SizedBox(width: 8),
                                  Text('Complete',
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleMedium
                                          ?.copyWith(color: AppColors.accent))
                                ]),
                            ])),
                  ),
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
