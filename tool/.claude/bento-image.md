# Bento Image (`tool/bento-image/`)

Susun beberapa foto jadi satu gambar galeri bertata-letak "bento grid" (kotak-kotak asimetris ala kartu bento) — pilih gaya grid, atur dimensi/jarak antar foto/kelengkungan sudut/warna latar, isi tiap sel dengan foto (geser & zoom per foto), lalu unduh hasil akhirnya sbg satu berkas PNG/JPG. Semuanya diproses di browser, tidak ada berkas yang diunggah ke server manapun.

## Status saat ini

Prototype pertama, tool ke-4 di `tool/` (setelah `pdf-editor/`, `color-picker/`, `generate-color/`). Sistem grid-nya sempat dirombak sekali dari daftar 9 template tetap (bentuk sel sudah dipatok per gaya) jadi arsitektur **Grid Style (algoritma) + Grid Layout (kolom/baris bebas diatur)** yg terpisah — lihat "Grid Style & Grid Layout" di bawah utk detail & alasannya.

## Dependensi eksternal

- Google Fonts (Inter + IBM Plex Mono) — sama dgn tool lain di `tool/`.
- Tidak ada library grid/image-editor eksternal — partisi grid dihitung manual lewat algoritma sendiri (lihat "Grid Style & Grid Layout" di bawah), render & ekspor gambar pakai Canvas 2D API bawaan browser saja.
- Tidak ada build tool, tidak ada Firebase.

## Struktur file

- `index.html`, `style.css`, `script.js` — pola sama dgn tool lain di `tool/`.

## Cara kerja

### Prinsip utama: kanvas preview = kanvas ekspor (WYSIWYG)

Sama seperti `color-picker/` ("apa yang diklik di layar itulah yang dibaca"): `<canvas id="bentoCanvas">` dipakai LANGSUNG utk preview (di-scale turun via CSS `max-width:100%`) dan utk `canvas.toBlob()` saat "Unduh Gambar" — bukan dua kanvas terpisah (satu preview beresolusi rendah + satu render tersembunyi beresolusi tinggi saat ekspor). `canvas.width`/`canvas.height` (atribut, bukan CSS) selalu sama dgn `state.canvasW`/`state.canvasH` yg dipilih user, jadi preview & hasil unduhan dijamin identik pixel-demi-pixel.

### Grid Style & Grid Layout (`script.js`) — arsitektur ke-2, menggantikan daftar template tetap

Versi pertama tool ini punya `TEMPLATES`: 9 bentuk bento siap-pakai, tiap bentuk dipatok ke ukuran grid dasarnya sendiri (mis. "Mozaik" selalu 4x3, "Kuadran" selalu 2x2). User minta dibuatkan ulang mengikuti pola desain **Bento Grid Generator** (bento.samolevsky.com) yg memisahkan dua konsep independen di panel kiri:

- **Grid Layout** — jumlah kolom & baris grid dasar (`state.layoutCols`/`state.layoutRows`, slider + input angka, dibatasi 2–8 tiap sisi — situs referensi mengizinkan sampai 24, tapi di sini sengaja dibatasi lebih kecil krn tiap sel WAJIB muat foto yg kebaca, bukan sekadar bentuk abstrak; grid 24x24 bakal bikin sel-sel terlalu kecil utk galeri foto). Tombol 🔗 mengunci Kolom = Baris (ganti salah satu ikut mengganti yg lain), tombol "🔀 Acak Tata Letak" pilih kolom/baris acak dlm batas itu.
- **Grid Style** — algoritma yg mempartisi grid dasar itu jadi sel-sel bento, dipilih dari daftar `STYLES` (bukan bentuk jadi yg dipatok ukurannya). Tombol "🔀 Acak Pola" membangkitkan ulang partisi dgn gaya & ukuran grid yg SAMA (kalau gayanya berbasis acak — lihat di bawah).

**Catatan sumber ide**: struktur "Grid Style terpisah dari Grid Layout" diamati dari UI publik bento.samolevsky.com (HTML halamannya diambil & didekode base64 secara manual utk melihat struktur DOM-nya — situs itu memuat markup lewat `atob()`, bukan HTML polos — sekadar utk memahami PANDUAN STRUKTUR: ada slider Columns/Rows terpisah dari daftar/segmented-control gaya `bento/regular/pattern/mondrian/tiling/recursive/pavement/squares/distribution/rectangles`). **Tidak ada kode maupun aset dari situs itu yang disalin** — seluruh algoritma partisi di bawah ini ditulis ulang dari nol khusus utk tool ini, & jumlah/nama gayanya sengaja lebih sedikit (4, bukan 10) drpd meniru persis, disesuaikan kebutuhan galeri foto drpd generator bentuk abstrak.

#### Algoritma tiap gaya (`STYLES` di `script.js`)

