# CLAUDE.md — Little Adventure

Prototype game petualangan 2D pixel-art di `trialerror/LittleAdventure/`. Tahap ini **fokus murni ke animasi & pergerakan karakter** — belum ada NPC atau musuh. Satu karakter (bisa diganti lewat picker Male/Female, lihat "Ganti karakter") yang bisa jalan 4 arah di atas gambar map sungguhan (`img/samplemap.png`), dengan kamera yang mengikuti karakter secara smooth (lihat "Kamera mengikuti karakter").

---

## Tech Stack

- **Frontend:** HTML5 + CSS3 + Vanilla JavaScript (tanpa framework/build tool)
- **Bahasa UI:** Indonesia
- **Aset:** sprite sheet pixel-art PNG (lihat "Aset karakter" di bawah)
- **Font:** [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans) (Google Fonts, gratis/open-source — lisensi SIL Open Font License, bebas dipakai tanpa atribusi) — dimuat via `<link>` CDN Google Fonts di `<head>` `index.html` (bukan self-host, konsisten dgn cara project ini tidak punya build step). Diset di `body` (`style.css`), dan `button { font-family: inherit; }` ditambahkan eksplisit krn elemen `<button>` tidak otomatis ikut font body di semua browser.

---

## Struktur File

```
LittleAdventure/
  index.html     # halaman prototype — .game-header (judul, hint kontrol, tombol Ganti Karakter — absolute,
                 # nempel atas, lihat "Layout: header vs #gameWorld"), .game-stage (#gameWorld/kamera >
                 # #worldLayer/dunia > #character > #speechBubble, PLUS #chatInput ngomong — absolute,
                 # nempel di BAWAH #gameWorld, lihat "Layout"), dan overlay #characterPickerOverlay
                 # (picker Male/Female)
  style.css      # styling jendela kamera, dunia (skala/posisi diisi lewat JS), properti statis karakter,
                 # overlay picker karakter (tombol, tab gender, grid thumbnail), input chat, & speech bubble
  script.js      # semua logic: sprite stepping, animasi jalan, kontrol keyboard, kamera mengikuti karakter,
                 # picker ganti karakter, fitur ngomong (chat bubble)
  img/
    character/
      Male/      # sprite sheet karakter pria — banyak varian (01 s/d ~25+), tiap nomor
                 # punya beberapa file -1/-2/-3/-4 (variasi warna/outfit sprite sheet yg sama)
      Female/    # sama pola dgn Male/, varian karakter wanita
    samplemap.png  # gambar map dunia (1920×1920px) — dipakai sbg background #worldLayer
    tileset/       # folder kosong, disiapkan utk tile individual ke depan — belum dipakai
  .claude/
    CLAUDE.md    # file ini
```

Belum ada build tool — cukup buka `index.html` langsung di browser (tidak butuh Firebase/server, murni client-side).

## Layout: `.game-header` & `#chatInput` vs `#gameWorld` (`style.css`)

`body` masih `display:flex; flex-direction:column; align-items:center; justify-content:center;` spy `#gameWorld` (jendela kamera, dibungkus `.game-stage`) selalu **pas di tengah layar** — tapi `.game-header` (judul, hint kontrol, tombol Ganti Karakter) sengaja **dikeluarkan dari alur flex itu** lewat `position: absolute; top: 24px; left: 50%; transform: translateX(-50%);` (containing block-nya `body`, yang dikasih `position: relative` khusus utk ini).

Alasan: kalau header ikut jadi flex child biasa (spt sebelumnya), `justify-content: center` di `body` nge-center **seluruh grup** (header + gameWorld) sbg satu blok — akibatnya `#gameWorld` sendiri tidak pas di tengah layar, geser ke bawah sejumlah tinggi header. Dgn header di-absolute-kan (dikeluarkan dari flow), `.game-stage` jadi **satu-satunya** flex child yang dihitung body, jadi `justify-content: center` bisa nge-center `#gameWorld` itu sendiri persis di tengah, apa pun tinggi header di atasnya (nambah/ngurangin baris hint tidak akan menggeser posisi `#gameWorld`).

