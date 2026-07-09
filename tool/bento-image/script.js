// ---------- THEME ----------
// Own storage key, independent from every other page in this repo (same
// pattern as e.g. noteapp_theme vs financeapp_theme, and generatecolor_theme
// vs colorpicker_theme in tool/).
(function initTheme(){
  const STORAGE_KEY = 'bentoimage_theme';
  const root = document.documentElement;
  const btn = document.getElementById('themeToggle');
  function applyTheme(theme){
    root.setAttribute('data-theme', theme);
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
  const saved = localStorage.getItem(STORAGE_KEY);
  applyTheme(saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  btn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  });
})();

// ---------- GRID STYLE (algoritma pembangkit pola) + GRID LAYOUT (kolom x baris) ----------
// Beda dari daftar template tetap (sebelumnya): "Grid Layout" (jumlah kolom &
// baris grid dasar) sekarang bebas diatur user, dan "Grid Style" adalah satu
// dari beberapa ALGORITMA yang mempartisi grid dasar itu jadi sel-sel bento —
// polanya dihitung ulang tiap kali kolom/baris/gaya berubah, bukan dipilih
// dari daftar bentuk yang sudah jadi. Pola ini diambil dari amatan struktur
// panel "Grid Style" + "Grid Layout" terpisah di bento.samolevsky.com (situs
// generator bento grid), lalu diimplementasikan ulang dari nol di sini —
// bukan menyalin kode/aset situs itu, cuma konsepnya (lihat penjelasan
// lengkap tiap algoritma di `tool/.claude/bento-image.md`).
//
// Tiap fungsi generate(cols, rows) WAJIB mengembalikan array sel yg mempartisi
// grid `cols x rows` scr LENGKAP (tiap unit tercakup persis sekali, tanpa
// celah/tumpang-tindih) — sel berbentuk {colStart, colSpan, rowStart, rowSpan}
// (1-indexed), sama persis skema yg dipakai `computeCellRects()`.

function toCellShape(region){
  return { colStart: region.c0 + 1, colSpan: region.c1 - region.c0, rowStart: region.r0 + 1, rowSpan: region.r1 - region.r0 };
}

// Partisi guillotine rekursif: potong satu region jadi dua terus-menerus
// (garis potong selalu tembus dari sisi ke sisi, spt memotong roti), berhenti
// makin sering seiring makin dalam rekursi (`stopBase/stopGrowth/stopMax`)
// supaya hasilnya campuran blok besar & kecil, bukan selalu petak seragam.
// `longSplitBias` condong memotong di sisi yg lebih panjang dulu (mencegah
// blok jadi terlalu kurus memanjang).
function splitRegion(region, style, depth){
  const w = region.c1 - region.c0, h = region.r1 - region.r0;
  if (w === 1 && h === 1) return [region];

  let stop = false;
  if (depth > 0) {
    const p = Math.min(style.stopBase + depth * style.stopGrowth, style.stopMax);
    stop = Math.random() < p;
  }
  if (stop) return [region];

  let vertical; // true = potongan garis vertikal (membagi kolom jadi kiri/kanan)
  if (w === 1) vertical = false;
  else if (h === 1) vertical = true;
  else vertical = Math.random() < (w >= h ? style.longSplitBias : 1 - style.longSplitBias);

  if (vertical) {
    const cut = region.c0 + 1 + Math.floor(Math.random() * (w - 1));
    return [...splitRegion({ ...region, c1: cut }, style, depth + 1),
            ...splitRegion({ ...region, c0: cut }, style, depth + 1)];
  }
  const cut = region.r0 + 1 + Math.floor(Math.random() * (h - 1));
  return [...splitRegion({ ...region, r1: cut }, style, depth + 1),
          ...splitRegion({ ...region, r0: cut }, style, depth + 1)];
}

function generateSplitStyle(cols, rows, styleParams){
  return splitRegion({ c0: 0, r0: 0, c1: cols, r1: rows }, styleParams, 0).map(toCellShape);
}

