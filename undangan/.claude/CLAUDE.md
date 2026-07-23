# Undangan Pernikahan Digital

Website undangan pernikahan digital utk mobile — single-page, mobile-first, HTML/CSS/JS vanilla tanpa build tool, dgn 1 bagian (RSVP & Ucapan) terhubung **Firebase Realtime Database** (lihat "RSVP & Ucapan"). Beda dari `app/` (aplikasi "beneran" dipakai sehari-hari, banyak halaman, semuanya terhubung Firebase) dan `tool/` (utilitas bantu berdiri sendiri, murni client-side tanpa data tersimpan) — folder ini kategori keempat di root repo: **microsite acara** sekali-pakai utk satu event pernikahan spesifik, kontennya sudah diisi data asli (bukan lagi template generik), dan cuma sebagian kecil (bukan seluruh app) yg butuh persistensi data.

## Status saat ini

Prototype pertama dibuat lewat permintaan terbuka ("desain modern minimalis ala tren undangan digital 2026, animasinya menarik, saya mau lihat initnya dulu") — dibangun langsung dgn data placeholder, lalu diiterasi bertahap oleh user:

1. Palet warna awal: ivory/cream + sage + gold + terracotta.
2. User kasih referensi gambar (mockup undangan bertema floral pink+hijau eucalyptus, tombol olive-green, nama mempelai script hijau tua) → palet diganti total mengikuti itu (lihat "Palet Warna").
3. Nama mempelai diisi data asli: **Adryan Luthfi Faiz** & **Suci Wulandari**, lalu detail orang tua & IG asli menyusul (link IG `<a href="#">` placeholder sempat lama gak diisi — SUDAH diisi link asli belakangan, lihat poin 16).
4. Galeri diisi 6 foto prewedding asli dari `gallery/` (awalnya placeholder kotak abu-abu).
5. Tanggal & jam akad diperbarui ke data asli: **Minggu, 2 Agustus 2026**, Akad 09.00 WIB.
6. Foto profil bulat kedua mempelai (`.couple-photo`) **sempat sengaja dibiarkan placeholder** ("Foto Pria"/"Foto Wanita") — user eksplisit minta dibiarkan placeholder dulu, belum ada foto individual yg mau dipasang di situ (beda dari galeri yg sudah diisi foto asli). **SUDAH DIISI** foto asli belakangan — lihat poin 15 & "Foto Profil Mempelai (`photo/`)".
7. RSVP & Ucapan disambungkan ke **Firebase Realtime Database** (path `undangan/rsvp`) — awalnya cuma demo client-side (hilang kalau refresh), sekarang submit beneran tersimpan & tersinkron realtime ke semua yg buka halaman (lihat "RSVP & Ucapan").
8. Ditambah **panel admin terpisah** (`rsvp.html`) utk memantau semua data RSVP yg masuk — view-only, realtime, blm ada proteksi login (lihat "Panel Admin").
9. Panel admin dikasih **gerbang PIN 6-digit** (`190723`) + lockout 1 menit stlh 3x salah — lihat "Proteksi PIN".
10. `index.html` (undangan tamu) diberi sentuhan **unsur adat Jawa & Padang** — motif kawung, siluet gonjong, bingkai songket — murni ornamental, lihat "Unsur Adat". `rsvp.html`/`rsvp.css` sengaja **tidak ikut diubah** (permintaan eksplisit "fokus di index.html").
11. Palet & motif kawung diganti lagi mengikuti referensi konkret tema "Adat Jawa" weddingbestie.id (screenshot + link dari user) — palet jadi sogan/blush/maroon/emas, motif kawung → belah-ketupat ramping, ditambah **2 ilustrasi bunga asli** (`asset/*.webp`) mengapit cover. Siluet gonjong (Padang) tetap dipertahankan. Lihat "Unsur Adat" bagian Tahap 2.
12. User nambah 8 aset baru (`asset/java-heritage-*.webp` + `JAWA-PATTERN.png`) & komplain background section2 setelah cover masih polos → semua aset dipasang menyebar di tiap section (bkn cuma cover), 1 aset (`java-heritage-PATTERN.webp`) dipakai sbg tekstur berulang di **semua** section. Nemu & benerin 1 bug stacking-context nyata (bkn cuma CSS bawaan browser) — lihat "Unsur Adat" bagian Tahap 3.
13. Sempat ada **2 varian desain alternatif** (`index2.html`+`style2.css`+`script2.js` bertema kawung, `index3.html`+`style3.css`+`script3.js` bertema leaf minimalis — dibuat sekali di awal utk dibandingkan, JS-nya SELALU byte-identik dgn `script.js`) — **SUDAH DIHAPUS** (permintaan eksplisit user: "yang dipake sekarang index.html") begitu `index.html` (varian adat Jawa+Padang penuh, lihat "Unsur Adat") ditetapkan sbg yg dipakai final. Semua fitur/perbaikan yg sblmnya diterapkan "ke-3 varian sekaligus" (Nama Tamu dari URL, Optimasi Galeri WebP, Kirim Kado Fisik, Musik Latar, dst — lihat section masing2) sekarang **cuma relevan utk `index.html`/`style.css`/`script.js`** — kalau baca riwayat perubahan lama di dokumen ini & ketemu "ke-3 file"/"index2.html"/"script3.js" dkk, itu peninggalan sblm penghapusan ini, sudah tidak berlaku lagi.
14. Ikon play/pause musik direvisi 2x lagi (lihat "Ikon Play/Pause Tombol Musik"): dari glyph teks Unicode (`▶︎`/`❚❚`) sempat py masalah ukuran gak konsisten & animasi putar dianggap kurang bagus → diganti bentuk CSS geometris murni (segitiga + 2 batang), STATIS tanpa animasi.
15. User nambah 2 foto asli baru ke folder baru `photo/` (`MONO0919-Edit.jpg` = mempelai pria, `MONO0927-Edit.jpg` = mempelai wanita) → di-duplikat jd WebP resolusi lebih kecil (pola sama persis dgn `gallery/`, lihat "Optimasi Galeri (WebP)"), lalu di-crop bagian wajah jd `photo/groom-face.webp` & `photo/bride-face.webp`, dipasang ke `.couple-photo` (`index.html`) gantiin placeholder "Foto Pria"/"Foto Wanita" dari poin 6 — lihat "Foto Profil Mempelai (`photo/`)".
16. Link IG di `.couple-social` (section "Kedua Mempelai") diisi data asli: `<a href="#">` placeholder → `https://www.instagram.com/iyonadryanlf/` (Adryan) & `https://www.instagram.com/wulanshii/` (Suci), keduanya ditambah `target="_blank" rel="noopener noreferrer"` spy kebuka tab baru (permintaan eksplisit user) drpd navigasi keluar dari halaman undangan di tab yg sama.
17. User nambah 2 logo bank resmi ke folder baru `logo/` (`logo-bank-bni.png`, `logo-bank-bca.png`) → di-trim+resize+konversi WebP (pola sama dgn foto lain di repo ini), dipasang di kartu "Amplop Digital" di bawah teks nama bank, di atas nomor rekening — lihat "Logo Bank".

## Struktur file

