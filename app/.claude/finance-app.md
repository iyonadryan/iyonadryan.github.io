# Finance App

Aplikasi web untuk memanage keuangan pribadi (pemasukan & pengeluaran), berfokus pada penggunaan **mobile** (dibuka dari HP). Desain dibuat mobile-first, layout disimulasikan seperti layar HP (max-width 480px, centered) agar tetap rapi saat dibuka di desktop.

## Status saat ini

UI/UX sudah jadi dan **data sudah terhubung ke Firebase Realtime Database**. Transaksi & rencana anggaran tersimpan realtime di server (bukan lagi localStorage). Preferensi tema & pilihan pengguna aktif (Iyon/Ciwul/Both) masih disimpan lokal (`localStorage`, key `financeapp_theme` & `financeapp_user` — lihat `STORAGE_KEYS` di `script.js`, bagian "Multi-user" di bawah).

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
      by:        "ciwul"       # "iyon" | "ciwul" — pembuat transaksi, lihat bagian "Multi-user"; DITAMBAHKAN, backfill via migrateTransactionOwners()
  plans/
    <periode>/                   # "harian"|"mingguan"|"bulanan"|"weekday"|"weekend"
      <category>/                # 1 rencana per kategori per periode — GLOBAL, bukan per-user (lihat "Multi-user")
        category: "makanan"      # bisa juga "semua" = gabungan semua expense
        limit:    1000000
        sort:     0              # urutan tampil (kecil = atas), diatur via drag
        by:       "ciwul"        # "iyon" | "ciwul" — cuma penanda pembuat utk visibility/badge, BUKAN path/kunci keunikan; DITAMBAHKAN, backfill via migrateLegacyPlanOwners()
  categories/
    expense/
      <id>/                       # mis. "makanan" — key = id, ditulis redundan juga sbg field
        id:        "makanan"
        label:     "Makanan"
        icon:      "🍔"           # emoji, disimpan apa adanya sbg string (JSON biasa, tidak perlu encoding khusus)
        colorSlot: 1              # 1-10, dipetakan ke var(--series-1..10) di css/base.css; dipakai categoryColorVar() utk Statistik Pengeluaran & swatch di popup Kategori
    income/
      <id>/                       # sama seperti expense
        id: "gaji"
        label: "Gaji"
        icon: "💼"
        colorSlot: 1              # sama 1-10; default seed reuse slot 1-4 expense; selain swatch popup Kategori belum ada fitur yang membacanya
