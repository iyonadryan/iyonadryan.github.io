import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../core/app_theme.dart';
import '../core/formatters.dart';
import '../core/widgets/ui.dart';
import 'store.dart';

/// Popup Detail Trip. Isinya **reaktif** terhadap perubahan dari device lain
/// (peserta/nota bisa ditambah orang lain saat popup masih terbuka — skenario
/// realistis waktu lagi trip beneran), makanya dibungkus `Consumer` dan trip-nya
/// dibaca ulang by id tiap rebuild, bukan disimpan sebagai snapshot.
Future<void> showTripDetail(BuildContext context, String tripId) {
  return showAppSheet<void>(
    context: context,
    title: 'Detail Trip',
    builder: (ctx) => Consumer<PatunganStore>(
      builder: (ctx2, store, _) {
        final trip = store.tripById(tripId);
        // Trip dihapus dari device lain saat popup terbuka.
        if (trip == null) {
          return const EmptyState(
            icon: '🗑️',
            message: 'Trip ini sudah dihapus.',
          );
        }
        return _TripDetailBody(trip: trip);
      },
    ),
  );
}

class _TripDetailBody extends StatelessWidget {
  const _TripDetailBody({required this.trip});

  final Trip trip;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final store = context.read<PatunganStore>();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                trip.name,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: p.text,
                ),
              ),
            ),
            IconButton(
              icon: const Text('✏️', style: TextStyle(fontSize: 15)),
              onPressed: () => showTripSheet(context, editing: trip),
            ),
            IconButton(
              icon: const Text('🗑️', style: TextStyle(fontSize: 15)),
              onPressed: () async {
                final ok = await confirmDialog(
                  context,
                  title: 'Hapus Trip?',
                  message: 'Semua peserta & nota di trip "${trip.name}" ikut '
                      'terhapus.',
                );
                if (!ok) return;
                await store.deleteTrip(trip.id);
                if (context.mounted) Navigator.pop(context);
              },
            ),
          ],
        ),
        Text(
          '${trip.participants.length} peserta · ${trip.expenses.length} nota · '
          '${formatCurrency(trip.total)}',
          style: TextStyle(fontSize: 12, color: p.textMuted),
        ),
        const SizedBox(height: 20),
        const SectionHeading('Peserta'),
        _Participants(trip: trip),
        const SizedBox(height: 20),
        Row(
          children: [
            const Expanded(child: SectionHeading('Pengeluaran (Nota)')),
            AccentIconButton(
              icon: Icons.add,
              size: 32,
              onPressed: () {
                if (trip.participants.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Tambah peserta dulu sebelum catat nota.'),
                    ),
                  );
                  return;
                }
                showExpenseSheet(context, trip);
              },
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (trip.expenses.isEmpty)
          const EmptyState(icon: '🧾', message: 'Belum ada nota tercatat.')
        else
          for (final e in trip.expenses)
            AppCard(
              onTap: () => showExpenseSheet(context, trip, editing: e),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          e.description,
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: p.text,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          'Dibayar ${trip.nameOf(e.paidBy)} · dibagi '
                          '${e.splitAmong.length} orang',
                          style: TextStyle(fontSize: 11.5, color: p.textMuted),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    formatCurrency(e.amount),
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: p.primary,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
        const SizedBox(height: 14),
        GradientButton(
          label: 'Lihat Ringkasan',
          onPressed: () => showSummary(context, trip.id),
        ),
      ],
    );
  }
}

class _Participants extends StatefulWidget {
  const _Participants({required this.trip});

  final Trip trip;

  @override
  State<_Participants> createState() => _ParticipantsState();
}

