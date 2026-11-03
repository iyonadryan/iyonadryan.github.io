/* =========================================================
   Finance App — script.js
   Data transaksi & rencana disimpan di Firebase Realtime DB
   di bawah path /finance (lihat firebaseConfig di index.html).

   Struktur data:
     finance/
       <YYYY-MM>/
         <timestamp>/ { transaksi, category, nominal, catatan, tanggal, waktu, timestamp, by }  // V1
         <kode>/      { kode, bentuk, account_type, … }  // V2 (satuan/nota/pindah), lihat web/finance-core.js
       counters/<prefix>-<YYYYMM>  // nomor urut kode V2
       plans/
         <period>/<category>/ { category, limit, sort, by, target } // 1 slot per kategori+periode (global, siapa pun pembuatnya)
       categories/
         expense|income/
           <id>/ { id, label, icon, colorSlot? } // colorSlot cuma di expense

   by = "iyon" | "ciwul" — siapa yang bikin (lihat bagian Multi-user). Preferensi
   tema & pilihan user aktif disimpan lokal (localStorage).
   ========================================================= */

(function () {
  "use strict";

  /* ---------------- Storage keys (lokal) ---------------- */
  const STORAGE_KEYS = {
    theme: "financeapp_theme",
    user: "financeapp_user",
  };

  /* ---------------- Multi-user (Iyon / Ciwul / Both) ---------------- */
  // "both" cuma mode TAMPILAN (gabungan semua data) — bukan pemilik data yang
  // valid, jadi tidak pernah muncul sbg data.by transaksi/rencana.
  const USERS = {
    iyon: { id: "iyon", label: "Iyon", icon: "../img/iyon.png" },
    ciwul: { id: "ciwul", label: "Ciwul", icon: "../img/ciwul.png" },
    both: { id: "both", label: "Both", icon: "../img/couple.png" },
  };

  // Pilihan user aktif, diingat di localStorage (pola sama spt tema). null =
  // belum pernah pilih (overlay #userSelectOverlay bakal tampil di init).
  let currentUser = localStorage.getItem(STORAGE_KEYS.user) || null;

  /* ---------------- Categories ---------------- */
  // Diisi realtime dari Firebase (categories/expense|income/<id>), lihat
  // rebuildFromSnapshot(). Kosong sampai snapshot pertama tiba — sama seperti
  // transactions/plans.
  let CATEGORIES = { expense: [], income: [] };

  // Data seed, dipakai SEKALI oleh migrateLegacyCategories() kalau node
  // categories belum ada di Firebase sama sekali. Id/label/icon harus persis
  // sama dengan yang lama supaya transaksi & rencana existing (nyimpen id
  // kategori sebagai string) tidak kehilangan kategorinya. colorSlot 1-8
  // dipetakan ke var(--series-1..8) di css/base.css, dipakai categoryColorVar()
  // utk Statistik Pengeluaran (expense, pakai semua 8 slot). Income juga
  // dikasih colorSlot (reuse slot 1-4) buat kebutuhan ke depan (mis. statistik
  // pemasukan) — belum ada fitur yang membacanya sekarang. Slot 1-4 dipilih
  // karena pasangan-pasangannya (1↔2, 2↔3, 3↔4) sudah tervalidasi CVD-safe
  // lewat dataviz skill; catatan: warnanya numpang sama dgn 4 kategori expense
  // pertama (Makanan/Transportasi/Belanja/Tagihan) — tidak masalah selama
  // expense & income tidak pernah ditampilkan berdampingan dalam satu chart;
  // kalau nanti ada fitur begitu, perlu palet terpisah utk income.
  const DEFAULT_CATEGORIES = {
    expense: [
      { id: "makanan", label: "Makanan", icon: "🍔", colorSlot: 1 },
      { id: "transportasi", label: "Transportasi", icon: "🚗", colorSlot: 2 },
      { id: "belanja", label: "Belanja", icon: "🛍️", colorSlot: 3 },
      { id: "tagihan", label: "Tagihan", icon: "🧾", colorSlot: 4 },
      { id: "hiburan", label: "Hiburan", icon: "🎮", colorSlot: 5 },
      { id: "kesehatan", label: "Kesehatan", icon: "💊", colorSlot: 6 },
      { id: "pendidikan", label: "Pendidikan", icon: "📚", colorSlot: 7 },
      { id: "lainnya-keluar", label: "Lainnya", icon: "📦", colorSlot: 8 },
    ],
    income: [
      { id: "gaji", label: "Gaji", icon: "💼", colorSlot: 1 },
      { id: "bonus", label: "Bonus", icon: "🎁", colorSlot: 2 },
      { id: "investasi", label: "Investasi", icon: "📈", colorSlot: 3 },
      { id: "lainnya-masuk", label: "Lainnya", icon: "💵", colorSlot: 4 },
    ],
  };

  const MONTH_NAMES = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];

  /* ---------------- State ---------------- */
  let transactions = []; // diisi realtime dari Firebase
  let plans = [];        // diisi realtime dari Firebase
  let viewDate = new Date(); // controls which month is shown on dashboard
  let currentTxType = "expense";
  let currentFilter = "all";
  let selectedCategories = [];
  let filterStartDate = ""; // filter rentang tanggal di halaman Transaksi ("YYYY-MM-DD")
  let filterEndDate = "";
  let currentPeriod = "bulanan"; // tab periode aktif di halaman Rencana
  let acctFilter = "all"; // tab Account Type (all|bank|cash|e_money), dibagi Dashboard & Transaksi
  let counters = {}; // /finance/counters — cuma utk pratinjau kode di form
  let balanceVisible = false; // saldo/pemasukan/pengeluaran tersembunyi saat pertama buka

  // Periode rencana anggaran. Harian/Mingguan/Weekday/Weekend dihitung terhadap
  // "sekarang" (hari/minggu berjalan), Bulanan mengikuti bulan yang dipilih
  // (viewDate). Weekday = Sen–Jum, Weekend = Sab–Min (dalam minggu berjalan).
  const PLAN_PERIODS = ["harian", "mingguan", "bulanan", "weekday", "weekend"];
  const PERIOD_LABELS = {
    harian: "harian",
    mingguan: "mingguan",
    bulanan: "bulanan",
    weekday: "weekday (Senin - Jum'at)",
    weekend: "weekend (Sabtu & Minggu)",
  };

  // Kategori khusus (hanya untuk Rencana): budget gabungan seluruh pengeluaran.
  const ALL_CATEGORY = { id: "semua", label: "Semua", icon: "💰💵🪙" };

  // Sentinel utk filter transaksi: mewakili kategori yang sudah dihapus
  // (transaksi lama masih nyimpen id lama itu sbg string, tapi kategorinya
  // sendiri sudah tidak ada di CATEGORIES). Diberi underscore ganda supaya
  // tidak pernah bentrok dgn id kategori asli (slugifyCategoryId membuang
  // karakter selain a-z0-9-).
  const UNKNOWN_CATEGORY_ID = "__unknown__";

  /* ---------------- V2 (dipakai bersama web desktop) ---------------- */
  // Core = logika murni (normalizer, nota, kode, agregasi); Data = tulis
  // Firebase (counter atomik, update parsial). File-nya di web/.
  const Core = window.FinanceCore;
  const Data = window.FinanceData.create(db, FINANCE_PATH);

  // Kode transaksi butuh server (counter lewat transaction()), jadi simpan
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

  // Account type — sumber uang tiap transaksi. Record lama = bank.
  const ACCOUNTS = [
    { id: "bank", label: "Bank", icon: "🏦" },
    { id: "cash", label: "Cash", icon: "💵" },
    { id: "e_money", label: "E-Money", icon: "📱" },
  ];
  const ACCOUNT_BY_ID = ACCOUNTS.reduce((m, a) => ((m[a.id] = a), m), {});

  // Tile/label transaksi pindah (tidak punya kategori).
  const TRANSFER_CATEGORY = { id: "__transfer__", label: "Pindah account", icon: "⇄" };
  const TYPE_LABELS = { income: "Pemasukan", expense: "Pengeluaran", transfer: "Pindah account" };

  function accountLabel(id) {
    return ACCOUNT_BY_ID[id] ? ACCOUNT_BY_ID[id].label : id || "—";
  }

  function transferRoute(tx) {
    return accountLabel(tx.dari) + " → " + accountLabel(tx.ke);
  }

  // Judul baris: nota → judul, pindah → catatan / rute, satuan → kategori.
  function txTitle(tx) {
    if (tx.type === "transfer") return "Pindah " + transferRoute(tx);
    if (tx.bentuk === "nota" && tx.title) return tx.title;
    return findCategory(tx.type, tx.category).label;
  }

  // Kategori yang dikandung transaksi (nota: semua kategori item).
  function txCategoryIds(tx) {
    if (tx.type === "transfer") return [];
    const keys = Object.keys(tx.rincian || {});
    return keys.length ? keys : [tx.category];
  }

  function formatQty(q) {
    return Number(q).toLocaleString("id-ID", { maximumFractionDigits: 3 });
  }

  function categoryExists(type, id) {
    return CATEGORIES[type].some((c) => c.id === id);
  }

  /* ================= Firebase data layer ================= */

  const financeRef = db.ref(FINANCE_PATH);

  // Pindahkan rencana lama (plans/<category>) ke bentuk berperiode
  // (plans/bulanan/<category>). Sekali jalan pada snapshot pertama.
  let legacyPlansMigrated = false;
  function migrateLegacyPlans(root) {
    if (legacyPlansMigrated) return;
    legacyPlansMigrated = true;
    const plansObj = (root && root.plans) || {};
    const updates = {};
    let found = false;
    Object.keys(plansObj).forEach((key) => {
      if (PLAN_PERIODS.includes(key)) return; // sudah bentuk baru
      const p = plansObj[key] || {};
      updates["plans/bulanan/" + key] = { category: key, limit: Number(p.limit) || 0 };
      updates["plans/" + key] = null; // hapus node lama
      found = true;
    });
    if (found) {
      financeRef.update(updates).catch((e) => console.error("Migrasi rencana gagal:", e));
    }
  }

  // Seed kategori dari DEFAULT_CATEGORIES kalau node categories belum ada
  // sama sekali di Firebase. Sekali jalan pada snapshot pertama (pola sama
  // seperti migrateLegacyPlans di atas).
  let legacyCategoriesMigrated = false;
  function migrateLegacyCategories(root) {
    if (legacyCategoriesMigrated) return;
    legacyCategoriesMigrated = true;
    if (root && root.categories) return; // sudah ada, tidak perlu seed

    const updates = {};
    DEFAULT_CATEGORIES.expense.forEach((cat) => {
      updates["categories/expense/" + cat.id] = cat;
    });
    DEFAULT_CATEGORIES.income.forEach((cat) => {
      updates["categories/income/" + cat.id] = cat;
    });
    financeRef.update(updates).catch((e) => console.error("Seed kategori gagal:", e));
  }

  // Backfill field colorSlot utk kategori income yang sudah lebih dulu ada di
  // Firebase (di-seed sebelum colorSlot ditambahkan ke income). Cocokkan by
  // id ke DEFAULT_CATEGORIES.income supaya label/icon yang mungkin sudah
  // diubah manual tidak ikut ketimpa — cuma field colorSlot yang ditulis, dan
  // cuma kalau memang belum ada. Sekali jalan pada snapshot pertama.
  let incomeColorSlotsMigrated = false;
  function migrateIncomeColorSlots(root) {
    if (incomeColorSlotsMigrated) return;
    incomeColorSlotsMigrated = true;
    const incomeObj = (root && root.categories && root.categories.income) || {};

    const updates = {};
    DEFAULT_CATEGORIES.income.forEach((defCat) => {
      const existing = incomeObj[defCat.id];
      if (existing && existing.colorSlot == null) {
        updates["categories/income/" + defCat.id + "/colorSlot"] = defCat.colorSlot;
      }
    });
    if (Object.keys(updates).length) {
      financeRef.update(updates).catch((e) => console.error("Backfill colorSlot income gagal:", e));
    }
  }

  // Backfill field `by` ke transaksi lama (sebelum fitur multi-user) — semua
  // dianggap punya "ciwul" karena itu satu-satunya pengguna sebelum ini.
  // Sekali jalan pada snapshot pertama.
  let transactionOwnersMigrated = false;
  function migrateTransactionOwners(root) {
    if (transactionOwnersMigrated) return;
    transactionOwnersMigrated = true;
    const updates = {};
    Object.keys(root || {}).forEach((topKey) => {
      if (!/^\d{4}-\d{2}$/.test(topKey)) return; // cuma node bulan (YYYY-MM)
      const monthObj = root[topKey] || {};
      Object.keys(monthObj).forEach((ts) => {
        const t = monthObj[ts] || {};
        if (!t.by) updates[topKey + "/" + ts + "/by"] = "ciwul";
      });
    });
    if (Object.keys(updates).length) {
      financeRef.update(updates).catch((e) => console.error("Backfill pemilik transaksi gagal:", e));
    }
  }
  // Backfill field `by` ke rencana lama (sebelum fitur multi-user) — tetap
  // flat (plans/<period>/<category>), `by` cukup jadi field di dalamnya
  // (bukan segmen path baru) — jadi 1 kategori+periode tetap 1 slot bersama,
  // cuma dicatat siapa pembuatnya. Data lama dianggap milik "ciwul". Sekali
  // jalan pada snapshot pertama, pola sama seperti migrateIncomeColorSlots.
  let legacyPlanOwnersMigrated = false;
  function migrateLegacyPlanOwners(root) {
    if (legacyPlanOwnersMigrated) return;
    legacyPlanOwnersMigrated = true;
    const plansObj = (root && root.plans) || {};
    const updates = {};
    PLAN_PERIODS.forEach((period) => {
      const periodObj = plansObj[period] || {};
      Object.keys(periodObj).forEach((cat) => {
        const node = periodObj[cat] || {};
        if (node && typeof node.limit === "number" && !node.by) {
          updates["plans/" + period + "/" + cat + "/by"] = "ciwul";
        }
      });
    });
    if (Object.keys(updates).length) {
      financeRef.update(updates).catch((e) => console.error("Backfill pemilik rencana gagal:", e));
    }
  }

  // Dengarkan seluruh subtree /finance secara realtime.
  function subscribeFinance() {
    financeRef.on(
      "value",
      (snapshot) => {
        const root = snapshot.val() || {};
        migrateLegacyPlans(root);
        migrateLegacyCategories(root);
        migrateIncomeColorSlots(root);
        migrateTransactionOwners(root);
        migrateLegacyPlanOwners(root);
        rebuildFromSnapshot(root);
        renderAll();
        hideLoading(); // data pertama sudah tiba
        maybeOfferStart();
      },
      (err) => {
        console.error("Gagal membaca data dari Firebase:", err);
        hideLoading(); // jangan biarkan user terjebak di layar loading
      }
    );
  }

  /* ================= Loading overlay ================= */

  let loadingHidden = false;

  function hideLoading() {
    if (loadingHidden) return;
    loadingHidden = true;
    const overlay = document.getElementById("loadingOverlay");
    if (overlay) overlay.classList.add("hidden");
  }

  // Bangun ulang array transactions & plans dari snapshot Firebase.
  function rebuildFromSnapshot(root) {
    const txs = [];
    const pl = [];

    Object.keys(root).forEach((topKey) => {
      if (topKey === "plans") {
        const plansObj = root.plans || {};
        Object.keys(plansObj).forEach((key) => {
          if (PLAN_PERIODS.includes(key)) {
            // Bentuk baru: plans/<periode>/<category>/{ limit, sort, by }
            const periodObj = plansObj[key] || {};
            Object.keys(periodObj).forEach((cat) => {
              const p = periodObj[cat] || {};
              // target = transaksi siapa yang dihitung; rencana tanpa target → ikut by.
              pl.push({
                id: key + "_" + cat, period: key, category: cat, by: p.by || "ciwul",
                target: p.target || p.by || "ciwul",
                limit: Number(p.limit) || 0, sort: Number(p.sort) || 0,
              });
            });
          } else {
            // Bentuk lama: plans/<category>/{ limit } → diperlakukan sebagai bulanan
            // (di-migrasi ke bentuk baru oleh migrateLegacyPlans()).
            const p = plansObj[key] || {};
            pl.push({
              id: "bulanan_" + key, period: "bulanan", category: key, by: p.by || "ciwul",
              target: p.target || p.by || "ciwul",
              limit: Number(p.limit) || 0, sort: Number(p.sort) || 0,
            });
          }
        });
      } else if (/^\d{4}-\d{2}$/.test(topKey)) {
        // Record V1 (key timestamp) & V2 (key kode) dinormalisasi jadi satu
        // bentuk oleh Core (sama persis dgn desktop): type income/expense/
        // transfer, account_type kosong → bank, nota → rincian per kategori.
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
    const expenseObj = categoriesObj.expense || {};
    const incomeObj = categoriesObj.income || {};
    CATEGORIES = {
      // Urut naik by colorSlot supaya urutan tampil stabil (sama seperti
      // urutan hardcoded sebelumnya), tidak bergantung urutan key Firebase.
      expense: Object.keys(expenseObj)
        .map((id) => expenseObj[id])
        .sort((a, b) => (Number(a.colorSlot) || 0) - (Number(b.colorSlot) || 0)),
      income: Object.keys(incomeObj)
        .map((id) => incomeObj[id])
        .sort((a, b) => (Number(a.colorSlot) || 0) - (Number(b.colorSlot) || 0)),
    };
  }

  // ---- Operasi tulis ----

  // Transaksi satuan baru → key = kode (TB-202611-000001, dst), sama dgn
  // desktop. Nomor urut atomik lewat counter; bulan kode & node ikut tanggal.
  // Field `timestamp` = waktu asli saat input (kapan dibuat). Resolve → kode.
  function addTransaction(data) {
    const { errors, record } = Core.buildSatuan({
      type: data.type,
      account_type: data.account,
      category: data.category,
      nominal: data.amount,
      catatan: data.note || "",
      by: data.by,
      tanggal: data.date,
      waktu: data.time,
      timestamp: Date.now(),
    });
    if (errors.length) return Promise.reject(new Error(errors.join(" ")));
    return Data.saveNew(record);
  }

  // Perkiraan kode di form (counter saat ini + 1 — bukan jaminan).
  function previewKode(rec) {
    try {
      const key = Core.counterKey(Core.kodePrefix(rec), Core.yyyymmOf(rec.tanggal));
      return Core.previewKode(rec, counters[key]);
    } catch (e) {
      return "—";
    }
  }

  // Ubah transaksi satuan yang sudah ada: HANYA nominal & catatan. Pakai
  // update parsial (bukan .set()) supaya field lain — termasuk field V2 spt
  // kode/account_type — tidak ikut terhapus.
  function updateTransaction(oldTx, data) {
    return Data.update(oldTx.ym, oldTx.id, { nominal: data.amount, catatan: data.note || "" });
  }

  function deleteTransaction(tx) {
    return Data.remove(tx.ym, tx.id);
  }

  // Transaksi sesuai scope user aktif — dipakai di semua render/filter/export
  // supaya Dashboard/Transaksi/Rencana konsisten cuma nampilin data yang
  // relevan. Mode "both" = gabungan semua (tidak difilter).
  function visibleTransactions() {
    return currentUser === "both" ? transactions : transactions.filter((t) => t.by === currentUser);
  }

  // + filter tab Account Type (Dashboard & Transaksi). Pindah tampil di tab
  // asal & tujuan; record lama tanpa account_type = bank.
  function scopedTransactions() {
    return visibleTransactions().filter((t) => Core.matchesAccount(t, acctFilter));
  }

  // Tab Semua | Bank | Cash | E-Money — satu state dipakai bareng Dashboard &
  // Transaksi, jadi ganti di satu halaman ikut berubah di halaman lain.
  function renderAccountTabs(container) {
    const tabs = [{ id: "all", label: "Semua", icon: "🗂️" }].concat(ACCOUNTS);
    container.innerHTML = tabs
      .map((a) => {
        const on = a.id === acctFilter;
        return `<button type="button" role="tab" class="acct-tab${on ? " active" : ""}" aria-selected="${on}" data-acct="${a.id}"><span aria-hidden="true">${a.icon}</span>${a.label}</button>`;
      })
      .join("");
    container.querySelectorAll("[data-acct]").forEach((b) =>
      b.addEventListener("click", () => {
        acctFilter = b.dataset.acct;
        renderDashboard();
        renderAllTransactions();
      })
    );
  }

  function savePlan(period, category, limit, sort, by, target) {
    return db.ref(FINANCE_PATH + "/plans/" + period + "/" + category).set({
      category: category,
      limit: limit,
      sort: sort || 0,
      by: by,
      target: target,
    });
  }

  // Pemakaian rencana = transaksi milik target (both = semua), semua account,
  // TIDAK ikut mode user yang sedang dilihat. Nota lewat rincian_kategori,
  // pindah cuma biaya admin (Core.expenseInCategory). "semua" = total.
  function planSpent(plan, now) {
    now = now || new Date();
    return transactions
      .filter((t) => (plan.target === "both" || t.by === plan.target) && txInPlanPeriod(t, plan.period, now))
      .reduce((s, t) => s + Core.expenseInCategory(t, plan.category), 0);
  }

  // Mode Iyon/Ciwul → rencana untuk dia + rencana Both; mode Both → semua.
  function planVisible(plan) {
    return currentUser === "both" || plan.target === currentUser || plan.target === "both";
  }

  // Nilai sort untuk rencana baru: paling akhir pada periodenya.
  function nextSortForPeriod(period) {
    const inPeriod = plans.filter((p) => p.period === period);
    return inPeriod.length ? Math.max.apply(null, inPeriod.map((p) => p.sort)) + 1 : 0;
  }

  function deletePlan(period, category) {
    return db.ref(FINANCE_PATH + "/plans/" + period + "/" + category).remove();
  }

  // Simpan (create/update) satu kategori. Menimpa seluruh node per id —
  // id tidak pernah berubah (dikunci saat edit), jadi aman .set().
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

  function renderAll() {
    renderDashboard();
    renderAllTransactions();
    renderPlans();
    updateMonthNavButtons();
    // Popup Kategori dirender saat dibuka; kalau sedang terbuka ketika data
    // berubah (habis create/edit/delete), render ulang isinya juga.
    if (categoriesModal.classList.contains("open")) renderCategoriesModal();
  }

  // Batasi geser bulan (Dashboard & Transaksi berbagi viewDate yang sama) ke
  // rentang ym terkecil–terbesar yang benar-benar ada transaksinya di
  // Firebase. Bulan di antaranya (mis. tidak ada transaksi) tetap bisa
  // disinggahi selama masih di dalam rentang; di luar rentang tombolnya mati.
  function updateMonthNavButtons() {
    const prevBtns = [document.getElementById("prevMonth"), document.getElementById("prevMonthTx")];
    const nextBtns = [document.getElementById("nextMonth"), document.getElementById("nextMonthTx")];
    const scoped = visibleTransactions();

    if (scoped.length === 0) {
      prevBtns.forEach((b) => (b.disabled = true));
      nextBtns.forEach((b) => (b.disabled = true));
      return;
    }

    const yms = scoped.map((t) => t.ym);
    const minYm = yms.reduce((a, b) => (b < a ? b : a));
    const maxYm = yms.reduce((a, b) => (b > a ? b : a));
    const currentYm = viewDate.getFullYear() + "-" + pad2(viewDate.getMonth() + 1);

    prevBtns.forEach((b) => (b.disabled = currentYm <= minYm));
    nextBtns.forEach((b) => (b.disabled = currentYm >= maxYm));
  }

  /* ================= Utilities ================= */

  function formatCurrency(value) {
    const n = Math.round(value);
    return (n < 0 ? "−Rp " : "Rp ") + Math.abs(n).toLocaleString("id-ID");
  }

  const MASKED_AMOUNT = "Rp ••••••";

  function formatAmountInput(input) {
    const digits = input.value.replace(/[^\d]/g, "");
    if (digits) {
      const formatted = parseInt(digits, 10).toLocaleString("id-ID");
      if (formatted !== input.value) input.value = formatted;
    } else {
      input.value = "";
    }
  }

  function formatDateShort(dateStr) {
    const d = new Date(dateStr);
    return d.getDate() + " " + MONTH_NAMES[d.getMonth()].slice(0, 3);
  }

  // Versi lengkap dengan tahun (dipakai di halaman Transaksi).
  function formatDateLong(dateStr) {
    const d = new Date(dateStr);
    return d.getDate() + " " + MONTH_NAMES[d.getMonth()].slice(0, 3) + " " + d.getFullYear();
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  // "YYYY-MM-DD" berdasarkan waktu lokal (bukan UTC seperti toISOString(),
  // yang salah tanggal untuk WIB dini hari).
  function localDateStrOf(ms) {
    const d = new Date(ms);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }


  // "HH:MM:SS" → "HH:MM" kalau tanpa detik (tampilan Dashboard).
  function formatTxTime(tx, withSeconds) {
    return withSeconds ? tx.time : tx.time.slice(0, 5);
  }

  // Jam saat transaksi dibuat (dari timestamp). withSeconds → sampai detik.
  function formatTime(ms, withSeconds) {
    const d = new Date(ms);
    let s = pad2(d.getHours()) + ":" + pad2(d.getMinutes());
    if (withSeconds) s += ":" + pad2(d.getSeconds());
    return s;
  }

  // Waktu pembuatan transaksi dalam ms (untuk sorting "paling baru"). Pakai
  // field timestamp, bukan key — key sekarang berbasis tanggal pilihan.
  function txTime(tx) {
    return Number(tx.timestamp) || Number(tx.id) || new Date(tx.date).getTime();
  }

  // Urut kronologis berdasarkan tanggal + waktu transaksi (bukan waktu input),
  // tie-break timestamp (key kode tidak kronologis, jadi tidak dipakai).
  const compareTxMoment = Core.compareChrono;

  function findCategory(type, id) {
    if (type === "transfer") return TRANSFER_CATEGORY;
    if (id === ALL_CATEGORY.id) return ALL_CATEGORY;
    return CATEGORIES[type].find((c) => c.id === id) || { label: id, icon: "❓" };
  }

  function isSameMonth(dateStr, ref) {
    const d = new Date(dateStr);
    return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
  }

  // Parse "YYYY-MM-DD" ke Date lokal (hindari pergeseran zona waktu dari UTC).
  function parseLocalDate(dateStr) {
    const parts = String(dateStr).split("-").map(Number);
    return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
  }

  function isSameDay(dateStr, ref) {
    const d = parseLocalDate(dateStr);
    return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
  }

  // Awal minggu (Senin) dari sebuah tanggal.
  function startOfWeek(ref) {
    const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
    const offset = (d.getDay() + 6) % 7; // Minggu(0)→6, Senin(1)→0, dst.
    d.setDate(d.getDate() - offset);
    return d;
  }

  function isSameWeek(dateStr, ref) {
    const start = startOfWeek(ref);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const d = parseLocalDate(dateStr);
    return d >= start && d < end;
  }

  function isWeekday(dateStr) {
    const day = parseLocalDate(dateStr).getDay(); // 0=Minggu … 6=Sabtu
    return day >= 1 && day <= 5; // Senin–Jumat
  }

  function isWeekend(dateStr) {
    const day = parseLocalDate(dateStr).getDay();
    return day === 0 || day === 6; // Sabtu & Minggu
  }

  // Apakah transaksi masuk jendela waktu sebuah rencana?
  // Harian → hari ini; Mingguan → minggu berjalan; Weekday/Weekend → subset
  // hari kerja / akhir pekan dalam minggu berjalan; Bulanan → bulan viewDate.
  function txInPlanPeriod(tx, period, now) {
    if (period === "harian") return isSameDay(tx.date, now);
    if (period === "mingguan") return isSameWeek(tx.date, now);
    if (period === "weekday") return isSameWeek(tx.date, now) && isWeekday(tx.date);
    if (period === "weekend") return isSameWeek(tx.date, now) && isWeekend(tx.date);
    return isSameMonth(tx.date, viewDate); // bulanan
  }

  /* ================= Theme ================= */

  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = saved || (prefersDark ? "dark" : "light");
    applyTheme(theme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEYS.theme, theme);
    const icon = theme === "dark" ? "☀️" : "🌙";
    document.getElementById("themeToggle").textContent = icon;
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    applyTheme(current === "dark" ? "light" : "dark");
  }

  /* ================= Balance visibility toggle ================= */

  const balanceToggleBtn = document.getElementById("balanceToggle");

  function updateBalanceToggleIcon() {
    const label = balanceVisible ? "Sembunyikan saldo" : "Tampilkan saldo";
    balanceToggleBtn.classList.toggle("is-visible", balanceVisible);
    balanceToggleBtn.setAttribute("aria-label", label);
    balanceToggleBtn.title = label;
  }

  balanceToggleBtn.addEventListener("click", () => {
    balanceVisible = !balanceVisible;
    updateBalanceToggleIcon();
    renderDashboard();
  });

  /* ================= Navigation ================= */

  function goToPage(pageId) {
    document.querySelectorAll(".page").forEach((el) => el.classList.remove("active"));
    document.getElementById(pageId).classList.add("active");

    document.querySelectorAll(".nav-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.nav === pageId);
    });

    if (pageId === "transactions") renderAllTransactions();
    if (pageId === "plans") renderPlans();
    if (pageId === "dashboard") renderDashboard();
  }

  /* ================= Dashboard rendering ================= */

  function renderDashboard() {
    document.getElementById("currentMonthLabel").textContent =
      MONTH_NAMES[viewDate.getMonth()] + " " + viewDate.getFullYear();

    renderAccountTabs(document.getElementById("dashAcctTabs"));
    const monthTx = scopedTransactions().filter((t) => isSameMonth(t.date, viewDate));
    // Pindah bukan pemasukan/pengeluaran — kecuali biaya admin (di account
    // asal). Di tab account, saldo ikut pindah masuk/keluar (Core.summarize).
    const sum = Core.summarize(monthTx, acctFilter);
    const totalIncome = sum.income;
    const totalExpense = sum.expense;
    const balance = sum.balance;

    const acct = ACCOUNT_BY_ID[acctFilter];
    document.getElementById("balanceLabel").textContent = acct ? "Saldo " + acct.label + " Bulan Ini" : "Saldo Bulan Ini";
    const transferEl = document.getElementById("balanceTransfer");
    transferEl.hidden = !(acct && (sum.transferIn || sum.transferOut));
    if (!transferEl.hidden) {
      transferEl.textContent = balanceVisible
        ? "Pindah masuk " + formatCurrency(sum.transferIn) + " · keluar " + formatCurrency(sum.transferOut)
        : "Pindah masuk " + MASKED_AMOUNT + " · keluar " + MASKED_AMOUNT;
    }

    document.getElementById("balanceAmount").textContent = balanceVisible ? formatCurrency(balance) : MASKED_AMOUNT;
    document.getElementById("totalIncome").textContent = balanceVisible ? formatCurrency(totalIncome) : MASKED_AMOUNT;
    document.getElementById("totalExpense").textContent = balanceVisible ? formatCurrency(totalExpense) : MASKED_AMOUNT;

    const total = totalIncome + totalExpense;
    const incomePct = total > 0 ? (totalIncome / total) * 100 : 50;
    const expensePct = total > 0 ? (totalExpense / total) * 100 : 50;
    document.getElementById("barIncome").style.width = incomePct + "%";
    document.getElementById("barExpense").style.width = expensePct + "%";

    const recent = monthTx
      .slice()
      .sort((a, b) => txTime(b) - txTime(a)) // paling baru diinput di atas
      .slice(0, 3);
    renderTransactionList(document.getElementById("recentTransactions"), recent, "Belum ada transaksi bulan ini.");

    // Biaya admin pindah milik account asal — di tab tujuan pindah tidak ikut statistik.
    renderCategoryStats(
      monthTx.filter((t) => t.type !== "transfer" || acctFilter === "all" || t.dari === acctFilter),
      totalExpense
    );
  }

  // CSS var kategorikal (--series-1..8) untuk kategori expense, dari field
  // colorSlot yang tersimpan di Firebase — warna ikut kategori (persisten),
  // bukan urutan/posisi/rank bulan itu.
  function categoryColorVar(catId) {
    const cat = CATEGORIES.expense.find((c) => c.id === catId);
    const slot = (cat && Number(cat.colorSlot)) || 1;
    return "var(--series-" + slot + ")";
  }

  // Breakdown pengeluaran per kategori bulan berjalan + insight kategori
  // terbesar, dibandingkan ke rencana bulanan kategori itu kalau ada.
  function renderCategoryStats(monthTx, totalExpense) {
    const container = document.getElementById("categoryStats");

    // Nota dipecah per kategori item (rincian_kategori); biaya admin pindah
    // masuk "Lainnya".
    const byCategory = Core.totalsByCategory(monthTx, "expense");

    const rows = Object.keys(byCategory)
      .map((catId) => ({ catId, amount: byCategory[catId] }))
      .sort((a, b) => b.amount - a.amount);

    if (rows.length === 0) {
      container.innerHTML = '<p class="empty-state">Belum ada pengeluaran bulan ini untuk dianalisis.</p>';
      return;
    }

    const top = rows[0];
    const topCat = findCategory("expense", top.catId);
    const topPct = Math.round((top.amount / totalExpense) * 100);
    const insight =
      topCat.icon + " <strong>" + escapeHtml(topCat.label) + "</strong> adalah kategori pengeluaran terbesar bulan ini — " +
      topPct + "% dari total pengeluaran.";

    const rowsHtml = rows
      .map((row) => {
        const cat = findCategory("expense", row.catId);
        const pct = Math.round((row.amount / totalExpense) * 100);
        const color = categoryColorVar(row.catId);
        const amountText = balanceVisible ? formatCurrency(row.amount) : MASKED_AMOUNT;

        // Catatan pakai pemakaian versi rencana (transaksi target), supaya
        // angkanya sama dengan kartu di halaman Rencana.
        const plan = plans.find((p) => p.period === "bulanan" && p.category === row.catId && planVisible(p));
        let budgetHtml = "";
        if (plan && plan.limit > 0) {
          const budgetPct = Math.round((planSpent(plan) / plan.limit) * 100);
          // Pas 100% = sudah mencapai batas (bukan "melebihi" — itu baru kalau
          // beneran lewat, >100%).
          const cls = budgetPct > 100 ? "over" : budgetPct >= 80 ? "warning" : "";
          const limitText = balanceVisible ? formatCurrency(plan.limit) : MASKED_AMOUNT;
          const label =
            budgetPct > 100
              ? "Melebihi rencana bulanan"
              : budgetPct === 100
              ? "Mencapai target rencana bulanan"
              : budgetPct >= 80
              ? "Mendekati batas rencana bulanan"
              : budgetPct + "% dari rencana bulanan";
          budgetHtml = '<span class="stat-row-budget ' + cls + '">' + label + " (" + limitText + ")</span>";
        }

        return `
          <div class="stat-row">
            <div class="stat-row-top">
              <span class="stat-row-label"><span class="stat-dot" style="background:${color}"></span>${cat.icon} ${escapeHtml(cat.label)}</span>
              <span class="plan-percent">${pct}%</span>
            </div>
            <div class="plan-progress-track">
              <div class="plan-progress-fill" style="width:${pct}%;background:${color}"></div>
            </div>
            <div class="plan-footer">
              <span class="plan-amounts">${amountText}</span>
              ${budgetHtml}
            </div>
          </div>
        `;
      })
      .join("");

    container.innerHTML = '<p class="stat-insight">' + insight + '</p><div class="stat-rows">' + rowsHtml + "</div>";
  }

  function renderAllTransactions() {
    document.getElementById("currentMonthLabelTx").textContent =
      MONTH_NAMES[viewDate.getMonth()] + " " + viewDate.getFullYear();

    renderAccountTabs(document.getElementById("txAcctTabs"));
    let list = scopedTransactions()
      .filter((t) => isSameMonth(t.date, viewDate))
      .sort((a, b) => compareTxMoment(b, a));
    if (currentFilter !== "all") {
      list = list.filter((t) => t.type === currentFilter); // pindah cuma tampil di tab Semua
    }
    if (selectedCategories.length > 0) {
      // Nota cocok kalau SALAH SATU kategori itemnya dipilih; pindah tidak
      // punya kategori jadi tersembunyi selama filter kategori aktif.
      list = list.filter((t) =>
        txCategoryIds(t).some(
          (c) => selectedCategories.includes(c) || (selectedCategories.includes(UNKNOWN_CATEGORY_ID) && !categoryExists(t.type, c))
        )
      );
    }
    // Filter rentang tanggal (dalam bulan aktif). "YYYY-MM-DD" bisa dibanding string.
    if (filterStartDate) {
      list = list.filter((t) => t.date >= filterStartDate);
    }
    if (filterEndDate) {
      list = list.filter((t) => t.date <= filterEndDate);
    }
    renderTransactionList(document.getElementById("allTransactions"), list, "Belum ada transaksi bulan ini.", true);
  }

  function renderTransactionList(container, list, emptyMessage, detailed) {
    container.innerHTML = "";

    if (list.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = emptyMessage;
      container.appendChild(empty);
      return;
    }

    list.forEach((tx) => {
      const cat = findCategory(tx.type, tx.category);
      // Halaman Transaksi (detailed): tanggal + tahun & jam:menit:detik.
      // Dashboard: tanggal singkat & jam:menit.
      const dateText = detailed ? formatDateLong(tx.date) : formatDateShort(tx.date);
      const timeText = formatTxTime(tx, detailed);
      // Badge kecil penunjuk pembuat (Iyon/Ciwul) — cuma tampil mode "Both",
      // ditumpuk di pojok tx-icon. Klik → openCreatorInfo().
      const badgeHtml =
        currentUser === "both" && USERS[tx.by]
          ? `<img class="creator-badge" src="${USERS[tx.by].icon}" data-by="${tx.by}" alt="${USERS[tx.by].label}">`
          : "";
      // Nota ≥ 2 item dapat badge "N item"; nota 1 item tampil spt satuan.
      const itemBadge = tx.bentuk === "nota" && tx.items.length > 1 ? `<span class="tx-item-badge">${tx.items.length} item</span>` : "";
      // Pindah: di tab account asal tampil keluar (nominal + biaya admin), di
      // tab tujuan tampil masuk, di "Semua" netral (⇄).
      let sign = tx.type === "income" ? "+" : "-";
      let shownAmount = tx.amount;
      let amountCls = tx.type;
      if (tx.type === "transfer") {
        if (acctFilter === tx.dari) { shownAmount = tx.amount + tx.fee; amountCls = "expense"; }
        else if (acctFilter === tx.ke) { sign = "+"; amountCls = "income"; }
        else sign = "⇄";
      }
      const item = document.createElement("div");
      item.className = "transaction-item";
      item.innerHTML = `
        <div class="tx-icon ${tx.type}">${cat.icon}${badgeHtml}</div>
        <div class="tx-info">
          <p class="tx-category">${escapeHtml(txTitle(tx))}${itemBadge}</p>
          <p class="tx-note">${tx.note ? escapeHtml(tx.note) : tx.bentuk === "nota" ? escapeHtml(cat.label) : "&mdash;"}</p>
        </div>
        <div class="tx-right">
          <span class="tx-amount ${amountCls}">${sign} ${formatCurrency(shownAmount)}</span>
          <p class="tx-date">${dateText}</p>
          <p class="tx-time">${timeText}</p>
        </div>
        <div class="tx-actions">
          <button class="tx-btn tx-edit" data-id="${tx.id}" aria-label="Edit">✏️</button>
          <button class="tx-btn tx-delete" data-id="${tx.id}" aria-label="Hapus">🗑️</button>
        </div>
      `;
      // Klik kartu (di luar tombol edit/hapus/badge) → buka popup detail
      // (catatan sering terpotong di list mobile, popup menampilkannya utuh).
      item.addEventListener("click", (e) => {
        if (e.target.closest(".tx-actions") || e.target.closest(".creator-badge")) return;
        openTransactionDetail(tx);
      });
      container.appendChild(item);
    });

    container.querySelectorAll(".tx-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tx = transactions.find((t) => t.id === btn.dataset.id);
        if (tx) openEditModal(tx);
      });
    });

    container.querySelectorAll(".tx-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tx = transactions.find((t) => t.id === btn.dataset.id);
        if (tx) openDeleteConfirm(tx);
      });
    });

    container.querySelectorAll(".creator-badge").forEach((img) => {
      img.addEventListener("click", () => openCreatorInfo(img.dataset.by));
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* ================= Plans rendering ================= */

  function renderPlans() {
    const container = document.getElementById("plansList");
    container.innerHTML = "";

    // Tombol "+" nonaktif (abu-abu) kalau semua kategori di periode ini sudah
    // dipakai — global, tidak bergantung mode user (satu kategori+periode
    // cuma boleh 1 rencana, siapa pun pembuatnya).
    const addBtn = document.getElementById("addPlanBtn");
    addBtn.disabled = periodIsFull(currentPeriod);

    const list = plans
      .filter((p) => p.period === currentPeriod && planVisible(p))
      .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));

    if (list.length === 0) {
      container.innerHTML =
        '<p class="empty-state">Belum ada rencana ' + PERIOD_LABELS[currentPeriod] + '. Tambahkan untuk mulai mengatur budget kategori.</p>';
      return;
    }

    const now = new Date();

    list.forEach((plan) => {
      const cat = findCategory("expense", plan.category);
      const spent = planSpent(plan, now);
      const targetLabel = USERS[plan.target] ? USERS[plan.target].label : plan.target;
      const byLabel = USERS[plan.by] ? USERS[plan.by].label : plan.by;

      const pct = Math.min(100, Math.round((spent / plan.limit) * 100));
      let fillClass = "";
      if (pct >= 100) fillClass = "over";
      else if (pct >= 80) fillClass = "warning";

      const badgeHtml =
        currentUser === "both" && USERS[plan.by]
          ? `<img class="creator-badge-inline" src="${USERS[plan.by].icon}" data-by="${plan.by}" alt="${USERS[plan.by].label}">`
          : "";

      const card = document.createElement("div");
      card.className = "plan-card";
      card.dataset.id = plan.id;
      card.innerHTML = `
        <button class="plan-drag" data-id="${plan.id}" aria-label="Geser untuk mengubah urutan" title="Geser untuk mengubah urutan">⠿</button>
        <div class="plan-body">
          <div class="plan-top">
            <span class="plan-category">${cat.icon} ${cat.label}${badgeHtml}</span>
            <div class="plan-actions">
              <button class="plan-btn plan-edit" data-id="${plan.id}" aria-label="Edit">✏️</button>
              <button class="plan-btn plan-delete" data-id="${plan.id}" aria-label="Hapus">🗑️</button>
            </div>
          </div>
          <p class="plan-target">🎯 Target ${escapeHtml(targetLabel)} · dibuat ${escapeHtml(byLabel)}</p>
          <div class="plan-progress-track">
            <div class="plan-progress-fill ${fillClass}" style="width:${pct}%"></div>
          </div>
          <div class="plan-footer">
            <span class="plan-amounts">${formatCurrency(spent)} / ${formatCurrency(plan.limit)}</span>
            <span class="plan-percent">${pct}%</span>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll(".plan-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const plan = plans.find((p) => p.id === btn.dataset.id);
        if (plan) openEditPlanModal(plan);
      });
    });

    container.querySelectorAll(".plan-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        const plan = plans.find((p) => p.id === btn.dataset.id);
        if (plan) openDeletePlanConfirm(plan);
      });
    });

    container.querySelectorAll(".creator-badge-inline").forEach((img) => {
      img.addEventListener("click", () => openCreatorInfo(img.dataset.by));
    });

    // Drag-reorder cuma masuk akal per satu pemilik — di mode Both, list
    // berisi rencana dua orang sekaligus jadi handle-nya dinonaktifkan
    // (disembunyikan visual, tapi slot tetap ada biar layout tidak geser).
    container.querySelectorAll(".plan-drag").forEach((handle) => {
      if (currentUser === "both") {
        handle.style.visibility = "hidden";
        handle.style.cursor = "default";
      } else {
        handle.addEventListener("pointerdown", startPlanDrag);
      }
    });
  }

  /* ================= Reorder rencana (drag) ================= */

  let planDrag = null; // state saat menggeser

  function startPlanDrag(e) {
    e.preventDefault();
    const card = e.target.closest(".plan-card");
    if (!card) return;
    const container = document.getElementById("plansList");
    const cards = Array.from(container.querySelectorAll(".plan-card"));
    const from = cards.indexOf(card);
    if (from < 0) return;

    // Jarak geser satu slot = tinggi kartu + gap antar kartu.
    const gap = parseFloat(getComputedStyle(container).rowGap || getComputedStyle(container).gap) || 0;
    const shift = card.offsetHeight + gap;
    // Pusat asli tiap kartu (sebelum transform) untuk menentukan slot tujuan.
    const centers = cards.map((c) => {
      const r = c.getBoundingClientRect();
      return r.top + r.height / 2;
    });

    planDrag = { container, card, cards, from, to: from, startY: e.clientY, shift, centers };
    card.classList.add("dragging");

    document.addEventListener("pointermove", onPlanDragMove);
    document.addEventListener("pointerup", endPlanDrag);
    document.addEventListener("pointercancel", endPlanDrag);
  }

  function onPlanDragMove(e) {
    if (!planDrag) return;
    e.preventDefault();
    const { card, cards, from, startY, shift, centers } = planDrag;

    // Kartu yang di-hold mengikuti pointer.
    const dy = e.clientY - startY;
    card.style.transform = "translateY(" + dy + "px)";

    // Tentukan slot tujuan dari posisi pusat kartu terhadap pusat asli lainnya.
    const draggedCenter = centers[from] + dy;
    let to = from;
    while (to < cards.length - 1 && draggedCenter > centers[to + 1]) to++;
    while (to > 0 && draggedCenter < centers[to - 1]) to--;
    planDrag.to = to;

    // Geser kartu lain (smooth via CSS transition) untuk membuka ruang.
    cards.forEach((c, i) => {
      if (i === from) return;
      let y = 0;
      if (from < to && i > from && i <= to) y = -shift;
      else if (from > to && i >= to && i < from) y = shift;
      c.style.transform = y ? "translateY(" + y + "px)" : "";
    });
  }

  function endPlanDrag() {
    if (!planDrag) return;
    const { container, card, cards, from, to } = planDrag;
    document.removeEventListener("pointermove", onPlanDragMove);
    document.removeEventListener("pointerup", endPlanDrag);
    document.removeEventListener("pointercancel", endPlanDrag);

    // Matikan transisi sejenak supaya rekonsiliasi DOM tidak berkedip.
    container.classList.add("reordering");
    cards.forEach((c) => { c.style.transform = ""; });
    card.classList.remove("dragging");

    if (to !== from) {
      // Susun ulang DOM sesuai urutan baru.
      const order = cards.slice();
      order.splice(from, 1);
      order.splice(to, 0, card);
      order.forEach((c) => container.appendChild(c));
    }

    // Paksa reflow lalu hidupkan transisi lagi untuk drag berikutnya.
    void container.offsetHeight;
    container.classList.remove("reordering");

    planDrag = null;
    commitPlanOrder();
  }

  // Tulis ulang field `sort` sesuai urutan kartu di DOM (per periode aktif).
  function commitPlanOrder() {
    const container = document.getElementById("plansList");
    const ids = Array.from(container.querySelectorAll(".plan-card")).map((c) => c.dataset.id);
    const updates = {};
    ids.forEach((id, i) => {
      const plan = plans.find((p) => p.id === id);
      if (plan && plan.sort !== i) {
        updates["plans/" + plan.period + "/" + plan.category + "/sort"] = i;
      }
    });
    if (Object.keys(updates).length) {
      financeRef.update(updates).catch((err) => console.error("Gagal menyimpan urutan:", err));
    }
  }

  /* ================= Category select population ================= */

  function populateCategorySelect(selectEl, type) {
    selectEl.innerHTML = "";
    CATEGORIES[type].forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = cat.icon + " " + cat.label;
      selectEl.appendChild(opt);
    });
  }

  // Semua kategori yang bisa dipilih di rencana (termasuk "Semua").
  function planCategoryPool() {
    return [ALL_CATEGORY].concat(CATEGORIES.expense);
  }

  // Apakah semua kategori di periode ini sudah punya rencana? (Global — satu
  // kategori+periode cuma boleh 1 rencana, siapa pun pembuatnya.)
  function periodIsFull(period) {
    const used = plans.filter((p) => p.period === period).map((p) => p.category);
    return planCategoryPool().every((c) => used.indexOf(c.id) !== -1);
  }

  // Dalam konteks modal (create), scope ke user yang lagi dipilih di toggle
  // "Dibuat oleh" (atau currentUser langsung kalau bukan mode Both). Dipakai
  // buat nyimpen field `by` — bukan buat cek keunikan kategori (itu tetap
  // global: satu kategori+periode = satu rencana, siapa pun pembuatnya).
  // null kalau belum dipilih (wajib pilih manual, tidak ada default).
  function planFormBy() {
    if (currentUser !== "both") return currentUser;
    const active = document.querySelector("#planByToggle .type-btn.active");
    return active ? active.dataset.by : null;
  }

  // Disable opsi periode yang sudah penuh di dropdown modal.
  function updatePeriodOptions() {
    Array.from(planPeriodInput.options).forEach((opt) => {
      opt.disabled = periodIsFull(opt.value);
    });
  }

  // Isi dropdown kategori untuk modal Rencana. Kategori (termasuk "Semua")
  // yang sudah punya rencana di periode itu disembunyikan supaya tidak
  // duplikat — satu kategori+periode cuma boleh 1 rencana, siapa pun
  // pembuatnya. `keepCategory` dipertahankan (dipakai saat edit).
  function populatePlanCategories(period, keepCategory) {
    const used = plans.filter((p) => p.period === period).map((p) => p.category);
    const available = planCategoryPool().filter((c) => c.id === keepCategory || used.indexOf(c.id) === -1);

    planCategoryInput.innerHTML = "";

    if (available.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Semua kategori sudah dipakai";
      opt.disabled = true;
      opt.selected = true;
      planCategoryInput.appendChild(opt);
      return;
    }

    available.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = cat.icon + " " + cat.label;
      planCategoryInput.appendChild(opt);
    });
  }

  /* ================= Category filter modal ================= */

  // Jumlah hari pada bulan yang sedang dilihat.
  function daysInViewMonth() {
    return new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  }

  // Isi dropdown kustom pilihan hari (1..akhir bulan). Pilihan disimpan di
  // dataset.value pada elemen .day-dd. "" = tidak difilter. Panel bisa scroll
  // (tinggi dibatasi di CSS) supaya hanya ~5 baris yang tampil.
  function fillDaySelect(dd, selectedDay) {
    const lastDay = daysInViewMonth();
    const toggle = dd.querySelector(".day-dd-toggle");
    const menu = dd.querySelector(".day-dd-menu");
    dd.classList.remove("open");
    dd.dataset.value = selectedDay ? String(selectedDay) : "";
    toggle.textContent = dd.dataset.value || "—";
    menu.innerHTML = "";

    const addOption = (value, label) => {
      const opt = document.createElement("button");
      opt.type = "button";
      opt.className = "day-dd-option";
      opt.textContent = label;
      if (String(value) === String(dd.dataset.value)) opt.classList.add("selected");
      opt.addEventListener("click", () => {
        dd.dataset.value = String(value);
        toggle.textContent = value ? String(value) : "—";
        menu.querySelectorAll(".day-dd-option").forEach((o) => o.classList.toggle("selected", o === opt));
        dd.classList.remove("open");
      });
      menu.appendChild(opt);
    };

    addOption("", "—"); // reset / tidak difilter
    for (let d = 1; d <= lastDay; d++) addOption(String(d), d);
  }

  // Ambil komponen hari dari tanggal state ("YYYY-MM-DD").
  function dayOf(dateStr) {
    return dateStr ? Number(dateStr.split("-")[2]) : "";
  }

  // Bentuk tanggal "YYYY-MM-DD" dari nomor hari pada bulan aktif.
  function dateFromDay(day) {
    if (!day) return "";
    return viewDate.getFullYear() + "-" + pad2(viewDate.getMonth() + 1) + "-" + pad2(Number(day));
  }

  function openFilterModal() {
    const list = document.getElementById("filterCategoryList");
    list.innerHTML = "";

    let cats = currentFilter === "all"
      ? [...CATEGORIES.expense, ...CATEGORIES.income]
      : CATEGORIES[currentFilter];
    // Urutkan berdasarkan label (A→Z), bukan urutan definisi/ikon.
    cats = cats.slice().sort((a, b) => a.label.localeCompare(b.label, "id"));

    cats.forEach((cat) => {
      const div = document.createElement("div");
      div.className = "filter-category-item";
      const checked = selectedCategories.includes(cat.id) ? "checked" : "";
      div.innerHTML = `
        <label>
          <input type="checkbox" value="${cat.id}" ${checked}>
          <span>${cat.icon} ${cat.label}</span>
        </label>
      `;
      list.appendChild(div);
    });

    // Kalau ada transaksi (sesuai tab tipe aktif) yang kategorinya sudah
    // dihapus, tambahkan opsi "Kategori Terhapus" di paling bawah supaya
    // transaksi itu masih bisa dicari/difilter.
    const hasUnknown = visibleTransactions().some(
      (t) => (currentFilter === "all" || t.type === currentFilter) && txCategoryIds(t).some((c) => !categoryExists(t.type, c))
    );
    if (hasUnknown) {
      const div = document.createElement("div");
      div.className = "filter-category-item";
      const checked = selectedCategories.includes(UNKNOWN_CATEGORY_ID) ? "checked" : "";
      div.innerHTML = `
        <label>
          <input type="checkbox" value="${UNKNOWN_CATEGORY_ID}" ${checked}>
          <span>❓ Kategori Terhapus</span>
        </label>
      `;
      list.appendChild(div);
    }

    // Rentang tanggal = pilihan hari dalam bulan aktif, prefill dari state.
    fillDaySelect(document.getElementById("filterStartInput"), dayOf(filterStartDate));
    fillDaySelect(document.getElementById("filterEndInput"), dayOf(filterEndDate));

    document.getElementById("filterModal").classList.add("open");
  }

  function closeFilterModal() {
    document.getElementById("filterModal").classList.remove("open");
  }

  function applyFilter() {
    const checks = document.querySelectorAll("#filterCategoryList input[type='checkbox']:checked");
    selectedCategories = Array.from(checks).map((cb) => cb.value);

    let start = dateFromDay(document.getElementById("filterStartInput").dataset.value);
    let end = dateFromDay(document.getElementById("filterEndInput").dataset.value);
    // Kalau kebalik (start > end), tukar supaya tetap masuk akal.
    if (start && end && start > end) {
      const tmp = start; start = end; end = tmp;
    }
    filterStartDate = start;
    filterEndDate = end;

    updateFilterButton();
    closeFilterModal();
    renderAllTransactions();
  }

  function updateFilterButton() {
    const btn = document.getElementById("filterBtn");
    const active = selectedCategories.length > 0 || filterStartDate || filterEndDate;
    btn.classList.toggle("active", !!active);
  }

  // Hapus SEMUA filter (tipe, kategori, rentang tanggal) lalu tutup popup.
  function resetFilter() {
    currentFilter = "all";
    document.querySelectorAll("#transactions .filter-tab").forEach((t) =>
      t.classList.toggle("active", t.dataset.filter === "all")
    );
    selectedCategories = [];
    filterStartDate = "";
    filterEndDate = "";
    updateFilterButton();
    closeFilterModal();
    renderAllTransactions();
  }

  /* ================= Transaction modal ================= */

  const transactionModal = document.getElementById("transactionModal");
  const transactionForm = document.getElementById("transactionForm");
  const transactionModalTitle = document.getElementById("transactionModalTitle");
  const categoryInput = document.getElementById("categoryInput");
  const dateInput = document.getElementById("dateInput");
  const timeInput = document.getElementById("timeInput");

  let editingTx = null; // null = mode tambah; berisi tx = mode edit

  function setTxType(type) {
    currentTxType = type;
    document.querySelectorAll("#transactionTypeToggle .type-btn").forEach((b) => b.classList.toggle("active", b.dataset.type === type));
    populateCategorySelect(categoryInput, type);
  }

  // Saat edit, tipe, kategori, tanggal, waktu, & account dikunci (hanya
  // nominal + catatan yang bisa diubah).
  function setImmutableFieldsLocked(locked) {
    categoryInput.disabled = locked;
    dateInput.disabled = locked;
    timeInput.disabled = locked;
    ["transactionTypeToggle", "txAccountToggle"].forEach((id) => {
      document.querySelectorAll("#" + id + " .type-btn").forEach((b) => (b.disabled = locked));
      document.getElementById(id).classList.toggle("locked", locked);
    });
  }

  let txAccount = Core.DEFAULT_ACCOUNT; // account terpilih di form

  function setTxAccount(account) {
    txAccount = account;
    document.querySelectorAll("#txAccountToggle .type-btn").forEach((b) => b.classList.toggle("active", b.dataset.account === account));
    updateKodePreview();
  }

  // Tambah: perkiraan kode dari counter. Edit: kode asli (transaksi lama "—").
  function updateKodePreview() {
    const el = document.getElementById("txKodePreview");
    if (editingTx) {
      document.getElementById("txKodeLabel").textContent = "Kode";
      el.textContent = editingTx.kode || "— (transaksi lama)";
      return;
    }
    document.getElementById("txKodeLabel").textContent = "Kode (perkiraan)";
    el.textContent = previewKode({ bentuk: "satuan", account_type: txAccount, tanggal: dateInput.value });
  }

  document.querySelectorAll("#txAccountToggle .type-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!btn.disabled) setTxAccount(btn.dataset.account);
    });
  });

  // Scope ke user aktif kalau bukan mode Both; kalau Both, baca toggle
  // "Dibuat oleh" di modal — null kalau belum dipilih (wajib pilih manual,
  // tidak ada default), submit akan divalidasi & ditolak kalau masih null.
  function transactionFormBy() {
    if (currentUser !== "both") return currentUser;
    const active = document.querySelector("#transactionByToggle .type-btn.active");
    return active ? active.dataset.by : null;
  }

  // Set toggle 2-tombol (Dibuat oleh) ke satu nilai, opsional dikunci
  // (dipakai saat edit — pembuat tidak bisa diubah, sama spt field lain).
  function setByToggleValue(toggleId, by, locked) {
    const toggle = document.getElementById(toggleId);
    toggle.querySelectorAll(".type-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.by === by);
      b.disabled = locked;
    });
    toggle.classList.toggle("locked", locked);
  }

  // Wiring klik toggle "Dibuat oleh" (dipakai transactionByToggle & planByToggle).
  function wireByToggle(toggleId, onChange) {
    const toggle = document.getElementById(toggleId);
    toggle.querySelectorAll(".type-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return; // dikunci saat edit
        toggle.querySelectorAll(".type-btn").forEach((b) => b.classList.toggle("active", b === btn));
        if (onChange) onChange();
      });
    });
  }

  // Field "Dibuat oleh" saat TAMBAH data baru: mode "Both" → tampil normal,
  // harus dipilih manual. Mode Iyon/Ciwul → tetap tampil tapi dikunci
  // otomatis ke user aktif, label berubah jadi "Dibuat oleh (otomatis)".
  function setupByFieldForCreate(fieldId, labelId, toggleId) {
    document.getElementById(fieldId).hidden = false;
    const label = document.getElementById(labelId);
    if (currentUser === "both") {
      label.textContent = "Dibuat oleh";
      setByToggleValue(toggleId, null, false); // belum dipilih — user wajib pilih manual
    } else {
      label.textContent = "Dibuat oleh (otomatis)";
      setByToggleValue(toggleId, currentUser, true);
    }
  }

  // Field "Dibuat oleh" saat EDIT: cuma relevan/tampil kalau mode "Both"
  // (pembuat data lama sudah tetap, tidak perlu ditanya di mode single-user),
  // dan selalu dikunci ke pembuat aslinya (tidak bisa diubah).
  function setupByFieldForEdit(fieldId, labelId, toggleId, by) {
    document.getElementById(fieldId).hidden = currentUser !== "both";
    document.getElementById(labelId).textContent = "Dibuat oleh";
    setByToggleValue(toggleId, by, true);
  }

  function openTransactionModal() {
    editingTx = null;
    editingTransfer = null;
    transactionModalTitle.textContent = "Tambah Transaksi";
    document.getElementById("txModeToggle").hidden = false;
    setTxMode("satuan");
    transactionForm.reset();
    setImmutableFieldsLocked(false);
    setTxType("expense");
    const now = Date.now();
    dateInput.value = localDateStrOf(now);
    timeInput.value = formatTime(now, true);
    setTxAccount(acctFilter !== "all" ? acctFilter : Core.DEFAULT_ACCOUNT); // default ikut tab yang dibuka
    setupByFieldForCreate("transactionByField", "transactionByLabel", "transactionByToggle");
    transactionModal.classList.add("open");
  }

  function openEditModal(tx) {
    // Form ini cuma untuk satuan — nota diedit di halaman Nota (item/rincian
    // harus tetap cocok dengan totalnya).
    if (tx.bentuk === "nota") {
      openNota(tx);
      return;
    }
    if (tx.type === "transfer") {
      openEditTransfer(tx);
      return;
    }
    editingTx = tx;
    editingTransfer = null;
    transactionModalTitle.textContent = "Edit Transaksi";
    document.getElementById("txModeToggle").hidden = true;
    setTxMode("satuan");
    transactionForm.reset();
    setTxType(tx.type);
    document.getElementById("amountInput").value = Math.round(tx.amount).toLocaleString("id-ID");
    categoryInput.value = tx.category;
    document.getElementById("noteInput").value = tx.note || "";
    dateInput.value = tx.date;
    timeInput.value = tx.time;
    setTxAccount(tx.account_type);
    setImmutableFieldsLocked(true); // kunci tipe, kategori, tanggal, account setelah prefill
    setupByFieldForEdit("transactionByField", "transactionByLabel", "transactionByToggle", tx.by);
    transactionModal.classList.add("open");
  }

  function closeTransactionModal() {
    transactionModal.classList.remove("open");
    editingTx = null;
    editingTransfer = null;
  }

  document.querySelectorAll("#transactionTypeToggle .type-btn").forEach((btn) => {
    btn.addEventListener("click", () => setTxType(btn.dataset.type));
  });

  transactionForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = document.getElementById("amountInput").value.replace(/\./g, "");
    const amount = parseFloat(raw);
    if (!amount || amount <= 0) return;

    const by = editingTx ? editingTx.by : transactionFormBy();
    if (!editingTx && !by) {
      alert('Pilih dulu "Dibuat oleh" siapa.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput.value)) {
      alert("Pilih dulu tanggalnya.");
      return;
    }
    // Sebagian browser mengembalikan "HH:MM" kalau detiknya 00 → lengkapi.
    const time = /^\d{2}:\d{2}$/.test(timeInput.value) ? timeInput.value + ":00" : timeInput.value;
    if (!/^\d{2}:\d{2}:\d{2}$/.test(time)) {
      alert("Pilih dulu waktunya.");
      return;
    }

    if (!editingTx && !requireOnline()) return;

    const data = {
      type: currentTxType,
      account: txAccount,
      amount: amount,
      category: categoryInput.value,
      note: document.getElementById("noteInput").value.trim(),
      date: dateInput.value,
      time,
      by,
    };

    const isAdd = !editingTx;
    const op = editingTx ? updateTransaction(editingTx, data) : addTransaction(data);
    op.catch((err) => {
      console.error("Gagal menyimpan transaksi:", err);
      alert("Gagal menyimpan transaksi: " + err.message);
    });
    closeTransactionModal();
    if (isAdd) goToPage("dashboard"); // habis tambah transaksi → ke Dashboard (edit tetap di halaman asal)
  });

  // Ganti tanggal → waktu reset ke awal hari (key mulai dari 00:00:00).
  dateInput.addEventListener("change", () => {
    timeInput.value = "00:00:00";
    updateKodePreview(); // bulan kode ikut tanggal
  });

  document.getElementById("cancelTransactionBtn").addEventListener("click", closeTransactionModal);
  document.getElementById("navAdd").addEventListener("click", openTransactionModal);
  wireByToggle("transactionByToggle");
  document.getElementById("amountInput").addEventListener("input", function () {
    formatAmountInput(this);
  });
  document.getElementById("planLimitInput").addEventListener("input", function () {
    formatAmountInput(this);
  });

  /* ================= Halaman Nota (V2, halaman penuh) ================= */

  // State form nota. Angka (qty/harga/nilai) disimpan sbg TEKS input dan baru
  // di-parse saat dihitung, supaya mengetik "0," atau "2,5" tidak terganggu.
  // Perhitungan (subtotal, penyesuaian, alokasi kategori) → Core.computeNota,
  // sama persis dgn halaman Nota desktop.
  let nota = null; // { tx (null = baru), type, account, by, items, adj, dirty, showErrors }
  let notaSaving = false;
  let pageBeforeNota = "dashboard";

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

  // Satuan item: pcs, kg & liter (qty boleh desimal, mis. 250 gram → 0.25 kg).
  // Satuan lain dari nota lama tetap dipertahankan.
  const NOTA_UNITS = ["pcs", "kg", "liter"];

  function parseAmount(str) {
    return Number(String(str).replace(/\D/g, "")) || 0;
  }

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
      document.getElementById("notaTitle").value = tx.title || "";
      document.getElementById("notaDate").value = tx.date;
      document.getElementById("notaTime").value = tx.time;
    } else {
      const d = defaults || {};
      const type = d.type || "expense";
      nota = {
        tx: null,
        type,
        account: d.account || (ACCOUNT_BY_ID[acctFilter] ? acctFilter : Core.DEFAULT_ACCOUNT),
        by: currentUser === "both" ? d.by || null : currentUser,
        items: [blankItem(type)],
        adj: [],
        dirty: false,
        showErrors: false,
      };
      document.getElementById("notaTitle").value = "";
      document.getElementById("notaDate").value = localDateStrOf(now);
      document.getElementById("notaTime").value = formatTime(now, true);
    }
    if (!nota.items.length) nota.items.push(blankItem(nota.type));

    const active = document.querySelector(".page.active");
    pageBeforeNota = active && active.id !== "nota" ? active.id : "dashboard";
    document.querySelectorAll(".page").forEach((el) => el.classList.toggle("active", el.id === "nota"));
    document.body.classList.add("nota-open");
    window.scrollTo(0, 0);
    renderNotaForm();
  }

  function closeNota(force) {
    if (!force && nota && nota.dirty && !notaSaving && !confirm("Perubahan nota belum disimpan. Tinggalkan halaman ini?")) return;
    nota = null;
    document.body.classList.remove("nota-open");
    goToPage(pageBeforeNota);
  }

  // Set toggle data-<attr> ke satu nilai, opsional dikunci.
  function setToggle(id, attr, value, locked) {
    const toggle = document.getElementById(id);
    toggle.querySelectorAll(".type-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset[attr] === value);
      b.disabled = locked;
    });
    toggle.classList.toggle("locked", locked);
  }

  function renderNotaForm() {
    const editing = !!nota.tx;
    document.getElementById("notaPageTitle").textContent = editing ? "Edit Nota" : "Nota Baru";
    document.getElementById("notaDate").disabled = editing;
    document.getElementById("notaLockedHint").hidden = !editing;
    setToggle("notaTypeToggle", "type", nota.type, editing);
    setToggle("notaAccountToggle", "account", nota.account, editing);
    // Dibuat oleh: aturan sama dgn form satuan — mode Both pilih manual, mode
    // Iyon/Ciwul dikunci otomatis; saat edit dikunci ke pembuat asli.
    setToggle("notaByToggle", "by", nota.by, editing || currentUser !== "both");
    document.getElementById("notaByLabel").textContent = !editing && currentUser !== "both" ? "Dibuat oleh (otomatis)" : "Dibuat oleh";
    document.getElementById("notaKodeLabel").textContent = editing ? "Kode" : "Kode (perkiraan)";
    document.getElementById("notaQuickAdj").innerHTML = ADJ_PRESETS[nota.type]
      .map((p, i) => `<button type="button" class="quick-chip" data-preset="${i}">+ ${p[0]}</button>`)
      .join("");
    renderNotaItems();
    renderNotaAdj();
    renderNotaSummary();
  }

  function notaCategoryOptions(type, selected) {
    let html = CATEGORIES[type]
      .map((c) => `<option value="${escapeHtml(c.id)}"${c.id === selected ? " selected" : ""}>${escapeHtml(c.icon + " " + c.label)}</option>`)
      .join("");
    if (selected && !categoryExists(type, selected)) {
      html = `<option value="${escapeHtml(selected)}" selected>❓ ${escapeHtml(selected)} (terhapus)</option>` + html;
    }
    return html;
  }

  function unitOptions(selected) {
    const units = selected && NOTA_UNITS.indexOf(selected) === -1 ? [selected].concat(NOTA_UNITS) : NOTA_UNITS;
    return units.map((u) => `<option value="${escapeHtml(u)}"${u === (selected || "pcs") ? " selected" : ""}>${escapeHtml(u)}</option>`).join("");
  }

  // Item = kartu bertumpuk (tabel desktop tidak muat di layar HP).
  function renderNotaItems() {
    const only = nota.items.length === 1;
    document.getElementById("notaItems").innerHTML = nota.items
      .map((it, i) => `
        <div class="nota-item" data-i="${i}">
          <div class="nota-item-top">
            <span class="nota-num">${i + 1}</span>
            <input type="text" data-f="nama" placeholder="Nama item" aria-label="Nama item ${i + 1}" value="${escapeHtml(it.nama)}">
            <button type="button" class="tx-btn tx-delete" data-del-item="${i}" aria-label="Hapus item ${i + 1}"${only ? " disabled" : ""}>🗑️</button>
          </div>
          <select data-f="category" aria-label="Kategori item ${i + 1}">${notaCategoryOptions(nota.type, it.category)}</select>
          <div class="nota-item-nums">
            <input type="text" data-f="qty" inputmode="decimal" aria-label="Qty item ${i + 1}" value="${escapeHtml(it.qty)}">
            <select data-f="satuan" aria-label="Satuan item ${i + 1}">${unitOptions(it.satuan)}</select>
            <div class="nota-money"><span>Rp</span><input type="text" data-f="harga" inputmode="numeric" placeholder="Harga satuan" aria-label="Harga satuan item ${i + 1}" value="${escapeHtml(it.harga)}"></div>
          </div>
          <p class="nota-sub">Subtotal <b data-sub="${i}">Rp 0</b></p>
        </div>`)
      .join("");
  }

  function renderNotaAdj() {
    const opt = (v, label, cur) => `<option value="${v}"${v === cur ? " selected" : ""}>${label}</option>`;
    document.getElementById("notaAdjRows").innerHTML = nota.adj
      .map((p, j) => `
        <div class="nota-item" data-j="${j}">
          <div class="nota-item-top">
            <input type="text" data-f="label" placeholder="mis. Diskon member" aria-label="Label penyesuaian ${j + 1}" value="${escapeHtml(p.label)}">
            <button type="button" class="tx-btn tx-delete" data-del-adj="${j}" aria-label="Hapus penyesuaian ${j + 1}">🗑️</button>
          </div>
          <div class="nota-item-nums nota-adj-nums">
            <select data-f="efek" aria-label="Efek penyesuaian ${j + 1}">${opt("kurang", "Kurangi", p.efek)}${opt("tambah", "Tambah", p.efek)}</select>
            <select data-f="mode" aria-label="Mode penyesuaian ${j + 1}">${opt("nominal", "Rp", p.mode)}${opt("persen", "%", p.mode)}</select>
            <div class="nota-money"><span>${p.mode === "persen" ? "%" : "Rp"}</span><input type="text" data-f="nilai" inputmode="decimal" placeholder="0" aria-label="Nilai penyesuaian ${j + 1}" value="${escapeHtml(p.nilai)}"></div>
          </div>
          <p class="nota-sub">Hasil <b class="adj-result ${p.efek}" data-res="${j}"></b></p>
        </div>`)
      .join("");
  }

  function notaInput() {
    return {
      items: nota.items.map((it) => ({ nama: it.nama, category: it.category, qty: parseDecimal(it.qty), satuan: it.satuan, harga: parseAmount(it.harga) })),
      penyesuaian: nota.adj.map((p) => ({ label: p.label, efek: p.efek, mode: p.mode, nilai: p.mode === "persen" ? parseDecimal(p.nilai || "0") : parseAmount(p.nilai) })),
    };
  }

  function notaFields() {
    const raw = document.getElementById("notaTime").value;
    return Object.assign(notaInput(), {
      type: nota.type,
      account_type: nota.account,
      judul: document.getElementById("notaTitle").value,
      by: nota.by,
      tanggal: document.getElementById("notaDate").value,
      waktu: /^\d{2}:\d{2}$/.test(raw) ? raw + ":00" : raw,
      timestamp: nota.tx ? nota.tx.timestamp : Date.now(),
    });
  }

  // Hitung ulang & perbarui angka/struk TANPA me-render ulang input (fokus &
  // kursor keyboard HP tidak hilang saat mengetik).
  function renderNotaSummary() {
    if (!nota) return;
    const calc = Core.computeNota(notaInput());
    calc.items.forEach((it, i) => {
      const el = document.querySelector('#notaItems [data-sub="' + i + '"]');
      if (el) el.textContent = formatCurrency(it.subtotal);
    });
    calc.penyesuaian.forEach((p, j) => {
      const el = document.querySelector('#notaAdjRows [data-res="' + j + '"]');
      if (!el) return;
      el.textContent = (p.efek === "kurang" ? "− " : "+ ") + formatCurrency(p.jumlah);
      el.className = "adj-result " + p.efek;
    });
    document.getElementById("notaItemCount").textContent = "· " + nota.items.length + " item";
    document.getElementById("notaTotalLabel").textContent = nota.type === "income" ? "Total diterima" : "Total dibayar";
    const totalEl = document.getElementById("notaTotal");
    totalEl.textContent = formatCurrency(calc.nominal);
    totalEl.classList.toggle("negative", calc.nominal <= 0);

    const kode = nota.tx
      ? nota.tx.kode || "—"
      : previewKode({ bentuk: "nota", account_type: nota.account, tanggal: document.getElementById("notaDate").value });
    document.getElementById("notaKode").textContent = kode;
    document.getElementById("notaReceipt").innerHTML = notaReceiptHtml(calc, kode);

    // Peringatan langsung kalau total ≤ 0; daftar error lengkap muncul setelah
    // Simpan ditekan (dan ikut diperbarui saat isian dibetulkan).
    let msgs = [];
    if (nota.showErrors) msgs = Core.buildNota(notaFields()).errors;
    else if (calc.nominal <= 0 && (calc.subtotal > 0 || calc.penyesuaian.length)) {
      msgs = ["Total nota " + (calc.nominal < 0 ? "negatif" : "Rp 0") + " — cek potongan/biaya."];
    }
    const box = document.getElementById("notaErrors");
    box.hidden = !msgs.length;
    box.innerHTML = msgs.map((m) => "<span>" + escapeHtml(m) + "</span>").join("");
  }

  function notaReceiptHtml(calc, kode) {
    const date = document.getElementById("notaDate").value;
    const time = document.getElementById("notaTime").value;
    const meta = [date ? formatDateLong(date) : "", time.slice(0, 5), accountLabel(nota.account), USERS[nota.by] ? USERS[nota.by].label : ""]
      .filter(Boolean)
      .join(" · ");
    const lines = calc.items
      .map((it) => `
        <div class="receipt-line"><div><p>${escapeHtml(it.nama || "Item tanpa nama")}</p>
          <p class="receipt-sub">${formatQty(it.qty || 0)} ${escapeHtml(it.satuan || "")} × ${formatCurrency(it.harga || 0)}</p></div>
          <span>${formatCurrency(it.subtotal || 0)}</span></div>`)
      .join("");
    const adj = calc.penyesuaian
      .map((p) => `<div class="receipt-row"><span>${escapeHtml(p.label || "Penyesuaian")}${p.mode === "persen" ? " (" + formatQty(p.nilai || 0) + "%)" : ""}</span>
        <span>${p.efek === "kurang" ? "− " : "+ "}${formatCurrency(p.jumlah || 0)}</span></div>`)
      .join("");
    const cats = Object.keys(calc.rincian_kategori)
      .filter((k) => calc.rincian_kategori[k] > 0)
      .sort((a, b) => calc.rincian_kategori[b] - calc.rincian_kategori[a])
      .map((k) => {
        const c = findCategory(nota.type, k);
        return `<div class="receipt-row"><span>${c.icon} ${escapeHtml(c.label)}</span><span>${formatCurrency(calc.rincian_kategori[k])}</span></div>`;
      })
      .join("");
    return `
      <p class="receipt-kicker">NOTA</p>
      <p class="receipt-title">${escapeHtml(document.getElementById("notaTitle").value.trim() || "Judul nota")}</p>
      <p class="receipt-sub">${escapeHtml(meta)}</p>
      <p class="receipt-sub kode">${escapeHtml(kode)}</p>
      <div class="receipt-cut"></div>
      ${lines}
      <div class="receipt-cut"></div>
      <div class="receipt-row"><span>Subtotal · ${calc.items.length} item</span><span>${formatCurrency(calc.subtotal)}</span></div>
      ${adj}
      <div class="receipt-row receipt-total"><span>${nota.type === "income" ? "TOTAL DITERIMA" : "TOTAL DIBAYAR"}</span><span>${formatCurrency(calc.nominal)}</span></div>
      ${cats ? '<div class="receipt-cut"></div><p class="receipt-sub">Per kategori</p>' + cats : ""}`;
  }

  function saveNota() {
    if (notaSaving) return;
    const built = Core.buildNota(notaFields());
    if (built.errors.length) {
      nota.showErrors = true;
      renderNotaSummary();
      document.getElementById("notaErrors").scrollIntoView({ block: "center" });
      return;
    }
    const tx = nota.tx;
    if (!tx && !requireOnline()) return;
    notaSaving = true;
    const btn = document.getElementById("notaSaveBtn");
    btn.disabled = true;
    btn.textContent = "Menyimpan…";
    // Baru: kode atomik (Data.saveNew). Edit: update parsial — kode, tanggal,
    // account & jenis tidak ikut dikirim (terkunci).
    const op = tx ? Data.updateNota(tx.ym, tx.id, built.record) : Data.saveNew(built.record);
    op.then(() => {
      // Tampilkan nota di halaman Transaksi pada bulan & tab account-nya.
      const d = built.record.tanggal;
      viewDate = new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, 1);
      if (acctFilter !== "all" && acctFilter !== built.record.account_type) acctFilter = "all";
      pageBeforeNota = "transactions";
      closeNota(true);
    })
      .catch((err) => {
        console.error("Gagal menyimpan nota:", err);
        alert("Gagal menyimpan nota: " + err.message);
      })
      .finally(() => {
        notaSaving = false;
        btn.disabled = false;
        btn.textContent = "Simpan";
      });
  }

  /* ---------- Event halaman Nota ---------- */

  function markNotaDirty() {
    nota.dirty = true;
    renderNotaSummary();
  }

  document.getElementById("notaTitle").addEventListener("input", markNotaDirty);
  document.getElementById("notaTime").addEventListener("input", markNotaDirty);
  // Ganti tanggal → waktu reset ke awal hari (aturan sama dgn form satuan);
  // bulan kode ikut tanggal.
  document.getElementById("notaDate").addEventListener("change", () => {
    document.getElementById("notaTime").value = "00:00:00";
    markNotaDirty();
  });

  document.querySelectorAll("#notaTypeToggle .type-btn").forEach((b) =>
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
  document.querySelectorAll("#notaAccountToggle .type-btn").forEach((b) =>
    b.addEventListener("click", () => {
      if (nota.tx) return;
      nota.account = b.dataset.account;
      setToggle("notaAccountToggle", "account", nota.account, false);
      markNotaDirty();
    })
  );
  document.querySelectorAll("#notaByToggle .type-btn").forEach((b) =>
    b.addEventListener("click", () => {
      if (b.disabled) return;
      nota.by = b.dataset.by;
      setToggle("notaByToggle", "by", nota.by, false);
      markNotaDirty();
    })
  );

  const notaItemsEl = document.getElementById("notaItems");
  notaItemsEl.addEventListener("input", (e) => {
    const f = e.target.dataset.f;
    const row = e.target.closest("[data-i]");
    if (!f || !row) return;
    if (f === "harga") formatAmountInput(e.target);
    nota.items[Number(row.dataset.i)][f] = e.target.value;
    markNotaDirty();
  });
  // Select item (kategori/satuan) di sebagian browser HP cuma memicu "change".
  notaItemsEl.addEventListener("change", (e) => {
    const f = e.target.dataset.f;
    const row = e.target.closest("[data-i]");
    if (!row || (f !== "category" && f !== "satuan")) return;
    nota.items[Number(row.dataset.i)][f] = e.target.value;
    markNotaDirty();
  });
  notaItemsEl.addEventListener("click", (e) => {
    const del = e.target.closest("[data-del-item]");
    if (!del || nota.items.length <= 1) return;
    nota.items.splice(Number(del.dataset.delItem), 1);
    renderNotaItems();
    markNotaDirty();
  });
  document.getElementById("notaAddItem").addEventListener("click", () => {
    const last = nota.items[nota.items.length - 1];
    const it = blankItem(nota.type);
    if (last && last.category) it.category = last.category; // item baru biasanya sejenis
    nota.items.push(it);
    renderNotaItems();
    markNotaDirty();
    notaItemsEl.querySelector('[data-i="' + (nota.items.length - 1) + '"] [data-f="nama"]').focus();
  });

  const notaAdjEl = document.getElementById("notaAdjRows");
  function addNotaAdj(p) {
    nota.adj.push(p);
    renderNotaAdj();
    markNotaDirty();
    const row = notaAdjEl.querySelector('[data-j="' + (nota.adj.length - 1) + '"]');
    row.querySelector(p.label ? '[data-f="nilai"]' : '[data-f="label"]').focus();
  }

  document.getElementById("notaAddAdj").addEventListener("click", () => addNotaAdj({ label: "", efek: "kurang", mode: "nominal", nilai: "" }));
  document.getElementById("notaQuickAdj").addEventListener("click", (e) => {
    const b = e.target.closest("[data-preset]");
    if (!b) return;
    const p = ADJ_PRESETS[nota.type][Number(b.dataset.preset)];
    addNotaAdj({ label: p[0], efek: p[1], mode: p[2], nilai: p[3] });
  });
  notaAdjEl.addEventListener("input", (e) => {
    const f = e.target.dataset.f;
    const row = e.target.closest("[data-j]");
    if (!f || !row || e.target.tagName === "SELECT") return;
    const p = nota.adj[Number(row.dataset.j)];
    if (f === "nilai" && p.mode === "nominal") formatAmountInput(e.target);
    p[f] = e.target.value;
    markNotaDirty();
  });
  notaAdjEl.addEventListener("change", (e) => {
    const f = e.target.dataset.f;
    const row = e.target.closest("[data-j]");
    if (!row || (f !== "efek" && f !== "mode")) return;
    const p = nota.adj[Number(row.dataset.j)];
    p[f] = e.target.value;
    if (f === "mode") p.nilai = p.mode === "nominal" ? (parseAmount(p.nilai) ? parseAmount(p.nilai).toLocaleString("id-ID") : "") : String(p.nilai).replace(/\./g, "");
    renderNotaAdj();
    markNotaDirty();
  });
  notaAdjEl.addEventListener("click", (e) => {
    const del = e.target.closest("[data-del-adj]");
    if (!del) return;
    nota.adj.splice(Number(del.dataset.delAdj), 1);
    renderNotaAdj();
    markNotaDirty();
  });

  document.getElementById("notaSaveBtn").addEventListener("click", saveNota);
  document.getElementById("notaCancelBtn").addEventListener("click", () => closeNota());
  document.getElementById("notaBackBtn").addEventListener("click", () => closeNota());

  /* ================= Pindah account (V2) ================= */

  // Mode "Pindah" di popup Tambah (form #transferForm, menggantikan form
  // satuan) + edit transaksi pindah. Pindah bukan pemasukan/pengeluaran —
  // cuma biaya admin yang dihitung pengeluaran Lainnya di account asal.
  const transferForm = document.getElementById("transferForm");
  const tfState = { from: "bank", to: "cash" };
  let editingTransfer = null; // null = tambah; berisi tx pindah = edit

  // Popup Tambah: Satuan | Nota | Pindah. Nota → halaman penuh (lihat atas).
  function setTxMode(mode) {
    document.querySelectorAll("#txModeToggle .mode-btn").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    const pindah = mode === "pindah";
    document.getElementById("transactionTypeToggle").hidden = pindah;
    transactionForm.hidden = pindah;
    transferForm.hidden = !pindah;
    if (pindah && !editingTransfer) resetTransferForm();
  }

  function resetTransferForm() {
    tfState.from = ACCOUNT_BY_ID[acctFilter] ? acctFilter : Core.DEFAULT_ACCOUNT;
    tfState.to = tfState.from === "cash" ? "bank" : "cash";
    const now = Date.now();
    transferForm.reset();
    document.getElementById("tfDate").value = localDateStrOf(now);
    document.getElementById("tfTime").value = formatTime(now, true);
    setTransferLocked(false);
    // Pembuat ikut pilihan di form satuan kalau sudah dipilih (mode Both).
    setupByFieldForCreate("transferByField", "transferByLabel", "transferByToggle");
    const picked = transactionFormBy();
    if (currentUser === "both" && picked) setByToggleValue("transferByToggle", picked, false);
    document.getElementById("tfKodeLabel").textContent = "Kode (perkiraan)";
    renderTransferForm();
  }

  function setTransferLocked(locked) {
    document.getElementById("tfDate").disabled = locked;
    document.getElementById("tfTime").disabled = locked;
    document.getElementById("tfSwap").hidden = locked;
    ["tfFromToggle", "tfToToggle"].forEach((id) => document.getElementById(id).classList.toggle("locked", locked));
  }

  // Ke ≠ Dari: opsi yang sama dgn asal dinonaktifkan di pemilih tujuan.
  function renderTransferForm() {
    const locked = !!editingTransfer;
    document.querySelectorAll("#tfFromToggle .type-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.account === tfState.from);
      b.disabled = locked;
    });
    document.querySelectorAll("#tfToToggle .type-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.account === tfState.to);
      b.disabled = locked || b.dataset.account === tfState.from;
    });
    renderTransferSummary();
  }

  function renderTransferSummary() {
    const amount = parseAmount(document.getElementById("tfAmount").value);
    const fee = parseAmount(document.getElementById("tfFee").value);
    const from = ACCOUNT_BY_ID[tfState.from], to = ACCOUNT_BY_ID[tfState.to];
    document.getElementById("tfSummary").innerHTML = `
      <p class="tf-route">${from.icon} ${from.label} <span aria-hidden="true">→</span> ${to.icon} ${to.label}</p>
      <div class="tf-kv"><span>${from.label} berkurang</span><b class="tf-out">− ${formatCurrency(amount + fee)}</b></div>
      <div class="tf-kv"><span>${to.label} bertambah</span><b class="tf-in">+ ${formatCurrency(amount)}</b></div>
      <p class="tf-note">Pemindahan tidak dihitung sebagai pemasukan atau pengeluaran. Hanya biaya admin yang tercatat sebagai pengeluaran (kategori Lainnya).</p>`;
    document.getElementById("tfKodePreview").textContent = editingTransfer
      ? editingTransfer.kode || "—"
      : previewKode({ bentuk: "pindah", dari: tfState.from, ke: tfState.to, tanggal: document.getElementById("tfDate").value });
  }

  function openEditTransfer(tx) {
    editingTransfer = tx;
    editingTx = null;
    transactionModalTitle.textContent = "Edit Pindah Account";
    document.getElementById("txModeToggle").hidden = true;
    transferForm.reset();
    tfState.from = tx.dari;
    tfState.to = tx.ke;
    document.getElementById("tfAmount").value = Math.round(tx.amount).toLocaleString("id-ID");
    document.getElementById("tfFee").value = tx.fee ? tx.fee.toLocaleString("id-ID") : "";
    document.getElementById("tfNote").value = tx.note || "";
    document.getElementById("tfDate").value = tx.date;
    document.getElementById("tfTime").value = tx.time;
    setTransferLocked(true);
    setupByFieldForEdit("transferByField", "transferByLabel", "transferByToggle", tx.by);
    document.getElementById("tfKodeLabel").textContent = "Kode";
    setTxMode("pindah");
    renderTransferForm();
    transactionModal.classList.add("open");
  }

  document.querySelectorAll("#tfFromToggle .type-btn").forEach((b) =>
    b.addEventListener("click", () => {
      if (b.disabled) return;
      // Memilih Dari = Ke saat ini → otomatis ditukar.
      if (b.dataset.account === tfState.to) tfState.to = tfState.from;
      tfState.from = b.dataset.account;
      renderTransferForm();
    })
  );
  document.querySelectorAll("#tfToToggle .type-btn").forEach((b) =>
    b.addEventListener("click", () => {
      if (b.disabled) return;
      tfState.to = b.dataset.account;
      renderTransferForm();
    })
  );
  document.getElementById("tfSwap").addEventListener("click", () => {
    const x = tfState.from;
    tfState.from = tfState.to;
    tfState.to = x;
    renderTransferForm();
  });
  ["tfAmount", "tfFee"].forEach((id) =>
    document.getElementById(id).addEventListener("input", function () {
      formatAmountInput(this);
      renderTransferSummary();
    })
  );
  // Ganti tanggal → waktu reset ke awal hari (sama dgn satuan/nota).
  document.getElementById("tfDate").addEventListener("change", () => {
    document.getElementById("tfTime").value = "00:00:00";
    renderTransferSummary();
  });
  wireByToggle("transferByToggle");

  transferForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = parseAmount(document.getElementById("tfAmount").value);
    const fee = parseAmount(document.getElementById("tfFee").value);
    const note = document.getElementById("tfNote").value.trim();

    if (editingTransfer) {
      // Edit: cuma jumlah, biaya admin, catatan (update parsial).
      if (!(amount > 0)) {
        alert("Jumlah dipindah harus lebih dari 0.");
        return;
      }
      const tx = editingTransfer;
      Data.update(tx.ym, tx.id, { nominal: amount, biaya_admin: fee, catatan: note }).catch((err) => {
        console.error("Gagal menyimpan pindah:", err);
        alert("Gagal menyimpan: " + err.message);
      });
      closeTransactionModal();
      return;
    }

    const activeBy = document.querySelector("#transferByToggle .type-btn.active");
    const by = currentUser === "both" ? (activeBy ? activeBy.dataset.by : null) : currentUser;
    const rawTime = document.getElementById("tfTime").value;
    const { errors, record } = Core.buildPindah({
      dari: tfState.from,
      ke: tfState.to,
      nominal: amount,
      biaya_admin: fee,
      catatan: note,
      by,
      tanggal: document.getElementById("tfDate").value,
      waktu: /^\d{2}:\d{2}$/.test(rawTime) ? rawTime + ":00" : rawTime,
      timestamp: Date.now(),
    });
    if (errors.length) {
      alert(errors.join("\n"));
      return;
    }
    if (!requireOnline()) return;
    Data.saveNew(record).catch((err) => {
      console.error("Gagal memindahkan saldo:", err);
      alert("Gagal memindahkan saldo: " + err.message);
    });
    closeTransactionModal();
    goToPage("dashboard"); // sama dgn tambah satuan
  });

  document.getElementById("cancelTransferBtn").addEventListener("click", closeTransactionModal);

  document.querySelectorAll("#txModeToggle .mode-btn").forEach((b) =>
    b.addEventListener("click", () => {
      if (b.dataset.mode === "nota") {
        // Nota pindah ke halaman lain → tanya dulu (popup Tambah tetap terbuka
        // di belakang sampai user memilih).
        notaConfirmModal.classList.add("open");
        return;
      }
      setTxMode(b.dataset.mode);
    })
  );

  const notaConfirmModal = document.getElementById("notaConfirmModal");
  const closeNotaConfirm = () => notaConfirmModal.classList.remove("open");

  // Lanjut → tutup popup, buka halaman Nota dgn jenis/account/pembuat yang
  // sudah dipilih di popup. Tidak → tetap di popup Tambah, mode tidak berubah.
  document.getElementById("notaConfirmYesBtn").addEventListener("click", () => {
    const defaults = { type: currentTxType, account: txAccount, by: transactionFormBy() };
    closeNotaConfirm();
    closeTransactionModal();
    openNota(null, defaults);
  });
  document.getElementById("notaConfirmNoBtn").addEventListener("click", closeNotaConfirm);
  notaConfirmModal.addEventListener("click", (e) => {
    if (e.target === notaConfirmModal) closeNotaConfirm();
  });

  /* ================= Transaction detail modal ================= */

  const transactionDetailModal = document.getElementById("transactionDetailModal");

  // Tampilkan detail lengkap satu transaksi (catatan sering terpotong di
  // list mobile, popup ini menampilkannya utuh + detail waktu lengkap).
  function openTransactionDetail(tx) {
    const cat = findCategory(tx.type, tx.category);
    const typeLabel = TYPE_LABELS[tx.type] + (tx.bentuk === "nota" ? " · Nota" : "");
    const isTransfer = tx.type === "transfer";

    const icon = document.getElementById("detailIcon");
    icon.textContent = cat.icon;
    icon.className = "detail-icon " + tx.type;

    document.getElementById("detailCategory").textContent = txTitle(tx);

    const badge = document.getElementById("detailTypeBadge");
    badge.textContent = typeLabel;
    badge.className = "detail-type-badge " + tx.type;

    const amount = document.getElementById("detailAmount");
    amount.textContent = (tx.type === "income" ? "+ " : isTransfer ? "⇄ " : "- ") + formatCurrency(tx.amount);
    amount.className = "detail-amount " + tx.type;

    document.getElementById("detailKode").textContent = tx.kode || "—";
    document.getElementById("detailAccountRow").hidden = isTransfer;
    document.getElementById("detailAccount").textContent = isTransfer ? "" : ACCOUNT_BY_ID[tx.account_type].icon + " " + accountLabel(tx.account_type);
    document.getElementById("detailRouteRow").hidden = !isTransfer;
    document.getElementById("detailRoute").textContent = isTransfer
      ? transferRoute(tx) + (tx.fee > 0 ? " · biaya admin " + formatCurrency(tx.fee) : "")
      : "";

    // Nota: daftar item + penyesuaian + total per kategori.
    const itemsRow = document.getElementById("detailItemsRow");
    itemsRow.hidden = tx.bentuk !== "nota";
    if (tx.bentuk === "nota") {
      document.getElementById("detailItemsLabel").textContent = "Item nota (" + tx.items.length + ")";
      const lines = tx.items.map((it) => {
        const c = findCategory(tx.type, it.category);
        return `<div class="detail-item"><div><p class="detail-item-name">${escapeHtml(it.nama)}</p>
          <p class="detail-item-sub">${c.icon} ${escapeHtml(c.label)} · ${formatQty(it.qty)} ${escapeHtml(it.satuan || "")} × ${formatCurrency(it.harga)}</p></div>
          <span class="detail-item-amount">${formatCurrency(it.subtotal)}</span></div>`;
      });
      if (tx.penyesuaian.length) {
        lines.push(`<div class="detail-item detail-item-sum"><span>Subtotal</span><span>${formatCurrency(tx.subtotal)}</span></div>`);
        tx.penyesuaian.forEach((p) => {
          const pct = p.mode === "persen" ? " (" + formatQty(p.nilai) + "%)" : "";
          lines.push(`<div class="detail-item detail-item-adj"><span>${escapeHtml(p.label)}${pct}</span><span>${p.efek === "kurang" ? "− " : "+ "}${formatCurrency(p.jumlah)}</span></div>`);
        });
      }
      const cats = Object.keys(tx.rincian);
      if (cats.length > 1) {
        lines.push(
          '<p class="detail-item-sub detail-rincian">Per kategori: ' +
            cats.map((k) => escapeHtml(findCategory(tx.type, k).label) + " " + formatCurrency(tx.rincian[k])).join(" · ") +
            "</p>"
        );
      }
      document.getElementById("detailItems").innerHTML = lines.join("");
    }

    document.getElementById("detailNote").textContent = tx.note || "—";
    document.getElementById("detailDate").textContent = formatDateLong(tx.date);
    document.getElementById("detailTxTime").textContent = tx.time;
    // Waktu dibuat = field timestamp (kapan diinput), tanggal + jam lengkap.
    const created = txTime(tx);
    document.getElementById("detailTime").textContent =
      formatDateLong(localDateStrOf(created)) + ", " + formatTime(created, true);

    transactionDetailModal.classList.add("open");
  }

  function closeTransactionDetail() {
    transactionDetailModal.classList.remove("open");
  }

  document.getElementById("closeDetailBtn").addEventListener("click", closeTransactionDetail);
  transactionDetailModal.addEventListener("click", (e) => {
    if (e.target === transactionDetailModal) closeTransactionDetail();
  });

  /* ================= Delete confirmation modal ================= */

  const confirmModal = document.getElementById("confirmModal");
  const confirmTitle = document.getElementById("confirmTitle");
  const confirmText = document.getElementById("confirmText");
  let pendingDeleteTx = null;
  let pendingDeletePlan = null;
  let pendingDeleteCategory = null; // { type, cat }

  function openDeleteConfirm(tx) {
    pendingDeleteTx = tx;
    pendingDeletePlan = null;
    pendingDeleteCategory = null;
    confirmTitle.textContent = "Hapus Transaksi?";
    confirmText.textContent = "Apakah Anda yakin ingin menghapus transaksi ini? Tindakan ini tidak dapat dibatalkan.";
    confirmModal.classList.add("open");
  }

  function openDeletePlanConfirm(plan) {
    pendingDeletePlan = plan;
    pendingDeleteTx = null;
    pendingDeleteCategory = null;
    confirmTitle.textContent = "Hapus Rencana?";
    confirmText.textContent = "Apakah Anda yakin ingin menghapus rencana anggaran untuk kategori ini?";
    confirmModal.classList.add("open");
  }

  function openDeleteCategoryConfirm(type, cat) {
    pendingDeleteCategory = { type, cat };
    pendingDeleteTx = null;
    pendingDeletePlan = null;
    confirmTitle.textContent = "Hapus Kategori?";
    confirmText.textContent =
      'Apakah Anda yakin ingin menghapus kategori "' + cat.label + '"? Transaksi lama dengan kategori ini tetap tersimpan tapi tampil tanpa nama kategori.';
    confirmModal.classList.add("open");
  }

  function closeDeleteConfirm() {
    confirmModal.classList.remove("open");
    pendingDeleteTx = null;
    pendingDeletePlan = null;
    pendingDeleteCategory = null;
  }

  document.getElementById("cancelDeleteBtn").addEventListener("click", closeDeleteConfirm);

  document.getElementById("confirmDeleteBtn").addEventListener("click", () => {
    if (pendingDeleteTx) {
      deleteTransaction(pendingDeleteTx).catch((err) => {
        console.error("Gagal menghapus transaksi:", err);
        alert("Gagal menghapus transaksi. Cek koneksi internet.");
      });
    } else if (pendingDeletePlan) {
      deletePlan(pendingDeletePlan.period, pendingDeletePlan.category).catch((err) => {
        console.error("Gagal menghapus rencana:", err);
        alert("Gagal menghapus rencana. Cek koneksi internet.");
      });
    } else if (pendingDeleteCategory) {
      deleteCategory(pendingDeleteCategory.type, pendingDeleteCategory.cat.id).catch((err) => {
        console.error("Gagal menghapus kategori:", err);
        alert("Gagal menghapus kategori. Cek koneksi internet.");
      });
    }
    closeDeleteConfirm();
  });

  /* ================= Plan modal ================= */

  const planModal = document.getElementById("planModal");
  const planForm = document.getElementById("planForm");
  const planCategoryInput = document.getElementById("planCategoryInput");
  const planPeriodInput = document.getElementById("planPeriodInput");

  let editingPlan = null;

  // Saat edit rencana, periode & kategori dikunci (mengubahnya = rencana lain).
  // Hanya batas anggaran yang bisa diubah.
  function setPlanFieldsLocked(locked) {
    planPeriodInput.disabled = locked;
    planCategoryInput.disabled = locked;
  }

  // Toggle "Target untuk" (Iyon/Ciwul/Both) — selalu bisa dipilih, juga saat edit.
  function setPlanTarget(target) {
    document.querySelectorAll("#planTargetToggle .type-btn").forEach((b) => b.classList.toggle("active", b.dataset.target === target));
  }

  function planFormTarget() {
    const active = document.querySelector("#planTargetToggle .type-btn.active");
    return active ? active.dataset.target : null;
  }

  document.querySelectorAll("#planTargetToggle .type-btn").forEach((btn) => {
    btn.addEventListener("click", () => setPlanTarget(btn.dataset.target));
  });

  function openPlanModal() {
    editingPlan = null;
    planForm.reset();
    setPlanFieldsLocked(false);
    setupByFieldForCreate("planByField", "planByLabel", "planByToggle");
    setPlanTarget(currentUser); // default = mode user aktif
    document.getElementById("planModalTitle").textContent = "Rencana Anggaran Baru";
    updatePeriodOptions(); // buramkan periode yang sudah penuh
    planPeriodInput.value = currentPeriod; // default ikut tab yang aktif
    populatePlanCategories(currentPeriod); // sembunyikan kategori yang sudah dipakai
    planModal.classList.add("open");
  }

  function openEditPlanModal(plan) {
    editingPlan = plan;
    planForm.reset();
    setupByFieldForEdit("planByField", "planByLabel", "planByToggle", plan.by);
    setPlanTarget(plan.target);
    document.getElementById("planModalTitle").textContent = "Edit Rencana Anggaran";
    planPeriodInput.value = plan.period;
    populatePlanCategories(plan.period, plan.category);
    planCategoryInput.value = plan.category;
    document.getElementById("planLimitInput").value = Math.round(plan.limit).toLocaleString("id-ID");
    setPlanFieldsLocked(true);
    planModal.classList.add("open");
  }

  function closePlanModal() {
    planModal.classList.remove("open");
    editingPlan = null;
  }

  planForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const rawLimit = document.getElementById("planLimitInput").value.replace(/\./g, "");
    const limit = parseFloat(rawLimit);
    if (!limit || limit <= 0) return;

    // Disimpan per periode+kategori+pemilik: menyimpan kombinasi yang sama
    // akan menimpa limit lama. Sort dipertahankan kalau rencana sudah ada,
    // rencana baru ditaruh paling akhir (dalam set milik user itu).
    const period = planPeriodInput.value;
    const category = planCategoryInput.value;
    if (!category) return; // tidak ada kategori tersedia (semua sudah dipakai)
    const by = editingPlan ? editingPlan.by : planFormBy();
    if (!editingPlan && !by) {
      alert('Pilih dulu "Dibuat oleh" siapa.');
      return;
    }
    const target = planFormTarget();
    if (!target) {
      alert('Pilih dulu "Target untuk" siapa.');
      return;
    }
    const existing = plans.find((p) => p.id === period + "_" + category);
    const sort = existing ? existing.sort : nextSortForPeriod(period);
    savePlan(period, category, limit, sort, by, target).catch((err) => {
      console.error("Gagal menyimpan rencana:", err);
      alert("Gagal menyimpan rencana. Cek koneksi internet.");
    });
    closePlanModal();
  });

  // Ganti periode di modal → perbarui daftar kategori yang masih tersedia.
  planPeriodInput.addEventListener("change", () => {
    populatePlanCategories(planPeriodInput.value);
  });

  document.getElementById("cancelPlanBtn").addEventListener("click", closePlanModal);
  document.getElementById("addPlanBtn").addEventListener("click", openPlanModal);
  wireByToggle("planByToggle"); // kategori/periode global, tidak perlu repopulasi saat ganti "Dibuat oleh"

  /* ================= Overlay click-to-close ================= */

  transactionModal.addEventListener("click", (e) => {
    if (e.target === transactionModal) closeTransactionModal();
  });
  planModal.addEventListener("click", (e) => {
    if (e.target === planModal) closePlanModal();
  });
  confirmModal.addEventListener("click", (e) => {
    if (e.target === confirmModal) closeDeleteConfirm();
  });

  /* ================= Filter tabs ================= */

  document.querySelectorAll("#transactions .filter-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      currentFilter = tab.dataset.filter;
      document.querySelectorAll("#transactions .filter-tab").forEach((t) => t.classList.toggle("active", t === tab));
      selectedCategories = [];
      updateFilterButton();
      renderAllTransactions();
    });
  });

  /* ================= Plan period tabs ================= */

  document.querySelectorAll("#plans .filter-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      currentPeriod = tab.dataset.period;
      document.querySelectorAll("#plans .filter-tab").forEach((t) => t.classList.toggle("active", t === tab));
      renderPlans();
    });
  });

  document.getElementById("filterBtn").addEventListener("click", openFilterModal);
  document.getElementById("applyFilterBtn").addEventListener("click", applyFilter);
  document.getElementById("resetFilterBtn").addEventListener("click", resetFilter);
  document.getElementById("cancelFilterBtn").addEventListener("click", closeFilterModal);

  // Dropdown hari kustom: toggle buka/tutup, hanya satu terbuka, tutup saat klik luar.
  document.querySelectorAll(".day-dd .day-dd-toggle").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const dd = btn.closest(".day-dd");
      const willOpen = !dd.classList.contains("open");
      document.querySelectorAll(".day-dd.open").forEach((o) => o.classList.remove("open"));
      dd.classList.toggle("open", willOpen);
      if (willOpen) {
        // Gulirkan ke hari yang sedang terpilih supaya langsung terlihat.
        const menu = dd.querySelector(".day-dd-menu");
        const sel = menu.querySelector(".day-dd-option.selected");
        if (sel) menu.scrollTop = Math.max(0, sel.offsetTop - menu.clientHeight / 2);
      }
    });
  });
  document.addEventListener("click", () => {
    document.querySelectorAll(".day-dd.open").forEach((o) => o.classList.remove("open"));
  });
  document.getElementById("filterModal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeFilterModal();
  });

  /* ================= Month navigation ================= */

  // viewDate dibagi antara Dashboard, Transaksi, & Rencana — ganti bulan
  // di satu halaman ikut mengubah data di halaman lain.
  function changeMonth(delta) {
    viewDate.setMonth(viewDate.getMonth() + delta);
    // Rentang tanggal terikat ke bulan tertentu → reset saat pindah bulan.
    filterStartDate = "";
    filterEndDate = "";
    updateFilterButton();
    renderAll();
  }

  ["prevMonth", "prevMonthTx"].forEach((id) => {
    document.getElementById(id).addEventListener("click", () => changeMonth(-1));
  });
  ["nextMonth", "nextMonthTx"].forEach((id) => {
    document.getElementById(id).addEventListener("click", () => changeMonth(1));
  });

  /* ================= Bottom nav / links ================= */

  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      goToPage(el.dataset.nav);
    });
  });

  /* ================= Settings ================= */

  document.getElementById("themeToggle").addEventListener("click", toggleTheme);
  document.getElementById("settingsThemeToggle").addEventListener("click", toggleTheme);

  /* ================= Multi-user (Iyon / Ciwul / Both) ================= */

  const userSelectOverlay = document.getElementById("userSelectOverlay");
  const userSwitchModal = document.getElementById("userSwitchModal");

  // Render 3 tombol Iyon/Ciwul/Both ke sebuah container — dipakai ulang utk
  // overlay pilih user pertama kali & modal ganti user di Pengaturan.
  function renderUserButtons(container, onSelect) {
    container.innerHTML = "";
    ["iyon", "ciwul", "both"].forEach((id) => {
      const user = USERS[id];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "user-select-btn" + (currentUser === id ? " active" : "");
      btn.innerHTML = `<img src="${user.icon}" alt="${user.label}"><span>${user.label}</span>`;
      btn.addEventListener("click", () => onSelect(id));
      container.appendChild(btn);
    });
  }

  // Update semua indikator visual user aktif: deskripsi di Pengaturan, ikon
  // kecil di header, dan ikon tombol "Ganti" (yang sekarang pakai foto user
  // aktif, bukan ikon generik) — supaya ketiganya selalu sinkron tiap ganti user.
  function updateActiveUserDesc() {
    const desc = document.getElementById("activeUserDesc");
    if (desc) desc.textContent = currentUser ? USERS[currentUser].label : "Belum dipilih";

    const user = currentUser ? USERS[currentUser] : null;
    [document.getElementById("headerUserIcon"), document.getElementById("switchUserBtnIcon")].forEach((img) => {
      if (!img) return;
      if (user) {
        img.src = user.icon;
        img.alt = user.label;
        img.hidden = false;
      } else {
        img.hidden = true;
      }
    });

    const switchBtn = document.getElementById("switchUserBtn");
    if (switchBtn) switchBtn.title = user ? "Ganti pengguna (aktif: " + user.label + ")" : "Ganti pengguna";
  }

  function setCurrentUser(id) {
    currentUser = id;
    localStorage.setItem(STORAGE_KEYS.user, id);
    userSelectOverlay.classList.remove("open");
    userSwitchModal.classList.remove("open");
    updateActiveUserDesc();
    renderAll();
    maybeOfferStart(); // pilih user pertama kali / user lain belum ditawari
  }

  // Tampilkan overlay pilih user kalau localStorage belum punya pilihan
  // (pertama kali buka app / storage-nya dibersihkan).
  function initUserSelect() {
    renderUserButtons(document.getElementById("userSelectOptions"), setCurrentUser);
    renderUserButtons(document.getElementById("userSwitchOptions"), setCurrentUser);
    updateActiveUserDesc();
    if (!currentUser) userSelectOverlay.classList.add("open");
  }

  document.getElementById("switchUserBtn").addEventListener("click", () => {
    renderUserButtons(document.getElementById("userSwitchOptions"), setCurrentUser);
    userSwitchModal.classList.add("open");
  });
  // Ikon pengguna aktif di header — pintasan yg sama persis dgn switchUserBtn
  // di Pengaturan, biar ganti pengguna gak perlu buka halaman Pengaturan dulu.
  document.getElementById("headerUserIcon").addEventListener("click", () => {
    renderUserButtons(document.getElementById("userSwitchOptions"), setCurrentUser);
    userSwitchModal.classList.add("open");
  });
  document.getElementById("cancelUserSwitchBtn").addEventListener("click", () => {
    userSwitchModal.classList.remove("open");
  });
  userSwitchModal.addEventListener("click", (e) => {
    if (e.target === userSwitchModal) userSwitchModal.classList.remove("open");
  });

  // Info "Dibuat oleh" (mode Both) — popup read-only, reuse gaya confirm-dialog.
  const creatorInfoModal = document.getElementById("creatorInfoModal");

  function openCreatorInfo(by) {
    const user = USERS[by] || { label: by, icon: "" };
    const iconEl = document.getElementById("creatorInfoIcon");
    iconEl.innerHTML = user.icon
      ? `<img src="${user.icon}" alt="${user.label}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">`
      : "👤";
    document.getElementById("creatorInfoText").textContent = "Dibuat oleh: " + user.label;
    creatorInfoModal.classList.add("open");
  }

  document.getElementById("closeCreatorInfoBtn").addEventListener("click", () => {
    creatorInfoModal.classList.remove("open");
  });
  creatorInfoModal.addEventListener("click", (e) => {
    if (e.target === creatorInfoModal) creatorInfoModal.classList.remove("open");
  });

  /* ================= Category list modal ================= */

  const categoriesModal = document.getElementById("categoriesModal");

  // Kategori bawaan "Lainnya" (id tetap "lainnya-keluar"/"lainnya-masuk" dari
  // DEFAULT_CATEGORIES, labelnya bebas diubah user mis. jadi "Lainnya
  // (Pengeluaran)") — dicek by id, bukan label, supaya tidak lepas kalau
  // labelnya di-custom. Sengaja tidak boleh di-edit/dihapus dari popup ini.
  function isLainnyaCategory(cat) {
    return cat.id === "lainnya-keluar" || cat.id === "lainnya-masuk";
  }

  // Satu baris kategori: swatch warna (dari colorSlot kategori itu sendiri,
  // expense & income sama-sama punya) + ikon + label + id + tombol edit/hapus
  // (disembunyikan khusus utk kategori "Lainnya").
  function categoryRowHtml(type, cat) {
    const slot = Number(cat.colorSlot) || 1;
    const actions = isLainnyaCategory(cat)
      ? ""
      : `
        <div class="category-actions">
          <button class="cat-btn cat-edit" data-type="${type}" data-id="${escapeHtml(cat.id)}" aria-label="Edit">✏️</button>
          <button class="cat-btn cat-delete" data-type="${type}" data-id="${escapeHtml(cat.id)}" aria-label="Hapus">🗑️</button>
        </div>
      `;
    return `
      <div class="category-row">
        <span class="category-swatch" style="background:var(--series-${slot})"></span>
        <span class="category-row-icon">${cat.icon}</span>
        <div class="category-row-text">
          <p class="category-row-label">${escapeHtml(cat.label)}</p>
          <p class="category-row-id">${escapeHtml(cat.id)}</p>
        </div>
        ${actions}
      </div>
    `;
  }

  // Urutan tampil popup Kategori: A-Z by label, biar gampang dicari user
  // saat scroll — kecuali label "Lainnya" selalu didorong ke paling akhir.
  // (Tidak mengubah urutan CATEGORIES sendiri — itu tetap by colorSlot,
  // dipakai dropdown/statistik supaya warna & urutan tampil di sana stabil.)
  function sortCategoriesForModal(list) {
    return list.slice().sort((a, b) => {
      const aLast = isLainnyaCategory(a);
      const bLast = isLainnyaCategory(b);
      if (aLast !== bLast) return aLast ? 1 : -1;
      return a.label.localeCompare(b.label, "id");
    });
  }

  function renderCategoriesModal() {
    document.getElementById("categoriesExpenseList").innerHTML = sortCategoriesForModal(CATEGORIES.expense)
      .map((cat) => categoryRowHtml("expense", cat))
      .join("");
    document.getElementById("categoriesIncomeList").innerHTML = sortCategoriesForModal(CATEGORIES.income)
      .map((cat) => categoryRowHtml("income", cat))
      .join("");

    categoriesModal.querySelectorAll(".cat-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cat = CATEGORIES[btn.dataset.type].find((c) => c.id === btn.dataset.id);
        if (cat) openEditCategoryModal(btn.dataset.type, cat);
      });
    });
    categoriesModal.querySelectorAll(".cat-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cat = CATEGORIES[btn.dataset.type].find((c) => c.id === btn.dataset.id);
        if (cat) openDeleteCategoryConfirm(btn.dataset.type, cat);
      });
    });
  }

  function openCategoriesModal() {
    renderCategoriesModal();
    categoriesModal.classList.add("open");
  }

  function closeCategoriesModal() {
    categoriesModal.classList.remove("open");
  }

  document.getElementById("categoriesBtn").addEventListener("click", openCategoriesModal);
  document.getElementById("cancelCategoriesBtn").addEventListener("click", closeCategoriesModal);
  categoriesModal.addEventListener("click", (e) => {
    if (e.target === categoriesModal) closeCategoriesModal();
  });

  /* ================= Category form modal (create/edit) ================= */

  const SERIES_SLOT_COUNT = 10; // jumlah slot warna --series-1..10 di css/base.css

  const categoryModal = document.getElementById("categoryModal");
  const categoryForm = document.getElementById("categoryForm");
  const categoryIdInput = document.getElementById("categoryIdInput");
  const categoryLabelInput = document.getElementById("categoryLabelInput");
  const categoryIconInput = document.getElementById("categoryIconInput");
  const categorySlotPicker = document.getElementById("categorySlotPicker");

  let editingCategory = null;  // { type, cat } saat edit; null saat create
  let categoryFormType = "expense"; // tipe kategori yang sedang dibuat/diedit
  let selectedSlot = 1;

  // Bentuk id dari label: lowercase, spasi → "-", buang selain huruf/angka/-.
  function slugifyCategoryId(label) {
    return String(label)
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  // Id sudah dipakai kategori lain di tipe ini, atau bentrok id reserved
  // "semua" milik ALL_CATEGORY?
  function isCategoryIdTaken(type, id) {
    return id === ALL_CATEGORY.id || CATEGORIES[type].some((c) => c.id === id);
  }

  // Ambil grapheme pertama — emoji bisa terdiri dari beberapa code unit
  // (ZWJ/varian), jadi tidak bisa pakai maxlength/slice biasa.
  function firstGrapheme(str) {
    const s = String(str).trim();
    if (!s) return "";
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      const it = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)[Symbol.iterator]();
      const first = it.next();
      return first.done ? "" : first.value.segment;
    }
    return Array.from(s)[0] || ""; // fallback: per code point
  }

  function renderSlotPicker() {
    categorySlotPicker.innerHTML = "";
    for (let slot = 1; slot <= SERIES_SLOT_COUNT; slot++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slot-option" + (slot === selectedSlot ? " selected" : "");
      btn.style.background = "var(--series-" + slot + ")";
      btn.setAttribute("aria-label", "Warna " + slot);
      btn.addEventListener("click", () => {
        selectedSlot = slot;
        categorySlotPicker.querySelectorAll(".slot-option").forEach((o, i) => o.classList.toggle("selected", i + 1 === slot));
      });
      categorySlotPicker.appendChild(btn);
    }
  }

  function openCreateCategoryModal(type) {
    editingCategory = null;
    categoryFormType = type;
    document.getElementById("categoryModalTitle").textContent =
      "Tambah Kategori " + (type === "expense" ? "Pengeluaran" : "Pemasukan");
    categoryForm.reset();
    categoryIdInput.disabled = false; // id bebas diisi manual saat create
    categoryIdInput.value = "";
    selectedSlot = 1;
    renderSlotPicker();
    categoryModal.classList.add("open");
  }

  function openEditCategoryModal(type, cat) {
    editingCategory = { type, cat };
    categoryFormType = type;
    document.getElementById("categoryModalTitle").textContent = "Edit Kategori";
    categoryForm.reset();
    categoryIdInput.disabled = true; // id dikunci saat edit
    categoryIdInput.value = cat.id;
    categoryLabelInput.value = cat.label;
    categoryIconInput.value = cat.icon;
    selectedSlot = Number(cat.colorSlot) || 1;
    renderSlotPicker();
    categoryModal.classList.add("open");
  }

  function closeCategoryModal() {
    categoryModal.classList.remove("open");
    editingCategory = null;
  }

  // Icon dibatasi 1 grapheme, dipangkas realtime saat mengetik/paste.
  categoryIconInput.addEventListener("input", () => {
    const g = firstGrapheme(categoryIconInput.value);
    if (categoryIconInput.value !== g) categoryIconInput.value = g;
  });

  categoryForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const label = categoryLabelInput.value.trim();
    const icon = firstGrapheme(categoryIconInput.value);
    if (!label || !icon) return;

    let id;
    if (editingCategory) {
      id = editingCategory.cat.id; // id lama, tidak pernah ikut form
    } else {
      id = slugifyCategoryId(categoryIdInput.value);
      if (!id) {
        alert("ID kategori tidak boleh kosong.");
        return;
      }
      if (isCategoryIdTaken(categoryFormType, id)) {
        alert('ID "' + id + '" sudah dipakai, pilih ID lain.');
        return;
      }
    }

    saveCategory(categoryFormType, { id, label, icon, colorSlot: selectedSlot }).catch((err) => {
      console.error("Gagal menyimpan kategori:", err);
      alert("Gagal menyimpan kategori. Cek koneksi internet.");
    });
    closeCategoryModal();
  });

  document.getElementById("addExpenseCategoryBtn").addEventListener("click", () => openCreateCategoryModal("expense"));
  document.getElementById("addIncomeCategoryBtn").addEventListener("click", () => openCreateCategoryModal("income"));
  document.getElementById("cancelCategoryBtn").addEventListener("click", closeCategoryModal);
  categoryModal.addEventListener("click", (e) => {
    if (e.target === categoryModal) closeCategoryModal();
  });

  /* ================= Export Excel ================= */

  // UI + penyiapan data ada di sini (butuh state internal IIFE); pembuatan
  // file .xlsx didelegasikan ke window.FinanceExcel (generate-excel.js).

  const exportModal = document.getElementById("exportModal");
  const monthPickerModal = document.getElementById("monthPickerModal");

  function openExportModal() {
    exportModal.classList.add("open");
  }
  function closeExportModal() {
    exportModal.classList.remove("open");
  }
  function closeMonthPicker() {
    monthPickerModal.classList.remove("open");
  }

  function monthLabel(date) {
    return MONTH_NAMES[date.getMonth()] + " " + date.getFullYear();
  }

  function monthLabelFromYm(ym) {
    const p = ym.split("-");
    return monthLabel(new Date(Number(p[0]), Number(p[1]) - 1, 1));
  }

  function excelReady() {
    if (window.FinanceExcel && FinanceExcel.available()) return true;
    alert("Gagal memuat modul Excel. Cek koneksi internet.");
    return false;
  }

  // Buka popup pilih bulan (daftar bulan yang punya transaksi, terbaru dulu).
  function openMonthPicker() {
    if (!excelReady()) return;
    const yms = Array.from(new Set(visibleTransactions().map((t) => t.ym))).sort().reverse();
    if (yms.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }
    const list = document.getElementById("monthPickerList");
    list.innerHTML = "";
    yms.forEach((ym) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "export-option";
      btn.innerHTML =
        '<span class="export-option-icon">🗓️</span>' +
        '<span><span class="export-option-title">' + monthLabelFromYm(ym) + "</span></span>";
      btn.addEventListener("click", () => exportTransactionsForYm(ym));
      list.appendChild(btn);
    });
    closeExportModal();
    monthPickerModal.classList.add("open");
  }

  function exportTransactionsForYm(ym) {
    if (!excelReady()) return;
    const monthTx = visibleTransactions()
      .filter((t) => t.ym === ym)
      .sort(compareTxMoment);
    if (monthTx.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }
    // Kolom & pemecahan baris sama persis dgn export desktop: nota → 1 baris per
    // item (kolom Nota = judul) + 1 baris gabungan penyesuaian; biaya admin pindah
    // → baris Pengeluaran tepat di bawah pindahnya.
    const categoryLabel = (type, id) => findCategory(type, id).label + (type === "income" ? " (masuk)" : " (keluar)");
    const rows = [];
    const push = (t, nota, account, tipe, kategori, nominal, catatan) =>
      rows.push({
        Kode: t.kode || "",
        Nota: nota,
        Tanggal: t.date,
        Waktu: t.time,
        "Account Type": account,
        Tipe: tipe,
        Kategori: kategori,
        Nominal: nominal,
        Catatan: catatan,
        "Dibuat oleh": USERS[t.by] ? USERS[t.by].label : t.by,
      });
    monthTx.forEach((t) => {
      if (t.type === "transfer") {
        push(t, "", t.dari + " → " + t.ke, TYPE_LABELS.transfer, "", t.amount, (t.note || "Pindah " + transferRoute(t)) + (t.fee ? " (biaya admin " + t.fee + ")" : ""));
        if (t.fee > 0) push(t, "", t.dari, TYPE_LABELS.expense, categoryLabel("expense", Core.TRANSFER_FEE_CATEGORY), t.fee, "Biaya Admin");
      } else if (t.bentuk === "nota" && t.items.length) {
        t.items.forEach((it) =>
          push(t, t.title, t.account_type || "", TYPE_LABELS[t.type], categoryLabel(t.type, it.category), Number(it.subtotal) || 0,
            it.nama + " · " + [formatQty(it.qty), it.satuan].filter(Boolean).join(" ") + " × " + (Number(it.harga) || 0).toLocaleString("id-ID"))
        );
        if (t.penyesuaian.length) {
          const adj = t.penyesuaian.map((p) => p.label + " " + (p.efek === "tambah" ? "+" : "−") + (Number(p.jumlah) || 0).toLocaleString("id-ID"));
          push(t, t.title, t.account_type || "", TYPE_LABELS[t.type], "", t.totalAdjust, "Penyesuaian: " + adj.join(", "));
        }
      } else {
        push(t, t.bentuk === "nota" ? t.title : "", t.account_type || "", TYPE_LABELS[t.type], categoryLabel(t.type, t.category), t.amount, t.note || "");
      }
    });
    FinanceExcel.download("transaksi-" + ym + ".xlsx", "Transaksi " + monthLabelFromYm(ym), rows);
    closeMonthPicker();
  }

  function exportMonthlySummary() {
    if (!excelReady()) return;
    const scoped = visibleTransactions();
    if (scoped.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }
    // Kelompokkan total income/expense per bulan (ym = "YYYY-MM").
    const byMonth = {};
    // Pindah bukan pemasukan/pengeluaran (kecuali biaya admin) — Core.flowOf.
    scoped.forEach((t) => {
      if (!byMonth[t.ym]) byMonth[t.ym] = { income: 0, expense: 0 };
      const f = Core.flowOf(t);
      byMonth[t.ym].income += f.income;
      byMonth[t.ym].expense += f.expense;
    });
    const rows = Object.keys(byMonth)
      .sort() // "YYYY-MM" → urut kronologis
      .map((ym) => {
        const parts = ym.split("-");
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
        const inc = byMonth[ym].income;
        const exp = byMonth[ym].expense;
        return { Bulan: monthLabel(d), Pemasukan: inc, Pengeluaran: exp, Saldo: inc - exp };
      });
    FinanceExcel.download("ringkasan-per-bulan.xlsx", "Ringkasan", rows);
    closeExportModal();
  }

  document.getElementById("exportBtn").addEventListener("click", openExportModal);
  document.getElementById("cancelExportBtn").addEventListener("click", closeExportModal);
  document.getElementById("exportTransactionsBtn").addEventListener("click", openMonthPicker);
  document.getElementById("exportSummaryBtn").addEventListener("click", exportMonthlySummary);
  document.getElementById("cancelMonthPickerBtn").addEventListener("click", closeMonthPicker);
  exportModal.addEventListener("click", (e) => {
    if (e.target === exportModal) closeExportModal();
  });
  monthPickerModal.addEventListener("click", (e) => {
    if (e.target === monthPickerModal) closeMonthPicker();
  });

  /* ================= Saldo start bulan baru ================= */

  // Saat app dibuka: kalau user belum punya transaksi di bulan kalender berjalan
  // (bukan bulan yang sedang dilihat) tapi saldo akhir bulan lalu per account
  // > 0, tawarkan mencatatnya sbg pemasukan Lainnya "Saldo start bulan ini"
  // tgl 1 jam 00:00:00 (satu transaksi per account). Per user; mode Both →
  // Iyon & Ciwul sekaligus. Lewati → ditawarkan lagi saat app dibuka lagi.
  // Aturan sama dgn web desktop (hitungan saldo = Core.accountBalances).
  const START_NOTE = "Saldo start bulan ini";
  const START_CATEGORY = "lainnya-masuk";
  const startModal = document.getElementById("startModal");
  const startOffered = new Set(); // user yang sudah ditawari di page load ini
  let startOffer = null; // { tanggal, groups: [{ by, accounts: [{ id, amount }] }] }
  let startSaving = false;

  function startOfferFor(by, ym, prevYm) {
    const mine = transactions.filter((t) => t.by === by);
    if (mine.some((t) => t.date.slice(0, 7) === ym)) return null;
    const bal = Core.accountBalances(mine.filter((t) => t.date.slice(0, 7) === prevYm));
    const accounts = ACCOUNTS.filter((a) => bal[a.id] > 0).map((a) => ({ id: a.id, amount: bal[a.id] }));
    return accounts.length ? { by, accounts } : null;
  }

  function maybeOfferStart() {
    if (!loadingHidden || !currentUser || startSaving) return;
    const now = new Date();
    const ym = now.getFullYear() + "-" + pad2(now.getMonth() + 1);
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYm = prev.getFullYear() + "-" + pad2(prev.getMonth() + 1);
    const users = (currentUser === "both" ? ["iyon", "ciwul"] : [currentUser]).filter((u) => !startOffered.has(u));
    users.forEach((u) => startOffered.add(u));
    const groups = users.map((u) => startOfferFor(u, ym, prevYm)).filter(Boolean);
    if (!groups.length) return;

    startOffer = { tanggal: ym + "-01", groups };
    const month = MONTH_NAMES[now.getMonth()];
    document.getElementById("startTitle").textContent = "Start Bulan " + month;
    document.getElementById("startIntro").textContent = "Bulan ini belum ada transaksi, tapi masih ada sisa saldo " + MONTH_NAMES[prev.getMonth()] + " " + prev.getFullYear() +
      ". Mulai " + month + " dari saldo ini? Angka bisa disesuaikan (kosongkan = tidak dicatat).";
    document.getElementById("startNote").textContent = "Dicatat sebagai pemasukan Lainnya \"" + START_NOTE + "\", tanggal 1 " + month + " jam 00:00:00.";
    document.getElementById("startGroups").innerHTML = groups
      .map((g, gi) => `
        <div class="start-group">
          ${currentUser === "both" ? `<div class="start-user"><img src="${USERS[g.by].icon}" alt="">${USERS[g.by].label}</div>` : ""}
          ${g.accounts
            .map((a, ai) => {
              const acct = ACCOUNT_BY_ID[a.id];
              return `<label class="start-row"><span>${acct.icon} ${acct.label}</span>
                <input type="text" inputmode="numeric" data-g="${gi}" data-a="${ai}" value="${a.amount.toLocaleString("id-ID")}" aria-label="Saldo start ${acct.label} ${USERS[g.by].label}"></label>`;
            })
            .join("")}
        </div>`)
      .join("");
    document.querySelectorAll("#startGroups input").forEach((inp) => inp.addEventListener("input", () => formatAmountInput(inp)));
    startModal.classList.add("open");
  }

  const closeStart = () => startModal.classList.remove("open");
  document.getElementById("startSkipBtn").addEventListener("click", closeStart);

  document.getElementById("startForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!startOffer || startSaving) return;
    const records = [];
    document.querySelectorAll("#startGroups input").forEach((inp) => {
      const g = startOffer.groups[Number(inp.dataset.g)];
      const a = g.accounts[Number(inp.dataset.a)];
      const nominal = parseAmount(inp.value);
      if (!(nominal > 0)) return;
      const built = Core.buildSatuan({
        type: "income", account_type: a.id, category: START_CATEGORY, nominal, catatan: START_NOTE,
        by: g.by, tanggal: startOffer.tanggal, waktu: "00:00:00", timestamp: Date.now(),
      });
      if (!built.errors.length) records.push(built.record);
    });
    if (!records.length) {
      closeStart();
      return;
    }
    if (!requireOnline()) return;
    startSaving = true;
    const btn = document.getElementById("startSaveBtn");
    btn.disabled = true;
    // Berurutan supaya nomor kode ikut urutan baris.
    records
      .reduce((p, rec) => p.then(() => Data.saveNew(rec)), Promise.resolve())
      .then(closeStart)
      .catch((err) => {
        console.error("Gagal mencatat saldo start:", err);
        alert("Gagal mencatat saldo start: " + err.message);
      })
      .finally(() => {
        startSaving = false;
        btn.disabled = false;
      });
  });

  /* ================= Init ================= */

  initTheme();
  initUserSelect();        // tampilkan overlay pilih user kalau belum pernah pilih
  updateBalanceToggleIcon();
  renderDashboard();       // render awal (masih kosong sampai data Firebase tiba)
  subscribeFinance();      // mulai dengarkan data realtime dari /finance

  // Fallback: kalau Firebase tak merespons (mis. offline), jangan biarkan
  // user terjebak di layar loading terus-menerus.
  setTimeout(hideLoading, 10000);
})();
