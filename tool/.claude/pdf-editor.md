# Bengkel PDF (`tool/pdf-editor/`)

Editor PDF yang jalan sepenuhnya di browser (client-side, tidak ada berkas yang pernah diupload ke server manapun) — buka/gabung PDF, atur ulang/putar/hapus/ekstrak halaman, tambah teks & tanda tangan (digambar tangan) sbg overlay lalu "diterapkan" (di-bake) ke PDF asli, isi form AcroForm interaktif, dan unduh hasil akhir.

## Status saat ini

Prototype pertama, mulai dibangun di percakapan lain (di luar riwayat sesi ini) sebagai satu file `index.html` dgn CSS & JS inline, lalu dilanjutkan di sini: dipisah jadi 3 file (`index.html`/`style.css`/`script.js`) + serangkaian perbaikan bug atas laporan user — posisi teks berubah saat diterapkan, alat "+ Teks" yang nge-bug saat dipakai berulang, dan teks kedua yg hilang saat "Terapkan" dipakai lebih dari sekali (lihat "Bug pdf-lib" di bawah, diagnosis-nya butuh riset terpisah pakai pdf-lib di Node krn bug-nya di level library bukan di kode app).

## Dependensi eksternal

- **pdf-lib** (`pdf-lib.min.js` v1.17.1, CDN cdnjs) — baca/tulis/manipulasi struktur PDF (halaman, teks, gambar, form field, rotasi).
- **pdf.js** (`pdf.min.js` v3.11.174 + `pdf.worker.min.js`, CDN cdnjs) — render halaman PDF ke `<canvas>` utk preview di layar (pdf-lib sendiri tidak bisa merender visual, cuma memanipulasi struktur data).
- Google Fonts (Inter + IBM Plex Mono) — tipografi UI.
- Tidak ada build tool, tidak ada dependency lain, **tidak ada Firebase/backend** — semua pemrosesan PDF terjadi di memori browser (`ArrayBuffer`/`Uint8Array`), tidak pernah dikirim ke server manapun. Ini beda mendasar dari semua app di `app/` yang selalu terhubung Firebase Realtime Database.

## Struktur file

- `index.html` — markup halaman (layout 3 kolom: sidebar halaman kiri, stage tengah, panel properti kanan) + modal tanda tangan. Topbar py `.back-link` (← ke `../index.html`, hub Iyon Tool) — sempat kelewatan saat file ini pertama dibuat (beda dari `color-picker`/`generate-color` yang sudah py itu sejak awal), ditambah menyusul.
- `style.css` — semua styling (dipisah dari index.html atas permintaan eksplisit user).
- `script.js` — semua logic (state, render, event handler, operasi pdf-lib/pdf.js). **Bukan IIFE** (variabel top-level ada di scope global, beda dari pola `app/*/script.js` yang selalu dibungkus `(function(){...})()`), tanpa framework/build tool.

## Model & alur data (murni di memori, tidak ada Firebase)

- `workingPdfDoc` — instance `PDFDocument` (pdf-lib), dokumen yang sedang diedit, sumber kebenaran struktur PDF (halaman, rotasi, isi form).
- `pdfjsDoc` — instance dokumen pdf.js, dibangun **ulang** dari `workingPdfDoc.save()` tiap kali ada perubahan (`refreshAll()`), dipakai murni utk render visual (thumbnail & stage) — tidak pernah dimutasi langsung.
- `overlaysByPage` — `{ [pageIndex]: [{id, type, xPct, yPct, wPct?, hPct?, text?, fontSize?, color?, fontFamily?, dataUrl?}] }` — teks/tanda tangan yang **belum** diterapkan ke PDF, hidup cuma di state JS sampai di-"bake" (lihat poin "Terapkan (bake)" di bawah).
- `history` — stack byte snapshot (`workingPdfDoc.save()`), maks 12 entri, dipakai tombol Undo.
- **Tidak ada penyimpanan lintas-sesi** — bahkan tidak ada `localStorage` sekalipun utk hal sepele spt preferensi tema (beda dari semua app di `app/`). Reload halaman = mulai dari kosong lagi. Ini konsisten dgn sifat tool: sesi kerja sekali pakai (buka → olah → unduh → selesai), bukan aplikasi dgn data yang perlu diingat.

### Bug pdf-lib: `workingPdfDoc` WAJIB di-reload dari bytes setelah tiap `bakeOverlays()` — jangan digambar berulang di instance yang sama