class _ParticipantsState extends State<_Participants> {
  final TextEditingController _name = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _add() async {
    final store = context.read<PatunganStore>();
    final name = _name.text.trim();
    if (name.isEmpty) return;

    // Nama peserta tidak boleh duplikat dalam satu trip (case-insensitive).
    final clash = widget.trip.participants
        .any((p) => p.name.toLowerCase() == name.toLowerCase());
    if (clash) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Peserta "$name" sudah ada di trip ini.')),
      );
      return;
    }

    final now = DateTime.now().millisecondsSinceEpoch;
    await store.addParticipant(
      widget.trip.id,
      Participant(id: '$now', name: name, createdAt: now),
    );
    _name.clear();
  }

  Future<void> _remove(Participant p) async {
    final store = context.read<PatunganStore>();

    // Diblok kalau masih dipakai di nota — user diminta beresin notanya dulu,
    // bukan auto-hapus nota terkait.
    if (store.participantInUse(widget.trip, p.id)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '${p.name} masih dipakai di nota. Ubah/hapus nota itu dulu.',
          ),
        ),
      );
      return;
    }

    final ok = await confirmDialog(
      context,
      title: 'Hapus Peserta?',
      message: '${p.name} akan dikeluarkan dari trip ini.',
    );
    if (ok) await store.deleteParticipant(widget.trip.id, p.id);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.trip.participants.isNotEmpty)
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final person in widget.trip.participants)
                Container(
                  padding: const EdgeInsets.only(left: 12, right: 4),
                  decoration: BoxDecoration(
                    color: p.surfaceAlt,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: p.border),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        person.name,
                        style: TextStyle(fontSize: 12.5, color: p.text),
                      ),
                      IconButton(
                        visualDensity: VisualDensity.compact,
                        constraints: const BoxConstraints(),
                        padding: const EdgeInsets.all(6),
                        icon: Icon(Icons.close, size: 14, color: p.textMuted),
                        onPressed: () => _remove(person),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _name,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _add(),
                decoration: const InputDecoration(hintText: 'Nama peserta'),
              ),
            ),
            const SizedBox(width: 8),
            AccentIconButton(icon: Icons.add, onPressed: _add),
          ],
        ),
      ],
    );
  }
}

/// Modal tambah/ubah trip — cuma nama. Peserta ditambahkan setelahnya di Detail
/// Trip, supaya alur bikin trip tetap cepat.
Future<void> showTripSheet(BuildContext context, {Trip? editing}) {
  final name = TextEditingController(text: editing?.name ?? '');

  return showAppSheet<void>(
    context: context,
    title: editing == null ? 'Tambah Trip' : 'Ubah Nama Trip',
    builder: (ctx) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldBox(
          label: 'Nama Trip',
          child: TextField(
            controller: name,
            autofocus: true,
            decoration: const InputDecoration(hintText: 'mis. Liburan ke Bali'),
          ),
        ),
        const SizedBox(height: 4),
        GradientButton(
          label: 'Simpan',
          onPressed: () async {
            if (name.text.trim().isEmpty) return;
            final id = editing?.id ?? '${DateTime.now().millisecondsSinceEpoch}';
            await ctx.read<PatunganStore>().saveTripName(id, name.text.trim());
            if (ctx.mounted) Navigator.pop(ctx);
          },
        ),
      ],
    ),
  );
}

/// Modal tambah/ubah nota.
Future<void> showExpenseSheet(
  BuildContext context,
  Trip trip, {
  Expense? editing,
}) {
  return showAppSheet<void>(
    context: context,
    title: editing == null ? 'Tambah Nota' : 'Ubah Nota',
    builder: (ctx) => _ExpenseForm(trip: trip, editing: editing),
  );
}

class _ExpenseForm extends StatefulWidget {
  const _ExpenseForm({required this.trip, this.editing});

  final Trip trip;
  final Expense? editing;

  @override
  State<_ExpenseForm> createState() => _ExpenseFormState();
}

class _ExpenseFormState extends State<_ExpenseForm> {
  late final TextEditingController _description =
      TextEditingController(text: widget.editing?.description ?? '');
  late final TextEditingController _amount = TextEditingController(
    text: widget.editing == null
        ? ''
        : formatThousands(widget.editing!.amount),
  );

  late String _paidBy =
      widget.editing?.paidBy ?? widget.trip.participants.first.id;

  /// Default **semua tercentang** — kasus paling umum "dibagi rata semua orang".
  late final Set<String> _splitAmong = widget.editing == null
      ? widget.trip.participants.map((p) => p.id).toSet()
      : {...widget.editing!.splitAmong};

