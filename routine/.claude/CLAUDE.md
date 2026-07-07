# Routine App

Aplikasi web untuk mencatat rutinitas/kebiasaan (harian, mingguan, bulanan) dan mengecek apakah sudah dilakukan pada periode berjalan — semacam habit tracker sederhana. Berfokus pada penggunaan **mobile** (dibuka dari HP), mobile-first, layout disimulasikan seperti layar HP (max-width 480px, centered). Dibangun mengikuti pola/struktur **Kitchen App** (`../kitchen`) sebagai referensi arsitektur (app-shell, bottom-nav, modal bottom-sheet, confirm dialog, theme toggle, layer data Firebase).

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
      name:      "Puasa Senin Kamis"
      period:    "harian" | "mingguan" | "bulanan"
      icon:      "🏃"            # emoji bebas, opsional — fallback ke ikon default periode (PERIOD_META) kalau kosong, TIDAK disimpan otomatis saat create
      days:      [1, 4]           # array angka 0-6 (0=Minggu … 6=Sabtu, konvensi Date.getDay())
                                   # HANYA relevan kalau period === "harian":
                                   #   [] = mode "Tiap Hari" (aktif tiap hari)
                                   #   non-kosong = mode "Hari Tertentu" (cuma aktif di hari itu)
                                   # selalu [] utk mingguan/bulanan
      createdAt: 1719...
  completions/
    <routineId>/
      <periodKey>: true          # ada key = sudah dicek utk instance periode itu; dihapus (bukan false) kalau di-uncheck
