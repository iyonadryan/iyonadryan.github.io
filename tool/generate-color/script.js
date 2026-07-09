// ---------- THEME ----------
// Own storage key, independent from every other page in this repo (same
// pattern as e.g. noteapp_theme vs financeapp_theme) — deliberately not
// shared even across tool/ pages.
(function initTheme(){
  const STORAGE_KEY = 'generatecolor_theme';
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

// ---------- DOM ----------
const baseColorPicker = document.getElementById('baseColorPicker');
const baseColorHex = document.getElementById('baseColorHex');
const baseColorR = document.getElementById('baseColorR');
const baseColorG = document.getElementById('baseColorG');
const baseColorB = document.getElementById('baseColorB');
const randomColorBtn = document.getElementById('randomColorBtn');
const saveColorBtn = document.getElementById('saveColorBtn');
const savedColorsEl = document.getElementById('savedColors');
const schemeTabsEl = document.getElementById('schemeTabs');
const schemeDescEl = document.getElementById('schemeDesc');
const schemeGridEl = document.getElementById('schemeGrid');
const contrastNoteEl = document.getElementById('contrastNote');
const catalogEl = document.getElementById('catalog');
const toastEl = document.getElementById('toast');

// ---------- COLOR MATH ----------
function clamp(v, min, max){ return Math.min(max, Math.max(min, v)); }

function hexToRgb(hex){
  let h = hex.replace('#','');
  if(h.length === 3) h = h.split('').map(c => c+c).join('');
  const num = parseInt(h, 16);
  return { r: (num>>16)&255, g: (num>>8)&255, b: num&255 };
}
function rgbToHex(r, g, b){
  return '#' + [r,g,b].map(v => Math.round(clamp(v,0,255)).toString(16).padStart(2,'0')).join('').toUpperCase();
}
function rgbToHsl(r, g, b){
  r/=255; g/=255; b/=255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s;
  const l = (max+min)/2;
  if(max === min){ h = 0; s = 0; }
  else{
    const d = max-min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    switch(max){
      case r: h = (g-b)/d + (g<b ? 6 : 0); break;
      case g: h = (b-r)/d + 2; break;
      default: h = (r-g)/d + 4; break;
    }
    h /= 6;
  }
  return { h: h*360, s: s*100, l: l*100 };
}
function hslToRgb(h, s, l){
  h = ((h%360)+360)%360; h/=360; s = clamp(s,0,100)/100; l = clamp(l,0,100)/100;
  let r, g, b;
  if(s === 0){ r = g = b = l; }
  else{
    const hue2rgb = (p,q,t) => {
      if(t<0) t+=1;
      if(t>1) t-=1;
      if(t<1/6) return p+(q-p)*6*t;
      if(t<1/2) return q;
      if(t<2/3) return p+(q-p)*(2/3-t)*6;
      return p;
    };
    const q = l<0.5 ? l*(1+s) : l+s-l*s;
    const p = 2*l-q;
    r = hue2rgb(p,q,h+1/3);
    g = hue2rgb(p,q,h);
    b = hue2rgb(p,q,h-1/3);
  }
  return { r: r*255, g: g*255, b: b*255 };
}
function hexToHsl(hex){ const {r,g,b} = hexToRgb(hex); return rgbToHsl(r,g,b); }
function hslToHex(h, s, l){ const {r,g,b} = hslToRgb(h,s,l); return rgbToHex(r,g,b); }

// WCAG 2.0 relative luminance / contrast ratio — used by the "Palet UI"
// scheme to check its background/text neutral pair actually reads as text,
// not just "looks fine" on the swatch preview.
function relLuminance(hex){
  const {r,g,b} = hexToRgb(hex);
  const chan = v => { v/=255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
  return 0.2126*chan(r) + 0.7152*chan(g) + 0.0722*chan(b);
}
function contrastRatio(hexA, hexB){
  const l1 = relLuminance(hexA), l2 = relLuminance(hexB);
  const hi = Math.max(l1,l2), lo = Math.min(l1,l2);
  return (hi+0.05)/(lo+0.05);
}

function normalizeHex(input){
  let v = String(input||'').trim();
  if(!v.startsWith('#')) v = '#'+v;
  if(/^#[0-9a-fA-F]{6}$/.test(v)) return v.toUpperCase();
  if(/^#[0-9a-fA-F]{3}$/.test(v)) return ('#'+v.slice(1).split('').map(c=>c+c).join('')).toUpperCase();
  return null;
}

// ---------- TOAST / CLIPBOARD ----------
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
    // Clipboard API unavailable (insecure origin, older browser, denied
    // permission) — fall back to the legacy selection+execCommand path.
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

// ---------- BASE COLOR STATE ----------
// Hardcoded rather than read from baseColorPicker.value/baseColorHex.value at
// load time — Chromium-based browsers restore an <input>'s last-typed value
// on a plain page reload even outside a <form>, so reading "whatever's
// currently in the DOM" here could silently pick up a stale color from a
// previous visit instead of this tool's actual default. The base color is
// deliberately NOT persisted (see tool/.claude/generate-color.md), so the
// canonical default is forced explicitly in the INIT section below too.
const DEFAULT_BASE_HEX = '#B5F82F';
let currentBaseHex = DEFAULT_BASE_HEX;
let activeScheme = 'complementary';

// `opts.skipHexSync`/`opts.skipRgbSync` let a field-specific handler update
// every OTHER input without rewriting the field the user is actively typing
// into — rewriting a focused text/number input mid-keystroke (even to the
// "same" value) can disrupt the cursor position or fight the user's edit,
// so each input's own live handler opts itself out of its own sync.
function setBaseColor(hex, opts){
  const options = opts || {};
  const normalized = normalizeHex(hex);
  if(!normalized) return;
  currentBaseHex = normalized;
  baseColorPicker.value = normalized;
  if(!options.skipHexSync) baseColorHex.value = normalized;
  baseColorHex.classList.remove('invalid');
  if(!options.skipRgbSync){
    const { r, g, b } = hexToRgb(normalized);
    baseColorR.value = r;
    baseColorG.value = g;
    baseColorB.value = b;
  }
  renderScheme(activeScheme);
}

baseColorPicker.addEventListener('input', e => setBaseColor(e.target.value));

// Only auto-commit while typing once a full 6-digit hex is present, so
// typing "#0f6e63" doesn't transiently apply "#0f6" (a valid 3-digit
// shorthand on its own) partway through. A 3-digit shorthand is still
// accepted, just on blur/tab-away instead of on every keystroke.
baseColorHex.addEventListener('input', e => {
  const raw = e.target.value.trim();
  const digits = raw.replace('#','');
  const normalized = normalizeHex(raw);
  if(normalized && digits.length === 6){
    setBaseColor(normalized, { skipHexSync: true });
  } else if(normalized && digits.length === 3){
    baseColorHex.classList.remove('invalid');
  } else {
    baseColorHex.classList.add('invalid');
  }
});
baseColorHex.addEventListener('blur', () => {
  const normalized = normalizeHex(baseColorHex.value);
  if(normalized) setBaseColor(normalized);
  else{ baseColorHex.value = currentBaseHex; baseColorHex.classList.remove('invalid'); }
});

// RGB fields mirror the hex field's live-vs-commit pattern: update on every
// keystroke (each channel is independent, so there's no 3-vs-6-digit
// ambiguity like the hex field has), but leave the field being typed into
// alone until blur, where it gets clamped/normalized for display.
function applyRgbFromInputs(){
  const r = clamp(parseInt(baseColorR.value, 10) || 0, 0, 255);
  const g = clamp(parseInt(baseColorG.value, 10) || 0, 0, 255);
  const b = clamp(parseInt(baseColorB.value, 10) || 0, 0, 255);
  setBaseColor(rgbToHex(r, g, b), { skipRgbSync: true });
}
[baseColorR, baseColorG, baseColorB].forEach(input => {
  input.addEventListener('input', applyRgbFromInputs);
  input.addEventListener('blur', () => {
    input.value = clamp(parseInt(input.value, 10) || 0, 0, 255);
  });
});

randomColorBtn.addEventListener('click', () => {
  setBaseColor(rgbToHex(Math.random()*256, Math.random()*256, Math.random()*256));
});

// ---------- WARNA TERSIMPAN ----------
// Persisted to localStorage (not just in-memory) — the whole point is
// letting the user come back later and flip between colors they saved
// earlier to compare them, so losing the list on reload would defeat it.
const SAVED_STORAGE_KEY = 'generatecolor_saved';

function loadSavedColors(){
  try{
    const raw = localStorage.getItem(SAVED_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(hex => normalizeHex(hex)) : [];
  }catch(err){
    return [];
  }
}
function persistSavedColors(){
  try{ localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(savedColors)); }
  catch(err){
    // localStorage bisa penuh atau dimatikan (mode privat) — biarkan gagal
    // diam-diam, jangan sampai merusak sesi yang sedang berjalan cuma krn
    // gagal menyimpan.
  }
}

let savedColors = loadSavedColors();

function renderSavedColors(){
  savedColorsEl.innerHTML = savedColors.map(hex =>
    '<div class="saved-chip" data-hex="' + hex + '">' +
      '<span class="saved-chip-color" style="background:' + hex + '"></span>' +
      '<span class="saved-chip-hex">' + hex + '</span>' +
      '<button type="button" class="saved-chip-del" data-del="' + hex + '" aria-label="Hapus ' + hex + '">✕</button>' +
    '</div>'
  ).join('');

  savedColorsEl.querySelectorAll('.saved-chip').forEach(chip => {
    chip.addEventListener('click', e => {
      if(e.target.closest('.saved-chip-del')) return;
      setBaseColor(chip.dataset.hex);
    });
  });
  savedColorsEl.querySelectorAll('.saved-chip-del').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      savedColors = savedColors.filter(hex => hex !== btn.dataset.del);
      persistSavedColors();
      renderSavedColors();
    });
  });
}

saveColorBtn.addEventListener('click', () => {
  if(savedColors.includes(currentBaseHex)){
    showToast(currentBaseHex + ' sudah tersimpan');
    return;
  }
  savedColors.unshift(currentBaseHex); // warna yg baru disimpan muncul paling depan
  persistSavedColors();
  renderSavedColors();
  showToast('Disimpan: ' + currentBaseHex);
});

// ---------- SKEMA WARNA ----------
const SCHEME_META = {
  complementary: {
    desc: 'Dua warna yang saling berseberangan di roda warna (180°) — kontras tinggi, cocok utk aksen yang mencolok.',
    build: (h,s,l) => [
      { hex: hslToHex(h,s,l), role:'Dasar' },
      { hex: hslToHex(h+180,s,l), role:'180°' },
    ],
  },
  analogous: {
    desc: 'Tiga warna yang bersebelahan di roda warna (±30°) — selaras & nyaman dipandang, cocok utk palet yang tenang.',
    build: (h,s,l) => [
      { hex: hslToHex(h-30,s,l), role:'-30°' },
      { hex: hslToHex(h,s,l), role:'Dasar' },
      { hex: hslToHex(h+30,s,l), role:'+30°' },
    ],
  },
  triadic: {
    desc: 'Tiga warna berjarak sama membentuk segitiga di roda warna (120°) — seimbang & tetap punya kontras yang jelas.',
    build: (h,s,l) => [
      { hex: hslToHex(h,s,l), role:'Dasar' },
      { hex: hslToHex(h+120,s,l), role:'+120°' },
      { hex: hslToHex(h+240,s,l), role:'+240°' },
    ],
  },
  tetradic: {
    desc: 'Empat warna membentuk persegi di roda warna (90°) — palet paling kaya, sebaiknya satu warna dijadikan dominan spy tidak ramai.',
    build: (h,s,l) => [
      { hex: hslToHex(h,s,l), role:'Dasar' },
      { hex: hslToHex(h+90,s,l), role:'+90°' },
      { hex: hslToHex(h+180,s,l), role:'+180°' },
      { hex: hslToHex(h+270,s,l), role:'+270°' },
    ],
  },
  splitComplementary: {
    desc: 'Warna dasar dipasangkan dgn dua warna di sisi kiri-kanan lawannya (±150°) — kontras spt komplementer tapi lebih lembut.',
    build: (h,s,l) => [
      { hex: hslToHex(h,s,l), role:'Dasar' },
      { hex: hslToHex(h+150,s,l), role:'+150°' },
      { hex: hslToHex(h+210,s,l), role:'+210°' },
    ],
  },
  monochromatic: {
    desc: 'Hue yang sama, cuma beda terang-gelap — palet paling aman & selalu serasi, cocok utk gradasi/tumpukan elemen.',
    build: (h,s) => [85,70,55,40,25].map(l => ({ hex: hslToHex(h,s,l), role: l+'% terang' })),
  },
  // Bukan skema roda-warna spt yg di atas — ini palet 5 warna berbasis PERAN,
  // pola yg umum dipakai buat kebutuhan UI/UX (dipakai luas oleh design
  // system spt Material Design & dibahas di banyak panduan UI color, mis.
  // Figma/IxDF/NN·g — lihat tool/.claude/generate-color.md utk detail &
  // sumbernya): Primer, Sekunder, Aksen, dan sepasang Netral (latar & teks).
  // Rasio 60/30/10 di label mengikuti aturan "60-30-10" yg lazim dipakai utk
  // menentukan PORSI pemakaian tiap warna di layar, bukan rumus hue-nya.
  uiPalette: {
    desc: 'Palet 5 warna berbasis peran utk UI/UX — Primer/Sekunder/Aksen + sepasang Netral (latar & teks) yang di-tint mengikuti hue warna dasar, bukan abu-abu polos. Mengikuti pola umum "60-30-10" & peran warna (Primer/Sekunder/Aksen/Netral) yang dipakai kebanyakan design system.',
    isUiPalette: true,
    build: (h,s,l) => [
      { hex: hslToHex(h, s, l), role:'Primer (60%)', tip:'Elemen branding utama: tombol utama, link, header.' },
      { hex: hslToHex(h-40, clamp(s*0.85,0,100), clamp(l+8,15,88)), role:'Sekunder (30%)', tip:'Kartu, sidebar, elemen pendukung yang tidak perlu menonjol.' },
      { hex: hslToHex(h+165, clamp(Math.max(s,75),0,95), 52), role:'Aksen (10%)', tip:'CTA, notifikasi, elemen yang perlu paling menonjol — pakai secukupnya.' },
      { hex: hslToHex(h, 10, 97), role:'Netral Terang', tip:'Latar halaman/kartu.' },
      { hex: hslToHex(h, 16, 15), role:'Netral Gelap', tip:'Teks body & judul.' },
    ],
  },
};

function renderScheme(scheme){
  const meta = SCHEME_META[scheme] || SCHEME_META.complementary;
  const { h, s, l } = hexToHsl(currentBaseHex);
  schemeDescEl.textContent = meta.desc;
  const colors = meta.build(h, s, l);
  const isRoleBased = !!meta.isUiPalette;

  schemeGridEl.innerHTML = colors.map(c =>
    '<div class="scheme-swatch' + (isRoleBased ? ' scheme-swatch-role' : '') + '">' +
      '<div class="scheme-swatch-color" style="background:' + c.hex + '" data-hex="' + c.hex + '" title="' + c.role + '"></div>' +
      '<div class="scheme-swatch-meta">' +
        (isRoleBased ? '<p class="scheme-swatch-role-label">' + c.role + '</p>' : '') +
        '<p class="scheme-swatch-hex">' + c.hex + '</p>' +
        (c.tip ? '<p class="scheme-swatch-tip">' + c.tip + '</p>' : '') +
        '<div class="scheme-swatch-actions">' +
          '<button type="button" class="mini-btn" data-copy="' + c.hex + '">Salin</button>' +
          '<button type="button" class="mini-btn" data-use="' + c.hex + '">Pakai</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  ).join('');

  schemeGridEl.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', () => copyText(btn.dataset.copy)));
  schemeGridEl.querySelectorAll('[data-use]').forEach(btn => btn.addEventListener('click', () => setBaseColor(btn.dataset.use)));
  schemeGridEl.querySelectorAll('.scheme-swatch-color').forEach(el => el.addEventListener('click', () => copyText(el.dataset.hex)));

  // "Palet UI" is the only scheme with a defined background/text pair, so
  // it's the only one where a WCAG contrast check actually means something.
  if(isRoleBased){
    const bg = colors.find(c => c.role === 'Netral Terang');
    const fg = colors.find(c => c.role === 'Netral Gelap');
    const ratio = contrastRatio(bg.hex, fg.hex);
    const passAA = ratio >= 4.5;
    contrastNoteEl.hidden = false;
    contrastNoteEl.className = 'contrast-note ' + (passAA ? 'pass' : 'warn');
    contrastNoteEl.textContent = (passAA ? '✓ ' : '⚠ ') +
      'Kontras Netral Terang ↔ Netral Gelap: ' + ratio.toFixed(2) + ':1 — ' +
      (passAA ? 'lolos WCAG AA (≥4.5:1) utk teks body.' : 'di bawah WCAG AA (4.5:1) — pertimbangkan teks lebih gelap.');
  } else {
    contrastNoteEl.hidden = true;
  }
}

schemeTabsEl.querySelectorAll('.scheme-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    schemeTabsEl.querySelectorAll('.scheme-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeScheme = btn.dataset.scheme;
    renderScheme(activeScheme);
  });
});

