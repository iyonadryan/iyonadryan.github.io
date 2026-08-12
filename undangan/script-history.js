// ---------- GUEST NAME FROM URL (?to=NamaTamu) ----------
// Sama persis dgn script.js — dipertahankan krn tidak butuh Firebase sama
// sekali (murni baca query string), harmless di halaman arsip.
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

// ---------- TOAST ----------
var toastEl = document.getElementById('toast');
var toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
}

// ---------- COPY REKENING/ALAMAT ----------
// Sama persis dgn script.js — murni clipboard API, tidak butuh Firebase.
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

// ---------- GALLERY LIGHTBOX (dgn navigasi next/prev looping + swipe) ----------
// Sama persis dgn script.js — murni DOM lokal, tidak butuh Firebase.
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