**Gejala yang dilaporkan user:** teks pertama diterapkan ("Terapkan teks/ttd ke halaman") dgn benar, tapi teks KEDUA yg ditambahkan setelahnya — walau kelihatan normal di editor sebelum diterapkan — hilang begitu diterapkan lagi (tidak nongol di PDF, tidak ada error apa pun di konsol).

**Cara didiagnosis** (murni via `pdf-lib`+`pdfjs-dist` di Node, di luar browser, spy bisa dites cepat & deterministik tanpa perlu klak-klik manual berulang): dibuat skrip yg mereplikasi persis pola `bakeOverlays()` — `doc.getPages()` → `page.drawText()` → `doc.save()` → (nanti) `doc.getPages()` lagi → `page.drawText()` lagi → `doc.save()` lagi, pada **instance `PDFDocument` yang sama** — lalu hasil akhirnya dibaca ulang pakai `pdfjsLib`'s `getTextContent()` (bukan cuma cek panjang byte atau nyari string mentah di buffer, yg gak reliable krn PDF sering encode teks bukan sbg ASCII polos). Hasilnya: **teks kedua tidak pernah muncul**, konsisten 100% direproduksi.

Lalu diuji beberapa variasi utk mempersempit akar masalahnya (lihat tabel — kolom "cache font" & "save() di antara" dikombinasikan):

| Skenario | Cache font? | `save()` di antara 2 gambar? | Hasil |
|---|---|---|---|
| A (pola asli app) | ya | ya | ❌ cuma teks pertama |
| B | tidak | ya | ❌ cuma teks pertama |
| C | ya | tidak | ✅ dua-duanya muncul |
| D | tidak | tidak | ✅ dua-duanya muncul |

→ **Cache font sama sekali bukan penyebabnya** (B gagal walau tanpa cache) — pemicunya murni **`doc.save()` yang dipanggil di antara dua sesi `drawText()` pada `PDFDocument` yang sama**. Diuji lebih lanjut: menyimpan referensi `page` yang SAMA (tidak fetch ulang `getPages()`) sebelum & sesudah `save()` tetap gagal juga — jadi bukan soal "objek `page`-nya jadi basi", tapi pdf-lib sendiri yang (kemungkinan) tidak lagi mau "membuka lagi" content-stream sebuah halaman utk operasi gambar (`drawText`/`drawImage`) setelah dokumennya pernah di-`save()` — walau referensi `Contents` di halaman itu (`[6 0 R]`) terlihat konsisten sebelum & sesudah.

Diuji juga apakah bug ini berlaku umum utk SEMUA jenis mutasi berulang+save, atau spesifik ke operasi gambar: **rotasi halaman berulang** (`setRotation()`) dan **isi form berulang** (`form.getTextField().setText()`) ke instance yang sama, dgn `save()` di antaranya, **keduanya TETAP tersimpan dgn benar** — jadi bug ini **spesifik ke `drawText()`/`drawImage()`** (operasi yang menulis ke content-stream halaman), bukan bug umum pdf-lib di semua jenis mutasi. Makanya `rotatePage()` dan handler `applyFormBtn` **tidak** perlu ikut diubah — cuma `bakeOverlays()`.

**Fix yang terbukti bekerja** (diverifikasi lewat skrip yang sama, 3× bake berturut-turut, ketiga teks semuanya muncul): setelah `bakeOverlays()` selesai menggambar & memanggil `pushHistory()` (yang di dalamnya ada `.save()`), **jangan lanjut pakai `workingPdfDoc` yang sama** — muat ulang jadi instance BARU dari bytes hasil save itu (`workingPdfDoc = await PDFDocument.load(bytes)`), sekalian reset `embeddedFontCache = {}` (referensi font terikat ke instance dokumen yg lama, ikut jadi tidak valid). Pola ini **sudah dipakai** di `undoBtn` (`workingPdfDoc = await PDFDocument.load(prev)`) dan `rebuildInOrder()` (`PDFDocument.create()` dari awal) — makanya kedua alur itu tidak pernah kena bug ini; `bakeOverlays()` dulu satu-satunya tempat yang MEMPERTAHANKAN instance lama setelah save, sampai diperbaiki.

### Koordinat overlay: `xPct`/`yPct` = pojok kiri-atas, relatif ukuran halaman

