// `hide Category`: package:flutter/foundation.dart juga mengekspor kelas
// `Category` (anotasi test `@Category([...])`), bentrok dengan `Category` kita
// sendiri di core/category.dart.
import 'package:flutter/foundation.dart' hide Category;

import '../core/app_store.dart';
import '../core/category.dart';

@immutable
class Ingredient {
  const Ingredient({required this.name, required this.qty});

  final String name;
  final String qty;

  Map<String, Object?> toMap() => {'name': name, 'qty': qty};
}

@immutable
class Recipe {
  const Recipe({
    required this.id,
    required this.name,
    required this.category,
    required this.servings,
    required this.time,
    required this.ingredients,
    required this.steps,
    required this.note,
    required this.createdAt,
  });

  final String id;
  final String name;
  final String category;

  /// Teks bebas (mis. "2-3 orang"), bukan angka strict — sengaja fleksibel.
  final String servings;
  final String time;

  /// Urutan array = urutan tampil.
  final List<Ingredient> ingredients;

  /// Urutan array = nomor langkah.
  final List<String> steps;
  final String note;
  final int createdAt;

  factory Recipe.fromMap(String id, Map<Object?, Object?> m) => Recipe(
        id: id,
        name: m.str('name'),
        category: m.str('category'),
        servings: m.str('servings'),
        time: m.str('time'),
        ingredients: [
          for (final raw in m.list('ingredients'))
            if (raw is Map)
              Ingredient(
                name: raw.cast<Object?, Object?>().str('name'),
                qty: raw.cast<Object?, Object?>().str('qty'),
              ),
        ],
        steps: [
          for (final raw in m.list('steps'))
            if (raw is String) raw,
        ],
        note: m.str('note'),
        createdAt: m.integer('createdAt'),
      );

  Map<String, Object?> toMap() => {
        'name': name,
        'category': category,
        'servings': servings,
        'time': time,
        'ingredients': [for (final i in ingredients) i.toMap()],
        'steps': steps,
        'note': note,
        'createdAt': createdAt,
      };
}

@immutable
class ShoppingItem {
  const ShoppingItem({
    required this.id,
    required this.name,
    required this.qty,
    required this.done,
    required this.createdAt,
  });

  final String id;
  final String name;
  final String qty;
  final bool done;
  final int createdAt;

  factory ShoppingItem.fromMap(String id, Map<Object?, Object?> m) =>
      ShoppingItem(
        id: id,
        name: m.str('name'),
        qty: m.str('qty'),
        done: m.flag('done'),
        createdAt: m.integer('createdAt'),
      );

  Map<String, Object?> toMap() => {
        'name': name,
        'qty': qty,
        'done': done,
        'createdAt': createdAt,
      };
}

/// 8 kategori bawaan, di-seed sekali kalau node `categories` masih kosong.
const List<({String label, String icon, int slot})> _defaultCategories = [
  (label: 'Sarapan', icon: '🥐', slot: 1),
  (label: 'Makan Siang', icon: '🍛', slot: 2),
  (label: 'Makan Malam', icon: '🍲', slot: 3),
  (label: 'Camilan', icon: '🍪', slot: 4),
  (label: 'Minuman', icon: '🥤', slot: 5),
  (label: 'Dessert', icon: '🍰', slot: 6),
  (label: 'Lauk', icon: '🍗', slot: 7),
  (label: 'Lainnya', icon: '📦', slot: 8),
];

class KitchenStore extends AppStore implements CategoryOwner {
  KitchenStore() : super('kitchen');

  List<Recipe> recipes = [];
  List<ShoppingItem> shopping = [];

  @override
  List<Category> categories = [];

  bool _categoriesSeeded = false;

  @override
  void rebuildFromSnapshot(Map<Object?, Object?> root) {
    recipes = [
      for (final e in (root.child('recipes') ?? {}).entriesAsMaps())
        Recipe.fromMap(e.key, e.value),
    ];

    shopping = [
      for (final e in (root.child('shopping') ?? {}).entriesAsMaps())
        ShoppingItem.fromMap(e.key, e.value),
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
      recipes.where((r) => r.category == id).length;

  int get pendingShoppingCount => shopping.where((s) => !s.done).length;

  // --- Tulis ----------------------------------------------------------------

  Future<void> saveRecipe(Recipe recipe) =>
      ref.child('recipes/${recipe.id}').set(recipe.toMap());

  Future<void> deleteRecipe(String id) => ref.child('recipes/$id').remove();

  Future<void> addShoppingItem(ShoppingItem item) =>
      ref.child('shopping/${item.id}').set(item.toMap());

  /// Toggle centang — langsung tulis tanpa konfirmasi (low-stakes).
  Future<void> toggleShoppingItem(ShoppingItem item) =>
      ref.child('shopping/${item.id}/done').set(!item.done);

  Future<void> deleteShoppingItem(String id) =>
      ref.child('shopping/$id').remove();

  /// Hapus semua item tercentang sekaligus lewat satu `update()` multi-path.
  Future<void> clearDoneShopping() {
    final updates = <String, Object?>{};
    for (final item in shopping.where((s) => s.done)) {
      updates['shopping/${item.id}'] = null;
    }
    return ref.update(updates);
  }

  @override
  Future<void> saveCategory(Category category) =>
      ref.child('categories/${category.id}').set(category.toMap());

  @override
  Future<void> deleteCategory(String id) =>
      ref.child('categories/$id').remove();
}
