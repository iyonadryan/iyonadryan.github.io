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
  index.html         # halaman GAME — .game-header (judul, hint kontrol, tombol Ganti Karakter — absolute,
                     # nempel atas, lihat "Layout: header vs #gameWorld"), .game-stage (#gameWorld/kamera >
                     # #worldLayer/dunia > #character > #speechBubble, PLUS #chatInput ngomong — absolute,
                     # nempel di BAWAH #gameWorld, lihat "Layout"), overlay #characterPickerOverlay
                     # (picker Male/Female), & link ke tilemap.html
  style.css          # styling khusus index.html (di atas)
  script.js          # logic khusus index.html: sprite stepping, animasi jalan, kontrol keyboard, kamera
                     # mengikuti karakter, picker ganti karakter, fitur ngomong (chat bubble)
  tilemap.html       # halaman TERPISAH — editor tile map (lihat "Tilemap Editor"), tema gelap sendiri,
                     # TIDAK menggunakan style.css/script.js milik index.html
  tilemap-style.css  # styling khusus tilemap.html
  tilemap-script.js  # logic khusus tilemap.html: layers, tools (brush/fill/erase), undo/redo, tileset
                     # picker, save/load JSON, save/load Firebase, autosave localStorage
  img/
    character/
      Male/      # sprite sheet karakter pria — banyak varian (01 s/d ~25+), tiap nomor
                 # punya beberapa file -1/-2/-3/-4 (variasi warna/outfit sprite sheet yg sama)
      Female/    # sama pola dgn Male/, varian karakter wanita
    samplemap.png  # gambar map dunia (1920×1920px) — dipakai sbg background #worldLayer di index.html
                   # (statis, BEDA dari tileset editable di tilemap.html — lihat "Tilemap Editor")
    tileset/       # aset tileset PIPO (32×32px/tile)
      [Base]BaseChip_pipo.png  # DUPLIKAT file yg sama di SampleMap/ — TIDAK dipakai tilemap.html (lihat SampleMap/ di bawah, itu yg dipakai)
      [A]_type1/, [A]_type2/, [A]_type3/  # varian animasi air/rumput per "musim"/tone warna — belum dipakai editor
      SampleMap/     # ★ INI yang dipakai tilemap.html ★ — 8 file PNG (+ .tsx Tiled pendampingnya, tidak
                     # dibaca tilemap.html, tilemap.html render sendiri bukan baca .tmx/.tsx) jadi 8 tab
                     # tileset tetap di editor (`TILESET_TYPES` di tilemap-script.js): [Base]BaseChip_pipo.png,
                     # LightShadow_pipo.png, [A]Dirt_pipo.png, [A]Flower_pipo.png, [A]Grass_pipo.png,
                     # [A]Wall-Up_pipo.png, [A]Water_pipo.png, [A]WaterFall_pipo.png — lihat "Tileset panel"
  .claude/
    CLAUDE.md    # file ini
```

Belum ada build tool — cukup buka `index.html`/`tilemap.html` langsung di browser (tidak butuh server; Firebase dipakai opsional utk fitur simpan-ke-cloud, lihat "Tilemap Editor").

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

## Tilemap Editor (`tilemap.html`, `tilemap-style.css`, `tilemap-script.js`)

Halaman **terpisah total** dari game (`index.html`) — link dua arah: tombol "🗺️ Tilemap Editor" di `.game-header` index.html → `tilemap.html`, dan link "← Kembali ke Little Adventure" di topbar `tilemap.html` → `index.html`. Dibuat terinspirasi [tilemapstudio.app](https://tilemapstudio.app/) (referensi UI: panel Layers kiri, kanvas+toolbar tengah, panel Tileset kanan), tapi versi jauh lebih sederhana (lihat "Beda dari referensi" di bawah).

Di `index.html`, tombolnya sengaja ditaruh **sebaris & bersebelahan** dgn "🧑 Ganti Karakter" (dibungkus `.header-actions`, `display:flex`) — permintaan eksplisit user biar tombolnya keliatan jelas, bukan link teks kecil terpisah di bawahnya spt versi awal. Styling `.tilemap-link` sengaja **outline** (bukan solid spt `.change-character-btn`) supaya dua-duanya sama-sama jelas sbg tombol tapi "Ganti Karakter" (aksi utama saat main game) tetap terasa lebih menonjol drpd "Tilemap Editor" (tool terpisah, bukan bagian gameplay).

**Kenapa file CSS/JS-nya dipisah dari `style.css`/`script.js` game** (`tilemap-style.css`/`tilemap-script.js`, bukan reuse): dua halaman ini punya kebutuhan UI & tema yang beda total (game = pixel-art/Pixelify Sans/light-blue sky; editor = tool padat teks/angka kecil, tema gelap, font sans-serif biasa spy lebih terbaca) dan tidak berbagi elemen DOM sama sekali — courtesy split biar tiap file tetap fokus ke satu halaman, bukan digabung terus isinya penuh pengecekan "kalau di halaman ini... kalau di halaman itu...".

### Konsep & struktur data

- **Tile size tetap 32×32px** (`TILE_SIZE`), sama persis di SEMUA tileset yg dipakai (lihat "Tileset panel — 8 tipe tetap" di bawah).
- **Model data** (dipegang di `layers` array, tiap elemen 1 layer):
  ```js
  { name: "Background", visible: true, opacity: 1, tilesetType: "Base", layerPosition: -1, tiles: number[] } // tiles: row-major, panjang mapWidth*mapHeight, isi = index tile (row*tilesetCols+col, KOLOM SPESIFIK TILESET tilesetType-nya sendiri) atau -1 (EMPTY/kosong)
  ```
  `layers[0]` = paling belakang/bawah (di-render duluan), index makin besar makin ke depan — tombol "↑ Naik" di panel Layers = pindah ke index lebih besar (ke depan), "↓ Turun" = kebalikannya. List UI di `#layerList` di-render **terbalik** (`for i = layers.length-1; i>=0; i--`) spy layer paling depan tampil PALING ATAS di list, meniru konvensi umum image editor (Photoshop dkk.). Array `layers[]` SELALU terurut menaik by `layerPosition` — lihat "Layer terkunci" di bawah soal kenapa `layerPosition` field terpisah dari sekadar index array.
