# Wishlist App

Aplikasi web untuk mencatat daftar keinginan (barang/hal yang ingin dimiliki/dicapai), dengan kategori, prioritas (Rendah/Sedang/Tinggi), deskripsi singkat, link referensi (mis. link produk), dan status "Sudah Didapat/Tercapai". Berfokus pada penggunaan **mobile** (dibuka dari HP), mobile-first, layout disimulasikan seperti layar HP (max-width 480px, centered).

## Status saat ini

Prototype pertama — dibangun mengikuti pola gabungan **Note App** (CRUD kategori, atribusi "Dibuat oleh" murni tanpa pengguna aktif, popup detail dgn tombol Tutup ganda) dan konsep prioritas enum tetap ala **Routine App**. Data langsung terhubung ke **Firebase Realtime Database** sejak awal (bukan mock data).

Dibangun lewat `AskUserQuestion` dua kali sebelum kode ditulis: (1) apakah item wishlist perlu status "Sudah Didapat" atau daftar polos → **dipilih ada status**, (2) awalnya juga sempat ditanya soal multi-user Iyon/Ciwul/Both device-scoped ala Routine/Finance App → **dipilih itu**, lalu **dibalik lagi** oleh user tidak lama setelah dibangun ("gak perlu ada user aktif, tapi pas create wishlist ada by iyon/ciwul, mirip kayak Note App") — jadi app ini **sempat py, lalu dilepas lagi**, seluruh mekanisme `currentUser`/`#userSelectOverlay`/`#userSwitchModal`/header user icon/scoping `visibleItems()` dihapus total, diganti pola atribusi murni Note App. Riwayat ini dicatat di sini krn kalau ada permintaan "tambah balik pengguna aktif" nanti, itu artinya balik ke arsitektur yang **sudah pernah dicoba & sengaja ditolak** — bukan fitur baru.

### Konfigurasi Firebase

- Memakai **project Firebase yang sama** dengan app lain (`iyon-adryanlf-trialerror`), path berbeda.
- SDK: **compat v8.10.1** (`firebase-app.js` + `firebase-database.js`), CDN gstatic. Config + `firebase.initializeApp` inline di `<head>` `index.html`, expose global `db` dan konstanta `WISHLIST_PATH = "wishlist"`.
- Path data app ini: **`wishlist/...`** (top-level, sejajar `kitchen`/`finance`/`routine`/`patungan`/`note`). Ini path **Firebase**, independen dari struktur folder lokal (lihat catatan struktur folder di `app/.claude/CLAUDE.md`).
- Rules Firebase dikelola di console yang sama — node `wishlist` perlu `.write: true` di rules kalau belum ada. **Belum ada auth** — seluruh isi DB berpotensi terbaca/tertulis publik, sama seperti app lain.

### Struktur data di Firebase

```
wishlist/
  items/
    <timestamp>/                 # key = Date.now() saat input
      title:       "Sepatu lari baru"
      price:       0             # angka polos (Rupiah, tanpa desimal) — default 0, editable
      description: "Warna hitam, ukuran 42"  # opsional, boleh kosong ("")
      link:        "https://tokopedia.com/..." # opsional, boleh kosong ("")
      category:    "elektronik"    # id kategori, lihat categories/ di bawah
      priority:    "tinggi"        # "rendah" | "sedang" | "tinggi" — enum tetap
      achieved:    false           # true = sudah didapat/tercapai
      achievedAt:  null            # Date.now() saat ditandai; null saat belum/dibatalkan
      by:          "iyon"          # "iyon" | "ciwul" — dipilih manual tiap tambah/ubah,
                                     # lihat "Dibuat oleh"
      createdAt:   1719...
      updatedAt:   1719...          # berubah tiap edit konten, TIDAK berubah krn toggle
                                     # achieved — lihat toggleAchieved()
  categories/
    <id>/                        # id = slug dari label (slugify()), mis. "elektronik"
      id:        "elektronik"
      label:     "Elektronik"
      icon:      "📱"
      colorSlot: 1                # 1-8, dipetakan ke var(--series-1..8) di css/base.css
```

