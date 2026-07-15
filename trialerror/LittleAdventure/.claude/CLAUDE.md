# CLAUDE.md — Little Adventure

Prototype game petualangan 2D pixel-art di `trialerror/LittleAdventure/`. Tahap ini **fokus murni ke animasi & pergerakan karakter** — belum ada map/level, NPC, musuh, atau pilihan karakter. Sekadar satu karakter yang bisa jalan 4 arah di dalam kotak dunia statis.

---

## Tech Stack

- **Frontend:** HTML5 + CSS3 + Vanilla JavaScript (tanpa framework/build tool)
- **Bahasa UI:** Indonesia
- **Aset:** sprite sheet pixel-art PNG (lihat "Aset karakter" di bawah)

---

## Struktur File

```
LittleAdventure/
  index.html     # halaman prototype — judul, hint kontrol, div #gameWorld + #character
  style.css      # styling dunia (kotak "tanah") & properti statis karakter
  script.js      # semua logic: sprite stepping, animasi jalan, kontrol keyboard
  img/
    Male/        # sprite sheet karakter pria — banyak varian (01 s/d ~25+), tiap nomor
                 # punya beberapa file -1/-2/-3/-4 (variasi warna/outfit sprite sheet yg sama)
    Female/      # sama pola dgn Male/, varian karakter wanita
  .claude/
    CLAUDE.md    # file ini
```

Belum ada build tool — cukup buka `index.html` langsung di browser (tidak butuh Firebase/server, murni client-side).

## Aset karakter (`img/Male/`, `img/Female/`)

Tiap file adalah **satu sprite sheet 3 kolom × 4 baris**, ukuran asli 96×128px (1 frame = 32×32px). Konvensi baris (dicek langsung dari sample `Male 01-1.png`, berlaku sama utk semua file lain di kedua folder):

| Baris | Arah |
|---|---|
| 0 (paling atas) | Jalan ke **bawah** |
| 1 | Jalan ke **kiri** |
| 2 | Jalan ke **kanan** |
| 3 (paling bawah) | Jalan ke **atas** |

Kolom: **0 & 2** = pose kaki melangkah (kiri/kanan), **1 (tengah)** = pose idle/diam — dipakai juga sbg frame "netral" di tengah siklus animasi jalan.

Prototype ini baru pakai **satu file hardcoded**: `img/Male/Male 01-1.png` (dikonfigurasi lewat konstanta `SPRITE_SRC` di `script.js`). Varian lain (nomor 02, 03, dst., suffix `-2`/`-3`/`-4`, dan seluruh isi `Female/`) belum dipakai sama sekali — belum ada UI pilih karakter (lihat "Rencana / TODO").

## Cara kerja animasi & pergerakan (`script.js`)

- **Stepping sprite via `background-position`**: `#character` adalah satu `<div>` kosong dengan `background-image` = sprite sheet, `background-size` = ukuran penuh sheet (sudah diskala), lalu tiap frame animasi cukup ganti `background-position` ke `-(kolom×FRAME)px -(baris×FRAME)px`. Tidak pakai `<img>`/canvas — dipilih krn paling sederhana utk kasus sprite sheet statis begini.
- **Skala pixel-art**: sprite asli 32×32px dikali `SCALE = 1.5` jadi 48×48px per frame (konstanta `FRAME_SRC`/`SCALE`/`FRAME` di `script.js`, ukuran karakter di layar diminta 48×48 secara eksplisit) supaya kelihatan jelas di layar modern. `image-rendering: pixelated` di CSS supaya hasil scale tetap tegas (tidak blur/anti-alias).
- **Siklus animasi jalan**: `WALK_FRAMES = [1, 0, 1, 2]` (tengah → kiri → tengah → kanan, berulang), ganti frame tiap `FRAME_DURATION` (140ms) selama ada arah yang ditahan. Berhenti bergerak → langsung balik ke `IDLE_FRAME` (kolom tengah) di baris arah hadap terakhir (`facing`), bukan freeze di pose kaki melangkah.
- **Kontrol**: Arrow keys **dan** WASD sama-sama jalan (`KEY_TO_DIR`), `e.preventDefault()` di keydown biar panah tidak ikut men-scroll halaman.
- **Multi-tombol ditahan sekaligus**: `heldDirections` adalah **array berurutan** (bukan `Set`) — arah yang dipakai gerak/animasi selalu elemen **paling akhir** (paling baru ditekan & masih ditahan). Efeknya: kalau user menekan Kanan lalu (tanpa lepas) menekan Atas, karakter langsung menghadap/jalan Atas; begitu Atas dilepas, otomatis balik jalan Kanan (bukan berhenti total) selama Kanan masih ditahan. Dilepas semua → berhenti & idle.
- **Loop gerak**: satu `requestAnimationFrame` loop (`loop()`), delta time dinormalisasi ke satuan "per frame 60fps" (`dt = (time - lastTime) / (1000/60)`) supaya `SPEED` (px per frame) konsisten di refresh rate layar berapa pun.
- **Batas dunia**: posisi karakter (`x`, `y`) di-clamp ke `[0, world.clientWidth/Height - FRAME]` tiap frame gerak — karakter tidak bisa keluar kotak `#gameWorld`. Belum ada kamera/scrolling — dunia diam, cuma karakter yang bergerak di dalamnya.
- **Kehilangan fokus window**: listener `blur` mengosongkan `heldDirections` supaya karakter tidak "nyangkut" jalan terus kalau user pindah tab/app saat tombol masih dianggap tertekan oleh browser.

## Kenapa bukan CSS `@keyframes` / sprite animation library

Animasi frame (ganti `background-position`) dan pergerakan (`transform: translate`) sama-sama didorong dari JS `requestAnimationFrame`, bukan CSS `@keyframes` — karena animasi jalan **harus start/stop persis mengikuti tombol ditekan/dilepas** (bukan animasi berulang otomatis), dan arah (baris sprite) berubah dinamis tergantung input. `@keyframes` cocok utk animasi yang bentuknya tetap/predictable, kurang cocok utk kontrol interaktif seperti ini.

## Rencana / TODO ke depan

- **Pilih karakter**: UI utk memilih dari `img/Male/`/`img/Female/` (banyak nomor & varian outfit) — saat ini masih hardcode `Male 01-1.png` di `SPRITE_SRC`.
- **Map/level**: dunia saat ini cuma kotak statis dgn motif rumput CSS — belum ada tile map sungguhan, collision dgn objek, kamera mengikuti karakter, dll.
- **Kontrol mobile**: kontrol saat ini keyboard-only (Arrow/WASD) — belum ada on-screen d-pad/joystick utk HP, walau prototype dibuka lewat browser mobile.
- Belum ada Firebase/data tersimpan — murni prototype client-side, tidak ada progres yang dipersist.
- Belum ada testing otomatis — project murni HTML/CSS/JS statis, sama seperti trialerror lain.

## Catatan implementasi

- Semua teks UI berbahasa Indonesia.
- **Wajib**: setiap kali ada perubahan struktur/fitur di project ini, update dokumen ini (`trialerror/LittleAdventure/.claude/CLAUDE.md`) di perubahan yang sama — berlaku di semua project dalam repo `iyonadryan.github.io`.
