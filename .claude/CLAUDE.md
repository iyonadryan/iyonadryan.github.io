# Iyon App (hub)

`app.html` di root repo — halaman prototype yang mengumpulkan link ke aplikasi web/mobile yang dibuat (bukan project showcase biasa seperti di `index.html` utama, tapi khusus app "beneran" yang dipakai sehari-hari: Kitchen App, Finance App, Routine App, dst).

## Status saat ini

Prototype pertama — `app.html` (markup + JS inline) + `style-app.css` (CSS terpisah, di-link via `<link rel="stylesheet" href="style-app.css">`), tanpa dependency eksternal. Belum terhubung ke apa pun (murni halaman navigasi/launcher), tidak ada data sendiri.

## Kenapa di root, bukan di `app/`

Folder `app/` sempat dibuat kosong sebagai working directory, tapi diputuskan **tidak dipakai** — `kitchen/` dan `finance/` sudah lebih dulu ada sejajar di root repo (`iyonadryan.github.io/kitchen`, `/finance`), jadi hub ini dibuat sebagai `app.html` di root juga supaya link `kitchen/index.html` & `finance/index.html` relatif langsung tanpa perlu pindah folder (yang akan mematahkan URL lama).

## Struktur halaman

- Header/hero (gradient ungu `--gradient-hero`, beda dari oranye Kitchen & teal Finance — sengaja netral karena ini halaman "pembungkus" keduanya) — judul "Iyon App" + tombol toggle tema (☀️/🌙) di pojok kanan atas. **Tidak ada bottom nav** (beda dari Kitchen/Finance) karena halaman ini cuma daftar link, bukan app dengan banyak halaman.
- List card aplikasi (`.app-card`) — tiap card: ikon emoji berwarna gradient khas app-nya (🍳 oranye utk Kitchen, 💰 teal utk Finance, 🔁 ungu-indigo utk Routine — warna icon sengaja meniru primary color masing-masing app), nama, deskripsi singkat, panah `›`. Klik card → link langsung ke `<folder>/index.html`.
- Ada `.empty-slot` placeholder dashed box di bawah list menandakan slot utk app berikutnya — update manual (tambah `<a class="app-card">` baru) kalau ada app baru.

## Tema light/dark

`data-theme` di `<html>`, variabel CSS di `:root`/`[data-theme="dark"]` — pola sama dengan Kitchen/Finance/Routine (lihat `kitchen/.claude/CLAUDE.md`, `finance/.claude/CLAUDE.md`, `routine/.claude/CLAUDE.md`), tapi state disimpan sendiri: localStorage key **`iyonapp_theme`** (terpisah dari `kitchenapp_theme`/`financeapp_theme`/`routineapp_theme` — ini shell/hub sendiri, bukan bagian dari app manapun). Fallback ke `prefers-color-scheme` kalau belum ada preferensi tersimpan.

## Rencana / TODO ke depan

- Tambah app baru: cukup tambah satu `.app-card` baru di `app.html` (ikon, nama, deskripsi, href ke `<folder>/index.html`), dan hapus/pindahkan `.empty-slot` placeholder kalau sudah tidak relevan.
- Belum ada favicon khusus — reuse `webimg/iyon-favicon.ico` punya portfolio utama.
- Belum dipikirkan apakah `app.html` nanti di-link dari `index.html` utama (portfolio) — saat ini berdiri sendiri, diakses langsung via URL.

## Catatan implementasi

- Semua teks UI berbahasa Indonesia, konsisten dengan Kitchen, Finance, & Routine App.
- **Wajib**: setiap kali ada perubahan struktur/fitur di `app.html` (app baru ditambahkan, halaman dipecah jadi banyak file, dll.), update dokumen ini di perubahan yang sama.
