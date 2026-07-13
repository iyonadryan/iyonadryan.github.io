import 'package:flutter/material.dart';

/// Padanan Dart dari blok `:root` / `[data-theme="dark"]` di `css/base.css`
/// tiap app web. Satu [AppPalette] = satu tema (light ATAU dark) dari satu app.
///
/// Nilai hex-nya disalin **persis** dari CSS supaya versi mobile & web
/// kelihatan sama. Kalau warna di CSS berubah, ubah di sini juga (dan
/// sebaliknya) — dua sumber ini sengaja dijaga sinkron manual, tidak ada
/// pipeline yang men-generate salah satunya.
@immutable
class AppPalette {
  const AppPalette({
    required this.brightness,
    required this.bg,
    required this.surface,
    required this.surfaceAlt,
    required this.border,
    required this.text,
    required this.textMuted,
    required this.primary,
    required this.primaryDark,
    required this.series,
    this.income,
    this.expense,
    this.warning,
    this.done,
    this.positive,
    this.negative,
    this.periodMingguan,
    this.periodBulanan,
    this.priorityTinggi,
    this.prioritySedang,
    this.priorityRendah,
  });

  final Brightness brightness;

  final Color bg;
  final Color surface;
  final Color surfaceAlt;
  final Color border;
  final Color text;
  final Color textMuted;
  final Color primary;
  final Color primaryDark;

  /// Palet kategorikal `--series-1..N` (index 0 = slot 1). Kitchen/Note/Wishlist
  /// punya 8 slot, Finance 10, Routine/Patungan tidak pakai (list kosong).
  final List<Color> series;

  // Semantik opsional — hanya diisi app yang memang punya var-nya di CSS.
  final Color? income; // Finance
  final Color? expense; // Finance
  final Color? warning; // Finance
  final Color? done; // Kitchen, Routine
  final Color? positive; // Patungan
  final Color? negative; // Patungan
  final Color? periodMingguan; // Routine
  final Color? periodBulanan; // Routine
  final Color? priorityTinggi; // Wishlist
  final Color? prioritySedang; // Wishlist
  final Color? priorityRendah; // Wishlist

  bool get isDark => brightness == Brightness.dark;

  /// `--gradient-card`: `linear-gradient(145deg, primary, primary-dark)`.
  /// 145° di CSS ≈ arah kiri-atas → kanan-bawah.
  LinearGradient get cardGradient => LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [primary, primaryDark],
      );

  /// `--gradient-primary`: 3 stop 0%/51%/100%, start & end = primaryDark,
  /// mid = primary. Dipakai tombol utama, FAB, dan `.icon-btn.accent`.
  LinearGradient get buttonGradient => LinearGradient(
        colors: [primaryDark, primary, primaryDark],
        stops: const [0.0, 0.51, 1.0],
      );

  /// Warna slot kategori (`colorSlot` 1..N di Firebase → `var(--series-N)`).
  /// Slot di luar rentang jatuh ke slot 1, meniru fallback `categoryColorVar()`
  /// versi web untuk kategori yang sudah dihapus.
  Color seriesSlot(int slot) {
    if (series.isEmpty) return primary;
    final i = slot - 1;
    if (i < 0 || i >= series.length) return series.first;
    return series[i];
  }
}

// --- Palet kategorikal bersama --------------------------------------------
// Kitchen/Note/Wishlist/Finance memakai 8 nilai pertama yang identik (sudah
// divalidasi terpisah per-surface lewat skill dataviz di sisi web). Finance
// menambah slot 9 & 10.

const List<Color> _seriesLight8 = [
  Color(0xFF2A78D6),
  Color(0xFF1BAF7A),
  Color(0xFFEDA100),
  Color(0xFF008300),
  Color(0xFF4A3AA7),
  Color(0xFFE34948),
  Color(0xFFE87BA4),
  Color(0xFFEB6834),
];

const List<Color> _seriesDark8 = [
  Color(0xFF3987E5),
  Color(0xFF199E70),
  Color(0xFFC98500),
  Color(0xFF008300),
  Color(0xFF9085E9),
  Color(0xFFE66767),
  Color(0xFFD55181),
  Color(0xFFD95926),
];

