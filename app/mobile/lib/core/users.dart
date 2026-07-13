import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Padanan konstanta `USERS` di versi web. Ikon-nya file PNG yang sama
/// (`app/img/*.png`), disalin ke `assets/img/` oleh `bootstrap.ps1` — di web
/// direferensikan sbg `../img/iyon.png`, di Flutter harus jadi asset.
@immutable
class AppUser {
  const AppUser({required this.id, required this.label, required this.asset});

  final String id;
  final String label;
  final String asset;

  ImageProvider get image => AssetImage(asset);
}

class Users {
  const Users._();

  static const AppUser iyon =
      AppUser(id: 'iyon', label: 'Iyon', asset: 'assets/img/iyon.png');
  static const AppUser ciwul =
      AppUser(id: 'ciwul', label: 'Ciwul', asset: 'assets/img/ciwul.png');

  /// "Both" bukan orang beneran — cuma mode tampilan gabungan di Finance &
  /// Routine App. Note & Wishlist TIDAK punya mode ini (atribusi murni,
  /// tanpa pengguna aktif).
  static const AppUser both =
      AppUser(id: 'both', label: 'Both', asset: 'assets/img/couple.png');

  /// Pembuat yang bisa dipilih (tanpa `both`) — isi toggle "Dibuat oleh".
  static const List<AppUser> creators = [iyon, ciwul];

  /// Pilihan pengguna aktif (dengan `both`) — isi overlay & modal ganti
  /// pengguna di Finance & Routine App.
  static const List<AppUser> selectable = [iyon, ciwul, both];

  static AppUser byId(String? id) => switch (id) {
        'ciwul' => ciwul,
        'both' => both,
        _ => iyon,
      };
}

/// Pengguna aktif device-level — HANYA dipakai Finance & Routine App.
/// Men-scope apa yang tampil: mode `iyon`/`ciwul` cuma menampilkan data milik
/// orang itu, mode `both` menggabungkan keduanya.
///
/// Kalau belum ada pilihan tersimpan, [currentUserId] `null` → app menampilkan
/// overlay pilih pengguna dulu (padanan `#userSelectOverlay` di web).
class UserScope extends ChangeNotifier {
  UserScope(this.storageKey);

  /// Sama persis dengan key localStorage versi web: `financeapp_user`,
  /// `routineapp_user`.
  final String storageKey;

  String? _currentUserId;
  String? get currentUserId => _currentUserId;

  bool get hasSelection => _currentUserId != null;
  bool get isBoth => _currentUserId == 'both';
  AppUser get currentUser => Users.byId(_currentUserId);

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _currentUserId = prefs.getString(storageKey);
    notifyListeners();
  }

  Future<void> select(String id) async {
    _currentUserId = id;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(storageKey, id);
  }

  /// True kalau data dengan pembuat [by] boleh tampil untuk pengguna aktif.
  /// Padanan `visibleTransactions()` / `visibleRoutines()` di versi web.
  bool canSee(String? by) => isBoth || by == _currentUserId;
}
