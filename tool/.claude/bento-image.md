# Bento Image (`tool/bento-image/`)

Susun beberapa foto jadi satu gambar galeri bertata-letak "bento grid" (kotak-kotak asimetris ala kartu bento) — pilih gaya grid, atur dimensi/jarak antar foto/kelengkungan sudut/warna latar, isi tiap sel dengan foto (geser & zoom per foto), lalu unduh hasil akhirnya sbg satu berkas PNG/JPG. Semuanya diproses di browser, tidak ada berkas yang diunggah ke server manapun.

## Status saat ini

Prototype pertama, tool ke-4 di `tool/` (setelah `pdf-editor/`, `color-picker/`, `generate-color/`).

## Dependensi eksternal

- Google Fonts (Inter + IBM Plex Mono) — sama dgn tool lain di `tool/`.
- Tidak ada library grid/image-editor eksternal — layout bento dihitung manual dari definisi grid (lihat "Template grid" di bawah), render & ekspor gambar pakai Canvas 2D API bawaan browser saja.
- Tidak ada build tool, tidak ada Firebase.

## Struktur file

- `index.html`, `style.css`, `script.js` — pola sama dgn tool lain di `tool/`.

## Cara kerja

### Prinsip utama: kanvas preview = kanvas ekspor (WYSIWYG)

Sama seperti `color-picker/` ("apa yang diklik di layar itulah yang dibaca"): `<canvas id="bentoCanvas">` dipakai LANGSUNG utk preview (di-scale turun via CSS `max-width:100%`) dan utk `canvas.toBlob()` saat "Unduh Gambar" — bukan dua kanvas terpisah (satu preview beresolusi rendah + satu render tersembunyi beresolusi tinggi saat ekspor). `canvas.width`/`canvas.height` (atribut, bukan CSS) selalu sama dgn `state.canvasW`/`state.canvasH` yg dipilih user, jadi preview & hasil unduhan dijamin identik pixel-demi-pixel.

### Template grid (`TEMPLATES` di `script.js`)

9 gaya bento siap pakai (Fokus Kiri/Kanan/Atas, Kuadran, Mozaik, Piramida, Sudut, Kolom Rata, Baris Rata), tiap template didefinisikan sbg partisi grid dasar `cols x rows` — tiap sel py `{colStart, colSpan, rowStart, rowSpan}` (1-indexed, spt garis grid CSS). **Syarat wajib tiap template**: seluruh unit grid dasar harus tercakup persis sekali (tidak ada celah, tidak ada tumpang tindih) — ini diverifikasi manual dgn skrip Node sekali pas dibuat (isi tiap sel grid dasar dihitung, harus semuanya bernilai 1), bukan pengecekan otomatis di app. Kalau nambah template baru, pastikan partisinya lengkap dgn cara yg sama sebelum dipakai.

`computeCellRects()` mengubah definisi template + `state.canvasW/H` + `state.gap` + `state.padding` jadi rect piksel nyata tiap sel (lebar kolom/tinggi baris dihitung dari ruang yg tersisa setelah dikurangi total gap & padding, dibagi rata `cols`/`rows`).

Panel kiri "Gaya Grid" menampilkan mini-preview tiap template via CSS Grid sungguhan (bukan gambar) — dibangun otomatis dari definisi `TEMPLATES` yg sama (`buildTemplatePicker()`), jadi mini-preview selalu sinkron dgn geometri asli, tidak pernah didesain terpisah/manual.

### Render kanvas (`renderCanvas()`)

1. Isi seluruh kanvas dgn `state.gapColor` (warna latar/celah) — ini SEKALIGUS jadi tampilan default sel kosong (lihat di bawah).
2. Tiap sel yg py foto: clip ke rounded-rect (`roundRectPath()`, radius = `state.radius`, clamp otomatis supaya tidak lebih besar dari setengah sisi sel), lalu gambar foto dgn `drawImageCover()` (algoritma `object-fit:cover` manual — scale = `max(rect.w/imgW, rect.h/imgH)`, dikali `zoom` sel itu, lalu digeser sesuai `panX`/`panY` sel).
3. Sel yg TIDAK py foto: sengaja **tidak digambar apa pun** — warna latar dari langkah 1 otomatis "terlihat" di situ. Ini pilihan desain sengaja: placeholder "+" (ikon overlay HTML, lihat di bawah) murni alat bantu edit, TIDAK ikut ke gambar hasil ekspor, spy hasil akhir tetap rapi walau user lupa mengisi satu-dua sel.

