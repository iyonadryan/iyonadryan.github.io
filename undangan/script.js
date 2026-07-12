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
  var end = '20260802T070000Z';
  var url = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    '&text=' + encodeURIComponent('Pernikahan Adryan & Suci') +
    '&dates=' + start + '/' + end +
    '&details=' + encodeURIComponent('Akad Nikah & Resepsi Pernikahan Adryan & Suci') +
    '&location=' + encodeURIComponent('Graha Kirana Ballroom, Jl. Riau No. 45, Bandung');
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
    copyText(btn.dataset.copy, 'Nomor rekening');
  });
});

// ---------- RSVP FORM (mock, belum terhubung backend) ----------
document.getElementById('rsvpForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var name = document.getElementById('rsvpName').value.trim();
  var attendance = document.getElementById('rsvpAttendance').value;
  var message = document.getElementById('rsvpMessage').value.trim();
  if (!name || !message) return;

  var attendanceLabel = { hadir: 'Hadir', ragu: 'Masih Ragu', tidak: 'Tidak Hadir' }[attendance];
  var card = document.createElement('div');
  card.className = 'wish-card';
  card.innerHTML =
    '<p class="wish-name">' + escapeHtml(name) + '<span class="wish-attendance">' + attendanceLabel + '</span></p>' +
    '<p class="wish-text">' + escapeHtml(message) + '</p>';
  document.getElementById('wishList').prepend(card);

  showToast('Terima kasih atas ucapannya!');
  e.target.reset();
});

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// ---------- GALLERY LIGHTBOX ----------
(function () {
  var lightbox = document.getElementById('lightbox');
  var lightboxImg = document.getElementById('lightboxImg');

  function openLightbox(src, alt) {
    lightboxImg.src = src;
    lightboxImg.alt = alt;
    lightbox.classList.add('open');
  }
  function closeLightbox() {
    lightbox.classList.remove('open');
  }

  document.querySelectorAll('.gallery-item').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var img = btn.querySelector('img');
      openLightbox(img.src, img.alt);
    });
  });

  document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLightbox();
  });
})();
