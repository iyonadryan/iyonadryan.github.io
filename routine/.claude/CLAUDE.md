# Routine App

Aplikasi web untuk mencatat rutinitas/kebiasaan (harian, mingguan, bulanan, weekday, weekend) dan mengecek apakah sudah dilakukan pada periode berjalan — semacam habit tracker sederhana. Berfokus pada penggunaan **mobile** (dibuka dari HP), mobile-first, layout disimulasikan seperti layar HP (max-width 480px, centered). Dibangun mengikuti pola/struktur **Kitchen App** (`../kitchen`) sebagai referensi arsitektur (app-shell, bottom-nav, modal bottom-sheet, confirm dialog, theme toggle, layer data Firebase).

## Status saat ini

Prototype pertama — UI/UX sudah jadi dan data langsung terhubung ke **Firebase Realtime Database** (bukan localStorage dulu baru dipindah, sama seperti Kitchen App). Tidak ada multi-user. Preferensi tema disimpan lokal (`localStorage`, key `routineapp_theme`).

### Konfigurasi Firebase

- Memakai **project Firebase yang sama** dengan Kitchen/Finance/24Card (`iyon-adryanlf-trialerror`), path berbeda.
- SDK: **compat v8.10.1** (`firebase-app.js` + `firebase-database.js`), CDN gstatic. Config + `firebase.initializeApp` inline di `<head>` `index.html`, expose global `db` dan konstanta `ROUTINE_PATH = "routine"`.
- Path data app ini: **`routine/...`** (top-level, sejajar `kitchen`/`finance`/`trial-error`).
- Rules Firebase dikelola di console yang sama — node `routine` perlu `.write: true` di rules kalau belum ada (cek console kalau tulis-baca gagal). **Belum ada auth** — seluruh isi DB berpotensi terbaca publik, sama seperti Kitchen/Finance.

### Struktur data di Firebase

```
routine/
  routines/
    <timestamp>/                 # key = Date.now() saat input
      name:      "Olahraga"
      period:    "harian" | "mingguan" | "bulanan" | "weekday" | "weekend"
      icon:      "🏃"            # emoji bebas, opsional — fallback ke ikon default periode (PERIOD_META) kalau kosong, TIDAK disimpan otomatis saat create
      createdAt: 1719...
  completions/
    <routineId>/
      <periodKey>: true          # ada key = sudah dicek utk instance periode itu; dihapus (bukan false) kalau di-uncheck
```

**`periodKey` tergantung `period` rutinitas** (lihat `periodKeyFor()` di `script.js`):
- `harian` / `weekday` / `weekend` → tanggal lokal hari ini `"YYYY-MM-DD"` (reset tiap hari; weekday/weekend cuma "aktif"/tampil di Cek kalau harinya cocok, tapi key-nya tetap harian).
- `mingguan` → tanggal Senin dari minggu berjalan `"YYYY-MM-DD"` (`startOfWeek()`, konvensi Senin–Minggu — **sama persis dengan Finance App** punya rencana anggaran mingguan).
- `bulanan` → `"YYYY-MM"`.

Tidak ada skema "kategori" bikinan user seperti Kitchen — `period` adalah **enum tetap 5 nilai** (bukan data dinamis), jadi tidak ada CRUD kategori/`categories` node.

### Cara kerja layer data (`script.js`)