### Overlay interaksi (`renderOverlay()`, `.cell-layer` di atas kanvas)

Pola sama dgn `.overlay-layer` di `pdf-editor/` & klik-piksel di `color-picker/`: lapisan `<div>` transparan di atas kanvas berisi satu `.cell-hit` per sel, diposisikan pakai **persentase** (bukan piksel absolut) dari `rect/canvasW` & `rect/canvasH` — beda dari pola konversi rasio `canvas.width/rect.width` yg dipakai `pdf-editor`/`color-picker` utk baca klik piksel, di sini tidak perlu itu krn overlay cuma butuh **kotak-kotak sejajar** dgn sel kanvas (bukan koordinat piksel presisi utk sampling warna), jadi cukup pakai `%` yg otomatis ikut ukuran kanvas ter-render tanpa listener resize sama sekali.

- **Sel kosong**: klik di mana saja pada sel → buka `#cellFileInput` (input file tersembunyi, 1 berkas) → foto yg dipilih otomatis masuk ke pool (lihat di bawah) SEKALIGUS langsung dipasang ke sel itu.
- **Sel terisi**: klik (tanpa geser) → buka file picker lagi utk **mengganti** foto sel itu. Tombol "×" kecil di pojok kanan-atas → hapus foto dari sel itu saja (foto tetap ada di pool foto, cuma dicopot dari sel). Geser (drag) → menggeser posisi foto di dalam sel (pan). Scroll mouse di atas sel → zoom in/out (`handleCellZoom()`, `state.cells[i].zoom`, dibatasi 1×–3×).
- **Klik vs geser**: dibedakan pakai ambang gerak 4px (`THRESH` di `attachCellDrag()`) sblm dianggap "drag", sama pola dgn perbaikan bug drag-vs-klik yg pernah dilakukan di Note App (`app/note/`) — supaya klik tipis yg sedikit bergeser (mis. tangan gemetar/trackpad) tidak salah kepasang jadi geser foto, dan sebaliknya drag sungguhan tidak ikut membuka file picker (ditandai `hit.dataset.dragged` yg dicek di listener `click`).
- Drag/zoom pakai **Pointer Events API** (`pointerdown/move/up/cancel` + `setPointerCapture`) drpd event mouse & touch terpisah spt di `pdf-editor` (yg dibuat lebih dulu, sblm konsisten pakai Pointer Events) — satu jalur kode utk mouse & sentuh sekaligus, tanpa duplikasi.
- Pan (`panX`/`panY`) disimpan sbg **fraksi -1..1** dari jarak geser maksimum yg masih menutupi sel sepenuhnya (bukan piksel absolut) — supaya tetap valid walau kanvas di-resize (ganti dimensi/template/gap) tanpa perlu dihitung ulang manual tiap perubahan.

### Pool foto & penempatan otomatis

- Semua foto yg diunggah (baik lewat dropzone kanan "+ Tambah Foto" MAUPUN klik sel kosong langsung) masuk ke satu array `state.images` (pool) — sel di kanvas cuma menyimpan **referensi id** (`state.cells[i].imageId`), bukan salinan gambar, jadi satu foto scr teknis bisa dipakai ulang di beberapa sel (skenario ini tidak diblokir, hanya belum ada UI khusus utk melakukannya sengaja krn "Isi Otomatis" & drag-dari-pool belum ada — lihat TODO).
- **"Isi Otomatis ke Sel Kosong"** — `autoFillCells()` mengisi sel-sel kosong (urut index) pakai foto pool yg BELUM dipakai di sel manapun, urut sesuai urutan upload.
- **"Acak Susunan Foto"** — hanya mengacak (Fisher-Yates) susunan foto yg SUDAH terpasang di sel-sel terisi (sel kosong tetap kosong) — pan/zoom tiap sel direset ke default krn foto yg nongol di situ sudah beda.
- **Ganti gaya grid**: `switchTemplate()` mengumpulkan urutan `imageId` yg lagi kepasang, mengosongkan seluruh `state.cells`, lalu `autoFillCells()` ulang dgn daftar itu ke template baru — jadi pindah gaya grid TIDAK menghapus foto yg sudah diatur user (cuma urutan/posisi sel yg mengikuti bentuk grid baru; pan/zoom per-sel ikut reset krn sel & bentuknya sudah beda).
- Hapus foto dari pool (tombol "×" di thumbnail pool) → foto itu jg otomatis dicopot dari sel manapun yg memakainya (`state.cells` disisir), plus `URL.revokeObjectURL()` dipanggil supaya blob URL tidak bocor memori.

