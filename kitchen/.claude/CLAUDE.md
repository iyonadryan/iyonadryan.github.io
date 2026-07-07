# Kitchen App

Aplikasi web untuk mencatat resep masakan & bahan-bahannya — seperti buku catatan masak digital, dengan CRUD yang mudah. Berfokus pada penggunaan **mobile** (dibuka dari HP). Desain mobile-first, layout disimulasikan seperti layar HP (max-width 480px, centered) agar tetap rapi saat dibuka di desktop. Dibangun mengikuti pola/struktur **Finance App** (`../finance`) sebagai referensi menu & arsitektur.

## Status saat ini

Prototype pertama — UI/UX sudah jadi dan **data sudah terhubung ke Firebase Realtime Database** sejak awal (bukan localStorage dulu baru dipindah, seperti Finance App). Tidak ada fitur multi-user (beda dari Finance App) — app ini dianggap dipakai satu rumah tangga/pencatat, jadi tidak ada field `by` di data. Preferensi tema disimpan lokal (`localStorage`, key `kitchenapp_theme` — lihat `STORAGE_KEYS` di `script.js`).

### Konfigurasi Firebase

- Memakai **project Firebase yang sama** dengan Finance App & 24Card (`iyon-adryanlf-trialerror`), tapi path berbeda.
- SDK: **compat v8.10.1** (`firebase-app.js` + `firebase-database.js`), di-load via CDN gstatic. Config + `firebase.initializeApp` ada inline di `<head>` `index.html`, mengekspos global `db` dan konstanta `KITCHEN_PATH = "kitchen"`.
- Path data app ini: **`kitchen/...`** (top-level, sejajar dengan `finance` dan `trial-error`).
- Rules Firebase dikelola di console yang sama dengan Finance/24Card — node `kitchen` perlu ditambahkan sebagai `.write: true` di rules kalau belum (cek console kalau tulis-baca gagal). Sama seperti Finance App, **belum ada auth** — seluruh isi DB berpotensi terbaca publik.

### Struktur data di Firebase

```
kitchen/
  recipes/
    <timestamp>/                 # key = Date.now() saat input, sama pola dgn transaksi Finance App
      name:        "Nasi Goreng Spesial"
      category:    "sarapan"     # id kategori, lihat categories/ di bawah
      servings:    "2 orang"     # teks bebas, opsional
      time:        "20 menit"    # teks bebas, opsional
      ingredients: [ { name: "Nasi putih", qty: "2 piring" }, ... ]  # array of object, urutan = urutan tampil
      steps:       [ "Tumis bumbu hingga harum", ... ]               # array of string, urutan = nomor langkah
      note:        "Tambahkan kerupuk saat disajikan"  # opsional
      createdAt:   1719...       # dipakai sort "resep terbaru" di Dashboard & default sort list Resep
  categories/
    <id>/                        # id = slug dari label (slugify()), mis. "makan-siang"
      id:        "makan-siang"
      label:     "Makan Siang"
      icon:      "🍛"           # emoji, 1 karakter/grapheme (TIDAK divalidasi Intl.Segmenter seperti Finance App — beda dari finance/script.js)
      colorSlot: 2               # 1-8, dipetakan ke var(--series-1..8) di css/base.css
  shopping/
    <timestamp>/                 # key = Date.now(), sama pola dgn recipes
      name:      "Bawang Merah"
      qty:       "1/4 kg"        # opsional
      done:      false           # dicentang / belum
      createdAt: 1719...
```

Beda dari Finance App: **satu daftar kategori flat** (bukan dipisah `expense`/`income`), dan **hanya 8 colorSlot** (bukan 10) — sudah divalidasi lewat skill `dataviz` (`validate_palette.js`) terhadap surface `#ffffff` (light) dan `#241d17` (dark, custom untuk tema kitchen — beda dari surface dark Finance App `#1e1e2a`). Kalau nanti butuh kategori ke-9, ke-10, dst., harus divalidasi ulang (bukan asal reuse slot 9-10 Finance App karena surface dark-nya beda).

### Cara kerja layer data (`script.js`)