```

Bentuk lama `plans/<category>/{ limit }` (tanpa periode) masih dibaca sebagai rencana **bulanan**, dan otomatis dipindah ke `plans/bulanan/<category>` sekali jalan oleh `migrateLegacyPlans()` pada snapshot pertama.

Kategori dulu hardcoded di `script.js`, sekarang datanya di Firebase (`categories/expense|income`). Kalau node `categories` belum ada sama sekali (mis. database baru), `migrateLegacyCategories()` men-seed sekali jalan dari `DEFAULT_CATEGORIES` (persis data hardcoded lama, termasuk `colorSlot`) pada snapshot pertama — pola sama seperti `migrateLegacyPlans`. Kategori income yang sudah lebih dulu ada di Firebase sebelum `colorSlot` ditambahkan (skema lama) di-backfill sekali jalan oleh `migrateIncomeColorSlots()` (cocokkan by id ke `DEFAULT_CATEGORIES.income`, cuma nulis field `colorSlot` yang belum ada — label/icon custom user tidak ikut ketimpa). Kategori khusus **`ALL_CATEGORY`** (💰💵🪙, `id: "semua"`, dipakai hanya di modal Rencana untuk budget gabungan semua expense) **tetap hardcoded** di `script.js`, sengaja tidak ikut disimpan ke Firebase — id `semua` juga di-reserve oleh `uniqueCategoryId()` supaya kategori baru tidak bisa menabraknya. Kategori sekarang bisa di-CRUD langsung dari app (lihat bagian Pengaturan → Kategori).

Catatan: user awalnya menuliskan struktur transaksi hanya `{ category, transaksi, catatan }` tanpa nominal; field `nominal` ditambahkan karena esensial untuk aplikasi keuangan.

### Cara kerja layer data (`script.js`)

- Satu listener realtime `financeRef.on("value", ...)` pada `db.ref("finance")`. Setiap perubahan → `rebuildFromSnapshot()` membangun ulang array `transactions[]`, `plans[]`, dan `CATEGORIES.expense`/`CATEGORIES.income` lalu `renderAll()`. Jadi UI selalu reaktif; fungsi tulis **tidak** perlu memanggil render manual. `CATEGORIES.expense` diurut naik berdasarkan `colorSlot` supaya urutan tampil stabil (tidak bergantung urutan key di Firebase).
- Tiap item `transactions[]` menyimpan `ym`, `id` (= timestamp key) supaya bisa menyusun path hapus (`deleteTransaction`); harinya didapat dari `date`/timestamp, tidak lagi jadi segmen path tersendiri.
- Tipe internal `income`/`expense` dipetakan ke `pemasukan`/`pengeluaran` lewat `TYPE_TO_FS`/`FS_TO_TYPE`.
- Fungsi tulis: `addTransaction` (menyertakan `by`), `updateTransaction` (edit; hanya nominal & catatan, path/timestamp/`by` tetap), `deleteTransaction`, `savePlan(period, category, limit, sort, by)` (menimpa per periode+kategori — `.set()` flat, `by` cuma field, bukan path baru), `deletePlan(period, category)`, `saveCategory(type, data)` (create/update kategori; `.set()` per id, aman karena id tak pernah berubah), `deleteCategory(type, id)`, `migrateLegacyPlans` (pindah rencana lama tanpa periode → `plans/bulanan/...`, sekali jalan), `migrateLegacyCategories` (seed `categories/` dari `DEFAULT_CATEGORIES` kalau belum ada, sekali jalan), `migrateIncomeColorSlots` (backfill field `colorSlot` ke kategori income yang sudah ada dari skema lama, sekali jalan), `migrateTransactionOwners` (backfill `by:"ciwul"` ke tiap transaksi yang belum punya field itu, sekali jalan — semua data lama dibuat oleh Ciwul), `migrateLegacyPlanOwners` (backfill field `by:"ciwul"` ke tiap rencana flat yang belum punya, pola sama seperti `migrateIncomeColorSlots`; **bukan** restrukturisasi path). Semua migrasi dipanggil tiap snapshot di `subscribeFinance()`, tapi masing-masing punya guard `let xMigrated = false` supaya cuma benar-benar menulis sekali.
- `categoryColorVar(catId)`: cari kategori expense-nya lalu baca field `colorSlot` langsung (fallback slot 1 kalau tidak ketemu, mis. transaksi lama yang kategorinya sudah dihapus dari Firebase) → `var(--series-N)`. Dipakai kartu Statistik Pengeluaran di Dashboard.
- Menghapus transaksi terakhir di suatu hari/bulan otomatis membersihkan node kosong (perilaku default Firebase RTDB).

## Struktur file

- `index.html` — struktur halaman (single-page, section di-toggle lewat JS, bukan multi-page).
- `css/` — styling, mobile-first, pakai CSS variables untuk theming (light/dark). Dulu satu file `style.css` (1500+ baris), dipecah per fitur supaya lebih gampang dinavigasi; isinya dipindah apa adanya (tidak ada aturan yang di-reorder), jadi hasil akhirnya identik dengan sebelum dipecah. Di-`<link>` di `index.html` sesuai urutan ini:
  - `css/base.css` — variabel `:root`/`[data-theme="dark"]`, reset global, loading overlay, app shell, header, page shell, month selector. Fondasi untuk semua halaman.
  - `css/components.css` — komponen lintas halaman: tombol (`.btn-*`, `.icon-btn*`), empty state, bottom nav, shell modal/bottom-sheet (`.modal-overlay`/`.modal-sheet`), field form modal bersama (`.type-toggle`, `.field`, `.modal-actions` — dipakai modal Transaksi/Rencana/Filter), dan confirm dialog terpusat.
  - `css/dashboard.css` — balance card, section heading, kartu Statistik Pengeluaran.
  - `css/transactions.css` — list transaksi, tab filter (`.filter-tab`, basis yang dipakai juga oleh `.plan-tabs` di Rencana), modal filter (`.day-dd*`, `.filter-category-*`), popup detail transaksi.
  - `css/plans.css` — list rencana, kartu rencana, drag-reorder.
  - `css/settings.css` — list Pengaturan, popup export Excel.
- `script.js` — semua logic (state, render, event handler, layer data Firebase). IIFE tunggal, vanilla JS tanpa framework/build tool. **Belum dipecah** seperti CSS — satu IIFE ini berbagi closure state (`transactions`, `plans`, `CATEGORIES`, `viewDate`, dst.) antar hampir semua fungsi, jadi pemecahannya lebih berisiko: ES modules (`type="module"`) akan mematahkan kemampuan "buka `index.html` langsung tanpa server" (browser blokir `import` lewat `file://`), sedangkan classic script butuh state itu di-expose jadi global. Kalau nanti dipecah, mulai dari bagian yang stateless dulu (mis. `Utilities`, penyiapan data `Export Excel`).
- `generate-excel.js` — helper pembuatan/unduh file Excel `.xlsx` (`window.FinanceExcel`), memakai SheetJS. Generik & tanpa state app: menerima data mentah dari `script.js`. Di-load setelah SheetJS CDN, sebelum `script.js`. Ini contoh pola "modul mandiri tanpa shared state" yang berhasil karena fungsinya generik — beda dengan sebagian besar `script.js` yang bergantung closure state.
- **`img/` bukan lagi folder sendiri di Finance App** — ikon `iyon.png`/`ciwul.png`/`couple.png` sekarang di `app/img/` (satu sumber dipakai bareng Routine & Note App juga), direferensikan dari `script.js` sbg `../img/<nama>.png`. Lihat `app/.claude/CLAUDE.md` bagian "Sumber img/ dikonsolidasi".
- `app/.claude/finance-app.md` — file ini, dokumentasi project untuk Claude.

