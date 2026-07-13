import 'package:flutter/material.dart';

import '../app_theme.dart';

/// Satu tab di bottom nav. Slot tengah (tombol `+`) TIDAK ikut list ini —
/// dia disisipkan otomatis oleh [AppShell] di antara item ke-2 dan ke-3,
/// persis seperti `.nav-add` di versi web.
@immutable
class NavItem {
  const NavItem({required this.icon, required this.label});

  final IconData icon;
  final String label;
}

/// Kerangka halaman yang dipakai keenam app: header + body (IndexedStack) +
/// bottom nav 4 tab dengan tombol `+` bergradient menonjol di tengah.
///
/// Padanan `.app-shell` + `.header` + `.bottom-nav` di CSS versi web. Tombol
/// `+` **selalu tampil di semua halaman** (sama dengan web), bukan cuma di
/// halaman list.
class AppShell extends StatelessWidget {
  const AppShell({
    super.key,
    required this.title,
    required this.navItems,
    required this.currentIndex,
    required this.onNavTap,
    required this.onAddTap,
    required this.pages,
    this.headerLeading,
    this.headerActions = const [],
  });

  final String title;
  final List<NavItem> navItems;
  final int currentIndex;
  final ValueChanged<int> onNavTap;
  final VoidCallback onAddTap;
  final List<Widget> pages;
  final Widget? headerLeading;
  final List<Widget> headerActions;

  @override
  Widget build(BuildContext context) {
    assert(navItems.length == 4, 'Bottom nav selalu 4 tab + tombol tengah');
    final p = context.palette;

    return Scaffold(
      backgroundColor: p.bg,
      appBar: AppBar(
        backgroundColor: p.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        titleSpacing: headerLeading == null ? null : 8,
        leading: headerLeading == null
            ? null
            : Padding(
                padding: const EdgeInsets.only(left: 12),
                child: headerLeading,
              ),
        leadingWidth: headerLeading == null ? null : 52,
        title: Text(
          title,
          style: TextStyle(
            color: p.text,
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
        actions: [...headerActions, const SizedBox(width: 4)],
        shape: Border(bottom: BorderSide(color: p.border)),
      ),
      body: IndexedStack(index: currentIndex, children: pages),
      bottomNavigationBar: _BottomNav(
        items: navItems,
        currentIndex: currentIndex,
        onTap: onNavTap,
        onAddTap: onAddTap,
      ),
    );
  }
}

class _BottomNav extends StatelessWidget {
  const _BottomNav({
    required this.items,
    required this.currentIndex,
    required this.onTap,
    required this.onAddTap,
  });

  final List<NavItem> items;
  final int currentIndex;
  final ValueChanged<int> onTap;
  final VoidCallback onAddTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    return Container(
      decoration: BoxDecoration(
        color: p.surface,
        border: Border(top: BorderSide(color: p.border)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 64,
          child: Row(
            children: [
              _tab(context, 0),
              _tab(context, 1),
              Expanded(child: Center(child: _addButton(context))),
              _tab(context, 2),
              _tab(context, 3),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tab(BuildContext context, int i) {
    final p = context.palette;
    final active = currentIndex == i;
    final color = active ? p.primary : p.textMuted;

    return Expanded(
      child: InkWell(
        onTap: () => onTap(i),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(items[i].icon, size: 22, color: color),
            const SizedBox(height: 2),
            Text(
              items[i].label,
              style: TextStyle(
                fontSize: 11,
                color: color,
                fontWeight: active ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// `.nav-add` — bulat, bergradient brand, menonjol ke atas dari bar.
  Widget _addButton(BuildContext context) {
    final p = context.palette;

    return Transform.translate(
      offset: const Offset(0, -10),
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: Ink(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: p.buttonGradient,
            boxShadow: [
              BoxShadow(
                color: p.primary.withValues(alpha: 0.35),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: InkWell(
            onTap: onAddTap,
            child: const SizedBox(
              width: 54,
              height: 54,
              child: Icon(Icons.add, color: Colors.white, size: 28),
            ),
          ),
        ),
      ),
    );
  }
}

/// Isi tiap halaman: scroll + padding standar, dengan ruang bawah supaya konten
/// terakhir tidak ketutup bottom nav. Padanan `.page` di CSS.
class PageBody extends StatelessWidget {
  const PageBody({super.key, required this.children, this.padding});

  final List<Widget> children;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: padding ?? const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: children,
    );
  }
}