Satu konvensi tunggal dipakai konsisten di 2 tempat sekaligus — render layar (CSS `left`/`top` dalam %) dan bake ke PDF (`page.drawText`/`drawImage`) — supaya tidak ada 2 sumber kebenaran posisi yang bisa saling berbeda.

### Kenapa `fontSize` overlay teks disimpan dalam satuan poin PDF, bukan px layar — perbaikan bug utama

**Gejala yang dilaporkan user:** posisi teks berubah begitu ditekan "Terapkan"/diunduh, padahal di layar sudah pas.

**Akar masalahnya:** versi sebelumnya menyimpan `fontSize` sbg px CSS mentah pada saat overlay dibuat, plus `scaleAtCreation` (skala render halaman saat itu) utk dikonversi ke poin PDF saat bake (`pdfFontSize = fontSize / scaleAtCreation`). Skala render halaman bisa berubah — resize window, breakpoint layout sidebar di 980px, pindah ke halaman lain dgn ukuran beda — SETELAH teks dibuat tapi SEBELUM diterapkan. `scaleAtCreation` yang sudah beku itu jadi tidak sinkron lagi dgn skala render yang sedang aktif, sehingga hitungan `x`/`y` saat bake memakai asumsi skala yang sudah basi → teks mendarat di posisi/ukuran yang beda dari yang terakhir terlihat di preview.

**Perbaikan:** `fontSize` sekarang **selalu** dalam satuan poin PDF (satuan kanonik, sama yang dipakai `page.drawText`) sejak overlay pertama dibuat — bukan lagi px layar. Saat render ke layar, `renderOverlayEl()` mengalikannya dgn `currentRenderScale` **saat itu juga** (bukan skala beku) utk mendapat px CSS. Saat bake, poin PDF dipakai apa adanya tanpa konversi apa pun. Tidak ada lagi "snapshot skala" yang bisa basi — preview & hasil bake selalu dihitung dari skala yang sama-sama live, di titik waktu yang sama.

**Perbaikan kedua, di baris kalkulasi yang sama:** posisi baseline teks (`y` di `drawText`) sebelumnya dihitung pakai `pdfFontSize * 0.87` — angka kira-kira, dipakai sama rata utk semua pilihan font. Sekarang pakai `font.heightAtSize(pdfFontSize, {descender:false})` — metrik ascender **asli** dari font pdf-lib yang bersangkutan, beda-beda per font scr akurat (Helvetica vs Times vs Courier, regular vs bold vs italic tidak lagi dipukul rata).

### Overlay gambar (tanda tangan) — sudah benar sejak awal, tidak disentuh

`wPct`/`hPct` (ukuran box, relatif ukuran halaman) dipakai baik di CSS maupun di `drawImage`, tidak ada satuan px absolut yang terlibat sama sekali di jalur ini — makanya tanda tangan tidak pernah kena bug yang sama dgn teks. Disebut di sini sbg referensi pola yang benar.

### Drag vs klik-untuk-edit teks — perbaikan bug interaksi

Sebelumnya, `pointerdown` di kotak overlay langsung mengaktifkan mode "drag" tanpa syarat (kecuali kena tombol hapus/resize) — akibatnya, klik ke **dalam** teks utk sekadar naruh kursor (mau ngetik) nyaris selalu ikut menggeser posisi overlay walau cuma goyangan mouse sekecil apa pun, krn `pointerdown` → `pointermove` dgn delta berapa pun langsung dianggap drag. Sekarang pakai ambang batas gerakan (`DRAG_THRESHOLD = 4px`, di `renderOverlayEl()`) — gerakan pointer di bawah itu dianggap klik biasa (fokus/taruh kursor, dibiarkan native), baru dianggap drag beneran (memanggil `preventDefault()` & mulai geser posisi) kalau lewat ambang itu.

### Tool "+ Teks" auto-balik ke "Pilih" setelah naruh satu teks — perbaikan bug "nambah teks jadi ngebug"

Sebelumnya, alat "+ Teks" tetap aktif terus-menerus setelah satu kotak teks ditaruh. Klik berikutnya — mis. niatnya mau ngedit teks yang baru dibuat tapi kliknya sedikit meleset ke area kosong overlay-layer — malah bikin kotak teks **baru** lagi, bertumpuk tanpa sengaja (ini yang terlihat seperti "bug" tiap kali nambah teks). Sekarang: setelah `addTextOverlay()` naruh satu teks, `setTool('select')` otomatis dipanggil balik ke alat "Pilih", **dan** kotak teks yang baru langsung difokuskan + isi placeholder-nya ("Teks baru") langsung ke-select semua lewat `Range`/`Selection` API — user bisa langsung mengetik menimpanya tanpa perlu klik dulu.

