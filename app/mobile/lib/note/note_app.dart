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
import 'note_sheet.dart';
import 'store.dart';

/// Entry Note App. **Tidak ada pengguna aktif** — field `by` di sini murni
/// atribusi ("siapa yang nulis"), tidak pernah menyembunyikan catatan siapa pun.
class NoteApp extends StatelessWidget {
  const NoteApp({super.key});

  @override
  Widget build(BuildContext context) {
    return AppHost<NoteStore>(
      spec: AppSpecs.note,
      createStore: NoteStore.new,
      loadingEmojis: '📝 💡 ⏰',
      builder: (context) => const _NoteShell(),
    );
  }
}

class _NoteShell extends StatefulWidget {
  const _NoteShell();

  @override
  State<_NoteShell> createState() => _NoteShellState();
}

class _NoteShellState extends State<_NoteShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    return AppShell(
      title: 'Note App',
      headerActions: const [ThemeToggleButton()],
      currentIndex: _index,
      onNavTap: (i) => setState(() => _index = i),
      onAddTap: () => showNoteSheet(context),
      navItems: const [
        NavItem(icon: Icons.dashboard_outlined, label: 'Dashboard'),
        NavItem(icon: Icons.sticky_note_2_outlined, label: 'Catatan'),
        NavItem(icon: Icons.push_pin_outlined, label: 'Tersemat'),
        NavItem(icon: Icons.settings_outlined, label: 'Pengaturan'),
      ],
      pages: [
        _DashboardPage(onSeeAll: () => setState(() => _index = 1)),
        const _NotesPage(),
        const _PinnedPage(),
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
    final store = context.watch<NoteStore>();

    final counts = <Category, int>{};
    for (final c in store.categories) {
      final n = store.itemCountForCategory(c.id);
      if (n > 0) counts[c] = n;
    }

    return PageBody(
      children: [
        HeroStatCard(
          stats: [
            (label: 'Catatan', value: '${store.notes.length}'),
            (label: 'Kategori', value: '${store.categories.length}'),
            (label: 'Tersemat', value: '${store.pinned.length}'),
          ],
        ),
        const SizedBox(height: 22),
        SectionHeading(
          'Catatan Terbaru',
          actionLabel: 'Lihat Semua',
          onAction: onSeeAll,
        ),
        if (store.notes.isEmpty)
          const EmptyState(icon: '📝', message: 'Belum ada catatan.')
        else
          for (final n in store.byRecent.take(4)) NoteTile(note: n),
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

class _NotesPage extends StatefulWidget {
  const _NotesPage();

  @override
  State<_NotesPage> createState() => _NotesPageState();
}

class _NotesPageState extends State<_NotesPage> {
  String _search = '';
  String? _category;

  @override
  Widget build(BuildContext context) {
    final store = context.watch<NoteStore>();

    final filtered = store.byRecent.where((n) {
      // Search mencari di judul MAUPUN isi.
      final q = _search.toLowerCase();
      final matchSearch = q.isEmpty ||
          n.title.toLowerCase().contains(q) ||
          n.content.toLowerCase().contains(q);
      final matchCategory = _category == null || n.category == _category;
      return matchSearch && matchCategory;
    }).toList();

    return PageBody(
      children: [
        TextField(
          decoration: const InputDecoration(
            hintText: 'Cari judul atau isi catatan…',
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
          const EmptyState(icon: '🔍', message: 'Tidak ada catatan yang cocok.')
        else
          for (final n in filtered) NoteTile(note: n),
      ],
    );
  }
}

/// Tersemat — halaman terpisah (bukan sekadar filter) supaya catatan penting
/// selalu 1 tap dari bottom nav. Ini yang menjawab kebutuhan "akses dengan
/// mudah".
class _PinnedPage extends StatelessWidget {
  const _PinnedPage();

  @override
  Widget build(BuildContext context) {
    final store = context.watch<NoteStore>();
    final pinned = store.pinned;

    return PageBody(
      children: [
        const SectionHeading('Catatan Tersemat'),
        if (pinned.isEmpty)
          const EmptyState(
            icon: '📌',
            message: 'Belum ada catatan yang disematkan.',
          )
        else
          for (final n in pinned) NoteTile(note: n),
      ],
    );
  }
}

class NoteTile extends StatelessWidget {
  const NoteTile({super.key, required this.note});

  final Note note;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final store = context.watch<NoteStore>();
    final cat = findCategory(store.categories, note.category);
    final color = p.seriesSlot(cat.colorSlot);

    return AppCard(
      onTap: () => showNoteDetail(context, note.id),
      child: Row(
        children: [
          // Badge pembuat SELALU tampil (tidak dikondisikan mode apa pun) —
          // Note App tidak punya mode lain, atribusi selalu relevan.
          CategoryIcon(emoji: cat.icon, color: color, by: note.by),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        note.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: p.text,
                        ),
                      ),
                    ),
                    if (note.pinned)
                      const Padding(
                        padding: EdgeInsets.only(left: 6),
                        child: Text('📌', style: TextStyle(fontSize: 12)),
                      ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  // Kartu list menampilkan cuplikan markdown mentah apa adanya
                  // — render markdown cuma di popup detail.
                  snippet(note.content),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, color: p.textMuted),
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

class _SettingsPage extends StatelessWidget {
  const _SettingsPage();

  @override
  Widget build(BuildContext context) {
    final store = context.watch<NoteStore>();

    return PageBody(
      children: [
        const ThemeSettingsCard(),
        SettingsCard(
          title: 'Kategori Catatan',
          subtitle: '${store.categories.length} kategori',
          child: SecondaryButton(
            label: 'Kelola Kategori',
            onPressed: () => showCategoriesSheet(
              context,
              owner: store,
              refreshOn: store,
              title: 'Kategori Catatan',
              deleteWarning:
                  'Catatan lama tetap tersimpan, tapi akan tampil sebagai '
                  '"Tanpa Kategori".',
            ),
          ),
        ),
        const HubSettingsCard(),
        const AboutSettingsCard(
          appName: 'Note App',
          text: 'Catatan aktivitas, reminder, & inspirasi. Isi catatan '
              'mendukung markdown. Data tersimpan realtime di Firebase, dipakai '
              'bareng dengan versi web di iyonadryan.github.io/app/note.',
        ),
      ],
    );
  }
}