const List<Color> _financeSeriesLight = [
  ..._seriesLight8,
  Color(0xFF0891B2),
  Color(0xFF9C5220),
];

const List<Color> _financeSeriesDark = [
  ..._seriesDark8,
  Color(0xFF0E9DB8),
  Color(0xFFB06A3E),
];

/// Warna gradient header hub (`--gradient-hero` di `app/style-app.css`).
/// Sengaja **hardcode** dan dipakai ulang oleh tombol "Iyon App" (`.btn-hub`)
/// di semua app — permintaan eksplisit user supaya "pintu balik ke hub"
/// warnanya konsisten, bukan ikut primary masing-masing app.
class HubGradient {
  const HubGradient._();

  static const List<Color> light = [Color(0xFF6D5BD0), Color(0xFF9B6BD6)];
  static const List<Color> dark = [Color(0xFF4F3FA6), Color(0xFF7A4FB0)];

  static LinearGradient of(Brightness b) => LinearGradient(
        colors: b == Brightness.dark ? dark : light,
      );
}

/// Identitas satu app: nama, deskripsi, ikon, dan pasangan palet light/dark.
/// Dipakai hub (kartu launcher) sekaligus tiap app (tema-nya sendiri).
@immutable
class AppSpec {
  const AppSpec({
    required this.id,
    required this.name,
    required this.description,
    required this.emoji,
    required this.themeStorageKey,
    required this.dbPath,
    required this.light,
    required this.dark,
  });

  final String id;
  final String name;
  final String description;
  final String emoji;

  /// Key SharedPreferences untuk tema — sengaja sama persis dengan key
  /// localStorage versi web (`financeapp_theme`, dst.) supaya konsepnya
  /// nyambung, walau storage-nya beda mesin.
  final String themeStorageKey;

  /// Node top-level di Realtime Database (`finance`, `kitchen`, ...).
  final String dbPath;

  final AppPalette light;
  final AppPalette dark;

  AppPalette palette(Brightness b) => b == Brightness.dark ? dark : light;
}

class AppSpecs {
  const AppSpecs._();

  static const AppSpec finance = AppSpec(
    id: 'finance',
    name: 'Finance App',
    description: 'Kelola pemasukan & pengeluaran pribadi',
    emoji: '💰',
    themeStorageKey: 'financeapp_theme',
    dbPath: 'finance',
    light: AppPalette(
      brightness: Brightness.light,
      bg: Color(0xFFF4F5F9),
      surface: Color(0xFFFFFFFF),
      surfaceAlt: Color(0xFFF0F1F6),
      border: Color(0xFFE6E8EF),
      text: Color(0xFF1C1D26),
      textMuted: Color(0xFF6B6F80),
      primary: Color(0xFF0891B2),
      primaryDark: Color(0xFF0B5A70),
      series: _financeSeriesLight,
      income: Color(0xFF16A34A),
      expense: Color(0xFFE63946),
      warning: Color(0xFFF59E0B),
    ),
    dark: AppPalette(
      brightness: Brightness.dark,
      bg: Color(0xFF14141C),
      surface: Color(0xFF1E1E2A),
      surfaceAlt: Color(0xFF262633),
      border: Color(0xFF32323F),
      text: Color(0xFFF2F2F5),
      textMuted: Color(0xFF9A9AAB),
      primary: Color(0xFF71B280),
      primaryDark: Color(0xFF134E5E),
      series: _financeSeriesDark,
      income: Color(0xFF34D17C),
      expense: Color(0xFFFF6B7A),
      warning: Color(0xFFFBBF24),
    ),
  );