```
undangan/
  index.html      # halaman undangan tamu (SATU-SATUNYA varian yg dipakai — tema adat Jawa+Padang
                     # penuh, lihat "Unsur Adat"): cover, 8 section utama, lightbox galeri
  style.css        # semua styling index.html (token warna di :root, animasi, responsive)
  script.js        # logic index.html (vanilla JS, tanpa framework)
  rsvp.html        # panel admin — lihat semua data RSVP/ucapan yg masuk (lihat "Panel Admin")
  rsvp.css         # styling khusus panel admin (reuse token dari style.css)
  rsvp.js          # logic panel admin
  gallery/         # 6 foto prewedding asli (dipakai di section Galeri)
    0K0A3202-Edit.jpg, 0K0A3216-Edit.jpg, 0K0A3227-Edit.jpg,      # resolusi penuh, ARSIP —
    MONO0889-Edit.jpg, MONO0896-Edit.jpg, MONO0902-Edit.jpg       # tidak direferensikan HTML lagi
    0K0A3202-Edit.webp, 0K0A3216-Edit.webp, 0K0A3227-Edit.webp,   # dipakai situs (lihat
    MONO0889-Edit.webp, MONO0896-Edit.webp, MONO0902-Edit.webp   # "Optimasi Galeri (WebP)")
  photo/           # foto individual mempelai (lihat "Foto Profil Mempelai")
    MONO0919-Edit.jpg, MONO0919-Edit.webp   # mempelai pria — jpg ARSIP resolusi penuh, webp duplikat kecil
    MONO0927-Edit.jpg, MONO0927-Edit.webp   # mempelai wanita — sama pola dgn di atas
    groom-face.webp                          # crop wajah dari MONO0919, dipakai `.couple-photo` index.html
    bride-face.webp                          # crop wajah dari MONO0927, dipakai `.couple-photo` index.html
  logo/            # logo resmi bank, alpha transparan (lihat "Amplop Digital")
    logo-bank-bni.png, logo-bank-bni.webp   # png asli dari user (arsip) + webp ter-trim&resize dipakai situs
    logo-bank-bca.png, logo-bank-bca.webp   # sama pola dgn di atas
  asset/           # ilustrasi adat (webp, alpha transparan) tersebar di semua section — lihat "Unsur Adat"
    crescent-arch.webp, rose-spray.webp          # cover (Tahap 2)
    java-heritage-COUPLE-1.webp                    # section Mempelai (kiri-atas)
    java-heritage-COUPLE-2.webp                    # section Penutup (kiri-atas)
    java-heritage-COUPLE-3.webp                    # section Mempelai (kanan-bawah, mirror dari -1)
    java-heritage-COUPLE-4.webp                    # section Penutup (kanan-bawah, mirror dari -2)
    java-heritage-GUNUNGAN.webp                    # watermark section Kutipan Pembuka
    java-heritage-MOTIF-ATAS.webp                  # border atas section Countdown
    java-heritage-MOTIF-BAWAH.webp                 # border bawah section Amplop Digital
    java-heritage-PATTERN.webp                     # tekstur berulang di SEMUA section
    JAWA-PATTERN.png                               # TIDAK dipakai — duplikat PATTERN.webp, lihat Tahap 3
  music/           # musik latar (lihat "Musik Latar")
    Lagu Pernikahan Kita - Tiara Andini ft. Arsy Widianto (Piano Cover) with Lyrics by AnggelMel.mp3
  .claude/
    CLAUDE.md       # file ini
```

Tidak ada folder `.claude/` terpisah lagi di dalamnya — sama seperti `app/`/`tool/`, ini folder tunggal dgn 1 dokumen.

## Alur halaman

1. **Cover/gate** (`#cover`) — layar penuh 100vh: eyebrow "THE WEDDING OF", monogram cincin "A & S", nama besar bergaya script "Adryan & Suci", tanggal, sapaan tamu (`#guestName`, lihat "Nama Tamu dari URL" — bisa dipersonalisasi per-link), tombol "Buka Undangan". Ada kelopak bunga jatuh halus (`.petal`, dibuat via JS `coverPetals`) dan reveal stagger masuk (`.reveal-in`, delay dihitung dari `data-delay` di `script.js`).
2. **Klik "Buka Undangan"** → `.cover.closing` (fade+scale out via `@keyframes cover-out`) → setelah 850ms, `cover.hidden=true`, `invite.hidden=false`, scroll ke atas, mulai `initScrollReveal()` (IntersectionObserver utk animasi fade-up tiap section saat discroll), dan audio latar dicoba diputar (`bgm.play()`, lihat "Musik Latar").
3. **Isi undangan** (`<main id="invite">`), scroll panjang berurutan: Kutipan pembuka → Kedua Mempelai → Countdown (Save the Date) → Rangkaian Acara (Akad & Resepsi) → Galeri → RSVP & Ucapan → Amplop Digital → Penutup.
4. **Tombol musik mengambang** (`.music-toggle`, kanan-bawah di layar sempit) — ikon **▶︎/❚❚** teks (`.music-icon-play`/`.music-icon-pause`, gantiin SVG disc+dot lama yg dianggap kurang jelas, lihat "Musik Latar") yg BERPUTAR (`animation-play-state` toggle) saat lagu diputar.

## Nama Tamu dari URL (`?to=...`)

Permintaan eksplisit user — link undangan bisa dipersonalisasi per-tamu lewat query string, mis. `index.html?to=BapakHaji` bikin sapaan cover ("Kepada Yth. Bapak/Ibu/Saudara/i / **Bapak Haji**") ganti dari placeholder default "Tamu Undangan".

- **Nama parameter SUDAH DIGANTI dari `tamu` ke `to`** (permintaan eksplisit user susulan) — awalnya dipilih `tamu` (bukan `to`/`guest`/`nama`, sempat ditanyakan ke user sblm implementasi pertama) krn dianggap paling deskriptif & konsisten dgn teks UI situs ini yg berbahasa Indonesia, TAPI user belakangan minta ganti eksplisit ke `to` (lebih pendek/umum, pola link undangan digital kebanyakan mmg pakai `?to=`). Variable JS lokal di dalam IIFE (nama var `tamu`) SENGAJA TIDAK diganti sekalian jadi `to` — cuma key `URLSearchParams.get(...)` yg diganti, krn `to` bakal bentrok/rancu kalau dipakai jd nama variable (mirip keyword), `tamu` tetap valid & jelas maknanya sbg nama variable internal.
- **`script.js`**, blok `(function () { ... })()` di paling ATAS file, SEBELUM "STAGGERED REVEAL DELAYS":
  ```js
  var tamu = new URLSearchParams(window.location.search).get('to');
  if (!tamu) return;
  tamu = tamu.trim();
  if (!tamu) return;
  var guestNameEl = document.getElementById('guestName');
  if (guestNameEl) guestNameEl.textContent = tamu;
  ```