- **Rendering**: satu `<canvas>` per layer (native resolution `mapWidth*TILE_SIZE` × `mapHeight*TILE_SIZE`, DIBANGUN/DIHAPUS ULANG tiap kali jumlah/urutan layer atau ukuran map berubah — `rebuildLayerCanvases()`), ditumpuk `position:absolute` di dalam `#canvasWrapper`, plus satu `#gridCanvas` paling atas (`pointer-events:none`, cuma gambar garis grid, tidak ikut disave). Tile digambar via `ctx.drawImage(cacheEntry.img, srcX, srcY, 32, 32, destX, destY, 32, 32)` — `cacheEntry` diambil dari `tilesetCache[layer.tilesetType]` **milik layer itu sendiri**, BUKAN dari `#tilesetImg` yg tampil di panel kanan (krn tiap layer bisa beda tileset, sedangkan panel kanan cuma nunjukin SATU tileset — punya layer yg lagi aktif). Lihat "Tileset panel" di bawah.
- **Zoom** (map maupun tileset) murni CSS: ukuran *native* canvas/img tetap tegas, yang di-scale cuma ukuran TAMPILAN (`canvasWrapper.style.width/height` utk map, `tilesetImg.style.width/height` utk tileset, dihitung dari `tilesetCols/Rows * TILE_SIZE * zoom` — BUKAN dari `naturalWidth` biar tidak ada race kondisi timing decode gambar, lihat "Tileset panel") — `image-rendering:pixelated` di kedua tempat spy hasil scale tetap tegas.
- **Hit-testing klik→sel** (baik di kanvas map maupun tileset) pakai rasio posisi klik thd `getBoundingClientRect()` (`xRatio = (clientX-rect.left)/rect.width`, dst.), BUKAN pembagian manual dgn nilai zoom — otomatis benar berapa pun zoom-nya tanpa perlu sinkron variabel zoom ke rumus klik.
- **Bug ditemukan & diperbaiki**: garis grid paling KANAN & paling BAWAH (`renderGrid()`) sempat tidak kelihatan sama sekali (padahal garis-garis lainnya normal). Penyebab: trik "+0.5" pada koordinat garis (standar utk bikin garis 1px kanvas jatuh pas di tengah pixel, tidak blur) mendorong garis TERAKHIR (`col === mapWidth` / `row === mapHeight`, persis di tepi kanvas) 0.5px ke LUAR area kanvas yg valid — jadi ke-clip abis, bukan cuma blur. Garis-garis lain (interior) aman krn +0.5-nya masih dalam batas kanvas. **Fix**: posisi garis di-clamp ke `Math.min(pos + 0.5, canvasSize - 0.5)` — garis interior tidak berubah sama sekali (clamp tidak kena), cuma garis paling tepi yg "didorong balik" dikit ke dalam spy tetap masuk area kanvas & tetap kelihatan.

### Tools

- **Brush**: timpa 1 sel di layer aktif dgn `selectedTile` (tile yg lagi dipilih di panel Tileset kanan, ditandai kotak merah `#tileHighlight`).
- **Erase**: set sel jadi `EMPTY` (-1).
- **Fill**: flood-fill 4-arah (BFS, stack-based) dari sel yg diklik — ganti semua sel bersambung yg nilainya SAMA PERSIS dgn sel awal, jadi `selectedTile`.
- Klik = 1 kali paint; klik-tahan-geser = **continuous paint** otomatis (tidak ada toggle terpisah spt referensi, selalu aktif) — dilacak via `pointerdown`/`pointermove`(di `window`, bukan cuma kanvas, biar tetap kebaca kalau kursor sempat keluar batas kanvas sebentar saat drag)/`pointerup`, dgn `lastPaintedCell` supaya sel yg sama tidak berulang kali di-render ulang selama drag di situ-situ saja.
- **Undo/redo**: snapshot **per-stroke** (satu array `tiles` layer aktif disalin utuh pas `pointerdown`, sebelum stroke itu mengubah apa pun) — bukan per-sel, jadi 1x Ctrl+Z/tombol Undo membatalkan SATU stroke/drag penuh, sesuai ekspektasi umum editor gambar. Maks 50 riwayat (`undoStack` dipotong dari depan kalau kelebihan). Ctrl+Z / Ctrl+Y (atau Ctrl+Shift+Z) jg jalan, diabaikan kalau fokus lagi di `<input>`/`<select>` (spy tidak nyasar pas lagi ngetik nama map).

### Background kanvas & preview tileset (`--preview-bg-*`, permintaan eksplisit user)

