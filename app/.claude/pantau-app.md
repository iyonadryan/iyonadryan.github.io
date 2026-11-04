# Pantau App

Aplikasi web untuk **track record angka barang rumah dari waktu ke waktu** — awalnya khusus **sisa token listrik**, tapi sengaja dibuat generik ("item") supaya nanti bisa dipakai utk kebutuhan rumah lain (kuota internet, gas, galon, meteran air PDAM, kilometer kendaraan, dst). User input **item, waktu (tanggal + jam), & nilai**, lalu app menghitung analisis pemakaian per hari, per hari-dalam-seminggu, per waktu (blok jam), & per bulan, plus estimasi sisa sekarang & kapan habis. Mobile-first (max-width 480px, centered), mengikuti pola arsitektur **Patungan App** (app-shell, bottom-nav, modal bottom-sheet, confirm dialog, theme toggle, layer data Firebase).

Nama "Pantau" dipilih (oleh Claude, saat user minta saran nama — alternatif yang ditawarkan: **Meteran App** (`meteran`), **Catat Rumah** (`catatrumah`), **Rekam App** (`rekam`)) karena generik: cocok utk token listrik sekarang & item rumah lain nanti, tidak terikat ke "listrik" saja. **Kalau user memutuskan nama lain**: rename folder `app/pantau/`, ganti `PANTAU_PATH` di `index.html`, judul/brand di `index.html`, card di `app/index.html` + `.app-icon.pantau` di `app/style-app.css`, localStorage keys di `script.js`, & file ini.

### Ikon app

Ikon app (favicon, `.brand-logo` header, kartu hub `app/index.html`, ikon pertama loading overlay) = **📈** — permintaan user supaya lebih umum, tidak terikat ke listrik (awalnya ⚡). Opsi lain yang sempat ditawarkan: 🔍, 📋, 📊. ⚡ tetap dipakai sbg ikon **item** Token Listrik (`PRESET_TOKEN`, `ICONS[0]`) & di welcome card empty state (krn konteksnya "mulai pantau token listrik"). Tab Analisis di bottom nav tetap 📊 (beda dgn ikon app, tidak bentrok).

## Status saat ini

**Prototype v0.1** — langsung terhubung ke **Firebase Realtime Database** sejak awal (pola sama dgn Patungan/Kitchen/Routine). **Tidak ada konsep pengguna aktif Iyon/Ciwul** (permintaan eksplisit user: "mirip seperti app Patungan, gak ada akun pembeda") — siapa pun yang buka app bisa catat/ubah/hapus apa saja.

### Konfigurasi Firebase

- **Project Firebase yang sama** dgn app lain (`iyon-adryanlf-trialerror`), compat SDK **v8.10.1** via CDN gstatic. Config + `firebase.initializeApp` inline di `<head>` `index.html`, expose global `db` & `PANTAU_PATH = "pantau"`.
- Path data: **`pantau/...`** (top-level, sejajar `kitchen`/`finance`/`routine`/`patungan`/`note`/`wishlist`).
- **Rules Firebase wajib ditambah** di console utk node `pantau` (user mengelola rules sendiri):
  ```json
  "pantau": { ".read": true, ".write": true }
  ```
  Kalau rules belum ada, listener `on("value")` kena permission denied → `alert()` "Gagal membaca data dari server…" (loading overlay tetap ditutup).
- **Belum ada auth** — sama seperti app lain.

### Struktur data di Firebase

```
pantau/
  items/
    <itemId>/                     # key = Date.now() saat dibuat
      name:      "Token Listrik"
      icon:      "⚡"              # emoji dari ICONS[] di script.js
      unit:      "kWh"             # teks bebas, boleh kosong
      type:      "sisa" | "meteran"
      createdAt: 1719...
      records/
        <recordId>/               # key = Date.now() saat input
          value:      45.6        # angka terbaca (desimal)
          topup:      0           # HANYA jenis "sisa": jumlah isi ulang yang masuk (0 = tidak isi ulang)
          recordedAt: 1719...     # waktu pembacaan yang dipilih user (tanggal+jam di form), BUKAN waktu input
          note:       "beli token 100rb"   # opsional (tidak ditulis kalau kosong)
          createdAt:  1719...     # waktu input
```

**Nested per item** (pola sama dgn `trips/<id>/expenses` Patungan) → hapus item = satu `remove()` ikut menghapus semua catatannya. **Pindah catatan ke item lain** (ganti dropdown Item saat edit) pakai multi-path `pantauRef.update({ old: null, new: data })` supaya atomik, record id & `createdAt` dipertahankan.

`recordedAt` terpisah dari `createdAt` krn user sering mencatat belakangan ("tadi pagi jam 7 sisa 45,6"). Semua analisis & urutan list pakai `recordedAt`.

### Dua jenis item (`type`)

| Jenis | Contoh | Pemakaian antar 2 catatan berurutan (a → b) |
|---|---|---|
| `sisa` | token listrik, gas, galon | `a.value + b.topup − b.value` (angka turun = terpakai; isi ulang ditambahkan balik) |
| `meteran` | meteran air PDAM, odometer | `b.value − a.value` (angka naik = terpakai) |

