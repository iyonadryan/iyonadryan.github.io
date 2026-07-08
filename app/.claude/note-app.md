# Note App

Aplikasi web untuk mencatat apa saja (catatan aktivitas, self reminder, inspirasi dari orang lain, dll.) dan mengaksesnya lagi dengan mudah lewat kategori, pencarian, dan sematkan (pin). Berfokus pada penggunaan **mobile** (dibuka dari HP), mobile-first, layout disimulasikan seperti layar HP (max-width 480px, centered).

## Kenapa "Note App", bukan "Journal App"

User awalnya bingung pilih antara dua konsep — dijelaskan dulu bedanya sebelum mulai bangun:
- **Note App**: potongan info pendek berdiri sendiri, bebas topik, diorganisir pakai kategori/tag/pin (bukan kronologis), aksesnya berbasis cari & filter.
- **Journal App**: entri reflektif per hari/momen (biasanya 1 entri = 1 hari), diorganisir kronologis (timeline), sering ada mood tracker — lebih ke nulis pengalaman/perasaan naratif.

Kebutuhan user ("catatan aktivitas, self reminder, inspirasi orang lain, dll", + penekanan di "akses dengan mudah") cocok ke pola **Note App** — isinya heterogen & butuh cepat ditemukan lagi, bukan dibaca berurutan sbg cerita harian. User confirm pilihan ini lewat `AskUserQuestion` sebelum dibangun.

Dibangun mengikuti pola/struktur **Kitchen App** (`../kitchen`) sebagai referensi CRUD kategori.

## Status saat ini

Prototype pertama — UI/UX sudah jadi dan data langsung terhubung ke **Firebase Realtime Database** sejak awal (pola sama dgn Kitchen/Routine/Patungan App). Preferensi tema disimpan lokal (`localStorage`, key `noteapp_theme`). **Tidak ada konsep "pengguna aktif" device-level** (beda dari Finance/Routine App) — lihat bagian "Dibuat oleh (bukan multi-user)" di bawah.

### Konfigurasi Firebase

- Memakai **project Firebase yang sama** dengan app lain (`iyon-adryanlf-trialerror`), path berbeda.
- SDK: **compat v8.10.1** (`firebase-app.js` + `firebase-database.js`), CDN gstatic. Config + `firebase.initializeApp` inline di `<head>` `index.html`, expose global `db` dan konstanta `NOTE_PATH = "note"`.
- Path data app ini: **`note/...`** (top-level, sejajar `kitchen`/`finance`/`routine`/`patungan`). Ini path **Firebase**, independen dari struktur folder lokal (lihat catatan struktur folder di `app/.claude/CLAUDE.md`).
- Rules Firebase dikelola di console yang sama — node `note` perlu `.write: true` di rules kalau belum ada. **Belum ada auth** — seluruh isi DB berpotensi terbaca/tertulis publik, sama seperti app lain.

### Struktur data di Firebase

```
note/
  notes/
    <timestamp>/                 # key = Date.now() saat input
      title:      "Ide liburan akhir tahun"
      content:    "Isi catatan bebas, bisa panjang..."
      category:   "inspirasi"    # id kategori, lihat categories/ di bawah
      pinned:     false           # true = disematkan, muncul di halaman Tersemat
      by:         "iyon"          # "iyon" | "ciwul" — dipilih manual tiap tambah/ubah, lihat "Dibuat oleh"
      createdAt:  1719...
      updatedAt:  1719...          # berubah tiap edit konten (title/content/category/by),
                                    # TIDAK berubah krn toggle pin — lihat toggleNotePinned()
  categories/
    <id>/                        # id = slug dari label (slugify()), mis. "inspirasi"
      id:        "inspirasi"
      label:     "Inspirasi"
      icon:      "💡"
      colorSlot: 3                # 1-8, dipetakan ke var(--series-1..8) di css/base.css
```

**Seed default 4 kategori** (`seedCategoriesIfEmpty()`, sama pola dgn Kitchen App): Aktivitas 📝, Reminder ⏰, Inspirasi 💡, Lainnya 📦. Kategori CRUD penuh dari Pengaturan (tambah/ubah/hapus, bebas bukan cuma 4 default ini).

