import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/app_theme.dart';
import '../core/formatters.dart';
import '../core/users.dart';
import '../core/widgets/ui.dart';
import 'store.dart';

/// Warna badge/tab per periode. Harian memakai `--color-primary`; dua lainnya
/// punya warna sendiri (`--period-*`).
Color periodColor(BuildContext context, RoutinePeriod period) {
  final p = context.palette;
  return switch (period) {
    RoutinePeriod.harian => p.primary,
    RoutinePeriod.mingguan => p.periodMingguan!,
    RoutinePeriod.bulanan => p.periodBulanan!,
  };
}

Future<void> showRoutineSheet(BuildContext context, {Routine? editing}) {
  return showAppSheet<void>(
    context: context,
    title: editing == null ? 'Tambah Rutinitas' : 'Ubah Rutinitas',
    builder: (ctx) => _RoutineForm(editing: editing),
  );
}

class _RoutineForm extends StatefulWidget {
  const _RoutineForm({this.editing});

  final Routine? editing;

  @override
  State<_RoutineForm> createState() => _RoutineFormState();
}

class _RoutineFormState extends State<_RoutineForm> {
  late final TextEditingController _name =
      TextEditingController(text: widget.editing?.name ?? '');
  late final TextEditingController _icon =
      TextEditingController(text: widget.editing?.icon ?? '');
  late RoutinePeriod _period = widget.editing?.period ?? RoutinePeriod.harian;

  /// Disimpulkan dari data: `days` kosong = "Tiap Hari". Bukan field terpisah
  /// di Firebase — cuma state UI untuk membangun `days` saat submit.
  late bool _specificDays = (widget.editing?.days.isNotEmpty) ?? false;
  late final Set<int> _days = {...?widget.editing?.days};

  late String _by = widget.editing?.by ?? 'iyon';

  bool get _isEdit => widget.editing != null;

  @override
  void initState() {
    super.initState();
    final scope = context.read<UserScope>();
    if (!_isEdit && !scope.isBoth) {
      _by = scope.currentUserId ?? 'iyon';
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _icon.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final store = context.read<RoutineStore>();

    final name = _name.text.trim();
    if (name.isEmpty) {
      _warn('Nama rutinitas wajib diisi.');
      return;
    }
    if (_period == RoutinePeriod.harian && _specificDays && _days.isEmpty) {
      _warn('Pilih minimal satu hari.');
      return;
    }

    final now = DateTime.now().millisecondsSinceEpoch;

    await store.saveRoutine(
      Routine(
        id: widget.editing?.id ?? '$now',
        name: name,
        period: _period,
        icon: _icon.text.trim(),
        // `days` cuma bermakna untuk periode harian mode "Hari Tertentu".
        days: _period == RoutinePeriod.harian && _specificDays
            ? (_days.toList()..sort())
            : const [],
        by: _by,
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
    final scope = context.watch<UserScope>();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldBox(
          label: 'Nama Rutinitas',
          child: TextField(
            controller: _name,
            decoration: const InputDecoration(
              hintText: 'mis. Puasa Senin Kamis',
            ),
          ),
        ),
        FieldBox(
          label: 'Periode',
          child: DropdownButtonFormField<RoutinePeriod>(
            initialValue: _period,
            onChanged: (v) => setState(() => _period = v!),
            items: [
              for (final period in RoutinePeriod.values)
                DropdownMenuItem(
                  value: period,
                  child: Text('${period.defaultIcon}  ${period.label}'),
                ),
            ],
          ),
        ),
        // Field khusus periode harian.
        if (_period == RoutinePeriod.harian) ...[
          FieldBox(
            label: 'Mode Harian',
            child: SegmentToggle<bool>(
              selected: _specificDays,
              options: const [
                (value: false, label: 'Tiap Hari'),
                (value: true, label: 'Hari Tertentu'),
              ],
              onSelected: (v) => setState(() => _specificDays = v),
            ),
          ),
          if (_specificDays)
            FieldBox(
              label: 'Pilih Hari',
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (var d = 0; d < 7; d++)
                    GestureDetector(
                      onTap: () => setState(() {
                        if (!_days.remove(d)) _days.add(d);
                      }),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: _days.contains(d) ? p.primary : p.surfaceAlt,
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                            color: _days.contains(d) ? p.primary : p.border,
                          ),
                        ),
                        child: Text(
                          dayNamesShort[d],
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            color:
                                _days.contains(d) ? Colors.white : p.textMuted,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
        ],
        FieldBox(
          label: 'Icon (opsional)',
          child: TextField(
            controller: _icon,
            decoration: InputDecoration(
              hintText: 'mis. 🏃 — kosongkan untuk ikon default periode '
                  '(${_period.defaultIcon})',
            ),
          ),
        ),
        if (scope.isBoth)
          FieldBox(
            label: 'Dibuat oleh',
            child: SegmentToggle<String>(
              selected: _by,
              locked: _isEdit,
              options: [
                for (final u in Users.creators) (value: u.id, label: u.label),
              ],
              onSelected: (v) => setState(() => _by = v),
            ),
          ),
        const SizedBox(height: 4),
        GradientButton(label: 'Simpan', onPressed: _submit),
      ],
    );
  }
}

/// Popup detail rutinitas.
Future<void> showRoutineDetail(BuildContext context, Routine routine) {
  return showAppSheet<void>(
    context: context,
    title: 'Detail Rutinitas',
    builder: (ctx) {
      final p = ctx.palette;
      final store = ctx.read<RoutineStore>();
      final color = periodColor(ctx, routine.period);

      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              CategoryIcon(
                emoji: routine.displayIcon,
                color: color,
                size: 52,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      routine.name,
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: p.text,
                      ),
                    ),
                    const SizedBox(height: 5),
                    AppChip(label: routine.periodLabel(), color: color),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          _detailRow(
            p.textMuted,
            p.text,
            'Dibuat Sejak',
            formatDateLong(fromMillis(routine.createdAt)),
          ),
          _detailRow(
            p.textMuted,
            p.text,
            'Dibuat Oleh',
            Users.byId(routine.by).label,
          ),
          // Blok "Hari Aktif" cuma relevan untuk periode harian.
          if (routine.period == RoutinePeriod.harian)
            _detailRow(
              p.textMuted,
              p.text,
              'Hari Aktif',
              routine.days.isEmpty
                  ? 'Setiap hari'
                  : routine.periodLabel(full: true),
            ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: SecondaryButton(
                  label: 'Ubah',
                  invert: true,
                  onPressed: () {
                    Navigator.pop(ctx);
                    showRoutineSheet(context, editing: routine);
                  },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: SecondaryButton(
                  label: 'Hapus',
                  onPressed: () async {
                    final ok = await confirmDialog(
                      ctx,
                      title: 'Hapus Rutinitas?',
                      message: 'Rutinitas "${routine.name}" beserta seluruh '
                          'riwayat ceknya akan dihapus.',
                    );
                    if (!ok) return;
                    await store.deleteRoutine(routine.id);
                    if (ctx.mounted) Navigator.pop(ctx);
                  },
                ),
              ),
            ],
          ),
        ],
      );
    },
  );
}

Widget _detailRow(
  Color labelColor,
  Color valueColor,
  String label,
  String value,
) =>
    Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              style: TextStyle(fontSize: 12.5, color: labelColor),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(fontSize: 13.5, color: valueColor),
            ),
          ),
        ],
      ),
    );
