# Tool (bengkel/utilitas mandiri)

`tool/` — folder kumpulan alat/utilitas web mandiri (client-side, jalan langsung di browser). Beda dari `app/` (lihat `app/.claude/CLAUDE.md`) yang khusus aplikasi Firebase-backed personal (Iyon/Ciwul) dgn hub launcher (`app/index.html`), multi-user, dashboard, dst — tool di sini berdiri sendiri, tidak terhubung ke Firebase project yang sama, dan biasanya tidak butuh konsep "pengguna aktif"/kategori/tema tersimpan spt app/. Fokusnya murni: satu tool = satu tugas spesifik yang diselesaikan sepenuhnya di browser.

## Kenapa folder terpisah dari `app/`

Tool pertama (`pdf-editor/`) sempat dipertimbangkan masuk `app/` krn pola foldernya mirip, tapi sifatnya beda: bukan app pribadi yang dipakai berulang dgn data tersimpan (spt Note/Wishlist/dst), melainkan utilitas sekali-pakai per sesi (buka file → olah → unduh → selesai, tidak ada data yang persist). Menaruhnya di `app/` akan salah kaprah krn `app/.claude/CLAUDE.md` & hub-nya didesain khusus utk ekosistem app Iyon/Ciwul. `tool/` jadi kategori ketiga yang sejajar dgn `app/` di root repo, bukan sub-bagian dari `app/`.

## Struktur folder

```
tool/
  .claude/
    CLAUDE.md          # file ini
    pdf-editor.md       # dokumentasi Bengkel PDF
    color-picker.md      # dokumentasi Color Picker
    generate-color.md    # dokumentasi Generate Color
  index.html          # hub — daftar link ke semua tool (lihat "Halaman hub" di bawah)
  style-tool.css       # CSS khusus hub, TIDAK dipakai/di-share ke tool manapun
  pdf-editor/
    index.html
    style.css
    script.js
  color-picker/
    index.html
    style.css
    script.js
  generate-color/
    index.html
    style.css
    script.js
```

## Dokumentasi per-tool dikonsolidasi (pola sama dgn `app/.claude/`)

Tiap tool **tidak punya folder `.claude/` sendiri** di dalam foldernya — dokumentasi ditaruh sbg file terpisah di `tool/.claude/<nama-tool>.md` (mis. `pdf-editor.md`). Folder `tool/` sendiri (bukan tool spesifik mana pun) punya `tool/.claude/CLAUDE.md` ini utk hal lintas-tool (struktur folder, konvensi bersama, TODO hub).

## Halaman hub (`tool/index.html`)

Sama pola dgn `app/index.html`: daftar `.tool-card` (ikon emoji, nama, deskripsi singkat, panah `›`) yang link langsung ke `<folder>/index.html`, link **relatif** (lihat alasan di `app/.claude/CLAUDE.md` bagian "Kenapa link relatif" — sama persis berlaku di sini krn user buka file langsung lewat `file://`). Termasuk toggle tema (localStorage key sendiri `iyontool_theme`, independen dari tema tiap tool di dalamnya) & animasi masuk kartu berjenjang (`@keyframes cardEnter`, delay dihitung otomatis dari urutan DOM, pola sama dgn `app/index.html`). `.empty-slot` di bawah list menandakan slot tool berikutnya — tambah `.tool-card` baru **di atasnya**, bukan di sembarang posisi, kalau ada tool baru.

`style-tool.css` **cuma dipakai halaman hub ini** — bukan file bersama yang di-`<link>` dari tool lain (tiap tool tetap punya `style.css` sendiri-sendiri, prinsip "setiap tool berdiri sendiri" tetap berlaku, hub cuma kebetulan berbagi token warna/font yang SAMA NILAINYA dgn tiap tool demi tampilan senada — bukan file yang sama).

## Identitas visual bersama (disalin manual ke tiap tool, bukan file CSS bersama)

Semua halaman di `tool/` (hub + tiap tool) pakai token warna & tipografi yang sama nilainya, supaya terasa satu keluarga "Iyon Tool" — **tapi disalin manual ke `:root` masing-masing file**, bukan lewat satu file CSS yang di-`<link>` bareng (biar tiap tool tetap independen, sesuai filosofi `tool/`, lihat "Kenapa folder terpisah dari `app/`"):