```

**`periodKey` tergantung `period` rutinitas** (lihat `periodKeyFor()` di `script.js`):
- `harian` → tanggal lokal hari ini `"YYYY-MM-DD"` (reset tiap hari, berlaku sama baik mode "Tiap Hari" maupun "Hari Tertentu" — yang membedakan cuma **kapan rutinitas itu ditampilkan** di Cek, lihat `isRoutineActiveToday()`).
- `mingguan` → tanggal Senin dari minggu berjalan `"YYYY-MM-DD"` (`startOfWeek()`, konvensi Senin–Minggu — **sama persis dengan Finance App** punya rencana anggaran mingguan).
- `bulanan` → `"YYYY-MM"`.

Tidak ada skema "kategori" bikinan user seperti Kitchen — `period` adalah **enum tetap 3 nilai** (bukan data dinamis), jadi tidak ada CRUD kategori/`categories` node. Fleksibilitas "hari tertentu" ada di dalam periode `harian` lewat field `days`, bukan lewat periode terpisah.

### Cara kerja layer data (`script.js`)

- Satu listener realtime `routineRef.on("value", ...)` pada `db.ref("routine")` (`subscribeRoutine()`). Setiap perubahan → `rebuildFromSnapshot()` membangun ulang `routines[]` dan `completions{}` (object mentah, bukan array — dibaca langsung by id+periodKey) lalu `renderAll()` — tidak ada render manual setelah operasi tulis.
- Fungsi tulis: `addRoutine`/`updateRoutine`/`deleteRoutine` (delete juga menghapus `completions/<id>` sekaligus lewat satu `update()` multi-path — riwayat cek rutinitas yang sudah dihapus ikut dibersihkan, TIDAK dipertahankan), `toggleCompletion(routineId, periodKey, done)` (`.set(true)` kalau dicek, `.set(null)` kalau di-uncheck — bukan `.set(false)`, supaya node kosong otomatis dibersihkan Firebase seperti pola hapus transaksi Finance App).
  - **Penting**: `updateRoutine` pakai `.update()` (merge, bukan overwrite penuh) — makanya `data.days` **selalu disertakan secara eksplisit** (walau `[]`) tiap submit form, supaya kalau user ganti periode dari "Harian + Hari Tertentu" ke "Mingguan"/"Bulanan" (atau balik ke "Tiap Hari"), field `days` lama ikut ditimpa bersih, bukan nyangkut jadi data basi krn `.update()` cuma menimpa key yang dikirim.
- `PERIOD_META` (konstanta, bukan dari Firebase) mendefinisikan label, ikon default, dan nama CSS var (`varName`) tiap periode — dipakai `periodChipStyle()`/`periodSwatchStyle()` (pola sama dgn `chipStyle()`/`swatchStyle()` Kitchen App, tapi sumber warnanya var periode tetap, bukan `colorSlot` kategori dinamis).
- `isDone(routine, now)`: cek `completions[routine.id][periodKeyFor(routine.period, now)]`.
- `isRoutineActiveToday(routine, now)`: `!routine.days.length || routine.days.includes(now.getDay())` — inti logika mode "Tiap Hari" vs "Hari Tertentu".
- `routinesForToday(now)`/`routinesForWeek()`/`routinesForMonth()`: filter rutinitas yang relevan ditampilkan di tiap grup halaman Cek (3 section — lihat bagian "Fitur"). `routinesForToday` sudah menggabungkan filter periode `harian` **dan** `isRoutineActiveToday`, jadi rutinitas "Hari Tertentu" otomatis hilang dari Cek di hari yang tidak dipilih.
- `routinePeriodLabel(routine, full)`: badge/label periode — kalau `harian` + `days` terisi, tampilkan nama hari-nya langsung (mis. "Sen, Kam", atau lengkap "Senin, Kamis" kalau `full=true`) alih-alih label generik "Harian", supaya lebih informatif sekilas lihat di list/detail.

## Struktur file

- `index.html` — struktur halaman (single-page, section di-toggle lewat JS via `goToPage()`, pola sama dgn Kitchen App).
- `css/` — mobile-first, CSS variables tema (light/dark), dipecah per fitur dari awal:
  - `css/base.css` — variabel `:root`/`[data-theme="dark"]` (termasuk `--gradient-card` hero card, `--period-mingguan`/`--period-bulanan` — **bukan** palet kategorikal `--series-N` yang perlu divalidasi dataviz, karena cuma 3 nilai enum tetap bukan kategori bikinan user), reset global, loading overlay, app shell, header, page shell, section heading.
  - `css/components.css` — tombol (`.btn-*`, `.icon-btn*`, termasuk `.settings-item a.btn-secondary` utk card "Semua Aplikasi"), bottom nav, filter tabs, modal/bottom-sheet + field form bersama (termasuk `.field[hidden] { display: none }` — **wajib ada** karena `.field { display: block }` sama spesifisitasnya dgn `[hidden]` bawaan browser dan menang krn author style; tanpa override ini, field yang di-toggle `el.hidden = true/false` via JS, mis. `#dailyModeField`/`#dailyDaysField`, tetap kelihatan walau `hidden`-nya `true`), confirm dialog generik. **Tidak ada** `.repeat-row`/slot-picker/category-row (tidak relevan, tidak ada kategori/bahan berulang di app ini).
  - `css/dashboard.css` — hero stat card (`.stat-hero`), breakdown chip per periode (`.category-breakdown`/`.breakdown-chip`, nama class dipertahankan sama dgn Kitchen App biar konsisten lintas app walau isinya breakdown periode bukan kategori).
  - `css/routines.css` — list & kartu rutinitas, popup detail (termasuk `.detail-section-label`/`.detail-note` utk blok "Hari Aktif", dipinjam pola persis dari `recipes.css` Kitchen App), warna tab per periode (`.tab-mingguan`/`.tab-bulanan` — tab `harian` reuse `.filter-tab.active` bawaan/`--color-primary`), **dan form mode Harian** (`.mode-toggle`/`.mode-btn` utk toggle "Tiap Hari"/"Hari Tertentu", `.day-picker`/`.day-chip` utk pemilih hari multi-select).
  - `css/check.css` — halaman Cek Rutinitas (`.check-item`/`.check-mark`, versi routine dari `.shopping-item`/`.shopping-check` Kitchen App — beda nama class krn semantiknya "sudah dilakukan" bukan "sudah dibeli").
  - `css/settings.css` — list Pengaturan (paling ringkas dari semua app — cuma toggle tema + link Semua Aplikasi + Tentang, tidak ada CRUD kategori/export).
- `script.js` — semua logic (state, render, event handler, layer data Firebase). Satu IIFE, vanilla JS, tanpa framework/build tool.
- `.claude/CLAUDE.md` — file ini.

Belum ada build tool. Cukup buka `index.html` langsung di browser atau lewat live server.

**Dependensi eksternal:** hanya Firebase compat v8.10.1 (app+database) via CDN.

## Fitur yang sudah ada

