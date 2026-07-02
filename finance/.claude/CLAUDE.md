# Finance App

Aplikasi web untuk memanage keuangan pribadi (pemasukan & pengeluaran), berfokus pada penggunaan **mobile** (dibuka dari HP). Desain dibuat mobile-first, layout disimulasikan seperti layar HP (max-width 480px, centered) agar tetap rapi saat dibuka di desktop.

## Status saat ini

UI/UX sudah jadi dan **data sudah terhubung ke Firebase Realtime Database**. Transaksi & rencana anggaran tersimpan realtime di server (bukan lagi localStorage). Hanya preferensi tema yang masih disimpan lokal (`localStorage`, key `financeapp_theme`).

### Konfigurasi Firebase

- Memakai **project Firebase yang sama** dengan project 24Card (`iyon-adryanlf-trialerror`), tapi path berbeda.
- SDK: **compat v8.10.1** (`firebase-app.js` + `firebase-database.js`), di-load via CDN gstatic. Config + `firebase.initializeApp` ada inline di `<head>` `index.html`, mengekspos global `db` dan konstanta `FINANCE_PATH = "finance"`.
- Path data 24Card: `trial-error/24Card/...`. Path data app ini: **`finance/...`** (top-level, sejajar dengan `trial-error`).
- Rules Firebase (dikelola di console): global `.read: true`, `.write: false`, kecuali node `trial-error/24Card` dan `finance` yang `.write: true`. Artinya **seluruh isi DB bisa dibaca publik** (termasuk data keuangan) — belum ada auth. Catat ini kalau nanti privasi jadi concern.

### Struktur data di Firebase

```
finance/
  <YYYY-MM>/                     # mis. "2026-06"
    <timestamp>/                 # key = Date.now() saat input
      transaksi: "pemasukan" | "pengeluaran"
      category:  "makanan"     # id kategori (lihat CATEGORIES di script.js)
      nominal:   50000         # jumlah uang (Rp) — DITAMBAHKAN, tidak ada di sketsa awal user
      catatan:   "Makan siang"
      tanggal:   "2026-06-01"  # tanggal transaksi (lengkap); harinya tidak lagi disimpan di path, cukup dari sini/timestamp
      timestamp: 1719...       # sama dengan key
  plans/
    <periode>/                   # "harian"|"mingguan"|"bulanan"|"weekday"|"weekend"
      <category>/                # 1 rencana per kategori per periode
        category: "makanan"      # bisa juga "semua" = gabungan semua expense
        limit:    1000000
        sort:     0              # urutan tampil (kecil = atas), diatur via drag
```

Bentuk lama `plans/<category>/{ limit }` (tanpa periode) masih dibaca sebagai rencana **bulanan**, dan otomatis dipindah ke `plans/bulanan/<category>` sekali jalan oleh `migrateLegacyPlans()` pada snapshot pertama.

Catatan: user awalnya menuliskan struktur transaksi hanya `{ category, transaksi, catatan }` tanpa nominal; field `nominal` ditambahkan karena esensial untuk aplikasi keuangan.

### Cara kerja layer data (`script.js`)

- Satu listener realtime `financeRef.on("value", ...)` pada `db.ref("finance")`. Setiap perubahan → `rebuildFromSnapshot()` membangun ulang array `transactions[]` & `plans[]` lalu `renderAll()`. Jadi UI selalu reaktif; fungsi tulis **tidak** perlu memanggil render manual.
- Tiap item `transactions[]` menyimpan `ym`, `id` (= timestamp key) supaya bisa menyusun path hapus (`deleteTransaction`); harinya didapat dari `date`/timestamp, tidak lagi jadi segmen path tersendiri.
- Tipe internal `income`/`expense` dipetakan ke `pemasukan`/`pengeluaran` lewat `TYPE_TO_FS`/`FS_TO_TYPE`.
- Fungsi tulis: `addTransaction`, `updateTransaction` (edit; hanya nominal & catatan, path/timestamp tetap), `deleteTransaction`, `savePlan(period, category, limit)` (menimpa per periode+kategori), `deletePlan(period, category)`, `migrateLegacyPlans` (pindah rencana lama tanpa periode → `plans/bulanan/...`, sekali jalan).
- Menghapus transaksi terakhir di suatu hari/bulan otomatis membersihkan node kosong (perilaku default Firebase RTDB).

