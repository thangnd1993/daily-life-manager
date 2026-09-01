import 'package:flutter/material.dart';
import '../../design/app_theme.dart';
import '../../design/app_widgets.dart';
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
      setState(() {
        loading = true;
        error = null;
      });
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
          transactions = (page['items'] as List<dynamic>? ?? const [])
              .cast<Map<String, dynamic>>();
          categories = results[2] as List<Map<String, dynamic>>;
          budgets = results[3] as List<Map<String, dynamic>>;
          analytics = results[4] as Map<String, dynamic>;
          loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          loading = false;
          error = 'Finance data could not be loaded.';
        });
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

  String get _monthLabel {
    const names = [
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
    ];
    return '${names[month.month - 1]} ${month.year}';
  }

  Future<void> _editTransaction([Map<String, dynamic>? transaction]) async {
    final type =
        ValueNotifier<String>(transaction?['type'] as String? ?? 'EXPENSE');
    final amount =
        TextEditingController(text: transaction?['amount'] as String? ?? '');
    final description = TextEditingController(
        text: transaction?['description'] as String? ?? '');
    String? categoryId = transaction?['categoryId'] as String?;
    DateTime occurredAt = transaction == null
        ? DateTime.now()
        : DateTime.parse(transaction['occurredAt'] as String);
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (dialogContext) =>
          StatefulBuilder(builder: (context, setDialogState) {
        final usable = categories
            .where((category) => category['type'] == type.value)
            .toList();
        if (!usable.any((category) => category['id'] == categoryId)) {
          categoryId = usable.isEmpty ? null : usable.first['id'] as String;
        }
        return SheetFrame(
          title: transaction == null ? 'Add transaction' : 'Edit transaction',
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            CompactSegmented<String>(
                values: const {'EXPENSE': 'Expense', 'INCOME': 'Income'},
                selected: type.value,
                onSelected: (value) =>
                    setDialogState(() => type.value = value)),
            const SizedBox(height: AppSpace.lg),
            TextField(
                controller: amount,
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.displaySmall,
                decoration: const InputDecoration(
                    hintText: '0 ₫',
                    filled: false,
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none)),
            const SizedBox(height: AppSpace.lg),
            SizedBox(
                height: 78,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: usable.length,
                  separatorBuilder: (_, __) =>
                      const SizedBox(width: AppSpace.xs),
                  itemBuilder: (context, index) {
                    final category = usable[index];
                    final selected = category['id'] == categoryId;
                    return Semantics(
                        selected: selected,
                        button: true,
                        child: InkWell(
                          borderRadius: BorderRadius.circular(16),
                          onTap: () => setDialogState(
                              () => categoryId = category['id'] as String),
                          child: AnimatedContainer(
                              duration: const Duration(milliseconds: 160),
                              width: 66,
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 9),
                              decoration: BoxDecoration(
                                  color: selected
                                      ? AppColors.accentSoft
                                      : Colors.white.withValues(alpha: .5),
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                      color: selected
                                          ? AppColors.accent
                                              .withValues(alpha: .25)
                                          : AppColors.line)),
                              child: Column(children: [
                                Icon(_categoryIcon(category['name'] as String),
                                    size: 22,
                                    color: selected
                                        ? AppColors.accent
                                        : AppColors.secondary),
                                const SizedBox(height: 5),
                                Text(category['name'] as String,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                        fontSize: 10,
                                        color: selected
                                            ? AppColors.accent
                                            : AppColors.secondary))
                              ])),
                        ));
                  },
                )),
            const SizedBox(height: AppSpace.md),
            GroupedSurface(children: [
              AppRow(
                  leading: const Icon(Icons.calendar_today_outlined),
                  title: 'Date',
                  subtitle: _formatDate(occurredAt),
                  onTap: () async {
                    final date = await showDatePicker(
                        context: context,
                        firstDate: DateTime(2000),
                        lastDate: DateTime(2100),
                        initialDate: occurredAt);
                    if (date != null) {
                      setDialogState(() => occurredAt = DateTime(
                          date.year,
                          date.month,
                          date.day,
                          occurredAt.hour,
                          occurredAt.minute));
                    }
                  }),
              AppRow(
                  leading: const Icon(Icons.schedule_outlined),
                  title: 'Time',
                  subtitle: TimeOfDay.fromDateTime(occurredAt).format(context),
                  onTap: () async {
                    final time = await showTimePicker(
                        context: context,
                        initialTime: TimeOfDay.fromDateTime(occurredAt));
                    if (time != null) {
                      setDialogState(() => occurredAt = DateTime(
                          occurredAt.year,
                          occurredAt.month,
                          occurredAt.day,
                          time.hour,
                          time.minute));
                    }
                  }),
            ]),
            const SizedBox(height: AppSpace.md),
            TextField(
                controller: description,
                maxLength: 280,
                decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.notes_rounded),
                    labelText: 'Description',
                    hintText: 'Optional note')),
            const SizedBox(height: AppSpace.md),
            FilledButton(
                onPressed: categoryId == null ||
                        !RegExp(r'^[1-9]\d*$').hasMatch(amount.text)
                    ? null
                    : () => Navigator.pop(dialogContext, true),
                child: const Text('Save transaction')),
            TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Cancel')),
          ]),
        );
      }),
    );
    if (saved != true || categoryId == null) {
      return;
    }
    final body = <String, dynamic>{
      'type': type.value,
      'amount': amount.text,
      'currency': 'VND',
      'categoryId': categoryId,
      'description': description.text,
      'occurredAt': occurredAt.toUtc().toIso8601String()
    };
    try {
      if (transaction == null) {
        await widget.api.createFinanceTransaction(body);
      } else {
        await widget.api
            .updateFinanceTransaction(transaction['id'] as String, body);
      }
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Transaction could not be saved.')));
      }
    } finally {
      type.dispose();
      amount.dispose();
      description.dispose();
    }
  }

  IconData _categoryIcon(String name) {
    final value = name.toLowerCase();
    if (value.contains('food')) return Icons.shopping_bag_outlined;
    if (value.contains('transport')) return Icons.directions_car_outlined;
    if (value.contains('shop')) return Icons.shopping_cart_outlined;
    if (value.contains('bill')) return Icons.receipt_long_outlined;
    return Icons.category_outlined;
  }

  String _formatDate(DateTime date) {
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

  Future<void> _deleteTransaction(Map<String, dynamic> transaction) async {
    final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
                title: const Text('Delete transaction?'),
                content: const Text('This action cannot be undone.'),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(context, false),
                      child: const Text('Cancel')),
                  FilledButton(
                      onPressed: () => Navigator.pop(context, true),
                      child: const Text('Delete'))
                ]));
    if (confirmed == true) {
      await widget.api.deleteFinanceTransaction(transaction['id'] as String);
      await _load();
    }
  }

  Future<void> _manageCategories() async {
    await Navigator.push(
        context,
        MaterialPageRoute<void>(
            builder: (_) => FinanceCategoriesScreen(api: widget.api)));
    await _load();
  }

  Future<void> _editBudget([Map<String, dynamic>? budget]) async {
    final amount =
        TextEditingController(text: budget?['amount'] as String? ?? '');
    String? categoryId = budget?['categoryId'] as String?;
    final expenseCategories =
        categories.where((category) => category['type'] == 'EXPENSE').toList();
    final saved = await showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        builder: (context) => SheetFrame(
              title:
                  budget == null ? 'Set monthly budget' : 'Edit monthly budget',
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (budget == null)
                      DropdownButtonFormField<String?>(
                          initialValue: categoryId,
                          decoration: const InputDecoration(labelText: 'Scope'),
                          items: [
                            const DropdownMenuItem(
                                value: null, child: Text('Overall expenses')),
                            ...expenseCategories.map((category) =>
                                DropdownMenuItem(
                                    value: category['id'] as String,
                                    child: Text(category['name'] as String)))
                          ],
                          onChanged: (value) => categoryId = value),
                    const SizedBox(height: AppSpace.md),
                    TextField(
                        controller: amount,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                            labelText: 'Budget amount (VND)')),
                    const SizedBox(height: AppSpace.lg),
                    FilledButton(
                        onPressed: () => Navigator.pop(context, true),
                        child: const Text('Save')),
                    TextButton(
                        onPressed: () => Navigator.pop(context, false),
                        child: const Text('Cancel')),
                  ]),
            ));
    if (saved == true && RegExp(r'^[1-9]\d*$').hasMatch(amount.text)) {
      if (budget == null) {
        await widget.api.upsertFinanceBudget({
          'year': month.year,
          'month': month.month,
          'amount': amount.text,
          'currency': 'VND',
          if (categoryId != null) 'categoryId': categoryId
        });
      } else {
        await widget.api
            .updateFinanceBudget(budget['id'] as String, amount.text);
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
      (analytics['expenseByCategory'] as List<dynamic>? ?? const [])
          .cast<Map<String, dynamic>>();

  List<Map<String, dynamic>> get _trend =>
      (analytics['trend'] as List<dynamic>? ?? const [])
          .cast<Map<String, dynamic>>();

  double get _spendRatio {
    final income =
        double.tryParse(summary['totalIncome']?.toString() ?? '') ?? 0;
    final expense =
        double.tryParse(summary['totalExpense']?.toString() ?? '') ?? 0;
    return income <= 0 ? 0 : (expense / income).clamp(0, 1);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(automaticallyImplyLeading: false, toolbarHeight: 0),
        floatingActionButton: FloatingActionButton.extended(
            onPressed: categories.isEmpty ? null : () => _editTransaction(),
            icon: const Icon(Icons.add),
            label: const Text('Add')),
        body: RefreshIndicator(
            onRefresh: _load,
            child: ListView(
                padding: const EdgeInsets.fromLTRB(
                    AppSpace.page, 20, AppSpace.page, 120),
                children: [
                  PageHeader(
                      eyebrow: 'Personal finance',
                      title: 'Finance',
                      trailing: IconButton(
                          onPressed: _manageCategories,
                          tooltip: 'Categories',
                          icon: const Icon(Icons.tune_rounded))),
                  const SizedBox(height: AppSpace.lg),
                  Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        IconButton(
                            onPressed: () => _changeMonth(-1),
                            icon: const Icon(Icons.chevron_left)),
                        Text(_monthLabel,
                            style: Theme.of(context).textTheme.titleLarge),
                        IconButton(
                            onPressed: () => _changeMonth(1),
                            icon: const Icon(Icons.chevron_right))
                      ]),
                  if (loading)
                    const Padding(
                        padding: EdgeInsets.all(40),
                        child: Center(child: CircularProgressIndicator())),
                  if (error != null)
                    AppStateView(
                        icon: Icons.cloud_off_outlined,
                        title: 'Finance unavailable',
                        message: error!,
                        onRetry: _load),
                  if (!loading && error == null) ...[
                    GlassSurface(
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                          Text('NET BALANCE',
                              style: Theme.of(context).textTheme.labelMedium),
                          const SizedBox(height: 6),
                          Text(_money(summary['netBalance']),
                              style: Theme.of(context).textTheme.displaySmall),
                          const SizedBox(height: AppSpace.sm),
                          TrendLine(
                              values: _trend
                                  .map((item) =>
                                      double.tryParse(
                                          item['netBalance']?.toString() ??
                                              '') ??
                                      0)
                                  .toList(),
                              height: 54),
                          const SizedBox(height: AppSpace.lg),
                          Row(children: [
                            Expanded(
                                child: _SummaryMetric(
                                    label: 'Income',
                                    value: _money(summary['totalIncome']))),
                            Expanded(
                                child: _SummaryMetric(
                                    label: 'Expense',
                                    value: _money(summary['totalExpense'])))
                          ]),
                          const SizedBox(height: AppSpace.md),
                          ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                  value: _spendRatio,
                                  minHeight: 6,
                                  backgroundColor: AppColors.line)),
                        ])),
                    const SizedBox(height: AppSpace.xl),
                    Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Budgets',
                              style: Theme.of(context).textTheme.titleLarge),
                          TextButton.icon(
                              onPressed: () => _editBudget(),
                              icon: const Icon(Icons.add),
                              label: const Text('Set budget'))
                        ]),
                    if (budgets.isEmpty)
                      const Text('No budgets set for this month.'),
                    ...budgets.map((budget) => Padding(
                        padding: const EdgeInsets.only(bottom: AppSpace.md),
                        child: DecoratedBox(
                            decoration: const BoxDecoration(
                                border: Border(
                                    bottom: BorderSide(color: AppColors.line))),
                            child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(children: [
                                        Expanded(
                                            child: Text(
                                                (budget['category'] as Map<
                                                            String,
                                                            dynamic>?)?['name']
                                                        as String? ??
                                                    'Overall expenses',
                                                style: const TextStyle(
                                                    fontWeight:
                                                        FontWeight.bold))),
                                        IconButton(
                                            onPressed: () =>
                                                _editBudget(budget),
                                            icon: const Icon(
                                                Icons.edit_outlined)),
                                        IconButton(
                                            onPressed: () =>
                                                _deleteBudget(budget),
                                            icon: const Icon(
                                                Icons.delete_outline))
                                      ]),
                                      Text(
                                          '${_money(budget['spentAmount'])} of ${_money(budget['amount'])}'),
                                      const SizedBox(height: 8),
                                      LinearProgressIndicator(
                                          value:
                                              ((budget['percentageUsed'] as num)
                                                          .toDouble() /
                                                      100)
                                                  .clamp(0, 1)
                                                  .toDouble(),
                                          color: budget['exceeded'] == true
                                              ? Colors.red
                                              : Colors.blue),
                                      const SizedBox(height: 6),
                                      Text(budget['exceeded'] == true
                                          ? 'Budget exceeded by ${_money((BigInt.parse(budget['remainingAmount'] as String).abs()).toString())}'
                                          : '${_money(budget['remainingAmount'])} remaining'),
                                    ]))))),
                    const SizedBox(height: 24),
                    Text('Expense breakdown',
                        style: Theme.of(context).textTheme.titleLarge),
                    ..._expenseBreakdown.map((item) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Column(children: [
                          Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text((item['category']
                                    as Map<String, dynamic>)['name'] as String),
                                Text(
                                    '${item['percentage']}% · ${_money(item['amount'])}')
                              ]),
                          const SizedBox(height: 4),
                          LinearProgressIndicator(
                              value:
                                  (item['percentage'] as num).toDouble() / 100)
                        ]))),
                    const SizedBox(height: 24),
                    Text('Six-month trend',
                        style: Theme.of(context).textTheme.titleLarge),
                    GroupedSurface(
                        children: _trend
                            .map((point) => AppRow(
                                title: '${point['month']}/${point['year']}',
                                subtitle:
                                    'Income ${_money(point['totalIncome'])}',
                                trailing: Text(
                                    'Expense ${_money(point['totalExpense'])}')))
                            .toList()),
                    const SizedBox(height: 24),
                    Text('Transactions',
                        style: Theme.of(context).textTheme.titleLarge),
                    if (transactions.isEmpty)
                      const Padding(
                          padding: EdgeInsets.symmetric(vertical: 24),
                          child: Text('No transactions for this month.')),
                    if (transactions.isNotEmpty)
                      GroupedSurface(
                          children: transactions.map((transaction) {
                        final expense = transaction['type'] == 'EXPENSE';
                        final category =
                            transaction['category'] as Map<String, dynamic>;
                        return AppRow(
                          leading: CircleAvatar(
                              child: Icon(expense
                                  ? Icons.arrow_upward
                                  : Icons.arrow_downward)),
                          title: category['name'] as String,
                          subtitle: transaction['description'] as String? ??
                              DateTime.parse(
                                      transaction['occurredAt'] as String)
                                  .toLocal()
                                  .toString()
                                  .split(' ')
                                  .first,
                          trailing: Text(
                              '${expense ? '−' : '+'}${_money(transaction['amount'])}',
                              style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: expense ? Colors.red : Colors.green)),
                          onTap: () => _editTransaction(transaction),
                          onLongPress: () => _deleteTransaction(transaction),
                        );
                      }).toList()),
                  ],
                ])),
      );
}

