import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
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
    } catch (_) {
      if (mounted) {
        setState(() { loading = false; error = 'Gold prices could not be loaded.'; });
      }
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

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xfff4f0e8),
    appBar: AppBar(backgroundColor: Colors.transparent, title: const Text('Gold prices'), leading: IconButton(onPressed: () => context.go('/'), icon: const Icon(Icons.arrow_back))),
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
