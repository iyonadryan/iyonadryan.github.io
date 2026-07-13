import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/app_palette.dart';
import '../core/app_theme.dart';
import '../finance/finance_app.dart';
import '../kitchen/kitchen_app.dart';
import '../note/note_app.dart';
import '../patungan/patungan_app.dart';
import '../routine/routine_app.dart';
import '../wishlist/wishlist_app.dart';

/// Hub — padanan `app/index.html`. Cuma launcher: daftar kartu app, tanpa
/// bottom nav dan tanpa data sendiri.
class HubPage extends StatefulWidget {
  const HubPage({super.key});

  @override
  State<HubPage> createState() => _HubPageState();
}

class _HubPageState extends State<HubPage> {
  final ThemeController _theme = ThemeController(AppSpecs.hub);

  @override
  void initState() {
    super.initState();
    _theme.load();
  }

  @override
  void dispose() {
    _theme.dispose();
    super.dispose();
  }

  /// Route ke app-nya. Tiap app punya tema & store sendiri di dalam route ini,
  /// jadi hub tidak perlu tahu apa-apa soal isinya.
  Widget _pageFor(String id) => switch (id) {
        'finance' => const FinanceApp(),
        'kitchen' => const KitchenApp(),
        'routine' => const RoutineApp(),
        'patungan' => const PatunganApp(),
        'note' => const NoteApp(),
        'wishlist' => const WishlistApp(),
        _ => throw ArgumentError('App tidak dikenal: $id'),
      };

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<ThemeController>.value(
      value: _theme,
      child: Consumer<ThemeController>(
        builder: (context, theme, _) {
          final brightness = theme.effectiveBrightness(context);
          final p = AppSpecs.hub.palette(brightness);

          return Theme(
            data: buildAppTheme(p),
            child: Scaffold(
              backgroundColor: p.bg,
              body: ListView(
                padding: EdgeInsets.zero,
                children: [
                  _Hero(
                    palette: p,
                    onToggleTheme: () => theme.toggle(context),
                    isDark: brightness == Brightness.dark,
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 20, 16, 28),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'APLIKASI',
                          style: TextStyle(
                            fontSize: 11,
                            letterSpacing: 1,
                            fontWeight: FontWeight.w700,
                            color: p.textMuted,
                          ),
                        ),
                        const SizedBox(height: 12),
                        for (var i = 0; i < AppSpecs.all.length; i++)
                          _StaggeredEntry(
                            index: i,
                            child: _AppCard(
                              spec: AppSpecs.all[i],
                              hubPalette: p,
                              onTap: () => Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => _pageFor(AppSpecs.all[i].id),
                                ),
                              ),
                            ),
                          ),
                        _StaggeredEntry(
                          index: AppSpecs.all.length,
                          child: _EmptySlot(palette: p),
                        ),
                        const SizedBox(height: 20),
                        Center(
                          child: Text(
                            'Iyon App · iyonadryan.github.io',
                            style: TextStyle(fontSize: 11, color: p.textMuted),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({
    required this.palette,
    required this.onToggleTheme,
    required this.isDark,
  });

  final AppPalette palette;
  final VoidCallback onToggleTheme;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        20,
        MediaQuery.paddingOf(context).top + 20,
        20,
        28,
      ),
      decoration: BoxDecoration(
        gradient: HubGradient.of(palette.brightness),
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(24)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Align(
            alignment: Alignment.centerRight,
            child: IconButton(
              onPressed: onToggleTheme,
              icon: Text(
                // Ikon = aksi saat diklik, bukan state sekarang.
                isDark ? '☀️' : '🌙',
                style: const TextStyle(fontSize: 18),
              ),
              tooltip: 'Ganti tema',
            ),
          ),
          const Text(
            'Iyon App',
            style: TextStyle(
              color: Colors.white,
              fontSize: 26,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Kumpulan aplikasi web & mobile',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.85),
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}

/// Animasi masuk kartu: geser dari bawah + fade in, **delay 0,25 detik
/// berjenjang** antar kartu — permintaan eksplisit user di versi web
/// (`@keyframes cardEnter`). Delay dihitung dari urutan, jadi menambah app baru
/// otomatis ikut kena stagger tanpa menyentuh kode animasi.
class _StaggeredEntry extends StatefulWidget {
  const _StaggeredEntry({required this.index, required this.child});

  final int index;
  final Widget child;

  @override
  State<_StaggeredEntry> createState() => _StaggeredEntryState();
}

class _StaggeredEntryState extends State<_StaggeredEntry>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 420),
  );

  @override
  void initState() {
    super.initState();

    // Padanan fallback `prefers-reduced-motion: reduce` di CSS. Dibaca dari
    // `accessibilityFeatures` (bukan MediaQuery) karena MediaQuery.of tidak
    // boleh dipanggil dari initState.
    if (WidgetsBinding.instance.accessibilityFeatures.disableAnimations) {
      _c.value = 1;
      return;
    }

    Future<void>.delayed(
      Duration(milliseconds: widget.index * 250),
      () {
        if (mounted) _c.forward();
      },
    );
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final curved = CurvedAnimation(parent: _c, curve: Curves.easeOutCubic);
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.22),
          end: Offset.zero,
        ).animate(curved),
        child: widget.child,
      ),
    );
  }
}

class _AppCard extends StatelessWidget {
  const _AppCard({
    required this.spec,
    required this.hubPalette,
    required this.onTap,
  });

  final AppSpec spec;
  final AppPalette hubPalette;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    // Ikon kartu memakai gradient brand app-nya sendiri (💰 teal utk Finance,
    // 🍳 oranye utk Kitchen, dst.) — bukan warna hub.
    final appPalette = spec.palette(hubPalette.brightness);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: hubPalette.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: hubPalette.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    gradient: appPalette.cardGradient,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    spec.emoji,
                    style: const TextStyle(fontSize: 22),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        spec.name,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: hubPalette.text,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        spec.description,
                        style: TextStyle(
                          fontSize: 12,
                          color: hubPalette.textMuted,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  Icons.chevron_right,
                  color: hubPalette.textMuted,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Placeholder dashed "app berikutnya" — sama dengan `.empty-slot` di web.
class _EmptySlot extends StatelessWidget {
  const _EmptySlot({required this.palette});

  final AppPalette palette;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: palette.border),
        color: palette.surfaceAlt.withValues(alpha: 0.5),
      ),
      alignment: Alignment.center,
      child: Text(
        '+ Aplikasi berikutnya nanti muncul di sini',
        style: TextStyle(fontSize: 12, color: palette.textMuted),
      ),
    );
  }
}
