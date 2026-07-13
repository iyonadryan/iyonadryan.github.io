import 'package:flutter/foundation.dart';

import '../core/app_store.dart';

/// Tipe transaksi. Di Firebase disimpan sebagai teks Indonesia
/// (`"pemasukan"`/`"pengeluaran"`) — padanan `TYPE_TO_FS`/`FS_TO_TYPE` di web.
enum TxType {
  income('pemasukan', 'Pemasukan'),
  expense('pengeluaran', 'Pengeluaran');

  const TxType(this.fs, this.label);

  /// Nilai yang benar-benar tersimpan di field `transaksi`.
  final String fs;
  final String label;

  static TxType fromFs(String? v) =>
      v == 'pemasukan' ? TxType.income : TxType.expense;
}

/// Periode rencana anggaran. Enum tetap, bukan data dinamis.
enum PlanPeriod {
  harian('harian', 'Harian'),
  mingguan('mingguan', 'Mingguan'),
  bulanan('bulanan', 'Bulanan'),
  weekday('weekday', 'Weekday'),
  weekend('weekend', 'Weekend');

  const PlanPeriod(this.id, this.label);

  final String id;
  final String label;

  static PlanPeriod fromId(String? v) =>
      PlanPeriod.values.firstWhere((p) => p.id == v, orElse: () => bulanan);
}

@immutable
class Transaction {
  const Transaction({
    required this.id,
    required this.ym,
    required this.type,
    required this.amount,
    required this.category,
    required this.note,
    required this.date,
    required this.by,
  });

  /// = timestamp key di Firebase. Bersama [ym] dipakai menyusun path saat
  /// update/hapus (`finance/<ym>/<id>`).
  final String id;
  final String ym;
  final TxType type;
  final double amount;
  final String category;
  final String note;

  /// "YYYY-MM-DD" — perbandingan string = perbandingan kronologis.
  final String date;

  /// Pembuat: "iyon" | "ciwul".
  final String by;

  /// Waktu pembuatan, dari timestamp key — dipakai sort "terbaru" & tampilan
  /// jam:menit(:detik).
  DateTime get createdAt =>
      DateTime.fromMillisecondsSinceEpoch(int.tryParse(id) ?? 0);

  factory Transaction.fromMap(String ym, String id, Map<Object?, Object?> m) =>
      Transaction(
        id: id,
        ym: ym,
        type: TxType.fromFs(m.str('transaksi')),
        amount: m.decimal('nominal'),
        category: m.str('category'),
        note: m.str('catatan'),
        date: m.str('tanggal'),
        by: m.str('by', 'ciwul'),
      );

  Map<String, Object?> toMap() => {
        'transaksi': type.fs,
        'category': category,
        'nominal': amount,
        'catatan': note,
        'tanggal': date,
        'timestamp': int.tryParse(id) ?? 0,
        'by': by,
      };
}

@immutable
class Plan {
  const Plan({
    required this.period,
    required this.category,
    required this.limit,
    required this.sort,
    required this.by,
  });

  final PlanPeriod period;

  /// Id kategori expense, atau `"semua"` (budget gabungan seluruh pengeluaran).
  final String category;
  final double limit;

  /// Urutan tampil (kecil = atas), diatur lewat drag.
  final int sort;
  final String by;

  /// Kunci unik satu rencana — SATU slot global per periode+kategori, tidak
  /// per-user (lihat catatan multi-user di `app/.claude/finance-app.md`).
  String get id => '${period.id}_$category';

  factory Plan.fromMap(PlanPeriod period, String category, Map<Object?, Object?> m) =>
      Plan(
        period: period,
        category: category,
        limit: m.decimal('limit'),
        sort: m.integer('sort'),
        by: m.str('by', 'ciwul'),
      );

  /// `savePlan` memakai `.set()` (menimpa seluruh node), jadi `sort` & `by`
  /// **wajib** ikut dikirim tiap simpan — kalau tidak, urutan ke-reset.
  Map<String, Object?> toMap() => {
        'category': category,
        'limit': limit,
        'sort': sort,
        'by': by,
      };
}

