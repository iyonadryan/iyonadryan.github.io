# Undangan Pernikahan Digital

Website undangan pernikahan digital utk mobile — single-page, mobile-first, HTML/CSS/JS vanilla tanpa build tool, dgn 1 bagian (RSVP & Ucapan) terhubung **Firebase Realtime Database** (lihat "RSVP & Ucapan"). Beda dari `app/` (aplikasi "beneran" dipakai sehari-hari, banyak halaman, semuanya terhubung Firebase) dan `tool/` (utilitas bantu berdiri sendiri, murni client-side tanpa data tersimpan) — folder ini kategori keempat di root repo: **microsite acara** sekali-pakai utk satu event pernikahan spesifik, kontennya sudah diisi data asli (bukan lagi template generik), dan cuma sebagian kecil (bukan seluruh app) yg butuh persistensi data.

## Status saat ini

Prototype pertama dibuat lewat permintaan terbuka ("desain modern minimalis ala tren undangan digital 2026, animasinya menarik, saya mau lihat initnya dulu") — dibangun langsung dgn data placeholder, lalu diiterasi bertahap oleh user:

1. Palet warna awal: ivory/cream + sage + gold + terracotta.
2. User kasih referensi gambar (mockup undangan bertema floral pink+hijau eucalyptus, tombol olive-green, nama mempelai script hijau tua) → palet diganti total mengikuti itu (lihat "Palet Warna").
3. Nama mempelai diisi data asli: **Adryan Luthfi Faiz** & **Suci Wulandari**, lalu detail orang tua & IG asli menyusul.
4. Galeri diisi 6 foto prewedding asli dari `gallery/` (awalnya placeholder kotak abu-abu).
5. Tanggal & jam akad diperbarui ke data asli: **Minggu, 2 Agustus 2026**, Akad 09.00 WIB.
6. Foto profil bulat kedua mempelai (`.couple-photo`) **sengaja masih placeholder** ("Foto Pria"/"Foto Wanita") — user eksplisit minta dibiarkan placeholder dulu, belum ada foto individual yg mau dipasang di situ (beda dari galeri yg sudah diisi foto asli).
7. RSVP & Ucapan disambungkan ke **Firebase Realtime Database** (path `undangan/rsvp`) — awalnya cuma demo client-side (hilang kalau refresh), sekarang submit beneran tersimpan & tersinkron realtime ke semua yg buka halaman (lihat "RSVP & Ucapan").
8. Ditambah **panel admin terpisah** (`rsvp.html`) utk memantau semua data RSVP yg masuk — view-only, realtime, blm ada proteksi login (lihat "Panel Admin").
9. Panel admin dikasih **gerbang PIN 6-digit** (`190723`) + lockout 1 menit stlh 3x salah — lihat "Proteksi PIN".

## Struktur file

```
undangan/
  index.html      # halaman undangan tamu: cover, 8 section utama, lightbox galeri
  style.css        # semua styling halaman undangan (token warna di :root, animasi, responsive)
  script.js        # logic halaman undangan (vanilla JS, tanpa framework)
  rsvp.html        # panel admin — lihat semua data RSVP/ucapan yg masuk (lihat "Panel Admin")
  rsvp.css         # styling khusus panel admin (reuse token dari style.css)
  rsvp.js          # logic panel admin
  gallery/         # 6 foto prewedding asli (dipakai di section Galeri)
    0K0A3202-Edit.jpg, 0K0A3216-Edit.jpg, 0K0A3227-Edit.jpg,
    MONO0889-Edit.jpg, MONO0896-Edit.jpg, MONO0902-Edit.jpg
  .claude/
    CLAUDE.md       # file ini
```

Tidak ada folder `.claude/` terpisah lagi di dalamnya — sama seperti `app/`/`tool/`, ini folder tunggal dgn 1 dokumen.

## Alur halaman