**Seed default 4 kategori** (`seedCategoriesIfEmpty()`, sama pola dgn Kitchen/Note App): Elektronik 📱, Fashion 👕, Hobi 🎨, Lainnya 📦. Kategori CRUD penuh dari Pengaturan (tambah/ubah/hapus, bebas bukan cuma 4 default ini).

**Kenapa `updatedAt` dipisah dari toggle `achieved`**: menandai "sudah didapat" bukan "mengedit isi wishlist", jadi tidak boleh bikin item itu melompat urutan krn perubahan status semata — pola identik dgn `toggleNotePinned()` Note App (pin juga tidak menyentuh `updatedAt`).

### Dibuat oleh (bukan multi-user) — pola identik Note App

- `USERS = { iyon, ciwul }` (tanpa `"both"`) **cuma dipakai utk lookup label/ikon badge "Dibuat oleh"** — **BUKAN** pengguna aktif device-level. App ini **tidak** men-scope tampilan per-user: semua item (siapa pun pembuatnya) selalu tampil ke siapa pun yang buka app, di semua halaman (Dashboard/Wishlist/Tercapai baca langsung dari `items[]` mentah, tidak ada fungsi `visibleItems()`).
- Field **Dibuat oleh** di modal Tambah/Ubah (`#wishlistByToggle`, toggle 2-tombol Iyon/Ciwul) **selalu tampil** (tidak `hidden`, tidak kondisional apa pun) — user pilih manual tiap kali tambah wishlist; default "Iyon". Saat **edit**, toggle **dikunci** ke `item.by` (`setByToggleValue(..., true)`) — pembuat tidak bisa diubah retroaktif.
- **Badge pembuat** (`.creator-badge`, absolute di pojok `.wishlist-icon`) **selalu tampil** di kartu list (beda dari desain multi-user sebelumnya yg cuma nongol pas mode Both) — krn atribusi sekarang selalu relevan ditampilkan, tidak ada mode lain. Klik badge → `openCreatorInfo()` (modal read-only "Dibuat oleh: `<nama>`").
- Meta **"Dibuat Oleh"** juga ditampilkan eksplisit sbg teks (bukan cuma badge foto) di popup detail — `#detailBy`, kolom ke-3 di `.detail-meta-row` (setelah Dibuat & Diubah Terakhir). Ini beda dari implementasi pertama app ini (yg sempat scoped, waktu itu sengaja TIDAK ada meta ini krn ikut pola Routine App) — sekarang ditambahkan supaya full-parity dgn Note App.
- **Tidak ada** (dan sudah dihapus total): overlay pilih pengguna pertama kali (`#userSelectOverlay`), `localStorage` key user (`wishlistapp_user` — cuma tersisa `wishlistapp_theme`), ikon pengguna aktif di header (`#headerUserIcon`), modal Ganti Pengguna (`#userSwitchModal`), row "Pengguna Aktif" di Pengaturan, fungsi `renderUserButtons()`/`updateActiveUserDesc()`/`updateByFieldVisibility()`/`setCurrentUser()`/`initUserSelect()`, dan CSS pendukungnya (`.user-select-overlay`/`.user-select-btn`/`.header-user-icon`/`.user-switch-btn` — semua dihapus dari `css/base.css`/`css/settings.css`).

### Prioritas (`priority`) — enum tetap, bukan kategori bikinan user