Belum ada build tool (tidak ada npm/bundler). Cukup buka `index.html` langsung di browser atau lewat live server.

**Dependensi eksternal (CDN, di `<head>`/akhir `body`):** Firebase compat v8.10.1 (app+database) dan **SheetJS** (`xlsx.full.min.js`) untuk export Excel.

## Fitur yang sudah ada

1. **Dashboard** (`#dashboard`)
   - Selector bulan (prev/next) untuk melihat ringkasan per bulan.
   - Card saldo bulan berjalan: total pemasukan, total pengeluaran, saldo, dan progress bar perbandingan income vs expense.
   - **Sembunyikan saldo**: tombol mata (`#balanceToggle`, kanan atas card, ikon outline SVG inline gaya Flaticon — bukan emoji) meng-toggle tampilan angka saldo/pemasukan/pengeluaran vs teks tersamar `Rp ••••••` (state `balanceVisible`, in-memory saja — **tidak** disimpan, jadi selalu kembali tersembunyi tiap buka app). Dua SVG (`.icon-eye-open`/`.icon-eye-closed`) ditumpuk di dalam tombol, ditukar tampil/sembunyi lewat class `.is-visible` di CSS; `stroke="currentColor"` mengikuti `color: #fff` pada `.balance-toggle` supaya otomatis kontras di kedua tema (balance card selalu bergradasi gelap di light & dark theme). Ikon merepresentasikan *aksi* saat diklik (pola sama seperti `applyTheme`): mata terbuka saat tersembunyi (klik untuk tampilkan), mata tercoret saat tampil (klik untuk sembunyikan).
   - List transaksi terbaru: **maks 3**, diurut paling baru berdasarkan waktu pembuatan (`txTime`, dari timestamp). Tiap item tampil tanggal singkat + jam:menit.
   - **Statistik Pengeluaran** (`#categoryStats`, `renderCategoryStats()`): breakdown pengeluaran per kategori bulan berjalan (expense saja, dari `monthTx` yang sama dengan balance card), diurut nominal terbesar → terkecil. Kalimat insight di atas menyorot kategori terbesar + persentasenya. Tiap baris: dot warna + ikon/label, persen dari total (reuse `.plan-percent`), progress bar (reuse `.plan-progress-track`/`.plan-progress-fill`, warna kategori di-inline), nominal (reuse `.plan-amounts`) dan — kalau kategori itu punya rencana **bulanan** — catatan singkat dibanding limitnya (`"X% dari rencana bulanan"` / `"Mendekati batas rencana bulanan"` ≥80% / `"Mencapai target rencana bulanan"` =100% / `"Melebihi rencana bulanan"` >100%, ≥80% warna `--color-warning`, >100% warna `--color-expense`). Tiap baris (`.stat-row`) dipisah garis (`border-bottom`, kecuali baris terakhir) supaya jelas baris "dari rencana" itu masih bagian kategori di atasnya. Nominal ikut `balanceVisible` (masking sama seperti balance card); bar & persen selalu tampil karena tidak membocorkan nominal absolut. Warna kategori pakai 10 CSS var `--series-1`..`--series-10` (light & dark, tervalidasi lewat `dataviz` skill — slot 9 cyan & 10 coklat ditambahkan saat CRUD kategori) yang **fixed mengikuti field `colorSlot` kategori** (`categoryColorVar()`) — bukan mengikuti ranking bulan itu, supaya warna kategori konsisten antar bulan.
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
   - **Kategori — CRUD penuh** (tombol `#categoriesBtn` → popup `#categoriesModal`): daftar semua kategori expense & income dari `CATEGORIES` (dua list, judul "Pengeluaran"/"Pemasukan"), tiap list ditutup tombol lebar penuh **"+ Buat Kategori Baru"** (`.category-add-btn.btn-invert` — warna dibalik per tema: hitam/teks putih di light, putih/teks hitam di dark, reuse `.btn-invert` yang sama dgn tombol Reset filter — `#addExpenseCategoryBtn`/`#addIncomeCategoryBtn`, tipe kategori ikut section-nya). Tiap baris (`.category-row`, `categoryRowHtml()`): lingkaran warna dari `colorSlot` kategori itu (`var(--series-N)`) + ikon + label + id + tombol ✏️/🗑️ (`.cat-btn`, gaya sama dgn `.tx-btn`/`.plan-btn`) sejajar di kanan — **kecuali kategori "Lainnya" bawaan** (`isLainnyaCategory()`, dicek **by id** — `"lainnya-keluar"`/`"lainnya-masuk"`, bukan by label, supaya tetap kena walau labelnya di-custom user mis. jadi "Lainnya (Pengeluaran)"), yang tombol edit/hapusnya sengaja disembunyikan karena id-nya dipakai sbg catch-all bawaan. **Urutan tampil** disortir A-Z by label khusus di popup ini (`sortCategoriesForModal()`, cuma untuk render — tidak mengubah `CATEGORIES` aslinya), dengan kedua kategori "Lainnya" itu selalu didorong ke paling akhir. List di-render `renderCategoriesModal()` — dipanggil saat buka popup **dan** dari `renderAll()` kalau popup sedang terbuka (supaya reaktif habis tulis Firebase).
     - **Create/Update** pakai modal form yang sama (`#categoryModal`, `openCreateCategoryModal(type)`/`openEditCategoryModal(type, cat)`, state `editingCategory`): field id **wajib diisi manual saat create** (`required`, placeholder "mis. kopi" — browser blok submit kalau kosong; `categoryIdInput.disabled` di-toggle sesuai mode), label "Label (Yang ditampilkan)" (placeholder "mis. Kopi", biar jelas ini teks tampilnya bukan id-nya), icon (**dibatasi 1 grapheme** via `firstGrapheme()` — pakai `Intl.Segmenter` supaya emoji multi-code-unit tidak kepotong; dipangkas realtime saat mengetik), dan **picker warna** (`.slot-picker`, 10 lingkaran `var(--series-1..10)`, konstanta `SERIES_SLOT_COUNT`). Saat submit create, id yang diketik user dinormalisasi lewat `slugifyCategoryId()` (lowercase, spasi→`-`) lalu dicek `isCategoryIdTaken()` (bentrok kategori lain di tipe yang sama, atau id reserved `semua` milik `ALL_CATEGORY`) — kalau bentrok atau habis di-slugify jadi kosong, `alert()` dan submit dibatalkan (tidak auto-rename diam-diam). Saat edit, **id tidak bisa diubah** (field dikunci) — submit selalu pakai id lama.
     - **Delete** lewat `#confirmModal` terpusat yang sama dengan transaksi/rencana (state `pendingDeleteCategory`, `openDeleteCategoryConfirm()`); teksnya mengingatkan transaksi lama tetap tersimpan tapi tampil tanpa nama kategori (fallback ❓ di `findCategory`).
     - Kategori baru otomatis muncul di form transaksi, filter, dan dropdown Rencana karena semuanya baca `CATEGORIES` yang sama (reaktif dari Firebase).
   - **Semua Aplikasi** — `.settings-item` biasa di atas "Tentang" berisi tombol `<a class="btn-secondary btn-hub">Iyon App</a>` (bukan `<button>`, tapi styling sama) mengarah ke `../index.html` (hub Iyon App). CSS tambahan cuma `.settings-item a.btn-secondary` di `css/settings.css` (supaya anchor ter-center & tanpa underline seperti button asli) — pola sama persis ditambahkan juga di Kitchen App (`kitchen/css/settings.css` & `kitchen/index.html`). Tombolnya diberi `.btn-hub` (`css/settings.css`) — gradient ungu **sama persis** dgn header hub `app/index.html` (`--gradient-hero` di `app/style-app.css`: light `#6d5bd0`→`#9b6bd6`, dark `#4f3fa6`→`#7a4fb0`, hardcode bukan pakai `--color-primary` app ini sendiri), permintaan eksplisit user spy tombol "pintu balik ke hub" ini konsisten warnanya di semua app — bukan ngikut warna primary masing-masing app. Ditambahkan identik di Kitchen/Routine/Patungan/Note App (`.btn-hub` class sama persis di tiap `components.css`/`settings.css`).
   - Info "Tentang". (Tombol "Hapus Semua Data" sudah dihapus sejak data pindah ke Firebase.)
