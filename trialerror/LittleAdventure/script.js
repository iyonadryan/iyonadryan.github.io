(function () {
  "use strict";

  // ================= Konfigurasi sprite =================
  // Sprite sheet karakter: 3 kolom x 4 baris, tiap frame 32x32px asli.
  // Baris:  0 = jalan bawah, 1 = jalan kiri, 2 = jalan kanan, 3 = jalan atas
  // Kolom:  0 & 2 = kaki melangkah, 1 = tengah/idle (dipakai juga sbg pose diam)
  const SPRITE_SRC = "img/character/Male/Male 01-1.png";
  const FRAME_SRC = 32; // px, ukuran asli 1 frame di file PNG
  const SHEET_COLS = 3;
  const SHEET_ROWS = 4;
  const SCALE = 1.5; // pixel-art diperbesar 1.5x biar keliatan jelas di layar
  const FRAME = FRAME_SRC * SCALE; // ukuran 1 frame setelah discale (48px)

  const ROW = { down: 0, left: 1, right: 2, up: 3 };

  // Urutan kolom saat animasi jalan: tengah -> kiri -> tengah -> kanan,
  // berulang selama tombol arah ditahan. Kolom 1 juga dipakai sbg idle.
  const WALK_FRAMES = [1, 0, 1, 2];
  const IDLE_FRAME = 1;
  const FRAME_DURATION = 140; // ms per pergantian frame animasi jalan
  const SPEED = 2.4; // px per frame animasi (~60fps) saat bergerak

  // ================= Konfigurasi peta dunia =================
  // Gambar peta (persegi, hasil tile map) — diskalakan pakai SCALE yang SAMA
  // dgn karakter di atas, supaya rasio karakter thd peta tetap konsisten.
  const MAP_SRC = "img/samplemap.png";
  const MAP_SRC_SIZE = 1920; // px, ukuran asli map (persegi: 1920x1920)

  // Dunia (#worldLayer) jauh lebih besar dari jendela kamera (#gameWorld)
  // supaya ada ruang buat karakter jalan-jalan & kameranya kelihatan geser.
  // Ukurannya sekarang mengikuti ukuran peta setelah discale (bukan lagi
  // angka arbitrer) — karakter dibatasi persis ke tepi gambar peta.
  const WORLD_WIDTH = MAP_SRC_SIZE * SCALE;
  const WORLD_HEIGHT = MAP_SRC_SIZE * SCALE;
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

  // Kalau window kehilangan fokus (alt-tab dll), lepas semua tombol supaya
  // karakter tidak "nyangkut" jalan terus walau tombolnya sudah tidak ditekan.
  window.addEventListener("blur", () => {
    heldDirections = [];
  });

  function setSpriteFrame(row, col) {
    character.style.backgroundPosition = `-${col * FRAME}px -${row * FRAME}px`;
  }

  function updateMovement(dt) {
    const dir = heldDirections[heldDirections.length - 1];
    moving = !!dir;
    if (!moving) return;

    facing = dir;
    const dist = SPEED * dt;
    if (dir === "up") y -= dist;
    if (dir === "down") y += dist;
    if (dir === "left") x -= dist;
    if (dir === "right") x += dist;

    // Karakter dibatasi ke batas DUNIA (bukan lagi batas jendela kamera).
    x = clamp(x, 0, WORLD_WIDTH - FRAME);
    y = clamp(y, 0, WORLD_HEIGHT - FRAME);

    character.style.transform = `translate(${x}px, ${y}px)`;
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

    if (time - lastWalkFrameTime >= FRAME_DURATION) {
      walkFrameIndex = (walkFrameIndex + 1) % WALK_FRAMES.length;
      lastWalkFrameTime = time;
    }
    setSpriteFrame(ROW[facing], WALK_FRAMES[walkFrameIndex]);
  }

  let lastTime = 0;
  function loop(time) {
    // Normalisasi delta time ke satuan "per frame 60fps" supaya SPEED tetap
    // konsisten walau refresh rate layar beda-beda.
    const dt = lastTime ? (time - lastTime) / (1000 / 60) : 1;
    lastTime = time;

    updateMovement(dt);
    updateCamera(dt);
    updateAnimation(time);

    requestAnimationFrame(loop);
  }

  function init() {
    character.style.width = `${FRAME}px`;
    character.style.height = `${FRAME}px`;
    character.style.backgroundImage = `url("${SPRITE_SRC}")`;
    character.style.backgroundSize = `${FRAME * SHEET_COLS}px ${FRAME * SHEET_ROWS}px`;

    worldLayer.style.width = `${WORLD_WIDTH}px`;
    worldLayer.style.height = `${WORLD_HEIGHT}px`;
    worldLayer.style.backgroundImage = `url("${MAP_SRC}")`;
    worldLayer.style.backgroundSize = `${WORLD_WIDTH}px ${WORLD_HEIGHT}px`;

    // Mulai di tengah dunia, menghadap bawah, pose idle.
    x = (WORLD_WIDTH - FRAME) / 2;
    y = (WORLD_HEIGHT - FRAME) / 2;
    character.style.transform = `translate(${x}px, ${y}px)`;
    setSpriteFrame(ROW.down, IDLE_FRAME);

    // Kamera langsung pas di tengah karakter sejak awal (tanpa animasi
    // "mengejar" pas load pertama kali).
    const viewW = viewport.clientWidth;
    const viewH = viewport.clientHeight;
    camX = clamp(x + FRAME / 2 - viewW / 2, 0, WORLD_WIDTH - viewW);
    camY = clamp(y + FRAME / 2 - viewH / 2, 0, WORLD_HEIGHT - viewH);
    worldLayer.style.transform = `translate(${-camX}px, ${-camY}px)`;

    requestAnimationFrame(loop);
  }

  init();
})();
