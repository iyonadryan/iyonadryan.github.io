import 'dart:async';

import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/foundation.dart';

/// Basis store tiap app. Meniru pola versi web persis:
///
///     appRef.on("value", snap => { rebuildFromSnapshot(snap); renderAll(); })
///
/// Satu listener realtime di node top-level app (`finance`, `kitchen`, ...).
/// Tiap snapshot → [rebuildFromSnapshot] menyusun ulang seluruh state in-memory
/// → `notifyListeners()` memicu rebuild UI.
///
/// Konsekuensi yang sama dengan web (dan disengaja): **fungsi tulis tidak perlu
/// memanggil render/refresh manual** — cukup tulis ke Firebase, listener yang
/// memantulkan hasilnya balik ke UI.
abstract class AppStore extends ChangeNotifier {
  AppStore(this.dbPath);

  /// Node top-level di Realtime Database. Sama persis dengan konstanta
  /// `FINANCE_PATH` / `KITCHEN_PATH` / dst. di versi web.
  final String dbPath;

  DatabaseReference get ref => FirebaseDatabase.instance.ref(dbPath);

  StreamSubscription<DatabaseEvent>? _sub;

  bool _loading = true;
  bool get loading => _loading;

  Object? _error;
  Object? get error => _error;

  /// Susun ulang state dari snapshot mentah. Dipanggil tiap kali data berubah
  /// (dari device ini maupun device lain).
  void rebuildFromSnapshot(Map<Object?, Object?> root);

  void subscribe() {
    _sub?.cancel();
    _sub = ref.onValue.listen(
      (event) {
        final value = event.snapshot.value;
        rebuildFromSnapshot(
          value is Map ? value.cast<Object?, Object?>() : const {},
        );
        _loading = false;
        _error = null;
        notifyListeners();
      },
      onError: (Object e) {
        // Sama semangat dgn `hideLoading()` di catch versi web: jangan biarkan
        // user terjebak di loading overlay kalau baca gagal.
        _error = e;
        _loading = false;
        notifyListeners();
      },
    );
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}

/// Helper baca snapshot mentah Firebase yang tipenya `Map<Object?, Object?>`.
extension SnapshotMap on Map<Object?, Object?> {
  Map<Object?, Object?>? child(String key) {
    final v = this[key];
    return v is Map ? v.cast<Object?, Object?>() : null;
  }

  String str(String key, [String fallback = '']) {
    final v = this[key];
    return v is String ? v : fallback;
  }

  num number(String key, [num fallback = 0]) {
    final v = this[key];
    if (v is num) return v;
    if (v is String) return num.tryParse(v) ?? fallback;
    return fallback;
  }

  int integer(String key, [int fallback = 0]) => number(key, fallback).toInt();

  double decimal(String key, [double fallback = 0]) =>
      number(key, fallback).toDouble();

  bool flag(String key, [bool fallback = false]) {
    final v = this[key];
    return v is bool ? v : fallback;
  }

  /// Array Firebase bisa datang sebagai List (index rapat) ATAU Map (index
  /// bolong). Dua-duanya dinormalkan jadi List.
  List<Object?> list(String key) {
    final v = this[key];
    if (v is List) return v;
    if (v is Map) return v.values.toList();
    return const [];
  }

  /// Anak-anak node ini sebagai pasangan (key, map). Urutan mengikuti Firebase;
  /// pemanggil yang bertanggung jawab menyortir.
  List<({String key, Map<Object?, Object?> value})> entriesAsMaps() {
    final out = <({String key, Map<Object?, Object?> value})>[];
    forEach((k, v) {
      if (v is Map) {
        out.add((key: '$k', value: v.cast<Object?, Object?>()));
      }
    });
    return out;
  }
}