- Tiga nilai tetap `"rendah" | "sedang" | "tinggi"`, meta & bobot sortir di `PRIORITY_META`/`PRIORITY_WEIGHT` (`script.js`). Pola identik dgn `PERIOD_META` Routine App (periode harian/mingguan/bulanan) — sama-sama enum tetap, **BUKAN** divalidasi lewat skill `dataviz` (beda dari `--series-1..8` kategorikal kategori, yg memang divalidasi krn kategori bebas dibuat user).
- Warna fixed traffic-light: `--priority-tinggi` (merah), `--priority-sedang` (amber), `--priority-rendah` (hijau) — didefinisikan di `css/base.css`, dipakai di badge kartu/detail (`priorityChipStyle()`) dan toggle Prioritas di modal Tambah/Ubah (`.priority-toggle .mode-btn.active[data-priority="..."]` di `css/components.css`, tiap tombol berwarna sesuai prioritasnya sendiri saat aktif — beda dari toggle 2-tombol lain yg selalu warna primary generik).
- Default prioritas item baru: **"sedang"** (tombol tengah, netral — tidak terlalu urgent maupun terlalu santai).
- **Sorting default** halaman Wishlist (`sortByPriorityThenDate()`): prioritas Tinggi dulu, lalu terbaru — jadi wishlist penting selalu kelihatan duluan meski filter prioritas di-set "Semua". **Ada filter tab khusus prioritas** (`#wishlistPriorityFilterTabs`, lihat "Fitur yang sudah ada" poin 2) — beririsan dgn filter kategori & search.

### Cara kerja layer data (`script.js`)

- Satu listener realtime `wishlistRef.on("value", ...)` pada `db.ref("wishlist")` (`subscribeWishlist()`). Setiap perubahan → `seedCategoriesIfEmpty()` → `rebuildFromSnapshot()` → `renderAll()`. **Tidak ada fungsi migrasi backfill** (beda dari Note/Routine App yg punya `migrateNoteOwners()`/`migrateRoutineOwners()`) — krn app ini baru dibuat dari awal dgn field `by` sudah wajib ada sejak item pertama, tidak ada data lama tanpa field itu.
- **Gotcha: `rebuildFromSnapshot()` men-whitelist field secara eksplisit** — nge-`map()` tiap item mentah dari Firebase jadi objek baru dgn daftar field yg di-hardcode satu-satu (`title`, `price`, `description`, dst), **bukan** spread (`{ ...it }`) dari snapshot mentah. Konsekuensinya: field baru yg ditambahkan ke Firebase (mis. lewat `addWishlist`/`updateWishlist`) **tidak otomatis ikut terbaca** ke `items[]` internal kalau lupa ditambahkan jg ke whitelist ini — data-nya kesimpan benar di Firebase, tapi render selalu baca `undefined`/fallback default seolah-olah field-nya kosong. Ini persis bug yg pernah kejadian pas field `price` pertama ditambahkan (sempat ke-skip dari whitelist, akibatnya kartu & detail selalu nampilin "Rp 0" walau `price` sungguhan sudah tersimpan) — **kalau nambah field baru ke item wishlist, WAJIB tambahkan jg satu baris di `rebuildFromSnapshot()`**, jangan cuma di `addWishlist`/`updateWishlist`/form.
- `renderAll()` juga re-render **popup Detail Wishlist yang sedang terbuka** kalau ada (pola sama dgn Note App — reaktif thd perubahan dari device lain, mis. toggle achieved langsung update tampilan tanpa perlu tutup-buka ulang modal).
- Fungsi tulis: `addWishlist`/`updateWishlist` (set `updatedAt: Date.now()`, `createdAt` dipertahankan; `addWishlist` juga inisialisasi `achieved:false, achievedAt:null`)/`deleteWishlist`, `toggleAchieved(id, achieved)` (`.update()` langsung ke `achieved`+`achievedAt`, **tidak** menyentuh `updatedAt`), `saveCategory`/`deleteCategory` (sama persis pola Note/Kitchen App).
- `getCategory(id)` fallback ke `FALLBACK_CATEGORY` (`{ label: "Tanpa Kategori", icon: "📦", colorSlot: 8 }`) kalau item merujuk kategori yang sudah dihapus — sama pola Note/Kitchen App.
- `normalizeLink(url)`: link disimpan **apa adanya** (persis ketikan user), tapi kalau belum ada skema `http(s)://` di depannya, `href`-nya (bukan teks tampilannya) di-prefix `"https://"` biar link tetap bisa diklik walau user males ngetik protokolnya lengkap.
- `snippet(text)`: potong deskripsi jadi cuplikan ~70 karakter (whitespace dirapikan jadi satu spasi) utk ditampilkan di list — isi lengkap cuma muncul di popup detail.

## Struktur file