- Satu listener realtime `routineRef.on("value", ...)` pada `db.ref("routine")` (`subscribeRoutine()`). Setiap perubahan → `rebuildFromSnapshot()` membangun ulang `routines[]` dan `completions{}` (object mentah, bukan array — dibaca langsung by id+periodKey) lalu `renderAll()` — tidak ada render manual setelah operasi tulis.
- Fungsi tulis: `addRoutine`/`updateRoutine`/`deleteRoutine` (delete juga menghapus `completions/<id>` sekaligus lewat satu `update()` multi-path — riwayat cek rutinitas yang sudah dihapus ikut dibersihkan, TIDAK dipertahankan), `toggleCompletion(routineId, periodKey, done)` (`.set(true)` kalau dicek, `.set(null)` kalau di-uncheck — bukan `.set(false)`, supaya node kosong otomatis dibersihkan Firebase seperti pola hapus transaksi Finance App).
- `PERIOD_META` (konstanta, bukan dari Firebase) mendefinisikan label, ikon default, dan nama CSS var (`varName`) tiap periode — dipakai `periodChipStyle()`/`periodSwatchStyle()` (pola sama dgn `chipStyle()`/`swatchStyle()` Kitchen App, tapi sumber warnanya var periode tetap, bukan `colorSlot` kategori dinamis).
- `isDone(routine, now)`: cek `completions[routine.id][periodKeyFor(routine.period, now)]`.
- `routinesForToday(now)`/`routinesForWeek()`/`routinesForMonth()`: filter rutinitas yang relevan ditampilkan di tiap grup halaman Cek (lihat bagian "Fitur").

## Struktur file

- `index.html` — struktur halaman (single-page, section di-toggle lewat JS via `goToPage()`, pola sama dgn Kitchen App).
- `css/` — mobile-first, CSS variables tema (light/dark), dipecah per fitur dari awal:
  - `css/base.css` — variabel `:root`/`[data-theme="dark"]` (termasuk `--gradient-card` hero card, `--period-mingguan/bulanan/weekday/weekend` — **bukan** palet kategorikal `--series-N` yang perlu divalidasi dataviz, karena cuma 5 nilai enum tetap bukan kategori bikinan user), reset global, loading overlay, app shell, header, page shell, section heading.
  - `css/components.css` — tombol (`.btn-*`, `.icon-btn*`, termasuk `.settings-item a.btn-secondary` utk card "Semua Aplikasi"), bottom nav, filter tabs (basis, tanpa scroll horizontal — beda dari Kitchen krn cuma 6 tab & sengaja wrap ke baris kedua), modal/bottom-sheet + field form bersama, confirm dialog generik. **Tidak ada** `.repeat-row`/slot-picker/category-row (tidak relevan, tidak ada kategori/bahan berulang di app ini).
  - `css/dashboard.css` — hero stat card (`.stat-hero`), breakdown chip per periode (`.category-breakdown`/`.breakdown-chip`, nama class dipertahankan sama dgn Kitchen App biar konsisten lintas app walau isinya breakdown periode bukan kategori).
  - `css/routines.css` — list & kartu rutinitas, popup detail, **dan warna tab per periode** (`.tab-mingguan`/`.tab-bulanan`/`.tab-weekday`/`.tab-weekend` — tab `harian` reuse `.filter-tab.active` bawaan/`--color-primary`). Warna weekday (indigo `#6366f1`) & weekend (oranye `#f97316`) sengaja **identik** dengan `.tab-weekday`/`.tab-weekend` Finance App supaya makna warna konsisten lintas app.
  - `css/check.css` — halaman Cek Rutinitas (`.check-item`/`.check-mark`, versi routine dari `.shopping-item`/`.shopping-check` Kitchen App — beda nama class krn semantiknya "sudah dilakukan" bukan "sudah dibeli").
  - `css/settings.css` — list Pengaturan (paling ringkas dari semua app — cuma toggle tema + link Semua Aplikasi + Tentang, tidak ada CRUD kategori/export).
- `script.js` — semua logic (state, render, event handler, layer data Firebase). Satu IIFE, vanilla JS, tanpa framework/build tool.
- `.claude/CLAUDE.md` — file ini.

Belum ada build tool. Cukup buka `index.html` langsung di browser atau lewat live server.

**Dependensi eksternal:** hanya Firebase compat v8.10.1 (app+database) via CDN.

## Fitur yang sudah ada