`.game-header` sendiri tetap `display:flex; flex-direction:column; align-items:center;` di dalam dirinya sendiri (buat nyusun h1/hint/tombol vertikal & center horizontal) — cuma **posisinya** thd `body` yang absolute, bukan strukturnya di dalam.

**`.hint` (list kontrol) 2 kolom**: `display:grid; grid-template-columns: repeat(2, auto);` — auto-placement CSS grid row-major, jadi urutan `<p>` di HTML otomatis ngisi kiri→kanan lalu turun baris (baris 1 = hint ke-1 & ke-2, baris 2 = hint ke-3 & ke-4, dst.), tidak perlu atur posisi manual per item. `justify-content:center` di `.hint` biar grid-nya sendiri tetap center di dalam `.game-header`, walau tiap barisnya rata kiri (`text-align:left` + `white-space:nowrap` per `<p>`, biar antar kolom rapi sejajar, bukan rata tengah yg bikin col kiri/kanan "jalan" tidak sejajar tiap baris).

**`#chatInput` pakai pola sama persis, tapi nempel di BAWAH `#gameWorld`** (bukan di header): dibungkus `.game-stage` (`position: relative`, satu-satunya anak alur-normalnya cuma `#gameWorld`, jadi ukurannya otomatis ngikut ukuran `#gameWorld` doang) bareng `#gameWorld`, lalu `#chatInput` diposisikan `position: absolute; top: 100%; left: 50%; transform: translateX(-50%);` relatif ke `.game-stage`. Efeknya: toggle `hidden` (muncul/hilang tiap buka/tutup chat) **tidak pernah menggeser posisi `#gameWorld`** — persis krn `#chatInput` sudah dikeluarkan dari alur normal, sama prinsipnya dgn `.game-header`.
- **Kenapa `#chatInput` BUKAN child `#gameWorld` langsung** (padahal `#gameWorld` juga sudah `position: relative`): `#gameWorld` punya `overflow: hidden` (dipakai buat motong `#worldLayer` yg jauh lebih besar, lihat "Kamera mengikuti karakter") — kalau `#chatInput` ditaruh sbg child-nya dgn `top:100%` (di luar batas kotak 320px tingginya), otomatis ke-clip/hilang krn `overflow:hidden` ikut motong descendant yg posisinya di luar box, bukan cuma `#worldLayer`. Makanya `#chatInput` ditaruh sbg **sibling** `#gameWorld` (sama-sama child `.game-stage`), bukan descendant-nya.

## Aset karakter (`img/character/Male/`, `img/character/Female/`)

Tiap file adalah **satu sprite sheet 3 kolom × 4 baris**, ukuran asli 96×128px (1 frame = 32×32px). Konvensi baris (dicek langsung dari sample `Male 01-1.png`, berlaku sama utk semua file lain di kedua folder):

| Baris | Arah |
|---|---|
| 0 (paling atas) | Jalan ke **bawah** |
| 1 | Jalan ke **kiri** |
| 2 | Jalan ke **kanan** |
| 3 (paling bawah) | Jalan ke **atas** |

Kolom: **0 & 2** = pose kaki melangkah (kiri/kanan), **1 (tengah)** = pose idle/diam — dipakai juga sbg frame "netral" di tengah siklus animasi jalan.

Default saat load pertama: `img/character/Male/Male 01-1.png` (`currentGender`/`currentFile` di `script.js`, awalnya `"Male"`/`CHARACTER_FILES.Male[0]`). Semua varian lain (nomor 02 s/d 18 utk Male, 02 s/d 25 utk Female, suffix `-2`/`-3`/`-4`) sudah bisa dipilih lewat picker "Ganti Karakter" (lihat "Ganti karakter").

`Male/`/`Female/` awalnya langsung di dalam `img/` (sejajar), dipindah ke dalam `img/character/` supaya `img/` bisa menampung jenis aset lain ke depan (tile map, objek, UI, dll.) tanpa tercampur rata dgn sprite karakter.

## Cara kerja animasi & pergerakan (`script.js`)

