# Patungan App

Aplikasi web untuk mencatat & membagi biaya nota/bill rame-rame (mis. lagi trip wisata) — supaya jelas siapa yang belum bayar atau utang ke siapa, tanpa perlu hitung manual. Berfokus pada penggunaan **mobile** (dibuka dari HP), mobile-first, layout disimulasikan seperti layar HP (max-width 480px, centered). Dibangun mengikuti pola/struktur **Kitchen/Finance/Routine App** sebagai referensi arsitektur (app-shell, bottom-nav, modal bottom-sheet, confirm dialog, theme toggle, layer data Firebase).

Nama "Patungan" dipilih user dari beberapa opsi (Split App, Urunan App, Nota App) — istilah sehari-hari yang paling nyambung sama konteks "urunan biaya bareng teman/keluarga pas lagi trip".

## Status saat ini

**Prototype v1** — fitur inti (trip, peserta, nota, ringkasan saldo & settlement) sudah jalan & terhubung ke **Firebase Realtime Database** sejak awal (pola sama dgn Kitchen/Routine App, bukan localStorage dulu baru dipindah). User bilang detail fitur lanjutan "menyusul" — jadi scope v1 ini hasil keputusan sendiri (bukan spek detail dari user), sengaja dijaga seminimal mungkin tapi tetap berguna: catat trip → catat siapa aja pesertanya → catat nota siapa bayar & dibagi ke siapa → lihat ringkasan siapa harus bayar ke siapa. Preferensi tema disimpan lokal (`localStorage`, key `patunganapp_theme`).

**Tidak ada konsep "pengguna aktif" (Iyon/Ciwul) seperti Finance/Routine App** — app ini secara alami sudah multi-orang lewat konsep **peserta per trip** (bebas siapa saja, bukan cuma 2 orang tetap), jadi tidak perlu device-level user switching. Siapa pun yang buka app bisa mengelola trip & nota siapa saja (belum ada proteksi akses).

### Konfigurasi Firebase

- Memakai **project Firebase yang sama** dengan Kitchen/Finance/Routine/24Card (`iyon-adryanlf-trialerror`), path berbeda.
- SDK: **compat v8.10.1** (`firebase-app.js` + `firebase-database.js`), CDN gstatic. Config + `firebase.initializeApp` inline di `<head>` `index.html`, expose global `db` dan konstanta `PATUNGAN_PATH = "patungan"`.
- Path data app ini: **`patungan/...`** (top-level, sejajar `kitchen`/`finance`/`routine`).
- Rules Firebase dikelola di console yang sama — node `patungan` perlu `.write: true` di rules kalau belum ada. **Belum ada auth** — seluruh isi DB berpotensi terbaca/tertulis publik, sama seperti app lain.

### Struktur data di Firebase

```
patungan/
  trips/
    <tripId>/                      # key = Date.now() saat input
      name:      "Liburan ke Bali"
      createdAt: 1719...
      participants/
        <participantId>/           # key = Date.now() saat input
          name:      "Iyon"
          createdAt: 1719...
      expenses/
        <expenseId>/                # key = Date.now() saat input
          description: "Makan malam"
          amount:      250000
          paidBy:      "<participantId>"       # siapa yang bayar duluan
          splitAmong:  ["<participantId>", ...] # dibagi rata ke siapa aja (bukan cuma nominal custom)
          createdAt:   1719...
```

**Nested per trip** (bukan node top-level `participants`/`expenses` terpisah) — sengaja begini supaya **hapus 1 trip = otomatis hapus semua peserta & nota di dalamnya** lewat satu `remove()`, tanpa perlu multi-path delete manual kayak `deleteRoutine()` Routine App yang harus hapus `completions/<id>` terpisah.

Split saat ini **selalu rata** antar peserta yang dicentang di `splitAmong` (`amount / splitAmong.length`) — **belum ada** split custom per-orang (mis. porsi tidak sama rata). Ini keputusan scope v1, lihat "Rencana ke depan".

### Cara kerja layer data (`script.js`)