1. **Cover/gate** (`#cover`) — layar penuh 100vh: eyebrow "THE WEDDING OF", monogram cincin "A & S", nama besar bergaya script "Adryan & Suci", tanggal, sapaan tamu, tombol "Buka Undangan". Ada kelopak bunga jatuh halus (`.petal`, dibuat via JS `coverPetals`) dan reveal stagger masuk (`.reveal-in`, delay dihitung dari `data-delay` di `script.js`).
2. **Klik "Buka Undangan"** → `.cover.closing` (fade+scale out via `@keyframes cover-out`) → setelah 850ms, `cover.hidden=true`, `invite.hidden=false`, scroll ke atas, mulai `initScrollReveal()` (IntersectionObserver utk animasi fade-up tiap section saat discroll), dan audio latar dicoba diputar (`bgm.play()`, lihat "Musik Latar").
3. **Isi undangan** (`<main id="invite">`), scroll panjang berurutan: Kutipan pembuka → Kedua Mempelai → Countdown (Save the Date) → Rangkaian Acara (Akad & Resepsi) → Galeri → RSVP & Ucapan → Amplop Digital → Penutup.
4. **Tombol musik mengambang** (`.music-toggle`, kanan-bawah di layar sempit) — ikon disc berputar (`.disc`, `animation-play-state` toggle) saat lagu diputar.

## Palet Warna

Ganti total dari draf pertama (ivory/gold/terracotta) mengikuti referensi gambar yg dikasih user (floral pink+eucalyptus, tombol olive). Token di `:root` (`style.css`):

| Variable | Hex | Dipakai utk |
|---|---|---|
| `--ivory` | `#F8FBF6` | bg utama section |
| `--cream` | `#EEF4EA` | bg section selang-seling |
| `--ink` | `#33402F` | teks body/paragraf |
| `--muted` | `#74847E` | label/eyebrow/teks sekunder (abu-hijau sejuk) |
| `--sage` | `#7C9473` | ikon daun, link IG, ampersand, label kecil |
| `--forest` | `#35492E` | **nama mempelai (script)**, heading section, angka countdown |
| `--olive` | `#7E8C3F` | **tombol CTA solid/outline** (Buka Undangan, Kirim Ucapan, Salin Nomor) |
| `--blush` | `#D98A96` | aksen dekoratif hangat (tanda kutip, label "Akad Nikah"/"Resepsi", status ucapan) |
| `--line` | `#D9CFC0` | garis pembatas tipis, border monogram/countdown |

**Prinsip pembagian warna**: label/teks sekunder = abu (`--muted`), judul & nama = hijau forest (`--forest`), tombol = olive (`--olive`), aksen dekoratif hangat = blush pink (`--blush`), ikon/link ringan = sage (`--sage`). Jangan campur — mis. jangan pakai `--forest` utk tombol (itu peran `--olive`), krn user membedakan keduanya scr eksplisit dari referensi gambar (nama = hijau lebih biru/tua, tombol = hijau lebih kuning/olive).

Tidak ada dark/light mode toggle — genre undangan digital selalu 1 tema tetap (bukan utility app), beda dari konvensi `app/`/`tool/`.

## Data acara

- **Tanggal**: Minggu, 2 Agustus 2026 (hari sengaja dikoreksi ke "Minggu" — dicek manual via `Date.prototype.toLocaleDateString('id-ID',{weekday:'long'})`, krn tanggal itu memang jatuh hari Minggu, bukan Sabtu spt asumsi awal placeholder).
- **Akad Nikah**: 09.00 — 10.30 WIB, di kediaman mempelai wanita (alamat placeholder, blm data asli).
- **Resepsi**: 11.00 — 14.00 WIB, Graha Kirana Ballroom (alamat placeholder, blm data asli).
- Tombol "Lihat Lokasi" tiap acara → link Google Maps search query (`https://maps.google.com/?q=...`), **bukan** embed peta — cukup buka tab baru.

### Countdown & Add to Calendar (`script.js`)

- Countdown (`cdDays/cdHours/cdMinutes/cdSeconds`) target `new Date('2026-08-02T09:00:00+07:00')` — **patokan waktu akad mulai**, bukan resepsi. Update tiap detik, ada efek "tick" (scale pulse) di angka detik.
- Tombol "+ Tambah ke Kalender" generate link Google Calendar (`calendar.google.com/calendar/render?action=TEMPLATE`), rentang waktu event **UTC** `20260802T020000Z` — `20260802T070000Z` (= 09.00–14.00 WIB, mencakup Akad s/d selesai Resepsi; WIB = UTC+7, jadi kurangi 7 jam dari waktu lokal saat ubah ke Z). **Kalau tanggal/jam acara berubah lagi, WAJIB update 3 tempat sekaligus**: `cover-date` + `event-datetime` (index.html, ada 2 — Akad & Resepsi), `target` countdown, dan `start`/`end` calendar (script.js) — tidak otomatis saling sinkron, semua hardcoded literal.