- **Stepping sprite via `background-position`**: `#character` adalah satu `<div>` kosong dengan `background-image` = sprite sheet, `background-size` = ukuran penuh sheet (sudah diskala), lalu tiap frame animasi cukup ganti `background-position` ke `-(kolom×FRAME)px -(baris×FRAME)px`. Tidak pakai `<img>`/canvas — dipilih krn paling sederhana utk kasus sprite sheet statis begini.
- **Skala pixel-art**: sprite asli 32×32px dikali `SCALE = 1.5` jadi 48×48px per frame (konstanta `FRAME_SRC`/`SCALE`/`FRAME` di `script.js`, ukuran karakter di layar diminta 48×48 secara eksplisit) supaya kelihatan jelas di layar modern. `image-rendering: pixelated` di CSS supaya hasil scale tetap tegas (tidak blur/anti-alias).
- **Siklus animasi jalan**: `WALK_FRAMES = [1, 0, 1, 2]` (tengah → kiri → tengah → kanan, berulang), ganti frame tiap `FRAME_DURATION` (140ms) selama ada arah yang ditahan. Berhenti bergerak → langsung balik ke `IDLE_FRAME` (kolom tengah) di baris arah hadap terakhir (`facing`), bukan freeze di pose kaki melangkah.
- **Kontrol**: Arrow keys **dan** WASD sama-sama jalan (`KEY_TO_DIR`), `e.preventDefault()` di keydown biar panah tidak ikut men-scroll halaman.
- **Multi-tombol ditahan sekaligus**: `heldDirections` adalah **array berurutan** (bukan `Set`) — arah yang dipakai gerak/animasi selalu elemen **paling akhir** (paling baru ditekan & masih ditahan). Efeknya: kalau user menekan Kanan lalu (tanpa lepas) menekan Atas, karakter langsung menghadap/jalan Atas; begitu Atas dilepas, otomatis balik jalan Kanan (bukan berhenti total) selama Kanan masih ditahan. Dilepas semua → berhenti & idle.
- **Loop gerak**: satu `requestAnimationFrame` loop (`loop()`), delta time dinormalisasi ke satuan "per frame 60fps" (`dt = (time - lastTime) / (1000/60)`) supaya `SPEED` (px per frame) konsisten di refresh rate layar berapa pun.
- **Batas dunia**: posisi karakter (`x`, `y`) — dalam koordinat **dunia** (`#worldLayer`), bukan koordinat layar — di-clamp ke `[0, WORLD_WIDTH/HEIGHT - FRAME]` tiap frame gerak, jadi karakter tidak bisa jalan keluar gambar map.
- **Kehilangan fokus window**: listener `blur` mengosongkan `heldDirections` (& `shiftHeld`, lihat "Jalan pelan") supaya karakter tidak "nyangkut" jalan terus kalau user pindah tab/app saat tombol masih dianggap tertekan oleh browser.

### Jalan pelan (tahan Shift)

- Tahan **Shift** selagi jalan → `shiftHeld = true` (listener `keydown`/`keyup` terpisah dari `KEY_TO_DIR`, krn Shift bukan tombol arah). Baik **kecepatan gerak** (`updateMovement`) maupun **kecepatan animasi jalan** (`updateAnimation`) ikut diperlambat bersamaan, sama-sama dikali `WALK_SLOW_FACTOR = 0.5` — permintaan eksplisit user supaya jalan pelan terlihat proporsional (bukan cuma gerakannya lambat tapi kaki masih "lari" cepat, atau sebaliknya).
  - Gerak: `speed = shiftHeld ? SPEED * WALK_SLOW_FACTOR : SPEED` (dikalikan — makin kecil faktornya, makin lambat geraknya).
  - Animasi: `frameDuration = shiftHeld ? FRAME_DURATION / WALK_SLOW_FACTOR : FRAME_DURATION` (**dibagi**, bukan dikali — durasi tiap frame perlu jadi lebih LAMA/besar supaya animasinya lebih lambat; `/0.5` = 2× durasi normal, senilai dgn "setengah kecepatan").
- Guard `document.activeElement === chatInput` juga dipasang di keydown Shift (sama pola dgn tombol arah) — supaya Shift+huruf pas ngetik pesan (mis. bikin huruf kapital) tidak ke-anggap "mulai jalan pelan" begitu chat ditutup.