1. **Dashboard** (`#dashboard`)
   - Hero card gradient ungu-indigo menampilkan 3 angka: total rutinitas, **belum dilakukan hari ini** (`routinesForToday()` yang belum `isDone`), **belum dilakukan minggu ini** (rutinitas `mingguan` yang belum `isDone`) — pola sama dgn `statShoppingCount` Kitchen App (angka = "belum", bukan total).
   - **Rutinitas Terbaru**: maks 4, diurut `createdAt` terbaru dulu. Link "Lihat Semua" → halaman Rutinitas.
   - **Breakdown per periode**: chip per periode yang punya ≥1 rutinitas (periode kosong disembunyikan dari breakdown, tapi tetap muncul sbg tab filter di halaman Rutinitas).
2. **Rutinitas** (`#routines`) — daftar & CRUD semua rutinitas.
   - **Filter tab periode** (`#routineFilterTabs`): Semua + 5 periode, tiap tab diberi warna sendiri (lihat `routines.css`). **Tidak ada search box** (beda dari Kitchen Resep) — disengaja, daftar rutinitas biasanya jauh lebih pendek dari daftar resep, jadi belum perlu.
   - List rutinitas (`.routine-item`, klik kartu → buka popup detail).
   - **Tambah/Ubah** (`#routineModal`, tombol **+ di tengah bottom nav** `#navAdd`, atau tombol "Ubah" di popup detail): form nama, periode (`<select>` 5 opsi tetap), icon (opsional, placeholder emoji — kalau dikosongkan, render fallback ke ikon default periode, **tidak** ditulis balik ke Firebase).
   - **Popup Detail** (`#routineDetailModal`): ikon + nama + badge periode, tanggal "Dibuat Sejak" (`createdAt` diformat panjang). Tombol **Ubah** → buka modal edit. Tombol **Hapus** → `openConfirm()` (dialog generik, sama pola Kitchen App) — teks konfirmasi mengingatkan riwayat cek ikut terhapus (beda dari Kitchen yg resepnya cuma "tampil sbg Tanpa Kategori", di sini datanya benar-benar dihapus karena tidak ada fallback yang masuk akal utk completion tanpa rutinitas induknya).
3. **Cek Rutinitas** (`#check`) — checklist "sudah dilakukan atau belum" utk periode yang sedang berjalan, dibagi 3 grup section (masing-masing render function sendiri, dipanggil dari `renderCheckLists()`):
   - **Hari Ini** (`#checkToday`): rutinitas `harian` (selalu tampil) + `weekday` (kalau hari ini Senin–Jumat) + `weekend` (kalau Sabtu–Minggu) — `routinesForToday()`.
   - **Minggu Ini** (`#checkWeek`): rutinitas `mingguan` — `routinesForWeek()`.
   - **Bulan Ini** (`#checkMonth`): rutinitas `bulanan` — `routinesForMonth()`.
   - Tiap section: item yang sudah dicek pindah ke bawah & nama dicoret (pola sama dgn Belanja Kitchen App), klik area manapun di item (bukan cuma lingkaran centang) → toggle `completions/<id>/<periodKey>` langsung tulis Firebase, **tanpa konfirmasi** (low-stakes, gampang di-uncheck lagi).
   - **Tidak ada tombol hapus di sini** — hapus rutinitas cuma lewat halaman Rutinitas (pemisahan tanggung jawab: Rutinitas = CRUD, Cek = tracking harian).
4. **Pengaturan** (`#settings`)
   - Toggle tema light/dark.
   - **Semua Aplikasi** — `.settings-item` berisi `<a class="btn-secondary">Iyon App</a>` → `../app.html` (hub Iyon App), pola identik dgn Kitchen/Finance App.
   - Info "Tentang".
