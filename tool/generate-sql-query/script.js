// ---------- THEME ----------
(function () {
  var STORAGE_KEY = "generatesqlquery_theme";
  var root = document.documentElement;
  var toggleBtn = document.getElementById("themeToggle");

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    toggleBtn.textContent = theme === "dark" ? "☀️" : "🌙";
  }

  var saved = localStorage.getItem(STORAGE_KEY);
  var initial = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(initial);

  toggleBtn.addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  });
})();

// ---------- TOAST ----------
var toastEl = document.getElementById('toast');
var toastTimer = null;
function showToast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ toastEl.classList.remove('show'); }, 1800);
}
async function copyText(text){
  try{
    await navigator.clipboard.writeText(text);
    showToast('Query berhasil disalin');
    return;
  }catch(err){
    // Clipboard API bisa gagal (origin tidak aman, browser lama, izin ditolak) — fallback ke execCommand.
  }
  try{
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Query berhasil disalin');
  }catch(err2){
    showToast('Gagal menyalin');
  }
}

// ---------- TYPE DEFINITIONS ----------
function todayISO(){ return new Date().toISOString().slice(0,10); }

var TYPE_DEFS = {
  autoincrement: { label: 'Auto Increment (ID)', fields: [
    { key:'start', label:'Mulai dari', input:'number', default:1 }
  ]},
  integer: { label: 'Integer', fields: [
    { key:'min', label:'Min', input:'number', default:1 },
    { key:'max', label:'Max', input:'number', default:1000 }
  ]},
  float: { label: 'Float / Desimal', fields: [
    { key:'min', label:'Min', input:'number', default:0 },
    { key:'max', label:'Max', input:'number', default:1000 },
    { key:'decimals', label:'Angka Desimal', input:'number', default:2 }
  ]},
  string: { label: 'String (Varchar)', fields: [
    { key:'length', label:'Panjang Karakter', input:'number', default:10 }
  ]},
  text: { label: 'Text (paragraf)', fields: [
    { key:'minWords', label:'Min Kata', input:'number', default:5 },
    { key:'maxWords', label:'Max Kata', input:'number', default:15 }
  ]},
  boolean: { label: 'Boolean', fields: [] },
  date: { label: 'Date', fields: [
    { key:'startDate', label:'Dari Tanggal', input:'date', default:'2020-01-01' },
    { key:'endDate', label:'Sampai Tanggal', input:'date', default: todayISO() }
  ]},
  timestamp: { label: 'Timestamp', fields: [
    { key:'startDate', label:'Dari Tanggal', input:'date', default:'2020-01-01' },
    { key:'endDate', label:'Sampai Tanggal', input:'date', default: todayISO() }
  ]},
  uuid: { label: 'UUID', fields: [] },
  enum: { label: 'Enum (pilihan)', fields: [
    { key:'values', label:'Pilihan (pisah koma)', input:'text', default:'aktif,nonaktif,pending', wide:true }
  ]},
  email: { label: 'Email', fields: [] },
  fullname: { label: 'Nama Lengkap', fields: [] }
};
var TYPE_ORDER = ['autoincrement','integer','float','string','text','boolean','date','timestamp','uuid','enum','email','fullname'];

// ---------- STATE ----------
var currentMode = 'mysql';
var colCounter = 0;
var columns = [];

function makeColumn(name, type){
  colCounter += 1;
  var def = TYPE_DEFS[type];
  var options = {};
  def.fields.forEach(function(f){ options[f.key] = f.default; });
  return { id: 'c' + colCounter, name: name, type: type, options: options, nullable: false, hasDefault: false, defaultValue: '', forceDefaultAll: false };
}

columns.push(makeColumn('id', 'autoincrement'));
columns.push(makeColumn('nama', 'fullname'));
columns.push(makeColumn('email', 'email'));
columns.push(makeColumn('status', 'enum'));
columns.push(makeColumn('created_at', 'timestamp'));