## Struktur file

- `index.html` — struktur halaman (single-page, section di-toggle lewat JS, bukan multi-page).
- `style.css` — semua styling, mobile-first, pakai CSS variables untuk theming (light/dark).
- `script.js` — semua logic (state, render, event handler, layer data Firebase). IIFE tunggal, vanilla JS tanpa framework/build tool.
- `generate-excel.js` — helper pembuatan/unduh file Excel `.xlsx` (`window.FinanceExcel`), memakai SheetJS. Generik & tanpa state app: menerima data mentah dari `script.js`. Di-load setelah SheetJS CDN, sebelum `script.js`.
- `.claude/CLAUDE.md` — file ini, dokumentasi project untuk Claude.

Belum ada build tool (tidak ada npm/bundler). Cukup buka `index.html` langsung di browser atau lewat live server.

**Dependensi eksternal (CDN, di `<head>`/akhir `body`):** Firebase compat v8.10.1 (app+database) dan **SheetJS** (`xlsx.full.min.js`) untuk export Excel.

## Fitur yang sudah ada

1. **Dashboard** (`#dashboard`)
   - Selector bulan (prev/next) untuk melihat ringkasan per bulan.
   - Card saldo bulan berjalan: total pemasukan, total pengeluaran, saldo, dan progress bar perbandingan income vs expense.
   - **Sembunyikan saldo**: tombol mata (`#balanceToggle`, kanan atas card, ikon outline SVG inline gaya Flaticon — bukan emoji) meng-toggle tampilan angka saldo/pemasukan/pengeluaran vs teks tersamar `Rp ••••••` (state `balanceVisible`, in-memory saja — **tidak** disimpan, jadi selalu kembali tersembunyi tiap buka app). Dua SVG (`.icon-eye-open`/`.icon-eye-closed`) ditumpuk di dalam tombol, ditukar tampil/sembunyi lewat class `.is-visible` di CSS; `stroke="currentColor"` mengikuti `color: #fff` pada `.balance-toggle` supaya otomatis kontras di kedua tema (balance card selalu bergradasi gelap di light & dark theme). Ikon merepresentasikan *aksi* saat diklik (pola sama seperti `applyTheme`): mata terbuka saat tersembunyi (klik untuk tampilkan), mata tercoret saat tampil (klik untuk sembunyikan).
   - List transaksi terbaru: **maks 3**, diurut paling baru berdasarkan waktu pembuatan (`txTime`, dari timestamp). Tiap item tampil tanggal singkat + jam:menit.
   - **Statistik Pengeluaran** (`#categoryStats`, `renderCategoryStats()`): breakdown pengeluaran per kategori bulan berjalan (expense saja, dari `monthTx` yang sama dengan balance card), diurut nominal terbesar → terkecil. Kalimat insight di atas menyorot kategori terbesar + persentasenya. Tiap baris: dot warna + ikon/label, persen dari total (reuse `.plan-percent`), progress bar (reuse `.plan-progress-track`/`.plan-progress-fill`, warna kategori di-inline), nominal (reuse `.plan-amounts`) dan — kalau kategori itu punya rencana **bulanan** — catatan singkat dibanding limitnya (`"X% dari rencana"` / `"Mendekati batas rencana"` ≥80% / `"Melebihi rencana"` ≥100%). Nominal ikut `balanceVisible` (masking sama seperti balance card); bar & persen selalu tampil karena tidak membocorkan nominal absolut. Warna kategori pakai 8 CSS var `--series-1`..`--series-8` (light & dark, tervalidasi lewat `dataviz` skill) yang **fixed mengikuti index di `CATEGORIES.expense`** (`categoryColorVar()`) — bukan mengikuti ranking bulan itu, supaya warna kategori konsisten antar bulan. Kalau nanti ada kategori custom, urutan definisi kategori (bukan urutan tampil) yang harus dipetakan ke slot warna.
