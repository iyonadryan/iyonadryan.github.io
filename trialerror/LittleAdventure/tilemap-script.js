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
  function tilesetLabel(key) {
    return tilesetTypeDef(key).label;
  }
  function tilesetFile(key) {
    return TILESET_DIR + tilesetTypeDef(key).file;
  }
  function tilesetColor(key) {
    return tilesetTypeDef(key).color;
  }

  // ================= DOM refs =================
  const layerList = document.getElementById("layerList");
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

  const saveJsonBtn = document.getElementById("saveJsonBtn");
  const loadJsonBtn = document.getElementById("loadJsonBtn");
  const loadJsonFile = document.getElementById("loadJsonFile");
  const mapNameInput = document.getElementById("mapNameInput");
  const saveFirebaseBtn = document.getElementById("saveFirebaseBtn");
  const firebaseMapSelect = document.getElementById("firebaseMapSelect");
  const refreshFirebaseListBtn = document.getElementById("refreshFirebaseListBtn");

  const canvasScroll = document.getElementById("canvasScroll");
  const canvasWrapper = document.getElementById("canvasWrapper");
  const gridCanvas = document.getElementById("gridCanvas");

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
  const cancelNewLayerBtn = document.getElementById("cancelNewLayerBtn");
  const confirmNewLayerBtn = document.getElementById("confirmNewLayerBtn");

  // ================= State =================
  let mapWidth = DEFAULT_MAP_WIDTH;
  let mapHeight = DEFAULT_MAP_HEIGHT;
  let layers = []; // { name, visible, opacity, tilesetType, tiles: number[] } — tiles: row-major, EMPTY = kosong
  let activeLayerIndex = 0;
  let layerCanvases = []; // <canvas> per layer, paralel dgn `layers`

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
  function createLayer(name, tilesetType) {
    return {
      name,
      visible: true,
      opacity: 1,
      tilesetType: tilesetType || DEFAULT_TILESET_TYPE,
      tiles: new Array(mapWidth * mapHeight).fill(EMPTY),
    };
  }

  function initDefaultLayers() {
    layers = [createLayer("Background", "Base"), createLayer("Foreground", "Base")];
    activeLayerIndex = 0;
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
    applyMapZoomToDom();
    renderAllLayers();
    renderGrid();
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
    const cache = tilesetCache[layer.tilesetType];
    if (!cache || !cache.loaded) return; // belum selesai preload, akan di-render ulang stlh siap
    ctx.globalAlpha = layer.opacity;
    ctx.imageSmoothingEnabled = false;
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
      const newTiles = new Array(newWidth * newHeight).fill(EMPTY);
      const copyW = Math.min(oldWidth, newWidth);
      const copyH = Math.min(oldHeight, newHeight);
      for (let row = 0; row < copyH; row++) {
        for (let col = 0; col < copyW; col++) {
          newTiles[row * newWidth + col] = layer.tiles[row * oldWidth + col];
        }
      }
      layer.tiles = newTiles;
    });
    mapWidth = newWidth;
    mapHeight = newHeight;
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
    const col = Math.floor(xRatio * mapWidth);
    const row = Math.floor(yRatio * mapHeight);
    if (col < 0 || col >= mapWidth || row < 0 || row >= mapHeight) return null;
    return { col, row };
  }

  function setCellIncremental(layerIndex, col, row, value) {
    const layer = layers[layerIndex];
    layer.tiles[row * mapWidth + col] = value;
    const ctx = layerCanvases[layerIndex].getContext("2d");
    ctx.clearRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    if (value !== EMPTY && layer.visible) {
      const cache = tilesetCache[layer.tilesetType];
      if (cache && cache.loaded) {
        ctx.globalAlpha = layer.opacity;
        drawTileOnCtx(ctx, cache, value, col, row);
        ctx.globalAlpha = 1;
      }
    }
  }

  // BFS 4-arah, ganti semua sel bersambung yg nilainya sama persis dgn sel yg
  // diklik menjadi `newValue` — pola flood-fill standar (mis. Paint Bucket).
  function floodFill(layerIndex, startCol, startRow, newValue) {
    const layer = layers[layerIndex];
    const idx0 = startRow * mapWidth + startCol;
    const target = layer.tiles[idx0];
    if (target === newValue) return;
    const stack = [[startCol, startRow]];
    while (stack.length) {
      const [col, row] = stack.pop();
      if (col < 0 || col >= mapWidth || row < 0 || row >= mapHeight) continue;
      const idx = row * mapWidth + col;
      if (layer.tiles[idx] !== target) continue;
      setCellIncremental(layerIndex, col, row, newValue);
      stack.push([col + 1, row], [col - 1, row], [col, row + 1], [col, row - 1]);
    }
  }

  function paintAt(col, row) {
    if (currentTool === "fill") {
      floodFill(activeLayerIndex, col, row, selectedTile);
      return;
    }
    const newValue = currentTool === "erase" ? EMPTY : selectedTile;
    const idx = row * mapWidth + col;
    if (layers[activeLayerIndex].tiles[idx] === newValue) return;
    setCellIncremental(activeLayerIndex, col, row, newValue);
  }

  canvasWrapper.addEventListener("pointerdown", (e) => {
    const cell = cellFromEvent(e);
    if (!cell) return;
    isPainting = true;
    pushUndo();
    paintAt(cell.col, cell.row);
    lastPaintedCell = `${cell.col},${cell.row}`;
    updateStatusCoords(cell);
  });

  window.addEventListener("pointermove", (e) => {
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
    const type = layers[activeLayerIndex].tilesetType;
    const cache = tilesetCache[type];
    tilesetCols = cache.cols;
    tilesetRows = cache.rows;
    selectedTile = 0; // index tile tidak nyambung antar tileset beda, reset tiap ganti
    tilesetImg.src = tilesetFile(type);
    updateTilesetTabsActive(type);
    updateTilesetDisplaySize();
    updateTileHighlight();
    updateTilesetInfo();
  }

  // Tab di panel kanan ini SEKADAR INDIKATOR (bukan tombol ganti tileset) —
  // krn 1 layer = 1 tileset yg cuma ditentukan sekali sewaktu layer dibuat
  // (modal Layer Baru), tab selain tileset milik layer aktif di-disable
  // (tidak bisa diklik sama sekali), permintaan eksplisit user.
  function renderTilesetTabs() {
    tilesetTabs.innerHTML = "";
    TILESET_TYPES.forEach((t) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tileset-tab";
      btn.textContent = t.label;
      btn.dataset.key = t.key;
      tilesetTabs.appendChild(btn);
    });
  }

  function updateTilesetTabsActive(activeType) {
    tilesetTabs.querySelectorAll(".tileset-tab").forEach((btn) => {
      const isActive = btn.dataset.key === activeType;
      btn.classList.toggle("active", isActive);
      btn.disabled = !isActive;
    });
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
  function renderLayerList() {
    layerList.innerHTML = "";
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      const row = document.createElement("div");
      row.className = "layer-row" + (i === activeLayerIndex ? " active" : "");

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

      const nameSpan = document.createElement("span");
      nameSpan.className = "layer-name";
      nameSpan.textContent = layer.name;
      nameSpan.title = "Klik dua kali utk ganti nama";
      nameSpan.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        const newName = prompt("Nama layer:", layer.name);
        if (newName && newName.trim()) {
          layer.name = newName.trim();
          renderLayerList();
          scheduleAutosave();
        }
      });

      top.appendChild(visBtn);
      top.appendChild(nameSpan);

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
      row.appendChild(opacity);
      row.addEventListener("click", () => {
        activeLayerIndex = i;
        renderLayerList();
        showTilesetForActiveLayer();
      });

      layerList.appendChild(row);
    }
  }

  // ================= Modal Layer Baru (nama + wajib pilih tileset) =================
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

  function openNewLayerModal() {
    newLayerNameInput.value = `Layer ${layers.length + 1}`;
    newLayerSelectedType = DEFAULT_TILESET_TYPE;
    renderNewLayerTilesetTabs();
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
    layers.push(createLayer(name, newLayerSelectedType));
    activeLayerIndex = layers.length - 1;
    rebuildLayerCanvases();
    renderLayerList();
    showTilesetForActiveLayer();
    scheduleAutosave();
    closeNewLayerModal();
  });

  removeLayerBtn.addEventListener("click", () => {
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
  moveLayerUpBtn.addEventListener("click", () => {
    if (activeLayerIndex >= layers.length - 1) return;
    [layers[activeLayerIndex], layers[activeLayerIndex + 1]] = [layers[activeLayerIndex + 1], layers[activeLayerIndex]];
    activeLayerIndex++;
    rebuildLayerCanvases();
    renderLayerList();
    scheduleAutosave();
  });

  moveLayerDownBtn.addEventListener("click", () => {
    if (activeLayerIndex <= 0) return;
    [layers[activeLayerIndex], layers[activeLayerIndex - 1]] = [layers[activeLayerIndex - 1], layers[activeLayerIndex]];
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

  function showStatusMessage(msg, isError) {
    statusSaveMsg.textContent = msg;
    statusSaveMsg.style.color = isError ? "var(--danger)" : "var(--success)";
    setTimeout(() => {
      statusSaveMsg.textContent = "";
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
  function buildMapData() {
    return {
      version: 2,
      tileSize: TILE_SIZE,
      mapWidth,
      mapHeight,
      layers: layers.map((l) => ({
        name: l.name,
        visible: l.visible,
        opacity: l.opacity,
        tilesetType: l.tilesetType,
        tiles: l.tiles,
      })),
    };
  }

  function applyMapData(data) {
    mapWidth = data.mapWidth;
    mapHeight = data.mapHeight;
    layers = data.layers.map((l) => ({
      name: l.name,
      visible: l.visible !== false,
      opacity: typeof l.opacity === "number" ? l.opacity : 1,
      // File v1 lama tidak punya tilesetType per layer — fallback ke default
      // (Base) drpd gagal/crash, dianggap paling masuk akal sbg tebakan.
      tilesetType: TILESET_TYPES.some((t) => t.key === l.tilesetType) ? l.tilesetType : DEFAULT_TILESET_TYPE,
      tiles: l.tiles.slice(),
    }));
    activeLayerIndex = 0;
    undoStack = [];
    redoStack = [];
    updateUndoRedoButtons();
    rebuildLayerCanvases();
    renderLayerList();
    updateStatusSize();
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
  function sanitizeKey(name) {
    return (name || "").trim().replace(/[.#$/[\]]/g, "_") || "map";
  }

  saveFirebaseBtn.addEventListener("click", () => {
    const key = sanitizeKey(mapNameInput.value);
    mapNameInput.value = key;
    db.ref(`${TILEMAP_PATH}/${key}`)
      .set(buildMapData())
      .then(() => {
        showStatusMessage(`Tersimpan ke Firebase sbg "${key}".`);
        refreshFirebaseList();
      })
      .catch((err) => showStatusMessage(`Gagal simpan ke Firebase: ${err.message}`, true));
  });

  function refreshFirebaseList() {
    db.ref(TILEMAP_PATH)
      .once("value")
      .then((snap) => {
        firebaseMapSelect.innerHTML = '<option value="">— Muat dari Firebase —</option>';
        snap.forEach((child) => {
          const opt = document.createElement("option");
          opt.value = child.key;
          opt.textContent = child.key;
          firebaseMapSelect.appendChild(opt);
        });
      })
      .catch((err) => showStatusMessage(`Gagal ambil daftar Firebase: ${err.message}`, true));
  }

  firebaseMapSelect.addEventListener("change", () => {
    const key = firebaseMapSelect.value;
    if (!key) return;
    db.ref(`${TILEMAP_PATH}/${key}`)
      .once("value")
      .then((snap) => {
        const data = snap.val();
        if (!data) return;
        applyMapData(data);
        mapNameInput.value = key;
        showStatusMessage(`Dimuat dari Firebase: "${key}".`);
      })
      .catch((err) => showStatusMessage(`Gagal muat dari Firebase: ${err.message}`, true));
  });

  refreshFirebaseListBtn.addEventListener("click", refreshFirebaseList);

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
        showTilesetForActiveLayer();
      }
      setMapZoom(1);
      setTilesetZoom(0.5);
    });
    refreshFirebaseList();
  }

  init();
})();