Tiap `generate(cols, rows)` WAJIB mengembalikan partisi LENGKAP grid `cols x rows` (tiap unit tercakup persis sekali) — diverifikasi dgn skrip Node terpisah (bukan pengecekan otomatis runtime di app) yg mengekstrak `STYLES` langsung dari `script.js` & menjalankan ratusan percobaan acak per ukuran grid (2×2 sampai 8×8, 20 percobaan/ukuran utk gaya berbasis acak) — 0 kegagalan sblm dianggap selesai. Kalau nambah gaya baru, verifikasi dgn cara yg sama sblm dipakai.

1. **Reguler** (`generateReguler`) — grid seragam, tiap sel 1x1, tidak ada elemen acak sama sekali.
2. **Bento** (`generateSplitStyle` + parameter `stopBase:0.35, stopGrowth:0.15, stopMax:0.85, longSplitBias:0.75`) — partisi **guillotine rekursif** (`splitRegion()`): potong satu region jadi dua terus-menerus (garis potong selalu tembus sisi-ke-sisi), makin dalam rekursi makin besar peluang berhenti (jadi satu blok), `longSplitBias` condong memotong sisi yg lebih panjang dulu (mencegah blok kurus memanjang). Rata-rata hasil ~3–5 blok per grid (diukur dari 20 percobaan tiap ukuran) — campuran blok besar & kecil yg jadi ciri khas "bento".
3. **Mondrian** (`generateSplitStyle` + `stopBase:0.5, stopGrowth:0.2, stopMax:0.9, longSplitBias:0.5`) — algoritma SAMA dgn Bento, cuma parameternya beda: lbh cepat berhenti (rata-rata ~2.7–3 blok, LEBIH SEDIKIT drpd Bento) & tanpa bias sisi panjang (`longSplitBias:0.5` = potongan acak arahnya, bukan condong), meniru kesan blok besar & tak beraturan ala lukisan Piet Mondrian drpd bentuk yg "rapi".
4. **Pola** (`generatePola`) — motif ubin 2x2 berulang (deterministik, bukan acak): tiap blok 2x2 dari grid dasar jadi satu sel, sisa baris/kolom ganjil di tepi otomatis jadi strip 1-lebar/1-tinggi.

`state.pattern` menyimpan partisi AKTIF (hasil `regeneratePattern()` = `getActiveStyle().generate(state.layoutCols, state.layoutRows)`), dipanggil ulang tiap kali gaya/kolom/baris berubah. `computeCellRects()` mengubah `state.pattern` + `state.canvasW/H` + `state.gap` + `state.padding` jadi rect piksel nyata tiap sel (lebar kolom/tinggi baris dihitung dari ruang yg tersisa setelah dikurangi total gap & padding, dibagi rata `layoutCols`/`layoutRows`) — fungsi ini sendiri TIDAK berubah dari versi pertama, cuma sumber datanya (`state.pattern` gantikan `template.cells`).

Panel kiri "Grid Style" menampilkan mini-preview tiap gaya via CSS Grid sungguhan (bukan gambar statis) — dibangun dari HASIL NYATA `generate(4, 3)` gaya itu (`buildStylePicker()`, ukuran contoh tetap 4x3 apa pun `layoutCols/Rows` yg aktif), supaya preview selalu jujur mewakili algoritmanya, bukan ikon terpisah yg bisa meleset dari kode asli.

#### Regenerasi & mempertahankan foto yg sudah dipasang

Tiga aksi berbeda yg semuanya memanggil ulang `regeneratePattern()` lalu **memindahkan foto yg sudah dipasang** ke sel-sel hasil baru (lewat `collectAssignedImageIds()` + `autoFillCells()`, sama polanya dgn `switchTemplate()` versi lama):
- **Ganti Grid Style** (`switchStyle()`) — gaya berubah, kolom/baris TETAP.
- **Ganti Grid Layout** (`setLayout()`, dipicu slider/input kolom & baris, atau "🔀 Acak Tata Letak") — kolom/baris berubah, gaya TETAP.
- **"🔀 Acak Pola"** (`regeneratePatternBtn`) — kolom/baris & gaya TETAP, cuma minta variasi acak baru dari gaya yg sama. Kalau gaya aktif deterministik (Reguler/Pola), tombol ini scr visual tidak mengubah apa pun (bukan bug — memang tidak ada elemen acak utk digenerate ulang) & muncul toast penjelasan singkat.

Tombol "🎲 Surprise" (`surpriseBtn`, di atas kanvas) beda dari ketiganya — mengacak GAYA **dan** kolom/baris sekaligus dlm satu klik, utk eksplorasi cepat.

pan/zoom tiap sel (`panX/panY/zoom`) selalu direset ke default tiap kali sebuah SEL BARU menerima sebuah foto (baik lewat regenerasi di atas maupun assign manual) — masuk akal krn sel & bentuknya sudah beda, posisi pan lama tidak relevan lagi.

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
- **Ganti Grid Style/Layout/regenerasi pola**: lihat "Regenerasi & mempertahankan foto yg sudah dipasang" di atas — pindah gaya/kolom/baris/regenerasi pola TIDAK menghapus foto yg sudah diatur user, cuma dipindah ke susunan sel baru.
- Hapus foto dari pool (tombol "×" di thumbnail pool) → foto itu jg otomatis dicopot dari sel manapun yg memakainya (`state.cells` disisir), plus `URL.revokeObjectURL()` dipanggil supaya blob URL tidak bocor memori.