1. **Dashboard** (`#dashboard`)
   - Hero card gradient ungu-indigo menampilkan 3 angka: total rutinitas, **belum dilakukan hari ini** (`routinesForToday(now)` yang belum `isDone` — otomatis cuma menghitung rutinitas "Hari Tertentu" yang memang aktif hari itu), **belum dilakukan minggu ini** (rutinitas `mingguan` yang belum `isDone`) — pola sama dgn `statShoppingCount` Kitchen App (angka = "belum", bukan total).
   - **Rutinitas Terbaru**: maks 4, diurut `createdAt` terbaru dulu. Link "Lihat Semua" → halaman Rutinitas.
   - **Breakdown per periode**: chip per periode yang punya ≥1 rutinitas (periode kosong disembunyikan dari breakdown, tapi tetap muncul sbg tab filter di halaman Rutinitas). Breakdown ini per `period` (harian/mingguan/bulanan), **tidak** dipecah lagi per kombinasi hari — rutinitas "Tiap Hari" dan "Hari Tertentu" sama-sama masuk hitungan "Harian".
2. **Rutinitas** (`#routines`) — daftar & CRUD semua rutinitas.
   - **Filter tab periode** (`#routineFilterTabs`): Semua + 3 periode (Harian/Mingguan/Bulanan), tiap tab non-harian diberi warna sendiri (lihat `routines.css`). **Tidak ada search box** (beda dari Kitchen Resep) — disengaja, daftar rutinitas biasanya jauh lebih pendek dari daftar resep.
   - List rutinitas (`.routine-item`, klik kartu → buka popup detail). Badge periode pakai `routinePeriodLabel()` — utk rutinitas harian "Hari Tertentu" langsung tampil nama harinya (mis. "Sen, Kam"), bukan cuma "Harian" generik.
   - **Tambah/Ubah** (`#routineModal`, tombol **+ di tengah bottom nav** `#navAdd`, atau tombol "Ubah" di popup detail):
     - Form: nama, periode (`<select>` 3 opsi: Harian/Mingguan/Bulanan), icon (opsional, placeholder emoji — kalau dikosongkan, render fallback ke ikon default periode, **tidak** ditulis balik ke Firebase).
     - **Kalau periode = Harian**, muncul field tambahan (`updatePeriodFieldsVisibility()` toggle `hidden` berdasar `<select>` periode):
       - **Mode Harian** (`#dailyModeToggle`, dua tombol `.mode-btn`): **"Tiap Hari"** (default, `days: []`) atau **"Hari Tertentu"**.
       - **Pilih Hari** (`#dailyDaysPicker`, cuma tampil kalau mode = "Hari Tertentu"): 7 chip hari (`.day-chip`, klik utk toggle pilih/batal, bisa pilih lebih dari satu — mis. "Puasa Senin Kamis" → pilih Sen + Kam, "Gym Jumat–Minggu" → pilih Jum + Sab + Min). Submit **divalidasi** minimal 1 hari terpilih kalau mode "Hari Tertentu" (`alert()` + submit dibatalkan kalau kosong).
     - State UI (`currentDailyMode`, `selectedDays`) **tidak** disimpan langsung ke Firebase sbg field terpisah — cuma dipakai utk membangun `data.days` saat submit, dan disimpulkan balik dari `routine.days.length` saat modal dibuka utk edit (`days.length ? "tertentu" : "setiap"`).
   - **Popup Detail** (`#routineDetailModal`): ikon + nama + badge periode (`routinePeriodLabel()`), meta "Dibuat Sejak" (`createdAt` diformat panjang), **dan blok "Hari Aktif"** (`#detailDaysWrap`, cuma tampil kalau `period === "harian"` — isi "Setiap hari" kalau `days` kosong, atau nama hari lengkap dipisah koma kalau terisi, mis. "Senin, Kamis"). Tombol **Ubah** → buka modal edit. Tombol **Hapus** → `openConfirm()` (dialog generik, sama pola Kitchen App) — teks konfirmasi mengingatkan riwayat cek ikut terhapus.
3. **Cek Rutinitas** (`#check`) — checklist "sudah dilakukan atau belum" utk periode yang sedang berjalan, dibagi 3 grup section (masing-masing render function sendiri, dipanggil dari `renderCheckLists()`):
   - **Hari Ini** (`#checkToday`): rutinitas `harian` yang **aktif hari ini** — `routinesForToday(now)` (mode "Tiap Hari" selalu masuk; mode "Hari Tertentu" cuma masuk kalau `now.getDay()` ada di `days`-nya). Rutinitas "Hari Tertentu" yang tidak aktif hari ini **tidak muncul sama sekali** di section ini (bukan tampil abu-abu/disabled), supaya list-nya selalu relevan sama hari itu.
   - **Minggu Ini** (`#checkWeek`): rutinitas `mingguan` — `routinesForWeek()`.
   - **Bulan Ini** (`#checkMonth`): rutinitas `bulanan` — `routinesForMonth()`.
   - Tiap section: item yang sudah dicek pindah ke bawah & nama dicoret (pola sama dgn Belanja Kitchen App), klik area manapun di item (bukan cuma lingkaran centang) → toggle `completions/<id>/<periodKey>` langsung tulis Firebase, **tanpa konfirmasi** (low-stakes, gampang di-uncheck lagi).
   - **Tidak ada tombol hapus di sini** — hapus rutinitas cuma lewat halaman Rutinitas (pemisahan tanggung jawab: Rutinitas = CRUD, Cek = tracking harian).