// ---------- RANDOM DATA HELPERS ----------
var FIRST_NAMES = ['Budi','Siti','Andi','Rina','Agus','Dewi','Joko','Sri','Ahmad','Fitri','Rudi','Wati','Bambang','Yuni','Hendra','Lestari','Eko','Indah','Fajar','Putri','Dedi','Ratna','Wahyu','Ayu','Irfan','Nadia','Rizky','Dian','Bayu','Melati'];
var LAST_NAMES = ['Saputra','Wijaya','Santoso','Kusuma','Pratama','Hidayat','Setiawan','Gunawan','Permata','Utami','Nugroho','Susanto','Firmansyah','Wardani','Kurniawan','Handayani','Yulianto','Rahman','Amelia','Prasetyo'];
var EMAIL_DOMAINS = ['gmail.com','yahoo.com','outlook.com','mail.com'];
var LOREM_WORDS = ['lorem','ipsum','dolor','sit','amet','konsumen','produk','testing','data','sistem','aplikasi','pengguna','transaksi','laporan','catatan','informasi','proyek','tim','klien','server','database','fitur','layanan','proses','hasil','contoh','sampel','dummy','rekam','berkas'];
var SYLLABLES = ['ba','bi','bu','be','ca','ci','cu','da','di','du','de','fa','ga','ha','ja','ka','la','ma','na','pa','ra','sa','ta','wa','ya','za','ko','ki','ru','ri','lo','mo','no','to','vo','xe','ze'];