- Font: Inter (UI) + IBM Plex Mono (label kecil uppercase/monospace, mis. angka RGB) — sama Google Fonts link tiap file.
- Warna terang: `--accent:#0F6E63` (teal), `--bg:#FAFAFA`, `--surface:#FFFFFF`, dst.
- Warna gelap (`[data-theme="dark"]`): `--accent:#35B3A0`, `--bg:#14171A`, `--surface:#1B1F23`, dst.
- Tiap tool & hub punya toggle tema + localStorage key **sendiri-sendiri** (`iyontool_theme`, `colorpicker_theme`, `generatecolor_theme`) — pola sama persis dgn tiap app di `app/` yang juga tidak berbagi key tema walau satu keluarga (lihat `app/.claude/CLAUDE.md` bagian tema).
- **Pengecualian**: `pdf-editor/` (tool pertama, dibuat sebelum identitas visual ini "dibakukan") belum punya `[data-theme="dark"]` sama sekali — light-only. Belum diretrofit krn tidak diminta; kalau nanti diminta, tinggal salin blok `[data-theme="dark"]` dari tool lain ke `pdf-editor/style.css` + tambah tombol toggle di `index.html`-nya.

## Status saat ini

- **`pdf-editor/`** — Bengkel PDF, editor PDF client-side (upload/gabung PDF, reorder/rotate/hapus/ekstrak halaman, tambah teks & tanda tangan overlay lalu "terapkan"/bake ke PDF, isi form AcroForm, unduh hasil). Lihat `tool/.claude/pdf-editor.md`.
- **`color-picker/`** — upload gambar/PDF, sistem otomatis membaca 9 warna dominan, dan klik piksel mana pun utk lihat warnanya (HEX & RGB, bisa disalin). Lihat `tool/.claude/color-picker.md`.
- **`generate-color/`** — generate skema warna dari satu warna dasar (komplementer/analogus/triadik/tetradik/split-komplementer/monokromatik) + katalog warna besar (16 keluarga hue × 10 tingkat terang-gelap, ala kartu contoh cat tembok). Lihat `tool/.claude/generate-color.md`.
- **Ada halaman hub** (`tool/index.html`) yang mengumpulkan link ke ketiga tool di atas — lihat "Halaman hub" di atas.
- **Belum terhubung** dari portfolio utama (`index.html` di root) maupun dari hub `app/index.html` — `tool/index.html` berdiri sendiri, diakses langsung via URL.
- Tidak ada dependency Firebase/backend sama sekali di `tool/` — semua tool di sini murni client-side (beda dari semua app di `app/` yang selalu terhubung Firebase Realtime Database sejak awal).

## Rencana / TODO ke depan

- Tambah tool baru: bikin folder baru di dalam `tool/` (mis. `tool/<nama-tool>/`), dokumentasi langsung dibuat di `tool/.claude/<nama-tool>.md` — **jangan** bikin folder `.claude/` terpisah di dalam folder tool itu sendiri (lihat "Dokumentasi per-tool dikonsolidasi"). Tambah juga satu `.tool-card` baru di `tool/index.html` (ikon, nama, deskripsi, href relatif ke `<folder>/index.html`) **di atas** `.empty-slot`.
- Belum dipikirkan apakah `tool/index.html` nanti di-link dari portfolio utama atau dari `app/index.html` — saat ini berdiri sendiri.
- `pdf-editor/` belum punya mode gelap (lihat "Identitas visual bersama" di atas) — bisa diretrofit kalau diminta.

## Catatan implementasi

- Semua teks UI berbahasa Indonesia, konsisten dgn `app/`.
- **Wajib**: setiap kali ada perubahan struktur/fitur di tool manapun dalam `tool/`, update dokumen tool terkait (`tool/.claude/<nama-tool>.md`) di perubahan yang sama. Update file ini (`tool/.claude/CLAUDE.md`) juga kalau ada perubahan lintas-tool (tool baru ditambahkan, struktur folder berubah, dst) — pola sama persis dgn kewajiban update `app/.claude/CLAUDE.md`.