// Reguler: grid seragam, tiap sel 1x1 — tidak ada elemen acak.
function generateReguler(cols, rows){
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ colStart: c + 1, colSpan: 1, rowStart: r + 1, rowSpan: 1 });
    }
  }
  return cells;
}

// Pola: motif ubin 2x2 berulang (sisa baris/kolom ganjil di tepi otomatis
// jadi strip 1-lebar/1-tinggi) — deterministik, tidak ada elemen acak.
function generatePola(cols, rows){
  const cells = [];
  for (let r = 0; r < rows; r += 2) {
    const rSpan = Math.min(2, rows - r);
    for (let c = 0; c < cols; c += 2) {
      const cSpan = Math.min(2, cols - c);
      cells.push({ colStart: c + 1, colSpan: cSpan, rowStart: r + 1, rowSpan: rSpan });
    }
  }
  return cells;
}

// Parameter `splitRegion()` per gaya acak — nilai ini dipilih lewat uji coba
// manual (skrip Node terpisah, lihat tool/.claude/bento-image.md) yg
// memvalidasi partisi selalu lengkap & menghitung rata-rata jumlah blok yg
// dihasilkan utk berbagai ukuran grid, supaya "Bento" terasa bervariasi
// (rata-rata ~3-5 blok) & "Mondrian" terasa lebih sedikit-tapi-besar
// (rata-rata ~3 blok, potongan lebih acak arahnya) drpd cuma tebak-tebakan.
const STYLES = [
  { id: 'reguler', label: 'Reguler', deterministic: true, generate: generateReguler },
  { id: 'bento', label: 'Bento', deterministic: false,
    generate: (c, r) => generateSplitStyle(c, r, { stopBase: 0.35, stopGrowth: 0.15, stopMax: 0.85, longSplitBias: 0.75 }) },
  { id: 'mondrian', label: 'Mondrian', deterministic: false,
    generate: (c, r) => generateSplitStyle(c, r, { stopBase: 0.5, stopGrowth: 0.2, stopMax: 0.9, longSplitBias: 0.5 }) },
  { id: 'pola', label: 'Pola', deterministic: true, generate: generatePola },
];

const DIM_PRESETS = [
  { label:'1:1', w:1080, h:1080 },
  { label:'4:5', w:1080, h:1350 },
  { label:'3:4', w:1080, h:1440 },
  { label:'16:9', w:1920, h:1080 },
  { label:'9:16', w:1080, h:1920 },
];

// ---------- STATE ----------
const state = {
  styleId: 'bento',
  layoutCols: 4,
  layoutRows: 3,
  linkColsRows: false,
  pattern: [],  // partisi sel aktif — hasil generate() gaya saat ini utk layoutCols x layoutRows
  canvasW: 1080,
  canvasH: 1080,
  gap: 12,
  radius: 16,
  padding: 0,
  gapColor: '#FFFFFF',
  images: [],   // { id, url, img: HTMLImageElement }
  cells: {},    // cellIndex -> { imageId, panX(-1..1), panY(-1..1), zoom(1..3) }
};
let imgIdCounter = 0;

function clamp(v, min, max){ return Math.min(max, Math.max(min, v)); }
function getActiveStyle(){ return STYLES.find(s => s.id === state.styleId) || STYLES[0]; }

// Bangkitkan ulang state.pattern dari gaya + kolom/baris aktif.
function regeneratePattern(){
  state.pattern = getActiveStyle().generate(state.layoutCols, state.layoutRows);
}

// ---------- GEOMETRY ----------
function computeCellRects(){
  const cols = state.layoutCols, rows = state.layoutRows;
  const W = state.canvasW, H = state.canvasH;
  const pad = state.padding, gap = state.gap;
  const innerW = W - pad * 2, innerH = H - pad * 2;
  const colW = (innerW - gap * (cols - 1)) / cols;
  const rowH = (innerH - gap * (rows - 1)) / rows;
  return state.pattern.map(cell => {
    const x = pad + (cell.colStart - 1) * (colW + gap);
    const y = pad + (cell.rowStart - 1) * (rowH + gap);
    const w = cell.colSpan * colW + (cell.colSpan - 1) * gap;
    const h = cell.rowSpan * rowH + (cell.rowSpan - 1) * gap;
    return { x, y, w, h };
  });
}