- **5 lingkaran warna** (`#bgSwatches` — hitam/putih/hijau/biru/merah) di toolbar, di sebelah "Show Grid". Klik salah satu → `.canvas-scroll` (area map) DAN `.tileset-scroll` (panel Tileset kanan) SAMA-SAMA ganti warna latar (satu kontrol, dua area — dua-duanya awalnya sama-sama hardcode `#10141f`).
- **Kenapa ini dibutuhkan**: beberapa tileset (mis. **Light Shadow**) isinya tile semi-transparan/gelap yg nyaris tidak kelihatan di atas background hitam polos — bisa ganti ke warna lain (putih/hijau/dst.) spy kontras & lebih gampang lihat tile-nya waktu milih/ngecat.
- **Warna asli didefinisikan SEBAGAI CSS variable di `:root`** (`--preview-bg-black`, `--preview-bg-white`, `--preview-bg-green`, `--preview-bg-blue`, `--preview-bg-red`, di `tilemap-style.css`) — permintaan eksplisit user spy gampang di-tweak sendiri nanti (ganti value 1 baris CSS, tidak perlu sentuh JS/HTML). Tiap lingkaran (`.bg-swatch[data-var="..."]`) warnanya diambil dari variable yg sama via attribute selector CSS, BUKAN inline style dari JS — 1 sumber kebenaran.
- **Mekanisme aktif**: ada 1 variable tambahan `--preview-bg-current` (default `var(--preview-bg-black)`), yg dipakai `.canvas-scroll`/`.tileset-scroll` sbg `background`. Klik lingkaran → JS cuma nunjuk ulang `--preview-bg-current` ke variable yg diklik (`document.documentElement.style.setProperty("--preview-bg-current", "var(--preview-bg-green)")`, dst.) — JS TIDAK PERNAH nyimpen/nulis nilai hex literal sendiri.
- **Tidak disimpan** ke `buildMapData()`/autosave — murni preferensi tampilan sesi berjalan, bukan bagian dari data map (beda dari `tilesetType`/`layerPosition` yg memang bagian dari map itu sendiri).

### Tileset panel — 8 tipe tetap, 1 layer = 1 tileset (permintaan eksplisit user)

Awalnya bisa **Import** tileset PNG bebas (`<input type="file">`) — **dihapus total**, diganti 8 tileset TETAP dari `img/tileset/SampleMap/` (`TILESET_TYPES` di `tilemap-script.js`):

| Tab | File |
|---|---|
| Base | `[Base]BaseChip_pipo.png` |
| Light Shadow | `LightShadow_pipo.png` |
| Dirt | `[A]Dirt_pipo.png` |
| Flower | `[A]Flower_pipo.png` |
| Grass | `[A]Grass_pipo.png` |
| Wall Up | `[A]Wall-Up_pipo.png` |
| Water | `[A]Water_pipo.png` |
| Water Fall | `[A]WaterFall_pipo.png` |

Ukuran (kolom×baris) beda-beda per file (dicek langsung dari tiap PNG, bukan diasumsikan sama): Base 8×133, Light Shadow 8×6, Dirt 8×42, Flower 8×12, Grass 8×66, Wall Up 8×12, Water **64×48** (lebar bgt, beda dari yg lain), Water Fall 32×18 — makanya `tilesetCols`/`tilesetRows` SELALU dihitung ulang per tileset (`cache.cols`/`cache.rows`, dari `naturalWidth/naturalHeight / TILE_SIZE` saat preload), tidak pernah di-hardcode 8 kolom spt asumsi awal.

- **Preload SEMUA 8 tileset sekaligus di awal** (`preloadAllTilesets()`, dipanggil sekali di `init()`, editor baru interaktif SETELAH semuanya selesai) — hasilnya disimpan di `tilesetCache` (object: `key -> { img, cols, rows, loaded }`, satu `Image()` in-memory per tipe, TERPISAH dari `#tilesetImg` yg tampil di panel kanan). Alasan preload semua di depan (bukan lazy-load pas dipilih): render layer manapun kapan saja butuh akses ke tileset APA PUN (krn tiap layer bisa beda tipe) — kalau lazy, layer dgn tileset yg belum sempat dimuat bakal gagal render/putih kosong.
- **1 layer = 1 tileset, field `tilesetType` per layer** (bukan lagi satu tileset global bwt semua layer) — field ini WAJIB diisi tiap layer (`createLayer(name, tilesetType)`), default **`"Base"`** utk 2 layer bawaan (Background & Foreground, `initDefaultLayers()`) sesuai permintaan eksplisit user.
- **Panel Tileset kanan SELALU menampilkan tileset milik layer yang lagi AKTIF** (`showTilesetForActiveLayer()`, dipanggil tiap kali `activeLayerIndex` berubah — klik baris layer lain, tambah/hapus layer, load map) — bukan pilihan bebas independen dari layer.
- **Tab (`.tileset-tab`) di panel ini SEKADAR INDIKATOR, bukan tombol ganti tileset** — permintaan eksplisit user. Cuma tab yg cocok dgn `tilesetType` layer aktif yg tampil solid/bisa diklik (`.active`, tapi klik-nya sendiri tidak ngapa-ngapain lagi krn sudah cocok); **7 tab lainnya di-`disabled`** (`updateTilesetTabsActive()` set `btn.disabled = true` utk semua yg bukan tipe aktif — native HTML `disabled`, jadi otomatis tidak bisa diklik sama sekali, bukan cuma gaya visual). Tileset satu layer sekarang **cuma bisa ditentukan sekali, sewaktu layer itu dibuat** (modal Layer Baru, lihat "Layers panel") — tidak ada lagi cara ganti tileset layer yg sudah ada (versi sebelumnya sempat bisa via klik tab + konfirmasi hapus isi, **dihapus** krn permintaan ini).
  - **Saat Block Layer aktif, SEMUA 8 tab jadi disabled** (tidak ada satu pun yg `.active`) — Block Layer bukan salah satu dari 8 tipe ini sama sekali, lihat "Block Layer" di bawah.
- **`selectedTile` di-reset ke 0** tiap kali panel Tileset berganti (ganti layer aktif) — nomor tile lama sudah tidak relevan di tileset baru.
- Label tileset tiap layer ditampilkan di panel Layers kiri (lihat "Layers panel" di bawah) & di info panel kanan (`#tilesetInfo`, format `"<Label> — tile #N (col C, row R)"`).

### Layers panel

