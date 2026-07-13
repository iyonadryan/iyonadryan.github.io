import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/app_palette.dart';
import '../core/app_theme.dart';
import '../core/category.dart';
import '../core/widgets/app_host.dart';
import '../core/widgets/app_shell.dart';
import '../core/widgets/category_sheet.dart';
import '../core/widgets/settings_common.dart';
import '../core/widgets/ui.dart';
import 'recipe_sheet.dart';
import 'store.dart';

/// Entry Kitchen App. **Tidak ada pengguna aktif** — app ini dianggap dipakai
/// satu rumah tangga, jadi tidak ada field `by` maupun scoping tampilan.
class KitchenApp extends StatelessWidget {
  const KitchenApp({super.key});

  @override
  Widget build(BuildContext context) {
    return AppHost<KitchenStore>(
      spec: AppSpecs.kitchen,
      createStore: KitchenStore.new,
      loadingEmojis: '🍳 🥕 🍅',
      builder: (context) => const _KitchenShell(),
    );
  }
}

class _KitchenShell extends StatefulWidget {
  const _KitchenShell();

  @override
  State<_KitchenShell> createState() => _KitchenShellState();
}

class _KitchenShellState extends State<_KitchenShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    return AppShell(
      title: 'Kitchen App',
      headerActions: const [ThemeToggleButton()],
      currentIndex: _index,
      onNavTap: (i) => setState(() => _index = i),
      onAddTap: () => showRecipeSheet(context),
      navItems: const [
        NavItem(icon: Icons.dashboard_outlined, label: 'Dashboard'),
        NavItem(icon: Icons.menu_book_outlined, label: 'Resep'),
        NavItem(icon: Icons.shopping_cart_outlined, label: 'Belanja'),
        NavItem(icon: Icons.settings_outlined, label: 'Pengaturan'),
      ],
      pages: [
        _DashboardPage(onSeeAllRecipes: () => setState(() => _index = 1)),
        const _RecipesPage(),
        const _ShoppingPage(),
        const _SettingsPage(),
      ],
    );
  }
}

class _DashboardPage extends StatelessWidget {
  const _DashboardPage({required this.onSeeAllRecipes});

  final VoidCallback onSeeAllRecipes;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final store = context.watch<KitchenStore>();

    final recent = [...store.recipes]
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

    // Kategori dengan 0 resep disembunyikan dari breakdown, tapi tetap muncul
    // sebagai tab filter di halaman Resep.
    final counts = <Category, int>{};
    for (final c in store.categories) {
      final n = store.itemCountForCategory(c.id);
      if (n > 0) counts[c] = n;
    }