- **`<p class="guest-name">` dikasih `id="guestName"`** (`index.html`, sebelumnya cuma class tanpa id) — satu2nya perubahan HTML yg diperlukan.
- **`URLSearchParams` otomatis decode `+`/`%20` jadi spasi** — jadi `?to=Bapak+Haji+Slamet` ATAU `?to=Bapak%20Haji%20Slamet` sama2 tampil "Bapak Haji Slamet"; nama tanpa spasi apa adanya (`?to=BapakHaji`, sesuai contoh awal user) jg tetap valid, ditampilkan persis apa adanya TANPA usaha nebak-nebak pisahin kata (mis. tidak ada logic "sisipkan spasi sebelum huruf kapital" — sengaja dihindari krn bisa salah utk nama yg emang dimaksud 1 kata atau py huruf kapital di tengah scr wajar).
- **`textContent`, BUKAN `innerHTML`** — otomatis aman dari HTML injection walau isi param `to` sembarangan/jahat, tanpa perlu sanitasi manual tambahan.
- **Param kosong/tidak ada → placeholder default "Tamu Undangan" di HTML dipakai apa adanya** (function `return` lebih awal, tidak nyentuh `#guestName` sama sekali) — jadi link TANPA `?to=` tetap valid & aman dibagi scr umum (mis. di grup WhatsApp campuran).
- **Diuji eksplisit** (Playwright + Edge headless, kedua nama param `tamu` DAN `to` dites sblm & sesudah rename): tanpa param → placeholder tetap "Tamu Undangan"; `?to=BapakHaji` → berubah jadi "BapakHaji"; `?to=Bapak+Haji+Slamet` → jadi "Bapak Haji Slamet" (spasi ke-decode benar); `?to=` (kosong) → placeholder tetap tidak berubah; `?tamu=BapakHaji` (nama param LAMA) → TERBUKTI TIDAK LAGI berfungsi stlh rename (placeholder tetap "Tamu Undangan", spt yg diharapkan — link lama yg py `?tamu=` bakal berhenti personalisasi kalau masih beredar, WAJIB kasih tau user kalau ada link `?tamu=` yg sudah disebar sblm rename ini). **Catatan testing**: `npx serve` (dipakai sbg static server lokal di banyak sesi testing repo ini) py bug nyata — redirect 301 "clean URL" utk file `.html` yg diakses dgn query string **MEMBUANG query string-nya** (`foo.html?x=1` → redirect ke `foo` TANPA `?x=1` sama sekali, dikonfirmasi via network log) — ini murni artefak tooling `serve`, BUKAN perilaku GitHub Pages (host produksi repo ini, yg serve file apa adanya tanpa redirect) atau bug di kode. Solusinya dites pakai static file server literal buatan sendiri (Node `http.createServer` polos, tanpa rewrite apa pun) drpd `npx serve` khusus utk kasus testing yg melibatkan query string.

## Palet Warna

Sudah 3x iterasi (lihat "Status saat ini"): ivory/gold/terracotta → sage/forest/olive/blush (ikut referensi floral pink+eucalyptus) → **sogan & emas** (warna hangat blush-maroon-gold, ikut referensi tema "Adat Jawa" weddingbestie.id). **Nama variable di `:root` (`style.css`) sengaja TIDAK diubah** tiap iterasi (`--forest`, `--olive`, dst — cuma nilai hex-nya yg diganti) biar diff minimal & semua `var(--forest)`/`var(--olive)` yg sudah dipakai di banyak tempat otomatis ikut berubah — **artinya nama variable saat ini sudah tidak deskriptif** (`--forest` isinya maroon, bukan hijau; `--olive` isinya emas, bukan hijau-zaitun) — jangan tertipu nama variable-nya, cek tabel ini kalau nambah CSS baru:

| Variable | Hex | Dipakai utk |
|---|---|---|
| `--ivory` | `#FDF6F1` | bg utama section (blush-cream lembut) |
| `--cream` | `#F8E9E1` | bg section selang-seling (pink-cream lebih pekat) |
| `--ink` | `#4A342E` | teks body/paragraf (cokelat tua hangat) |
| `--muted` | `#8A7A72` | label/eyebrow/teks sekunder (abu-cokelat) |
| `--sage` | `#8CA184` | ikon dedaunan kecil, link IG, ampersand — **satu-satunya sisa hijau**, sengaja dipertahankan krn senada dgn dedaunan di foto bunga `asset/*.webp` |
| `--forest` *(nama lama, isi baru)* | `#5C2A35` | **maroon tua** — nama mempelai (script), heading section, angka countdown, label ucapan |
| `--olive` *(nama lama, isi baru)* | `#BB8A3D` | **emas/mustard** — tombol CTA solid/outline, label "THE WEDDING OF" |
| `--blush` | `#D98A96` | aksen dekoratif hangat (tanda kutip, label "Akad Nikah"/"Resepsi", status ucapan) — tetap cocok dgn palet baru |
| `--line` | `#E3CBB8` | garis pembatas tipis, border monogram/countdown (krem-cokelat, sebelumnya abu-hijau) |
| `--gold-thread` | `#BB8A3D` | **nilainya sama persis dgn `--olive` baru** (sengaja disatukan — emas songket & emas tombol dianggap 1 keluarga warna) — dipakai utk motif divider, bingkai songket, underline judul, border atas kartu |
| `--maroon` | `#7A3030` | siluet gonjong di cover, border kartu Acara (Akad/Resepsi) — sedikit lebih merah/gelap drpd `--forest` biar ada variasi |

Tidak ada dark/light mode toggle — genre undangan digital selalu 1 tema tetap (bukan utility app), beda dari konvensi `app/`/`tool/`.

**Efek samping yg disengaja**: `rsvp.html`/`rsvp.css` **ikut berubah warnanya juga** krn nge-`<link>` `style.css` yg sama (bukan salinan token sendiri) — ini bukan kelalaian, cuma memang tidak disentuh langsung (`rsvp.css`/`rsvp.js` tidak diedit sama sekali di iterasi palet ke-3 ini, sesuai instruksi "fokus di index.html"), tapi hasilnya tetap konsisten krn variable-nya sama. Sudah diverifikasi visual, tidak rusak.

## Unsur Adat

Fitur ini melalui **2 tahap** — penting dibedakan krn pendekatannya beda:

### Tahap 1 — Fusion Jawa + Padang (ornamental murni, tanpa aset gambar)

Permintaan awal ("tampilannya dirubah dgn unsur adat jawa dan padang") direspons dgn motif SVG buatan sendiri (bukan gambar):
- **Siluet Gonjong (Minang/Padang)** — path SVG (`.gonjong-ornament`, viewBox 160×46) garis lengkung 5-puncak meniru atap rumah gadang. Di puncak cover, di atas "THE WEDDING OF". Warna `--maroon`, `stroke` bukan `fill`.
- **Bingkai songket** — strip motif belah-ketupat CSS murni (2 `repeating-linear-gradient` 45°/-45°) di tepi atas/bawah cover (`.cover::before`/`.cover::after`) & underline mini di bawah tiap `.section-title` (`::after`).
- Motif kawung (4 lingkaran batik Jawa) sempat dipakai di `.ornament-divider`, **lalu diganti** di Tahap 2 (lihat di bawah).

### Tahap 2 — Ikut referensi visual konkret "Adat Jawa" (weddingbestie.id/id/tema/jawa)

User kasih screenshot + link tema Jawa dari weddingbestie.id sbg acuan look yg mau ditiru (bkn sekadar motif abstrak lagi, tapi keseluruhan nuansa: warna sogan-emas, bunga di pojok cover, gaya divider). Perubahan:

- **Palet warna diganti total** ke sogan & emas (blush-maroon-gold) — lihat "Palet Warna". Ini **menggantikan** (bukan menambah di atas) palet fusion sage/forest/olive Tahap 1.
- **2 ilustrasi bunga asli** (`asset/crescent-arch.webp` & `asset/rose-spray.webp`, keduanya **sudah py alpha channel transparan** dari sumbernya — dicek via `sharp` sblm dipakai, tidak perlu diproses ulang) dipasang mengapit cover: `crescent-arch.webp` pojok kiri-atas (`.cover-floral-tl`), `rose-spray.webp` pojok kanan-bawah (`.cover-floral-br`, di-mirror `scaleX(-1)` biar motifnya "menghadap" ke tengah) — pola asimetris identik dgn referensi. Awalnya ini disebut "satu-satunya aset gambar eksternal" di dokumen — **sudah tidak berlaku**, lihat Tahap 3 di bawah (user nambah 8 aset lagi).
- **Motif kawung (4 lingkaran) di `.ornament-divider` diganti** jadi bentuk belah-ketupat/daun ramping + titik tengah (`.divider-icon-outline` + `.divider-icon-dot`, viewBox 24×24) — meniru persis bentuk ornamen divider di screenshot referensi (garis - bentuk lonjong tipis - garis), dipakai di 3 tempat yg sama (cover, Kutipan Pembuka, Penutup).
- **Eyebrow "THE WEDDING OF" dikasih garis pengapit kiri-kanan** (`.cover-eyebrow::before`/`::after`) + warna emas — meniru gaya label "— TEMA ADAT —" di referensi.
- Nama mempelai (script) & semua heading section ikut berubah warna jadi maroon (efek otomatis dari palet baru, bukan perubahan struktur terpisah).
- **Siluet gonjong dari Tahap 1 TETAP DIPERTAHANKAN** (tidak dihapus) — mewakili unsur Padang yg masih relevan, warnanya (`--maroon`) justru makin match dgn palet baru.

