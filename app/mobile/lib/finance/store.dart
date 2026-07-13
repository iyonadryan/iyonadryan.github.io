import '../core/app_store.dart';
import '../core/formatters.dart';
import 'models.dart';

/// Store Finance App — satu listener realtime di node `finance`.
///
/// Node ini isinya campur: key `<YYYY-MM>` (bulan transaksi) bersebelahan
/// dengan key khusus `plans` dan `categories`. Makanya [rebuildFromSnapshot]
/// harus **melewati** dua key itu saat menyapu bulan.
class FinanceStore extends AppStore {
  FinanceStore() : super('finance');

  List<Transaction> transactions = [];
  List<Plan> plans = [];
  List<FinanceCategory> expenseCategories = [];
  List<FinanceCategory> incomeCategories = [];

  // Guard migrasi — tiap migrasi dipanggil tiap snapshot, tapi hanya benar-benar
  // menulis sekali. Pola sama dengan `let xMigrated = false` di versi web.
  bool _plansMigrated = false;
  bool _categoriesSeeded = false;
  bool _txOwnersMigrated = false;

  static const Set<String> _reservedKeys = {'plans', 'categories'};

  @override
  void rebuildFromSnapshot(Map<Object?, Object?> root) {
    _rebuildTransactions(root);
    _rebuildPlans(root);
    _rebuildCategories(root);

    _migrateLegacyPlans(root);
    _seedCategoriesIfEmpty(root);
    _migrateTransactionOwners(root);
  }

  void _rebuildTransactions(Map<Object?, Object?> root) {
    final out = <Transaction>[];
    root.forEach((key, value) {
      final ym = '$key';
      if (_reservedKeys.contains(ym) || value is! Map) return;
      value.cast<Object?, Object?>().forEach((txKey, txValue) {
        if (txValue is Map) {
          out.add(
            Transaction.fromMap(
              ym,
              '$txKey',
              txValue.cast<Object?, Object?>(),
            ),
          );
        }
      });
    });
    transactions = out;
  }

  void _rebuildPlans(Map<Object?, Object?> root) {
    final node = root.child('plans');
    if (node == null) {
      plans = [];
      return;
    }

    final out = <Plan>[];
    for (final entry in node.entriesAsMaps()) {
      final periodIds = PlanPeriod.values.map((p) => p.id).toSet();

      if (periodIds.contains(entry.key)) {
        final period = PlanPeriod.fromId(entry.key);
        for (final cat in entry.value.entriesAsMaps()) {
          out.add(Plan.fromMap(period, cat.key, cat.value));
        }
      } else if (entry.value.containsKey('limit')) {
        // Bentuk lama `plans/<category>/{ limit }` (tanpa periode) — dibaca
        // sebagai rencana bulanan. `_migrateLegacyPlans` memindahkannya nanti.
        out.add(Plan.fromMap(PlanPeriod.bulanan, entry.key, entry.value));
      }
    }
    plans = out;
  }

  void _rebuildCategories(Map<Object?, Object?> root) {
    final node = root.child('categories');

    List<FinanceCategory> read(String type) {
      final sub = node?.child(type);
      if (sub == null) return [];
      final out = [
        for (final e in sub.entriesAsMaps())
          FinanceCategory.fromMap(e.key, e.value),
      ];
      // Urut naik by colorSlot supaya urutan tampil stabil, tidak bergantung
      // urutan key di Firebase.
      out.sort((a, b) => a.colorSlot.compareTo(b.colorSlot));
      return out;
    }

    expenseCategories = read('expense');
    incomeCategories = read('income');
  }

  // --- Migrasi (sekali jalan) ----------------------------------------------

  /// `plans/<category>/{limit}` (skema lama tanpa periode) →
  /// `plans/bulanan/<category>`.
  void _migrateLegacyPlans(Map<Object?, Object?> root) {
    if (_plansMigrated) return;
    final node = root.child('plans');
    if (node == null) return;

    final periodIds = PlanPeriod.values.map((p) => p.id).toSet();
    final updates = <String, Object?>{};

    for (final entry in node.entriesAsMaps()) {
      if (periodIds.contains(entry.key)) continue;
      if (!entry.value.containsKey('limit')) continue;
      updates['plans/bulanan/${entry.key}'] = {
        'category': entry.key,
        'limit': entry.value.decimal('limit'),
        'sort': entry.value.integer('sort'),
        'by': entry.value.str('by', 'ciwul'),
      };
      updates['plans/${entry.key}'] = null;
    }

    _plansMigrated = true;
    if (updates.isNotEmpty) ref.update(updates);
  }

  /// Seed `categories/` dari [defaultCategories] kalau node-nya belum ada sama
  /// sekali (mis. database baru).
  void _seedCategoriesIfEmpty(Map<Object?, Object?> root) {
    if (_categoriesSeeded) return;
    _categoriesSeeded = true;
    if (root.child('categories') != null) return;

    final seed = <String, Object?>{};
    defaultCategories.forEach((type, list) {
      for (final c in list) {
        seed['categories/$type/${c.id}'] = c.toMap();
      }
    });
    ref.update(seed);
  }

  /// Backfill `by: "ciwul"` ke transaksi yang belum punya field itu — semua
  /// data lama dibuat oleh Ciwul.
  void _migrateTransactionOwners(Map<Object?, Object?> root) {
    if (_txOwnersMigrated) return;

    final updates = <String, Object?>{};
    root.forEach((key, value) {
      final ym = '$key';
      if (_reservedKeys.contains(ym) || value is! Map) return;
      value.cast<Object?, Object?>().forEach((txKey, txValue) {
        if (txValue is Map && !txValue.containsKey('by')) {
          updates['$ym/$txKey/by'] = 'ciwul';
        }
      });
    });

    _txOwnersMigrated = true;
    if (updates.isNotEmpty) ref.update(updates);
  }