- `index.html` — struktur halaman (single-page, section di-toggle lewat JS via `goToPage()`).
- `css/` — mobile-first, CSS variables tema (light/dark):
  - `css/base.css` — variabel `:root`/`[data-theme="dark"]` (termasuk `--priority-tinggi/sedang/rendah` enum tetap warna prioritas, dan `--series-1..8` kategorikal — **divalidasi lewat skill `dataviz`** thd surface app ini sendiri, `#fff7fb` light / `#291a2b` dark; nilainya sama persis dgn default reference palette skill krn kedua surface itu cukup dekat luminance-nya dgn app lain shg lolos validasi tanpa perlu di-tune ulang — TETAP divalidasi ulang scr eksplisit lewat `validate_palette.js`, bukan asal-comot), reset global, loading overlay, app shell, header, page shell, section heading. **Tidak ada** `.user-select-overlay`/`.header-user-icon` (dihapus, lihat "Dibuat oleh").
  - `css/components.css` — tombol (termasuk `.btn-hub` gradient ungu hub, `.btn-invert`), filter tabs, bottom nav, modal/bottom-sheet + field form bersama (termasuk `.field[hidden] { display: none }`, gotcha yang sama dgn app lain), `.mode-toggle`/`.mode-btn` dipakai ulang utk toggle "Dibuat oleh" **dan** toggle "Prioritas" (`.priority-toggle`, warna per-tombol override khusus), confirm dialog generik (`.confirm-overlay`/`.confirm-dialog`), dan komponen CRUD kategori (`.slot-picker`, `.category-list`/`.category-row`/`.cat-btn` — disalin persis dari Note/Kitchen App krn fiturnya identik).
  - `css/dashboard.css` — hero stat card, `.wishlist-mini-list`, breakdown kategori (sama pola Note/Kitchen App).
  - `css/wishlist.css` — list & kartu wishlist (`.wishlist-item`, `.wishlist-badges` — **dua badge** kategori+prioritas ditumpuk vertikal di kartu, beda dari Note App yg cuma satu badge kategori; `.creator-badge` absolute di `.wishlist-icon`, **selalu tampil** — pola Note App), search box, popup detail (`.detail-achieved-note` pita hijau "Tercapai pada...", `.detail-link` link yg diklik buka tab baru, `.detail-badge-row` dua badge kategori+prioritas di header detail).
  - `css/settings.css` — list Pengaturan, ringkas (cuma toggle tema, CRUD kategori, Semua Aplikasi, Tentang; **tidak ada** `.user-switch-btn`, dihapus bareng fitur pengguna aktif — sama pola Note App).
- `script.js` — semua logic (state, render, event handler, layer data Firebase). Satu IIFE, vanilla JS, tanpa framework/build tool.
- **`img/` bukan folder sendiri di Wishlist App** — ikon `iyon.png`/`ciwul.png` ada di `app/img/`, direferensikan dari `script.js` sbg `../img/<nama>.png`. Lihat `app/.claude/CLAUDE.md` bagian "Sumber img/ dikonsolidasi".
- `app/.claude/wishlist-app.md` — file ini.

Belum ada build tool. Cukup buka `index.html` langsung di browser atau lewat live server.

**Dependensi eksternal:** hanya Firebase compat v8.10.1 (app+database) via CDN.

## Fitur yang sudah ada

1. **Dashboard** (`#dashboard`)
   - Hero card gradient fuchsia/magenta menampilkan 3 angka: **Aktif** (belum tercapai), **Kategori** (total kategori), **Tercapai** — **semuanya total keseluruhan**, tidak di-scope per pembuat (lihat "Dibuat oleh (bukan multi-user)").
   - **Wishlist Terbaru**: maks 4 item **aktif** (belum tercapai), diurut `updatedAt` terbaru dulu. Link "Lihat Semua" → halaman Wishlist.
   - **Breakdown kategori**: chip per kategori yang punya ≥1 item (aktif maupun tercapai) — kategori dengan 0 item disembunyikan dari breakdown, tapi tetap muncul sbg filter tab di halaman Wishlist.
