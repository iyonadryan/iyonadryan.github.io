import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/app_theme.dart';
import '../core/category.dart';
import '../core/formatters.dart';
import '../core/users.dart';
import '../core/widgets/ui.dart';
import 'store.dart';

/// Warna prioritas — traffic-light tetap, independen dari warna brand.
Color priorityColor(BuildContext context, Priority priority) {
  final p = context.palette;
  return switch (priority) {
    Priority.tinggi => p.priorityTinggi!,
    Priority.sedang => p.prioritySedang!,
    Priority.rendah => p.priorityRendah!,
  };
}

Future<void> showWishlistSheet(BuildContext context, {WishlistItem? editing}) {
  return showAppSheet<void>(
    context: context,
    title: editing == null ? 'Tambah Wishlist' : 'Ubah Wishlist',
    builder: (ctx) => _WishlistForm(editing: editing),
  );
}

class _WishlistForm extends StatefulWidget {
  const _WishlistForm({this.editing});

  final WishlistItem? editing;

  @override
  State<_WishlistForm> createState() => _WishlistFormState();
}

class _WishlistFormState extends State<_WishlistForm> {
  late final TextEditingController _title =
      TextEditingController(text: widget.editing?.title ?? '');

  /// Default "0" (bukan kosong) — permintaan eksplisit user.
  late final TextEditingController _price = TextEditingController(
    text: formatThousands(widget.editing?.price ?? 0),
  );

  late final TextEditingController _description =
      TextEditingController(text: widget.editing?.description ?? '');
  late final TextEditingController _link =
      TextEditingController(text: widget.editing?.link ?? '');

  late String? _category = widget.editing?.category;
  late Priority _priority = widget.editing?.priority ?? Priority.sedang;
  late String _by = widget.editing?.by ?? 'iyon';

  bool get _isEdit => widget.editing != null;

  @override
  void dispose() {
    _title.dispose();
    _price.dispose();
    _description.dispose();
    _link.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final store = context.read<WishlistStore>();

    if (_title.text.trim().isEmpty) {
      _warn('Judul wajib diisi.');
      return;
    }
    if (_category == null) {
      _warn('Pilih kategori dulu.');
      return;
    }

    final now = DateTime.now().millisecondsSinceEpoch;
    await store.saveItem(
      WishlistItem(
        id: widget.editing?.id ?? '$now',
        title: _title.text.trim(),
        price: parseAmount(_price.text),
        description: _description.text.trim(),
        link: _link.text.trim(),
        category: _category!,
        priority: _priority,
        // Status "tercapai" tidak disentuh dari form ini — cuma lewat toggle di
        // popup detail.
        achieved: widget.editing?.achieved ?? false,
        achievedAt: widget.editing?.achievedAt,
        by: _by,
        createdAt: widget.editing?.createdAt ?? now,
        updatedAt: now,
      ),
    );
    if (mounted) Navigator.pop(context);
  }

  void _warn(String message) => ScaffoldMessenger.of(context)
      .showSnackBar(SnackBar(content: Text(message)));

  @override
  Widget build(BuildContext context) {
    final store = context.watch<WishlistStore>();
    final selected =
        store.categories.any((c) => c.id == _category) ? _category : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldBox(
          label: 'Judul',
          child: TextField(
            controller: _title,
            decoration: const InputDecoration(hintText: 'mis. Sepatu lari baru'),
          ),
        ),
        FieldBox(
          label: 'Nominal (Rp)',
          child: TextField(
            controller: _price,
            keyboardType: TextInputType.number,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              const ThousandsInputFormatter(),
            ],
            decoration: const InputDecoration(hintText: '0'),
          ),
        ),
        FieldBox(
          label: 'Kategori',
          child: DropdownButtonFormField<String>(
            initialValue: selected,
            hint: const Text('Pilih kategori'),
            onChanged: (v) => setState(() => _category = v),
            items: [
              for (final c in store.categories)
                DropdownMenuItem(
                  value: c.id,
                  child: Text('${c.icon}  ${c.label}'),
                ),
            ],
          ),
        ),
        FieldBox(
          label: 'Prioritas',
          child: SegmentToggle<Priority>(
            selected: _priority,
            // Tiap tombol berwarna sesuai prioritasnya sendiri saat aktif —
            // beda dari toggle lain yang selalu warna primary generik.
            activeColorOf: (p) => priorityColor(context, p),
            options: [
              for (final p in Priority.values) (value: p, label: p.label),
            ],
            onSelected: (v) => setState(() => _priority = v),
          ),
        ),
        FieldBox(
          label: 'Deskripsi (opsional)',
          child: TextField(
            controller: _description,
            maxLines: 2,
            decoration: const InputDecoration(
              hintText: 'mis. Warna hitam, ukuran 42',
            ),
          ),
        ),
        FieldBox(
          label: 'Link (opsional)',
          child: TextField(
            controller: _link,
            decoration: const InputDecoration(
              hintText: 'mis. tokopedia.com/…',
            ),
          ),
        ),
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
        GradientButton(label: 'Simpan', onPressed: _submit),
      ],
    );
  }
}