2. **Transaksi** (`#transactions`)
   - Punya selector bulan sendiri (prev/next) — **per-bulan, beda bulan beda data**. List difilter ke bulan yang sedang dipilih.
   - **Filter bertingkat** (lihat bagian "Filter transaksi"): tab tipe Semua / Pemasukan / Pengeluaran, plus tombol 🔍 → modal filter berisi **rentang tanggal** (start & end, dibatasi ke bulan aktif) + kategori multi-select.
   - Tampilan lebih detail (`detailed=true` di `renderTransactionList`): tanggal + tahun & jam:menit:**detik**. Urut per tanggal desc, tie-break waktu pembuatan.
   - Edit & hapus transaksi langsung dari list (lihat bagian "Edit & hapus (transaksi & rencana)").
   - **Popup detail transaksi**: klik kartu transaksi (di Dashboard maupun Transaksi, di luar tombol ✏️/🗑️) → `openTransactionDetail(tx)` membuka `#transactionDetailModal` (pola bottom-sheet) menampilkan kategori, tipe, nominal, **catatan utuh** (di list `.tx-note` terpotong `text-overflow: ellipsis` — popup ini solusinya), tanggal lengkap & jam:menit:detik. Read-only (cuma tombol Tutup); listener klik dipasang per-item di `renderTransactionList`, diabaikan kalau target ada di dalam `.tx-actions` (`e.target.closest(".tx-actions")`) supaya tidak bentrok dengan tombol edit/hapus.
3. **Rencana Anggaran / Plans** (`#plans`)
   - Budget per kategori pengeluaran, ditambah lewat tombol `+` di header (`#addPlanBtn`, pakai `.icon-btn.accent` — bergradient warna seragam dengan tombol + tambah transaksi).
   - **Tab periode** (desain sama seperti filter transaksi, class `.filter-tab` di dalam `#plans`, container `.plan-tabs`): **Harian / Mingguan / Bulanan / Weekday / Weekend** (`data-period`), state `currentPeriod` (default `"bulanan"`). Klik tab → filter list ke periode itu + re-render. Handler di-scope `#plans .filter-tab` (dan handler transaksi di-scope `#transactions .filter-tab`) supaya tidak saling tabrakan. 5 tab membungkus ke 2 baris (`.plan-tabs { flex-wrap }`); **Weekday & Weekend diberi warna khusus** (indigo `#6366f1` / oranye `#f97316`, class `.tab-weekday`/`.tab-weekend`) untuk membedakannya dari periode lain.
   - Tiap kategori bisa punya rencana di beberapa periode sekaligus (mis. Makanan harian + Makanan bulanan), **tapi tidak boleh duplikat kategori dalam satu periode**: dropdown kategori di modal (`populatePlanCategories(period, keepCategory)`) menyembunyikan kategori yang sudah dipakai di periode terpilih. Ganti periode di modal → daftar kategori diperbarui (listener `change` pada `#planPeriodInput`).
   - **Periode penuh** (`periodIsFull` — semua kategori di pool sudah dipakai): (a) tombol `+` (`#addPlanBtn`) di-`disable` & jadi abu-abu (`.icon-btn.accent:disabled`), diatur di `renderPlans`; (b) di dropdown Periode modal, opsi periode yang penuh di-`disable`/buram (`updatePeriodOptions`, dipanggil saat buka modal tambah); (c) kalau periode terpilih ternyata penuh, dropdown kategori menampilkan opsi disabled "Semua kategori sudah dipakai" dan submit di-blok.
   - Ada juga kategori khusus **"Semua"** (`ALL_CATEGORY` = `{ id: "semua", label: "Semua", icon: "💰💵🪙" }`, **hanya muncul di modal Rencana**) yang budget-nya = gabungan **seluruh** pengeluaran di periode itu; ikut aturan anti-duplikat (maksimal satu "Semua" per periode).
   - Progress bar dihitung dari total pengeluaran pada **jendela waktu periode** (`txInPlanPeriod`): Harian = **hari ini**; Mingguan = **minggu berjalan** (Senin–Minggu); Weekday = **Sen–Jum** & Weekend = **Sab–Min** dalam minggu berjalan; semuanya relatif waktu **sekarang** (`new Date()`, bukan `viewDate`) kecuali Bulanan = bulan yang dipilih (`viewDate`). Untuk kategori "Semua", filter kategori dilewati (jumlahkan semua expense). Warna: class `warning` di ≥80%, `over` di ≥100%.
   - **Urutan bisa diubah dengan drag** (lihat bagian "Reorder rencana"): tiap card punya handle ⠿ di paling kiri; geser (mouse/sentuh) untuk menyusun ulang, urutan disimpan ke field `sort` di Firebase.
   - Tiap card punya tombol ✏️ edit & 🗑️ hapus (lihat bagian "Edit & hapus (transaksi & rencana)").
