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

`currentBaseHex` — satu sumber kebenaran, disinkronkan ke 3 tempat tiap berubah: `<input type="color">` (color picker native), input teks HEX (`#RRGGBB`, dgn validasi), dan re-render bagian "Skema Warna". **Tidak disimpan** ke `localStorage` — reload halaman kembali ke default `#0F6E63` (warna aksen tool ini sendiri).

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

Tiap swatch skema py 2 tombol: **Salin** (HEX ke clipboard) dan **Pakai** (jadikan warna itu sbg warna dasar baru → memicu ulang semua skema dari sana — jadi bisa "menjelajah" roda warna dgn saling meloncat antar hasil).

### Katalog Warna (`buildCatalogRows()`)

**Bukan** hasil scrape/data dari katalog cat merek tertentu — murni digenerate sistematis, terinspirasi dari cara toko cat memajang kartu contoh warna (satu keluarga warna, banyak tingkat terang-gelap):

- **16 keluarga hue** dgn nama Indonesia, disebar keliling roda warna (`HUE_FAMILIES`, dari Merah 0° sampai Merah Muda 340°), ditambah 2 keluarga khusus: **Abu-abu** (saturasi 0, cuma ramp lightness) dan **Cokelat** (bukan hue spektral asli — didekati sbg jingga gelap-desaturasi, hue ~28° dgn saturasi & rentang lightness sendiri yang lebih gelap, krn "cokelat" scr visual tidak pernah muncul di ujung terang/pastel spt keluarga hue lain).
- Tiap keluarga py **10 tingkat** bernomor ala Tailwind (`50, 100, 200, ... 900` — dari paling terang ke paling gelap), dgn lightness (`TIER_LIGHTNESS`) tetap sama utk semua keluarga (biar sejajar), dan saturasi yang sedikit menurun di kedua ujung ramp (`TIER_SAT_MULT`, mendekati 1.0 cuma di tengah) — meniru bagaimana warna cat sungguhan terlihat agak "pudar" di ujung paling terang/gelapnya, bukan makin jenuh terus.
- Total **18 baris × 10 kolom = 180 swatch**. Klik swatch mana pun → HEX-nya disalin ke clipboard **dan** langsung dijadikan warna dasar baru (skema warna di atas ikut ter-render ulang) — dua aksi sekaligus, mengaitkan katalog dgn generator skema dlm satu tool yang sama.

### Salin & toast

Sama persis pola `copyText()`/toast di `tool/color-picker/script.js` (fallback `execCommand('copy')` kalau Clipboard API tidak tersedia) — kode terpisah/diduplikasi, bukan file bersama, konsisten dgn filosofi "tiap tool berdiri sendiri" (lihat `tool/.claude/CLAUDE.md`).

## Fitur yang sudah ada

1. Warna dasar via color picker native + input HEX manual (saling sinkron), plus tombol "Acak" (random RGB).
2. 6 tab skema harmoni warna (lihat tabel di atas), tiap swatch bisa disalin atau dijadikan warna dasar baru.
3. Deskripsi singkat tiap skema (`#schemeDesc`) menjelaskan rumus & kapan skema itu cocok dipakai.
4. Katalog warna 180-swatch (16 keluarga hue + abu-abu + cokelat × 10 tingkat), hover nampilkan kode HEX, klik menyalin + menjadikannya warna dasar.
5. Toggle tema terang/gelap (`generatecolor_theme`, independen dari tool lain — lihat `tool/.claude/CLAUDE.md` bagian "Identitas visual bersama").

## Rencana / TODO ke depan

- Katalog warna belum punya nama spesifik per-swatch (mis. "Merah 500") selain label keluarga+angka tingkat — bisa ditambah kalau dibutuhkan nama yang lebih deskriptif/marketable.
- Belum ada cara menyimpan/mengekspor palet (mis. unduh sbg gambar, salin semua HEX skema sekaligus, format utk Figma/CSS variables, dst).
- Belum ada testing otomatis / build pipeline — project murni HTML/CSS/JS statis.

## Catatan implementasi

- Semua teks UI berbahasa Indonesia.
- **Wajib**: setiap kali ada perubahan struktur/fitur di project ini, update dokumen ini (`tool/.claude/generate-color.md`) di perubahan yang sama.
