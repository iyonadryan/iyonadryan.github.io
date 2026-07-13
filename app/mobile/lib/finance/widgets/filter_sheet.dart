import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/formatters.dart';
import '../../core/users.dart';
import '../../core/widgets/ui.dart';
import '../models.dart';
import '../store.dart';
import '../ui_state.dart';

/// Modal filter transaksi: rentang tanggal (dibatasi ke bulan aktif) +
/// kategori multi-select. Tiga tombol: Batal / Reset / Terapkan.
Future<void> showFilterSheet(BuildContext context) {
  return showAppSheet<void>(
    context: context,
    title: 'Filter Transaksi',
    builder: (ctx) => const _FilterForm(),
  );
}

class _FilterForm extends StatefulWidget {
  const _FilterForm();

  @override
  State<_FilterForm> createState() => _FilterFormState();
}

class _FilterFormState extends State<_FilterForm> {
  late Set<String> _categories;
  late int? _startDay;
  late int? _endDay;

  @override
  void initState() {
    super.initState();
    final ui = context.read<FinanceUiState>();
    _categories = {...ui.selectedCategories};
    _startDay = _dayOf(ui.filterStartDate);
    _endDay = _dayOf(ui.filterEndDate);
  }

  int? _dayOf(String? date) =>
      date == null ? null : DateTime.parse(date).day;

  String _dateFromDay(int day, DateTime month) =>
      dateKey(DateTime(month.year, month.month, day));

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final store = context.watch<FinanceStore>();
    final ui = context.watch<FinanceUiState>();
    final scope = context.watch<UserScope>();

    final daysInMonth =
        DateTime(ui.viewDate.year, ui.viewDate.month + 1, 0).day;

    // Pool kategori mengikuti tab tipe yang sedang aktif: tab "Semua" →
    // expense + income, tab tertentu → tipe itu saja.
    final pool = <FinanceCategory>[
      if (ui.typeFilter != TxType.income) ...store.expenseCategories,
      if (ui.typeFilter != TxType.expense) ...store.incomeCategories,
    ];

    // Kalau ada transaksi (sesuai tab aktif) yang kategorinya sudah dihapus,
    // tawarkan opsi ekstra "Kategori Terhapus" — tanpa ini, transaksi itu
    // hilang sama sekali dari filter kategori.
    final hasOrphan = store
        .visible(scope.canSee)
        .where((t) => t.ym == ymKey(ui.viewDate))
        .where((t) => ui.typeFilter == null || t.type == ui.typeFilter)
        .any((t) => !store.categoryExists(t.type, t.category));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldBox(
          label: 'Rentang Tanggal (bulan ${formatMonthLong(ui.viewDate)})',
          child: Row(
            children: [
              Expanded(
                child: _DayDropdown(
                  hint: 'Dari',
                  value: _startDay,
                  max: daysInMonth,
                  onChanged: (v) => setState(() => _startDay = v),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _DayDropdown(
                  hint: 'Sampai',
                  value: _endDay,
                  max: daysInMonth,
                  onChanged: (v) => setState(() => _endDay = v),
                ),
              ),
            ],
          ),
        ),
        FieldBox(
          label: 'Kategori',
          child: Container(
            constraints: const BoxConstraints(maxHeight: 220),
            decoration: BoxDecoration(
              color: p.surfaceAlt,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: p.border),
            ),
            child: ListView(
              shrinkWrap: true,
              children: [
                for (final c in pool)
                  CheckboxListTile(
                    dense: true,
                    controlAffinity: ListTileControlAffinity.leading,
                    value: _categories.contains(c.id),
                    title: Text('${c.icon}  ${c.label}'),
                    onChanged: (on) => setState(() {
                      if (on ?? false) {
                        _categories.add(c.id);
                      } else {
                        _categories.remove(c.id);
                      }
                    }),
                  ),
                if (hasOrphan)
                  CheckboxListTile(
                    dense: true,
                    controlAffinity: ListTileControlAffinity.leading,
                    value: _categories.contains(unknownCategory.id),
                    title: Text(
                      '${unknownCategory.icon}  ${unknownCategory.label}',
                    ),
                    onChanged: (on) => setState(() {
                      if (on ?? false) {
                        _categories.add(unknownCategory.id);
                      } else {
                        _categories.remove(unknownCategory.id);
                      }
                    }),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            Expanded(
              child: SecondaryButton(
                label: 'Batal',
                onPressed: () => Navigator.pop(context),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: SecondaryButton(
                label: 'Reset',
                invert: true,
                onPressed: () {
                  // Reset membuang SEMUA filter, termasuk tab tipe.
                  ui.resetFilter();
                  Navigator.pop(context);
                },
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: GradientButton(
                label: 'Terapkan',
                onPressed: () {
                  ui.applyFilter(
                    categories: _categories,
                    start: _startDay == null
                        ? null
                        : _dateFromDay(_startDay!, ui.viewDate),
                    end: _endDay == null
                        ? null
                        : _dateFromDay(_endDay!, ui.viewDate),
                  );
                  Navigator.pop(context);
                },
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _DayDropdown extends StatelessWidget {
  const _DayDropdown({
    required this.hint,
    required this.value,
    required this.max,
    required this.onChanged,
  });

  final String hint;
  final int? value;
  final int max;
  final ValueChanged<int?> onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<int?>(
      initialValue: value,
      hint: Text(hint),
      isExpanded: true,
      onChanged: onChanged,
      items: [
        const DropdownMenuItem(value: null, child: Text('—')),
        for (var d = 1; d <= max; d++)
          DropdownMenuItem(value: d, child: Text('$d')),
      ],
    );
  }
}
