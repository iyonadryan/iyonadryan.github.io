import 'package:flutter/material.dart';

import '../app_theme.dart';
import '../category.dart';
import '../formatters.dart';
import 'ui.dart';

/// Popup CRUD kategori (`#categoriesModal`) — dipakai **identik** oleh Kitchen,
/// Note, dan Wishlist App. Di versi web tiap app punya salinan kode & CSS-nya
/// sendiri; di sini satu komponen dipakai bertiga.
///
/// Finance App punya versinya sendiri (dua list expense/income, id diketik
/// manual) — lihat `lib/finance/pages/settings_page.dart`.
Future<void> showCategoriesSheet(
  BuildContext context, {
  required CategoryOwner owner,
  required Listenable refreshOn,
  required String title,
  required String deleteWarning,
}) {
  return showAppSheet<void>(
    context: context,
    title: title,
    builder: (ctx) => ListenableBuilder(
      // Store adalah listener realtime Firebase — list ini ikut ter-update
      // kalau kategori berubah dari device lain saat sheet masih terbuka.
      listenable: refreshOn,
      builder: (ctx2, _) => _CategoryList(
        owner: owner,
        deleteWarning: deleteWarning,
      ),
    ),
  );
}

class _CategoryList extends StatelessWidget {
  const _CategoryList({required this.owner, required this.deleteWarning});

  final CategoryOwner owner;
  final String deleteWarning;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    // Urutan tampil di popup ini disortir A-Z by label (cuma untuk render —
    // tidak mengubah urutan aslinya), dengan "Lainnya" didorong ke paling akhir.
    final sorted = [...owner.categories]..sort((a, b) {
        final aLast = a.id == 'lainnya';
        final bLast = b.id == 'lainnya';
        if (aLast != bLast) return aLast ? 1 : -1;
        return a.label.toLowerCase().compareTo(b.label.toLowerCase());
      });

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final c in sorted)
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: p.surfaceAlt,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: p.border),
            ),
            child: Row(
              children: [
                Container(
                  width: 16,
                  height: 16,
                  decoration: BoxDecoration(
                    color: p.seriesSlot(c.colorSlot),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 10),
                Text(c.icon, style: const TextStyle(fontSize: 18)),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        c.label,
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: p.text,
                        ),
                      ),
                      Text(
                        c.id,
                        style: TextStyle(fontSize: 11, color: p.textMuted),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Text('✏️', style: TextStyle(fontSize: 15)),
                  onPressed: () => _openForm(context, owner, existing: c),
                ),
                IconButton(
                  icon: const Text('🗑️', style: TextStyle(fontSize: 15)),
                  onPressed: () => _confirmDelete(context, owner, c),
                ),
              ],
            ),
          ),
        const SizedBox(height: 6),
        SecondaryButton(
          label: '+ Buat Kategori Baru',
          invert: true,
          onPressed: () => _openForm(context, owner),
        ),
      ],
    );
  }

  Future<void> _confirmDelete(
    BuildContext context,
    CategoryOwner owner,
    Category c,
  ) async {
    final used = owner.itemCountForCategory(c.id);
    final ok = await confirmDialog(
      context,
      title: 'Hapus Kategori?',
      message: used == 0
          ? 'Kategori "${c.label}" akan dihapus.'
          : '$used item masih memakai kategori "${c.label}". $deleteWarning',
    );
    if (ok) await owner.deleteCategory(c.id);
  }
}

Future<void> _openForm(
  BuildContext context,
  CategoryOwner owner, {
  Category? existing,
}) {
  return showAppSheet<void>(
    context: context,
    title: existing == null ? 'Kategori Baru' : 'Ubah Kategori',
    builder: (ctx) => _CategoryForm(owner: owner, existing: existing),
  );
}

class _CategoryForm extends StatefulWidget {
  const _CategoryForm({required this.owner, this.existing});

  final CategoryOwner owner;
  final Category? existing;

  @override
  State<_CategoryForm> createState() => _CategoryFormState();
}

class _CategoryFormState extends State<_CategoryForm> {
  late final TextEditingController _label =
      TextEditingController(text: widget.existing?.label ?? '');
  late final TextEditingController _icon =
      TextEditingController(text: widget.existing?.icon ?? '');
  late int _slot = widget.existing?.colorSlot ?? 1;

  @override
  void dispose() {
    _label.dispose();
    _icon.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final label = _label.text.trim();
    if (label.isEmpty) return;

    // Id kategori dibuat otomatis dari label (`slugify`), TIDAK diketik manual
    // — pola Kitchen/Note/Wishlist. Saat edit, id lama dipertahankan supaya
    // item yang sudah merujuk kategori ini tidak jadi yatim.
    final id = widget.existing?.id ??
        uniqueSlug(
          slugify(label),
          widget.owner.categories.map((c) => c.id).toSet(),
        );

    await widget.owner.saveCategory(
      Category(
        id: id,
        label: label,
        icon: _icon.text.trim().isEmpty ? '📦' : _icon.text.trim(),
        colorSlot: _slot,
      ),
    );
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldBox(
          label: 'Label (Yang ditampilkan)',
          child: TextField(
            controller: _label,
            decoration: const InputDecoration(hintText: 'mis. Camilan'),
          ),
        ),
        FieldBox(
          label: 'Icon (emoji)',
          child: TextField(
            controller: _icon,
            decoration: const InputDecoration(hintText: 'mis. 🍪'),
          ),
        ),
        FieldBox(
          label: 'Warna',
          child: SlotPicker(
            selected: _slot,
            palette: p,
            onSelected: (s) => setState(() => _slot = s),
          ),
        ),
        const SizedBox(height: 8),
        GradientButton(label: 'Simpan', onPressed: _submit),
      ],
    );
  }
}
