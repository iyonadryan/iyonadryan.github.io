import 'package:flutter/material.dart';

import '../app_palette.dart';
import '../app_theme.dart';
import '../users.dart';

/// Judul section ("Transaksi Terbaru", "Resep Terbaru", ...) dengan link
/// opsional di kanan ("Lihat Semua"). Padanan `.section-heading`.
class SectionHeading extends StatelessWidget {
  const SectionHeading(this.title, {super.key, this.actionLabel, this.onAction});

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: p.text,
              ),
            ),
          ),
          if (actionLabel != null)
            GestureDetector(
              onTap: onAction,
              child: Text(
                actionLabel!,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: p.primary,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Kartu putih standar (`.card`, `.tx-item`, `.recipe-item`, ...).
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(14),
    this.margin = const EdgeInsets.only(bottom: 10),
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsets padding;
  final EdgeInsets margin;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Container(
      margin: margin,
      decoration: BoxDecoration(
        color: p.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: p.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}

/// Hero card bergradient di Dashboard (`.stat-hero` / `.balance-card`) —
/// beberapa angka besar berdampingan di atas latar gradient brand.
class HeroStatCard extends StatelessWidget {
  const HeroStatCard({super.key, required this.stats, this.trailing});

  final List<({String label, String value})> stats;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: p.cardGradient,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: p.primary.withValues(alpha: 0.3),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          if (trailing != null)
            Align(alignment: Alignment.centerRight, child: trailing),
          Row(
            children: [
              for (final s in stats)
                Expanded(
                  child: Column(
                    children: [
                      Text(
                        s.value,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        s.label,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.85),
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Empty state (`.empty-state`) — ikon besar + pesan.
class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.message});

  final String icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 36),
      child: Column(
        children: [
          Text(icon, style: const TextStyle(fontSize: 40)),
          const SizedBox(height: 10),
          Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(color: p.textMuted, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

/// Tombol utama bergradient brand (`.btn-primary`).
class GradientButton extends StatelessWidget {
  const GradientButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.gradient,
  });

  final String label;
  final VoidCallback? onPressed;

  /// Override gradient — dipakai tombol "Iyon App" (`.btn-hub`) yang sengaja
  /// selalu ungu hub, bukan warna primary app-nya.
  final LinearGradient? gradient;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final enabled = onPressed != null;

    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        clipBehavior: Clip.antiAlias,
        child: Ink(
          decoration: BoxDecoration(
            gradient: gradient ?? p.buttonGradient,
            borderRadius: BorderRadius.circular(12),
          ),
          child: InkWell(
            onTap: onPressed,
            child: Container(
              height: 48,
              alignment: Alignment.center,
              child: Text(
                label,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Tombol sekunder (`.btn-secondary`) — outline, warna teks ikut tema.
class SecondaryButton extends StatelessWidget {
  const SecondaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.invert = false,
  });

  final String label;
  final VoidCallback? onPressed;

  /// `.btn-invert` — warna dibalik per tema (hitam/teks putih di light,
  /// putih/teks hitam di dark). Dipakai tombol "Ubah" & "+ Buat Kategori Baru".
  final bool invert;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    if (invert) {
      final bg = p.isDark ? Colors.white : Colors.black;
      final fg = p.isDark ? Colors.black : Colors.white;
      return SizedBox(
        height: 48,
        child: FilledButton(
          onPressed: onPressed,
          style: FilledButton.styleFrom(
            backgroundColor: bg,
            foregroundColor: fg,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          child: Text(label),
        ),
      );
    }

    return SizedBox(
      height: 48,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: p.text,
          side: BorderSide(color: p.border),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        child: Text(label),
      ),
    );
  }
}

/// Tombol ikon bergradient (`.icon-btn.accent`) — mis. `+` di header halaman
/// Rencana / Belanja.
class AccentIconButton extends StatelessWidget {
  const AccentIconButton({
    super.key,
    required this.icon,
    required this.onPressed,
    this.size = 38,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final double size;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final enabled = onPressed != null;

    return Material(
      color: Colors.transparent,
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: Ink(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: enabled ? p.buttonGradient : null,
          color: enabled ? null : p.surfaceAlt,
        ),
        child: InkWell(
          onTap: onPressed,
          child: SizedBox(
            width: size,
            height: size,
            child: Icon(
              icon,
              size: size * 0.5,
              color: enabled ? Colors.white : p.textMuted,
            ),
          ),
        ),
      ),
    );
  }
}

/// Baris tab filter (`.filter-tab`) — dipakai filter tipe transaksi, kategori
/// resep, periode rencana, prioritas wishlist, dst.
class FilterTabs<T> extends StatelessWidget {
  const FilterTabs({
    super.key,
    required this.tabs,
    required this.selected,
    required this.onSelected,
    this.label,
    this.activeColorOf,
  });

  final List<({T value, String label})> tabs;
  final T selected;
  final ValueChanged<T> onSelected;

  /// Label kecil di atas baris tab (`.filter-label`) — cuma dipakai Wishlist
  /// yang punya dua baris filter (Kategori & Prioritas).
  final String? label;

  /// Warna tab saat aktif, per-nilai. Default `primary`. Routine (warna
  /// periode) & Wishlist (warna prioritas) memakai warna sendiri.
  final Color Function(T value)? activeColorOf;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (label != null) ...[
          Text(
            label!.toUpperCase(),
            style: TextStyle(
              fontSize: 10,
              letterSpacing: 0.8,
              fontWeight: FontWeight.w700,
              color: p.textMuted,
            ),
          ),
          const SizedBox(height: 6),
        ],
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final t in tabs)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: _tab(context, t),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _tab(BuildContext context, ({T value, String label}) t) {
    final p = context.palette;
    final active = t.value == selected;
    final activeColor = activeColorOf?.call(t.value) ?? p.primary;

    return GestureDetector(
      onTap: () => onSelected(t.value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: active ? activeColor : p.surface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: active ? activeColor : p.border),
        ),
        child: Text(
          t.label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: active ? FontWeight.w600 : FontWeight.w500,
            color: active ? Colors.white : p.textMuted,
          ),
        ),
      ),
    );
  }
}

/// Toggle 2–3 tombol (`.type-toggle` / `.mode-toggle`) — tipe transaksi,
/// "Dibuat oleh", mode harian, prioritas.
class SegmentToggle<T> extends StatelessWidget {
  const SegmentToggle({
    super.key,
    required this.options,
    required this.selected,
    required this.onSelected,
    this.locked = false,
    this.activeColorOf,
  });

  final List<({T value, String label})> options;
  final T selected;
  final ValueChanged<T> onSelected;

  /// Dikunci saat mode edit (tipe/kategori/pembuat tidak boleh diubah) —
  /// padanan `setImmutableFieldsLocked(true)` / `.mode-toggle.locked`.
  final bool locked;

  final Color Function(T value)? activeColorOf;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    return Opacity(
      opacity: locked ? 0.6 : 1,
      child: Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: p.surfaceAlt,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: p.border),
        ),
        child: Row(
          children: [
            for (final o in options)
              Expanded(
                child: GestureDetector(
                  onTap: locked ? null : () => onSelected(o.value),
                  child: Container(
                    height: 38,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: o.value == selected
                          ? (activeColorOf?.call(o.value) ?? p.primary)
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(9),
                    ),
                    child: Text(
                      o.label,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: o.value == selected ? Colors.white : p.textMuted,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Field form di dalam modal (`.field`) — label di atas, input di bawah.
class FieldBox extends StatelessWidget {
  const FieldBox({super.key, required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: p.textMuted,
            ),
          ),
          const SizedBox(height: 6),
          child,
        ],
      ),
    );
  }
}

/// Picker warna kategori (`.slot-picker`) — N lingkaran `--series-1..N`.
class SlotPicker extends StatelessWidget {
  const SlotPicker({
    super.key,
    required this.selected,
    required this.onSelected,
    required this.palette,
  });

  final int selected;
  final ValueChanged<int> onSelected;
  final AppPalette palette;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        for (var slot = 1; slot <= palette.series.length; slot++)
          GestureDetector(
            onTap: () => onSelected(slot),
            child: Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: palette.seriesSlot(slot),
                shape: BoxShape.circle,
                border: Border.all(
                  color: slot == selected ? palette.text : Colors.transparent,
                  width: 2.5,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Foto kecil pembuat di pojok ikon kartu (`.creator-badge`). Klik → info
/// pembuat (`openCreatorInfo()` di versi web).
class CreatorBadge extends StatelessWidget {
  const CreatorBadge({super.key, required this.by, this.size = 18});

  final String by;
  final double size;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final user = Users.byId(by);

    return GestureDetector(
      onTap: () => showCreatorInfo(context, by),
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: p.surface, width: 1.5),
          image: DecorationImage(image: user.image, fit: BoxFit.cover),
        ),
      ),
    );
  }
}

Future<void> showCreatorInfo(BuildContext context, String by) {
  final user = Users.byId(by);
  return showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      content: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircleAvatar(radius: 22, backgroundImage: user.image),
          const SizedBox(width: 14),
          Flexible(
            child: Text(
              'Dibuat oleh: ${user.label}',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: const Text('Tutup'),
        ),
      ],
    ),
  );
}

/// Ikon kategori bulat berwarna slot (`.tx-icon` / `.recipe-icon`), dengan
/// badge pembuat opsional di pojok kanan-bawah.
class CategoryIcon extends StatelessWidget {
  const CategoryIcon({
    super.key,
    required this.emoji,
    required this.color,
    this.by,
    this.size = 44,
  });

  final String emoji;
  final Color color;

  /// Non-null → badge pembuat ditempel di pojok.
  final String? by;
  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              // Latar lembut dari warna kategori — padanan `color-mix()` di CSS.
              color: color.withValues(alpha: 0.16),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(emoji, style: TextStyle(fontSize: size * 0.45)),
          ),
          if (by != null)
            Positioned(
              right: -2,
              bottom: -2,
              child: CreatorBadge(by: by!),
            ),
        ],
      ),
    );
  }
}