- Tombol **+** membuka **modal "Layer Baru"** (`#newLayerModal`) — input nama + WAJIB pilih salah satu dari 8 tab tileset (`newLayerSelectedType`, default "Base") sebelum bisa klik "Buat Layer". Beda dari versi awal yg cuma `prompt()` nama doang — permintaan eksplisit user spy tileset layer baru selalu ditentukan jelas sejak awal, bukan menyusul.
  - **Nama layer baru harus unik** (permintaan eksplisit user) — dicek `confirmNewLayerBtn` thd SEMUA nama layer yg sudah ada (`layers.some(l => l.name.toLowerCase() === name.toLowerCase())`, case-insensitive spy "background" & "Background" jg dianggap tabrakan), termasuk thd 3 layer bawaan terkunci ("Block Layer"/"Background"/"Foreground") — bukan cuma nama layer user lain. Alasan utamanya spy user tidak bisa bikin layer baru pakai nama yg sama persis dgn layer terkunci yg sudah ada (bisa membingungkan, apalagi Background/Foreground tidak py tombol ✏️ jadi tidak kelihatan "asli"-nya yg mana kalau ada 2 layer bernama sama). Gagal → `alert()`, modal TETAP terbuka (pola sama spt validasi nama kosong).
- Tombol **− / ↑ / ↓**: hapus layer aktif (minimal 1 layer harus tetap ada, DAN tidak boleh layer terkunci — lihat "Layer terkunci"), naik/turunkan urutan (tukar posisi di array `layers`, lalu `rebuildLayerCanvases()` krn urutan DOM canvas ikut berubah).
- Tiap baris: tombol mata (👁️/🚫, toggle `visible`), nama layer, **ikon gembok** (🔒, cuma tampil kalau layer terkunci — lihat "Layer terkunci"), **label tileset** (`.layer-tileset-label`, teks kecil di bawah nama — permintaan eksplisit user spy kelihatan tipe tileset yg dipakai tiap layer), slider opacity (0–100%, langsung `renderLayer()` ulang saat digeser). Klik baris (di luar tombol mata) = jadikan layer itu **aktif** (target painting brush/fill/erase berikutnya, DAN otomatis switch panel Tileset kanan ke tileset milik layer itu — lihat "Tileset panel").
- **Ganti nama inline** (bukan lagi klik-ganda + `prompt()`, permintaan eksplisit user): tombol ✏️ di sebelah nama → nama berubah jadi `<input>` di tempat yg sama persis (`editingLayerNameIndex` menyimpan index layer mana yg lagi diedit, di-render ulang lewat `renderLayerList()` yg sama), tombol ✏️ ikut berubah jadi 💾. Klik 💾 (atau Enter di input) → `commitLayerRename()` simpan nama & balik ke tampilan teks biasa; Escape → batal tanpa simpan. Nama kosong/spasi doang diabaikan saat commit (nama lama dipertahankan, bukan dianggap error). Input otomatis fokus+`.select()` begitu muncul (`renderLayerList()` cari `.layer-name-input` di DOM stlh render, panggil `.focus()`/`.select()`) — `editingLayerNameIndex` cuma nyimpen SATU index, jadi maksimal 1 layer yg bisa dalam mode edit bersamaan; klik ✏️ di layer lain sementara satu masih diedit otomatis membatalkan (bukan menyimpan) edit yg sebelumnya blm di-save.
  - **Layer terkunci (Background/Foreground) TIDAK dapat tombol ✏️ sama sekali** (permintaan eksplisit user) — namanya tampil sbg teks polos selamanya, tidak ada cara masuk mode edit dari UI (beda dari cuma "dikunci tapi tombolnya kelihatan/disabled" spt Hapus/Naik/Turun — di sini tombolnya memang tidak pernah dirender utk layer terkunci, lihat `renderLayerList()`).

### Layer terkunci — Background & Foreground tidak bisa dihapus/dipindah (permintaan eksplisit user)

- **`layerPosition`** = field angka TETAP per layer, identitas independen dari nama (ganti nama TIDAK mempengaruhi status kunci): **Background = `-1`**, **Foreground = `0`** — dua-duanya **terkunci** (`isLayerLocked(layer)` → `layer.layerPosition <= 0`). Layer buatan user (lewat modal Layer Baru) SELALU dapat posisi **> 0**, jadi otomatis tidak terkunci.
- **Batas posisi layer user**: `nextUserLayerPosition()` = posisi tertinggi yg sudah dipakai + 1 (mulai dari 1 kalau belum ada layer user sama sekali). Dibatasi maks **98** (`USER_LAYER_MAX_POSITION`) — kalau sudah 98 layer user (posisi 1-98 semua kepakai), tombol **+**/modal Layer Baru menolak bikin layer baru lagi (`alert()`, dicek di 2 tempat: `openNewLayerModal()` sebelum modal dibuka, & `confirmNewLayerBtn` sblm benar-benar push — dobel jaga-jaga).
- **Warna card beda per jenis layer terkunci** (permintaan eksplisit user): Block Layer → merah (`.layer-row--block`), Background & Foreground → coklat (`.layer-row--basefg`) — layer user biasa tetap warna default (`--bg-panel-alt`). Class ditentukan di `renderLayerList()` dari `layer.layerPosition` (`=== BLOCK_LAYER_POSITION` → merah, `<= LOCKED_MAX_POSITION` → coklat), BUKAN dari nama — konsisten dgn `isLayerLocked()` yg jg pakai posisi, bukan nama (nama bisa diganti user tanpa mempengaruhi identitas/kuncinya). Tiap varian py versi `.active` sendiri (background sedikit lebih terang, border tetap `var(--accent)`) spy status "sedang dipilih" tetap kebaca di atas warna custom-nya.
- **Ikon 🔒** (`.layer-lock-icon`) muncul di baris layer terkunci, di sebelah nama — MURNI indikator visual, penegakan aturannya sendiri ada di 3 tempat lain:
  - `removeLayerBtn`: `alert()` + batal kalau `isLayerLocked(layers[activeLayerIndex])`.
  - `moveLayerUpBtn`/`moveLayerDownBtn`: dicek DUA arah — layer aktif sendiri tidak boleh terkunci, DAN layer tetangga yg mau ditukar posisinya (`layers[activeLayerIndex ± 1]`) juga tidak boleh terkunci. Cek kedua ini penting krn layer user paling bawah bertetangga langsung dgn Foreground (posisi 0) — tanpa cek ini, "Turun" dari situ akan nyoba nuker DENGAN Foreground yg terkunci.
  - `renderLayerList()`: tombol Hapus/Naik/Turun di-`disabled` (native HTML, bukan cuma gaya) berdasar status kunci layer AKTIF + tetangganya — user tidak akan lihat tombolnya kelihatan bisa diklik padahal ditolak diam-diam.