function roundRectPath(ctx, x, y, w, h, r){
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// object-fit:cover ke dalam `rect`, dgn pan (panX/panY, -1..1 = batas geser
// maksimum tetap menutupi sel) & zoom (1..3) per sel.
function drawImageCover(ctx, img, rect, cellState){
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const coverScale = Math.max(rect.w / iw, rect.h / ih) * (cellState.zoom || 1);
  const dw = iw * coverScale, dh = ih * coverScale;
  const baseX = rect.x + (rect.w - dw) / 2;
  const baseY = rect.y + (rect.h - dh) / 2;
  const maxShiftX = Math.max(0, (dw - rect.w) / 2);
  const maxShiftY = Math.max(0, (dh - rect.h) / 2);
  const dx = baseX + (cellState.panX || 0) * maxShiftX;
  const dy = baseY + (cellState.panY || 0) * maxShiftY;
  ctx.drawImage(img, dx, dy, dw, dh);
}

// ---------- RENDER ----------
const canvas = document.getElementById('bentoCanvas');
const ctx = canvas.getContext('2d');

function renderCanvas(){
  canvas.width = state.canvasW;
  canvas.height = state.canvasH;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = state.gapColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const rects = computeCellRects();
  rects.forEach((rect, i) => {
    const cs = state.cells[i];
    const im = cs && cs.imageId ? state.images.find(x => x.id === cs.imageId) : null;
    if (im && im.img.complete && im.img.naturalWidth) {
      ctx.save();
      roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, state.radius);
      ctx.clip();
      drawImageCover(ctx, im.img, rect, cs);
      ctx.restore();
    }
    // sel kosong: tidak digambar apa pun — warna latar (gapColor) yang
    // sudah mengisi seluruh kanvas otomatis "terlihat" di area itu, jadi
    // hasil ekspor tetap bersih tanpa placeholder ikut terbakar ke gambar.
  });
}

function renderOverlay(){
  const layer = document.getElementById('cellLayer');
  layer.innerHTML = '';
  const rects = computeCellRects();
  const W = state.canvasW, H = state.canvasH;

  rects.forEach((rect, i) => {
    const hit = document.createElement('div');
    hit.className = 'cell-hit';
    hit.style.left = (rect.x / W * 100) + '%';
    hit.style.top = (rect.y / H * 100) + '%';
    hit.style.width = (rect.w / W * 100) + '%';
    hit.style.height = (rect.h / H * 100) + '%';

    const cs = state.cells[i];
    const hasImage = !!(cs && cs.imageId && state.images.find(x => x.id === cs.imageId));

    if (hasImage) {
      hit.classList.add('filled');
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'cell-del';
      del.textContent = '×';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        delete state.cells[i];
        renderAll();
      });
      hit.appendChild(del);
      attachCellDrag(hit, i);
      hit.addEventListener('wheel', (e) => handleCellZoom(e, i), { passive: false });
    } else {
      hit.classList.add('empty');
      const plus = document.createElement('div');
      plus.className = 'cell-plus';
      plus.textContent = '+';
      hit.appendChild(plus);
    }

    hit.addEventListener('click', () => {
      if (hit.dataset.dragged === '1') { hit.dataset.dragged = ''; return; }
      openCellFilePicker(i);
    });

    layer.appendChild(hit);
  });
}

function renderAll(){
  renderCanvas();
  renderOverlay();
  refreshStyleActive();
  refreshDimActive();
}