- Satu listener realtime `patunganRef.on("value", ...)` pada `db.ref("patungan")` (`subscribePatungan()`). Setiap perubahan → `rebuildFromSnapshot()` membangun ulang `trips[]` (masing-masing berisi array `participants[]` & `expenses[]` nested) lalu `renderAll()`.
- `renderAll()` juga re-render **isi modal Detail Trip yang sedang terbuka** (`tripDetailModal`) kalau ada — beda dari app lain yang modal detailnya statis sampai ditutup manual, di sini sengaja reaktif krn peserta/nota bisa berubah dari perangkat lain saat modal masih terbuka (skenario realistis: 2 orang buka app bersamaan waktu lagi trip beneran).
- Fungsi tulis: `addTrip`/`updateTripName`/`deleteTrip` (delete cascade otomatis, lihat di atas), `addParticipant`/`deleteParticipant` (delete diblok kalau peserta itu masih dipakai di `paidBy` atau `splitAmong` nota manapun di trip itu — `alert()` minta hapus/ubah nota itu dulu, **bukan** auto-cleanup nota terkait), `addExpense`/`updateExpense` (pakai `.update()` bukan `.set()`, createdAt asli dipertahankan biar urutan list tidak lompat tiap diedit — beda dari `updateRoutine` Routine App yang perlu eksplisit reset field kosong, di sini semua field form selalu dikirim penuh tiap submit jadi aman)/`deleteExpense`.
- `calcBalances(trip)`: hitung saldo net tiap peserta — tiap nota, yang `paidBy` dapat `+amount`, tiap peserta di `splitAmong` dapat `-amount/splitAmong.length`. Net akhir positif = harus **menerima** (nombokin duluan), negatif = harus **membayar** (masih nunggak).
- `simplifyDebts(balances)`: greedy debt-simplification (pola umum ala Splitwise) — urutkan kreditor & debitor terbesar, cocokkan berulang supaya jumlah transaksi settlement seminimal mungkin (bukan tiap orang bayar ke tiap orang, tapi disederhanakan).

## Struktur file

- `index.html` — struktur halaman (single-page, section di-toggle lewat JS via `goToPage()`, pola sama dgn app lain).
- `css/` — mobile-first, CSS variables tema (light/dark), dipecah per fitur:
  - `css/base.css` — variabel `:root`/`[data-theme="dark"]` (termasuk `--color-positive`/`--color-negative` utk saldo Ringkasan, dgn nama beda dari `--color-income`/`--color-expense` Finance App krn semantiknya beda — bukan pemasukan/pengeluaran tapi "harus terima"/"harus bayar"), reset global, loading overlay, app shell, header, page shell, section heading.
  - `css/components.css` — tombol (`.btn-*`, `.icon-btn*`), bottom nav, modal/bottom-sheet + field form bersama (termasuk `.field[hidden] { display: none }`, gotcha yang sama spt Routine App — wajib ada krn `.field` declare `display:block` eksplisit), confirm dialog generik. **Tidak ada filter-tabs** (tidak relevan, tidak ada konsep periode/kategori di app ini).
  - `css/dashboard.css` — hero stat card (`.stat-hero`), list trip mini di Dashboard.
  - `css/trips.css` — file terbesar: list & kartu trip, popup Detail Trip (chip peserta `.participant-chip`, list nota `.expense-item`), popup Ringkasan (`.balance-row`/`.settlement-row`), dan `.split-list`/`.split-row` (checkbox pilih siapa aja yang dibagi di modal Tambah/Ubah Nota).
  - `css/history.css` — halaman Riwayat (gabungan nota lintas trip, tiap item ada `.history-trip-badge` penunjuk asal trip-nya).
  - `css/settings.css` — list Pengaturan (paling ringkas — cuma toggle tema, link Semua Aplikasi, Tentang; **tidak ada** row "Pengguna Aktif" krn app ini tidak pakai konsep Iyon/Ciwul, lihat "Status saat ini").
- `script.js` — semua logic (state, render, event handler, layer data Firebase). Satu IIFE, vanilla JS, tanpa framework/build tool.
- `app/.claude/patungan-app.md` — file ini.

Belum ada build tool. Cukup buka `index.html` langsung di browser atau lewat live server.

**Dependensi eksternal:** hanya Firebase compat v8.10.1 (app+database) via CDN.

## Fitur yang sudah ada

