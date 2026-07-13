// `hide Category`: package:flutter/foundation.dart juga mengekspor kelas
// `Category` (anotasi test `@Category([...])`), bentrok dengan `Category` kita
// sendiri di core/category.dart.
import 'package:flutter/foundation.dart' hide Category;

import '../core/app_store.dart';
import '../core/category.dart';

@immutable
class Note {
  const Note({
    required this.id,
    required this.title,
    required this.content,
    required this.category,
    required this.pinned,
    required this.by,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String title;

  /// Markdown mentah — di-render jadi teks berformat di popup detail, tapi
  /// disimpan apa adanya.
  final String content;

  final String category;
  final bool pinned;

  /// "iyon" | "ciwul" — murni **atribusi**, dipilih manual tiap catatan.
  /// BUKAN pengguna aktif: tidak pernah menyembunyikan catatan siapa pun.
  final String by;

  final int createdAt;

  /// Berubah tiap edit konten. **Tidak** berubah karena toggle pin — sematkan
  /// bukan "mengedit isi", jadi tidak boleh bikin catatan melompat ke atas list
  /// "Catatan Terbaru".
  final int updatedAt;

  factory Note.fromMap(String id, Map<Object?, Object?> m) => Note(
        id: id,
        title: m.str('title'),
        content: m.str('content'),
        category: m.str('category'),
        pinned: m.flag('pinned'),
        by: m.str('by', 'iyon'),
        createdAt: m.integer('createdAt'),
        updatedAt: m.integer('updatedAt'),
      );

  Map<String, Object?> toMap() => {
        'title': title,
        'content': content,
        'category': category,
        'pinned': pinned,
        'by': by,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
      };
}

const List<({String label, String icon, int slot})> _defaultCategories = [
  (label: 'Aktivitas', icon: '📝', slot: 1),
  (label: 'Reminder', icon: '⏰', slot: 2),
  (label: 'Inspirasi', icon: '💡', slot: 3),
  (label: 'Lainnya', icon: '📦', slot: 8),
];

class NoteStore extends AppStore implements CategoryOwner {
  NoteStore() : super('note');

  List<Note> notes = [];

  @override
  List<Category> categories = [];

  bool _categoriesSeeded = false;
  bool _ownersMigrated = false;

  @override
  void rebuildFromSnapshot(Map<Object?, Object?> root) {
    notes = [
      for (final e in (root.child('notes') ?? {}).entriesAsMaps())
        Note.fromMap(e.key, e.value),
    ];

    categories = [
      for (final e in (root.child('categories') ?? {}).entriesAsMaps())
        Category.fromMap(e.key, e.value),
    ]..sort((a, b) => a.colorSlot.compareTo(b.colorSlot));

    _seedCategoriesIfEmpty(root);
    _migrateOwners(root);
  }

  void _seedCategoriesIfEmpty(Map<Object?, Object?> root) {
    if (_categoriesSeeded) return;
    _categoriesSeeded = true;
    if (root.child('categories') != null) return;

    final updates = <String, Object?>{};
    for (final c in seedCategories(_defaultCategories)) {
      updates['categories/${c.id}'] = c.toMap();
    }
    ref.update(updates);
  }

  /// Backfill `by` untuk catatan yang dibuat sebelum field itu ada.
  void _migrateOwners(Map<Object?, Object?> root) {
    if (_ownersMigrated) return;

    final updates = <String, Object?>{};
    (root.child('notes') ?? {}).forEach((id, value) {
      if (value is Map && !value.containsKey('by')) {
        updates['notes/$id/by'] = 'iyon';
      }
    });

    _ownersMigrated = true;
    if (updates.isNotEmpty) ref.update(updates);
  }

  @override
  int itemCountForCategory(String id) =>
      notes.where((n) => n.category == id).length;

  List<Note> get pinned => notes.where((n) => n.pinned).toList()
    ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));

  /// Urut terbaru **by `updatedAt`** — catatan yang baru diedit ikut naik,
  /// bukan cuma yang baru dibuat.
  List<Note> get byRecent => [...notes]
    ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));

  // --- Tulis ----------------------------------------------------------------

  Future<void> saveNote(Note note) =>
      ref.child('notes/${note.id}').set(note.toMap());

  Future<void> deleteNote(String id) => ref.child('notes/$id').remove();

  /// Toggle pin — sengaja **tidak menyentuh `updatedAt`**.
  Future<void> togglePinned(Note note) =>
      ref.child('notes/${note.id}/pinned').set(!note.pinned);

  @override
  Future<void> saveCategory(Category category) =>
      ref.child('categories/${category.id}').set(category.toMap());

  @override
  Future<void> deleteCategory(String id) =>
      ref.child('categories/$id').remove();
}
