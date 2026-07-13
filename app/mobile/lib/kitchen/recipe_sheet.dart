import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/app_theme.dart';
import '../core/category.dart';
import '../core/widgets/ui.dart';
import 'store.dart';

/// Modal tambah/ubah resep. Bahan & langkah pakai **baris dinamis** — tambah
/// sebanyak yang perlu, baris kosong difilter saat submit (user boleh menambah
/// baris lalu tidak mengisinya).
Future<void> showRecipeSheet(BuildContext context, {Recipe? editing}) {
  return showAppSheet<void>(
    context: context,
    title: editing == null ? 'Tambah Resep' : 'Ubah Resep',
    builder: (ctx) => _RecipeForm(editing: editing),
  );
}

class _RecipeForm extends StatefulWidget {
  const _RecipeForm({this.editing});

  final Recipe? editing;

  @override
  State<_RecipeForm> createState() => _RecipeFormState();
}

class _RecipeFormState extends State<_RecipeForm> {
  late final TextEditingController _name =
      TextEditingController(text: widget.editing?.name ?? '');
  late final TextEditingController _servings =
      TextEditingController(text: widget.editing?.servings ?? '');
  late final TextEditingController _time =
      TextEditingController(text: widget.editing?.time ?? '');
  late final TextEditingController _note =
      TextEditingController(text: widget.editing?.note ?? '');

  late String? _category = widget.editing?.category;

  late final List<({TextEditingController name, TextEditingController qty})>
      _ingredients = widget.editing == null || widget.editing!.ingredients.isEmpty
          ? [_newIngredientRow()]
          : [
              for (final i in widget.editing!.ingredients)
                (
                  name: TextEditingController(text: i.name),
                  qty: TextEditingController(text: i.qty),
                ),
            ];

  late final List<TextEditingController> _steps =
      widget.editing == null || widget.editing!.steps.isEmpty
          ? [TextEditingController()]
          : [
              for (final s in widget.editing!.steps)
                TextEditingController(text: s),
            ];

  ({TextEditingController name, TextEditingController qty}) _newIngredientRow() =>
      (name: TextEditingController(), qty: TextEditingController());

