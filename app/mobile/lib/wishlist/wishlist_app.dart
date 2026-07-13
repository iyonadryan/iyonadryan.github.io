import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/app_palette.dart';
import '../core/app_theme.dart';
import '../core/category.dart';
import '../core/formatters.dart';
import '../core/widgets/app_host.dart';
import '../core/widgets/app_shell.dart';
import '../core/widgets/category_sheet.dart';
import '../core/widgets/settings_common.dart';
import '../core/widgets/ui.dart';
import 'store.dart';
import 'wishlist_sheet.dart';

/// Entry Wishlist App. Pola atribusi murni seperti Note App — **tidak ada
/// pengguna aktif**. (App ini sempat punya, lalu sengaja dilepas lagi.)
class WishlistApp extends StatelessWidget {
  const WishlistApp({super.key});

  @override
  Widget build(BuildContext context) {
    return AppHost<WishlistStore>(
      spec: AppSpecs.wishlist,
      createStore: WishlistStore.new,
      loadingEmojis: '🎁 ✨ 🛍️',
      builder: (context) => const _WishlistShell(),
    );
  }
}

class _WishlistShell extends StatefulWidget {
  const _WishlistShell();

  @override
  State<_WishlistShell> createState() => _WishlistShellState();
}

class _WishlistShellState extends State<_WishlistShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    return AppShell(
      title: 'Wishlist App',
      headerActions: const [ThemeToggleButton()],
      currentIndex: _index,
      onNavTap: (i) => setState(() => _index = i),
      onAddTap: () => showWishlistSheet(context),
      navItems: const [
        NavItem(icon: Icons.dashboard_outlined, label: 'Dashboard'),
        NavItem(icon: Icons.card_giftcard, label: 'Wishlist'),
        NavItem(icon: Icons.emoji_events_outlined, label: 'Tercapai'),
        NavItem(icon: Icons.settings_outlined, label: 'Pengaturan'),
      ],
      pages: [
        _DashboardPage(onSeeAll: () => setState(() => _index = 1)),
        const _WishlistPage(),
        const _AchievedPage(),
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
    final p = context.palette;
    final store = context.watch<WishlistStore>();

    final recent = [...store.active]
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));

    // Kategori dihitung dari SEMUA item (aktif maupun tercapai).
    final counts = <Category, int>{};
    for (final c in store.categories) {
      final n = store.itemCountForCategory(c.id);
      if (n > 0) counts[c] = n;
    }

    return PageBody(
      children: [
        HeroStatCard(
          stats: [
            (label: 'Aktif', value: '${store.active.length}'),
            (label: 'Kategori', value: '${store.categories.length}'),
            (label: 'Tercapai', value: '${store.achieved.length}'),
          ],
        ),
        const SizedBox(height: 22),
        SectionHeading(
          'Wishlist Terbaru',
          actionLabel: 'Lihat Semua',
          onAction: onSeeAll,
        ),
        if (recent.isEmpty)
          const EmptyState(icon: '🎁', message: 'Belum ada wishlist aktif.')
        else
          for (final i in recent.take(4)) _WishlistTile(item: i),
        if (counts.isNotEmpty) ...[
          const SizedBox(height: 14),
          const SectionHeading('Kategori'),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final e in counts.entries)
                AppChip(
                  label: '${e.key.label} (${e.value})',
                  color: p.seriesSlot(e.key.colorSlot),
                  icon: e.key.icon,
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _WishlistPage extends StatefulWidget {
  const _WishlistPage();

  @override
  State<_WishlistPage> createState() => _WishlistPageState();
}

class _WishlistPageState extends State<_WishlistPage> {
  String _search = '';
  String? _category;
  Priority? _priority;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final store = context.watch<WishlistStore>();

    // Tiga filter beririsan (AND): kategori + prioritas + search.
    final filtered = store.sortByPriorityThenDate(
      store.active.where((i) {
        final q = _search.toLowerCase();
        final matchSearch = q.isEmpty ||
            i.title.toLowerCase().contains(q) ||
            i.description.toLowerCase().contains(q);
        final matchCategory = _category == null || i.category == _category;
        final matchPriority = _priority == null || i.priority == _priority;
        return matchSearch && matchCategory && matchPriority;
      }).toList(),
    );

    // Total dihitung ulang tiap render dari item yang lolos filter — otomatis
    // ikut berubah tiap filter/search diganti, tanpa listener terpisah.
    final total = filtered.fold<double>(0, (s, i) => s + i.price);

    return PageBody(
      children: [
        TextField(
          decoration: const InputDecoration(
            hintText: 'Cari judul atau deskripsi…',
            prefixIcon: Icon(Icons.search),
          ),
          onChanged: (v) => setState(() => _search = v),
        ),
        const SizedBox(height: 14),
        FilterTabs<String?>(
          label: 'Kategori',
          selected: _category,
          onSelected: (v) => setState(() => _category = v),
          tabs: [
            (value: null, label: 'Semua'),
            for (final c in store.categories) (value: c.id, label: c.label),
          ],
        ),
        const SizedBox(height: 12),
        FilterTabs<Priority?>(
          label: 'Prioritas',
          selected: _priority,
          onSelected: (v) => setState(() => _priority = v),
          tabs: [
            (value: null, label: 'Semua'),
            for (final pr in Priority.values) (value: pr, label: pr.label),
          ],
          activeColorOf: (pr) =>
              pr == null ? p.primary : priorityColor(context, pr),
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: p.surfaceAlt,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: p.border),
          ),
          child: Row(
            children: [
              Text(
                'TOTAL',
                style: TextStyle(
                  fontSize: 10.5,
                  letterSpacing: 0.8,
                  fontWeight: FontWeight.w700,
                  color: p.textMuted,
                ),
              ),
              const Spacer(),
              Text(
                formatCurrency(total),
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: p.primary,
                ),
              ),
            ],
          ),
        ),
        if (filtered.isEmpty)
          const EmptyState(icon: '🔍', message: 'Tidak ada item yang cocok.')
        else
          for (final i in filtered) _WishlistTile(item: i),
      ],
    );
  }
}