  static const AppSpec kitchen = AppSpec(
    id: 'kitchen',
    name: 'Kitchen App',
    description: 'Catatan resep & daftar belanja dapur',
    emoji: '🍳',
    themeStorageKey: 'kitchenapp_theme',
    dbPath: 'kitchen',
    light: AppPalette(
      brightness: Brightness.light,
      bg: Color(0xFFFAF6F2),
      surface: Color(0xFFFFFFFF),
      surfaceAlt: Color(0xFFF5EFE8),
      border: Color(0xFFECE2D8),
      text: Color(0xFF2A1F1A),
      textMuted: Color(0xFF7A6D63),
      primary: Color(0xFFEA580C),
      primaryDark: Color(0xFF9A3412),
      series: _seriesLight8,
      done: Color(0xFF16A34A),
    ),
    dark: AppPalette(
      brightness: Brightness.dark,
      bg: Color(0xFF1C1712),
      surface: Color(0xFF241D17),
      surfaceAlt: Color(0xFF2C231B),
      border: Color(0xFF3A2F26),
      text: Color(0xFFF5EFE8),
      textMuted: Color(0xFFAB9C8F),
      primary: Color(0xFFFB923C),
      primaryDark: Color(0xFF7C2D12),
      series: _seriesDark8,
      done: Color(0xFF34D17C),
    ),
  );

  static const AppSpec routine = AppSpec(
    id: 'routine',
    name: 'Routine App',
    description: 'Catat & cek rutinitas harian, mingguan, bulanan',
    emoji: '🔁',
    themeStorageKey: 'routineapp_theme',
    dbPath: 'routine',
    light: AppPalette(
      brightness: Brightness.light,
      bg: Color(0xFFF4F3FA),
      surface: Color(0xFFFFFFFF),
      surfaceAlt: Color(0xFFEFEDF8),
      border: Color(0xFFDDD8EE),
      text: Color(0xFF211D2C),
      textMuted: Color(0xFF726B87),
      primary: Color(0xFF516395),
      primaryDark: Color(0xFF614385),
      series: [],
      done: Color(0xFF22C55E),
      periodMingguan: Color(0xFF0891B2),
      periodBulanan: Color(0xFF7C3AED),
    ),
    dark: AppPalette(
      brightness: Brightness.dark,
      bg: Color(0xFF17141F),
      surface: Color(0xFF211D2C),
      surfaceAlt: Color(0xFF282433),
      border: Color(0xFF383047),
      text: Color(0xFFECE9F5),
      textMuted: Color(0xFFA39BB8),
      primary: Color(0xFF8B9EE0),
      primaryDark: Color(0xFF7C5CAD),
      series: [],
      done: Color(0xFF4ADE80),
      periodMingguan: Color(0xFF22D3EE),
      periodBulanan: Color(0xFFA78BFA),
    ),
  );

  static const AppSpec patungan = AppSpec(
    id: 'patungan',
    name: 'Patungan App',
    description: 'Bagi biaya nota rame-rame, tau siapa utang ke siapa',
    emoji: '🧾',
    themeStorageKey: 'patunganapp_theme',
    dbPath: 'patungan',
    light: AppPalette(
      brightness: Brightness.light,
      bg: Color(0xFFFDF3F4),
      surface: Color(0xFFFFFFFF),
      surfaceAlt: Color(0xFFFCE8EA),
      border: Color(0xFFF6D9DC),
      text: Color(0xFF2A1A1D),
      textMuted: Color(0xFF8A6B6F),
      primary: Color(0xFFE11D48),
      primaryDark: Color(0xFF9F1239),
      series: [],
      positive: Color(0xFF16A34A),
      negative: Color(0xFFE63946),
    ),
    dark: AppPalette(
      brightness: Brightness.dark,
      bg: Color(0xFF1C1315),
      surface: Color(0xFF26191C),
      surfaceAlt: Color(0xFF2E1F22),
      border: Color(0xFF3D282B),
      text: Color(0xFFF7ECEE),
      textMuted: Color(0xFFAB8B8F),
      primary: Color(0xFFFB7185),
      primaryDark: Color(0xFFBE123C),
      series: [],
      positive: Color(0xFF34D17C),
      negative: Color(0xFFFF6B7A),
    ),
  );

