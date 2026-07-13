import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/app_palette.dart';
import '../core/app_theme.dart';
import '../core/category.dart';
import '../core/formatters.dart';
import '../core/users.dart';
import '../core/widgets/ui.dart';
import 'store.dart';

/// Render markdown isi catatan. Di versi web ini dua fungsi buatan sendiri
/// (`renderMarkdownToHtml`/`inlineMarkdown`) karena project-nya sengaja tanpa
/// dependency; di Flutter dipakai `flutter_markdown` yang sudah matang —
/// tidak ada alasan menulis parser sendiri di sini.
///
/// Link (markdown maupun bare URL) **selalu buka browser eksternal**, bukan
/// menavigasi keluar dari app — permintaan eksplisit user di versi web.
class NoteMarkdown extends StatelessWidget {
  const NoteMarkdown({super.key, required this.content});

  final String content;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    return MarkdownBody(
      data: content,
      selectable: true,
      onTapLink: (text, href, title) async {
        if (href == null) return;
        final uri = Uri.tryParse(href);
        if (uri == null) return;
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      },
      styleSheet: MarkdownStyleSheet(
        p: TextStyle(color: p.text, fontSize: 13.5, height: 1.6),
        h1: TextStyle(color: p.text, fontSize: 20, fontWeight: FontWeight.w800),
        h2: TextStyle(color: p.text, fontSize: 18, fontWeight: FontWeight.w700),
        h3: TextStyle(color: p.text, fontSize: 16, fontWeight: FontWeight.w700),
        listBullet: TextStyle(color: p.text, fontSize: 13.5),
        blockquoteDecoration: BoxDecoration(
          color: p.surfaceAlt,
          borderRadius: BorderRadius.circular(8),
          border: Border(left: BorderSide(color: p.primary, width: 3)),
        ),
        code: TextStyle(
          backgroundColor: p.surfaceAlt,
          color: p.text,
          fontFamily: 'monospace',
          fontSize: 12.5,
        ),
        // Link amber/primary & bold tanpa underline — bukan biru bawaan.
        a: TextStyle(
          color: p.primary,
          fontWeight: FontWeight.w700,
          decoration: TextDecoration.none,
        ),
        horizontalRuleDecoration: BoxDecoration(
          border: Border(top: BorderSide(color: p.border)),
        ),
      ),
    );
  }
}

/// Modal tambah/ubah catatan.
Future<void> showNoteSheet(BuildContext context, {Note? editing}) {
  return showAppSheet<void>(
    context: context,
    title: editing == null ? 'Tambah Catatan' : 'Ubah Catatan',
    builder: (ctx) => _NoteForm(editing: editing),
  );
}

class _NoteForm extends StatefulWidget {
  const _NoteForm({this.editing});

  final Note? editing;

  @override
  State<_NoteForm> createState() => _NoteFormState();
}

class _NoteFormState extends State<_NoteForm> {
  late final TextEditingController _title =
      TextEditingController(text: widget.editing?.title ?? '');

  /// Isi catatan **tidak** dipegang oleh field di form ini — dia diedit di
  /// editor layar penuh terpisah, dan hasilnya ditahan di sini sampai submit.
  /// Padanan `noteContentDraft` di versi web.
  late String _contentDraft = widget.editing?.content ?? '';

  late String? _category = widget.editing?.category;
  late bool _pinned = widget.editing?.pinned ?? false;
  late String _by = widget.editing?.by ?? 'iyon';

  bool get _isEdit => widget.editing != null;

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final store = context.read<NoteStore>();

    if (_title.text.trim().isEmpty) {
      _warn('Judul wajib diisi.');
      return;
    }
    // Isi catatan bukan elemen form asli, jadi validasi wajib-isinya manual.
    if (_contentDraft.trim().isEmpty) {
      _warn('Isi catatan tidak boleh kosong.');
      return;
    }
    if (_category == null) {
      _warn('Pilih kategori dulu.');
      return;
    }

    final now = DateTime.now().millisecondsSinceEpoch;
    await store.saveNote(
      Note(
        id: widget.editing?.id ?? '$now',
        title: _title.text.trim(),
        content: _contentDraft.trim(),
        category: _category!,
        pinned: _pinned,
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
    final p = context.palette;
    final store = context.watch<NoteStore>();

    final selected =
        store.categories.any((c) => c.id == _category) ? _category : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldBox(
          label: 'Judul',
          child: TextField(
            controller: _title,
            decoration: const InputDecoration(
              hintText: 'mis. Ide liburan akhir tahun',
            ),
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
          label: 'Isi Catatan',
          // Tombol preview → buka editor layar penuh. Isi catatan sering panjang
          // (hasil tempel rangkuman), butuh area nulis lega — bukan textarea
          // kecil di dalam bottom-sheet.
          child: InkWell(
            onTap: () async {
              final result = await showContentEditor(context, _contentDraft);
              if (result != null) setState(() => _contentDraft = result);
            },
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: p.surfaceAlt,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: p.border),
              ),
              child: Text(
                _contentDraft.isEmpty
                    ? 'Ketuk untuk menulis isi catatan…'
                    : snippet(_contentDraft),
                style: TextStyle(
                  color: _contentDraft.isEmpty ? p.textMuted : p.text,
                  fontSize: 13.5,
                ),
              ),
            ),
          ),
        ),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          value: _pinned,
          title: const Text('Sematkan catatan ini'),
          onChanged: (v) => setState(() => _pinned = v ?? false),
        ),
        const SizedBox(height: 6),
        FieldBox(
          // Selalu tampil (bukan kondisional) — Note App tidak punya pengguna
          // aktif, jadi pembuat dipilih manual tiap catatan.
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

/// Editor isi catatan layar penuh, dengan tab **Tulis / Preview**.
///
/// Bukan transformasi inline ala Notion asli (ketik `# ` lalu teksnya langsung
/// berubah di tempat) — itu sempat dipertimbangkan lalu **ditolak** di versi web
/// karena butuh editor rich-text 2 arah yang rawan bug kursor & keyboard mobile.
/// Yang dipakai: textarea markdown mentah + tab preview terpisah.
///
/// Mengembalikan isi baru kalau disimpan, `null` kalau dibatalkan (ketikan
/// dibuang, draft di form tidak tersentuh).
Future<String?> showContentEditor(BuildContext context, String initial) {
  return Navigator.of(context).push<String>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => _ContentEditor(initial: initial),
    ),
  );
}