1. **Dashboard** (`#dashboard`)
   - Hero card gradient rose/merah menampilkan 3 angka: total trip, total nota tercatat (lintas semua trip), total Rp tercatat (lintas semua trip).
   - **Trip Terbaru**: maks 4, diurut `createdAt` terbaru dulu. Link "Lihat Semua" → halaman Trip.
2. **Trip** (`#trips`) — daftar semua trip (`.trip-item`: nama, jumlah peserta & nota, total Rp trip itu). Klik kartu → buka popup **Detail Trip**. Tombol **+ di tengah bottom nav** (`#navAdd`) → modal Tambah Trip (cuma nama; peserta ditambahkan setelahnya di Detail Trip, bukan saat create trip — supaya alur tambah trip cepat/tidak berat).
3. **Detail Trip** (`#tripDetailModal`, modal bottom-sheet paling kompleks di app ini) — dibuka dari kartu trip manapun (Dashboard atau halaman Trip):
   - Header: nama trip + tombol ✏️ (ubah nama, reuse modal Tambah Trip) + 🗑️ (hapus trip, `openConfirm()` — teks mengingatkan semua peserta & nota ikut terhapus).
   - **Peserta**: chip list (`.participant-chip`, tiap chip ada tombol ✕ hapus) + input tambah cepat (nama + tombol "+ Tambah", submit jg via Enter). Nama peserta **tidak boleh duplikat** dalam satu trip (dicek case-insensitive, `alert()` kalau bentrok). **Hapus peserta diblok** kalau peserta itu masih jadi `paidBy` atau ada di `splitAmong` nota manapun di trip itu (`alert()` minta beresin nota itu dulu — bukan auto-hapus nota terkait atau fallback semacam "Peserta Terhapus").
   - **Pengeluaran (Nota)**: list nota (`.expense-item`: deskripsi, "Dibayar <nama> · dibagi N orang", jumlah). Tombol `+` (`.icon-btn.accent.small`, di baris label section) → modal Tambah Nota. Klik nota manapun → modal yang sama dalam mode edit (+ tombol Hapus muncul).
   - Tombol **"Lihat Ringkasan"** (full-width, di bawah) → buka popup Ringkasan.
4. **Modal Tambah/Ubah Nota** (`#expenseModal`): deskripsi, jumlah (Rp, diformat ribuan realtime saat mengetik — `formatAmountInput()`, pola identik Finance App), **Dibayar oleh** (`<select>` dari peserta trip aktif), **Dibagi ke** (checkbox multi-select dari peserta trip aktif, **default semua tercentang** — kasus paling umum "dibagi rata semua orang"). Submit **divalidasi** minimal 1 peserta dicentang di split. Kalau trip belum punya peserta sama sekali, tombol tambah nota diblok dgn `alert()` minta tambah peserta dulu.
5. **Ringkasan** (`#summaryModal`, dibuka dari Detail Trip):
   - **Saldo Peserta** (`.balance-row`): tiap peserta + saldo net (`calcBalances()`) — ijo `+Rp X` (harus menerima) / merah `-Rp X` (harus membayar) / tanpa warna kalau pas 0.
   - **Siapa Bayar ke Siapa** (`.settlement-row`): hasil `simplifyDebts()` — daftar "A → B: Rp X" yang sudah disederhanakan (bukan tiap orang ke tiap orang mentah-mentah). Kosong (tidak ada baris) → tampil empty-state "Semua sudah impas".
6. **Riwayat** (`#history`) — gabungan **semua nota lintas semua trip**, diurut `createdAt` terbaru, tiap item ada badge nama trip asalnya (`.history-trip-badge`) + siapa yang bayar. Berguna buat lihat cepat pengeluaran tanpa buka satu-satu trip.
7. **Pengaturan** (`#settings`) — toggle tema, link "Semua Aplikasi" → `../index.html`, info "Tentang". Paling ringkas dari semua app (tidak ada Pengguna Aktif, tidak ada kategori/export).
8. **Navigasi**: bottom nav — Dashboard, Trip, **[+]** (tambah trip, selalu tampil), Riwayat, Pengaturan.
9. **Tema light/dark**: `data-theme` di `<html>`, variabel di `css/base.css`. Primary **rose/merah muda** (`#e11d48` light / `#fb7185` dark) — beda dari oranye Kitchen, teal Finance, ungu-indigo Routine, ungu hub `app/index.html`. Warna saldo Ringkasan (`--color-positive`/`--color-negative`) pakai palet semantik sendiri (hijau/merah universal "untung/rugi"), independen dari primary brand — sama semangat dgn `--color-done` Kitchen/Routine App yang juga tidak ikut warna brand.
10. **Confirm dialog generik** (`#confirmModal`, `openConfirm(title, text, onConfirm)`): satu callback, pola identik app lain. Dipakai utk hapus trip & hapus peserta (bukan hapus nota, yang punya tombol Hapus sendiri di dalam modal edit-nya — beda pola dgn app lain krn nota adanya di dalam modal lain, bukan popup detail sendiri).