2. **Wishlist** (`#wishlist`) — daftar & CRUD item **aktif** (belum tercapai — item tercapai pindah ke halaman Tercapai, lihat poin 4).
   - Search box (`#wishlistSearchInput`, cari substring di **judul maupun deskripsi**, case-insensitive, realtime tiap ketik).
   - **Dua baris filter tab, masing-masing berlabel** (`.filter-label`, teks kecil uppercase muted persis di atas baris tombolnya — beda dari app lain yg filter tab-nya tanpa label krn cuma py satu baris): "Kategori" di atas kategori (`#wishlistFilterTabs`, sama pola dgn Note/Kitchen App) **dan** "Prioritas" di atas prioritas (`#wishlistPriorityFilterTabs`, Semua/Rendah/Sedang/Tinggi — urutan naik, sama dgn toggle Prioritas di modal Tambah/Ubah) — kedua filter beririsan (AND) satu sama lain **dan** dgn search. Tab prioritas yg aktif berwarna sesuai prioritasnya sendiri (`.priority-filter-tabs .filter-tab.active[data-priority="..."]` di `components.css`, sama pola dgn `.priority-toggle`), bukan warna primary generik spt tab kategori/tab "Semua".
   - List item (`.wishlist-item`, klik kartu → popup detail; klik `.creator-badge` → info pembuat). Kartu **2 baris**: baris 1 judul, baris 2 (`.wishlist-subline`) **harga + cuplikan deskripsi** digabung `"<formatCurrency(item.price)> - <snippet(description)>"` (kalau deskripsi kosong, baris 2 cuma harga sendirian) — satu baris, dipotong `…` via CSS ellipsis kalau kepanjangan (lihat "Field Nominal/Harga (`price`)"). **Dua badge** (kategori + prioritas) ditumpuk di kanan, dan foto kecil pembuat di pojok ikon.
   - **Tambah/Ubah** (`#wishlistModal`, tombol **+ di tengah bottom nav** `#navAdd`, atau tombol "Ubah" di popup detail): judul, **nominal** (`#wishlistPriceInput`, label UI "Nominal (Rp)" — lihat "Field Nominal/Harga (`price`)" utk nama field Firebase-nya), kategori (`<select>` dinamis dari `categories[]`), **prioritas** (toggle 3-tombol Rendah/Sedang/Tinggi, default Sedang), deskripsi singkat (`<textarea>`, opsional — **bukan** editor layar penuh spt Note App krn memang didesain singkat, bukan konten panjang), link (opsional, `<input>` teks biasa bukan `type="url"` spy longgar), **Dibuat oleh** (toggle Iyon/Ciwul, **selalu tampil** — bukan kondisional — default "Iyon", dikunci saat edit).
3. **Popup Detail Wishlist** (`#wishlistDetailModal`)
   - Header (ikon kategori + judul + **harga** `#detailPrice` (`formatCurrency(item.price)`, teks bold warna `var(--color-primary)` persis di bawah judul, di atas baris badge) + **dua badge** kategori & prioritas), meta row **3 kolom**: tanggal Dibuat, Diubah Terakhir ("—" kalau belum pernah diedit sejak dibuat), dan **Dibuat Oleh** (nama pembuat, teks eksplisit — bukan cuma badge foto).
   - Pita hijau **"🎉 Tercapai pada `<tanggal>`"** (`#detailAchievedNote`) muncul kalau `item.achieved`.
   - Deskripsi (disembunyikan kalau kosong) dan Link (disembunyikan kalau kosong, link diklik buka tab baru `target="_blank" rel="noopener noreferrer"`, warna `var(--color-primary)` bold tanpa underline — pola sama dgn fix link Note App).
   - **Dua tombol Tutup** (pola persis Note App): `#closeWishlistDetailBtn` di `.detail-actions-row` dan `#detailCloseIconBtn` (✕ bulat pojok kanan-atas card, `.detail-close-btn`/`.detail-sheet`).
   - Tombol **🎁/✅ Toggle Sudah Didapat** (`#toggleAchievedBtn`, icon-btn, langsung tulis Firebase tanpa konfirmasi — low-stakes, gampang di-toggle balik, ikon & warna berubah sesuai status via class `.achieved`), **Ubah** (`.btn-invert`, pola warna dibalik: hitam/putih light, putih/hitam dark) → buka modal edit, **Hapus** → `openConfirm()`.