- **Tukar posisi (Naik/Turun) menukar NILAI `layerPosition` juga**, bukan cuma posisi di array `layers[]` — supaya field-nya selalu akurat mencerminkan urutan render yg sesungguhnya (penting jg utk `buildMapData()`/save).
- **Migrasi file lama** (`migrateLayerPositions()`): map JSON v1/v2 (sebelum fitur ini ada) tidak punya `layerPosition` sama sekali — ditebak dari NAMA layer (`"Background"` persis → -1, `"Foreground"` persis → 0, selain itu → posisi user berurutan mulai 1). **Batasan yg disadari**: kalau user sempat ganti nama Background/Foreground SEBELUM sempat save ulang di versi baru ini, tebakannya meleset (dianggap layer user biasa, jadi TIDAK terkunci) — tidak ada cara lain menebak identitas asli dari file lama yg format-nya memang belum menyimpan info itu.
  - **Nama tileset di label dibungkus badge kapsul berwarna** (`.tileset-badge` — `border-radius:999px`, teks tebal+putih, permintaan eksplisit user) — warnanya beda per tipe (`TILESET_TYPES[].color`, satu field warna tetap per entry, mis. Grass hijau `#16a34a`, Flower pink `#db2777`, Water biru `#0284c7`) biar bisa bedain sekilas pandang layer mana pakai tileset apa tanpa perlu baca teksnya dulu. Warna diisi via `badge.style.background` di JS (bukan class CSS per tipe) krn sumbernya satu tempat (`TILESET_TYPES`), bukan didup di CSS.

### Block Layer — layer khusus red block, selalu paling atas (permintaan eksplisit user)

Satu layer **singleton** tambahan (bukan dibuat lewat modal Layer Baru spt layer biasa) — dibuat sekali di `createBlockLayer()`, dipanggil dari `initDefaultLayers()` bareng Background/Foreground. Beda total dari layer biasa krn dia bukan tileset gambar sama sekali, cuma satu warna solid tetap.

- **`layerPosition: 99`** (`BLOCK_LAYER_POSITION`) — SELALU tertinggi/paling depan, krn `nextUserLayerPosition()` sengaja cuma menghitung max di antara posisi `< 99` (layer user tetap dibatasi maks posisi 98, lihat "Layer terkunci" di atas — 99 bukan bagian dari kuota itu).
- **Terkunci spt Background/Foreground** (`isLayerLocked()` diperluas: `layerPosition <= 0 || layerPosition === 99`) — tidak bisa dihapus/dipindah urutan, DAN (krn aturan "layer terkunci tidak dapat tombol ✏️", lihat "Layers panel") juga tidak bisa diganti nama.
- **`tilesetType: "Block"`** (`BLOCK_TILESET_KEY`) — sengaja BUKAN salah satu entry `TILESET_TYPES` (8 tileset gambar asli), dicek lewat `isBlockLayer(layer)` (`layer.tilesetType === "Block"`). `tilesetLabel()`/`tilesetColor()` meng-intercept key ini duluan sebelum fallback ke `tilesetTypeDef()` — badge di panel Layers otomatis tampil **"Red Block"** warna `#dc2626`, tanpa perlu entry tambahan di `TILESET_TYPES` (yg emang cuma utk tileset gambar).
- **Semua 8 tab Tileset di-disable** saat Block Layer aktif (`showTilesetForActiveLayer()` cabang khusus) — `updateTilesetTabsActive("Block")` otomatis bikin SEMUA tab non-aktif krn tidak ada satu pun `data-key` yg cocok dgn `"Block"`, jadi tidak perlu logic tambahan di fungsi itu sendiri. Preview tileset (`#tilesetImg`/`#tileHighlight`) disembunyikan (`display:none`) & info panel (`#tilesetInfo`/`#statusSelectedTile`) diisi teks statis "Red Block — otomatis, tidak pakai tileset" — bukan `cache.cols`/`cache.rows` spt layer biasa (`tilesetCache["Block"]` memang sengaja tidak pernah ada).
- **Grid 4× lebih rapat, sel 4× lebih kecil, luas piksel TETAP SAMA** (`BLOCK_SUBDIVISION = 4`, permintaan eksplisit user): kolom/baris efektif Block Layer = `mapWidth/mapHeight * 4`, tapi tiap sel cuma `BLOCK_TILE_SIZE = TILE_SIZE / 4` (8px, bukan 32px) — hasil kali keduanya (`cols * cellSize`) sama persis dgn layer biasa (`mapWidth * TILE_SIZE`), jadi kanvas Block Layer selalu ukuran fisik sama dgn layer lain di tumpukan yg sama, tanpa perlu penanganan khusus di `rebuildLayerCanvases()` (yg emang nyetel semua kanvas ke `mapWidth*TILE_SIZE` × `mapHeight*TILE_SIZE` apa adanya).
  - **`layerGridDims(layer)`/`layerGridDimsFor(layer, w, h)`** — helper generik "berapa kolom/baris/piksel-per-sel yg berlaku utk layer INI", beda utk Block Layer (`{cols: w*4, rows: h*4}`, `cellSize: 8`) drpd layer biasa (`{cols: w, rows: h}`, `cellSize: 32`). Dipakai di SEMUA tempat yg perlu tau grid: `renderLayer()`, `setCellIncremental()`, `floodFill()`, `cellFromEvent()`, `paintAt()`, `resizeMapTo()` — sengaja tidak ada satu pun tempat lagi yg hardcode `mapWidth`/`mapHeight`/`TILE_SIZE` langsung tanpa lewat helper ini, biar nambah jenis layer khusus lain nanti (kalau ada) tidak perlu ubah banyak tempat.
  - Versi `...For(layer, w, h)` (nerima `w`/`h` eksplisit) dipakai khusus `resizeMapTo()` yg butuh dimensi LAMA & BARU sekaligus (sebelum & sesudah `mapWidth`/`mapHeight` global di-update) — versi tanpa `For` pakai `mapWidth`/`mapHeight` yg sedang berlaku, dipakai semua tempat lain.
