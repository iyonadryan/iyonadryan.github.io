import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/formatters.dart';
import '../../core/users.dart';
import '../../core/widgets/ui.dart';
import '../models.dart';
import '../store.dart';

/// Modal tambah/ubah rencana anggaran.
///
/// Saat edit, **periode, kategori, dan pembuat dikunci** — mengubah salah satu
/// dari itu artinya rencana yang berbeda, bukan mengedit yang ini.
Future<void> showPlanSheet(BuildContext context, {Plan? editing}) {
  return showAppSheet<void>(
    context: context,
    title: editing == null ? 'Tambah Rencana' : 'Edit Rencana',
    builder: (ctx) => _PlanForm(editing: editing),
  );
}

class _PlanForm extends StatefulWidget {
  const _PlanForm({this.editing});

  final Plan? editing;

  @override
  State<_PlanForm> createState() => _PlanFormState();
}

class _PlanFormState extends State<_PlanForm> {
  late PlanPeriod _period = widget.editing?.period ?? PlanPeriod.bulanan;
  late String? _category = widget.editing?.category;
  late final TextEditingController _limit = TextEditingController(
    text: widget.editing == null ? '' : formatThousands(widget.editing!.limit),
  );
  late String _by = widget.editing?.by ?? 'iyon';

  bool get _isEdit => widget.editing != null;

  @override
  void initState() {
    super.initState();
    final scope = context.read<UserScope>();
    if (!_isEdit && !scope.isBoth) {
      _by = scope.currentUserId ?? 'iyon';
    }
  }

  @override
  void dispose() {
    _limit.dispose();
    super.dispose();
  }

  /// Kategori yang masih bisa dipilih di periode ini — yang sudah dipakai
  /// disembunyikan supaya tidak ada duplikat kategori dalam satu periode.
  /// Keunikan dicek **global** (bukan per-user).
  List<FinanceCategory> _availableCategories(FinanceStore store) {
    final used = store.plans
        .where((p) => p.period == _period)
        .map((p) => p.category)
        .toSet();

    // Saat edit, kategori yang sedang diedit tetap harus ada di daftar.
    used.remove(widget.editing?.category);

    return [
      allCategory,
      ...store.expenseCategories,
    ].where((c) => !used.contains(c.id)).toList();
  }

  Future<void> _submit() async {
    final store = context.read<FinanceStore>();
    final limit = parseAmount(_limit.text);

    if (_category == null) {
      _warn('Pilih kategori dulu.');
      return;
    }
    if (limit <= 0) {
      _warn('Batas anggaran harus lebih dari 0.');
      return;
    }

    await store.savePlan(
      Plan(
        period: _period,
        category: _category!,
        limit: limit,
        // `savePlan` memakai `.set()` — `sort` lama WAJIB dipertahankan saat
        // edit, kalau tidak urutan drag-nya ke-reset.
        sort: widget.editing?.sort ?? store.nextSortForPeriod(_period),
        by: _by,
      ),
    );
    if (mounted) Navigator.pop(context);
  }

  void _warn(String message) => ScaffoldMessenger.of(context)
      .showSnackBar(SnackBar(content: Text(message)));

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final store = context.watch<FinanceStore>();
    final scope = context.watch<UserScope>();

    final available = _availableCategories(store);
    final selected =
        available.any((c) => c.id == _category) ? _category : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldBox(
          label: 'Periode',
          child: DropdownButtonFormField<PlanPeriod>(
            initialValue: _period,
            onChanged: _isEdit
                ? null
                : (v) => setState(() {
                      _period = v!;
                      // Ganti periode → pool kategori berubah, pilihan lama
                      // bisa jadi sudah terpakai di periode baru.
                      _category = null;
                    }),
            items: [
              for (final period in PlanPeriod.values)
                DropdownMenuItem(
                  value: period,
                  // Periode yang sudah penuh dimatikan di dropdown.
                  enabled: _isEdit || !store.periodIsFull(period),
                  child: Text(
                    period.label,
                    style: TextStyle(
                      color: (!_isEdit && store.periodIsFull(period))
                          ? p.textMuted
                          : p.text,
                    ),
                  ),
                ),
            ],
          ),
        ),
        FieldBox(
          label: 'Kategori',
          child: DropdownButtonFormField<String>(
            initialValue: selected,
            onChanged: _isEdit ? null : (v) => setState(() => _category = v),
            hint: Text(
              available.isEmpty
                  ? 'Semua kategori sudah dipakai'
                  : 'Pilih kategori',
            ),
            items: [
              for (final c in available)
                DropdownMenuItem(
                  value: c.id,
                  child: Text('${c.icon}  ${c.label}'),
                ),
            ],
          ),
        ),
        FieldBox(
          label: 'Batas Anggaran (Rp)',
          child: TextField(
            controller: _limit,
            keyboardType: TextInputType.number,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              const ThousandsInputFormatter(),
            ],
            decoration: const InputDecoration(hintText: '0'),
          ),
        ),
        if (scope.isBoth && !_isEdit)
          FieldBox(
            label: 'Dibuat oleh',
            child: SegmentToggle<String>(
              selected: _by,
              options: [
                for (final u in Users.creators) (value: u.id, label: u.label),
              ],
              onSelected: (v) => setState(() => _by = v),
            ),
          ),
        const SizedBox(height: 6),
        if (_isEdit)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text(
              'Hanya batas anggaran yang bisa diubah.',
              style: TextStyle(fontSize: 11.5, color: p.textMuted),
            ),
          ),
        GradientButton(
          label: 'Simpan',
          onPressed: available.isEmpty && !_isEdit ? null : _submit,
        ),
      ],
    );
  }
}
