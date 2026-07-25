// ---------- GUEST NAME FROM URL (?to=NamaTamu) ----------
// Permintaan eksplisit user — link undangan per-tamu bisa personalisasi
// sapaan cover, mis. ?to=BapakHaji. `URLSearchParams` otomatis decode
// %20/+ jadi spasi (jadi ?to=Bapak+Haji atau ?to=Bapak%20Haji sama2
// jadi "Bapak Haji"), ditulis apa adanya via textContent (BUKAN innerHTML,
// otomatis aman dari HTML injection walau isi param sembarangan). Kalau
// param tidak ada/kosong → placeholder "Tamu Undangan" bawaan di HTML tetap
// dipakai, tidak disentuh sama sekali.
(function () {
  var tamu = new URLSearchParams(window.location.search).get('to');
  if (!tamu) return;
  tamu = tamu.trim();
  if (!tamu) return;
  var guestNameEl = document.getElementById('guestName');
  if (guestNameEl) guestNameEl.textContent = tamu;
})();

// ---------- STAGGERED REVEAL DELAYS ----------
document.querySelectorAll('[data-delay]').forEach(function (el) {
  var step = el.closest('.cover-inner') ? 0.12 : 0.1;
  el.style.animationDelay = (parseInt(el.dataset.delay, 10) * step) + 's';
  el.style.transitionDelay = (parseInt(el.dataset.delay, 10) * step) + 's';
});

// ---------- FALLING PETALS (cover only) ----------
(function () {
  var wrap = document.getElementById('coverPetals');
  var count = 14;
  for (var i = 0; i < count; i++) {
    var petal = document.createElement('span');
    petal.className = 'petal';
    petal.style.left = Math.random() * 100 + '%';
    petal.style.animationDuration = (9 + Math.random() * 8) + 's';
    petal.style.animationDelay = (Math.random() * 10) + 's';
    petal.style.opacity = String(0.2 + Math.random() * 0.3);
    petal.style.transform = 'scale(' + (0.6 + Math.random() * 0.8) + ')';
    wrap.appendChild(petal);
  }
})();

// ---------- OPEN INVITATION ----------
var cover = document.getElementById('cover');
var invite = document.getElementById('invite');
var bgm = document.getElementById('bgm');

document.getElementById('openInviteBtn').addEventListener('click', function () {
  cover.classList.add('closing');
  bgm.play().catch(function () {});
  document.getElementById('musicToggle').classList.add('playing');
  setTimeout(function () {
    cover.hidden = true;
    invite.hidden = false;
    window.scrollTo(0, 0);
    initScrollReveal();
  }, 850);
});

// ---------- SCROLL REVEAL ----------
function initScrollReveal() {
  var els = document.querySelectorAll('.reveal');
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  els.forEach(function (el) { observer.observe(el); });
}

// ---------- MUSIC TOGGLE ----------
document.getElementById('musicToggle').addEventListener('click', function () {
  var btn = this;
  if (bgm.paused) {
    bgm.play().catch(function () {});
    btn.classList.add('playing');
  } else {
    bgm.pause();
    btn.classList.remove('playing');
  }
});

// ---------- COUNTDOWN ----------
(function () {
  var target = new Date('2026-08-02T09:00:00+07:00').getTime();
  var dayEl = document.getElementById('cdDays');
  var hourEl = document.getElementById('cdHours');
  var minEl = document.getElementById('cdMinutes');
  var secEl = document.getElementById('cdSeconds');

  function pad(n) { return String(n).padStart(2, '0'); }

  function tick() {
    var diff = Math.max(0, target - Date.now());
    var days = Math.floor(diff / 86400000);
    var hours = Math.floor((diff % 86400000) / 3600000);
    var mins = Math.floor((diff % 3600000) / 60000);
    var secs = Math.floor((diff % 60000) / 1000);

    dayEl.textContent = pad(days);
    hourEl.textContent = pad(hours);
    minEl.textContent = pad(mins);
    secEl.textContent = pad(secs);

    secEl.classList.add('tick');
    setTimeout(function () { secEl.classList.remove('tick'); }, 250);
  }

  tick();
  setInterval(tick, 1000);
})();

// ---------- ADD TO CALENDAR ----------
document.getElementById('addCalendarBtn').addEventListener('click', function () {
  var start = '20260802T020000Z';
  var end = '20260802T090000Z';
  var url = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    '&text=' + encodeURIComponent('Pernikahan Adryan & Suci') +
    '&dates=' + start + '/' + end +
    '&details=' + encodeURIComponent('Akad Nikah & Resepsi Pernikahan Adryan & Suci') +
    '&location=' + encodeURIComponent('Masjid Raya Al Ikhlas, Asrama Polri Ex Brimob, Jl. Kesatriaan Raya, RT.5/RW.7, Cilincing, Jakarta Utara 14120');
  window.open(url, '_blank', 'noopener,noreferrer');
});