## Galeri & Lightbox

- 6 foto asli di `gallery/*.jpg`, ditampilkan grid 3 kolom (`.gallery-grid`, `aspect-ratio:1/1`, `object-fit:cover`).
- Tiap foto dibungkus `<button class="gallery-item">` (bukan `<div>`) supaya bisa diklik & accessible (fokus keyboard). Klik → `#lightbox` overlay fullscreen (`script.js`, IIFE "GALLERY LIGHTBOX"): set `src`/`alt` dari `<img>` yg diklik, toggle class `.open`. Tutup lewat tombol ✕, klik area gelap di luar gambar, atau tombol **Esc**.
- Foto profil bulat mempelai (`.couple-photo`, section "Kedua Mempelai") **beda dari galeri** — itu masih placeholder teks ("Foto Pria"/"Foto Wanita"), **sengaja belum diisi** foto asli (lihat "Status saat ini" poin 6).

## RSVP & Ucapan (Firebase)

Satu-satunya bagian di `undangan/` yg terhubung ke **Firebase Realtime Database** — sisanya (galeri, countdown, amplop digital, dst.) tetap murni statis/client-side.

### Konfigurasi Firebase

- Memakai **project Firebase yang sama** dgn semua app di `app/` (`iyon-adryanlf-trialerror`), path berbeda. SDK compat v8.10.1 (`firebase-app.js` + `firebase-database.js`), CDN gstatic — config + `firebase.initializeApp` inline di `<head>` `index.html` (disalin persis dari pola `app/wishlist/index.html`), expose global `db` dan konstanta `UNDANGAN_PATH = "undangan"`.
- Path data: **`undangan/rsvp/...`** (top-level, sejajar `wishlist`/`kitchen`/`finance`/dst di Realtime Database — path Firebase independen dari struktur folder lokal). **Tidak ada auth** — sama spt app lain, node ini berpotensi terbaca/tertulis publik; perlu entry `undangan: { ".write": true }` di rules Firebase console kalau belum ada.

### Struktur data

```
undangan/
  rsvp/
    <timestamp>/          # key = Date.now() saat submit
      name:       "Nama Tamu"
      attendance: "hadir"        # "hadir" | "ragu" | "tidak"
      message:    "Ucapan & doa..."
      createdAt:  1719...
```

### Cara kerja (`script.js`)

- `rsvpRef = db.ref(UNDANGAN_PATH + "/rsvp")`, listener realtime `rsvpRef.on("value", ...)` dipasang sekali di awal (bukan cuma stlh submit) — jadi ucapan dari **siapa pun yg pernah mengisi, di device mana pun**, langsung tampil ke semua orang yg buka halaman (bukan cuma riwayat sesi sendiri spt versi awal yg client-side-only).
- `renderWishList(wishesObj)`: ubah objek snapshot jadi array, urut `createdAt` terbaru dulu (`sort` descending), render semua jadi `.wish-card`. Kalau kosong (blm ada ucapan sama sekali) → tampil `.wish-empty` ("Jadilah yang pertama…") drpd list kosong tanpa keterangan.
- Submit form → `rsvpRef.child(String(Date.now())).set({...})` (pola key sama dgn `wishlist/items/<timestamp>` di Wishlist App), **bukan** manipulasi DOM langsung — render selalu lewat listener `on("value")` yg otomatis ke-trigger stlh write sukses (konsisten dgn prinsip "jangan render manual stlh operasi tulis" yg dipakai semua app di `app/`).
- Tombol submit di-`disabled` selama proses tulis berlangsung (dicegah double-submit), dinyalakan lagi di `.then()` baik sukses maupun gagal. Toast sukses "Terima kasih atas ucapannya!" atau gagal "Gagal mengirim, cek koneksi internet" (`showToast()`).
- **Tidak ada migrasi/backfill** — path ini baru dibuat dari awal langsung dgn skema di atas, tidak ada data lama berformat beda.

## Panel Admin (`rsvp.html`)

