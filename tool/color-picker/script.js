pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

// ---------- THEME ----------
// Preference stored under its own key, independent from every other
// page/app in this repo (same pattern as e.g. noteapp_theme vs
// financeapp_theme) — deliberately not shared even across tool/ pages.
(function initTheme(){
  const STORAGE_KEY = 'colorpicker_theme';
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

// Longest side (px) the working canvas is capped to. Sampling/clicking both
// happen against this same canvas, so this is a display-quality vs.
// performance tradeoff, not an accuracy compromise — whatever is on screen
// is exactly what gets read.
const MAX_DIM = 900;

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const pageNav = document.getElementById('pageNav');
const pageNavLabel = document.getElementById('pageNavLabel');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const canvasPanel = document.getElementById('canvasPanel');
const canvasWrap = document.getElementById('canvasWrap');
const pixelInfo = document.getElementById('pixelInfo');
const dominantPanel = document.getElementById('dominantPanel');
const dominantGrid = document.getElementById('dominantGrid');
const toastEl = document.getElementById('toast');

let pdfDoc = null;
let currentPdfPage = 1;

// ---------- UTIL ----------
function rgbToHex(r,g,b){
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('').toUpperCase();
}
function colorDistance(a,b){
  const dr=a.r-b.r, dg=a.g-b.g, db=a.b-b.b;
  return Math.sqrt(dr*dr + dg*dg + db*db);
}
let toastTimer = null;
function showToast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> toastEl.classList.remove('show'), 1600);
}
async function copyText(text){
  try{
    await navigator.clipboard.writeText(text);
    showToast('Disalin: ' + text);
    return;
  }catch(err){
    // Clipboard API can be unavailable (insecure origin, older browser,
    // permission denied) — fall back to the legacy selection+execCommand
    // path instead of failing with nothing visible to the user.
  }
  try{
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Disalin: ' + text);
  }catch(err2){
    showToast('Gagal menyalin');
  }
}

// ---------- DOMINANT COLOR EXTRACTION ----------
// Quantizes every sampled pixel to a coarse 4-bit-per-channel bucket, tallies
// the most frequent buckets, then greedily keeps the most frequent ones that
// are also visually distinct from what's already picked — otherwise a photo
// with one large smooth gradient (e.g. sky) would fill most/all 9 slots with
// near-identical shades of the same color.
function extractDominantColors(ctx, w, h, count){
  const totalPixels = w*h;
  const maxSamples = 220000;
  const stride = Math.max(1, Math.floor(Math.sqrt(totalPixels/maxSamples)));
  const data = ctx.getImageData(0, 0, w, h).data;

  const BITS = 4;
  const buckets = new Map();
  for(let y=0; y<h; y+=stride){
    for(let x=0; x<w; x+=stride){
      const idx = (y*w + x) * 4;
      if(data[idx+3] < 16) continue; // skip near-transparent pixels
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      const key = (r>>(8-BITS))<<(BITS*2) | (g>>(8-BITS))<<BITS | (b>>(8-BITS));
      let bucket = buckets.get(key);
      if(!bucket){ bucket = {count:0, r:0, g:0, b:0}; buckets.set(key, bucket); }
      bucket.count++; bucket.r += r; bucket.g += g; bucket.b += b;
    }
  }

  const sorted = [...buckets.values()]
    .map(b => ({ count:b.count, r:Math.round(b.r/b.count), g:Math.round(b.g/b.count), b:Math.round(b.b/b.count) }))
    .sort((a,b) => b.count - a.count);

  const MIN_DIST = 28;
  const picked = [];
  for(const c of sorted){
    if(picked.length >= count) break;
    if(!picked.some(p => colorDistance(p, c) < MIN_DIST)) picked.push(c);
  }
  // Diversity filtering can leave us short on a low-variety image (e.g. a
  // near-solid color) — top up with whatever's left, closest-first, rather
  // than returning fewer than requested.
  if(picked.length < count){
    for(const c of sorted){
      if(picked.length >= count) break;
      if(!picked.includes(c)) picked.push(c);
    }
  }
  return picked.slice(0, count);
}

function renderDominantGrid(colors){
  dominantGrid.innerHTML = colors.map(c => {
    const hex = rgbToHex(c.r, c.g, c.b);
    const rgbStr = 'rgb(' + c.r + ', ' + c.g + ', ' + c.b + ')';
    return '<button type="button" class="swatch" data-hex="' + hex + '">' +
      '<div class="swatch-color" style="background:' + hex + '"></div>' +
      '<div class="swatch-meta">' +
        '<p class="swatch-hex">' + hex + '</p>' +
        '<p class="swatch-rgb">' + rgbStr + '</p>' +
      '</div>' +
    '</button>';
  }).join('');
  dominantGrid.querySelectorAll('.swatch').forEach(btn => {
    btn.addEventListener('click', () => copyText(btn.dataset.hex));
  });
}