// ---------- DRAG (geser posisi foto dalam sel) & ZOOM (scroll) ----------
// Threshold gerak sebelum dianggap "drag" bukan "klik" — pola sama dgn
// perbaikan bug drag-vs-klik di Note App, supaya klik tipis tak sengaja
// tidak menggeser gambar & sebaliknya drag tidak membuka file picker.
function attachCellDrag(hit, i){
  const THRESH = 4;
  let dragging = false, moved = false;
  let startX = 0, startY = 0, startPanX = 0, startPanY = 0;

  hit.addEventListener('pointerdown', (e) => {
    const cs = state.cells[i];
    if (!cs) return;
    dragging = true; moved = false;
    startX = e.clientX; startY = e.clientY;
    startPanX = cs.panX || 0; startPanY = cs.panY || 0;
    hit.classList.add('dragging');
    hit.setPointerCapture(e.pointerId);
  });

  hit.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (Math.abs(dx) > THRESH || Math.abs(dy) > THRESH) moved = true;
    if (!moved) return;

    const cs = state.cells[i];
    const im = cs && state.images.find(x => x.id === cs.imageId);
    if (!im) return;
    const rect = computeCellRects()[i];
    const boxRect = canvas.getBoundingClientRect();
    const scaleX = state.canvasW / boxRect.width;
    const scaleY = state.canvasH / boxRect.height;

    const iw = im.img.naturalWidth, ih = im.img.naturalHeight;
    const coverScale = Math.max(rect.w / iw, rect.h / ih) * (cs.zoom || 1);
    const dw = iw * coverScale, dh = ih * coverScale;
    const maxShiftX = Math.max(0, (dw - rect.w) / 2);
    const maxShiftY = Math.max(0, (dh - rect.h) / 2);

    const dxPx = dx * scaleX, dyPx = dy * scaleY;
    cs.panX = maxShiftX > 0 ? clamp(startPanX + dxPx / maxShiftX, -1, 1) : 0;
    cs.panY = maxShiftY > 0 ? clamp(startPanY + dyPx / maxShiftY, -1, 1) : 0;
    renderCanvas();
  });

  function endDrag(){
    if (!dragging) return;
    dragging = false;
    hit.classList.remove('dragging');
    if (moved) hit.dataset.dragged = '1';
  }
  hit.addEventListener('pointerup', endDrag);
  hit.addEventListener('pointercancel', endDrag);
}

function handleCellZoom(e, i){
  e.preventDefault();
  const cs = state.cells[i];
  if (!cs) return;
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  cs.zoom = clamp((cs.zoom || 1) + delta, 1, 3);
  renderCanvas();
}

// ---------- FOTO (pool) ----------
function addImageFile(file, cb){
  if (!file || !file.type.startsWith('image/')) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const id = 'img' + (++imgIdCounter) + '_' + Date.now();
    state.images.push({ id, url, img });
    renderPool();
    if (cb) cb(id);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    alert('Gagal memuat salah satu foto. Coba berkas lain.');
  };
  img.src = url;
}

function renderPool(){
  const pool = document.getElementById('photoPool');
  pool.innerHTML = '';
  state.images.forEach(im => {
    const item = document.createElement('div');
    item.className = 'pool-item';
    const img = document.createElement('img');
    img.src = im.url;
    img.alt = '';
    item.appendChild(img);
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'pool-item-del';
    del.textContent = '×';
    del.addEventListener('click', () => {
      state.images = state.images.filter(x => x.id !== im.id);
      Object.keys(state.cells).forEach(k => {
        if (state.cells[k] && state.cells[k].imageId === im.id) delete state.cells[k];
      });
      URL.revokeObjectURL(im.url);
      renderPool();
      renderAll();
    });
    item.appendChild(del);
    pool.appendChild(item);
  });
}

function openCellFilePicker(i){
  const input = document.getElementById('cellFileInput');
  input.dataset.cellIndex = String(i);
  input.value = '';
  input.click();
}

document.getElementById('cellFileInput').addEventListener('change', function(){
  const idx = parseInt(this.dataset.cellIndex, 10);
  const file = this.files[0];
  if (!file || Number.isNaN(idx)) return;
  addImageFile(file, (id) => {
    state.cells[idx] = { imageId: id, panX: 0, panY: 0, zoom: 1 };
    renderAll();
  });
});

const photoDropzone = document.getElementById('photoDropzone');
const poolFileInput = document.getElementById('poolFileInput');
photoDropzone.addEventListener('click', () => poolFileInput.click());
poolFileInput.addEventListener('change', function(){
  Array.from(this.files).forEach(f => addImageFile(f));
  this.value = '';
});
['dragover', 'dragenter'].forEach(ev => photoDropzone.addEventListener(ev, (e) => {
  e.preventDefault();
  photoDropzone.classList.add('drag');
}));
['dragleave'].forEach(ev => photoDropzone.addEventListener(ev, () => photoDropzone.classList.remove('drag')));
photoDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  photoDropzone.classList.remove('drag');
  Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')).forEach(f => addImageFile(f));
});

