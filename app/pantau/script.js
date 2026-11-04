/* =========================================================
   Pantau App — script.js
   Pantau/catat angka barang rumah dari waktu ke waktu (awalnya
   utk sisa token listrik), lalu analisis pemakaiannya per hari,
   per hari-dalam-seminggu, per waktu, & per bulan.

   Data di Firebase Realtime DB di bawah path /pantau (lihat
   firebaseConfig di index.html).

   Struktur data:
     pantau/
       items/
         <itemId>/                    # key = Date.now() saat input
           name:      "Token Listrik"
           icon:      "⚡"
           unit:      "kWh"
           type:      "sisa" | "meteran"
           createdAt: 1719...
           records/
             <recordId>/              # key = Date.now() saat input
               value:      45.6       # angka yang terbaca saat itu
               topup:      0          # (jenis "sisa" saja) jumlah isi ulang yg masuk
               recordedAt: 1719...    # waktu pembacaan (dipilih user), BUKAN waktu input
               note:       "..."      # opsional
               createdAt:  1719...

   Menghapus item otomatis ikut menghapus semua records di
   dalamnya (nested, pola sama dgn trip di Patungan App).

   TIDAK ada konsep "pengguna aktif" (Iyon/Ciwul) — sama spt
   Patungan App. Preferensi tema & item terakhir disimpan lokal.
   ========================================================= */