Hasil **negatif** (mis. sisa naik tapi kolom isi ulang kosong, atau meteran turun/ganti meteran) → interval ditandai **tidak valid** & dilewati di semua analisis; list catatan menampilkan peringatan ⚠️ oranye di catatan itu. Modal Catat juga menampilkan preview "Terpakai X dlm Y jam (≈ Z/hari)" **sebelum disimpan** — sekaligus rem typo; kalau negatif, preview berubah jadi warning yang mengarahkan ke kolom "Isi ulang".

## Cara kerja analisis (`analyze(item)` di `script.js`)

1. `buildIntervals(item)` — pasangan catatan berurutan (urut `recordedAt`) → `{ from, to, dt, usage, valid }`.
2. `allocateDaily(validIntervals)` — pemakaian tiap interval **dibagi rata secara proporsional waktu** ke hari kalender yang dilewati (catatan Sen 20:00 → Rab 08:00 dibagi ke Sen 4 jam, Sel 24 jam, Rab 8 jam). Tiap hari menyimpan `usage` & `covered` (ms yg tercakup data). Ini kunci supaya catatan dgn jarak tidak teratur tetap bisa dianalisis per hari.
3. Dari alokasi harian:
   - **Rata-rata / hari**: total usage ÷ total waktu valid (seluruh data), dan versi **7 hari terakhir** (dipakai kalau cakupannya ≥ 1 hari penuh — lebih mencerminkan kebiasaan terkini).
   - **Laju estimasi** = rata-rata 7 hari terakhir, fallback ke seluruh data.
   - **Estimasi sekarang**: `sisa` → `last.value − laju × hari sejak catatan terakhir` (min 0), **perkiraan habis** = estimasi ÷ laju (≤ 3 hari → warning). `meteran` → `last.value + laju × hari`.
   - **Per hari dalam seminggu**: Σusage ÷ Σcovered per weekday (tampil mulai Senin). Butuh ≥ 6 jam data di weekday itu, kalau kurang bar tampil kosong (dashed).
   - **Rekap bulanan**: total usage per bulan kalender + "≈ N hari data" + rata-rata/hari (bulan yang datanya tidak penuh tetap jujur kelihatan cakupannya).
4. `allocateBlocks()` — sama spt harian tapi ke 4 blok 6-jam (Dini hari 00–06, Pagi 06–12, Siang 12–18, Malam 18–24), satuan per jam. **Hanya ditampilkan kalau ada ≥ 3 interval valid berjarak ≤ 12 jam** — kalau user cuma catat 1×/hari, alokasi rata bikin semua blok sama (menyesatkan), jadi diganti hint "catat beberapa kali sehari (pagi & malam)".

## Struktur file

- `index.html` — single page, section di-toggle `goToPage()`.
- `css/base.css` — variabel tema (primary **biru sky/"listrik"** `#0284c7` light / `#38bdf8` dark — belum dipakai app lain), `--chart-*` (bar chart 1 hue), `--color-warning*`, reset, loading overlay (`.loading-icons` 📈⚡💧), shell, header, page, section heading, **`.chip-row`/`.chip`** (pemilih item di Analisis & filter Riwayat; `.chip-row[hidden]` wajib krn `display:flex`).
- `css/components.css` — salinan generik dari Patungan (tombol, `.btn-hub`, bottom nav, modal, `.field`, confirm dialog).
- `css/forms.css` — `.icon-picker` (grid emoji radio), `.type-options` (pilih jenis Sisa/Meteran, pakai `:has(input:checked)`) — radio-nya **wajib di-reset** (`.field .type-option input`: width 18px, padding/border/background 0, outline cuma saat `:focus-visible`) krn aturan generik `.field input` di components.css bikin radio melebar 100% & outline focus jadi oval, `.field-hint`, `.record-preview` (+ `.warn`), `.now-btn` ("Sekarang" di label Jam).
- `css/dashboard.css` — `.item-card` (kartu gradient per item di Beranda), `.welcome-card` (empty state), `.link-btn`.
- `css/analysis.css` — `.analysis-head`, `.stat-grid`/`.stat-tile`, `.chart-card` + **bar chart div-based** (`.bar-chart`/`.bar-col`/`.bar-track`/`.bar`/`.bar-ref`/`.bar-value`/`.bar-label`/`.chart-readout`), `.month-row`, `.record-list`/`.record-item` (dipakai juga di Riwayat), `.badge-topup`.
- `css/history.css` — `.history-group-label` (grup per tanggal).
- `css/settings.css` — salinan Patungan.
- `script.js` — satu IIFE vanilla JS: state, Firebase layer, format helpers, engine analisis, render per halaman, modal.

**Dependensi eksternal:** hanya Firebase compat v8.10.1 (app+database).

## Fitur

