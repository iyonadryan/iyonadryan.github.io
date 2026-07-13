import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_palette.dart';
import '../app_store.dart';
import '../app_theme.dart';
import '../users.dart';
import 'settings_common.dart';
import 'ui.dart';

/// Pembungkus satu app. Tiap app di-`push` dari hub sebagai satu route, dan di
/// dalam route itu dia punya dunia sendiri:
///
/// - **Tema sendiri** (palet + preferensi light/dark tersimpan di key-nya
///   sendiri) — ganti tema di Finance tidak mengubah Kitchen, sama seperti web.
/// - **Store sendiri** (satu listener realtime ke node Firebase-nya).
/// - **Pengguna aktif sendiri** — opsional, cuma Finance & Routine.
///
/// Selama snapshot pertama Firebase belum tiba, [LoadingOverlay] menutup layar
/// (padanan `#loadingOverlay`). Kalau app punya pengguna aktif tapi belum ada
/// pilihan tersimpan, [UserSelectOverlay] tampil di atasnya.
class AppHost<S extends AppStore> extends StatefulWidget {
  const AppHost({
    super.key,
    required this.spec,
    required this.createStore,
    required this.loadingEmojis,
    required this.builder,
    this.userScopeKey,
  });

  final AppSpec spec;
  final S Function() createStore;
  final String loadingEmojis;
  final Widget Function(BuildContext context) builder;

  /// Key SharedPreferences pengguna aktif (`financeapp_user`, `routineapp_user`).
  /// `null` → app ini tidak punya konsep pengguna aktif (Kitchen, Patungan,
  /// Note, Wishlist).
  final String? userScopeKey;

  @override
  State<AppHost<S>> createState() => _AppHostState<S>();
}

class _AppHostState<S extends AppStore> extends State<AppHost<S>> {
  late final ThemeController _theme = ThemeController(widget.spec);
  late final S _store = widget.createStore();
  late final UserScope? _scope =
      widget.userScopeKey == null ? null : UserScope(widget.userScopeKey!);

  bool _prefsLoaded = false;

  @override
  void initState() {
    super.initState();
    _store.subscribe();
    _loadPrefs();
  }

  Future<void> _loadPrefs() async {
    await _theme.load();
    await _scope?.load();
    if (mounted) setState(() => _prefsLoaded = true);
  }

  @override
  void dispose() {
    _store.dispose();
    _theme.dispose();
    _scope?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<ThemeController>.value(value: _theme),
        ChangeNotifierProvider<S>.value(value: _store),
        if (_scope != null) ChangeNotifierProvider<UserScope>.value(value: _scope),
      ],
      child: Consumer<ThemeController>(
        builder: (context, theme, _) {
          final brightness = theme.effectiveBrightness(context);
          final data = buildAppTheme(widget.spec.palette(brightness));

          return Theme(
            data: data,
            child: Builder(
              builder: (themedContext) => _body(themedContext),
            ),
          );
        },
      ),
    );
  }

  Widget _body(BuildContext context) {
    // Preferensi belum kebaca ATAU snapshot Firebase pertama belum tiba.
    if (!_prefsLoaded) {
      return LoadingOverlay(emojis: widget.loadingEmojis);
    }

    final scope = _scope;
    if (scope != null && !scope.hasSelection) {
      return UserSelectOverlay(onSelected: scope.select);
    }

    return ListenableBuilder(
      listenable: _store,
      builder: (context, _) {
        if (_store.loading) {
          return LoadingOverlay(emojis: widget.loadingEmojis);
        }
        if (_store.error != null) {
          return _errorScreen(context);
        }
        return widget.builder(context);
      },
    );
  }

  Widget _errorScreen(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      backgroundColor: p.bg,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('📡', style: TextStyle(fontSize: 40)),
              const SizedBox(height: 12),
              Text(
                'Gagal memuat data',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: p.text,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Cek koneksi internet, lalu coba lagi.',
                textAlign: TextAlign.center,
                style: TextStyle(color: p.textMuted),
              ),
              const SizedBox(height: 20),
              GradientButton(
                label: 'Coba Lagi',
                onPressed: () => setState(_store.subscribe),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