- Satu listener realtime `kitchenRef.on("value", ...)` pada `db.ref("kitchen")` (`subscribeKitchen()`). Setiap perubahan → `rebuildFromSnapshot()` membangun ulang array `recipes[]`, `categories[]`, `shopping[]` lalu `renderAll()` — pola identik dengan Finance App, tapi tanpa migrasi data lama (project baru, tidak ada skema legacy).
- **Seed kategori default** (`seedCategoriesIfEmpty()`, guard `categoriesSeeded`): kalau node `categories` belum ada sama sekali di Firebase, di-seed sekali dari `DEFAULT_CATEGORIES` (8 kategori: Sarapan, Makan Siang, Makan Malam, Camilan, Minuman, Dessert, Lauk, Lainnya) — pola sama dengan `migrateLegacyCategories()` Finance App, tapi lebih sederhana (tidak ada backfill/migrasi lain karena tidak ada skema lama).
- Fungsi tulis: `addRecipe`/`updateRecipe`/`deleteRecipe`, `saveCategory`/`deleteCategory` (id tidak pernah berubah saat edit, `.set()` aman), `addShoppingItem`/`toggleShoppingItem`/`deleteShoppingItem`/`clearDoneShopping` (hapus semua item yang `done:true` sekaligus lewat satu `update()` multi-path).
- `getCategory(id)` fallback ke `FALLBACK_CATEGORY` (`{ label: "Tanpa Kategori", icon: "📦", colorSlot: 8 }`) kalau resep merujuk kategori yang sudah dihapus — sama semangat dengan `categoryColorVar()` Finance App.
- `slugify()`/`uniqueSlug()`: id kategori baru **dibuat otomatis dari label** (bukan diisi manual seperti Finance App) — simplifikasi disengaja karena tidak ada kebutuhan id yang predictable/stabil across migrasi seperti di Finance App.

## Struktur file

- `index.html` — struktur halaman (single-page, section di-toggle lewat JS via `goToPage()`, sama pola dgn Finance App).
- `css/` — mobile-first, CSS variables untuk theming (light/dark), dipecah per fitur dari awal (bukan hasil pemecahan file besar seperti Finance App):
  - `css/base.css` — variabel `:root`/`[data-theme="dark"]` (termasuk `--gradient-card` utk hero card, `--series-1..8` kategorikal), reset global, loading overlay, app shell, header, page shell, section heading.
  - `css/components.css` — komponen lintas halaman: tombol (`.btn-*`, `.icon-btn*`), bottom nav, filter tabs, modal/bottom-sheet + field form bersama, **repeatable rows** (`.repeat-row`/`.repeat-add` — dipakai form Bahan-bahan & Langkah-langkah, TIDAK ADA padanannya di Finance App), confirm dialog generik, slot color picker, category rows (popup CRUD kategori).
  - `css/dashboard.css` — hero stat card (`.stat-hero`, versi kitchen dari `.balance-card` Finance App), category breakdown chips.
  - `css/recipes.css` — list resep, search box, filter tabs kategori, popup detail resep (bahan + langkah bernomor).
  - `css/shopping.css` — daftar belanja (checklist).
  - `css/settings.css` — list Pengaturan (lebih ringkas dari Finance App — tidak ada export Excel/multi-user).
- `script.js` — semua logic (state, render, event handler, layer data Firebase). Satu IIFE, vanilla JS, tanpa framework/build tool — pola sama dengan Finance App (lihat catatan soal ES modules vs classic script di `finance/.claude/CLAUDE.md` kalau nanti mau dipecah).
- `.claude/CLAUDE.md` — file ini.

Belum ada build tool. Cukup buka `index.html` langsung di browser atau lewat live server.

**Dependensi eksternal:** hanya Firebase compat v8.10.1 (app+database) via CDN — tidak ada SheetJS/library lain (belum ada fitur export).

## Fitur yang sudah ada

1. **Dashboard** (`#dashboard`)
   - Hero card gradient (`.stat-hero`) menampilkan 3 angka: total resep, total kategori, jumlah item belanja yang belum dicentang (`statShoppingCount` = `shopping.filter(s => !s.done).length`).
   - **Resep Terbaru**: maks 4 resep, diurut `createdAt` terbaru dulu. Link "Lihat Semua" → pindah ke halaman Resep (`data-nav="recipes"`, sama listener dengan bottom nav).
   - **Breakdown kategori**: chip per kategori yang punya ≥1 resep (kategori dengan 0 resep disembunyikan dari breakdown, tapi tetap muncul di filter tab halaman Resep).
2. **Resep** (`#recipes`)
   - Search box (`#recipeSearchInput`, filter substring nama resep, case-insensitive, realtime tiap ketik).
   - Filter tab kategori (`#recipeFilterTabs`, dibangun dinamis dari `categories[]` + tab "Semua") — beririsan dengan search (AND, bukan OR).
   - List resep (`.recipe-item`, klik kartu → buka popup detail; ikon & badge kategori pakai `chipStyle()`/`color-mix()` biar reaktif tema tanpa perlu hex terpisah per tema).