### Unduh (PNG/JPG)

Tab format (`.format-tab`, mirip `.scheme-tab` di `generate-color`) pilih `image/png` atau `image/jpeg`; JPG munculkan slider kualitas (`qualityRange`, 10–100%) yg diteruskan sbg parameter `quality` ke `canvas.toBlob()` (PNG tidak py parameter ini, selalu lossless). `renderCanvas()` dipanggil ulang tepat sblm `toBlob()` utk memastikan hasil unduhan mengikuti state terbaru walau ada race kecil sblmnya. Nama berkas tetap: `bento-image.png` / `bento-image.jpg`.

## Fitur yang sudah ada

1. **Grid Style**: 4 algoritma pola (Reguler, Bento, Mondrian, Pola) + tombol "🔀 Acak Pola" (variasi baru dari gaya yg sama).
2. **Grid Layout**: kolom & baris bebas diatur (slider + input angka, 2–8), tombol 🔗 kunci Kolom=Baris, tombol "🔀 Acak Tata Letak", tombol "🎲 Surprise" (acak gaya + tata letak sekaligus).
3. Dimensi: 5 preset rasio (1:1, 4:5, 3:4, 16:9, 9:16) + input lebar/tinggi custom (px, dibatasi 200–4000) — beda konsep dari Grid Layout (ini ukuran kanvas ekspor dlm piksel, bukan jumlah kolom/baris grid).
4. Slider jarak antar foto (gap), kelengkungan sudut (radius, 0 = siku 90°), padding luar — semuanya real-time.
5. Warna latar/celah (color picker + input HEX tersinkron, dgn validasi format spt di `generate-color`).
6. Unggah foto lewat dropzone (klik/drag-drop, banyak sekaligus) ATAU langsung klik sel kosong di kanvas (satu per satu).
7. Per-sel: ganti foto (klik), geser posisi (drag/pan), zoom (scroll, 1×–3×), hapus dari sel (tombol ×).
8. Pool foto di panel kanan (thumbnail grid, hapus per-foto), "Isi Otomatis ke Sel Kosong", "Acak Susunan Foto", "Kosongkan Semua Sel".
9. Ganti Grid Style/Layout/regenerasi pola mempertahankan foto yg sudah diatur (dipindah otomatis ke susunan sel baru).
10. Unduh sbg PNG (lossless) atau JPG (kualitas diatur), preview kanvas = hasil unduhan persis (WYSIWYG).
11. Toggle tema terang/gelap (`bentoimage_theme`, independen dari tool lain — lihat `tool/.claude/CLAUDE.md` bagian "Identitas visual bersama"). Tombol aksi utama ("Unduh Gambar", gaya grid aktif) pakai gradient teal mengalir spt `pdf-editor/` (lihat catatan di `tool/.claude/pdf-editor.md`), tombol sekunder/destruktif ikut gradient jg pakai palet warnanya sendiri (netral/peach).

## Rencana / TODO ke depan

- Belum bisa drag foto LANGSUNG dari pool ke sel tertentu (drag-and-drop antar elemen) — saat ini penempatan per-sel selalu lewat klik→file-picker atau "Isi Otomatis" (urutan otomatis), bukan pilih manual dari pool yg sudah ada.
- Cuma 4 Grid Style (Reguler/Bento/Mondrian/Pola) — situs referensi (bento.samolevsky.com) py ~10 (termasuk tiling/recursive/pavement/squares/distribution/rectangles yg belum diimplementasi di sini). Bisa ditambah kalau diminta, tinggal tambah entri baru ke `STYLES` dgn fungsi `generate(cols,rows)` sendiri + diverifikasi partisinya lengkap (lihat "Algoritma tiap gaya").
- Kolom/baris dibatasi 2–8 (keputusan sengaja, lihat "Grid Style & Grid Layout") — belum ada opsi utk user yg mau grid lbh besar/kecil dari itu.
- Belum ada undo/riwayat perubahan (beda dari `pdf-editor` yg py stack undo) — mengubah pengaturan langsung menimpa state, tidak bisa dibatalkan selain manual mengatur ulang.
- Zoom per-sel cuma lewat scroll mouse (belum ada kontrol UI eksplisit/slider utk perangkat tanpa scroll wheel presisi, mis. touchpad kasar atau HP — perlu dicek/ditambah kalau ada laporan sulit dipakai di mobile).
- Belum ada testing otomatis / build pipeline — project murni HTML/CSS/JS statis (validasi partisi grid saat ini cuma dijalankan manual sekali via skrip Node terpisah tiap ada perubahan algoritma, bukan bagian dari app/CI).

## Catatan implementasi

- Semua teks UI berbahasa Indonesia, konsisten dgn `app/` & tool lain di `tool/`.
- **Wajib**: setiap kali ada perubahan struktur/fitur di project ini, update dokumen ini (`tool/.claude/bento-image.md`) di perubahan yang sama.