5. **Navigasi**: bottom nav — Dashboard, Rutinitas, **[+]** (tambah rutinitas, selalu tampil), Cek, Pengaturan. Pola sama dgn Kitchen App (`goToPage()`).
6. **Tema light/dark**: `data-theme` di `<html>`, variabel di `css/base.css`. Primary **ungu-indigo** (`#516395` light / `#8b9ee0` dark, gradient dgn `--color-primary-dark` `#614385` light / `#7c5cad` dark) — terinspirasi gradient tombol dari referensi eksternal (gradientbuttons.colorion.co, stop `#614385`→`#516395`→`#614385`), dipetakan ke slot `--gradient-start/mid/end` yang sudah ada (start & end = warna sama di `primary-dark`, mid = `primary`, persis pola 0%/51%/100% referensinya). **Awalnya hijau** (asosiasi "habit/growth") tapi diganti krn dirasa kurang bagus secara visual. Beda dari oranye Kitchen, teal Finance, ungu-lebih-terang hub `app.html`. Checkmark "selesai" (`--color-done`) **tetap hijau universal**, tidak ikut berubah — independen dari warna brand, sama pola dgn `--color-done` Kitchen App. **Tidak divalidasi lewat skill `dataviz`** (beda dari `--series-N` Kitchen/Finance) karena warna periode adalah 5 nilai tetap yang dipilih manual, bukan palet kategorikal terbuka.
7. **Confirm dialog generik** (`#confirmModal`, `openConfirm(title, text, onConfirm)`): satu callback (`pendingConfirmAction`), sama pola dgn Kitchen App. Cuma dipakai utk hapus rutinitas (bukan toggle cek, lihat poin 3).

## Model data internal (`script.js`, hasil rebuild dari Firebase)

```js
// routines[] (item)
{ id, name, period: "harian"|"mingguan"|"bulanan"|"weekday"|"weekend", icon, createdAt }

// completions — OBJECT mentah (bukan array), langsung dari Firebase, tidak di-rebuild jadi array
{ [routineId]: { [periodKey]: true } }
```

## Perbedaan sengaja dari Kitchen App (referensi arsitektur)

- **Tidak ada kategori bikinan user** — `period` adalah enum tetap 5 nilai, jadi tidak ada `categories` node, tidak ada CRUD kategori, tidak ada `colorSlot`/slot-picker/`dataviz` validation.
- **Tidak ada search box** di halaman Rutinitas (beda dari Resep) — daftar rutinitas biasanya pendek.
- **Delete rutinitas menghapus riwayat cek sekaligus** (`completions/<id>`) — beda dari Kitchen yang resep lama tetap tersimpan dgn fallback "Tanpa Kategori" saat kategorinya dihapus; di sini tidak ada padanan fallback yang masuk akal utk completion tanpa rutinitas induk.
- **Konsep "periode" (harian/mingguan/bulanan/weekday/weekend) diambil dari Finance App** (rencana anggaran), bukan dari Kitchen App — termasuk konvensi minggu Senin–Minggu (`startOfWeek()`) dan warna weekday/weekend (indigo/oranye) yang sengaja disamakan lintas app.

## Rencana / TODO ke depan

- **Auth**: sama seperti Kitchen/Finance, DB masih publik readable/writable tanpa proteksi.
- Rules Firebase console perlu ditambahkan entry `routine: { ".write": true }` kalau belum ada.
- Belum ada fallback `setTimeout` di loading overlay kalau koneksi Firebase gagal total (sama catatan dgn Kitchen App).
- Kemungkinan fitur lanjutan: streak/riwayat cek (saat ini cuma tahu status periode berjalan, riwayat periode-periode lama tidak ditampilkan di UI walau datanya tersimpan di `completions`), reminder/notifikasi, statistik konsistensi per rutinitas.
- Belum ada testing otomatis / build pipeline — project murni HTML/CSS/JS statis.

## Catatan implementasi

- Semua teks UI berbahasa Indonesia, konsisten dgn Kitchen & Finance App.
- Saat menambahkan fitur baru, ikuti pola yang sudah ada: render function terpisah per bagian (`renderDashboard`, `renderRoutineList`, `renderCheckLists`, dst.), dipanggil ulang dari `renderAll()` tiap snapshot Firebase berubah — jangan panggil render manual setelah operasi tulis, biarkan listener realtime yang memicu re-render.
- **Wajib**: setiap kali ada perubahan struktur/fitur di project ini, update dokumen ini (`.claude/CLAUDE.md`) di perubahan yang sama — berlaku di semua project dalam repo `iyonadryan.github.io`.
