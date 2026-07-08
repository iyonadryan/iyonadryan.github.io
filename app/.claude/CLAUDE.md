# Iyon App (hub)

`app/index.html` — halaman prototype yang mengumpulkan link ke aplikasi web/mobile yang dibuat (bukan project showcase biasa seperti di `index.html` utama di root repo, tapi khusus app "beneran" yang dipakai sehari-hari: Kitchen App, Finance App, Routine App, Patungan App, Note App, dst).

## Status saat ini

Prototype pertama — `app/index.html` (markup + JS inline) + `app/style-app.css` (CSS terpisah, di-link via `<link rel="stylesheet" href="style-app.css">`), tanpa dependency eksternal. Belum terhubung ke apa pun (murni halaman navigasi/launcher), tidak ada data sendiri.

## Struktur folder: semua app di dalam `app/`

Awalnya hub ini `app.html` di **root repo** (dan `kitchen/`/`finance`/dst juga sejajar di root), dengan alasan folder `app/` yang sempat dibuat kosong sengaja **tidak dipakai** biar link relatif tetap pendek tanpa perlu pindah folder. **Keputusan itu dibalik** atas permintaan user — sekarang semua app (`kitchen/`, `finance/`, `routine/`, `patungan/`, `note/`) dipindah ke dalam `app/`, dan `app.html` ikut pindah + berganti nama jadi `app/index.html`, supaya struktur file di root repo lebih rapi (tidak ada banyak folder app lepas sejajar dengan folder project lama seperti `trialerror/`, `wedding/`, dst).

```
iyonadryan.github.io/
  app/
    index.html          # hub ini (dulu app.html di root)
    style-app.css        # dulu style-app.css di root
    img/                 # ikon pengguna (iyon.png/ciwul.png/couple.png) — SATU sumber
                          # dipakai bareng oleh Finance/Routine/Note App (lihat "Sumber img/ dikonsolidasi")
    .claude/
      CLAUDE.md           # file ini (dulu .claude/CLAUDE.md di root)
      kitchen-app.md       # dulu kitchen/.claude/CLAUDE.md (lihat "Dokumentasi per-app dikonsolidasi")
      finance-app.md       # dulu finance/.claude/CLAUDE.md
      routine-app.md       # dulu routine/.claude/CLAUDE.md
      patungan-app.md      # dulu patungan/.claude/CLAUDE.md
      note-app.md          # dulu note/.claude/CLAUDE.md
    kitchen/
    finance/
    routine/
    patungan/
    note/
  index.html             # portfolio utama, TIDAK terhubung ke app/ (lihat TODO)
  webimg/, trialerror/, wedding/, dst.  # project portfolio lama, tidak berubah
```

Karena semua app tetap **sejajar sebagai anak langsung `app/`** (cuma pindah satu level lebih dalam bareng-bareng), link antar mereka **tidak berubah** — `kitchen/index.html`, `finance/index.html`, dst di `app/index.html` tetap relatif apa adanya. Yang berubah:
- Tiap app's tombol "Semua Aplikasi" di Pengaturan: `../app.html` → **`../index.html`** (nama file hub berubah, tetap relatif).
- Favicon hub: `webimg/iyon-favicon.ico` → **`../webimg/iyon-favicon.ico`** (naik satu level ke root dulu sebelum ke `webimg/`, tetap relatif).
- Firebase path (`kitchen`, `finance`, `routine`, `patungan`, `note` di root Realtime Database) **tidak berubah** — itu struktur data cloud, sama sekali independen dari struktur file lokal.

### Kenapa link relatif (`../index.html`), BUKAN path absolut (`/app/index.html`)

Sempat dicoba pakai path absolut (`/app/index.html`) krn waktu testing lewat dev server lokal `npx serve`, ketahuan link relatif "rapuh" thd trailing-slash (redirect chain `serve` bisa bikin `../index.html` resolve ke tempat salah). **Tapi ini salah langkah** — user buka app-nya langsung lewat `file://` (double-click file di Explorer/Finder, bukan lewat web server), dan di protokol `file://`, path absolut spt `/app/index.html` di-resolve ke **root drive** (mis. `C:/app/index.html`), BUKAN ke folder project — link jadi rusak total. Path relatif (`../index.html`) sebaliknya bekerja benar baik di `file://` (workflow utama user buat testing lokal) maupun di GitHub Pages produksi (asal diakses dgn URL yang wajar, ada `index.html`/trailing slash — kasus umum, bukan bare-path tanpa trailing slash yang cuma masalah kalau lewat `npx serve`). **Kesimpulan: selalu pakai link relatif utk apa pun di dalam repo ini** — path absolut cuma aman di web server sungguhan, bukan di `file://`.

### Sumber `img/` dikonsolidasi

Ikon pengguna (`iyon.png`/`ciwul.png`/`couple.png`, placeholder foto bulat) awalnya disalin terpisah ke tiap app yang butuh (Finance, Routine, Note — app yang punya konsep "Dibuat oleh"). Sekarang **cuma ada satu salinan** di `app/img/`, dipakai bareng lewat path relatif `../img/<nama>.png` dari masing-masing app (mis. `finance/script.js` → `USERS.iyon.icon = "../img/iyon.png"`). Kitchen & Patungan tidak butuh (tidak ada konsep "Dibuat oleh"/pengguna).

