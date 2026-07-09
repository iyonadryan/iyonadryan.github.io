# Generate Color (`tool/generate-color/`)

Dari satu warna dasar, buat kombinasi warna pakai skema harmoni klasik (komplementer, analogus, triadik, tetradik, split-komplementer, monokromatik), plus katalog besar warna bertingkat terang-gelap ala kartu contoh cat tembok. Semuanya dihitung langsung di browser, tidak ada data/API eksternal.

## Status saat ini

Prototype pertama, dibangun bareng `color-picker/` dan hub `tool/index.html` dlm satu sesi.

## Dependensi eksternal

- Google Fonts (Inter + IBM Plex Mono) — sama dgn tool lain di `tool/`.
- Tidak ada library warna eksternal (tidak pakai chroma.js/tinycolor/dst) — semua konversi HEX↔RGB↔HSL ditulis manual di `script.js` (fungsi standar, sudah diuji manual round-trip HEX→HSL→HEX utk beberapa warna termasuk hitam/putih/abu-abu/warna primer, hasilnya presisi).
- Tidak ada build tool, tidak ada Firebase.

## Struktur file

- `index.html`, `style.css`, `script.js` — pola sama dgn tool lain di `tool/`.

## Cara kerja

### State warna dasar

`currentBaseHex` — satu sumber kebenaran, disinkronkan ke **4 tempat** tiap berubah: `<input type="color">` (color picker native), input teks HEX (`#RRGGBB`, dgn validasi), tiga input angka R/G/B terpisah (`#baseColorR/G/B`, masing-masing `0-255`), dan re-render bagian "Skema Warna". **Tidak disimpan** ke `localStorage` — reload halaman kembali ke default `#0F6E63` (warna aksen tool ini sendiri). Beda dgn daftar "Warna Tersimpan" (lihat subbagian di bawah), yang justru **memang** persist krn tujuannya beda: `currentBaseHex` cuma state kerja sesaat, drpd "Warna Tersimpan" yang gunanya membandingkan pilihan warna dari waktu ke waktu.

**Sinkronisasi hex ↔ RGB tanpa saling rebutan kursor saat mengetik**: `setBaseColor(hex, opts)` nerima `opts.skipHexSync`/`opts.skipRgbSync` — tiap field yang punya listener `input` live (hex, R, G, B) matiin sync ke DIRINYA SENDIRI pas manggil `setBaseColor()` dari listener-nya sendiri, cuma nyinkronin field LAIN. Alasannya: nulis ulang value sebuah `<input>` teks/angka yang lagi difokus & diketik user (walau nilainya "sama") bisa mengganggu posisi kursor atau balapan sama pengetikan user tiap keystroke. Field yang sedang diketik baru dirapikan/di-clamp pas `blur` (fokus pindah), bukan tiap huruf/angka.

