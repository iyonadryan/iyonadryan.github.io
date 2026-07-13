import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/app_palette.dart';
import '../core/app_theme.dart';
import '../core/formatters.dart';
import '../core/widgets/app_host.dart';
import '../core/widgets/app_shell.dart';
import '../core/widgets/settings_common.dart';
import '../core/widgets/ui.dart';
import 'store.dart';
import 'trip_detail.dart';

/// Entry Patungan App. **Tidak ada pengguna aktif Iyon/Ciwul** — "multi-orang"
/// di app ini justru fitur intinya sendiri (peserta per trip, bebas siapa &
/// berapa banyak), jadi user-switching device-level malah membingungkan.
class PatunganApp extends StatelessWidget {
  const PatunganApp({super.key});

  @override
  Widget build(BuildContext context) {
    return AppHost<PatunganStore>(
      spec: AppSpecs.patungan,
      createStore: PatunganStore.new,
      loadingEmojis: '🧾 💸 🤝',
      builder: (context) => const _PatunganShell(),
    );
  }
}

class _PatunganShell extends StatefulWidget {
  const _PatunganShell();

  @override
  State<_PatunganShell> createState() => _PatunganShellState();
}

class _PatunganShellState extends State<_PatunganShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    return AppShell(
      title: 'Patungan App',
      headerActions: const [ThemeToggleButton()],
      currentIndex: _index,
      onNavTap: (i) => setState(() => _index = i),
      onAddTap: () => showTripSheet(context),
      navItems: const [
        NavItem(icon: Icons.dashboard_outlined, label: 'Dashboard'),
        NavItem(icon: Icons.luggage_outlined, label: 'Trip'),
        NavItem(icon: Icons.history, label: 'Riwayat'),
        NavItem(icon: Icons.settings_outlined, label: 'Pengaturan'),
      ],
      pages: [
        _DashboardPage(onSeeAll: () => setState(() => _index = 1)),
        const _TripsPage(),
        const _HistoryPage(),
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
    final store = context.watch<PatunganStore>();

    return PageBody(
      children: [
        HeroStatCard(
          stats: [
            (label: 'Trip', value: '${store.trips.length}'),
            (label: 'Nota', value: '${store.totalExpenses}'),
            (label: 'Total', value: formatCurrency(store.totalAmount)),
          ],
        ),
        const SizedBox(height: 22),
        SectionHeading(
          'Trip Terbaru',
          actionLabel: 'Lihat Semua',
          onAction: onSeeAll,
        ),
        if (store.trips.isEmpty)
          const EmptyState(icon: '🧳', message: 'Belum ada trip.')
        else
          for (final t in store.trips.take(4)) _TripTile(trip: t),
      ],
    );
  }
}

class _TripsPage extends StatelessWidget {
  const _TripsPage();

  @override
  Widget build(BuildContext context) {
    final store = context.watch<PatunganStore>();

    return PageBody(
      children: [
        if (store.trips.isEmpty)
          const EmptyState(
            icon: '🧳',
            message: 'Belum ada trip. Tekan + untuk membuat yang pertama.',
          )
        else
          for (final t in store.trips) _TripTile(trip: t),
      ],
    );
  }
}

class _TripTile extends StatelessWidget {
  const _TripTile({required this.trip});

  final Trip trip;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    return AppCard(
      onTap: () => showTripDetail(context, trip.id),
      child: Row(
        children: [
          CategoryIcon(emoji: '🧳', color: p.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  trip.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: p.text,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  '${trip.participants.length} peserta · '
                  '${trip.expenses.length} nota',
                  style: TextStyle(fontSize: 11.5, color: p.textMuted),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            formatCurrency(trip.total),
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: p.primary,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}

/// Riwayat — semua nota lintas semua trip, urut terbaru, tiap item diberi badge
/// nama trip asalnya. Berguna untuk lihat cepat tanpa buka satu-satu trip.
class _HistoryPage extends StatelessWidget {
  const _HistoryPage();

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final store = context.watch<PatunganStore>();

    final all = <({Trip trip, Expense expense})>[
      for (final t in store.trips)
        for (final e in t.expenses) (trip: t, expense: e),
    ]..sort((a, b) => b.expense.createdAt.compareTo(a.expense.createdAt));

    return PageBody(
      children: [
        if (all.isEmpty)
          const EmptyState(icon: '📜', message: 'Belum ada nota tercatat.')
        else
          for (final item in all)
            AppCard(
              onTap: () => showTripDetail(context, item.trip.id),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.expense.description,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: p.text,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            AppChip(label: item.trip.name, color: p.primary),
                            const SizedBox(width: 8),
                            Flexible(
                              child: Text(
                                'Dibayar '
                                '${item.trip.nameOf(item.expense.paidBy)}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 11.5,
                                  color: p.textMuted,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    formatCurrency(item.expense.amount),
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: p.primary,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
      ],
    );
  }
}

class _SettingsPage extends StatelessWidget {
  const _SettingsPage();

  @override
  Widget build(BuildContext context) {
    return const PageBody(
      children: [
        ThemeSettingsCard(),
        HubSettingsCard(),
        AboutSettingsCard(
          appName: 'Patungan App',
          text: 'Bagi biaya nota rame-rame, tau siapa utang ke siapa. Split '
              'selalu rata antar peserta yang dipilih. Data tersimpan realtime '
              'di Firebase, dipakai bareng dengan versi web di '
              'iyonadryan.github.io/app/patungan.',
        ),
      ],
    );
  }
}
