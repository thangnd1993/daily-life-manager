import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../auth/auth_controller.dart';
import '../../config/app_config.dart';
import '../../design/app_theme.dart';
import '../../design/app_widgets.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({required this.auth, super.key});
  final AuthController auth;
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with AutomaticKeepAliveClientMixin {
  bool loading = true;
  String? error;
  bool checkedIn = false;
  Map<String, dynamic> finance = const {};
  List<Map<String, dynamic>> budgets = const [];
  List<Map<String, dynamic>> prices = const [];
  List<Map<String, dynamic>> alerts = const [];
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
      final now = DateTime.now();
      final results = await Future.wait([
        widget.auth.api.attendanceToday(AppConfig.timezone),
        widget.auth.api.financeSummary(now.year, now.month),
        widget.auth.api.financeBudgets(now.year, now.month),
        widget.auth.api.goldPrices(),
        widget.auth.api.goldAlerts(),
      ]);
      if (!mounted) return;
      setState(() {
        checkedIn = (results[0] as Map<String, dynamic>)['checkedIn'] == true;
        finance = results[1] as Map<String, dynamic>;
        budgets = results[2] as List<Map<String, dynamic>>;
        prices = results[3] as List<Map<String, dynamic>>;
        alerts = results[4] as List<Map<String, dynamic>>;
        loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          loading = false;
          error = 'Your overview could not be refreshed.';
        });
      }
    }
  }

  String _money(dynamic value) {
    final digits = value?.toString() ?? '0';
    return '${digits.replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => '.')} ₫';
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final activeAlerts =
        alerts.where((item) => item['isEnabled'] == true).length;
    final firstPrice = prices.isEmpty ? null : prices.first;
    final now = DateTime.now();
    final greeting = now.hour < 12
        ? 'Good morning'
        : now.hour < 18
            ? 'Good afternoon'
            : 'Good evening';
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
            padding: const EdgeInsets.fromLTRB(
                AppSpace.page, 20, AppSpace.page, 120),
            children: [
              PageHeader(
                eyebrow: 'Today · ${now.day}/${now.month}/${now.year}',
                title:
                    '$greeting,\n${widget.auth.account?.displayName ?? 'User'}',
                trailing: IconButton(
                    tooltip: 'Refresh overview',
                    onPressed: loading ? null : _load,
                    icon: const Icon(Icons.refresh_rounded)),
              ),
              const SizedBox(height: AppSpace.xl),
              if (loading)
                const Center(
                    child: Padding(
                        padding: EdgeInsets.all(48),
                        child: CircularProgressIndicator()))
              else if (error != null)
                AppStateCard(
                    icon: Icons.cloud_off_outlined,
                    title: 'Overview unavailable',
                    message: error!,
                    onRetry: _load)
              else ...[
                GlassSurface(
                    onTap: () => context.go('/attendance'),
                    child: Padding(
                      padding: EdgeInsets.zero,
                      child: Row(children: [
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
                                    ? Icons.check_circle_rounded
                                    : Icons.schedule_rounded,
                                size: 26,
                                color: Colors.white)),
                        const SizedBox(width: AppSpace.md),
                        Expanded(
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                              StatusMark(
                                  label: checkedIn
                                      ? 'Checked in today'
                                      : 'Attendance is waiting',
                                  positive: checkedIn),
                              const SizedBox(height: 4),
                              Text(
                                  checkedIn
                                      ? 'Your daily record is complete.'
                                      : 'One tap is waiting in Attendance.',
                                  style:
                                      Theme.of(context).textTheme.titleMedium),
                            ])),
                        const Icon(Icons.chevron_right_rounded,
                            color: AppColors.secondary),
                      ]),
                    )),
                const SizedBox(height: AppSpace.lg),
                const SectionHeader(title: 'This month'),
                const SizedBox(height: AppSpace.sm),
                GlassSurface(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Text(_money(finance['netBalance']),
                          style: Theme.of(context).textTheme.displaySmall),
                      const SizedBox(height: 4),
                      Text('Monthly net',
                          style: Theme.of(context).textTheme.labelMedium),
                      const SizedBox(height: AppSpace.md),
                      Row(children: [
                        Expanded(
                            child: _Metric(
                                label: 'Income',
                                value: _money(finance['totalIncome']))),
                        Expanded(
                            child: _Metric(
                                label: 'Spent',
                                value: _money(finance['totalExpense']))),
                      ]),
                      const SizedBox(height: AppSpace.md),
                      ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: const LinearProgressIndicator(
                              value: .68,
                              minHeight: 6,
                              backgroundColor: AppColors.line)),
                    ])),
                const SizedBox(height: AppSpace.lg),
                GroupedSurface(children: [
                  AppRow(
                      title: 'Budgets',
                      subtitle: budgets.isEmpty
                          ? 'No budget set'
                          : '${budgets.length} active',
                      trailing: const Icon(Icons.chevron_right_rounded),
                      onTap: () => context.go('/finance')),
                  AppRow(
                      title: firstPrice?['productName'] as String? ??
                          'Gold prices',
                      subtitle: firstPrice == null
                          ? 'No stored price'
                          : '${_money(firstPrice['buyPrice'])} buy · ${_money(firstPrice['sellPrice'])} sell',
                      trailing: const Icon(Icons.chevron_right_rounded),
                      onTap: () => context.go('/gold')),
                  if (activeAlerts > 0)
                    AppRow(
                        title: 'Gold alerts',
                        subtitle:
                            '$activeAlerts enabled alert${activeAlerts == 1 ? '' : 's'}',
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: () => context.go('/gold')),
                ]),
              ],
            ]),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: Theme.of(context).textTheme.labelMedium),
        const SizedBox(height: 4),
        Text(value, style: Theme.of(context).textTheme.titleLarge),
      ]);
}