// ---------- Isi Otomatis / Acak / Kosongkan ----------
function collectAssignedImageIds(){
  return Object.keys(state.cells)
    .sort((a, b) => a - b)
    .map(k => state.cells[k] && state.cells[k].imageId)
    .filter(Boolean);
}

function autoFillCells(imageIds){
  const usedIds = new Set(collectAssignedImageIds());
  const ids = imageIds || state.images.map(im => im.id).filter(id => !usedIds.has(id));
  let idx = 0;
  state.pattern.forEach((_, i) => {
    if (idx >= ids.length) return;
    if (!state.cells[i] || !state.cells[i].imageId) {
      state.cells[i] = { imageId: ids[idx], panX: 0, panY: 0, zoom: 1 };
      idx++;
    }
  });
}

document.getElementById('autoFillBtn').addEventListener('click', () => {
  autoFillCells();
  renderAll();
});

document.getElementById('shuffleImagesBtn').addEventListener('click', () => {
  const idxs = Object.keys(state.cells).filter(k => state.cells[k] && state.cells[k].imageId);
  const ids = idxs.map(k => state.cells[k].imageId);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  idxs.forEach((k, i) => {
    state.cells[k].imageId = ids[i];
    state.cells[k].panX = 0; state.cells[k].panY = 0; state.cells[k].zoom = 1;
  });
  renderAll();
});

document.getElementById('clearAllBtn').addEventListener('click', () => {
  state.cells = {};
  renderAll();
});

// ---------- Grid Style ----------
// Ganti gaya TANPA mengubah kolom/baris yg lagi diatur user — cuma partisi
// selnya yg berubah, foto yg sudah dipasang dipindah otomatis ke sel-sel baru
// (urutan dipertahankan lewat collectAssignedImageIds()/autoFillCells(), pola
// yg sama dgn `switchTemplate()` versi lama).
function switchStyle(id){
  const assignedIds = collectAssignedImageIds();
  state.styleId = id;
  state.cells = {};
  regeneratePattern();
  autoFillCells(assignedIds);
  renderAll();
}

// Preview mini tiap tombol gaya dibangun dari HASIL NYATA generate() gaya itu
// pakai ukuran contoh 4x3 (bukan gambar/ikon statis terpisah) — supaya
// preview selalu jujur mewakili bentuk yg dihasilkan algoritmanya, bukan
// desain manual yg bisa meleset dari kode aslinya.
const STYLE_PREVIEW_COLS = 4, STYLE_PREVIEW_ROWS = 3;
function buildStylePicker(){
  const wrap = document.getElementById('styleList');
  wrap.innerHTML = '';
  STYLES.forEach(s => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'style-btn';
    btn.dataset.id = s.id;

    const thumb = document.createElement('div');
    thumb.className = 'style-thumb';
    thumb.style.gridTemplateColumns = `repeat(${STYLE_PREVIEW_COLS},1fr)`;
    thumb.style.gridTemplateRows = `repeat(${STYLE_PREVIEW_ROWS},1fr)`;
    s.generate(STYLE_PREVIEW_COLS, STYLE_PREVIEW_ROWS).forEach(cell => {
      const c = document.createElement('div');
      c.className = 'style-thumb-cell';
      c.style.gridColumn = `${cell.colStart} / span ${cell.colSpan}`;
      c.style.gridRow = `${cell.rowStart} / span ${cell.rowSpan}`;
      thumb.appendChild(c);
    });

    const name = document.createElement('div');
    name.className = 'style-name';
    name.textContent = s.label;

    btn.appendChild(thumb);
    btn.appendChild(name);
    btn.addEventListener('click', () => switchStyle(s.id));
    wrap.appendChild(btn);
  });
  refreshStyleActive();
}