### Unduh (PNG/JPG)

Tab format (`.format-tab`, mirip `.scheme-tab` di `generate-color`) pilih `image/png` atau `image/jpeg`; JPG munculkan slider kualitas (`qualityRange`, 10–100%) yg diteruskan sbg parameter `quality` ke `canvas.toBlob()` (PNG tidak py parameter ini, selalu lossless). `renderCanvas()` dipanggil ulang tepat sblm `toBlob()` utk memastikan hasil unduhan mengikuti state terbaru walau ada race kecil sblmnya. Nama berkas tetap: `bento-image.png` / `bento-image.jpg`.

## Fitur yang sudah ada

1. 9 gaya grid bento siap pakai + tombol "🔀 Acak Gaya" (pilih gaya lain scr acak).
2. Dimensi: 5 preset rasio (1:1, 4:5, 3:4, 16:9, 9:16) + input lebar/tinggi custom (px, dibatasi 200–4000).
3. Slider jarak antar foto (gap), kelengkungan sudut (radius, 0 = siku 90°), padding luar — semuanya real-time.
4. Warna latar/celah (color picker + input HEX tersinkron, dgn validasi format spt di `generate-color`).
5. Unggah foto lewat dropzone (klik/drag-drop, banyak sekaligus) ATAU langsung klik sel kosong di kanvas (satu per satu).
6. Per-sel: ganti foto (klik), geser posisi (drag/pan), zoom (scroll, 1×–3×), hapus dari sel (tombol ×).
7. Pool foto di panel kanan (thumbnail grid, hapus per-foto), "Isi Otomatis ke Sel Kosong", "Acak Susunan Foto", "Kosongkan Semua Sel".
8. Ganti gaya grid mempertahankan foto yg sudah diatur (urutan dipindah otomatis ke sel-sel gaya baru).
9. Unduh sbg PNG (lossless) atau JPG (kualitas diatur), preview kanvas = hasil unduhan persis (WYSIWYG).
10. Toggle tema terang/gelap (`bentoimage_theme`, independen dari tool lain — lihat `tool/.claude/CLAUDE.md` bagian "Identitas visual bersama"). Tombol aksi utama ("Unduh Gambar", gaya grid aktif) pakai gradient teal mengalir spt `pdf-editor/` (lihat catatan di `tool/.claude/pdf-editor.md`), tombol sekunder/destruktif ikut gradient jg pakai palet warnanya sendiri (netral/peach).

## Rencana / TODO ke depan

- Belum bisa drag foto LANGSUNG dari pool ke sel tertentu (drag-and-drop antar elemen) — saat ini penempatan per-sel selalu lewat klik→file-picker atau "Isi Otomatis" (urutan otomatis), bukan pilih manual dari pool yg sudah ada.
- Belum ada mode "grid custom" (user menentukan sendiri jumlah kolom/baris & span tiap sel) — semua gaya masih dari daftar preset `TEMPLATES` yg tetap.
- Belum ada undo/riwayat perubahan (beda dari `pdf-editor` yg py stack undo) — mengubah pengaturan langsung menimpa state, tidak bisa dibatalkan selain manual mengatur ulang.
- Zoom per-sel cuma lewat scroll mouse (belum ada kontrol UI eksplisit/slider utk perangkat tanpa scroll wheel presisi, mis. touchpad kasar atau HP — perlu dicek/ditambah kalau ada laporan sulit dipakai di mobile).
- Belum ada testing otomatis / build pipeline — project murni HTML/CSS/JS statis.

## Catatan implementasi

- Semua teks UI berbahasa Indonesia, konsisten dgn `app/` & tool lain di `tool/`.
- **Wajib**: setiap kali ada perubahan struktur/fitur di project ini, update dokumen ini (`tool/.claude/bento-image.md`) di perubahan yang sama.