**Kenapa `updatedAt` dipisah dari toggle pin**: sematkan/batal-sematkan catatan bukan "mengedit isi", jadi tidak boleh bikin catatan itu melompat ke atas list "Catatan Terbaru" cuma krn di-pin — hanya perubahan title/content/category/pembuat yang menghitung sbg "diubah".

### Cara kerja layer data (`script.js`)

- Satu listener realtime `noteRef.on("value", ...)` pada `db.ref("note")` (`subscribeNote()`). Setiap perubahan → `seedCategoriesIfEmpty()` → `migrateNoteOwners()` (backfill `by` yang belum ada) → `rebuildFromSnapshot()` → `renderAll()`.
- `renderAll()` juga re-render **popup Detail Catatan yang sedang terbuka** kalau ada (pola sama dgn Patungan App's `tripDetailModal` — reaktif thd perubahan dari device lain, mis. toggle pin langsung update tampilan tombol 📌 di popup yang sama tanpa perlu tutup-buka ulang).
- **Tidak ada scoping tampilan** — semua render function (`renderDashboard`/`renderNoteList`/`renderPinnedList`) baca langsung dari `notes[]` mentah, catatan siapa pun (Iyon atau Ciwul) selalu tampil ke siapa pun yang buka app. Kategori juga tetap global (bukan per-pembuat).
- Fungsi tulis: `addNote`/`updateNote` (set `updatedAt: Date.now()`, `createdAt` dipertahankan)/`deleteNote`, `toggleNotePinned(id, pinned)` (`.set()` langsung ke field `pinned`, **tidak** menyentuh `updatedAt`), `saveCategory`/`deleteCategory` (sama persis pola Kitchen App).
- `getCategory(id)` fallback ke `FALLBACK_CATEGORY` (`{ label: "Tanpa Kategori", icon: "📦", colorSlot: 8 }`) kalau catatan merujuk kategori yang sudah dihapus — sama pola Kitchen App.
- `snippet(content)`: potong isi catatan jadi cuplikan ~70 karakter (whitespace dirapikan jadi satu spasi) utk ditampilkan di list — isi lengkap cuma muncul di popup detail.

### Render markdown di popup detail (`renderMarkdownToHtml`/`inlineMarkdown`)

Banyak catatan ditempel dari rangkuman ber-markdown (mis. hasil ringkasan video/artikel — heading, bold, list, blockquote, link), jadi popup detail (`#detailContent`) me-render `note.content` sbg HTML, bukan lagi teks polos `white-space: pre-wrap`.

- **Bukan parser markdown lengkap/library eksternal** — dua fungsi kecil murni di `script.js` (tanpa dependency baru, konsisten dgn "tanpa framework/build tool" project ini): `renderMarkdownToHtml(content)` (block-level, jalan per baris: heading `#`..`######`, `---` → `<hr>`, `> ` → `<blockquote>`, `1. ` → `<ol>`, `- `/`* ` → `<ul>` dgn **1 level nesting** kalau indent ≥2 spasi, sisanya per-baris jadi `<p>`) dan `inlineMarkdown(text)` (inline: `**bold**`, `*italic*`, `` `code` ``, link markdown `[label](url)`, dan bare URL `https://...` di-auto-link).
- **Keamanan**: `inlineMarkdown` selalu `escapeHtml()` teks dulu sebelum menyisipkan tag apa pun — hasil akhirnya baru di-`innerHTML`-kan (`renderNoteDetail()`), jadi tetap aman dari XSS meski isi catatan berisi karakter `<`/`>`/`&` mentah.
- **Link selalu buka tab baru**: baik link markdown maupun bare URL yang ke-auto-link dapat `target="_blank" rel="noopener noreferrer"` — permintaan eksplisit user spy klik link di catatan tidak menavigasi keluar dari app.
- Link di-stash jadi placeholder (`@@MD<i>@@`) dulu sebelum regex bold/italic/code jalan, supaya isi URL/label link tidak ikut ke-mangle olehnya, baru dikembalikan di akhir `inlineMarkdown`.
- **Hanya dipakai di popup detail** — kartu list (`noteCardHTML`/`snippet()`) tetap teks polos apa adanya (cuplikan pendek, markdown mentah di situ tidak masalah).
- CSS pendukungnya di `css/notes.css` bagian `.detail-content h1..h6/ul/ol/blockquote/hr/code/a` (elemen `#detailContent` di `index.html` diganti dari `<p>` jadi `<div>` krn sekarang berisi elemen block spt heading/list, bukan cuma teks datar).
- Link (baik markdown maupun bare URL) berwarna **amber/kuning** (`var(--color-primary)`, bukan biru bawaan browser) dan **bold tanpa underline** — override eksplisit `a`/`a:visited`/`a:hover`/`a:active` di `.detail-content a` krn default `:visited` (ungu) py spesifisitas setara & bisa menang tanpa override eksplisit ini.

### Editor layar penuh: Isi Catatan (ala Notion)

Field "Isi Catatan" di modal Tambah/Ubah (`#noteModal`) **bukan lagi `<textarea>` langsung di dalam form** — diganti tombol preview (`#openContentEditorBtn`, class `.content-field-btn`) yang membuka editor terpisah menutupi **seluruh layar** (`#contentEditorModal`, class `.content-editor-overlay`/`.content-editor-sheet` — beda dari `.modal-overlay`/`.modal-sheet` bottom-sheet yang dipakai modal lain), dgn tombol **Simpan**/**Batal** selalu menempel di paling bawah layar (`.content-editor-actions`, bukan ikut scroll bareng textarea). Alasan: isi catatan sering panjang (hasil tempel rangkuman), butuh area nulis lebih lega drpd textarea kecil di dalam bottom-sheet.

- **State sementara** `noteContentDraft` (module-level di `script.js`) menyimpan nilai isi catatan selama modal Tambah/Ubah terbuka — **bukan** dibaca langsung dari elemen form saat submit (beda dari field lain spt judul/kategori yang tetap baca langsung dari elemen). Diisi dari `note.content` (mode edit) atau `""` (mode tambah) di `openNoteModal()`, direset ke `""` di `closeNoteModal()`.
- Tombol preview (`#noteContentPreview`) tampilkan cuplikan via `snippet()` (sama fungsi yg dipakai kartu list) kalau `noteContentDraft` ada isinya, atau placeholder abu-abu "Ketuk untuk menulis isi catatan…" (class `.placeholder`) kalau kosong — di-refresh lewat `renderContentPreview()`.
- Alur: klik `#openContentEditorBtn` → salin `noteContentDraft` ke `#contentEditorTextarea`, buka overlay, fokus textarea → user ketik bebas → **Simpan** (`#saveContentEditorBtn`) commit `contentEditorTextarea.value.trim()` balik ke `noteContentDraft` + refresh preview, **Batal** (`#cancelContentEditorBtn`) tutup overlay tanpa menyentuh `noteContentDraft` sama sekali (perubahan di textarea dibuang).
- `noteForm` submit pakai `noteContentDraft` langsung sbg `data.content` (bukan lagi query elemen `<textarea>` yg sudah tidak ada). Krn bukan elemen form asli, validasi wajib-isi **tidak** lagi otomatis dari atribut `required` HTML5 — dicek manual (`if (!data.content) { alert(...); return; }`), beda dari judul yg masih pakai `required` bawaan `<input>`.
- Textarea isi catatan **mendukung markdown mentah** (placeholder-nya kasih contoh `# Judul`, `**tebal**`, `- daftar`) — konsisten dgn "Render markdown di popup detail" di atas yg me-render hasil ketikan ini.

## Struktur file

- `index.html` — struktur halaman (single-page, section di-toggle lewat JS via `goToPage()`).
- `css/` — mobile-first, CSS variables tema (light/dark):
  - `css/base.css` — variabel `:root`/`[data-theme="dark"]` (termasuk `--series-1..8` kategorikal — **divalidasi lewat skill `dataviz`** thd surface app ini sendiri, `#fff8ec` light / `#241c12` dark; nilainya sama persis dgn default reference palette skill krn kedua surface itu cukup dekat luminance-nya dgn punya Kitchen App shg lolos validasi tanpa perlu di-tune ulang — TETAP divalidasi ulang scr eksplisit, bukan asal-comot dari Kitchen), reset global, loading overlay, app shell, header, page shell, section heading.
  - `css/components.css` — tombol, filter tabs, bottom nav, modal/bottom-sheet + field form bersama (termasuk `.field[hidden] { display: none }`, gotcha yang sama dgn Routine/Patungan App), `.mode-toggle`/`.mode-btn` (+ `.locked`) dipakai ulang utk toggle "Dibuat oleh", confirm dialog generik, komponen CRUD kategori (`.slot-picker`, `.category-list`/`.category-row`/`.cat-btn` — disalin persis dari Kitchen App krn fiturnya identik), **dan editor layar penuh Isi Catatan** (`.content-field-btn` tombol pemicu di form, `.content-editor-overlay`/`.content-editor-sheet`/`.content-editor-textarea`/`.content-editor-actions` — beda pola dari `.modal-overlay`/`.modal-sheet` krn full-screen bukan bottom-sheet, lihat "Editor layar penuh: Isi Catatan").
  - `css/dashboard.css` — hero stat card, `.note-mini-list`, breakdown kategori (sama pola Kitchen App).
  - `css/notes.css` — list & kartu catatan (`.note-item`, termasuk `.creator-badge` absolute di `.note-icon` — **selalu tampil**, tidak dikondisikan mode apa pun, `.note-pin` indikator sematkan), search box, popup detail (`.detail-content` di-render dari markdown ringan — lihat "Render markdown di popup detail" — bukan lagi `white-space: pre-wrap` teks polos; `.detail-meta-row` isinya 3 item: Dibuat / Diubah Terakhir / Dibuat Oleh).
  - `css/settings.css` — list Pengaturan (ringkas — cuma toggle tema, CRUD kategori, Semua Aplikasi, Tentang; **tidak ada** `.user-switch-btn`, dihapus bareng fitur pengguna aktif).
- `script.js` — semua logic (state, render, event handler, layer data Firebase). Satu IIFE, vanilla JS, tanpa framework/build tool.
- **`img/` bukan folder sendiri di Note App** — ikon `iyon.png`/`ciwul.png` (dipakai) & `couple.png` (tidak dipakai lagi sejak mode "Both" dihapus, tapi tetap ada di sumber bersama karena app lain masih pakai) ada di `app/img/`, direferensikan dari `script.js` sbg `../img/<nama>.png`. Lihat `app/.claude/CLAUDE.md` bagian "Sumber img/ dikonsolidasi".
- `app/.claude/note-app.md` — file ini.

Belum ada build tool. Cukup buka `index.html` langsung di browser atau lewat live server.

**Dependensi eksternal:** hanya Firebase compat v8.10.1 (app+database) via CDN.

## Fitur yang sudah ada

1. **Dashboard** (`#dashboard`)
   - Hero card gradient amber/kuning menampilkan 3 angka: total catatan, jumlah kategori, jumlah catatan tersemat — **semuanya total keseluruhan**, tidak di-scope per pembuat (lihat "Dibuat oleh (bukan multi-user)").
   - **Catatan Terbaru**: maks 4, diurut `updatedAt` terbaru dulu (catatan yang baru diedit ikut naik ke atas, bukan cuma yang baru dibuat). Link "Lihat Semua" → halaman Catatan.
   - **Breakdown kategori**: chip per kategori yang punya ≥1 catatan (kategori dengan 0 catatan disembunyikan dari breakdown, tapi tetap muncul sbg filter tab di halaman Catatan).
2. **Catatan** (`#notes`) — daftar & CRUD semua catatan.
   - Search box (`#noteSearchInput`, cari substring di **judul maupun isi**, case-insensitive, realtime tiap ketik).
   - Filter tab kategori (`#noteFilterTabs`, sama pola dgn Kitchen Resep) — beririsan dgn search (AND).
   - List catatan (`.note-item`, klik kartu → popup detail; klik `.creator-badge` → info pembuat). Kartu tampil ikon kategori, judul, cuplikan isi (`snippet()`), indikator 📌 kalau disematkan, badge kategori, dan foto kecil pembuat di pojok ikon.
   - **Tambah/Ubah** (`#noteModal`, tombol **+ di tengah bottom nav** `#navAdd`, atau tombol "Ubah" di popup detail): judul, kategori (`<select>` dinamis dari `categories[]`), **isi catatan lewat editor layar penuh** (lihat "Editor layar penuh: Isi Catatan" di bawah — bukan lagi `<textarea>` langsung di dalam modal), checkbox "Sematkan catatan ini", **Dibuat oleh** (toggle Iyon/Ciwul, **selalu tampil** — bukan kondisional — default "Iyon", dikunci saat edit).
3. **Popup Detail Catatan** (`#noteDetailModal`)
   - Header (ikon kategori + judul + badge kategori), meta row **3 kolom**: tanggal Dibuat, Diubah Terakhir ("—" kalau belum pernah diedit sejak dibuat), dan **Dibuat Oleh** (nama pembuat, teks eksplisit — bukan cuma badge foto), isi catatan lengkap di-render sbg markdown ringan (lihat "Render markdown di popup detail").
   - Tombol **📌 Toggle Sematkan** (icon-btn, langsung tulis Firebase tanpa konfirmasi — low-stakes, gampang di-toggle balik), **Ubah** → buka modal edit, **Hapus** → `openConfirm()`.
4. **Tersemat** (`#pinned`) — semua catatan `pinned === true`, diurut `updatedAt` terbaru. Halaman terpisah (bukan cuma filter) supaya akses catatan penting selalu 1 tap dari bottom nav — ini fitur utama yang menjawab kebutuhan user "akses dengan mudah".
5. **Pengaturan** (`#settings`) — Mode Tampilan, **Kategori Catatan — CRUD** (`#categoriesBtn` → `#categoriesModal`, identik pola Kitchen App: list kategori + "+ Buat Kategori Baru", modal Label/Icon/slot-picker 8 warna, delete via `openConfirm()` dgn pesan fallback "Tanpa Kategori"), Semua Aplikasi, Tentang. **Tidak ada row "Pengguna Aktif"** (dihapus, lihat bagian di bawah).
6. **Navigasi**: bottom nav — Dashboard, Catatan, **[+]** (tambah catatan, selalu tampil), Tersemat, Pengaturan.
7. **Tema light/dark**: `data-theme` di `<html>`, variabel di `css/base.css`. Primary **amber/kuning** (`#d97706` light / `#fbbf24` dark) — beda dari oranye Kitchen, teal Finance, ungu-indigo Routine, rose Patungan; dipilih krn asosiasi "sticky note kuning". Kategorikal 8-slot **divalidasi lewat skill `dataviz`** (lihat "Struktur file" → `base.css`).
8. **Dibuat oleh (bukan multi-user)** — awalnya app ini punya pola multi-user penuh spt Finance/Routine App (overlay pilih "pengguna aktif" Iyon/Ciwul/Both, scoping tampilan per-user, dsb), **lalu diminta dihapus** dan disederhanakan jadi murni atribusi:
   - `USERS = { iyon, ciwul }` (tanpa `"both"` — konsep itu sudah tidak relevan tanpa scoping).
   - Field **Dibuat oleh** di modal Tambah/Ubah **selalu tampil** (bukan `hidden`, bukan kondisional apa pun) — user pilih manual Iyon/Ciwul tiap kali tambah catatan; default "Iyon". Saat edit, toggle **dikunci** ke `note.by` (pembuat tidak bisa diubah retroaktif) — satu-satunya sisa perilaku "locked on edit" dari pola lama yang dipertahankan krn tetap masuk akal.
   - **Tidak ada** lagi: overlay pilih pengguna pertama kali, `localStorage` key `noteapp_user`, halaman/tombol ganti pengguna, scoping `visibleNotes()` — semua catatan (siapa pun pembuatnya) selalu tampil ke siapa pun yang buka app, di semua halaman.
   - **Badge pembuat** (`.creator-badge`, absolute di pojok `.note-icon`) & **meta "Dibuat Oleh"** di popup detail **selalu tampil** (dulu cuma muncul kalau mode aktifnya "Both") — krn sekarang tidak ada mode lain, atribusi selalu relevan ditampilkan. Klik badge → `openCreatorInfo()` (modal read-only "Dibuat oleh: <nama>", masih dipertahankan).
   - `migrateNoteOwners()` (backfill `by` catatan lama) **tetap dipertahankan apa adanya** — masih relevan utk data yang mungkin dibuat sebelum field `by` ada.
9. **Confirm dialog generik** (`#confirmModal`, `openConfirm(title, text, onConfirm)`): satu callback, pola identik app lain. Dipakai hapus catatan & hapus kategori (bukan toggle pin, lihat poin 3).

## Model data internal (`script.js`, hasil rebuild dari Firebase)

```js
// notes[] (item)
{ id, title, content, category, pinned: boolean, by: "iyon"|"ciwul", createdAt, updatedAt }

// categories[] (item) — flat, urut naik by colorSlot
{ id, label, icon, colorSlot }
```

## Perbedaan sengaja dari app lain (referensi arsitektur)

- **Atribusi tanpa multi-user** — beda dari Finance/Routine App (device-level "pengguna aktif" yang men-scope tampilan) DAN beda dari versi awal Note App sendiri (yang sempat pakai pola itu sebelum diminta disederhanakan). Field `by` di sini murni label "siapa yang nulis", dipilih manual tiap catatan, tidak pernah menyembunyikan data siapa pun.
- **Kategori CRUD (bukan enum tetap)** — beda dari Routine App yang periode-nya enum tetap; di sini sama persis pola Kitchen App krn kategori catatan memang perlu fleksibel/personal.
- **`updatedAt` terpisah dari toggle pin** — keputusan sengaja spy sematkan/batal-sematkan bukan dianggap "mengedit" utk keperluan sorting "Catatan Terbaru" (lihat "Struktur data di Firebase").
- **Halaman Tersemat berdiri sendiri** (bukan cuma filter kategori) — beda dari pola filter-tab app lain, krn "akses cepat ke catatan penting" adalah kebutuhan eksplisit user, bukan sekadar kategori tambahan.

## Rencana / TODO ke depan

- **Auth**: sama seperti app lain, DB masih publik readable/writable tanpa proteksi. Rules Firebase console perlu ditambahkan entry `note: { ".write": true }` kalau belum ada.
- Belum ada fallback `setTimeout` di loading overlay kalau koneksi Firebase gagal total (sama catatan dgn app lain).
- Kemungkinan fitur lanjutan: reminder/notifikasi (utk catatan kategori "Reminder" bisa dikasih waktu & notif), rich text/checklist di dalam isi catatan (saat ini plain text), lampiran gambar, arsip (beda dari hapus permanen).
- Belum ada testing otomatis / build pipeline — project murni HTML/CSS/JS statis.

## Catatan implementasi

- Semua teks UI berbahasa Indonesia, konsisten dgn app lain.
- Saat menambahkan fitur baru, ikuti pola yang sudah ada: render function terpisah per bagian (`renderDashboard`, `renderNoteList`, `renderPinnedList`, dst.), dipanggil ulang dari `renderAll()` tiap snapshot Firebase berubah — jangan panggil render manual setelah operasi tulis, biarkan listener realtime yang memicu re-render.
- **Wajib**: setiap kali ada perubahan struktur/fitur di project ini, update dokumen ini (`app/.claude/note-app.md`) di perubahan yang sama — berlaku di semua project dalam repo `iyonadryan.github.io`.
