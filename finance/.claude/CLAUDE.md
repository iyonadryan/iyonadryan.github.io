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
    <DD>/                        # mis. "01"
      <timestamp>/               # key = Date.now() saat input
        transaksi: "pemasukan" | "pengeluaran"
        category:  "makanan"     # id kategori (lihat CATEGORIES di script.js)
        nominal:   50000         # jumlah uang (Rp) — DITAMBAHKAN, tidak ada di sketsa awal user
        catatan:   "Makan siang"
        tanggal:   "2026-06-01"  # redundan dgn path, disimpan utk kemudahan
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
- Tiap item `transactions[]` menyimpan `ym`, `day`, `id` (= timestamp key) supaya bisa menyusun path hapus (`deleteTransaction`).
- Tipe internal `income`/`expense` dipetakan ke `pemasukan`/`pengeluaran` lewat `TYPE_TO_FS`/`FS_TO_TYPE`.
- Fungsi tulis: `addTransaction`, `updateTransaction` (edit; hanya nominal & catatan, path/timestamp tetap), `deleteTransaction`, `savePlan(period, category, limit)` (menimpa per periode+kategori), `deletePlan(period, category)`, `migrateLegacyPlans` (pindah rencana lama tanpa periode → `plans/bulanan/...`, sekali jalan).
- Menghapus transaksi terakhir di suatu hari/bulan otomatis membersihkan node kosong (perilaku default Firebase RTDB).

## Struktur file

- `index.html` — struktur halaman (single-page, section di-toggle lewat JS, bukan multi-page).
- `style.css` — semua styling, mobile-first, pakai CSS variables untuk theming (light/dark).
- `script.js` — semua logic (state, render, event handler, layer data Firebase). IIFE tunggal, vanilla JS tanpa framework/build tool.
- `.claude/CLAUDE.md` — file ini, dokumentasi project untuk Claude.

Belum ada build tool (tidak ada npm/bundler). Cukup buka `index.html` langsung di browser atau lewat live server.

## Fitur yang sudah ada

1. **Dashboard** (`#dashboard`)
   - Selector bulan (prev/next) untuk melihat ringkasan per bulan.
   - Card saldo bulan berjalan: total pemasukan, total pengeluaran, saldo, dan progress bar perbandingan income vs expense.
   - List transaksi terbaru: **maks 3**, diurut paling baru berdasarkan waktu pembuatan (`txTime`, dari timestamp). Tiap item tampil tanggal singkat + jam:menit.
2. **Transaksi** (`#transactions`)
   - Punya selector bulan sendiri (prev/next) — **per-bulan, beda bulan beda data**. List difilter ke bulan yang sedang dipilih.
   - **Filter dua tingkat** (lihat bagian "Filter transaksi"): tab tipe Semua / Pemasukan / Pengeluaran, plus tombol 🔍 → modal filter kategori multi-select.
   - Tampilan lebih detail (`detailed=true` di `renderTransactionList`): tanggal + tahun & jam:menit:**detik**. Urut per tanggal desc, tie-break waktu pembuatan.
   - Edit & hapus transaksi langsung dari list (lihat bagian "Edit & hapus (transaksi & rencana)").