5. **Tambah transaksi** lewat tombol **+ di tengah bottom nav** (`#navAdd`, `.nav-add` — bulat bergradient, menonjol ke atas, **selalu tampil di semua halaman**) → modal bottom-sheet, pilih tipe (income/expense), kategori, jumlah, catatan. **Tanggal otomatis** (field `#dateInput` `disabled`, di-set ke hari ini saat tambah; label "Tanggal (otomatis)"). Jumlah diformat ribuan realtime saat diketik (`formatAmountInput`). Setelah **tambah** transaksi berhasil, app otomatis pindah ke Dashboard (`goToPage("dashboard")`); **edit** tetap di halaman asal.
6. **Navigasi**: bottom navigation bar ala aplikasi mobile — Dashboard, Transaksi, **[+]**, Rencana, Pengaturan (tombol + tambah transaksi ada di slot tengah, di antara Transaksi & Rencana).
7. **Tema light/dark**: pakai atribut `data-theme` di `<html>`, variabel warna di `:root` dan `[data-theme="dark"]` pada `css/base.css`. Preferensi tersimpan di localStorage, fallback ke `prefers-color-scheme`.
8. **Multi-user (Iyon / Ciwul / Both)**: app dipakai 2 orang, jadi tiap transaksi & rencana punya field `by` (`"iyon"` | `"ciwul"`) penanda pembuat.
   - **Konstanta & state**: `USERS = { iyon: {id,label:"Iyon",icon:"../img/iyon.png"}, ciwul: {...}, both: {id,label:"Both",icon:"../img/couple.png"} }`; `currentUser` (in-memory, diisi dari `localStorage[STORAGE_KEYS.user]` saat load). Ikon sementara **placeholder PNG** (lingkaran warna + emoji 👨/👩/👫, 256×256) di `app/img/iyon.png`/`app/img/ciwul.png`/`app/img/couple.png` (satu sumber dipakai bareng app lain, lihat "Struktur file") — nama file sengaja tetap dipertahankan kalau nanti ditimpa foto asli, tidak perlu ubah kode.
   - **Pilih pengguna pertama kali**: kalau `localStorage` belum punya pilihan, `initUserSelect()` menampilkan `#userSelectOverlay` (full-screen, z-index di atas `#loadingOverlay`) berisi 3 tombol besar (foto + label). Pilih salah satu → `setCurrentUser(id)` simpan ke `localStorage`, tutup overlay, `renderAll()`. Bisa diganti kapan saja dari **Pengaturan** ("Pengguna Aktif" + tombol "Ganti" → `#userSwitchModal`, reuse render tombol yang sama) **atau langsung dari header** — `#headerUserIcon` (foto pengguna aktif di sebelah judul app) juga diklik → buka `#userSwitchModal` yang sama (listener terpisah, tapi callback identik dgn `#switchUserBtn`), permintaan eksplisit user spy ganti pengguna gak perlu buka halaman Pengaturan dulu. Pola identik dgn Routine App (lihat `app/.claude/routine-app.md` bagian sama).
   - `#userSwitchModal` **dipindah dari bottom-sheet (`.modal-sheet`) ke gaya popup tengah layar** (`.modal-overlay.confirm-overlay` + `.confirm-dialog`, class yg sama dipakai `#confirmModal`/`#creatorInfoModal`) — perubahan sengaja diminta user ("popup di tengah, mirip dialog konfirmasi yang sudah ada"), berlaku utk kedua entry point (header icon & tombol Pengaturan) krn satu modal dipakai bareng. `#userSwitchOptions` dapat sedikit margin scoped (`margin: 4px 0 20px` di `components.css`) krn `.confirm-dialog` aslinya didesain di sekitar `<p>`, bukan baris tombol foto.
   - **Scoping tampilan**: `visibleTransactions()` — `currentUser === "both" ? transactions : transactions.filter(t => t.by === currentUser)` — dipakai di `renderDashboard`, `renderAllTransactions`, `renderPlans` (hitung `spent`), `updateMonthNavButtons`, `openFilterModal` (cek kategori terhapus), `openMonthPicker`, `exportTransactionsForYm`, `exportMonthlySummary`. Jadi **Dashboard, Transaksi, & export Excel otomatis ke-scope** ke user aktif; mode Both menampilkan gabungan semua data.
   - **Rencana (Plans) — visibility-only, BUKAN per-user data**: skema Firebase plans **tetap flat** (`plans/<period>/<category>`, satu slot global per kombinasi periode+kategori, siapa pun pembuatnya) — keputusan ini final setelah user menolak proposal awal (path nested `.../<by>/...`) karena tidak perlu path baru selama sudah ada field `by`. Konsekuensinya: **Iyon & Ciwul TIDAK bisa punya rencana terpisah untuk kategori+periode yang sama** — kalau satu sudah membuat "Makanan bulanan", yang lain hanya bisa mengedit punya itu (dianggap satu rencana bersama), bukan membuat rencana kedua. `periodIsFull`/`populatePlanCategories`/`updatePeriodOptions` mengecek keunikan **global** (tidak di-scope per-user). Yang **memang** per-user hanya *tampilan list*: `renderPlans()` memfilter `plans.filter(p => p.period === currentPeriod && (currentUser === "both" || p.by === currentUser))` — jadi saat mode Iyon, rencana yang `by:"ciwul"` tersembunyi dari list (walau tetap "menghabiskan slot" global kategori itu untuk periode itu).
   - **Field "Dibuat oleh" saat mode Both**: karena "Both" bukan orang beneran, modal Tambah/Edit Transaksi (`#transactionByField`, toggle `#transactionByToggle`) dan Tambah/Edit Rencana (`#planByField`, toggle `#planByToggle`) menampilkan toggle Iyon/Ciwul **hanya kalau `currentUser === "both"`** (`updateByFieldVisibility()`); kalau mode aktif Iyon/Ciwul, field disembunyikan dan `by` otomatis ikut `currentUser`. Saat **edit**, `by` tidak berubah (ambil dari data lama, sama seperti field lain yang dikunci). Toggle ini reuse pola `.type-toggle`/`.type-btn` yang sebelumnya cuma dipakai utk expense/income — makanya toggle tipe asli diberi `id="transactionTypeToggle"` supaya query selector bisa di-scope dan tidak tabrakan dengan toggle by yang baru.
   - **Badge pembuat (mode Both saja)**: `renderTransactionList()` menyisipkan `<img class="creator-badge">` (pojok kanan-bawah `.tx-icon`) dan `renderPlans()` menyisipkan `<img class="creator-badge-inline">` (di samping label kategori) berisi ikon `USERS[tx.by]`. Klik badge → `openCreatorInfo(by)` membuka `#creatorInfoModal` (reuse gaya `.confirm-dialog`) menampilkan teks "Dibuat oleh: <label>". Listener klik item transaksi/rencana diabaikan kalau target ada di dalam badge (supaya tidak bentrok dengan buka detail/edit).
   - **Drag-reorder rencana**: handle ⠿ disembunyikan & drag dimatikan saat `currentUser === "both"` (list berisi campuran rencana banyak pemilik, urutan drag jadi ambigu); di mode single-user tetap berfungsi normal.

