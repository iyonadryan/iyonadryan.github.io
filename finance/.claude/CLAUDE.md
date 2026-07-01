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
    <category>/                  # 1 rencana per kategori pengeluaran
      category: "makanan"
      limit:    1000000
```

Catatan: user awalnya menuliskan struktur transaksi hanya `{ category, transaksi, catatan }` tanpa nominal; field `nominal` ditambahkan karena esensial untuk aplikasi keuangan.

### Cara kerja layer data (`script.js`)

- Satu listener realtime `financeRef.on("value", ...)` pada `db.ref("finance")`. Setiap perubahan → `rebuildFromSnapshot()` membangun ulang array `transactions[]` & `plans[]` lalu `renderAll()`. Jadi UI selalu reaktif; fungsi tulis **tidak** perlu memanggil render manual.
- Tiap item `transactions[]` menyimpan `ym`, `day`, `id` (= timestamp key) supaya bisa menyusun path hapus (`deleteTransaction`).
- Tipe internal `income`/`expense` dipetakan ke `pemasukan`/`pengeluaran` lewat `TYPE_TO_FS`/`FS_TO_TYPE`.
- Fungsi tulis: `addTransaction`, `deleteTransaction`, `savePlan` (menimpa per kategori), `deletePlan`, `resetAllData` (menghapus seluruh node `finance`).
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
   - Punya selector bulan sendiri (prev/next) — **per-bulan, beda bulan beda data**. List difilter ke bulan yang sedang dipilih, bisa difilter lagi: Semua / Pemasukan / Pengeluaran.
   - Tampilan lebih detail (`detailed=true` di `renderTransactionList`): tanggal + tahun & jam:menit:**detik**. Urut per tanggal desc, tie-break waktu pembuatan.
   - Edit & hapus transaksi langsung dari list (lihat bagian "Edit & hapus transaksi").
3. **Rencana Anggaran / Plans** (`#plans`)
   - Budget per kategori pengeluaran (limit bulanan).
   - Progress bar otomatis dari total pengeluaran kategori tsb di bulan yang sedang dilihat (warna berubah saat mendekati/melebihi limit).
4. **Pengaturan** (`#settings`)
   - Toggle tema light/dark.
   - Info "Tentang". (Tombol "Hapus Semua Data" sudah dihapus sejak data pindah ke Firebase.)
5. **Tambah transaksi** lewat FAB (tombol +) di kanan bawah → modal bottom-sheet, pilih tipe (income/expense), kategori, jumlah, catatan, tanggal.
6. **Navigasi**: bottom navigation bar ala aplikasi mobile (Dashboard, Transaksi, Rencana, Pengaturan).
7. **Tema light/dark**: pakai atribut `data-theme` di `<html>`, variabel warna di `:root` dan `[data-theme="dark"]` pada `style.css`. Preferensi tersimpan di localStorage, fallback ke `prefers-color-scheme`.

## Model data internal (`script.js`, hasil rebuild dari Firebase)

```js
// transactions[] (item)
{ id, ym: "YYYY-MM", day: "DD", type: "income" | "expense", amount: number, category: string, note: string, date: "YYYY-MM-DD" }

// plans[] (item)
{ id: category, category: string, limit: number }  // budget bulanan per kategori (kategori expense saja)
```

`id` transaksi = timestamp key di Firebase; `ym`/`day` dipakai untuk menyusun path saat hapus. Struktur mentah di Firebase lihat bagian "Struktur data di Firebase" di atas. Kategori didefinisikan statis di `script.js` (`CATEGORIES.income` dan `CATEGORIES.expense`), masing-masing punya `id`, `label`, `icon` (emoji).

## Rencana / TODO ke depan

- **Auth**: DB masih publik readable (belum ada login). Kalau mau privat, perlu Firebase Auth + ketatkan rules per-user.
- Kemungkinan fitur lanjutan: grafik/statistik lebih detail, kategori custom (bukan hardcoded), export data, notifikasi budget hampir habis.
- Belum ada testing otomatis / build pipeline — project murni HTML/CSS/JS statis.

## Loading overlay

Saat app dibuka, ada overlay `#loadingOverlay` (animasi ikon uang 💰💵🪙 memantul naik-turun, keyframe `coinBounce` di `style.css`) yang menutup layar sampai data pertama dari Firebase tiba. Disembunyikan oleh `hideLoading()` di `script.js` — dipanggil pada snapshot pertama, pada error baca, dan sebagai fallback `setTimeout(hideLoading, 10000)` supaya user tak terjebak kalau offline.

## Edit & hapus transaksi

Tiap item transaksi punya dua tombol aksi di kanan (`.tx-actions`): ✏️ **edit** dan 🗑️ **hapus**.
- **Edit**: `openEditModal(tx)` memakai ulang modal `#transactionModal` (judul jadi "Edit Transaksi" via `#transactionModalTitle`, form di-prefill). State `editingTx` menandai mode; saat submit, kalau `editingTx` terisi → `updateTransaction()` (bukan `addTransaction()`). Kalau tanggal diubah sehingga bulan/hari berpindah, node dipindah ke path baru (key/timestamp dipertahankan) lalu node lama dihapus.
- **Hapus**: `openDeleteConfirm(tx)` membuka dialog konfirmasi terpusat `#confirmModal` ("Hapus Transaksi?" + Batal/Ya, Hapus). State `pendingDeleteTx`; tombol "Ya, Hapus" memanggil `deleteTransaction()`.

## Catatan implementasi

- Semua teks UI berbahasa Indonesia.
- **`viewDate` dibagi** antara Dashboard, Transaksi, & Rencana. Dashboard dan Transaksi masing-masing punya selector bulan (`#prevMonth`/`#nextMonth` dan `#prevMonthTx`/`#nextMonthTx`) yang semuanya lewat `changeMonth(delta)` → mengubah `viewDate` lalu `renderAll()`. Jadi ganti bulan di satu halaman ikut mengubah halaman lain (satu konsep "bulan aktif" untuk seluruh app).
- Format mata uang: `Rp` + pemisah ribuan gaya Indonesia (`toLocaleString("id-ID")`), lihat `formatCurrency()`.
- Modal tambah/edit transaksi & tambah rencana pakai pola bottom-sheet (`.modal-overlay` + `.modal-sheet`). Dialog konfirmasi hapus pakai varian terpusat (`.confirm-overlay` + `.confirm-dialog`).
- Saat menambahkan fitur baru, ikuti pola yang sudah ada: render function terpisah per section (`renderDashboard`, `renderAllTransactions`, `renderPlans`), lalu panggil ulang render terkait setiap kali data berubah (create/update/delete).