3. **Rencana Anggaran / Plans** (`#plans`)
   - Budget per kategori pengeluaran, ditambah lewat tombol `+` di header (`#addPlanBtn`, pakai `.icon-btn.accent` — bergradient warna seragam dengan FAB tambah transaksi).
   - **Tab periode** (desain sama seperti filter transaksi, class `.filter-tab` di dalam `#plans`, container `.plan-tabs`): **Harian / Mingguan / Bulanan / Weekday / Weekend** (`data-period`), state `currentPeriod` (default `"bulanan"`). Klik tab → filter list ke periode itu + re-render. Handler di-scope `#plans .filter-tab` (dan handler transaksi di-scope `#transactions .filter-tab`) supaya tidak saling tabrakan. 5 tab membungkus ke 2 baris (`.plan-tabs { flex-wrap }`); **Weekday & Weekend diberi warna khusus** (indigo `#6366f1` / oranye `#f97316`, class `.tab-weekday`/`.tab-weekend`) untuk membedakannya dari periode lain.
   - Tiap kategori bisa punya rencana di beberapa periode sekaligus (mis. Makanan harian + Makanan bulanan), **tapi tidak boleh duplikat kategori dalam satu periode**: dropdown kategori di modal (`populatePlanCategories(period, keepCategory)`) menyembunyikan kategori yang sudah dipakai di periode terpilih. Ganti periode di modal → daftar kategori diperbarui (listener `change` pada `#planPeriodInput`).
   - **Periode penuh** (`periodIsFull` — semua kategori di pool sudah dipakai): (a) tombol `+` (`#addPlanBtn`) di-`disable` & jadi abu-abu (`.icon-btn.accent:disabled`), diatur di `renderPlans`; (b) di dropdown Periode modal, opsi periode yang penuh di-`disable`/buram (`updatePeriodOptions`, dipanggil saat buka modal tambah); (c) kalau periode terpilih ternyata penuh, dropdown kategori menampilkan opsi disabled "Semua kategori sudah dipakai" dan submit di-blok.
   - Ada juga kategori khusus **"Semua"** (`ALL_CATEGORY` = `{ id: "semua", label: "Semua", icon: "💰💵🪙" }`, **hanya muncul di modal Rencana**) yang budget-nya = gabungan **seluruh** pengeluaran di periode itu; ikut aturan anti-duplikat (maksimal satu "Semua" per periode).
   - Progress bar dihitung dari total pengeluaran pada **jendela waktu periode** (`txInPlanPeriod`): Harian = **hari ini**; Mingguan = **minggu berjalan** (Senin–Minggu); Weekday = **Sen–Jum** & Weekend = **Sab–Min** dalam minggu berjalan; semuanya relatif waktu **sekarang** (`new Date()`, bukan `viewDate`) kecuali Bulanan = bulan yang dipilih (`viewDate`). Untuk kategori "Semua", filter kategori dilewati (jumlahkan semua expense). Warna: class `warning` di ≥80%, `over` di ≥100%.
   - **Urutan bisa diubah dengan drag** (lihat bagian "Reorder rencana"): tiap card punya handle ⠿ di paling kiri; geser (mouse/sentuh) untuk menyusun ulang, urutan disimpan ke field `sort` di Firebase.
   - Tiap card punya tombol ✏️ edit & 🗑️ hapus (lihat bagian "Edit & hapus (transaksi & rencana)").
4. **Pengaturan** (`#settings`)
   - Toggle tema light/dark.
   - Info "Tentang". (Tombol "Hapus Semua Data" sudah dihapus sejak data pindah ke Firebase.)
5. **Tambah transaksi** lewat FAB (tombol +) di kanan bawah → modal bottom-sheet, pilih tipe (income/expense), kategori, jumlah, catatan. **Tanggal otomatis** (field `#dateInput` `disabled`, di-set ke hari ini saat tambah; label "Tanggal (otomatis)"). Jumlah diformat ribuan realtime saat diketik (`formatAmountInput`). **FAB hanya tampil di Dashboard** — disembunyikan di Transaksi (fokus menampilkan history), Rencana, & Pengaturan (di-toggle di `goToPage`).
6. **Navigasi**: bottom navigation bar ala aplikasi mobile (Dashboard, Transaksi, Rencana, Pengaturan).
7. **Tema light/dark**: pakai atribut `data-theme` di `<html>`, variabel warna di `:root` dan `[data-theme="dark"]` pada `style.css`. Preferensi tersimpan di localStorage, fallback ke `prefers-color-scheme`.

## Model data internal (`script.js`, hasil rebuild dari Firebase)

```js
// transactions[] (item)
{ id, ym: "YYYY-MM", day: "DD", type: "income" | "expense", amount: number, category: string, note: string, date: "YYYY-MM-DD" }

// plans[] (item)
{ id: "<period>_<category>", period: "harian"|"mingguan"|"bulanan"|"weekday"|"weekend", category: string, limit: number, sort: number }
// budget per periode+kategori (kategori expense atau "semua"); id = period + "_" + category; sort = urutan tampil
```

`id` transaksi = timestamp key di Firebase; `ym`/`day` dipakai untuk menyusun path saat hapus. Struktur mentah di Firebase lihat bagian "Struktur data di Firebase" di atas. Kategori didefinisikan statis di `script.js` (`CATEGORIES.income` dan `CATEGORIES.expense`), masing-masing punya `id`, `label`, `icon` (emoji). Ada satu kategori khusus `ALL_CATEGORY` (`id: "semua"`) yang **hanya dipakai di Rencana** (bukan transaksi) sebagai budget gabungan semua expense.

## Rencana / TODO ke depan

- **Auth**: DB masih publik readable (belum ada login). Kalau mau privat, perlu Firebase Auth + ketatkan rules per-user.
- Kemungkinan fitur lanjutan: grafik/statistik lebih detail, kategori custom (bukan hardcoded), export data, notifikasi budget hampir habis.
- Belum ada testing otomatis / build pipeline — project murni HTML/CSS/JS statis.

## Loading overlay

Saat app dibuka, ada overlay `#loadingOverlay` (animasi ikon uang 💰💵🪙 memantul naik-turun, keyframe `coinBounce` di `style.css`) yang menutup layar sampai data pertama dari Firebase tiba. Disembunyikan oleh `hideLoading()` di `script.js` — dipanggil pada snapshot pertama, pada error baca, dan sebagai fallback `setTimeout(hideLoading, 10000)` supaya user tak terjebak kalau offline.