// ---------- PIXEL INSPECTOR ----------
function updatePixelInfo(r, g, b, clickX, clickY, rect){
  const hex = rgbToHex(r, g, b);
  const rgbStr = 'rgb(' + r + ', ' + g + ', ' + b + ')';
  pixelInfo.innerHTML =
    '<div class="pixel-swatch" style="background:' + hex + '"></div>' +
    '<div class="pixel-values">' +
      '<div class="value-row"><span class="value-label">HEX</span><span>' + hex + '</span>' +
        '<button type="button" class="copy-btn" data-copy="' + hex + '">Salin</button></div>' +
      '<div class="value-row"><span class="value-label">RGB</span><span>' + rgbStr + '</span>' +
        '<button type="button" class="copy-btn" data-copy="' + rgbStr + '">Salin</button></div>' +
    '</div>';
  pixelInfo.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => copyText(btn.dataset.copy));
  });

  let marker = canvasWrap.querySelector('.pixel-marker');
  if(!marker){
    marker = document.createElement('div');
    marker.className = 'pixel-marker';
    canvasWrap.appendChild(marker);
  }
  marker.style.left = (clickX/rect.width*100) + '%';
  marker.style.top = (clickY/rect.height*100) + '%';
}

// ---------- CANVAS SETUP ----------
function computeWorkingSize(srcW, srcH){
  const scale = Math.min(1, MAX_DIM / Math.max(srcW, srcH));
  return { w: Math.max(1, Math.round(srcW*scale)), h: Math.max(1, Math.round(srcH*scale)) };
}
function createWorkingCanvas(w, h){
  canvasWrap.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvasWrap.appendChild(canvas);
  return canvas;
}
function onCanvasReady(canvas, ctx){
  canvasPanel.hidden = false;
  dominantPanel.hidden = false;
  pixelInfo.innerHTML = '<p class="empty-hint">Klik di mana saja pada gambar untuk melihat warnanya.</p>';

  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width/rect.width, scaleY = canvas.height/rect.height;
    const cx = Math.min(canvas.width-1, Math.max(0, Math.floor((e.clientX-rect.left)*scaleX)));
    const cy = Math.min(canvas.height-1, Math.max(0, Math.floor((e.clientY-rect.top)*scaleY)));
    const data = ctx.getImageData(cx, cy, 1, 1).data;
    updatePixelInfo(data[0], data[1], data[2], e.clientX-rect.left, e.clientY-rect.top, rect);
  });

  try{
    const colors = extractDominantColors(ctx, canvas.width, canvas.height, 9);
    renderDominantGrid(colors);
  }catch(err){
    console.error('Gagal menghitung warna dominan:', err);
    dominantGrid.innerHTML = '<p class="empty-hint">Gagal menghitung warna dominan untuk gambar ini.</p>';
  }
}

// ---------- LOAD: IMAGE ----------
async function loadImageFile(file){
  let url;
  try{
    url = URL.createObjectURL(file);
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('image-load-failed'));
      im.src = url;
    });
    const { w, h } = computeWorkingSize(img.naturalWidth, img.naturalHeight);
    const canvas = createWorkingCanvas(w, h);
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    pdfDoc = null;
    pageNav.hidden = true;
    onCanvasReady(canvas, canvas.getContext('2d'));
  }catch(err){
    console.error('Gagal memuat gambar:', err);
    alert('Gagal memuat gambar. Pastikan berkasnya adalah gambar yang valid.');
  }finally{
    if(url) URL.revokeObjectURL(url);
  }
}

// ---------- LOAD: PDF ----------
async function loadPdfFile(file){
  try{
    const buf = await file.arrayBuffer();
    pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
    currentPdfPage = 1;
    await renderPdfPage();
  }catch(err){
    console.error('Gagal memuat PDF:', err);
    pdfDoc = null;
    alert('Gagal memuat berkas PDF. Pastikan berkasnya tidak rusak atau terenkripsi.');
  }
}
async function renderPdfPage(){
  if(!pdfDoc) return;
  try{
    const page = await pdfDoc.getPage(currentPdfPage);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(1, MAX_DIM / Math.max(baseViewport.width, baseViewport.height));
    const viewport = page.getViewport({ scale });
    const canvas = createWorkingCanvas(Math.round(viewport.width), Math.round(viewport.height));
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    pageNav.hidden = pdfDoc.numPages <= 1;
    pageNavLabel.textContent = 'Halaman ' + currentPdfPage + '/' + pdfDoc.numPages;
    prevPageBtn.disabled = currentPdfPage <= 1;
    nextPageBtn.disabled = currentPdfPage >= pdfDoc.numPages;

    onCanvasReady(canvas, ctx);
  }catch(err){
    console.error('Gagal merender halaman PDF:', err);
    alert('Gagal menampilkan halaman PDF ini.');
  }
}
prevPageBtn.addEventListener('click', () => {
  if(!pdfDoc || currentPdfPage <= 1) return;
  currentPdfPage--; renderPdfPage();
});
nextPageBtn.addEventListener('click', () => {
  if(!pdfDoc || currentPdfPage >= pdfDoc.numPages) return;
  currentPdfPage++; renderPdfPage();
});

// ---------- FILE INTAKE ----------
function isImageFile(file){
  return file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name);
}
function isPdfFile(file){
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}
function handleFile(file){
  if(isPdfFile(file)) loadPdfFile(file);
  else if(isImageFile(file)) loadImageFile(file);
  else alert('Format berkas tidak didukung. Unggah gambar (PNG/JPG/dst) atau PDF.');
}

dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => {
  if(e.target.files.length) handleFile(e.target.files[0]);
  fileInput.value = '';
});
['dragover'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add('drag'); }));
['dragleave','drop'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove('drag'); }));
dropzone.addEventListener('drop', e => {
  if(e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