### Lompat (tekan Space)

- **Murni efek visual (hop)** — tekan Space memicu class `.jumping` di `#character`, yang menjalankan `@keyframes jump` (CSS, `style.css`): `translateY` naik ke `-14px` di titik tengah animasi lalu balik ke `0`, durasi `0.45s`. **Tidak mengubah** posisi dunia (`x`/`y`), kecepatan, arah hadap, atau collision sama sekali — bisa dipicu sambil diam maupun sambil jalan, dua-duanya independen.
- **Kenapa posisi karakter dipindah dari CSS `transform` ke properti `translate` terpisah** (`character.style.translate = "${x}px ${y}px"`, di `updateMovement`/`init`, bukan lagi `character.style.transform = "translate(...)"`): krn animasi lompat JUGA butuh `transform` (`translateY` hop). Kalau posisi masih pakai `transform` inline dari JS, animasi CSS yang jg menyasar `transform` bakal rebutan/saling timpa nilai di properti yang sama. `translate` (properti CSS individual, terpisah dari `transform`, didukung semua browser evergreen) & `transform` dijamin dikompose bareng oleh browser (posisi dari `translate`, ditambah offset hop dari `transform`), jadi keduanya jalan bebas tanpa konflik.
- **Guard `isJumping`**: menekan Space lagi selagi masih di tengah animasi lompat diabaikan (tidak restart/menumpuk animasi) sampai lompatan sebelumnya selesai.
- **Class `.jumping` dilepas via event `animationend`** (bukan `setTimeout` durasi hardcoded) — supaya kalau durasi di `@keyframes jump` diubah nanti, JS otomatis ikut tanpa perlu disinkronkan manual di dua tempat.
- Guard `document.activeElement === chatInput` sama spt Shift/tombol arah — spasi dipakai buat ngetik spasi normal di pesan chat, bukan trigger lompat, selama fokus di `#chatInput`.
- **`#speechBubble` ikut naik-turun bareng saat lompat** (bukan bug) — krn dia child `#character`, & animasi hop-nya nempel di `#character` itu sendiri.

## Map dunia (`img/samplemap.png`, `#worldLayer`)

- `#worldLayer` pakai `img/samplemap.png` (1920×1920px) sbg `background-image`, bukan lagi motif rumput CSS (`repeating-linear-gradient`) yang dipakai di versi sebelumnya.
- **Skala map = skala karakter** (`WORLD_WIDTH`/`WORLD_HEIGHT` = `MAP_SRC_SIZE * SCALE` di `script.js`) — permintaan eksplisit user supaya rasio ukuran karakter thd map konsisten (bukan angka dunia yang arbitrer spt sebelumnya). Karena `SCALE` sama persis dgn konstanta yang dipakai sprite karakter, ubah `SCALE` sekali otomatis mengubah skala keduanya bersamaan.
- `background-size` di-set ke `WORLD_WIDTH`×`WORLD_HEIGHT` (ukuran map setelah discale) via JS di `init()` — konsisten dgn pola `.character` yang skalanya jg diatur lewat `background-size`.
- `image-rendering: pixelated` juga dipasang di `#worldLayer` (bukan cuma `.character`) supaya map ikut tegas/tidak blur setelah di-scale.

## Kamera mengikuti karakter (`updateCamera`, `#gameWorld` vs `#worldLayer`)

Dua layer terpisah — dipisah krn kamera & dunia butuh digeser independen dari border/shadow "jendela":

- **`#gameWorld`** = jendela kamera, ukuran tetap (480×320, `overflow: hidden`), inilah yang punya border/shadow "kotak game".
- **`#worldLayer`** = dunia sesungguhnya (gambar map `samplemap.png`), jauh lebih besar dari jendela (`WORLD_WIDTH`×`WORLD_HEIGHT`, lihat "Map dunia"), berisi map + karakter. Digeser via `transform: translate(-camX, -camY)` — makin besar `camX`/`camY`, makin ke kiri-atas dunia bergeser relatif ke jendela (ilusi kamera "maju" ke kanan-bawah).
- Karakter sendiri posisinya (`x`, `y`) tetap dalam **koordinat dunia** (sama seperti sebelum ada kamera) — transform karakter tidak berubah sama sekali oleh kamera, cuma parent-nya (`#worldLayer`) yang bergeser.

