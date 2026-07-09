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

// ---------- GRID TEMPLATES ----------
// Tiap template mempartisi grid dasar (cols x rows) jadi beberapa sel bento
// tanpa celah/tumpang tindih (setiap unit base grid tercakup persis sekali).
// colStart/rowStart 1-indexed, colSpan/rowSpan = jumlah unit yang dicakup.
const TEMPLATES = [
  { id:'fokus-kiri', label:'Fokus Kiri', cols:3, rows:2, cells:[
    { colStart:1, colSpan:2, rowStart:1, rowSpan:2 },
    { colStart:3, colSpan:1, rowStart:1, rowSpan:1 },
    { colStart:3, colSpan:1, rowStart:2, rowSpan:1 },
  ]},
  { id:'fokus-kanan', label:'Fokus Kanan', cols:3, rows:2, cells:[
    { colStart:1, colSpan:1, rowStart:1, rowSpan:1 },
    { colStart:1, colSpan:1, rowStart:2, rowSpan:1 },
    { colStart:2, colSpan:2, rowStart:1, rowSpan:2 },
  ]},
  { id:'fokus-atas', label:'Fokus Atas', cols:2, rows:3, cells:[
    { colStart:1, colSpan:2, rowStart:1, rowSpan:1 },
    { colStart:1, colSpan:1, rowStart:2, rowSpan:2 },
    { colStart:2, colSpan:1, rowStart:2, rowSpan:1 },
    { colStart:2, colSpan:1, rowStart:3, rowSpan:1 },
  ]},
  { id:'kuadran', label:'Kuadran', cols:2, rows:2, cells:[
    { colStart:1, colSpan:1, rowStart:1, rowSpan:1 },
    { colStart:2, colSpan:1, rowStart:1, rowSpan:1 },
    { colStart:1, colSpan:1, rowStart:2, rowSpan:1 },
    { colStart:2, colSpan:1, rowStart:2, rowSpan:1 },
  ]},
  { id:'mozaik', label:'Mozaik', cols:4, rows:3, cells:[
    { colStart:1, colSpan:2, rowStart:1, rowSpan:2 },
    { colStart:3, colSpan:1, rowStart:1, rowSpan:1 },
    { colStart:4, colSpan:1, rowStart:1, rowSpan:1 },
    { colStart:3, colSpan:1, rowStart:2, rowSpan:1 },
    { colStart:4, colSpan:1, rowStart:2, rowSpan:1 },
    { colStart:1, colSpan:4, rowStart:3, rowSpan:1 },
  ]},
  { id:'piramida', label:'Piramida', cols:3, rows:3, cells:[
    { colStart:1, colSpan:3, rowStart:1, rowSpan:1 },
    { colStart:1, colSpan:2, rowStart:2, rowSpan:2 },
    { colStart:3, colSpan:1, rowStart:2, rowSpan:1 },
    { colStart:3, colSpan:1, rowStart:3, rowSpan:1 },
  ]},
  { id:'sudut', label:'Sudut', cols:4, rows:3, cells:[
    { colStart:1, colSpan:1, rowStart:1, rowSpan:1 },
    { colStart:2, colSpan:3, rowStart:1, rowSpan:2 },
    { colStart:1, colSpan:1, rowStart:2, rowSpan:2 },
    { colStart:2, colSpan:1, rowStart:3, rowSpan:1 },
    { colStart:3, colSpan:1, rowStart:3, rowSpan:1 },
    { colStart:4, colSpan:1, rowStart:3, rowSpan:1 },
  ]},
  { id:'kolom-rata', label:'Kolom Rata', cols:4, rows:1, cells:[
    { colStart:1, colSpan:1, rowStart:1, rowSpan:1 },
    { colStart:2, colSpan:1, rowStart:1, rowSpan:1 },
    { colStart:3, colSpan:1, rowStart:1, rowSpan:1 },
    { colStart:4, colSpan:1, rowStart:1, rowSpan:1 },
  ]},
  { id:'baris-rata', label:'Baris Rata', cols:1, rows:4, cells:[
    { colStart:1, colSpan:1, rowStart:1, rowSpan:1 },
    { colStart:1, colSpan:1, rowStart:2, rowSpan:1 },
    { colStart:1, colSpan:1, rowStart:3, rowSpan:1 },
    { colStart:1, colSpan:1, rowStart:4, rowSpan:1 },
  ]},
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
  templateId: TEMPLATES[0].id,
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
function getActiveTemplate(){ return TEMPLATES.find(t => t.id === state.templateId) || TEMPLATES[0]; }

// ---------- GEOMETRY ----------
function computeCellRects(){
  const t = getActiveTemplate();
  const W = state.canvasW, H = state.canvasH;
  const pad = state.padding, gap = state.gap;
  const innerW = W - pad * 2, innerH = H - pad * 2;
  const colW = (innerW - gap * (t.cols - 1)) / t.cols;
  const rowH = (innerH - gap * (t.rows - 1)) / t.rows;
  return t.cells.map(cell => {
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
  refreshTemplateActive();
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
  const t = getActiveTemplate();
  const usedIds = new Set(collectAssignedImageIds());
  const ids = imageIds || state.images.map(im => im.id).filter(id => !usedIds.has(id));
  let idx = 0;
  t.cells.forEach((_, i) => {
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

// ---------- Gaya grid ----------
function switchTemplate(id){
  const assignedIds = collectAssignedImageIds();
  state.templateId = id;
  state.cells = {};
  autoFillCells(assignedIds);
  renderAll();
}

function buildTemplatePicker(){
  const wrap = document.getElementById('templateGrid');
  wrap.innerHTML = '';
  TEMPLATES.forEach(t => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'template-btn';
    btn.dataset.id = t.id;

    const thumb = document.createElement('div');
    thumb.className = 'template-thumb';
    thumb.style.gridTemplateColumns = `repeat(${t.cols},1fr)`;
    thumb.style.gridTemplateRows = `repeat(${t.rows},1fr)`;
    t.cells.forEach(cell => {
      const c = document.createElement('div');
      c.className = 'template-thumb-cell';
      c.style.gridColumn = `${cell.colStart} / span ${cell.colSpan}`;
      c.style.gridRow = `${cell.rowStart} / span ${cell.rowSpan}`;
      thumb.appendChild(c);
    });

    const name = document.createElement('div');
    name.className = 'template-name';
    name.textContent = t.label;

    btn.appendChild(thumb);
    btn.appendChild(name);
    btn.addEventListener('click', () => switchTemplate(t.id));
    wrap.appendChild(btn);
  });
  refreshTemplateActive();
}

function refreshTemplateActive(){
  document.querySelectorAll('.template-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.id === state.templateId);
  });
}

document.getElementById('shuffleTemplateBtn').addEventListener('click', () => {
  const others = TEMPLATES.filter(t => t.id !== state.templateId);
  const pick = others[Math.floor(Math.random() * others.length)];
  switchTemplate(pick.id);
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
buildTemplatePicker();
buildDimPresets();
renderAll();