/// Kategori Finance — beda dari [Category] flat milik Kitchen/Note/Wishlist:
/// dipisah expense/income, dan **id-nya diketik manual** saat create (bukan
/// slug otomatis dari label), karena id dipakai sebagai kunci stabil di data
/// transaksi lama.
@immutable
class FinanceCategory {
  const FinanceCategory({
    required this.id,
    required this.label,
    required this.icon,
    required this.colorSlot,
  });

  final String id;
  final String label;
  final String icon;
  final int colorSlot;

  factory FinanceCategory.fromMap(String id, Map<Object?, Object?> m) =>
      FinanceCategory(
        id: id,
        label: m.str('label', id),
        icon: m.str('icon', '❓'),
        colorSlot: m.integer('colorSlot', 1),
      );

  Map<String, Object?> toMap() => {
        'id': id,
        'label': label,
        'icon': icon,
        'colorSlot': colorSlot,
      };
}

/// Kategori khusus "Semua" — budget gabungan seluruh pengeluaran. **Hanya
/// muncul di modal Rencana**, sengaja tidak disimpan di Firebase, dan id
/// `"semua"` di-reserve supaya kategori buatan user tidak bisa menabraknya.
const FinanceCategory allCategory = FinanceCategory(
  id: 'semua',
  label: 'Semua',
  icon: '💰',
  colorSlot: 1,
);

/// Kategori pengganti untuk transaksi yang kategorinya sudah dihapus — transaksi
/// lama tetap tampil, cuma tanpa nama kategori aslinya.
const FinanceCategory unknownCategory = FinanceCategory(
  id: '__unknown__',
  label: 'Kategori Terhapus',
  icon: '❓',
  colorSlot: 1,
);

/// Seed kategori kalau node `categories` belum ada sama sekali di Firebase.
/// Sama persis dengan `DEFAULT_CATEGORIES` di `finance/script.js`.
const Map<String, List<FinanceCategory>> defaultCategories = {
  'expense': [
    FinanceCategory(id: 'makanan', label: 'Makanan', icon: '🍔', colorSlot: 1),
    FinanceCategory(id: 'transport', label: 'Transport', icon: '🚗', colorSlot: 2),
    FinanceCategory(id: 'belanja', label: 'Belanja', icon: '🛒', colorSlot: 3),
    FinanceCategory(id: 'tagihan', label: 'Tagihan', icon: '🧾', colorSlot: 4),
    FinanceCategory(id: 'hiburan', label: 'Hiburan', icon: '🎬', colorSlot: 5),
    FinanceCategory(id: 'kesehatan', label: 'Kesehatan', icon: '💊', colorSlot: 6),
    FinanceCategory(id: 'pendidikan', label: 'Pendidikan', icon: '📚', colorSlot: 7),
    FinanceCategory(
      id: 'lainnya-keluar',
      label: 'Lainnya',
      icon: '📦',
      colorSlot: 8,
    ),
  ],
  'income': [
    FinanceCategory(id: 'gaji', label: 'Gaji', icon: '💼', colorSlot: 1),
    FinanceCategory(id: 'bonus', label: 'Bonus', icon: '🎁', colorSlot: 2),
    FinanceCategory(id: 'investasi', label: 'Investasi', icon: '📈', colorSlot: 3),
    FinanceCategory(
      id: 'lainnya-masuk',
      label: 'Lainnya',
      icon: '📦',
      colorSlot: 4,
    ),
  ],
};

/// Kategori "Lainnya" bawaan — tombol edit/hapusnya disembunyikan karena id-nya
/// dipakai sebagai catch-all. Dicek **by id**, bukan by label, supaya tetap kena
/// walau label-nya di-custom user.
bool isLainnyaCategory(String id) =>
    id == 'lainnya-keluar' || id == 'lainnya-masuk';
