import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/formatters.dart';
import '../../core/users.dart';
import '../../core/widgets/ui.dart';
import '../models.dart';
import '../store.dart';
import '../ui_state.dart';
import '../widgets/plan_sheet.dart';

class FinancePlansPage extends StatelessWidget {
  const FinancePlansPage({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final store = context.watch<FinanceStore>();
    final ui = context.watch<FinanceUiState>();
    final scope = context.watch<UserScope>();

    // Rencana adalah SATU slot global per periode+kategori (siapa pun
    // pembuatnya). Yang per-user cuma *tampilannya*: mode Iyon menyembunyikan
    // rencana milik Ciwul, walau slot kategori itu tetap "terpakai" secara
    // global.
    final visible = store.plans
        .where((pl) => pl.period == ui.currentPeriod && scope.canSee(pl.by))
        .toList()
      ..sort((a, b) {
        final bySort = a.sort.compareTo(b.sort);
        return bySort != 0 ? bySort : a.id.compareTo(b.id);
      });

    final full = store.periodIsFull(ui.currentPeriod);

    // Drag-reorder dimatikan di mode Both — list-nya campuran rencana banyak
    // pemilik, jadi urutan drag ambigu.
    final canReorder = !scope.isBoth && visible.length > 1;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'Rencana Anggaran',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: p.text,
                  ),
                ),
              ),
              AccentIconButton(
                icon: Icons.add,
                // Periode penuh → tidak ada kategori tersisa untuk dibuat.
                onPressed:
                    full ? null : () => showPlanSheet(context),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: FilterTabs<PlanPeriod>(
            selected: ui.currentPeriod,
            onSelected: ui.setPeriod,
            tabs: [
              for (final period in PlanPeriod.values)
                (value: period, label: period.label),
            ],
            // Weekday & Weekend diberi warna khusus supaya beda dari periode
            // "biasa" (harian/mingguan/bulanan).
            activeColorOf: (period) => switch (period) {
              PlanPeriod.weekday => const Color(0xFF6366F1),
              PlanPeriod.weekend => const Color(0xFFF97316),
              _ => p.primary,
            },
          ),
        ),
        const SizedBox(height: 12),
        Expanded(
          child: visible.isEmpty
              ? const EmptyState(
                  icon: '🎯',
                  message: 'Belum ada rencana anggaran di periode ini.',
                )
              : ReorderableListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
                  buildDefaultDragHandles: false,
                  itemCount: visible.length,
                  onReorderItem: (oldIndex, newIndex) {
                    if (!canReorder) return;
                    final reordered = [...visible];
                    reordered.insert(
                      newIndex,
                      reordered.removeAt(oldIndex),
                    );
                    store.commitPlanOrder(ui.currentPeriod, reordered);
                  },
                  itemBuilder: (context, i) => _PlanCard(
                    key: ValueKey(visible[i].id),
                    plan: visible[i],
                    index: i,
                    showHandle: canReorder,
                  ),
                ),
        ),
      ],
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    super.key,
    required this.plan,
    required this.index,
    required this.showHandle,
  });

  final Plan plan;
  final int index;
  final bool showHandle;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final store = context.watch<FinanceStore>();
    final ui = context.watch<FinanceUiState>();
    final scope = context.watch<UserScope>();

    final isAll = plan.category == allCategory.id;
    final cat = isAll
        ? allCategory
        : store.findCategory(TxType.expense, plan.category);

    final spent = store
        .txInPlanPeriod(plan, store.visible(scope.canSee), ui.viewDate)
        .fold<double>(0, (s, t) => s + t.amount);

    final ratio = plan.limit <= 0 ? 0.0 : spent / plan.limit;
    final barColor = ratio >= 1
        ? p.expense!
        : ratio >= 0.8
            ? p.warning!
            : p.primary;

    // Key-nya ada di _PlanCard (dibutuhkan ReorderableListView) — jangan
    // diteruskan lagi ke AppCard, nanti dua widget punya key yang sama.
    return AppCard(
      onTap: () => showPlanSheet(context, editing: plan),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (showHandle)
                ReorderableDragStartListener(
                  index: index,
                  child: Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Icon(
                      Icons.drag_indicator,
                      size: 18,
                      color: p.textMuted,
                    ),
                  ),
                ),
              Text(cat.icon, style: const TextStyle(fontSize: 16)),
              const SizedBox(width: 6),
              Expanded(
                child: Row(
                  children: [
                    Flexible(
                      child: Text(
                        cat.label,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: p.text,
                        ),
                      ),
                    ),
                    if (scope.isBoth) ...[
                      const SizedBox(width: 6),
                      CreatorBadge(by: plan.by, size: 16),
                    ],
                  ],
                ),
              ),
              Text(
                '${(ratio * 100).round()}%',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: barColor,
                ),
              ),
              InkWell(
                onTap: () async {
                  final ok = await confirmDialog(
                    context,
                    title: 'Hapus Rencana?',
                    message:
                        'Rencana ${cat.label} (${plan.period.label}) akan dihapus.',
                  );
                  if (ok) await store.deletePlan(plan);
                },
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                  child: Text('🗑️', style: TextStyle(fontSize: 13)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: ratio.clamp(0.0, 1.0),
              minHeight: 6,
              backgroundColor: p.surfaceAlt,
              valueColor: AlwaysStoppedAnimation(barColor),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '${formatCurrency(spent)} dari ${formatCurrency(plan.limit)}',
            style: TextStyle(fontSize: 12, color: p.textMuted),
          ),
        ],
      ),
    );
  }
}
