import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/app_palette.dart';
import '../core/app_theme.dart';
import '../core/users.dart';
import '../core/widgets/app_host.dart';
import '../core/widgets/app_shell.dart';
import '../core/widgets/settings_common.dart';
import '../core/widgets/ui.dart';
import 'routine_sheet.dart';
import 'store.dart';

/// Entry Routine App. Punya pengguna aktif (Iyon/Ciwul/Both) — rutinitas
/// sifatnya personal per orang, sama seperti Finance.
class RoutineApp extends StatelessWidget {
  const RoutineApp({super.key});

  @override
  Widget build(BuildContext context) {
    return AppHost<RoutineStore>(
      spec: AppSpecs.routine,
      createStore: RoutineStore.new,
      loadingEmojis: '🔁 ✅ 📅',
      userScopeKey: 'routineapp_user',
      builder: (context) => const _RoutineShell(),
    );
  }
}

class _RoutineShell extends StatefulWidget {
  const _RoutineShell();

  @override
  State<_RoutineShell> createState() => _RoutineShellState();
}

class _RoutineShellState extends State<_RoutineShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    return AppShell(
      title: 'Routine App',
      headerLeading: const HeaderUserIcon(),
      headerActions: const [ThemeToggleButton()],
      currentIndex: _index,
      onNavTap: (i) => setState(() => _index = i),
      onAddTap: () => showRoutineSheet(context),
      navItems: const [
        NavItem(icon: Icons.dashboard_outlined, label: 'Dashboard'),
        NavItem(icon: Icons.repeat, label: 'Rutinitas'),
        NavItem(icon: Icons.checklist_outlined, label: 'Cek'),
        NavItem(icon: Icons.settings_outlined, label: 'Pengaturan'),
      ],
      pages: [
        _DashboardPage(onSeeAll: () => setState(() => _index = 1)),
        const _RoutinesPage(),
        const _CheckPage(),
        const _SettingsPage(),
      ],
    );
  }
}

class _DashboardPage extends StatelessWidget {
  const _DashboardPage({required this.onSeeAll});

  final VoidCallback onSeeAll;