function refreshStyleActive(){
  document.querySelectorAll('.style-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.id === state.styleId);
  });
}

document.getElementById('regeneratePatternBtn').addEventListener('click', () => {
  const assignedIds = collectAssignedImageIds();
  state.cells = {};
  regeneratePattern();
  autoFillCells(assignedIds);
  renderAll();
  if (getActiveStyle().deterministic) {
    showToast('Gaya ini tetap sama tiap "Acak" (bukan acak) — coba ganti Grid Style utk variasi lain');
  }
});

// ---------- Grid Layout (kolom x baris) ----------
const colsRange = document.getElementById('colsRange'), colsInput = document.getElementById('colsInput');
const rowsRange = document.getElementById('rowsRange'), rowsInput = document.getElementById('rowsInput');
const linkToggleBtn = document.getElementById('linkToggleBtn');

function syncLayoutInputs(){
  colsRange.value = state.layoutCols; colsInput.value = state.layoutCols;
  rowsRange.value = state.layoutRows; rowsInput.value = state.layoutRows;
}

function setLayout(cols, rows){
  state.layoutCols = clamp(cols, 2, 8);
  state.layoutRows = clamp(rows, 2, 8);
  syncLayoutInputs();
  const assignedIds = collectAssignedImageIds();
  state.cells = {};
  regeneratePattern();
  autoFillCells(assignedIds);
  renderAll();
}

colsRange.addEventListener('input', () => {
  const c = parseInt(colsRange.value, 10);
  setLayout(c, state.linkColsRows ? c : state.layoutRows);
});
rowsRange.addEventListener('input', () => {
  const r = parseInt(rowsRange.value, 10);
  setLayout(state.linkColsRows ? r : state.layoutCols, r);
});
colsInput.addEventListener('change', () => {
  const c = parseInt(colsInput.value, 10) || state.layoutCols;
  setLayout(c, state.linkColsRows ? c : state.layoutRows);
});
rowsInput.addEventListener('change', () => {
  const r = parseInt(rowsInput.value, 10) || state.layoutRows;
  setLayout(state.linkColsRows ? r : state.layoutCols, r);
});

linkToggleBtn.addEventListener('click', () => {
  state.linkColsRows = !state.linkColsRows;
  linkToggleBtn.classList.toggle('active', state.linkColsRows);
  linkToggleBtn.setAttribute('aria-pressed', String(state.linkColsRows));
  if (state.linkColsRows && state.layoutCols !== state.layoutRows) {
    setLayout(state.layoutCols, state.layoutCols);
  }
});

document.getElementById('randomLayoutBtn').addEventListener('click', () => {
  const c = 2 + Math.floor(Math.random() * 7);
  const r = state.linkColsRows ? c : 2 + Math.floor(Math.random() * 7);
  setLayout(c, r);
});

// "Kejutkan Aku": acak gaya + tata letak sekaligus dlm satu klik — beda dari
// "Acak Pola" (regeneratePatternBtn, gaya tetap) & "Acak Tata Letak"
// (randomLayoutBtn, gaya tetap) yg masing-masing cuma acak satu aspek.
document.getElementById('surpriseBtn').addEventListener('click', () => {
  const pick = STYLES[Math.floor(Math.random() * STYLES.length)];
  const c = 2 + Math.floor(Math.random() * 7);
  const r = state.linkColsRows ? c : 2 + Math.floor(Math.random() * 7);
  const assignedIds = collectAssignedImageIds();
  state.styleId = pick.id;
  state.layoutCols = clamp(c, 2, 8);
  state.layoutRows = clamp(r, 2, 8);
  syncLayoutInputs();
  state.cells = {};
  regeneratePattern();
  autoFillCells(assignedIds);
  renderAll();
});

// ---------- Dimensi ----------
const canvasWInput = document.getElementById('canvasW');
const canvasHInput = document.getElementById('canvasH');
canvasWInput.value = state.canvasW;
canvasHInput.value = state.canvasH;

