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

class FinanceDashboardPage extends StatelessWidget {
  const FinanceDashboardPage({super.key, required this.onSeeAllTransactions});

  final VoidCallback onSeeAllTransactions;

  @override
  Widget build(BuildContext context) {
    final store = context.watch<FinanceStore>();
    final ui = context.watch<FinanceUiState>();
    final scope = context.watch<UserScope>();

    final monthTx = store
        .visible(scope.canSee)
        .where((t) => t.ym == ymKey(ui.viewDate))
        .toList();

    final recent = [...monthTx]
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

    return PageBody(
      children: [
        const MonthSelector(),
        _BalanceCard(monthTx: monthTx),
        const SizedBox(height: 22),
        SectionHeading(
          'Transaksi Terbaru',
          actionLabel: 'Lihat Semua',
          onAction: onSeeAllTransactions,
        ),
        if (recent.isEmpty)
          const EmptyState(
            icon: '🧾',
            message: 'Belum ada transaksi di bulan ini.',
          )
        else
          for (final tx in recent.take(3)) TransactionTile(tx: tx),
        const SizedBox(height: 12),
        _CategoryStats(monthTx: monthTx),
      ],
    );
  }
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.monthTx});

  final List<Transaction> monthTx;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final ui = context.watch<FinanceUiState>();

    final income = monthTx
        .where((t) => t.type == TxType.income)
        .fold<double>(0, (s, t) => s + t.amount);
    final expense = monthTx
        .where((t) => t.type == TxType.expense)
        .fold<double>(0, (s, t) => s + t.amount);
    final balance = income - expense;

    // Padanan teks tersamar `Rp ••••••` di web.
    String money(double v) => ui.balanceVisible ? formatCurrency(v) : 'Rp ••••••';

    final total = income + expense;
    final incomeRatio = total == 0 ? 0.0 : income / total;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: p.cardGradient,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: p.primary.withValues(alpha: 0.3),
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Saldo Bulan Ini',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.85),
                    fontSize: 12.5,
                  ),
                ),
              ),
              // Ikon = aksi saat diklik: mata terbuka saat angka tersembunyi
              // (klik untuk tampilkan), tercoret saat tampil.
              IconButton(
                onPressed: ui.toggleBalance,
                visualDensity: VisualDensity.compact,
                icon: Icon(
                  ui.balanceVisible
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  color: Colors.white,
                  size: 20,
                ),
              ),
            ],
          ),
          Text(
            money(balance),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: incomeRatio,
              minHeight: 6,
              backgroundColor: Colors.white.withValues(alpha: 0.25),
              valueColor: AlwaysStoppedAnimation(
                Colors.white.withValues(alpha: 0.9),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(child: _mini('Pemasukan', money(income), '↑')),
              Expanded(child: _mini('Pengeluaran', money(expense), '↓')),
            ],
          ),
        ],
      ),
    );
  }

  Widget _mini(String label, String value, String arrow) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$arrow $label',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.8),
              fontSize: 11.5,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      );
}

/// Statistik Pengeluaran — breakdown per kategori bulan berjalan, urut nominal
/// terbesar. Warna kategori mengikuti `colorSlot`-nya (fixed), **bukan** ranking
/// bulan itu, supaya warna satu kategori konsisten antar bulan.
class _CategoryStats extends StatelessWidget {
  const _CategoryStats({required this.monthTx});

  final List<Transaction> monthTx;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final store = context.watch<FinanceStore>();
    final ui = context.watch<FinanceUiState>();

    final expenses = monthTx.where((t) => t.type == TxType.expense).toList();
    if (expenses.isEmpty) return const SizedBox.shrink();

    final totals = <String, double>{};
    for (final t in expenses) {
      totals[t.category] = (totals[t.category] ?? 0) + t.amount;
    }
    final total = totals.values.fold<double>(0, (s, v) => s + v);

    final rows = totals.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    final top = store.findCategory(TxType.expense, rows.first.key);
    final topPct = (rows.first.value / total * 100).round();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SectionHeading('Statistik Pengeluaran'),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Pengeluaran terbesar bulan ini di ${top.label} '
                '($topPct% dari total).',
                style: TextStyle(
                  fontSize: 12.5,
                  color: p.textMuted,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 14),
              for (var i = 0; i < rows.length; i++)
                _StatRow(
                  category: store.findCategory(TxType.expense, rows[i].key),
                  amount: rows[i].value,
                  ratio: rows[i].value / total,
                  masked: !ui.balanceVisible,
                  isLast: i == rows.length - 1,
                  plan: _monthlyPlanFor(store, rows[i].key),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Plan? _monthlyPlanFor(FinanceStore store, String categoryId) {
    for (final p in store.plans) {
      if (p.period == PlanPeriod.bulanan && p.category == categoryId) return p;
    }
    return null;
  }
}

class _StatRow extends StatelessWidget {
  const _StatRow({
    required this.category,
    required this.amount,
    required this.ratio,
    required this.masked,
    required this.isLast,
    required this.plan,
  });

  final FinanceCategory category;
  final double amount;
  final double ratio;
  final bool masked;
  final bool isLast;
  final Plan? plan;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final color = p.seriesSlot(category.colorSlot);

    // Catatan "vs rencana bulanan" — teks & warnanya berjenjang sesuai seberapa
    // dekat pengeluaran ke limitnya.
    String? planNote;
    Color? planColor;
    if (plan != null && plan!.limit > 0) {
      final pct = amount / plan!.limit * 100;
      if (pct > 100) {
        planNote = 'Melebihi rencana bulanan';
        planColor = p.expense;
      } else if (pct == 100) {
        planNote = 'Mencapai target rencana bulanan';
        planColor = p.warning;
      } else if (pct >= 80) {
        planNote = 'Mendekati batas rencana bulanan';
        planColor = p.warning;
      } else {
        planNote = '${pct.round()}% dari rencana bulanan';
      }
    }

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        border: isLast
            ? null
            : Border(bottom: BorderSide(color: p.border)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 9,
                height: 9,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '${category.icon} ${category.label}',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: p.text,
                  ),
                ),
              ),
              // Persen & bar selalu tampil walau nominal disembunyikan — tidak
              // membocorkan angka absolut.
              Text(
                '${(ratio * 100).round()}%',
                style: TextStyle(fontSize: 12, color: p.textMuted),
              ),
              const SizedBox(width: 10),
              Text(
                masked ? 'Rp ••••••' : formatCurrency(amount),
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: p.text,
                ),
              ),
            ],
          ),
          const SizedBox(height: 7),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: ratio,
              minHeight: 5,
              backgroundColor: p.surfaceAlt,
              valueColor: AlwaysStoppedAnimation(color),
            ),
          ),
          if (planNote != null) ...[
            const SizedBox(height: 5),
            Text(
              planNote,
              style: TextStyle(
                fontSize: 11,
                color: planColor ?? p.textMuted,
                fontWeight:
                    planColor == null ? FontWeight.w400 : FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
