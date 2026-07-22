(function () {
  "use strict";

  // ================= Konfigurasi =================
  const TILE_SIZE = 32; // px, ukuran 1 tile sumber (sesuai semua tileset PIPO di bawah)
  const DEFAULT_MAP_WIDTH = 25;
  const DEFAULT_MAP_HEIGHT = 19;
  const EMPTY = -1; // penanda "kosong" (tidak ada tile) di array tiles tiap layer
  const AUTOSAVE_KEY = "littleadventure_tilemap_autosave";
  const AUTOSAVE_DEBOUNCE = 600; // ms, jeda sebelum nulis ke localStorage stlh perubahan terakhir

  // Daftar tileset yang TERSEDIA — semua dari img/tileset/SampleMap/, permintaan
  // eksplisit user (bukan lagi bebas import file apa pun). Tiap LAYER cuma
  // boleh pakai SATU tipe dari daftar ini (lihat "1 layer = 1 tileset" di
  // CLAUDE.md) — daftar ini jg dipakai di tab panel Tileset & modal Layer Baru.
  const TILESET_DIR = "img/tileset/SampleMap/";
  // `color` dipakai buat badge kapsul warna-warni di panel Layers (lihat
  // renderLayerList()) — 1 warna tetap per tipe, biar gampang bedain sekilas
  // pandang layer mana pakai tileset apa tanpa harus baca teksnya.
  const TILESET_TYPES = [
    { key: "Base", label: "Base", file: "[Base]BaseChip_pipo.png", color: "#64748b" },
    { key: "LightShadow", label: "Light Shadow", file: "LightShadow_pipo.png", color: "#52525b" },
    { key: "Dirt", label: "Dirt", file: "[A]Dirt_pipo.png", color: "#92400e" },
    { key: "Flower", label: "Flower", file: "[A]Flower_pipo.png", color: "#db2777" },
    { key: "Grass", label: "Grass", file: "[A]Grass_pipo.png", color: "#16a34a" },
    { key: "WallUp", label: "Wall Up", file: "[A]Wall-Up_pipo.png", color: "#78716c" },
    { key: "Water", label: "Water", file: "[A]Water_pipo.png", color: "#0284c7" },
    { key: "WaterFall", label: "Water Fall", file: "[A]WaterFall_pipo.png", color: "#0891b2" },
  ];
  const DEFAULT_TILESET_TYPE = "Base"; // default Background & Foreground, sesuai permintaan user

  function tilesetTypeDef(key) {
    return TILESET_TYPES.find((t) => t.key === key) || TILESET_TYPES[0];
  }
  function tilesetFile(key) {
    return TILESET_DIR + tilesetTypeDef(key).file;
  }

  // ================= Mode Layer (Ground/Object/Mask) =================
  // Permintaan eksplisit user — SETIAP layer sekarang py field `mode` yg
  // menentukan perilaku render-nya di GAME (lihat "Y-sorting"/"Dunia dari
  // Tilemap Editor" di script.js/CLAUDE.md):
  //   - "Ground" = SELALU di belakang karakter (statis) — dipakai Background/
  //     Foreground bawaan, TAPI sekarang bisa jg dipilih user utk layer baru
  //     manapun (bukan cuma 2 slot tetap itu lagi).
  //   - "Object" = di depan/belakang karakter scr DINAMIS (Y-sorting
  //     per-baris, lihat "Y-sorting") — default utk layer baru, cocok dgn
  //     perilaku SEMUA layer user versi2 sebelumnya (dulu semua layer selain
  //     Background/Foreground otomatis begini, ditentukan dari layerPosition
  //     doang; sekarang eksplisit lewat field ini).
  //   - "Mask" = reserved, CUMA Block Layer & Top Object (lihat di bawah) —
  //     BUKAN pilihan user (tidak muncul di modal Layer Baru), tidak
  //     digambar spt layer biasa sama sekali (data-nya dipakai
  //     collision/override Y-sorting, bukan visual).
  const LAYER_MODE_GROUND = "Ground";
  const LAYER_MODE_OBJECT = "Object";
  const LAYER_MODE_MASK = "Mask";
  const USER_LAYER_MODES = [LAYER_MODE_GROUND, LAYER_MODE_OBJECT]; // pilihan di modal Layer Baru — Mask TIDAK termasuk
  const DEFAULT_LAYER_MODE = LAYER_MODE_OBJECT; // cocok dgn perilaku default layer user versi lama (selalu Y-sorted)
  // Warna badge "Mode: ..." di panel Layers — Ground COKLAT (permintaan
  // eksplisit user, "berwarna coklat seperti Background dan Foreground"),
  // Object slate netral (tidak diminta warna khusus), Mask UNGU (penanda
  // "reserved/khusus", sengaja beda dari merah/biru badge TILESET Block
  // Layer/Top Object yg sudah ada — 2 lapis warna beda makna, jangan disamain).
  const LAYER_MODE_COLORS = {
    [LAYER_MODE_GROUND]: "#8b5e34",
    [LAYER_MODE_OBJECT]: "#4b5563",
    [LAYER_MODE_MASK]: "#7c3aed",
  };
  function modeColor(mode) {
    return LAYER_MODE_COLORS[mode] || LAYER_MODE_COLORS[LAYER_MODE_OBJECT];
  }

  // ================= Block Layer (layer khusus, bukan tileset gambar) =================
  // Satu layer SINGLETON tambahan, TIDAK dibuat lewat modal Layer Baru spt
  // layer biasa — dibuat sekali di initDefaultLayers(), permanen terkunci
  // (isLayerLocked()) & selalu PALING ATAS (layerPosition tertinggi).
  const BLOCK_TILESET_KEY = "Block"; // bukan entry di TILESET_TYPES — sengaja BUKAN tileset gambar sama sekali
  const BLOCK_LAYER_NAME = "Block Layer";
  const BLOCK_LAYER_POSITION = 99; // selalu tertinggi — TILESET_MAX_POSITION user cuma sampai 98 (lihat nextUserLayerPosition())
  const BLOCK_SUBDIVISION = 4; // grid Block Layer 4x lebih rapat per sisi drpd layer biasa (16x jumlah sel)
  const BLOCK_TILE_SIZE = TILE_SIZE / BLOCK_SUBDIVISION; // 8px/sel — 4x lebih kecil, jadi luas PIKSEL totalnya tetap sama persis dgn layer biasa (mapWidth*TILE_SIZE x mapHeight*TILE_SIZE)
  const BLOCK_TILE_VALUE = 0; // satu-satunya nilai "terisi" di layer ini — bukan index tileset asli, cuma penanda
  const BLOCK_COLOR = "rgba(220, 38, 38, 0.5)"; // merah, opacity 50% baked-in (permintaan eksplisit user)

  function isBlockLayer(layer) {
    return layer.tilesetType === BLOCK_TILESET_KEY;
  }

  // Label/warna badge "Tileset: ..." di panel Layers — Block Layer & Top
  // Object bukan bagian dari TILESET_TYPES, jadi di-intercept duluan
  // sebelum fallback ke tilesetTypeDef() (yg cuma tau 8 tileset gambar asli).
  function tilesetLabel(key) {
    if (key === BLOCK_TILESET_KEY) return "Red Block";
    if (key === TOP_OBJECT_TILESET_KEY) return "Top Object";
    return tilesetTypeDef(key).label;
  }
  function tilesetColor(key) {
    if (key === BLOCK_TILESET_KEY) return "#dc2626";
    if (key === TOP_OBJECT_TILESET_KEY) return "#2563eb";
    return tilesetTypeDef(key).color;
  }

  // Ukuran grid efektif 1 layer — beda utk Block Layer (lebih rapat, sel
  // lebih kecil) drpd layer biasa (grid = mapWidth x mapHeight, sel = TILE_SIZE).
  // Dipakai di mana pun perlu tau "berapa kolom/baris/piksel per sel" tanpa
  // peduli lagi ngerender layer biasa atau Block Layer.
  // Versi `...For(layer, w, h)` menerima w/h eksplisit (dipakai `resizeMapTo`
  // yg butuh dimensi LAMA & BARU sekaligus, sebelum `mapWidth`/`mapHeight`
  // global ke-update) — `layerGridDims(layer)` (tanpa `For`) pakai `mapWidth`/
  // `mapHeight` yg sedang berlaku, dipakai di semua tempat lain.
  function layerGridDimsFor(layer, w, h) {
    return isBlockLayer(layer) ? { cols: w * BLOCK_SUBDIVISION, rows: h * BLOCK_SUBDIVISION } : { cols: w, rows: h };
  }
  function layerGridDims(layer) {
    return { ...layerGridDimsFor(layer, mapWidth, mapHeight), cellSize: isBlockLayer(layer) ? BLOCK_TILE_SIZE : TILE_SIZE };
  }

  function createBlockLayer() {
    const cols = mapWidth * BLOCK_SUBDIVISION;
    const rows = mapHeight * BLOCK_SUBDIVISION;
    return {
      name: BLOCK_LAYER_NAME,
      visible: true,
      opacity: 1,
      tilesetType: BLOCK_TILESET_KEY,
      layerPosition: BLOCK_LAYER_POSITION,
      mode: LAYER_MODE_MASK,
      tiles: new Array(cols * rows).fill(EMPTY),
    };
  }

  // ================= Top Object (layer khusus, mask "selalu di depan
  // karakter" — permintaan eksplisit user) =================
  // Singleton terkunci SAMA persis pola Block Layer (lihat di atas) — beda
  // utamanya: (1) grid NORMAL (mapWidth x mapHeight, BUKAN grid 4x lebih
  // rapat spt Block Layer, krn presisi sub-tile tidak perlu di sini), (2)
  // posisinya SEDIKIT di bawah Block Layer (98, bukan 99) — dua2nya layer
  // "utility" terkunci di ujung PALING ATAS tumpukan. Bukan layer yg
  // digambar sendiri di GAME — cuma MASK yg nandain sel mana di layer LAIN
  // (layerPosition > 0) yg harus selalu di depan karakter, ngabaikan
  // Y-sorting biasa (lihat "Y-sorting" & "Top Object" di CLAUDE.md).
  const TOP_OBJECT_TILESET_KEY = "TopObject"; // bukan entry TILESET_TYPES, sama alasannya dgn BLOCK_TILESET_KEY
  const TOP_OBJECT_LAYER_NAME = "Top Object";
  const TOP_OBJECT_LAYER_POSITION = 98; // tepat di bawah Block Layer (99) — USER_LAYER_MAX_POSITION diciutkan ke 97 (lihat di bawah)
  const TOP_OBJECT_TILE_VALUE = 0; // sama pola dgn BLOCK_TILE_VALUE — satu2nya nilai "ditandai", bukan index tileset asli
  const TOP_OBJECT_COLOR = "rgba(37, 99, 235, 0.5)"; // biru, opacity 50% — sengaja beda warna dari Block Layer (merah) biar gampang dibedain scr visual pas edit

  function isTopObjectLayer(layer) {
    return layer.tilesetType === TOP_OBJECT_TILESET_KEY;
  }

  function createTopObjectLayer() {
    return {
      name: TOP_OBJECT_LAYER_NAME,
      visible: true,
      opacity: 1,
      tilesetType: TOP_OBJECT_TILESET_KEY,
      layerPosition: TOP_OBJECT_LAYER_POSITION,
      mode: LAYER_MODE_MASK,
      tiles: new Array(mapWidth * mapHeight).fill(EMPTY), // grid NORMAL, bukan grid Block Layer yg lebih rapat
    };
  }

  // ================= DOM refs =================
  const layerList = document.getElementById("layerList");
  const activeLayerNameLabel = document.getElementById("activeLayerNameLabel");
  const addLayerBtn = document.getElementById("addLayerBtn");
  const removeLayerBtn = document.getElementById("removeLayerBtn");
  const moveLayerUpBtn = document.getElementById("moveLayerUpBtn");
  const moveLayerDownBtn = document.getElementById("moveLayerDownBtn");

  const toolGroup = document.getElementById("toolGroup");
  const undoBtn = document.getElementById("undoBtn");
  const redoBtn = document.getElementById("redoBtn");
  const showGridCheckbox = document.getElementById("showGridCheckbox");
  const mapWidthInput = document.getElementById("mapWidthInput");
  const mapHeightInput = document.getElementById("mapHeightInput");
  const resizeMapBtn = document.getElementById("resizeMapBtn");
  const zoomOutBtn = document.getElementById("zoomOutBtn");
  const zoomInBtn = document.getElementById("zoomInBtn");
  const zoomFitBtn = document.getElementById("zoomFitBtn");
  const zoomLabel = document.getElementById("zoomLabel");
  const clearAllBtn = document.getElementById("clearAllBtn");
  const bgSwatches = document.getElementById("bgSwatches");

  const saveJsonBtn = document.getElementById("saveJsonBtn");
  const loadJsonBtn = document.getElementById("loadJsonBtn");
  const loadJsonFile = document.getElementById("loadJsonFile");
  const mapNameInput = document.getElementById("mapNameInput");
  const saveFirebaseBtn = document.getElementById("saveFirebaseBtn");
  const openLoadMapModalBtn = document.getElementById("openLoadMapModalBtn");
  const loadMapModal = document.getElementById("loadMapModal");
  const loadMapSearchInput = document.getElementById("loadMapSearchInput");
  const loadMapList = document.getElementById("loadMapList");
  const closeLoadMapModalBtn = document.getElementById("closeLoadMapModalBtn");

  const canvasScroll = document.getElementById("canvasScroll");
  const canvasWrapper = document.getElementById("canvasWrapper");
  const gridCanvas = document.getElementById("gridCanvas");
  const startMarkerCanvas = document.getElementById("startMarkerCanvas");
  const startPositionLabel = document.getElementById("startPositionLabel");
  const clearStartPositionBtn = document.getElementById("clearStartPositionBtn");

  const statusTool = document.getElementById("statusTool");
  const statusCoords = document.getElementById("statusCoords");
  const statusSize = document.getElementById("statusSize");
  const statusSelectedTile = document.getElementById("statusSelectedTile");
  const statusAutosave = document.getElementById("statusAutosave");
  const statusSaveMsg = document.getElementById("statusSaveMsg");

  const tilesetTabs = document.getElementById("tilesetTabs");
  const tilesetZoomOutBtn = document.getElementById("tilesetZoomOutBtn");
  const tilesetZoomInBtn = document.getElementById("tilesetZoomInBtn");
  const tilesetZoomFitBtn = document.getElementById("tilesetZoomFitBtn");
  const tilesetZoomLabel = document.getElementById("tilesetZoomLabel");
  const tilesetScroll = document.getElementById("tilesetScroll");
  const tilesetImageWrapper = document.getElementById("tilesetImageWrapper");
  const tilesetImg = document.getElementById("tilesetImg");
  const tileHighlight = document.getElementById("tileHighlight");
  const tilesetInfo = document.getElementById("tilesetInfo");

  const newLayerModal = document.getElementById("newLayerModal");
  const newLayerNameInput = document.getElementById("newLayerNameInput");
  const newLayerTilesetTabs = document.getElementById("newLayerTilesetTabs");
  const newLayerModeTabs = document.getElementById("newLayerModeTabs");
  const cancelNewLayerBtn = document.getElementById("cancelNewLayerBtn");
  const confirmNewLayerBtn = document.getElementById("confirmNewLayerBtn");

  const pinModal = document.getElementById("pinModal");
  const pinModalTitle = document.getElementById("pinModalTitle");
  const pinModalDesc = document.getElementById("pinModalDesc");
  const pinModalInput = document.getElementById("pinModalInput");
  const pinModalError = document.getElementById("pinModalError");
  const cancelPinModalBtn = document.getElementById("cancelPinModalBtn");
  const confirmPinModalBtn = document.getElementById("confirmPinModalBtn");

  const pinLockedModal = document.getElementById("pinLockedModal");
  const closePinLockedModalBtn = document.getElementById("closePinLockedModalBtn");

  // ================= State =================
  let mapWidth = DEFAULT_MAP_WIDTH;
  let mapHeight = DEFAULT_MAP_HEIGHT;
  let layers = []; // { name, visible, opacity, tilesetType, tiles: number[] } — tiles: row-major, EMPTY = kosong
  let activeLayerIndex = 0;
  // Titik spawn karakter di game (bukan bagian dari layers[] — cuma 1 titik
  // {col,row} di grid NORMAL, bukan tile yg dilukis), null = belum diset
  // (game fallback ke tengah dunia, lihat "Start Position" di CLAUDE.md).
  let startPosition = null;
  let layerCanvases = []; // <canvas> per layer, paralel dgn `layers`
  let editingLayerNameIndex = null; // index layer yg lagi diedit namanya (inline), null = tidak ada

  // Cache 1 <img> per tipe tileset (dimuat sekali di awal, dipakai sbg source
  // ctx.drawImage() utk RENDER — independen dari #tilesetImg yang cuma dipakai
  // utk TAMPILAN panel kanan/pilih tile). Krn tiap layer bisa beda tileset,
  // render harus selalu ambil dari cache milik layer itu sendiri, bukan dari
  // tileset yang lagi ditampilkan di panel.
  const tilesetCache = {}; // key -> { img, cols, rows, loaded }

  let tilesetCols = 0; // kolom tileset yg LAGI DITAMPILKAN di panel kanan (ikut layer aktif)
  let tilesetRows = 0;
  let selectedTile = 0;

  let currentTool = "brush"; // brush | fill | erase
  let mapZoom = 1;
  let tilesetZoom = 0.5;
  let showGrid = true;

  let isPainting = false;
  let lastPaintedCell = null;

  let undoStack = [];
  let redoStack = [];
  let autosaveTimer = null;

  let newLayerSelectedType = DEFAULT_TILESET_TYPE;
  let newLayerSelectedMode = DEFAULT_LAYER_MODE;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // ================= Preload semua tileset =================
  function preloadTilesetType(key, onLoad) {
    const img = new Image();
    const entry = { img, cols: 0, rows: 0, loaded: false };
    tilesetCache[key] = entry;
    img.onload = () => {
      entry.cols = Math.floor(img.naturalWidth / TILE_SIZE);
      entry.rows = Math.floor(img.naturalHeight / TILE_SIZE);
      entry.loaded = true;
      if (onLoad) onLoad();
    };
    img.src = tilesetFile(key);
  }

  function preloadAllTilesets(onAllLoaded) {
    let remaining = TILESET_TYPES.length;
    TILESET_TYPES.forEach((t) => {
      preloadTilesetType(t.key, () => {
        remaining--;
        if (remaining === 0 && onAllLoaded) onAllLoaded();
      });
    });
  }

  // ================= Layer helpers =================
  // layerPosition = identitas TETAP tiap layer (independen dari nama, jadi
  // ganti nama tidak mempengaruhi status kunci): -1 = Background — SATU2NYA
  // layer dasar yg TERKUNCI (tidak bisa dihapus/dipindah/direname) sekarang,
  // permintaan eksplisit user susulan ("sebelumnya fixed itu Background dan
  // Foreground, sekarang hanya Background yang fixed/locked, Foreground
  // sekarang menjadi layer biasa"). Foreground BUKAN LAGI singleton spesial
  // — tidak lagi dibuat otomatis di `initDefaultLayers()`, & kalau map lama
  // (v5 ke bawah) masih py layer bernama "Foreground" di posisi 0, dia
  // sekarang diperlakukan PERSIS spt layer user biasa (bisa dihapus/
  // dipindah/direname) begitu dimuat. Layer buatan user (via modal Layer
  // Baru) SELALU > 0, maks 97 (jadi range 1-97, total 97 layer tambahan —
  // diciutkan dari 98 krn posisi 98 dipakai Top Object) — dijaga di
  // `confirmNewLayerBtn`.
  const BACKGROUND_LAYER_POSITION = -1;
  const USER_LAYER_MAX_POSITION = 97;
  // Batas legacy KHUSUS migrasi `mode` (`migrateLayerMode()` di bawah) — map
  // lama (v5 ke bawah, sblm fitur `mode` ada) py Background(-1)/Foreground(0)
  // yg DUA2NYA dulu implisit Ground, jadi tebakan mode utk file selawas itu
  // TETAP pakai ambang `<= 0` ini apa adanya (BUKAN tentang locked/tidaknya
  // layer — itu urusan `isLayerLocked()` di atas yg SEKARANG cuma soal
  // posisi PERSIS, bukan threshold lagi).
  const LEGACY_GROUND_POSITION_MAX = 0;

  function isLayerLocked(layer) {
    return (
      layer.layerPosition === BACKGROUND_LAYER_POSITION || layer.layerPosition === BLOCK_LAYER_POSITION || layer.layerPosition === TOP_OBJECT_LAYER_POSITION
    );
  }

  function createLayer(name, tilesetType, layerPosition, mode) {
    return {
      name,
      visible: true,
      opacity: 1,
      tilesetType: tilesetType || DEFAULT_TILESET_TYPE,
      layerPosition,
      mode: mode || DEFAULT_LAYER_MODE,
      tiles: new Array(mapWidth * mapHeight).fill(EMPTY),
    };
  }

  // Map baru (permintaan eksplisit user susulan): pas pertama kali buka page
  // Editor, cuma Background, Top Object, & Block Layer yg ada — SEMUANYA
  // terkunci. Foreground BUKAN LAGI dibuat otomatis di sini — kalau user mau
  // layer serupa, tinggal bikin lewat modal Layer Baru (+ pilih mode Ground
  // sendiri kalau mau perilaku "selalu di belakang karakter" spt Background).
  function initDefaultLayers() {
    layers = [createLayer("Background", "Base", BACKGROUND_LAYER_POSITION, LAYER_MODE_GROUND), createTopObjectLayer(), createBlockLayer()];
    activeLayerIndex = 0;
    startPosition = null;
  }

  // Posisi user-layer berikutnya = posisi tertinggi yg sudah dipakai + 1
  // (mulai dari 1 kalau belum ada layer buatan user sama sekali). Top Object
  // (98) & Block Layer (99) SENGAJA DIKECUALIKAN dari perhitungan max — kalau
  // ikut kehitung, layer user pertama bakal dapet posisi 99/100 & langsung
  // ketolak sbg "sudah maks 97 layer" padahal belum ada satu pun layer user.
  function nextUserLayerPosition() {
    let max = 0;
    layers.forEach((l) => {
      if (l.layerPosition > max && l.layerPosition < TOP_OBJECT_LAYER_POSITION) max = l.layerPosition;
    });
    return max + 1;
  }

  // ================= Canvas dunia (layer + grid) =================
  function rebuildLayerCanvases() {
    layerCanvases.forEach((c) => c.remove());
    layerCanvases = layers.map(() => {
      const canvas = document.createElement("canvas");
      canvas.className = "layer-canvas";
      canvas.width = mapWidth * TILE_SIZE;
      canvas.height = mapHeight * TILE_SIZE;
      canvasWrapper.insertBefore(canvas, gridCanvas);
      return canvas;
    });
    gridCanvas.width = mapWidth * TILE_SIZE;
    gridCanvas.height = mapHeight * TILE_SIZE;
    startMarkerCanvas.width = mapWidth * TILE_SIZE;
    startMarkerCanvas.height = mapHeight * TILE_SIZE;
    applyMapZoomToDom();
    renderAllLayers();
    renderGrid();
    renderStartMarker();
  }

  function drawTileOnCtx(ctx, cacheEntry, tileIndex, col, row) {
    const srcCol = tileIndex % cacheEntry.cols;
    const srcRow = Math.floor(tileIndex / cacheEntry.cols);
    ctx.drawImage(
      cacheEntry.img,
      srcCol * TILE_SIZE, srcRow * TILE_SIZE, TILE_SIZE, TILE_SIZE,
      col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE
    );
  }

  function renderLayer(index) {
    const layer = layers[index];
    const canvas = layerCanvases[index];
    if (!layer || !canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!layer.visible) return;
    ctx.globalAlpha = layer.opacity;
    ctx.imageSmoothingEnabled = false;

    // Block Layer bukan gambar tileset — digambar sbg kotak merah solid
    // (BLOCK_COLOR, sudah termasuk opacity 50% bakuannya) di grid yg lebih
    // rapat (BLOCK_TILE_SIZE), bukan drawImage spt layer biasa.
    if (isBlockLayer(layer)) {
      const { cols, rows, cellSize } = layerGridDims(layer);
      ctx.fillStyle = BLOCK_COLOR;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (layer.tiles[row * cols + col] === EMPTY) continue;
          ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
      ctx.globalAlpha = 1;
      return;
    }

    // Top Object jg bukan gambar tileset — kotak biru solid (TOP_OBJECT_COLOR)
    // di grid NORMAL (bukan lebih rapat spt Block Layer, lihat "Top Object"),
    // nandain sel mana yg bakal selalu di depan karakter di game.
    if (isTopObjectLayer(layer)) {
      const { cols, rows, cellSize } = layerGridDims(layer);
      ctx.fillStyle = TOP_OBJECT_COLOR;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (layer.tiles[row * cols + col] === EMPTY) continue;
          ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
      ctx.globalAlpha = 1;
      return;
    }

    const cache = tilesetCache[layer.tilesetType];
    if (!cache || !cache.loaded) {
      ctx.globalAlpha = 1;
      return; // belum selesai preload, akan di-render ulang stlh siap
    }
    for (let row = 0; row < mapHeight; row++) {
      for (let col = 0; col < mapWidth; col++) {
        const tile = layer.tiles[row * mapWidth + col];
        if (tile === EMPTY) continue;
        drawTileOnCtx(ctx, cache, tile, col, row);
      }
    }
    ctx.globalAlpha = 1;
  }

  function renderAllLayers() {
    layers.forEach((_, i) => renderLayer(i));
  }

  function renderGrid() {
    const ctx = gridCanvas.getContext("2d");
    ctx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
    if (!showGrid) return;
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    // "+ 0.5" bikin garis 1px jatuh pas di tengah pixel grid (crisp, tidak
    // blur) — tapi utk garis PALING KANAN/BAWAH (col===mapWidth/row===mapHeight),
    // offset itu mendorongnya 0.5px ke LUAR batas kanvas, jadi ke-clip/hilang
    // sama sekali. Di-clamp ke `canvas.width/height - 0.5` biar garis
    // terakhir tetap jatuh di dalam kanvas (masih crisp, cuma posisinya
    // digeser dikit ke dalam drpd keluar).
    for (let col = 0; col <= mapWidth; col++) {
      const x = Math.min(col * TILE_SIZE + 0.5, gridCanvas.width - 0.5);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, gridCanvas.height);
      ctx.stroke();
    }
    for (let row = 0; row <= mapHeight; row++) {
      const y = Math.min(row * TILE_SIZE + 0.5, gridCanvas.height - 0.5);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(gridCanvas.width, y);
      ctx.stroke();
    }
  }

  // ================= Start Position (titik spawn karakter) =================
  // BUKAN layer (lihat diskusi di CLAUDE.md kenapa) — cuma 1 titik {col,row}
  // di grid NORMAL (mapWidth x mapHeight), disimpan terpisah dari layers[],
  // digambar di kanvas SENDIRI (#startMarkerCanvas, elemen TERAKHIR di DOM
  // canvasWrapper jadi selalu tergambar plaing atas, di atas grid sekalipun)
  // spy tidak numpuk sistem tile/undo layer sama sekali.

  // Marker-nya gambar karakter default game (Male 01-1.png) pose idle
  // menghadap bawah — permintaan eksplisit user, gantiin lingkaran+"S" versi
  // awal, spy langsung kebayang arah hadap awal karakter pas main. Konvensi
  // baris/kolom sprite sheet (3 kolom x 4 baris, 32x32px/frame) SAMA persis
  // dgn yg dipakai game (lihat "Aset karakter" di CLAUDE.md) — baris 0 =
  // hadap bawah, kolom 1 (tengah) = pose idle/diam. 32x32 sumbernya PAS sama
  // dgn TILE_SIZE, jadi crop 1:1 tanpa scale.
  const START_MARKER_SPRITE_SRC = "img/character/Male/Male 01-1.png";
  const startMarkerSprite = new Image();
  let startMarkerSpriteLoaded = false;
  startMarkerSprite.onload = () => {
    startMarkerSpriteLoaded = true;
    renderStartMarker(); // jaga2 startPosition sudah keisi (mis. dari autosave) sblm sprite ini selesai dimuat
  };
  startMarkerSprite.src = START_MARKER_SPRITE_SRC;

  function renderStartMarker() {
    const ctx = startMarkerCanvas.getContext("2d");
    ctx.clearRect(0, 0, startMarkerCanvas.width, startMarkerCanvas.height);
    if (!startPosition || !startMarkerSpriteLoaded) return;
    ctx.imageSmoothingEnabled = false;
    const destX = startPosition.col * TILE_SIZE;
    const destY = startPosition.row * TILE_SIZE;
    ctx.drawImage(startMarkerSprite, 32, 0, 32, 32, destX, destY, TILE_SIZE, TILE_SIZE);
  }

  // Sel di grid NORMAL (mapWidth x mapHeight) dari posisi klik — BEDA dari
  // cellFromEvent() yg ngikutin grid LAYER AKTIF (bisa jadi grid 4x lebih
  // rapat kalau Block Layer lagi aktif, lihat layerGridDims()). Start
  // Position bukan bagian dari layer manapun, jadi harus SELALU pakai grid
  // normal apa pun layer yg lagi aktif/tool yg lagi dipakai sebelumnya.
  function normalCellFromEvent(e) {
    const rect = canvasWrapper.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;
    const col = Math.floor(xRatio * mapWidth);
    const row = Math.floor(yRatio * mapHeight);
    if (col < 0 || col >= mapWidth || row < 0 || row >= mapHeight) return null;
    return { col, row };
  }

  function updateStartPositionLabel() {
    startPositionLabel.textContent = startPosition ? `Start: (${startPosition.col}, ${startPosition.row})` : "Start: belum diset";
  }

  function setStartPosition(col, row) {
    startPosition = { col, row };
    renderStartMarker();
    updateStartPositionLabel();
  }

  function clearStartPosition() {
    if (!startPosition) return;
    startPosition = null;
    renderStartMarker();
    updateStartPositionLabel();
    scheduleAutosave();
  }

  clearStartPositionBtn.addEventListener("click", clearStartPosition);

  // ================= Zoom (map) =================
  function applyMapZoomToDom() {
    canvasWrapper.style.width = `${mapWidth * TILE_SIZE * mapZoom}px`;
    canvasWrapper.style.height = `${mapHeight * TILE_SIZE * mapZoom}px`;
  }

  function setMapZoom(z) {
    mapZoom = clamp(z, 0.1, 4);
    applyMapZoomToDom();
    zoomLabel.textContent = `${Math.round(mapZoom * 100)}%`;
  }

  zoomInBtn.addEventListener("click", () => setMapZoom(mapZoom + 0.1));
  zoomOutBtn.addEventListener("click", () => setMapZoom(mapZoom - 0.1));
  zoomFitBtn.addEventListener("click", () => {
    const fit = (canvasScroll.clientWidth - 32) / (mapWidth * TILE_SIZE);
    setMapZoom(fit);
  });

  // ================= Resize map (mempertahankan tile yg masih dalam batas baru) =================
  function resizeMapTo(newWidth, newHeight) {
    const oldWidth = mapWidth;
    const oldHeight = mapHeight;
    layers.forEach((layer) => {
      // Block Layer punya grid 4x lebih rapat (lihat layerGridDimsFor) —
      // dimensi lama & baru dihitung PER LAYER, bukan cuma pakai mapWidth/
      // mapHeight mentah spt sebelum Block Layer ada.
      const oldDims = layerGridDimsFor(layer, oldWidth, oldHeight);
      const newDims = layerGridDimsFor(layer, newWidth, newHeight);
      const newTiles = new Array(newDims.cols * newDims.rows).fill(EMPTY);
      const copyW = Math.min(oldDims.cols, newDims.cols);
      const copyH = Math.min(oldDims.rows, newDims.rows);
      for (let row = 0; row < copyH; row++) {
        for (let col = 0; col < copyW; col++) {
          newTiles[row * newDims.cols + col] = layer.tiles[row * oldDims.cols + col];
        }
      }
      layer.tiles = newTiles;
    });
    mapWidth = newWidth;
    mapHeight = newHeight;
    // Start Position ikut di-clamp ke batas peta baru (bukan dihapus) kalau
    // titiknya jadi di luar jangkauan stlh diciutkan — konsisten dgn tile
    // layer yg jg cuma "dipotong" ke batas baru drpd dibuang semua.
    if (startPosition) {
      startPosition = {
        col: clamp(startPosition.col, 0, mapWidth - 1),
        row: clamp(startPosition.row, 0, mapHeight - 1),
      };
      updateStartPositionLabel();
    }
    undoStack = [];
    redoStack = [];
    updateUndoRedoButtons();
    rebuildLayerCanvases();
    updateStatusSize();
    scheduleAutosave();
  }

  resizeMapBtn.addEventListener("click", () => {
    const newWidth = clamp(parseInt(mapWidthInput.value, 10) || mapWidth, 1, 200);
    const newHeight = clamp(parseInt(mapHeightInput.value, 10) || mapHeight, 1, 200);
    mapWidthInput.value = newWidth;
    mapHeightInput.value = newHeight;
    resizeMapTo(newWidth, newHeight);
  });

  // ================= Lukis (brush/fill/erase) =================
  function cellFromEvent(e) {
    const rect = canvasWrapper.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;
    const { cols, rows } = layerGridDims(layers[activeLayerIndex]);
    const col = Math.floor(xRatio * cols);
    const row = Math.floor(yRatio * rows);
    if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
    return { col, row };
  }

  function setCellIncremental(layerIndex, col, row, value) {
    const layer = layers[layerIndex];
    const { cols, cellSize } = layerGridDims(layer);
    layer.tiles[row * cols + col] = value;
    const ctx = layerCanvases[layerIndex].getContext("2d");
    ctx.clearRect(col * cellSize, row * cellSize, cellSize, cellSize);
    if (value === EMPTY || !layer.visible) return;
    ctx.globalAlpha = layer.opacity;
    if (isBlockLayer(layer)) {
      ctx.fillStyle = BLOCK_COLOR;
      ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
    } else if (isTopObjectLayer(layer)) {
      ctx.fillStyle = TOP_OBJECT_COLOR;
      ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
    } else {
      const cache = tilesetCache[layer.tilesetType];
      if (cache && cache.loaded) drawTileOnCtx(ctx, cache, value, col, row);
    }
    ctx.globalAlpha = 1;
  }

  // BFS 4-arah, ganti semua sel bersambung yg nilainya sama persis dgn sel yg
  // diklik menjadi `newValue` — pola flood-fill standar (mis. Paint Bucket).
  function floodFill(layerIndex, startCol, startRow, newValue) {
    const layer = layers[layerIndex];
    const { cols, rows } = layerGridDims(layer);
    const idx0 = startRow * cols + startCol;
    const target = layer.tiles[idx0];
    if (target === newValue) return;
    const stack = [[startCol, startRow]];
    while (stack.length) {
      const [col, row] = stack.pop();
      if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
      const idx = row * cols + col;
      if (layer.tiles[idx] !== target) continue;
      setCellIncremental(layerIndex, col, row, newValue);
      stack.push([col + 1, row], [col - 1, row], [col, row + 1], [col, row - 1]);
    }
  }

  function paintAt(col, row) {
    const layer = layers[activeLayerIndex];
    const tileValue = isBlockLayer(layer) ? BLOCK_TILE_VALUE : isTopObjectLayer(layer) ? TOP_OBJECT_TILE_VALUE : selectedTile;
    if (currentTool === "fill") {
      floodFill(activeLayerIndex, col, row, tileValue);
      return;
    }
    const newValue = currentTool === "erase" ? EMPTY : tileValue;
    const { cols } = layerGridDims(layer);
    const idx = row * cols + col;
    if (layer.tiles[idx] === newValue) return;
    setCellIncremental(activeLayerIndex, col, row, newValue);
  }

  canvasWrapper.addEventListener("pointerdown", (e) => {
    // Tool "Start Position" bukan aksi layer sama sekali (bukan tile, tidak
    // masuk undo stack) — cabang terpisah, pakai grid NORMAL selalu
    // (normalCellFromEvent), bukan grid layer aktif (cellFromEvent).
    if (currentTool === "start") {
      const cell = normalCellFromEvent(e);
      if (!cell) return;
      isPainting = true; // dipakai jg drag utk reposisi live, lihat pointermove
      setStartPosition(cell.col, cell.row);
      lastPaintedCell = `${cell.col},${cell.row}`;
      updateStatusCoords(cell);
      return;
    }
    const cell = cellFromEvent(e);
    if (!cell) return;
    isPainting = true;
    pushUndo();
    paintAt(cell.col, cell.row);
    lastPaintedCell = `${cell.col},${cell.row}`;
    updateStatusCoords(cell);
  });

  window.addEventListener("pointermove", (e) => {
    if (currentTool === "start") {
      const cell = normalCellFromEvent(e);
      if (cell) updateStatusCoords(cell);
      if (!isPainting || !cell) return;
      const key = `${cell.col},${cell.row}`;
      if (key === lastPaintedCell) return;
      lastPaintedCell = key;
      setStartPosition(cell.col, cell.row);
      return;
    }
    const cell = cellFromEvent(e);
    if (cell) updateStatusCoords(cell);
    if (!isPainting || !cell) return;
    const key = `${cell.col},${cell.row}`;
    if (key === lastPaintedCell) return;
    lastPaintedCell = key;
    paintAt(cell.col, cell.row);
  });

  window.addEventListener("pointerup", () => {
    if (isPainting) scheduleAutosave();
    isPainting = false;
    lastPaintedCell = null;
  });

  // ================= Undo / redo =================
  // Snapshot per-stroke (bukan per-sel) — 1 aksi Undo membatalkan satu
  // stroke/drag penuh, bukan cuma 1 tile, sesuai ekspektasi umum editor.
  function pushUndo() {
    undoStack.push({ layerIndex: activeLayerIndex, tiles: layers[activeLayerIndex].tiles.slice() });
    if (undoStack.length > 50) undoStack.shift();
    redoStack = [];
    updateUndoRedoButtons();
  }

  function undo() {
    if (!undoStack.length) return;
    const snap = undoStack.pop();
    redoStack.push({ layerIndex: snap.layerIndex, tiles: layers[snap.layerIndex].tiles.slice() });
    layers[snap.layerIndex].tiles = snap.tiles;
    renderLayer(snap.layerIndex);
    updateUndoRedoButtons();
    scheduleAutosave();
  }

  function redo() {
    if (!redoStack.length) return;
    const snap = redoStack.pop();
    undoStack.push({ layerIndex: snap.layerIndex, tiles: layers[snap.layerIndex].tiles.slice() });
    layers[snap.layerIndex].tiles = snap.tiles;
    renderLayer(snap.layerIndex);
    updateUndoRedoButtons();
    scheduleAutosave();
  }

  function updateUndoRedoButtons() {
    undoBtn.disabled = !undoStack.length;
    redoBtn.disabled = !redoStack.length;
  }

  undoBtn.addEventListener("click", undo);
  redoBtn.addEventListener("click", redo);

  window.addEventListener("keydown", (e) => {
    if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "SELECT")) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if (ctrl && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
      e.preventDefault();
      redo();
    }
  });

  // ================= Tools & grid toggle =================
  toolGroup.querySelectorAll(".tool-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentTool = btn.dataset.tool;
      toolGroup.querySelectorAll(".tool-btn").forEach((b) => b.classList.toggle("active", b === btn));
      statusTool.textContent = btn.textContent.trim();
    });
  });

  showGridCheckbox.addEventListener("change", () => {
    showGrid = showGridCheckbox.checked;
    renderGrid();
  });

  // Background di belakang kanvas map & preview tileset (bukan warna tile) —
  // cuma nunjuk `--preview-bg-current` ke salah satu variabel `--preview-bg-*`
  // yg SUDAH didefinisikan di :root (tilemap-style.css), bukan nulis hex
  // literal dari JS — jadi kalau warnanya di-tweak langsung di CSS nanti,
  // tombol lingkaran ini otomatis ikut brubah tanpa perlu sentuh JS sama sekali.
  bgSwatches.querySelectorAll(".bg-swatch").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.documentElement.style.setProperty("--preview-bg-current", `var(${btn.dataset.var})`);
      bgSwatches.querySelectorAll(".bg-swatch").forEach((b) => b.classList.toggle("active", b === btn));
    });
  });

  clearAllBtn.addEventListener("click", () => {
    if (!confirm(`Kosongkan semua isi layer "${layers[activeLayerIndex].name}"?`)) return;
    pushUndo();
    layers[activeLayerIndex].tiles.fill(EMPTY);
    renderLayer(activeLayerIndex);
    scheduleAutosave();
  });

  // ================= Tileset panel (tab per tipe, ikut layer aktif) =================
  // Panel kanan SELALU menampilkan tileset milik layer yang lagi aktif —
  // bukan pilihan bebas, krn 1 layer cuma boleh pakai 1 tipe tileset.
  function showTilesetForActiveLayer() {
    const layer = layers[activeLayerIndex];
    const type = layer.tilesetType;
    selectedTile = 0; // index tile tidak nyambung antar tileset beda, reset tiap ganti
    // Block Layer/Top Object bukan tileset gambar sama sekali — SEMUA tab
    // di-disable (tidak ada gunanya ganti "tileset" sesuatu yg bukan
    // tileset), beda dari layer biasa yg SEKARANG semua tab tetap bisa
    // diklik (lihat "Ganti tileset layer" — permintaan eksplisit user
    // susulan, gantiin versi lama yg cuma bisa ditentukan sekali pas dibuat).
    updateTilesetTabsActive(type, isBlockLayer(layer) || isTopObjectLayer(layer));

    if (isBlockLayer(layer) || isTopObjectLayer(layer)) {
      // Block Layer/Top Object bukan tileset gambar — sembunyikan preview &
      // highlight, isi info statis (tidak ada apa2 utk dipilih user).
      tilesetImg.removeAttribute("src");
      tilesetImg.style.display = "none";
      tileHighlight.style.display = "none";
      tilesetInfo.textContent = `${tilesetLabel(type)} — otomatis, tidak pakai tileset`;
      statusSelectedTile.textContent = tilesetLabel(type);
      return;
    }

    tilesetImg.style.display = "";
    tileHighlight.style.display = "";
    const cache = tilesetCache[type];
    tilesetCols = cache.cols;
    tilesetRows = cache.rows;
    tilesetImg.src = tilesetFile(type);
    updateTilesetDisplaySize();
    updateTileHighlight();
    updateTilesetInfo();
  }

  // Tab di panel kanan ini BISA diklik utk GANTI tileset layer aktif
  // (permintaan eksplisit user susulan — gantiin versi lama yg cuma
  // "indikator", tileset ditentukan sekali doang pas layer dibuat) — lihat
  // `requestTilesetChange()` di bawah. Klik tab yg BUKAN Block Layer/Top
  // Object aktif (lihat `updateTilesetTabsActive()`) selalu diizinkan, TAPI
  // ganti tileset SELALU minta konfirmasi dulu krn ISI LAYER (array tiles)
  // bakal DIKOSONGKAN — index tile lama tidak nyambung sama sekali ke
  // tileset baru (col/row dihitung dari `cache.cols` tileset yg beda).
  function renderTilesetTabs() {
    tilesetTabs.innerHTML = "";
    TILESET_TYPES.forEach((t) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tileset-tab";
      btn.textContent = t.label;
      btn.dataset.key = t.key;
      btn.addEventListener("click", () => requestTilesetChange(t.key));
      tilesetTabs.appendChild(btn);
    });
  }

  // `disableAll` = true kalau layer aktif Block Layer/Top Object (bukan
  // tileset gambar sama sekali, lihat pemanggilnya di
  // `showTilesetForActiveLayer()`) — SEMUA tab di-disable spy tidak ada yg
  // bisa diklik. Layer biasa: SEMUA tab tetap aktif/bisa diklik (beda dari
  // versi lama yg nge-disable 7 tab selain yg lagi kepakai).
  function updateTilesetTabsActive(activeType, disableAll) {
    tilesetTabs.querySelectorAll(".tileset-tab").forEach((btn) => {
      const isActive = btn.dataset.key === activeType;
      btn.classList.toggle("active", isActive);
      btn.disabled = !!disableAll;
    });
  }

  // Ganti tileset layer AKTIF ke `newType` — SELALU minta konfirmasi dulu
  // (permintaan eksplisit user: "ada pop up apakah kau yakin, karena akan
  // clear layer karena ganti tileset") krn index tile lama (`layer.tiles`)
  // tidak nyambung sama sekali ke tileset baru begitu diganti (drawImage
  // pakai `col/row` yg dihitung dari lebar tileset LAMA, kalau tetap dipakai
  // di tileset BARU bisa jatuh di tile yg SALAH TOTAL/di luar batas gambar
  // sama sekali) — satu2nya cara aman adalah kosongkan isinya, sama pola
  // dgn `clearAllBtn`.
  function requestTilesetChange(newType) {
    const layer = layers[activeLayerIndex];
    if (isBlockLayer(layer) || isTopObjectLayer(layer)) return; // jaga2, tombolnya harusnya sudah disabled
    if (newType === layer.tilesetType) return; // klik tileset yg sama, tidak ngapa-ngapain
    if (!confirm(`Ganti tileset layer "${layer.name}" ke "${tilesetTypeDef(newType).label}"? Isi layer ini akan hilang (dikosongkan).`)) return;
    pushUndo();
    layer.tilesetType = newType;
    layer.tiles.fill(EMPTY);
    renderLayer(activeLayerIndex);
    renderLayerList();
    showTilesetForActiveLayer();
    scheduleAutosave();
  }

  function updateTileHighlight() {
    const col = selectedTile % tilesetCols;
    const row = Math.floor(selectedTile / tilesetCols);
    const size = TILE_SIZE * tilesetZoom;
    tileHighlight.style.width = `${size}px`;
    tileHighlight.style.height = `${size}px`;
    tileHighlight.style.left = `${col * size}px`;
    tileHighlight.style.top = `${row * size}px`;
  }

  function updateTilesetInfo() {
    const col = selectedTile % tilesetCols;
    const row = Math.floor(selectedTile / tilesetCols);
    const type = layers[activeLayerIndex].tilesetType;
    tilesetInfo.textContent = `${tilesetLabel(type)} — tile #${selectedTile} (col ${col}, row ${row})`;
    statusSelectedTile.textContent = `${tilesetLabel(type)} #${selectedTile}`;
  }

  function updateTilesetDisplaySize() {
    const w = tilesetCols * TILE_SIZE * tilesetZoom;
    const h = tilesetRows * TILE_SIZE * tilesetZoom;
    tilesetImg.style.width = `${w}px`;
    tilesetImg.style.height = `${h}px`;
    updateTileHighlight();
  }

  function setTilesetZoom(z) {
    tilesetZoom = clamp(z, 0.1, 4);
    tilesetZoomLabel.textContent = `${Math.round(tilesetZoom * 100)}%`;
    updateTilesetDisplaySize();
  }

  tilesetZoomInBtn.addEventListener("click", () => setTilesetZoom(tilesetZoom + 0.1));
  tilesetZoomOutBtn.addEventListener("click", () => setTilesetZoom(tilesetZoom - 0.1));
  tilesetZoomFitBtn.addEventListener("click", () => {
    const fit = (tilesetScroll.clientWidth - 16) / (tilesetCols * TILE_SIZE);
    setTilesetZoom(fit);
  });

  tilesetImageWrapper.addEventListener("click", (e) => {
    const rect = tilesetImg.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;
    const col = Math.floor(xRatio * tilesetCols);
    const row = Math.floor(yRatio * tilesetRows);
    if (col < 0 || col >= tilesetCols || row < 0 || row >= tilesetRows) return;
    selectedTile = row * tilesetCols + col;
    updateTileHighlight();
    updateTilesetInfo();
  });

  // ================= Layer list UI =================
  // Commit rename inline (tombol 💾 atau tekan Enter) — nama kosong/spasi
  // doang diabaikan (nama lama dipertahankan), bukan dianggap error.
  function commitLayerRename(index, rawValue) {
    const newName = rawValue.trim();
    if (newName) layers[index].name = newName;
    editingLayerNameIndex = null;
    renderLayerList();
    scheduleAutosave();
  }

  function renderLayerList() {
    layerList.innerHTML = "";
    activeLayerNameLabel.textContent = layers[activeLayerIndex] ? layers[activeLayerIndex].name : "";
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      const row = document.createElement("div");
      // Warna card khusus — Block Layer (paling atas) merah, Top Object
      // (persis di bawahnya) biru, keduanya ditentukan dari `layerPosition`
      // (posisi tetap, konsisten dgn `isLayerLocked()`). Card COKLAT sekarang
      // ditentukan dari `layer.mode === "Ground"` (permintaan eksplisit
      // user: "layernya juga berwarna coklat seperti Background dan
      // Foreground") — BUKAN lagi dari posisi/kunci, jadi layer BARU manapun
      // yg user pilih mode Ground (bukan cuma Background bawaan — Foreground
      // BUKAN LAGI singleton spesial, lihat "Layer helpers") ikut dapat card
      // coklat yg sama.
      let variantClass = "";
      if (layer.layerPosition === BLOCK_LAYER_POSITION) variantClass = " layer-row--block";
      else if (layer.layerPosition === TOP_OBJECT_LAYER_POSITION) variantClass = " layer-row--topobject";
      else if (layer.mode === LAYER_MODE_GROUND) variantClass = " layer-row--basefg";
      row.className = "layer-row" + variantClass + (i === activeLayerIndex ? " active" : "");

      const top = document.createElement("div");
      top.className = "layer-row-top";

      const visBtn = document.createElement("button");
      visBtn.type = "button";
      visBtn.className = "layer-visibility";
      visBtn.title = "Tampil/sembunyikan layer";
      visBtn.textContent = layer.visible ? "👁️" : "🚫";
      visBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        layer.visible = !layer.visible;
        renderLayer(i);
        renderLayerList();
        scheduleAutosave();
      });

      top.appendChild(visBtn);

      // Ganti nama inline (bukan lagi dblclick + prompt()) — klik ✏️ → nama
      // jadi <input> langsung di tempat, ikonnya ganti jadi 💾, klik itu utk
      // commit & balik ke tampilan teks biasa. Permintaan eksplisit user.
      // Layer TERKUNCI (Background/Foreground) tidak dapat tombol ✏️ sama
      // sekali — namanya tetap, tidak bisa diedit (permintaan eksplisit user).
      if (!isLayerLocked(layer) && editingLayerNameIndex === i) {
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.className = "layer-name-input";
        nameInput.value = layer.name;
        nameInput.addEventListener("click", (e) => e.stopPropagation());
        nameInput.addEventListener("keydown", (e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            commitLayerRename(i, nameInput.value);
          } else if (e.key === "Escape") {
            e.preventDefault();
            editingLayerNameIndex = null;
            renderLayerList();
          }
        });
        top.appendChild(nameInput);

        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.className = "layer-rename-btn";
        saveBtn.title = "Simpan nama";
        saveBtn.textContent = "💾";
        saveBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          commitLayerRename(i, nameInput.value);
        });
        top.appendChild(saveBtn);
      } else {
        const nameSpan = document.createElement("span");
        nameSpan.className = "layer-name";
        nameSpan.textContent = layer.name;
        top.appendChild(nameSpan);

        if (!isLayerLocked(layer)) {
          const editBtn = document.createElement("button");
          editBtn.type = "button";
          editBtn.className = "layer-rename-btn";
          editBtn.title = "Ganti nama layer";
          editBtn.textContent = "✏️";
          editBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            editingLayerNameIndex = i;
            renderLayerList();
          });
          top.appendChild(editBtn);
        }
      }

      // Background (SATU2NYA layer dasar yg terkunci sekarang, lihat "Layer
      // helpers" — Foreground BUKAN LAGI singleton spesial) TERKUNCI —
      // permintaan eksplisit user, tidak bisa dihapus/dipindah urutan. Ikon
      // gembok murni indikator visual (lihat removeLayerBtn/moveLayerUpBtn/moveLayerDownBtn
      // di bawah utk penegakan aturannya yg sesungguhnya).
      if (isLayerLocked(layer)) {
        const lockIcon = document.createElement("span");
        lockIcon.className = "layer-lock-icon";
        lockIcon.textContent = "🔒";
        lockIcon.title = "Layer ini terkunci — tidak bisa dihapus atau dipindah urutan";
        top.appendChild(lockIcon);
      }

      // Label tileset — permintaan eksplisit user spy kelihatan tipe tileset
      // yg dipakai tiap layer (krn 1 layer cuma boleh 1 tileset). Nama tileset
      // dibungkus badge kapsul berwarna (beda tipe beda warna, lihat
      // TILESET_TYPES.color) — teks "Tileset:" sendiri tetap teks polos.
      const tilesetLabelEl = document.createElement("div");
      tilesetLabelEl.className = "layer-tileset-label";
      tilesetLabelEl.appendChild(document.createTextNode("Tileset: "));
      const tilesetBadge = document.createElement("span");
      tilesetBadge.className = "tileset-badge";
      tilesetBadge.textContent = tilesetLabel(layer.tilesetType);
      tilesetBadge.style.background = tilesetColor(layer.tilesetType);
      tilesetLabelEl.appendChild(tilesetBadge);

      // Label mode — permintaan eksplisit user, ditaruh TEPAT DI BAWAH
      // "Tileset :" (sama pola badge kapsul warna, lihat komentar di atas).
      // Ground = coklat, Object = slate netral, Mask = ungu (lihat
      // LAYER_MODE_COLORS/modeColor()).
      const modeLabelEl = document.createElement("div");
      modeLabelEl.className = "layer-tileset-label";
      modeLabelEl.appendChild(document.createTextNode("Mode: "));
      const modeBadge = document.createElement("span");
      modeBadge.className = "tileset-badge";
      modeBadge.textContent = layer.mode;
      modeBadge.style.background = modeColor(layer.mode);
      modeLabelEl.appendChild(modeBadge);

      const opacity = document.createElement("input");
      opacity.type = "range";
      opacity.min = "0";
      opacity.max = "100";
      opacity.value = String(Math.round(layer.opacity * 100));
      opacity.className = "layer-opacity";
      opacity.addEventListener("input", () => {
        layer.opacity = Number(opacity.value) / 100;
        renderLayer(i);
      });
      opacity.addEventListener("change", scheduleAutosave);

      row.appendChild(top);
      row.appendChild(tilesetLabelEl);
      row.appendChild(modeLabelEl);
      row.appendChild(opacity);
      row.addEventListener("click", () => {
        activeLayerIndex = i;
        renderLayerList();
        showTilesetForActiveLayer();
      });

      layerList.appendChild(row);
    }

    // Fokus & select otomatis ke input nama yg lagi diedit (kalau ada) —
    // dipanggil stlh elemen-nya benar-benar masuk DOM (baru bisa fokus).
    const editingInput = layerList.querySelector(".layer-name-input");
    if (editingInput) {
      editingInput.focus();
      editingInput.select();
    }

    // Tombol Hapus/Naik/Turun dinonaktifkan kalau layer AKTIF terkunci, atau
    // kalau tetangga yg mau ditukar posisinya adalah layer yg terkunci
    // (mis. layer user paling bawah tidak boleh "Turun" krn di bawahnya
    // Foreground yg terkunci).
    const activeLayer = layers[activeLayerIndex];
    const locked = isLayerLocked(activeLayer);
    removeLayerBtn.disabled = locked;
    // Sebelumnya Naik cuma dicek "activeLayerIndex >= layers.length-1" (asumsi
    // implisit: tidak pernah ada layer terkunci DI ATAS layer user, cuma
    // benar sblm Block Layer ada). Sejak Block Layer (posisi 99, SELALU
    // elemen terakhir) ada, tetangga di atas jg bisa terkunci — jadi dicek
    // simetris dgn Turun (isLayerLocked tetangga), bukan cuma posisi array.
    moveLayerUpBtn.disabled = locked || activeLayerIndex >= layers.length - 1 || isLayerLocked(layers[activeLayerIndex + 1]);
    moveLayerDownBtn.disabled = locked || activeLayerIndex <= 0 || isLayerLocked(layers[activeLayerIndex - 1]);
  }

  // ================= Modal Layer Baru (nama + wajib pilih tileset + mode) =================
  function renderNewLayerTilesetTabs() {
    newLayerTilesetTabs.innerHTML = "";
    TILESET_TYPES.forEach((t) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tileset-tab" + (t.key === newLayerSelectedType ? " active" : "");
      btn.textContent = t.label;
      btn.addEventListener("click", () => {
        newLayerSelectedType = t.key;
        renderNewLayerTilesetTabs();
      });
      newLayerTilesetTabs.appendChild(btn);
    });
  }

  // Mode Ground/Object utk layer BARU (permintaan eksplisit user) — Mask
  // TIDAK ditawarkan di sini sama sekali (`USER_LAYER_MODES` cuma berisi 2
  // dari 3 mode yg ada, lihat deklarasinya), krn Mask reserved khusus Block
  // Layer/Top Object (singleton, tidak dibuat lewat modal ini).
  function renderNewLayerModeTabs() {
    newLayerModeTabs.innerHTML = "";
    USER_LAYER_MODES.forEach((m) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tileset-tab" + (m === newLayerSelectedMode ? " active" : "");
      btn.textContent = m;
      btn.addEventListener("click", () => {
        newLayerSelectedMode = m;
        renderNewLayerModeTabs();
      });
      newLayerModeTabs.appendChild(btn);
    });
  }

  function openNewLayerModal() {
    if (nextUserLayerPosition() > USER_LAYER_MAX_POSITION) {
      alert(`Sudah mencapai maksimal ${USER_LAYER_MAX_POSITION} layer tambahan.`);
      return;
    }
    newLayerNameInput.value = `Layer ${layers.length + 1}`;
    newLayerSelectedType = DEFAULT_TILESET_TYPE;
    newLayerSelectedMode = DEFAULT_LAYER_MODE;
    renderNewLayerTilesetTabs();
    renderNewLayerModeTabs();
    newLayerModal.classList.add("open");
    newLayerNameInput.focus();
  }

  function closeNewLayerModal() {
    newLayerModal.classList.remove("open");
  }

  addLayerBtn.addEventListener("click", openNewLayerModal);
  cancelNewLayerBtn.addEventListener("click", closeNewLayerModal);
  newLayerModal.addEventListener("click", (e) => {
    if (e.target === newLayerModal) closeNewLayerModal();
  });

  confirmNewLayerBtn.addEventListener("click", () => {
    const name = newLayerNameInput.value.trim();
    if (!name) {
      alert("Nama layer tidak boleh kosong.");
      return;
    }
    // Nama layer harus unik — termasuk terhadap layer dasar/singleton yg
    // sudah ada (Block Layer/Top Object/Background, ATAU layer bernama
    // "Foreground" kalau map ini masih py peninggalan dari sebelum fitur ini
    // ada, lihat "Layer helpers") — cek dilakukan thd SEMUA layer yg ada,
    // bukan cuma yg terkunci (permintaan eksplisit user). Case-insensitive
    // spy "background" & "Background" dianggap tabrakan jg, bukan cuma exact
    // match.
    if (layers.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
      alert(`Sudah ada layer dgn nama "${name}". Pilih nama lain.`);
      return;
    }
    const position = nextUserLayerPosition();
    if (position > USER_LAYER_MAX_POSITION) {
      alert(`Sudah mencapai maksimal ${USER_LAYER_MAX_POSITION} layer tambahan.`);
      return;
    }
    // BUKAN push() ke ujung array — Top Object (98) & Block Layer (99) HARUS
    // selalu jadi 2 elemen TERAKHIR (invariant "layers[] terurut menaik by
    // layerPosition", lihat "Layer terkunci"/"Block Layer" di CLAUDE.md).
    // Layer baru selalu disisipkan TEPAT SEBELUM Top Object (yg posisinya
    // paling rendah di antara dua reserved layer itu, jadi otomatis jg
    // sebelum Block Layer), bukan sesudahnya.
    const topObjectIdx = layers.findIndex((l) => l.layerPosition === TOP_OBJECT_LAYER_POSITION);
    layers.splice(topObjectIdx, 0, createLayer(name, newLayerSelectedType, position, newLayerSelectedMode));
    activeLayerIndex = topObjectIdx;
    rebuildLayerCanvases();
    renderLayerList();
    showTilesetForActiveLayer();
    scheduleAutosave();
    closeNewLayerModal();
  });

  removeLayerBtn.addEventListener("click", () => {
    if (isLayerLocked(layers[activeLayerIndex])) {
      alert("Layer ini terkunci, tidak bisa dihapus.");
      return;
    }
    if (layers.length <= 1) {
      alert("Minimal harus ada 1 layer.");
      return;
    }
    if (!confirm(`Hapus layer "${layers[activeLayerIndex].name}"? Isi layer ini akan hilang.`)) return;
    layers.splice(activeLayerIndex, 1);
    activeLayerIndex = Math.max(0, activeLayerIndex - 1);
    undoStack = [];
    redoStack = [];
    updateUndoRedoButtons();
    rebuildLayerCanvases();
    renderLayerList();
    showTilesetForActiveLayer();
    scheduleAutosave();
  });

  // "Naik" = mendekati depan/foreground (index makin besar), "Turun" = mendekati
  // belakang/background (index makin kecil) — sesuai urutan render layers[].
  // Background (layer dasar terkunci SATU2NYA sekarang, lihat "Layer
  // helpers") TERKUNCI: tidak bisa jadi sumber ATAU tujuan tukar posisi
  // (dicek dua-duanya krn layer user paling bawah bisa bertetangga langsung
  // dgn Background yg terkunci).
  moveLayerUpBtn.addEventListener("click", () => {
    if (isLayerLocked(layers[activeLayerIndex])) return;
    if (activeLayerIndex >= layers.length - 1) return;
    if (isLayerLocked(layers[activeLayerIndex + 1])) return;
    const a = layers[activeLayerIndex];
    const b = layers[activeLayerIndex + 1];
    [a.layerPosition, b.layerPosition] = [b.layerPosition, a.layerPosition];
    [layers[activeLayerIndex], layers[activeLayerIndex + 1]] = [b, a];
    activeLayerIndex++;
    rebuildLayerCanvases();
    renderLayerList();
    scheduleAutosave();
  });

  moveLayerDownBtn.addEventListener("click", () => {
    if (isLayerLocked(layers[activeLayerIndex])) return;
    if (activeLayerIndex <= 0) return;
    if (isLayerLocked(layers[activeLayerIndex - 1])) return;
    const a = layers[activeLayerIndex];
    const b = layers[activeLayerIndex - 1];
    [a.layerPosition, b.layerPosition] = [b.layerPosition, a.layerPosition];
    [layers[activeLayerIndex], layers[activeLayerIndex - 1]] = [b, a];
    activeLayerIndex--;
    rebuildLayerCanvases();
    renderLayerList();
    scheduleAutosave();
  });

  // ================= Status bar helper =================
  function updateStatusCoords(cell) {
    statusCoords.textContent = cell ? `${cell.col}, ${cell.row}` : "-, -";
  }

  function updateStatusSize() {
    statusSize.textContent = `${mapWidth} x ${mapHeight}`;
    mapWidthInput.value = mapWidth;
    mapHeightInput.value = mapHeight;
  }

  let statusMsgTimer = null;

  function showStatusMessage(msg, isError) {
    statusSaveMsg.textContent = msg;
    statusSaveMsg.classList.toggle("error", !!isError);
    statusSaveMsg.classList.toggle("success", !isError);
    // Reset timer lama tiap panggilan baru — tanpa ini, 2 pesan berturutan
    // dlm <3.5s bisa bikin timer PERTAMA nge-clear pesan KEDUA lbh awal dari
    // seharusnya (pola sama spt bubbleHideTimer di game, script.js).
    clearTimeout(statusMsgTimer);
    statusMsgTimer = setTimeout(() => {
      statusSaveMsg.textContent = "";
      statusSaveMsg.classList.remove("error", "success");
    }, 3500);
  }

  // ================= Save / Load JSON =================
  // Format JSON dipilih drpd plain text krn: (1) map punya struktur bersarang
  // (banyak layer, tiap layer array tile) yg canggung direpresentasikan rata
  // sbg teks tanpa format ad-hoc sendiri; (2) JSON.parse/stringify native di
  // JS, tidak perlu parser custom; (3) match 1:1 dgn Firebase Realtime
  // Database yg emang nyimpen data sbg pohon JSON — objek yg sama persis bisa
  // langsung di .set() ke Firebase maupun di-download sbg file, tanpa
  // transformasi. Lihat juga CLAUDE.md.
  //
  // version 2: tilesetSrc/tilesetCols/tilesetRows global (v1) diganti jadi
  // `tilesetType` PER LAYER (krn 1 layer = 1 tileset, tiap layer bisa beda).
  // version 3: tambah `layerPosition` per layer (identitas kunci Background
  // -1/Foreground 0, lihat "Layer helpers").
  // version 4: tambah `startPosition` map-level (lihat "Start Position").
  function buildMapData() {
    return {
      version: 5, // v5 naik dari v4 krn tambahan `mode` per layer (lihat "Mode Layer")
      tileSize: TILE_SIZE,
      mapWidth,
      mapHeight,
      startPosition, // {col,row} atau null — titik spawn karakter, lihat "Start Position"
      layers: layers.map((l) => ({
        name: l.name,
        visible: l.visible,
        opacity: l.opacity,
        tilesetType: l.tilesetType,
        layerPosition: l.layerPosition,
        mode: l.mode,
        tiles: l.tiles,
      })),
    };
  }

  // File v1/v2 lama tidak punya `layerPosition` sama sekali — ditebak dari
  // NAMA layer ("Background"/"Foreground" persis → -1/0, lainnya → posisi
  // user berurutan mulai 1) krn itu satu-satunya info yg tersisa. Kalau nama
  // sudah diganti user sebelum sempat upgrade ke versi ini, tebakannya bisa
  // meleset (jadi dianggap layer user biasa, tidak terkunci) — batasan yg
  // disadari, bukan bug, tidak ada cara lain menebak identitas aslinya.
  function migrateLayerPositions(rawLayers) {
    let nextPosition = 1;
    return rawLayers.map((l) => {
      if (typeof l.layerPosition === "number") return l.layerPosition;
      if (l.name === "Background") return -1;
      if (l.name === "Foreground") return 0;
      return nextPosition++;
    });
  }

  // File v4 lama (sblm fitur "Mode Layer" ada) tidak punya field `mode` sama
  // sekali — ditebak dari `tilesetType`/`layerPosition` (SUDAH ke-migrasi di
  // atas, jadi `resolvedPosition` di sini SELALU angka) supaya perilaku
  // render map lama TETAP SAMA persis spt sebelum fitur ini ada, tanpa perlu
  // user edit ulang manual: Block Layer/Top Object → "Mask" (ditentukan dari
  // `tilesetType`, SEBELUM `layerPosition` dicek — 2 layer ini kebetulan jg
  // px `layerPosition` > `LEGACY_GROUND_POSITION_MAX` jadi HARUS dicek lebih
  // dulu, kalau kebalik bakal salah ke-anggap "Object"), Background/Foreground
  // LAMA (`layerPosition <= 0` — dua2nya DULU implisit Ground, TERLEPAS dari
  // status locked/tidaknya Foreground SEKARANG, lihat "Layer helpers") →
  // "Ground", sisanya (semua layer user lama) → "Object" (perilaku Y-sorted
  // default versi sebelum fitur mode ada).
  function migrateLayerMode(l, resolvedPosition) {
    if (l.mode === LAYER_MODE_GROUND || l.mode === LAYER_MODE_OBJECT || l.mode === LAYER_MODE_MASK) return l.mode;
    if (l.tilesetType === BLOCK_TILESET_KEY || l.tilesetType === TOP_OBJECT_TILESET_KEY) return LAYER_MODE_MASK;
    if (resolvedPosition <= LEGACY_GROUND_POSITION_MAX) return LAYER_MODE_GROUND;
    return LAYER_MODE_OBJECT;
  }

  function applyMapData(data) {
    mapWidth = data.mapWidth;
    mapHeight = data.mapHeight;
    // File v3 lama (sblm fitur ini ada) tidak punya field ini sama sekali —
    // fallback null (belum diset), bukan dianggap error.
    startPosition =
      data.startPosition && Number.isInteger(data.startPosition.col) && Number.isInteger(data.startPosition.row)
        ? { col: clamp(data.startPosition.col, 0, mapWidth - 1), row: clamp(data.startPosition.row, 0, mapHeight - 1) }
        : null;
    const positions = migrateLayerPositions(data.layers);
    layers = data.layers.map((l, i) => ({
      name: l.name,
      visible: l.visible !== false,
      opacity: typeof l.opacity === "number" ? l.opacity : 1,
      // File v1 lama tidak punya tilesetType per layer — fallback ke default
      // (Base) drpd gagal/crash, dianggap paling masuk akal sbg tebakan.
      // BLOCK_TILESET_KEY/TOP_OBJECT_TILESET_KEY diterima jg krn valid
      // (bukan entry TILESET_TYPES, sengaja bukan tileset gambar — lihat
      // isBlockLayer()/isTopObjectLayer()).
      tilesetType:
        l.tilesetType === BLOCK_TILESET_KEY || l.tilesetType === TOP_OBJECT_TILESET_KEY || TILESET_TYPES.some((t) => t.key === l.tilesetType)
          ? l.tilesetType
          : DEFAULT_TILESET_TYPE,
      layerPosition: positions[i],
      mode: migrateLayerMode(l, positions[i]),
      tiles: l.tiles.slice(),
    }));
    // File lama (dibuat sblm fitur ybs ada) tidak akan punya layer di posisi
    // reserved-nya sama sekali — tambahkan singleton-nya drpd map jd
    // selamanya tanpa layer itu (tidak ada UI utk bikin ulang scr manual,
    // beda dgn layer biasa yg bisa dibuat lewat modal Layer Baru kapan saja).
    if (!layers.some((l) => l.layerPosition === TOP_OBJECT_LAYER_POSITION)) {
      layers.push(createTopObjectLayer());
    }
    if (!layers.some((l) => l.layerPosition === BLOCK_LAYER_POSITION)) {
      layers.push(createBlockLayer());
    }
    // Jaga-jaga file hasil edit manual/rusak urutannya — render & kunci-mengunci
    // (moveLayerUpBtn/moveLayerDownBtn) berasumsi layers[] SELALU terurut
    // menaik by layerPosition.
    layers.sort((a, b) => a.layerPosition - b.layerPosition);
    activeLayerIndex = 0;
    undoStack = [];
    redoStack = [];
    updateUndoRedoButtons();
    rebuildLayerCanvases();
    renderLayerList();
    updateStatusSize();
    updateStartPositionLabel();
    showTilesetForActiveLayer();
  }

  saveJsonBtn.addEventListener("click", () => {
    const data = buildMapData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(mapNameInput.value.trim() || "map").replace(/[^a-z0-9_-]/gi, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showStatusMessage("Tersimpan sbg file JSON.");
  });

  loadJsonBtn.addEventListener("click", () => loadJsonFile.click());
  loadJsonFile.addEventListener("change", () => {
    const file = loadJsonFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        applyMapData(JSON.parse(reader.result));
        showStatusMessage(`Dimuat dari "${file.name}".`);
      } catch (err) {
        showStatusMessage(`Gagal membaca JSON: ${err.message}`, true);
      }
    };
    reader.readAsText(file);
    loadJsonFile.value = "";
  });

  // ================= Save / Load Firebase =================
  // Karakter `. # $ [ ] /` diganti "_" krn terlarang jadi key Firebase —
  // TIDAK ADA lagi fallback "map" kalau nama kosong (permintaan eksplisit
  // user, lihat validasi di saveFirebaseBtn di bawah) — dulu sengaja
  // fallback ke situ, tapi itu justru bikin user bisa asal klik Simpan
  // tanpa isi nama sama sekali.
  function sanitizeKey(name) {
    return (name || "").trim().replace(/[.#$/[\]]/g, "_");
  }

  // ================= PIN simpan server (permintaan eksplisit user) =================
  // Tiap map di Firebase nyimpen 1 field tambahan "pin" (angka 6 digit) —
  // GERBANG UPDATE, bukan gerbang baca: muat/lihat map manapun via popup
  // "Muat dari Server" (lihat `openLoadMapModal()` di bawah) TETAP bebas
  // tanpa PIN, cuma tombol "Simpan di server" yg sekarang minta PIN dulu.
  // Sengaja BUKAN bagian dari `buildMapData()`/`version` (field itu
  // scope-nya "isi map": layer, tile, dst.) — pin murni kredensial akses utk
  // 1 aksi tulis ke Firebase, jadi TIDAK ikut disimpan ke Save JSON/autosave
  // localStorage (export/backup lokal bukan tempat yg tepat utk nyimpen
  // kredensial ini).
  //
  // Dicek FRESH dari Firebase tiap kali tombol Simpan diklik (BUKAN dicache
  // dari pin map yg kebetulan lagi terbuka di editor) — supaya sekadar
  // MEMBUKA/melihat sebuah map (via dropdown) tidak otomatis "membocorkan"
  // izin nulis ulang map itu; user tetap harus MENGETIK PIN-nya scr eksplisit
  // tiap kali mau menyimpan, persis sesuai maksud "hanya user yg tau PIN yg
  // bisa update".
  // Batas percobaan PIN salah berturut-turut (mode verify SAJA — mode "Buat
  // PIN Baru" tidak pernah bisa "salah") sebelum popup "PIN Salah 3 Kali"
  // muncul (permintaan eksplisit user) — dihitung PER SESI modal terbuka
  // (`pinWrongAttempts` di-reset tiap `openPinModal()` dipanggil ulang, jadi
  // klik Simpan lagi dari awal jg ngasih 3 percobaan baru, bukan akumulasi
  // selamanya).
  const PIN_MAX_ATTEMPTS = 3;
  let pinWrongAttempts = 0;
  let pinModalResolve = null; // (enteredDigits) => true utk tutup modal, false utk tetap terbuka (mis. PIN salah)

  function openPinModal(existingPin, onConfirm) {
    const isCreate = existingPin == null;
    pinWrongAttempts = 0;
    pinModalTitle.textContent = isCreate ? "Buat PIN Baru" : "Masukkan PIN";
    pinModalDesc.textContent = isCreate
      ? "Map ini belum punya PIN. Buat PIN 6 angka — PIN ini yg akan diminta tiap kali map ini mau di-update lagi nanti."
      : "Map ini sudah dilindungi PIN. Masukkan PIN 6 angka untuk melanjutkan penyimpanan.";
    confirmPinModalBtn.textContent = isCreate ? "Buat & Simpan" : "Konfirmasi & Simpan";
    pinModalInput.value = "";
    pinModalError.textContent = "";
    pinModal.classList.add("open");
    pinModalInput.focus();

    pinModalResolve = (digits) => {
      if (!isCreate && Number(digits) !== Number(existingPin)) {
        pinWrongAttempts++;
        if (pinWrongAttempts >= PIN_MAX_ATTEMPTS) {
          openPinLockedModal();
          return true; // tutup pinModal jg — popup lockout yg lanjut tampil
        }
        pinModalError.textContent = "PIN salah. Coba lagi.";
        pinModalInput.value = "";
        pinModalInput.focus();
        return false;
      }
      onConfirm(Number(digits));
      return true;
    };
  }

  function closePinModal() {
    pinModal.classList.remove("open");
    pinModalResolve = null;
    saveFirebaseBtn.disabled = false;
  }

  function openPinLockedModal() {
    pinLockedModal.classList.add("open");
  }

  // Dipanggil dari tombol "Tutup" popup lockout — permintaan eksplisit user
  // "tombol tutup semua pop up", jadi SENGAJA jg nutup `pinModal` (harusnya
  // sudah tertutup lewat `closePinModal()` di `submitPinModal()`, tapi
  // dipanggil ulang di sini spy tidak gantung kalau urutannya berubah nanti)
  // — bukan cuma nutup popup lockout-nya sendiri.
  function closePinLockedModal() {
    pinLockedModal.classList.remove("open");
    closePinModal();
  }

  closePinLockedModalBtn.addEventListener("click", closePinLockedModal);
  pinLockedModal.addEventListener("click", (e) => {
    if (e.target === pinLockedModal) closePinLockedModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && pinLockedModal.classList.contains("open")) closePinLockedModal();
  });

  function submitPinModal() {
    const digits = pinModalInput.value.trim();
    if (!/^\d{6}$/.test(digits)) {
      pinModalError.textContent = "PIN harus tepat 6 angka.";
      pinModalInput.focus();
      return;
    }
    if (pinModalResolve && pinModalResolve(digits) !== false) closePinModal();
  }

  confirmPinModalBtn.addEventListener("click", submitPinModal);
  cancelPinModalBtn.addEventListener("click", closePinModal);
  pinModal.addEventListener("click", (e) => {
    if (e.target === pinModal) closePinModal();
  });
  pinModalInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitPinModal();
    } else if (e.key === "Escape") {
      closePinModal();
    }
  });

  // `createdAt`/`updatedAt` — sama pola dgn `pin` (permintaan susulan user
  // "mulai sekarang, tambahkan juga createdAt dan updatedAt berisi
  // timestamp"): metadata RECORD Firebase, bukan "isi map", jadi sengaja jg
  // BUKAN bagian dari `buildMapData()`/skema `version`/Save JSON/autosave —
  // ditempel manual di `saveMapToFirebase()` doang, sama persis `pin`.
  // `Date.now()` (epoch ms, client-side) — konsisten dgn konvensi timestamp
  // yg sudah dipakai app lain di repo ini (`created`/`expired` di
  // `24Card/poker.js` dkk), BUKAN `firebase.database.ServerValue.TIMESTAMP`.
  function saveMapToFirebase(key, pin, existingCreatedAt) {
    const data = buildMapData();
    data.pin = pin;
    const now = Date.now();
    // `createdAt` di-PERTAHANKAN kalau map-nya sudah pernah ada sebelumnya
    // (map lama blm py field ini jg dianggap "belum ada", fallback ke now,
    // drpd field ini abadi kosong) — cuma diisi SEKALI di penyimpanan
    // pertama sebuah map, `updatedAt` yg berubah tiap simpan.
    data.createdAt = existingCreatedAt || now;
    data.updatedAt = now;
    db.ref(`${TILEMAP_PATH}/${key}`)
      .set(data)
      .then(() => {
        // TIDAK perlu refresh daftar apa pun di sini lagi (beda dari versi
        // dropdown lama) — popup "Muat dari Server" sekarang SELALU fetch
        // ulang tiap dibuka (lihat `openLoadMapModal()`), jadi tidak ada
        // cache list yg perlu disinkron manual stlh save.
        showStatusMessage(`Tersimpan ke server sbg "${key}".`);
      })
      .catch((err) => showStatusMessage(`Gagal simpan ke server: ${err.message}`, true));
  }

  saveFirebaseBtn.addEventListener("click", () => {
    const key = sanitizeKey(mapNameInput.value);
    if (!key) {
      showStatusMessage("Isi nama map dulu sebelum menyimpan.", true);
      mapNameInput.focus();
      return;
    }
    mapNameInput.value = key;
    saveFirebaseBtn.disabled = true;
    Promise.all([db.ref(`${TILEMAP_PATH}/${key}/pin`).once("value"), db.ref(`${TILEMAP_PATH}/${key}/createdAt`).once("value")])
      .then(([pinSnap, createdAtSnap]) => {
        openPinModal(pinSnap.val(), (pin) => saveMapToFirebase(key, pin, createdAtSnap.val()));
      })
      .catch((err) => {
        saveFirebaseBtn.disabled = false;
        showStatusMessage(`Gagal cek PIN: ${err.message}`, true);
      });
  });

  // ================= Muat dari Server (popup, permintaan eksplisit user) =================
  // Diganti dari `<select>` dropdown ke tombol + popup — dropdown native
  // browser cuma bisa nampilin 1 baris teks per opsi, tidak cukup utk
  // metadata yg diminta (ukuran grid + createdAt + updatedAt per map). Pola
  // UI-nya SENGAJA disamakan dgn popup "Pilih Map" di GAME (`script.js`,
  // lihat "Pilih Map" di CLAUDE.md) — search + urutan abjad + "default"
  // disematkan paling atas — bedanya di sini pakai
  // `db.ref(TILEMAP_PATH).once("value")` biasa (BUKAN REST `?shallow=true`
  // spt di game) krn di sini JUSTRU BUTUH isi tiap map
  // (`mapWidth`/`mapHeight`/`createdAt`/`updatedAt`), bukan cuma nama
  // key-nya doang — `?shallow=true` hanya balikin nama anak, tidak cukup.
  let allMapsMeta = []; // cache selagi popup terbuka — di-fetch ulang tiap dibuka (lihat openLoadMapModal)

  function formatMapTimestamp(ts) {
    if (typeof ts !== "number") return "—"; // map lama sblm fitur createdAt/updatedAt ada
    return new Date(ts).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  // "default" SELALU di posisi PALING ATAS (permintaan eksplisit user),
  // sisanya abjad — dipanggil SETELAH filter search jg diterapkan, spy
  // "default" tetap nempel di atas walau lagi nyari sesuatu yg lain.
  function sortMapsMeta(list) {
    const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
    const defaultIdx = sorted.findIndex((m) => m.name === "default");
    if (defaultIdx > 0) sorted.unshift(sorted.splice(defaultIdx, 1)[0]);
    return sorted;
  }

  function loadMapFromFirebase(key) {
    db.ref(`${TILEMAP_PATH}/${key}`)
      .once("value")
      .then((snap) => {
        const data = snap.val();
        if (!data) return;
        applyMapData(data);
        mapNameInput.value = key;
        showStatusMessage(`Dimuat dari server: "${key}".`);
      })
      .catch((err) => showStatusMessage(`Gagal muat dari server: ${err.message}`, true));
  }

  function renderLoadMapList(query) {
    loadMapList.innerHTML = "";
    const q = query.trim().toLowerCase();
    const filtered = q ? allMapsMeta.filter((m) => m.name.toLowerCase().includes(q)) : allMapsMeta;
    const sorted = sortMapsMeta(filtered);

    if (sorted.length === 0) {
      const empty = document.createElement("div");
      empty.className = "map-load-empty";
      empty.textContent = allMapsMeta.length === 0 ? "Belum ada map tersimpan." : "Tidak ada map yg cocok.";
      loadMapList.appendChild(empty);
      return;
    }

    // Dibangun via createElement/textContent (BUKAN innerHTML+interpolasi
    // string) — nama map bisa berisi karakter apa pun yg lolos
    // `sanitizeKey()` (yg cuma nyaring karakter terlarang Firebase, BUKAN
    // karakter HTML), jadi innerHTML+interpolasi berpotensi jadi celah XSS
    // kalau ada nama map yg kebetulan berisi `<`/`>`.
    sorted.forEach((m) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "map-load-item" + (m.name === mapNameInput.value ? " active" : "");

      const nameEl = document.createElement("div");
      nameEl.className = "map-load-item-name";
      nameEl.textContent = m.name;

      const metaEl = document.createElement("div");
      metaEl.className = "map-load-item-meta";
      const sizeSpan = document.createElement("span");
      sizeSpan.textContent = `${m.mapWidth ?? "?"} × ${m.mapHeight ?? "?"}`;
      const createdSpan = document.createElement("span");
      createdSpan.textContent = `Dibuat: ${formatMapTimestamp(m.createdAt)}`;
      const updatedSpan = document.createElement("span");
      updatedSpan.textContent = `Diperbarui: ${formatMapTimestamp(m.updatedAt)}`;
      metaEl.append(sizeSpan, createdSpan, updatedSpan);

      item.append(nameEl, metaEl);
      item.addEventListener("click", () => {
        closeLoadMapModal();
        loadMapFromFirebase(m.name);
      });
      loadMapList.appendChild(item);
    });
  }

  async function openLoadMapModal() {
    loadMapSearchInput.value = "";
    loadMapModal.classList.add("open");
    loadMapList.innerHTML = '<div class="map-load-empty">Memuat daftar map…</div>';
    try {
      const snap = await db.ref(TILEMAP_PATH).once("value");
      allMapsMeta = [];
      snap.forEach((child) => {
        const data = child.val() || {};
        allMapsMeta.push({ name: child.key, mapWidth: data.mapWidth, mapHeight: data.mapHeight, createdAt: data.createdAt, updatedAt: data.updatedAt });
      });
    } catch (err) {
      loadMapList.innerHTML = "";
      const errEl = document.createElement("div");
      errEl.className = "map-load-empty";
      errEl.textContent = "Gagal memuat daftar map.";
      loadMapList.appendChild(errEl);
      console.warn("Gagal memuat daftar map dari Firebase:", err);
      return;
    }
    renderLoadMapList("");
    loadMapSearchInput.focus();
  }

  function closeLoadMapModal() {
    loadMapModal.classList.remove("open");
  }

  openLoadMapModalBtn.addEventListener("click", openLoadMapModal);
  closeLoadMapModalBtn.addEventListener("click", closeLoadMapModal);
  loadMapModal.addEventListener("click", (e) => {
    if (e.target === loadMapModal) closeLoadMapModal();
  });
  loadMapSearchInput.addEventListener("input", () => renderLoadMapList(loadMapSearchInput.value));
  loadMapSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLoadMapModal();
  });

  // ================= Autosave lokal (localStorage) =================
  // Jaring pengaman murni lokal (bukan pengganti Save JSON/Firebase) — kalau
  // tab ke-refresh/ke-close tidak sengaja, draft masih bisa dipulihkan. Ditulis
  // debounced (bukan tiap 1 perubahan) biar tidak nulis localStorage berlebihan
  // pas lagi nge-drag kuas.
  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(buildMapData()));
        const now = new Date();
        statusAutosave.textContent = `Auto-save: ${now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
      } catch (err) {
        // localStorage penuh/disabled — bukan fatal, cukup diamkan (Save JSON/Firebase manual tetap jalan).
      }
    }, AUTOSAVE_DEBOUNCE);
  }

  function tryRestoreAutosave() {
    let raw;
    try {
      raw = localStorage.getItem(AUTOSAVE_KEY);
    } catch (err) {
      return false;
    }
    if (!raw) return false;
    if (!confirm("Ditemukan draft tersimpan otomatis dari sesi sebelumnya. Muat draft itu?")) return false;
    try {
      applyMapData(JSON.parse(raw));
      showStatusMessage("Draft auto-save dipulihkan.");
      return true;
    } catch (err) {
      return false;
    }
  }

  // ================= Init =================
  function init() {
    updateUndoRedoButtons();
    renderTilesetTabs();
    preloadAllTilesets(() => {
      if (!tryRestoreAutosave()) {
        initDefaultLayers();
        rebuildLayerCanvases();
        renderLayerList();
        updateStatusSize();
        updateStartPositionLabel();
        showTilesetForActiveLayer();
      }
      setMapZoom(1);
      setTilesetZoom(0.5);
    });
    // Tidak ada prefetch daftar map di sini lagi (beda dari versi dropdown
    // lama) — popup "Muat dari Server" fetch on-demand tiap dibuka.
  }

  init();
})();
