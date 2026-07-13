import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/formatters.dart';
import '../../core/users.dart';
import '../../core/widgets/ui.dart';
import '../models.dart';
import '../store.dart';

/// Modal tambah/ubah transaksi. Mengembalikan `true` kalau transaksi **baru**
/// berhasil ditambahkan (pemanggil memakainya untuk pindah ke Dashboard);
/// edit mengembalikan `false` supaya user tetap di halaman asal.
Future<bool?> showTransactionSheet(
  BuildContext context, {
  Transaction? editing,
}) {
  return showAppSheet<bool>(
    context: context,
    title: editing == null ? 'Tambah Transaksi' : 'Edit Transaksi',
    builder: (ctx) => _TransactionForm(editing: editing),
  );
}

class _TransactionForm extends StatefulWidget {
  const _TransactionForm({this.editing});

  final Transaction? editing;

  @override
  State<_TransactionForm> createState() => _TransactionFormState();
}

class _TransactionFormState extends State<_TransactionForm> {
  late TxType _type = widget.editing?.type ?? TxType.expense;
  late String? _category = widget.editing?.category;
  late final TextEditingController _amount = TextEditingController(
    text: widget.editing == null
        ? ''
        : formatThousands(widget.editing!.amount),
  );
  late final TextEditingController _note =
      TextEditingController(text: widget.editing?.note ?? '');
  late String _by = widget.editing?.by ?? 'iyon';

  bool get _isEdit => widget.editing != null;

  @override
  void initState() {
    super.initState();
    final scope = context.read<UserScope>();
    // Kalau pengguna aktif Iyon/Ciwul, `by` otomatis ikut dia (field "Dibuat
    // oleh" tidak ditampilkan). Field itu cuma muncul di mode Both.
    if (!_isEdit && !scope.isBoth) {
      _by = scope.currentUserId ?? 'iyon';
    }
  }

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final store = context.read<FinanceStore>();
    final amount = parseAmount(_amount.text);

    if (amount <= 0) {
      _warn('Nominal harus lebih dari 0.');
      return;
    }

    if (_isEdit) {
      // Tipe, kategori, tanggal, dan `by` dikunci — cuma nominal & catatan yang
      // bisa diubah, dan node ditulis ulang di path yang sama.
      await store.updateTransaction(
        widget.editing!,
        amount: amount,
        note: _note.text.trim(),
      );
      if (mounted) Navigator.pop(context, false);
      return;
    }

    if (_category == null) {
      _warn('Pilih kategori dulu.');
      return;
    }

    final now = DateTime.now();
    await store.addTransaction(
      Transaction(
        id: '${now.millisecondsSinceEpoch}',
        ym: ymKey(now),
        type: _type,
        amount: amount,
        category: _category!,
        note: _note.text.trim(),
        date: dateKey(now),
        by: _by,
      ),
    );
    if (mounted) Navigator.pop(context, true);
  }

  void _warn(String message) => ScaffoldMessenger.of(context)
      .showSnackBar(SnackBar(content: Text(message)));

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final store = context.watch<FinanceStore>();
    final scope = context.watch<UserScope>();

    final pool = _type == TxType.expense
        ? store.expenseCategories
        : store.incomeCategories;

    // Kategori terpilih bisa saja sudah dihapus (transaksi lama) — jangan
    // sampai DropdownButton crash karena value-nya tidak ada di items.
    final selected = pool.any((c) => c.id == _category) ? _category : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldBox(
          label: 'Tipe',
          child: SegmentToggle<TxType>(
            selected: _type,
            locked: _isEdit,
            options: const [
              (value: TxType.expense, label: 'Pengeluaran'),
              (value: TxType.income, label: 'Pemasukan'),
            ],
            onSelected: (t) => setState(() {
              _type = t;
              _category = null;
            }),
          ),
        ),
        FieldBox(
          label: 'Kategori',
          child: DropdownButtonFormField<String>(
            initialValue: selected,
            // Kategori dikunci saat edit — ubah kategori = transaksi lain.
            onChanged: _isEdit
                ? null
                : (v) => setState(() => _category = v),
            hint: const Text('Pilih kategori'),
            items: [
              for (final c in pool)
                DropdownMenuItem(
                  value: c.id,
                  child: Text('${c.icon}  ${c.label}'),
                ),
            ],
          ),
        ),
        FieldBox(
          label: 'Jumlah (Rp)',
          child: TextField(
            controller: _amount,
            keyboardType: TextInputType.number,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              const ThousandsInputFormatter(),
            ],
            decoration: const InputDecoration(hintText: '0'),
          ),
        ),
        FieldBox(
          label: 'Catatan',
          child: TextField(
            controller: _note,
            maxLines: 2,
            decoration: const InputDecoration(hintText: 'mis. Makan siang'),
          ),
        ),
        FieldBox(
          // Tanggal selalu hari ini & tidak bisa diubah — sama dengan versi web.
          label: 'Tanggal (otomatis)',
          child: TextField(
            enabled: false,
            controller: TextEditingController(
              text: formatDateLong(
                _isEdit
                    ? DateTime.parse(widget.editing!.date)
                    : DateTime.now(),
              ),
            ),
          ),
        ),
        if (scope.isBoth)
          FieldBox(
            label: 'Dibuat oleh',
            child: SegmentToggle<String>(
              selected: _by,
              // Pembuat tidak bisa diubah retroaktif saat edit.
              locked: _isEdit,
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
              'Hanya nominal & catatan yang bisa diubah.',
              style: TextStyle(fontSize: 11.5, color: p.textMuted),
            ),
          ),
        GradientButton(label: 'Simpan', onPressed: _submit),
      ],
    );
  }
}

/// Popup detail transaksi — read-only. Ada supaya **catatan panjang bisa dibaca
/// utuh**; di list catatan dipotong ellipsis.
Future<void> showTransactionDetail(BuildContext context, Transaction tx) {
  return showAppSheet<void>(
    context: context,
    title: 'Detail Transaksi',
    builder: (ctx) {
      final p = ctx.palette;
      final store = ctx.read<FinanceStore>();
      final cat = store.findCategory(tx.type, tx.category);
      final income = tx.type == TxType.income;

      Widget row(String label, String value) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 96,
                  child: Text(
                    label,
                    style: TextStyle(fontSize: 12.5, color: p.textMuted),
                  ),
                ),
                Expanded(
                  child: Text(
                    value,
                    style: TextStyle(
                      fontSize: 13.5,
                      color: p.text,
                      height: 1.5,
                    ),
                  ),
                ),
              ],
            ),
          );

      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Column(
              children: [
                CategoryIcon(
                  emoji: cat.icon,
                  color: p.seriesSlot(cat.colorSlot),
                  size: 60,
                ),
                const SizedBox(height: 10),
                Text(
                  '${income ? '+' : '-'}${formatCurrency(tx.amount)}',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: income ? p.income : p.expense,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          row('Kategori', cat.label),
          row('Tipe', tx.type.label),
          row('Catatan', tx.note.isEmpty ? '—' : tx.note),
          row('Tanggal', formatDateLong(DateTime.parse(tx.date))),
          row('Waktu', formatTimeWithSeconds(tx.createdAt)),
          row('Dibuat oleh', Users.byId(tx.by).label),
          const SizedBox(height: 8),
          SecondaryButton(
            label: 'Tutup',
            onPressed: () => Navigator.pop(ctx),
          ),
        ],
      );
    },
  );
}
