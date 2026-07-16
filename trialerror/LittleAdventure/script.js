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
  const WORLD_MAP_NAME = "map_iyon";
  const WORLD_MAP_PATH = `trial-error/littleAdventure/tilemaps/${WORLD_MAP_NAME}`;
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
  // CLAUDE.md Tilemap Editor) & batas posisi Background/Foreground, sama
  // persis dgn BLOCK_TILESET_KEY/BLOCK_SUBDIVISION/LOCKED_MAX_POSITION di
  // tilemap-script.js.
  const BLOCK_TILESET_KEY = "Block";
  const BLOCK_SUBDIVISION = 4;
  const LOCKED_MAX_POSITION = 0;

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

  const changeCharacterBtn = document.getElementById("changeCharacterBtn");
  const characterPickerOverlay = document.getElementById("characterPickerOverlay");
  const closePickerBtn = document.getElementById("closePickerBtn");
  const genderTabs = document.getElementById("genderTabs");
  const characterGrid = document.getElementById("characterGrid");

  const chatInput = document.getElementById("chatInput");
  const speechBubble = document.getElementById("speechBubble");
  const BUBBLE_DURATION = 4000; // ms, bubble ilang otomatis stlh sekian lama

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
    if (document.activeElement === chatInput) return; // lagi ngetik chat, jangan dianggap tombol gerak
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
    if (document.activeElement === chatInput) return; // lagi ngetik chat, jangan dianggap tombol jalan-pelan
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

  window.addEventListener("keydown", (e) => {
    if (document.activeElement === chatInput) return; // lagi ngetik chat, spasi jadi karakter biasa
    if (e.code !== "Space") return;
    e.preventDefault(); // spasi jangan sampai scroll halaman
    if (isJumping) return; // lagi lompat, abaikan spasi tambahan sampai selesai
    isJumping = true;
    character.classList.add("jumping");
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
    blockLayerData = null;
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

  // Bangun dunia dari map hasil Tilemap Editor. Urutan render (permintaan
  // eksplisit user): Background & Foreground (layerPosition <= 0) SELALU di
  // BAWAH karakter, SEMUA layer lain (layer user + Block Layer) di ATAS
  // karakter — dicapai murni lewat urutan DOM (insertBefore vs appendChild),
  // krn #worldLayer/.character/canvas semua `position:absolute` TANPA
  // z-index, jadi urutan DOM = urutan tumpuk (lihat CLAUDE.md).
  async function buildWorldFromMapData(data) {
    const mapWidth = data.mapWidth;
    const mapHeight = data.mapHeight;
    WORLD_WIDTH = mapWidth * TILE_SRC * SCALE;
    WORLD_HEIGHT = mapHeight * TILE_SRC * SCALE;

    const layers = Array.isArray(data.layers) ? data.layers : [];
    const visibleLayers = layers.filter((l) => l.visible !== false && l.tilesetType !== BLOCK_TILESET_KEY);

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

    const belowLayers = visibleLayers.filter((l) => l.layerPosition <= LOCKED_MAX_POSITION).sort((a, b) => a.layerPosition - b.layerPosition);
    const aboveLayers = visibleLayers.filter((l) => l.layerPosition > LOCKED_MAX_POSITION).sort((a, b) => a.layerPosition - b.layerPosition);

    belowLayers.forEach((layer) => {
      worldLayer.insertBefore(makeWorldLayerCanvas(layer, mapWidth, mapHeight, imageCache), character);
    });
    aboveLayers.forEach((layer) => {
      worldLayer.appendChild(makeWorldLayerCanvas(layer, mapWidth, mapHeight, imageCache));
    });

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
  }

  async function loadWorldMap() {
    try {
      const snapshot = await db.ref(WORLD_MAP_PATH).once("value");
      const data = snapshot.val();
      if (!data || !Array.isArray(data.layers)) throw new Error(`Map "${WORLD_MAP_NAME}" kosong/tidak ditemukan di Firebase`);
      await buildWorldFromMapData(data);
    } catch (err) {
      console.warn("Gagal memuat dunia dari Tilemap Editor, pakai fallback samplemap.png:", err);
      buildWorldFallback();
    }
  }

  // Cek apakah kotak karakter (FRAME x FRAME) di posisi (px, py) menabrak
  // sel Block Layer manapun — di-scan per-sel (bukan cuma 4 pojok) krn grid
  // Block Layer jauh lebih rapat drpd FRAME (lihat BLOCK_SUBDIVISION di
  // CLAUDE.md), jadi 1 sel yg diblok bisa jatuh di TENGAH salah satu sisi
  // kotak tanpa kena pojok manapun kalau cuma dicek 4 pojoknya saja.
  function isAreaBlocked(px, py) {
    if (!blockLayerData) return false;
    const { cols, rows, cellSize, tiles } = blockLayerData;
    const colStart = Math.max(0, Math.floor(px / cellSize));
    const colEnd = Math.min(cols - 1, Math.floor((px + FRAME - 1) / cellSize));
    const rowStart = Math.max(0, Math.floor(py / cellSize));
    const rowEnd = Math.min(rows - 1, Math.floor((py + FRAME - 1) / cellSize));
    for (let row = rowStart; row <= rowEnd; row++) {
      for (let col = colStart; col <= colEnd; col++) {
        if (tiles[row * cols + col] !== -1 && tiles[row * cols + col] != null) return true;
      }
    }
    return false;
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

  // ================= Ngomong (chat bubble) =================
  const BUBBLE_MAX_CHARS_PER_LINE = 30;
  let bubbleHideTimer = null;

  function openChatInput() {
    chatInput.hidden = false;
    chatInput.value = "";
    chatInput.focus();
  }

  function closeChatInput() {
    chatInput.hidden = true;
    chatInput.blur();
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

  // Enter di luar chat input = buka input; Enter di dalam chat input = submit
  // (tutup input, tampilkan bubble kalau ada teksnya, batal kalau kosong).
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (document.activeElement === chatInput) {
      const text = chatInput.value.trim();
      closeChatInput();
      if (text) showSpeechBubble(text);
    } else {
      openChatInput();
    }
  });

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

  async function init() {
    character.style.width = `${FRAME}px`;
    character.style.height = `${FRAME}px`;
    character.style.backgroundImage = `url("${characterPath(currentGender, currentFile)}")`;
    character.style.backgroundSize = `${FRAME * SHEET_COLS}px ${FRAME * SHEET_ROWS}px`;

    // Isi WORLD_WIDTH/HEIGHT & render layer dunia (atau fallback kalau
    // gagal) — HARUS selesai dulu sblm hitung posisi awal karakter/kamera
    // di bawah, krn keduanya bergantung pada ukuran dunia yg sebenarnya.
    await loadWorldMap();
    worldLayer.style.width = `${WORLD_WIDTH}px`;
    worldLayer.style.height = `${WORLD_HEIGHT}px`;

    // Pindahkan #speechBubble jadi anak TERAKHIR #worldLayer (setelah semua
    // <canvas> layer map selesai dibuat di atas) — supaya bubble SELALU
    // tergambar paling depan, tidak ketutup layer map yg posisinya di atas
    // karakter (lihat komentar panjang di style.css utk alasan lengkapnya).
    // appendChild() pada elemen yg sudah ada di DOM otomatis MEMINDAHKAN-nya
    // (bukan menduplikasi), jadi ini aman dipanggil dari .character ke sini.
    worldLayer.appendChild(speechBubble);

    // Mulai di tengah dunia, menghadap bawah, pose idle.
    x = (WORLD_WIDTH - FRAME) / 2;
    y = (WORLD_HEIGHT - FRAME) / 2;
    character.style.translate = `${x}px ${y}px`;
    updateSpeechBubblePosition();
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