3. **Tambah/Ubah Resep** (`#recipeModal`, tombol **+ di tengah bottom nav** `#navAdd` untuk tambah cepat dari halaman mana pun, atau tombol "Ubah" di popup detail untuk edit)
   - Form: nama, kategori (select dinamis dari `categories[]`), porsi & waktu masak (teks bebas, bukan angka strict — fleksibel utk "2-3 orang" dsb.), **Bahan-bahan** (baris dinamis: nama + jumlah, tombol "+ Tambah Bahan", tiap baris bisa dihapus individual), **Langkah-langkah** (baris dinamis bernomor otomatis via `renumberSteps()`, tombol "+ Tambah Langkah"), catatan (opsional).
   - Baris kosong (nama bahan/teks langkah kosong) **difilter saat submit** (`recipeForm` submit handler) — user boleh menambah baris lalu tidak mengisinya, tidak masuk ke data tersimpan.
   - Mode tambah vs edit dibedakan state `editingRecipeId` (null = tambah).
4. **Popup Detail Resep** (`#recipeDetailModal`)
   - Header (ikon + nama + badge kategori), meta row (porsi & waktu masak), daftar bahan (`.ingredient-list`), langkah bernomor (`.step-list`, nomor dari CSS `counter()`), catatan (disembunyikan kalau kosong via `#detailNoteWrap.hidden`).
   - Tombol **Ubah** → tutup detail, buka `recipeModal` mode edit. Tombol **Hapus** → `openConfirm()` (dialog generik, lihat di bawah).
5. **Belanja** (`#shopping`)
   - Checklist bahan yang perlu dibeli. Tombol `+` di header (`#addShoppingBtn`, pakai `.icon-btn.accent`) → modal cepat (nama + jumlah opsional).
   - Klik lingkaran centang (`.shopping-check`) → toggle `done` (langsung tulis Firebase, tanpa konfirmasi — item belanja dianggap low-stakes). Item yang `done` pindah ke bawah list & nama dicoret.
   - Tombol 🗑️ per item → hapus langsung (tanpa konfirmasi, beda dari hapus resep/kategori yang pakai `openConfirm()` — disengaja karena item belanja gampang ditambah ulang).
   - **"Hapus yang sudah dicentang"** (`#clearDoneBtn`, hanya tampil kalau ada item `done`) → `clearDoneShopping()`, hapus semua item tercentang sekaligus.
6. **Pengaturan** (`#settings`)
   - Toggle tema light/dark (`#settingsThemeToggle`, sama fungsi `toggleTheme()` dengan tombol di header `#themeToggle`).
   - **Kategori Resep — CRUD** (`#categoriesBtn` → popup `#categoriesModal`): satu list flat (beda Finance App yang pisah expense/income), tiap baris (`.category-row`) tampil swatch warna + ikon + label + tombol ✏️/🗑️. Tombol **"+ Buat Kategori Baru"** (`.category-add-btn.btn-invert`) di bawah list.
     - **Create/Update**: modal `#categoryModal` (`openCategoryModal(cat)`, state `editingCategoryId`) — field Label & Icon (bebas, TIDAK dibatasi 1 grapheme via `Intl.Segmenter` seperti Finance App — kalau user masukkan emoji multi-code-unit atau lebih dari 1 karakter, tersimpan apa adanya), dan slot-picker warna 8 slot (`renderSlotPicker()`, klik lingkaran utk pilih, `chosenColorSlot` disimpan di closure state saat submit). Kategori baru: id dari `uniqueSlug(slugify(label))` (auto, tidak diisi manual — beda dari Finance App). Kategori edit: id dikunci (dari `editingCategoryId`).
     - **Delete**: `openConfirm()` generik, teks mengingatkan resep lama tetap tersimpan tapi tampil sebagai "Tanpa Kategori" (`FALLBACK_CATEGORY`).
   - Info "Tentang".
7. **Navigasi**: bottom nav — Dashboard, Resep, **[+]** (tambah resep, selalu tampil di semua halaman), Belanja, Pengaturan. Sama pola dgn Finance App (`goToPage()`), tanpa month-selector (kitchen tidak berkonsep "per bulan").
8. **Tema light/dark**: `data-theme` di `<html>`, variabel di `css/base.css`. Palet warna **oranye/cokelat** (nuansa dapur, beda dari teal Finance App) — primary `#ea580c` (light) / `#fb923c` (dark). Kategorikal 8-slot divalidasi lewat skill `dataviz` (lihat bagian "Struktur data" di atas untuk detail surface yang dipakai).
9. **Confirm dialog generik** (`#confirmModal`, `openConfirm(title, text, onConfirm)`): **lebih sederhana dari Finance App** — satu callback function (`pendingConfirmAction`), bukan beberapa variable `pendingDeleteTx`/`pendingDeletePlan`/`pendingDeleteCategory` terpisah. Dipakai untuk hapus resep & hapus kategori (bukan hapus item belanja, lihat poin 5).

