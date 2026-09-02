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

  String _historyDate(dynamic value) {
    final parsed = DateTime.tryParse(value?.toString() ?? '');
    return parsed == null
        ? 'Recent check-in'
        : '${_shortDate(parsed)} ${parsed.year}';
  }

  String _friendlySource(Map<String, dynamic> record) {
    final source = record['source']?.toString().toLowerCase();
    final sourceLabel = source == null || source.isEmpty
        ? 'Mobile'
        : '${source[0].toUpperCase()}${source.substring(1)}';
    final checkedAt =
        DateTime.tryParse(record['checkedInAt']?.toString() ?? '')?.toLocal();
    return checkedAt == null
        ? sourceLabel
        : '${TimeOfDay.fromDateTime(checkedAt).format(context)} · $sourceLabel';
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
                Row(children: [
                  const Icon(Icons.arrow_back_ios_new_rounded, size: 17),
                  const SizedBox(width: 20),
                  Text('Attendance',
                      style: Theme.of(context).textTheme.titleLarge),
                ]),
                const SizedBox(height: AppSpace.md),
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
                    padding: const EdgeInsets.all(18),
                    child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 260),
                        child: Column(
                            key: ValueKey(checkedIn),
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(
                                        child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                          Text(time,
                                              style: Theme.of(context)
                                                  .textTheme
                                                  .headlineLarge),
                                          const SizedBox(height: 3),
                                          Text('${_shortDate(now)} ${now.year}',
                                              style: const TextStyle(
                                                  fontSize: 12,
                                                  color: AppColors.secondary)),
                                        ])),
                                    Container(
                                        width: 64,
                                        height: 64,
                                        decoration: BoxDecoration(
                                            shape: BoxShape.circle,
                                            color: AppColors.accent,
                                            border: Border.all(
                                                color: const Color(0x88ffffff),
                                                width: 8),
                                            boxShadow: const [
                                              BoxShadow(
                                                  color: Color(0x44246bfd),
                                                  blurRadius: 20)
                                            ]),
                                        child: Icon(
                                            checkedIn
                                                ? Icons.check_rounded
                                                : Icons.fingerprint_rounded,
                                            color: Colors.white,
                                            size: 26)),
                                  ]),
                              const SizedBox(height: AppSpace.sm),
                              Align(
                                  alignment: Alignment.centerRight,
                                  child: Column(children: [
                                    Text(
                                        checkedIn
                                            ? 'You are all set'
                                            : 'Ready for today?',
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleMedium),
                                    Text(
                                        checkedIn
                                            ? 'Checked in at ${_friendlyCheckInTime()}'
                                            : 'Check in with one tap',
                                        style: const TextStyle(
                                            fontSize: 11,
                                            color: AppColors.secondary)),
                                  ])),
                              const SizedBox(height: AppSpace.sm),
                              if (!checkedIn)
                                SizedBox(
                                    width: double.infinity,
                                    child: FilledButton.icon(
                                        onPressed: _checkIn,
                                        icon: const Icon(
                                            Icons.touch_app_outlined),
                                        label: const Text('Check in now')))
                              else
                                Container(
                                    height: 40,
                                    decoration: BoxDecoration(
                                        border:
                                            Border.all(color: AppColors.line),
                                        borderRadius:
                                            BorderRadius.circular(14)),
                                    child: const Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.center,
                                        children: [
                                          Icon(Icons.verified_rounded,
                                              color: AppColors.secondary,
                                              size: 16),
                                          SizedBox(width: 8),
                                          Text('Completed',
                                              style: TextStyle(fontSize: 12)),
                                        ])),
                            ])),
                  ),
                const SizedBox(height: AppSpace.md),
                const SectionHeader(title: 'This month'),
                const SizedBox(height: AppSpace.sm),
                if (!loading && error == null)
                  GlassSurface(
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpace.lg, vertical: AppSpace.md),
                    child: Row(children: [
                      Text('${records.length}',
                          style: Theme.of(context).textTheme.headlineMedium),
                      const SizedBox(width: 6),
                      Text(records.length == 1 ? 'day' : 'days'),
                      const Spacer(),
                      const StatusMark(label: 'Present', positive: true),
                    ]),
                  ),
                if (!loading && error == null)
                  const SizedBox(height: AppSpace.md),
                const SectionHeader(title: 'Recent check-ins'),
                const SizedBox(height: AppSpace.sm),
                if (!loading && error == null && records.isEmpty)
                  const GlassSurface(
                      padding: EdgeInsets.symmetric(vertical: 20),
                      child: Center(
                          child: Text('No check-ins yet',
                              style: TextStyle(
                                  fontSize: 12, color: AppColors.secondary))))
                else
                  GroupedSurface(
                      children: records
                          .take(31)
                          .map((record) => AppRow(
                                leading: const Icon(
                                    Icons.check_circle_outline_rounded,
                                    color: AppColors.accent),
                                title: _historyDate(record['attendanceDate']),
                                subtitle: _friendlySource(record),
                              ))
                          .toList()),
              ])),
    );
  }
}