class _ContentEditor extends StatefulWidget {
  const _ContentEditor({required this.initial});

  final String initial;

  @override
  State<_ContentEditor> createState() => _ContentEditorState();
}

class _ContentEditorState extends State<_ContentEditor> {
  late final TextEditingController _text =
      TextEditingController(text: widget.initial);

  /// Mode selalu direset ke "Tulis" tiap editor dibuka.
  bool _preview = false;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    return Scaffold(
      backgroundColor: p.bg,
      appBar: AppBar(
        backgroundColor: p.surface,
        surfaceTintColor: Colors.transparent,
        title: const Text('Isi Catatan'),
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: SegmentToggle<bool>(
              selected: _preview,
              options: const [
                (value: false, label: 'Tulis'),
                (value: true, label: 'Preview'),
              ],
              onSelected: (v) => setState(() => _preview = v),
            ),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: _preview
            // Preview membaca isi textarea **saat itu** (bukan draft yang belum
            // di-commit), jadi selalu sinkron dengan ketikan terakhir.
            ? SingleChildScrollView(child: NoteMarkdown(content: _text.text))
            : TextField(
                controller: _text,
                autofocus: true,
                maxLines: null,
                expands: true,
                textAlignVertical: TextAlignVertical.top,
                decoration: const InputDecoration(
                  hintText: 'Tulis bebas. Markdown didukung:\n'
                      '# Judul\n**tebal**\n- daftar',
                ),
              ),
      ),
      // Tombol selalu menempel di bawah layar, tidak ikut scroll bersama teks.
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: SecondaryButton(
                  label: 'Batal',
                  onPressed: () => Navigator.pop(context),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: GradientButton(
                  label: 'Simpan',
                  onPressed: () =>
                      Navigator.pop(context, _text.text.trim()),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Popup detail catatan — isi lengkap di-render sebagai markdown.
Future<void> showNoteDetail(BuildContext context, String noteId) {
  return showAppSheet<void>(
    context: context,
    title: 'Detail Catatan',
    builder: (ctx) => Consumer<NoteStore>(
      builder: (ctx2, store, _) {
        // Dibaca ulang by id tiap rebuild supaya popup ikut ter-update kalau
        // catatan berubah dari device lain (mis. toggle pin) — tanpa perlu
        // tutup-buka ulang.
        final found = store.notes.where((n) => n.id == noteId).firstOrNull;
        if (found == null) {
          return const EmptyState(
            icon: '🗑️',
            message: 'Catatan ini sudah dihapus.',
          );
        }
        final note = found;

        final p = ctx2.palette;
        final cat = findCategory(store.categories, note.category);
        final color = p.seriesSlot(cat.colorSlot);

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                CategoryIcon(emoji: cat.icon, color: color, size: 50),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        note.title,
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
            Row(
              children: [
                Expanded(
                  child: _meta(p, 'Dibuat', formatDateLong(fromMillis(note.createdAt))),
                ),
                Expanded(
                  child: _meta(
                    p,
                    'Diubah',
                    note.updatedAt <= note.createdAt
                        ? '—'
                        : formatDateLong(fromMillis(note.updatedAt)),
                  ),
                ),
                Expanded(
                  child: _meta(p, 'Dibuat Oleh', Users.byId(note.by).label),
                ),
              ],
            ),
            const SizedBox(height: 18),
            NoteMarkdown(content: note.content),
            const SizedBox(height: 20),
            Row(
              children: [
                // Toggle pin langsung tulis Firebase tanpa konfirmasi.
                IconButton(
                  onPressed: () => store.togglePinned(note),
                  icon: Text(
                    note.pinned ? '📌' : '📍',
                    style: const TextStyle(fontSize: 18),
                  ),
                  tooltip:
                      note.pinned ? 'Batal sematkan' : 'Sematkan catatan',
                ),
                Expanded(
                  child: SecondaryButton(
                    label: 'Ubah',
                    invert: true,
                    onPressed: () {
                      Navigator.pop(ctx2);
                      showNoteSheet(context, editing: note);
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
                        title: 'Hapus Catatan?',
                        message:
                            'Catatan "${note.title}" akan dihapus permanen.',
                      );
                      if (!ok) return;
                      await store.deleteNote(note.id);
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

Widget _meta(AppPalette p, String label, String value) => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 11, color: p.textMuted)),
        const SizedBox(height: 3),
        Text(
          value,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: p.text,
          ),
        ),
      ],
    );