## Model data internal (`script.js`, hasil rebuild dari Firebase)

```js
// transactions[] (item)
{ id, ym: "YYYY-MM", type: "income" | "expense", amount: number, category: string, note: string, date: "YYYY-MM-DD", by: "iyon" | "ciwul" }

// plans[] (item)
{ id: "<period>_<category>", period: "harian"|"mingguan"|"bulanan"|"weekday"|"weekend", category: string, limit: number, sort: number, by: "iyon" | "ciwul" }
// budget per periode+kategori (kategori expense atau "semua"); id = period + "_" + category; sort = urutan tampil
// by = pembuat (utk visibility/badge) — SATU slot global per period+category, TIDAK per-user (lihat "Multi-user")
```

`id` transaksi = timestamp key di Firebase; `ym`/`id` dipakai untuk menyusun path saat hapus. Struktur mentah di Firebase lihat bagian "Struktur data di Firebase" di atas. Kategori didefinisikan statis di `script.js` (`CATEGORIES.income` dan `CATEGORIES.expense`), masing-masing punya `id`, `label`, `icon` (emoji). Ada satu kategori khusus `ALL_CATEGORY` (`id: "semua"`) yang **hanya dipakai di Rencana** (bukan transaksi) sebagai budget gabungan semua expense.

## Rencana / TODO ke depan