**Efek "smooth, sedikit tertinggal"** (`updateCamera`, permintaan eksplisit user — bukan kamera yang langsung snap ke tengah): tiap frame, dihitung `targetCamX/Y` (posisi kamera yang bikin karakter PAS di tengah jendela), lalu posisi kamera aktual (`camX`/`camY`) didekatkan ke target itu **sedikit demi sedikit** pakai *exponential smoothing*: `camX += (targetCamX - camX) * t`, dengan `t = 1 - (1 - CAMERA_SMOOTH)^dt` (versi `CAMERA_SMOOTH = 0.08` yang disesuaikan ke delta time `dt`, supaya kecepatan "mengejar" konsisten di framerate berapa pun — pola dt yang sama dgn `SPEED` gerak karakter). Hasilnya: pas karakter mulai jalan, kamera "ketinggalan" sesaat (karakter sedikit menjauh dari tengah), lalu begitu karakter **berhenti**, kamera terus mendekat sampai karakter kembali PAS di tengah — bukan berhenti mendadak.
- **Clamp ke tepi dunia**: `targetCamX/Y` di-clamp ke `[0, WORLD_WIDTH/HEIGHT - viewport]` — kalau karakter jalan ke pojok dunia, kamera berhenti di tepi (tidak menampilkan area kosong di luar `#worldLayer`), jadi karakter TIDAK selalu pas di tengah persis di dekat tepi dunia (perilaku standar kamera game tile, bukan bug).
- **Saat load pertama**: kamera langsung dipasang pas di tengah karakter tanpa animasi "mengejar" (`init()` set `camX`/`camY` langsung ke target, tidak lewat `updateCamera`) — smoothing cuma kerasa pas karakter mulai/berhenti gerak, bukan pas halaman pertama dibuka.

## Ganti karakter (`#changeCharacterBtn`, `#characterPickerOverlay`)

- Tombol **"🧑 Ganti Karakter"** di atas jendela game membuka overlay picker (`characterPickerOverlay.classList.add("open")` — pola show/hide sama spt modal umum, `display:none` default lalu `.open` jadi `flex`).
- **Tab gender** (Pria/Wanita, `.gender-tab[data-gender]`) menentukan `pickerGender` — daftar yang ditampilkan di grid, **belum tentu** karakter yang lagi dipakai (`currentGender`/`currentFile`). Ganti tab cuma ganti apa yang ditampilkan; karakter beneran baru berubah begitu user klik salah satu thumbnail.
- **Grid thumbnail** (`renderCharacterGrid()`) dibangun murni dari JS (bukan hardcode di HTML) krn jumlahnya banyak (69 file Male + 91 file Female). Tiap thumbnail adalah `<button>` kosong dgn `background-image` = sprite sheet file itu sendiri, `background-position` di-crop ke pose **idle menghadap bawah** (baris 0, kolom tengah — sama spt pose awal karakter) lewat `THUMB_SIZE` (48px, terpisah dari `FRAME` karakter sungguhan) — jadi tidak perlu file preview/thumbnail terpisah, cukup 1 file sprite sheet dipakai dobel (karakter & preview-nya sendiri).
- **Sumber daftar file** (`CHARACTER_FILES.Male`/`.Female`): ditulis eksplisit sbg array literal di `script.js`, **bukan** digenerate dari pola angka (mis. `for i in 1..25`) — krn tidak semua nomor punya keempat varian `-1/-2/-3/-4` lengkap (mis. `Male 18` & `Female 23/24/25` cuma py `-1`). Kalau nanti ada file baru ditambah ke `img/character/Male|Female/`, array ini **harus diupdate manual** biar muncul di picker (tidak otomatis ke-detect, krn JS di browser tidak bisa listing folder di static hosting/`file://`).
- Klik thumbnail → `setCharacterSprite(gender, file)` (update `currentGender`/`currentFile` + `character.style.backgroundImage`) lalu overlay langsung tertutup (`closeCharacterPicker()`) — tidak ada tombol "Terapkan" terpisah, pilih = langsung pakai.
- **Tidak disimpan** (localStorage/Firebase) — ganti karakter cuma di memori, balik ke default Male 01-1 tiap reload halaman, konsisten dgn prototype ini yang memang belum ada persistensi sama sekali (lihat "Rencana / TODO ke depan").
- Ukuran (`FRAME`)/`background-size` karakter **tidak berubah** saat ganti sprite — semua file di `CHARACTER_FILES` dijamin format sama (32×32/frame, 3 kolom × 4 baris), jadi cukup ganti `background-image` saja tanpa perlu resize apa pun.