Halaman terpisah dari undangan tamu, khusus **melihat semua data RSVP/ucapan yg masuk ke `undangan/rsvp`** — file sendiri (`rsvp.html`/`rsvp.css`/`rsvp.js`), bukan bagian dari `index.html`. Diakses lewat URL langsung (`undangan/rsvp.html`), ada tombol "←" kembali ke `index.html`.

- **View-only** — cuma utk memantau, **tidak ada fitur hapus/edit data** dari panel ini (blm diminta; kalau nanti dibutuhkan, lihat TODO).
- **4 stat tile** di atas: Total, Hadir, Ragu, Tidak Hadir — dihitung ulang tiap kali data Firebase berubah (`renderStats()`), bukan cuma sekali saat load.
- **4 filter tab** (Semua/Hadir/Masih Ragu/Tidak Hadir, `#adminFilterTabs`) — filter cuma mempengaruhi list card di bawah, **tidak** mempengaruhi angka di stat tile (stat tile selalu total keseluruhan, independen dari filter aktif).
- List card (`.admin-card`) tampil nama, badge status kehadiran berwarna (hijau/kuning/merah muda sesuai status), isi ucapan, dan waktu submit (`formatDateTime()`, format "12 Jul 2026, 16:57"), diurut terbaru dulu.
- **Realtime** — pakai listener `rsvpRef.on("value", ...)` yg sama persis dgn `index.html` (path & struktur data identik), jadi begitu ada tamu isi RSVP dari HP-nya, panel admin yg lagi kebuka di device lain **langsung ikut update tanpa refresh** (sudah diverifikasi: submit dari `index.html` di 1 tab, terlihat muncul otomatis di `rsvp.html` yg kebuka di tab lain).
- CSS-nya (`rsvp.css`) **reuse token warna & font dari `style.css`** (keduanya di-`<link>` bareng di `<head>` `rsvp.html`) drpd duplikat `:root` — `rsvp.css` cuma nambah layout khusus dashboard (stat tile, filter tab, list card) yg tidak ada di `style.css`.
### Proteksi PIN (`#pinGate`)

Halaman ini **dikunci PIN 6-digit** (`190723`, hardcoded literal di `rsvp.js`) sblm konten dashboard dirender — bukan keamanan sungguhan (PIN kebaca siapa pun yg buka devtools/lihat source `rsvp.js`), cuma penghalang kasual thd orang yg kebetulan tahu/nebak URL `rsvp.html`.

- **UI**: 6 kotak input digit (`.pin-box`, `type="password"` jadi dot tersamar), auto-advance ke kotak berikutnya tiap isi 1 digit, auto-cek begitu 6 kotak penuh (**tidak perlu tombol submit**), Backspace di kotak kosong mundur ke kotak sebelumnya.
- **Lockout**: salah 3x berturut-turut → terkunci **1 menit**, kotak input di-`disabled`, tampil countdown mundur ("Terlalu banyak percobaan. Coba lagi dalam 0:47.") yg update tiap detik. Setelah countdown habis, otomatis kebuka lagi (attempts di-reset ke 0).
- **State lockout persisten** di `localStorage` (key `undangan_rsvp_pin_state`, `{attempts, lockUntil}`) — **reload halaman selagi masih terkunci TIDAK mereset penguncian** (sudah diverifikasi via test: reload saat lockout tetap nunjukin countdown yg sama, bukan kotak kosong siap coba lagi).
- **Sesi tetap kebuka** stlh PIN benar — disimpan di `sessionStorage` (key `undangan_rsvp_unlocked`, bukan `localStorage`) supaya reload/navigasi dlm 1 sesi tab yg sama tidak perlu masukin PIN ulang, tapi **tutup tab/browser → terkunci lagi** stlh dibuka baru (beda dari lockout yg persisten lewat `localStorage`).
- Dashboard (listener Firebase `rsvpRef.on("value",...)` + wiring filter tab) **baru di-inisialisasi via `initDashboard()` stlh PIN benar** — sebelum itu `#rsvpAdmin` tetap `hidden` & tidak ada request Firebase apa pun yg jalan (`dashboardStarted` flag mencegah `initDashboard()` dipanggil dobel).
- **Kalau PIN perlu diganti**: cuma 1 tempat — konstanta `PIN` di awal IIFE "PIN GATE" (`rsvp.js`).

## Amplop Digital