## Filter transaksi

Halaman Transaksi punya filter **dua tingkat** yang bekerja bersama; keduanya dipakai di `renderAllTransactions()` di atas list yang sudah difilter per bulan.

1. **Tab tipe** (`.filter-tab`, `data-filter` = `all`/`income`/`expense`) → state `currentFilter`. Klik tab: set `currentFilter`, tandai tab aktif, **reset `selectedCategories` ke `[]`** (filter kategori dibatalkan tiap ganti tab), lalu re-render.
2. **Filter kategori** (tombol 🔍 `#filterBtn` → modal `#filterModal`) → state `selectedCategories[]` (array id kategori).
   - `openFilterModal()` mengisi `#filterCategoryList` dengan checkbox kategori. Kategori yang ditampilkan **mengikuti tab aktif**: tab `all` → gabungan expense + income; tab income/expense → kategori tipe itu saja. Checkbox yang sudah terpilih di-`checked`.
   - `applyFilter()` mengumpulkan checkbox tercentang → `selectedCategories`, update indikator tombol (`updateFilterButton()` menambah class `.active` di `#filterBtn` kalau ada kategori terpilih), tutup modal, re-render.
   - Di `renderAllTransactions`, list difilter: kalau `currentFilter !== "all"` filter per `type`, lalu kalau `selectedCategories.length > 0` filter per `category`.

## Edit & hapus (transaksi & rencana)

**Transaksi** — tiap item punya dua tombol di kanan (`.tx-actions`): ✏️ **edit** dan 🗑️ **hapus**.
- **Edit**: `openEditModal(tx)` memakai ulang modal `#transactionModal` (judul jadi "Edit Transaksi" via `#transactionModalTitle`, form di-prefill). State `editingTx` menandai mode; saat submit, kalau `editingTx` terisi → `updateTransaction()` (bukan `addTransaction()`).
  - **Hanya nominal & catatan yang bisa diubah.** Tipe transaksi, kategori, dan tanggal **dikunci**: `setImmutableFieldsLocked(true)` men-`disable` tombol `.type-btn` + `#categoryInput` (dan `#dateInput` memang selalu `disabled`), dengan class `.locked` di `.type-toggle` untuk gaya "tidak bisa diubah". Mode tambah memanggil `setImmutableFieldsLocked(false)` untuk membuka lagi.
  - `updateTransaction(oldTx, data)` menulis ulang node di **path yang sama** (`ym`/`day`/`id` dari `oldTx`) — timestamp A tetap A, tidak ada pemindahan node. Tipe/kategori/tanggal diambil dari `oldTx` (bukan form), hanya `nominal` & `catatan` yang dipakai dari input.
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
- `renderPlans` mengurutkan list per periode dengan `a.sort - b.sort` (tie-break `id`). Rencana baru dapat `sort` paling akhir (`nextSortForPeriod`); saat edit, `sort` lama dipertahankan (submit form mencari plan yang sudah ada by `id`). **Penting**: `savePlan` memakai `.set()` sehingga menulis ulang seluruh node — field `sort` **harus** ikut dikirim tiap simpan supaya urutan tidak ke-reset.

## Catatan implementasi

- Semua teks UI berbahasa Indonesia.
- **`viewDate` dibagi** antara Dashboard, Transaksi, & Rencana. Dashboard dan Transaksi masing-masing punya selector bulan (`#prevMonth`/`#nextMonth` dan `#prevMonthTx`/`#nextMonthTx`) yang semuanya lewat `changeMonth(delta)` → mengubah `viewDate` lalu `renderAll()`. Jadi ganti bulan di satu halaman ikut mengubah halaman lain (satu konsep "bulan aktif" untuk seluruh app).
- Format mata uang: `Rp` + pemisah ribuan gaya Indonesia (`toLocaleString("id-ID")`), lihat `formatCurrency()`.
- Modal tambah/edit transaksi (`#transactionModal`), tambah/edit rencana (`#planModal`), dan filter kategori (`#filterModal`) pakai pola bottom-sheet (`.modal-overlay` + `.modal-sheet`), dibuka/ditutup dengan toggle class `.open`. Dialog konfirmasi hapus (`#confirmModal`, dipakai bersama transaksi & rencana) pakai varian terpusat (`.confirm-overlay` + `.confirm-dialog`). Semua overlay bisa ditutup dengan klik area gelap di luar sheet.
- Saat menambahkan fitur baru, ikuti pola yang sudah ada: render function terpisah per section (`renderDashboard`, `renderAllTransactions`, `renderPlans`), lalu panggil ulang render terkait setiap kali data berubah (create/update/delete).