4. **Tercapai** (`#achieved`) — semua item `achieved === true`, diurut `achievedAt` terbaru. Halaman terpisah (bukan cuma filter) — riwayat wishlist yang sudah kesampaian, permintaan eksplisit user ("tetap tersimpan sbg riwayat, bukan langsung dihapus").
5. **Pengaturan** (`#settings`) — Mode Tampilan, **Kategori Wishlist — CRUD** (`#categoriesBtn` → `#categoriesModal`, identik pola Note/Kitchen App), Semua Aplikasi, Tentang. **Tidak ada row "Pengguna Aktif"** (dihapus, lihat "Dibuat oleh (bukan multi-user)").
6. **Navigasi**: bottom nav — Dashboard, Wishlist, **[+]** (tambah wishlist, selalu tampil), Tercapai, Pengaturan.
7. **Tema light/dark**: `data-theme` di `<html>`, variabel di `css/base.css`. Primary **fuchsia/magenta** (`#c026d3` light / `#e879f9` dark) — hue baru, belum dipakai app lain (beda dari oranye Kitchen, teal Finance, ungu-indigo Routine, rose Patungan, amber Note). Kategorikal 8-slot **divalidasi lewat skill `dataviz`** (lihat "Struktur file" → `base.css`); prioritas 3-slot fixed **tidak** divalidasi (enum tetap, sama alasan dgn periode Routine App).
8. **Confirm dialog generik** (`#confirmModal`, `openConfirm(title, text, onConfirm)`): satu callback, pola identik app lain. Dipakai hapus wishlist & hapus kategori (bukan toggle achieved, lihat poin 3).

### Field Nominal/Harga (`price`) — harga/estimasi biaya per item

- **Nama field Firebase-nya `price`** (bukan `nominal` — sempat dipakai sesaat pas fitur ini pertama dibuat, langsung diganti user krn `nominal` dianggap kurang pas; dipilih via `AskUserQuestion` dari beberapa opsi: `price`/`amount`/`estimatedPrice`/`cost` → **`price`** yg dipilih krn ini murni harga barang wishlist, bukan jumlah transaksi keluar-masuk uang spt `amount` Finance App). **Label UI tetap "Nominal (Rp)"** (teks Indonesia, tidak diminta ikut berubah) — jadi ada perbedaan sengaja antara nama field data (`price`, Inggris, konsisten dgn field lain kayak `title`/`category`) dan label yg dilihat user (Indonesia), bukan inkonsistensi yg kelewatan.
- Input teks `#wishlistPriceInput` (id JS juga ikut disamakan ke `price`, bukan `nominal`), **bukan** `type="number"` — sama pola dgn `amountInput` Finance App: `inputmode="numeric"`, diformat live pakai titik ribuan (`id-ID`) tiap ketik lewat `formatAmountInput()` (fungsi baru di `script.js`, disalin persis dari Finance App). Saat submit, titik ribuan dibuang lalu di-`parseFloat()` jadi angka polos sblm disimpan ke Firebase (`price: parseFloat(...replace(/\./g,""))`).
- **Default 0** — item baru dibuka dgn `#wishlistPriceInput` terisi `"0"` (bukan kosong), sesuai permintaan eksplisit user. Saat edit, terisi `Math.round(item.price||0).toLocaleString("id-ID")` (fallback 0 kalau item lama blm py field ini — **tidak ada migrasi backfill**, sama alasan dgn field `by`, lihat "Cara kerja layer data").
- **Editable penuh** — beda dari `by` (dikunci saat edit), harga bebas diubah kapan pun via form Ubah, tidak ada validasi minimum/maksimum.
- `formatCurrency(value)` (helper, `"Rp " + Math.round(value||0).toLocaleString("id-ID")`, disiapkan bareng `formatAmountInput()` di bagian Utilities) **dipakai di 2 tempat tampilan**: baris ke-2 kartu list (`.wishlist-subline`, digabung cuplikan deskripsi — lihat poin 2 "Fitur yang sudah ada") dan header popup detail (`#detailPrice`, lihat poin 3). **Belum** dipakai utk total estimasi budget di Dashboard — lihat TODO.
- **Visual harga dibedakan dari sisa teks di sekitarnya** — dibungkus `<span class="wishlist-price">` (tebal `font-weight:700` + warna `var(--color-primary)`, css/wishlist.css) di dalam `.wishlist-subline` kartu list, sementara sisa teks (deskripsi) tetap warna muted biasa. Popup detail (`#detailPrice`) pola serupa tapi sbg elemen `<p class="detail-price">` sendiri (bukan `<span>` nested), krn posisinya baris sendiri di bawah judul, bukan digabung sebaris dgn teks lain.

