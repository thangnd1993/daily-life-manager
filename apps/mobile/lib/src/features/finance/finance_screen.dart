import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../network/api_client.dart';

class FinanceScreen extends StatefulWidget {
  const FinanceScreen({required this.api, super.key});
  final ApiClient api;

  @override
  State<FinanceScreen> createState() => _FinanceScreenState();
}

class _FinanceScreenState extends State<FinanceScreen> {
  DateTime month = DateTime(DateTime.now().year, DateTime.now().month);
  bool loading = true;
  String? error;
  Map<String, dynamic> summary = const {};
  List<Map<String, dynamic>> transactions = const [];
  List<Map<String, dynamic>> categories = const [];
  List<Map<String, dynamic>> budgets = const [];
  Map<String, dynamic> analytics = const {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() { loading = true; error = null; });
    }
    try {
      final results = await Future.wait([
        widget.api.financeSummary(month.year, month.month),
        widget.api.financeTransactions(month.year, month.month),
        widget.api.financeCategories(),
        widget.api.financeBudgets(month.year, month.month),
        widget.api.financeAnalytics(month.year, month.month),
      ]);
      final page = results[1] as Map<String, dynamic>;
      if (mounted) {
        setState(() {
          summary = results[0] as Map<String, dynamic>;
          transactions = (page['items'] as List<dynamic>? ?? const []).cast<Map<String, dynamic>>();
          categories = results[2] as List<Map<String, dynamic>>;
          budgets = results[3] as List<Map<String, dynamic>>;
          analytics = results[4] as Map<String, dynamic>;
          loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() { loading = false; error = 'Finance data could not be loaded.'; });
      }
    }
  }

  String _money(dynamic value) {
    final digits = value?.toString() ?? '0';
    return '${digits.replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (match) => '.')} ₫';
  }

  Future<void> _changeMonth(int offset) async {
    month = DateTime(month.year, month.month + offset);
    await _load();
  }

  Future<void> _editTransaction([Map<String, dynamic>? transaction]) async {
    final type = ValueNotifier<String>(transaction?['type'] as String? ?? 'EXPENSE');
    final amount = TextEditingController(text: transaction?['amount'] as String? ?? '');
    final description = TextEditingController(text: transaction?['description'] as String? ?? '');
    String? categoryId = transaction?['categoryId'] as String?;
    DateTime occurredAt = transaction == null ? DateTime.now() : DateTime.parse(transaction['occurredAt'] as String);
    final saved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(builder: (context, setDialogState) {
        final usable = categories.where((category) => category['type'] == type.value).toList();
        if (!usable.any((category) => category['id'] == categoryId)) {
          categoryId = usable.isEmpty ? null : usable.first['id'] as String;
        }
        return AlertDialog(
          title: Text(transaction == null ? 'Add transaction' : 'Edit transaction'),
          content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
            SegmentedButton<String>(
              segments: const [ButtonSegment(value: 'EXPENSE', label: Text('Expense')), ButtonSegment(value: 'INCOME', label: Text('Income'))],
              selected: {type.value},
              onSelectionChanged: (value) => setDialogState(() => type.value = value.first),
            ),
            TextField(controller: amount, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Amount (VND)')),
            DropdownButtonFormField<String>(
              key: ValueKey(type.value),
              initialValue: categoryId,
              decoration: const InputDecoration(labelText: 'Category'),
              items: usable.map((category) => DropdownMenuItem(value: category['id'] as String, child: Text(category['name'] as String))).toList(),
              onChanged: (value) => categoryId = value,
            ),
            TextField(controller: description, maxLength: 280, decoration: const InputDecoration(labelText: 'Description (optional)')),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Date'),
              subtitle: Text('${occurredAt.year}-${occurredAt.month.toString().padLeft(2, '0')}-${occurredAt.day.toString().padLeft(2, '0')}'),
              onTap: () async {
                final date = await showDatePicker(context: context, firstDate: DateTime(2000), lastDate: DateTime(2100), initialDate: occurredAt);
                if (date != null) {
                  setDialogState(() => occurredAt = DateTime(date.year, date.month, date.day, occurredAt.hour, occurredAt.minute));
                }
              },
            ),
          ])),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancel')),
            FilledButton(onPressed: categoryId == null || !RegExp(r'^[1-9]\d*$').hasMatch(amount.text) ? null : () => Navigator.pop(dialogContext, true), child: const Text('Save')),
          ],
        );
      }),
    );
    if (saved != true || categoryId == null) {
      return;
    }
    final body = <String, dynamic>{'type': type.value, 'amount': amount.text, 'currency': 'VND', 'categoryId': categoryId, 'description': description.text, 'occurredAt': occurredAt.toUtc().toIso8601String()};
    try {
      if (transaction == null) {
        await widget.api.createFinanceTransaction(body);
      } else {
        await widget.api.updateFinanceTransaction(transaction['id'] as String, body);
      }
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Transaction could not be saved.')));
      }
    } finally {
      type.dispose(); amount.dispose(); description.dispose();
    }
  }

  Future<void> _deleteTransaction(Map<String, dynamic> transaction) async {
    final confirmed = await showDialog<bool>(context: context, builder: (context) => AlertDialog(title: const Text('Delete transaction?'), content: const Text('This action cannot be undone.'), actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete'))]));
    if (confirmed == true) {
      await widget.api.deleteFinanceTransaction(transaction['id'] as String);
      await _load();
    }
  }

  Future<void> _manageCategories() async {
    await Navigator.push(context, MaterialPageRoute<void>(builder: (_) => FinanceCategoriesScreen(api: widget.api)));
    await _load();
  }

  Future<void> _editBudget([Map<String, dynamic>? budget]) async {
    final amount = TextEditingController(text: budget?['amount'] as String? ?? '');
    String? categoryId = budget?['categoryId'] as String?;
    final expenseCategories = categories.where((category) => category['type'] == 'EXPENSE').toList();
    final saved = await showDialog<bool>(context: context, builder: (context) => AlertDialog(
      title: Text(budget == null ? 'Set monthly budget' : 'Edit monthly budget'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        if (budget == null) DropdownButtonFormField<String?>(initialValue: categoryId, decoration: const InputDecoration(labelText: 'Scope'), items: [const DropdownMenuItem(value: null, child: Text('Overall expenses')), ...expenseCategories.map((category) => DropdownMenuItem(value: category['id'] as String, child: Text(category['name'] as String)))], onChanged: (value) => categoryId = value),
        TextField(controller: amount, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Budget amount (VND)')),
      ]),
      actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Save'))],
    ));
    if (saved == true && RegExp(r'^[1-9]\d*$').hasMatch(amount.text)) {
      if (budget == null) {
        await widget.api.upsertFinanceBudget({'year': month.year, 'month': month.month, 'amount': amount.text, 'currency': 'VND', if (categoryId != null) 'categoryId': categoryId});
      } else {
        await widget.api.updateFinanceBudget(budget['id'] as String, amount.text);
      }
      await _load();
    }
    amount.dispose();
  }

  Future<void> _deleteBudget(Map<String, dynamic> budget) async {
    await widget.api.deleteFinanceBudget(budget['id'] as String);
    await _load();
  }

  List<Map<String, dynamic>> get _expenseBreakdown =>
      (analytics['expenseByCategory'] as List<dynamic>? ?? const []).cast<Map<String, dynamic>>();

  List<Map<String, dynamic>> get _trend =>
      (analytics['trend'] as List<dynamic>? ?? const []).cast<Map<String, dynamic>>();

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xffeef4fb),
    appBar: AppBar(title: const Text('Personal finance'), leading: IconButton(onPressed: () => context.go('/'), icon: const Icon(Icons.arrow_back)), actions: [IconButton(onPressed: _manageCategories, tooltip: 'Categories', icon: const Icon(Icons.category_outlined))]),
    floatingActionButton: FloatingActionButton.extended(onPressed: categories.isEmpty ? null : () => _editTransaction(), icon: const Icon(Icons.add), label: const Text('Add')),
    body: RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.all(20), children: [
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [IconButton(onPressed: () => _changeMonth(-1), icon: const Icon(Icons.chevron_left)), Text('${month.month}/${month.year}', style: Theme.of(context).textTheme.titleLarge), IconButton(onPressed: () => _changeMonth(1), icon: const Icon(Icons.chevron_right))]),
      if (loading) const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator())),
      if (error != null) Card(child: Padding(padding: const EdgeInsets.all(20), child: Text(error!, style: const TextStyle(color: Colors.red)))),
      if (!loading && error == null) ...[
        Wrap(spacing: 8, runSpacing: 8, children: [
          _SummaryCard(label: 'Income', value: _money(summary['totalIncome']), color: Colors.green),
          _SummaryCard(label: 'Expense', value: _money(summary['totalExpense']), color: Colors.red),
          _SummaryCard(label: 'Net', value: _money(summary['netBalance']), color: Colors.blue),
        ]),
        const SizedBox(height: 16),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text('Budgets', style: Theme.of(context).textTheme.titleLarge), TextButton.icon(onPressed: () => _editBudget(), icon: const Icon(Icons.add), label: const Text('Set budget'))]),
        if (budgets.isEmpty) const Text('No budgets set for this month.'),
        ...budgets.map((budget) => Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Expanded(child: Text((budget['category'] as Map<String, dynamic>?)?['name'] as String? ?? 'Overall expenses', style: const TextStyle(fontWeight: FontWeight.bold))), IconButton(onPressed: () => _editBudget(budget), icon: const Icon(Icons.edit_outlined)), IconButton(onPressed: () => _deleteBudget(budget), icon: const Icon(Icons.delete_outline))]),
          Text('${_money(budget['spentAmount'])} of ${_money(budget['amount'])}'),
          const SizedBox(height: 8),
          LinearProgressIndicator(value: ((budget['percentageUsed'] as num).toDouble() / 100).clamp(0, 1).toDouble(), color: budget['exceeded'] == true ? Colors.red : Colors.blue),
          const SizedBox(height: 6),
          Text(budget['exceeded'] == true ? 'Budget exceeded by ${_money((BigInt.parse(budget['remainingAmount'] as String).abs()).toString())}' : '${_money(budget['remainingAmount'])} remaining'),
        ]))),
        const SizedBox(height: 24),
        Text('Expense breakdown', style: Theme.of(context).textTheme.titleLarge),
        ..._expenseBreakdown.map((item) => Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Column(children: [Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text((item['category'] as Map<String, dynamic>)['name'] as String), Text('${item['percentage']}% · ${_money(item['amount'])}')]), const SizedBox(height: 4), LinearProgressIndicator(value: (item['percentage'] as num).toDouble() / 100)]))),
        const SizedBox(height: 24),
        Text('Six-month trend', style: Theme.of(context).textTheme.titleLarge),
        ..._trend.map((point) => ListTile(contentPadding: EdgeInsets.zero, title: Text('${point['month']}/${point['year']}'), subtitle: Text('Income ${_money(point['totalIncome'])}'), trailing: Text('Expense ${_money(point['totalExpense'])}'))),
        const SizedBox(height: 24),
        Text('Transactions', style: Theme.of(context).textTheme.titleLarge),
        if (transactions.isEmpty) const Padding(padding: EdgeInsets.symmetric(vertical: 24), child: Text('No transactions for this month.')),
        ...transactions.map((transaction) {
          final expense = transaction['type'] == 'EXPENSE';
          final category = transaction['category'] as Map<String, dynamic>;
          return Card(child: ListTile(
            leading: CircleAvatar(child: Icon(expense ? Icons.arrow_upward : Icons.arrow_downward)),
            title: Text(category['name'] as String),
            subtitle: Text(transaction['description'] as String? ?? DateTime.parse(transaction['occurredAt'] as String).toLocal().toString().split(' ').first),
            trailing: Text('${expense ? '−' : '+'}${_money(transaction['amount'])}', style: TextStyle(fontWeight: FontWeight.bold, color: expense ? Colors.red : Colors.green)),
            onTap: () => _editTransaction(transaction),
            onLongPress: () => _deleteTransaction(transaction),
          ));
        }),
      ],
    ])),
  );
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.label, required this.value, required this.color});
  final String label;
  final String value;
  final Color color;
  @override
  Widget build(BuildContext context) => SizedBox(width: 165, child: Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label), const SizedBox(height: 6), Text(value, style: TextStyle(fontWeight: FontWeight.bold, color: color))]))));
}