/// Popup detail wishlist.
Future<void> showWishlistDetail(BuildContext context, String itemId) {
  return showAppSheet<void>(
    context: context,
    title: 'Detail Wishlist',
    builder: (ctx) => Consumer<WishlistStore>(
      builder: (ctx2, store, _) {
        // Dibaca ulang by id tiap rebuild (bukan snapshot yang dioper masuk)
        // supaya popup ikut ter-update kalau item berubah dari device lain.
        final found = store.items.where((i) => i.id == itemId).firstOrNull;
        if (found == null) {
          return const EmptyState(
            icon: '🗑️',
            message: 'Item ini sudah dihapus.',
          );
        }
        final item = found;

        final p = ctx2.palette;
        final cat = findCategory(store.categories, item.category);
        final color = p.seriesSlot(cat.colorSlot);
        final pColor = priorityColor(ctx2, item.priority);

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                CategoryIcon(emoji: cat.icon, color: color, size: 52),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title,
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: p.text,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        formatCurrency(item.price),
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: p.primary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          AppChip(label: cat.label, color: color, icon: cat.icon),
                          const SizedBox(width: 6),
                          AppChip(label: item.priority.label, color: pColor),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (item.achieved) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: p.priorityRendah!.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '🎉 Tercapai pada '
                  '${formatDateLong(fromMillis(item.achievedAt))}',
                  style: TextStyle(
                    color: p.priorityRendah,
                    fontWeight: FontWeight.w600,
                    fontSize: 12.5,
                  ),
                ),
              ),
            ],
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _meta(
                    p.textMuted,
                    p.text,
                    'Dibuat',
                    formatDateLong(fromMillis(item.createdAt)),
                  ),
                ),
                Expanded(
                  child: _meta(
                    p.textMuted,
                    p.text,
                    'Diubah',
                    item.updatedAt <= item.createdAt
                        ? '—'
                        : formatDateLong(fromMillis(item.updatedAt)),
                  ),
                ),
                Expanded(
                  child: _meta(
                    p.textMuted,
                    p.text,
                    'Dibuat Oleh',
                    Users.byId(item.by).label,
                  ),
                ),
              ],
            ),
            if (item.description.isNotEmpty) ...[
              const SizedBox(height: 18),
              Text(
                item.description,
                style: TextStyle(color: p.text, fontSize: 13.5, height: 1.6),
              ),
            ],
            if (item.uri != null) ...[
              const SizedBox(height: 14),
              GestureDetector(
                onTap: () => launchUrl(
                  item.uri!,
                  mode: LaunchMode.externalApplication,
                ),
                child: Text(
                  item.link,
                  style: TextStyle(
                    color: p.primary,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ),
            ],
            const SizedBox(height: 20),
            Row(
              children: [
                // Toggle "sudah didapat" — langsung tulis, tanpa konfirmasi.
                IconButton(
                  onPressed: () => store.toggleAchieved(item),
                  icon: Text(
                    item.achieved ? '✅' : '🎁',
                    style: const TextStyle(fontSize: 18),
                  ),
                  tooltip: item.achieved
                      ? 'Batalkan status tercapai'
                      : 'Tandai sudah didapat',
                ),
                Expanded(
                  child: SecondaryButton(
                    label: 'Ubah',
                    invert: true,
                    onPressed: () {
                      Navigator.pop(ctx2);
                      showWishlistSheet(context, editing: item);
                    },
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: SecondaryButton(
                    label: 'Hapus',
                    onPressed: () async {
                      final ok = await confirmDialog(
                        ctx2,
                        title: 'Hapus Wishlist?',
                        message:
                            '"${item.title}" akan dihapus permanen.',
                      );
                      if (!ok) return;
                      await store.deleteItem(item.id);
                      if (ctx2.mounted) Navigator.pop(ctx2);
                    },
                  ),
                ),
              ],
            ),
          ],
        );
      },
    ),
  );
}

Widget _meta(
  Color labelColor,
  Color valueColor,
  String label,
  String value,
) =>
    Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 11, color: labelColor)),
        const SizedBox(height: 3),
        Text(
          value,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: valueColor,
          ),
        ),
      ],
    );