- **Auth**: DB masih publik readable (belum ada login). Fitur multi-user (Iyon/Ciwul/Both) di atas **cuma preferensi tampilan/pelabelan**, bukan proteksi akses — siapa pun yang buka app tetap bisa memilih jadi "siapa saja". Kalau mau privat sungguhan, perlu Firebase Auth + ketatkan rules per-user.
- Ikon `app/img/iyon.png`/`app/img/ciwul.png`/`app/img/couple.png` masih placeholder (lingkaran warna + emoji) — tinggal ditimpa foto asli nanti (dipakai bareng app lain, jadi cukup timpa sekali), nama file tidak perlu berubah.
- Kemungkinan fitur lanjutan: grafik/statistik lebih detail, notifikasi budget hampir habis. (Kategori custom & export data sudah jadi.)
- Belum ada testing otomatis / build pipeline — project murni HTML/CSS/JS statis.

## Loading overlay

Saat app dibuka, ada overlay `#loadingOverlay` (animasi ikon uang 💰💵🪙 memantul naik-turun, keyframe `coinBounce` di `style.css`) yang menutup layar sampai data pertama dari Firebase tiba. Disembunyikan oleh `hideLoading()` di `script.js` — dipanggil pada snapshot pertama, pada error baca, dan sebagai fallback `setTimeout(hideLoading, 10000)` supaya user tak terjebak kalau offline.

