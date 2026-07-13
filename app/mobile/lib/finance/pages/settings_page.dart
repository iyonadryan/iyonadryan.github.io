import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/formatters.dart';
import '../../core/users.dart';
import '../../core/widgets/app_shell.dart';
import '../../core/widgets/settings_common.dart';
import '../../core/widgets/ui.dart';
import '../excel_export.dart';
import '../models.dart';
import '../store.dart';

class FinanceSettingsPage extends StatelessWidget {
  const FinanceSettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final store = context.watch<FinanceStore>();
    final scope = context.watch<UserScope>();

    return PageBody(
      children: [
        const ActiveUserCard(),
        const ThemeSettingsCard(),
        SettingsCard(
          title: 'Export ke Excel',
          subtitle: 'Unduh transaksi atau ringkasan bulanan',
          child: SecondaryButton(
            label: 'Export',
            onPressed: () =>
                _showExportSheet(context, store, store.visible(scope.canSee)),
          ),
        ),
        SettingsCard(
          title: 'Kategori',
          subtitle: 'Kelola kategori pemasukan & pengeluaran',
          child: SecondaryButton(
            label: 'Kelola Kategori',
            onPressed: () => _showCategoriesSheet(context),
          ),
        ),
        const HubSettingsCard(),
        const AboutSettingsCard(
          appName: 'Finance App',
          text: 'Kelola pemasukan & pengeluaran pribadi. '
              'Data tersimpan realtime di Firebase, dipakai bareng dengan '
              'versi web di iyonadryan.github.io/app/finance.',
        ),
      ],
    );
  }
}

// --- Export ----------------------------------------------------------------

Future<void> _showExportSheet(
  BuildContext context,
  FinanceStore store,
  List<Transaction> visible,
) {
  return showAppSheet<void>(
    context: context,
    title: 'Export ke Excel',
    builder: (ctx) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SettingsCard(
          title: 'Transaksi per bulan',
          subtitle: 'Pilih bulan, lalu unduh semua transaksinya',
          onTap: () async {
            final ym = await _pickMonth(ctx, store.monthsWithData(visible));
            if (ym == null || !ctx.mounted) return;
            await _run(
              ctx,
              () => FinanceExcel.transactionsForMonth(store, visible, ym),
            );
          },
        ),
        SettingsCard(
          title: 'Ringkasan per bulan',
          subtitle: 'Pemasukan, pengeluaran, & saldo tiap bulan',
          onTap: () => _run(ctx, () => FinanceExcel.monthlySummary(visible)),
        ),
      ],
    ),
  );
}

Future<String?> _pickMonth(BuildContext context, List<String> months) {
  // Bulan terbaru dulu — yang paling sering diekspor.
  final ordered = months.reversed.toList();

  return showAppSheet<String>(
    context: context,
    title: 'Pilih Bulan',
    builder: (ctx) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (ordered.isEmpty)
          const EmptyState(icon: '📭', message: 'Belum ada data transaksi.')
        else
          for (final ym in ordered)
            SettingsCard(
              title: formatMonthLong(DateTime.parse('$ym-01')),
              onTap: () => Navigator.pop(ctx, ym),
            ),
      ],
    ),
  );
}

Future<void> _run(BuildContext context, Future<void> Function() task) async {
  final messenger = ScaffoldMessenger.of(context);
  final navigator = Navigator.of(context);
  try {
    await task();
    navigator.pop();
  } on Exception catch (e) {
    messenger.showSnackBar(
      SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
    );
  }
}

// --- CRUD kategori ---------------------------------------------------------

/// Popup kategori Finance — **dua list terpisah** (Pengeluaran & Pemasukan),
/// beda dari Kitchen/Note/Wishlist yang kategorinya flat satu list. Karena itu
/// Finance tidak memakai `core/widgets/category_sheet.dart`.
Future<void> _showCategoriesSheet(BuildContext context) {
  return showAppSheet<void>(
    context: context,
    title: 'Kategori',
    builder: (ctx) => Consumer<FinanceStore>(
      builder: (ctx2, store, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _CategorySection(
            title: 'Pengeluaran',
            type: TxType.expense,
            categories: store.expenseCategories,
          ),
          const SizedBox(height: 22),
          _CategorySection(
            title: 'Pemasukan',
            type: TxType.income,
            categories: store.incomeCategories,
          ),
        ],
      ),
    ),
  );
}

class _CategorySection extends StatelessWidget {
  const _CategorySection({
    required this.title,
    required this.type,
    required this.categories,
  });

  final String title;
  final TxType type;
  final List<FinanceCategory> categories;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final store = context.read<FinanceStore>();

