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
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Today',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
          Text('Hello, ${widget.auth.account?.displayName ?? 'User'}'),
        ]),
        actions: [
          IconButton(
              tooltip: 'Refresh overview',
              onPressed: loading ? null : _load,
              icon: const Icon(Icons.refresh))
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: [
              if (loading)
                const GlassCard(
                    child: Padding(
                        padding: EdgeInsets.all(28),
                        child: Center(child: CircularProgressIndicator())))
              else if (error != null)
                AppStateCard(
                    icon: Icons.cloud_off_outlined,
                    title: 'Overview unavailable',
                    message: error!,
                    onRetry: _load)
              else ...[
                GlassCard(
                    onTap: () => context.go('/attendance'),
                    child: Row(children: [
                      Icon(checkedIn ? Icons.check_circle : Icons.schedule,
                          size: 34,
                          color: checkedIn
                              ? Colors.green.shade700
                              : Theme.of(context).colorScheme.primary),
                      const SizedBox(width: AppSpace.md),
                      Expanded(
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                            Text(
                                checkedIn
                                    ? 'Checked in today'
                                    : 'Attendance is waiting',
                                style: Theme.of(context).textTheme.titleLarge),
                            const SizedBox(height: 4),
                            Text(checkedIn
                                ? 'Your daily record is complete.'
                                : 'Check in from the Attendance tab.'),
                          ])),
                      const Icon(Icons.chevron_right),
                    ])),
                const SizedBox(height: AppSpace.md),
                _OverviewCard(
                    icon: Icons.account_balance_wallet_outlined,
                    title: 'This month',
                    value: _money(finance['netBalance']),
                    detail:
                        '${_money(finance['totalIncome'])} in · ${_money(finance['totalExpense'])} out',
                    onTap: () => context.go('/finance')),
                const SizedBox(height: AppSpace.md),
                _OverviewCard(
                    icon: Icons.savings_outlined,
                    title: 'Budgets',
                    value: budgets.isEmpty
                        ? 'No budget set'
                        : '${budgets.length} active',
                    detail: budgets.isEmpty
                        ? 'Set a monthly spending target.'
                        : 'Review current usage and remaining amounts.',
                    onTap: () => context.go('/finance')),
                const SizedBox(height: AppSpace.md),
                _OverviewCard(
                    icon: Icons.auto_awesome_outlined,
                    title:
                        firstPrice?['productName'] as String? ?? 'Gold prices',
                    value: firstPrice == null
                        ? 'No stored price'
                        : '${_money(firstPrice['buyPrice'])} buy',
                    detail: firstPrice == null
                        ? 'Pull to refresh when provider data is available.'
                        : '${_money(firstPrice['sellPrice'])} sell · ${firstPrice['stale'] == true ? 'stored' : 'latest'}',
                    onTap: () => context.go('/gold')),
                const SizedBox(height: AppSpace.md),
                _OverviewCard(
                    icon: Icons.notifications_active_outlined,
                    title: 'Gold alerts',
                    value: '$activeAlerts active',
                    detail: alerts.isEmpty
                        ? 'Create an alert from Gold.'
                        : '${alerts.length} configured in total.',
                    onTap: () => context.go('/gold')),
              ],
            ]),
      ),
    );
  }
}

class _OverviewCard extends StatelessWidget {
  const _OverviewCard(
      {required this.icon,
      required this.title,
      required this.value,
      required this.detail,
      required this.onTap});
  final IconData icon;
  final String title;
  final String value;
  final String detail;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => GlassCard(
        onTap: onTap,
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(15)),
              child: Icon(icon)),
          const SizedBox(width: AppSpace.md),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(title),
                const SizedBox(height: 3),
                Text(value, style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 3),
                Text(detail, maxLines: 2, overflow: TextOverflow.ellipsis)
              ])),
          const Icon(Icons.chevron_right),
        ]),
      );
}
