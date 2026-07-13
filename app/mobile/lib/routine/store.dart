import 'package:flutter/foundation.dart';

import '../core/app_store.dart';
import '../core/formatters.dart';

/// Periode rutinitas — enum tetap 3 nilai, bukan kategori bikinan user.
/// Fleksibilitas "kapan aktif" ada di dalam periode `harian` lewat field
/// [Routine.days], bukan lewat menambah periode baru.
enum RoutinePeriod {
  harian('harian', 'Harian', '📅'),
  mingguan('mingguan', 'Mingguan', '🗓️'),
  bulanan('bulanan', 'Bulanan', '📆');

  const RoutinePeriod(this.id, this.label, this.defaultIcon);

  final String id;
  final String label;

  /// Ikon fallback kalau rutinitas tidak punya ikon sendiri. **Tidak** ditulis
  /// balik ke Firebase — cuma dipakai saat render.
  final String defaultIcon;

  static RoutinePeriod fromId(String? v) =>
      RoutinePeriod.values.firstWhere((p) => p.id == v, orElse: () => harian);
}

/// Nama hari, index = `DateTime.weekday % 7` (0=Minggu … 6=Sabtu), konvensi
/// yang sama dengan `Date.getDay()` di JS.
const List<String> dayNamesShort = [
  'Min',
  'Sen',
  'Sel',
  'Rab',
  'Kam',
  'Jum',
  'Sab',
];
const List<String> dayNamesLong = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

/// `DateTime.weekday` memakai 1=Senin..7=Minggu; data `days` memakai konvensi JS
/// 0=Minggu..6=Sabtu. Ini jembatannya.
int jsWeekday(DateTime d) => d.weekday % 7;

@immutable
class Routine {
  const Routine({
    required this.id,
    required this.name,
    required this.period,
    required this.icon,
    required this.days,
    required this.by,
    required this.createdAt,
  });

  final String id;
  final String name;
  final RoutinePeriod period;

  /// Boleh kosong — render jatuh ke [RoutinePeriod.defaultIcon].
  final String icon;

  /// Hari aktif (0=Minggu … 6=Sabtu). **Cuma bermakna kalau [period] harian**:
  /// kosong = "Tiap Hari", terisi = "Hari Tertentu" (hari-hari itu saja).
  final List<int> days;

  final String by;
  final int createdAt;

  String get displayIcon => icon.isEmpty ? period.defaultIcon : icon;

  factory Routine.fromMap(String id, Map<Object?, Object?> m) => Routine(
        id: id,
        name: m.str('name'),
        period: RoutinePeriod.fromId(m.str('period')),
        icon: m.str('icon'),
        days: [
          for (final d in m.list('days'))
            if (d is num) d.toInt(),
        ],
        by: m.str('by', 'iyon'),
        createdAt: m.integer('createdAt'),
      );

  /// `days` **selalu disertakan** (walau kosong) supaya kalau user ganti periode
  /// dari "Harian + Hari Tertentu" ke Mingguan/Bulanan, hari lama ikut ditimpa
  /// bersih — `update()` cuma menimpa key yang dikirim.
  Map<String, Object?> toMap() => {
        'name': name,
        'period': period.id,
        'icon': icon,
        'days': days,
        'by': by,
        'createdAt': createdAt,
      };

  /// Label periode yang informatif: rutinitas harian "Hari Tertentu" menampilkan
  /// nama harinya langsung (mis. "Sen, Kam") alih-alih "Harian" generik.
  String periodLabel({bool full = false}) {
    if (period != RoutinePeriod.harian || days.isEmpty) return period.label;
    final names = full ? dayNamesLong : dayNamesShort;
    final sorted = [...days]..sort();
    return sorted.map((d) => names[d]).join(', ');
  }
}

class RoutineStore extends AppStore {
  RoutineStore() : super('routine');

  List<Routine> routines = [];

  /// Object mentah `{ routineId: { periodKey: true } }` — sengaja tidak
  /// di-rebuild jadi array, karena selalu dibaca langsung by id + periodKey.
  Map<String, Set<String>> completions = {};

  bool _ownersMigrated = false;

  @override
  void rebuildFromSnapshot(Map<Object?, Object?> root) {
    routines = [
      for (final e in (root.child('routines') ?? {}).entriesAsMaps())
        Routine.fromMap(e.key, e.value),
    ];

    final done = <String, Set<String>>{};
    (root.child('completions') ?? {}).forEach((routineId, value) {
      if (value is Map) {
        done['$routineId'] = value.keys.map((k) => '$k').toSet();
      }
    });
    completions = done;

    _migrateOwners(root);
  }

  /// Backfill `by: "iyon"` ke rutinitas yang dibuat sebelum fitur multi-user ada.
  void _migrateOwners(Map<Object?, Object?> root) {
    if (_ownersMigrated) return;

    final updates = <String, Object?>{};
    (root.child('routines') ?? {}).forEach((id, value) {
      if (value is Map && !value.containsKey('by')) {
        updates['routines/$id/by'] = 'iyon';
      }
    });

    _ownersMigrated = true;
    if (updates.isNotEmpty) ref.update(updates);
  }

  // --- Query turunan --------------------------------------------------------

  List<Routine> visible(bool Function(String?) canSee) =>
      routines.where((r) => canSee(r.by)).toList();

  /// Kunci instance periode berjalan. Harian → tanggal hari ini; mingguan →
  /// Senin minggu berjalan; bulanan → "YYYY-MM".
  String periodKeyFor(RoutinePeriod period, DateTime now) => switch (period) {
        RoutinePeriod.harian => dateKey(now),
        RoutinePeriod.mingguan => dateKey(startOfWeek(now)),
        RoutinePeriod.bulanan => ymKey(now),
      };

  bool isDone(Routine r, DateTime now) =>
      completions[r.id]?.contains(periodKeyFor(r.period, now)) ?? false;

  /// Inti logika "Tiap Hari" vs "Hari Tertentu".
  bool isActiveToday(Routine r, DateTime now) =>
      r.days.isEmpty || r.days.contains(jsWeekday(now));

  /// Rutinitas harian yang **aktif hari ini** — yang "Hari Tertentu" tapi bukan
  /// harinya tidak muncul sama sekali (bukan tampil abu-abu), supaya list Cek
  /// selalu relevan dengan hari itu.
  List<Routine> forToday(List<Routine> pool, DateTime now) => pool
      .where((r) => r.period == RoutinePeriod.harian && isActiveToday(r, now))
      .toList();

  List<Routine> forPeriod(List<Routine> pool, RoutinePeriod period) =>
      pool.where((r) => r.period == period).toList();

  // --- Tulis ----------------------------------------------------------------

  Future<void> saveRoutine(Routine r) =>
      ref.child('routines/${r.id}').update(r.toMap());

  /// Hapus rutinitas **beserta riwayat ceknya** — tidak ada fallback yang masuk
  /// akal untuk completion tanpa rutinitas induk.
  Future<void> deleteRoutine(String id) => ref.update({
        'routines/$id': null,
        'completions/$id': null,
      });

  /// `.set(null)` (bukan `false`) saat di-uncheck, supaya node kosong otomatis
  /// dibersihkan Firebase.
  Future<void> toggleCompletion(Routine r, DateTime now, bool done) => ref
      .child('completions/${r.id}/${periodKeyFor(r.period, now)}')
      .set(done ? true : null);
}