**Bug: default warna dasar kadang bukan `#0F6E63` pas buka halaman** — akar masalahnya browser Chromium (& turunannya) me-restore value terakhir sebuah `<input>` teks/angka pas halaman di-reload biasa (Ctrl+R), **walau elemennya tidak di dalam `<form>`** dan walau `value="..."` di HTML-nya tetap `#0F6E63`. Kode awal baca `currentBaseHex` dari `baseColorPicker.value` saat script jalan (`normalizeHex(baseColorPicker.value) || '#0F6E63'`) — kalau browser sudah keburu nyuntik value lama (mis. warna terakhir yang sempat dicoba sblm reload) ke input itu SEBELUM script sempat baca, hasilnya default yang salah, bukan bug di logika warna. Diperbaiki dgn: (1) `DEFAULT_BASE_HEX` konstanta terpisah, tidak pernah baca dari DOM; (2) `INIT` manggil `setBaseColor(DEFAULT_BASE_HEX)` scr eksplisit di awal, maksa SEMUA field (picker, hex, R, G, B) balik ke default kanonik, nimpa apa pun yang sudah kadung disuntik browser; (3) `autocomplete="off"` ditambahkan ke kelima input itu sbg lapisan pertahanan tambahan (mengurangi kemungkinan restore di browser lain juga, walau fix #1-2 di atas yang benar2 menjamin).

### Warna Tersimpan (`savedColors`, tombol "Simpan")

Diminta scr eksplisit user: tombol **Simpan** di samping **Acak** menyimpan `currentBaseHex` saat ini ke daftar "Warna Tersimpan" (chip kecil di bawah baris warna dasar) — gunanya biar user gampang loncat-membandingkan beberapa warna yang sudah pernah dicoba, bukan cuma warna terakhir.

- Disimpan ke `localStorage` (key `generatecolor_saved`, array JSON berisi HEX) — **beda** dari `currentBaseHex` yang sengaja tidak persist (lihat di atas): daftar ini justru harus tetap ada setelah reload, itu poin utamanya.
- Klik tombol **Simpan** → `currentBaseHex` ditambahkan ke depan daftar (`unshift`, jadi yg terbaru muncul duluan) — kalau HEX itu sudah ada di daftar, tidak ada duplikat, cuma toast "sudah tersimpan".
- Klik salah satu **chip warna tersimpan** → `setBaseColor()` dgn HEX chip itu (jadikan warna dasar aktif, skema & katalog ikut re-render) — begini caranya "membandingkan": klik satu chip, lihat hasil skemanya, klik chip lain, bandingkan.
- Tombol **✕** kecil di tiap chip → hapus HEX itu dari daftar & `localStorage` (event delegation dgn `e.stopPropagation()` spy klik ✕ tidak ikut memicu "jadikan warna dasar" milik chip induknya).
- `loadSavedColors()`/`persistSavedColors()` dibungkus try/catch — `localStorage` bisa penuh atau nonaktif (mode privat browser), gagal baca/tulis dibiarkan diam-diam drpd bikin seluruh tool error cuma krn fitur simpan gagal.

Input teks HEX (`baseColorHex`) sengaja **tidak langsung menerapkan** tiap ketikan mentah-mentah: kalau baru 3 digit (`#0f6`, kebetulan valid sbg notasi HEX pendek/shorthand) sementara user masih bermaksud mengetik 6 digit penuh (`#0f6e63`), auto-apply langsung di tengah pengetikan akan sempat menerapkan warna yang salah (`#0f6` di-expand jadi `#00FF66`) sebelum user selesai mengetik. Makanya auto-apply cuma jalan begitu ada 6 digit HEX lengkap; input 3-digit tetap diterima tapi baru diterapkan saat field kehilangan fokus (blur) — begitu juga fallback: kalau di-blur dalam keadaan tidak valid sama sekali, teksnya dikembalikan ke `currentBaseHex` yang terakhir valid, drpd dibiarkan menampilkan teks yang salah.

### Skema warna (`SCHEME_META`)

Tiap skema didefinisikan sbg fungsi `build(h,s,l)` yang mengembalikan array `{hex, role}`, dihitung dari HSL warna dasar (bukan RGB — rotasi "derajat di roda warna" jauh lebih alami dilakukan di ruang HSL lewat penjumlahan `hue`):

| Skema | Rumus hue | Jumlah warna |
|---|---|---|
| Komplementer | dasar, +180° | 2 |
| Analogus | -30°, dasar, +30° | 3 |
| Triadik | dasar, +120°, +240° | 3 |
| Tetradik | dasar, +90°, +180°, +270° | 4 |
| Split-Komplementer | dasar, +150°, +210° | 3 |
| Monokromatik | hue & saturasi sama, lightness `[85,70,55,40,25]` | 5 |
| **Palet UI (5 Warna)** | lihat subbagian di bawah — beda jenis dari 6 skema roda-warna di atas | 5 |

Tiap swatch skema py 2 tombol: **Salin** (HEX ke clipboard) dan **Pakai** (jadikan warna itu sbg warna dasar baru → memicu ulang semua skema dari sana — jadi bisa "menjelajah" roda warna dgn saling meloncat antar hasil).

### Palet UI (5 Warna) — role-based, bukan rotasi roda warna

Diminta scr eksplisit user ("skema warna jg tambahin utk kebutuhan UI UX yang biasanya isi 5"), lalu diriset dulu lewat `WebSearch` sebelum diimplementasi — bukan cuma opini. Sumber yang dicek: panduan warna UI dari Figma, IxDF/careerfoundry, NN/g, dan Supercharge Design/UXPin soal struktur warna design system. Semuanya konvergen ke pola yang sama:

- **Aturan 60-30-10** (dipinjam dari desain interior): 60% warna dominan/primer, 30% warna sekunder, 10% warna aksen (saturasi tinggi, kontras maksimal, dipakai secukupnya spy tetap "menonjol" — CTA, notifikasi, link penting).
- **Warna netral** (utk latar & teks) idealnya **di-tint mengikuti hue brand**, bukan abu-abu/hitam-putih polos — praktik modern yang juga dipakai palet `--text`/`--bg` tool ini sendiri (mis. `#16181B` bukan `#000000`).
- **Kontras teks vs latar** wajib memenuhi WCAG AA (≥4.5:1 utk teks body) — bukan sekadar "kelihatan oke".

Diterjemahkan jadi 5 peran (`SCHEME_META.uiPalette`, ditandai `isUiPalette:true` biar `renderScheme()` tahu harus merender kartu role-based, bukan kartu hue-rotation biasa):

| Peran | Hue | Saturasi | Lightness | Kegunaan |
|---|---|---|---|---|
| Primer (60%) | dasar | dasar | dasar | Elemen branding utama: tombol utama, link, header |
| Sekunder (30%) | -40° | ×0.85 | +8 (dijepit 15–88) | Kartu, sidebar, elemen pendukung |
| Aksen (10%) | +165° | dinaikkan ke min. 75 | 52 (tetap) | CTA, notifikasi — dipakai secukupnya |
| Netral Terang | dasar | 10 (tetap) | 97 (tetap) | Latar halaman/kartu |
| Netral Gelap | dasar | 16 (tetap) | 15 (tetap) | Teks body & judul |

Netral Terang/Gelap sengaja **tidak bergantung** pada saturasi/lightness warna dasar (cuma hue-nya) — supaya pasangan latar-teks selalu berkontras tinggi apa pun warna dasarnya (sudah dites lewat skrip Node manual thd 5 warna dasar berbeda, termasuk yang sangat terang/pucat & yang minim saturasi — kontras hasilnya selalu ≥13:1, jauh di atas ambang WCAG AA 4.5:1).

Di bawah grid, muncul catatan kontras (`#contrastNote`, cuma tampil utk skema ini) yang menghitung rasio kontras WCAG asli (`relLuminance()`/`contrastRatio()`, rumus resmi W3C) antara Netral Terang & Netral Gelap, dan menandai lolos/tidaknya ambang AA 4.5:1 — secara desain (lihat tabel di atas) akan selalu lolos, tapi catatan ini tetap dihitung ulang tiap render (bukan teks statis) spy tetap valid kalau formula di atas diubah nanti.

### Katalog Warna (`buildCatalogRows()`)

**Bukan** hasil scrape/data dari katalog cat merek tertentu — murni digenerate sistematis, terinspirasi dari cara toko cat memajang kartu contoh warna (satu keluarga warna, banyak tingkat terang-gelap):

- **16 keluarga hue** dgn nama Indonesia, disebar keliling roda warna (`HUE_FAMILIES`, dari Merah 0° sampai Merah Muda 340°), ditambah 2 keluarga khusus: **Abu-abu** (saturasi 0, cuma ramp lightness) dan **Cokelat** (bukan hue spektral asli — didekati sbg jingga gelap-desaturasi, hue ~28° dgn saturasi & rentang lightness sendiri yang lebih gelap, krn "cokelat" scr visual tidak pernah muncul di ujung terang/pastel spt keluarga hue lain).
- Tiap keluarga py **10 tingkat** bernomor ala Tailwind (`50, 100, 200, ... 900` — dari paling terang ke paling gelap), dgn lightness (`TIER_LIGHTNESS`) tetap sama utk semua keluarga (biar sejajar), dan saturasi yang sedikit menurun di kedua ujung ramp (`TIER_SAT_MULT`, mendekati 1.0 cuma di tengah) — meniru bagaimana warna cat sungguhan terlihat agak "pudar" di ujung paling terang/gelapnya, bukan makin jenuh terus.
- Total **18 baris × 10 kolom = 180 swatch**. Klik swatch mana pun → HEX-nya disalin ke clipboard **dan** langsung dijadikan warna dasar baru (skema warna di atas ikut ter-render ulang) — dua aksi sekaligus, mengaitkan katalog dgn generator skema dlm satu tool yang sama.

### Salin & toast

Sama persis pola `copyText()`/toast di `tool/color-picker/script.js` (fallback `execCommand('copy')` kalau Clipboard API tidak tersedia) — kode terpisah/diduplikasi, bukan file bersama, konsisten dgn filosofi "tiap tool berdiri sendiri" (lihat `tool/.claude/CLAUDE.md`).

## Fitur yang sudah ada

1. Warna dasar via color picker native + input HEX manual **+ tiga input angka R/G/B terpisah** (semuanya saling sinkron real-time, lihat "State warna dasar"), plus tombol "Acak" (random RGB) dan **"Simpan"** (simpan warna dasar aktif ke daftar "Warna Tersimpan" yang persist ke `localStorage` — lihat subbagian "Warna Tersimpan"). Tiap chip warna tersimpan bisa diklik (jadikan warna dasar lagi, utk membandingkan) atau dihapus (✕).
2. 7 tab skema warna: 6 skema harmoni roda-warna + 1 **Palet UI (5 Warna)** role-based (lihat tabel & subbagian "Palet UI" di atas), tiap swatch bisa disalin atau dijadikan warna dasar baru.
3. Deskripsi singkat tiap skema (`#schemeDesc`) menjelaskan rumus & kapan skema itu cocok dipakai; khusus Palet UI, tiap swatch py label peran + tip pemakaian, dan muncul catatan rasio kontras WCAG AA antara Netral Terang & Gelap (`#contrastNote`).
4. Katalog warna 180-swatch (16 keluarga hue + abu-abu + cokelat × 10 tingkat), hover nampilkan kode HEX, klik menyalin + menjadikannya warna dasar.
5. Toggle tema terang/gelap (`generatecolor_theme`, independen dari tool lain — lihat `tool/.claude/CLAUDE.md` bagian "Identitas visual bersama").

## Rencana / TODO ke depan

- Katalog warna belum punya nama spesifik per-swatch (mis. "Merah 500") selain label keluarga+angka tingkat — bisa ditambah kalau dibutuhkan nama yang lebih deskriptif/marketable.
- Belum ada cara menyimpan/mengekspor palet (mis. unduh sbg gambar, salin semua HEX skema sekaligus, format utk Figma/CSS variables, dst).
- Belum ada testing otomatis / build pipeline — project murni HTML/CSS/JS statis.

## Catatan implementasi

- Semua teks UI berbahasa Indonesia.
- **Wajib**: setiap kali ada perubahan struktur/fitur di project ini, update dokumen ini (`tool/.claude/generate-color.md`) di perubahan yang sama.