## Filter transaksi

Halaman Transaksi punya filter bertingkat yang bekerja bersama; semuanya dipakai di `renderAllTransactions()` di atas list yang sudah difilter per bulan.

1. **Tab tipe** (`.filter-tab`, `data-filter` = `all`/`income`/`expense`) → state `currentFilter`. Klik tab: set `currentFilter`, tandai tab aktif, **reset `selectedCategories` ke `[]`** (filter kategori dibatalkan tiap ganti tab), lalu re-render. (Rentang tanggal **tidak** direset di sini karena tidak bergantung tipe.)
2. **Modal filter** (tombol 🔍 `#filterBtn` → modal `#filterModal`) berisi dua bagian:
   - **Rentang tanggal** (`#filterStartInput` & `#filterEndInput`, **dropdown kustom** `.day-dd` — bukan `<select>` native, karena tinggi popup select tak bisa dibatasi lintas browser) → **pilihan hari** 1..akhir bulan (tampilan sudah per-bulan). Pilihan disimpan di `dataset.value` pada `.day-dd`; state `filterStartDate`/`filterEndDate` tetap "YYYY-MM-DD". `openFilterModal()` mengisi opsi via `fillDaySelect()` (opsi "—" = tanpa filter) & prefill dari state (`dayOf`). Toggle `.day-dd-toggle` buka/tutup panel `.day-dd-menu` (hanya satu terbuka; tutup saat klik luar); panel dibatasi `max-height` (~5–6 baris) lalu scroll, dan auto-scroll ke hari terpilih saat dibuka. `applyFilter()` membaca `dataset.value` → `dateFromDay` (hari + bulan aktif), menukar start/end bila terbalik. List kategori dibatasi ~3 baris (`max-height`, scroll).
   - **Tiga tombol** di modal: **Batal** (`closeFilterModal`), **Reset** (`resetFilter` — hapus SEMUA filter: tipe→"all" + tab-nya, kategori, rentang tanggal, lalu tutup & re-render), **Terapkan** (`applyFilter`).
   - **Kategori** (`selectedCategories[]`): `openFilterModal()` mengisi `#filterCategoryList` dengan checkbox mengikuti tab aktif (tab `all` → expense+income; income/expense → tipe itu saja); yang terpilih di-`checked`. Kalau ada transaksi (sesuai tab aktif) yang kategorinya sudah dihapus dari `CATEGORIES` (`!categoryExists(type, id)`), ditambahkan satu opsi ekstra **"❓ Kategori Terhapus"** di bawah list — value-nya sentinel `UNKNOWN_CATEGORY_ID` (`"__unknown__"`, sengaja tidak mungkin bentrok id kategori asli karena `slugifyCategoryId()` membuang underscore), supaya transaksi dgn kategori yang sudah dihapus tetap bisa dicari/difilter (sebelumnya "hilang" dari filter kategori karena tidak ada lagi di `CATEGORIES` utk di-render checkbox-nya).
   - `applyFilter()` membaca tanggal + checkbox → state, `updateFilterButton()` menandai `#filterBtn` `.active` kalau **ada** kategori terpilih **atau** rentang tanggal terisi, tutup modal, re-render.
   - Di `renderAllTransactions`, urutan filter: `currentFilter` (type) → `selectedCategories` (category, cocok id asli **atau** — kalau `UNKNOWN_CATEGORY_ID` dicentang — kategorinya memang sudah tidak ada di `CATEGORIES`) → `filterStartDate` (`t.date >= start`) → `filterEndDate` (`t.date <= end`). Perbandingan string "YYYY-MM-DD" = kronologis.