// ---------- KATALOG WARNA ----------
// A generated "paint chip wall" — not sampled from any real paint brand's
// catalog, just a systematic set of named hue families each stepped through
// a light→dark tier ramp (Tailwind-style 50–900 numbering), so users get a
// big, browsable set of named color options like a wall of paint swatches.
const HUE_FAMILIES = [
  { name:'Merah', hue:0 },
  { name:'Merah Jingga', hue:20 },
  { name:'Jingga', hue:40 },
  { name:'Jingga Kuning', hue:55 },
  { name:'Kuning', hue:70 },
  { name:'Kuning Hijau', hue:95 },
  { name:'Hijau', hue:120 },
  { name:'Hijau Toska', hue:150 },
  { name:'Toska', hue:180 },
  { name:'Biru Muda', hue:200 },
  { name:'Biru', hue:220 },
  { name:'Biru Ungu', hue:250 },
  { name:'Ungu', hue:275 },
  { name:'Ungu Magenta', hue:300 },
  { name:'Magenta', hue:320 },
  { name:'Merah Muda', hue:340 },
];
const TIERS = [50,100,200,300,400,500,600,700,800,900];
const TIER_LIGHTNESS = [96,91,83,74,64,54,45,36,27,17];
// Saturation eases off slightly at both extremes — very light/very dark
// swatches read as more "washed out" in real paint chips too — full
// strength through the middle tiers.
const TIER_SAT_MULT = [0.55,0.72,0.88,0.97,1,1,0.97,0.9,0.8,0.68];
const BASE_SATURATION = 68;
const BROWN_LIGHTNESS = [82,73,64,55,46,38,30,23,16,9];