  @override
  Widget build(BuildContext context) {
    final store = context.watch<RoutineStore>();
    final scope = context.watch<UserScope>();
    final now = DateTime.now();

    final mine = store.visible(scope.canSee);

    // Angka hero = "belum dilakukan", bukan total — yang penting dilihat sekilas
    // itu sisa pekerjaan, bukan berapa banyak yang pernah dibuat.
    final todoToday = store
        .forToday(mine, now)
        .where((r) => !store.isDone(r, now))
        .length;
    final todoWeek = store
        .forPeriod(mine, RoutinePeriod.mingguan)
        .where((r) => !store.isDone(r, now))
        .length;

    final recent = [...mine]
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

    final counts = <RoutinePeriod, int>{};
    for (final period in RoutinePeriod.values) {
      final n = store.forPeriod(mine, period).length;
      if (n > 0) counts[period] = n;
    }

    return PageBody(
      children: [
        HeroStatCard(
          stats: [
            (label: 'Rutinitas', value: '${mine.length}'),
            (label: 'Belum hari ini', value: '$todoToday'),
            (label: 'Belum minggu ini', value: '$todoWeek'),
          ],
        ),
        const SizedBox(height: 22),
        SectionHeading(
          'Rutinitas Terbaru',
          actionLabel: 'Lihat Semua',
          onAction: onSeeAll,
        ),
        if (recent.isEmpty)
          const EmptyState(icon: '🔁', message: 'Belum ada rutinitas.')
        else
          for (final r in recent.take(4)) _RoutineTile(routine: r),
        if (counts.isNotEmpty) ...[
          const SizedBox(height: 14),
          const SectionHeading('Per Periode'),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final e in counts.entries)
                AppChip(
                  label: '${e.key.label} (${e.value})',
                  color: periodColor(context, e.key),
                  icon: e.key.defaultIcon,
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _RoutinesPage extends StatefulWidget {
  const _RoutinesPage();

  @override
  State<_RoutinesPage> createState() => _RoutinesPageState();
}

class _RoutinesPageState extends State<_RoutinesPage> {
  /// `null` = tab "Semua".
  RoutinePeriod? _period;

  @override
  Widget build(BuildContext context) {
    final store = context.watch<RoutineStore>();
    final scope = context.watch<UserScope>();

    final list = store
        .visible(scope.canSee)
        .where((r) => _period == null || r.period == _period)
        .toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

    return PageBody(
      children: [
        FilterTabs<RoutinePeriod?>(
          selected: _period,
          onSelected: (v) => setState(() => _period = v),
          tabs: [
            (value: null, label: 'Semua'),
            for (final period in RoutinePeriod.values)
              (value: period, label: period.label),
          ],
          activeColorOf: (period) => period == null
              ? context.palette.primary
              : periodColor(context, period),
        ),
        const SizedBox(height: 16),
        if (list.isEmpty)
          const EmptyState(
            icon: '🔁',
            message: 'Belum ada rutinitas di periode ini.',
          )
        else
          for (final r in list) _RoutineTile(routine: r),
      ],
    );
  }
}

class _RoutineTile extends StatelessWidget {
  const _RoutineTile({required this.routine});

  final Routine routine;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final scope = context.watch<UserScope>();
    final color = periodColor(context, routine.period);

    return AppCard(
      onTap: () => showRoutineDetail(context, routine),
      child: Row(
        children: [
          CategoryIcon(
            emoji: routine.displayIcon,
            color: color,
            by: scope.isBoth ? routine.by : null,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              routine.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontWeight: FontWeight.w600, color: p.text),
            ),
          ),
          const SizedBox(width: 8),
          AppChip(label: routine.periodLabel(), color: color),
        ],
      ),
    );
  }
}

/// Cek Rutinitas — checklist periode berjalan, dibagi 3 grup.
class _CheckPage extends StatelessWidget {
  const _CheckPage();

  @override
  Widget build(BuildContext context) {
    final store = context.watch<RoutineStore>();
    final scope = context.watch<UserScope>();
    final now = DateTime.now();
    final mine = store.visible(scope.canSee);

    return PageBody(
      children: [
        _CheckSection(
          title: 'Hari Ini',
          routines: store.forToday(mine, now),
          now: now,
        ),
        _CheckSection(
          title: 'Minggu Ini',
          routines: store.forPeriod(mine, RoutinePeriod.mingguan),
          now: now,
        ),
        _CheckSection(
          title: 'Bulan Ini',
          routines: store.forPeriod(mine, RoutinePeriod.bulanan),
          now: now,
        ),
      ],
    );
  }
}

class _CheckSection extends StatelessWidget {
  const _CheckSection({
    required this.title,
    required this.routines,
    required this.now,
  });

  final String title;
  final List<Routine> routines;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final store = context.watch<RoutineStore>();
    final scope = context.watch<UserScope>();

    // Yang sudah dicek turun ke bawah.
    final sorted = [...routines]..sort((a, b) {
        final aDone = store.isDone(a, now);
        final bDone = store.isDone(b, now);
        if (aDone != bDone) return aDone ? 1 : -1;
        return a.createdAt.compareTo(b.createdAt);
      });

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionHeading(title),
        if (sorted.isEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 18),
            child: Text(
              'Tidak ada rutinitas.',
              style: TextStyle(fontSize: 12.5, color: p.textMuted),
            ),
          )
        else
          for (final r in sorted) _buildItem(context, store, scope, r),
        const SizedBox(height: 14),
      ],
    );
  }

  Widget _buildItem(
    BuildContext context,
    RoutineStore store,
    UserScope scope,
    Routine r,
  ) {
    final p = context.palette;
    final done = store.isDone(r, now);

    return AppCard(
      // Klik di mana pun di item → toggle. Langsung tulis Firebase, tanpa
      // konfirmasi (low-stakes, gampang di-uncheck lagi).
      onTap: () => store.toggleCompletion(r, now, !done),
      child: Row(
        children: [
          Icon(
            done ? Icons.check_circle : Icons.radio_button_unchecked,
            color: done ? p.done : p.textMuted,
          ),
          const SizedBox(width: 12),
          Text(r.displayIcon, style: const TextStyle(fontSize: 16)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              r.name,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: done ? p.textMuted : p.text,
                decoration: done ? TextDecoration.lineThrough : null,
              ),
            ),
          ),
          if (scope.isBoth) CreatorBadge(by: r.by, size: 18),
        ],
      ),
    );
  }
}

class _SettingsPage extends StatelessWidget {
  const _SettingsPage();

  @override
  Widget build(BuildContext context) {
    return const PageBody(
      children: [
        // Pengguna Aktif sengaja paling atas (beda dari Kitchen/Finance yang
        // menaruh tema duluan) — di app ini siapa yang aktif lebih penting.
        ActiveUserCard(),
        ThemeSettingsCard(),
        HubSettingsCard(),
        AboutSettingsCard(
          appName: 'Routine App',
          text: 'Catat & cek rutinitas harian, mingguan, bulanan. Data '
              'tersimpan realtime di Firebase, dipakai bareng dengan versi web '
              'di iyonadryan.github.io/app/routine.',
        ),
      ],
    );
  }
}