    return PageBody(
      children: [
        HeroStatCard(
          stats: [
            (label: 'Resep', value: '${store.recipes.length}'),
            (label: 'Kategori', value: '${store.categories.length}'),
            (label: 'Belanja', value: '${store.pendingShoppingCount}'),
          ],
        ),
        const SizedBox(height: 22),
        SectionHeading(
          'Resep Terbaru',
          actionLabel: 'Lihat Semua',
          onAction: onSeeAllRecipes,
        ),
        if (recent.isEmpty)
          const EmptyState(icon: '🍳', message: 'Belum ada resep tersimpan.')
        else
          for (final r in recent.take(4)) _RecipeTile(recipe: r),
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

class _RecipesPage extends StatefulWidget {
  const _RecipesPage();

  @override
  State<_RecipesPage> createState() => _RecipesPageState();
}

class _RecipesPageState extends State<_RecipesPage> {
  String _search = '';

  /// `null` = tab "Semua".
  String? _category;

  @override
  Widget build(BuildContext context) {
    final store = context.watch<KitchenStore>();

    // Search & filter kategori beririsan (AND, bukan OR).
    final filtered = store.recipes.where((r) {
      final matchSearch = _search.isEmpty ||
          r.name.toLowerCase().contains(_search.toLowerCase());
      final matchCategory = _category == null || r.category == _category;
      return matchSearch && matchCategory;
    }).toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

    return PageBody(
      children: [
        TextField(
          decoration: const InputDecoration(
            hintText: 'Cari resep…',
            prefixIcon: Icon(Icons.search),
          ),
          onChanged: (v) => setState(() => _search = v),
        ),
        const SizedBox(height: 14),
        FilterTabs<String?>(
          selected: _category,
          onSelected: (v) => setState(() => _category = v),
          tabs: [
            (value: null, label: 'Semua'),
            for (final c in store.categories) (value: c.id, label: c.label),
          ],
        ),
        const SizedBox(height: 16),
        if (filtered.isEmpty)
          const EmptyState(icon: '🔍', message: 'Tidak ada resep yang cocok.')
        else
          for (final r in filtered) _RecipeTile(recipe: r),
      ],
    );
  }
}

class _RecipeTile extends StatelessWidget {
  const _RecipeTile({required this.recipe});

  final Recipe recipe;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final store = context.watch<KitchenStore>();
    final cat = findCategory(store.categories, recipe.category);
    final color = p.seriesSlot(cat.colorSlot);

    return AppCard(
      onTap: () => showRecipeDetail(context, recipe),
      child: Row(
        children: [
          CategoryIcon(emoji: cat.icon, color: color),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  recipe.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: p.text,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  [
                    if (recipe.servings.isNotEmpty) '🍽️ ${recipe.servings}',
                    if (recipe.time.isNotEmpty) '⏱️ ${recipe.time}',
                    '${recipe.ingredients.length} bahan',
                  ].join(' · '),
                  style: TextStyle(fontSize: 11.5, color: p.textMuted),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          AppChip(label: cat.label, color: color),
        ],
      ),
    );
  }
}

class _ShoppingPage extends StatelessWidget {
  const _ShoppingPage();

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final store = context.watch<KitchenStore>();

    // Item yang sudah dicentang turun ke bawah list.
    final items = [...store.shopping]..sort((a, b) {
        if (a.done != b.done) return a.done ? 1 : -1;
        return a.createdAt.compareTo(b.createdAt);
      });

    final hasDone = store.shopping.any((s) => s.done);

    return PageBody(
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Daftar Belanja',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: p.text,
                ),
              ),
            ),
            AccentIconButton(
              icon: Icons.add,
              onPressed: () => _showShoppingSheet(context),
            ),
          ],
        ),
        const SizedBox(height: 14),
        if (items.isEmpty)
          const EmptyState(
            icon: '🛒',
            message: 'Belum ada bahan yang perlu dibeli.',
          )
        else
          for (final item in items)
            AppCard(
              // Toggle centang langsung tulis Firebase, tanpa konfirmasi.
              onTap: () => store.toggleShoppingItem(item),
              child: Row(
                children: [
                  Icon(
                    item.done
                        ? Icons.check_circle
                        : Icons.radio_button_unchecked,
                    color: item.done ? p.done : p.textMuted,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.name,
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: item.done ? p.textMuted : p.text,
                            decoration: item.done
                                ? TextDecoration.lineThrough
                                : null,
                          ),
                        ),
                        if (item.qty.isNotEmpty)
                          Text(
                            item.qty,
                            style:
                                TextStyle(fontSize: 12, color: p.textMuted),
                          ),
                      ],
                    ),
                  ),
                  // Hapus item belanja langsung tanpa konfirmasi — gampang
                  // ditambah ulang, beda dari hapus resep/kategori.
                  IconButton(
                    icon: const Text('🗑️', style: TextStyle(fontSize: 14)),
                    onPressed: () => store.deleteShoppingItem(item.id),
                  ),
                ],
              ),
            ),
        if (hasDone) ...[
          const SizedBox(height: 8),
          SecondaryButton(
            label: 'Hapus yang sudah dicentang',
            onPressed: store.clearDoneShopping,
          ),
        ],
      ],
    );
  }
}

Future<void> _showShoppingSheet(BuildContext context) {
  final name = TextEditingController();
  final qty = TextEditingController();

  return showAppSheet<void>(
    context: context,
    title: 'Tambah Belanja',
    builder: (ctx) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldBox(
          label: 'Nama Bahan',
          child: TextField(
            controller: name,
            autofocus: true,
            decoration: const InputDecoration(hintText: 'mis. Bawang Merah'),
          ),
        ),
        FieldBox(
          label: 'Jumlah (opsional)',
          child: TextField(
            controller: qty,
            decoration: const InputDecoration(hintText: 'mis. 1/4 kg'),
          ),
        ),
        const SizedBox(height: 4),
        GradientButton(
          label: 'Tambah',
          onPressed: () async {
            if (name.text.trim().isEmpty) return;
            final now = DateTime.now().millisecondsSinceEpoch;
            await ctx.read<KitchenStore>().addShoppingItem(
                  ShoppingItem(
                    id: '$now',
                    name: name.text.trim(),
                    qty: qty.text.trim(),
                    done: false,
                    createdAt: now,
                  ),
                );
            if (ctx.mounted) Navigator.pop(ctx);
          },
        ),
      ],
    ),
  );
}

class _SettingsPage extends StatelessWidget {
  const _SettingsPage();

  @override
  Widget build(BuildContext context) {
    final store = context.watch<KitchenStore>();

    return PageBody(
      children: [
        const ThemeSettingsCard(),
        SettingsCard(
          title: 'Kategori Resep',
          subtitle: '${store.categories.length} kategori',
          child: SecondaryButton(
            label: 'Kelola Kategori',
            onPressed: () => showCategoriesSheet(
              context,
              owner: store,
              refreshOn: store,
              title: 'Kategori Resep',
              deleteWarning:
                  'Resep lama tetap tersimpan, tapi akan tampil sebagai '
                  '"Tanpa Kategori".',
            ),
          ),
        ),
        const HubSettingsCard(),
        const AboutSettingsCard(
          appName: 'Kitchen App',
          text: 'Catatan resep & daftar belanja dapur. Data tersimpan realtime '
              'di Firebase, dipakai bareng dengan versi web di '
              'iyonadryan.github.io/app/kitchen.',
        ),
      ],
    );
  }
}
