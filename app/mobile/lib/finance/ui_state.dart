import 'package:flutter/foundation.dart';

import 'models.dart';

/// State UI Finance App yang dipakai bersama antar halaman — padanan variabel
/// closure di IIFE `finance/script.js` (`viewDate`, `balanceVisible`,
/// `currentFilter`, `selectedCategories`, `currentPeriod`, dst).
///
/// Dipisah dari [FinanceStore] karena ini murni state tampilan: tidak pernah
/// ditulis ke Firebase dan tidak ikut ter-reset saat snapshot datang.
class FinanceUiState extends ChangeNotifier {
  /// **Satu konsep "bulan aktif" untuk seluruh app** — Dashboard, Transaksi,
  /// dan Rencana bulanan semuanya membacanya. Ganti bulan di satu halaman ikut
  /// mengubah halaman lain, persis seperti versi web.
  DateTime viewDate = DateTime.now();

  /// Sembunyikan saldo. In-memory saja — **tidak** disimpan, jadi selalu
  /// kembali tersembunyi tiap app dibuka (disengaja).
  bool balanceVisible = false;

  /// Filter tipe di halaman Transaksi. `null` = semua.
  TxType? typeFilter;

  /// Filter kategori (multi-select). Kosong = tanpa filter.
  Set<String> selectedCategories = {};

  /// Rentang tanggal "YYYY-MM-DD", dibatasi ke bulan aktif. `null` = tanpa batas.
  String? filterStartDate;
  String? filterEndDate;

  /// Tab periode di halaman Rencana.
  PlanPeriod currentPeriod = PlanPeriod.bulanan;

  bool get hasActiveFilter =>
      selectedCategories.isNotEmpty ||
      filterStartDate != null ||
      filterEndDate != null;

  void changeMonth(int delta) {
    viewDate = DateTime(viewDate.year, viewDate.month + delta);
    // Rentang tanggal terikat ke bulan tertentu, jadi ikut direset saat pindah
    // bulan. Filter kategori TIDAK direset (tidak month-specific).
    filterStartDate = null;
    filterEndDate = null;
    notifyListeners();
  }

  void toggleBalance() {
    balanceVisible = !balanceVisible;
    notifyListeners();
  }

  void setTypeFilter(TxType? type) {
    typeFilter = type;
    // Ganti tab tipe membatalkan filter kategori (kategori beda pool per tipe).
    selectedCategories = {};
    notifyListeners();
  }

  void applyFilter({
    required Set<String> categories,
    required String? start,
    required String? end,
  }) {
    selectedCategories = categories;
    // Tukar kalau terbalik.
    if (start != null && end != null && start.compareTo(end) > 0) {
      filterStartDate = end;
      filterEndDate = start;
    } else {
      filterStartDate = start;
      filterEndDate = end;
    }
    notifyListeners();
  }

  void resetFilter() {
    typeFilter = null;
    selectedCategories = {};
    filterStartDate = null;
    filterEndDate = null;
    notifyListeners();
  }

  void setPeriod(PlanPeriod period) {
    currentPeriod = period;
    notifyListeners();
  }
}
