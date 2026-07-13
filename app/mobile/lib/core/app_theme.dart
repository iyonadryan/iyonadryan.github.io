import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_palette.dart';

/// Pembungkus [AppPalette] supaya bisa diambil dari mana saja lewat
/// `Theme.of(context)` — padanan "CSS variable" versi Flutter. Tanpa ini tiap
/// widget harus dioper palette-nya manual lewat konstruktor.
@immutable
class PaletteTheme extends ThemeExtension<PaletteTheme> {
  const PaletteTheme(this.palette);

  final AppPalette palette;

  @override
  PaletteTheme copyWith({AppPalette? palette}) =>
      PaletteTheme(palette ?? this.palette);

  /// Palet tidak di-lerp saat animasi ganti tema — pindah light↔dark langsung
  /// menukar seluruh set warna, sama seperti CSS yang menukar `data-theme`.
  @override
  PaletteTheme lerp(PaletteTheme? other, double t) =>
      t < 0.5 ? this : (other ?? this);
}

extension PaletteContext on BuildContext {
  AppPalette get palette =>
      Theme.of(this).extension<PaletteTheme>()!.palette;
}

/// [ThemeData] dari satu [AppPalette]. Radius & tinggi nav mengikuti
/// `--radius-*` / `--nav-height` di `css/base.css` (sama di semua app).
ThemeData buildAppTheme(AppPalette p) {
  final base = ThemeData(brightness: p.brightness, useMaterial3: true);

  return base.copyWith(
    scaffoldBackgroundColor: p.bg,
    canvasColor: p.surface,
    dividerColor: p.border,
    colorScheme: ColorScheme.fromSeed(
      seedColor: p.primary,
      brightness: p.brightness,
    ).copyWith(
      primary: p.primary,
      surface: p.surface,
      onSurface: p.text,
      error: p.expense ?? p.negative ?? const Color(0xFFE63946),
    ),
    textTheme: base.textTheme.apply(
      bodyColor: p.text,
      displayColor: p.text,
    ),
    iconTheme: IconThemeData(color: p.text),
    cardTheme: CardThemeData(
      color: p.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: p.surfaceAlt,
      hintStyle: TextStyle(color: p.textMuted),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: p.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: p.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: p.primary, width: 1.6),
      ),
      disabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: p.border),
      ),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: p.surface,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: p.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    ),
    extensions: [PaletteTheme(p)],
  );
}

/// Preferensi tema per-app, disimpan di SharedPreferences dengan key yang sama
/// persis dengan localStorage versi web (`financeapp_theme`, `kitchenapp_theme`,
/// `iyonapp_theme`, ...). Tiap app punya state-nya sendiri — ganti tema di
/// Finance tidak mengubah tema Kitchen, sama seperti di web.
///
/// Belum ada preferensi tersimpan → ikut tema sistem (padanan fallback
/// `prefers-color-scheme` di web).
class ThemeController extends ChangeNotifier {
  ThemeController(this.spec);

  final AppSpec spec;

  ThemeMode _mode = ThemeMode.system;
  ThemeMode get mode => _mode;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    switch (prefs.getString(spec.themeStorageKey)) {
      case 'light':
        _mode = ThemeMode.light;
      case 'dark':
        _mode = ThemeMode.dark;
      default:
        _mode = ThemeMode.system;
    }
    notifyListeners();
  }

  /// Brightness yang benar-benar tampil sekarang — perlu dibaca dulu sebelum
  /// toggle, karena mode `system` tidak tahu sedang gelap atau terang.
  Brightness effectiveBrightness(BuildContext context) => switch (_mode) {
        ThemeMode.light => Brightness.light,
        ThemeMode.dark => Brightness.dark,
        ThemeMode.system => MediaQuery.platformBrightnessOf(context),
      };

  Future<void> toggle(BuildContext context) async {
    final next = effectiveBrightness(context) == Brightness.dark
        ? ThemeMode.light
        : ThemeMode.dark;
    _mode = next;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      spec.themeStorageKey,
      next == ThemeMode.dark ? 'dark' : 'light',
    );
  }
}