/// Badge kecil kategori/periode/prioritas di kartu (`.tx-badge`).
class AppChip extends StatelessWidget {
  const AppChip({
    super.key,
    required this.label,
    required this.color,
    this.icon,
  });

  final String label;
  final Color color;
  final String? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        icon == null ? label : '$icon $label',
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}

// --- Modal & dialog --------------------------------------------------------

/// Bottom sheet (`.modal-overlay` + `.modal-sheet`) — modal tambah/ubah &
/// popup detail di semua app. Bisa ditutup dengan tap area gelap di luar sheet,
/// sama seperti web.
Future<T?> showAppSheet<T>({
  required BuildContext context,
  required String title,
  required Widget Function(BuildContext context) builder,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: context.palette.surface,
    builder: (ctx) {
      final p = ctx.palette;
      return Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(ctx).bottom,
        ),
        child: DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.75,
          maxChildSize: 0.95,
          minChildSize: 0.4,
          builder: (ctx2, scrollController) => Column(
            children: [
              Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: p.border,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: p.text,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(ctx2),
                      icon: Icon(Icons.close, color: p.textMuted),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                  child: builder(ctx2),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}

/// Dialog konfirmasi terpusat (`#confirmModal`). Satu callback, sama pola
/// dengan `openConfirm(title, text, onConfirm)` di Kitchen/Routine/Patungan.
/// Mengembalikan `true` kalau user menekan tombol merah.
Future<bool> confirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = 'Ya, Hapus',
}) async {
  final p = context.palette;
  final result = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
      content: Text(message, style: TextStyle(color: p.textMuted)),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: Text('Batal', style: TextStyle(color: p.textMuted)),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(ctx, true),
          style: FilledButton.styleFrom(
            backgroundColor: p.expense ?? p.negative ?? const Color(0xFFE63946),
          ),
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return result ?? false;
}

/// Overlay loading (`#loadingOverlay`) — emoji memantul sampai snapshot
/// Firebase pertama tiba.
class LoadingOverlay extends StatelessWidget {
  const LoadingOverlay({super.key, required this.emojis});

  final String emojis;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return ColoredBox(
      color: p.bg,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(emojis, style: const TextStyle(fontSize: 34)),
            const SizedBox(height: 18),
            SizedBox(
              width: 26,
              height: 26,
              child: CircularProgressIndicator(strokeWidth: 2.5, color: p.primary),
            ),
          ],
        ),
      ),
    );
  }
}

/// Baris di halaman Pengaturan (`.settings-item`).
class SettingsCard extends StatelessWidget {
  const SettingsCard({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
    this.child,
    this.onTap,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;
  final Widget? child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: p.text,
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 3),
                      Text(
                        subtitle!,
                        style: TextStyle(fontSize: 12, color: p.textMuted),
                      ),
                    ],
                  ],
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          if (child != null) ...[const SizedBox(height: 12), child!],
        ],
      ),
    );
  }
}