## Model data internal (`script.js`, hasil rebuild dari Firebase)

```js
// recipes[] (item)
{ id, name, category, servings, time, ingredients: [{name, qty}], steps: [string], note, createdAt }

// categories[] (item) — flat, urut naik by colorSlot
{ id, label, icon, colorSlot }

// shopping[] (item)
{ id, name, qty, done: boolean, createdAt }
```

`id` semua entity = timestamp key di Firebase (recipes/shopping) atau slug (categories) — sama dgn `id` field di dalam node itu sendiri.

## Perbedaan sengaja dari Finance App (referensi arsitektur)

Karena user minta "tampilannya... bisa lihat di finance app" sebagai referensi menu, banyak pola dipakai ulang identik (app-shell, bottom-nav, modal bottom-sheet, confirm dialog, filter tabs, theme toggle). Tapi beberapa hal **sengaja disederhanakan** karena tidak relevan utk kasus kitchen:

- **Tidak ada multi-user** (Iyon/Ciwul/Both) — tidak ada field `by`, tidak ada `userSelectOverlay`.
- **Tidak ada konsep bulan/periode** — tidak ada `viewDate`, month-selector, atau filter tanggal.
- **Tidak ada migrasi data legacy** — project baru, jadi tidak ada fungsi `migrate*` seperti di Finance App.
- **Kategori flat, bukan expense/income** — dan id kategori auto-generate dari label, bukan diisi manual.
- **Confirm dialog pakai satu callback**, bukan banyak variable pending per jenis entity.
- **Belum ada export Excel** — kalau nanti ditambahkan, ikuti pola `generate-excel.js` Finance App (helper mandiri tanpa shared state, `window.KitchenExcel` misalnya).

## Rencana / TODO ke depan

- **Auth**: sama seperti Finance App, DB masih publik readable/writable tanpa proteksi.
- Rules Firebase console perlu ditambahkan entry `kitchen: { ".write": true }` kalau belum ada (cek kalau tulis data gagal diam-diam).
- Kemungkinan fitur lanjutan: agregasi otomatis "tambah semua bahan resep ini ke Daftar Belanja" (saat ini Belanja & Resep independen — user input manual), rencana masak mingguan/meal plan, foto resep, rating/favorit.
- Belum ada testing otomatis / build pipeline — project murni HTML/CSS/JS statis.

## Loading overlay

Sama pola dgn Finance App: `#loadingOverlay` (ikon 🍳🥕🍅 memantul, keyframe `coinBounce` di `css/base.css`) disembunyikan oleh `hideLoading()` saat snapshot Firebase pertama tiba atau saat error baca. **Beda dari Finance App**: belum ada fallback `setTimeout` — kalau koneksi Firebase gagal total tanpa memicu callback error, overlay bisa tersangkut terbuka selamanya. Pertimbangkan menambahkan fallback timeout kalau ini jadi masalah nyata di lapangan.

## Catatan implementasi

- Semua teks UI berbahasa Indonesia, konsisten dgn Finance App.
- Palet kategori (`--series-1..8`) divalidasi via skill `dataviz` (`node scripts/validate_palette.js ... --mode light --surface "#ffffff"` dan `--mode dark --surface "#241d17"`) — kalau surface warna berubah (`--color-surface` di `base.css`), validasi ulang sebelum menambah/mengubah slot warna.
- Icon kategori (emoji) & label **tidak divalidasi format-nya** saat CRUD kategori (beda dari Finance App yang membatasi icon 1 grapheme via `Intl.Segmenter`) — kalau ingin konsistensi visual lebih ketat di masa depan, tambahkan validasi serupa.
- Saat menambahkan fitur baru, ikuti pola yang sudah ada: render function terpisah per section (`renderDashboard`, `renderRecipeList`, `renderShoppingList`, `renderCategoriesModal`), dipanggil ulang dari `renderAll()` setiap kali snapshot Firebase berubah — jangan panggil render manual setelah operasi tulis (`addRecipe`, dll.), biarkan listener realtime yang memicu re-render.
- **Wajib**: setiap kali ada perubahan struktur/fitur di project ini (field baru di Firebase, halaman baru, komponen CSS baru, dll.), update dokumen ini (`.claude/CLAUDE.md`) di perubahan yang sama — jangan biarkan jadi dokumentasi basi. Konvensi ini berlaku di semua project dalam repo `iyonadryan.github.io`, bukan cuma Kitchen App.