    // Urut A-Z by label khusus di popup ini (tidak mengubah urutan aslinya),
    // dengan kategori "Lainnya" bawaan selalu didorong ke paling akhir.
    final sorted = [...categories]..sort((a, b) {
        final aLast = isLainnyaCategory(a.id);
        final bLast = isLainnyaCategory(b.id);
        if (aLast != bLast) return aLast ? 1 : -1;
        return a.label.toLowerCase().compareTo(b.label.toLowerCase());
      });

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          title,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: p.text,
          ),
        ),
        const SizedBox(height: 10),
        for (final c in sorted)
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: p.surfaceAlt,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: p.border),
            ),
            child: Row(
              children: [
                Container(
                  width: 16,
                  height: 16,
                  decoration: BoxDecoration(
                    color: p.seriesSlot(c.colorSlot),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 10),
                Text(c.icon, style: const TextStyle(fontSize: 17)),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        c.label,
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: p.text,
                        ),
                      ),
                      Text(
                        c.id,
                        style: TextStyle(fontSize: 11, color: p.textMuted),
                      ),
                    ],
                  ),
                ),
                // Kategori "Lainnya" bawaan tidak bisa diubah/dihapus — id-nya
                // dipakai sebagai catch-all.
                if (!isLainnyaCategory(c.id)) ...[
                  IconButton(
                    icon: const Text('✏️', style: TextStyle(fontSize: 14)),
                    onPressed: () =>
                        _openForm(context, type, categories, existing: c),
                  ),
                  IconButton(
                    icon: const Text('🗑️', style: TextStyle(fontSize: 14)),
                    onPressed: () async {
                      final ok = await confirmDialog(
                        context,
                        title: 'Hapus Kategori?',
                        message:
                            'Transaksi lama tetap tersimpan, tapi akan tampil '
                            'tanpa nama kategori (❓ Kategori Terhapus).',
                      );
                      if (ok) await store.deleteCategory(type, c.id);
                    },
                  ),
                ],
              ],
            ),
          ),
        const SizedBox(height: 4),
        SecondaryButton(
          label: '+ Buat Kategori Baru',
          invert: true,
          onPressed: () => _openForm(context, type, categories),
        ),
      ],
    );
  }
}

Future<void> _openForm(
  BuildContext context,
  TxType type,
  List<FinanceCategory> siblings, {
  FinanceCategory? existing,
}) {
  return showAppSheet<void>(
    context: context,
    title: existing == null ? 'Kategori Baru' : 'Ubah Kategori',
    builder: (ctx) => _CategoryForm(
      type: type,
      siblings: siblings,
      existing: existing,
    ),
  );
}

class _CategoryForm extends StatefulWidget {
  const _CategoryForm({
    required this.type,
    required this.siblings,
    this.existing,
  });

  final TxType type;
  final List<FinanceCategory> siblings;
  final FinanceCategory? existing;

  @override
  State<_CategoryForm> createState() => _CategoryFormState();
}

class _CategoryFormState extends State<_CategoryForm> {
  late final TextEditingController _id =
      TextEditingController(text: widget.existing?.id ?? '');
  late final TextEditingController _label =
      TextEditingController(text: widget.existing?.label ?? '');
  late final TextEditingController _icon =
      TextEditingController(text: widget.existing?.icon ?? '');
  late int _slot = widget.existing?.colorSlot ?? 1;

  bool get _isEdit => widget.existing != null;

  @override
  void dispose() {
    _id.dispose();
    _label.dispose();
    _icon.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final store = context.read<FinanceStore>();

    final label = _label.text.trim();
    if (label.isEmpty) {
      _warn('Label wajib diisi.');
      return;
    }

    // Id kategori Finance **diketik manual** (bukan slug otomatis dari label,
    // beda dari Kitchen/Note/Wishlist) — dinormalisasi lalu dicek bentrok.
    // Kalau bentrok, submit dibatalkan; tidak auto-rename diam-diam.
    final id = _isEdit ? widget.existing!.id : slugify(_id.text);
    if (id.isEmpty) {
      _warn('Id kategori wajib diisi (mis. "kopi").');
      return;
    }
    if (!_isEdit) {
      if (id == allCategory.id) {
        _warn('Id "semua" sudah dipakai sistem. Pilih id lain.');
        return;
      }
      if (widget.siblings.any((c) => c.id == id)) {
        _warn('Id "$id" sudah dipakai kategori lain.');
        return;
      }
    }

    await store.saveCategory(
      widget.type,
      FinanceCategory(
        id: id,
        label: label,
        icon: _icon.text.trim().isEmpty ? '📦' : _icon.text.trim(),
        colorSlot: _slot,
      ),
    );
    if (mounted) Navigator.pop(context);
  }

  void _warn(String message) => ScaffoldMessenger.of(context)
      .showSnackBar(SnackBar(content: Text(message)));

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldBox(
          label: 'Id',
          child: TextField(
            controller: _id,
            // Id tidak bisa diubah saat edit — transaksi lama merujuk ke id ini.
            enabled: !_isEdit,
            decoration: const InputDecoration(hintText: 'mis. kopi'),
          ),
        ),
        FieldBox(
          label: 'Label (Yang ditampilkan)',
          child: TextField(
            controller: _label,
            decoration: const InputDecoration(hintText: 'mis. Kopi'),
          ),
        ),
        FieldBox(
          label: 'Icon (emoji)',
          child: TextField(
            controller: _icon,
            decoration: const InputDecoration(hintText: 'mis. ☕'),
          ),
        ),
        FieldBox(
          label: 'Warna',
          child: SlotPicker(
            selected: _slot,
            palette: p,
            onSelected: (s) => setState(() => _slot = s),
          ),
        ),
        const SizedBox(height: 8),
        GradientButton(label: 'Simpan', onPressed: _submit),
      ],
    );
  }
}
