import 'package:flutter/material.dart';
import '../../network/api_client.dart';

class GoldScreen extends StatefulWidget {
  const GoldScreen({required this.api, super.key});
  final ApiClient api;
  @override
  State<GoldScreen> createState() => _GoldScreenState();
}

class _GoldScreenState extends State<GoldScreen> {
  bool loading = true;
  String? error;
  List<Map<String, dynamic>> prices = const [];
  List<Map<String, dynamic>> history = const [];
  List<Map<String, dynamic>> alerts = const [];
  List<Map<String, dynamic>> triggers = const [];
  String? selectedCode;
  int days = 7;

  @override
  void initState() { super.initState(); _loadLatest(); }

  Future<void> _loadLatest() async {
    if (mounted) {
      setState(() { loading = true; error = null; });
    }
    try {
      final result = await widget.api.goldPrices();
      selectedCode = result.any((item) => item['productCode'] == selectedCode) ? selectedCode : (result.isEmpty ? null : result.first['productCode'] as String);
      if (mounted) {
        setState(() { prices = result; loading = false; });
      }
      if (selectedCode != null) {
        await _loadHistory();
      }
      await _loadAlerts();
    } catch (_) {
      if (mounted) {
        setState(() { loading = false; error = 'Gold prices could not be loaded.'; });
      }
    }
  }

  Future<void> _loadAlerts() async {
    try {
      final results = await Future.wait([widget.api.goldAlerts(), widget.api.goldAlertTriggers()]);
      if (mounted) setState(() { alerts = results[0]; triggers = results[1]; });
    } catch (_) {
      if (mounted) setState(() { alerts = const []; triggers = const []; });
    }
  }

  Future<void> _loadHistory() async {
    final code = selectedCode;
    if (code == null) {
      return;
    }
    try {
      final result = await widget.api.goldHistory(code, days);
      if (mounted) {
        setState(() => history = (result['items'] as List<dynamic>? ?? const []).cast<Map<String, dynamic>>());
      }
    } catch (_) {
      if (mounted) {
        setState(() => history = const []);
      }
    }
  }

  String _money(dynamic value) {
    final digits = value?.toString() ?? '0';
    return '${digits.replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (match) => '.')} ₫';
  }

  Future<void> _select(String code) async { setState(() { selectedCode = code; history = const []; }); await _loadHistory(); }
  Future<void> _range(int value) async { setState(() { days = value; history = const []; }); await _loadHistory(); }

  String _alertThreshold(Map<String, dynamic> alert) => alert['condition'] == 'PERCENT_CHANGE'
      ? '${((alert['thresholdBasisPoints'] as num) / 100).toStringAsFixed(2)}% movement'
      : '${alert['priceSide']} ${alert['condition']} ${_money(alert['thresholdAmount'])}';

  Future<void> _toggle(Map<String, dynamic> alert, bool value) async {
    await widget.api.setGoldAlertEnabled(alert['id'] as String, value);
    await _loadAlerts();
  }