Kartu bank (`.gift-card`) tiap punya tombol "Salin Nomor" (`.copy-btn`, `data-copy="<nomor tanpa spasi>"`) → `copyText()` di `script.js`: coba `navigator.clipboard.writeText()`, fallback ke `textarea`+`execCommand('copy')` kalau gagal (pola sama persis dgn tool lain di `tool/`), feedback via toast kecil bawah layar. Nomor rekening & nama pemilik **masih placeholder**, blm data asli.

## Musik Latar

`<audio id="bgm" loop preload="none">` **tanpa `src`** (blm ada file audio asli disiapkan) — tombol `.music-toggle` tetap berfungsi scr visual (toggle class `.playing`, ikon disc berputar) walau `bgm.play()` gagal diam-diam (`.catch(()=>{})`) krn tidak ada sumber suara. Begitu ada file lagu asli, tinggal isi `src="nama-file.mp3"` di `<audio>`, tidak perlu ubah JS sama sekali.

## Gotcha: `[hidden]` vs `display:flex`

`.cover{ display:flex; ... }` (utk centering konten) **menang atas** attribute `hidden` bawaan browser (`[hidden]{display:none}`) krn spesifisitas CSS sama (class selector vs attribute selector, keduanya (0,1,0)) dan aturan `.cover` di stylesheet penulis datang setelah UA stylesheet default — akibatnya cover tidak benar-benar hilang stlh "Buka Undangan" diklik, cuma numpuk di atas/mendorong section berikutnya turun 100vh. **Sudah diperbaiki** dgn `[hidden]{ display:none !important; }` di baris awal `style.css`. Ini bug berulang yg sama persis pernah kejadian di `tool/generate-sql-query/` — **kalau bikin file HTML/CSS baru lain di repo ini yg pakai kombinasi `hidden` attribute + elemen ber-`display:flex/grid` eksplisit, selalu tambahkan rule `[hidden]{display:none!important}` di awal**, jangan asumsikan `hidden` otomatis menang.

## Placeholder yang masih tersisa

- Foto profil bulat kedua mempelai (`.couple-photo`) — sengaja dibiarkan, lihat "Status saat ini".
- Alamat lengkap Akad (`Jl. Kenanga No. 12, Bandung`) & Resepsi (`Jl. Riau No. 45, Bandung`), termasuk link Google Maps query-nya.
- Nomor rekening & nama pemilik di Amplop Digital.
- File audio latar (`#bgm` blm ada `src`).

## Rencana / TODO ke depan

- Isi placeholder yg tersisa di atas begitu user kasih datanya.
- **Auth Firebase**: sama spt app lain, path `undangan` di Realtime Database masih publik readable/writable tanpa proteksi rules — perlu ditambah rules kalau mau dibatasi (mis. rate-limit submit, validasi field wajib ada). **Beda dari** proteksi PIN `rsvp.html` (lihat "Proteksi PIN") — PIN cuma ngunci tampilan UI-nya, data mentahnya di Firebase tetap bisa diakses langsung via REST API/devtools oleh siapa pun yg tau `databaseURL` (sama kayak semua app lain di repo ini), PIN bukan pengganti Firebase rules.
- Panel admin blm ada fitur hapus/edit data (view-only, lihat "Panel Admin") — tambahkan kalau user minta, pola tombol hapus + `openConfirm()` sudah ada presedennya di app lain (`app/wishlist`, dst).
- Belum ada moderasi ucapan (semua submit langsung tampil ke publik tanpa direview) — kalau nanti butuh, bisa tambah field `approved:boolean` + filter di `renderWishList()`/`renderList()`.
- Belum terhubung dari portfolio utama (`index.html` root) maupun hub app/tool manapun — berdiri sendiri, diakses langsung via URL `/undangan/` atau `/undangan/index.html`.
- Belum ada testing otomatis/build pipeline — murni HTML/CSS/JS statis, testing manual/Playwright ad-hoc tiap ada perubahan.

## Catatan implementasi

- Semua teks UI berbahasa Indonesia.
- **Wajib**: setiap kali ada perubahan struktur/fitur/konten signifikan di folder ini (section baru, data acara berubah, foto/audio asli dipasang, dst.), update dokumen ini (`undangan/.claude/CLAUDE.md`) di perubahan yang sama — pola sama persis dgn kewajiban update CLAUDE.md di `app/` dan `tool/`.