function buildDimPresets(){
  const wrap = document.getElementById('dimPresets');
  wrap.innerHTML = '';
  DIM_PRESETS.forEach(p => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dim-preset-btn';
    btn.textContent = p.label;
    btn.dataset.w = p.w;
    btn.dataset.h = p.h;
    btn.addEventListener('click', () => {
      state.canvasW = p.w; state.canvasH = p.h;
      canvasWInput.value = p.w; canvasHInput.value = p.h;
      renderAll();
    });
    wrap.appendChild(btn);
  });
  refreshDimActive();
}

function refreshDimActive(){
  document.querySelectorAll('.dim-preset-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.w, 10) === state.canvasW && parseInt(b.dataset.h, 10) === state.canvasH);
  });
}

function onDimInput(){
  state.canvasW = clamp(parseInt(canvasWInput.value, 10) || state.canvasW, 200, 4000);
  state.canvasH = clamp(parseInt(canvasHInput.value, 10) || state.canvasH, 200, 4000);
  canvasWInput.value = state.canvasW;
  canvasHInput.value = state.canvasH;
  renderAll();
}
canvasWInput.addEventListener('change', onDimInput);
canvasHInput.addEventListener('change', onDimInput);

// ---------- Slider: jarak / radius / padding ----------
const gapRange = document.getElementById('gapRange'), gapValue = document.getElementById('gapValue');
gapRange.addEventListener('input', () => {
  state.gap = parseInt(gapRange.value, 10);
  gapValue.textContent = state.gap + 'px';
  renderAll();
});

const radiusRange = document.getElementById('radiusRange'), radiusValue = document.getElementById('radiusValue');
radiusRange.addEventListener('input', () => {
  state.radius = parseInt(radiusRange.value, 10);
  radiusValue.textContent = state.radius + 'px';
  renderCanvas();
});

const paddingRange = document.getElementById('paddingRange'), paddingValue = document.getElementById('paddingValue');
paddingRange.addEventListener('input', () => {
  state.padding = parseInt(paddingRange.value, 10);
  paddingValue.textContent = state.padding + 'px';
  renderAll();
});

// ---------- Warna latar / celah ----------
const gapColorPicker = document.getElementById('gapColorPicker');
const gapColorHex = document.getElementById('gapColorHex');
gapColorPicker.addEventListener('input', () => {
  state.gapColor = gapColorPicker.value.toUpperCase();
  gapColorHex.value = state.gapColor;
  gapColorHex.classList.remove('invalid');
  renderCanvas();
});
gapColorHex.addEventListener('input', () => {
  let v = gapColorHex.value.trim();
  if (!v.startsWith('#')) v = '#' + v;
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
    gapColorHex.classList.remove('invalid');
    state.gapColor = v.toUpperCase();
    gapColorPicker.value = v;
    renderCanvas();
  } else {
    gapColorHex.classList.add('invalid');
  }
});

// ---------- Unduh ----------
let exportFormat = 'png';
const formatTabs = document.querySelectorAll('.format-tab');
formatTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    formatTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    exportFormat = tab.dataset.format;
    document.getElementById('qualityRow').hidden = exportFormat !== 'jpeg';
  });
});

const qualityRange = document.getElementById('qualityRange');
const qualityValue = document.getElementById('qualityValue');
qualityRange.addEventListener('input', () => {
  qualityValue.textContent = qualityRange.value + '%';
});

let toastTimer = null;
function showToast(msg){
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1600);
}

document.getElementById('downloadBtn').addEventListener('click', () => {
  try {
    renderCanvas();
    const mime = exportFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
    const quality = exportFormat === 'jpeg' ? (parseInt(qualityRange.value, 10) / 100) : undefined;
    canvas.toBlob((blob) => {
      if (!blob) { alert('Gagal membuat gambar. Coba lagi.'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bento-image.' + (exportFormat === 'jpeg' ? 'jpg' : 'png');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast('Gambar berhasil diunduh');
    }, mime, quality);
  } catch (err) {
    console.error('Gagal mengunduh gambar:', err);
    alert('Gagal mengunduh gambar. Coba lagi.');
  }
});

// ---------- INIT ----------
syncLayoutInputs();
regeneratePattern();
buildStylePicker();
buildDimPresets();
renderAll();