  Future<void> _delete(Map<String, dynamic> alert) async {
    final confirmed = await showDialog<bool>(context: context, builder: (context) => AlertDialog(title: const Text('Delete alert?'), content: const Text('This alert and its trigger history will be removed.'), actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete'))])) ?? false;
    if (!confirmed) return;
    await widget.api.deleteGoldAlert(alert['id'] as String);
    await _loadAlerts();
  }

  Future<void> _showAlertForm([Map<String, dynamic>? existing]) async {
    final code = existing?['productCode'] as String? ?? selectedCode ?? 'SJC';
    var side = existing?['priceSide'] as String? ?? 'BUY';
    var condition = existing?['condition'] as String? ?? 'ABOVE';
    final controller = TextEditingController(text: condition == 'PERCENT_CHANGE' ? (((existing?['thresholdBasisPoints'] as num?) ?? 100) / 100).toString() : existing?['thresholdAmount']?.toString() ?? '90000000');
    final saved = await showDialog<Map<String, dynamic>>(context: context, builder: (context) => StatefulBuilder(builder: (context, setDialogState) => AlertDialog(
      title: Text(existing == null ? 'Create gold alert' : 'Edit gold alert'),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        DropdownButtonFormField<String>(initialValue: side, decoration: const InputDecoration(labelText: 'Price side'), items: const [DropdownMenuItem(value: 'BUY', child: Text('Buy price')), DropdownMenuItem(value: 'SELL', child: Text('Sell price'))], onChanged: (value) => setDialogState(() => side = value!)),
        DropdownButtonFormField<String>(initialValue: condition, decoration: const InputDecoration(labelText: 'Condition'), items: const [DropdownMenuItem(value: 'ABOVE', child: Text('Above')), DropdownMenuItem(value: 'BELOW', child: Text('Below')), DropdownMenuItem(value: 'PERCENT_CHANGE', child: Text('Percentage movement'))], onChanged: (value) => setDialogState(() { condition = value!; controller.clear(); })),
        TextField(controller: controller, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: condition == 'PERCENT_CHANGE' ? 'Movement threshold (%)' : 'Threshold (VND)', errorText: controller.text.trim().isEmpty ? 'Enter a positive threshold' : null)),
      ])),
      actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')), FilledButton(onPressed: () {
        final value = double.tryParse(controller.text.trim());
        if (value == null || value <= 0) return;
        Navigator.pop(context, {'productCode': code, 'priceSide': side, 'condition': condition, if (condition != 'PERCENT_CHANGE') 'thresholdAmount': controller.text.trim(), if (condition == 'PERCENT_CHANGE') 'thresholdBasisPoints': (value * 100).round(), 'cooldownMinutes': existing?['cooldownMinutes'] ?? 60, if (existing != null) 'isEnabled': existing['isEnabled']});
      }, child: const Text('Save'))],
    )));
    controller.dispose();
    if (saved == null) return;
    if (existing == null) {
      await widget.api.createGoldAlert(saved);
    } else {
      await widget.api.updateGoldAlert(existing['id'] as String, saved);
    }
    await _loadAlerts();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Gold'), automaticallyImplyLeading: false),
    body: RefreshIndicator(onRefresh: _loadLatest, child: ListView(padding: const EdgeInsets.all(20), children: [
      if (loading) const Padding(padding: EdgeInsets.all(48), child: Center(child: CircularProgressIndicator())),
      if (error != null) Card(child: Padding(padding: const EdgeInsets.all(20), child: Text(error!, style: const TextStyle(color: Colors.red)))),
      if (!loading && error == null && prices.isEmpty) const Card(child: Padding(padding: EdgeInsets.all(20), child: Text('No stored gold prices yet.'))),
      if (prices.isNotEmpty) ...[
        Wrap(spacing: 8, children: prices.map((item) => ChoiceChip(label: Text(item['productCode'] as String), selected: item['productCode'] == selectedCode, onSelected: (_) => _select(item['productCode'] as String))).toList()),
        const SizedBox(height: 18),
        ...prices.where((item) => item['productCode'] == selectedCode).map((item) => Card(
          elevation: 0,
          color: Colors.white.withValues(alpha: .72),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28), side: const BorderSide(color: Colors.white)),
          child: Padding(padding: const EdgeInsets.all(24), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(item['productName'] as String, style: Theme.of(context).textTheme.headlineSmall),
            Text('${item['provider']} · per ${item['unit']}'),
            const SizedBox(height: 18),
            Row(children: [Expanded(child: _Price(label: 'Buy', value: _money(item['buyPrice']))), Expanded(child: _Price(label: 'Sell', value: _money(item['sellPrice'])))]),
            const SizedBox(height: 14),
            Text(item['stale'] == true ? 'Stored price · may be delayed' : 'Updated ${item['sourceTimestamp']}', style: TextStyle(color: item['stale'] == true ? Colors.orange.shade900 : Colors.green.shade800)),
          ])),
        )),
        const SizedBox(height: 18),
        SegmentedButton<int>(segments: const [ButtonSegment(value: 1, label: Text('1D')), ButtonSegment(value: 7, label: Text('7D')), ButtonSegment(value: 30, label: Text('30D'))], selected: {days}, onSelectionChanged: (values) => _range(values.first)),
        const SizedBox(height: 12),
        Text('Recent history', style: Theme.of(context).textTheme.titleLarge),
        if (history.isEmpty) const Padding(padding: EdgeInsets.symmetric(vertical: 20), child: Text('No history for this range.')),
        ...history.reversed.take(20).map((item) => ListTile(contentPadding: EdgeInsets.zero, title: Text('${_money(item['buyPrice'])} buy · ${_money(item['sellPrice'])} sell'), subtitle: Text(item['sourceTimestamp'] as String))),
        const SizedBox(height: 24),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text('Gold alerts', style: Theme.of(context).textTheme.titleLarge), FilledButton.icon(onPressed: _showAlertForm, icon: const Icon(Icons.add_alert_outlined), label: const Text('New alert'))]),
        if (alerts.isEmpty) const Card(child: Padding(padding: EdgeInsets.all(20), child: Text('No gold alerts yet.'))),
        ...alerts.map((alert) => Card(
          elevation: 0, color: Colors.white.withValues(alpha: .68),
          child: ListTile(
            title: Text('${alert['productCode']} · ${_alertThreshold(alert)}'),
            subtitle: Text(alert['lastTriggeredAt'] == null ? 'Not triggered yet' : 'Last triggered ${alert['lastTriggeredAt']}'),
            leading: Switch(value: alert['isEnabled'] == true, onChanged: (value) => _toggle(alert, value)),
            trailing: PopupMenuButton<String>(onSelected: (value) => value == 'edit' ? _showAlertForm(alert) : _delete(alert), itemBuilder: (_) => const [PopupMenuItem(value: 'edit', child: Text('Edit')), PopupMenuItem(value: 'delete', child: Text('Delete'))]),
          ),
        )),
        const SizedBox(height: 16),
        Text('Recent alert activity', style: Theme.of(context).textTheme.titleMedium),
        if (triggers.isEmpty) const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('No alert triggers yet.')),
        ...triggers.take(10).map((trigger) => ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.notifications_active_outlined), title: Text('${trigger['productCode']} condition matched'), subtitle: Text(trigger['triggeredAt'] as String))),
      ],
      const SizedBox(height: 20),
      const Text('Prices are informational and may be delayed. Verify with the seller or provider before transacting.'),
    ])),
  );
}

class _Price extends StatelessWidget {
  const _Price({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label), const SizedBox(height: 4), Text(value, style: Theme.of(context).textTheme.titleLarge)]);
}
