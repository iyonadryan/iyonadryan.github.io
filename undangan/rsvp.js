// ---------- RSVP ADMIN DASHBOARD ----------
var ATTENDANCE_META = {
  hadir: { label: 'Hadir', className: 'badge-hadir' },
  ragu: { label: 'Masih Ragu', className: 'badge-ragu' },
  tidak: { label: 'Tidak Hadir', className: 'badge-tidak' }
};
var MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

var currentFilter = 'semua';
var allWishes = [];
var listEl = document.getElementById('adminList');

function pad2(n) { return String(n).padStart(2, '0'); }

function formatDateTime(ms) {
  if (!ms) return '—';
  var d = new Date(ms);
  return d.getDate() + ' ' + MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear() + ', ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function renderStats(wishes) {
  document.getElementById('statTotal').textContent = wishes.length;
  document.getElementById('statHadir').textContent = wishes.filter(function (w) { return w.attendance === 'hadir'; }).length;
  document.getElementById('statRagu').textContent = wishes.filter(function (w) { return w.attendance === 'ragu'; }).length;
  document.getElementById('statTidak').textContent = wishes.filter(function (w) { return w.attendance === 'tidak'; }).length;
}

function renderList() {
  var wishes = currentFilter === 'semua' ? allWishes : allWishes.filter(function (w) { return w.attendance === currentFilter; });

  if (!wishes.length) {
    listEl.innerHTML = '<p class="admin-empty">Belum ada data pada filter ini.</p>';
    return;
  }

  listEl.innerHTML = wishes.map(function (w) {
    var meta = ATTENDANCE_META[w.attendance] || { label: w.attendance || '—', className: '' };
    return '<div class="admin-card">' +
      '<div class="admin-card-head">' +
        '<span class="admin-name">' + escapeHtml(w.name) + '</span>' +
        '<span class="admin-badge ' + meta.className + '">' + escapeHtml(meta.label) + '</span>' +
      '</div>' +
      '<p class="admin-message">' + escapeHtml(w.message) + '</p>' +
      '<p class="admin-time">' + formatDateTime(w.createdAt) + '</p>' +
    '</div>';
  }).join('');
}

var dashboardStarted = false;
function initDashboard() {
  if (dashboardStarted) return;
  dashboardStarted = true;

  var rsvpRef = db.ref(UNDANGAN_PATH + '/rsvp');

  rsvpRef.on('value', function (snapshot) {
    var val = snapshot.val() || {};
    allWishes = Object.keys(val).map(function (id) {
      var w = val[id];
      return { id: id, name: w.name, attendance: w.attendance, message: w.message, createdAt: w.createdAt };
    }).sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });

    renderStats(allWishes);
    renderList();
  }, function (err) {
    console.error('Gagal memuat data RSVP:', err);
    listEl.innerHTML = '<p class="admin-empty">Gagal memuat data. Cek koneksi internet.</p>';
  });

  document.getElementById('adminFilterTabs').addEventListener('click', function (e) {
    var btn = e.target.closest('.filter-tab');
    if (!btn) return;
    currentFilter = btn.dataset.filter;
    document.querySelectorAll('#adminFilterTabs .filter-tab').forEach(function (b) {
      b.classList.toggle('active', b === btn);
    });
    renderList();
  });
}

// ---------- PIN GATE ----------
// Proteksi ringan client-side (bukan keamanan sungguhan — PIN ada di source
// JS, siapa pun yg buka devtools bisa baca). Cukup utk mencegah orang random
// yg kebetulan tahu URL rsvp.html, bukan utk data sensitif/finansial.
(function () {
  var PIN = '190723';
  var MAX_ATTEMPTS = 3;
  var LOCK_MS = 60000;
  var STORAGE_KEY = 'undangan_rsvp_pin_state';
  var SESSION_KEY = 'undangan_rsvp_unlocked';

  var gate = document.getElementById('pinGate');
  var card = gate.querySelector('.pin-card');
  var adminEl = document.getElementById('rsvpAdmin');
  var boxes = Array.prototype.slice.call(document.querySelectorAll('.pin-box'));
  var errorEl = document.getElementById('pinError');
  var lockEl = document.getElementById('pinLock');
  var lockTimer = null;

  function getState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { attempts: 0, lockUntil: 0 };
    } catch (e) {
      return { attempts: 0, lockUntil: 0 };
    }
  }
  function setState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function unlock() {
    sessionStorage.setItem(SESSION_KEY, '1');
    gate.hidden = true;
    adminEl.hidden = false;
    initDashboard();
  }

  function clearBoxes() {
    boxes.forEach(function (b) { b.value = ''; });
    boxes[0].focus();
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
    card.classList.add('shake');
    setTimeout(function () { card.classList.remove('shake'); }, 400);
  }

  function formatCountdown(ms) {
    var s = Math.ceil(ms / 1000);
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + pad2(r);
  }

  function startLockCountdown(lockUntil) {
    boxes.forEach(function (b) { b.disabled = true; });
    errorEl.hidden = true;
    lockEl.hidden = false;
    clearInterval(lockTimer);

    function tick() {
      var remaining = lockUntil - Date.now();
      if (remaining <= 0) {
        clearInterval(lockTimer);
        lockEl.hidden = true;
        boxes.forEach(function (b) { b.disabled = false; });
        setState({ attempts: 0, lockUntil: 0 });
        clearBoxes();
        return;
      }
      lockEl.textContent = 'Terlalu banyak percobaan. Coba lagi dalam ' + formatCountdown(remaining) + '.';
    }
    tick();
    lockTimer = setInterval(tick, 1000);
  }

  function checkPin() {
    var entered = boxes.map(function (b) { return b.value; }).join('');
    if (entered.length < PIN.length) return;

    if (entered === PIN) {
      setState({ attempts: 0, lockUntil: 0 });
      unlock();
      return;
    }

    var state = getState();
    state.attempts = (state.attempts || 0) + 1;
    if (state.attempts >= MAX_ATTEMPTS) {
      state.lockUntil = Date.now() + LOCK_MS;
      setState(state);
      startLockCountdown(state.lockUntil);
    } else {
      setState(state);
      showError('PIN salah. Sisa percobaan: ' + (MAX_ATTEMPTS - state.attempts) + '.');
      clearBoxes();
    }
  }

  boxes.forEach(function (box, i) {
    box.addEventListener('input', function () {
      box.value = box.value.replace(/[^0-9]/g, '');
      if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
      checkPin();
    });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Backspace' && !box.value && i > 0) boxes[i - 1].focus();
    });
  });

  if (sessionStorage.getItem(SESSION_KEY) === '1') {
    unlock();
    return;
  }

  var state = getState();
  if (state.lockUntil && state.lockUntil > Date.now()) {
    startLockCountdown(state.lockUntil);
  } else {
    boxes[0].focus();
  }
})();
