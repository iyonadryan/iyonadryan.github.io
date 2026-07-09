pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;

// Font choices use the PDF "standard 14" fonts, which every PDF viewer can
// render without needing any embedded font file — reliable with zero network
// dependency at export time. Each maps to the closest system font for an
// accurate on-screen preview.
const FONT_OPTIONS = {
  Helvetica:        { label:'Sans (Helvetica)',     std: StandardFonts.Helvetica,        css:"Arial, Helvetica, sans-serif",              weight:'normal', style:'normal' },
  HelveticaBold:    { label:'Sans Tebal',            std: StandardFonts.HelveticaBold,    css:"Arial, Helvetica, sans-serif",              weight:'bold',   style:'normal' },
  HelveticaOblique: { label:'Sans Miring',           std: StandardFonts.HelveticaOblique, css:"Arial, Helvetica, sans-serif",              weight:'normal', style:'italic' },
  TimesRoman:       { label:'Serif (Times)',         std: StandardFonts.TimesRoman,       css:"'Times New Roman', Times, serif",           weight:'normal', style:'normal' },
  TimesRomanBold:   { label:'Serif Tebal',           std: StandardFonts.TimesRomanBold,   css:"'Times New Roman', Times, serif",           weight:'bold',   style:'normal' },
  TimesRomanItalic: { label:'Serif Miring',          std: StandardFonts.TimesRomanItalic, css:"'Times New Roman', Times, serif",           weight:'normal', style:'italic' },
  Courier:          { label:'Monospace (Courier)',   std: StandardFonts.Courier,          css:"'Courier New', Courier, monospace",         weight:'normal', style:'normal' },
  CourierBold:      { label:'Monospace Tebal',       std: StandardFonts.CourierBold,      css:"'Courier New', Courier, monospace",         weight:'bold',   style:'normal' },
};
let embeddedFontCache = {};

// ---------- STATE ----------
let workingPdfDoc = null;      // pdf-lib PDFDocument (live, editable)
let pdfjsDoc = null;           // pdf.js document (for rendering, rebuilt after each mutation)
let currentPageIndex = 0;
// overlaysByPage: { pageIndex: [ {id,type,xPct,yPct,wPct,hPct,text,fontSize,color,fontFamily,dataUrl} ] }
// xPct/yPct is always the top-left corner of the overlay box, as a fraction
// of the page's width/height — the SAME convention used both on screen (CSS
// left/top %) and when baking into the PDF, so there is exactly one source
// of truth for position (see renderOverlayEl() and bakeOverlays()).
// For text overlays, fontSize is stored in PDF points (the unit baked into
// the file), never in on-screen pixels — renderOverlayEl() is the only place
// that converts it to CSS px, by multiplying by the current render scale.
// This is what keeps the preview and the baked PDF in sync regardless of
// zoom level, window size, or which page/scale was active when the text was
// first placed (previously a frozen "scale at creation" was used instead,
// which drifted out of sync with the live preview scale and caused text to
// land in the wrong place once applied).
let overlaysByPage = {};
let currentTool = 'select';
let selectedPages = new Set();
let history = [];              // stack of Uint8Array snapshots for undo
let ovIdCounter = 1;
let currentRenderScale = 1;    // px-per-PDF-point scale of the current stage render
let currentOverlayLayerEl = null;

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const thumbsEl = document.getElementById('thumbs');
const stageArea = document.getElementById('stageArea');
const propPanel = document.getElementById('propPanel');
const formPanel = document.getElementById('formPanel');
const formFieldsEl = document.getElementById('formFields');