4. **Pengaturan** (`#settings`)
   - Toggle tema light/dark.
   - **Export ke Excel** (tombol `#exportBtn` → popup `#exportModal`): lihat bagian "Export Excel".
   - Info "Tentang". (Tombol "Hapus Semua Data" sudah dihapus sejak data pindah ke Firebase.)
5. **Tambah transaksi** lewat tombol **+ di tengah bottom nav** (`#navAdd`, `.nav-add` — bulat bergradient, menonjol ke atas, **selalu tampil di semua halaman**) → modal bottom-sheet, pilih tipe (income/expense), kategori, jumlah, catatan. **Tanggal otomatis** (field `#dateInput` `disabled`, di-set ke hari ini saat tambah; label "Tanggal (otomatis)"). Jumlah diformat ribuan realtime saat diketik (`formatAmountInput`). Setelah **tambah** transaksi berhasil, app otomatis pindah ke Dashboard (`goToPage("dashboard")`); **edit** tetap di halaman asal.
6. **Navigasi**: bottom navigation bar ala aplikasi mobile — Dashboard, Transaksi, **[+]**, Rencana, Pengaturan (tombol + tambah transaksi ada di slot tengah, di antara Transaksi & Rencana).
7. **Tema light/dark**: pakai atribut `data-theme` di `<html>`, variabel warna di `:root` dan `[data-theme="dark"]` pada `style.css`. Preferensi tersimpan di localStorage, fallback ke `prefers-color-scheme`.

## Model data internal (`script.js`, hasil rebuild dari Firebase)

```js
// transactions[] (item)
{ id, ym: "YYYY-MM", type: "income" | "expense", amount: number, category: string, note: string, date: "YYYY-MM-DD" }

// plans[] (item)
{ id: "<period>_<category>", period: "harian"|"mingguan"|"bulanan"|"weekday"|"weekend", category: string, limit: number, sort: number }
// budget per periode+kategori (kategori expense atau "semua"); id = period + "_" + category; sort = urutan tampil
```

`id` transaksi = timestamp key di Firebase; `ym`/`id` dipakai untuk menyusun path saat hapus. Struktur mentah di Firebase lihat bagian "Struktur data di Firebase" di atas. Kategori didefinisikan statis di `script.js` (`CATEGORIES.income` dan `CATEGORIES.expense`), masing-masing punya `id`, `label`, `icon` (emoji). Ada satu kategori khusus `ALL_CATEGORY` (`id: "semua"`) yang **hanya dipakai di Rencana** (bukan transaksi) sebagai budget gabungan semua expense.

## Rencana / TODO ke depan

