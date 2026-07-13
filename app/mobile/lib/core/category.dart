import 'package:flutter/material.dart';

import 'app_store.dart';
import 'formatters.dart';

/// Kategori flat (Kitchen, Note, Wishlist) — id = slug dari label, warna
/// `colorSlot` 1..8 memetakan ke `--series-N`.
///
/// Finance App TIDAK memakai model ini: kategorinya dipisah expense/income dan
/// id-nya diketik manual (bukan slug otomatis dari label), lihat
/// `lib/finance/models.dart`.
@immutable
class Category {
  const Category({
    required this.id,
    required this.label,
    required this.icon,
    required this.colorSlot,
  });

  final String id;
  final String label;
  final String icon;
  final int colorSlot;

  factory Category.fromMap(String id, Map<Object?, Object?> m) => Category(
        id: id,
        label: m.str('label', id),
        icon: m.str('icon', '📦'),
        colorSlot: m.integer('colorSlot', 1),
      );

  Map<String, Object?> toMap() => {
        'id': id,
        'label': label,
        'icon': icon,
        'colorSlot': colorSlot,
      };

  Category copyWith({String? label, String? icon, int? colorSlot}) => Category(
        id: id,
        label: label ?? this.label,
        icon: icon ?? this.icon,
        colorSlot: colorSlot ?? this.colorSlot,
      );
}

/// Kategori pengganti kalau item merujuk kategori yang sudah dihapus.
/// Padanan `FALLBACK_CATEGORY` di Kitchen/Note/Wishlist App — item lama tetap
/// tampil, cuma tanpa nama kategori aslinya.
const Category fallbackCategory = Category(
  id: '',
  label: 'Tanpa Kategori',
  icon: '📦',
  colorSlot: 8,
);

/// Kontrak tulis kategori — diimplementasi tiap store (Kitchen/Note/Wishlist)
/// supaya sheet CRUD kategori di `widgets/category_sheet.dart` bisa dipakai
/// bareng tanpa tahu app mana yang memanggilnya.
abstract interface class CategoryOwner {
  List<Category> get categories;
  Future<void> saveCategory(Category category);
  Future<void> deleteCategory(String id);

  /// Berapa item yang masih memakai kategori ini — dipakai teks konfirmasi
  /// hapus supaya user tahu dampaknya.
  int itemCountForCategory(String id);
}

/// Ambil kategori by id, fallback kalau sudah dihapus. Padanan `getCategory()`.
Category findCategory(List<Category> categories, String? id) {
  for (final c in categories) {
    if (c.id == id) return c;
  }
  return fallbackCategory;
}

/// Seed kategori default kalau node `categories` masih kosong sama sekali.
/// Padanan `seedCategoriesIfEmpty()` — dipanggil dari `rebuildFromSnapshot`
/// dengan guard supaya cuma benar-benar menulis sekali.
List<Category> seedCategories(List<({String label, String icon, int slot})> defs) =>
    [
      for (final d in defs)
        Category(
          id: slugify(d.label),
          label: d.label,
          icon: d.icon,
          colorSlot: d.slot,
        ),
    ];