### Tahap 3 — Sebar aset ilustrasi ke semua section + fix bug stacking-context

User nambah 8 file baru ke `asset/` (`java-heritage-COUPLE-1..4.webp`, `java-heritage-GUNUNGAN.webp`, `java-heritage-MOTIF-ATAS.webp`, `java-heritage-MOTIF-BAWAH.webp`, `java-heritage-PATTERN.webp`, `JAWA-PATTERN.png`) & komplain: stlh "Buka Undangan", background section2 berikutnya (bukan cover) masih polos/kosong. Semua di-cek dulu isinya (dimensi, alpha, preview render) sblm dipasang, krn nama file tdk selalu jelas isinya (mis. "COUPLE-1/2/3/4" ternyata bkn foto pasangan, tapi 2 PASANG ilustrasi cermin: 1&3 = separuh gunungan+bunga lili, saling mirror; 2&4 = bunga lili polos, saling mirror — makanya dinamai "COUPLE").

**Pemetaan aset → lokasi** (semua di `index.html`, style di `style.css`):

| Aset | Lokasi | Class |
|---|---|---|
| `java-heritage-PATTERN.webp` | Tekstur linework mandala, diulang (`background-repeat:repeat`) di **SEMUA** section sbg background — inilah yg langsung mengatasi keluhan "polos" | `.section` (base rule, bukan per-section) |
| `java-heritage-GUNUNGAN.webp` | Watermark besar tembus pandang (`opacity:0.1`) di belakang teks section Kutipan Pembuka — cocok scr makna (gunungan = "pohon kehidupan") dgn isi kutipan ttg pasangan hidup | `.quote-gunungan` |
| `java-heritage-COUPLE-1.webp` / `-3.webp` | Mengapit section "Kedua Mempelai" (kiri-atas & kanan-bawah) — dipakai APA ADANYA tanpa CSS mirror krn keduanya SUDAH saling mirror dari sumbernya | `.couple-corner` (`-tl`/`-br` utk posisi) |
| `java-heritage-COUPLE-2.webp` / `-4.webp` | Dipakai ULANG (class sama, `.couple-corner`) mengapit section Penutup — versi bunga polos (tanpa gunungan) cocok sbg "farewell" | `.couple-corner` |
| `java-heritage-MOTIF-ATAS.webp` | Strip batik pudar nempel di tepi ATAS section Countdown (Save The Date) | `.motif-border.motif-atas` |
| `java-heritage-MOTIF-BAWAH.webp` | Strip batik pudar nempel di tepi BAWAH section Amplop Digital | `.motif-border.motif-bawah` |
| `JAWA-PATTERN.png` | **TIDAK dipakai** — dicek via `sharp`, statistik alpha channel & dimensinya identik persis dgn `java-heritage-PATTERN.webp` (sama-sama 512×512, alpha min/max/mean sama persis) → kesimpulan ini duplikat file yg sama dlm format berbeda, pakai salah satu (webp) sudah cukup, pakai dua-duanya cuma load asset yg sama 2x tanpa nilai tambah visual. |

**Bug nyata yg ditemukan & diperbaiki: negative `z-index` "bocor" ke belakang seluruh halaman.** Semua ilustrasi di atas ditaruh `position:absolute; z-index:-1` (supaya otomatis tampil di ATAS background section tapi di BAWAH konten normal/teks/card — lebih robust drpd nambah rule `:not()` per elemen sibling). Tapi krn `.section` cuma py `position:relative` **tanpa** `z-index` eksplisit, `.section` **tidak** membentuk stacking context sendiri (per spesifikasi CSS, positioned element dgn `z-index:auto` tidak membentuk stacking context baru) — akibatnya elemen anak ber-`z-index:-1` "bocor" naik ke stacking context ANCESTOR TERDEKAT YG BENERAN py stacking context (bisa jadi `body`), rendernya jadi di **paling belakang seluruh halaman** (di belakang `background` si `body` sendiri) — makanya semua ilustrasi ini SAMA SEKALI TIDAK KELIHATAN pas pertama dipasang, padahal `getBoundingClientRect()`/`complete`/`opacity` semua terbaca normal di devtools (jebakan: elemen "ada" & "positioned benar" tapi tetap gak kelihatan). **Fix**: tambah `isolation:isolate;` ke `.section` (base rule) — cara modern bikin elemen py stacking context sendiri tanpa perlu otak-atik angka `z-index`. Ini murni technical gotcha, sama sekali gak spesifik ke tema adat — **kalau nambah elemen dekoratif `position:absolute` + `z-index` negatif di container CSS baru manapun di repo ini, pastikan container-nya py `isolation:isolate` atau `z-index` eksplisit, jangan cuma `position:relative` doang.**

**Kalau nanti user kasih detail adat yg lebih spesifik** (mis. nama prosesi Jawa "Panggih", pantun/pasambahan Minang, busana adat, dst.) — itu akan jadi **konten baru** (section/teks tambahan), bukan cuma styling, jadi minta detail lengkapnya dulu sblm nambah, jangan menebak-nebak istilah adat krn resiko salah/kurang tepat scr budaya.

## Data acara

- **Tanggal**: Minggu, 2 Agustus 2026 (hari sengaja dikoreksi ke "Minggu" — dicek manual via `Date.prototype.toLocaleDateString('id-ID',{weekday:'long'})`, krn tanggal itu memang jatuh hari Minggu, bukan Sabtu spt asumsi awal placeholder).
- **Akad Nikah**: 09.00 — 10.30 WIB, **Masjid Raya Al Ikhlas** (data asli, menggantikan placeholder "kediaman mempelai wanita").
- **Resepsi**: 11.00 — 14.00 WIB, **Masjid Raya Al Ikhlas** — **SAMA PERSIS lokasinya dgn Akad** (permintaan eksplisit user, beda dari placeholder lama yg py 2 venue beda — Kediaman Mempelai Wanita utk Akad, Graha Kirana Ballroom utk Resepsi).
- **Alamat lengkap** (dipakai di `<p class="event-venue">`, 2× di `index.html` — Akad & Resepsi): `Asrama Polri Ex Brimob, Jl. Kesatriaan Raya, RT.5/RW.7, Cilincing, Jakarta Utara 14120` — ditulis PERSIS dari input user, KECUALI "North Jakarta City" (bahasa Inggris asli dari user, kemungkinan hasil ekspor Google Maps locale Inggris) diterjemahkan ke **"Jakarta Utara"** spy konsisten dgn aturan "semua teks UI berbahasa Indonesia" — bagian lain (RT/RW, nama jalan, kode pos) dibiarkan APA ADANYA tanpa reformat, sama prinsipnya dgn alamat kirim kado (lihat "Kirim Kado Fisik").
- **Tombol "Lihat Lokasi" (kedua acara) pakai link Google Maps SHARE asli dari user** (`https://maps.app.goo.gl/wWomQoFo3YL3nC1aA?g_st=ac`, format `maps.app.goo.gl` short-link) — **BUKAN LAGI** search query `https://maps.google.com/?q=...` yg dipakai placeholder lama (nama venue+alamat di-`+`-encode manual) — link share asli lebih akurat (nunjuk pin PERSIS, bukan hasil pencarian teks yg bisa meleset), dipakai apa adanya, sama persis di kedua kartu (Akad & Resepsi). **Kalau lokasi ganti lagi nanti**: link share Maps yg baru HARUS diminta ke user (bukan dikonstruksi manual dari nama+alamat spt sebelumnya), krn user secara eksplisit kasih link share, bukan minta di-generate dari teks alamat.

