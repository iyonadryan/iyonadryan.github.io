import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/app_palette.dart';
import '../core/widgets/app_host.dart';
import '../core/widgets/app_shell.dart';
import '../core/widgets/settings_common.dart';
import 'pages/dashboard_page.dart';
import 'pages/plans_page.dart';
import 'pages/settings_page.dart';
import 'pages/transactions_page.dart';
import 'store.dart';
import 'ui_state.dart';
import 'widgets/transaction_sheet.dart';

/// Entry Finance App. Punya pengguna aktif (Iyon/Ciwul/Both) — beda dari
/// Kitchen/Patungan/Note/Wishlist.
class FinanceApp extends StatelessWidget {
  const FinanceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return AppHost<FinanceStore>(
      spec: AppSpecs.finance,
      createStore: FinanceStore.new,
      loadingEmojis: '💰 💵 🪙',
      userScopeKey: 'financeapp_user',
      builder: (context) => ChangeNotifierProvider(
        create: (_) => FinanceUiState(),
        child: const _FinanceShell(),
      ),
    );
  }
}

class _FinanceShell extends StatefulWidget {
  const _FinanceShell();

  @override
  State<_FinanceShell> createState() => _FinanceShellState();
}

class _FinanceShellState extends State<_FinanceShell> {
  int _index = 0;

  void _goTo(int i) => setState(() => _index = i);

  @override
  Widget build(BuildContext context) {
    return AppShell(
      title: 'Finance App',
      headerLeading: const HeaderUserIcon(),
      headerActions: const [ThemeToggleButton()],
      currentIndex: _index,
      onNavTap: _goTo,
      // Tambah transaksi bisa dari halaman mana pun. Setelah berhasil, app
      // pindah ke Dashboard — sama dengan `goToPage("dashboard")` di web.
      onAddTap: () async {
        final added = await showTransactionSheet(context);
        if (added ?? false) _goTo(0);
      },
      navItems: const [
        NavItem(icon: Icons.dashboard_outlined, label: 'Dashboard'),
        NavItem(icon: Icons.receipt_long_outlined, label: 'Transaksi'),
        NavItem(icon: Icons.pie_chart_outline, label: 'Rencana'),
        NavItem(icon: Icons.settings_outlined, label: 'Pengaturan'),
      ],
      pages: [
        FinanceDashboardPage(onSeeAllTransactions: () => _goTo(1)),
        const FinanceTransactionsPage(),
        const FinancePlansPage(),
        const FinanceSettingsPage(),
      ],
    );
  }
}