class _SummaryMetric extends StatelessWidget {
  const _SummaryMetric({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: Theme.of(context).textTheme.labelMedium),
        const SizedBox(height: 5),
        Text(value, style: Theme.of(context).textTheme.titleLarge)
      ]);
}

class FinanceCategoriesScreen extends StatefulWidget {
  const FinanceCategoriesScreen({required this.api, super.key});
  final ApiClient api;
  @override
  State<FinanceCategoriesScreen> createState() =>
      _FinanceCategoriesScreenState();
}

class _FinanceCategoriesScreenState extends State<FinanceCategoriesScreen> {
  List<Map<String, dynamic>> categories = const [];
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final data = await widget.api.financeCategories();
    if (mounted) setState(() => categories = data);
  }

  Future<void> _edit([Map<String, dynamic>? category]) async {
    final name =
        TextEditingController(text: category?['name'] as String? ?? '');
    String type = category?['type'] as String? ?? 'EXPENSE';
    final saved = await showDialog<bool>(
        context: context,
        builder: (context) => StatefulBuilder(
            builder: (context, setState) => AlertDialog(
                    title: Text(
                        category == null ? 'New category' : 'Rename category'),
                    content: Column(mainAxisSize: MainAxisSize.min, children: [
                      TextField(
                          controller: name,
                          decoration: const InputDecoration(labelText: 'Name')),
                      if (category == null)
                        DropdownButtonFormField<String>(
                            initialValue: type,
                            items: const [
                              DropdownMenuItem(
                                  value: 'EXPENSE', child: Text('Expense')),
                              DropdownMenuItem(
                                  value: 'INCOME', child: Text('Income'))
                            ],
                            onChanged: (value) => setState(() => type = value!))
                    ]),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(context, false),
                          child: const Text('Cancel')),
                      FilledButton(
                          onPressed: () => Navigator.pop(context, true),
                          child: const Text('Save'))
                    ])));
    if (saved == true && name.text.trim().isNotEmpty) {
      if (category == null) {
        await widget.api.createFinanceCategory(name.text.trim(), type);
      } else {
        await widget.api
            .updateFinanceCategory(category['id'] as String, name.text.trim());
      }
      await _load();
    }
    name.dispose();
  }

  Future<void> _delete(Map<String, dynamic> category) async {
    try {
      await widget.api.deleteFinanceCategory(category['id'] as String);
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content:
                Text('Categories used by transactions cannot be deleted.')));
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(title: const Text('Finance categories')),
      floatingActionButton: FloatingActionButton(
          onPressed: () => _edit(), child: const Icon(Icons.add)),
      body: ListView(
          children: categories.map((category) {
        final personal = category['userId'] != null;
        return ListTile(
            title: Text(category['name'] as String),
            subtitle: Text(
                '${category['type']} · ${personal ? 'Personal' : 'Default'}'),
            onTap: personal ? () => _edit(category) : null,
            trailing: personal
                ? IconButton(
                    onPressed: () => _delete(category),
                    icon: const Icon(Icons.delete_outline))
                : const Icon(Icons.lock_outline));
      }).toList()));
}