## Ngomong / chat bubble (`#chatInput`, `#speechBubble`)

- **Tekan Enter** (kapan pun, selama fokus **bukan** di `#chatInput`) → buka `#chatInput` (`openChatInput()`: `hidden = false`, kosongkan value, `.focus()`). Input ini diposisikan **absolute nempel di bawah `#gameWorld`** (lihat "Layout" — sengaja bukan bagian alur normal, biar muncul/hilangnya tidak menggeser posisi kotak game).
- **Tekan Enter lagi** (kali ini fokus **di dalam** `#chatInput`) → submit: input ditutup (`closeChatInput()`), lalu kalau teksnya tidak kosong, tampilkan `#speechBubble` berisi teks itu (`showSpeechBubble()`). Submit dgn input kosong = batal diam-diam (bubble tidak muncul).
- **Satu listener `keydown` di `window`** menangani kedua kasus (buka vs submit) dgn cek `document.activeElement === chatInput` — bukan dua listener terpisah (satu di `window` utk buka, satu di `#chatInput` utk submit), krn kalau dipisah, event `keydown` Enter yang sama akan bubbling dari `#chatInput` ke `window` dan bisa memicu KEDUANYA di satu kali tekan (submit lalu langsung ke-buka lagi). Satu listener dgn branching menghindari masalah itu sekaligus.
- **Bubble jadi child dari `#character`** (bukan child `#worldLayer`/`#gameWorld` terpisah) — otomatis ikut posisi & transform karakter (gerak, kena geser kamera) tanpa perlu hitung posisi manual sama sekali. Posisi CSS `bottom: 100%` (nempel pas di atas kepala karakter) + `left: 50%` & `transform: translateX(-50%)` (center horizontal).
- **Auto-hilang** stlh `BUBBLE_DURATION` (4 detik, `setTimeout` + `clearTimeout` kalau ada bubble baru muncul sebelum yang lama hilang — jadi ngomong lagi sebelum 4 detik langsung reset timer-nya, bukan numpuk 2 timer). Disembunyikan lewat class `.visible` (`opacity`, ada transisi) — bukan `display`, spy bisa fade sederhana.
- **Word-wrap manual maks 30 karakter/baris** (`BUBBLE_MAX_CHARS_PER_LINE`, fungsi `wrapText()`) — teks dipecah jadi array baris di JS (greedy, pecah di spasi selama muat; kata tunggal yg sendirinya udah lebih panjang dari 30 karakter dipaksa dipotong per 30 char) SEBELUM di-render, hasilnya digabung pakai `"\n"` lalu `speechBubble.textContent = ...`. CSS `.speech-bubble` diset `white-space: pre-line` (hormati `\n` manual ini) + `max-width: 32ch` (buffer dikit di atas 30 char, jaga-jaga variasi lebar karakter font). Sengaja **bukan** cuma andalkan CSS `max-width` + word-wrap otomatis browser — krn itu cuma "kira-kira" pas di lebar tertentu (tergantung lebar tiap huruf), sedangkan permintaan user spesifik "maks 30 karakter", bukan "kira-kira muat di sekian piksel".
  - **Bug yang sempat kejadian & fix-nya**: pas awal diimplementasi, bubble malah ke-wrap tiap ~2-3 karakter (jauh lebih agresif dari 30), khususnya kalau isinya satu "kata" tanpa spasi (mis. ngetik berulang tanpa spasi). Penyebabnya BUKAN di `wrapText()` (itu sudah benar), tapi krn `.speech-bubble` posisinya `position: absolute` dgn cuma `left: 50%` (tanpa `right`) & `width` dibiarkan `auto` — utk elemen begini, spec CSS menghitung lebar shrink-to-fit dari SISA RUANG containing block (`.character`, cuma lebar `FRAME`=48px!), bukan dari `max-width` yang di-set. Hasilnya lebar efektif yang dipakai buat wrap jadi jauh lebih sempit dari 32ch yang dimaksud. **Fix**: tambah `width: max-content` eksplisit — ini memaksa lebar dihitung dari kontennya sendiri (bukan dari sisa ruang containing block), `max-width: 32ch` tetap jadi batas atas seperti niat awal. Pelajaran: elemen `position:absolute` dgn cuma satu offset (`left` **atau** `right`, bukan dua-duanya) + `width:auto` itu jebakan umum — kalau containing block-nya kecil, WAJIB kasih `width: max-content` (atau `width` eksplisit) kalau maksudnya mau shrink-to-fit ke konten, bukan ke containing block.