  @override
  void dispose() {
    _name.dispose();
    _servings.dispose();
    _time.dispose();
    _note.dispose();
    for (final i in _ingredients) {
      i.name.dispose();
      i.qty.dispose();
    }
    for (final s in _steps) {
      s.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    final store = context.read<KitchenStore>();

    final name = _name.text.trim();
    if (name.isEmpty) {
      _warn('Nama resep wajib diisi.');
      return;
    }
    if (_category == null) {
      _warn('Pilih kategori dulu.');
      return;
    }

    final now = DateTime.now().millisecondsSinceEpoch;

    await store.saveRecipe(
      Recipe(
        id: widget.editing?.id ?? '$now',
        name: name,
        category: _category!,
        servings: _servings.text.trim(),
        time: _time.text.trim(),
        // Baris kosong dibuang di sini, bukan dicegah saat mengetik.
        ingredients: [
          for (final i in _ingredients)
            if (i.name.text.trim().isNotEmpty)
              Ingredient(name: i.name.text.trim(), qty: i.qty.text.trim()),
        ],
        steps: [
          for (final s in _steps)
            if (s.text.trim().isNotEmpty) s.text.trim(),
        ],
        note: _note.text.trim(),
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
    final store = context.watch<KitchenStore>();

    final selected =
        store.categories.any((c) => c.id == _category) ? _category : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldBox(
          label: 'Nama Resep',
          child: TextField(
            controller: _name,
            decoration:
                const InputDecoration(hintText: 'mis. Nasi Goreng Spesial'),
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
        Row(
          children: [
            Expanded(
              child: FieldBox(
                label: 'Porsi',
                child: TextField(
                  controller: _servings,
                  decoration: const InputDecoration(hintText: 'mis. 2 orang'),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: FieldBox(
                label: 'Waktu Masak',
                child: TextField(
                  controller: _time,
                  decoration: const InputDecoration(hintText: 'mis. 20 menit'),
                ),
              ),
            ),
          ],
        ),
        _label(context, 'Bahan-bahan'),
        for (var i = 0; i < _ingredients.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                Expanded(
                  flex: 3,
                  child: TextField(
                    controller: _ingredients[i].name,
                    decoration:
                        const InputDecoration(hintText: 'Nama bahan'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 2,
                  child: TextField(
                    controller: _ingredients[i].qty,
                    decoration: const InputDecoration(hintText: 'Jumlah'),
                  ),
                ),
                IconButton(
                  icon: Icon(Icons.close, size: 18, color: p.textMuted),
                  onPressed: _ingredients.length == 1
                      ? null
                      : () => setState(() => _ingredients.removeAt(i)),
                ),
              ],
            ),
          ),
        _addRowButton(
          '+ Tambah Bahan',
          () => setState(() => _ingredients.add(_newIngredientRow())),
        ),
        const SizedBox(height: 14),
        _label(context, 'Langkah-langkah'),
        for (var i = 0; i < _steps.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 14, right: 8),
                  child: Text(
                    // Nomor langkah dari urutan, tidak disimpan di data.
                    '${i + 1}.',
                    style: TextStyle(
                      color: p.textMuted,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Expanded(
                  child: TextField(
                    controller: _steps[i],
                    maxLines: null,
                    decoration: const InputDecoration(
                      hintText: 'mis. Tumis bumbu hingga harum',
                    ),
                  ),
                ),
                IconButton(
                  icon: Icon(Icons.close, size: 18, color: p.textMuted),
                  onPressed: _steps.length == 1
                      ? null
                      : () => setState(() => _steps.removeAt(i)),
                ),
              ],
            ),
          ),
        _addRowButton(
          '+ Tambah Langkah',
          () => setState(() => _steps.add(TextEditingController())),
        ),
        const SizedBox(height: 14),
        FieldBox(
          label: 'Catatan (opsional)',
          child: TextField(
            controller: _note,
            maxLines: 2,
            decoration: const InputDecoration(
              hintText: 'mis. Tambahkan kerupuk saat disajikan',
            ),
          ),
        ),
        const SizedBox(height: 4),
        GradientButton(label: 'Simpan', onPressed: _submit),
      ],
    );
  }

  Widget _label(BuildContext context, String text) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(
          text,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: context.palette.textMuted,
          ),
        ),
      );

  Widget _addRowButton(String label, VoidCallback onTap) => Align(
        alignment: Alignment.centerLeft,
        child: TextButton(onPressed: onTap, child: Text(label)),
      );
}

/// Popup detail resep — bahan + langkah bernomor, dengan tombol Ubah & Hapus.
Future<void> showRecipeDetail(BuildContext context, Recipe recipe) {
  return showAppSheet<void>(
    context: context,
    title: 'Detail Resep',
    builder: (ctx) => Consumer<KitchenStore>(
      builder: (ctx2, store, _) {
        final p = ctx2.palette;
        final cat = findCategory(store.categories, recipe.category);
        final color = p.seriesSlot(cat.colorSlot);

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
                        recipe.name,
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: p.text,
                        ),
                      ),
                      const SizedBox(height: 5),
                      AppChip(label: cat.label, color: color, icon: cat.icon),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (recipe.servings.isNotEmpty || recipe.time.isNotEmpty)
              Row(
                children: [
                  if (recipe.servings.isNotEmpty)
                    Expanded(child: _meta(p.textMuted, '🍽️ ${recipe.servings}')),
                  if (recipe.time.isNotEmpty)
                    Expanded(child: _meta(p.textMuted, '⏱️ ${recipe.time}')),
                ],
              ),
            const SizedBox(height: 18),
            if (recipe.ingredients.isNotEmpty) ...[
              _sectionLabel(p.text, 'Bahan-bahan'),
              for (final i in recipe.ingredients)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    children: [
                      Text('• ', style: TextStyle(color: color)),
                      Expanded(
                        child: Text(
                          i.name,
                          style: TextStyle(color: p.text, fontSize: 13.5),
                        ),
                      ),
                      Text(
                        i.qty,
                        style: TextStyle(color: p.textMuted, fontSize: 12.5),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 18),
            ],
            if (recipe.steps.isNotEmpty) ...[
              _sectionLabel(p.text, 'Langkah-langkah'),
              for (var i = 0; i < recipe.steps.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 22,
                        height: 22,
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.16),
                          shape: BoxShape.circle,
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          '${i + 1}',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: color,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          recipe.steps[i],
                          style: TextStyle(
                            color: p.text,
                            fontSize: 13.5,
                            height: 1.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 14),
            ],
            if (recipe.note.isNotEmpty) ...[
              _sectionLabel(p.text, 'Catatan'),
              Text(
                recipe.note,
                style: TextStyle(
                  color: p.textMuted,
                  fontSize: 13,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 14),
            ],
            Row(
              children: [
                Expanded(
                  child: SecondaryButton(
                    label: 'Ubah',
                    invert: true,
                    onPressed: () {
                      Navigator.pop(ctx2);
                      showRecipeSheet(context, editing: recipe);
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
                        title: 'Hapus Resep?',
                        message: 'Resep "${recipe.name}" akan dihapus permanen.',
                      );
                      if (!ok) return;
                      await store.deleteRecipe(recipe.id);
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

Widget _meta(Color color, String text) => Text(
      text,
      style: TextStyle(color: color, fontSize: 12.5),
    );

Widget _sectionLabel(Color color, String text) => Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
