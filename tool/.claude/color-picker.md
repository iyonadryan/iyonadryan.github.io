# Color Picker (`tool/color-picker/`)

Unggah gambar atau PDF, lalu (1) sistem otomatis menyimpulkan 9 warna dominan dari gambar itu, dan (2) klik piksel mana pun pada gambar utk melihat warnanya persis (HEX & RGB), keduanya bisa disalin ke clipboard. Semuanya diproses di browser — tidak ada berkas yang diupload ke server manapun.

## Status saat ini

Prototype pertama, dibangun bareng `generate-color/` dan hub `tool/index.html` dlm satu sesi.

## Dependensi eksternal

- **pdf.js** (`pdf.min.js` v3.11.174 + worker, CDN cdnjs — versi & sumber sama persis dgn yang dipakai `tool/pdf-editor/`) — dipakai **hanya** utk merender halaman PDF ke `<canvas>` kalau berkas yang diunggah PDF. Kalau berkasnya gambar biasa, pdf.js tidak disentuh sama sekali (dimuat tapi menganggur).
- Google Fonts (Inter + IBM Plex Mono) — sama dgn tool lain di `tool/`.
- Tidak ada dependency lain, tidak ada build tool, tidak ada Firebase.

## Struktur file

- `index.html`, `style.css`, `script.js` — pola sama dgn `pdf-editor/` (3 file terpisah, tanpa framework).

## Cara kerja

### Alur unggah & render

1. Dropzone (klik atau drag-drop) menerima `image/*` atau PDF (dicek via `file.type` + fallback ekstensi `.pdf`/gambar umum, krn browser kadang tidak mengisi `file.type` dgn benar — pola sama dgn validasi berkas di `pdf-editor`).
2. **Gambar**: dimuat lewat `Image()` + `URL.createObjectURL`, lalu digambar ke canvas kerja.
3. **PDF**: dirender halaman per halaman lewat pdf.js (default halaman 1). Kalau dokumennya lebih dari 1 halaman, muncul navigasi "Halaman X/Y" (‹ ›) — pindah halaman me-render ulang canvas kerja dan menghitung ulang warna dominan (state warna piksel yg sebelumnya dipilih ikut direset, krn itu gambar yg berbeda).
4. Canvas kerja dibatasi maks 900px di sisi terpanjang (`MAX_DIM`) — bukan cuma soal performa, tapi supaya **kanvas yang sama** dipakai baik utk klik-piksel maupun sampling warna dominan (WYSIWYG: apa yang diklik di layar itulah yang dibaca, tidak ada kanvas tersembunyi beresolusi beda yang bisa membuat hasil klik & swatch tidak konsisten).

### 9 warna dominan (`extractDominantColors()`)

Bukan cuma "9 warna terbanyak mentah" — itu bisa menghasilkan 9 warna yang nyaris sama kalau gambarnya didominasi satu gradasi besar (mis. langit). Alurnya:

1. Kuantisasi tiap piksel ke bucket kasar (4-bit per kanal RGB, jadi maks 4096 kombinasi) & hitung frekuensinya, sambil mengakumulasi rata-rata RGB asli di tiap bucket (bukan cuma warna hasil kuantisasi, biar tetap presisi).
2. Kalau jumlah piksel besar, sampling pakai `stride` (lompat piksel) supaya total sampel yg diproses maks ~220 ribu — cukup akurat, tetap responsif tanpa nge-freeze tab.
3. Urutkan bucket dari yang paling sering muncul.
4. Pilih scr **greedy**: ambil bucket paling sering, lalu bucket berikutnya cuma diambil kalau jarak warnanya (Euclidean RGB) cukup jauh (≥28) dari semua yang sudah diambil — mencegah 9 slot terisi warna yang nyaris identik. Kalau proses ini menyisakan kurang dari 9 (gambar yang variasi warnanya sedikit), sisa slot diisi dari bucket paling sering berikutnya tanpa syarat jarak, drpd hasil akhirnya kurang dari 9.

### Inspeksi piksel

Klik di canvas → koordinat klik (`clientX/Y`) dikonversi ke koordinat piksel kanvas asli via rasio `canvas.width/rect.width` (pola sama persis dgn `sigPos()` di `pdf-editor`, supaya tetap akurat walau kanvas discale turun oleh CSS `max-width:100%`) → `getImageData(x,y,1,1)` → tampilkan HEX & RGB, plus marker lingkaran kecil di titik yang diklik (posisi dlm %, jadi tetap pas kalau layar di-resize).

### Salin ke clipboard

`copyText()` — coba `navigator.clipboard.writeText()` dulu; kalau gagal/tidak tersedia (origin tidak aman, browser lama, izin ditolak), fallback ke `textarea` tersembunyi + `document.execCommand('copy')`. Feedback lewat toast kecil di bawah layar (`#toast`, auto-hilang ~1.6 detik), bukan `alert()` blocking — konsisten dgn "copy" yang sering dipakai berulang-ulang, tidak boleh mengganggu alur kerja.

## Fitur yang sudah ada

1. Unggah gambar (PNG/JPG/dst) atau PDF, drag-drop atau klik dropzone.
2. Navigasi halaman utk PDF multi-halaman.
3. Grid 9 warna dominan, tiap swatch tampil HEX + RGB, klik utk salin HEX.
4. Klik piksel di gambar → panel HEX & RGB + tombol salin masing-masing + marker posisi klik.
5. Toast konfirmasi tiap kali menyalin, penanganan error (berkas rusak/gagal dimuat) via `alert()` yang jelas.
6. Toggle tema terang/gelap (`colorpicker_theme`, independen dari tool lain — lihat `tool/.claude/CLAUDE.md` bagian "Identitas visual bersama").

## Rencana / TODO ke depan

- Belum bisa unggah banyak gambar sekaligus utk dibandingkan warnanya — saat ini satu gambar per sesi analisis.
- Jumlah warna dominan (9) masih tetap (hardcode) — bisa dibuat bisa diatur user kalau dibutuhkan.
- Belum ada testing otomatis / build pipeline — project murni HTML/CSS/JS statis.

## Catatan implementasi

- Semua teks UI berbahasa Indonesia.
- **Wajib**: setiap kali ada perubahan struktur/fitur di project ini, update dokumen ini (`tool/.claude/color-picker.md`) di perubahan yang sama.