### Overlay & seleksi checkbox ikut halaman saat reorder/hapus — perbaikan bug tersembunyi

`rebuildInOrder()` (dipanggil dari operasi pindah/hapus halaman) sebelumnya me-reset `overlaysByPage` **total** tiap kali dipanggil, walau halaman tempat overlay itu ditaruh sama sekali tidak ikut kena operasi (mis. hapus halaman 5 ikut menghapus overlay teks yang ada di halaman 2). `selectedPages` (state kotak centang pilih-halaman di sidebar) juga tetap menyimpan index lama walau halaman-halaman sudah bergeser, jadi centangnya bisa diam-diam "menempel" ke halaman yang salah setelah reorder. Sekarang kedua state itu di-remap mengikuti index halaman barunya (`orderIndices.forEach((oldIdx, newIdx) => ...)` di `rebuildInOrder()`) — overlay/seleksi cuma benar-benar hilang kalau halamannya sendiri yang dihapus.

### Rotasi halaman menghapus overlay di halaman itu — keputusan sengaja, bukan celah yang belum sempat diperbaiki

`xPct`/`yPct` overlay tidak ikut dirotasi otomatis saat halaman diputar (transformasi koordinat lintas-rotasi belum diimplementasi). Drpd overlay diam-diam mendarat di posisi/orientasi yang salah tanpa user sadar, `rotatePage()` sengaja menghapus overlay yang ada di halaman itu saat diputar. TODO kalau mau ditingkatkan: hitung ulang `xPct`/`yPct` (dan tukar `wPct`/`hPct` utk overlay gambar) sesuai sudut rotasi baru, drpd dihapus.

### Tombol aksi utama (`.btn-brass`, `.stamp-btn`) pakai gradient teal, bukan solid

Tombol CTA utama — "Terapkan ke PDF" (form), "Terapkan teks/ttd ke halaman", "Gunakan Tanda Tangan" (modal), "Unduh PDF" — pakai `background-image: linear-gradient(to right, var(--accent-strong) 0%, var(--accent-mid) 51%, var(--accent-strong) 100%)` + `background-size:200% auto`, digeser ke `background-position: right center` saat hover (transisi `.5s`) utk efek "mengalir". `--accent-mid: #35B3A0` ditambahkan ke `:root` khusus utk gradient ini — nilainya sama persis dgn `--accent` versi `[data-theme="dark"]` di tool lain (lihat `tool/.claude/CLAUDE.md` bagian "Identitas visual bersama"), dipakai ulang di sini sbg titik tengah gradient karena warnanya sudah bagian dari "keluarga" teal tool ini, bukan warna baru yang lepas.

Gradient yang sama juga dipakai di `.tool-btn.active` (toggle alat aktif di toolbar tengah — "Pilih"/"+ Teks"/dst yang lagi terpilih), krn itu jg elemen yang menonjolkan state "aktif/utama" spt tombol CTA. `.tool-btn` non-aktif & `:hover`-nya tetap solid (`var(--border)`), cuma state `.active` yang digradient.

Tombol sekunder (`.btn-ghost` — "Ekstrak halaman terpilih") & destruktif (`.btn-wax` — "Hapus halaman terpilih") jg ikut digradient, tapi pakai palet warnanya sendiri drpd ikut teal, biar makna warnanya (netral vs destruktif) tetap kebaca:
- `.btn-ghost`: `var(--surface-alt) → var(--border-mid) → var(--surface-alt)` (sheen abu-abu netral, teks tetap `var(--text)`). `--border-mid: #EDEDEA` ditambahkan sbg titik tengah — di antara `--border` & `--surface-alt` yang udah ada.
- `.btn-wax`: `var(--danger-light) → var(--danger-mid) → var(--danger-light)` (sheen peach, teks tetap `var(--danger)`). `--danger-mid: #F6DACB` ditambahkan sbg variable formal — sebelumnya nilai ini cuma hex literal di aturan `:hover` lama, sekarang dipakai ulang sbg titik tengah gradient.

## Fitur yang sudah ada

