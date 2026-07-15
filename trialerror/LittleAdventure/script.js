(function () {
  "use strict";

  // ================= Konfigurasi sprite =================
  // Sprite sheet karakter: 3 kolom x 4 baris, tiap frame 32x32px asli.
  // Baris:  0 = jalan bawah, 1 = jalan kiri, 2 = jalan kanan, 3 = jalan atas
  // Kolom:  0 & 2 = kaki melangkah, 1 = tengah/idle (dipakai juga sbg pose diam)
  const SPRITE_SRC = "img/Male/Male 01-1.png";
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

  const KEY_TO_DIR = {
    ArrowUp: "up", w: "up", W: "up",
    ArrowDown: "down", s: "down", S: "down",
    ArrowLeft: "left", a: "left", A: "left",
    ArrowRight: "right", d: "right", D: "right",
  };

  const character = document.getElementById("character");
  const world = document.getElementById("gameWorld");

  let x = 0;
  let y = 0;
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

    x = Math.max(0, Math.min(world.clientWidth - FRAME, x));
    y = Math.max(0, Math.min(world.clientHeight - FRAME, y));

    character.style.transform = `translate(${x}px, ${y}px)`;
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
    updateAnimation(time);

    requestAnimationFrame(loop);
  }

  function init() {
    character.style.width = `${FRAME}px`;
    character.style.height = `${FRAME}px`;
    character.style.backgroundImage = `url("${SPRITE_SRC}")`;
    character.style.backgroundSize = `${FRAME * SHEET_COLS}px ${FRAME * SHEET_ROWS}px`;

    // Mulai di tengah dunia, menghadap bawah, pose idle.
    x = (world.clientWidth - FRAME) / 2;
    y = (world.clientHeight - FRAME) / 2;
    character.style.transform = `translate(${x}px, ${y}px)`;
    setSpriteFrame(ROW.down, IDLE_FRAME);

    requestAnimationFrame(loop);
  }

  init();
})();