### Dokumentasi per-app dikonsolidasi

Tiap app **tidak lagi punya folder `.claude/` sendiri** — semua dokumentasi project dipindah jadi file terpisah di `app/.claude/`, dinamai `<nama-app>-app.md` (mis. `finance-app.md`, `kitchen-app.md`). Hub ini (`app/`) tetap punya `app/.claude/CLAUDE.md` sendiri (file ini) — cuma sub-app yang dikonsolidasi. **Update progres tiap app tetap di file masing-masing** (`app/.claude/<nama>-app.md`), bukan digabung jadi satu file besar.

## Struktur halaman

- Header/hero (gradient ungu `--gradient-hero`, beda dari oranye Kitchen & teal Finance — sengaja netral karena ini halaman "pembungkus" keduanya) — judul "Iyon App" + tombol toggle tema (☀️/🌙) di pojok kanan atas. **Tidak ada bottom nav** (beda dari Kitchen/Finance) karena halaman ini cuma daftar link, bukan app dengan banyak halaman.
- List card aplikasi (`.app-card`) — tiap card: ikon emoji berwarna gradient khas app-nya (🍳 oranye utk Kitchen, 💰 teal utk Finance, 🔁 ungu-indigo utk Routine, 🧾 rose/merah muda utk Patungan, 📝 amber/kuning utk Note — warna icon sengaja meniru primary color masing-masing app), nama, deskripsi singkat, panah `›`. Klik card → link langsung ke `<folder>/index.html`.
- Urutan card **bukan** urut abjad/urut dibuat — Finance → Kitchen → Routine → Patungan → Note (app baru ditaruh paling bawah, di atas `.empty-slot`, sesuai permintaan user tiap kali nambah app baru).
- Ada `.empty-slot` placeholder dashed box di bawah list menandakan slot utk app berikutnya — update manual (tambah `<a class="app-card">` baru **di atas** `.empty-slot`, bukan di sembarang posisi) kalau ada app baru.
- **Animasi masuk saat halaman dibuka**: tiap child langsung `.app-list` (semua `.app-card` + `.empty-slot` paling bawah) geser dari bawah (`translateY(24px)` → `0`) sambil fade in (`opacity 0` → `1`) lewat `@keyframes cardEnter` di `style-app.css`, dgn **delay 0.25 detik berjenjang** antar kartu (kartu ke-N delay `(N-1) × 0.25s`) — permintaan eksplisit user. Delay-nya **dihitung otomatis dari urutan DOM lewat JS** (`document.querySelectorAll(".app-list > *").forEach(...)` di `<script>` inline `index.html`, set `el.style.animationDelay`), **bukan** nth-child CSS manual — jadi nambah `.app-card` baru (lihat TODO di bawah) otomatis ikut kena stagger tanpa perlu sentuh CSS animasi ini sama sekali. Ada fallback `prefers-reduced-motion: reduce` (durasi dipangkas ke ~0, delay dibuang) di `style-app.css`.

## Tema light/dark

`data-theme` di `<html>`, variabel CSS di `:root`/`[data-theme="dark"]` — pola sama dengan Kitchen/Finance/Routine/Patungan/Note (lihat `app/.claude/kitchen-app.md`, `app/.claude/finance-app.md`, `app/.claude/routine-app.md`, `app/.claude/patungan-app.md`, `app/.claude/note-app.md`), tapi state disimpan sendiri: localStorage key **`iyonapp_theme`** (terpisah dari `kitchenapp_theme`/`financeapp_theme`/`routineapp_theme`/`patunganapp_theme`/`noteapp_theme` — ini shell/hub sendiri, bukan bagian dari app manapun). Fallback ke `prefers-color-scheme` kalau belum ada preferensi tersimpan.

## Rencana / TODO ke depan

- Tambah app baru: bikin folder baru **di dalam `app/`** (bukan di root repo lagi), tambah satu `.app-card` baru di `app/index.html` (ikon, nama, deskripsi, href ke `<folder>/index.html`), dan hapus/pindahkan `.empty-slot` placeholder kalau sudah tidak relevan. Jangan lupa tambah field "Semua Aplikasi" → `../index.html` (**relatif**, bukan absolut — lihat "Kenapa link relatif") di app baru itu sendiri (lihat pola di app lain). Dokumentasi app baru langsung dibuat di `app/.claude/<nama>-app.md`, **jangan** bikin folder `.claude/` terpisah di dalam folder app itu sendiri.
- Belum ada favicon khusus — reuse `../webimg/iyon-favicon.ico` punya portfolio utama.
- Belum dipikirkan apakah `app/index.html` nanti di-link dari `index.html` utama (portfolio) — saat ini berdiri sendiri, diakses langsung via URL `/app/` atau `/app/index.html`.

## Catatan implementasi

- Semua teks UI berbahasa Indonesia, konsisten dengan Kitchen, Finance, Routine, Patungan, & Note App.
- **Wajib**: setiap kali ada perubahan struktur/fitur di `app/index.html` (app baru ditambahkan, halaman dipecah jadi banyak file, dll.), update dokumen ini di perubahan yang sama.