## Model data internal (`script.js`, hasil rebuild dari Firebase)

```js
// items[] (item)
{ id, title, price: number, description, link, category, priority: "rendah"|"sedang"|"tinggi",
  achieved: boolean, achievedAt, by: "iyon"|"ciwul", createdAt, updatedAt }

// categories[] (item) — flat, urut naik by colorSlot
{ id, label, icon, colorSlot }
```

## Perbedaan sengaja dari app lain (referensi arsitektur)

- **Atribusi tanpa multi-user** — sama persis pola Note App (lihat "Dibuat oleh (bukan multi-user)"), **beda dari Routine/Finance App** (device-level "pengguna aktif" yang men-scope tampilan) — dan beda dari versi *pertama* app Wishlist ini sendiri, yang sempat pakai pola multi-user sebelum diminta disederhanakan (lihat "Status saat ini").
- **Kategori CRUD (bukan enum tetap)** — sama persis pola Note/Kitchen App krn kategori wishlist memang perlu fleksibel/personal.
- **Dua dimensi klasifikasi per item** (kategori bebas + prioritas enum tetap) — beda dari app lain yg cuma satu dimensi (kategori Note/Kitchen, periode Routine).
- **Status "tercapai" sbg riwayat, bukan hapus** — mirip toggle pin Note App scr mekanisme (toggle low-stakes, tidak sentuh `updatedAt`), tapi beda tujuan: pin = "sematkan biar gampang diakses", achieved = "sudah tidak relevan lagi jadi wishlist aktif, tapi simpan sbg riwayat" — makanya py halaman terpisah (Tercapai) bukan cuma filter, sama alasan dgn halaman Tersemat Note App.

## Rencana / TODO ke depan

- **Auth**: sama seperti app lain, DB masih publik readable/writable tanpa proteksi. Rules Firebase console perlu ditambahkan entry `wishlist: { ".write": true }` kalau belum ada.
- Belum ada fallback `setTimeout` di loading overlay kalau koneksi Firebase gagal total (sama catatan dgn app lain).
- **Field `price` sudah tampil di kartu list & popup detail** (lihat "Field Nominal/Harga (`price`)") — yg belum: total estimasi budget di hero Dashboard (mis. total `price` semua item aktif).
- Kemungkinan fitur lanjutan lain: lampiran gambar produk, reminder tanggal target, arsip (beda dari hapus permanen untuk item tercapai lama).
- Belum ada testing otomatis / build pipeline — project murni HTML/CSS/JS statis.

## Catatan implementasi

- Semua teks UI berbahasa Indonesia, konsisten dgn app lain.
- Saat menambahkan fitur baru, ikuti pola yang sudah ada: render function terpisah per bagian (`renderDashboard`, `renderWishlistList`, `renderAchievedList`, dst.), dipanggil ulang dari `renderAll()` tiap snapshot Firebase berubah — jangan panggil render manual setelah operasi tulis, biarkan listener realtime yang memicu re-render.
- **Wajib**: setiap kali ada perubahan struktur/fitur di project ini, update dokumen ini (`app/.claude/wishlist-app.md`) di perubahan yang sama — berlaku di semua project dalam repo `iyonadryan.github.io`.