## Model data internal (`script.js`, hasil rebuild dari Firebase)

```js
// trips[] (item)
{
  id, name, createdAt,
  participants: [ { id, name, createdAt }, ... ],
  expenses: [ { id, description, amount, paidBy, splitAmong: string[], createdAt }, ... ],
}
```

Tidak ada node top-level terpisah utk `participants`/`expenses` — semuanya nested di dalam tiap item `trips[]`, hasil rebuild dari struktur Firebase yang juga nested (lihat "Struktur data di Firebase").

## Perbedaan sengaja dari app lain (referensi arsitektur)

- **Tidak ada multi-user Iyon/Ciwul** (beda dari Finance/Routine App) — "multi-orang"-nya app ini justru fitur intinya sendiri (peserta per trip, bebas siapa & berapa banyak), jadi konsep device-level user-switching tidak relevan/malah membingungkan di sini.
- **Delete trip cascade otomatis** (nested node) — beda dari Routine App yang harus hapus 2 path terpisah (`routines/<id>` + `completions/<id>`) krn strukturnya flat top-level.
- **Delete peserta diblok (bukan cascade / bukan fallback "Tanpa X")** kalau masih dipakai di nota — beda dari Kitchen App yang resep dgn kategori terhapus tetap tampil fallback "Tanpa Kategori". Di sini tidak ada fallback yang masuk akal utk nota yang "pembayarnya sudah tidak ada".
- **Split selalu rata** (v1) — belum ada custom split per-orang kayak fitur "unequal split" di app split-bill beneran (Splitwise dkk).

## Rencana / TODO ke depan

Scope v1 ini sengaja minimal ("fitur detail menyusul" dari user) — kemungkinan lanjutan:
- **Split custom** (nominal beda-beda per peserta, bukan cuma rata), atau split by percentage/shares.
- **Auth / proteksi akses**: sama seperti app lain, DB masih publik readable/writable. Rules Firebase console perlu ditambahkan entry `patungan: { ".write": true }` kalau belum ada.
- **Multi-currency** kalau ada trip luar negeri (saat ini hardcode Rupiah, `formatCurrency()`/`toLocaleString("id-ID")`).
- **Tandai "sudah dibayar"** — saat ini Ringkasan cuma menghitung siapa-utang-siapa, belum ada cara mencatat kalau utang itu sudah benar-benar dilunasi (settlement cuma informasional, tidak ada state "lunas").
- **Foto nota** (upload gambar struk) — belum ada, cuma teks deskripsi + jumlah.
- Belum ada fallback `setTimeout` di loading overlay kalau koneksi Firebase gagal total (sama catatan dgn app lain).
- Belum ada testing otomatis / build pipeline — project murni HTML/CSS/JS statis.

## Catatan implementasi

- Semua teks UI berbahasa Indonesia, konsisten dgn app lain.
- Saat menambahkan fitur baru, ikuti pola yang sudah ada: render function terpisah per bagian (`renderDashboard`, `renderTripList`, `renderTripDetail`, `renderHistory`, `renderSummary`), dipanggil ulang dari `renderAll()` tiap snapshot Firebase berubah — jangan panggil render manual setelah operasi tulis, biarkan listener realtime yang memicu re-render.
- **Wajib**: setiap kali ada perubahan struktur/fitur di project ini, update dokumen ini (`app/.claude/patungan-app.md`) di perubahan yang sama — berlaku di semua project dalam repo `iyonadryan.github.io`.