3. **Ganti bulan** (`changeMonth`) mereset `filterStartDate`/`filterEndDate` (terikat ke bulan tertentu) lalu `updateFilterButton()`; `selectedCategories` tetap (tidak month-specific).

## Edit & hapus (transaksi & rencana)

**Transaksi** — tiap item punya dua tombol di kanan (`.tx-actions`): ✏️ **edit** dan 🗑️ **hapus**.
- **Edit**: `openEditModal(tx)` memakai ulang modal `#transactionModal` (judul jadi "Edit Transaksi" via `#transactionModalTitle`, form di-prefill). State `editingTx` menandai mode; saat submit, kalau `editingTx` terisi → `updateTransaction()` (bukan `addTransaction()`).
  - **Hanya nominal & catatan yang bisa diubah.** Tipe transaksi, kategori, dan tanggal **dikunci**: `setImmutableFieldsLocked(true)` men-`disable` tombol `.type-btn` + `#categoryInput` (dan `#dateInput` memang selalu `disabled`), dengan class `.locked` di `.type-toggle` untuk gaya "tidak bisa diubah". Mode tambah memanggil `setImmutableFieldsLocked(false)` untuk membuka lagi.
  - `updateTransaction(oldTx, data)` menulis ulang node di **path yang sama** (`ym`/`id` dari `oldTx`) — timestamp A tetap A, tidak ada pemindahan node. Tipe/kategori/tanggal diambil dari `oldTx` (bukan form), hanya `nominal` & `catatan` yang dipakai dari input.
- **Hapus**: `openDeleteConfirm(tx)` membuka dialog konfirmasi terpusat `#confirmModal` ("Hapus Transaksi?"). State `pendingDeleteTx`.

**Rencana** — tiap plan card punya ✏️ edit & 🗑️ hapus (`.plan-actions`).
- **Edit**: `openEditPlanModal(plan)` memakai ulang modal `#planModal`, prefill periode + kategori + limit; state `editingPlan`. **Periode, kategori, & `by`(pembuat) dikunci** saat edit (`setPlanFieldsLocked(true)` men-`disable` `#planPeriodInput` & `#planCategoryInput`, toggle "Dibuat oleh" juga disembunyikan) — hanya batas anggaran yang bisa diubah; mengubah periode/kategori = rencana lain. Submit memanggil `savePlan(period, category, limit, sort, by)` (menimpa per periode+kategori, `sort`/`by` dipertahankan dari data lama saat edit).
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
- **Batas geser bulan**: tombol prev/next (di kedua halaman) dibatasi ke rentang `ym` ("YYYY-MM") terkecil–terbesar yang benar-benar ada transaksinya di Firebase — `updateMonthNavButtons()`, dipanggil di akhir `renderAll()` (jadi ikut ter-update tiap snapshot Firebase berubah maupun tiap pindah bulan). Kalau `transactions` kosong sama sekali, kedua tombol dimatikan (tidak ada ke mana pun untuk digeser). Bulan **di antara** min–max yang kebetulan tidak punya transaksi (mis. bulan bolong) tetap bisa disinggahi — yang dibatasi cuma ujung rentangnya, bukan tiap bulan individual. Pakai atribut `disabled` native (bukan sekadar CSS), jadi klik pun tidak akan menembus batas.
- Format mata uang: `Rp` + pemisah ribuan gaya Indonesia (`toLocaleString("id-ID")`), lihat `formatCurrency()`.
- Modal tambah/edit transaksi (`#transactionModal`), tambah/edit rencana (`#planModal`), dan filter kategori (`#filterModal`) pakai pola bottom-sheet (`.modal-overlay` + `.modal-sheet`), dibuka/ditutup dengan toggle class `.open`. Dialog konfirmasi hapus (`#confirmModal`, dipakai bersama transaksi & rencana) pakai varian terpusat (`.confirm-overlay` + `.confirm-dialog`). Semua overlay bisa ditutup dengan klik area gelap di luar sheet.
- Saat menambahkan fitur baru, ikuti pola yang sudah ada: render function terpisah per section (`renderDashboard`, `renderAllTransactions`, `renderPlans`), lalu panggil ulang render terkait setiap kali data berubah (create/update/delete).