function randInt(min, max){ return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max, decimals){ return Number((Math.random() * (max - min) + min).toFixed(decimals)); }
function randItem(arr){ return arr[randInt(0, arr.length - 1)]; }
function uuidv4(){
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
function randomToken(length){
  var s = '';
  while (s.length < length) s += randItem(SYLLABLES);
  return s.slice(0, Math.max(1, length));
}
function randomWords(minWords, maxWords){
  var n = randInt(minWords, maxWords);
  var words = [];
  for (var i = 0; i < n; i++) words.push(randItem(LOREM_WORDS));
  var text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1) + '.';
}
function randomFullName(){ return randItem(FIRST_NAMES) + ' ' + randItem(LAST_NAMES); }
function randomEmail(name){
  var base = (name || randomFullName()).toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.+|\.+$/g, '');
  return base + randInt(1, 999) + '@' + randItem(EMAIL_DOMAINS);
}
function randomDateBetween(startISO, endISO){
  var start = new Date(startISO || '2020-01-01').getTime();
  var end = new Date(endISO || todayISO()).getTime();
  if (isNaN(start) || isNaN(end) || end < start) { var t = start; start = end; end = t; }
  if (isNaN(start) || isNaN(end)) { start = new Date('2020-01-01').getTime(); end = Date.now(); }
  return new Date(start + Math.random() * (end - start));
}
function pad2(n){ return String(n).padStart(2, '0'); }
function formatDate(d){ return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function formatTimestamp(d){ return formatDate(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()); }
function escapeSQLString(str){ return String(str).replace(/'/g, "''"); }
function escapeHTML(str){
  return String(str).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}

// ---------- SQL SYNTAX HIGHLIGHT ----------
// Tokenizes the RAW (pre-escape) SQL text so quote/backtick matching stays simple,
// then escapes each token's own content inside the callback. The unmatched
// "glue" between tokens (spaces, commas, parens, newlines) is always plain
// structural syntax from our own generator, so leaving it un-escaped is safe.
var SQL_KEYWORDS = ['CREATE','TABLE','INSERT','INTO','VALUES','PRIMARY','KEY','AUTO_INCREMENT',
  'SERIAL','CHECK','IN','DEFAULT','NULL','TRUE','FALSE','NOT','VARCHAR','INT','INTEGER','TEXT',
  'BOOLEAN','DATE','DATETIME','TIMESTAMP','CHAR','UUID','ENUM','DECIMAL','NUMERIC',
  'CURRENT_TIMESTAMP','CURRENT_DATE','CURRENT_TIME','NOW'];
var SQL_TOKEN_RE = new RegExp(
  "('(?:[^']|'')*')" +               // 1: string literal
  "|(`[^`]*`|\"[^\"]*\")" +          // 2: quoted identifier
  "|(\\b\\d+(?:\\.\\d+)?\\b)" +      // 3: number
  "|(\\b(?:" + SQL_KEYWORDS.join('|') + ")\\b)",  // 4: keyword
  'gi'
);

function highlightSQL(sql){
  return String(sql).replace(SQL_TOKEN_RE, function(match, str, ident, num, kw){
    if (str !== undefined) return '<span class="sql-value">' + escapeHTML(match) + '</span>';
    if (ident !== undefined) return '<span class="sql-ident">' + escapeHTML(match) + '</span>';
    if (num !== undefined) return '<span class="sql-value">' + escapeHTML(match) + '</span>';
    return '<span class="sql-keyword">' + escapeHTML(match) + '</span>';
  });
}

// ---------- VALUE GENERATION ----------
function parsedDefaultValue(col){
  var raw = String(col.defaultValue || '').trim();
  switch (col.type){
    case 'integer': return parseInt(raw, 10) || 0;
    case 'float': return parseFloat(raw) || 0;
    case 'boolean': return /^(true|1)$/i.test(raw);
    case 'date': return /^CURRENT_DATE$/i.test(raw) ? formatDate(new Date()) : raw;
    case 'timestamp': return /^(CURRENT_TIMESTAMP|NOW\(\))$/i.test(raw) ? formatTimestamp(new Date()) : raw;
    default: return raw;
  }
}

function generateValue(col, rowIndex){
  var hasUsableDefault = col.type !== 'autoincrement' && col.hasDefault && String(col.defaultValue || '').trim();
  if (hasUsableDefault && col.forceDefaultAll) return parsedDefaultValue(col);
  if (col.type !== 'autoincrement' && col.nullable && Math.random() < 0.15) return null;
  if (hasUsableDefault && Math.random() < 0.3) return parsedDefaultValue(col);
  var o = col.options;
  switch (col.type){
    case 'autoincrement': return (Number(o.start) || 1) + rowIndex;
    case 'integer': return randInt(Number(o.min) || 0, Number(o.max) || 1000);
    case 'float': return randFloat(Number(o.min) || 0, Number(o.max) || 1000, Number(o.decimals) >= 0 ? Number(o.decimals) : 2);
    case 'string': return randomToken(Number(o.length) > 0 ? Number(o.length) : 10);
    case 'text': return randomWords(Number(o.minWords) || 5, Math.max(Number(o.maxWords) || 15, Number(o.minWords) || 5));
    case 'boolean': return Math.random() < 0.5;
    case 'date': return formatDate(randomDateBetween(o.startDate, o.endDate));
    case 'timestamp': return formatTimestamp(randomDateBetween(o.startDate, o.endDate));
    case 'uuid': return uuidv4();
    case 'enum': {
      var vals = String(o.values || '').split(',').map(function(v){ return v.trim(); }).filter(Boolean);
      return vals.length ? randItem(vals) : '';
    }
    case 'email': return randomEmail();
    case 'fullname': return randomFullName();
    default: return null;
  }
}

// ---------- SQL BUILDING ----------
function quoteIdent(mode, name){ return mode === 'mysql' ? ('`' + name + '`') : ('"' + name + '"'); }

function sqlBaseType(mode, col){
  var o = col.options;
  var decimals = Number(o.decimals) >= 0 ? Number(o.decimals) : 2;
  var length = Number(o.length) > 0 ? Number(o.length) : 255;
  var enumVals = String(o.values || '').split(',').map(function(v){ return v.trim(); }).filter(Boolean);
  var quotedEnumList = enumVals.map(function(v){ return "'" + escapeSQLString(v) + "'"; }).join(', ');

  if (mode === 'mysql'){
    switch (col.type){
      case 'autoincrement': return 'INT AUTO_INCREMENT PRIMARY KEY';
      case 'integer': return 'INT';
      case 'float': return 'DECIMAL(12,' + decimals + ')';
      case 'string': return 'VARCHAR(' + length + ')';
      case 'text': return 'TEXT';
      case 'boolean': return 'BOOLEAN';
      case 'date': return 'DATE';
      case 'timestamp': return 'DATETIME';
      case 'uuid': return 'CHAR(36)';
      case 'enum': return 'ENUM(' + quotedEnumList + ')';
      case 'email': return 'VARCHAR(255)';
      case 'fullname': return 'VARCHAR(150)';
    }
  } else {
    switch (col.type){
      case 'autoincrement': return 'SERIAL PRIMARY KEY';
      case 'integer': return 'INTEGER';
      case 'float': return 'NUMERIC(12,' + decimals + ')';
      case 'string': return 'VARCHAR(' + length + ')';
      case 'text': return 'TEXT';
      case 'boolean': return 'BOOLEAN';
      case 'date': return 'DATE';
      case 'timestamp': return 'TIMESTAMP';
      case 'uuid': return 'UUID';
      case 'enum': return 'VARCHAR(50)';
      case 'email': return 'VARCHAR(255)';
      case 'fullname': return 'VARCHAR(150)';
    }
  }
  return 'TEXT';
}

function sqlConstraint(mode, col){
  if (mode === 'postgresql' && col.type === 'enum'){
    var enumVals = String(col.options.values || '').split(',').map(function(v){ return v.trim(); }).filter(Boolean);
    var quotedEnumList = enumVals.map(function(v){ return "'" + escapeSQLString(v) + "'"; }).join(', ');
    return ' CHECK (' + quoteIdent(mode, col.name) + ' IN (' + quotedEnumList + '))';
  }
  return '';
}

// Nilai default boleh berupa keyword/fungsi SQL (CURRENT_TIMESTAMP, NOW(), NULL)
// yang tidak boleh di-quote, atau literal biasa yang perlu di-quote sesuai tipe.
var SQL_KEYWORD_DEFAULT = /^(CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME|NULL)$/i;
var SQL_FUNCTION_CALL = /^[A-Za-z_][A-Za-z0-9_]*\(.*\)$/;

function buildDefaultClause(col){
  if (col.type === 'autoincrement' || !col.hasDefault) return '';
  var raw = String(col.defaultValue || '').trim();
  if (!raw) return '';
  var literal;
  if (col.type === 'integer' || col.type === 'float'){
    literal = raw;
  } else if (col.type === 'boolean'){
    literal = /^(true|1)$/i.test(raw) ? 'TRUE' : 'FALSE';
  } else if (SQL_KEYWORD_DEFAULT.test(raw) || SQL_FUNCTION_CALL.test(raw)){
    literal = /^NULL$/i.test(raw) ? 'NULL' : raw.toUpperCase();
  } else {
    literal = "'" + escapeSQLString(raw) + "'";
  }
  return ' DEFAULT ' + literal;
}

function buildSQLValue(value, col, mode){
  if (value === null || value === undefined) return 'NULL';
  switch (col.type){
    case 'autoincrement':
    case 'integer':
    case 'float':
      return String(value);
    case 'boolean':
      return value ? 'TRUE' : 'FALSE';
    default:
      return "'" + escapeSQLString(value) + "'";
  }
}

function buildCreateTable(mode, tableName, cols){
  var lines = cols.map(function(col){
    return '  ' + quoteIdent(mode, col.name) + ' ' + sqlBaseType(mode, col) +
      buildDefaultClause(col) + sqlConstraint(mode, col);
  });
  return 'CREATE TABLE ' + quoteIdent(mode, tableName) + ' (\n' + lines.join(',\n') + '\n);';
}

function buildInsert(mode, tableName, cols, rows){
  var header = 'INSERT INTO ' + quoteIdent(mode, tableName) + ' (' +
    cols.map(function(c){ return quoteIdent(mode, c.name); }).join(', ') + ') VALUES';
  var valueLines = rows.map(function(row){
    return '  (' + cols.map(function(c){ return buildSQLValue(row[c.id], c, mode); }).join(', ') + ')';
  });
  return header + '\n' + valueLines.join(',\n') + ';';
}

// ---------- COLUMN BUILDER UI ----------
var columnListEl = document.getElementById('columnList');

function typeOptionsHTML(selectedType){
  return TYPE_ORDER.map(function(t){
    return '<option value="' + t + '"' + (t === selectedType ? ' selected' : '') + '>' + TYPE_DEFS[t].label + '</option>';
  }).join('');
}

function renderColumns(){
  columnListEl.innerHTML = columns.map(function(col){
    var def = TYPE_DEFS[col.type];
    var optsHTML = def.fields.map(function(f){
      var val = col.options[f.key] !== undefined ? col.options[f.key] : f.default;
      return '<div class="opt-field' + (f.wide ? ' wide' : '') + '">' +
        '<label>' + escapeHTML(f.label) + '</label>' +
        '<input type="' + f.input + '" class="col-opt" data-key="' + f.key + '" value="' + escapeHTML(String(val)) + '">' +
        '</div>';
    }).join('');
    return '<div class="column-row" data-col-id="' + col.id + '">' +
      '<div class="column-row-main">' +
        '<input type="text" class="col-name" value="' + escapeHTML(col.name) + '" placeholder="nama_kolom">' +
        '<select class="col-type">' + typeOptionsHTML(col.type) + '</select>' +
        '<button type="button" class="col-remove" title="Hapus kolom">✕</button>' +
      '</div>' +
      '<div class="column-row-options">' + optsHTML + '</div>' +
      '<label class="checkbox-row"><input type="checkbox" class="col-nullable"' + (col.nullable ? ' checked' : '') + '> Kadang NULL</label>' +
      '<label class="checkbox-row"><input type="checkbox" class="col-has-default"' + (col.hasDefault ? ' checked' : '') + '> Set Default Value</label>' +
      (col.hasDefault ?
        '<div class="opt-field default-value-field">' +
          '<label>Default Value</label>' +
          '<div class="default-value-row">' +
            '<input type="text" class="col-default-value" value="' + escapeHTML(col.defaultValue) + '" placeholder="mis. 0, aktif, CURRENT_TIMESTAMP">' +
            '<button type="button" class="default-all-btn' + (col.forceDefaultAll ? ' active' : '') + '" title="Isi semua baris data dummy kolom ini dgn nilai default">Isi Semua</button>' +
          '</div>' +
        '</div>'
        : '') +
    '</div>';
  }).join('');
}

function findColumn(id){ return columns.find(function(c){ return c.id === id; }); }

columnListEl.addEventListener('input', function(e){
  var row = e.target.closest('.column-row');
  if (!row) return;
  var col = findColumn(row.getAttribute('data-col-id'));
  if (!col) return;
  if (e.target.classList.contains('col-name')){
    col.name = e.target.value;
  } else if (e.target.classList.contains('col-opt')){
    col.options[e.target.getAttribute('data-key')] = e.target.value;
  } else if (e.target.classList.contains('col-default-value')){
    col.defaultValue = e.target.value;
  }
});

columnListEl.addEventListener('change', function(e){
  var row = e.target.closest('.column-row');
  if (!row) return;
  var col = findColumn(row.getAttribute('data-col-id'));
  if (!col) return;
  if (e.target.classList.contains('col-type')){
    col.type = e.target.value;
    var def = TYPE_DEFS[col.type];
    var opts = {};
    def.fields.forEach(function(f){ opts[f.key] = f.default; });
    col.options = opts;
    renderColumns();
  } else if (e.target.classList.contains('col-nullable')){
    col.nullable = e.target.checked;
  } else if (e.target.classList.contains('col-has-default')){
    col.hasDefault = e.target.checked;
    if (!col.hasDefault) col.forceDefaultAll = false;
    renderColumns();
  }
});

columnListEl.addEventListener('click', function(e){
  var removeBtn = e.target.closest('.col-remove');
  if (removeBtn){
    var row = removeBtn.closest('.column-row');
    var id = row.getAttribute('data-col-id');
    if (columns.length <= 1){ showToast('Minimal harus ada 1 kolom'); return; }
    columns = columns.filter(function(c){ return c.id !== id; });
    renderColumns();
    return;
  }

  var allBtn = e.target.closest('.default-all-btn');
  if (allBtn){
    var colRow = allBtn.closest('.column-row');
    var col = findColumn(colRow.getAttribute('data-col-id'));
    if (!col) return;
    col.forceDefaultAll = !col.forceDefaultAll;
    renderColumns();
    showToast(col.forceDefaultAll
      ? 'Semua baris "' + col.name + '" akan pakai nilai default'
      : 'Kolom "' + col.name + '" kembali acak sebagian');
  }
});

document.getElementById('addColumnBtn').addEventListener('click', function(){
  columns.push(makeColumn('kolom_baru', 'string'));
  renderColumns();
});

renderColumns();

// ---------- MODE TABS ----------
document.getElementById('modeTabs').addEventListener('click', function(e){
  var btn = e.target.closest('.mode-tab');
  if (!btn) return;
  currentMode = btn.getAttribute('data-mode');
  document.querySelectorAll('.mode-tab').forEach(function(b){ b.classList.toggle('active', b === btn); });
});

// ---------- GENERATE ----------
var outputPanel = document.getElementById('outputPanel');
var emptyPanel = document.getElementById('emptyPanel');
var sqlOutputEl = document.getElementById('sqlOutput');
var previewTableEl = document.getElementById('previewTable');
var previewNoteEl = document.getElementById('previewNote');

function validateColumns(){
  if (!columns.length) { showToast('Tambahkan minimal 1 kolom'); return false; }
  var seen = {};
  for (var i = 0; i < columns.length; i++){
    var name = columns[i].name.trim();
    if (!name){ showToast('Nama kolom tidak boleh kosong'); return false; }
    var key = name.toLowerCase();
    if (seen[key]){ showToast('Nama kolom "' + name + '" duplikat'); return false; }
    seen[key] = true;
    columns[i].name = name;
  }
  return true;
}

function renderPreview(rows, cols, rowCount){
  var thead = '<thead><tr>' + cols.map(function(c){ return '<th>' + escapeHTML(c.name) + '</th>'; }).join('') + '</tr></thead>';
  var shown = rows.slice(0, 10);
  var bodyRows = shown.map(function(row){
    return '<tr>' + cols.map(function(c){
      var v = row[c.id];
      if (v === null || v === undefined) return '<td><span class="null-cell">NULL</span></td>';
      if (c.type === 'boolean') return '<td>' + (v ? 'true' : 'false') + '</td>';
      return '<td>' + escapeHTML(String(v)) + '</td>';
    }).join('') + '</tr>';
  }).join('');
  var moreRow = '';
  if (rowCount > shown.length){
    moreRow = '<tr class="more-row"><td colspan="' + cols.length + '">… ' + (rowCount - shown.length) + ' data lainnya</td></tr>';
  }
  previewTableEl.innerHTML = thead + '<tbody>' + bodyRows + moreRow + '</tbody>';
  previewNoteEl.textContent = 'Menampilkan ' + shown.length + ' dari ' + rowCount + ' baris hasil generate';
}

document.getElementById('generateBtn').addEventListener('click', function(){
  if (!validateColumns()){ renderColumns(); return; }

  var tableName = (document.getElementById('tableName').value || 'tabel_baru').trim() || 'tabel_baru';
  var rowCount = Math.min(5000, Math.max(1, parseInt(document.getElementById('rowCount').value, 10) || 1));
  var includeCreateTable = document.getElementById('includeCreateTable').checked;

  var rows = [];
  for (var i = 0; i < rowCount; i++){
    var row = {};
    columns.forEach(function(col){ row[col.id] = generateValue(col, i); });
    rows.push(row);
  }

  var parts = [];
  if (includeCreateTable) parts.push(buildCreateTable(currentMode, tableName, columns));
  parts.push(buildInsert(currentMode, tableName, columns, rows));
  var sql = parts.join('\n\n');

  sqlOutputEl.innerHTML = highlightSQL(sql);
  renderPreview(rows, columns, rowCount);

  emptyPanel.hidden = true;
  outputPanel.hidden = false;

  document.getElementById('copyBtn').onclick = function(){ copyText(sql); };

  showToast('Query berhasil dibuat (' + rowCount + ' baris)');
});
