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

  String _month(int month) => const [
        'JAN',
        'FEB',
        'MAR',
        'APR',
        'MAY',
        'JUN',
        'JUL',
        'AUG',
        'SEP',
        'OCT',
        'NOV',
        'DEC'
      ][month - 1];

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
              Row(children: [
                const Icon(Icons.menu_rounded, size: 22),
                const Spacer(),
                IconButton(
                    onPressed: loading ? null : _load,
                    icon:
                        const Icon(Icons.notifications_none_rounded, size: 21)),
                CircleAvatar(
                    radius: 17,
                    backgroundColor: AppColors.accentSoft,
                    child: Text(
                        (widget.auth.account?.displayName ?? 'U')
                            .substring(0, 1),
                        style: const TextStyle(color: AppColors.accent))),
              ]),
              const SizedBox(height: AppSpace.sm),
              Text(
                  'TODAY · ${now.day.toString().padLeft(2, '0')} ${_month(now.month)} ${now.year}',
                  style: Theme.of(context).textTheme.labelMedium),
              const SizedBox(height: 6),
              Text(
                  '$greeting,\n${widget.auth.account?.displayName ?? 'User'} 👋',
                  style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: AppSpace.md),
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
                    padding: const EdgeInsets.all(14),
                    onTap: () => context.go('/attendance'),
                    child: Padding(
                      padding: EdgeInsets.zero,
                      child: Row(children: [
                        Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: checkedIn
                                    ? AppColors.accent
                                    : AppColors.ink),
                            child: Icon(
                                checkedIn
                                    ? Icons.check_circle_rounded
                                    : Icons.schedule_rounded,
                                size: 22,
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
                                      ? 'You are all set'
                                      : 'Ready to check in',
                                  style:
                                      Theme.of(context).textTheme.titleMedium),
                            ])),
                        const Icon(Icons.chevron_right_rounded,
                            color: AppColors.secondary),
                      ]),
                    )),
                const SizedBox(height: AppSpace.sm),
                GlassSurface(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('This month',
                              style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: AppSpace.xs),
                          Row(children: [
                            Expanded(
                                child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                  Text(_money(finance['netBalance']),
                                      style: Theme.of(context)
                                          .textTheme
                                          .headlineLarge),
                                  Text('Net balance',
                                      style: Theme.of(context)
                                          .textTheme
                                          .labelMedium),
                                ])),
                            Expanded(
                                child: TrendLine(values: [
                              double.tryParse(
                                      finance['totalIncome']?.toString() ??
                                          '') ??
                                  0,
                              double.tryParse(
                                      finance['netBalance']?.toString() ??
                                          '') ??
                                  0,
                              double.tryParse(
                                      finance['totalExpense']?.toString() ??
                                          '') ??
                                  0,
                            ], height: 36)),
                          ]),
                          const Divider(height: 16),
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
                        ])),
                const SizedBox(height: AppSpace.md),
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(
                      child: GlassSurface(
                          padding: const EdgeInsets.all(16),
                          onTap: () => context.go('/finance'),
                          child: _BudgetSnapshot(
                              budget: budgets.isEmpty ? null : budgets.first))),
                  const SizedBox(width: AppSpace.sm),
                  Expanded(
                      child: GlassSurface(
                          padding: const EdgeInsets.all(16),
                          onTap: () => context.go('/gold'),
                          child:
                              _GoldSnapshot(price: firstPrice, money: _money))),
                ]),
                const SizedBox(height: AppSpace.md),
                const SectionHeader(title: 'Quick actions'),
                const SizedBox(height: AppSpace.sm),
                Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _QuickAction(
                          label: 'Add expense',
                          icon: Icons.remove_rounded,
                          color: AppColors.danger,
                          onTap: () => context.go('/finance')),
                      _QuickAction(
                          label: 'Add income',
                          icon: Icons.add_rounded,
                          color: AppColors.success,
                          onTap: () => context.go('/finance')),
                      _QuickAction(
                          label: 'Gold alerts',
                          icon: Icons.notifications_rounded,
                          color: AppColors.warning,
                          onTap: () => context.go('/gold')),
                      _QuickAction(
                          label: checkedIn ? 'Attendance' : 'Check in',
                          icon: Icons.how_to_reg_rounded,
                          color: AppColors.accent,
                          onTap: () => context.go('/attendance')),
                    ]),
                if (activeAlerts > 0) ...[
                  const SizedBox(height: AppSpace.lg),
                  GroupedSurface(children: [
                    AppRow(
                        title: 'Gold alerts',
                        subtitle:
                            '$activeAlerts enabled alert${activeAlerts == 1 ? '' : 's'}',
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: () => context.go('/gold'))
                  ]),
                ],
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

class _BudgetSnapshot extends StatelessWidget {
  const _BudgetSnapshot({required this.budget});
  final Map<String, dynamic>? budget;
  @override
  Widget build(BuildContext context) {
    final percent = (budget?['percentageUsed'] as num?)?.toDouble() ?? 0;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Budget', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: AppSpace.sm),
      Text('${percent.round()}%',
          style: Theme.of(context).textTheme.headlineMedium),
      const SizedBox(height: AppSpace.sm),
      ClipRRect(
          borderRadius: BorderRadius.circular(5),
          child: LinearProgressIndicator(
              value: (percent / 100).clamp(0, 1),
              minHeight: 7,
              backgroundColor: AppColors.line)),
      const SizedBox(height: AppSpace.sm),
      Text(budget == null ? 'No budget set' : '1 active',
          style: Theme.of(context)
              .textTheme
              .bodySmall
              ?.copyWith(color: AppColors.secondary)),
    ]);
  }
}

class _GoldSnapshot extends StatelessWidget {
  const _GoldSnapshot({required this.price, required this.money});
  final Map<String, dynamic>? price;
  final String Function(dynamic) money;
  @override
  Widget build(BuildContext context) =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(price?['productName'] as String? ?? 'Gold',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: AppSpace.sm),
        Text('Buy',
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: AppColors.secondary)),
        Text(price == null ? '—' : money(price!['buyPrice']),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
                color: AppColors.success, fontWeight: FontWeight.w700)),
        const SizedBox(height: AppSpace.xs),
        Text('Sell',
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: AppColors.secondary)),
        Text(price == null ? '—' : money(price!['sellPrice']),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
                color: AppColors.danger, fontWeight: FontWeight.w700)),
      ]);
}

class _QuickAction extends StatelessWidget {
  const _QuickAction(
      {required this.label,
      required this.icon,
      required this.color,
      required this.onTap});
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => SizedBox(
      width: 74,
      child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
          child: Column(children: [
            Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: .7),
                    borderRadius: BorderRadius.circular(17),
                    boxShadow: const [
                      BoxShadow(color: Color(0x12000000), blurRadius: 14)
                    ]),
                child: Icon(icon, color: color)),
            const SizedBox(height: 7),
            Text(label,
                maxLines: 2,
                textAlign: TextAlign.center,
                style:
                    const TextStyle(fontSize: 11, color: AppColors.secondary)),
          ])));
}