/// Tercapai — halaman terpisah (bukan filter): riwayat wishlist yang sudah
/// kesampaian, permintaan eksplisit user ("tetap tersimpan sbg riwayat").
class _AchievedPage extends StatelessWidget {
  const _AchievedPage();

  @override
  Widget build(BuildContext context) {
    final store = context.watch<WishlistStore>();
    final list = store.achieved;

    return PageBody(
      children: [
        const SectionHeading('Sudah Tercapai'),
        if (list.isEmpty)
          const EmptyState(
            icon: '🏆',
            message: 'Belum ada wishlist yang tercapai.',
          )
        else
          for (final i in list) _WishlistTile(item: i),
      ],
    );
  }
}

class _WishlistTile extends StatelessWidget {
  const _WishlistTile({required this.item});

  final WishlistItem item;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final store = context.watch<WishlistStore>();
    final cat = findCategory(store.categories, item.category);
    final color = p.seriesSlot(cat.colorSlot);

    return AppCard(
      onTap: () => showWishlistDetail(context, item.id),
      child: Row(
        children: [
          // Badge pembuat selalu tampil — atribusi murni, tidak ada mode lain.
          CategoryIcon(emoji: cat.icon, color: color, by: item.by),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: p.text,
                    decoration:
                        item.achieved ? TextDecoration.lineThrough : null,
                  ),
                ),
                const SizedBox(height: 3),
                // Baris 2: harga (tebal, warna primary) + cuplikan deskripsi.
                RichText(
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  text: TextSpan(
                    children: [
                      TextSpan(
                        text: formatCurrency(item.price),
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: p.primary,
                        ),
                      ),
                      if (item.description.isNotEmpty)
                        TextSpan(
                          text: ' - ${snippet(item.description)}',
                          style: TextStyle(fontSize: 12, color: p.textMuted),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          // Dua badge ditumpuk vertikal: kategori + prioritas.
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              AppChip(label: cat.label, color: color),
              const SizedBox(height: 4),
              AppChip(
                label: item.priority.label,
                color: priorityColor(context, item.priority),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SettingsPage extends StatelessWidget {
  const _SettingsPage();

  @override
  Widget build(BuildContext context) {
    final store = context.watch<WishlistStore>();

    return PageBody(
      children: [
        const ThemeSettingsCard(),
        SettingsCard(
          title: 'Kategori Wishlist',
          subtitle: '${store.categories.length} kategori',
          child: SecondaryButton(
            label: 'Kelola Kategori',
            onPressed: () => showCategoriesSheet(
              context,
              owner: store,
              refreshOn: store,
              title: 'Kategori Wishlist',
              deleteWarning:
                  'Item lama tetap tersimpan, tapi akan tampil sebagai '
                  '"Tanpa Kategori".',
            ),
          ),
        ),
        const HubSettingsCard(),
        const AboutSettingsCard(
          appName: 'Wishlist App',
          text: 'Daftar keinginan dengan kategori & prioritas. Item yang sudah '
              'didapat pindah ke halaman Tercapai sebagai riwayat. Data '
              'tersimpan realtime di Firebase, dipakai bareng dengan versi web '
              'di iyonadryan.github.io/app/wishlist.',
        ),
      ],
    );
  }
}