### Countdown & Add to Calendar (`script.js`)

- Countdown (`cdDays/cdHours/cdMinutes/cdSeconds`) target `new Date('2026-08-02T09:00:00+07:00')` — **patokan waktu akad mulai**, bukan resepsi. Update tiap detik, ada efek "tick" (scale pulse) di angka detik.
- Tombol "+ Tambah ke Kalender" generate link Google Calendar (`calendar.google.com/calendar/render?action=TEMPLATE`), rentang waktu event **UTC** `20260802T020000Z` — `20260802T070000Z` (= 09.00–14.00 WIB, mencakup Akad s/d selesai Resepsi; WIB = UTC+7, jadi kurangi 7 jam dari waktu lokal saat ubah ke Z). **Kalau tanggal/jam acara berubah lagi, WAJIB update 3 tempat sekaligus**: `cover-date` + `event-datetime` (index.html, ada 2 — Akad & Resepsi), `target` countdown, dan `start`/`end` calendar (script.js) — tidak otomatis saling sinkron, semua hardcoded literal.
- **Kalau VENUE (bukan tanggal/jam) yg berubah, `&location=` di link kalender ini (`script.js`) JUGA WAJIB diupdate** — field ini SEMPAT KELEWATAN sekali (lihat "Bug ditemukan & diperbaiki: lokasi 'Tambah ke Kalender' masih alamat lama" di bawah "Musik Latar"), krn tidak disebut eksplisit di catatan "3 tempat" di atas (yg cuma soal tanggal/jam, bukan lokasi).

## Galeri & Lightbox

- 6 foto asli, ditampilkan grid 3 kolom (`.gallery-grid`, `aspect-ratio:1/1`, `object-fit:cover`) — `<img src="gallery/*.webp">` di `index.html` (lihat "Optimasi Galeri (WebP)" di bawah utk kenapa `.webp`, bukan `.jpg` lagi).
- Tiap foto dibungkus `<button class="gallery-item">` (bukan `<div>`) supaya bisa diklik & accessible (fokus keyboard). Klik → `#lightbox` overlay fullscreen (`script.js`, IIFE "GALLERY LIGHTBOX"): set `src`/`alt` dari `<img>` yg diklik (baca `img.src` APA ADANYA, jadi otomatis ikut `.webp` tanpa perlu sentuh JS sama sekali), toggle class `.open`. Tutup lewat tombol ✕, klik area gelap di luar gambar, atau tombol **Esc**.
- Foto profil bulat mempelai (`.couple-photo`, section "Kedua Mempelai") **beda dari galeri** — bukan bagian dari `.gallery-grid`/lightbox, foto individual sendiri (crop wajah), lihat "Foto Profil Mempelai (`photo/`)" di bawah.

### Optimasi Galeri (WebP)

Permintaan eksplisit user — 6 foto asli (`gallery/*.jpg`, LANGSUNG dari kamera profesional, resolusi 3615×5422/4439×6658, **6-12MB per file**, total ±57MB) terlalu besar utk situs mobile-first, bikin loading galeri lambat.

- **`gallery/*.webp` DIBUAT sbg DUPLIKAT baru** (bukan replace/hapus `.jpg` asli — permintaan eksplisit user "duplikat image", jadi `.jpg` resolusi penuh TETAP ADA di folder yg sama sbg arsip, cuma sudah TIDAK direferensikan dari HTML manapun lagi) — dihasilkan via `sharp` (`npm install sharp` sementara di scratchpad, bukan dependency permanen repo ini — project ini toh tanpa `package.json`/build tool, lihat "Tech Stack"): **resize max 2000px** (sisi terpanjang, `fit:'inside', withoutEnlargement:true` — proporsi tetap terjaga, tidak pernah diperbesar), **kualitas WebP 82**.
- **Hasil: ±99% lebih kecil** (mis. `MONO0889-Edit.jpg` 12.21MB → `MONO0889-Edit.webp` 0.14MB) — total galeri jadi ±565KB drpd ±57MB, TANPA penurunan kualitas visual yg kentara (dicek visual langsung tiap hasil, foto studio terang MAUPUN foto gelap/monokrom yg rawan banding — dua2nya tetap tajam & bersih).
- **Kenapa max 2000px cukup**: `.lightbox` (tampilan penuh foto) `position:fixed;inset:0` — bentang SELURUH viewport browser (BUKAN dibatasi `max-width:520px` bingkai halaman spt konten lain, lihat "Layout"), tapi foto berorientasi potret (rasio ±2:3) jadi 2000px di sisi terpanjang sudah lebih dari cukup utk tampilan penuh layar desktop manapun yg realistis, apalagi cuma thumbnail grid 3-kolom yg jauh lebih kecil lagi.
- **HTML** (`index.html`, `<img src="gallery/*.jpg">` → `.webp`) — SATU-SATUNYA perubahan yg diperlukan; `script.js` (lightbox) **TIDAK PERLU diubah** krn baca `img.src` dinamis, otomatis ikut apa pun ekstensi yg ada di HTML.
- **Diuji eksplisit** (Playwright + Edge headless): semua 6 request gambar galeri TERBUKTI HTTP 200 dgn `content-type: image/webp`, tiap `<img>` TERBUKTI `complete:true` dgn dimensi 1333×2000, klik galeri → lightbox TERBUKTI nampilin file `.webp` yg sama (bukan fallback ke jpg lama) — screenshot grid & lightbox dua2nya TERBUKTI tampil bersih tanpa artefak.
- **Kalau nanti mau folder lebih ringan lagi** (`.jpg` asli 57MB msh nyisa di `gallery/`, disengaja dipertahankan sbg arsip resolusi penuh) — tinggal dihapus manual kapan saja, TIDAK ada referensi apa pun lagi ke file itu di kode (aman dihapus tanpa merusak apa pun) — belum dihapus di sini krn user secara eksplisit minta "duplikat", bukan "ganti/hapus".

## Foto Profil Mempelai (`photo/`)

Mengisi placeholder `.couple-photo` ("Foto Pria"/"Foto Wanita", lihat "Status saat ini" poin 6 & 15) dgn foto asli — user nambah 2 foto baru ke folder baru `undangan/photo/`: `MONO0919-Edit.jpg` (mempelai pria, Adryan, 4249×6373, 11.07MB) & `MONO0927-Edit.jpg` (mempelai wanita, Suci, 4439×6658, 13.29MB). Prosesnya **2 tahap terpisah**, jangan dikira 1 langkah:

