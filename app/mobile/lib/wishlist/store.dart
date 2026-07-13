// `hide Category`: package:flutter/foundation.dart juga mengekspor kelas
// `Category` (anotasi test `@Category([...])`), bentrok dengan `Category` kita
// sendiri di core/category.dart.
import 'package:flutter/foundation.dart' hide Category;

import '../core/app_store.dart';
import '../core/category.dart';

/// Prioritas — enum tetap 3 nilai, bukan kategori bikinan user. Warnanya
/// traffic-light (`--priority-*`), tidak ikut palet kategorikal.
enum Priority {
  rendah('rendah', 'Rendah', 0),
  sedang('sedang', 'Sedang', 1),
  tinggi('tinggi', 'Tinggi', 2);

  const Priority(this.id, this.label, this.weight);

  final String id;
  final String label;

  /// Bobot sortir — makin besar makin duluan tampil.
  final int weight;

  static Priority fromId(String? v) =>
      Priority.values.firstWhere((p) => p.id == v, orElse: () => sedang);
}

@immutable
class WishlistItem {
  const WishlistItem({
    required this.id,
    required this.title,
    required this.price,
    required this.description,
    required this.link,
    required this.category,
    required this.priority,
    required this.achieved,
    required this.achievedAt,
    required this.by,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String title;

  /// Harga/estimasi biaya (Rupiah, angka polos). Nama field-nya `price` di
  /// Firebase, tapi label UI-nya "Nominal (Rp)" — perbedaan yang disengaja.
  final double price;

  final String description;
  final String link;
  final String category;
  final Priority priority;

  final bool achieved;
  final int? achievedAt;

  /// Atribusi murni (seperti Note App) — TIDAK men-scope tampilan.
  final String by;

  final int createdAt;

  /// Berubah tiap edit konten; **tidak** berubah karena toggle `achieved`.
  final int updatedAt;

  factory WishlistItem.fromMap(String id, Map<Object?, Object?> m) =>
      WishlistItem(
        id: id,
        title: m.str('title'),
        price: m.decimal('price'),
        description: m.str('description'),
        link: m.str('link'),
        category: m.str('category'),
        priority: Priority.fromId(m.str('priority')),
        achieved: m.flag('achieved'),
        achievedAt: m['achievedAt'] is num
            ? (m['achievedAt']! as num).toInt()
            : null,
        by: m.str('by', 'iyon'),
        createdAt: m.integer('createdAt'),
        updatedAt: m.integer('updatedAt'),
      );

  Map<String, Object?> toMap() => {
        'title': title,
        'price': price,
        'description': description,
        'link': link,
        'category': category,
        'priority': priority.id,
        'achieved': achieved,
        'achievedAt': achievedAt,
        'by': by,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
      };

  /// Link disimpan **apa adanya** (persis ketikan user), tapi `href`-nya
  /// di-prefix `https://` kalau user malas mengetik protokolnya.
  Uri? get uri {
    if (link.isEmpty) return null;
    final withScheme =
        link.startsWith('http://') || link.startsWith('https://')
            ? link
            : 'https://$link';
    return Uri.tryParse(withScheme);
  }
}

const List<({String label, String icon, int slot})> _defaultCategories = [
  (label: 'Elektronik', icon: '📱', slot: 1),
  (label: 'Fashion', icon: '👕', slot: 2),
  (label: 'Hobi', icon: '🎨', slot: 3),
  (label: 'Lainnya', icon: '📦', slot: 8),
];

class WishlistStore extends AppStore implements CategoryOwner {
  WishlistStore() : super('wishlist');

  List<WishlistItem> items = [];

  @override
  List<Category> categories = [];

  bool _categoriesSeeded = false;

  @override
  void rebuildFromSnapshot(Map<Object?, Object?> root) {
    items = [
      for (final e in (root.child('items') ?? {}).entriesAsMaps())
        WishlistItem.fromMap(e.key, e.value),
    ];

    categories = [
      for (final e in (root.child('categories') ?? {}).entriesAsMaps())
        Category.fromMap(e.key, e.value),
    ]..sort((a, b) => a.colorSlot.compareTo(b.colorSlot));

    _seedCategoriesIfEmpty(root);
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

  @override
  int itemCountForCategory(String id) =>
      items.where((i) => i.category == id).length;

  List<WishlistItem> get active => items.where((i) => !i.achieved).toList();

  List<WishlistItem> get achieved => items.where((i) => i.achieved).toList()
    ..sort((a, b) => (b.achievedAt ?? 0).compareTo(a.achievedAt ?? 0));

  /// Sorting default halaman Wishlist: prioritas Tinggi dulu, lalu terbaru —
  /// supaya wishlist penting selalu kelihatan duluan meski filter prioritas
  /// di-set "Semua".
  List<WishlistItem> sortByPriorityThenDate(List<WishlistItem> pool) =>
      [...pool]..sort((a, b) {
          final byPriority = b.priority.weight.compareTo(a.priority.weight);
          return byPriority != 0
              ? byPriority
              : b.updatedAt.compareTo(a.updatedAt);
        });

  // --- Tulis ----------------------------------------------------------------

  Future<void> saveItem(WishlistItem item) =>
      ref.child('items/${item.id}').set(item.toMap());

  Future<void> deleteItem(String id) => ref.child('items/$id').remove();

  /// Toggle "sudah didapat" — sengaja **tidak menyentuh `updatedAt`**, supaya
  /// item tidak melompat urutan cuma karena perubahan status.
  Future<void> toggleAchieved(WishlistItem item) =>
      ref.child('items/${item.id}').update({
        'achieved': !item.achieved,
        'achievedAt':
            item.achieved ? null : DateTime.now().millisecondsSinceEpoch,
      });

  @override
  Future<void> saveCategory(Category category) =>
      ref.child('categories/${category.id}').set(category.toMap());

  @override
  Future<void> deleteCategory(String id) =>
      ref.child('categories/$id').remove();
}