- **Render**: `renderLayer()` cabang Block Layer gambar `ctx.fillRect()` warna solid `BLOCK_COLOR = "rgba(220, 38, 38, 0.5)"` (merah, opacity 50% BAKED IN ke warnanya sendiri, bukan lewat `layer.opacity`/slider) per sel yg terisi — BUKAN `drawImage` dari `tilesetCache` spt layer biasa.
- **Painting**: `paintAt()` **memaksa** nilai yg diisi jadi `BLOCK_TILE_VALUE` (`0`, bukan `-1`/EMPTY) kalau `isBlockLayer(layer)`, mengabaikan `selectedTile` sepenuhnya (yg toh juga tidak relevan krn tidak ada tileset dipilih) — "diklik hanya mengisi red block" persis sesuai permintaan, berlaku sama utk Brush maupun Fill (`floodFill`). Erase tetap set `EMPTY` spt biasa.
- **Resize** (`resizeMapTo()`): pakai `layerGridDimsFor()` utk hitung dimensi LAMA & BARU per-layer, jadi Block Layer di-resize dgn kelipatan 4 (mis. Lebar 15→10 di UI = kolom Block Layer 60→40) sementara UI Lebar/Tinggi (`#mapWidthInput`/`#mapHeightInput`) TETAP menampilkan angka satuan layer normal (15/10) — pengguna tidak pernah lihat/input angka internal ×4 itu.
- **Save/Load**: `buildMapData()` tidak butuh perubahan (Block Layer disimpan sama spt layer lain — `tilesetType: "Block"`, `layerPosition: 99`, `tiles` array yg lebih panjang). Dua penyesuaian di `applyMapData()`:
  1. Validasi `tilesetType` yg sebelumnya cuma menerima 8 key `TILESET_TYPES` (fallback ke `"Base"` kalau tidak cocok, buat file v1 lama) diperluas menerima `"Block"` juga — tanpa ini, memuat file yg py Block Layer bakal DIAM-DIAM mengubahnya jadi layer Base biasa (bug nyata yg ditemukan & diperbaiki saat testing fitur ini).
  2. **Fallback auto-create**: kalau file yg dimuat (JSON lama/autosave lama/Firebase lama, dibuat SEBELUM fitur ini ada) tidak punya layer posisi 99 sama sekali, `applyMapData()` otomatis `push(createBlockLayer())` supaya map manapun selalu berakhir dgn Block Layer ada — konsisten dgn sifatnya sbg singleton yg TIDAK punya cara dibuat ulang manual dari UI (beda dari layer biasa yg bisa dibuat kapan saja lewat modal +).
- **Diuji end-to-end** (Playwright + Edge headless, pola sama spt fitur lain di project ini): singleton position/lock/badge/no-pencil-icon benar, 8 tab Tileset ke-disable saat aktif, Brush/Erase/Fill mengisi/menghapus warna merah 50% opacity persis di grid 4× lebih rapat (dicek lewat sampling piksel kanvas, bukan cuma visual), Remove/Naik/Turun ter-disable, resize (kecil→besar→balik) tidak crash & Block Layer tetap ada, dan round-trip penuh lewat autosave→reload (`tryRestoreAutosave()` incl. dialog `confirm()`) mempertahankan `tilesetType`/`layerPosition`/isi piksel dgn benar.

**Bug ditemukan & diperbaiki stlh fitur ini pertama kali jalan** (2 bug terkait, ditemukan user):