  @override
  void dispose() {
    _description.dispose();
    _amount.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final store = context.read<PatunganStore>();
    final amount = parseAmount(_amount.text);

    if (_description.text.trim().isEmpty) {
      _warn('Deskripsi wajib diisi.');
      return;
    }
    if (amount <= 0) {
      _warn('Jumlah harus lebih dari 0.');
      return;
    }
    if (_splitAmong.isEmpty) {
      _warn('Pilih minimal satu peserta untuk dibagi.');
      return;
    }

    final now = DateTime.now().millisecondsSinceEpoch;
    await store.saveExpense(
      widget.trip.id,
      Expense(
        id: widget.editing?.id ?? '$now',
        description: _description.text.trim(),
        amount: amount,
        paidBy: _paidBy,
        splitAmong: _splitAmong.toList(),
        createdAt: widget.editing?.createdAt ?? now,
      ),
    );
    if (mounted) Navigator.pop(context);
  }

  void _warn(String message) => ScaffoldMessenger.of(context)
      .showSnackBar(SnackBar(content: Text(message)));

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final store = context.read<PatunganStore>();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldBox(
          label: 'Deskripsi',
          child: TextField(
            controller: _description,
            decoration: const InputDecoration(hintText: 'mis. Makan malam'),
          ),
        ),
        FieldBox(
          label: 'Jumlah (Rp)',
          child: TextField(
            controller: _amount,
            keyboardType: TextInputType.number,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              const ThousandsInputFormatter(),
            ],
            decoration: const InputDecoration(hintText: '0'),
          ),
        ),
        FieldBox(
          label: 'Dibayar oleh',
          child: DropdownButtonFormField<String>(
            initialValue: _paidBy,
            onChanged: (v) => setState(() => _paidBy = v!),
            items: [
              for (final person in widget.trip.participants)
                DropdownMenuItem(value: person.id, child: Text(person.name)),
            ],
          ),
        ),
        FieldBox(
          label: 'Dibagi ke',
          child: Container(
            decoration: BoxDecoration(
              color: p.surfaceAlt,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: p.border),
            ),
            child: Column(
              children: [
                for (final person in widget.trip.participants)
                  CheckboxListTile(
                    dense: true,
                    controlAffinity: ListTileControlAffinity.leading,
                    value: _splitAmong.contains(person.id),
                    title: Text(person.name),
                    onChanged: (on) => setState(() {
                      if (on ?? false) {
                        _splitAmong.add(person.id);
                      } else {
                        _splitAmong.remove(person.id);
                      }
                    }),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 4),
        GradientButton(label: 'Simpan', onPressed: _submit),
        if (widget.editing != null) ...[
          const SizedBox(height: 10),
          SecondaryButton(
            label: 'Hapus Nota',
            onPressed: () async {
              await store.deleteExpense(widget.trip.id, widget.editing!.id);
              if (context.mounted) Navigator.pop(context);
            },
          ),
        ],
      ],
    );
  }
}

/// Popup Ringkasan: saldo tiap peserta + siapa bayar ke siapa (disederhanakan).
Future<void> showSummary(BuildContext context, String tripId) {
  return showAppSheet<void>(
    context: context,
    title: 'Ringkasan',
    builder: (ctx) => Consumer<PatunganStore>(
      builder: (ctx2, store, _) {
        final trip = store.tripById(tripId);
        if (trip == null) {
          return const EmptyState(
            icon: '🗑️',
            message: 'Trip ini sudah dihapus.',
          );
        }

        final p = ctx2.palette;
        final balances = store.calcBalances(trip);
        final settlements = store.simplifyDebts(balances);

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SectionHeading('Saldo Peserta'),
            for (final person in trip.participants)
              Builder(
                builder: (_) {
                  final value = balances[person.id] ?? 0;
                  final color = value > 1
                      ? p.positive!
                      : value < -1
                          ? p.negative!
                          : p.textMuted;
                  final sign = value > 1 ? '+' : '';

                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 7),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            person.name,
                            style: TextStyle(color: p.text),
                          ),
                        ),
                        Text(
                          '$sign${formatCurrency(value)}',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: color,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            const SizedBox(height: 20),
            const SectionHeading('Siapa Bayar ke Siapa'),
            if (settlements.isEmpty)
              const EmptyState(icon: '🤝', message: 'Semua sudah impas.')
            else
              for (final s in settlements)
                AppCard(
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${trip.nameOf(s.from)} → ${trip.nameOf(s.to)}',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: p.text,
                          ),
                        ),
                      ),
                      Text(
                        formatCurrency(s.amount),
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: p.primary,
                        ),
                      ),
                    ],
                  ),
                ),
          ],
        );
      },
    ),
  );
}