1. **Duplikat WebP full-frame** — pola PERSIS sama dgn "Optimasi Galeri (WebP)" di atas (`sharp`, resize max 2000px sisi terpanjang `fit:'inside'`, kualitas 82): `MONO0919-Edit.webp` (130.1KB) & `MONO0927-Edit.webp` (145.2KB) DIBUAT sbg duplikat, `.jpg` asli TETAP ADA sbg arsip. **Tidak ada HTML yg mereferensikan 2 file full-frame ini** (beda dari `gallery/`, yg webp full-frame-nya beneran dipakai di grid) — di `photo/`, full-frame cuma bahan mentah utk tahap 2 (crop wajah), foto YANG DIPAKAI di situs adalah hasil crop-nya, bukan versi full-frame ini.
2. **Crop wajah** dari `.jpg` ASLI (resolusi penuh, BUKAN dari `.webp` yg sudah di-resize tahap 1 — crop dari sumber resolusi tertinggi biar hasil akhir tetap tajam) pakai `sharp().extract({left,top,width,height})` lalu `.resize(400,400).webp({quality:88})` → `groom-face.webp` (27.0KB) & `bride-face.webp` (17.4KB). **Koordinat crop dicari via preview iteratif** (crop percobaan di-screenshot, dicek visual, disesuaikan sampai framing pas — bukan angka sekali tebak), hasil akhir: kotak persegi berpusat di wajah + sebagian penutup kepala/kerudung, cukup ruang di sekeliling drpd crop terlalu ketat mepet wajah (konsisten gaya "headshot", bukan cuma mata-hidung-mulut doang) — kedua crop dibuat dgn framing/zoom level SEPADAN (rasio wajah-thd-frame mirip) spy simetris pas ditampilkan berdampingan di section "Kedua Mempelai".
3. **`index.html`**: `<div class="couple-photo"><span>Foto Pria</span></div>` / `...Foto Wanita...` → `<div class="couple-photo"><img src="photo/groom-face.webp" alt="Adryan Luthfi Faiz"></div>` / `...bride-face.webp" alt="Suci Wulandari"...` — placeholder `<span>` teks dihapus total, gantiin `<img>`.
4. **`style.css`** `.couple-photo`: ditambah `overflow:hidden` (spy `<img>` kepotong rapi ikut bentuk lingkaran, container-nya sendiri TETAP dipertahankan `width:96px;height:96px;border-radius:50%` — jadi kalau `<img>` gagal load, background gradient lama tetap kelihatan sbg fallback graceful) + rule baru `.couple-photo img{ width:100%; height:100%; object-fit:cover; }` (isi penuh lingkaran, crop otomatis ikut bentuk kontainer kalau rasio sedikit meleset, walau harusnya udah persegi pas dari tahap crop).
- **Kenapa 400×400, bukan lebih kecil/besar**: `.couple-photo` tampil di CSS cuma `96px` — tapi retina/HiDPI display butuh ±2-3x resolusi native spy tetap tajam, 400px (±4.2x) kasih ruang lebih dari cukup tanpa file jadi besar (27KB/17.4KB, jauh di bawah threshold yg perlu dikhawatirkan).
- **Diuji eksplisit** (Playwright + Edge headless): kedua `<img>` TERBUKTI `complete:true`, `naturalWidth`/`naturalHeight` `400×400`, tanpa `pageerror`; screenshot section "Kedua Mempelai" (kedua kartu) TERBUKTI foto tampil bersih dlm bingkai lingkaran, wajah dua2nya proporsional/tidak terpotong aneh, framing kartu pria & wanita terlihat sepadan/konsisten.
- **Kalau nanti user nambah foto profil lagi/ganti foto** (mis. gara2 hasil crop kurang pas atau foto diganti sesi lain): ulangi 2 tahap yg sama (duplikat webp dulu, baru crop wajah manual dgn preview iteratif) — TIDAK ada cara otomatis deteksi wajah di pipeline ini (semua koordinat crop dicari manual via preview, bukan face-detection library).

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
  - **Status kehadiran = WARNA STROKE KIRI kartu, BUKAN teks** (permintaan eksplisit user susulan — sebelumnya ada `<span class="wish-attendance">Hadir</span>` dkk di sebelah nama, DIHAPUS total) — `ATTENDANCE_CLASS = { hadir: 'wish-card--hadir', ragu: 'wish-card--ragu', tidak: 'wish-card--tidak' }` (gantiin `ATTENDANCE_LABEL` lama) nambahin modifier class ke `.wish-card`, warnanya (`style.css`: `.wish-card--hadir` hijau `#3E7449`, `--ragu` kuning `#A67525`, `--tidak` merah `#B04F60`) SAMA PERSIS dgn warna badge status di Panel Admin (`rsvp.css` `.badge-hadir`/`.badge-ragu`/`.badge-tidak`, lihat "Panel Admin") — sengaja disamakan spy 1 bahasa warna konsisten antara halaman tamu & admin.
  - **`#wishList`/`.wish-list` sekarang scrollable** (`max-height:300px; overflow-y:auto;` — direvisi dari `480px` semula ke `300px` permintaan eksplisit user susulan, permintaan awalnya krn keluhan "kalo yg ngucapin udah 10 jadi kepanjangan") — list ucapan tidak lagi bikin halaman jadi sangat panjang kalau ucapan yg masuk banyak, digulir SENDIRI di dalam kotaknya (bukan ikut scroll seluruh halaman) begitu kontennya melebihi tinggi itu.
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

Kartu bank (`.gift-card`) tiap punya tombol "Salin Nomor"/"Salin Alamat" (`.copy-btn`, `data-copy="<teks yg disalin>"`) → `copyText()` di `script.js`: coba `navigator.clipboard.writeText()`, fallback ke `textarea`+`execCommand('copy')` kalau gagal (pola sama persis dgn tool lain di `tool/`), feedback via toast kecil bawah layar.

- **Label toast per-tombol** (`data-copy-label`, permintaan eksplisit user susulan pas nambah kartu alamat di bawah) — listener `.copy-btn` (`script.js`) sekarang baca `btn.dataset.copyLabel || 'Nomor rekening'` (fallback ke label lama kalau atribut ini tidak ada, jadi 2 tombol bank yg SUDAH ADA duluan tidak perlu diubah HTML-nya sama sekali, otomatis tetap "Nomor rekening disalin"). Kartu alamat (lihat di bawah) pakai `data-copy-label="Alamat"` → toast "Alamat disalin", bukan ikut2an bilang "Nomor rekening disalin" yg keliru.

**Data asli** (diisi menggantikan placeholder Bank Mandiri/BCA sebelumnya, di `index.html`):
- **Adryan Luthfi Faiz** — Bank **BNI**, `836097456`
- **Suci Wulandari** — Bank **BCA**, `6310363331`

`<p class="gift-number">` (versi tampil) SEKARANG SAMA PERSIS dgn `data-copy` (dipakai tombol Salin) — **TANPA spasi pengelompokan** (permintaan eksplisit user susulan, sebelumnya sempat ditampilkan dgn spasi mis. `836 097 456` lalu diminta dihapus) — jadi cuma ada **1 bentuk angka** yg perlu dijaga sinkron, bukan 2 format beda. Kalau nomor rekening berubah lagi nanti, wajib update KEDUA atribut (`gift-number` & `data-copy`, isinya SEKARANG identik) di `index.html`.

### Logo Bank

User nambah 2 file logo resmi ke folder baru `undangan/logo/` (`logo-bank-bni.png`, `logo-bank-bca.png` — keduanya lockup horizontal "ikon + wordmark", py alpha channel transparan asli dari sumbernya, dikonfirmasi via `sharp` cek RGBA pojok = `[255,255,255,0]`, BUKAN cuma putih opaque). Diminta ditaruh **di bawah teks nama bank** ("Bank BNI"/"Bank BCA"), di ATAS nomor rekening.

