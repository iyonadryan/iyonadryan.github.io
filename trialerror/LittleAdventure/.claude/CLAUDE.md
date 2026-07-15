# CLAUDE.md — Little Adventure

Prototype game petualangan 2D pixel-art di `trialerror/LittleAdventure/`. Tahap ini **fokus murni ke animasi & pergerakan karakter** — belum ada NPC, musuh, atau pilihan karakter. Satu karakter yang bisa jalan 4 arah di atas gambar map sungguhan (`img/samplemap.png`), dengan kamera yang mengikuti karakter secara smooth (lihat "Kamera mengikuti karakter").

---

## Tech Stack

- **Frontend:** HTML5 + CSS3 + Vanilla JavaScript (tanpa framework/build tool)
- **Bahasa UI:** Indonesia
- **Aset:** sprite sheet pixel-art PNG (lihat "Aset karakter" di bawah)

---

## Struktur File

```
LittleAdventure/
  index.html     # halaman prototype — judul, hint kontrol, #gameWorld (kamera) > #worldLayer (dunia) > #character
  style.css      # styling jendela kamera, dunia (skala/posisi diisi lewat JS), & properti statis karakter
  script.js      # semua logic: sprite stepping, animasi jalan, kontrol keyboard, kamera mengikuti karakter
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

## Aset karakter (`img/character/Male/`, `img/character/Female/`)

Tiap file adalah **satu sprite sheet 3 kolom × 4 baris**, ukuran asli 96×128px (1 frame = 32×32px). Konvensi baris (dicek langsung dari sample `Male 01-1.png`, berlaku sama utk semua file lain di kedua folder):

| Baris | Arah |
|---|---|
| 0 (paling atas) | Jalan ke **bawah** |
| 1 | Jalan ke **kiri** |
| 2 | Jalan ke **kanan** |
| 3 (paling bawah) | Jalan ke **atas** |

Kolom: **0 & 2** = pose kaki melangkah (kiri/kanan), **1 (tengah)** = pose idle/diam — dipakai juga sbg frame "netral" di tengah siklus animasi jalan.

Prototype ini baru pakai **satu file hardcoded**: `img/character/Male/Male 01-1.png` (dikonfigurasi lewat konstanta `SPRITE_SRC` di `script.js`). Varian lain (nomor 02, 03, dst., suffix `-2`/`-3`/`-4`, dan seluruh isi `Female/`) belum dipakai sama sekali — belum ada UI pilih karakter (lihat "Rencana / TODO").

`Male/`/`Female/` awalnya langsung di dalam `img/` (sejajar), dipindah ke dalam `img/character/` supaya `img/` bisa menampung jenis aset lain ke depan (tile map, objek, UI, dll.) tanpa tercampur rata dgn sprite karakter.

## Cara kerja animasi & pergerakan (`script.js`)

- **Stepping sprite via `background-position`**: `#character` adalah satu `<div>` kosong dengan `background-image` = sprite sheet, `background-size` = ukuran penuh sheet (sudah diskala), lalu tiap frame animasi cukup ganti `background-position` ke `-(kolom×FRAME)px -(baris×FRAME)px`. Tidak pakai `<img>`/canvas — dipilih krn paling sederhana utk kasus sprite sheet statis begini.
- **Skala pixel-art**: sprite asli 32×32px dikali `SCALE = 1.5` jadi 48×48px per frame (konstanta `FRAME_SRC`/`SCALE`/`FRAME` di `script.js`, ukuran karakter di layar diminta 48×48 secara eksplisit) supaya kelihatan jelas di layar modern. `image-rendering: pixelated` di CSS supaya hasil scale tetap tegas (tidak blur/anti-alias).
- **Siklus animasi jalan**: `WALK_FRAMES = [1, 0, 1, 2]` (tengah → kiri → tengah → kanan, berulang), ganti frame tiap `FRAME_DURATION` (140ms) selama ada arah yang ditahan. Berhenti bergerak → langsung balik ke `IDLE_FRAME` (kolom tengah) di baris arah hadap terakhir (`facing`), bukan freeze di pose kaki melangkah.
- **Kontrol**: Arrow keys **dan** WASD sama-sama jalan (`KEY_TO_DIR`), `e.preventDefault()` di keydown biar panah tidak ikut men-scroll halaman.
- **Multi-tombol ditahan sekaligus**: `heldDirections` adalah **array berurutan** (bukan `Set`) — arah yang dipakai gerak/animasi selalu elemen **paling akhir** (paling baru ditekan & masih ditahan). Efeknya: kalau user menekan Kanan lalu (tanpa lepas) menekan Atas, karakter langsung menghadap/jalan Atas; begitu Atas dilepas, otomatis balik jalan Kanan (bukan berhenti total) selama Kanan masih ditahan. Dilepas semua → berhenti & idle.
- **Loop gerak**: satu `requestAnimationFrame` loop (`loop()`), delta time dinormalisasi ke satuan "per frame 60fps" (`dt = (time - lastTime) / (1000/60)`) supaya `SPEED` (px per frame) konsisten di refresh rate layar berapa pun.
- **Batas dunia**: posisi karakter (`x`, `y`) — dalam koordinat **dunia** (`#worldLayer`), bukan koordinat layar — di-clamp ke `[0, WORLD_WIDTH/HEIGHT - FRAME]` tiap frame gerak, jadi karakter tidak bisa jalan keluar gambar map.
- **Kehilangan fokus window**: listener `blur` mengosongkan `heldDirections` supaya karakter tidak "nyangkut" jalan terus kalau user pindah tab/app saat tombol masih dianggap tertekan oleh browser.

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

## Kenapa bukan CSS `@keyframes` / sprite animation library

Animasi frame (ganti `background-position`) dan pergerakan (`transform: translate`) sama-sama didorong dari JS `requestAnimationFrame`, bukan CSS `@keyframes` — karena animasi jalan **harus start/stop persis mengikuti tombol ditekan/dilepas** (bukan animasi berulang otomatis), dan arah (baris sprite) berubah dinamis tergantung input. `@keyframes` cocok utk animasi yang bentuknya tetap/predictable, kurang cocok utk kontrol interaktif seperti ini.

## Rencana / TODO ke depan

- **Pilih karakter**: UI utk memilih dari `img/character/Male/`/`img/character/Female/` (banyak nomor & varian outfit) — saat ini masih hardcode `Male 01-1.png` di `SPRITE_SRC`.
- **Map/level**: sudah pakai gambar map sungguhan (`img/samplemap.png`, lihat "Map dunia") & kamera mengikuti karakter **sudah ada** (lihat "Kamera mengikuti karakter") — tapi belum ada collision (karakter bisa jalan tembus sungai/rumah di gambar map), belum ada tile map berbasis data (posisi objek/bangunan tidak diketahui program, cuma gambar statis), dan `img/tileset/` masih kosong (belum dipakai).
- **Kontrol mobile**: kontrol saat ini keyboard-only (Arrow/WASD) — belum ada on-screen d-pad/joystick utk HP, walau prototype dibuka lewat browser mobile.
- Belum ada Firebase/data tersimpan — murni prototype client-side, tidak ada progres yang dipersist.
- Belum ada testing otomatis — project murni HTML/CSS/JS statis, sama seperti trialerror lain.

## Catatan implementasi

- Semua teks UI berbahasa Indonesia.
- **Wajib**: setiap kali ada perubahan struktur/fitur di project ini, update dokumen ini (`trialerror/LittleAdventure/.claude/CLAUDE.md`) di perubahan yang sama — berlaku di semua project dalam repo `iyonadryan.github.io`.
