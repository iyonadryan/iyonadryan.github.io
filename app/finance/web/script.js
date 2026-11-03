/* =========================================================
   Finance App (Desktop) — script.js
   Versi web desktop dari app/finance/ (mobile). Membaca &
   menulis data Firebase yang SAMA PERSIS (path `finance/...`),
   dengan aturan tulis yang sama (key transaksi = tanggal+waktu
   +1, field waktu/timestamp/by, rencana global per
   periode+kategori, kategori di `categories/<type>/<id>`).
   Migrasi data lama TIDAK dijalankan di sini — itu tugas versi
   mobile; desktop cuma baca/tulis bentuk data terbaru.
   ========================================================= */

(function () {
  "use strict";

  /* ---------------- Konstanta ---------------- */

  // Key localStorage sama dgn versi mobile, jadi tema & user aktif ikut
  // tersinkron kalau dibuka di browser yang sama.
  const STORAGE_KEYS = {
    theme: "financeapp_theme",
    user: "financeapp_user",
  };

  // "both" cuma mode TAMPILAN — tidak pernah jadi nilai data.by.
  // slot = warna avatar (var(--series-N)).
  const USERS = {
    iyon: { label: "Iyon", ini: "I", slot: 1 },
    ciwul: { label: "Ciwul", ini: "C", slot: 5 },
  };
  const USER_MODES = ["iyon", "ciwul", "both"];

  // Kategori khusus (hanya untuk Rencana): budget gabungan seluruh pengeluaran.
  // Tidak disimpan di Firebase (sama spt mobile).
  const ALL_CATEGORY = { id: "semua", label: "Semua", icon: "🗂️", colorSlot: 1 };
  const UNKNOWN_CATEGORY_ID = "__unknown__";
  const SERIES_SLOT_COUNT = 10;

  const PLAN_PERIODS = ["harian", "mingguan", "bulanan", "weekday", "weekend"];
  const PERIOD_LABELS = {
    harian: "Harian",
    mingguan: "Mingguan",
    bulanan: "Bulanan",
    weekday: "Weekday",
    weekend: "Weekend",
  };

  const MONTH_NAMES = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const DOW_SHORT = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  const DOW_LONG = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

  const TYPE_LABELS = { income: "Pemasukan", expense: "Pengeluaran", transfer: "Pindah account" };

  // Account type (V2) — sumber uang tiap transaksi. Record lama = bank.
  const ACCOUNTS = [
    { id: "bank", label: "Bank", icon: "🏦", desc: "Rekening bank (BCA, Mandiri, dll)" },
    { id: "cash", label: "Cash", icon: "💵", desc: "Uang tunai / dompet fisik" },
    { id: "e_money", label: "E-Money", icon: "📱", desc: "Dompet digital (GoPay, OVO, DANA, dll)" },
  ];
  const ACCOUNT_BY_ID = ACCOUNTS.reduce((m, a) => ((m[a.id] = a), m), {});
  const ACCOUNT_TABS = [{ id: "all", label: "Semua", icon: "🗂️" }].concat(ACCOUNTS);

  const MASKED_AMOUNT = "Rp ••••••";

  const VIEWS = {
    dashboard: ["Dashboard", "Ringkasan keuangan bulan ini"],
    transactions: ["Transaksi", "Semua pemasukan dan pengeluaran"],
    analysis: ["Analisis", "Bandingkan pengeluaran antar dua rentang waktu"],
    plans: ["Rencana Anggaran", "Batas pengeluaran per kategori dan periode"],
    categories: ["Kategori", "Kelola kategori pengeluaran dan pemasukan"],
    settings: ["Info", "Tentang aplikasi dan daftar aplikasi lainnya"],
    nota: ["Nota Baru", "Satu transaksi berisi banyak item"],
  };
  // Pindah account AKTIF (keputusan user, 2 Nov 2026) walau web mobile
  // belum diperbarui — di klien lama transaksi "pindah" terbaca sbg
  // pengeluaran sebesar nominal (risiko diterima). Set ke false untuk
  // mengunci lagi. Record pindah yang sudah ada tetap dibaca walau false.
  const ENABLE_TRANSFER = true;
  // Halaman yang datanya terikat ke bulan terpilih (tampilkan navigasi bulan).
  const MONTH_VIEWS = ["dashboard", "transactions", "plans"];

  const ICON = {
    eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
    eyeOff: "M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.8M6.6 6.7C3.7 8.5 2 12 2 12s3.5 7 10 7c1.5 0 2.8-.3 4-.8M9.9 9.9a3 3 0 0 0 4.2 4.2",
    moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
    sun: "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
    edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
    trash: "M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6",
    grip: "M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01",
    chevL: "M15 6l-6 6 6 6",
    chevR: "M9 6l6 6-6 6",
  };

  /* ---------------- State ---------------- */

  let transactions = []; // diisi realtime dari Firebase
  let plans = [];
  let CATEGORIES = { expense: [], income: [] };

  let currentView = "dashboard";
  let currentUser = storageGet(STORAGE_KEYS.user);
  if (USER_MODES.indexOf(currentUser) === -1) currentUser = "both";

  let viewDate = new Date();
  viewDate.setDate(1); // selalu tgl 1 supaya geser bulan tidak loncat (31 → bulan berikutnya)
  let balanceVisible = false; // tersembunyi tiap buka app (sama spt mobile)

  let dashRange = "week"; // grafik Perbandingan Pengeluaran: "week" | "month"
  let acctFilter = "all"; // tab Account Type — dibagi Dashboard & Transaksi

  let txTypeFilter = "all";
  let filterCats = [];
  let filterAccts = []; // filter Account Type (multi) di modal Filter; [] = semua
  let filterFrom = null; // filter rentang hari (angka tanggal) dalam bulan aktif
  let filterTo = null;
  let selectedTxId = null;
  let txSearch = "";
  let txPage = 1;
  let txLimit = 10; // baris per halaman: 10 | 25 | 50
  let txJumpToSelected = false; // buka halaman yang memuat selectedTxId (dari klik Transaksi Terbaru)
  const TX_LIMITS = [10, 25, 50];

  let anaPreset = "month"; // "month" | "week" | "half" | "custom"
  let anaCustom = null;    // { a: [start, end], b: [start, end] } saat custom
  let anaSwap = false;

  let currentPeriod = "semua"; // tab Rencana; default "Semua" (= ALL_PERIODS_TAB)

  /* ================= Firebase data layer ================= */

  // V2: perhitungan murni di FinanceCore (finance-core.js), tulis record
  // berkode lewat FinanceData (finance-data.js). Lihat docs/v2-plan.md.
  const Core = window.FinanceCore;
  const Data = FinanceData.create(db, FINANCE_PATH);
  const financeRef = db.ref(FINANCE_PATH);

  let counters = {}; // /finance/counters — hanya utk pratinjau kode di form

  // Status koneksi: counter kode butuh server (transaction()), jadi simpan
  // diblokir dgn pesan jelas kalau sedang offline. null = belum diketahui.
  let online = null;
  db.ref(".info/connected").on("value", (s) => (online = !!s.val()));

  function requireOnline() {
    if (online === false) {
      alert("Butuh koneksi internet untuk membuat kode transaksi. Coba lagi setelah online.");
      return false;
    }
    return true;
  }

  function subscribeFinance() {
    financeRef.on(
      "value",
      (snapshot) => {
        rebuildFromSnapshot(snapshot.val() || {});
        renderAll();
        hideLoading();
        if (pendingNotaHash) {
          const h = pendingNotaHash;
          pendingNotaHash = null;
          openNotaFromHash(h);
        }
      },
      (err) => {
        console.error("Gagal membaca data dari Firebase:", err);
        hideLoading();
      }
    );
  }

  function rebuildFromSnapshot(root) {
    const txs = [];
    const pl = [];

    Object.keys(root).forEach((topKey) => {
      if (topKey === "plans") {
        const plansObj = root.plans || {};
        PLAN_PERIODS.forEach((period) => {
          const periodObj = plansObj[period] || {};
          Object.keys(periodObj).forEach((cat) => {
            const p = periodObj[cat] || {};
            pl.push({
              // by = pembuat; target = transaksi siapa yang dihitung (iyon/ciwul/both).
              // Rencana lama tanpa target → ikut by (dulu by = pemilik rencana).
              id: period + "_" + cat, period, category: cat, by: p.by || "ciwul", target: p.target || p.by || "ciwul",
              limit: Number(p.limit) || 0, sort: Number(p.sort) || 0,
            });
          });
        });
      } else if (/^\d{4}-\d{2}$/.test(topKey)) {
        // Record V1 (key timestamp) & V2 (key kode) dinormalisasi jadi satu
        // bentuk: account_type kosong → bank, bentuk kosong → satuan, dst.
        const monthObj = root[topKey] || {};
        Object.keys(monthObj).forEach((key) => {
          const t = monthObj[key];
          if (t && typeof t === "object") txs.push(Core.normalizeRecord(topKey, key, t));
        });
      }
    });

    transactions = txs;
    plans = pl;
    counters = root.counters || {};

    const categoriesObj = root.categories || {};
    const bySlot = (a, b) => (Number(a.colorSlot) || 0) - (Number(b.colorSlot) || 0);
    CATEGORIES = {
      expense: Object.values(categoriesObj.expense || {}).sort(bySlot),
      income: Object.values(categoriesObj.income || {}).sort(bySlot),
    };
  }

  // Transaksi satuan baru → key = kode (TB-202611-000001, dst). Nomor urut
  // atomik lewat counter; bulan kode & node ikut `tanggal`. Resolve → kode.
  function addSatuan(f) {
    const { errors, record } = Core.buildSatuan(Object.assign({ timestamp: Date.now() }, f));
    if (errors.length) return Promise.reject(new Error(errors.join(" ")));
    return Data.saveNew(record);
  }

  // Edit = update field yang berubah saja (bukan .set()), jadi field V2 lain
  // tidak hilang. kode/tanggal/account_type/bentuk dikunci di FinanceData.
  function updateTransaction(tx, fields) {
    return Data.update(tx.ym, tx.id, fields);
  }

  function deleteTransaction(tx) {
    return Data.remove(tx.ym, tx.id);
  }

  // Pratinjau kode di form (counter saat ini + 1 — bukan jaminan, kode final
  // ditentukan saat simpan).
  function previewKode(rec) {
    try {
      const key = Core.counterKey(Core.kodePrefix(rec), Core.yyyymmOf(rec.tanggal));
      return Core.previewKode(rec, counters[key]);
    } catch (e) {
      return "—";
    }
  }

  function savePlan(period, category, limit, sort, by, target) {
    return db.ref(FINANCE_PATH + "/plans/" + period + "/" + category).set({
      category,
      limit,
      sort: sort || 0,
      by,
      target,
    });
  }

  function nextSortForPeriod(period) {
    const inPeriod = plans.filter((p) => p.period === period);
    return inPeriod.length ? Math.max.apply(null, inPeriod.map((p) => p.sort)) + 1 : 0;
  }

  function deletePlan(plan) {
    return db.ref(FINANCE_PATH + "/plans/" + plan.period + "/" + plan.category).remove();
  }

  function saveCategory(type, data) {
    return db.ref(FINANCE_PATH + "/categories/" + type + "/" + data.id).set({
      id: data.id,
      label: data.label,
      icon: data.icon,
      colorSlot: data.colorSlot,
    });
  }

  function deleteCategory(type, id) {
    return db.ref(FINANCE_PATH + "/categories/" + type + "/" + id).remove();
  }

  function reportWriteError(what) {
    return (err) => {
      console.error("Gagal " + what + ":", err);
      alert("Gagal " + what + ". Cek koneksi internet.");
    };
  }

  /* ================= Utilities ================= */

  function $(id) {
    return document.getElementById(id);
  }

  function storageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      /* abaikan — preferensi saja */
    }
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  // "YYYY-MM-DD" waktu lokal (bukan UTC spt toISOString()).
  function localDateStrOf(ms) {
    const d = new Date(ms);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function todayStr() {
    return localDateStrOf(Date.now());
  }

  // "HH:MM:SS" waktu lokal.
  function formatTime(ms) {
    const d = new Date(ms);
    return pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
  }

  function ymOf(dateStr) {
    return String(dateStr).slice(0, 7);
  }

  function viewYm() {
    return viewDate.getFullYear() + "-" + pad2(viewDate.getMonth() + 1);
  }

  function daysInMonth(y, m0) {
    return new Date(y, m0 + 1, 0).getDate();
  }

  function monthLabel(date) {
    return MONTH_NAMES[date.getMonth()] + " " + date.getFullYear();
  }

  // Aritmetika tanggal via nomor hari (UTC) — bebas masalah zona waktu/DST.
  function dayNum(iso) {
    const p = String(iso).split("-").map(Number);
    return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000);
  }

  function isoOfDay(n) {
    return new Date(n * 86400000).toISOString().slice(0, 10);
  }

  // 0 = Senin … 6 = Minggu
  function dowOf(iso) {
    return (new Date(dayNum(iso) * 86400000).getUTCDay() + 6) % 7;
  }

  function shortDate(iso) {
    const p = String(iso).split("-").map(Number);
    return p[2] + " " + MONTH_SHORT[p[1] - 1];
  }

  function longDate(iso) {
    const p = String(iso).split("-").map(Number);
    return p[2] + " " + MONTH_NAMES[p[1] - 1] + " " + p[0];
  }

  function shortDateYear(iso) {
    return shortDate(iso) + " " + String(iso).slice(0, 4);
  }

  function formatCurrency(value) {
    const n = Math.round(value);
    return (n < 0 ? "−" : "") + "Rp " + Math.abs(n).toLocaleString("id-ID");
  }

  function money(value) {
    return balanceVisible ? formatCurrency(value) : MASKED_AMOUNT;
  }

  function fmtK(v) {
    if (v === 0) return "0";
    if (v >= 1e9) return String(v / 1e9).replace(".", ",") + "M";
    if (v >= 1e6) return String(v / 1e6).replace(".", ",") + "jt";
    return v / 1e3 + "k";
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sumAmount(list) {
    return list.reduce((s, t) => s + t.amount, 0);
  }

  function parseAmount(str) {
    return Number(String(str).replace(/\D/g, "")) || 0;
  }

  // Format ribuan realtime saat mengetik (sama spt mobile).
  function formatAmountInput(input) {
    const n = parseAmount(input.value);
    input.value = n ? n.toLocaleString("id-ID") : "";
  }

  // Tile/label untuk transaksi pindah (tidak punya kategori).
  const TRANSFER_CATEGORY = { id: "__transfer__", label: "Pindah account", icon: "⇄", colorSlot: 9 };

  function findCategory(type, id) {
    if (type === "transfer") return TRANSFER_CATEGORY;
    if (id === ALL_CATEGORY.id) return ALL_CATEGORY;
    return CATEGORIES[type].find((c) => c.id === id) || { id, label: id || "Tanpa kategori", icon: "❓", colorSlot: 1 };
  }

  function categoryExists(type, id) {
    return CATEGORIES[type].some((c) => c.id === id);
  }

  function slotOf(cat) {
    const s = Number(cat && cat.colorSlot) || 1;
    return Math.min(SERIES_SLOT_COUNT, Math.max(1, s));
  }

  function catColor(cat) {
    return "var(--series-" + slotOf(cat) + ")";
  }

  function tileHtml(cat, size) {
    return '<div class="tile" style="--tile:' + catColor(cat) + ";--size:" + size + 'px"><span aria-hidden="true">' +
      escapeHtml(cat.icon) + "</span></div>";
  }

  function userModeLabel(id) {
    return id === "both" ? "Both" : USERS[id] ? USERS[id].label : id;
  }

  function avatarHtml(by, size) {
    if (by === "both") return '<span class="avatar avatar-both" style="--size:' + size + 'px" title="Both">B</span>';
    const u = USERS[by];
    if (!u) return "";
    return '<span class="avatar" style="--av:var(--series-' + u.slot + ");--size:" + size + 'px" title="' + u.label + '">' + u.ini + "</span>";
  }

  function svgIcon(path, size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + path + '"/></svg>';
  }

  function isLainnyaCategory(id) {
    return id === "lainnya-keluar" || id === "lainnya-masuk";
  }

  function visibleTransactions() {
    return currentUser === "both" ? transactions : transactions.filter((t) => t.by === currentUser);
  }

  // + filter tab Account Type (Dashboard & Transaksi). Pindah tampil di tab
  // asal & tujuan; record lama tanpa account_type = bank.
  function scopedTransactions() {
    return visibleTransactions().filter((t) => Core.matchesAccount(t, acctFilter));
  }

  // Waktu input (field timestamp) — dipakai "Transaksi Terbaru".
  function txTime(tx) {
    return tx.timestamp || 0;
  }

  // Urut kronologis tanggal + waktu transaksi, tie-break timestamp (key kode
  // dikelompokkan per prefix, jadi tidak bisa dipakai sbg urutan).
  const compareTxMoment = Core.compareChrono;

  function accountLabel(id) {
    return ACCOUNT_BY_ID[id] ? ACCOUNT_BY_ID[id].label : id || "—";
  }

  // Tab Account Type (Semua | Bank | Cash | E-Money) — satu state dipakai
  // bareng Dashboard & Transaksi.
  function renderAccountTabs(container, onChange) {
    container.innerHTML = ACCOUNT_TABS.map((a) => {
      const on = a.id === acctFilter;
      return '<button type="button" role="tab" class="acct-tab' + (on ? " active" : "") + '" aria-selected="' + on + '" data-acct="' + a.id + '">' +
        '<span aria-hidden="true">' + a.icon + "</span>" + a.label + "</button>";
    }).join("");
    container.querySelectorAll("[data-acct]").forEach((b) =>
      b.addEventListener("click", () => {
        acctFilter = b.dataset.acct;
        txPage = 1;
        selectedTxId = null;
        onChange();
      })
    );
  }

  // Pindah: di tab account asal tampil keluar (nominal + biaya admin), di tab
  // tujuan tampil masuk, di "Semua" netral (⇄).
  function signedAmount(tx) {
    if (tx.type === "transfer") {
      if (acctFilter === tx.dari) return "− " + money(tx.amount + tx.fee);
      if (acctFilter === tx.ke) return "+ " + money(tx.amount);
      return "⇄ " + money(tx.amount);
    }
    return (tx.type === "income" ? "+ " : "− ") + money(tx.amount);
  }

  function amountClass(tx) {
    if (tx.type === "transfer") return acctFilter === tx.dari ? "amount-expense" : acctFilter === tx.ke ? "amount-income" : "amount-transfer";
    return tx.type === "income" ? "amount-income" : "amount-expense";
  }

  function transferRoute(tx) {
    return accountLabel(tx.dari) + " → " + accountLabel(tx.ke);
  }

  function txTitle(tx) {
    if (tx.type === "transfer") return tx.note || "Pindah " + transferRoute(tx);
    return tx.title || tx.note || findCategory(tx.type, tx.category).label;
  }

  // Kategori yg dikandung transaksi (nota: semua kategori item).
  function txCategoryIds(tx) {
    const keys = Object.keys(tx.rincian || {});
    return keys.length ? keys : [tx.category];
  }

  // Nota "beneran" (≥ 2 item) dapat badge & bisa dibuka; nota 1 item tampil spt satuan.
  function isMultiNota(tx) {
    return tx.bentuk === "nota" && tx.items.length > 1;
  }

  function formatQty(q) {
    return Number(q).toLocaleString("id-ID", { maximumFractionDigits: 3 });
  }

  /* ================= Shell: tema, user, navigasi, bulan ================= */

  function initTheme() {
    const saved = storageGet(STORAGE_KEYS.theme);
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (prefersDark ? "dark" : "light"));
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    storageSet(STORAGE_KEYS.theme, theme);
    const dark = theme === "dark";
    $("themeIconPath").setAttribute("d", dark ? ICON.sun : ICON.moon);
    $("themeLabel").textContent = dark ? "Mode terang" : "Mode gelap";
  }

  $("themeToggle").addEventListener("click", () => {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    applyTheme(dark ? "light" : "dark");
  });

  function setCurrentUser(id) {
    currentUser = id;
    storageSet(STORAGE_KEYS.user, id);
    selectedTxId = null;
    txPage = 1;
    renderAll();
  }

  function setView(view) {
    if (!VIEWS[view]) view = "dashboard";
    if (currentView === "nota" && view !== "nota" && !leaveNotaOk()) return;
    currentView = view;
    // Hash halaman nota di-set openNota() (bisa "#nota/<ym>/<kode>" saat edit).
    if (view !== "nota" && location.hash !== "#" + view) history.replaceState(null, "", "#" + view);
    renderAll();
    window.scrollTo(0, 0);
  }

  document.querySelectorAll(".nav-item[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });
  document.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.goto));
  });
  window.addEventListener("hashchange", () => {
    const v = location.hash.slice(1);
    if (v.split("/")[0] === "nota") {
      if (currentView !== "nota") openNotaFromHash(v);
    } else if (VIEWS[v] && v !== currentView) setView(v);
  });

  $("balanceToggle").addEventListener("click", () => {
    balanceVisible = !balanceVisible;
    renderAll();
  });

  function changeMonth(delta) {
    viewDate.setMonth(viewDate.getMonth() + delta);
    // Rentang tanggal terikat ke bulan tertentu → reset saat pindah bulan.
    filterFrom = null;
    filterTo = null;
    selectedTxId = null;
    txPage = 1;
    renderAll();
  }

  $("prevMonth").addEventListener("click", () => changeMonth(-1));
  $("nextMonth").addEventListener("click", () => changeMonth(1));

  function renderShell() {
    const navView = currentView === "nota" ? "transactions" : currentView;
    document.querySelectorAll(".nav-item[data-view]").forEach((btn) => {
      const on = btn.dataset.view === navView;
      btn.classList.toggle("active", on);
      if (on) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    document.querySelectorAll(".view").forEach((el) => {
      el.hidden = el.id !== "view-" + currentView;
    });

    const title = currentView === "nota" && nota && nota.tx ? "Edit Nota" : VIEWS[currentView][0];
    $("viewTitle").textContent = title;
    $("viewSub").textContent = VIEWS[currentView][1];
    document.title = title + " · Finance Desktop";
    $("userTabs").hidden = currentView === "nota"; // spt desain: halaman nota tanpa ganti user

    // Navigasi bulan, dibatasi ke rentang ym yang punya transaksi (spt mobile).
    $("monthNav").hidden = MONTH_VIEWS.indexOf(currentView) === -1;
    $("monthLabel").textContent = monthLabel(viewDate);
    const yms = visibleTransactions().map((t) => t.ym);
    const cur = viewYm();
    if (yms.length === 0) {
      $("prevMonth").disabled = true;
      $("nextMonth").disabled = true;
    } else {
      $("prevMonth").disabled = cur <= yms.reduce((a, b) => (b < a ? b : a));
      $("nextMonth").disabled = cur >= yms.reduce((a, b) => (b > a ? b : a));
    }

    const userTabs = $("userTabs");
    userTabs.innerHTML = USER_MODES.map((id) => {
      const label = userModeLabel(id);
      const on = currentUser === id;
      return '<button type="button" class="seg-btn' + (on ? " active" : "") + '" aria-pressed="' + on + '" data-user="' + id + '">' + label + "</button>";
    }).join("");
    userTabs.querySelectorAll("[data-user]").forEach((b) => b.addEventListener("click", () => setCurrentUser(b.dataset.user)));

    const me = $("meAvatar");
    if (currentUser === "both") {
      me.className = "avatar avatar-lg avatar-both";
      me.removeAttribute("style");
      me.textContent = "B";
      $("meLabel").textContent = "Both";
    } else {
      me.className = "avatar avatar-lg";
      me.style.setProperty("--av", "var(--series-" + USERS[currentUser].slot + ")");
      me.textContent = USERS[currentUser].ini;
      $("meLabel").textContent = USERS[currentUser].label;
    }

    const label = balanceVisible ? "Sembunyikan nominal" : "Tampilkan nominal";
    $("balanceToggle").setAttribute("aria-label", label);
    $("balanceToggle").title = label;
    $("balanceIconPath").setAttribute("d", balanceVisible ? ICON.eyeOff : ICON.eye);
  }

  function renderAll() {
    renderShell();
    if (currentView === "dashboard") renderDashboard();
    else if (currentView === "transactions") renderTransactions();
    else if (currentView === "analysis") renderAnalysis();
    else if (currentView === "plans") renderPlans();
    else if (currentView === "categories") renderCategories();
    else if (currentView === "nota") renderNotaSummary(); // form tidak di-render ulang (input sedang diketik)
  }

  function segTabsHtml(items, active, attr) {
    return items
      .map((x) => {
        const on = x[0] === active;
        return '<button type="button" class="seg-btn' + (on ? " active" : "") + '" aria-pressed="' + on + '" ' + attr + '="' + x[0] + '">' + x[1] + "</button>";
      })
      .join("");
  }

  /* ================= Loading overlay ================= */

  let loadingHidden = false;

  function hideLoading() {
    if (loadingHidden) return;
    loadingHidden = true;
    $("loadingOverlay").classList.add("hidden");
  }

  /* ================= Modal helpers ================= */

  const modalStack = [];

  function openModal(id) {
    const el = $(id);
    el.hidden = false;
    if (modalStack.indexOf(id) === -1) modalStack.push(id);
  }

  function closeModal(id) {
    $(id).hidden = true;
    const i = modalStack.indexOf(id);
    if (i !== -1) modalStack.splice(i, 1);
  }

  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    // Tutup kalau klik backdrop — tapi hanya kalau mousedown juga di backdrop
    // (supaya drag dari input keluar modal tidak ikut menutup).
    let downOnBackdrop = false;
    overlay.addEventListener("mousedown", (e) => {
      downOnBackdrop = e.target === overlay;
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay && downOnBackdrop) closeModal(overlay.id);
    });
    overlay.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(overlay.id));
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalStack.length) closeModal(modalStack[modalStack.length - 1]);
  });

  // Dialog konfirmasi hapus generik (transaksi / rencana / kategori).
  let confirmAction = null;

  function openConfirm(opts) {
    $("confirmTitle").textContent = opts.title;
    $("confirmText").textContent = opts.text;
    $("confirmItem").innerHTML = opts.itemHtml;
    confirmAction = opts.onOk;
    openModal("confirmModal");
  }

  $("confirmOkBtn").addEventListener("click", () => {
    const action = confirmAction;
    confirmAction = null;
    closeModal("confirmModal");
    if (action) action();
  });

  // Toggle "Dibuat oleh" (Iyon/Ciwul). Mode Both → wajib pilih manual (tanpa
  // default); mode Iyon/Ciwul → dikunci ke user aktif (aturan sama dgn mobile).
  function renderByToggle(container, value, locked, onPick) {
    container.innerHTML = ["iyon", "ciwul"]
      .map((u) => {
        const on = value === u;
        return '<button type="button" class="toggle-btn' + (on ? " active" : "") + '" aria-pressed="' + on + '" data-by="' + u + '"' + (locked ? " disabled" : "") + ">" + USERS[u].label + "</button>";
      })
      .join("");
    if (!locked) {
      container.querySelectorAll("[data-by]").forEach((b) => b.addEventListener("click", () => onPick(b.dataset.by)));
    }
  }

  function renderAccountPicker(container, value, onPick, locked) {
    container.innerHTML = ACCOUNTS.map((a) => {
      const on = a.id === value;
      return '<button type="button" class="toggle-btn' + (on ? " active" : "") + '" data-account="' + a.id + '" aria-pressed="' + on + '"' + (locked ? " disabled" : "") + ">" +
        '<span aria-hidden="true">' + a.icon + "</span>" + a.label + "</button>";
    }).join("");
    if (!locked) container.querySelectorAll("[data-account]").forEach((b) => b.addEventListener("click", () => onPick(b.dataset.account)));
  }

  // Toggle "Target untuk" rencana (Iyon/Ciwul/Both) — selalu bisa dipilih.
  function renderTargetToggle(container, value, onPick) {
    container.innerHTML = USER_MODES
      .map((u) => {
        const on = value === u;
        return '<button type="button" class="toggle-btn' + (on ? " active" : "") + '" aria-pressed="' + on + '" data-target="' + u + '">' + userModeLabel(u) + "</button>";
      })
      .join("");
    container.querySelectorAll("[data-target]").forEach((b) => b.addEventListener("click", () => onPick(b.dataset.target)));
  }

  function byLabelText() {
    return currentUser === "both" ? "Dibuat oleh" : "Dibuat oleh (otomatis)";
  }

  /* ================= Chart garis (SVG 760×230) ================= */

  const CH = { X0: 52, X1: 748, Y0: 16, Y1: 220 };
  const Y_STEPS = [50000, 100000, 200000, 250000, 500000, 1e6, 2e6, 2.5e6, 5e6, 1e7, 2e7, 2.5e7, 5e7, 1e8, 2e8, 2.5e8, 5e8, 1e9];
  let chartSeq = 0;

  const f1 = (v) => v.toFixed(1);

  // Kurva monotone (tidak overshoot di bawah 0) — sama dgn desain.
  function smoothPath(pts) {
    const n = pts.length;
    if (n === 0) return "";
    if (n === 1) return "M" + f1(pts[0].x) + " " + f1(pts[0].y);
    const dx = [], m = [], t = [];
    for (let i = 0; i < n - 1; i++) {
      dx[i] = pts[i + 1].x - pts[i].x;
      m[i] = (pts[i + 1].y - pts[i].y) / dx[i];
    }
    t[0] = m[0];
    t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) {
        t[i] = 0;
        t[i + 1] = 0;
      } else {
        const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
        if (s > 9) {
          const k = 3 / Math.sqrt(s);
          t[i] = k * a * m[i];
          t[i + 1] = k * b * m[i];
        }
      }
    }
    let d = "M" + f1(pts[0].x) + " " + f1(pts[0].y);
    for (let i = 0; i < n - 1; i++) {
      d += " C" + f1(pts[i].x + dx[i] / 3) + " " + f1(pts[i].y + (t[i] * dx[i]) / 3) + " " +
        f1(pts[i + 1].x - dx[i] / 3) + " " + f1(pts[i + 1].y - (t[i + 1] * dx[i]) / 3) + " " +
        f1(pts[i + 1].x) + " " + f1(pts[i + 1].y);
    }
    return d;
  }

  function linePath(pts) {
    return pts.map((p, i) => (i ? "L" : "M") + f1(p.x) + " " + f1(p.y)).join(" ");
  }

  // cfg = {
  //   n, label, series: [{ values, color, width, dash, smooth, area (opacity), dotR }],
  //   extra: [{ from: [i, v], to: [i, v], color, dash, opacity }],
  //   max, hover, tip(i) → html, hitLabel(i), xLabel(i) → html, xHeight, tipOffset
  // }
  function renderLineChart(el, cfg) {
    const n = Math.max(2, cfg.n);
    let maxVal = Math.max(1, cfg.max || 0);
    cfg.series.forEach((s) => s.values.forEach((v) => (maxVal = Math.max(maxVal, v))));
    const step = Y_STEPS.find((s) => s * 4 >= maxVal) || Math.ceil(maxVal / 4);
    const top = step * 4;
    const cx = (i) => CH.X0 + (i * (CH.X1 - CH.X0)) / (n - 1);
    const cy = (v) => CH.Y1 - (v / top) * (CH.Y1 - CH.Y0);
    const gid = "chartGrad" + ++chartSeq;

    const paths = cfg.series.map((s) => {
      const pts = s.values.map((v, i) => ({ x: cx(i), y: cy(v) }));
      return { s, pts, d: s.smooth === false ? linePath(pts) : smoothPath(pts) };
    });

    let svg = '<svg viewBox="0 0 760 230" width="100%" height="100%" role="img" aria-label="' + escapeHtml(cfg.label) + '">';
    const areaPath = paths.find((p) => p.s.area && p.pts.length);
    if (areaPath) {
      svg += '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" style="stop-color:' + areaPath.s.color + ";stop-opacity:" + areaPath.s.area + '"/>' +
        '<stop offset="1" style="stop-color:' + areaPath.s.color + ';stop-opacity:0"/></linearGradient></defs>';
    }
    for (let k = 0; k <= 4; k++) {
      const y = f1(cy(k * step));
      svg += '<line x1="52" x2="748" y1="' + y + '" y2="' + y + '" style="stroke:var(--border)" stroke-width="1"/>';
    }
    if (areaPath) {
      const last = areaPath.pts[areaPath.pts.length - 1];
      svg += '<path d="' + areaPath.d + " L" + f1(last.x) + " " + CH.Y1 + " L" + f1(areaPath.pts[0].x) + " " + CH.Y1 + ' Z" fill="url(#' + gid + ')"/>';
    }
    (cfg.extra || []).forEach((x) => {
      svg += '<path d="M' + f1(cx(x.from[0])) + " " + f1(cy(x.from[1])) + " L" + f1(cx(x.to[0])) + " " + f1(cy(x.to[1])) +
        '" fill="none" style="stroke:' + x.color + '" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="' + x.dash + '" opacity="' + x.opacity + '"/>';
    });
    paths.forEach((p) => {
      svg += '<path d="' + p.d + '" fill="none" style="stroke:' + p.s.color + '" stroke-width="' + (p.s.width || 3) +
        '" stroke-linecap="round" stroke-linejoin="round"' + (p.s.dash ? ' stroke-dasharray="' + p.s.dash + '"' : "") + "/>";
    });
    paths.forEach((p) => {
      if (!p.s.dotR) return;
      p.pts.forEach((pt) => {
        svg += '<circle cx="' + f1(pt.x) + '" cy="' + f1(pt.y) + '" r="' + p.s.dotR + '" style="fill:var(--surface);stroke:' + p.s.color + '" stroke-width="2.5"/>';
      });
    });
    svg += '<line class="chart-hl" y1="16" y2="220" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="3 4"/>';
    paths.forEach((p) => {
      svg += '<circle class="chart-hd" r="7.5" style="fill:' + p.s.color + ';stroke:var(--surface)" stroke-width="3"/>';
    });
    svg += "</svg>";

    let ylabels = "";
    for (let k = 0; k <= 4; k++) {
      ylabels += '<span class="chart-y tnum" style="top:' + cy(k * step) / 2.3 + '%">' + fmtK(k * step) + "</span>";
    }
    const hw = (CH.X1 - CH.X0) / (n - 1);
    let hits = "";
    let xl = "";
    for (let i = 0; i < n; i++) {
      // Area hover dibatasi ke dalam kotak grafik (0–760) supaya kolom
      // pertama/terakhir tidak menjorok keluar & bikin scroll horizontal.
      const left = Math.max(0, cx(i) - hw / 2), right = Math.min(760, cx(i) + hw / 2);
      hits += '<button type="button" class="chart-hit" data-i="' + i + '" aria-label="' + escapeHtml(cfg.hitLabel(i)) +
        '" style="left:' + left / 7.6 + "%;width:" + (right - left) / 7.6 + '%"></button>';
      const label = cfg.xLabel(i);
      if (label) xl += '<div class="chart-xl" style="left:' + cx(i) / 7.6 + '%">' + label + "</div>";
    }

    el.innerHTML = '<div class="chart-plot">' + svg + ylabels + hits + '<div class="chart-tip" aria-hidden="true"></div></div>' +
      '<div class="chart-x" style="height:' + (cfg.xHeight || 30) + 'px">' + xl + "</div>";

    const hl = el.querySelector(".chart-hl");
    const hds = el.querySelectorAll(".chart-hd");
    const tip = el.querySelector(".chart-tip");
    let current = -1;

    function setHover(i) {
      if (i === current) return;
      current = i;
      const x = f1(cx(i));
      hl.setAttribute("x1", x);
      hl.setAttribute("x2", x);
      let minY = CH.Y1;
      paths.forEach((p, k) => {
        const idx = Math.min(i, p.pts.length - 1);
        if (idx < 0) {
          hds[k].style.display = "none";
          return;
        }
        hds[k].style.display = "";
        hds[k].setAttribute("cx", f1(p.pts[idx].x));
        hds[k].setAttribute("cy", f1(p.pts[idx].y));
        minY = Math.min(minY, p.pts[idx].y);
      });
      tip.innerHTML = cfg.tip(i);
      const tx = Math.max(CH.X0, Math.min(cx(i) - 88, CH.X1 - 176));
      const ty = Math.max(0, minY - (cfg.tipOffset || 78));
      tip.style.left = tx / 7.6 + "%";
      tip.style.top = ty / 2.3 + "%";
      // Di layar sempit lebar minimum tooltip (150px) bisa melewati tepi
      // kanan grafik → geser balik supaya tetap di dalam kotak grafik.
      const plotW = tip.parentNode.clientWidth;
      if (plotW && tip.offsetLeft + tip.offsetWidth > plotW) {
        tip.style.left = Math.max(0, plotW - tip.offsetWidth) + "px";
      }
    }

    el.querySelectorAll(".chart-hit").forEach((b) => {
      const i = Number(b.dataset.i);
      const h = () => setHover(i);
      b.addEventListener("mouseenter", h);
      b.addEventListener("focus", h);
      b.addEventListener("click", h);
    });
    setHover(Math.min(n - 1, Math.max(0, cfg.hover == null ? n - 1 : cfg.hover)));
  }

  function tipHtml(title, rows) {
    return '<div class="chart-tip-title">' + title + "</div>" + rows.map((r) => "<div" + (r.dim ? ' style="opacity:0.8"' : "") + ">" + r.text + "</div>").join("");
  }

  /* ================= Dashboard ================= */

  // Record yang dihitung sbg arus (pemasukan/pengeluaran/kategori) utk tab
  // account aktif. Pindah cuma menyumbang biaya admin, dan itu milik account
  // asal — di tab account tujuan tidak dihitung.
  function flowTransactions(list) {
    return list.filter((t) => t.type !== "transfer" || acctFilter === "all" || t.dari === acctFilter);
  }

  function expenseOf(tx) {
    return Core.flowOf(tx).expense;
  }

  function renderDashboard() {
    const ym = viewYm();
    const monthTx = scopedTransactions().filter((t) => ymOf(t.date) === ym);
    const sum = Core.summarize(monthTx, acctFilter);
    const income = sum.income;
    const expense = sum.expense;

    renderAccountTabs($("dashAcctTabs"), renderDashboard);
    const acct = ACCOUNT_BY_ID[acctFilter];
    $("heroBalanceLabel").textContent = acct ? "Saldo " + acct.label + " Bulan Ini" : "Saldo Bulan Ini";
    $("heroBalance").textContent = money(sum.balance);
    // Di tab account tertentu, saldo ikut pindah masuk/keluar (bukan pemasukan/
    // pengeluaran) — ditampilkan supaya saldo ≠ pemasukan − pengeluaran tetap jelas.
    const hasTf = !!acct && (sum.transferIn || sum.transferOut);
    $("heroTransfer").hidden = !hasTf;
    if (hasTf) $("heroTransfer").textContent = "Pindah masuk " + money(sum.transferIn) + " · keluar " + money(sum.transferOut);
    $("heroIncome").textContent = money(income);
    $("heroExpense").textContent = money(expense);
    const ratio = income > 0 ? Math.round((expense / income) * 100) : 0;
    $("heroRatioBar").style.width = Math.min(100, ratio) + "%";
    $("heroRatioText").textContent =
      income > 0
        ? "Pengeluaran " + ratio + "% dari pemasukan bulan ini"
        : expense > 0
        ? "Belum ada pemasukan bulan ini"
        : "Belum ada transaksi bulan ini";

    $("dashRangeTabs").innerHTML = segTabsHtml([["week", "7 hari"], ["month", "Bulan ini"]], dashRange, "data-range");
    $("dashRangeTabs").querySelectorAll("[data-range]").forEach((b) =>
      b.addEventListener("click", () => {
        dashRange = b.dataset.range;
        renderDashboard();
      })
    );
    renderDashChart();
    renderStats(flowTransactions(monthTx), expense);
    renderRecent(monthTx);
  }

  // Hari "acuan" grafik 7 hari: hari ini kalau bulan aktif = bulan ini,
  // hari terakhir bulan itu kalau bulan lalu.
  function dashAnchorIso() {
    const today = todayStr();
    const ym = viewYm();
    if (ymOf(today) === ym) return today;
    if (ym < ymOf(today)) return ym + "-" + pad2(daysInMonth(viewDate.getFullYear(), viewDate.getMonth()));
    return ym + "-01";
  }

  function renderDashChart() {
    const expenseByDate = {};
    flowTransactions(scopedTransactions()).forEach((t) => {
      const v = expenseOf(t);
      if (v) expenseByDate[t.date] = (expenseByDate[t.date] || 0) + v;
    });
    const valueOn = (iso) => expenseByDate[iso] || 0;

    const curDates = [], prevDates = [];
    let hover;
    if (dashRange === "week") {
      const a = dayNum(dashAnchorIso());
      for (let i = 6; i >= 0; i--) {
        curDates.push(isoOfDay(a - i));
        prevDates.push(isoOfDay(a - i - 7));
      }
      hover = 6;
    } else {
      const y = viewDate.getFullYear(), m = viewDate.getMonth();
      const py = m === 0 ? y - 1 : y, pm = m === 0 ? 11 : m - 1;
      const prevDays = daysInMonth(py, pm);
      const nd = daysInMonth(y, m);
      for (let d = 1; d <= nd; d++) {
        curDates.push(y + "-" + pad2(m + 1) + "-" + pad2(d));
        prevDates.push(d <= prevDays ? py + "-" + pad2(pm + 1) + "-" + pad2(d) : null);
      }
      const today = todayStr();
      hover = ymOf(today) === viewYm() ? Number(today.slice(8)) - 1 : nd - 1;
    }
    const cur = curDates.map(valueOn);
    const prev = prevDates.map((d) => (d ? valueOn(d) : 0));
    const prevName = dashRange === "week" ? "7 hari lalu" : "1 bulan lalu";
    const n = cur.length;
    const dotR = n > 10 ? 3 : 4.5;
    $("dashPrevName").textContent = prevName;

    renderLineChart($("dashChart"), {
      n,
      label: "Grafik perbandingan pengeluaran dengan periode sebelumnya",
      series: [
        { values: prev, color: "var(--muted)", width: 2.5, dash: "1 6", dotR },
        { values: cur, color: "var(--exp)", width: 3, area: 0.26, dotR },
      ],
      hover,
      hitLabel: (i) => "Lihat detail " + shortDate(curDates[i]),
      tip: (i) =>
        tipHtml(shortDateYear(curDates[i]), [
          { text: "Pengeluaran " + money(cur[i]) },
          { text: prevName + " " + (prevDates[i] ? "(" + shortDate(prevDates[i]) + ") " : "") + money(prev[i]), dim: true },
        ]),
      xLabel: (i) => {
        if (dashRange === "week") {
          return '<div class="chart-xl-main"><span class="dot dot-sm" style="background:var(--exp)"></span>' + shortDate(curDates[i]) + "</div>" +
            '<div class="chart-xl-prev"><span class="dot dot-sm" style="background:var(--muted)"></span>' + shortDate(prevDates[i]) + "</div>";
        }
        const label = i === 0 ? shortDate(curDates[i]) : (i + 1) % 5 === 0 || i === n - 1 ? String(i + 1) : "";
        return label ? '<div class="chart-xl-main">' + label + "</div>" : "";
      },
      xHeight: dashRange === "week" ? 64 : 36,
    });
  }

  // Breakdown pengeluaran per kategori + catatan terhadap rencana bulanan
  // kategori itu (aturan sama dgn mobile).
  // Nota dihitung per kategori lewat rincian_kategori (Core.totalsByCategory).
  function renderStats(monthTx, totalExpense) {
    const byCat = Core.totalsByCategory(monthTx, "expense");
    const rows = Object.keys(byCat)
      .filter((id) => byCat[id] > 0)
      .map((id) => ({ cat: findCategory("expense", id), amount: byCat[id] }))
      .sort((a, b) => b.amount - a.amount);

    if (!rows.length) {
      $("statInsight").textContent = "Belum ada pengeluaran bulan ini.";
      $("statSegments").innerHTML = "";
      $("statRows").innerHTML = "";
      return;
    }

    const top = rows[0];
    $("statInsight").textContent =
      top.cat.label + " jadi pengeluaran terbesar bulan ini, " + Math.round((top.amount / totalExpense) * 100) + "% dari total.";
    $("statSegments").innerHTML = rows
      .map((r) => '<div style="height:100%;flex:' + r.amount + " 1 0;background:" + catColor(r.cat) + '"></div>')
      .join("");
    $("statRows").innerHTML = rows
      .map((r) => {
        const pct = Math.round((r.amount / totalExpense) * 100);
        // Catatan pakai pemakaian versi rencana (transaksi target, semua account),
        // supaya angkanya sama dengan kartu di halaman Rencana.
        const plan = plans.find((p) => p.period === "bulanan" && p.category === r.cat.id && planVisible(p));
        let note = "", noteColor = "var(--muted)";
        if (plan && plan.limit > 0) {
          const bp = Math.round((planSpent(plan) / plan.limit) * 100);
          if (bp > 100) { note = "Melebihi rencana bulanan"; noteColor = "var(--danger)"; }
          else if (bp === 100) { note = "Mencapai target rencana bulanan"; noteColor = "var(--warn)"; }
          else if (bp >= 80) { note = "Mendekati batas rencana bulanan"; noteColor = "var(--warn)"; }
          else note = bp + "% dari rencana bulanan";
        }
        return '<div class="stat-row">' +
          '<div class="stat-row-top"><div class="stat-row-label">' + tileHtml(r.cat, 36) + escapeHtml(r.cat.label) + "</div>" +
          '<span class="strong tnum">' + pct + "%</span></div>" +
          '<div class="track"><div class="fill" style="width:' + pct + "%;background:" + catColor(r.cat) + '"></div></div>' +
          '<div class="stat-row-foot"><span class="muted tnum" style="font-weight:600">' + money(r.amount) + "</span>" +
          '<span class="stat-note" style="color:' + noteColor + '">' + note + "</span></div></div>";
      })
      .join("");
  }

  function renderRecent(monthTx) {
    const list = monthTx.slice().sort((a, b) => txTime(b) - txTime(a)).slice(0, 5);
    const el = $("recentList");
    if (!list.length) {
      el.innerHTML = '<p class="empty-state">Belum ada transaksi bulan ini.</p>';
      return;
    }
    el.innerHTML = list
      .map((tx) => {
        const cat = findCategory(tx.type, tx.category);
        return '<button type="button" class="list-row" data-tx="' + escapeHtml(tx.id) + '">' + tileHtml(cat, 40) +
          '<span class="item-text"><span class="item-title">' + escapeHtml(txTitle(tx)) + "</span>" +
          '<span class="item-sub">' + shortDate(tx.date) + " · " + tx.time.slice(0, 5) + "</span></span>" +
          '<span class="amount ' + amountClass(tx) + '">' + signedAmount(tx) + "</span></button>";
      })
      .join("");
    el.querySelectorAll("[data-tx]").forEach((b) =>
      b.addEventListener("click", () => {
        selectedTxId = b.dataset.tx;
        txJumpToSelected = true;
        setView("transactions");
      })
    );
  }

  /* ================= Transaksi ================= */

  // Teks yang dicocokkan pencarian: catatan/judul, kategori, tanggal, pembuat, kode.
  function txSearchText(tx) {
    const by = USERS[tx.by] ? USERS[tx.by].label : tx.by;
    const itemNames = (tx.items || []).map((i) => i.nama).join(" ") + (tx.type === "transfer" ? " pindah " + transferRoute(tx) : "");
    return [tx.note, tx.title, findCategory(tx.type, tx.category).label, shortDate(tx.date), longDate(tx.date), by, tx.kode || "", itemNames].join(" ").toLowerCase();
  }

  function filteredTransactions() {
    const ym = viewYm();
    const q = txSearch.trim().toLowerCase();
    return scopedTransactions()
      .filter((t) => {
        if (ymOf(t.date) !== ym) return false;
        if (txTypeFilter !== "all" && t.type !== txTypeFilter) return false;
        const day = Number(t.date.slice(8, 10));
        if (filterFrom && day < filterFrom) return false;
        if (filterTo && day > filterTo) return false;
        // Account Type: cocok kalau salah satu yang dipilih (pindah: asal atau tujuan).
        if (filterAccts.length && !filterAccts.some((a) => Core.matchesAccount(t, a))) return false;
        if (filterCats.length) {
          // Nota cocok kalau salah satu kategori item-nya dipilih. Pindah tidak
          // punya kategori → tidak ikut saat filter kategori aktif.
          if (t.type === "transfer") return false;
          const cats = txCategoryIds(t);
          const hit = cats.some((c) => (categoryExists(t.type, c) ? filterCats.indexOf(c) !== -1 : filterCats.indexOf(UNKNOWN_CATEGORY_ID) !== -1));
          if (!hit) return false;
        }
        if (q && txSearchText(t).indexOf(q) === -1) return false;
        return true;
      })
      .sort((a, b) => compareTxMoment(b, a));
  }

  function renderTransactions() {
    renderAccountTabs($("txAcctTabs"), renderTransactions);
    renderTxChart();

    $("txTabs").innerHTML = segTabsHtml([["all", "Semua"], ["income", "Pemasukan"], ["expense", "Pengeluaran"]], txTypeFilter, "data-txtype");
    $("txTabs").querySelectorAll("[data-txtype]").forEach((b) =>
      b.addEventListener("click", () => {
        txTypeFilter = b.dataset.txtype;
        filterCats = []; // filter kategori dibatalkan tiap ganti tab (spt mobile)
        txPage = 1;
        renderTransactions();
      })
    );

    renderFilterState();
    $("txSearchClear").hidden = !txSearch;

    const list = filteredTransactions();
    const pages = Math.max(1, Math.ceil(list.length / txLimit));
    if (txJumpToSelected) {
      const idx = list.findIndex((t) => t.id === selectedTxId);
      if (idx !== -1) txPage = Math.floor(idx / txLimit) + 1;
      txJumpToSelected = false;
    }
    txPage = Math.min(Math.max(1, txPage), pages);
    const start = (txPage - 1) * txLimit;
    const pageList = list.slice(start, start + txLimit);
    // Detail mengikuti baris di halaman yang sedang tampil.
    if (!pageList.some((t) => t.id === selectedTxId)) selectedTxId = pageList.length ? pageList[0].id : null;

    const rows = $("txRows");
    if (!list.length) {
      const hasMonthData = scopedTransactions().some((t) => ymOf(t.date) === viewYm());
      rows.innerHTML = '<p class="empty-state">' + (hasMonthData ? "Tidak ada transaksi yang cocok." : "Belum ada transaksi bulan ini.") + "</p>";
    } else {
      rows.innerHTML = pageList.map((tx, i) => txRowHtml(tx, start + i + 1)).join("");
    }
    renderPager(list.length, pages, start, pageList.length);
    renderTxDetail(pageList.find((t) => t.id === selectedTxId));
  }

  function renderPager(total, pages, start, shown) {
    $("txTotal").textContent = "Total " + total + " data";
    $("txRange").textContent = "Menampilkan " + (total ? start + 1 : 0) + "–" + (start + shown) + " · Halaman " + txPage + " dari " + pages;

    $("txLimitOpts").innerHTML = segTabsHtml(TX_LIMITS.map((n) => [String(n), String(n)]), String(txLimit), "data-limit");
    $("txLimitOpts").querySelectorAll("[data-limit]").forEach((b) =>
      b.addEventListener("click", () => {
        txLimit = Number(b.dataset.limit);
        txPage = 1;
        renderTransactions();
      })
    );

    // Maksimal 5 nomor halaman di sekitar halaman aktif (spt desain).
    let a = Math.max(1, txPage - 2);
    const b = Math.min(pages, a + 4);
    a = Math.max(1, b - 4);
    let html = "";
    for (let i = a; i <= b; i++) {
      const on = i === txPage;
      html += '<button type="button" class="pager-btn pager-num' + (on ? " active" : "") + '" data-page="' + i + '" aria-label="Halaman ' + i + '"' + (on ? ' aria-current="page"' : "") + ">" + i + "</button>";
    }
    $("txPages").innerHTML = html;
    $("txPages").querySelectorAll("[data-page]").forEach((btn) =>
      btn.addEventListener("click", () => goTxPage(Number(btn.dataset.page)))
    );
    $("txPrev").disabled = txPage <= 1;
    $("txNext").disabled = txPage >= pages;
  }

  function goTxPage(page) {
    txPage = page;
    renderTransactions();
  }

  $("txPrev").addEventListener("click", () => goTxPage(txPage - 1));
  $("txNext").addEventListener("click", () => goTxPage(txPage + 1));

  $("txSearch").addEventListener("input", (e) => {
    txSearch = e.target.value;
    txPage = 1;
    renderTransactions();
  });
  $("txSearchClear").addEventListener("click", () => {
    txSearch = "";
    $("txSearch").value = "";
    txPage = 1;
    renderTransactions();
    $("txSearch").focus();
  });

  const expandedNota = new Set(); // id nota yg item-nya sedang dibuka di tabel

  // no = nomor urut di daftar terfilter (lanjut antar halaman: hal. 2 mulai 11, dst).
  function txRowHtml(tx, no) {
    const cat = findCategory(tx.type, tx.category);
    const sel = tx.id === selectedTxId;
    const id = escapeHtml(tx.id);
    const multi = isMultiNota(tx);
    const open = multi && expandedNota.has(tx.id);
    const sub = tx.type === "transfer"
      ? "Pindah account · " + transferRoute(tx)
      : multi ? cat.label + " · " + Object.keys(tx.rincian).length + " kategori" : tx.note || tx.title ? cat.label : TYPE_LABELS[tx.type];
    const expandBtn = multi
      ? '<button type="button" class="icon-btn tx-expand' + (open ? " open" : "") + '" data-expand="' + id + '" aria-expanded="' + open + '" aria-label="' + (open ? "Tutup" : "Lihat") + ' item nota">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>'
      : "";
    return '<div class="tx-grid tx-row' + (sel ? " selected" : "") + '">' +
      '<span class="tx-no tnum">' + no + "</span>" +
      '<button type="button" class="tx-main" data-select="' + id + '" aria-pressed="' + sel + '">' + tileHtml(cat, 40) +
      '<span class="item-text"><span class="tx-title-line"><span class="item-title">' + escapeHtml(txTitle(tx)) + "</span>" +
      (multi ? '<span class="nota-badge">' + tx.items.length + " item</span>" : "") + "</span>" +
      '<span class="item-sub">' + escapeHtml(sub) + "</span>" +
      '<span class="kode-sm tnum">' + escapeHtml(tx.kode || "—") + "</span></span></button>" +
      '<div class="tx-date"><span style="font-weight:600">' + shortDate(tx.date) + '</span><span class="item-sub tnum">' + tx.time + "</span></div>" +
      "<div>" + avatarHtml(tx.by, 32) + "</div>" +
      '<span class="amount ta-r ' + amountClass(tx) + '">' + signedAmount(tx) + "</span>" +
      '<div class="tx-actions">' + expandBtn +
      '<button type="button" class="icon-btn" data-edit="' + id + '" aria-label="Edit transaksi">' + svgIcon(ICON.edit, 17) + "</button>" +
      '<button type="button" class="icon-btn" data-del="' + id + '" aria-label="Hapus transaksi">' + svgIcon(ICON.trash, 17) + "</button>" +
      "</div></div>" + (open ? notaItemsRowHtml(tx) : "");
  }

  // Daftar item (+ penyesuaian) di bawah baris nota yg dibuka.
  function notaItemsRowHtml(tx) {
    const items = tx.items.map((it) => {
      const c = findCategory(tx.type, it.category);
      return '<div class="tx-item"><span class="item-title">' + escapeHtml(it.nama) + '</span><span class="item-sub">' + escapeHtml(c.icon + " " + c.label) + "</span>" +
        '<span class="item-sub tnum">' + formatQty(it.qty) + " " + escapeHtml(it.satuan || "") + " × " + money(it.harga) + "</span>" +
        '<span class="tnum ta-r strong">' + money(it.subtotal) + "</span></div>";
    });
    const adj = tx.penyesuaian.map((p) =>
      '<div class="tx-item adj"><span>' + escapeHtml(p.label) + "</span><span></span><span>" + (p.mode === "persen" ? formatQty(p.nilai) + "% dari subtotal" : "") + "</span>" +
      '<span class="tnum ta-r">' + (p.efek === "kurang" ? "− " : "+ ") + money(p.jumlah) + "</span></div>"
    );
    return '<div class="tx-items">' + items.concat(adj).join("") + "</div>";
  }

  $("txRows").addEventListener("click", (e) => {
    const exp = e.target.closest("[data-expand]");
    if (exp) {
      const id = exp.dataset.expand;
      if (expandedNota.has(id)) expandedNota.delete(id);
      else expandedNota.add(id);
      renderTransactions();
      return;
    }
    const sel = e.target.closest("[data-select]");
    const edit = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-del]");
    if (sel) {
      selectedTxId = sel.dataset.select;
      renderTransactions();
    } else if (edit) {
      const tx = transactions.find((t) => t.id === edit.dataset.edit);
      if (tx) openEditTx(tx);
    } else if (del) {
      const tx = transactions.find((t) => t.id === del.dataset.del);
      if (tx) confirmDeleteTx(tx);
    }
  });

  function renderTxDetail(tx) {
    const el = $("txDetail");
    if (!tx) {
      el.innerHTML = '<p class="empty-state">Pilih transaksi untuk melihat detailnya.</p>';
      return;
    }
    if (tx.type === "transfer") {
      el.innerHTML = transferDetailHtml(tx);
      return;
    }
    const cat = findCategory(tx.type, tx.category);
    const isNota = tx.bentuk === "nota";
    const head = isNota
      ? '<div class="item-text"><span style="font-weight:800;font-size:16px">' + escapeHtml(tx.title || "Nota") + '</span><span class="muted">Nota ' + TYPE_LABELS[tx.type].toLowerCase() + " · " + tx.items.length + " item</span></div>"
      : '<div class="item-text"><span style="font-weight:800;font-size:16px">' + escapeHtml(cat.label) + '</span><span class="muted">' + TYPE_LABELS[tx.type] + "</span></div>";
    el.innerHTML =
      '<div class="item-line" style="gap:14px">' + tileHtml(cat, 56) + head + "</div>" +
      '<span class="tx-detail-amount tnum ' + amountClass(tx) + '">' + signedAmount(tx) + "</span>" +
      (isNota
        ? '<div class="receipt-mini">' + receiptBodyHtml(tx.type, tx.items, tx.penyesuaian, tx.subtotal, tx.amount, tx.rincian, money) + "</div>"
        : '<div class="note-box"><span class="overline">Catatan</span><span>' + escapeHtml(tx.note || "—") + "</span></div>") +
      '<dl class="dl">' +
      '<dt>Kode</dt><dd class="kode">' + escapeHtml(tx.kode || "—") + "</dd>" +
      "<dt>Account</dt><dd>" + accountChipHtml(tx.account_type) + "</dd>" +
      "<dt>Tanggal</dt><dd>" + longDate(tx.date) + "</dd>" +
      "<dt>Waktu</dt><dd>" + tx.time + "</dd>" +
      "<dt>Waktu dibuat</dt><dd>" + (tx.timestamp ? shortDateYear(localDateStrOf(tx.timestamp)) + ", " + formatTime(tx.timestamp) : "—") + "</dd>" +
      '<dt>Dibuat oleh</dt><dd class="dd-user">' + avatarHtml(tx.by, 24) + (USERS[tx.by] ? USERS[tx.by].label : escapeHtml(tx.by)) + "</dd>" +
      "</dl>";
  }

  function transferDetailHtml(tx) {
    const from = ACCOUNT_BY_ID[tx.dari] || {}, to = ACCOUNT_BY_ID[tx.ke] || {};
    return '<div class="item-line" style="gap:14px">' + tileHtml(TRANSFER_CATEGORY, 56) +
      '<div class="item-text"><span style="font-weight:800;font-size:16px">' + escapeHtml(transferRoute(tx)) + '</span><span class="muted">Pindah account</span></div></div>' +
      '<span class="tx-detail-amount tnum amount-transfer">⇄ ' + money(tx.amount) + "</span>" +
      '<div class="tf-summary">' +
      '<div class="kv"><span class="muted">' + (from.icon || "") + " " + escapeHtml(accountLabel(tx.dari)) + ' berkurang</span><span class="strong tnum amount-expense">− ' + money(tx.amount + tx.fee) + "</span></div>" +
      '<div class="kv"><span class="muted">' + (to.icon || "") + " " + escapeHtml(accountLabel(tx.ke)) + ' bertambah</span><span class="strong tnum amount-income">+ ' + money(tx.amount) + "</span></div>" +
      '<div class="kv"><span class="muted">Biaya admin</span><span class="strong tnum">' + (tx.fee ? money(tx.fee) : "—") + "</span></div>" +
      '<span class="tf-note">Bukan pemasukan/pengeluaran. Hanya biaya admin yang dihitung sebagai pengeluaran (kategori Lainnya) di account asal.</span>' +
      "</div>" +
      '<div class="note-box"><span class="overline">Catatan</span><span>' + escapeHtml(tx.note || "—") + "</span></div>" +
      '<dl class="dl">' +
      '<dt>Kode</dt><dd class="kode">' + escapeHtml(tx.kode || "—") + "</dd>" +
      "<dt>Tanggal</dt><dd>" + longDate(tx.date) + "</dd>" +
      "<dt>Waktu</dt><dd>" + tx.time + "</dd>" +
      "<dt>Waktu dibuat</dt><dd>" + (tx.timestamp ? shortDateYear(localDateStrOf(tx.timestamp)) + ", " + formatTime(tx.timestamp) : "—") + "</dd>" +
      '<dt>Dibuat oleh</dt><dd class="dd-user">' + avatarHtml(tx.by, 24) + (USERS[tx.by] ? USERS[tx.by].label : escapeHtml(tx.by)) + "</dd>" +
      "</dl>";
  }

  function accountChipHtml(id) {
    const a = ACCOUNT_BY_ID[id];
    return a ? '<span aria-hidden="true">' + a.icon + "</span> " + a.label : "—";
  }

  function renderTxChart() {
    const y = viewDate.getFullYear(), m = viewDate.getMonth();
    const nd = daysInMonth(y, m);
    const inc = new Array(nd).fill(0), exp = new Array(nd).fill(0);
    const ym = viewYm();
    flowTransactions(scopedTransactions()).forEach((t) => {
      if (ymOf(t.date) !== ym) return;
      const i = Number(t.date.slice(8, 10)) - 1;
      if (i < 0 || i >= nd) return;
      const f = Core.flowOf(t);
      inc[i] += f.income;
      exp[i] += f.expense;
    });
    $("txChartSub").textContent = "Per hari, " + monthLabel(viewDate);
    const today = todayStr();
    const dateOf = (i) => ym + "-" + pad2(i + 1);

    renderLineChart($("txChart"), {
      n: nd,
      label: "Grafik pemasukan dan pengeluaran per hari bulan ini",
      series: [
        { values: exp, color: "var(--exp)", width: 2.5, dash: "1 6", dotR: 3 },
        { values: inc, color: "var(--inc)", width: 3, area: 0.26, dotR: 3 },
      ],
      hover: ymOf(today) === ym ? Number(today.slice(8)) - 1 : nd - 1,
      hitLabel: (i) => "Lihat detail " + shortDate(dateOf(i)),
      tip: (i) => tipHtml(shortDateYear(dateOf(i)), [{ text: "Pemasukan " + money(inc[i]) }, { text: "Pengeluaran " + money(exp[i]) }]),
      xLabel: (i) => {
        const label = i === 0 ? shortDate(dateOf(0)) : (i + 1) % 5 === 0 || i === nd - 1 ? String(i + 1) : "";
        return label ? '<div class="chart-xl-main">' + label + "</div>" : "";
      },
    });
  }

  /* ---------- Filter transaksi ---------- */

  let filterDraft = null;

  function categoryChipLabel(id) {
    if (id === UNKNOWN_CATEGORY_ID) return "Kategori Terhapus";
    const cat = CATEGORIES.expense.find((c) => c.id === id) || CATEGORIES.income.find((c) => c.id === id);
    if (!cat) return id;
    if (isLainnyaCategory(id)) return cat.label + (id === "lainnya-masuk" ? " (Masuk)" : " (Keluar)");
    return cat.label;
  }

  function renderFilterState() {
    const hasDate = !!(filterFrom || filterTo);
    const count = (hasDate ? 1 : 0) + (filterAccts.length ? 1 : 0) + (filterCats.length ? 1 : 0);
    $("filterBtn").classList.toggle("active", count > 0);
    $("filterCount").hidden = count === 0;
    $("filterCount").textContent = count;

    const chipsEl = $("filterChips");
    chipsEl.hidden = count === 0;
    if (!count) return;
    const mon = MONTH_SHORT[viewDate.getMonth()];
    const chips = [];
    if (hasDate) {
      chips.push(filterFrom && filterTo ? filterFrom + "–" + filterTo + " " + mon : filterFrom ? "Mulai " + filterFrom + " " + mon : "Sampai " + filterTo + " " + mon);
    }
    filterAccts.forEach((id) => chips.push(accountLabel(id)));
    filterCats.forEach((id) => chips.push(categoryChipLabel(id)));
    chipsEl.innerHTML = '<span class="muted" style="font-weight:600">Filter aktif</span>' +
      chips.map((c) => '<span class="filter-chip">' + escapeHtml(c) + "</span>").join("") +
      '<button type="button" class="link-btn" id="chipResetBtn" style="margin-left:4px">Reset</button>';
    $("chipResetBtn").addEventListener("click", resetFilter);
  }

  function openFilterModal() {
    filterDraft = { from: filterFrom, to: filterTo, accts: filterAccts.slice(), cats: filterCats.slice() };
    const nd = daysInMonth(viewDate.getFullYear(), viewDate.getMonth());
    const mon = MONTH_SHORT[viewDate.getMonth()];
    let opts = '<option value="">—</option>';
    for (let d = 1; d <= nd; d++) opts += '<option value="' + d + '">' + d + " " + mon + "</option>";
    $("filterFrom").innerHTML = opts;
    $("filterTo").innerHTML = opts;
    $("filterFrom").value = filterDraft.from ? String(filterDraft.from) : "";
    $("filterTo").value = filterDraft.to ? String(filterDraft.to) : "";
    renderFilterAccts();
    renderFilterCats();
    openModal("filterModal");
  }

  // Pilihan Account Type (boleh lebih dari satu), gaya sama dgn item kategori.
  function renderFilterAccts() {
    $("filterAcctList").innerHTML = ACCOUNTS.map((a) => {
      const on = filterDraft.accts.indexOf(a.id) !== -1;
      return '<label class="filter-cat-item' + (on ? " checked" : "") + '">' +
        '<input type="checkbox" value="' + a.id + '"' + (on ? " checked" : "") + ">" +
        '<span aria-hidden="true">' + a.icon + '</span><span class="strong">' + a.label + "</span></label>";
    }).join("");
    $("filterAcctList").querySelectorAll("input").forEach((cb) =>
      cb.addEventListener("change", () => {
        filterDraft.accts = cb.checked ? filterDraft.accts.concat([cb.value]) : filterDraft.accts.filter((x) => x !== cb.value);
        cb.closest(".filter-cat-item").classList.toggle("checked", cb.checked);
      })
    );
  }

  function renderFilterCats() {
    const types = txTypeFilter === "all" ? ["expense", "income"] : [txTypeFilter];
    const items = [];
    types.forEach((type) => {
      CATEGORIES[type]
        .slice()
        .sort((a, b) => a.label.localeCompare(b.label, "id"))
        .forEach((cat) => items.push({ id: cat.id, cat, tag: TYPE_LABELS[type] }));
    });
    const hasUnknown = visibleTransactions().some(
      (t) => t.type !== "transfer" && (txTypeFilter === "all" || t.type === txTypeFilter) && txCategoryIds(t).some((c) => !categoryExists(t.type, c))
    );
    if (hasUnknown) items.push({ id: UNKNOWN_CATEGORY_ID, cat: { icon: "❓", label: "Kategori Terhapus", colorSlot: 1 }, tag: "" });

    $("filterCatList").innerHTML = items
      .map((it) => {
        const on = filterDraft.cats.indexOf(it.id) !== -1;
        return '<label class="filter-cat-item' + (on ? " checked" : "") + '">' +
          '<input type="checkbox" value="' + escapeHtml(it.id) + '"' + (on ? " checked" : "") + ">" +
          tileHtml(it.cat, 36) + '<span class="strong">' + escapeHtml(it.cat.label) + "</span>" +
          '<span class="item-sub">' + it.tag + "</span></label>";
      })
      .join("");
    $("filterCatList").querySelectorAll("input").forEach((cb) =>
      cb.addEventListener("change", () => {
        filterDraft.cats = cb.checked ? filterDraft.cats.concat([cb.value]) : filterDraft.cats.filter((x) => x !== cb.value);
        cb.closest(".filter-cat-item").classList.toggle("checked", cb.checked);
      })
    );
  }

  function resetFilter() {
    txTypeFilter = "all";
    filterAccts = [];
    filterCats = [];
    filterFrom = null;
    filterTo = null;
    txPage = 1;
    closeModal("filterModal");
    renderTransactions();
  }

  $("filterBtn").addEventListener("click", openFilterModal);
  $("filterResetBtn").addEventListener("click", resetFilter);
  $("filterApplyBtn").addEventListener("click", () => {
    let from = Number($("filterFrom").value) || null;
    let to = Number($("filterTo").value) || null;
    if (from && to && from > to) {
      const x = from;
      from = to;
      to = x;
    }
    filterFrom = from;
    filterTo = to;
    filterAccts = ACCOUNTS.map((a) => a.id).filter((id) => filterDraft.accts.indexOf(id) !== -1); // urut Bank → Cash → E-Money
    filterCats = filterDraft.cats.slice();
    txPage = 1;
    closeModal("filterModal");
    renderTransactions();
  });

  /* ---------- Export Excel ---------- */

  function categoryExcelLabel(type, id) {
    return findCategory(type, id).label + (type === "income" ? " (masuk)" : " (keluar)");
  }

  $("exportBtn").addEventListener("click", () => {
    if (!(window.FinanceExcel && FinanceExcel.available())) {
      alert("Gagal memuat modul Excel. Cek koneksi internet.");
      return;
    }
    const list = filteredTransactions().slice().sort(compareTxMoment);
    if (!list.length) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }
    // Kolom sama dgn template import (+ Kode, Nota, & Dibuat oleh — diabaikan importer),
    // jadi file hasil export bisa diimport lagi.
    const txRows = list.map((t) => ({
      Kode: t.kode || "",
      Nota: t.bentuk === "nota" ? "Y" : "", // Y = nota (banyak item), kosong = satuan/pindah
      Tanggal: t.date,
      Waktu: t.time,
      "Account Type": t.type === "transfer" ? t.dari + " → " + t.ke : t.account_type || "",
      Tipe: TYPE_LABELS[t.type],
      Kategori: t.type === "transfer" ? "" : categoryExcelLabel(t.type, t.category),
      Nominal: t.amount,
      Catatan:
        t.bentuk === "nota" ? t.title + " (nota " + t.items.length + " item)"
        : t.type === "transfer" ? (t.note || "Pindah " + transferRoute(t)) + (t.fee ? " (biaya admin " + t.fee + ")" : "")
        : t.note || "",
      "Dibuat oleh": USERS[t.by] ? USERS[t.by].label : t.by,
    }));
    // Biaya admin pindah = baris Pengeluaran tersendiri TEPAT di bawah baris
    // pindahnya (kode/tanggal/waktu/pembuat sama, account = asal).
    const rows = [];
    list.forEach((t, i) => {
      rows.push(txRows[i]);
      if (t.type !== "transfer" || !(t.fee > 0)) return;
      rows.push({
        Kode: t.kode || "",
        Nota: "",
        Tanggal: t.date,
        Waktu: t.time,
        "Account Type": t.dari,
        Tipe: TYPE_LABELS.expense,
        Kategori: categoryExcelLabel("expense", Core.TRANSFER_FEE_CATEGORY),
        Nominal: t.fee,
        Catatan: "Biaya Admin",
        "Dibuat oleh": USERS[t.by] ? USERS[t.by].label : t.by,
      });
    });
    // Kolom Nota (Y/kosong) rata tengah → ExcelJS (lihat generate-excel.js).
    FinanceExcel.downloadStyled("transaksi-" + viewYm() + ".xlsx", "Transaksi", rows, { center: ["Nota"] }).catch((err) => {
      console.error("Gagal export:", err);
      alert("Gagal membuat file export: " + err.message);
    });
  });

  /* ---------- Edit & hapus transaksi ---------- */

  // Edit V2 (satuan): boleh ubah kategori, jumlah, catatan, waktu, dibuat oleh.
  // Terkunci: kode, account type, tanggal, jenis (kode bergantung padanya —
  // salah tanggal/account = hapus lalu buat baru).
  let editingTx = null;
  let editBy = null;

  function openEditTx(tx) {
    if (tx.bentuk === "nota") {
      openNota(tx);
      return;
    }
    // Pindah: dari/ke ikut terkunci (kode TF-{asal}{tujuan}); yang bisa diubah
    // jumlah, biaya admin, catatan, waktu, dibuat oleh.
    const isTf = tx.type === "transfer";
    editingTx = tx;
    editBy = tx.by;
    $("editTxInfo").innerHTML =
      '<dl class="dl">' +
      '<dt>Kode</dt><dd class="kode">' + escapeHtml(tx.kode || "—") + "</dd>" +
      (isTf
        ? "<dt>Pindah</dt><dd>" + accountChipHtml(tx.dari) + " → " + accountChipHtml(tx.ke) + "</dd>"
        : "<dt>Account</dt><dd>" + accountChipHtml(tx.account_type) + "</dd>") +
      "<dt>Tanggal</dt><dd>" + longDate(tx.date) + "</dd>" +
      "<dt>Jenis</dt><dd>" + TYPE_LABELS[tx.type] + "</dd>" +
      "</dl>";
    $("editTxCategoryField").hidden = isTf;
    $("editTxFeeField").hidden = !isTf;
    $("editTxAmount").value = Math.round(tx.amount).toLocaleString("id-ID");
    $("editTxNote").value = tx.note || "";
    $("editTxTime").value = tx.time;
    renderEditBy();
    if (isTf) {
      $("editTxFee").value = tx.fee ? tx.fee.toLocaleString("id-ID") : "";
      openModal("editTxModal");
      $("editTxAmount").focus();
      return;
    }
    const sel = $("editTxCategory");
    sel.innerHTML = CATEGORIES[tx.type]
      .map((c) => '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.icon + " " + c.label) + "</option>")
      .join("");
    if (!categoryExists(tx.type, tx.category)) {
      // Kategori sudah dihapus — tetap bisa disimpan apa adanya.
      sel.insertAdjacentHTML("afterbegin", '<option value="' + escapeHtml(tx.category) + '">❓ ' + escapeHtml(tx.category || "Tanpa kategori") + " (terhapus)</option>");
    }
    sel.value = tx.category;
    $("editTxAmount").value = Math.round(tx.amount).toLocaleString("id-ID");
    $("editTxNote").value = tx.note || "";
    $("editTxTime").value = tx.time;
    renderEditBy();
    openModal("editTxModal");
    $("editTxAmount").focus();
  }

  function renderEditBy() {
    renderByToggle($("editTxByToggle"), editBy, false, (by) => {
      editBy = by;
      renderEditBy();
    });
  }

  $("editTxAmount").addEventListener("input", function () {
    formatAmountInput(this);
  });
  $("editTxFee").addEventListener("input", function () {
    formatAmountInput(this);
  });

  $("editTxForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const tx = editingTx;
    if (!tx) return;
    const amount = parseAmount($("editTxAmount").value);
    const rawTime = $("editTxTime").value;
    const time = /^\d{2}:\d{2}$/.test(rawTime) ? rawTime + ":00" : rawTime;
    if (amount <= 0) {
      alert("Jumlah harus lebih dari 0.");
      return;
    }
    if (!Core.isTime(time)) {
      alert("Waktu tidak valid.");
      return;
    }
    // Hanya field yang berubah yang dikirim.
    const isTf = tx.type === "transfer";
    const next = { nominal: amount, catatan: $("editTxNote").value.trim(), waktu: time, by: editBy };
    const prev = { nominal: tx.amount, catatan: tx.note, waktu: tx.time, by: tx.by };
    if (isTf) {
      next.biaya_admin = parseAmount($("editTxFee").value);
      prev.biaya_admin = tx.fee;
    } else {
      next.category = $("editTxCategory").value;
      prev.category = tx.category;
    }
    const fields = {};
    Object.keys(next).forEach((k) => {
      if (next[k] !== prev[k]) fields[k] = next[k];
    });
    if (Object.keys(fields).length) updateTransaction(tx, fields).catch(reportWriteError("menyimpan transaksi"));
    editingTx = null;
    closeModal("editTxModal");
  });

  function confirmDeleteTx(tx) {
    const cat = findCategory(tx.type, tx.category);
    openConfirm({
      title: "Hapus Transaksi?",
      text: "Transaksi ini akan dihapus permanen dan tidak bisa dikembalikan.",
      itemHtml: tileHtml(cat, 40) +
        '<div class="item-text"><span class="item-title">' + escapeHtml(txTitle(tx)) + '</span><span class="item-sub">' + shortDate(tx.date) + " · " + tx.time.slice(0, 5) + "</span></div>" +
        '<span class="amount ' + amountClass(tx) + '">' + signedAmount(tx) + "</span>",
      onOk: () => deleteTransaction(tx).catch(reportWriteError("menghapus transaksi")),
    });
  }

  /* ================= Analisis: Periode A vs Periode B ================= */

  function presetRanges(preset) {
    const today = todayStr();
    const t = dayNum(today);
    if (preset === "week") return { a: [isoOfDay(t - 6), today], b: [isoOfDay(t - 13), isoOfDay(t - 7)] };
    if (preset === "half") return { a: [isoOfDay(t - 14), today], b: [isoOfDay(t - 29), isoOfDay(t - 15)] };
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const py = m === 0 ? y - 1 : y, pm = m === 0 ? 11 : m - 1;
    const ymA = y + "-" + pad2(m + 1), ymB = py + "-" + pad2(pm + 1);
    return {
      a: [ymA + "-01", ymA + "-" + pad2(daysInMonth(y, m))],
      b: [ymB + "-01", ymB + "-" + pad2(daysInMonth(py, pm))],
    };
  }

  function currentRanges() {
    const r = anaPreset === "custom" && anaCustom ? anaCustom : presetRanges(anaPreset);
    return anaSwap ? { a: r.b, b: r.a } : { a: r.a, b: r.b };
  }

  function rangeText(r) {
    return shortDate(r[0]) + " – " + shortDate(r[1]) + " " + r[1].slice(0, 4);
  }

  // Statistik satu periode. `el` = jumlah hari yang sudah berjalan (sampai
  // hari ini) — dipakai rata-rata harian & proyeksi.
  function periodStats(r, pool) {
    const list = pool.filter((t) => t.date >= r[0] && t.date <= r[1]);
    const d0 = dayNum(r[0]);
    const days = dayNum(r[1]) - d0 + 1;
    const el = Math.max(1, Math.min(days, dayNum(todayStr()) - d0 + 1));
    const daily = new Array(el).fill(0);
    const byCat = {};
    list.forEach((t) => {
      const i = dayNum(t.date) - d0;
      if (i < el) daily[i] += t.amount;
      const c = Core.categoryAmounts(t).byCat; // nota → rincian_kategori
      Object.keys(c).forEach((k) => (byCat[k] = (byCat[k] || 0) + c[k]));
    });
    const cum = [];
    daily.reduce((run, v, i) => (cum[i] = run + v), 0);
    const total = sumAmount(list);
    return {
      list, days, el, daily, cum, byCat, total,
      avg: Math.round(total / el),
      count: list.length,
      top: list.slice().sort((x, y) => y.amount - x.amount),
    };
  }

  function chipOf(a, b) {
    if (!b) return { text: a ? "Baru" : "—", neutral: true };
    const pct = Math.round(((a - b) / b) * 100);
    if (pct === 0) return { text: "Sama", neutral: true };
    return pct > 0 ? { text: "▲ " + pct + "%", color: "var(--danger)" } : { text: "▼ " + Math.abs(pct) + "%", color: "var(--accent)" };
  }

  function chipHtml(c) {
    return '<span class="chip' + (c.neutral ? " chip-neutral" : "") + '"' + (c.color ? ' style="--chip:' + c.color + '"' : "") + ">" + c.text + "</span>";
  }

  function barWidth(v, max) {
    return Math.max(v ? 2 : 0, Math.round((v / max) * 100));
  }

  function cmpRowHtml(icon, label, a, b, max, colorA) {
    return '<div class="cmp-row"><div class="cmp-top">' + icon + '<span class="strong">' + escapeHtml(label) + "</span>" + chipHtml(chipOf(a, b)) + "</div>" +
      '<div class="cmp-bars">' +
      '<span class="cmp-tag"><span class="dot dot-sm" style="background:var(--exp)"></span>A</span>' +
      '<div class="track track-10"><div class="fill" style="width:' + barWidth(a, max) + "%;background:" + colorA + '"></div></div>' +
      '<span class="cmp-a tnum">' + money(a) + "</span>" +
      '<span class="cmp-tag"><span class="dot dot-sm" style="background:var(--muted)"></span>B</span>' +
      '<div class="track track-10"><div class="fill" style="width:' + barWidth(b, max) + '%;background:var(--muted);opacity:0.55"></div></div>' +
      '<span class="cmp-b tnum">' + money(b) + "</span></div></div>";
  }

  function accentTile(emoji) {
    return '<div class="tile" style="--tile:var(--accent);--size:40px"><span aria-hidden="true">' + emoji + "</span></div>";
  }

  function renderAnalysis() {
    const { a: ra, b: rb } = currentRanges();
    // Pengeluaran saja; pindah ikut hanya sebesar biaya admin (kategori Lainnya).
    const pool = visibleTransactions()
      .filter((t) => Core.flowOf(t).expense > 0)
      .map((t) => (t.type === "transfer" ? Object.assign({}, t, { amount: t.fee, category: Core.TRANSFER_FEE_CATEGORY }) : t));
    const sa = periodStats(ra, pool), sb = periodStats(rb, pool);

    // --- Bar atas: preset + Periode A/B ---
    const presets = [["month", "Bulan ini vs bulan lalu"], ["week", "7 hari terakhir"], ["half", "15 hari terakhir"], ["custom", "Kustom…"]];
    $("anaPresets").innerHTML = segTabsHtml(presets, anaPreset, "data-preset");
    $("anaPresets").querySelectorAll("[data-preset]").forEach((b) =>
      b.addEventListener("click", () => {
        if (b.dataset.preset === "custom") {
          openRangeModal();
          return;
        }
        anaPreset = b.dataset.preset;
        anaSwap = false;
        renderAnalysis();
      })
    );
    $("anaRangeA").textContent = rangeText(ra);
    $("anaRangeB").textContent = rangeText(rb);
    $("anaLegendA").textContent = rangeText(ra);
    $("anaLegendB").textContent = rangeText(rb);
    $("anaDaysA").textContent = sa.el < sa.days ? "berjalan · hari ke-" + sa.el + " dari " + sa.days : sa.days + " hari";
    $("anaDaysB").textContent = sb.days + " hari";

    // --- KPI ---
    const diff = sa.total - sb.total;
    const topA = sa.top[0], topB = sb.top[0];
    const kpis = [
      { label: "Total Pengeluaran", a: money(sa.total), b: money(sb.total), chip: chipOf(sa.total, sb.total), sub: (diff >= 0 ? "Naik " : "Turun ") + money(Math.abs(diff)) + " dari Periode B" },
      { label: "Rata-rata per Hari", a: money(sa.avg), b: money(sb.avg), chip: chipOf(sa.avg, sb.avg), sub: (sa.el < sa.days ? sa.el + " dari " + sa.days + " hari berjalan" : sa.days + " hari") + " vs " + sb.days + " hari" },
      { label: "Jumlah Transaksi", a: sa.count + " transaksi", b: sb.count + " transaksi", chip: chipOf(sa.count, sb.count), sub: "Rata-rata " + money(sa.count ? Math.round(sa.total / sa.count) : 0) + " per transaksi" },
      { label: "Transaksi Terbesar", a: money(topA ? topA.amount : 0), b: money(topB ? topB.amount : 0), chip: chipOf(topA ? topA.amount : 0, topB ? topB.amount : 0), sub: topA ? txTitle(topA) + " · " + shortDate(topA.date) : "Belum ada transaksi" },
    ];
    $("anaKpis").innerHTML = kpis
      .map((k) => '<div class="card kpi"><span class="muted" style="font-weight:600">' + k.label + "</span>" +
        '<span class="kpi-value tnum">' + k.a + "</span>" +
        '<div class="kpi-foot"><span class="muted small tnum">B: ' + k.b + "</span>" + chipHtml(k.chip) + "</div>" +
        '<span class="kpi-sub">' + escapeHtml(k.sub) + "</span></div>")
      .join("");

    // --- Grafik kumulatif + proyeksi ---
    const rem = sa.days - sa.el;
    const projTotal = Math.round(sa.total + (sa.total / sa.el) * rem);
    const nn = Math.max(sa.days, sb.days, 2);
    renderLineChart($("anaChart"), {
      n: nn,
      label: "Grafik pengeluaran kumulatif Periode A dibanding Periode B",
      max: Math.max(sa.total, sb.total, projTotal),
      series: [
        { values: sb.cum, color: "var(--muted)", width: 2.5, dash: "1 6", smooth: false, dotR: nn <= 10 ? 4.5 : 0 },
        { values: sa.cum, color: "var(--exp)", width: 3, smooth: false, area: 0.22, dotR: nn <= 10 ? 4.5 : 0 },
      ],
      extra: rem > 0 ? [{ from: [sa.el - 1, sa.total], to: [sa.days - 1, projTotal], color: "var(--exp)", dash: "6 6", opacity: 0.6 }] : [],
      hover: sa.el - 1,
      tipOffset: 104,
      hitLabel: (i) => "Lihat detail hari ke-" + (i + 1),
      tip: (i) => {
        const ia = Math.min(i, sa.el - 1), ib = Math.min(i, sb.cum.length - 1);
        return '<div class="chart-tip-title">Hari ke-' + (i + 1) + "</div>" +
          '<div class="chart-tip-row"><span class="dot dot-sm" style="background:var(--exp)"></span>A · ' + shortDate(isoOfDay(dayNum(ra[0]) + ia)) + "</div>" +
          '<div class="tnum" style="padding-left:14px">' + money(sa.cum[ia] || 0) + "</div>" +
          '<div class="chart-tip-row" style="opacity:0.85"><span class="dot dot-sm" style="background:var(--surface);opacity:0.7"></span>B · ' + shortDate(isoOfDay(dayNum(rb[0]) + Math.max(0, ib))) + "</div>" +
          '<div class="tnum" style="padding-left:14px;opacity:0.85">' + money(ib >= 0 ? sb.cum[ib] : 0) + "</div>";
      },
      xLabel: (i) => {
        const label = nn <= 15 ? "Hari ke-" + (i + 1) : i === 0 || (i + 1) % 5 === 0 ? "Hari " + (i + 1) : "";
        return label ? '<span class="chart-xl-muted">' + label + "</span>" : "";
      },
    });

    renderAnaProjection(sa, sb, rem, projTotal);

    // --- Per kategori ---
    const catIds = Object.keys(Object.assign({}, sa.byCat, sb.byCat)).sort(
      (x, y) => (sb.byCat[y] || 0) + (sa.byCat[y] || 0) - ((sb.byCat[x] || 0) + (sa.byCat[x] || 0))
    );
    const cMax = Math.max(1, ...catIds.map((k) => Math.max(sa.byCat[k] || 0, sb.byCat[k] || 0)));
    $("anaCats").innerHTML = catIds.length
      ? catIds.map((k) => {
          const cat = findCategory("expense", k);
          return cmpRowHtml(tileHtml(cat, 40), cat.label, sa.byCat[k] || 0, sb.byCat[k] || 0, cMax, catColor(cat));
        }).join("")
      : '<p class="empty-state">Belum ada pengeluaran di kedua periode.</p>';

    // --- Pola per hari dalam seminggu ---
    const dowTotals = (r, s) => {
      const o = [0, 0, 0, 0, 0, 0, 0];
      s.daily.forEach((v, i) => (o[dowOf(isoOfDay(dayNum(r[0]) + i))] += v));
      return o;
    };
    const dowA = dowTotals(ra, sa), dowB = dowTotals(rb, sb);
    const dMax = Math.max(1, ...dowA, ...dowB);
    const dowTop = dowA.indexOf(Math.max(...dowA));
    const hasA = sa.total > 0;
    const barStyle = (v, color) => "height:" + Math.max(v ? 4 : 2, Math.round((v / dMax) * 150)) + "px;background:" + color + (v ? "" : ";opacity:0.35");
    $("anaDow").innerHTML = DOW_SHORT.map((l, i) =>
      '<div class="dow-col"><div class="dow-bars">' +
      '<div class="dow-bar" title="A · ' + DOW_LONG[i] + ": " + money(dowA[i]) + '" style="' + barStyle(dowA[i], "var(--exp)") + '"></div>' +
      '<div class="dow-bar" title="B · ' + DOW_LONG[i] + ": " + money(dowB[i]) + '" style="' + barStyle(dowB[i], "var(--muted)") + (dowB[i] ? ";opacity:0.6" : "") + '"></div>' +
      '</div><span class="dow-label' + (hasA && i === dowTop ? " top" : "") + '">' + l + "</span></div>"
    ).join("");
    $("anaDowNote").textContent = "Total per hari dalam seminggu" + (hasA ? " · paling boros di Periode A: " + DOW_LONG[dowTop] : "");

    // --- Ringkasan ---
    const catDiff = catIds.map((k) => ({ k, d: (sa.byCat[k] || 0) - (sb.byCat[k] || 0) })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
    const topCatA = catIds.slice().sort((x, y) => (sa.byCat[y] || 0) - (sa.byCat[x] || 0))[0];
    const zeroDays = sa.daily.filter((v) => v === 0).length;
    const insights = [
      "Total pengeluaran " + (diff >= 0 ? "naik " : "turun ") + money(Math.abs(diff)) + (sb.total ? " (" + Math.abs(Math.round((diff / sb.total) * 100)) + "%)" : "") + " dibanding Periode B.",
      catDiff[0] && catDiff[0].d !== 0 ? "Perubahan terbesar ada di " + findCategory("expense", catDiff[0].k).label + ": " + (catDiff[0].d >= 0 ? "naik " : "turun ") + money(Math.abs(catDiff[0].d)) + "." : null,
      topCatA && sa.byCat[topCatA] ? "Kategori paling boros di Periode A adalah " + findCategory("expense", topCatA).label + " dengan " + money(sa.byCat[topCatA]) + "." : null,
      "Rata-rata " + money(sa.avg) + " per hari di Periode A, dibanding " + money(sb.avg) + " di Periode B.",
      zeroDays ? "Ada " + zeroDays + " hari tanpa pengeluaran di Periode A." : "Ada pengeluaran setiap hari di Periode A.",
    ].filter(Boolean);
    $("anaInsights").innerHTML = insights.map((t) => '<div class="insight"><span class="dot"></span><span>' + escapeHtml(t) + "</span></div>").join("");

    // --- Weekday vs weekend (rata-rata per hari) ---
    const dayCount = (r, weekend) => {
      let c = 0;
      for (let n = dayNum(r[0]); n <= dayNum(r[1]); n++) if ((dowOf(isoOfDay(n)) >= 5) === weekend) c++;
      return c;
    };
    const wkTotal = (r, s, weekend) => s.daily.reduce((acc, v, i) => acc + ((dowOf(isoOfDay(dayNum(r[0]) + i)) >= 5) === weekend ? v : 0), 0);
    const wkRows = [["Weekday (Sen–Jum)", "📅", false], ["Weekend (Sab–Min)", "🎉", true]].map((x) => ({
      label: x[0], icon: x[1],
      a: Math.round(wkTotal(ra, sa, x[2]) / Math.max(1, dayCount(ra, x[2]))),
      b: Math.round(wkTotal(rb, sb, x[2]) / Math.max(1, dayCount(rb, x[2]))),
    }));
    const wMax = Math.max(1, ...wkRows.map((x) => Math.max(x.a, x.b)));
    $("anaWk").innerHTML = wkRows.map((x) => cmpRowHtml(accentTile(x.icon), x.label, x.a, x.b, wMax, "var(--exp)")).join("");

    // --- Ukuran transaksi ---
    const SIZES = [["Kecil (< Rp 50 rb)", "🪙", 0, 50000], ["Sedang (Rp 50–250 rb)", "💵", 50000, 250001], ["Besar (> Rp 250 rb)", "💎", 250001, Infinity]];
    const szRows = SIZES.map((x) => ({
      label: x[0], icon: x[1],
      a: sumAmount(sa.list.filter((t) => t.amount >= x[2] && t.amount < x[3])),
      b: sumAmount(sb.list.filter((t) => t.amount >= x[2] && t.amount < x[3])),
    }));
    const sMax = Math.max(1, ...szRows.map((x) => Math.max(x.a, x.b)));
    $("anaSize").innerHTML = szRows.map((x) => cmpRowHtml(accentTile(x.icon), x.label, x.a, x.b, sMax, "var(--exp)")).join("");

    // --- Hari penting ---
    const peak = (r, s) => {
      let bi = 0;
      s.daily.forEach((v, i) => { if (v > s.daily[bi]) bi = i; });
      return { d: shortDate(isoOfDay(dayNum(r[0]) + bi)), v: s.daily[bi] || 0 };
    };
    const streak = (s) => {
      let best = 0, cur = 0;
      s.daily.forEach((v) => { cur = v === 0 ? cur + 1 : 0; if (cur > best) best = cur; });
      return best;
    };
    const pa = peak(ra, sa), pb = peak(rb, sb);
    const zeroA = sa.daily.filter((v) => v === 0).length, zeroB = sb.daily.filter((v) => v === 0).length;
    const days = [
      ["Hari paling boros", money(pa.v), pa.v ? pa.d : "—", money(pb.v), pb.v ? pb.d : "—"],
      ["Hari tanpa pengeluaran", zeroA + " hari", "dari " + sa.el + " hari", zeroB + " hari", "dari " + sb.el + " hari"],
      ["Streak hemat terpanjang", streak(sa) + " hari", "berturut-turut", streak(sb) + " hari", "berturut-turut"],
      ["Rata-rata per transaksi", money(sa.count ? Math.round(sa.total / sa.count) : 0), sa.count + " transaksi", money(sb.count ? Math.round(sb.total / sb.count) : 0), sb.count + " transaksi"],
    ];
    $("anaDays").innerHTML = days.map((d) =>
      '<div class="days-grid"><span class="muted" style="font-weight:600">' + d[0] + "</span>" +
      '<div class="days-cell"><span class="tnum" style="font-weight:800">' + d[1] + '</span><span class="item-sub">' + d[2] + "</span></div>" +
      '<div class="days-cell"><span class="tnum muted strong">' + d[3] + '</span><span class="item-sub">' + d[4] + "</span></div></div>"
    ).join("");

    // --- Transaksi terbesar ---
    const topRows = (arr) =>
      arr.length
        ? arr.slice(0, 5).map((t) => {
            const cat = findCategory("expense", t.category);
            return '<div class="top-row">' + tileHtml(cat, 40) +
              '<div class="item-text"><span class="item-title">' + escapeHtml(txTitle(t)) + '</span><span class="item-sub">' + escapeHtml(cat.label) + " · " + shortDate(t.date) + "</span></div>" +
              avatarHtml(t.by, 28) + '<span class="top-amount">' + money(t.amount) + "</span></div>";
          }).join("")
        : '<p class="empty-state">Belum ada pengeluaran.</p>';
    $("anaTopA").innerHTML = topRows(sa.top);
    $("anaTopB").innerHTML = topRows(sb.top);
  }

  function renderAnaProjection(sa, sb, rem, projTotal) {
    const el = $("anaProj");
    el.hidden = rem <= 0;
    if (rem <= 0) return;
    const over = sa.total > sb.total;
    const scale = Math.max(1, projTotal, sb.total, sa.total) * 1.06;
    const c = chipOf(projTotal, sb.total);
    const chip = chipHtml({ text: c.text === "Sama" ? "Sama dengan Periode B" : c.text + " dari Periode B", neutral: c.neutral, color: c.color });
    el.innerHTML =
      '<div class="card-head"><div class="card-title"><h2>Proyeksi Akhir Periode</h2><span class="muted small">Periode A masih berjalan: hari ke-' + sa.el + " dari " + sa.days + ", sisa " + rem + " hari</span></div>" + chip + "</div>" +
      '<div class="proj-grid">' +
      '<div class="proj-item"><span class="muted" style="font-weight:600">Perkiraan total Periode A</span><span class="proj-value tnum">' + money(projTotal) + '</span><span class="muted small">Laju saat ini ' + money(sa.avg) + " per hari</span></div>" +
      '<div class="proj-item"><span class="muted" style="font-weight:600">' + (over ? "Sudah melewati Periode B" : "Batas aman per hari") + "</span>" +
      '<span class="proj-value tnum" style="color:' + (over ? "var(--danger)" : "var(--accent)") + '">' + (over ? money(sa.total - sb.total) : money(Math.floor((sb.total - sa.total) / Math.max(1, rem)))) + "</span>" +
      '<span class="muted small">' + (over ? "Pengeluaran sudah melebihi total Periode B" : "agar total tidak melebihi Periode B (sisa " + money(sb.total - sa.total) + " untuk " + rem + " hari)") + "</span></div>" +
      "</div>" +
      '<div style="display:flex;flex-direction:column;gap:10px"><div class="proj-bar">' +
      '<div class="proj-spent" style="width:' + (sa.total / scale) * 100 + '%"></div>' +
      '<div class="proj-rest" style="left:' + (sa.total / scale) * 100 + "%;width:" + ((projTotal - sa.total) / scale) * 100 + '%"></div>' +
      '<div class="proj-mark" style="left:' + (sb.total / scale) * 100 + '%"></div></div>' +
      '<div class="proj-legend">' +
      '<span><span class="dot" style="width:10px;height:10px;flex-basis:10px;background:var(--exp)"></span>Sudah terpakai ' + money(sa.total) + "</span>" +
      '<span><span class="dot" style="width:10px;height:10px;flex-basis:10px;background:var(--exp);opacity:0.35"></span>Proyeksi sisa ' + money(projTotal - sa.total) + "</span>" +
      '<span><span style="width:3px;height:14px;border-radius:2px;background:var(--text)"></span>Total Periode B ' + money(sb.total) + "</span>" +
      "</div></div>";
  }

  $("anaSwap").addEventListener("click", () => {
    anaSwap = !anaSwap;
    renderAnalysis();
  });
  document.querySelectorAll("[data-open-range]").forEach((b) => b.addEventListener("click", openRangeModal));

  /* ---------- Popup pilih rentang ---------- */

  // draft.a / draft.b = [start, end]; cal.a / cal.b = "YYYY-MM" bulan kalender
  // yang tampil; stage = klik ke-berapa di kalender (0 → set awal, 1 → set akhir).
  let rangeDraft = null;

  function openRangeModal() {
    const r = currentRanges();
    rangeDraft = {
      a: r.a.slice(), b: r.b.slice(),
      cal: { a: ymOf(r.a[0]), b: ymOf(r.b[0]) },
      stage: { a: 0, b: 0 },
    };
    $("rangeQuick").innerHTML = [["month", "Bulan ini vs bulan lalu"], ["week", "7 hari terakhir vs 7 hari sebelumnya"], ["half", "15 hari terakhir vs 15 hari sebelumnya"]]
      .map((x) => '<button type="button" class="quick-chip' + (anaPreset === x[0] && !anaSwap ? " active" : "") + '" data-quick="' + x[0] + '">' + x[1] + "</button>")
      .join("");
    $("rangeQuick").querySelectorAll("[data-quick]").forEach((b) =>
      b.addEventListener("click", () => {
        anaPreset = b.dataset.quick;
        anaSwap = false;
        closeModal("rangeModal");
        renderAnalysis();
      })
    );
    $("rangeError").textContent = "";
    renderRangeDraft();
    openModal("rangeModal");
  }

  function renderRangeDraft() {
    ["a", "b"].forEach((k) => {
      const K = k.toUpperCase();
      $("range" + K + "Start").value = rangeDraft[k][0] || "";
      $("range" + K + "End").value = rangeDraft[k][1] || "";
      renderCalendar($("rangeCal" + K), k);
    });
  }

  function renderCalendar(el, key) {
    const r = rangeDraft[key];
    const [y, m] = rangeDraft.cal[key].split("-").map(Number);
    const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7;
    const nd = daysInMonth(y, m - 1);
    let cells = "";
    for (let i = 0; i < offset; i++) cells += '<span class="cal-cell"></span>';
    for (let d = 1; d <= nd; d++) {
      const iso = y + "-" + pad2(m) + "-" + pad2(d);
      const edge = iso === r[0] || iso === r[1];
      const inR = r[0] && r[1] && iso >= r[0] && iso <= r[1];
      cells += '<button type="button" class="cal-cell' + (edge ? " edge" : inR ? " in-range" : "") + '" data-iso="' + iso + '" aria-label="' + longDate(iso) + '">' + d + "</button>";
    }
    el.style.setProperty("--cal", key === "a" ? "var(--exp)" : "var(--muted)");
    el.innerHTML =
      '<div class="cal-head"><button type="button" class="icon-btn" data-cal="-1" aria-label="Bulan sebelumnya">' + svgIcon(ICON.chevL, 16) + "</button>" +
      "<span>" + MONTH_NAMES[m - 1] + " " + y + "</span>" +
      '<button type="button" class="icon-btn" data-cal="1" aria-label="Bulan berikutnya">' + svgIcon(ICON.chevR, 16) + "</button></div>" +
      '<div class="cal-dow">' + DOW_SHORT.map((d) => "<span>" + d + "</span>").join("") + "</div>" +
      '<div class="cal-grid">' + cells + "</div>";
    el.querySelectorAll("[data-cal]").forEach((b) =>
      b.addEventListener("click", () => {
        const d = new Date(y, m - 1 + Number(b.dataset.cal), 1);
        rangeDraft.cal[key] = d.getFullYear() + "-" + pad2(d.getMonth() + 1);
        renderCalendar(el, key);
      })
    );
    el.querySelectorAll("[data-iso]").forEach((b) =>
      b.addEventListener("click", () => {
        const iso = b.dataset.iso;
        const rr = rangeDraft[key];
        if (rangeDraft.stage[key] === 0) {
          rangeDraft[key] = [iso, iso];
          rangeDraft.stage[key] = 1;
        } else {
          rangeDraft[key] = iso < rr[0] ? [iso, rr[0]] : [rr[0], iso];
          rangeDraft.stage[key] = 0;
        }
        renderRangeDraft();
      })
    );
  }

  ["a", "b"].forEach((k) => {
    const K = k.toUpperCase();
    [["Start", 0], ["End", 1]].forEach(([suffix, idx]) => {
      $("range" + K + suffix).addEventListener("change", (e) => {
        if (!rangeDraft) return;
        rangeDraft[k][idx] = e.target.value;
        rangeDraft.stage[k] = 0;
        if (e.target.value) rangeDraft.cal[k] = ymOf(e.target.value);
        renderCalendar($("rangeCal" + K), k);
      });
    });
  });

  $("rangeApplyBtn").addEventListener("click", () => {
    const ok = (r) => r[0] && r[1] && r[0] <= r[1];
    if (!ok(rangeDraft.a) || !ok(rangeDraft.b)) {
      $("rangeError").textContent = "Tanggal mulai dan sampai wajib diisi, dan tanggal mulai tidak boleh setelah tanggal sampai.";
      return;
    }
    anaPreset = "custom";
    anaCustom = { a: rangeDraft.a.slice(), b: rangeDraft.b.slice() };
    anaSwap = false;
    closeModal("rangeModal");
    renderAnalysis();
  });

  /* ================= Rencana ================= */

  function parseLocalDate(dateStr) {
    const p = String(dateStr).split("-").map(Number);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
  }

  function startOfWeek(ref) {
    const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }

  function isSameWeek(dateStr, ref) {
    const start = startOfWeek(ref);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const d = parseLocalDate(dateStr);
    return d >= start && d < end;
  }

  // Jendela waktu rencana — sama dgn mobile: Harian → hari ini; Mingguan →
  // minggu berjalan; Weekday/Weekend → subset minggu berjalan; Bulanan →
  // bulan yang dipilih (viewDate).
  function txInPlanPeriod(tx, period, now) {
    const dow = dowOf(tx.date);
    if (period === "harian") return tx.date === localDateStrOf(now.getTime());
    if (period === "mingguan") return isSameWeek(tx.date, now);
    if (period === "weekday") return isSameWeek(tx.date, now) && dow <= 4;
    if (period === "weekend") return isSameWeek(tx.date, now) && dow >= 5;
    return ymOf(tx.date) === viewYm();
  }

  // Pemakaian per kategori: nota lewat rincian_kategori, pindah cuma biaya
  // admin (Core.expenseInCategory). "semua" = total pengeluaran.
  // Yang dihitung transaksi milik target rencana (both = semua), bukan
  // mode user yang sedang dilihat.
  function planSpent(plan) {
    const now = new Date();
    return transactions
      .filter((t) => (plan.target === "both" || t.by === plan.target) && txInPlanPeriod(t, plan.period, now))
      .reduce((s, t) => s + Core.expenseInCategory(t, plan.category), 0);
  }

  // Mode Iyon/Ciwul → rencana untuk dia + rencana Both; mode Both → semua.
  function planVisible(plan) {
    return currentUser === "both" || plan.target === currentUser || plan.target === "both";
  }

  function planCategoryPool() {
    return [ALL_CATEGORY].concat(CATEGORIES.expense);
  }

  // Global — satu kategori+periode cuma boleh 1 rencana, siapa pun pembuatnya.
  function periodIsFull(period) {
    const used = plans.filter((p) => p.period === period).map((p) => p.category);
    return planCategoryPool().every((c) => used.indexOf(c.id) !== -1);
  }

  function planStatus(pct) {
    if (pct > 100) return { label: "Melebihi", color: "var(--danger)" };
    if (pct === 100) return { label: "Tercapai", color: "var(--warn)" };
    if (pct >= 80) return { label: "Mendekati batas", color: "var(--warn)" };
    return { label: "Aman", color: "var(--accent)" };
  }

  function periodCaption(period) {
    const today = todayStr();
    if (period === "harian") return "Dihitung dari pengeluaran hari ini, " + shortDateYear(today) + ".";
    const ws = startOfWeek(new Date());
    const we = new Date(ws);
    we.setDate(ws.getDate() + 6);
    const weekText = shortDate(localDateStrOf(ws.getTime())) + " – " + shortDateYear(localDateStrOf(we.getTime()));
    if (period === "mingguan") return "Dihitung dari pengeluaran minggu berjalan, Senin sampai Minggu (" + weekText + ").";
    if (period === "weekday") return "Dihitung dari pengeluaran Senin sampai Jumat minggu berjalan (" + weekText + ").";
    if (period === "weekend") return "Dihitung dari pengeluaran Sabtu sampai Minggu minggu berjalan (" + weekText + ").";
    return "Dihitung dari pengeluaran " + monthLabel(viewDate) + ".";
  }

  // Tab "Semua" = semua periode sekaligus, dikelompokkan per periode (urutan
  // PLAN_PERIODS). Bukan periode rencana — tidak pernah disimpan ke Firebase.
  const ALL_PERIODS_TAB = "semua";

  function plansOfPeriod(period) {
    return plans
      .filter((p) => p.period === period && planVisible(p))
      .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
  }

  function planCardHtml(plan, dragOff) {
    const cat = findCategory("expense", plan.category);
    const spent = planSpent(plan);
    const pct = plan.limit > 0 ? Math.round((spent / plan.limit) * 100) : 0;
    const st = planStatus(pct);
    const left = plan.limit - spent;
    const id = escapeHtml(plan.id);
    return '<article class="card plan-card" data-id="' + id + '">' +
      '<div class="plan-head">' +
      '<span class="plan-drag' + (dragOff ? " disabled" : "") + '" title="Geser untuk mengubah urutan" aria-hidden="true">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="' + ICON.grip + '"/></svg></span>' +
      tileHtml(cat, 44) +
      '<div class="plan-title"><span class="strong">' + escapeHtml(cat.label) + '</span><span class="item-sub">Batas ' + formatCurrency(plan.limit) + "</span></div>" +
      '<span class="chip" style="--chip:' + st.color + '">' + st.label + "</span>" +
      '<button type="button" class="icon-btn" data-plan-edit="' + id + '" aria-label="Edit rencana">' + svgIcon(ICON.edit, 17) + "</button>" +
      '<button type="button" class="icon-btn" data-plan-del="' + id + '" aria-label="Hapus rencana">' + svgIcon(ICON.trash, 17) + "</button>" +
      "</div>" +
      '<div class="plan-spent"><span class="plan-spent-value tnum">' + money(spent) + '</span><span class="strong tnum">' + pct + "%</span></div>" +
      '<div class="track track-10"><div class="fill" style="width:' + Math.min(100, pct) + "%;background:" + st.color + '"></div></div>' +
      '<div class="plan-foot"><span class="tnum">' + (left >= 0 ? "Sisa " + money(left) : "Lebih " + money(-left)) + "</span>" +
      '<span class="plan-by">' + avatarHtml(plan.target, 20) + "Target " + escapeHtml(userModeLabel(plan.target)) +
      '<span class="plan-maker">· dibuat ' + escapeHtml(userModeLabel(plan.by)) + "</span></span></div>" +
      "</article>";
  }

  function renderPlans() {
    const tabs = [[ALL_PERIODS_TAB, "Semua"]].concat(PLAN_PERIODS.map((p) => [p, PERIOD_LABELS[p]]));
    $("periodTabs").innerHTML = segTabsHtml(tabs, currentPeriod, "data-period");
    $("periodTabs").querySelectorAll("[data-period]").forEach((b) =>
      b.addEventListener("click", () => {
        currentPeriod = b.dataset.period;
        renderPlans();
      })
    );
    const all = currentPeriod === ALL_PERIODS_TAB;
    $("addPlanBtn").disabled = all ? PLAN_PERIODS.every(periodIsFull) : periodIsFull(currentPeriod);
    $("addPlanBtn").title = $("addPlanBtn").disabled
      ? all ? "Semua kategori di semua periode sudah punya rencana" : "Semua kategori di periode ini sudah punya rencana"
      : "";
    $("periodCaption").textContent = all ? "Semua rencana, dikelompokkan per periode." : periodCaption(currentPeriod);

    // Geser urutan cuma masuk akal per satu pemilik (sama spt mobile) — di mode
    // Both handle-nya disembunyikan. Di tab Semua, geser hanya di dalam grupnya
    // (urutan `sort` memang per periode).
    const dragOff = currentUser === "both";
    const grid = $("planGrid");
    grid.classList.toggle("plan-groups", all);

    if (all) {
      const groups = PLAN_PERIODS.map((p) => [p, plansOfPeriod(p)]).filter((g) => g[1].length);
      if (!groups.length) {
        grid.innerHTML = '<p class="empty-state">Belum ada rencana. Tambahkan untuk mulai mengatur budget kategori.</p>';
        return;
      }
      grid.innerHTML = groups
        .map((g) =>
          '<section class="plan-group">' +
          '<div class="plan-group-head"><h2 class="h2-sm">' + PERIOD_LABELS[g[0]] + ' <span class="muted tnum" style="font-weight:600">· ' + g[1].length + " rencana</span></h2>" +
          '<span class="muted small">' + escapeHtml(periodCaption(g[0])) + "</span></div>" +
          '<div class="plan-grid" data-group="' + g[0] + '">' + g[1].map((plan) => planCardHtml(plan, dragOff)).join("") + "</div>" +
          "</section>"
        )
        .join("");
      if (!dragOff) grid.querySelectorAll("[data-group]").forEach(wirePlanDrag);
      return;
    }

    const list = plansOfPeriod(currentPeriod);
    if (!list.length) {
      grid.innerHTML = '<p class="empty-state" style="grid-column:1/-1">Belum ada rencana ' + PERIOD_LABELS[currentPeriod].toLowerCase() + ". Tambahkan untuk mulai mengatur budget kategori.</p>";
      return;
    }
    grid.innerHTML = list.map((plan) => planCardHtml(plan, dragOff)).join("");
    if (!dragOff) wirePlanDrag(grid);
  }

  $("planGrid").addEventListener("click", (e) => {
    const edit = e.target.closest("[data-plan-edit]");
    const del = e.target.closest("[data-plan-del]");
    if (edit) {
      const plan = plans.find((p) => p.id === edit.dataset.planEdit);
      if (plan) openEditPlan(plan);
    } else if (del) {
      const plan = plans.find((p) => p.id === del.dataset.planDel);
      if (plan) confirmDeletePlan(plan);
    }
  });

  // Drag & drop urutan kartu rencana (HTML5 DnD; kartu baru bisa di-drag
  // setelah handle ditekan, supaya klik/seleksi teks di kartu tetap normal).
  function wirePlanDrag(grid) {
    let dragging = null;
    grid.querySelectorAll(".plan-card").forEach((card) => {
      const handle = card.querySelector(".plan-drag");
      handle.addEventListener("mousedown", () => (card.draggable = true));
      handle.addEventListener("mouseup", () => (card.draggable = false));
      card.addEventListener("dragstart", (e) => {
        dragging = card;
        card.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", card.dataset.id);
      });
      card.addEventListener("dragover", (e) => {
        if (!dragging || dragging === card) return;
        e.preventDefault();
        const cards = Array.from(grid.children);
        if (cards.indexOf(dragging) < cards.indexOf(card)) card.after(dragging);
        else card.before(dragging);
      });
      card.addEventListener("drop", (e) => e.preventDefault());
      card.addEventListener("dragend", () => {
        card.classList.remove("dragging");
        card.draggable = false;
        if (dragging) {
          dragging = null;
          commitPlanOrder(grid);
        }
      });
    });
  }

  function commitPlanOrder(grid) {
    const updates = {};
    Array.from(grid.querySelectorAll(".plan-card")).forEach((card, i) => {
      const plan = plans.find((p) => p.id === card.dataset.id);
      if (plan && plan.sort !== i) updates["plans/" + plan.period + "/" + plan.category + "/sort"] = i;
    });
    if (Object.keys(updates).length) financeRef.update(updates).catch(reportWriteError("menyimpan urutan"));
  }

  /* ---------- Modal tambah / edit / hapus rencana ---------- */

  let planBy = null;
  let planTarget = null;
  let editingPlan = null;
  let editPlanTarget = null;

  function openAddPlan() {
    const periodSel = $("planPeriod");
    periodSel.innerHTML = PLAN_PERIODS.map((p) => {
      const full = periodIsFull(p);
      return '<option value="' + p + '"' + (full ? " disabled" : "") + ">" + PERIOD_LABELS[p] + (full ? " (penuh)" : "") + "</option>";
    }).join("");
    const firstFree = PLAN_PERIODS.find((p) => !periodIsFull(p));
    if (!firstFree) {
      alert("Semua kategori di semua periode sudah punya rencana.");
      return;
    }
    // Dari tab Semua → default Bulanan (periode paling umum).
    const preferred = currentPeriod === ALL_PERIODS_TAB ? "bulanan" : currentPeriod;
    periodSel.value = periodIsFull(preferred) ? firstFree : preferred;
    fillPlanCategories(periodSel.value);
    $("planLimit").value = "";
    planBy = currentUser === "both" ? null : currentUser;
    $("planByLabel").textContent = byLabelText();
    renderPlanBy();
    planTarget = currentUser;
    renderPlanTarget();
    openModal("planModal");
  }

  function renderPlanBy() {
    renderByToggle($("planByToggle"), planBy, currentUser !== "both", (by) => {
      planBy = by;
      renderPlanBy();
    });
  }

  function renderPlanTarget() {
    renderTargetToggle($("planTargetToggle"), planTarget, (t) => {
      planTarget = t;
      renderPlanTarget();
    });
  }

  function renderEditPlanTarget() {
    renderTargetToggle($("planEditTargetToggle"), editPlanTarget, (t) => {
      editPlanTarget = t;
      renderEditPlanTarget();
    });
  }

  function fillPlanCategories(period) {
    const used = plans.filter((p) => p.period === period).map((p) => p.category);
    const free = planCategoryPool().filter((c) => used.indexOf(c.id) === -1);
    $("planCategory").innerHTML = free.length
      ? free.map((c) => '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.icon + " " + c.label) + "</option>").join("")
      : '<option value="" disabled selected>Semua kategori sudah dipakai</option>';
  }

  $("addPlanBtn").addEventListener("click", openAddPlan);
  $("planPeriod").addEventListener("change", (e) => fillPlanCategories(e.target.value));
  $("planLimit").addEventListener("input", function () {
    formatAmountInput(this);
  });

  $("planForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const period = $("planPeriod").value;
    const category = $("planCategory").value;
    const limit = parseAmount($("planLimit").value);
    if (!category) {
      alert("Semua kategori di periode ini sudah punya rencana.");
      return;
    }
    if (limit <= 0) {
      alert("Batas anggaran harus lebih dari 0.");
      return;
    }
    if (!planBy) {
      alert('Pilih dulu "Dibuat oleh" siapa.');
      return;
    }
    if (!planTarget) {
      alert('Pilih dulu "Target untuk" siapa.');
      return;
    }
    savePlan(period, category, limit, nextSortForPeriod(period), planBy, planTarget).catch(reportWriteError("menyimpan rencana"));
    if (currentPeriod !== ALL_PERIODS_TAB) currentPeriod = period; // di tab Semua tetap di Semua
    closeModal("planModal");
    renderPlans();
  });

  function planInfoHtml(plan, extra) {
    const cat = findCategory("expense", plan.category);
    return tileHtml(cat, 40) + '<div class="item-text"><span class="strong">' + escapeHtml(cat.label) + '</span><span class="item-sub">' + extra + "</span></div>";
  }

  function openEditPlan(plan) {
    editingPlan = plan;
    $("planEditInfo").innerHTML = '<div class="item-line">' +
      planInfoHtml(plan, "Periode " + PERIOD_LABELS[plan.period] + " · dibuat " + escapeHtml(userModeLabel(plan.by))) + "</div>";
    $("planEditLimit").value = plan.limit.toLocaleString("id-ID");
    editPlanTarget = plan.target;
    renderEditPlanTarget();
    openModal("planEditModal");
    $("planEditLimit").focus();
  }

  $("planEditLimit").addEventListener("input", function () {
    formatAmountInput(this);
  });

  $("planEditForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!editingPlan) return;
    const limit = parseAmount($("planEditLimit").value);
    if (limit <= 0) {
      alert("Batas anggaran harus lebih dari 0.");
      return;
    }
    const p = editingPlan;
    savePlan(p.period, p.category, limit, p.sort, p.by, editPlanTarget || p.target).catch(reportWriteError("menyimpan rencana"));
    editingPlan = null;
    closeModal("planEditModal");
  });

  function confirmDeletePlan(plan) {
    const pct = plan.limit > 0 ? Math.round((planSpent(plan) / plan.limit) * 100) : 0;
    openConfirm({
      title: "Hapus Rencana?",
      text: "Rencana ini akan dihapus permanen. Transaksi yang sudah tercatat tidak ikut terhapus.",
      itemHtml: planInfoHtml(plan, PERIOD_LABELS[plan.period] + " · Batas " + formatCurrency(plan.limit)) + '<span class="strong tnum">' + pct + "%</span>",
      onOk: () => deletePlan(plan).catch(reportWriteError("menghapus rencana")),
    });
  }

  /* ================= Kategori ================= */

  // A-Z by label, kategori "Lainnya" bawaan selalu paling akhir (spt mobile).
  function sortCategoriesForList(list) {
    return list.slice().sort((a, b) => {
      const la = isLainnyaCategory(a.id), lb = isLainnyaCategory(b.id);
      if (la !== lb) return la ? 1 : -1;
      return a.label.localeCompare(b.label, "id");
    });
  }

  // Termasuk nota yang salah satu item-nya berkategori ini (rincian_kategori).
  function categoryTxCount(type, id) {
    return visibleTransactions().filter((t) => t.type === type && (t.category === id || (t.rincian && id in t.rincian))).length;
  }

  function renderCategories() {
    ["expense", "income"].forEach((type) => {
      const list = sortCategoriesForList(CATEGORIES[type]);
      $(type === "expense" ? "catExpCount" : "catIncCount").textContent = list.length + " kategori";
      $(type === "expense" ? "catExpList" : "catIncList").innerHTML = list.length
        ? list.map((cat) => {
            const id = escapeHtml(cat.id);
            const actions = isLainnyaCategory(cat.id)
              ? ""
              : '<button type="button" class="icon-btn" data-cat-edit="' + id + '" data-type="' + type + '" aria-label="Edit kategori">' + svgIcon(ICON.edit, 17) + "</button>" +
                '<button type="button" class="icon-btn" data-cat-del="' + id + '" data-type="' + type + '" aria-label="Hapus kategori">' + svgIcon(ICON.trash, 17) + "</button>";
            return '<div class="cat-row">' + tileHtml(cat, 40) +
              '<div class="item-text"><span class="strong">' + escapeHtml(cat.label) + '</span><span class="item-sub">' + id + "</span></div>" +
              '<span class="cat-count tnum">' + categoryTxCount(type, cat.id) + " transaksi</span>" +
              '<div class="cat-actions">' + actions + "</div></div>";
          }).join("")
        : '<p class="empty-state">Belum ada kategori.</p>';
    });
  }

  $("view-categories").addEventListener("click", (e) => {
    const add = e.target.closest("[data-add-cat]");
    const edit = e.target.closest("[data-cat-edit]");
    const del = e.target.closest("[data-cat-del]");
    if (add) openCatModal(add.dataset.addCat, null);
    else if (edit) {
      const cat = CATEGORIES[edit.dataset.type].find((c) => c.id === edit.dataset.catEdit);
      if (cat) openCatModal(edit.dataset.type, cat);
    } else if (del) {
      const cat = CATEGORIES[del.dataset.type].find((c) => c.id === del.dataset.catDel);
      if (cat) confirmDeleteCategory(del.dataset.type, cat);
    }
  });

  /* ---------- Modal buat / edit kategori ---------- */

  let catForm = null; // { type, cat (null = buat baru), slot }

  function slugifyCategoryId(text) {
    return String(text)
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  // Ambil grapheme pertama — emoji bisa terdiri dari beberapa code unit.
  function firstGrapheme(str) {
    const s = String(str).trim();
    if (!s) return "";
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      const first = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)[Symbol.iterator]().next();
      return first.done ? "" : first.value.segment;
    }
    return Array.from(s)[0] || "";
  }

  function openCatModal(type, cat) {
    catForm = { type, cat, slot: cat ? slotOf(cat) : 1 };
    $("catTitle").textContent = (cat ? "Edit Kategori " : "Tambah Kategori ") + TYPE_LABELS[type];
    $("catId").value = cat ? cat.id : "";
    $("catId").disabled = !!cat;
    $("catLabel").value = cat ? cat.label : "";
    $("catIcon").value = cat ? cat.icon : "";
    renderCatForm();
    openModal("catModal");
    (cat ? $("catLabel") : $("catId")).focus();
  }

  function catIdError() {
    if (!catForm || catForm.cat) return "";
    const raw = $("catId").value.trim();
    if (!raw) return "";
    const id = slugifyCategoryId(raw);
    if (!id) return "ID hanya boleh berisi huruf, angka, dan tanda -";
    if (id === ALL_CATEGORY.id) return 'ID "semua" dipakai oleh sistem';
    if (categoryExists(catForm.type, id)) return "ID sudah dipakai kategori lain";
    return "";
  }

  function renderCatForm() {
    const label = $("catLabel").value.trim();
    const icon = firstGrapheme($("catIcon").value);
    $("catPreviewTile").innerHTML = tileHtml({ icon: icon || "❔", colorSlot: catForm.slot }, 44);
    $("catPreviewLabel").textContent = label || "Nama kategori";
    const err = catIdError();
    $("catIdError").textContent = err;
    const idOk = catForm.cat || (slugifyCategoryId($("catId").value) && !err);
    $("catSaveBtn").disabled = !(label && icon && idOk);
    const slots = [];
    for (let s = 1; s <= SERIES_SLOT_COUNT; s++) {
      slots.push('<button type="button" class="slot' + (s === catForm.slot ? " selected" : "") + '" style="--slot:var(--series-' + s + ')" data-slot="' + s + '" aria-label="Warna ' + s + '" aria-pressed="' + (s === catForm.slot) + '"></button>');
    }
    $("catSlots").innerHTML = slots.join("");
    $("catSlots").querySelectorAll("[data-slot]").forEach((b) =>
      b.addEventListener("click", () => {
        catForm.slot = Number(b.dataset.slot);
        renderCatForm();
      })
    );
  }

  $("catId").addEventListener("input", renderCatForm);
  $("catLabel").addEventListener("input", renderCatForm);
  $("catIcon").addEventListener("input", () => {
    const g = firstGrapheme($("catIcon").value);
    if ($("catIcon").value !== g) $("catIcon").value = g;
    renderCatForm();
  });

  $("catForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!catForm || $("catSaveBtn").disabled) return;
    const label = $("catLabel").value.trim();
    const icon = firstGrapheme($("catIcon").value);
    const id = catForm.cat ? catForm.cat.id : slugifyCategoryId($("catId").value);
    if (!catForm.cat && (catIdError() || !id)) return;
    saveCategory(catForm.type, { id, label, icon, colorSlot: catForm.slot }).catch(reportWriteError("menyimpan kategori"));
    catForm = null;
    closeModal("catModal");
  });

  function confirmDeleteCategory(type, cat) {
    openConfirm({
      title: "Hapus Kategori?",
      text: "Transaksi lama dengan kategori ini tetap tersimpan, tetapi tampil tanpa nama kategori.",
      itemHtml: tileHtml(cat, 40) +
        '<div class="item-text"><span class="strong">' + escapeHtml(cat.label) + '</span><span class="item-sub">' + escapeHtml(cat.id) + "</span></div>" +
        '<span class="muted small tnum">' + categoryTxCount(type, cat.id) + " transaksi</span>",
      onOk: () => deleteCategory(type, cat.id).catch(reportWriteError("menghapus kategori")),
    });
  }

  /* ================= Tambah transaksi (Manual / Import) ================= */

  const txState = { tab: "manual", mode: "satuan", type: "expense", by: null, account: "bank" };

  function openTxModal(tab) {
    txState.tab = tab || "manual";
    txState.mode = "satuan";
    txState.type = "expense";
    txState.by = currentUser === "both" ? null : currentUser;
    // Default account = tab yang sedang dibuka (kalau bukan "Semua").
    txState.account = ACCOUNT_BY_ID[acctFilter] ? acctFilter : "bank";
    $("txForm").reset();
    const now = Date.now();
    $("txDate").value = localDateStrOf(now);
    $("txTime").value = formatTime(now);
    resetImport();
    resetTransferForm();
    fillTxCategories();
    renderTxModal();
    openModal("txModal");
    if (txState.tab === "manual") $("txAmount").focus();
  }

  function fillTxCategories() {
    $("txCategory").innerHTML = CATEGORIES[txState.type]
      .map((c) => '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.icon + " " + c.label) + "</option>")
      .join("");
  }

  function renderTxModal() {
    document.querySelectorAll("[data-tx-tab]").forEach((b) => {
      const on = b.dataset.txTab === txState.tab;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on);
    });
    document.querySelectorAll("[data-tx-panel]").forEach((p) => (p.hidden = p.dataset.txPanel !== txState.tab));
    document.querySelectorAll("[data-tx-mode]").forEach((p) => (p.hidden = p.dataset.txMode !== txState.mode));
    $("txModeToggle").querySelectorAll("[data-mode]").forEach((b) => {
      if (b.dataset.mode === "pindah") b.hidden = !ENABLE_TRANSFER;
      const on = b.dataset.mode === txState.mode;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on);
    });
    $("txTypeToggle").querySelectorAll("[data-type]").forEach((b) => {
      const on = b.dataset.type === txState.type;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on);
    });
    const locked = currentUser !== "both";
    const pick = (by) => {
      txState.by = by;
      renderTxModal();
    };
    $("txByLabel").textContent = byLabelText();
    $("importByLabel").textContent = byLabelText();
    renderByToggle($("txByToggle"), txState.by, locked, pick);
    renderByToggle($("importByToggle"), txState.by, locked, pick);
    $("tfByLabel").textContent = byLabelText();
    renderByToggle($("tfByToggle"), txState.by, locked, pick);
    renderTransferForm();
    renderAccountPicker($("txAcctToggle"), txState.account, (id) => {
      txState.account = id;
      renderTxModal();
    });
    renderTxKodePreview();
    renderImport();
  }

  function renderTxKodePreview() {
    $("txKodePreview").textContent = previewKode({ bentuk: "satuan", account_type: txState.account, tanggal: $("txDate").value });
  }

  $("addTxBtn").addEventListener("click", () => openTxModal("manual"));
  $("txModeToggle").querySelectorAll("[data-mode]").forEach((b) =>
    b.addEventListener("click", () => {
      txState.mode = b.dataset.mode;
      renderTxModal();
    })
  );
  // Mode Nota: tutup popup → halaman Nota (bawa jenis/account/pembuat dari popup).
  $("openNotaBtn").addEventListener("click", () => {
    closeModal("txModal");
    openNota(null, { type: txState.type, account: txState.account, by: txState.by });
  });
  document.querySelectorAll("[data-tx-tab]").forEach((b) =>
    b.addEventListener("click", () => {
      txState.tab = b.dataset.txTab;
      renderTxModal();
    })
  );
  $("txTypeToggle").querySelectorAll("[data-type]").forEach((b) =>
    b.addEventListener("click", () => {
      txState.type = b.dataset.type;
      fillTxCategories();
      renderTxModal();
    })
  );
  $("txAmount").addEventListener("input", function () {
    formatAmountInput(this);
  });
  // Ganti tanggal → waktu reset ke awal hari (aturan sama dgn mobile).
  $("txDate").addEventListener("change", () => {
    $("txTime").value = "00:00:00";
    renderTxKodePreview(); // bulan kode ikut tanggal
  });

  $("txForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = parseAmount($("txAmount").value);
    const category = $("txCategory").value;
    const date = $("txDate").value;
    // Sebagian browser mengembalikan "HH:MM" kalau detiknya 00 → lengkapi.
    const rawTime = $("txTime").value;
    const time = /^\d{2}:\d{2}$/.test(rawTime) ? rawTime + ":00" : rawTime;
    if (amount <= 0) {
      alert("Jumlah harus lebih dari 0.");
      return;
    }
    if (!category) {
      alert("Pilih dulu kategorinya.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      alert("Pilih dulu tanggalnya.");
      return;
    }
    if (!/^\d{2}:\d{2}:\d{2}$/.test(time)) {
      alert("Pilih dulu waktunya.");
      return;
    }
    if (!txState.by) {
      alert('Pilih dulu "Dibuat oleh" siapa.');
      return;
    }
    if (!requireOnline()) return;
    addSatuan({
      type: txState.type,
      account_type: txState.account,
      category,
      nominal: amount,
      catatan: $("txNote").value.trim(),
      tanggal: date,
      waktu: time,
      by: txState.by,
    }).catch(reportWriteError("menyimpan transaksi"));
    closeModal("txModal");
  });

  /* ---------- Import Excel / CSV ---------- */

  const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
  let importState = null; // { name, rows: [data valid], errors: [{ row, msgs }], total }
  let importBusy = false;

  function resetImport() {
    importState = null;
    importBusy = false;
    $("importFile").value = "";
  }

  function renderImport() {
    const zone = $("dropZone");
    zone.classList.toggle("has-file", !!importState);
    $("dropTitle").textContent = importState ? importState.name : "Klik untuk pilih file atau seret ke sini";
    $("dropHint").textContent = importState ? importState.total + " baris terbaca · klik untuk ganti file" : "Format .xlsx atau .csv, maksimal 5 MB";
    $("importSummary").hidden = !importState;
    if (importState) {
      $("importValid").textContent = importState.rows.length + " baris";
      $("importInvalid").textContent = importState.errors.length + " baris";
    }
    $("importBtn").disabled = !importState || importBusy;
    $("importBtn").textContent = importBusy ? "Mengimpor…" : "Import";
  }

  $("dropZone").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", (e) => handleImportFile(e.target.files[0]));
  $("dropZone").addEventListener("dragover", (e) => {
    e.preventDefault();
    $("dropZone").classList.add("dragover");
  });
  $("dropZone").addEventListener("dragleave", () => $("dropZone").classList.remove("dragover"));
  $("dropZone").addEventListener("drop", (e) => {
    e.preventDefault();
    $("dropZone").classList.remove("dragover");
    handleImportFile(e.dataTransfer.files[0]);
  });

  function handleImportFile(file) {
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      alert("Format file harus .xlsx atau .csv.");
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      alert("Ukuran file maksimal 5 MB.");
      return;
    }
    if (typeof XLSX === "undefined") {
      alert("Gagal memuat modul Excel. Cek koneksi internet.");
      return;
    }
    file
      .arrayBuffer()
      .then((buf) => {
        // raw:true → teks di CSV tidak di-parse jadi tanggal/angka otomatis.
        const wb = XLSX.read(buf, { type: "array", raw: true });
        const ws = wb.Sheets.Transaksi || wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
        importState = Object.assign({ name: file.name }, parseImportRows(aoa));
        renderImport();
      })
      .catch((err) => {
        console.error("Gagal membaca file import:", err);
        alert("File tidak bisa dibaca. Pastikan formatnya .xlsx atau .csv.");
      })
      .finally(() => ($("importFile").value = ""));
  }

  // Excel menyimpan tanggal/jam sbg angka serial (hari sejak 1899-12-30).
  const EXCEL_EPOCH_OFFSET = 25569; // serial untuk 1970-01-01

  function parseImportDate(v) {
    if (typeof v === "number" && isFinite(v) && v > 0) return isoOfDay(Math.floor(v) - EXCEL_EPOCH_OFFSET);
    const s = String(v).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    return isoOfDay(dayNum(s)) === s ? s : null; // tolak tanggal mustahil (mis. 2026-02-30)
  }

  function parseImportTime(v) {
    if (typeof v === "number" && isFinite(v) && v >= 0) {
      const secs = Math.round((v - Math.floor(v)) * 86400) % 86400;
      return pad2(Math.floor(secs / 3600)) + ":" + pad2(Math.floor((secs % 3600) / 60)) + ":" + pad2(secs % 60);
    }
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(v).trim());
    if (!m) return null;
    const h = Number(m[1]), mi = Number(m[2]), s = Number(m[3] || 0);
    if (h > 23 || mi > 59 || s > 59) return null;
    return pad2(h) + ":" + pad2(mi) + ":" + pad2(s);
  }

  function parseImportAmount(v) {
    if (typeof v === "number") return isFinite(v) ? Math.round(v) : null;
    const s = String(v).trim().replace(/^rp\.?\s*/i, "");
    if (/^\d+$/.test(s)) return Number(s);
    if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ""));
    return null;
  }

  // Kosong → bank. Terima id (bank/cash/e_money) & label (Bank/Cash/E-Money).
  function parseImportAccount(v) {
    const s = String(v).trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (!s) return "bank";
    if (s === "emoney") return "e_money";
    return ACCOUNT_BY_ID[s] ? s : null;
  }

  function parseImportRows(aoa) {
    // Keterangan format dalam kurung diabaikan: "Tanggal (yyyy-mm-dd)" = "tanggal"
    // (header template), "Tanggal" (header export) tetap cocok.
    const header = (aoa[0] || []).map((h) => String(h).trim().toLowerCase().replace(/\s*\(.*\)$/, ""));
    const col = (name) => header.indexOf(name);
    // Account Type opsional (file lama tanpa kolom ini → semua bank).
    const acctCol = ["account type", "account_type", "account"].map(col).find((i) => i !== -1);
    const cols = { tanggal: col("tanggal"), waktu: col("waktu"), account: acctCol === undefined ? -1 : acctCol, tipe: col("tipe"), kategori: col("kategori"), nominal: col("nominal"), catatan: col("catatan") };
    const missing = ["Tanggal", "Waktu", "Tipe", "Kategori", "Nominal"].filter((h) => cols[h.toLowerCase()] === -1);
    if (missing.length) {
      return { rows: [], total: Math.max(0, aoa.length - 1), errors: [{ row: 1, msgs: missing.map((h) => 'Kolom "' + h + '" tidak ditemukan di baris judul') }] };
    }

    // Lookup kategori per tipe: "Label (keluar)", "Label", atau id.
    const lookup = { expense: {}, income: {} };
    ["expense", "income"].forEach((type) => {
      CATEGORIES[type].forEach((c) => {
        const key = c.label.trim().toLowerCase();
        if (!lookup[type][key]) lookup[type][key] = c;
        lookup[type]["id:" + c.id] = c;
      });
    });

    const rows = [], errors = [];
    let total = 0;
    for (let r = 1; r < aoa.length; r++) {
      const line = aoa[r] || [];
      // Baris kosong dilewati — termasuk baris contoh template yang cuma berisi
      // Tanggal & Waktu (belum ditimpa user).
      if (line.every((v, i) => i === cols.tanggal || i === cols.waktu || String(v).trim() === "")) continue;
      total++;
      const msgs = [];
      const cell = (k) => (cols[k] === -1 ? "" : line[cols[k]]);

      const date = parseImportDate(cell("tanggal"));
      if (!date) msgs.push("Format Tanggal harus sesuai (contoh : 2026-10-30)");
      const time = parseImportTime(cell("waktu"));
      if (!time) msgs.push("Format Waktu harus sesuai (contoh : 08:00:00)");

      const account = parseImportAccount(cell("account"));
      if (!account) msgs.push('Account Type harus bank, cash, atau e_money (kosong = bank), bukan "' + String(cell("account")).trim() + '"');

      const typeRaw = String(cell("tipe")).trim().toLowerCase();
      const type = typeRaw === "pengeluaran" ? "expense" : typeRaw === "pemasukan" ? "income" : null;
      if (!type) msgs.push("Tipe harus Pengeluaran atau Pemasukan");

      const amount = parseImportAmount(cell("nominal"));
      if (amount === null) msgs.push("Nominal harus berupa angka");
      else if (amount <= 0) msgs.push("Nominal harus lebih dari 0");

      const catRaw = String(cell("kategori")).trim();
      let category = null;
      if (!catRaw) msgs.push("Kategori wajib diisi");
      else if (type) {
        const sfx = /\s*\((keluar|masuk)\)\s*$/i.exec(catRaw);
        const name = (sfx ? catRaw.slice(0, sfx.index) : catRaw).trim();
        const sfxType = sfx ? (sfx[1].toLowerCase() === "masuk" ? "income" : "expense") : null;
        if (sfxType && sfxType !== type) {
          msgs.push('Kategori "' + catRaw + '" bukan kategori ' + TYPE_LABELS[type].toLowerCase());
        } else {
          const c = lookup[type][name.toLowerCase()] || lookup[type]["id:" + name.toLowerCase()];
          if (c) category = c.id;
          else msgs.push('Kategori "' + name + '" tidak ditemukan');
        }
      }

      if (msgs.length) errors.push({ row: r + 1, msgs });
      else rows.push({ date, time, account_type: account, type, amount, category, note: String(cell("catatan")).trim() });
    }
    if (!total) errors.push({ row: 2, msgs: ["File tidak berisi transaksi"] });
    return { rows, errors, total };
  }

  $("importBtn").addEventListener("click", async () => {
    if (!importState || importBusy) return;
    if (importState.errors.length) {
      closeModal("txModal");
      showImportFail(importState.errors);
      return;
    }
    if (!txState.by) {
      alert('Pilih dulu "Dibuat oleh" siapa.');
      return;
    }
    if (!requireOnline()) return;
    const by = txState.by;
    const { rows, name } = importState;
    importBusy = true;
    renderImport();
    let saved = 0;
    try {
      // Berurutan supaya nomor kode urut sesuai urutan baris (per prefix
      // account per bulan).
      for (const row of rows) {
        await addSatuan({
          type: row.type,
          account_type: row.account_type,
          category: row.category,
          nominal: row.amount,
          catatan: row.note,
          tanggal: row.date,
          waktu: row.time,
          by,
        });
        saved++;
      }
    } catch (err) {
      console.error("Import gagal:", err);
      importBusy = false;
      renderImport();
      alert("Import terhenti karena gagal menyimpan ke server (cek koneksi). " + saved + " dari " + rows.length + " transaksi sudah tersimpan.");
      return;
    }
    importBusy = false;
    closeModal("txModal");
    $("importOkDesc").innerHTML = rows.length + " transaksi dari <b>" + escapeHtml(name) + "</b> sudah ditambahkan.";
    $("importOkExp").textContent = rows.filter((r) => r.type === "expense").length + " transaksi";
    $("importOkInc").textContent = rows.filter((r) => r.type === "income").length + " transaksi";
    $("importOkBy").textContent = USERS[by].label;
    $("importOkAcct").textContent = ACCOUNTS.map((a) => [a.label, rows.filter((r) => r.account_type === a.id).length])
      .filter((x) => x[1])
      .map((x) => x[0] + " " + x[1])
      .join(" · ");
    openModal("importOkModal");
  });

  function showImportFail(errors) {
    $("importFailTotal").textContent = errors.length + " row error";
    $("importFailRows").innerHTML = errors
      .map((e) => e.msgs.map((m, j) => '<div class="error-row"><span>' + (j === 0 ? e.row : "") + "</span><span>" + escapeHtml(m) + "</span></div>").join(""))
      .join("");
    openModal("importFailModal");
  }

  $("importRetryBtn").addEventListener("click", () => {
    closeModal("importFailModal");
    openTxModal("import");
  });

  $("templateBtn").addEventListener("click", () => {
    const btn = $("templateBtn");
    if (!window.FinanceTemplate) return;
    const today = todayStr();
    const exp = CATEGORIES.expense[0], inc = CATEGORIES.income[0];
    const examples = [];
    if (exp) examples.push([today, "12:30:00", "cash", "Pengeluaran", exp.label + " (keluar)", 35000, "Makan siang"]);
    if (inc) examples.push([today, "08:00:00", "bank", "Pemasukan", inc.label + " (masuk)", 8500000, "Gaji bulan ini"]);
    btn.disabled = true;
    FinanceTemplate.download("template-import-transaksi.xlsx", {
      accounts: ACCOUNTS.map((a) => a.id),
      types: ["Pengeluaran", "Pemasukan"],
      categories: CATEGORIES.expense.map((c) => c.label + " (keluar)").concat(CATEGORIES.income.map((c) => c.label + " (masuk)")),
      examples,
      // Baris 2 sheet Transaksi: contoh Tanggal & Waktu saat ini (format yang benar).
      now: [today, formatTime(Date.now())],
    })
      .catch((err) => {
        console.error("Gagal membuat template:", err);
        alert("Gagal membuat template. Cek koneksi internet.");
      })
      .finally(() => (btn.disabled = false));
  });

  /* ================= Halaman Nota (V2) ================= */

  // State form nota. Angka (qty/harga/nilai) disimpan sbg TEKS input dan baru
  // di-parse saat dihitung, supaya mengetik "0," atau "2,5" tidak terganggu.
  // Perhitungan (subtotal, penyesuaian, alokasi kategori) → Core.computeNota.
  let nota = null; // { tx (null = baru), type, account, by, items, adj, dirty, showErrors }
  let pendingNotaHash = null; // "#nota…" dibuka sebelum data pertama tiba
  let notaSaving = false;

  // Tombol cepat penyesuaian: [label, efek, mode, nilai awal].
  const ADJ_PRESETS = {
    expense: [
      ["Diskon", "kurang", "persen", ""],
      ["Promo", "kurang", "nominal", ""],
      ["Voucher", "kurang", "nominal", ""],
      ["Cashback", "kurang", "nominal", ""],
      ["PPN", "tambah", "persen", "11"],
      ["Ongkir", "tambah", "nominal", ""],
      ["Biaya layanan", "tambah", "nominal", ""],
    ],
    income: [
      ["Pajak", "kurang", "persen", ""],
      ["PPh", "kurang", "persen", ""],
      ["Biaya admin", "kurang", "nominal", ""],
    ],
  };

  // "2,5" / "2.5" / "1.250,5" → angka. Koma ada → titik = pemisah ribuan.
  function parseDecimal(str) {
    const s = String(str).trim();
    const n = Number(s.indexOf(",") !== -1 ? s.replace(/\./g, "").replace(",", ".") : s);
    return s && isFinite(n) ? n : NaN;
  }

  function blankItem(type) {
    const first = CATEGORIES[type][0];
    return { nama: "", category: first ? first.id : "", qty: "1", satuan: "pcs", harga: "" };
  }

  function openNota(tx, defaults) {
    const now = Date.now();
    if (tx) {
      nota = {
        tx,
        type: tx.type,
        account: tx.account_type,
        by: tx.by,
        items: tx.items.map((i) => ({
          nama: i.nama || "",
          category: i.category || "",
          qty: formatQty(i.qty || 0),
          satuan: i.satuan || "pcs",
          harga: Number(i.harga || 0).toLocaleString("id-ID"),
        })),
        adj: tx.penyesuaian.map((p) => ({
          label: p.label || "",
          efek: p.efek === "tambah" ? "tambah" : "kurang",
          mode: p.mode === "persen" ? "persen" : "nominal",
          nilai: p.mode === "persen" ? formatQty(p.nilai || 0) : Number(p.nilai || 0).toLocaleString("id-ID"),
        })),
        dirty: false,
        showErrors: false,
      };
      $("notaTitle").value = tx.title || "";
      $("notaDate").value = tx.date;
      $("notaTime").value = tx.time;
    } else {
      const d = defaults || {};
      const type = d.type || "expense";
      nota = {
        tx: null,
        type,
        account: d.account || (ACCOUNT_BY_ID[acctFilter] ? acctFilter : "bank"),
        by: currentUser === "both" ? d.by || null : currentUser,
        items: [blankItem(type)],
        adj: [],
        dirty: false,
        showErrors: false,
      };
      $("notaTitle").value = "";
      $("notaDate").value = localDateStrOf(now);
      $("notaTime").value = formatTime(now);
    }
    if (!nota.items.length) nota.items.push(blankItem(nota.type));
    history.replaceState(null, "", tx ? "#nota/" + tx.ym + "/" + encodeURIComponent(tx.id) : "#nota");
    renderNotaForm();
    setView("nota");
    if (!tx) $("notaTitle").focus();
  }

  // "#nota" = nota baru, "#nota/<ym>/<id>" = edit. Sebelum data pertama tiba
  // (kategori & transaksi belum ada) dibuka belakangan oleh subscribeFinance.
  function openNotaFromHash(v) {
    if (!loadingHidden) {
      pendingNotaHash = v;
      return;
    }
    const parts = v.split("/");
    if (parts.length < 3) {
      openNota(null);
      return;
    }
    const ym = parts[1], id = decodeURIComponent(parts[2]);
    const tx = transactions.find((t) => t.ym === ym && t.id === id && t.bentuk === "nota");
    if (tx) openNota(tx);
    else {
      alert("Nota tidak ditemukan (mungkin sudah dihapus).");
      setView("transactions");
    }
  }

  function leaveNotaOk() {
    if (!nota || !nota.dirty || notaSaving) return true;
    return confirm("Perubahan nota belum disimpan. Tinggalkan halaman ini?");
  }

  function renderNotaForm() {
    const editing = !!nota.tx;
    $("notaCrumb").textContent = editing ? "Edit Nota" : "Nota Baru";
    $("notaDate").disabled = editing;
    $("notaLockedHint").hidden = !editing;
    $("notaTypeToggle").querySelectorAll("[data-type]").forEach((b) => {
      const on = b.dataset.type === nota.type;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on);
      b.disabled = editing;
    });
    $("notaByLabel").textContent = editing ? "Dibuat oleh" : byLabelText();
    renderNotaBy();
    renderAccountPicker(
      $("notaAcctToggle"),
      nota.account,
      (id) => {
        nota.account = id;
        nota.dirty = true;
        renderNotaForm();
      },
      editing
    );
    $("notaKodeSuffix").textContent = editing ? " · tidak bisa diubah" : " · dibuat otomatis saat disimpan";
    $("notaQuickAdj").innerHTML = ADJ_PRESETS[nota.type]
      .map((p, i) => '<button type="button" class="quick-chip" data-preset="' + i + '">+ ' + p[0] + "</button>")
      .join("");
    renderNotaItems();
    renderNotaAdj();
    renderNotaSummary();
  }

  function renderNotaBy() {
    const locked = !nota.tx && currentUser !== "both";
    renderByToggle($("notaByToggle"), nota.by, locked, (by) => {
      nota.by = by;
      nota.dirty = true;
      renderNotaBy();
      renderNotaSummary();
    });
  }

  // Satuan item nota: pcs (jumlah barang), kg & liter (qty boleh desimal,
  // mis. 250 gram → 0.25 kg). Satuan lain dari nota lama tetap dipertahankan.
  const NOTA_UNITS = ["pcs", "kg", "liter"];

  function unitOptionsHtml(selected) {
    const units = selected && NOTA_UNITS.indexOf(selected) === -1 ? [selected].concat(NOTA_UNITS) : NOTA_UNITS;
    return units.map((u) => '<option value="' + escapeHtml(u) + '"' + (u === (selected || "pcs") ? " selected" : "") + ">" + escapeHtml(u) + "</option>").join("");
  }

  function categoryOptionsHtml(type, selected) {
    let html = CATEGORIES[type]
      .map((c) => '<option value="' + escapeHtml(c.id) + '"' + (c.id === selected ? " selected" : "") + ">" + escapeHtml(c.icon + " " + c.label) + "</option>")
      .join("");
    if (selected && !categoryExists(type, selected)) {
      html = '<option value="' + escapeHtml(selected) + '" selected>❓ ' + escapeHtml(selected) + " (terhapus)</option>" + html;
    }
    return html;
  }

  function renderNotaItems() {
    const only = nota.items.length === 1;
    $("notaItemRows").innerHTML = nota.items
      .map((it, i) => {
        const n = i + 1;
        return '<div class="nota-grid nota-row" data-i="' + i + '">' +
          '<span class="nota-num tnum">' + n + "</span>" +
          '<input class="input" data-f="nama" aria-label="Nama item ' + n + '" placeholder="Nama item" value="' + escapeHtml(it.nama) + '">' +
          '<select class="input" data-f="category" aria-label="Kategori item ' + n + '">' + categoryOptionsHtml(nota.type, it.category) + "</select>" +
          '<input class="input input-center tnum" data-f="qty" inputmode="decimal" aria-label="Qty item ' + n + '" value="' + escapeHtml(it.qty) + '">' +
          '<select class="input" data-f="satuan" aria-label="Satuan item ' + n + '">' + unitOptionsHtml(it.satuan) + "</select>" +
          '<div class="money-sm"><span>Rp</span><input class="tnum" data-f="harga" inputmode="numeric" aria-label="Harga satuan item ' + n + '" placeholder="0" value="' + escapeHtml(it.harga) + '"></div>' +
          '<span class="nota-sub" data-sub="' + i + '"></span>' +
          '<button type="button" class="icon-btn" data-del-item="' + i + '" aria-label="Hapus item ' + n + '"' + (only ? " disabled" : "") + ">" + svgIcon(ICON.trash, 17) + "</button>" +
          "</div>";
      })
      .join("");
  }

  function renderNotaAdj() {
    const opt = (v, label, cur) => '<option value="' + v + '"' + (v === cur ? " selected" : "") + ">" + label + "</option>";
    $("notaAdjRows").innerHTML = nota.adj
      .map((p, j) => {
        const n = j + 1;
        return '<div class="adj-row" data-j="' + j + '">' +
          '<input class="input" data-f="label" aria-label="Label penyesuaian ' + n + '" placeholder="mis. Diskon member" value="' + escapeHtml(p.label) + '">' +
          '<select class="input" data-f="efek" aria-label="Efek penyesuaian ' + n + '">' + opt("kurang", "Kurangi", p.efek) + opt("tambah", "Tambah", p.efek) + "</select>" +
          '<select class="input" data-f="mode" aria-label="Mode penyesuaian ' + n + '">' + opt("nominal", "Rp", p.mode) + opt("persen", "%", p.mode) + "</select>" +
          '<div class="money-sm"><span>' + (p.mode === "persen" ? "%" : "Rp") + '</span><input class="tnum" data-f="nilai" inputmode="decimal" aria-label="Nilai penyesuaian ' + n + '" placeholder="0" value="' + escapeHtml(p.nilai) + '"></div>' +
          '<span class="adj-result ' + p.efek + '" data-res="' + j + '"></span>' +
          '<button type="button" class="icon-btn" data-del-adj="' + j + '" aria-label="Hapus penyesuaian ' + n + '">' + svgIcon(ICON.trash, 17) + "</button>" +
          "</div>";
      })
      .join("");
  }

  function notaInput() {
    return {
      items: nota.items.map((it) => ({ nama: it.nama, category: it.category, qty: parseDecimal(it.qty), satuan: it.satuan, harga: parseAmount(it.harga) })),
      penyesuaian: nota.adj.map((p) => ({ label: p.label, efek: p.efek, mode: p.mode, nilai: p.mode === "persen" ? parseDecimal(p.nilai || "0") : parseAmount(p.nilai) })),
    };
  }

  function notaFields() {
    const raw = $("notaTime").value;
    return Object.assign(notaInput(), {
      type: nota.type,
      account_type: nota.account,
      judul: $("notaTitle").value,
      by: nota.by,
      tanggal: $("notaDate").value,
      waktu: /^\d{2}:\d{2}$/.test(raw) ? raw + ":00" : raw,
      timestamp: nota.tx ? nota.tx.timestamp : Date.now(),
    });
  }

  // Hitung ulang & perbarui angka/struk TANPA me-render ulang input.
  function renderNotaSummary() {
    if (!nota || currentView !== "nota") return;
    const calc = Core.computeNota(notaInput());
    calc.items.forEach((it, i) => {
      const el = document.querySelector('#notaItemRows [data-sub="' + i + '"]');
      if (el) el.textContent = formatCurrency(it.subtotal);
    });
    calc.penyesuaian.forEach((p, j) => {
      const el = document.querySelector('#notaAdjRows [data-res="' + j + '"]');
      if (!el) return;
      el.textContent = (p.efek === "kurang" ? "− " : "+ ") + formatCurrency(p.jumlah);
      el.className = "adj-result " + p.efek;
    });
    $("notaItemCount").textContent = "· " + nota.items.length + " item";
    $("notaSubtotal").textContent = formatCurrency(calc.subtotal);
    $("notaAdjTotal").textContent = (calc.total_penyesuaian < 0 ? "− " : "+ ") + formatCurrency(Math.abs(calc.total_penyesuaian));
    $("notaTotalLabel").textContent = nota.type === "income" ? "Total diterima" : "Total dibayar";
    $("notaTotal").textContent = formatCurrency(calc.nominal);
    $("notaTotal").classList.toggle("negative", calc.nominal <= 0);

    const kode = nota.tx ? nota.tx.kode || "—" : previewKode({ bentuk: "nota", account_type: nota.account, tanggal: $("notaDate").value });
    $("notaKode").textContent = kode;
    $("notaReceipt").innerHTML = notaReceiptHtml(calc, kode);

    // Peringatan langsung kalau total ≤ 0; daftar error lengkap muncul setelah
    // tombol Simpan ditekan (dan ikut diperbarui saat isian dibetulkan).
    let msgs = [];
    if (nota.showErrors) msgs = Core.buildNota(notaFields()).errors;
    else if (calc.nominal <= 0 && (calc.subtotal > 0 || calc.penyesuaian.length)) {
      msgs = ["Total nota " + (calc.nominal < 0 ? "negatif" : "Rp 0") + " — cek potongan/biaya."];
    }
    $("notaErrors").hidden = !msgs.length;
    $("notaErrors").innerHTML = msgs.map((m) => "<span>" + escapeHtml(m) + "</span>").join("");
  }

  function notaReceiptHtml(calc, kode) {
    const acct = ACCOUNT_BY_ID[nota.account];
    const date = $("notaDate").value, time = $("notaTime").value;
    const meta = [date ? shortDateYear(date) : "", time.slice(0, 5), acct ? acct.label : "", USERS[nota.by] ? USERS[nota.by].label : ""].filter(Boolean).join(" · ");
    return '<div class="receipt-head"><span class="receipt-kicker">NOTA</span>' +
      '<span class="receipt-title">' + escapeHtml($("notaTitle").value.trim() || "Judul nota") + "</span>" +
      '<span class="receipt-meta tnum">' + escapeHtml(meta) + "</span>" +
      '<span class="receipt-kode">' + escapeHtml(kode) + "</span></div>" +
      '<div class="receipt-cut"></div>' +
      receiptBodyHtml(nota.type, calc.items, calc.penyesuaian, calc.subtotal, calc.nominal, calc.rincian_kategori, formatCurrency);
  }

  // Isi struk: item, subtotal, penyesuaian, total, rincian per kategori.
  // Dipakai halaman Nota (fmt = formatCurrency) & panel detail (fmt = money).
  function receiptBodyHtml(type, items, adj, subtotal, nominal, rincian, fmt) {
    const lines = items
      .map((it) =>
        '<div class="receipt-line"><div class="receipt-line-text"><span>' + escapeHtml(it.nama || "Item tanpa nama") + "</span>" +
        '<span class="item-sub tnum">' + formatQty(it.qty || 0) + (it.satuan ? " " + escapeHtml(it.satuan) : "") + " × " + fmt(it.harga || 0) + "</span></div>" +
        '<span class="tnum">' + fmt(it.subtotal || 0) + "</span></div>"
      )
      .join("");
    const adjRows = adj
      .map((p) =>
        '<div class="receipt-row"><span>' + escapeHtml(p.label || "Penyesuaian") + (p.mode === "persen" ? " (" + formatQty(p.nilai || 0) + "%)" : "") + "</span>" +
        "<span>" + (p.efek === "kurang" ? "− " : "+ ") + fmt(p.jumlah || 0) + "</span></div>"
      )
      .join("");
    const cats = Object.keys(rincian || {})
      .filter((k) => rincian[k] > 0)
      .sort((a, b) => rincian[b] - rincian[a])
      .map((k) => {
        const c = findCategory(type, k);
        const pct = nominal > 0 ? Math.round((rincian[k] / nominal) * 100) : 0;
        return '<div class="receipt-cat"><div><span style="font-weight:600">' + escapeHtml(c.icon + " " + c.label) + "</span>" +
          '<span class="tnum strong">' + fmt(rincian[k]) + "</span></div>" +
          '<div class="track" style="height:6px"><div class="fill" style="width:' + pct + "%;background:" + catColor(c) + '"></div></div></div>';
      })
      .join("");
    return '<div class="receipt-lines">' + lines + "</div>" +
      '<div class="receipt-cut"></div>' +
      '<div class="receipt-row"><span>Subtotal · ' + items.length + " item</span><span>" + fmt(subtotal) + "</span></div>" +
      adjRows +
      '<div class="receipt-total"><span>' + (type === "income" ? "TOTAL DITERIMA" : "TOTAL DIBAYAR") + "</span><span>" + fmt(nominal) + "</span></div>" +
      (cats ? '<div class="receipt-cut"></div><div class="receipt-cats"><span class="overline">Per kategori</span>' + cats + "</div>" : "");
  }

  function saveNota() {
    if (notaSaving) return;
    const built = Core.buildNota(notaFields());
    if (built.errors.length) {
      nota.showErrors = true;
      renderNotaSummary();
      $("notaErrors").scrollIntoView({ block: "nearest" });
      return;
    }
    const tx = nota.tx;
    if (!tx && !requireOnline()) return;
    notaSaving = true;
    $("notaSaveBtn").disabled = true;
    $("notaSaveBtn").textContent = "Menyimpan…";
    // Baru: kode atomik (Data.saveNew). Edit: update parsial — kode, tanggal,
    // account type & jenis tidak ikut dikirim (terkunci).
    const op = tx ? Data.updateNota(tx.ym, tx.id, built.record).then(() => tx.id) : Data.saveNew(built.record);
    op.then((id) => {
      nota.dirty = false;
      selectedTxId = id;
      txJumpToSelected = true;
      const d = built.record.tanggal;
      viewDate = new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, 1);
      if (acctFilter !== "all" && acctFilter !== built.record.account_type) acctFilter = "all";
      setView("transactions");
    })
      .catch(reportWriteError("menyimpan nota"))
      .finally(() => {
        notaSaving = false;
        $("notaSaveBtn").disabled = false;
        $("notaSaveBtn").textContent = "Simpan Nota";
      });
  }

  /* ---------- Event halaman Nota ---------- */

  function markNotaDirty() {
    nota.dirty = true;
    renderNotaSummary();
  }

  $("notaTitle").addEventListener("input", markNotaDirty);
  $("notaTime").addEventListener("input", markNotaDirty);
  // Ganti tanggal → waktu reset ke awal hari (aturan sama dgn form satuan);
  // bulan kode ikut tanggal.
  $("notaDate").addEventListener("change", () => {
    $("notaTime").value = "00:00:00";
    markNotaDirty();
  });

  $("notaTypeToggle").querySelectorAll("[data-type]").forEach((b) =>
    b.addEventListener("click", () => {
      if (nota.tx || b.dataset.type === nota.type) return;
      nota.type = b.dataset.type;
      // Kategori item ikut jenis nota → reset ke kategori pertama jenis baru.
      nota.items.forEach((it) => {
        if (!categoryExists(nota.type, it.category)) it.category = blankItem(nota.type).category;
      });
      nota.dirty = true;
      renderNotaForm();
    })
  );

  $("notaItemRows").addEventListener("input", (e) => {
    const f = e.target.dataset.f;
    const row = e.target.closest("[data-i]");
    if (!f || !row) return;
    if (f === "harga") formatAmountInput(e.target);
    nota.items[Number(row.dataset.i)][f] = e.target.value;
    markNotaDirty();
  });
  $("notaItemRows").addEventListener("click", (e) => {
    const del = e.target.closest("[data-del-item]");
    if (!del || nota.items.length <= 1) return;
    nota.items.splice(Number(del.dataset.delItem), 1);
    renderNotaItems();
    markNotaDirty();
  });
  $("notaAddItem").addEventListener("click", () => {
    const last = nota.items[nota.items.length - 1];
    const it = blankItem(nota.type);
    if (last && last.category) it.category = last.category; // item baru biasanya sejenis
    nota.items.push(it);
    renderNotaItems();
    markNotaDirty();
    $("notaItemRows").querySelector('[data-i="' + (nota.items.length - 1) + '"] [data-f="nama"]').focus();
  });

  function addNotaAdj(p) {
    nota.adj.push(p);
    renderNotaAdj();
    markNotaDirty();
    const row = $("notaAdjRows").querySelector('[data-j="' + (nota.adj.length - 1) + '"]');
    row.querySelector(p.label ? '[data-f="nilai"]' : '[data-f="label"]').focus();
  }

  $("notaAddAdj").addEventListener("click", () => addNotaAdj({ label: "", efek: "kurang", mode: "nominal", nilai: "" }));
  $("notaQuickAdj").addEventListener("click", (e) => {
    const b = e.target.closest("[data-preset]");
    if (!b) return;
    const p = ADJ_PRESETS[nota.type][Number(b.dataset.preset)];
    addNotaAdj({ label: p[0], efek: p[1], mode: p[2], nilai: p[3] });
  });
  $("notaAdjRows").addEventListener("input", (e) => {
    const f = e.target.dataset.f;
    const row = e.target.closest("[data-j]");
    if (!f || !row || e.target.tagName === "SELECT") return;
    const p = nota.adj[Number(row.dataset.j)];
    if (f === "nilai" && p.mode === "nominal") formatAmountInput(e.target);
    p[f] = e.target.value;
    markNotaDirty();
  });
  $("notaAdjRows").addEventListener("change", (e) => {
    const f = e.target.dataset.f;
    const row = e.target.closest("[data-j]");
    if (!row || (f !== "efek" && f !== "mode")) return;
    const p = nota.adj[Number(row.dataset.j)];
    p[f] = e.target.value;
    if (f === "mode") p.nilai = p.mode === "nominal" ? (parseAmount(p.nilai) ? parseAmount(p.nilai).toLocaleString("id-ID") : "") : String(p.nilai).replace(/\./g, "");
    renderNotaAdj();
    markNotaDirty();
  });
  $("notaAdjRows").addEventListener("click", (e) => {
    const del = e.target.closest("[data-del-adj]");
    if (!del) return;
    nota.adj.splice(Number(del.dataset.delAdj), 1);
    renderNotaAdj();
    markNotaDirty();
  });

  $("notaSaveBtn").addEventListener("click", saveNota);
  $("notaCancelBtn").addEventListener("click", () => setView("transactions"));
  $("notaBackBtn").addEventListener("click", () => setView("transactions"));

  /* ================= Pindah account (V2, di balik ENABLE_TRANSFER) ================= */

  // Form mode "Pindah" di popup Tambah Transaksi. Pembuat (by) memakai
  // txState.by yang sama dgn mode Satuan/Import.
  const tfState = { from: "bank", to: "cash" };

  function resetTransferForm() {
    tfState.from = ACCOUNT_BY_ID[acctFilter] ? acctFilter : "bank";
    tfState.to = tfState.from === "cash" ? "bank" : "cash";
    const now = Date.now();
    $("tfForm").reset();
    $("tfDate").value = localDateStrOf(now);
    $("tfTime").value = formatTime(now);
  }

  // Pemilih account dgn satu opsi bisa dinonaktifkan (Ke ≠ Dari).
  function renderTransferPicker(container, value, disabledId, onPick) {
    container.innerHTML = ACCOUNTS.map((a) => {
      const on = a.id === value;
      return '<button type="button" class="toggle-btn' + (on ? " active" : "") + '" data-account="' + a.id + '" aria-pressed="' + on + '"' + (a.id === disabledId ? " disabled" : "") + ">" +
        '<span aria-hidden="true">' + a.icon + "</span>" + a.label + "</button>";
    }).join("");
    container.querySelectorAll("[data-account]:not([disabled])").forEach((b) => b.addEventListener("click", () => onPick(b.dataset.account)));
  }

  function renderTransferForm() {
    // Memilih Dari = Ke saat ini → otomatis ditukar.
    renderTransferPicker($("tfFrom"), tfState.from, null, (id) => {
      if (id === tfState.to) tfState.to = tfState.from;
      tfState.from = id;
      renderTransferForm();
    });
    renderTransferPicker($("tfTo"), tfState.to, tfState.from, (id) => {
      tfState.to = id;
      renderTransferForm();
    });
    renderTransferSummary();
  }

  function renderTransferSummary() {
    const amount = parseAmount($("tfAmount").value);
    const fee = parseAmount($("tfFee").value);
    const from = ACCOUNT_BY_ID[tfState.from], to = ACCOUNT_BY_ID[tfState.to];
    $("tfSummary").innerHTML =
      '<div class="tf-route"><span>' + from.icon + " " + from.label + '</span><span aria-hidden="true">→</span><span>' + to.icon + " " + to.label + "</span></div>" +
      '<div class="kv"><span class="muted">' + from.label + ' berkurang</span><span class="strong tnum amount-expense">− ' + formatCurrency(amount + fee) + "</span></div>" +
      '<div class="kv"><span class="muted">' + to.label + ' bertambah</span><span class="strong tnum amount-income">+ ' + formatCurrency(amount) + "</span></div>" +
      '<span class="tf-note">Pemindahan tidak dihitung sebagai pemasukan atau pengeluaran. Hanya biaya admin yang tercatat sebagai pengeluaran (kategori Lainnya).</span>';
    $("tfKodePreview").textContent = previewKode({ bentuk: "pindah", dari: tfState.from, ke: tfState.to, tanggal: $("tfDate").value });
  }

  $("tfSwap").addEventListener("click", () => {
    const x = tfState.from;
    tfState.from = tfState.to;
    tfState.to = x;
    renderTransferForm();
  });
  ["tfAmount", "tfFee"].forEach((id) =>
    $(id).addEventListener("input", function () {
      formatAmountInput(this);
      renderTransferSummary();
    })
  );
  // Ganti tanggal → waktu reset ke awal hari (sama dgn satuan/nota).
  $("tfDate").addEventListener("change", () => {
    $("tfTime").value = "00:00:00";
    renderTransferSummary();
  });

  $("tfForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!ENABLE_TRANSFER) return;
    const rawTime = $("tfTime").value;
    const { errors, record } = Core.buildPindah({
      dari: tfState.from,
      ke: tfState.to,
      nominal: parseAmount($("tfAmount").value),
      biaya_admin: parseAmount($("tfFee").value),
      catatan: $("tfNote").value.trim(),
      by: txState.by,
      tanggal: $("tfDate").value,
      waktu: /^\d{2}:\d{2}$/.test(rawTime) ? rawTime + ":00" : rawTime,
      timestamp: Date.now(),
    });
    if (errors.length) {
      alert(errors.join("\n"));
      return;
    }
    if (!requireOnline()) return;
    Data.saveNew(record).catch(reportWriteError("memindahkan saldo"));
    closeModal("txModal");
  });

  /* ================= Init ================= */

  initTheme();
  const initialView = location.hash.slice(1);
  currentView = VIEWS[initialView] && initialView !== "nota" ? initialView : "dashboard";
  renderAll();
  subscribeFinance();
  if (initialView.split("/")[0] === "nota") openNotaFromHash(initialView);
})();