- **Diproses dulu sblm dipakai** (`sharp`, sama precedent dgn foto/galeri lain di repo ini): `.trim()` (buang padding transparan berlebih di sekeliling logo — PNG asli py banyak ruang kosong, `logo-bank-bni.png` dari `2000×1414` jadi `1528×443` stlh trim, `logo-bank-bca.png` `2000×627` sudah pas/gak berubah) → `.resize({width:480})` → `.webp({quality:90})` — hasil `logo-bank-bni.webp` (12.7KB) & `logo-bank-bca.webp` (23.7KB), alpha TETAP terjaga (WebP support transparansi sama spt PNG). **PNG asli TETAP ADA** di folder yg sama sbg arsip (pola sama dgn `gallery/`/`photo/` — duplikat, bukan replace), yg dipakai HTML cuma versi `.webp`.
- **HTML** (`index.html`, 2 kartu bank): `<img class="gift-logo" src="logo/logo-bank-bni.webp" alt="Logo Bank BNI">` / `...logo-bank-bca.webp" alt="Logo Bank BCA"...` disisipkan di ANTARA `<p class="gift-bank">` & `<p class="gift-number">`. Kartu ke-3 (Kirim Kado Fisik, lihat di bawah) **TIDAK dikasih logo** — bukan kartu bank, gak relevan.
- **CSS** (`style.css`) — class baru `.gift-logo{ display:block; height:26px; width:auto; margin:0 auto 10px; }`: tinggi FIXED `26px` biar 2 logo yg rasio aspeknya beda (BNI trimmed ±3.45:1, BCA ±3.2:1 — mirip tapi gak identik) tetap konsisten tingginya walau lebarnya beda dikit (89.8px vs 83.2px dirender, selisih wajar krn beda logo, bukan bug); `width:auto` biar `object-fit` gak perlu, proporsi asli logo terjaga apa adanya (gak digepengin/diregangin). **`margin:0 auto`, BUKAN cuma `text-align:center` dari `.section`/`.gift-card` (yg cuma efektif ke inline/inline-block, TIDAK ke `display:block`)** — gotcha sempat kejadian: logo awalnya nempel rata kiri padahal teks "BANK BNI"/"BANK BCA" di atasnya kelihatan center, krn `<img>`-nya `display:block` py lebar intrinsik < lebar card, `text-align:center` parent gak ngefek ke situ, HARUS `margin-left:auto;margin-right:auto` eksplisit di elemen block itu sendiri.
- **Diuji eksplisit** (Playwright + Edge headless): kedua `<img>` TERBUKTI `complete:true` dgn dimensi asli `480×139`/`480×150`, TANPA `pageerror`; screenshot section Amplop Digital TERBUKTI kedua logo tampil bersih dgn background transparan (nyatu mulus dgn `.gift-card` yg berwarna `var(--card)`, gak ada kotak putih solid yg keliatan mismatch), tinggi render konsisten `26px` di kedua logo.

### Kirim Kado Fisik (kartu ke-3, alamat)

Permintaan eksplisit user — ditanya dulu ("dipakai buat apa alamatnya?") krn ambigu antara ganti alamat Akad/Resepsi vs field baru, user pilih: **field baru khusus alamat kirim kado fisik** (bukan alamat acara Akad/Resepsi yg masih placeholder terpisah, lihat "Data acara"), berlaku sama utk kado dari pihak mempelai pria maupun wanita (1 alamat, bukan 2 alamat per keluarga).

- **Kartu ke-3** ditambahkan SETELAH 2 kartu bank (`data-delay="5"`, lanjutan urutan reveal 3/4 yg sudah ada), REUSE class `.gift-card` (container sama) + `.gift-bank` (dipakai ulang sbg label judul "Kirim Kado Fisik", walau namanya "gift-**bank**" skrg isinya bukan nama bank) + `.gift-owner` (dipakai ulang sbg keterangan "Untuk mempelai pria & wanita") — class BARU cuma 1: **`.gift-address-text`** (font 14px, `color: var(--ink)`, `line-height:1.7` — beda dari `.gift-number` yg serif besar, krn isinya alamat panjang bukan angka rekening pendek) di `style.css`.
- **Alamat**: `KP TANAH 80 NO.2 RT.010/RW.008 KLENDER DUREN SAWIT JAKARTA TIMUR DKI JAKARTA` — ditulis **PERSIS apa adanya** (all-caps, singkatan RT/RW dgn titik) sesuai input asli user, TIDAK diformat ulang (kapitalisasi/tanda baca) krn resiko salah transkripsi/tafsir struktur alamat (RT/RW mana, kelurahan/kecamatan mana) yg tidak eksplisit dijelaskan user — konsisten dgn prinsip "display = copy value, apa adanya" yg baru ditegaskan user di kartu bank (lihat di atas).
- **`data-copy` SAMA PERSIS dgn teks yg ditampilkan** (bukan versi lain) — tombol "Salin Alamat" (`data-copy-label="Alamat"`, lihat di atas).
- **Diuji eksplisit** (Playwright + Edge headless): kartu ke-3 TERBUKTI muncul dgn label/teks alamat/tombol yg benar, `data-copy` SAMA PERSIS dgn teks tampil, klik "Salin Alamat" (izin clipboard di-`grantPermissions`) TERBUKTI nyalin teks yg benar ke clipboard SUNGGUHAN (dicek `navigator.clipboard.readText()`) & toast TERBUKTI muncul "Alamat disalin" (bukan "Nomor rekening disalin" yg keliru) — 2 tombol bank yg sudah ada TERBUKTI tidak terpengaruh (`copyLabel: null`, tetap fallback ke label lama).

## Musik Latar

**Data asli** — user nambah file lagu ke folder baru `undangan/music/` (`Lagu Pernikahan Kita - Tiara Andini ft. Arsy Widianto (Piano Cover) with Lyrics by AnggelMel.mp3`, durasi ±4:45), diisi ke `<audio id="bgm" loop preload="none" src="music/...">` di `index.html` — TIDAK ada perubahan JS sama sekali (sesuai catatan lama: tinggal isi `src`, `bgm.play()` di `script.js` sudah menangani sisanya), cuma `src` attribute yg ditambah.

- **Nama file di `src` di-`encodeURIComponent()`-kan** (spasi → `%20`, `(`/`)` → `%28`/`%29`, dst.) — nama file asli py spasi & tanda kurung, encoding manual dipakai drpd nulis spasi mentah di atribut HTML (lebih robust lintas server/browser drpd andalkan auto-encoding implisit browser).
- **Folder `music/` BARU** (belum ada sebelumnya) — cuma isi 1 file ini, ditaruh sejajar `gallery/`/`asset/` di root `undangan/`.
- **Diuji eksplisit** (Playwright + Edge headless): request network ke path `music/...` TERBUKTI berhasil (HTTP 200); klik "Buka Undangan" → `bgm.play()` TERBUKTI benar2 jalan (`paused: false`, `currentTime` maju, `readyState: 4`/HAVE_ENOUGH_DATA, `duration` ±285 detik, `error: null`, TIDAK ada page error) — bukan cuma diam2 gagal spt sblm ada file asli.

### Ikon Play/Pause Tombol Musik

Permintaan eksplisit user susulan — ikon SVG "disc+dot" (lingkaran + titik tengah) yg dulu dipakai `.music-toggle` dianggap **kurang jelas** maknanya (tidak keliatan jelas ini tombol play/pause musik). Diganti ikon teks universal:

- **Iterasi 1 (SUDAH TIDAK BERLAKU)**: sempat dipakai 2 glyph teks Unicode ditumpuk, `▶︎` & `❚❚` (`.music-icon-play`/`.music-icon-pause`, `<span aria-hidden="true">`) — gantiin `<svg class="disc">...</svg>` yg lebih lama lagi. Sempat jg dikasih animasi SPIN (`animation: spin 3.2s linear infinite`, toggle `animation-play-state` via `.music-toggle.playing`).
- **Iterasi 2 (STATE SAAT INI)** — user test langsung & komplain 2 hal: (a) ukuran `❚❚` tampak lebih besar drpd `▶︎` walau `font-size` sama persis (bobot visual glyph font beda2 per karakter, gak bisa dijamin sama lintas browser/OS), (b) animasi putar dianggap kurang bagus, minta versi diam. **Kedua glyph teks DIHAPUS TOTAL, diganti bentuk CSS geometris murni** (span kosong, bentuknya digambar lewat CSS, bukan lewat karakter font) — `.music-icon-play` segitiga (border-trick: `border-top`/`border-bottom` transparan 7px + `border-left` solid 12px), `.music-icon-pause` 2 batang (`::before`/`::after` tiap `width:5px;height:14px;background:#fff`, `display:flex;gap:4px`) — keduanya `height:14px` PERSIS SAMA, jadi ukuran terjamin identik selalu (bkn cuma "kelihatan mirip" spt pendekatan glyph). **Animasi spin DIHAPUS SELURUHNYA** (`@keyframes spin` & `animation-play-state` dihapus dari CSS, bukan cuma di-nonaktifkan) — ikon SEKARANG STATIS, cuma berubah bentuk (segitiga↔2 batang) saat toggle, tidak berputar.
- **`index.html`**: `<span class="music-icon music-icon-play/-pause" aria-hidden="true">` SEKARANG KOSONG (tanpa isi teks glyph sama sekali) — visualnya 100% dari CSS (`::before`/`::after` + border-trick), HTML cuma nyediain 2 elemen kosong yg mana yg kelihatan diatur `display` via class `.playing` (sama mekanismenya dgn iterasi sblmnya, cuma isi visualnya beda).
- **Rule `prefers-reduced-motion`** (`@media (prefers-reduced-motion: reduce)`, di `style.css`): entry `.music-icon` DIHAPUS dari daftar selector yg dimatikan animasinya — SUDAH TIDAK PERLU krn ikon musik skrg emang gak py animasi sama sekali lagi (bukan lagi soal "matiin kalau user prefer minim animasi", tapi "emang gak ada animasi apa2 dari awal").
- **Diuji eksplisit** (Playwright + Edge headless, setelah nunggu penuh transisi cover-close 850ms — jgn ukur elemen sblm itu selesai, ketauan `getBoundingClientRect()` semua 0 kalau diukur kepagian): state playing → ikon 2-batang TERBUKTI `14×14px`; state paused → ikon segitiga TERBUKTI `12×14px` (lebar beda krn bentuk beda, TAPI tinggi SAMA PERSIS `14px` drpd kedua bentuk — inilah yg dijamin "sama ukuran"); `animationName` komputasi TERBUKTI `"none"` di kedua state; `bgm.paused` TERBUKTI ikut berubah benar (`false` saat playing, `true` saat paused) — screenshot kedua state dikonfirmasi visual bersih, ukuran ikon konsisten, tanpa gerakan putar.

### Bug ditemukan & diperbaiki: lokasi "Tambah ke Kalender" masih alamat lama

Waktu venue diganti ke Masjid Raya Al Ikhlas (lihat "Data acara"), field `&location=...` di link Google Calendar (`addCalendarBtn`, `script.js`) **KELEWATAN** — masih hardcode `"Graha Kirana Ballroom, Jl. Riau No. 45, Bandung"` (placeholder LAMA yg sudah tidak dipakai di mana pun lagi di HTML). Ditemukan & diperbaiki sekalian pas kerjain permintaan ikon musik ini — `&location=` sekarang `"Masjid Raya Al Ikhlas, Asrama Polri Ex Brimob, Jl. Kesatriaan Raya, RT.5/RW.7, Cilincing, Jakarta Utara 14120"`, sama persis alamat yg dipakai di section Rangkaian Acara. **Pelajaran**: field lokasi kalender ini TIDAK disebut di catatan "kalau tanggal/jam acara berubah, wajib update 3 tempat" (lihat "Countdown & Add to Calendar" di atas) — daftar itu HARUSNYA jg mencakup field ini kalau ke depan VENUE (bukan cuma tanggal/jam) berubah lagi.

## Gotcha: `[hidden]` vs `display:flex`

`.cover{ display:flex; ... }` (utk centering konten) **menang atas** attribute `hidden` bawaan browser (`[hidden]{display:none}`) krn spesifisitas CSS sama (class selector vs attribute selector, keduanya (0,1,0)) dan aturan `.cover` di stylesheet penulis datang setelah UA stylesheet default — akibatnya cover tidak benar-benar hilang stlh "Buka Undangan" diklik, cuma numpuk di atas/mendorong section berikutnya turun 100vh. **Sudah diperbaiki** dgn `[hidden]{ display:none !important; }` di baris awal `style.css`. Ini bug berulang yg sama persis pernah kejadian di `tool/generate-sql-query/` — **kalau bikin file HTML/CSS baru lain di repo ini yg pakai kombinasi `hidden` attribute + elemen ber-`display:flex/grid` eksplisit, selalu tambahkan rule `[hidden]{display:none!important}` di awal**, jangan asumsikan `hidden` otomatis menang.

## Rencana / TODO ke depan

- **Auth Firebase**: sama spt app lain, path `undangan` di Realtime Database masih publik readable/writable tanpa proteksi rules — perlu ditambah rules kalau mau dibatasi (mis. rate-limit submit, validasi field wajib ada). **Beda dari** proteksi PIN `rsvp.html` (lihat "Proteksi PIN") — PIN cuma ngunci tampilan UI-nya, data mentahnya di Firebase tetap bisa diakses langsung via REST API/devtools oleh siapa pun yg tau `databaseURL` (sama kayak semua app lain di repo ini), PIN bukan pengganti Firebase rules.
- Panel admin blm ada fitur hapus/edit data (view-only, lihat "Panel Admin") — tambahkan kalau user minta, pola tombol hapus + `openConfirm()` sudah ada presedennya di app lain (`app/wishlist`, dst).
- Belum ada moderasi ucapan (semua submit langsung tampil ke publik tanpa direview) — kalau nanti butuh, bisa tambah field `approved:boolean` + filter di `renderWishList()`/`renderList()`.
- Belum terhubung dari portfolio utama (`index.html` root) maupun hub app/tool manapun — berdiri sendiri, diakses langsung via URL `/undangan/` atau `/undangan/index.html`.
- Belum ada testing otomatis/build pipeline — murni HTML/CSS/JS statis, testing manual/Playwright ad-hoc tiap ada perubahan.

## Catatan implementasi

- Semua teks UI berbahasa Indonesia.
- **Wajib**: setiap kali ada perubahan struktur/fitur/konten signifikan di folder ini (section baru, data acara berubah, foto/audio asli dipasang, dst.), update dokumen ini (`undangan/.claude/CLAUDE.md`) di perubahan yang sama — pola sama persis dgn kewajiban update CLAUDE.md di `app/` dan `tool/`.