- **Tombol gerak (Arrow/WASD) di-nonaktifkan sementara fokus di `#chatInput`** (guard `if (document.activeElement === chatInput) return;` di listener `keydown` gerak yang sudah ada) — supaya ngetik huruf "w"/"a"/"s"/"d" di pesan tidak ikut menggerakkan karakter. **Tidak** di-guard di listener `keyup` (melepas tombol yang kepencet sebelum fokus pindah ke input tetap harus dibersihkan dari `heldDirections`, apa pun status fokusnya).
- **Belum ada** validasi panjang teks/emoji/sanitasi HTML (`textContent` dipakai, bukan `innerHTML`, jadi otomatis aman dari HTML injection) — juga belum ada riwayat chat atau multiplayer (chat cuma tampilan lokal, tidak dikirim ke mana pun).

## Kenapa bukan CSS `@keyframes` / sprite animation library

Animasi frame (ganti `background-position`) dan pergerakan (`transform: translate`) sama-sama didorong dari JS `requestAnimationFrame`, bukan CSS `@keyframes` — karena animasi jalan **harus start/stop persis mengikuti tombol ditekan/dilepas** (bukan animasi berulang otomatis), dan arah (baris sprite) berubah dinamis tergantung input. `@keyframes` cocok utk animasi yang bentuknya tetap/predictable, kurang cocok utk kontrol interaktif seperti ini.

## Rencana / TODO ke depan

- **Pilih karakter**: sudah ada (lihat "Ganti karakter") — belum ada: pilihan tersimpan (reset ke Male 01-1 tiap reload), dan daftar file di `CHARACTER_FILES` harus diupdate manual kalau ada sprite baru ditambahkan.
- **Map/level**: sudah pakai gambar map sungguhan (`img/samplemap.png`, lihat "Map dunia") & kamera mengikuti karakter **sudah ada** (lihat "Kamera mengikuti karakter") — tapi belum ada collision (karakter bisa jalan tembus sungai/rumah di gambar map), belum ada tile map berbasis data (posisi objek/bangunan tidak diketahui program, cuma gambar statis), dan `img/tileset/` masih kosong (belum dipakai).
- **Kontrol mobile**: kontrol saat ini keyboard-only (Arrow/WASD) — belum ada on-screen d-pad/joystick utk HP, walau prototype dibuka lewat browser mobile.
- Belum ada Firebase/data tersimpan — murni prototype client-side, tidak ada progres yang dipersist.
- Belum ada testing otomatis — project murni HTML/CSS/JS statis, sama seperti trialerror lain.

## Catatan implementasi

- Semua teks UI berbahasa Indonesia.
- **Wajib**: setiap kali ada perubahan struktur/fitur di project ini, update dokumen ini (`trialerror/LittleAdventure/.claude/CLAUDE.md`) di perubahan yang sama — berlaku di semua project dalam repo `iyonadryan.github.io`.
