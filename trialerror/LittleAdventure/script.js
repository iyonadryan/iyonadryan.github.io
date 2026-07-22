(function () {
  "use strict";

  // ================= Konfigurasi sprite =================
  // Sprite sheet karakter: 3 kolom x 4 baris, tiap frame 32x32px asli.
  // Baris:  0 = jalan bawah, 1 = jalan kiri, 2 = jalan kanan, 3 = jalan atas
  // Kolom:  0 & 2 = kaki melangkah, 1 = tengah/idle (dipakai juga sbg pose diam)
  // Semua file di CHARACTER_FILES (lihat bawah) sama persis formatnya
  // (32x32/frame, 3x4), jadi ganti karakter cuma perlu ganti backgroundImage.
  const FRAME_SRC = 32; // px, ukuran asli 1 frame di file PNG
  const SHEET_COLS = 3;
  const SHEET_ROWS = 4;
  const SCALE = 1.5; // pixel-art diperbesar 1.5x biar keliatan jelas di layar
  const FRAME = FRAME_SRC * SCALE; // ukuran 1 frame setelah discale (48px)

  // Daftar semua file sprite yang tersedia per gender, dari isi folder
  // img/character/Male & img/character/Female apa adanya (banyak file tidak
  // punya keempat varian -1/-2/-3/-4 lengkap, mis. "Male 18" cuma ada -1) —
  // makanya daftarnya ditulis apa adanya sbg data, bukan digenerate dari pola
  // angka yang diasumsikan.
  const CHARACTER_FILES = {
    Male: [
      "Male 01-1.png", "Male 01-2.png", "Male 01-3.png", "Male 01-4.png",
      "Male 02-1.png", "Male 02-2.png", "Male 02-3.png", "Male 02-4.png",
      "Male 03-1.png", "Male 03-2.png", "Male 03-3.png", "Male 03-4.png",
      "Male 04-1.png", "Male 04-2.png", "Male 04-3.png", "Male 04-4.png",
      "Male 05-1.png", "Male 05-2.png", "Male 05-3.png", "Male 05-4.png",
      "Male 06-1.png", "Male 06-2.png", "Male 06-3.png", "Male 06-4.png",
      "Male 07-1.png", "Male 07-2.png", "Male 07-3.png", "Male 07-4.png",
      "Male 08-1.png", "Male 08-2.png", "Male 08-3.png", "Male 08-4.png",
      "Male 09-1.png", "Male 09-2.png", "Male 09-3.png", "Male 09-4.png",
      "Male 10-1.png", "Male 10-2.png", "Male 10-3.png", "Male 10-4.png",
      "Male 11-1.png", "Male 11-2.png", "Male 11-3.png", "Male 11-4.png",
      "Male 12-1.png", "Male 12-2.png", "Male 12-3.png", "Male 12-4.png",
      "Male 13-1.png", "Male 13-2.png", "Male 13-3.png", "Male 13-4.png",
      "Male 14-1.png", "Male 14-2.png", "Male 14-3.png", "Male 14-4.png",
      "Male 15-1.png", "Male 15-2.png", "Male 15-3.png", "Male 15-4.png",
      "Male 16-1.png", "Male 16-2.png", "Male 16-3.png", "Male 16-4.png",
      "Male 17-1.png", "Male 17-2.png", "Male 17-3.png", "Male 17-4.png",
      "Male 18-1.png",
    ],
    Female: [
      "Female 01-1.png", "Female 01-2.png", "Female 01-3.png", "Female 01-4.png",
      "Female 02-1.png", "Female 02-2.png", "Female 02-3.png", "Female 02-4.png",
      "Female 03-1.png", "Female 03-2.png", "Female 03-3.png", "Female 03-4.png",
      "Female 04-1.png", "Female 04-2.png", "Female 04-3.png", "Female 04-4.png",
      "Female 05-1.png", "Female 05-2.png", "Female 05-3.png", "Female 05-4.png",
      "Female 06-1.png", "Female 06-2.png", "Female 06-3.png", "Female 06-4.png",
      "Female 07-1.png", "Female 07-2.png", "Female 07-3.png", "Female 07-4.png",
      "Female 08-1.png", "Female 08-2.png", "Female 08-3.png", "Female 08-4.png",
      "Female 09-1.png", "Female 09-2.png", "Female 09-3.png", "Female 09-4.png",
      "Female 10-1.png", "Female 10-2.png", "Female 10-3.png", "Female 10-4.png",
      "Female 11-1.png", "Female 11-2.png", "Female 11-3.png", "Female 11-4.png",
      "Female 12-1.png", "Female 12-2.png", "Female 12-3.png", "Female 12-4.png",
      "Female 13-1.png", "Female 13-2.png", "Female 13-3.png", "Female 13-4.png",
      "Female 14-1.png", "Female 14-2.png", "Female 14-3.png", "Female 14-4.png",
      "Female 15-1.png", "Female 15-2.png", "Female 15-3.png", "Female 15-4.png",
      "Female 16-1.png", "Female 16-2.png", "Female 16-3.png", "Female 16-4.png",
      "Female 17-1.png", "Female 17-2.png", "Female 17-3.png", "Female 17-4.png",
      "Female 18-1.png", "Female 18-2.png", "Female 18-3.png", "Female 18-4.png",
      "Female 19-1.png", "Female 19-2.png", "Female 19-3.png", "Female 19-4.png",
      "Female 20-1.png", "Female 20-2.png", "Female 20-3.png", "Female 20-4.png",
      "Female 21-1.png", "Female 21-2.png", "Female 21-3.png", "Female 21-4.png",
      "Female 22-1.png", "Female 22-2.png", "Female 22-3.png", "Female 22-4.png",
      "Female 23-1.png", "Female 24-1.png", "Female 25-1.png",
    ],
  };
  const THUMB_SIZE = 48; // px, ukuran tiap kotak preview di grid pilih karakter

  function characterPath(gender, file) {
    return `img/character/${gender}/${file}`;
  }

  let currentGender = "Male"; // gender karakter yang lagi dipakai
  let currentFile = CHARACTER_FILES.Male[0]; // file spesifik yang lagi dipakai
  let pickerGender = currentGender; // tab gender yang lagi ditampilkan di picker (belum tentu dipakai)

  const ROW = { down: 0, left: 1, right: 2, up: 3 };

  // Urutan kolom saat animasi jalan: tengah -> kiri -> tengah -> kanan,
  // berulang selama tombol arah ditahan. Kolom 1 juga dipakai sbg idle.
  const WALK_FRAMES = [1, 0, 1, 2];
  const IDLE_FRAME = 1;
  const FRAME_DURATION = 140; // ms per pergantian frame animasi jalan
  const SPEED = 2.4; // px per frame animasi (~60fps) saat bergerak
  const WALK_SLOW_FACTOR = 0.5; // dikali ke SPEED, dibagi ke FRAME_DURATION saat Shift ditahan (jalan pelan)

  // ================= Konfigurasi peta dunia =================
  // Dunia sekarang dimuat dari map hasil Tilemap Editor (tilemap.html),
  // disimpan di Firebase — lihat "Dunia dari Tilemap Editor" di CLAUDE.md.
  // Fallback ke gambar statis lama kalau load dari Firebase gagal (map belum
  // ada/rules blm diset/network error) supaya game tidak pernah blank.
  const TILEMAPS_PATH = "trial-error/littleAdventure/tilemaps"; // node induk — dipakai jg utk listing nama map, lihat "Pilih Map"
  let WORLD_MAP_NAME = "default"; // `let`, bisa diganti lewat popup "Pilih Map"
  const FALLBACK_MAP_SRC = "img/samplemap.png";
  const FALLBACK_MAP_SRC_SIZE = 1920; // px, ukuran asli map fallback (persegi: 1920x1920)

  // Sama persis dgn TILE_SIZE/TILESET_TYPES di tilemap-script.js — WAJIB
  // disinkron manual kalau daftar tileset di sana berubah (tidak ada modul/
  // import di project ini, lihat catatan serupa di CHARACTER_FILES).
  const TILE_SRC = 32;
  const TILESET_DIR = "img/tileset/SampleMap/";
  const TILESET_FILES = {
    Base: "[Base]BaseChip_pipo.png",
    LightShadow: "LightShadow_pipo.png",
    Dirt: "[A]Dirt_pipo.png",
    Flower: "[A]Flower_pipo.png",
    Grass: "[A]Grass_pipo.png",
    WallUp: "[A]Wall-Up_pipo.png",
    Water: "[A]Water_pipo.png",
    WaterFall: "[A]WaterFall_pipo.png",
  };
  // "Block Layer" (tilesetType khusus, bukan gambar tileset — lihat
  // CLAUDE.md Tilemap Editor), sama persis dgn BLOCK_TILESET_KEY/
  // BLOCK_SUBDIVISION di tilemap-script.js.
  const BLOCK_TILESET_KEY = "Block";
  const BLOCK_SUBDIVISION = 4;
  // Ambang batas KHUSUS migrasi `mode` legacy (lihat effectiveLayerMode() di
  // bawah) — SAMA PERSIS nilai & nama dgn LEGACY_GROUND_POSITION_MAX di
  // tilemap-script.js. Map lama (v5 ke bawah) py Background(-1)/Foreground(0)
  // yg DUA2NYA dulu implisit Ground — TIDAK ADA hubungannya dgn status
  // "locked" (game ini toh tidak py konsep locked layer sama sekali, itu
  // murni urusan editor), murni soal nebak `mode` map lama yg belum py field
  // itu.
  const LEGACY_GROUND_POSITION_MAX = 0;
  // "Top Object" (mask khusus, bukan gambar tileset — lihat CLAUDE.md
  // Tilemap Editor "Top Object") — sama persis dgn TOP_OBJECT_TILESET_KEY di
  // tilemap-script.js. Nandain sel mana (grid NORMAL, BUKAN grid Block Layer
  // yg lebih rapat — lihat BLOCK_SUBDIVISION) di layer ATAS karakter yg
  // HARUS selalu di depan karakter, ngabaikan Y-sorting biasa (lihat
  // updateDepthSort()/topObjectCanvas).
  const TOP_OBJECT_TILESET_KEY = "TopObject";

  // "Mode Layer" (Ground/Object/Mask, permintaan eksplisit user) — sama
  // persis dgn LAYER_MODE_GROUND/LAYER_MODE_OBJECT/LAYER_MODE_MASK di
  // tilemap-script.js. Ground = SELALU di belakang karakter (statis), Object
  // = Y-sorting per-baris (lihat "Y-sorting"), Mask = Block Layer/Top Object
  // (dikecualikan total dari render normal, lihat effectiveLayerMode() &
  // buildWorldFromMapData() di bawah).
  const LAYER_MODE_GROUND = "Ground";
  const LAYER_MODE_OBJECT = "Object";
  const LAYER_MODE_MASK = "Mask";

  // Map lama (sblm fitur "Mode Layer" ada, `version < 5`) tidak punya field
  // `mode` per layer sama sekali — ditebak dari `tilesetType`/`layerPosition`
  // SAMA PERSIS pola `migrateLayerMode()` di `tilemap-script.js`, supaya
  // perilaku render map lama TETAP SAMA persis spt sebelum fitur ini ada.
  function effectiveLayerMode(l) {
    if (l.mode === LAYER_MODE_GROUND || l.mode === LAYER_MODE_OBJECT || l.mode === LAYER_MODE_MASK) return l.mode;
    if (l.tilesetType === BLOCK_TILESET_KEY || l.tilesetType === TOP_OBJECT_TILESET_KEY) return LAYER_MODE_MASK;
    if (l.layerPosition <= LEGACY_GROUND_POSITION_MAX) return LAYER_MODE_GROUND;
    return LAYER_MODE_OBJECT;
  }

  // Dunia (#worldLayer) jauh lebih besar dari jendela kamera (#gameWorld)
  // supaya ada ruang buat karakter jalan-jalan & kameranya kelihatan geser.
  // Diisi (bareng karakter dibatasi persis ke tepi peta) begitu peta selesai
  // dimuat (lihat loadWorldMap()) — makanya `let`, bukan `const` lagi.
  let WORLD_WIDTH = 0;
  let WORLD_HEIGHT = 0;
  // Data Block Layer (kalau ada di map) buat cek tabrakan — null kalau map
  // tidak py Block Layer sama sekali/disembunyikan di editor/masih fallback.
  // Koordinat sudah dlm satuan WORLD (dikali SCALE), lihat isAreaBlocked().
  let blockLayerData = null;
  // Titik spawn karakter (Start Position dari Tilemap Editor, lihat CLAUDE.md)
  // — koordinat sudah dlm satuan WORLD (dikali SCALE), null kalau map tidak
  // py Start Position diset/masih fallback (karakter mulai di TENGAH dunia,
  // perilaku lama, lihat loadAndSetupWorld()).
  let startPositionWorld = null;
  // Kanvas tunggal (seukuran WORLD penuh, bukan per-baris) berisi SEMUA
  // konten layer atas-karakter yg selnya ditandai "Top Object" (mask, lihat
  // TOP_OBJECT_TILESET_KEY di atas) — TIDAK PERNAH ikut Y-sorting biasa,
  // selalu dipaksa jadi anak TEPAT SEBELUM #speechBubble stlh tiap
  // updateDepthSort() (lihat di sana), jadi permanen di depan karakter walau
  // posisi kaki karakter ada di bawah baris tile itu. null kalau map tidak
  // py Top Object/tidak ada sel ditandai/masih fallback.
  let topObjectCanvas = null;

  // "Kaki" karakter (permintaan eksplisit user) — kotak 32x8 native (bukan
  // seluruh FRAME 32x32) di bagian PALING BAWAH karakter, dipakai sbg
  // acuan tabrakan Block Layer (isAreaBlocked()) MAUPUN Y-sorting layer di
  // atas karakter (updateDepthSort()) — bukan seluruh badan, krn scr visual
  // cuma kaki yg relevan "nyentuh tanah". Lebar (32 native) PAS sama dgn
  // FRAME_SRC = selebar FRAME penuh, tingginya (8 native) PAS sama dgn
  // BLOCK_SUBDIVISION punya tilemap-script.js punya BLOCK_TILE_SIZE (native
  // 8px) — dikonversi ke satuan WORLD (dikali SCALE) sama spt semua ukuran
  // lain di file ini.
  const FOOT_HEIGHT_SRC = 8;
  const FOOT_HEIGHT = FOOT_HEIGHT_SRC * SCALE; // 12px WORLD

  // Y-sorting (permintaan eksplisit user) — layer SELAIN Background/
  // Foreground (layerPosition > 0) TIDAK LAGI selalu di depan karakter;
  // per-baris tile, dinamis pindah di depan/belakang tergantung posisi Y
  // kaki karakter dibanding baris itu. `aboveRowCanvasesByRow[row]` = array
  // <canvas> (1 per layer "atas", urutan ascending layerPosition) utk baris
  // itu; `lastDepthSplitRow` nyimpen baris pemisah terakhir spy
  // updateDepthSort() tidak kerja DOM sia-sia kalau belum berubah. Lihat
  // "Y-sorting" di CLAUDE.md.
  let aboveRowCanvasesByRow = [];
  let lastDepthSplitRow = -1;

  // 0-1: seberapa cepat kamera "mengejar" posisi target (karakter di tengah).
  // Makin kecil, makin nge-lag/lambat & smooth; makin besar, makin ketat
  // nempel ke karakter (1 = langsung nempel tanpa jeda sama sekali).
  const CAMERA_SMOOTH = 0.08;

  const KEY_TO_DIR = {
    ArrowUp: "up", w: "up", W: "up",
    ArrowDown: "down", s: "down", S: "down",
    ArrowLeft: "left", a: "left", A: "left",
    ArrowRight: "right", d: "right", D: "right",
  };

  const character = document.getElementById("character");
  const viewport = document.getElementById("gameWorld");
  const worldLayer = document.getElementById("worldLayer");
  const mapLabelName = document.getElementById("mapLabelName");

  const changeCharacterBtn = document.getElementById("changeCharacterBtn");
  const characterPickerOverlay = document.getElementById("characterPickerOverlay");
  const closePickerBtn = document.getElementById("closePickerBtn");
  const genderTabs = document.getElementById("genderTabs");
  const characterGrid = document.getElementById("characterGrid");

  const openMapPickerBtn = document.getElementById("openMapPickerBtn");
  const mapPickerOverlay = document.getElementById("mapPickerOverlay");
  const closeMapPickerBtn = document.getElementById("closeMapPickerBtn");
  const mapSearchInput = document.getElementById("mapSearchInput");
  const mapList = document.getElementById("mapList");

  const musicBtn = document.getElementById("musicBtn");

  const editorLink = document.getElementById("editorLink");
  const editorWarningOverlay = document.getElementById("editorWarningOverlay");
  const editorWarningBackBtn = document.getElementById("editorWarningBackBtn");
  const editorWarningContinueBtn = document.getElementById("editorWarningContinueBtn");

  const chatInput = document.getElementById("chatInput");
  const speechBubble = document.getElementById("speechBubble");
  const BUBBLE_DURATION = 4000; // ms, bubble ilang otomatis stlh sekian lama

  // Dipakai guard tombol gerak/Shift/Space — true kalau fokus lagi di input
  // teks mana pun (chat ATAU search popup Pilih Map), supaya ngetik "w"/"a"/
  // "s"/"d"/spasi di situ tidak ikut ke-anggap kontrol gerak karakter.
  function isTypingInField() {
    return document.activeElement === chatInput || document.activeElement === mapSearchInput;
  }

  let x = 0; // posisi karakter dalam koordinat dunia (bukan koordinat layar)
  let y = 0;
  let camX = 0; // posisi kamera (pojok kiri-atas jendela) dalam koordinat dunia
  let camY = 0;
  let facing = "down";
  let moving = false;
  let walkFrameIndex = 0;
  let lastWalkFrameTime = 0;

  // Arah yang lagi ditahan, disimpan berurutan (bukan Set) supaya arah yang
  // "menang" selalu yang PALING BARU ditekan & masih ditahan — jadi kalau
  // user menekan dua arah sekaligus (mis. Kanan lalu Atas), karakter ngikut
  // arah terakhir, dan begitu dilepas otomatis balik ke arah sebelumnya yang
  // masih ditahan (bukan langsung berhenti total).
  let heldDirections = [];

  // Tahan Shift = jalan pelan (mode "sneak/walk"). Kecepatan gerak & animasi
  // sama-sama diperlambat setengah kali lipat (dikali 0.5) selagi ditahan.
  let shiftHeld = false;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function addDirection(dir) {
    const idx = heldDirections.indexOf(dir);
    if (idx !== -1) heldDirections.splice(idx, 1);
    heldDirections.push(dir);
  }

  function removeDirection(dir) {
    const idx = heldDirections.indexOf(dir);
    if (idx !== -1) heldDirections.splice(idx, 1);
  }

  window.addEventListener("keydown", (e) => {
    if (isTypingInField()) return; // lagi ngetik di input teks, jangan dianggap tombol gerak
    const dir = KEY_TO_DIR[e.key];
    if (!dir) return;
    e.preventDefault(); // tombol panah jangan sampai scroll halaman
    addDirection(dir);
  });

  window.addEventListener("keyup", (e) => {
    const dir = KEY_TO_DIR[e.key];
    if (!dir) return;
    removeDirection(dir);
  });

  window.addEventListener("keydown", (e) => {
    if (isTypingInField()) return; // lagi ngetik di input teks, jangan dianggap tombol jalan-pelan
    if (e.key === "Shift") shiftHeld = true;
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "Shift") shiftHeld = false;
  });

  // ================= Lompat (Space) =================
  // Lompat murni efek visual (hop naik-turun via animasi CSS "jump" di
  // .character, lihat style.css) — TIDAK mengubah posisi/kecepatan gerak
  // atau logika tabrakan sama sekali, cuma kosmetik. Bisa dipicu sambil
  // diam atau sambil jalan.
  let isJumping = false;

  // Dipakai keydown Space DAN tombol lompat di kontrol layar sentuh (lihat
  // "Kontrol layar sentuh" di bawah) — logic-nya sama persis, jadi ditaruh
  // di 1 fungsi drpd diduplikasi.
  function triggerJump() {
    if (isJumping) return; // lagi lompat, abaikan trigger tambahan sampai selesai
    isJumping = true;
    character.classList.add("jumping");
  }

  window.addEventListener("keydown", (e) => {
    if (isTypingInField()) return; // lagi ngetik di input teks, spasi jadi karakter biasa
    if (e.code !== "Space") return;
    e.preventDefault(); // spasi jangan sampai scroll halaman
    triggerJump();
  });

  // Lepas class "jumping" begitu animasi CSS-nya selesai, bukan pakai
  // setTimeout durasi hardcoded — otomatis selalu sinkron dgn durasi asli
  // yang didefinisikan di @keyframes "jump" (style.css), walau durasinya
  // diubah di sana nanti.
  character.addEventListener("animationend", (e) => {
    if (e.animationName !== "jump") return;
    character.classList.remove("jumping");
    isJumping = false;
  });

  // Kalau window kehilangan fokus (alt-tab dll), lepas semua tombol supaya
  // karakter tidak "nyangkut" jalan terus walau tombolnya sudah tidak ditekan.
  window.addEventListener("blur", () => {
    heldDirections = [];
    shiftHeld = false;
  });

  // ================= Kontrol layar sentuh (HP) =================
  // Cuma KELIHATAN di device `pointer: coarse` (lihat style.css), tapi
  // listener-nya tetap dipasang apa pun device-nya (murni CSS yg
  // nyembunyiin, bukan JS) — cost-nya kecil & lebih sederhana drpd deteksi
  // device di JS segala. Semua tombol manggil fungsi yg SAMA persis dgn
  // keyboard (addDirection/removeDirection, shiftHeld, triggerJump()) biar
  // perilakunya identik, bukan implementasi kedua yg terpisah.
  //
  // `setPointerCapture` dipasang tiap `pointerdown` supaya event `pointerup`
  // tetap ditangkap elemen yg sama walau jari sempat geser sedikit keluar
  // batas tombol sebelum diangkat (pola umum utk tombol touch "tahan") —
  // tanpa ini, jari geser dikit bisa bikin `pointerup`/`pointerleave` tidak
  // konsisten & tombol "nyangkut" dianggap masih ditekan.
  function bindHoldButton(btn, onStart, onEnd) {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      onStart();
    });
    btn.addEventListener("pointerup", onEnd);
    btn.addEventListener("pointercancel", onEnd);
  }

  // ---- Analog stick (kontrol arah, gantiin 4 tombol W/A/S/D persegi) ----
  // Permintaan eksplisit user (referensi: analog stick controller fisik) —
  // 1 lingkaran dasar diam (`#touchJoystick`) + 1 knob yg diseret di
  // dalamnya (`#joystickKnob`). Sistem gerak game ini cuma kenal 4 arah
  // kardinal (lihat `heldDirections`/`KEY_TO_DIR` di atas), jadi "analog"
  // di sini murni VISUAL (knob bisa digeser bebas ke segala arah dlm
  // lingkaran) — arah GERAKnya sendiri tetap dikuantisasi ke salah satu
  // dari up/down/left/right via `angleToDirection()`, sama spt kalau pakai
  // 4 tombol terpisah, cuma UX-nya lebih mirip stick asli.
  const touchJoystick = document.getElementById("touchJoystick");
  const joystickKnob = document.getElementById("joystickKnob");
  const JOYSTICK_DEAD_ZONE = 12; // px — seretan di bawah ini dianggap netral (tidak ada arah aktif)

  let joystickActiveDir = null; // arah yg lagi "ditekan" lewat joystick (null = netral)
  let joystickPointerId = null; // cuma 1 jari yg dianggap aktif per waktu, dilacak via pointerId

  function setJoystickDirection(dir) {
    if (dir === joystickActiveDir) return;
    if (joystickActiveDir) removeDirection(joystickActiveDir);
    joystickActiveDir = dir;
    if (dir) addDirection(dir);
  }

  // Kuantisasi sudut seretan (atan2 koordinat layar: sumbu-Y makin besar =
  // makin ke BAWAH) ke 4 sektor 90° — 0°=kanan, 90°=bawah, ±180°=kiri, -90°=atas.
  function angleToDirection(dx, dy) {
    const deg = Math.atan2(dy, dx) * (180 / Math.PI);
    if (deg >= -45 && deg < 45) return "right";
    if (deg >= 45 && deg < 135) return "down";
    if (deg >= 135 || deg < -135) return "left";
    return "up";
  }

  function setKnobOffset(x, y) {
    joystickKnob.style.setProperty("--knob-x", `${x}px`);
    joystickKnob.style.setProperty("--knob-y", `${y}px`);
  }

  function handleJoystickMove(e) {
    const rect = touchJoystick.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const radius = rect.width / 2;

    // Knob dikunci maks ke tepi lingkaran dasar (tidak bisa diseret keluar
    // secara visual), tapi ARAH tetap dihitung dari posisi jari SEBENARNYA
    // (dx/dy asli, bukan yg sudah di-clamp) — bebas seberapa jauh jari
    // geser di luar lingkaran, sudutnya tetap akurat.
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, radius);
    const angle = Math.atan2(dy, dx);
    setKnobOffset(Math.cos(angle) * clampedDist, Math.sin(angle) * clampedDist);

    setJoystickDirection(dist < JOYSTICK_DEAD_ZONE ? null : angleToDirection(dx, dy));
  }

  function endJoystick(e) {
    if (e.pointerId !== joystickPointerId) return;
    joystickPointerId = null;
    setJoystickDirection(null);
    setKnobOffset(0, 0);
  }

  touchJoystick.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    touchJoystick.setPointerCapture(e.pointerId);
    joystickPointerId = e.pointerId;
    handleJoystickMove(e);
  });
  touchJoystick.addEventListener("pointermove", (e) => {
    if (e.pointerId !== joystickPointerId) return;
    handleJoystickMove(e);
  });
  touchJoystick.addEventListener("pointerup", endJoystick);
  touchJoystick.addEventListener("pointercancel", endJoystick);

  bindHoldButton(
    document.getElementById("touchShiftBtn"),
    () => { shiftHeld = true; },
    () => { shiftHeld = false; }
  );

  document.getElementById("touchJumpBtn").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    triggerJump(); // tap sekali = 1 lompatan, tidak perlu logic "tahan" spt dpad/shift
  });

  function setSpriteFrame(row, col) {
    character.style.backgroundPosition = `-${col * FRAME}px -${row * FRAME}px`;
  }

  // ================= Dunia dari Tilemap Editor (Firebase) =================
  function tilesetImageSrc(type) {
    return TILESET_DIR + TILESET_FILES[type];
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Gagal memuat gambar: ${src}`));
      img.src = src;
    });
  }

  // Fallback murni gambar statis (perilaku lama, sebelum ada Tilemap Editor)
  // — dipakai kalau load dari Firebase gagal, spy game tidak pernah blank.
  function buildWorldFallback() {
    WORLD_WIDTH = FALLBACK_MAP_SRC_SIZE * SCALE;
    WORLD_HEIGHT = FALLBACK_MAP_SRC_SIZE * SCALE;
    worldLayer.style.backgroundImage = `url("${FALLBACK_MAP_SRC}")`;
    worldLayer.style.backgroundSize = `${WORLD_WIDTH}px ${WORLD_HEIGHT}px`;
    // Bersihin sisa <canvas> layer dari map SEBELUMNYA (kalau ini terjadi
    // krn ganti map lewat popup "Pilih Map", bukan cuma load pertama kali)
    // — tanpa ini, kanvas map lama numpuk di atas gambar fallback ini.
    worldLayer.querySelectorAll(".world-layer-canvas").forEach((c) => c.remove());
    blockLayerData = null;
    startPositionWorld = null;
    // Kanvas per-baris (Y-sorting) & topObjectCanvas dari map SEBELUMNYA
    // sudah kehapus lewat querySelectorAll di atas (sama class
    // .world-layer-canvas) — referensinya jg direset spy updateDepthSort()
    // tidak nyoba pindahin elemen kanvas yg sudah tidak relevan.
    aboveRowCanvasesByRow = [];
    lastDepthSplitRow = -1;
    topObjectCanvas = null;
  }

  // Gambar 1 layer (bukan Block Layer) ke <canvas> native resolution
  // (mapWidth/mapHeight * TILE_SRC) — sama persis pola drawImage per-tile
  // spt renderLayer() di tilemap-script.js. Diskalakan ke ukuran WORLD murni
  // lewat CSS (canvas.style.width/height), bukan drawImage berskala, spy
  // hasil pixel-art tetap tegas (`image-rendering: pixelated`, lihat style.css).
  function makeWorldLayerCanvas(layer, mapWidth, mapHeight, imageCache) {
    const canvas = document.createElement("canvas");
    canvas.className = "world-layer-canvas";
    canvas.width = mapWidth * TILE_SRC;
    canvas.height = mapHeight * TILE_SRC;
    canvas.style.width = `${WORLD_WIDTH}px`;
    canvas.style.height = `${WORLD_HEIGHT}px`;

    const img = imageCache[layer.tilesetType];
    if (img) {
      const ctx = canvas.getContext("2d");
      const cols = Math.floor(img.naturalWidth / TILE_SRC);
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = typeof layer.opacity === "number" ? layer.opacity : 1;
      for (let row = 0; row < mapHeight; row++) {
        for (let col = 0; col < mapWidth; col++) {
          const tile = layer.tiles[row * mapWidth + col];
          if (tile === -1 || tile == null) continue;
          const srcCol = tile % cols;
          const srcRow = Math.floor(tile / cols);
          ctx.drawImage(img, srcCol * TILE_SRC, srcRow * TILE_SRC, TILE_SRC, TILE_SRC, col * TILE_SRC, row * TILE_SRC, TILE_SRC, TILE_SRC);
        }
      }
      ctx.globalAlpha = 1;
    }
    return canvas;
  }

  // Sama persis pola makeWorldLayerCanvas(), TAPI cuma gambar SATU baris
  // tile (bukan seluruh layer) ke kanvas setinggi 1 baris — dipakai khusus
  // layer di ATAS karakter (layerPosition > 0) spy tiap baris bisa
  // diposisikan sendiri2 di depan/belakang karakter (Y-sorting, lihat
  // updateDepthSort()). `canvas.style.top` di-set manual per baris (nimpa
  // `top:0` bawaan `.world-layer-canvas`, lihat style.css) krn tiap kanvas
  // baris ini HARUS didudukkan di ketinggian baris aslinya masing2.
  // `topObjectTiles` (opsional, lihat TOP_OBJECT_TILESET_KEY) = array tiles
  // mentah layer Top Object map ini, seukuran mapWidth*mapHeight (grid
  // NORMAL, sama persis dgn grid layer di atas karakter — TIDAK perlu
  // konversi spt BLOCK_SUBDIVISION). Sel yg ditandai DILEWATI di sini —
  // digambar terpisah ke topObjectCanvas (lihat makeTopObjectCanvas())
  // supaya TIDAK ikut Y-sorting per-baris biasa.
  function makeWorldLayerRowCanvas(layer, row, mapWidth, imageCache, topObjectTiles) {
    const canvas = document.createElement("canvas");
    canvas.className = "world-layer-canvas";
    canvas.width = mapWidth * TILE_SRC;
    canvas.height = TILE_SRC;
    canvas.style.width = `${WORLD_WIDTH}px`;
    canvas.style.height = `${TILE_SRC * SCALE}px`;
    canvas.style.top = `${row * TILE_SRC * SCALE}px`;

    const img = imageCache[layer.tilesetType];
    if (img) {
      const ctx = canvas.getContext("2d");
      const cols = Math.floor(img.naturalWidth / TILE_SRC);
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = typeof layer.opacity === "number" ? layer.opacity : 1;
      for (let col = 0; col < mapWidth; col++) {
        if (topObjectTiles) {
          const mark = topObjectTiles[row * mapWidth + col];
          if (mark !== -1 && mark != null) continue;
        }
        const tile = layer.tiles[row * mapWidth + col];
        if (tile === -1 || tile == null) continue;
        const srcCol = tile % cols;
        const srcRow = Math.floor(tile / cols);
        ctx.drawImage(img, srcCol * TILE_SRC, srcRow * TILE_SRC, TILE_SRC, TILE_SRC, col * TILE_SRC, 0, TILE_SRC, TILE_SRC);
      }
      ctx.globalAlpha = 1;
    }
    return canvas;
  }

  // Kanvas gabungan SEMUA layer atas-karakter, HANYA sel yg ditandai Top
  // Object — seukuran WORLD PENUH (bukan per-baris spt
  // makeWorldLayerRowCanvas()) krn kanvas ini TIDAK PERNAH ikut Y-sorting,
  // posisinya selalu tepat sebelum #speechBubble (lihat updateDepthSort()).
  // aboveLayers HARUS sudah terurut ascending layerPosition (sama pola dgn
  // pemanggilnya di buildWorldFromMapData()) spy layer yg lebih "atas"
  // digambar belakangan (menimpa yg di bawahnya), konsisten dgn urutan
  // tumpuk normal. Return null kalau tidak ada sel ditandai sama sekali
  // (drpd taruh kanvas kosong percuma di DOM).
  function makeTopObjectCanvas(aboveLayers, topObjectTiles, mapWidth, mapHeight, imageCache) {
    if (!topObjectTiles || !topObjectTiles.some((t) => t !== -1 && t != null)) return null;
    const canvas = document.createElement("canvas");
    canvas.className = "world-layer-canvas";
    canvas.width = mapWidth * TILE_SRC;
    canvas.height = mapHeight * TILE_SRC;
    canvas.style.width = `${WORLD_WIDTH}px`;
    canvas.style.height = `${WORLD_HEIGHT}px`;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    aboveLayers.forEach((layer) => {
      const img = imageCache[layer.tilesetType];
      if (!img) return;
      const cols = Math.floor(img.naturalWidth / TILE_SRC);
      ctx.globalAlpha = typeof layer.opacity === "number" ? layer.opacity : 1;
      for (let row = 0; row < mapHeight; row++) {
        for (let col = 0; col < mapWidth; col++) {
          const mark = topObjectTiles[row * mapWidth + col];
          if (mark === -1 || mark == null) continue;
          const tile = layer.tiles[row * mapWidth + col];
          if (tile === -1 || tile == null) continue;
          const srcCol = tile % cols;
          const srcRow = Math.floor(tile / cols);
          ctx.drawImage(img, srcCol * TILE_SRC, srcRow * TILE_SRC, TILE_SRC, TILE_SRC, col * TILE_SRC, row * TILE_SRC, TILE_SRC, TILE_SRC);
        }
      }
      ctx.globalAlpha = 1;
    });
    return canvas;
  }

  // Bangun dunia dari map hasil Tilemap Editor. Urutan render (permintaan
  // eksplisit user): layer bermode "Ground" (lihat "Mode Layer" — Background
  // SELALU Ground, Foreground BUKAN LAGI singleton spesial, bisa jadi Ground
  // ATAU Object skrg tergantung pilihan user pas dibuat) SELALU di BAWAH
  // karakter. Layer bermode "Object" SEKARANG dinamis — per-baris tile,
  // di depan/belakang karakter tergantung posisi Y kaki
  // karakter (Y-sorting, lihat updateDepthSort()) — dicapai lewat urutan DOM
  // (insertBefore vs appendChild), krn #worldLayer/.character/canvas semua
  // `position:absolute` TANPA z-index, jadi urutan DOM = urutan tumpuk
  // (lihat "Y-sorting" di CLAUDE.md).
  async function buildWorldFromMapData(data) {
    const mapWidth = data.mapWidth;
    const mapHeight = data.mapHeight;
    WORLD_WIDTH = mapWidth * TILE_SRC * SCALE;
    WORLD_HEIGHT = mapHeight * TILE_SRC * SCALE;

    const layers = Array.isArray(data.layers) ? data.layers : [];
    // Layer bermode "Mask" (Block Layer/Top Object) dikecualikan total dari
    // render normal — datanya dipakai TERPISAH sbg collision/mask override
    // (lihat blockLayer/topObjectLayer di bawah), bukan digambar spt layer
    // biasa. `effectiveLayerMode()` (lihat deklarasinya) nanganin map LAMA
    // yg belum py field `mode` sama sekali.
    const visibleLayers = layers.filter((l) => l.visible !== false && effectiveLayerMode(l) !== LAYER_MODE_MASK);

    // Cuma preload tileset yg beneran dipakai layer yg keliatan (bukan semua
    // 8 spt di editor — di sini tidak ada UI ganti-ganti tileset, jadi tidak
    // perlu preload yg tidak kepakai).
    const neededTypes = [...new Set(visibleLayers.map((l) => l.tilesetType).filter((t) => TILESET_FILES[t]))];
    const imageCache = {};
    await Promise.all(
      neededTypes.map(async (type) => {
        imageCache[type] = await loadImage(tilesetImageSrc(type));
      })
    );

    worldLayer.style.backgroundImage = "none";
    worldLayer.querySelectorAll(".world-layer-canvas").forEach((c) => c.remove());

    const belowLayers = visibleLayers.filter((l) => effectiveLayerMode(l) === LAYER_MODE_GROUND).sort((a, b) => a.layerPosition - b.layerPosition);
    const aboveLayers = visibleLayers.filter((l) => effectiveLayerMode(l) === LAYER_MODE_OBJECT).sort((a, b) => a.layerPosition - b.layerPosition);

    belowLayers.forEach((layer) => {
      worldLayer.insertBefore(makeWorldLayerCanvas(layer, mapWidth, mapHeight, imageCache), character);
    });

    // Top Object (mask "selalu di depan karakter", lihat TOP_OBJECT_TILESET_KEY)
    // — dibaca dari `layers` MENTAH (bukan visibleLayers, krn sudah
    // dikeluarkan dari situ di atas), sama pola dgn blockLayer di bawah.
    // Disembunyikan di editor (visible:false) berarti mask-nya jg dianggap
    // mati (sel yg tadinya ditandai ikut Y-sorting biasa lagi).
    const topObjectLayer = layers.find((l) => l.tilesetType === TOP_OBJECT_TILESET_KEY && l.visible !== false);
    const topObjectTiles = topObjectLayer ? topObjectLayer.tiles : null;

    // Layer di ATAS karakter DIBAGI per-baris (bukan 1 kanvas utuh spt
    // belowLayers) — posisi akhirnya (depan/belakang karakter) ditentukan
    // updateDepthSort() stlh ini, dipanggil dari loadAndSetupWorld(). Taruh
    // dulu apa adanya di sini (appendChild, urutan row lalu layer ascending)
    // — cuma penempatan SEMENTARA, langsung disusun ulang begitu
    // updateDepthSort() jalan (dipaksa jalan via lastDepthSplitRow=-1 di
    // bawah). Sel yg ditandai Top Object DILEWATI di sini (lihat
    // makeWorldLayerRowCanvas()) — digambar terpisah ke topObjectCanvas.
    aboveRowCanvasesByRow = Array.from({ length: mapHeight }, () => []);
    aboveLayers.forEach((layer) => {
      for (let row = 0; row < mapHeight; row++) {
        const rowCanvas = makeWorldLayerRowCanvas(layer, row, mapWidth, imageCache, topObjectTiles);
        worldLayer.appendChild(rowCanvas);
        aboveRowCanvasesByRow[row].push(rowCanvas);
      }
    });
    lastDepthSplitRow = -1;

    // Kanvas gabungan sel-sel yg ditandai Top Object — lihat
    // makeTopObjectCanvas() & deklarasi topObjectCanvas di atas. Posisi DOM
    // akhirnya (tepat sebelum #speechBubble) baru benar2 dipaksakan pas
    // updateDepthSort() jalan pertama kali di bawah (lastDepthSplitRow=-1
    // di atas menjamin itu, sama pola dgn aboveRowCanvasesByRow) — di sini
    // cukup appendChild apa adanya dulu.
    topObjectCanvas = makeTopObjectCanvas(aboveLayers, topObjectTiles, mapWidth, mapHeight, imageCache);
    if (topObjectCanvas) worldLayer.appendChild(topObjectCanvas);

    // Block Layer TIDAK PERNAH digambar (opacity 0%/sepenuhnya tak
    // kelihatan, permintaan eksplisit user) — cuma datanya yg dipakai buat
    // tabrakan (lihat isAreaBlocked()). Kalau layer ini disembunyikan di
    // editor (visible:false), dianggap tabrakannya jg dimatikan (cara
    // pembuat map "nonaktifkan" blok tanpa hapus datanya).
    const blockLayer = layers.find((l) => l.tilesetType === BLOCK_TILESET_KEY && l.visible !== false);
    blockLayerData = blockLayer
      ? {
          cols: mapWidth * BLOCK_SUBDIVISION,
          rows: mapHeight * BLOCK_SUBDIVISION,
          cellSize: (TILE_SRC / BLOCK_SUBDIVISION) * SCALE, // px, satuan WORLD (sudah dikali SCALE)
          tiles: blockLayer.tiles,
        }
      : null;

    // Start Position (titik spawn, diset di Tilemap Editor lewat tool
    // "📍 Start Position" — BUKAN layer, lihat CLAUDE.md) — dikonversi ke
    // satuan WORLD (dikali TILE_SRC*SCALE, sama pola konversinya dgn
    // blockLayerData.cellSize di atas). null kalau map tidak py Start
    // Position diset — loadAndSetupWorld() fallback ke tengah dunia.
    const sp = data.startPosition;
    startPositionWorld =
      sp && Number.isInteger(sp.col) && Number.isInteger(sp.row) ? { x: sp.col * TILE_SRC * SCALE, y: sp.row * TILE_SRC * SCALE } : null;
  }

  async function loadWorldMap() {
    try {
      const snapshot = await db.ref(`${TILEMAPS_PATH}/${WORLD_MAP_NAME}`).once("value");
      const data = snapshot.val();
      if (!data || !Array.isArray(data.layers)) throw new Error(`Map "${WORLD_MAP_NAME}" kosong/tidak ditemukan di Firebase`);
      await buildWorldFromMapData(data);
    } catch (err) {
      console.warn("Gagal memuat dunia dari Tilemap Editor, pakai fallback samplemap.png:", err);
      buildWorldFallback();
    }
  }

  // Cek apakah kotak KAKI karakter (FRAME lebar x FOOT_HEIGHT tinggi, cuma
  // bagian PALING BAWAH karakter, permintaan eksplisit user — lihat
  // deklarasi FOOT_HEIGHT di atas) di posisi (px, py) menabrak sel Block
  // Layer manapun — BUKAN lagi seluruh kotak FRAME x FRAME. Di-scan per-sel
  // (bukan cuma 4 pojok) krn grid Block Layer jauh lebih rapat drpd FRAME
  // (lihat BLOCK_SUBDIVISION di CLAUDE.md), jadi 1 sel yg diblok bisa jatuh
  // di TENGAH salah satu sisi kotak tanpa kena pojok manapun kalau cuma
  // dicek pojoknya saja.
  function isAreaBlocked(px, py) {
    if (!blockLayerData) return false;
    const footY = py + FRAME - FOOT_HEIGHT;
    const { cols, rows, cellSize, tiles } = blockLayerData;
    const colStart = Math.max(0, Math.floor(px / cellSize));
    const colEnd = Math.min(cols - 1, Math.floor((px + FRAME - 1) / cellSize));
    const rowStart = Math.max(0, Math.floor(footY / cellSize));
    const rowEnd = Math.min(rows - 1, Math.floor((footY + FOOT_HEIGHT - 1) / cellSize));
    for (let row = rowStart; row <= rowEnd; row++) {
      for (let col = colStart; col <= colEnd; col++) {
        if (tiles[row * cols + col] !== -1 && tiles[row * cols + col] != null) return true;
      }
    }
    return false;
  }

  // Y-sorting (permintaan eksplisit user, lihat deklarasi
  // aboveRowCanvasesByRow/lastDepthSplitRow di atas) — baris ke-R (kanvas
  // layer di ATAS karakter) dibandingkan tepi BAWAHnya `(R+1)*TILE_SRC*SCALE`
  // thd posisi Y KAKI karakter (`y + FRAME`, tepi bawah kotak karakter —
  // SAMA persis titik acuannya dgn kaki di isAreaBlocked() di atas, cuma di
  // sini yg dipakai bukan FOOT_HEIGHT-nya, krn yg dibandingkan adalah tepi
  // BAWAH kaki, bukan area kakinya): kalau kaki karakter SUDAH sejajar/lebih
  // rendah drpd tepi bawah baris itu → karakter "di depan" (baris itu
  // digambar DI BELAKANG karakter). Kalau belum → karakter "di belakang"
  // (baris itu DI DEPAN karakter). `splitRow` = baris pertama yg masih
  // "di depan karakter" — semua baris SEBELUM itu taruh sblm #character di
  // DOM, semua baris DARI situ taruh SETELAH #character (tapi SEBELUM
  // #speechBubble, spy bubble ngomong tetap selalu paling depan, lihat
  // "Ngomong / chat bubble").
  function updateDepthSort() {
    if (!aboveRowCanvasesByRow.length) return;
    const footY = y + FRAME;
    let splitRow = 0;
    while (splitRow < aboveRowCanvasesByRow.length && (splitRow + 1) * TILE_SRC * SCALE <= footY) splitRow++;
    if (splitRow === lastDepthSplitRow) return; // belum berubah, skip kerjaan DOM
    lastDepthSplitRow = splitRow;
    for (let row = 0; row < aboveRowCanvasesByRow.length; row++) {
      aboveRowCanvasesByRow[row].forEach((c) => {
        if (row < splitRow) worldLayer.insertBefore(c, character);
        else worldLayer.insertBefore(c, speechBubble);
      });
    }
    // Top Object (lihat topObjectCanvas di atas) HARUS tetap jadi kanvas
    // TERDEPAN di antara semua layer atas-karakter stlh reorder di atas —
    // insertBefore(c, speechBubble) pas nyusun baris "di depan" bisa nyelip
    // lewat topObjectCanvas (mendorongnya jd lebih ke belakang drpd baris
    // itu), jadi harus DIPAKSA balik ke posisi tepat sebelum #speechBubble
    // di SETIAP pass reorder (bukan cuma pas dibangun pertama kali).
    if (topObjectCanvas) worldLayer.insertBefore(topObjectCanvas, speechBubble);
  }

  function updateMovement(dt) {
    const dir = heldDirections[heldDirections.length - 1];
    moving = !!dir;
    if (!moving) return;

    facing = dir;
    const speed = shiftHeld ? SPEED * WALK_SLOW_FACTOR : SPEED;
    const dist = speed * dt;
    let newX = x;
    let newY = y;
    if (dir === "up") newY -= dist;
    if (dir === "down") newY += dist;
    if (dir === "left") newX -= dist;
    if (dir === "right") newX += dist;

    // Karakter dibatasi ke batas DUNIA (bukan lagi batas jendela kamera).
    newX = clamp(newX, 0, WORLD_WIDTH - FRAME);
    newY = clamp(newY, 0, WORLD_HEIGHT - FRAME);

    // Tabrakan Block Layer (permintaan eksplisit user, lihat "Dunia dari
    // Tilemap Editor" di CLAUDE.md) — gerakan dibatalkan SELURUHNYA (bukan
    // digeser/di-slide) kalau posisi baru menabrak, karakter tetap di posisi
    // lama frame ini. Cukup krn cuma 1 sumbu yg berubah per frame
    // (heldDirections cuma py 1 arah "menang" tiap saat, lihat komentar di
    // deklarasinya), jadi tidak perlu resolusi per-sumbu terpisah.
    if (!isAreaBlocked(newX, newY)) {
      x = newX;
      y = newY;
    }

    // Pakai properti CSS "translate" (bukan "transform") buat posisi — biar
    // "transform" tetap bebas dipakai animasi CSS "jump" (lihat "Lompat
    // (Space)") tanpa keduanya rebutan/saling timpa di properti yang sama.
    character.style.translate = `${x}px ${y}px`;
    updateSpeechBubblePosition();
  }

  // #speechBubble sekarang sibling #character (anak TERAKHIR #worldLayer,
  // lihat init() & style.css) supaya selalu tergambar di atas SEMUA layer
  // map, termasuk yg posisinya di depan karakter — jadi posisinya harus
  // di-set manual tiap kali karakter bergerak (dulu otomatis ikut krn nested
  // di dalam .character). Titik anchor = tengah-atas kotak karakter (sama
  // persis titik yg dulu dipakai `left:50%; bottom:100%` relatif ke
  // .character), offset visual (center + naik ke atas kepala) tetap di CSS.
  function updateSpeechBubblePosition() {
    speechBubble.style.left = `${x + FRAME / 2}px`;
    speechBubble.style.top = `${y}px`;
  }

  // Kamera "mengejar" titik yang bikin karakter tepat di tengah jendela,
  // tapi tidak langsung nempel — didekati sedikit demi sedikit tiap frame
  // (exponential smoothing) supaya gerakannya smooth & sedikit "tertinggal"
  // dari karakter, baru menyusul pelan-pelan sampai karakter balik ke tengah
  // begitu ia berhenti.
  function updateCamera(dt) {
    const viewW = viewport.clientWidth;
    const viewH = viewport.clientHeight;

    const targetCamX = clamp(x + FRAME / 2 - viewW / 2, 0, WORLD_WIDTH - viewW);
    const targetCamY = clamp(y + FRAME / 2 - viewH / 2, 0, WORLD_HEIGHT - viewH);

    // 1 - (1-smooth)^dt: versi CAMERA_SMOOTH yang disesuaikan ke delta time,
    // supaya kecepatan "mengejar" tetap konsisten walau framerate beda-beda.
    const t = 1 - Math.pow(1 - CAMERA_SMOOTH, dt);
    camX += (targetCamX - camX) * t;
    camY += (targetCamY - camY) * t;

    worldLayer.style.transform = `translate(${-camX}px, ${-camY}px)`;
  }

  function updateAnimation(time) {
    if (!moving) {
      walkFrameIndex = 0;
      lastWalkFrameTime = time;
      setSpriteFrame(ROW[facing], IDLE_FRAME);
      return;
    }

    // Shift ditahan -> animasi jalan ikut diperlambat (durasi per frame dibagi
    // WALK_SLOW_FACTOR, bukan dikali, krn makin besar durasi = makin lambat).
    const frameDuration = shiftHeld ? FRAME_DURATION / WALK_SLOW_FACTOR : FRAME_DURATION;
    if (time - lastWalkFrameTime >= frameDuration) {
      walkFrameIndex = (walkFrameIndex + 1) % WALK_FRAMES.length;
      lastWalkFrameTime = time;
    }
    setSpriteFrame(ROW[facing], WALK_FRAMES[walkFrameIndex]);
  }

  // ================= Ganti karakter (picker Male/Female) =================
  function setCharacterSprite(gender, file) {
    currentGender = gender;
    currentFile = file;
    character.style.backgroundImage = `url("${characterPath(gender, file)}")`;
  }

  // Isi ulang grid thumbnail sesuai tab gender yang lagi ditampilkan
  // (pickerGender) — tiap thumbnail nge-crop pose idle-bawah (baris 0,
  // kolom tengah) dari sprite sheet-nya sendiri lewat background-position,
  // jadi tidak perlu file preview terpisah.
  function renderCharacterGrid() {
    characterGrid.innerHTML = "";
    CHARACTER_FILES[pickerGender].forEach((file) => {
      const thumb = document.createElement("button");
      thumb.type = "button";
      thumb.className = "character-thumb";
      if (pickerGender === currentGender && file === currentFile) {
        thumb.classList.add("selected");
      }
      thumb.title = file.replace(".png", "");
      thumb.style.backgroundImage = `url("${characterPath(pickerGender, file)}")`;
      thumb.style.backgroundSize = `${THUMB_SIZE * SHEET_COLS}px ${THUMB_SIZE * SHEET_ROWS}px`;
      thumb.style.backgroundPosition = `-${IDLE_FRAME * THUMB_SIZE}px -${ROW.down * THUMB_SIZE}px`;
      thumb.addEventListener("click", () => {
        setCharacterSprite(pickerGender, file);
        closeCharacterPicker();
      });
      characterGrid.appendChild(thumb);
    });
  }

  function openCharacterPicker() {
    pickerGender = currentGender;
    genderTabs.querySelectorAll(".gender-tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.gender === pickerGender);
    });
    renderCharacterGrid();
    characterPickerOverlay.classList.add("open");
  }

  function closeCharacterPicker() {
    characterPickerOverlay.classList.remove("open");
  }

  // Tombol "Music" (permintaan eksplisit user, khusus PC/laptop — lihat
  // @media (pointer: coarse) di style.css utk penyembunyian di HP) — buka
  // tab BARU ke video YouTube tetap (bukan navigasi/redirect di tab yg
  // sama, spy game tetap kebuka). `noopener,noreferrer` (permintaan
  // keamanan standar `window.open` ke domain eksternal) — cegah tab baru
  // itu punya akses balik (`window.opener`) ke halaman game ini.
  const MUSIC_URL = "https://youtu.be/sJx_BqzbAEc";
  musicBtn.addEventListener("click", () => {
    window.open(MUSIC_URL, "_blank", "noopener,noreferrer");
  });

  changeCharacterBtn.addEventListener("click", openCharacterPicker);
  closePickerBtn.addEventListener("click", closeCharacterPicker);
  characterPickerOverlay.addEventListener("click", (e) => {
    if (e.target === characterPickerOverlay) closeCharacterPicker();
  });
  genderTabs.querySelectorAll(".gender-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      pickerGender = tab.dataset.gender;
      genderTabs.querySelectorAll(".gender-tab").forEach((t) => t.classList.toggle("active", t === tab));
      renderCharacterGrid();
    });
  });

  // ================= Pilih Map (popup, daftar dari Firebase) =================
  // Permintaan eksplisit user — tombol "🗺️ Map" di header buka popup daftar
  // SEMUA map tersimpan di Firebase (bisa sampai ~1000), py search, terurut
  // abjad. Klik salah satu ganti dunia yg lagi jalan (switchWorldMap(),
  // lihat dekat init()) TANPA reload halaman.
  let allMapNames = []; // cache selagi popup terbuka — di-fetch ulang tiap dibuka (lihat openMapPicker)

  // Shallow REST fetch (`?shallow=true`) — Firebase RTDB balikin CUMA nama
  // key anak langsung (`{ "map_iyon": true, ... }`), BUKAN isi datanya
  // (tiles per layer bisa ribuan angka per map) — jauh lebih ringan drpd
  // `db.ref(...).once("value")` biasa yg bakal narik SEMUA data SEMUA map
  // sekaligus cuma buat nampilin daftar nama. Krn ini format REST-only (SDK
  // compat tidak expose opsi shallow), dipanggil lewat fetch() langsung ke
  // `databaseURL` yg sama dgn `firebaseConfig` (lihat <head> index.html).
  async function fetchMapNames() {
    const res = await fetch(`${firebaseConfig.databaseURL}/${TILEMAPS_PATH}.json?shallow=true`);
    if (!res.ok) throw new Error(`Gagal ambil daftar map (HTTP ${res.status})`);
    const data = await res.json();
    if (!data) return [];
    return Object.keys(data).sort((a, b) => a.localeCompare(b));
  }

  function renderMapList(query) {
    mapList.innerHTML = "";
    const q = query.trim().toLowerCase();
    const filtered = q ? allMapNames.filter((name) => name.toLowerCase().includes(q)) : allMapNames;

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "map-list-empty";
      empty.textContent = allMapNames.length === 0 ? "Belum ada map tersimpan." : "Tidak ada map yg cocok.";
      mapList.appendChild(empty);
      return;
    }

    filtered.forEach((name) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "map-list-item" + (name === WORLD_MAP_NAME ? " active" : "");
      item.textContent = name;
      item.addEventListener("click", () => {
        closeMapPicker();
        switchWorldMap(name);
      });
      mapList.appendChild(item);
    });
  }

  async function openMapPicker() {
    mapSearchInput.value = "";
    mapPickerOverlay.classList.add("open");
    mapList.innerHTML = '<div class="map-list-empty">Memuat daftar map…</div>';
    try {
      allMapNames = await fetchMapNames();
    } catch (err) {
      mapList.innerHTML = "";
      const errEl = document.createElement("div");
      errEl.className = "map-list-empty";
      errEl.textContent = "Gagal memuat daftar map.";
      mapList.appendChild(errEl);
      console.warn("Gagal memuat daftar map dari Firebase:", err);
      return;
    }
    renderMapList("");
    mapSearchInput.focus();
  }

  function closeMapPicker() {
    mapPickerOverlay.classList.remove("open");
  }

  openMapPickerBtn.addEventListener("click", openMapPicker);
  closeMapPickerBtn.addEventListener("click", closeMapPicker);
  mapPickerOverlay.addEventListener("click", (e) => {
    if (e.target === mapPickerOverlay) closeMapPicker();
  });
  mapSearchInput.addEventListener("input", () => renderMapList(mapSearchInput.value));

  // ================= Peringatan buka Editor di HP =================
  // Permintaan eksplisit user — Tilemap Editor tidak dirancang responsif
  // (lihat tilemap-style.css, tidak py breakpoint mobile sama sekali),
  // jadi di device layar sentuh klik "Editor" ditahan dulu, ditawarin
  // konfirmasi drpd langsung nyasar ke halaman yg berantakan di HP tanpa
  // peringatan apa pun.
  editorLink.addEventListener("click", (e) => {
    if (!window.matchMedia("(pointer: coarse)").matches) return; // desktop/mouse — biarkan navigasi normal
    e.preventDefault();
    editorWarningOverlay.classList.add("open");
  });

  function closeEditorWarning() {
    editorWarningOverlay.classList.remove("open");
  }

  editorWarningBackBtn.addEventListener("click", closeEditorWarning);
  editorWarningOverlay.addEventListener("click", (e) => {
    if (e.target === editorWarningOverlay) closeEditorWarning();
  });
  editorWarningContinueBtn.addEventListener("click", () => {
    window.location.href = editorLink.href; // "Lanjut" — tetap buka Editor sesuai href aslinya
  });

  // ================= Ngomong (chat bubble) =================
  const BUBBLE_MAX_CHARS_PER_LINE = 30;
  let bubbleHideTimer = null;
  const sendChatBtn = document.getElementById("sendChatBtn");

  // Ambil teks dari #chatInput, tampilkan sbg bubble kalau tidak kosong,
  // lalu selalu kosongkan lagi field-nya (siap diisi pesan berikutnya) —
  // input SELALU kelihatan (permintaan eksplisit user, tidak lagi
  // toggle show/hide via Enter spt versi lama), jadi tidak ada lagi
  // openChatInput()/closeChatInput() yg nge-hide elemennya.
  function submitChatInput() {
    const text = chatInput.value.trim();
    chatInput.value = "";
    // Lepas fokus dari input stlh submit (permintaan eksplisit user) — tanpa
    // ini, fokus TETAP nempel di #chatInput stlh Enter (cuma value-nya yg
    // dikosongkan), jadi W/A/S/D abis ngirim pesan masih ke-anggap ngetik
    // (lihat isTypingInField()) drpd langsung gerakin karakter.
    chatInput.blur();
    if (text) showSpeechBubble(text);
  }

  // Pecah teks jadi baris maks BUBBLE_MAX_CHARS_PER_LINE karakter, greedy
  // word-wrap (pecah di spasi selama muat). Kata yang sendirian sudah lebih
  // panjang dari batas (jarang, tapi bisa terjadi) dipaksa dipotong per
  // BUBBLE_MAX_CHARS_PER_LINE juga, supaya tidak ada satu baris pun yang
  // kepanjangan.
  function wrapText(text, maxChars) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let current = "";
    words.forEach((word) => {
      if (word.length > maxChars) {
        if (current) {
          lines.push(current);
          current = "";
        }
        for (let i = 0; i < word.length; i += maxChars) {
          lines.push(word.slice(i, i + maxChars));
        }
        return;
      }
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > maxChars) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    });
    if (current) lines.push(current);
    return lines;
  }

  function showSpeechBubble(text) {
    speechBubble.textContent = wrapText(text, BUBBLE_MAX_CHARS_PER_LINE).join("\n");
    speechBubble.classList.add("visible");
    clearTimeout(bubbleHideTimer);
    bubbleHideTimer = setTimeout(() => {
      speechBubble.classList.remove("visible");
    }, BUBBLE_DURATION);
  }

  // Enter = TOGGLE mode ngetik/mode gerak (permintaan eksplisit user, khusus
  // PC/laptop — mempermudah gonta-ganti tanpa perlu klik manual ke field):
  // - Fokus lagi di #chatInput → submit (spt sebelumnya) + `blur()` (lihat
  //   submitChatInput()) → balik ke mode gerak (WASD langsung jalan lagi).
  // - TIDAK fokus di situ → `chatInput.focus()` (masuk mode ngetik), TANPA
  //   submit apa pun (field toh kosong sejak submit terakhir) — jadi Enter
  //   sekarang py 2 arah: buka mode ngetik DAN nutupnya, gantiin gabungan
  //   "klik field" (buka) + "Enter sekali lagi" (submit doang, tanpa nutup)
  //   versi sebelumnya.
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (document.activeElement === chatInput) {
      e.preventDefault();
      submitChatInput();
      return;
    }
    // Jangan nyerobot fokus kalau lagi ngetik di field LAIN (mis.
    // #mapSearchInput di popup Pilih Map, lihat isTypingInField()) ATAU lagi
    // ada overlay/popup lain yg kebuka (Karakter/Pilih Map/Peringatan
    // Editor) — Enter di situ punya konteksnya sendiri2 (submit search,
    // dst.), bukan urusan toggle chat ini.
    if (isTypingInField()) return;
    if (characterPickerOverlay.classList.contains("open")) return;
    if (mapPickerOverlay.classList.contains("open")) return;
    if (editorWarningOverlay.classList.contains("open")) return;
    e.preventDefault();
    chatInput.focus();
  });

  sendChatBtn.addEventListener("click", submitChatInput);

  let lastTime = 0;
  function loop(time) {
    // Normalisasi delta time ke satuan "per frame 60fps" supaya SPEED tetap
    // konsisten walau refresh rate layar beda-beda.
    const dt = lastTime ? (time - lastTime) / (1000 / 60) : 1;
    lastTime = time;

    updateMovement(dt);
    updateDepthSort();
    updateCamera(dt);
    updateAnimation(time);

    requestAnimationFrame(loop);
  }

  // Muat map (WORLD_MAP_NAME yg berlaku saat dipanggil) & posisikan ulang
  // karakter/kamera/bubble ke tengah dunia BARU — dipakai pas load pertama
  // (init()) MAUPUN pas ganti map lewat popup "Pilih Map" (switchWorldMap()),
  // krn kedua kasus butuh langkah yg SAMA persis stlh data map selesai dimuat.
  async function loadAndSetupWorld() {
    // Isi WORLD_WIDTH/HEIGHT & render layer dunia (atau fallback kalau
    // gagal) — HARUS selesai dulu sblm hitung posisi karakter/kamera di
    // bawah, krn keduanya bergantung pada ukuran dunia yg sebenarnya.
    await loadWorldMap();
    worldLayer.style.width = `${WORLD_WIDTH}px`;
    worldLayer.style.height = `${WORLD_HEIGHT}px`;
    mapLabelName.textContent = WORLD_MAP_NAME;

    // Pindahkan #speechBubble jadi anak TERAKHIR #worldLayer (setelah semua
    // <canvas> layer map selesai dibuat di atas) — supaya bubble SELALU
    // tergambar paling depan, tidak ketutup layer map yg posisinya di atas
    // karakter (lihat komentar panjang di style.css utk alasan lengkapnya).
    // appendChild() pada elemen yg sudah ada di DOM otomatis MEMINDAHKAN-nya
    // (bukan menduplikasi) — jg berarti aman dipanggil ULANG tiap ganti map.
    worldLayer.appendChild(speechBubble);

    // Mulai di Start Position (diset di Tilemap Editor) kalau map-nya py
    // itu — fallback ke TENGAH dunia kalau tidak (perilaku lama, jg dipakai
    // pas fallback ke samplemap.png statis). Diklamp ke batas dunia jg,
    // jaga2 kalau map di-resize di editor SETELAH Start Position diset dgn
    // cara yg entah kenapa lolos dari clamp di sisi editor (defense in depth).
    if (startPositionWorld) {
      x = clamp(startPositionWorld.x, 0, WORLD_WIDTH - FRAME);
      y = clamp(startPositionWorld.y, 0, WORLD_HEIGHT - FRAME);
    } else {
      x = (WORLD_WIDTH - FRAME) / 2;
      y = (WORLD_HEIGHT - FRAME) / 2;
    }
    character.style.translate = `${x}px ${y}px`;
    updateSpeechBubblePosition();
    setSpriteFrame(ROW.down, IDLE_FRAME);
    // Urutan depan/belakang AWAL (Y-sorting) — lastDepthSplitRow sudah
    // direset ke -1 di buildWorldFromMapData()/buildWorldFallback(), jadi
    // ini DIJAMIN jalan (bukan di-skip krn "belum berubah") & langsung
    // nyusun kanvas layer atas sesuai posisi awal karakter yg baru diisi.
    updateDepthSort();

    // Kamera langsung pas di tengah karakter (tanpa animasi "mengejar").
    const viewW = viewport.clientWidth;
    const viewH = viewport.clientHeight;
    camX = clamp(x + FRAME / 2 - viewW / 2, 0, WORLD_WIDTH - viewW);
    camY = clamp(y + FRAME / 2 - viewH / 2, 0, WORLD_HEIGHT - viewH);
    worldLayer.style.transform = `translate(${-camX}px, ${-camY}px)`;
  }

  // Dipanggil dari popup "Pilih Map" (lihat di bawah) — ganti map aktif &
  // rebuild dunia dgn map yg baru, TANPA reload halaman (setup karakter
  // sprite/listener dll di init() cuma perlu jalan sekali, tidak diulang).
  async function switchWorldMap(name) {
    WORLD_MAP_NAME = name;
    await loadAndSetupWorld();
  }

  async function init() {
    character.style.width = `${FRAME}px`;
    character.style.height = `${FRAME}px`;
    character.style.backgroundImage = `url("${characterPath(currentGender, currentFile)}")`;
    character.style.backgroundSize = `${FRAME * SHEET_COLS}px ${FRAME * SHEET_ROWS}px`;

    await loadAndSetupWorld();

    requestAnimationFrame(loop);
  }

  init();
})();