function buildCatalogRows(){
  const rows = HUE_FAMILIES.map(fam => ({
    name: fam.name,
    swatches: TIERS.map((tier,i) => ({ tier, hex: hslToHex(fam.hue, BASE_SATURATION*TIER_SAT_MULT[i], TIER_LIGHTNESS[i]) })),
  }));
  rows.push({
    name:'Abu-abu',
    swatches: TIERS.map((tier,i) => ({ tier, hex: hslToHex(0, 0, TIER_LIGHTNESS[i]) })),
  });
  // Brown isn't a spectral hue — it's a low-saturation, mid-to-dark orange,
  // so it gets its own (darker) lightness range instead of the shared ramp.
  rows.push({
    name:'Cokelat',
    swatches: TIERS.map((tier,i) => ({ tier, hex: hslToHex(28, 45*TIER_SAT_MULT[i], BROWN_LIGHTNESS[i]) })),
  });
  return rows;
}

function renderCatalog(){
  const rows = buildCatalogRows();
  catalogEl.innerHTML = rows.map(row =>
    '<div class="catalog-row">' +
      '<span class="catalog-row-name">' + row.name + '</span>' +
      '<div class="catalog-strip">' +
        row.swatches.map(sw =>
          '<button type="button" class="catalog-swatch" style="background:' + sw.hex + '" data-hex="' + sw.hex + '" aria-label="' + row.name + ' ' + sw.tier + ' ' + sw.hex + '"></button>'
        ).join('') +
      '</div>' +
    '</div>'
  ).join('');

  catalogEl.querySelectorAll('.catalog-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      setBaseColor(btn.dataset.hex);
      copyText(btn.dataset.hex);
    });
  });
}

// ---------- INIT ----------
// Force every input back to the canonical default, overriding whatever the
// browser may have already restored into them before this script ran (see
// the comment on DEFAULT_BASE_HEX above).
setBaseColor(DEFAULT_BASE_HEX);
renderCatalog();
renderSavedColors();

// The reset above isn't always enough on its own: Chromium restores an
// <input>'s last-typed value as part of session-history state for that
// navigation entry, and that restoration can land AFTER this script has
// already run (not just before it) — which is exactly why the color kept
// coming back on reload even with the fix above in place. `pageshow` fires
// once the browser has fully finished showing the page, including any such
// restoration (both for a normal load and for a back/forward bfcache
// restore), so re-asserting the default there is what actually wins.
window.addEventListener('pageshow', () => {
  setBaseColor(DEFAULT_BASE_HEX);
});