// ---------- TOAST ----------
var toastEl = document.getElementById('toast');
var toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
}

// ---------- COPY REKENING ----------
async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(label + ' disalin');
    return;
  } catch (err) {}
  try {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast(label + ' disalin');
  } catch (err2) {
    showToast('Gagal menyalin');
  }
}

document.querySelectorAll('.copy-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    copyText(btn.dataset.copy, btn.dataset.copyLabel || 'Nomor rekening');
  });
});

// ---------- RSVP & UCAPAN (Firebase: undangan/rsvp) ----------
var rsvpRef = db.ref(UNDANGAN_PATH + '/rsvp');
var wishListEl = document.getElementById('wishList');
var ATTENDANCE_CLASS = { hadir: 'wish-card--hadir', ragu: 'wish-card--ragu', tidak: 'wish-card--tidak' };

function renderWishList(wishesObj) {
  var wishes = Object.keys(wishesObj || {}).map(function (id) {
    var w = wishesObj[id];
    return { id: id, name: w.name, attendance: w.attendance, message: w.message, createdAt: w.createdAt };
  }).sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });

  if (!wishes.length) {
    wishListEl.innerHTML = '<p class="wish-empty">Jadilah yang pertama mengirim ucapan &amp; doa.</p>';
    return;
  }

  wishListEl.innerHTML = wishes.map(function (w) {
    return '<div class="wish-card ' + (ATTENDANCE_CLASS[w.attendance] || '') + '">' +
      '<p class="wish-name">' + escapeHtml(w.name) + '</p>' +
      '<p class="wish-text">' + escapeHtml(w.message) + '</p>' +
      '</div>';
  }).join('');
}

rsvpRef.on('value', function (snapshot) {
  renderWishList(snapshot.val());
}, function (err) {
  console.error('Gagal memuat ucapan:', err);
  wishListEl.innerHTML = '<p class="wish-empty">Gagal memuat ucapan. Cek koneksi internet.</p>';
});

document.getElementById('rsvpForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var name = document.getElementById('rsvpName').value.trim();
  var attendance = document.getElementById('rsvpAttendance').value;
  var message = document.getElementById('rsvpMessage').value.trim();
  if (!name || !message) return;

  var form = e.target;
  var submitBtn = form.querySelector('button[type=submit]');
  submitBtn.disabled = true;

  rsvpRef.child(String(Date.now())).set({
    name: name,
    attendance: attendance,
    message: message,
    createdAt: Date.now()
  }).then(function () {
    showToast('Terima kasih atas ucapannya!');
    form.reset();
  }).catch(function (err) {
    console.error('Gagal mengirim ucapan:', err);
    showToast('Gagal mengirim, cek koneksi internet');
  }).then(function () {
    submitBtn.disabled = false;
  });
});

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// ---------- GALLERY LIGHTBOX (dgn navigasi next/prev looping + swipe) ----------
(function () {
  var lightbox = document.getElementById('lightbox');
  var lightboxImg = document.getElementById('lightboxImg');
  var prevBtn = document.getElementById('lightboxPrev');
  var nextBtn = document.getElementById('lightboxNext');
  var items = Array.prototype.slice.call(document.querySelectorAll('.gallery-item'));
  var currentIndex = 0;

  function showIndex(index) {
    currentIndex = (index + items.length) % items.length;
    var img = items[currentIndex].querySelector('img');
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt;
  }
  function openLightbox(index) {
    showIndex(index);
    lightbox.classList.add('open');
  }
  function closeLightbox() {
    lightbox.classList.remove('open');
  }
  function showNext() { showIndex(currentIndex + 1); }
  function showPrev() { showIndex(currentIndex - 1); }

  items.forEach(function (btn, i) {
    btn.addEventListener('click', function () {
      openLightbox(i);
    });
  });

  document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
  nextBtn.addEventListener('click', showNext);
  prevBtn.addEventListener('click', showPrev);
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', function (e) {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') showNext();
    if (e.key === 'ArrowLeft') showPrev();
  });

  // Swipe geser di dalam popup (mode digeser) — next/prev berdasar arah geser
  var touchStartX = null;
  lightbox.addEventListener('touchstart', function (e) {
    touchStartX = e.changedTouches[0].clientX;
  }, { passive: true });
  lightbox.addEventListener('touchend', function (e) {
    if (touchStartX === null) return;
    var deltaX = e.changedTouches[0].clientX - touchStartX;
    var SWIPE_THRESHOLD = 40;
    if (deltaX <= -SWIPE_THRESHOLD) showNext();
    else if (deltaX >= SWIPE_THRESHOLD) showPrev();
    touchStartX = null;
  }, { passive: true });
})();