- **Auth**: DB masih publik readable (belum ada login). Kalau mau privat, perlu Firebase Auth + ketatkan rules per-user.
- Kemungkinan fitur lanjutan: grafik/statistik lebih detail, kategori custom (bukan hardcoded), export data, notifikasi budget hampir habis.
- Belum ada testing otomatis / build pipeline — project murni HTML/CSS/JS statis.

## Loading overlay

Saat app dibuka, ada overlay `#loadingOverlay` (animasi ikon uang 💰💵🪙 memantul naik-turun, keyframe `coinBounce` di `style.css`) yang menutup layar sampai data pertama dari Firebase tiba. Disembunyikan oleh `hideLoading()` di `script.js` — dipanggil pada snapshot pertama, pada error baca, dan sebagai fallback `setTimeout(hideLoading, 10000)` supaya user tak terjebak kalau offline.

## Filter transaksi

Halaman Transaksi punya filter bertingkat yang bekerja bersama; semuanya dipakai di `renderAllTransactions()` di atas list yang sudah difilter per bulan.

1. **Tab tipe** (`.filter-tab`, `data-filter` = `all`/`income`/`expense`) → state `currentFilter`. Klik tab: set `currentFilter`, tandai tab aktif, **reset `selectedCategories` ke `[]`** (filter kategori dibatalkan tiap ganti tab), lalu re-render. (Rentang tanggal **tidak** direset di sini karena tidak bergantung tipe.)
2. **Modal filter** (tombol 🔍 `#filterBtn` → modal `#filterModal`) berisi dua bagian:
   - **Rentang tanggal** (`#filterStartInput` & `#filterEndInput`, **dropdown kustom** `.day-dd` — bukan `<select>` native, karena tinggi popup select tak bisa dibatasi lintas browser) → **pilihan hari** 1..akhir bulan (tampilan sudah per-bulan). Pilihan disimpan di `dataset.value` pada `.day-dd`; state `filterStartDate`/`filterEndDate` tetap "YYYY-MM-DD". `openFilterModal()` mengisi opsi via `fillDaySelect()` (opsi "—" = tanpa filter) & prefill dari state (`dayOf`). Toggle `.day-dd-toggle` buka/tutup panel `.day-dd-menu` (hanya satu terbuka; tutup saat klik luar); panel dibatasi `max-height` (~5–6 baris) lalu scroll, dan auto-scroll ke hari terpilih saat dibuka. `applyFilter()` membaca `dataset.value` → `dateFromDay` (hari + bulan aktif), menukar start/end bila terbalik. List kategori dibatasi ~3 baris (`max-height`, scroll).
   - **Tiga tombol** di modal: **Batal** (`closeFilterModal`), **Reset** (`resetFilter` — hapus SEMUA filter: tipe→"all" + tab-nya, kategori, rentang tanggal, lalu tutup & re-render), **Terapkan** (`applyFilter`).
   - **Kategori** (`selectedCategories[]`): `openFilterModal()` mengisi `#filterCategoryList` dengan checkbox mengikuti tab aktif (tab `all` → expense+income; income/expense → tipe itu saja); yang terpilih di-`checked`.
   - `applyFilter()` membaca tanggal + checkbox → state, `updateFilterButton()` menandai `#filterBtn` `.active` kalau **ada** kategori terpilih **atau** rentang tanggal terisi, tutup modal, re-render.
   - Di `renderAllTransactions`, urutan filter: `currentFilter` (type) → `selectedCategories` (category) → `filterStartDate` (`t.date >= start`) → `filterEndDate` (`t.date <= end`). Perbandingan string "YYYY-MM-DD" = kronologis.
3. **Ganti bulan** (`changeMonth`) mereset `filterStartDate`/`filterEndDate` (terikat ke bulan tertentu) lalu `updateFilterButton()`; `selectedCategories` tetap (tidak month-specific).

## Edit & hapus (transaksi & rencana)

