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
  bool loading = true, enabled = false, leaveMode = false;
  String? error, leaveReason;
  Map<String, dynamic>? today;
  List<Map<String, dynamic>> records = const [];
  int workedDays = 0, totalMinutes = 0, offDays = 0;
  DateTime displayedMonth = DateTime(DateTime.now().year, DateTime.now().month);
  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        loading = true;
        error = null;
      });
    }
    try {
      final data = await Future.wait([
        widget.api.attendanceToday(AppConfig.timezone),
        widget.api.attendanceMonth(displayedMonth.year, displayedMonth.month)
      ]);
      final current = data[0], month = data[1];
      if (!mounted) {
        return;
      }
      setState(() {
        enabled = current['featureEnabled'] != false;
        leaveMode = current['leaveModeEnabled'] == true;
        leaveReason = current['leaveReason'] as String?;
        today = current['record'] as Map<String, dynamic>?;
        records = (month['items'] as List<dynamic>? ?? const [])
            .cast<Map<String, dynamic>>();
        workedDays = month['workedDays'] as int? ?? 0;
        totalMinutes = month['totalWorkedMinutes'] as int? ?? 0;
        offDays = month['offDays'] as int? ?? 0;
        loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          loading = false;
          error = 'Work records could not be loaded.';
        });
      }
    }
  }

  String _duration(int minutes) {
    if (minutes <= 0) return 'Off';
    final h = minutes ~/ 60, m = minutes % 60;
    return m == 0 ? '$h h' : '$h h $m min';
  }

  String _date(dynamic value) {
    final date = DateTime.tryParse(value?.toString() ?? '')?.toLocal();
    if (date == null) return 'Work day';
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
    return '${date.day.toString().padLeft(2, '0')} ${months[date.month - 1]} ${date.year}';
  }

  Future<void> _toggleLeave(bool value) async {
    String? reason;
    if (value) {
      final controller = TextEditingController();
      final confirmed = await showModalBottomSheet<bool>(
          context: context,
          builder: (context) => SheetFrame(
              title: 'Turn on Leave Mode?',
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                        'Automatic daily attendance will be paused until you turn Leave Mode off.'),
                    const SizedBox(height: 16),
                    TextField(
                        controller: controller,
                        decoration: const InputDecoration(
                            labelText: 'Reason (optional)')),
                    const SizedBox(height: 16),
                    FilledButton(
                        onPressed: () => Navigator.pop(context, true),
                        child: const Text('Pause automatic attendance')),
                  ])));
      reason = controller.text.trim();
      controller.dispose();
      if (confirmed != true) return;
    }
    await widget.api.setAttendanceLeaveMode(value,
        reason: reason?.isEmpty == true ? null : reason);
    await _load();
  }

  Future<void> _changeMonth(int delta) async {
    final candidate =
        DateTime(displayedMonth.year, displayedMonth.month + delta);
    final current = DateTime(DateTime.now().year, DateTime.now().month);
    if (candidate.isAfter(current)) return;
    setState(() => displayedMonth = candidate);
    await _load();
  }

  Map<String, dynamic>? _recordFor(DateTime date) {
    final key = _dateKey(date);
    for (final record in records) {
      if (record['attendanceDate']?.toString().startsWith(key) == true) {
        return record;
      }
    }
    return null;
  }

  String _dateKey(DateTime date) =>
      '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

  List<DateTime> get _elapsedDates {
    final now = DateTime.now();
    final lastDay =
        displayedMonth.year == now.year && displayedMonth.month == now.month
            ? now.day
            : DateTime(displayedMonth.year, displayedMonth.month + 1, 0).day;
    return List.generate(
        lastDay,
        (index) =>
            DateTime(displayedMonth.year, displayedMonth.month, index + 1))
      ..sort((a, b) => b.compareTo(a));
  }

  Future<void> _edit(DateTime date, [Map<String, dynamic>? record]) async {
    final initial = record?['workedMinutes'] as int? ?? 240;
    var isOff = initial == 0, hours = initial ~/ 60, minutes = initial % 60;
    final reason =
        TextEditingController(text: record?['offReason'] as String? ?? '');
    final saved = await showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        builder: (context) => StatefulBuilder(
            builder: (context, setSheet) => SheetFrame(
                title: _date(date.toIso8601String()),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      CompactSegmented<bool>(
                          values: const {false: 'Working day', true: 'Off'},
                          selected: isOff,
                          onSelected: (value) => setSheet(() => isOff = value)),
                      const SizedBox(height: 16),
                      if (!isOff)
                        Row(children: [
                          Expanded(
                              child: DropdownButtonFormField<int>(
                                  initialValue: hours,
                                  decoration:
                                      const InputDecoration(labelText: 'Hours'),
                                  items: List.generate(
                                      13,
                                      (i) => DropdownMenuItem(
                                          value: i, child: Text('$i'))),
                                  onChanged: (v) =>
                                      setSheet(() => hours = v ?? 0))),
                          const SizedBox(width: 12),
                          Expanded(
                              child: DropdownButtonFormField<int>(
                                  initialValue: minutes,
                                  decoration: const InputDecoration(
                                      labelText: 'Minutes'),
                                  items: const [0, 15, 30, 45]
                                      .map((m) => DropdownMenuItem(
                                          value: m, child: Text('$m')))
                                      .toList(),
                                  onChanged: (v) =>
                                      setSheet(() => minutes = v ?? 0))),
                        ])
                      else
                        TextField(
                            controller: reason,
                            decoration: const InputDecoration(
                                labelText: 'Reason',
                                hintText: 'Sick leave, personal leave…')),
                      const SizedBox(height: 18),
                      FilledButton(
                          onPressed: () {
                            if (isOff && reason.text.trim().isEmpty) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                      content: Text(
                                          'Please provide an OFF reason.')));
                              return;
                            }
                            Navigator.pop(context, true);
                          },
                          child: const Text('Save work record')),
                    ]))));
    if (saved == true) {
      final key = _dateKey(date);
      await widget.api.updateAttendanceDay(
          key, isOff ? 0 : hours * 60 + minutes, AppConfig.timezone,
          offReason: isOff ? reason.text.trim() : null);
      await _load();
    }
    // Let the modal route finish its dismissal animation before releasing the
    // controller used by its outgoing TextField.
    await Future<void>.delayed(const Duration(milliseconds: 350));
    reason.dispose();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final todayMinutes =
        today?['workedMinutes'] as int? ?? (today == null ? 0 : 240);
    return Scaffold(
      body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
              padding: const EdgeInsets.fromLTRB(
                  AppSpace.page, 18, AppSpace.page, 120),
              children: [
                Row(children: [
                  const Icon(Icons.arrow_back_ios_new_rounded, size: 17),
                  const SizedBox(width: 20),
                  Text('Attendance',
                      style: Theme.of(context).textTheme.titleLarge)
                ]),
                const SizedBox(height: 18),
                if (loading)
                  const Padding(
                      padding: EdgeInsets.all(48),
                      child: Center(child: CircularProgressIndicator()))
                else if (error != null)
                  AppStateCard(
                      icon: Icons.cloud_off_outlined,
                      title: 'Attendance unavailable',
                      message: error!,
                      onRetry: _load)
                else if (!enabled)
                  const AppStateCard(
                      icon: Icons.event_busy_outlined,
                      title: 'Attendance is disabled',
                      message:
                          'Ask an administrator to enable work tracking for your account.')
                else ...[
                  GlassSurface(
                      padding: const EdgeInsets.all(18),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('THIS MONTH',
                                style: Theme.of(context).textTheme.labelMedium),
                            const SizedBox(height: 12),
                            Row(children: [
                              Expanded(
                                  child: _Total(
                                      value: '$workedDays',
                                      label: 'Worked days')),
                              Expanded(
                                  child: _Total(
                                      value: totalMinutes == 0
                                          ? '0 h'
                                          : _duration(totalMinutes),
                                      label: 'Total hours')),
                              Expanded(
                                  child: _Total(
                                      value: '$offDays', label: 'Off days'))
                            ]),
                          ])),
                  const SizedBox(height: 12),
                  GlassSurface(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 10),
                      child: Row(children: [
                        const Icon(Icons.beach_access_outlined,
                            color: AppColors.accent),
                        const SizedBox(width: 12),
                        Expanded(
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                              Text(
                                  leaveMode
                                      ? 'Leave Mode active'
                                      : 'Leave Mode',
                                  style:
                                      Theme.of(context).textTheme.titleMedium),
                              Text(
                                  leaveMode
                                      ? 'Automatic attendance is paused${leaveReason == null ? '' : ' · $leaveReason'}'
                                      : 'Pause automatic daily attendance',
                                  style: const TextStyle(
                                      fontSize: 11, color: AppColors.secondary))
                            ])),
                        Switch(value: leaveMode, onChanged: _toggleLeave),
                      ])),
                  const SizedBox(height: 16),
                  SectionHeader(
                      title: 'Today',
                      action: 'Edit',
                      onAction: () => _edit(DateTime.now(), today)),
                  GlassSurface(
                      padding: const EdgeInsets.all(16),
                      onTap: () => _edit(DateTime.now(), today),
                      child: Row(children: [
                        CircleAvatar(
                            radius: 25,
                            backgroundColor: todayMinutes > 0
                                ? AppColors.accentSoft
                                : AppColors.line,
                            child: Icon(
                                todayMinutes > 0
                                    ? Icons.schedule_rounded
                                    : Icons.event_busy_outlined,
                                color: AppColors.accent)),
                        const SizedBox(width: 14),
                        Expanded(
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                              Text(_duration(todayMinutes),
                                  style: Theme.of(context)
                                      .textTheme
                                      .headlineMedium),
                              Text(
                                  today == null
                                      ? (leaveMode
                                          ? 'Leave Mode active'
                                          : 'No record yet')
                                      : todayMinutes > 0
                                          ? (today?['source'] == 'AUTO'
                                              ? 'Auto recorded'
                                              : 'Edited')
                                          : (today?['offReason'] ?? 'Off'),
                                  style: const TextStyle(
                                      color: AppColors.secondary))
                            ])),
                        const Icon(Icons.chevron_right_rounded),
                      ])),
                  const SizedBox(height: 18),
                  Row(children: [
                    IconButton(
                        tooltip: 'Previous month',
                        onPressed: () => _changeMonth(-1),
                        icon: const Icon(Icons.chevron_left_rounded)),
                    Expanded(
                        child: Text(
                            '${_monthName(displayedMonth.month)} ${displayedMonth.year}',
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.titleMedium)),
                    IconButton(
                        tooltip: 'Next month',
                        onPressed: DateTime(displayedMonth.year,
                                    displayedMonth.month) ==
                                DateTime(
                                    DateTime.now().year, DateTime.now().month)
                            ? null
                            : () => _changeMonth(1),
                        icon: const Icon(Icons.chevron_right_rounded)),
                  ]),
                  const SectionHeader(title: 'Monthly days'),
                  const SizedBox(height: 8),
                  GroupedSurface(
                      children: _elapsedDates.map((date) {
                    final record = _recordFor(date);
                    final minutes = record?['workedMinutes'] as int? ?? 0;
                    final hasRecord = record != null;
                    return AppRow(
                        leading: Icon(
                            !hasRecord
                                ? Icons.add_circle_outline_rounded
                                : minutes > 0
                                    ? Icons.check_circle_outline_rounded
                                    : Icons.remove_circle_outline_rounded,
                            color: !hasRecord
                                ? AppColors.accent
                                : minutes > 0
                                    ? AppColors.success
                                    : AppColors.warning),
                        title: _date(date.toIso8601String()),
                        subtitle: !hasRecord
                            ? 'No record · Add work record'
                            : minutes > 0
                                ? '${record['source'] == 'AUTO' ? 'Auto' : 'Edited'} · ${_duration(minutes)}'
                                : 'Off · ${record['offReason'] ?? 'Reason unavailable'}',
                        trailing: Text(hasRecord ? _duration(minutes) : 'Add',
                            style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: !hasRecord
                                    ? AppColors.accent
                                    : minutes > 0
                                        ? AppColors.ink
                                        : AppColors.warning)),
                        onTap: () => _edit(date, record));
                  }).toList()),
                ],
              ])),
    );
  }
}

String _monthName(int month) => const [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ][month - 1];

class _Total extends StatelessWidget {
  const _Total({required this.value, required this.label});
  final String value, label;
  @override
  Widget build(BuildContext context) =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(value, style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 3),
        Text(label,
            style: const TextStyle(fontSize: 11, color: AppColors.secondary))
      ]);
}