1. **Beranda** (`#home`) — satu `.item-card` gradient per item: ikon, nama, jumlah catatan, tombol **+ Catat** (buka modal Catat dgn item itu terpilih), estimasi sisa/angka sekarang (besar), "Habis ± N hari lagi · tanggal" (`sisa`) atau "Bulan ini X" (`meteran`), 2 mini stat (terakhir dicatat + x lalu, rata-rata/hari). Kalau < 2 catatan → hint cara mulai. Klik kartu → Analisis item itu. Link "+ Item Baru". **Empty state** (belum ada item): tombol **"⚡ Buat item Token Listrik"** (preset `PRESET_TOKEN`: ⚡, kWh, sisa — satu tap langsung jadi) + "atau buat item lain".
2. **Analisis** (`#analysis`) — chip pemilih item (disembunyikan kalau cuma 1 item), header item + ✏️ ubah / 🗑️ hapus (confirm, cascade catatan). Stat grid 4 tile (Terakhir dicatat, Est. sekarang, Rata-rata/hari, Perkiraan habis / Total tercatat). Chart: **Pemakaian per Hari** (14 hari terakhir, hari ini "Ini" di-highlight), **Per Hari dalam Seminggu** (ringkasan "paling boros/hemat"), **Per Waktu** (blok 6 jam, lihat syarat di atas), **Rekap Bulanan** (+ total isi ulang utk `sisa`). **Catatan Terbaru** (8 terakhir, tiap item: waktu, pemakaian sejak catatan sebelumnya & laju/hari, catatan, badge isi ulang) + tombol "Lihat semua N catatan" → Riwayat terfilter ke item itu.
3. **Interaksi chart** — tiap kolom bar adalah `<button>` (hit target selebar kolom); tap/hover mengisi `.chart-readout` di bawah chart (tanggal + nilai + cakupan data kalau sebagian). Mouse keluar chart → readout kembali ke ringkasan default. Garis putus-putus = rata-rata (dijelaskan di subtitle; **tidak** ada label di dalam plot krn bentrok dgn bar paling kanan). Label angka hanya di bar tertinggi (selective direct label).
4. **Riwayat** (`#history`) — semua catatan lintas item, urut terbaru, dikelompokkan per tanggal (Hari ini / Kemarin / tanggal). Chip filter Semua + per item (disembunyikan kalau cuma 1 item). Klik catatan → modal ubah.
5. **Modal Catat / Ubah Catatan** (`#recordModal`) — Item (select), Tanggal + Jam (default sekarang, tombol "Sekarang"), nilai (label menyesuaikan jenis + satuan; `inputmode="decimal"`), **Isi ulang** (hanya `sisa`), preview pemakaian, Catatan opsional. Validasi: waktu tidak boleh > 5 menit ke depan, nilai ≥ 0, isi ulang ≥ 0. Mode ubah menampilkan tombol Hapus.
6. **Modal Item** (`#itemModal`) — nama, ikon (12 emoji di `ICONS[]`, grid 6 kolom: ⚡ 📶 kuota 📱 pulsa 💧 🔥 🚰 🛢️ 📦 🚗 🏍️ 🍚 🧴 — jumlahnya sengaja kelipatan 6 supaya baris penuh; kalau nambah ikon, sesuaikan `repeat(6, 1fr)` di `.icon-picker`), satuan, jenis (Sisa/Meteran dgn penjelasan contoh). Ubah item pakai `.update()` (records tidak tertimpa).
7. **Pengaturan** — toggle tema, Semua Aplikasi (`.btn-hub` → `../index.html`), **Cara Hitung** (penjelasan singkat alokasi & isi ulang), Tentang.
8. **Auto-refresh** `setInterval(renderAll, 60000)` — estimasi "sekarang" & "x lalu" bergantung jam.

### Parsing angka (`parseNum`)

Koma = desimal (`45,6`, `1.234,5`). Kalau tanpa koma: satu titik yang **bukan** diikuti tepat 3 digit = desimal (`45.67` → 45,67, spt tampilan meteran token), selain itu titik = pemisah ribuan (`12.345` → 12345). Tampilan pakai `toLocaleString("id-ID")` (maks 2 desimal, 1 desimal kalau ≥ 100).

## localStorage

- `pantauapp_theme` — tema.
- `pantauapp_last_item` — item terakhir dipilih (Analisis & default modal Catat). Akses dibungkus `storeGet`/`storeSet` try/catch.

## Rencana / TODO ke depan

- **Harga isi ulang** (Rp per beli token) → analisis Rp/bulan & Rp/kWh. Sementara bisa ditulis di kolom Catatan.
- Grafik garis nilai sisa dari waktu ke waktu.
- Pengingat/notifikasi kalau perkiraan habis ≤ N hari (butuh PWA/push).
- Export CSV/Excel catatan.
- Auth / proteksi akses (sama spt app lain).
- Belum ada fallback `setTimeout` loading overlay kalau Firebase tidak pernah merespons.

## Catatan implementasi

- Semua teks UI berbahasa Indonesia.
- Render per halaman (`renderHome`, `renderAnalysis`, `renderHistory`) dipanggil dari `renderAll()` tiap snapshot Firebase — jangan render manual setelah operasi tulis.
- `withUnit()` mengembalikan **HTML** (satuan di-escape) — pakai di `innerHTML`, bukan `textContent`.
- **Wajib**: setiap perubahan struktur/fitur di app ini, update dokumen ini (`app/.claude/pantau-app.md`) di perubahan yang sama.