**Transaksi** — tiap item punya dua tombol di kanan (`.tx-actions`): ✏️ **edit** dan 🗑️ **hapus**.
- **Edit**: `openEditModal(tx)` memakai ulang modal `#transactionModal` (judul jadi "Edit Transaksi" via `#transactionModalTitle`, form di-prefill). State `editingTx` menandai mode; saat submit, kalau `editingTx` terisi → `updateTransaction()` (bukan `addTransaction()`).
  - **Hanya nominal & catatan yang bisa diubah.** Tipe transaksi, kategori, dan tanggal **dikunci**: `setImmutableFieldsLocked(true)` men-`disable` tombol `.type-btn` + `#categoryInput` (dan `#dateInput` memang selalu `disabled`), dengan class `.locked` di `.type-toggle` untuk gaya "tidak bisa diubah". Mode tambah memanggil `setImmutableFieldsLocked(false)` untuk membuka lagi.
  - `updateTransaction(oldTx, data)` menulis ulang node di **path yang sama** (`ym`/`id` dari `oldTx`) — timestamp A tetap A, tidak ada pemindahan node. Tipe/kategori/tanggal diambil dari `oldTx` (bukan form), hanya `nominal` & `catatan` yang dipakai dari input.
- **Hapus**: `openDeleteConfirm(tx)` membuka dialog konfirmasi terpusat `#confirmModal` ("Hapus Transaksi?"). State `pendingDeleteTx`.

**Rencana** — tiap plan card punya ✏️ edit & 🗑️ hapus (`.plan-actions`).
- **Edit**: `openEditPlanModal(plan)` memakai ulang modal `#planModal`, prefill periode + kategori + limit; state `editingPlan`. **Periode & kategori dikunci** saat edit (`setPlanFieldsLocked(true)` men-`disable` `#planPeriodInput` & `#planCategoryInput`) — hanya batas anggaran yang bisa diubah; mengubah periode/kategori = rencana lain. Submit memanggil `savePlan(period, category, limit)` (menimpa per periode+kategori).
- **Hapus**: `openDeletePlanConfirm(plan)` memakai `#confirmModal` yang sama ("Hapus Rencana?"). State `pendingDeletePlan`; tombol "Ya, Hapus" memanggil `deletePlan(period, category)`.

**Confirm modal dipakai bersama**: `#confirmModal` melayani transaksi & rencana. Judul/teks di-set per konteks, dan hanya satu dari `pendingDeleteTx`/`pendingDeletePlan` yang terisi (yang lain di-null-kan). Tombol "Ya, Hapus" (`#confirmDeleteBtn`) memeriksa mana yang terisi lalu memanggil `deleteTransaction()` atau `deletePlan()`.

## Reorder rencana (drag)

Urutan card rencana bisa diatur dengan menggeser handle ⠿ (`.plan-drag`) di paling kiri tiap card. Implementasi drag-nya vanilla, pakai **Pointer Events** (jalan untuk mouse & sentuh, `touch-action: none` di handle supaya tidak ikut men-scroll saat digeser dari HP). Pakai pendekatan **transform** (bukan `insertBefore` saat bergerak) supaya mulus:
- `startPlanDrag` (pointerdown di handle) menyimpan snapshot: daftar card, index awal (`from`), tinggi+gap satu slot (`shift`), dan pusat asli tiap card (`centers`). Card diberi class `.dragging` (terangkat: `z-index`, shadow, `transition: none` supaya mengikuti pointer secara real-time).
- `onPlanDragMove`: card yang di-hold di-`translateY(dy)` mengikuti pointer; slot tujuan (`to`) dihitung dari pusatnya vs `centers`; card lain di-`translateY(±shift)` untuk membuka ruang — bergeser **mulus** karena `.plan-card { transition: transform 0.18s }`.
- `endPlanDrag`: matikan transisi sesaat (`.plans-list.reordering`), bersihkan semua `transform`, susun ulang DOM sesuai `from`→`to` (via `appendChild` berurutan), reflow, lalu hidupkan transisi lagi — supaya rekonsiliasi tidak berkedip. Terakhir panggil `commitPlanOrder()`.
- `commitPlanOrder()` membaca urutan DOM card lalu menulis field `sort` (0,1,2,…) untuk tiap `plans/<period>/<category>/sort` lewat satu `financeRef.update()` multi-path (hanya menulis yang berubah).