// ---------- UTIL ----------
function hexToRgb01(hex){
  const h = hex.replace('#','');
  const r = parseInt(h.substring(0,2),16)/255;
  const g = parseInt(h.substring(2,4),16)/255;
  const b = parseInt(h.substring(4,6),16)/255;
  return rgb(r,g,b);
}
function dataUrlToBytes(dataUrl){
  const base64 = dataUrl.split(',')[1];
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function downloadBytes(bytes, filename){
  const blob = new Blob([bytes], {type:'application/pdf'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function isPdfFile(file){
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

// ---------- LOADING / MERGING ----------
async function handleFiles(fileList){
  const snapshotDoc = workingPdfDoc;
  try{
    for(const file of fileList){
      const buf = await file.arrayBuffer();
      if(!workingPdfDoc){
        workingPdfDoc = await PDFDocument.load(buf, {ignoreEncryption:true});
      } else {
        const src = await PDFDocument.load(buf, {ignoreEncryption:true});
        const copied = await workingPdfDoc.copyPages(src, src.getPageIndices());
        copied.forEach(p => workingPdfDoc.addPage(p));
      }
    }
  }catch(err){
    console.error('Gagal memuat PDF:', err);
    workingPdfDoc = snapshotDoc; // jangan tinggalkan state setengah-dimuat
    alert('Gagal memuat berkas PDF. Pastikan berkasnya tidak rusak dan bukan PDF terenkripsi dengan proteksi yang tidak didukung.');
    return;
  }
  currentPageIndex = 0;
  overlaysByPage = {};
  history = [];
  await pushHistory();
  await refreshAll();
}

dropzone.addEventListener('click', ()=>fileInput.click());
fileInput.addEventListener('change', e=>{
  const files = Array.from(e.target.files).filter(isPdfFile);
  if(files.length) handleFiles(files);
  else if(e.target.files.length) alert('Hanya berkas PDF yang didukung.');
  fileInput.value='';
});
['dragover'].forEach(evt=>dropzone.addEventListener(evt, e=>{ e.preventDefault(); dropzone.classList.add('drag'); }));
['dragleave','drop'].forEach(evt=>dropzone.addEventListener(evt, e=>{ e.preventDefault(); dropzone.classList.remove('drag'); }));
dropzone.addEventListener('drop', e=>{
  const files = Array.from(e.dataTransfer.files).filter(isPdfFile);
  if(files.length) handleFiles(files);
  else if(e.dataTransfer.files.length) alert('Hanya berkas PDF yang didukung.');
});

// ---------- HISTORY ----------
async function pushHistory(){
  const bytes = await workingPdfDoc.save();
  history.push(bytes);
  if(history.length > 12) history.shift();
  return bytes;
}
document.getElementById('undoBtn').addEventListener('click', async ()=>{
  if(history.length < 2) return;
  history.pop();
  const prev = history[history.length-1];
  workingPdfDoc = await PDFDocument.load(prev);
  overlaysByPage = {};
  embeddedFontCache = {};
  await refreshAll();
});

// ---------- REFRESH / RENDER ----------
async function refreshAll(){
  const bytes = await workingPdfDoc.save();
  pdfjsDoc = await pdfjsLib.getDocument({data: bytes}).promise;
  if(currentPageIndex >= pdfjsDoc.numPages) currentPageIndex = pdfjsDoc.numPages-1;
  await renderThumbs();
  await renderStage();
  await refreshFormPanel();
}

async function renderThumbs(){
  thumbsEl.innerHTML = '';
  for(let i=0;i<pdfjsDoc.numPages;i++){
    const page = await pdfjsDoc.getPage(i+1);
    const viewport = page.getViewport({scale: 0.28});
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({canvasContext: ctx, viewport}).promise;

    const wrap = document.createElement('div');
    wrap.className = 'thumb' + (i===currentPageIndex ? ' active' : '');
    wrap.appendChild(canvas);

    const cb = document.createElement('input');
    cb.type='checkbox';
    cb.checked = selectedPages.has(i);
    cb.addEventListener('click', e=>e.stopPropagation());
    cb.addEventListener('change', ()=>{ cb.checked ? selectedPages.add(i) : selectedPages.delete(i); });
    wrap.appendChild(cb);

    const meta = document.createElement('div');
    meta.className='meta';
    meta.innerHTML = `<span class="pagenum">Hal ${i+1}</span>`;
    const actions = document.createElement('div');
    actions.className='actions';
    actions.innerHTML = `
      <button class="iconbtn" title="Naik" data-act="up">↑</button>
      <button class="iconbtn" title="Turun" data-act="down">↓</button>
      <button class="iconbtn" title="Putar" data-act="rot">⟳</button>
      <button class="iconbtn" title="Hapus" data-act="del">✕</button>`;
    meta.appendChild(actions);
    wrap.appendChild(meta);

    wrap.addEventListener('click', ()=>{ currentPageIndex = i; renderThumbs(); renderStage(); });
    actions.querySelector('[data-act=up]').addEventListener('click', e=>{ e.stopPropagation(); movePage(i,-1); });
    actions.querySelector('[data-act=down]').addEventListener('click', e=>{ e.stopPropagation(); movePage(i,1); });
    actions.querySelector('[data-act=rot]').addEventListener('click', e=>{ e.stopPropagation(); rotatePage(i); });
    actions.querySelector('[data-act=del]').addEventListener('click', e=>{ e.stopPropagation(); deletePages([i]); });

    thumbsEl.appendChild(wrap);
  }
}

let renderToken = 0;
async function renderStage(){
  if(!pdfjsDoc){ return; }
  const myToken = ++renderToken;
  const page = await pdfjsDoc.getPage(currentPageIndex+1);
  const containerWidth = Math.min(720, stageArea.parentElement.clientWidth - 40);
  const baseViewport = page.getViewport({scale:1});
  const scale = containerWidth / baseViewport.width;
  const viewport = page.getViewport({scale});
  if(myToken !== renderToken) return;

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width; canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await page.render({canvasContext: ctx, viewport}).promise;
  if(myToken !== renderToken) return;

  stageArea.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'page-wrap';
  wrap.style.width = viewport.width+'px';
  wrap.style.height = viewport.height+'px';
  wrap.appendChild(canvas);

  const overlayLayer = document.createElement('div');
  overlayLayer.className = 'overlay-layer';
  wrap.appendChild(overlayLayer);
  stageArea.appendChild(wrap);

  currentRenderScale = scale;
  currentOverlayLayerEl = overlayLayer;

  overlayLayer.addEventListener('click', e=>{
    if(e.target !== overlayLayer) return;
    if(currentTool === 'text'){
      const rect = overlayLayer.getBoundingClientRect();
      const xPct = (e.clientX - rect.left)/rect.width;
      const yPct = (e.clientY - rect.top)/rect.height;
      addTextOverlay(xPct, yPct);
      // Balik ke alat "Pilih" setelah menaruh satu kotak teks — kalau tetap
      // di mode "+ Teks", klik berikutnya di dekat teks yang baru (mis. saat
      // mencoba mengedit isinya) bisa jatuh di area kosong overlay-layer dan
      // membuat kotak teks BARU lagi tanpa sengaja alih-alih mengedit yang
      // sudah ada. Ini yang terlihat seperti "nambah teks jadi ngebug".
      setTool('select');
    }
  });

  const list = overlaysByPage[currentPageIndex] || [];
  list.forEach(ov => renderOverlayEl(ov, overlayLayer, currentRenderScale));
}

// Rebuilds only the overlay elements (text/signature) on top of the current
// page render, without re-rendering the PDF.js canvas itself. This keeps the
// displayed scale stable while editing font size/color/position, so text no
// longer appears to shrink or jump after being applied.
function refreshOverlayLayer(){
  if(!currentOverlayLayerEl) return;
  currentOverlayLayerEl.innerHTML = '';
  const list = overlaysByPage[currentPageIndex] || [];
  list.forEach(ov => renderOverlayEl(ov, currentOverlayLayerEl, currentRenderScale));
}
window.addEventListener('resize', ()=>{ if(pdfjsDoc) renderStage(); });

// ---------- OVERLAYS ----------
function setTool(tool){
  currentTool = tool;
  document.querySelectorAll('.tool-btn[data-tool]').forEach(b=>{
    b.classList.toggle('active', b.dataset.tool === tool);
  });
}
document.querySelectorAll('.tool-btn[data-tool]').forEach(btn=>{
  btn.addEventListener('click', ()=> setTool(btn.dataset.tool));
});

function addTextOverlay(xPct,yPct){
  // fontSize is in PDF points from the moment the overlay is created — see
  // the note on overlaysByPage above for why.
  const ov = { id: 'ov'+(ovIdCounter++), type:'text', xPct, yPct, text:'Teks baru', fontSize:16, color:'#1a1a1a', fontFamily:'Helvetica' };
  if(!overlaysByPage[currentPageIndex]) overlaysByPage[currentPageIndex]=[];
  overlaysByPage[currentPageIndex].push(ov);
  refreshOverlayLayer();

  // Langsung fokuskan & pilih semua isi placeholder ("Teks baru") di kotak
  // yang baru dibuat, supaya user bisa langsung mengetik menimpanya tanpa
  // perlu klik dulu — juga alasan tool otomatis balik ke "Pilih" di atas.
  const newTextEl = currentOverlayLayerEl && currentOverlayLayerEl.querySelector('[data-ov-id="'+ov.id+'"] .ov-text');
  if(newTextEl){
    newTextEl.focus();
    const range = document.createRange();
    range.selectNodeContents(newTextEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  showTextProps(ov);
}

// `scale` converts the canonical fontSize (stored in PDF points, the same
// unit used when baking text into the PDF) into on-screen CSS pixels for the
// current zoom level of the page render, so the preview matches the final PDF.
function renderOverlayEl(ov, layer, scale){
  scale = scale || 1;
  const el = document.createElement('div');
  el.className = 'ov-item' + (ov.type==='img' ? ' img' : '');
  el.dataset.ovId = ov.id;
  el.style.left = (ov.xPct*100)+'%';
  el.style.top = (ov.yPct*100)+'%';

  if(ov.type==='text'){
    const txt = document.createElement('div');
    txt.className='ov-text';
    txt.contentEditable = true;
    const fo = FONT_OPTIONS[ov.fontFamily] || FONT_OPTIONS.Helvetica;
    txt.style.fontSize = (ov.fontSize*scale)+'px';
    txt.style.color = ov.color;
    txt.style.fontFamily = fo.css;
    txt.style.fontWeight = fo.weight;
    txt.style.fontStyle = fo.style;
    txt.innerText = ov.text;
    txt.addEventListener('input', ()=>{ ov.text = txt.innerText; });
    txt.addEventListener('mousedown', e=>e.stopPropagation());
    el.appendChild(txt);
  } else {
    const img = document.createElement('img');
    img.src = ov.dataUrl;
    el.style.width = (ov.wPct*100)+'%';
    el.style.height = (ov.hPct*100)+'%';
    el.appendChild(img);
    const rs = document.createElement('div');
    rs.className='ov-resize';
    rs.addEventListener('pointerdown', e=>{
      e.stopPropagation(); e.preventDefault();
      const layerRect = layer.getBoundingClientRect();
      function onMove(ev){
        const w = Math.max(20, ev.clientX - layerRect.left - (ov.xPct*layerRect.width));
        const h = Math.max(20, ev.clientY - layerRect.top - (ov.yPct*layerRect.height));
        ov.wPct = w/layerRect.width; ov.hPct = h/layerRect.height;
        el.style.width = (ov.wPct*100)+'%'; el.style.height=(ov.hPct*100)+'%';
      }
      function onUp(){ window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); }
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
    el.appendChild(rs);
  }

  const del = document.createElement('button');
  del.className='ov-del'; del.innerText='✕';
  del.addEventListener('click', e=>{
    e.stopPropagation();
    overlaysByPage[currentPageIndex] = overlaysByPage[currentPageIndex].filter(o=>o.id!==ov.id);
    refreshOverlayLayer();
  });
  el.appendChild(del);

  // Drag-to-move only kicks in once the pointer has actually travelled past
  // a small threshold. Without this, every click INTO the text (e.g. to
  // place the caret before typing) also armed the same move handler used for
  // dragging — the tiniest, unavoidable mouse jitter between pointerdown and
  // pointerup was enough to nudge the overlay's position on nearly every
  // edit, which is what made the text seem to "jump" while working with it.
  el.addEventListener('pointerdown', e=>{
    if(e.target === del || e.target.classList.contains('ov-resize')) return;
    const layerRect = layer.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    const startXPct = ov.xPct, startYPct = ov.yPct;
    let dragging = false;
    const DRAG_THRESHOLD = 4; // px
    function onMove(ev){
      const dx = ev.clientX-startX, dy = ev.clientY-startY;
      if(!dragging){
        if(Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
        dragging = true;
      }
      ev.preventDefault();
      ov.xPct = Math.min(0.95, Math.max(0, startXPct + dx/layerRect.width));
      ov.yPct = Math.min(0.95, Math.max(0, startYPct + dy/layerRect.height));
      el.style.left = (ov.xPct*100)+'%';
      el.style.top = (ov.yPct*100)+'%';
    }
    function onUp(){ window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });

  layer.appendChild(el);

  // simple property editor when clicking a text overlay
  el.addEventListener('click', e=>{
    if(ov.type!=='text') return;
    e.stopPropagation();
    showTextProps(ov);
  });
}

function showTextProps(ov){
  const fontOptionsHtml = Object.keys(FONT_OPTIONS).map(key=>
    `<option value="${key}" ${ov.fontFamily===key?'selected':''}>${FONT_OPTIONS[key].label}</option>`
  ).join('');
  propPanel.innerHTML = `
    <div class="field-row"><label>Font</label>
      <select id="pFontFamily">${fontOptionsHtml}</select></div>
    <div class="field-row"><label>Ukuran Font (pt)</label>
      <input type="number" id="pFontSize" min="8" max="72" value="${ov.fontSize}"></div>
    <div class="field-row"><label>Warna</label>
      <input type="color" id="pColor" value="${ov.color}"></div>
  `;
  document.getElementById('pFontFamily').addEventListener('change', e=>{
    ov.fontFamily = e.target.value; refreshOverlayLayer();
  });
  document.getElementById('pFontSize').addEventListener('input', e=>{
    ov.fontSize = parseInt(e.target.value)||16; refreshOverlayLayer();
  });
  document.getElementById('pColor').addEventListener('input', e=>{
    ov.color = e.target.value; refreshOverlayLayer();
  });
}

// ---------- SIGNATURE ----------
const sigModal = document.getElementById('sigModal');
const sigCanvas = document.getElementById('sigCanvas');
const sctx = sigCanvas.getContext('2d');
let drawing = false, lastX=0, lastY=0;
function sigPos(e){
  const r = sigCanvas.getBoundingClientRect();
  const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
  const cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
  return [cx * (sigCanvas.width/r.width), cy * (sigCanvas.height/r.height)];
}
// Clears to a transparent buffer (not a white fill) so the exported PNG has
// no background box behind the ink — only the stroke pixels are opaque.
function clearSig(){ sctx.clearRect(0,0,sigCanvas.width,sigCanvas.height); }
sigCanvas.addEventListener('pointerdown', e=>{ drawing=true; [lastX,lastY]=sigPos(e); });
sigCanvas.addEventListener('pointermove', e=>{
  if(!drawing) return;
  const [x,y] = sigPos(e);
  sctx.strokeStyle='#14213d'; sctx.lineWidth=3; sctx.lineCap='round';
  sctx.beginPath(); sctx.moveTo(lastX,lastY); sctx.lineTo(x,y); sctx.stroke();
  [lastX,lastY]=[x,y];
});
window.addEventListener('pointerup', ()=>drawing=false);

document.getElementById('sigToolBtn').addEventListener('click', ()=>{
  if(!workingPdfDoc){ alert('Unggah PDF terlebih dahulu.'); return; }
  clearSig();
  sigModal.style.display='flex';
});
document.getElementById('sigCancel').addEventListener('click', ()=> sigModal.style.display='none');
document.getElementById('sigClear').addEventListener('click', clearSig);
document.getElementById('sigSave').addEventListener('click', ()=>{
  const dataUrl = sigCanvas.toDataURL('image/png');
  const ov = { id:'ov'+(ovIdCounter++), type:'img', xPct:0.3, yPct:0.4, wPct:0.3, hPct:0.15, dataUrl };
  if(!overlaysByPage[currentPageIndex]) overlaysByPage[currentPageIndex]=[];
  overlaysByPage[currentPageIndex].push(ov);
  sigModal.style.display='none';
  refreshOverlayLayer();
});

// ---------- PAGE OPERATIONS ----------
async function rebuildInOrder(orderIndices){
  const newDoc = await PDFDocument.create();
  const copied = await newDoc.copyPages(workingPdfDoc, orderIndices);
  copied.forEach(p=>newDoc.addPage(p));
  workingPdfDoc = newDoc;

  // Carry overlays and the selection checkboxes along with their pages
  // instead of wiping everything on every reorder/delete — previously
  // overlaysByPage was reset in full here even when the page an overlay was
  // placed on wasn't touched by the operation at all, and selectedPages kept
  // its old indices even though pages had just shifted underneath them
  // (so a checkbox could silently end up "selecting" a different page).
  const remappedOverlays = {};
  const remappedSelected = new Set();
  orderIndices.forEach((oldIdx, newIdx) => {
    if(overlaysByPage[oldIdx]) remappedOverlays[newIdx] = overlaysByPage[oldIdx];
    if(selectedPages.has(oldIdx)) remappedSelected.add(newIdx);
  });
  overlaysByPage = remappedOverlays;
  selectedPages = remappedSelected;

  embeddedFontCache = {};
  await pushHistory();
  await refreshAll();
}
async function movePage(i, dir){
  const n = pdfjsDoc.numPages;
  const j = i+dir;
  if(j<0 || j>=n) return;
  const order = [...Array(n).keys()];
  [order[i], order[j]] = [order[j], order[i]];
  currentPageIndex = j;
  await rebuildInOrder(order);
}
async function deletePages(indices){
  const n = pdfjsDoc.numPages;
  const removeSet = new Set(indices);
  const order = [...Array(n).keys()].filter(i=>!removeSet.has(i));
  if(order.length===0){ alert('Tidak bisa menghapus semua halaman.'); return; }
  currentPageIndex = 0;
  await rebuildInOrder(order);
}
async function rotatePage(i){
  const pages = workingPdfDoc.getPages();
  const p = pages[i];
  const current = p.getRotation().angle;
  p.setRotation(degrees((current+90)%360));
  // Overlay position (xPct/yPct) is measured against the page's on-screen
  // orientation and doesn't rotate along with the page itself, so anything
  // already placed on this page would land in the wrong spot once it's
  // rendered rotated. Dropping it here is safer than leaving it silently
  // misplaced.
  delete overlaysByPage[i];
  await pushHistory();
  await refreshAll();
}
document.getElementById('deleteBtn').addEventListener('click', ()=>{
  if(selectedPages.size===0){ alert('Pilih halaman lewat kotak centang terlebih dahulu.'); return; }
  deletePages([...selectedPages]);
});
document.getElementById('extractBtn').addEventListener('click', async ()=>{
  if(selectedPages.size===0){ alert('Pilih halaman lewat kotak centang terlebih dahulu.'); return; }
  try{
    // Bake any pending text/signature overlays first — otherwise they exist
    // only in this tab's memory and silently would not appear in the
    // extracted copy (downloading already did this; extracting didn't).
    if(Object.keys(overlaysByPage).length){ await bakeOverlays(); }
    const indices = [...selectedPages].sort((a,b)=>a-b);
    const newDoc = await PDFDocument.create();
    const copied = await newDoc.copyPages(workingPdfDoc, indices);
    copied.forEach(p=>newDoc.addPage(p));
    const bytes = await newDoc.save();
    downloadBytes(bytes, 'halaman-terpilih.pdf');
  }catch(err){
    console.error('Gagal mengekstrak halaman:', err);
    alert('Gagal mengekstrak halaman. Coba lagi.');
  }
});

// ---------- BAKE OVERLAYS ----------
async function bakeOverlays(){
  const pages = workingPdfDoc.getPages();
  async function getFont(key){
    if(!embeddedFontCache[key]){
      const fo = FONT_OPTIONS[key] || FONT_OPTIONS.Helvetica;
      embeddedFontCache[key] = await workingPdfDoc.embedFont(fo.std);
    }
    return embeddedFontCache[key];
  }
  for(const pageIdxStr of Object.keys(overlaysByPage)){
    const pageIdx = parseInt(pageIdxStr);
    const page = pages[pageIdx];
    if(!page) continue;
    const pw = page.getWidth(), ph = page.getHeight();
    for(const ov of overlaysByPage[pageIdx]){
      if(ov.type==='text'){
        if(!ov.text) continue;
        // ov.fontSize is already a PDF point size (see the note on
        // overlaysByPage above) — no zoom-dependent conversion needed here
        // any more, which removes the previous bug where text baked at the
        // wrong size/position if the page's on-screen scale had changed
        // (e.g. from a window resize) between placing the text and applying it.
        const pdfFontSize = ov.fontSize;
        const font = await getFont(ov.fontFamily || 'Helvetica');
        // xPct/yPct is the top-left corner of the text box (same convention
        // as the CSS left/top used to position it on screen), but pdf-lib's
        // drawText() anchors (x,y) at the BASELINE of the first line. Convert
        // using this font's actual ascender metric instead of a fixed guess,
        // so every font (Helvetica/Times/Courier, regular/bold/italic) lines
        // up with where it visually appeared in the editor.
        const ascent = font.heightAtSize(pdfFontSize, { descender: false });
        const x = ov.xPct*pw;
        const y = ph - (ov.yPct*ph) - ascent;
        page.drawText(ov.text, { x, y, size: pdfFontSize, font, color: hexToRgb01(ov.color) });
      } else if(ov.type==='img'){
        const bytes = dataUrlToBytes(ov.dataUrl);
        const png = await workingPdfDoc.embedPng(bytes);
        const w = ov.wPct*pw, h = ov.hPct*ph;
        const x = ov.xPct*pw;
        const y = ph - (ov.yPct*ph) - h;
        page.drawImage(png, {x, y, width:w, height:h});
      }
    }
  }
  overlaysByPage = {};
  await pushHistory();
  await refreshAll();
}
document.getElementById('bakeBtn').addEventListener('click', async ()=>{
  if(!workingPdfDoc) return;
  try{
    await bakeOverlays();
  }catch(err){
    console.error('Gagal menerapkan teks/tanda tangan:', err);
    alert('Gagal menerapkan teks/tanda tangan ke PDF. Coba lagi.');
  }
});

// ---------- FORM FILLING ----------
async function refreshFormPanel(){
  formFieldsEl.innerHTML = '';
  let fields = [];
  try{
    const form = workingPdfDoc.getForm();
    fields = form.getFields();
  }catch(e){ fields = []; }
  if(!fields.length){ formPanel.style.display='none'; return; }
  formPanel.style.display='block';
  fields.forEach(f=>{
    const name = f.getName();
    const wrap = document.createElement('div');
    wrap.className='form-field';
    if(f instanceof PDFLib.PDFTextField){
      let val=''; try{ val=f.getText()||''; }catch(e){}
      wrap.innerHTML = `<label>${name}</label><input type="text" data-field="${name}" data-kind="text" value="${val.replace(/"/g,'&quot;')}">`;
    } else if(f instanceof PDFLib.PDFCheckBox){
      let checked=false; try{ checked=f.isChecked(); }catch(e){}
      wrap.innerHTML = `<label><input type="checkbox" data-field="${name}" data-kind="checkbox" ${checked?'checked':''}> ${name}</label>`;
    } else if(f instanceof PDFLib.PDFDropdown){
      const opts = f.getOptions();
      wrap.innerHTML = `<label>${name}</label><select data-field="${name}" data-kind="dropdown">` +
        opts.map(o=>`<option value="${o}">${o}</option>`).join('') + `</select>`;
    } else if(f instanceof PDFLib.PDFRadioGroup){
      const opts = f.getOptions();
      wrap.innerHTML = `<label>${name}</label><div class="radio-row">` +
        opts.map(o=>`<label><input type="radio" name="rg_${name}" data-field="${name}" data-kind="radio" value="${o}"> ${o}</label>`).join('') +
        `</div>`;
    } else if(f instanceof PDFLib.PDFOptionList){
      const opts = f.getOptions();
      wrap.innerHTML = `<label>${name}</label><select data-field="${name}" data-kind="dropdown">` +
        opts.map(o=>`<option value="${o}">${o}</option>`).join('') + `</select>`;
    } else {
      wrap.innerHTML = `<label>${name} (tipe tidak didukung)</label>`;
    }
    formFieldsEl.appendChild(wrap);
  });
}
document.getElementById('applyFormBtn').addEventListener('click', async ()=>{
  try{
    const form = workingPdfDoc.getForm();
    const inputs = formFieldsEl.querySelectorAll('[data-field]');
    inputs.forEach(inp=>{
      const name = inp.dataset.field, kind = inp.dataset.kind;
      try{
        if(kind==='text'){ form.getTextField(name).setText(inp.value); }
        else if(kind==='checkbox'){ const cb=form.getCheckBox(name); inp.checked? cb.check() : cb.uncheck(); }
        else if(kind==='dropdown'){ form.getDropdown(name).select(inp.value); }
        else if(kind==='radio'){ if(inp.checked) form.getRadioGroup(name).select(inp.value); }
      }catch(e){ console.warn('Gagal set field', name, e); }
    });
    await pushHistory();
    await refreshAll();
    alert('Data formulir diterapkan ke PDF.');
  }catch(err){
    console.error('Gagal menerapkan formulir:', err);
    alert('Gagal menerapkan data formulir. Coba lagi.');
  }
});

// ---------- EXPORT ----------
document.getElementById('downloadBtn').addEventListener('click', async ()=>{
  if(!workingPdfDoc){ alert('Belum ada PDF untuk diunduh.'); return; }
  try{
    if(Object.keys(overlaysByPage).length){ await bakeOverlays(); }
    const bytes = await workingPdfDoc.save();
    downloadBytes(bytes, 'hasil-edit.pdf');
  }catch(err){
    console.error('Gagal mengunduh PDF:', err);
    alert('Gagal membuat berkas PDF hasil edit. Coba lagi.');
  }
});
