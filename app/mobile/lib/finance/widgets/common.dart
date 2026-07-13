import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/formatters.dart';
import '../../core/users.dart';
import '../../core/widgets/ui.dart';
import '../models.dart';
import '../store.dart';
import '../ui_state.dart';
import 'transaction_sheet.dart';

/// Selector bulan (prev/next). Tombolnya **dibatasi ke rentang bulan yang
/// benar-benar punya transaksi** — bukan sekadar disamarkan, tapi benar-benar
/// non-aktif, sama dengan `updateMonthNavButtons()` di web. Bulan bolong di
/// tengah rentang tetap bisa disinggahi.
class MonthSelector extends StatelessWidget {
  const MonthSelector({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final store = context.watch<FinanceStore>();
    final ui = context.watch<FinanceUiState>();
    final scope = context.watch<UserScope>();

    final months = store.monthsWithData(store.visible(scope.canSee));
    final current = ymKey(ui.viewDate);
    final canPrev = months.isNotEmpty && current.compareTo(months.first) > 0;
    final canNext = months.isNotEmpty && current.compareTo(months.last) < 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      decoration: BoxDecoration(
        color: p.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: p.border),
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: canPrev ? () => ui.changeMonth(-1) : null,
            icon: const Icon(Icons.chevron_left),
          ),
          Expanded(
            child: Text(
              formatMonthLong(ui.viewDate),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: p.text,
              ),
            ),
          ),
          IconButton(
            onPressed: canNext ? () => ui.changeMonth(1) : null,
            icon: const Icon(Icons.chevron_right),
          ),
        ],
      ),
    );
  }
}

/// Satu baris transaksi. [detailed] = tampilan halaman Transaksi (tanggal +
/// tahun & jam:menit:detik); kalau false = tampilan ringkas Dashboard.
///
/// Klik kartu (di luar tombol ✏️/🗑️ dan badge pembuat) → popup detail, yang
/// ada khusus supaya catatan panjang bisa dibaca utuh — di list catatan
/// terpotong ellipsis.
class TransactionTile extends StatelessWidget {
  const TransactionTile({
    super.key,
    required this.tx,
    this.detailed = false,
    this.showActions = false,
  });

  final Transaction tx;
  final bool detailed;
  final bool showActions;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final store = context.watch<FinanceStore>();
    final scope = context.watch<UserScope>();

    final cat = store.findCategory(tx.type, tx.category);
    final income = tx.type == TxType.income;
    final color = income ? p.income! : p.expense!;

    // Nominal di list transaksi TIDAK ikut "sembunyikan saldo" — yang di-mask
    // cuma balance card & Statistik Pengeluaran, sama seperti versi web.
    final amountText = '${income ? '+' : '-'}${formatCurrency(tx.amount)}';

    final when = detailed
        ? '${formatDateLong(DateTime.parse(tx.date))} · '
            '${formatTimeWithSeconds(tx.createdAt)}'
        : '${formatDateShort(DateTime.parse(tx.date))} · '
            '${formatTime(tx.createdAt)}';

    return AppCard(
      onTap: () => showTransactionDetail(context, tx),
      child: Row(
        children: [
          CategoryIcon(
            emoji: cat.icon,
            color: p.seriesSlot(cat.colorSlot),
            // Badge pembuat cuma relevan di mode Both (campuran dua orang).
            by: scope.isBoth ? tx.by : null,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  cat.label,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: p.text,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  tx.note.isEmpty ? when : tx.note,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, color: p.textMuted),
                ),
                if (tx.note.isNotEmpty)
                  Text(
                    when,
                    style: TextStyle(fontSize: 11, color: p.textMuted),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                amountText,
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: color,
                  fontSize: 13.5,
                ),
              ),
              if (showActions)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _iconAction(
                      '✏️',
                      () => showTransactionSheet(context, editing: tx),
                    ),
                    _iconAction('🗑️', () async {
                      final ok = await confirmDialog(
                        context,
                        title: 'Hapus Transaksi?',
                        message:
                            'Transaksi ini akan dihapus permanen dari catatan.',
                      );
                      if (ok) await store.deleteTransaction(tx);
                    }),
                  ],
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _iconAction(String emoji, VoidCallback onTap) => InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
          child: Text(emoji, style: const TextStyle(fontSize: 14)),
        ),
      );
}
