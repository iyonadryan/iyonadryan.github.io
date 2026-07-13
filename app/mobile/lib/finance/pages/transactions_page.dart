import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/formatters.dart';
import '../../core/users.dart';
import '../../core/widgets/app_shell.dart';
import '../../core/widgets/ui.dart';
import '../models.dart';
import '../store.dart';
import '../ui_state.dart';
import '../widgets/common.dart';
import '../widgets/filter_sheet.dart';

/// Halaman Transaksi — list per bulan aktif dengan filter bertingkat:
/// tab tipe → kategori → rentang tanggal. Semuanya beririsan (AND).
class FinanceTransactionsPage extends StatelessWidget {
  const FinanceTransactionsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final store = context.watch<FinanceStore>();
    final ui = context.watch<FinanceUiState>();
    final scope = context.watch<UserScope>();

    var list = store
        .visible(scope.canSee)
        .where((t) => t.ym == ymKey(ui.viewDate))
        .toList();

    if (ui.typeFilter != null) {
      list = list.where((t) => t.type == ui.typeFilter).toList();
    }

    if (ui.selectedCategories.isNotEmpty) {
      list = list.where((t) {
        if (ui.selectedCategories.contains(t.category)) return true;
        // Sentinel "Kategori Terhapus": cocok kalau kategori transaksi ini
        // memang sudah tidak ada lagi di daftar kategori.
        return ui.selectedCategories.contains(unknownCategory.id) &&
            !store.categoryExists(t.type, t.category);
      }).toList();
    }

    // Perbandingan string "YYYY-MM-DD" = perbandingan kronologis.
    if (ui.filterStartDate != null) {
      list = list
          .where((t) => t.date.compareTo(ui.filterStartDate!) >= 0)
          .toList();
    }
    if (ui.filterEndDate != null) {
      list =
          list.where((t) => t.date.compareTo(ui.filterEndDate!) <= 0).toList();
    }

    // Urut per tanggal desc, tie-break waktu pembuatan.
    list.sort((a, b) {
      final byDate = b.date.compareTo(a.date);
      return byDate != 0 ? byDate : b.createdAt.compareTo(a.createdAt);
    });

    return PageBody(
      children: [
        const MonthSelector(),
        Row(
          children: [
            Expanded(
              child: FilterTabs<TxType?>(
                selected: ui.typeFilter,
                onSelected: ui.setTypeFilter,
                tabs: const [
                  (value: null, label: 'Semua'),
                  (value: TxType.income, label: 'Pemasukan'),
                  (value: TxType.expense, label: 'Pengeluaran'),
                ],
              ),
            ),
            const SizedBox(width: 8),
            _FilterButton(active: ui.hasActiveFilter),
          ],
        ),
        const SizedBox(height: 16),
        if (list.isEmpty)
          EmptyState(
            icon: '🔍',
            message: ui.hasActiveFilter || ui.typeFilter != null
                ? 'Tidak ada transaksi yang cocok dengan filter.'
                : 'Belum ada transaksi di bulan ini.',
          )
        else ...[
          Text(
            '${list.length} transaksi',
            style: TextStyle(fontSize: 12, color: p.textMuted),
          ),
          const SizedBox(height: 10),
          for (final tx in list)
            TransactionTile(tx: tx, detailed: true, showActions: true),
        ],
      ],
    );
  }
}

class _FilterButton extends StatelessWidget {
  const _FilterButton({required this.active});

  final bool active;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    return GestureDetector(
      onTap: () => showFilterSheet(context),
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: active ? p.primary : p.surface,
          shape: BoxShape.circle,
          border: Border.all(color: active ? p.primary : p.border),
        ),
        child: Icon(
          Icons.tune,
          size: 18,
          color: active ? Colors.white : p.textMuted,
        ),
      ),
    );
  }
}