  static const AppSpec note = AppSpec(
    id: 'note',
    name: 'Note App',
    description: 'Catatan aktivitas, reminder, & inspirasi',
    emoji: '📝',
    themeStorageKey: 'noteapp_theme',
    dbPath: 'note',
    light: AppPalette(
      brightness: Brightness.light,
      bg: Color(0xFFFDF6EA),
      surface: Color(0xFFFFF8EC),
      surfaceAlt: Color(0xFFF7ECD9),
      border: Color(0xFFEEDDC0),
      text: Color(0xFF2B2013),
      textMuted: Color(0xFF8A7A5C),
      primary: Color(0xFFD97706),
      primaryDark: Color(0xFF92400E),
      series: _seriesLight8,
    ),
    dark: AppPalette(
      brightness: Brightness.dark,
      bg: Color(0xFF1C150D),
      surface: Color(0xFF241C12),
      surfaceAlt: Color(0xFF2C2216),
      border: Color(0xFF3D2F1C),
      text: Color(0xFFF5ECD9),
      textMuted: Color(0xFFAB9A7A),
      primary: Color(0xFFFBBF24),
      primaryDark: Color(0xFFB45309),
      series: _seriesDark8,
    ),
  );

  static const AppSpec wishlist = AppSpec(
    id: 'wishlist',
    name: 'Wishlist App',
    description: 'Daftar keinginan, kategori & prioritas',
    emoji: '🎁',
    themeStorageKey: 'wishlistapp_theme',
    dbPath: 'wishlist',
    light: AppPalette(
      brightness: Brightness.light,
      bg: Color(0xFFFDF5FA),
      surface: Color(0xFFFFF7FB),
      surfaceAlt: Color(0xFFF9ECF4),
      border: Color(0xFFF0D9E8),
      text: Color(0xFF2B1A29),
      textMuted: Color(0xFF8A7086),
      primary: Color(0xFFC026D3),
      primaryDark: Color(0xFF86198F),
      series: _seriesLight8,
      priorityTinggi: Color(0xFFDC2626),
      prioritySedang: Color(0xFFD97706),
      priorityRendah: Color(0xFF16A34A),
    ),
    dark: AppPalette(
      brightness: Brightness.dark,
      bg: Color(0xFF1A1220),
      surface: Color(0xFF291A2B),
      surfaceAlt: Color(0xFF331F36),
      border: Color(0xFF4A2E4D),
      text: Color(0xFFF5E9F3),
      textMuted: Color(0xFFB89BB5),
      primary: Color(0xFFE879F9),
      primaryDark: Color(0xFFC026D3),
      series: _seriesDark8,
      priorityTinggi: Color(0xFFF87171),
      prioritySedang: Color(0xFFFBBF24),
      priorityRendah: Color(0xFF4ADE80),
    ),
  );

  /// Hub `app/index.html`. Bukan app dengan data sendiri — cuma launcher, jadi
  /// `dbPath` kosong dan tidak ada palet series.
  static const AppSpec hub = AppSpec(
    id: 'hub',
    name: 'Iyon App',
    description: 'Kumpulan aplikasi web & mobile',
    emoji: '📱',
    themeStorageKey: 'iyonapp_theme',
    dbPath: '',
    light: AppPalette(
      brightness: Brightness.light,
      bg: Color(0xFFF5F4FA),
      surface: Color(0xFFFFFFFF),
      surfaceAlt: Color(0xFFEFEDF8),
      border: Color(0xFFE2DEF0),
      text: Color(0xFF211D2C),
      textMuted: Color(0xFF726B87),
      primary: Color(0xFF6D5BD0),
      primaryDark: Color(0xFF9B6BD6),
      series: [],
    ),
    dark: AppPalette(
      brightness: Brightness.dark,
      bg: Color(0xFF16131F),
      surface: Color(0xFF211D2C),
      surfaceAlt: Color(0xFF282433),
      border: Color(0xFF383047),
      text: Color(0xFFECE9F5),
      textMuted: Color(0xFFA39BB8),
      primary: Color(0xFF4F3FA6),
      primaryDark: Color(0xFF7A4FB0),
      series: [],
    ),
  );

  /// Urutan kartu di hub — sengaja BUKAN abjad, mengikuti `app/index.html`
  /// (app baru selalu ditaruh paling bawah).
  static const List<AppSpec> all = [
    finance,
    kitchen,
    routine,
    patungan,
    note,
    wishlist,
  ];
}