## Export Excel

Unduh data ke file `.xlsx` asli, 100% di browser via **SheetJS** (CDN). Pemisahan tanggung jawab karena `script.js` IIFE tertutup: **data mengalir keluar** dari `script.js` ke helper global.
- `generate-excel.js` mendefinisikan `window.FinanceExcel` — `available()` (cek `typeof XLSX`) & `download(fileName, sheetName, rows)` (rows = array of objects → `XLSX.utils.json_to_sheet` → `book_new`/`book_append_sheet` → `writeFile` yang memicu unduhan). Tanpa akses/tahu state app.
- `script.js` (dalam IIFE) memegang UI + penyiapan data: tombol `#exportBtn` buka popup `#exportModal` (bottom-sheet, 2 opsi):
  - **Transaksi per bulan**: klik → buka popup **pilih bulan** (`#monthPickerModal`, `openMonthPicker` menampilkan daftar `ym` yang punya transaksi, terbaru dulu). Pilih bulan → `exportTransactionsForYm(ym)`: `transactions` dengan `t.ym === ym`, urut menaik, kolom `Tanggal/Waktu/Tipe/Kategori/Nominal/Catatan`. `Nominal` **angka** (bukan string "Rp") supaya bisa dihitung di Excel. File `transaksi-<YYYY-MM>.xlsx`.
  - **Ringkasan per bulan** (`exportMonthlySummary`): semua `transactions` dikelompokkan per `ym`, kolom `Bulan/Pemasukan/Pengeluaran/Saldo`, satu baris per bulan (urut kronologis). File `ringkasan-per-bulan.xlsx`.
  - Guard: modul SheetJS gagal dimuat (offline) → alert; data kosong → alert "Tidak ada data untuk diekspor".
- `renderPlans` mengurutkan list per periode dengan `a.sort - b.sort` (tie-break `id`). Rencana baru dapat `sort` paling akhir (`nextSortForPeriod`); saat edit, `sort` lama dipertahankan (submit form mencari plan yang sudah ada by `id`). **Penting**: `savePlan` memakai `.set()` sehingga menulis ulang seluruh node — field `sort` **harus** ikut dikirim tiap simpan supaya urutan tidak ke-reset.

## Catatan implementasi

- Semua teks UI berbahasa Indonesia.
- **`viewDate` dibagi** antara Dashboard, Transaksi, & Rencana. Dashboard dan Transaksi masing-masing punya selector bulan (`#prevMonth`/`#nextMonth` dan `#prevMonthTx`/`#nextMonthTx`) yang semuanya lewat `changeMonth(delta)` → mengubah `viewDate` lalu `renderAll()`. Jadi ganti bulan di satu halaman ikut mengubah halaman lain (satu konsep "bulan aktif" untuk seluruh app).
- Format mata uang: `Rp` + pemisah ribuan gaya Indonesia (`toLocaleString("id-ID")`), lihat `formatCurrency()`.
- Modal tambah/edit transaksi (`#transactionModal`), tambah/edit rencana (`#planModal`), dan filter kategori (`#filterModal`) pakai pola bottom-sheet (`.modal-overlay` + `.modal-sheet`), dibuka/ditutup dengan toggle class `.open`. Dialog konfirmasi hapus (`#confirmModal`, dipakai bersama transaksi & rencana) pakai varian terpusat (`.confirm-overlay` + `.confirm-dialog`). Semua overlay bisa ditutup dengan klik area gelap di luar sheet.
- Saat menambahkan fitur baru, ikuti pola yang sudah ada: render function terpisah per section (`renderDashboard`, `renderAllTransactions`, `renderPlans`), lalu panggil ulang render terkait setiap kali data berubah (create/update/delete).