4. **Pengaturan** (`#settings`)
   - Toggle tema light/dark.
   - **Semua Aplikasi** — `.settings-item` berisi `<a class="btn-secondary">Iyon App</a>` → `../app.html` (hub Iyon App), pola identik dgn Kitchen/Finance App.
   - Info "Tentang".
5. **Navigasi**: bottom nav — Dashboard, Rutinitas, **[+]** (tambah rutinitas, selalu tampil), Cek, Pengaturan. Pola sama dgn Kitchen App (`goToPage()`).
6. **Tema light/dark**: `data-theme` di `<html>`, variabel di `css/base.css`. Primary **ungu-indigo** (`#516395` light / `#8b9ee0` dark, gradient dgn `--color-primary-dark` `#614385` light / `#7c5cad` dark) — terinspirasi gradient tombol dari referensi eksternal (gradientbuttons.colorion.co, stop `#614385`→`#516395`→`#614385`), dipetakan ke slot `--gradient-start/mid/end` yang sudah ada (start & end = warna sama di `primary-dark`, mid = `primary`, persis pola 0%/51%/100% referensinya). Beda dari oranye Kitchen, teal Finance, ungu-lebih-terang hub `app.html`. Checkmark "selesai" (`--color-done`) **tetap hijau universal**, independen dari warna brand, sama pola dgn `--color-done` Kitchen App. **Tidak divalidasi lewat skill `dataviz`** (beda dari `--series-N` Kitchen/Finance) karena warna periode adalah 3 nilai tetap yang dipilih manual, bukan palet kategorikal terbuka.
7. **Confirm dialog generik** (`#confirmModal`, `openConfirm(title, text, onConfirm)`): satu callback (`pendingConfirmAction`), sama pola dgn Kitchen App. Cuma dipakai utk hapus rutinitas (bukan toggle cek, lihat poin 3).

## Model data internal (`script.js`, hasil rebuild dari Firebase)

```js
// routines[] (item)
{ id, name, period: "harian"|"mingguan"|"bulanan", icon, days: number[], createdAt }
// days: 0-6 (0=Minggu … 6=Sabtu), cuma bermakna kalau period === "harian".
// [] = "Tiap Hari", non-kosong = "Hari Tertentu" (hari-hari itu saja).

// completions — OBJECT mentah (bukan array), langsung dari Firebase, tidak di-rebuild jadi array
{ [routineId]: { [periodKey]: true } }
```

## Perbedaan sengaja dari Kitchen App (referensi arsitektur)

- **Tidak ada kategori bikinan user** — `period` adalah enum tetap 3 nilai, jadi tidak ada `categories` node, tidak ada CRUD kategori, tidak ada `colorSlot`/slot-picker/`dataviz` validation. Fleksibilitas "kapan aktif" untuk periode `harian` ditangani lewat field `days` (multi-select hari), bukan lewat menambah periode baru.
- **Tidak ada search box** di halaman Rutinitas (beda dari Resep) — daftar rutinitas biasanya pendek.
- **Delete rutinitas menghapus riwayat cek sekaligus** (`completions/<id>`) — beda dari Kitchen yang resep lama tetap tersimpan dgn fallback "Tanpa Kategori" saat kategorinya dihapus; di sini tidak ada padanan fallback yang masuk akal utk completion tanpa rutinitas induk.
- **Konsep "periode" (harian/mingguan/bulanan) diambil dari Finance App** (rencana anggaran) — termasuk konvensi minggu Senin–Minggu (`startOfWeek()`) utk periode `mingguan`. **Beda dari Finance App**: Finance App punya periode `weekday`/`weekend` terpisah (tetap, tidak fleksibel); Routine App awalnya juga meniru pola itu tapi **diganti** jadi field `days` yang lebih fleksibel di dalam periode `harian` (bisa kombinasi hari apa saja, bukan cuma dua kelompok tetap Senin–Jumat / Sabtu–Minggu) — keputusan final setelah dicoba dulu versi weekday/weekend, dirasa kurang fleksibel utk kasus seperti "Puasa Senin Kamis".

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
