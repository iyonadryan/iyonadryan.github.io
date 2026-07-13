import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_palette.dart';
import '../app_theme.dart';
import '../users.dart';
import 'ui.dart';

/// Baris "Mode Tampilan" di Pengaturan — toggle light/dark, sama fungsi dengan
/// tombol ☀️/🌙 di header.
class ThemeSettingsCard extends StatelessWidget {
  const ThemeSettingsCard({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<ThemeController>();
    final dark = controller.effectiveBrightness(context) == Brightness.dark;

    return SettingsCard(
      title: 'Mode Tampilan',
      subtitle: dark ? 'Gelap' : 'Terang',
      trailing: Switch(
        value: dark,
        onChanged: (_) => controller.toggle(context),
      ),
    );
  }
}

/// Tombol ☀️/🌙 di header. Ikon merepresentasikan **aksi saat diklik** (bukan
/// state sekarang) — pola sama dengan `applyTheme()` di versi web.
class ThemeToggleButton extends StatelessWidget {
  const ThemeToggleButton({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<ThemeController>();
    final dark = controller.effectiveBrightness(context) == Brightness.dark;

    return IconButton(
      onPressed: () => controller.toggle(context),
      icon: Text(dark ? '☀️' : '🌙', style: const TextStyle(fontSize: 17)),
      tooltip: 'Ganti tema',
    );
  }
}

/// Kartu "Semua Aplikasi" → balik ke hub. Tombolnya sengaja **selalu gradient
/// ungu hub** (`.btn-hub`), bukan warna primary app-nya — permintaan eksplisit
/// user supaya "pintu balik ke hub" konsisten di semua app.
class HubSettingsCard extends StatelessWidget {
  const HubSettingsCard({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    return SettingsCard(
      title: 'Semua Aplikasi',
      subtitle: 'Kembali ke daftar aplikasi Iyon App',
      child: GradientButton(
        label: 'Iyon App',
        gradient: HubGradient.of(p.brightness),
        onPressed: () => Navigator.of(context).pop(),
      ),
    );
  }
}

class AboutSettingsCard extends StatelessWidget {
  const AboutSettingsCard({super.key, required this.appName, required this.text});

  final String appName;
  final String text;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return SettingsCard(
      title: 'Tentang',
      child: Text(
        text,
        style: TextStyle(fontSize: 12.5, color: p.textMuted, height: 1.5),
      ),
    );
  }
}

// --- Pengguna aktif (Finance & Routine App saja) ---------------------------

/// Overlay full-screen "pilih pengguna" saat app dibuka pertama kali dan belum
/// ada pilihan tersimpan. Padanan `#userSelectOverlay`.
class UserSelectOverlay extends StatelessWidget {
  const UserSelectOverlay({super.key, required this.onSelected});

  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    return ColoredBox(
      color: p.bg,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Siapa yang pakai?',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: p.text,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Bisa diganti kapan saja dari Pengaturan.',
                style: TextStyle(color: p.textMuted, fontSize: 13),
              ),
              const SizedBox(height: 26),
              UserOptionRow(onSelected: onSelected),
            ],
          ),
        ),
      ),
    );
  }
}

/// Tiga tombol besar (foto + label) Iyon / Ciwul / Both. Dipakai bareng oleh
/// overlay pilih pengguna & modal Ganti Pengguna.
class UserOptionRow extends StatelessWidget {
  const UserOptionRow({super.key, required this.onSelected, this.selected});

  final ValueChanged<String> onSelected;
  final String? selected;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (final u in Users.selectable)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6),
            child: GestureDetector(
              onTap: () => onSelected(u.id),
              child: Container(
                width: 92,
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  color: p.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: u.id == selected ? p.primary : p.border,
                    width: u.id == selected ? 2 : 1,
                  ),
                ),
                child: Column(
                  children: [
                    CircleAvatar(radius: 26, backgroundImage: u.image),
                    const SizedBox(height: 8),
                    Text(
                      u.label,
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: p.text,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Modal Ganti Pengguna — gaya **popup tengah layar** (bukan bottom-sheet),
/// permintaan eksplisit user. Dipanggil dari dua tempat: foto pengguna di
/// header, dan tombol "Ganti" di Pengaturan.
Future<void> showUserSwitchDialog(BuildContext context, UserScope scope) {
  return showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text(
        'Ganti Pengguna',
        style: TextStyle(fontWeight: FontWeight.w700),
      ),
      content: UserOptionRow(
        selected: scope.currentUserId,
        onSelected: (id) {
          scope.select(id);
          Navigator.pop(ctx);
        },
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: const Text('Batal'),
        ),
      ],
    ),
  );
}

/// Foto pengguna aktif di header — diklik langsung buka modal Ganti Pengguna
/// tanpa harus buka Pengaturan dulu (permintaan eksplisit user).
class HeaderUserIcon extends StatelessWidget {
  const HeaderUserIcon({super.key});

  @override
  Widget build(BuildContext context) {
    final scope = context.watch<UserScope>();

    return GestureDetector(
      onTap: () => showUserSwitchDialog(context, scope),
      child: CircleAvatar(
        radius: 16,
        backgroundImage: scope.currentUser.image,
      ),
    );
  }
}

/// Kartu "Pengguna Aktif" di Pengaturan.
class ActiveUserCard extends StatelessWidget {
  const ActiveUserCard({super.key});

  @override
  Widget build(BuildContext context) {
    final scope = context.watch<UserScope>();

    return SettingsCard(
      title: 'Pengguna Aktif',
      subtitle: scope.currentUser.label,
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircleAvatar(radius: 16, backgroundImage: scope.currentUser.image),
          const SizedBox(width: 10),
          OutlinedButton(
            onPressed: () => showUserSwitchDialog(context, scope),
            child: const Text('Ganti'),
          ),
        ],
      ),
    );
  }
}