(function () {
  "use strict";

  const STORAGE_KEYS = { theme: "pantauapp_theme", lastItem: "pantauapp_last_item" };

  const HOUR = 3600000;
  const DAY = 24 * HOUR;

  const WEEKDAYS_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]; // index = Date.getDay()
  const WEEKDAYS_LONG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // tampil mulai Senin
  const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const MONTHS_LONG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  // 📶 kuota internet & 📱 pulsa: cocok jenis "sisa" (berkurang, sesekali isi ulang)
  const ICONS = ["⚡", "📶", "📱", "💧", "🔥", "🚰", "🛢️", "📦", "🚗", "🏍️", "🍚", "🧴"];

  // Blok waktu utk analisis "per waktu" (4 × 6 jam, mulai tengah malam)
  const TIME_BLOCKS = [
    { label: "Dini hari", range: "00–06" },
    { label: "Pagi", range: "06–12" },
    { label: "Siang", range: "12–18" },
    { label: "Malam", range: "18–24" },
  ];

  const TYPE_INFO = {
    sisa: { valueLabel: "Sisa saat ini", estLabel: "Estimasi sisa sekarang" },
    meteran: { valueLabel: "Angka meteran saat ini", estLabel: "Estimasi angka sekarang" },
  };

  const PRESET_TOKEN = { name: "Token Listrik", icon: "⚡", unit: "kWh", type: "sisa" };

  /* ---------------- Local storage (aman kalau diblok browser) ---------------- */

  function storeGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function storeSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      /* abaikan */
    }
  }

  /* ---------------- State ---------------- */

  let items = []; // [{ id, name, icon, unit, type, createdAt, records: [...] (urut recordedAt naik) }]
  let selectedItemId = storeGet(STORAGE_KEYS.lastItem); // item aktif di Analisis & default modal Catat
  let historyFilter = "all"; // "all" | itemId

  function findItem(id) {
    return items.find((it) => it.id === id) || null;
  }

  function selectItem(id) {
    selectedItemId = id;
    if (id) storeSet(STORAGE_KEYS.lastItem, id);
  }

  /* ================= Firebase data layer ================= */

  const pantauRef = db.ref(PANTAU_PATH);

  function subscribePantau() {
    pantauRef.on(
      "value",
      (snapshot) => {
        rebuildFromSnapshot(snapshot.val() || {});
        renderAll();
        hideLoading();
      },
      (err) => {
        console.error("Gagal membaca data dari Firebase:", err);
        hideLoading();
        alert("Gagal membaca data dari server. Cek koneksi internet atau rules Firebase utk path \"" + PANTAU_PATH + "\".");
      }
    );
  }

  function rebuildFromSnapshot(root) {
    const itemsObj = root.items || {};
    items = Object.keys(itemsObj)
      .map((id) => {
        const it = itemsObj[id] || {};
        const recObj = it.records || {};
        const records = Object.keys(recObj)
          .map((rid) => {
            const r = recObj[rid] || {};
            return {
              id: rid,
              value: Number(r.value) || 0,
              topup: Number(r.topup) || 0,
              recordedAt: Number(r.recordedAt) || Number(r.createdAt) || 0,
              note: r.note || "",
              createdAt: Number(r.createdAt) || 0,
            };
          })
          .sort((a, b) => a.recordedAt - b.recordedAt || a.createdAt - b.createdAt);
        return {
          id,
          name: it.name || "",
          icon: it.icon || "📦",
          unit: it.unit || "",
          type: it.type === "meteran" ? "meteran" : "sisa",
          createdAt: Number(it.createdAt) || 0,
          records,
        };
      })
      .sort((a, b) => a.createdAt - b.createdAt);

    if (!findItem(selectedItemId)) selectItem(items.length ? items[0].id : null);
    if (historyFilter !== "all" && !findItem(historyFilter)) historyFilter = "all";
  }

  // ---- Operasi tulis: Item ----

  function addItem(data) {
    const id = String(Date.now());
    selectItem(id);
    return pantauRef.child("items/" + id).set({ ...data, createdAt: Number(id) });
  }

  function updateItem(id, data) {
    // .update() supaya records di dalam item tidak ikut tertimpa
    return pantauRef.child("items/" + id).update(data);
  }

  function deleteItem(id) {
    return pantauRef.child("items/" + id).remove();
  }

  // ---- Operasi tulis: Catatan ----

  function addRecord(itemId, data) {
    const ts = Date.now();
    return pantauRef.child("items/" + itemId + "/records/" + ts).set({ ...data, createdAt: ts });
  }

  function updateRecord(oldItemId, newItemId, record, data) {
    if (oldItemId === newItemId) {
      return pantauRef.child("items/" + oldItemId + "/records/" + record.id).update(data);
    }
    // Pindah item: hapus dari item lama + tulis di item baru, satu operasi atomik.
    const updates = {};
    updates["items/" + oldItemId + "/records/" + record.id] = null;
    updates["items/" + newItemId + "/records/" + record.id] = { ...data, createdAt: record.createdAt || Date.now() };
    return pantauRef.update(updates);
  }

  function deleteRecord(itemId, recordId) {
    return pantauRef.child("items/" + itemId + "/records/" + recordId).remove();
  }

  function onWriteError(what) {
    return (err) => {
      console.error("Gagal " + what + ":", err);
      alert("Gagal " + what + ". Cek koneksi internet.");
    };
  }

  /* ================= Loading overlay ================= */

  let loadingHidden = false;
  function hideLoading() {
    if (loadingHidden) return;
    loadingHidden = true;
    const overlay = document.getElementById("loadingOverlay");
    if (overlay) overlay.classList.add("hidden");
  }

  /* ================= Theme ================= */

  function initTheme() {
    const saved = storeGet(STORAGE_KEYS.theme);
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (prefersDark ? "dark" : "light"));
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    storeSet(STORAGE_KEYS.theme, theme);
    document.getElementById("themeToggle").textContent = theme === "dark" ? "☀️" : "🌙";
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    applyTheme(current === "dark" ? "light" : "dark");
  }

  /* ================= Bottom nav / paging ================= */

  function goToPage(pageId) {
    document.querySelectorAll(".page").forEach((el) => el.classList.remove("active"));
    document.getElementById(pageId).classList.add("active");
    document.querySelectorAll("[data-nav]").forEach((el) => el.classList.toggle("active", el.dataset.nav === pageId));
    window.scrollTo(0, 0);
  }

  /* ================= Format helpers ================= */

  function fmtNum(v, maxFrac) {
    if (v == null || !isFinite(v)) return "–";
    const frac = maxFrac == null ? (Math.abs(v) >= 100 ? 1 : 2) : maxFrac;
    return Number(v).toLocaleString("id-ID", { maximumFractionDigits: frac });
  }

  // Hasilnya HTML (satuan = input user, di-escape) — pakai di innerHTML.
  function withUnit(v, unit, maxFrac) {
    return fmtNum(v, maxFrac) + (unit ? " " + escapeHtml(unit) : "");
  }

  // Terima "45,6" / "45.6" / "1.234,5". Koma = desimal. Titik dianggap
  // desimal kalau cuma satu & tidak diikuti tepat 3 digit (mis. "45.67"),
  // selain itu dianggap pemisah ribuan ("12.345").
  function parseNum(str) {
    let s = String(str || "").trim().replace(/\s/g, "");
    if (!s) return null;
    if (s.includes(",")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      const parts = s.split(".");
      if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) s = parts.join("");
    }
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function startOfDay(ts) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function addDays(ts, n) {
    const d = new Date(ts);
    d.setDate(d.getDate() + n);
    return d.getTime();
  }

  function dayKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function fmtTime(ts) {
    const d = new Date(ts);
    return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  function fmtDate(ts, withYear) {
    const d = new Date(ts);
    const showYear = withYear || d.getFullYear() !== new Date().getFullYear();
    return WEEKDAYS_SHORT[d.getDay()] + ", " + d.getDate() + " " + MONTHS_SHORT[d.getMonth()] + (showYear ? " " + d.getFullYear() : "");
  }

  function fmtDateTime(ts) {
    return fmtDate(ts) + " · " + fmtTime(ts);
  }

  function dayLabel(ts) {
    const today = startOfDay(Date.now());
    const day = startOfDay(ts);
    if (day === today) return "Hari ini";
    if (day === addDays(today, -1)) return "Kemarin";
    return fmtDate(ts, true);
  }

  function fmtDuration(ms) {
    const totalH = Math.round(ms / HOUR);
    if (ms < HOUR) return Math.max(1, Math.round(ms / 60000)) + " mnt";
    if (totalH < 24) return totalH + " jam";
    const d = Math.floor(totalH / 24);
    const h = totalH % 24;
    return d + " hari" + (h ? " " + h + " jam" : "");
  }

  function fmtAgo(ts) {
    const ms = Date.now() - ts;
    if (ms < 0) return "nanti";
    if (ms < 60000) return "baru saja";
    return fmtDuration(ms) + " lalu";
  }

  function fmtDaysLeft(days) {
    if (days < 1) return Math.max(1, Math.round(days * 24)) + " jam";
    return fmtNum(days, days < 10 ? 1 : 0) + " hari";
  }

  /* ================= Analisis ================= */

  // Pemakaian antara dua catatan berurutan.
  //   sisa    : prev.value + curr.topup − curr.value (berkurang = terpakai)
  //   meteran : curr.value − prev.value             (naik = terpakai)
  // Interval dgn hasil negatif (mis. sisa naik tapi kolom isi ulang kosong,
  // atau meteran turun) dianggap TIDAK VALID & dilewati di semua analisis.
  function buildIntervals(item) {
    const recs = item.records;
    const out = [];
    for (let i = 1; i < recs.length; i++) {
      const a = recs[i - 1];
      const b = recs[i];
      const dt = b.recordedAt - a.recordedAt;
      const raw = item.type === "meteran" ? b.value - a.value : a.value + b.topup - b.value;
      const usage = Math.round(raw * 1000) / 1000;
      out.push({ from: a.recordedAt, to: b.recordedAt, dt, usage, valid: dt > 0 && usage >= 0, recId: b.id });
    }
    return out;
  }

  // Bagi rata pemakaian tiap interval ke hari kalender yg dilewatinya
  // (proporsional thd lama waktu di hari itu).
  function allocateDaily(intervals) {
    const days = {};
    intervals.forEach((iv) => {
      const rate = iv.usage / iv.dt;
      let t = iv.from;
      while (t < iv.to) {
        const ds = startOfDay(t);
        const end = Math.min(addDays(ds, 1), iv.to);
        const ms = end - t;
        const key = dayKey(ds);
        const d = days[key] || (days[key] = { start: ds, usage: 0, covered: 0 });
        d.usage += rate * ms;
        d.covered += ms;
        t = end;
      }
    });
    return days;
  }

  // Sama spt allocateDaily, tapi ke 4 blok waktu 6-jaman (lihat TIME_BLOCKS).
  function allocateBlocks(intervals) {
    const blocks = TIME_BLOCKS.map(() => ({ usage: 0, covered: 0 }));
    intervals.forEach((iv) => {
      const rate = iv.usage / iv.dt;
      let t = iv.from;
      while (t < iv.to) {
        const d = new Date(t);
        const idx = Math.floor(d.getHours() / 6);
        d.setHours(idx * 6 + 6, 0, 0, 0);
        const end = Math.min(d.getTime(), iv.to);
        const ms = end - t;
        blocks[idx].usage += rate * ms;
        blocks[idx].covered += ms;
        t = end;
      }
    });
    return blocks;
  }

  function analyze(item, now) {
    now = now || Date.now();
    const intervals = buildIntervals(item);
    const valid = intervals.filter((iv) => iv.valid);
    const intervalByRec = {};
    intervals.forEach((iv) => (intervalByRec[iv.recId] = iv));

    const totalUsage = valid.reduce((s, iv) => s + iv.usage, 0);
    const totalMs = valid.reduce((s, iv) => s + iv.dt, 0);
    const avgPerDay = totalMs > 0 ? totalUsage / (totalMs / DAY) : null;

    const days = allocateDaily(valid);
    const dayList = Object.values(days);

    // Laju 7 hari terakhir (lebih mencerminkan kebiasaan terkini) —
    // dipakai utk estimasi kalau datanya minimal mencakup 1 hari penuh.
    const cutoff = addDays(startOfDay(now), -6);
    let recentUsage = 0;
    let recentCovered = 0;
    dayList.forEach((d) => {
      if (d.start >= cutoff) {
        recentUsage += d.usage;
        recentCovered += d.covered;
      }
    });
    const recentPerDay = recentCovered >= DAY ? recentUsage / (recentCovered / DAY) : null;
    const rate = recentPerDay != null ? recentPerDay : avgPerDay;
    const rateSource = recentPerDay != null ? "7 hari terakhir" : "seluruh data";

    const last = item.records.length ? item.records[item.records.length - 1] : null;
    let estNow = null;
    let daysLeft = null;
    let emptyAt = null;
    if (last && rate != null) {
      const elapsedDays = Math.max(0, (now - last.recordedAt) / DAY);
      if (item.type === "sisa") {
        estNow = Math.max(0, last.value - rate * elapsedDays);
        if (rate > 0) {
          daysLeft = estNow / rate;
          emptyAt = now + daysLeft * DAY;
        }
      } else {
        estNow = last.value + rate * elapsedDays;
      }
    }

    // Per hari dalam seminggu: total pemakaian / total hari tercakup
    const weekdays = WEEKDAYS_SHORT.map(() => ({ usage: 0, covered: 0 }));
    dayList.forEach((d) => {
      const w = new Date(d.start).getDay();
      weekdays[w].usage += d.usage;
      weekdays[w].covered += d.covered;
    });

    // Per bulan
    const monthsObj = {};
    dayList.forEach((d) => {
      const dt = new Date(d.start);
      const key = dt.getFullYear() * 100 + dt.getMonth();
      const m = monthsObj[key] || (monthsObj[key] = { key, year: dt.getFullYear(), month: dt.getMonth(), usage: 0, covered: 0 });
      m.usage += d.usage;
      m.covered += d.covered;
    });
    const months = Object.values(monthsObj).sort((a, b) => b.key - a.key);

    // Per waktu — cuma bermakna kalau ada interval pendek (catat >1× sehari)
    const shortCount = valid.filter((iv) => iv.dt <= 12 * HOUR).length;
    const blocks = allocateBlocks(valid);

    // Total isi ulang (jenis sisa)
    const topupTotal = item.records.reduce((s, r) => s + (r.topup || 0), 0);
    const invalidCount = intervals.length - valid.length;

    return {
      intervals, valid, intervalByRec, totalUsage, totalMs, avgPerDay,
      days, recentPerDay, rate, rateSource, last, estNow, daysLeft, emptyAt,
      weekdays, months, blocks, shortCount, topupTotal, invalidCount,
    };
  }

  /* ================= Render: all ================= */

  function renderAll() {
    renderHome();
    renderAnalysis();
    renderHistory();
  }

  /* ================= Render: Beranda ================= */

  function itemCardHTML(item) {
    const a = analyze(item);
    const unit = item.unit;
    let body = "";

    if (!a.last) {
      body = '<p class="item-card-hint">Belum ada catatan. Tekan <strong>+ Catat</strong> utk mencatat angka pertama.</p>';
    } else if (a.rate == null) {
      body =
        '<div class="item-card-main">' +
        '<p class="item-card-label">Terakhir dicatat &middot; ' + escapeHtml(fmtAgo(a.last.recordedAt)) + "</p>" +
        '<p class="item-card-value">' + fmtNum(a.last.value) + "<small>" + escapeHtml(unit) + "</small></p>" +
        "</div>" +
        '<p class="item-card-hint">Catat minimal 2 kali (mis. besok di jam yang sama) supaya rata-rata pemakaian & estimasi bisa dihitung.</p>';
    } else {
      let sub = "";
      if (item.type === "sisa") {
        if (a.daysLeft != null) {
          const warn = a.daysLeft <= 3;
          sub =
            '<p class="item-card-sub' + (warn ? " warn" : "") + '">' +
            (warn ? "⚠️ " : "") +
            "Habis ± " + fmtDaysLeft(a.daysLeft) + " lagi &middot; " + escapeHtml(fmtDate(a.emptyAt)) +
            "</p>";
        } else {
          sub = '<p class="item-card-sub">Belum ada pemakaian terdeteksi</p>';
        }
      } else {
        const monthNow = a.months.find((m) => m.year === new Date().getFullYear() && m.month === new Date().getMonth());
        sub = '<p class="item-card-sub">Bulan ini ' + withUnit(monthNow ? monthNow.usage : 0, unit) + "</p>";
      }
      body =
        '<div class="item-card-main">' +
        '<p class="item-card-label">' + TYPE_INFO[item.type].estLabel + "</p>" +
        '<p class="item-card-value">~' + fmtNum(a.estNow) + "<small>" + escapeHtml(unit) + "</small></p>" +
        sub +
        "</div>" +
        '<div class="item-card-stats">' +
        '<div class="item-card-stat"><strong>' + withUnit(a.last.value, unit) + "</strong><span>Terakhir · " + escapeHtml(fmtAgo(a.last.recordedAt)) + "</span></div>" +
        '<div class="item-card-stat"><strong>' + withUnit(a.rate, unit) + "</strong><span>Rata-rata / hari</span></div>" +
        "</div>";
    }

    return (
      '<div class="item-card" data-id="' + item.id + '">' +
      '<div class="item-card-top">' +
      '<div class="item-card-icon">' + escapeHtml(item.icon) + "</div>" +
      '<p class="item-card-name">' + escapeHtml(item.name) + "<small>" + item.records.length + " catatan</small></p>" +
      '<button type="button" class="item-card-catat" data-catat="' + item.id + '">+ Catat</button>' +
      "</div>" +
      body +
      "</div>"
    );
  }

  function renderHome() {
    const el = document.getElementById("itemCards");
    if (!items.length) {
      el.innerHTML =
        '<div class="welcome-card">' +
        '<div class="welcome-icon">⚡</div>' +
        "<h3>Mulai pantau token listrik</h3>" +
        "<p>Catat sisa token beberapa kali (tanggal, jam, & angka di meteran). Pantau App akan menghitung pemakaian per hari, per hari dalam seminggu, & perkiraan kapan token habis.</p>" +
        '<button type="button" class="btn-primary" id="presetTokenBtn">⚡ Buat item Token Listrik</button>' +
        '<button type="button" class="link-btn" id="customItemBtn">atau buat item lain</button>' +
        "</div>";
      return;
    }
    el.innerHTML = items.map(itemCardHTML).join("");
  }

  document.getElementById("itemCards").addEventListener("click", (e) => {
    if (e.target.closest("#presetTokenBtn")) {
      addItem(PRESET_TOKEN).catch(onWriteError("membuat item"));
      return;
    }
    if (e.target.closest("#customItemBtn")) {
      openItemModal(null);
      return;
    }
    const catatBtn = e.target.closest("[data-catat]");
    if (catatBtn) {
      openRecordModal(null, catatBtn.dataset.catat);
      return;
    }
    const card = e.target.closest(".item-card");
    if (card) {
      selectItem(card.dataset.id);
      renderAnalysis();
      goToPage("analysis");
    }
  });

  document.getElementById("addItemLink").addEventListener("click", (e) => {
    e.preventDefault();
    openItemModal(null);
  });

  /* ================= Render: chart helper ================= */

  // bars: [{ label, value (null = tanpa data), tip (HTML readout), current }]
  // opts: { ref: angka garis rata-rata (putus-putus), defaultTip, emptyText }
  function barChartHTML(bars, opts) {
    const values = bars.map((b) => (b.value == null ? 0 : b.value));
    const max = Math.max(opts.ref || 0, ...values);
    if (!(max > 0)) return '<p class="chart-empty">' + (opts.emptyText || "Belum ada data pemakaian.") + "</p>";

    let maxIdx = -1;
    bars.forEach((b, i) => {
      if (b.value != null && (maxIdx < 0 || b.value > bars[maxIdx].value)) maxIdx = i;
    });

    // Garis putus-putus rata-rata — tanpa label di dalam plot (bentrok dgn
    // batang paling kanan); artinya dijelaskan di subtitle chart.
    const ref =
      opts.ref > 0
        ? '<div class="bar-ref" style="bottom:calc(var(--lab) + var(--plot) * ' + (opts.ref / max).toFixed(4) + ')"></div>'
        : "";

    const cols = bars
      .map((b, i) => {
        const empty = b.value == null;
        const h = empty ? 0 : Math.max(1.5, (b.value / max) * 100);
        return (
          '<button type="button" class="bar-col' + (empty ? " empty" : "") + (b.current ? " current" : "") + '" data-tip="' + escapeHtml(b.tip) + '">' +
          '<span class="bar-track"><span class="bar" style="height:' + h.toFixed(2) + '%">' +
          (i === maxIdx ? '<span class="bar-value">' + fmtNum(b.value, 1) + "</span>" : "") +
          "</span></span>" +
          '<span class="bar-label">' + escapeHtml(b.label) + "</span>" +
          "</button>"
        );
      })
      .join("");

    return (
      '<div class="bar-chart">' + ref + cols + "</div>" +
      '<p class="chart-readout" data-default="' + escapeHtml(opts.defaultTip) + '">' + opts.defaultTip + "</p>"
    );
  }

  function setReadout(col) {
    const card = col.closest(".chart-card");
    if (!card) return;
    card.querySelectorAll(".bar-col.active").forEach((c) => c.classList.remove("active"));
    col.classList.add("active");
    const readout = card.querySelector(".chart-readout");
    if (readout) readout.innerHTML = col.dataset.tip;
  }

  function resetReadout(card) {
    card.querySelectorAll(".bar-col.active").forEach((c) => c.classList.remove("active"));
    const readout = card.querySelector(".chart-readout");
    if (readout) readout.innerHTML = readout.dataset.default;
  }

  /* ================= Render: Analisis ================= */

  function renderChips(containerId, activeId, withAll) {
    const el = document.getElementById(containerId);
    const chips = (withAll ? [{ id: "all", icon: "", name: "Semua" }] : []).concat(items);
    el.innerHTML = chips
      .map((it) => '<button type="button" class="chip' + (it.id === activeId ? " active" : "") + '" data-id="' + it.id + '">' + (it.icon ? escapeHtml(it.icon) + " " : "") + escapeHtml(it.name) + "</button>")
      .join("");
    el.hidden = chips.length <= 1 && !withAll;
  }

  function statTile(label, value, unit, sub, warn) {
    return (
      '<div class="stat-tile' + (warn ? " warn" : "") + '">' +
      '<p class="stat-tile-label">' + label + "</p>" +
      '<p class="stat-tile-value">' + value + (unit ? "<small>" + escapeHtml(unit) + "</small>" : "") + "</p>" +
      (sub ? '<p class="stat-tile-sub">' + sub + "</p>" : "") +
      "</div>"
    );
  }

  function recordItemHTML(item, rec, iv, showItem) {
    const unit = item.unit;
    let meta = "";
    let warn = false;
    // meta = HTML aman (withUnit sudah escape satuan, note di-escape di sini)
    if (iv) {
      if (!iv.valid) {
        warn = true;
        meta = item.type === "sisa" ? "⚠️ Naik dari catatan sebelumnya tanpa isi ulang — tidak dihitung" : "⚠️ Lebih kecil dari catatan sebelumnya — tidak dihitung";
      } else {
        const perDay = iv.usage / (iv.dt / DAY);
        meta = "Terpakai " + withUnit(iv.usage, unit) + " dlm " + fmtDuration(iv.dt) + " (≈ " + fmtNum(perDay) + "/hari)";
      }
    } else {
      meta = "Catatan pertama";
    }
    if (rec.note) meta += " · " + escapeHtml(rec.note);

    return (
      '<div class="record-item" data-item="' + item.id + '" data-id="' + rec.id + '">' +
      (showItem ? '<span class="record-icon">' + escapeHtml(item.icon) + "</span>" : "") +
      '<div class="record-info">' +
      '<p class="record-time">' + (showItem ? escapeHtml(item.name) + " · " + fmtTime(rec.recordedAt) : escapeHtml(fmtDateTime(rec.recordedAt))) +
      (rec.topup > 0 ? '<span class="badge-topup">+' + withUnit(rec.topup, unit) + "</span>" : "") +
      "</p>" +
      '<p class="record-meta' + (warn ? " warn" : "") + '">' + meta + "</p>" +
      "</div>" +
      '<div class="record-value">' + fmtNum(rec.value) + "<small>" + escapeHtml(unit) + "</small></div>" +
      "</div>"
    );
  }

  function renderAnalysis() {
    const body = document.getElementById("analysisBody");
    renderChips("analysisChips", selectedItemId, false);

    const item = findItem(selectedItemId);
    if (!item) {
      body.innerHTML = '<p class="empty-state">Belum ada item. Buat item dulu di Beranda.</p>';
      return;
    }

    const a = analyze(item);
    const unit = item.unit;
    const now = Date.now();
    const today = startOfDay(now);
    let html = "";

    html +=
      '<div class="analysis-head">' +
      '<span class="analysis-head-icon">' + escapeHtml(item.icon) + "</span>" +
      '<div class="analysis-head-text"><h3>' + escapeHtml(item.name) + "</h3><span>" +
      (item.type === "sisa" ? "Jenis Sisa" : "Jenis Meteran") + " · " + item.records.length + " catatan" +
      "</span></div>" +
      '<button type="button" class="icon-btn small" id="editItemBtn" aria-label="Ubah item">✏️</button>' +
      '<button type="button" class="icon-btn small" id="deleteItemBtn" aria-label="Hapus item">🗑️</button>' +
      "</div>";

    // ---- Stat tiles ----
    if (a.last) {
      const tiles = [];
      tiles.push(statTile("Terakhir dicatat", fmtNum(a.last.value), unit, escapeHtml(fmtDateTime(a.last.recordedAt))));
      tiles.push(statTile(TYPE_INFO[item.type].estLabel.replace("Estimasi ", "Est. "), a.estNow != null ? "~" + fmtNum(a.estNow) : "–", unit, a.estNow != null ? "dari laju " + a.rateSource : "butuh ≥ 2 catatan"));
      tiles.push(statTile("Rata-rata / hari", fmtNum(a.recentPerDay != null ? a.recentPerDay : a.avgPerDay), unit, a.recentPerDay != null ? "7 hari terakhir" + (a.avgPerDay != null ? " · semua " + fmtNum(a.avgPerDay) : "") : "seluruh data"));
      if (item.type === "sisa") {
        const warn = a.daysLeft != null && a.daysLeft <= 3;
        tiles.push(statTile("Perkiraan habis", a.daysLeft != null ? fmtDaysLeft(a.daysLeft) : "–", "", a.emptyAt ? escapeHtml(fmtDate(a.emptyAt)) + " · " + fmtTime(a.emptyAt) : "belum terhitung", warn));
      } else {
        tiles.push(statTile("Total tercatat", fmtNum(a.totalUsage), unit, a.totalMs ? "dlm " + fmtDuration(a.totalMs) : ""));
      }
      html += '<div class="stat-grid">' + tiles.join("") + "</div>";
    }

    if (a.valid.length === 0) {
      html +=
        '<div class="chart-card"><p class="chart-title">Belum bisa dianalisis</p>' +
        '<p class="chart-empty">' +
        (item.records.length < 2
          ? "Butuh minimal 2 catatan. Contoh: catat sisa token malam ini, lalu besok malam di jam yang sama."
          : "Belum ada selisih yang valid antar catatan. Cek lagi angka & kolom isi ulang di catatanmu.") +
        "</p></div>";
    } else {
      // ---- Harian: 14 hari terakhir ----
      const dayBars = [];
      let sum14 = 0;
      let cov14 = 0;
      for (let i = 13; i >= 0; i--) {
        const ds = addDays(today, -i);
        const d = a.days[dayKey(ds)];
        const dt = new Date(ds);
        const label = i === 0 ? "Ini" : String(dt.getDate());
        let tip;
        if (d) {
          sum14 += d.usage;
          cov14 += d.covered;
          const partial = d.covered < DAY - 60000;
          tip =
            "<strong>" + WEEKDAYS_LONG[dt.getDay()] + ", " + dt.getDate() + " " + MONTHS_LONG[dt.getMonth()] + "</strong> — " +
            withUnit(d.usage, unit) +
            (partial ? " (data " + fmtDuration(d.covered) + " dari 24 jam)" : "");
        } else {
          tip = "<strong>" + WEEKDAYS_LONG[dt.getDay()] + ", " + dt.getDate() + " " + MONTHS_LONG[dt.getMonth()] + "</strong> — belum ada data";
        }
        dayBars.push({ label, value: d ? d.usage : null, tip, current: i === 0 });
      }
      const avg14 = cov14 > 0 ? sum14 / (cov14 / DAY) : null;
      html +=
        '<div class="chart-card">' +
        '<p class="chart-title">Pemakaian per Hari</p>' +
        '<p class="chart-subtitle">14 hari terakhir · ' + escapeHtml(unit || "satuan") + " per hari · garis putus-putus = rata-rata</p>" +
        barChartHTML(dayBars, {
          ref: avg14,
          defaultTip: "Total 14 hari <strong>" + withUnit(sum14, unit) + "</strong> · rata-rata <strong>" + withUnit(avg14, unit) + "</strong>/hari. Ketuk batang utk detail.",
        }) +
        "</div>";

      // ---- Per hari dalam seminggu ----
      const wkBars = WEEK_ORDER.map((w) => {
        const d = a.weekdays[w];
        const days = d.covered / DAY;
        const value = d.covered >= 6 * HOUR ? d.usage / days : null;
        return {
          label: WEEKDAYS_SHORT[w],
          value,
          current: w === new Date(now).getDay(),
          tip: "<strong>" + WEEKDAYS_LONG[w] + "</strong> — " + (value != null ? "rata-rata " + withUnit(value, unit) + "/hari (dari ≈ " + fmtNum(days, 1) + " hari data)" : "belum cukup data"),
        };
      });
      const wkValues = wkBars.filter((b) => b.value != null);
      let wkDefault = "Rata-rata pemakaian tiap hari dalam seminggu. Ketuk batang utk detail.";
      if (wkValues.length >= 2) {
        const hi = wkValues.reduce((m, b) => (b.value > m.value ? b : m));
        const lo = wkValues.reduce((m, b) => (b.value < m.value ? b : m));
        const hiName = WEEKDAYS_LONG[WEEKDAYS_SHORT.indexOf(hi.label)];
        const loName = WEEKDAYS_LONG[WEEKDAYS_SHORT.indexOf(lo.label)];
        wkDefault = "Paling boros <strong>" + hiName + "</strong> (" + withUnit(hi.value, unit) + "), paling hemat <strong>" + loName + "</strong> (" + withUnit(lo.value, unit) + ").";
      }
      html +=
        '<div class="chart-card">' +
        '<p class="chart-title">Per Hari dalam Seminggu</p>' +
        '<p class="chart-subtitle">Rata-rata ' + escapeHtml(unit || "") + " per hari · garis putus-putus = rata-rata semua hari</p>" +
        barChartHTML(wkBars, { ref: a.avgPerDay, defaultTip: wkDefault }) +
        "</div>";

      // ---- Per waktu (blok 6 jam) ----
      let blockHTML;
      if (a.shortCount >= 3) {
        const blBars = a.blocks.map((b, i) => {
          const value = b.covered >= HOUR ? b.usage / (b.covered / HOUR) : null;
          return {
            label: TIME_BLOCKS[i].label,
            value,
            current: Math.floor(new Date(now).getHours() / 6) === i,
            tip: "<strong>" + TIME_BLOCKS[i].label + " (" + TIME_BLOCKS[i].range + ")</strong> — " + (value != null ? "rata-rata " + withUnit(value, unit) + "/jam" : "belum cukup data"),
          };
        });
        blockHTML = barChartHTML(blBars, {
          ref: a.avgPerDay != null ? a.avgPerDay / 24 : 0,
          defaultTip: "Rata-rata pemakaian per jam di tiap waktu. Ketuk batang utk detail.",
        });
      } else {
        blockHTML = '<p class="chart-empty">Supaya pola per waktu kelihatan, catat beberapa kali sehari (mis. pagi sebelum berangkat & malam sebelum tidur). Butuh minimal 3 selisih catatan yang jaraknya ≤ 12 jam.</p>';
      }
      html +=
        '<div class="chart-card">' +
        '<p class="chart-title">Per Waktu</p>' +
        '<p class="chart-subtitle">' + escapeHtml(unit || "") + " per jam · garis putus-putus = rata-rata per jam</p>" +
        blockHTML +
        "</div>";

      // ---- Bulanan ----
      html +=
        '<div class="chart-card">' +
        '<p class="chart-title">Rekap Bulanan</p>' +
        '<div class="month-list">' +
        a.months
          .map(
            (m) =>
              '<div class="month-row">' +
              '<span class="month-name">' + MONTHS_LONG[m.month] + " " + m.year + '<br><span class="month-meta">≈ ' + fmtNum(m.covered / DAY, 1) + " hari data · " + fmtNum(m.usage / (m.covered / DAY)) + "/hari</span></span>" +
              '<span class="month-total">' + withUnit(m.usage, unit) + "</span>" +
              "</div>"
          )
          .join("") +
        "</div>" +
        (item.type === "sisa" && a.topupTotal > 0 ? '<p class="chart-subtitle" style="margin-top:8px">Total isi ulang tercatat: ' + withUnit(a.topupTotal, unit) + "</p>" : "") +
        "</div>";
    }

    // ---- Catatan terbaru ----
    const latest = [...item.records].reverse().slice(0, 8);
    html += '<div class="section-heading"><h3>Catatan Terbaru</h3></div>';
    html += latest.length
      ? '<div class="record-list">' + latest.map((r) => recordItemHTML(item, r, a.intervalByRec[r.id], false)).join("") + "</div>" +
        (item.records.length > latest.length ? '<button type="button" class="btn-secondary see-all-btn" id="seeAllRecordsBtn">Lihat semua ' + item.records.length + " catatan</button>" : "")
      : '<p class="empty-state">Belum ada catatan. Tekan + di bawah utk mencatat.</p>';

    body.innerHTML = html;
  }

  document.getElementById("analysisChips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    selectItem(chip.dataset.id);
    renderAnalysis();
  });

  const analysisBody = document.getElementById("analysisBody");

  analysisBody.addEventListener("click", (e) => {
    const col = e.target.closest(".bar-col");
    if (col) {
      setReadout(col);
      return;
    }
    const item = findItem(selectedItemId);
    if (!item) return;
    if (e.target.closest("#editItemBtn")) {
      openItemModal(item);
      return;
    }
    if (e.target.closest("#deleteItemBtn")) {
      openConfirm("Hapus Item?", 'Hapus "' + item.name + '"? Semua ' + item.records.length + " catatan di dalamnya ikut terhapus.", () => {
        deleteItem(item.id).catch(onWriteError("menghapus item"));
      });
      return;
    }
    if (e.target.closest("#seeAllRecordsBtn")) {
      historyFilter = item.id;
      renderHistory();
      goToPage("history");
      return;
    }
    const rec = e.target.closest(".record-item");
    if (rec) openRecordFromEl(rec);
  });

  // Hover (mouse) juga mengisi readout; keluar dari chart → balik ke ringkasan
  analysisBody.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse") return;
    const col = e.target.closest(".bar-col");
    if (col) setReadout(col);
  });
  analysisBody.addEventListener("pointerout", (e) => {
    if (e.pointerType !== "mouse") return;
    const chart = e.target.closest(".bar-chart");
    if (chart && !chart.contains(e.relatedTarget)) resetReadout(chart.closest(".chart-card"));
  });

  /* ================= Render: Riwayat ================= */

  function renderHistory() {
    renderChips("historyChips", historyFilter, true);
    document.getElementById("historyChips").hidden = items.length <= 1;

    const all = [];
    items.forEach((item) => {
      if (historyFilter !== "all" && historyFilter !== item.id) return;
      const intervalByRec = {};
      buildIntervals(item).forEach((iv) => (intervalByRec[iv.recId] = iv));
      item.records.forEach((rec) => all.push({ item, rec, iv: intervalByRec[rec.id] }));
    });
    all.sort((x, y) => y.rec.recordedAt - x.rec.recordedAt);

    const el = document.getElementById("historyList");
    if (!all.length) {
      el.innerHTML = '<p class="empty-state">Belum ada catatan.</p>';
      return;
    }

    let html = "";
    let currentDay = null;
    all.forEach(({ item, rec, iv }) => {
      const day = startOfDay(rec.recordedAt);
      if (day !== currentDay) {
        if (currentDay !== null) html += "</div>";
        currentDay = day;
        html += '<p class="history-group-label">' + escapeHtml(dayLabel(rec.recordedAt)) + '</p><div class="record-list">';
      }
      html += recordItemHTML(item, rec, iv, true);
    });
    html += "</div>";
    el.innerHTML = html;
  }

  document.getElementById("historyChips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    historyFilter = chip.dataset.id;
    renderHistory();
  });

  document.getElementById("historyList").addEventListener("click", (e) => {
    const rec = e.target.closest(".record-item");
    if (rec) openRecordFromEl(rec);
  });

  function openRecordFromEl(el) {
    const item = findItem(el.dataset.item);
    const rec = item && item.records.find((r) => r.id === el.dataset.id);
    if (rec) openRecordModal(rec, item.id);
  }

  /* ================= Item modal (add/edit) ================= */

  const itemModal = document.getElementById("itemModal");
  const itemForm = document.getElementById("itemForm");
  let editingItemId = null;

  document.getElementById("itemIconPicker").innerHTML = ICONS.map(
    (ic) => '<label><input type="radio" name="itemIcon" value="' + ic + '"><span>' + ic + "</span></label>"
  ).join("");

  function setRadio(name, value) {
    const el = itemForm.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (el) el.checked = true;
    else {
      const first = itemForm.querySelector('input[name="' + name + '"]');
      if (first) first.checked = true;
    }
  }

  function openItemModal(item) {
    editingItemId = item ? item.id : null;
    document.getElementById("itemModalTitle").textContent = item ? "Ubah Item" : "Item Baru";
    document.getElementById("itemNameInput").value = item ? item.name : "";
    document.getElementById("itemUnitInput").value = item ? item.unit : "";
    setRadio("itemIcon", item ? item.icon : ICONS[0]);
    setRadio("itemType", item ? item.type : "sisa");
    itemModal.classList.add("open");
  }

  function closeItemModal() {
    itemModal.classList.remove("open");
    editingItemId = null;
  }

  document.getElementById("cancelItemBtn").addEventListener("click", closeItemModal);
  itemModal.addEventListener("click", (e) => {
    if (e.target === itemModal) closeItemModal();
  });

  itemForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("itemNameInput").value.trim();
    if (!name) return;
    const data = {
      name,
      unit: document.getElementById("itemUnitInput").value.trim(),
      icon: (itemForm.querySelector('input[name="itemIcon"]:checked') || {}).value || ICONS[0],
      type: (itemForm.querySelector('input[name="itemType"]:checked') || {}).value === "meteran" ? "meteran" : "sisa",
    };
    const action = editingItemId ? updateItem(editingItemId, data) : addItem(data);
    action.catch(onWriteError("menyimpan item"));
    closeItemModal();
  });

  /* ================= Record modal (catat / ubah) ================= */

  const recordModal = document.getElementById("recordModal");
  const recordForm = document.getElementById("recordForm");
  const recItemInput = document.getElementById("recordItemInput");
  const recDateInput = document.getElementById("recordDateInput");
  const recTimeInput = document.getElementById("recordTimeInput");
  const recValueInput = document.getElementById("recordValueInput");
  const recTopupInput = document.getElementById("recordTopupInput");
  const recNoteInput = document.getElementById("recordNoteInput");
  const recPreview = document.getElementById("recordPreview");
  let editingRecord = null; // { record, itemId }

  function setDateTimeInputs(ts) {
    const d = new Date(ts);
    recDateInput.value = d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
    recTimeInput.value = pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  function readDateTimeInputs() {
    const dp = recDateInput.value.split("-").map(Number);
    const tp = recTimeInput.value.split(":").map(Number);
    if (dp.length !== 3 || tp.length < 2 || dp.some(isNaN) || tp.some(isNaN)) return null;
    return new Date(dp[0], dp[1] - 1, dp[2], tp[0], tp[1], 0, 0).getTime();
  }

  function updateRecordFormForItem() {
    const item = findItem(recItemInput.value);
    if (!item) return;
    const unitSuffix = item.unit ? " (" + item.unit + ")" : "";
    document.getElementById("recordValueLabel").textContent = TYPE_INFO[item.type].valueLabel + unitSuffix;
    document.getElementById("recordTopupLabel").textContent = "Isi ulang" + unitSuffix + " (opsional)";
    document.getElementById("recordTopupField").hidden = item.type !== "sisa";
    updateRecordPreview();
  }

  // Preview pemakaian sejak catatan sebelumnya — sekaligus "rem" typo.
  function updateRecordPreview() {
    const item = findItem(recItemInput.value);
    const value = parseNum(recValueInput.value);
    const ts = readDateTimeInputs();
    recPreview.hidden = true;
    recPreview.classList.remove("warn");
    if (!item || value == null || ts == null) return;

    const editingId = editingRecord ? editingRecord.record.id : null;
    const prev = item.records.filter((r) => r.id !== editingId && r.recordedAt < ts).pop();
    if (!prev) return;

    const topup = item.type === "sisa" ? parseNum(recTopupInput.value) || 0 : 0;
    const usage = item.type === "meteran" ? value - prev.value : prev.value + topup - value;
    const dt = ts - prev.recordedAt;
    const prevText = "sebelumnya " + withUnit(prev.value, item.unit) + " (" + escapeHtml(fmtDateTime(prev.recordedAt)) + ")";

    recPreview.hidden = false;
    if (usage < 0) {
      recPreview.classList.add("warn");
      recPreview.innerHTML =
        "⚠️ " + (item.type === "sisa" ? "Lebih besar dari " + prevText + ". Kalau barusan isi ulang, isi kolom <strong>Isi ulang</strong>." : "Lebih kecil dari " + prevText + ". Cek lagi angkanya.");
    } else {
      recPreview.innerHTML =
        "Terpakai <strong>" + withUnit(usage, item.unit) + "</strong> dlm " + fmtDuration(dt) + " (≈ " + fmtNum(usage / (dt / DAY)) + "/hari) — " + prevText + ".";
    }
  }

  function openRecordModal(record, itemId) {
    if (!items.length) {
      openItemModal(null);
      return;
    }
    const targetItemId = findItem(itemId) ? itemId : selectedItemId || items[0].id;
    editingRecord = record ? { record, itemId: targetItemId } : null;

    recItemInput.innerHTML = items.map((it) => '<option value="' + it.id + '">' + escapeHtml(it.icon + " " + it.name) + "</option>").join("");
    recItemInput.value = targetItemId;
    document.getElementById("recordModalTitle").textContent = record ? "Ubah Catatan" : "Catat";
    setDateTimeInputs(record ? record.recordedAt : Date.now());
    recValueInput.value = record ? fmtNum(record.value, 3) : "";
    recTopupInput.value = record && record.topup ? fmtNum(record.topup, 3) : "";
    recNoteInput.value = record ? record.note : "";
    document.getElementById("deleteRecordBtn").hidden = !record;

    updateRecordFormForItem();
    recordModal.classList.add("open");
    if (!record) setTimeout(() => recValueInput.focus(), 250);
  }

  function closeRecordModal() {
    recordModal.classList.remove("open");
    editingRecord = null;
  }

  recItemInput.addEventListener("change", updateRecordFormForItem);
  [recDateInput, recTimeInput, recValueInput, recTopupInput].forEach((el) => el.addEventListener("input", updateRecordPreview));
  document.getElementById("recordNowBtn").addEventListener("click", () => {
    setDateTimeInputs(Date.now());
    updateRecordPreview();
  });

  document.getElementById("cancelRecordBtn").addEventListener("click", closeRecordModal);
  recordModal.addEventListener("click", (e) => {
    if (e.target === recordModal) closeRecordModal();
  });

  document.getElementById("deleteRecordBtn").addEventListener("click", () => {
    if (!editingRecord) return;
    const { record, itemId } = editingRecord;
    const item = findItem(itemId);
    openConfirm("Hapus Catatan?", "Hapus catatan " + withUnit(record.value, item ? item.unit : "") + " (" + fmtDateTime(record.recordedAt) + ")?", () => {
      deleteRecord(itemId, record.id).catch(onWriteError("menghapus catatan"));
      closeRecordModal();
    });
  });

  recordForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const item = findItem(recItemInput.value);
    if (!item) return;

    const recordedAt = readDateTimeInputs();
    if (recordedAt == null) {
      alert("Tanggal/jam belum valid.");
      return;
    }
    if (recordedAt > Date.now() + 5 * 60000) {
      alert("Waktu catatan tidak boleh di masa depan.");
      return;
    }
    const value = parseNum(recValueInput.value);
    if (value == null || value < 0) {
      alert("Angka belum valid. Contoh: 45,6");
      return;
    }
    const topupRaw = item.type === "sisa" ? parseNum(recTopupInput.value) : null;
    if (topupRaw != null && topupRaw < 0) {
      alert("Isi ulang tidak boleh minus.");
      return;
    }

    const data = {
      value,
      topup: item.type === "sisa" ? topupRaw || 0 : null,
      recordedAt,
      note: recNoteInput.value.trim() || null,
    };

    selectItem(item.id);
    let action;
    if (editingRecord) {
      action = updateRecord(editingRecord.itemId, item.id, editingRecord.record, data);
    } else {
      // .set() pada record baru: field null otomatis tidak ditulis
      action = addRecord(item.id, data);
    }
    action.catch(onWriteError("menyimpan catatan"));
    closeRecordModal();
  });

  document.getElementById("navAdd").addEventListener("click", () => openRecordModal(null, selectedItemId));

  /* ================= Generic confirm dialog ================= */

  const confirmModal = document.getElementById("confirmModal");
  let pendingConfirmAction = null;

  function openConfirm(title, text, onConfirm) {
    document.getElementById("confirmTitle").textContent = title;
    document.getElementById("confirmText").textContent = text;
    pendingConfirmAction = onConfirm;
    confirmModal.classList.add("open");
  }

  function closeConfirm() {
    confirmModal.classList.remove("open");
    pendingConfirmAction = null;
  }

  document.getElementById("cancelDeleteBtn").addEventListener("click", closeConfirm);
  confirmModal.addEventListener("click", (e) => {
    if (e.target === confirmModal) closeConfirm();
  });
  document.getElementById("confirmDeleteBtn").addEventListener("click", () => {
    const action = pendingConfirmAction;
    closeConfirm();
    if (action) action();
  });

  /* ================= Utilities ================= */

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  /* ================= Wiring ================= */

  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      goToPage(el.dataset.nav);
    });
  });

  document.getElementById("themeToggle").addEventListener("click", toggleTheme);
  document.getElementById("settingsThemeToggle").addEventListener("click", toggleTheme);

  // Estimasi "sekarang" & "x jam lalu" bergantung waktu — refresh tiap menit
  setInterval(renderAll, 60000);

  /* ================= Init ================= */

  initTheme();
  subscribePantau();
})();