1. **Layer baru muncul DI ATAS Block Layer di panel** (seharusnya selalu DI BAWAHNYA) — penyebab: tombol **+**/modal Layer Baru pakai `layers.push(...)` (nambah di UJUNG array), padahal Block Layer (posisi 99) HARUS selalu jadi elemen TERAKHIR supaya invariant "layers[] terurut menaik by `layerPosition`" (lihat "Layer terkunci" di atas) tetap terjaga — push ke ujung nyelipin layer baru SETELAH Block Layer, merusak urutan itu utk selamanya (Block Layer permanen "terjebak" di tengah array), yg jg berakibat urutan tampil di panel (`renderLayerList()` iterasi array TERBALIK) jadi salah: layer baru tampil di atas Block Layer, bukan di bawahnya. **Fix**: cari index Block Layer (`layers.findIndex(l => l.layerPosition === BLOCK_LAYER_POSITION)`), lalu `layers.splice(blockIdx, 0, layerBaru)` — nyisip TEPAT SEBELUM Block Layer, bukan `push()` ke ujung. Ini jg otomatis membenarkan urutan tumpukan kanvas (`rebuildLayerCanvases()` bikin kanvas per elemen array berurutan, kanvas yg dibikin BELAKANGAN nempel di atas secara DOM — dgn fix ini kanvas Block Layer selalu dibikin PALING TERAKHIR/paling atas lagi, sesuai maksud aslinya).
2. **Tombol "Naik" tidak simetris dgn "Turun" soal cek tetangga terkunci**: `moveLayerDownBtn.disabled` sudah benar cek `isLayerLocked(layers[activeLayerIndex - 1])` (tetangga di bawah), tapi `moveLayerUpBtn.disabled` SEBELUMNYA cuma cek `activeLayerIndex >= layers.length - 1` (asumsi implisit: tetangga di ATAS tidak pernah terkunci — benar SEBELUM Block Layer ada, krn dulu tidak ada layer terkunci yg posisinya di atas layer user manapun). Begitu bug #1 di atas diperbaiki (Block Layer balik jadi elemen array PALING TERAKHIR yg sesungguhnya), layer user paling atas (persis di bawah Block Layer) jadi berada di index `layers.length - 2`, BUKAN lagi `length - 1` — cek lama jadi `false` (tombol Naik keliatan AKTIF/bisa diklik), padahal harusnya tetap disabled krn tetangganya (Block Layer) terkunci. Klik-nya sendiri sebenarnya tetap aman (handler `moveLayerUpBtn` sudah py pengecekan `isLayerLocked` terpisah yg mencegah swap beneran terjadi), tapi tombolnya scr visual keliru tampil bisa diklik. **Fix**: tambah `|| isLayerLocked(layers[activeLayerIndex + 1])` ke kondisi disable Naik, persis simetris dgn Turun — layer user paling atas (langsung di bawah Block Layer) sekarang disabled Naik-nya krn alasan yg BENAR (tetangga terkunci), bukan lagi kebetulan dari cek posisi array yg sudah tidak relevan.

### Save/Load — kenapa JSON, bukan plain text

**Direkomendasikan & yang diimplementasikan: JSON**, bukan format teks custom, alasannya:
1. **Struktur bersarang** (banyak layer, tiap layer array puluhan-ratusan angka tile) canggung direpresentasikan rata sbg teks tanpa bikin parser/format ad-hoc sendiri (mis. CSV multi-level) — JSON sudah punya cara alami merepresentasikan ini (`layers: [ {tiles: [...]}, ... ]`).
2. **Native di JavaScript** — `JSON.stringify`/`JSON.parse` bawaan, tidak perlu nulis parser custom sama sekali (beda dari format teks bikinan sendiri yg butuh parser+writer manual, rawan bug edge-case spt delimiter yg kepakai di dalam data).
3. **Match 1:1 dgn Firebase Realtime Database** — Firebase RTDB **secara native menyimpan data sbg pohon JSON**. Objek hasil `buildMapData()` bisa LANGSUNG di-`.set()` ke Firebase maupun didownload sbg file `.json`, tanpa transformasi/konversi format apa pun di antara keduanya — satu fungsi (`buildMapData()`) melayani kedua tujuan sekaligus.
- **Save JSON** (`saveJsonBtn`): `Blob` + elemen `<a download>` sementara → file `<namaMap>.json` ke folder Downloads browser.
- **Load JSON** (`loadJsonBtn` → `<input type="file">` tersembunyi): `FileReader.readAsText` → `JSON.parse` → `applyMapData()` (rebuild layers, canvas, tileset, dsb. — dibungkus `try/catch`, gagal parse cuma nampilin pesan error di status bar, bukan crash halaman).
- **Format `buildMapData()`** (**`version: 3`** — v2 naik dari v1 krn `tilesetType` per-layer, v3 naik dari v2 krn tambahan `layerPosition` per-layer, lihat "Layer terkunci" & catatan compat di bawah):
  ```json
  {
    "version": 3,
    "tileSize": 32,
    "mapWidth": 25, "mapHeight": 19,
    "layers": [
      { "name": "Background", "visible": true, "opacity": 1, "tilesetType": "Base", "layerPosition": -1, "tiles": [-1, 12, 12, ...] },
      { "name": "Foreground", "visible": true, "opacity": 1, "tilesetType": "Grass", "layerPosition": 0, "tiles": [-1, -1, 45, ...] }
    ]
  }
  ```
  Field global v1 (`tilesetSrc`/`tilesetCols`/`tilesetRows`) **dihapus** — sudah tidak relevan krn tileset sekarang per-layer (`tilesetType`), bukan satu tileset berlaku bwt semua layer. **Backward-compat**: `applyMapData()` fallback `tilesetType` ke `"Base"` kalau memuat file v1 lama yg tidak punya field itu sama sekali (drpd gagal/`undefined`), & `layerPosition` ditebak dari nama layer kalau file v1/v2 lama tidak punya field itu (`migrateLayerPositions()`, lihat "Layer terkunci") — user perlu cek ulang manual tileset & status kunci tiap layer setelah muat file selawas itu.

### Simpan/muat ke Firebase

- **Project Firebase SAMA PERSIS dgn app lain di repo ini** (`iyon-adryanlf-trialerror`, SDK compat v8.10.1, config disalin apa adanya dari `app/finance/index.html`) — path baru **`trial-error/littleAdventure/tilemaps/<nama>`** (permintaan eksplisit user; top-level `trial-error` dipakai sbg namespace bareng, `littleAdventure` sub-node khusus project ini, `tilemaps` khusus data map — nyisain ruang kalau ke depan ada data lain punya Little Adventure yg jg mau disimpan di Firebase, mis. save-game).
- Input nama map (`#mapNameInput`) di-**sanitize** (`sanitizeKey()`: karakter `. # $ [ ] /` diganti `_`, krn karakter itu terlarang jadi key Firebase) sebelum dipakai sbg path.
- **Simpan** (`saveFirebaseBtn`): `db.ref("trial-error/littleAdventure/tilemaps/"+key).set(buildMapData())` — timpa penuh kalau nama sudah ada (bukan merge), lalu refresh daftar dropdown.
- **Muat** (`#firebaseMapSelect`, populated dari `db.ref("trial-error/littleAdventure/tilemaps").once("value")` — list semua key/nama map tersimpan): pilih dari dropdown langsung `applyMapData()` (tidak perlu tombol "Load" terpisah, ganti pilihan = langsung muat).
- **Belum ada auth** — path ini publik readable/writable, sama seperti semua app lain di repo (lihat pola serupa di `app/.claude/*.md`).
- **Rules Firebase console PERLU ditambahkan manual** sebelum fitur ini benar-benar jalan — path `trial-error` belum tentu otomatis dapat `.write:true` di rules Realtime Database (beda node top-level = beda entry di rules), kalau belum ada bakal muncul error `permission_denied` pas simpan/muat/refresh daftar. Cek console Firebase project `iyon-adryanlf-trialerror` kalau fitur cloud ini gagal — pola sama dgn app lain (lihat "Rencana / TODO ke depan" app-app di `app/.claude/*.md`).