1. **Upload & gabung** — drag-drop atau klik dropzone, multi-file (`multiple`), tiap file PDF valid digabung berurutan ke `workingPdfDoc` yang sama (`copyPages`). Filter tipe PDF diterapkan di kedua jalur (input file & drop) + fallback cek ekstensi `.pdf` (browser kadang tidak mengisi `file.type` dgn benar), dgn pesan `alert()` kalau semua berkas yang dipilih/di-drop ternyata bukan PDF.
2. **Sidebar halaman** (`#thumbs`) — thumbnail tiap halaman (render pdf.js skala 0.28), checkbox pilih, tombol naik/turun (reorder), putar 90°, hapus per-halaman. Tombol global "Ekstrak halaman terpilih" (unduh PDF baru berisi cuma halaman tercentang) & "Hapus halaman terpilih".
3. **Stage (tengah)** (`#stageArea`) — render halaman aktif ke canvas (skala menyesuaikan lebar kontainer, maks 720px), lapisan overlay transparan (`.overlay-layer`) di atasnya utk teks/tanda tangan.
4. **Alat "+ Teks"** — klik di halaman utk naruh kotak teks baru (`contentEditable`, bisa diketik langsung), drag (lewat ambang batas gerakan) utk pindah posisi, klik utk buka panel properti (font/ukuran dalam pt/warna) di kanan (`showTextProps()`).
5. **Alat "✒ Tanda Tangan"** — modal canvas gambar bebas (mouse/touch, `touch-action:none` biar tidak ikut scroll layar), hasil PNG transparan (`clearRect`, bukan fill putih) ditaruh sbg overlay gambar, bisa di-drag & di-resize lewat handle pojok kanan-bawah.
6. **Undo** — stack snapshot byte PDF (maks 12 langkah). Overlay yang belum di-bake ikut ke-reset saat undo — konsisten dgn semantik "kembali ke versi PDF sebelumnya" (overlay bukan bagian dari byte PDF yang di-snapshot).
7. **Terapkan (bake)** — tombol "Terapkan teks/ttd ke halaman" menuliskan semua overlay yang masih pending langsung ke `workingPdfDoc` (jadi konten PDF permanen — tidak bisa diedit lagi lewat overlay setelahnya) via `page.drawText`/`page.drawImage`.
8. **Isi Formulir** (`#formPanel`) — kalau PDF punya AcroForm, panel kanan otomatis menampilkan field-nya (text/checkbox/dropdown/radio/option list) utk diisi & diterapkan (`form.getTextField().setText()`/dst, per-field dibungkus try/catch spy satu field gagal tidak menggagalkan semua).
9. **Unduh** — bake otomatis dulu kalau ada overlay pending, lalu unduh `hasil-edit.pdf`. "Ekstrak halaman terpilih" juga bake dulu (konsistensi dgn Unduh, lihat catatan bug di atas — sebelumnya cuma Unduh yang melakukan ini, jadi ekstrak bisa diam-diam kehilangan teks/ttd yang belum diterapkan) sebelum bikin PDF baru dari halaman tercentang.
10. **Penanganan error** — upload PDF rusak/terenkripsi tak didukung, gagal bake/unduh/ekstrak/isi-form semuanya dibungkus try/catch dgn `alert()` yang jelas ke user (dan `console.error` utk debug), drpd gagal diam-diam atau melempar exception tak tertangani yang membekukan UI.

## Rencana / TODO ke depan

- Rotasi halaman menghapus overlay-nya (lihat penjelasan arsitektur di atas) — bisa ditingkatkan jadi transformasi koordinat otomatis kalau dibutuhkan, drpd dihapus.
- Multi-baris teks (`Enter` di kotak teks `contentEditable`) mengandalkan penanganan `\n` bawaan pdf-lib `drawText()` (line-height default pdf-lib) — belum di-tuning presisi supaya sama persis dgn `line-height:1.1` CSS di pratinjau, cukup dekat tapi belum sempurna.
- Belum ada halaman hub/navigasi ke tool lain — lihat `tool/.claude/CLAUDE.md`.
- Belum ada testing otomatis / build pipeline — project murni HTML/CSS/JS statis, sama seperti app di `app/`.

## Catatan implementasi

- Semua teks UI berbahasa Indonesia.
- **Wajib**: setiap kali ada perubahan struktur/fitur di project ini, update dokumen ini (`tool/.claude/pdf-editor.md`) di perubahan yang sama — berlaku di semua project dalam repo `iyonadryan.github.io`.