class FinanceCategoriesScreen extends StatefulWidget {
  const FinanceCategoriesScreen({required this.api, super.key});
  final ApiClient api;
  @override
  State<FinanceCategoriesScreen> createState() => _FinanceCategoriesScreenState();
}

class _FinanceCategoriesScreenState extends State<FinanceCategoriesScreen> {
  List<Map<String, dynamic>> categories = const [];
  @override void initState() { super.initState(); _load(); }
  Future<void> _load() async { final data = await widget.api.financeCategories(); if (mounted) setState(() => categories = data); }
  Future<void> _edit([Map<String, dynamic>? category]) async {
    final name = TextEditingController(text: category?['name'] as String? ?? '');
    String type = category?['type'] as String? ?? 'EXPENSE';
    final saved = await showDialog<bool>(context: context, builder: (context) => StatefulBuilder(builder: (context, setState) => AlertDialog(title: Text(category == null ? 'New category' : 'Rename category'), content: Column(mainAxisSize: MainAxisSize.min, children: [TextField(controller: name, decoration: const InputDecoration(labelText: 'Name')), if (category == null) DropdownButtonFormField<String>(initialValue: type, items: const [DropdownMenuItem(value: 'EXPENSE', child: Text('Expense')), DropdownMenuItem(value: 'INCOME', child: Text('Income'))], onChanged: (value) => setState(() => type = value!))]), actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Save'))])));
    if (saved == true && name.text.trim().isNotEmpty) { if (category == null) { await widget.api.createFinanceCategory(name.text.trim(), type); } else { await widget.api.updateFinanceCategory(category['id'] as String, name.text.trim()); } await _load(); }
    name.dispose();
  }
  Future<void> _delete(Map<String, dynamic> category) async { try { await widget.api.deleteFinanceCategory(category['id'] as String); await _load(); } catch (_) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Categories used by transactions cannot be deleted.'))); } }
  @override Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Finance categories')), floatingActionButton: FloatingActionButton(onPressed: () => _edit(), child: const Icon(Icons.add)), body: ListView(children: categories.map((category) { final personal = category['userId'] != null; return ListTile(title: Text(category['name'] as String), subtitle: Text('${category['type']} · ${personal ? 'Personal' : 'Default'}'), onTap: personal ? () => _edit(category) : null, trailing: personal ? IconButton(onPressed: () => _delete(category), icon: const Icon(Icons.delete_outline)) : const Icon(Icons.lock_outline)); }).toList()));
}