### Autosave lokal (`localStorage`)

Jaring pengaman **murni lokal**, bukan pengganti Save JSON/Firebase manual — tiap ada perubahan (painting, resize, ganti layer, dll.) dijadwalkan (`scheduleAutosave()`, debounce 600ms biar tidak nulis `localStorage` tiap gerakan kuas) nulis snapshot penuh (`buildMapData()`) ke `localStorage["littleadventure_tilemap_autosave"]`. Saat halaman dibuka, kalau ada draft tersimpan → `confirm()` tawarkan pulihkan (`tryRestoreAutosave()`); kalau ditolak/tidak ada, mulai dari map kosong default (`DEFAULT_MAP_WIDTH`×`DEFAULT_MAP_HEIGHT` = 25×19).

### Beda dari referensi (tilemapstudio.app) — sengaja disederhanakan

- **Tidak ada** multi-tile pattern brush (referensi bisa pilih blok 4×4 tile sekali jalan) — cuma 1 tile per klik.
- **Tidak ada** Shapes/Select tool, Rotate/Flip tile, L/R Swap.
- **Tidak ada** "Hide Tileset"/"Hide Layers" toggle collapse panel (panel Layers & Tileset selalu tampil).
- Screenshot capture (kamera icon di referensi) tidak ada — export cuma lewat Save JSON/Firebase, bukan gambar PNG hasil render map.
- **Import tileset bebas (`<input type="file">`) sempat ada, lalu DIHAPUS** — diganti 8 tab tileset tetap dari `img/tileset/SampleMap/`, permintaan eksplisit user (lihat "Tileset panel — 8 tipe tetap"). Beda dari referensi yg tetap punya tombol Import bebas.

### Belum terhubung ke game (`index.html`) — masih tool berdiri sendiri

Map yg dibuat/disimpan di sini **belum otomatis dipakai** `index.html`/`script.js` (yang masih pakai `img/samplemap.png` statis, lihat "Map dunia") — tilemap.html murni alat bikin & simpan data map dulu. Menyambungkannya (render map JSON hasil editor ini jadi `#worldLayer` game, gantiin gambar statis) adalah pekerjaan terpisah ke depan (lihat "Rencana / TODO ke depan") krn butuh mengganti pendekatan render `#worldLayer` dari 1 `background-image` jadi tumpukan `<canvas>`/gambar per-tile spt di editor ini.

## Kenapa bukan CSS `@keyframes` / sprite animation library

Animasi frame (ganti `background-position`) dan pergerakan (`transform: translate`) sama-sama didorong dari JS `requestAnimationFrame`, bukan CSS `@keyframes` — karena animasi jalan **harus start/stop persis mengikuti tombol ditekan/dilepas** (bukan animasi berulang otomatis), dan arah (baris sprite) berubah dinamis tergantung input. `@keyframes` cocok utk animasi yang bentuknya tetap/predictable, kurang cocok utk kontrol interaktif seperti ini.

## Rencana / TODO ke depan

- **Pilih karakter**: sudah ada (lihat "Ganti karakter") — belum ada: pilihan tersimpan (reset ke Male 01-1 tiap reload), dan daftar file di `CHARACTER_FILES` harus diupdate manual kalau ada sprite baru ditambahkan.
- **Map/level**: sudah pakai gambar map sungguhan (`img/samplemap.png`, lihat "Map dunia") & kamera mengikuti karakter **sudah ada** (lihat "Kamera mengikuti karakter") — tapi belum ada collision (karakter bisa jalan tembus sungai/rumah di gambar map), dan gambar map itu masih statis (bukan tile map berbasis data). **Tilemap Editor** (`tilemap.html`, lihat "Tilemap Editor") sudah bisa bikin & simpan map berbasis data (JSON/Firebase) pakai aset `img/tileset/`, tapi **belum disambungkan** ke `index.html` — game masih render `img/samplemap.png` statis, belum baca output editor ini.
- **Kontrol mobile**: kontrol saat ini keyboard-only (Arrow/WASD) — belum ada on-screen d-pad/joystick utk HP, walau prototype dibuka lewat browser mobile.
- **Firebase**: `tilemap.html` sudah terhubung (simpan/muat map JSON ke `trial-error/littleAdventure/tilemaps/`, lihat "Tilemap Editor") — **rules Firebase console utk path `trial-error` perlu dicek/ditambahkan manual** (belum dikonfirmasi bisa tulis, lihat "Simpan/muat ke Firebase"). `index.html` (game-nya sendiri) masih murni client-side, tidak ada progres/save-game yang dipersist.
- Belum ada testing otomatis — project murni HTML/CSS/JS statis, sama seperti trialerror lain.

## Catatan implementasi

- Semua teks UI berbahasa Indonesia.
- **Wajib**: setiap kali ada perubahan struktur/fitur di project ini, update dokumen ini (`trialerror/LittleAdventure/.claude/CLAUDE.md`) di perubahan yang sama — berlaku di semua project dalam repo `iyonadryan.github.io`.