  // --- Query turunan --------------------------------------------------------

  /// Transaksi yang boleh tampil untuk pengguna aktif. Padanan
  /// `visibleTransactions()` — mode `both` menggabungkan semua.
  List<Transaction> visible(bool Function(String?) canSee) =>
      transactions.where((t) => canSee(t.by)).toList();

  FinanceCategory findCategory(TxType type, String id) {
    final pool =
        type == TxType.expense ? expenseCategories : incomeCategories;
    for (final c in pool) {
      if (c.id == id) return c;
    }
    return unknownCategory;
  }

  bool categoryExists(TxType type, String id) {
    final pool =
        type == TxType.expense ? expenseCategories : incomeCategories;
    return pool.any((c) => c.id == id);
  }

  /// Pengeluaran yang masuk hitungan progress bar sebuah rencana.
  ///
  /// Jendela waktunya relatif **sekarang** (`DateTime.now()`), KECUALI bulanan
  /// yang mengikuti bulan yang sedang dilihat user ([viewDate]):
  /// - harian   → hari ini
  /// - mingguan → minggu berjalan (Senin–Minggu)
  /// - weekday  → Sen–Jum minggu berjalan
  /// - weekend  → Sab–Min minggu berjalan
  /// - bulanan  → bulan yang dipilih
  List<Transaction> txInPlanPeriod(
    Plan plan,
    List<Transaction> pool,
    DateTime viewDate,
  ) {
    final now = DateTime.now();
    final monday = startOfWeek(now);

    bool inWindow(Transaction t) {
      switch (plan.period) {
        case PlanPeriod.harian:
          return t.date == dateKey(now);
        case PlanPeriod.bulanan:
          return t.ym == ymKey(viewDate);
        case PlanPeriod.mingguan:
          return _within(t.date, monday, monday.add(const Duration(days: 6)));
        case PlanPeriod.weekday:
          return _within(t.date, monday, monday.add(const Duration(days: 4)));
        case PlanPeriod.weekend:
          return _within(
            t.date,
            monday.add(const Duration(days: 5)),
            monday.add(const Duration(days: 6)),
          );
      }
    }

    return pool
        .where(
          (t) =>
              t.type == TxType.expense &&
              // Kategori "semua" = jumlahkan seluruh expense, filter kategori
              // dilewati.
              (plan.category == allCategory.id || t.category == plan.category) &&
              inWindow(t),
        )
        .toList();
  }

  static bool _within(String date, DateTime from, DateTime to) =>
      date.compareTo(dateKey(from)) >= 0 && date.compareTo(dateKey(to)) <= 0;

  /// `sort` untuk rencana baru — selalu paling akhir di periodenya.
  int nextSortForPeriod(PlanPeriod period) {
    final inPeriod = plans.where((p) => p.period == period);
    if (inPeriod.isEmpty) return 0;
    return inPeriod.map((p) => p.sort).reduce((a, b) => a > b ? a : b) + 1;
  }

  /// Semua kategori (+ "Semua") sudah dipakai di periode ini → tidak ada
  /// rencana baru yang bisa dibuat. Keunikan dicek **global**, bukan per-user.
  bool periodIsFull(PlanPeriod period) {
    final used =
        plans.where((p) => p.period == period).map((p) => p.category).toSet();
    final pool = [allCategory.id, ...expenseCategories.map((c) => c.id)];
    return pool.every(used.contains);
  }

  /// Bulan-bulan yang benar-benar punya transaksi, urut naik. Dipakai membatasi
  /// tombol prev/next bulan & daftar bulan di export.
  List<String> monthsWithData(List<Transaction> pool) {
    final set = pool.map((t) => t.ym).toSet().toList()..sort();
    return set;
  }

  // --- Tulis ----------------------------------------------------------------

  Future<void> addTransaction(Transaction tx) =>
      ref.child('${tx.ym}/${tx.id}').set(tx.toMap());

  /// Hanya nominal & catatan yang boleh berubah. Tipe/kategori/tanggal/`by`
  /// diambil dari data lama, dan node ditulis ulang di **path yang sama**
  /// (timestamp tidak berubah, tidak ada pemindahan node).
  Future<void> updateTransaction(
    Transaction old, {
    required double amount,
    required String note,
  }) {
    final updated = Transaction(
      id: old.id,
      ym: old.ym,
      type: old.type,
      amount: amount,
      category: old.category,
      note: note,
      date: old.date,
      by: old.by,
    );
    return ref.child('${old.ym}/${old.id}').set(updated.toMap());
  }

  Future<void> deleteTransaction(Transaction tx) =>
      ref.child('${tx.ym}/${tx.id}').remove();

  Future<void> savePlan(Plan plan) =>
      ref.child('plans/${plan.period.id}/${plan.category}').set(plan.toMap());

  Future<void> deletePlan(Plan plan) =>
      ref.child('plans/${plan.period.id}/${plan.category}').remove();

  /// Tulis ulang field `sort` setelah drag-reorder, satu `update()` multi-path.
  Future<void> commitPlanOrder(PlanPeriod period, List<Plan> ordered) {
    final updates = <String, Object?>{};
    for (var i = 0; i < ordered.length; i++) {
      updates['plans/${period.id}/${ordered[i].category}/sort'] = i;
    }
    return ref.update(updates);
  }

  Future<void> saveCategory(TxType type, FinanceCategory category) {
    final node = type == TxType.expense ? 'expense' : 'income';
    return ref.child('categories/$node/${category.id}').set(category.toMap());
  }

  Future<void> deleteCategory(TxType type, String id) {
    final node = type == TxType.expense ? 'expense' : 'income';
    return ref.child('categories/$node/$id').remove();
  }
}
