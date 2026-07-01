/* =========================================================
   Finance App — script.js
   Data transaksi & rencana disimpan di Firebase Realtime DB
   di bawah path /finance (lihat firebaseConfig di index.html).

   Struktur data:
     finance/
       <YYYY-MM>/
         <DD>/
           <timestamp>/ { transaksi, category, nominal, catatan, tanggal, timestamp }
       plans/
         <category>/ { category, limit }

   Preferensi tema tetap disimpan lokal (localStorage).
   ========================================================= */

(function () {
  "use strict";

  /* ---------------- Storage keys (lokal, hanya untuk tema) ---------------- */
  const STORAGE_KEYS = {
    theme: "financeapp_theme",
  };

  /* ---------------- Categories ---------------- */
  const CATEGORIES = {
    expense: [
      { id: "makanan", label: "Makanan", icon: "🍔" },
      { id: "transportasi", label: "Transportasi", icon: "🚗" },
      { id: "belanja", label: "Belanja", icon: "🛍️" },
      { id: "tagihan", label: "Tagihan", icon: "🧾" },
      { id: "hiburan", label: "Hiburan", icon: "🎮" },
      { id: "kesehatan", label: "Kesehatan", icon: "💊" },
      { id: "pendidikan", label: "Pendidikan", icon: "📚" },
      { id: "lainnya-keluar", label: "Lainnya", icon: "📦" },
    ],
    income: [
      { id: "gaji", label: "Gaji", icon: "💼" },
      { id: "bonus", label: "Bonus", icon: "🎁" },
      { id: "investasi", label: "Investasi", icon: "📈" },
      { id: "lainnya-masuk", label: "Lainnya", icon: "💵" },
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
  let currentPeriod = "bulanan"; // tab periode aktif di halaman Rencana

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

  /* ================= Firebase data layer ================= */

  const financeRef = db.ref(FINANCE_PATH);

  // Konversi tipe internal <-> label transaksi di Firebase.
  const TYPE_TO_FS = { income: "pemasukan", expense: "pengeluaran" };
  const FS_TO_TYPE = { pemasukan: "income", pengeluaran: "expense" };

  // Pecah "YYYY-MM-DD" jadi { ym: "YYYY-MM", dd: "DD" } untuk path Firebase.
  function pathParts(dateStr) {
    const parts = String(dateStr).split("-");
    return { ym: parts[0] + "-" + parts[1], dd: parts[2] };
  }

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

  // Dengarkan seluruh subtree /finance secara realtime.
  function subscribeFinance() {
    financeRef.on(
      "value",
      (snapshot) => {
        const root = snapshot.val() || {};
        migrateLegacyPlans(root);
        rebuildFromSnapshot(root);
        renderAll();
        hideLoading(); // data pertama sudah tiba
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
            // Bentuk baru: plans/<periode>/<category>/{ limit, sort }
            const periodObj = plansObj[key] || {};
            Object.keys(periodObj).forEach((cat) => {
              const p = periodObj[cat] || {};
              pl.push({ id: key + "_" + cat, period: key, category: cat, limit: Number(p.limit) || 0, sort: Number(p.sort) || 0 });
            });
          } else {
            // Bentuk lama: plans/<category>/{ limit } → diperlakukan sebagai bulanan
            // (di-migrasi ke bentuk baru oleh migrateLegacyPlans()).
            const p = plansObj[key] || {};
            pl.push({ id: "bulanan_" + key, period: "bulanan", category: key, limit: Number(p.limit) || 0, sort: Number(p.sort) || 0 });
          }
        });
      } else if (/^\d{4}-\d{2}$/.test(topKey)) {
        const monthObj = root[topKey] || {};
        Object.keys(monthObj).forEach((dd) => {
          const dayObj = monthObj[dd] || {};
          Object.keys(dayObj).forEach((ts) => {
            const t = dayObj[ts] || {};
            txs.push({
              id: ts,
              ym: topKey,
              day: dd,
              type: FS_TO_TYPE[t.transaksi] || "expense",
              amount: Number(t.nominal) || 0,
              category: t.category,
              note: t.catatan || "",
              date: t.tanggal || topKey + "-" + dd,
            });
          });
        });
      }
    });

    transactions = txs;
    plans = pl;
  }

  // ---- Operasi tulis ----

  function addTransaction(data) {
    const { ym, dd } = pathParts(data.date);
    const ts = Date.now();
    return db.ref(FINANCE_PATH + "/" + ym + "/" + dd + "/" + ts).set({
      transaksi: TYPE_TO_FS[data.type],
      category: data.category,
      nominal: data.amount,
      catatan: data.note || "",
      tanggal: data.date,
      timestamp: ts,
    });
  }

  // Ubah transaksi yang sudah ada. Saat edit HANYA nominal & catatan yang bisa
  // berubah; tipe, kategori, dan tanggal (timestamp/path) dipertahankan apa
  // adanya dari transaksi lama. Jadi node ditulis ulang di path yang sama —
  // timestamp A tetap A, tidak ada pemindahan node.
  function updateTransaction(oldTx, data) {
    const path = FINANCE_PATH + "/" + oldTx.ym + "/" + oldTx.day + "/" + oldTx.id;
    return db.ref(path).set({
      transaksi: TYPE_TO_FS[oldTx.type],
      category: oldTx.category,
      nominal: data.amount,
      catatan: data.note || "",
      tanggal: oldTx.date,
      timestamp: Number(oldTx.id) || Date.now(),
    });
  }

  function deleteTransaction(tx) {
    return db.ref(FINANCE_PATH + "/" + tx.ym + "/" + tx.day + "/" + tx.id).remove();
  }

  function savePlan(period, category, limit, sort) {
    return db.ref(FINANCE_PATH + "/plans/" + period + "/" + category).set({
      category: category,
      limit: limit,
      sort: sort || 0,
    });
  }

  // Nilai sort untuk rencana baru: paling akhir pada periodenya.
  function nextSortForPeriod(period) {
    const inPeriod = plans.filter((p) => p.period === period);
    return inPeriod.length ? Math.max.apply(null, inPeriod.map((p) => p.sort)) + 1 : 0;
  }

  function deletePlan(period, category) {
    return db.ref(FINANCE_PATH + "/plans/" + period + "/" + category).remove();
  }

  function renderAll() {
    renderDashboard();
    renderAllTransactions();
    renderPlans();
  }

  /* ================= Utilities ================= */

  function formatCurrency(value) {
    return "Rp " + Math.round(value).toLocaleString("id-ID");
  }

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

  // Jam saat transaksi dibuat (dari timestamp). withSeconds → sampai detik.
  function formatTime(ms, withSeconds) {
    const d = new Date(ms);
    let s = pad2(d.getHours()) + ":" + pad2(d.getMinutes());
    if (withSeconds) s += ":" + pad2(d.getSeconds());
    return s;
  }

  // Waktu pembuatan transaksi dalam ms (untuk sorting "paling baru").
  function txTime(tx) {
    return Number(tx.id) || Number(tx.timestamp) || new Date(tx.date).getTime();
  }

  function findCategory(type, id) {
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

    const monthTx = transactions.filter((t) => isSameMonth(t.date, viewDate));
    const totalIncome = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const totalExpense = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const balance = totalIncome - totalExpense;

    document.getElementById("balanceAmount").textContent = formatCurrency(balance);
    document.getElementById("totalIncome").textContent = formatCurrency(totalIncome);
    document.getElementById("totalExpense").textContent = formatCurrency(totalExpense);

    const total = totalIncome + totalExpense;
    const incomePct = total > 0 ? (totalIncome / total) * 100 : 50;
    const expensePct = total > 0 ? (totalExpense / total) * 100 : 50;
    document.getElementById("barIncome").style.width = incomePct + "%";
    document.getElementById("barExpense").style.width = expensePct + "%";

    const recent = monthTx
      .slice()
      .sort((a, b) => txTime(b) - txTime(a)) // paling baru (jam) di atas
      .slice(0, 3);
    renderTransactionList(document.getElementById("recentTransactions"), recent, "Belum ada transaksi bulan ini.");
  }

  function renderAllTransactions() {
    document.getElementById("currentMonthLabelTx").textContent =
      MONTH_NAMES[viewDate.getMonth()] + " " + viewDate.getFullYear();

    let list = transactions
      .filter((t) => isSameMonth(t.date, viewDate))
      .sort((a, b) => {
        const byDate = new Date(b.date) - new Date(a.date);
        return byDate !== 0 ? byDate : txTime(b) - txTime(a);
      });
    if (currentFilter !== "all") {
      list = list.filter((t) => t.type === currentFilter);
    }
    if (selectedCategories.length > 0) {
      list = list.filter((t) => selectedCategories.includes(t.category));
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
      const ts = txTime(tx);
      const dateText = detailed ? formatDateLong(tx.date) : formatDateShort(tx.date);
      const timeText = formatTime(ts, detailed);
      const item = document.createElement("div");
      item.className = "transaction-item";
      item.innerHTML = `
        <div class="tx-icon ${tx.type}">${cat.icon}</div>
        <div class="tx-info">
          <p class="tx-category">${cat.label}</p>
          <p class="tx-note">${tx.note ? escapeHtml(tx.note) : "&mdash;"}</p>
        </div>
        <div class="tx-right">
          <span class="tx-amount ${tx.type}">${tx.type === "income" ? "+" : "-"} ${formatCurrency(tx.amount)}</span>
          <p class="tx-date">${dateText}</p>
          <p class="tx-time">${timeText}</p>
        </div>
        <div class="tx-actions">
          <button class="tx-btn tx-edit" data-id="${tx.id}" aria-label="Edit">✏️</button>
          <button class="tx-btn tx-delete" data-id="${tx.id}" aria-label="Hapus">🗑️</button>
        </div>
      `;
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

    // Tombol "+" nonaktif (abu-abu) kalau semua kategori di periode ini sudah dipakai.
    const addBtn = document.getElementById("addPlanBtn");
    addBtn.disabled = periodIsFull(currentPeriod);

    const list = plans
      .filter((p) => p.period === currentPeriod)
      .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));

    if (list.length === 0) {
      container.innerHTML =
        '<p class="empty-state">Belum ada rencana ' + PERIOD_LABELS[currentPeriod] + '. Tambahkan untuk mulai mengatur budget kategori.</p>';
      return;
    }

    const now = new Date();

    list.forEach((plan) => {
      const cat = findCategory("expense", plan.category);
      const isAll = plan.category === ALL_CATEGORY.id;
      const spent = transactions
        .filter((t) => t.type === "expense" && (isAll || t.category === plan.category) && txInPlanPeriod(t, plan.period, now))
        .reduce((s, t) => s + t.amount, 0);

      const pct = Math.min(100, Math.round((spent / plan.limit) * 100));
      let fillClass = "";
      if (pct >= 100) fillClass = "over";
      else if (pct >= 80) fillClass = "warning";

      const card = document.createElement("div");
      card.className = "plan-card";
      card.dataset.id = plan.id;
      card.innerHTML = `
        <button class="plan-drag" data-id="${plan.id}" aria-label="Geser untuk mengubah urutan" title="Geser untuk mengubah urutan">⠿</button>
        <div class="plan-body">
          <div class="plan-top">
            <span class="plan-category">${cat.icon} ${cat.label}</span>
            <div class="plan-actions">
              <button class="plan-btn plan-edit" data-id="${plan.id}" aria-label="Edit">✏️</button>
              <button class="plan-btn plan-delete" data-id="${plan.id}" aria-label="Hapus">🗑️</button>
            </div>
          </div>
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

    container.querySelectorAll(".plan-drag").forEach((handle) => {
      handle.addEventListener("pointerdown", startPlanDrag);
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

  // Apakah semua kategori di periode ini sudah punya rencana?
  function periodIsFull(period) {
    const used = plans.filter((p) => p.period === period).map((p) => p.category);
    return planCategoryPool().every((c) => used.indexOf(c.id) !== -1);
  }

  // Disable opsi periode yang sudah penuh di dropdown modal.
  function updatePeriodOptions() {
    Array.from(planPeriodInput.options).forEach((opt) => {
      opt.disabled = periodIsFull(opt.value);
    });
  }

  // Isi dropdown kategori untuk modal Rencana. Kategori (termasuk "Semua")
  // yang sudah punya rencana di periode itu disembunyikan supaya tidak
  // duplikat. `keepCategory` dipertahankan (dipakai saat edit).
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

  function openFilterModal() {
    const list = document.getElementById("filterCategoryList");
    list.innerHTML = "";

    let cats = currentFilter === "all"
      ? [...CATEGORIES.expense, ...CATEGORIES.income]
      : CATEGORIES[currentFilter];

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

    document.getElementById("filterModal").classList.add("open");
  }

  function closeFilterModal() {
    document.getElementById("filterModal").classList.remove("open");
  }

  function applyFilter() {
    const checks = document.querySelectorAll("#filterCategoryList input[type='checkbox']:checked");
    selectedCategories = Array.from(checks).map((cb) => cb.value);
    updateFilterButton();
    closeFilterModal();
    renderAllTransactions();
  }

  function updateFilterButton() {
    const btn = document.getElementById("filterBtn");
    if (selectedCategories.length > 0) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  }

  /* ================= Transaction modal ================= */

  const transactionModal = document.getElementById("transactionModal");
  const transactionForm = document.getElementById("transactionForm");
  const transactionModalTitle = document.getElementById("transactionModalTitle");
  const categoryInput = document.getElementById("categoryInput");
  const dateInput = document.getElementById("dateInput");

  let editingTx = null; // null = mode tambah; berisi tx = mode edit

  function setTxType(type) {
    currentTxType = type;
    document.querySelectorAll(".type-btn").forEach((b) => b.classList.toggle("active", b.dataset.type === type));
    populateCategorySelect(categoryInput, type);
  }

  // Saat edit, tipe & kategori dikunci (hanya nominal + catatan yang bisa
  // diubah). Tanggal memang selalu disabled.
  function setImmutableFieldsLocked(locked) {
    categoryInput.disabled = locked;
    document.querySelectorAll(".type-btn").forEach((b) => (b.disabled = locked));
    document.querySelector(".type-toggle").classList.toggle("locked", locked);
  }

  function openTransactionModal() {
    editingTx = null;
    transactionModalTitle.textContent = "Tambah Transaksi";
    transactionForm.reset();
    setImmutableFieldsLocked(false);
    setTxType("expense");
    dateInput.value = new Date().toISOString().slice(0, 10);
    transactionModal.classList.add("open");
  }

  function openEditModal(tx) {
    editingTx = tx;
    transactionModalTitle.textContent = "Edit Transaksi";
    transactionForm.reset();
    setTxType(tx.type);
    document.getElementById("amountInput").value = Math.round(tx.amount).toLocaleString("id-ID");
    categoryInput.value = tx.category;
    document.getElementById("noteInput").value = tx.note || "";
    dateInput.value = tx.date;
    setImmutableFieldsLocked(true); // kunci tipe & kategori setelah prefill
    transactionModal.classList.add("open");
  }

  function closeTransactionModal() {
    transactionModal.classList.remove("open");
    editingTx = null;
  }

  document.querySelectorAll(".type-btn").forEach((btn) => {
    btn.addEventListener("click", () => setTxType(btn.dataset.type));
  });

  transactionForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = document.getElementById("amountInput").value.replace(/\./g, "");
    const amount = parseFloat(raw);
    if (!amount || amount <= 0) return;

    const data = {
      type: currentTxType,
      amount: amount,
      category: categoryInput.value,
      note: document.getElementById("noteInput").value.trim(),
      date: dateInput.value,
    };

    const isAdd = !editingTx;
    const op = editingTx ? updateTransaction(editingTx, data) : addTransaction(data);
    op.catch((err) => {
      console.error("Gagal menyimpan transaksi:", err);
      alert("Gagal menyimpan transaksi. Cek koneksi internet.");
    });
    closeTransactionModal();
    if (isAdd) goToPage("dashboard"); // habis tambah transaksi → ke Dashboard (edit tetap di halaman asal)
  });

  document.getElementById("cancelTransactionBtn").addEventListener("click", closeTransactionModal);
  document.getElementById("navAdd").addEventListener("click", openTransactionModal);
  document.getElementById("amountInput").addEventListener("input", function () {
    formatAmountInput(this);
  });
  document.getElementById("planLimitInput").addEventListener("input", function () {
    formatAmountInput(this);
  });

  /* ================= Delete confirmation modal ================= */

  const confirmModal = document.getElementById("confirmModal");
  const confirmTitle = document.getElementById("confirmTitle");
  const confirmText = document.getElementById("confirmText");
  let pendingDeleteTx = null;
  let pendingDeletePlan = null;

  function openDeleteConfirm(tx) {
    pendingDeleteTx = tx;
    pendingDeletePlan = null;
    confirmTitle.textContent = "Hapus Transaksi?";
    confirmText.textContent = "Apakah Anda yakin ingin menghapus transaksi ini? Tindakan ini tidak dapat dibatalkan.";
    confirmModal.classList.add("open");
  }

  function openDeletePlanConfirm(plan) {
    pendingDeletePlan = plan;
    pendingDeleteTx = null;
    confirmTitle.textContent = "Hapus Rencana?";
    confirmText.textContent = "Apakah Anda yakin ingin menghapus rencana anggaran untuk kategori ini?";
    confirmModal.classList.add("open");
  }

  function closeDeleteConfirm() {
    confirmModal.classList.remove("open");
    pendingDeleteTx = null;
    pendingDeletePlan = null;
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

  function openPlanModal() {
    editingPlan = null;
    planForm.reset();
    setPlanFieldsLocked(false);
    updatePeriodOptions(); // buramkan periode yang sudah penuh
    planPeriodInput.value = currentPeriod; // default ikut tab yang aktif
    populatePlanCategories(currentPeriod); // sembunyikan kategori yang sudah dipakai
    planModal.classList.add("open");
  }

  function openEditPlanModal(plan) {
    editingPlan = plan;
    planForm.reset();
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

    // Disimpan per periode+kategori: menyimpan kombinasi yang sama akan
    // menimpa limit lama. Sort dipertahankan kalau rencana sudah ada,
    // rencana baru ditaruh paling akhir.
    const period = planPeriodInput.value;
    const category = planCategoryInput.value;
    if (!category) return; // tidak ada kategori tersedia (semua sudah dipakai)
    const existing = plans.find((p) => p.id === period + "_" + category);
    const sort = existing ? existing.sort : nextSortForPeriod(period);
    savePlan(period, category, limit, sort).catch((err) => {
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
  document.getElementById("cancelFilterBtn").addEventListener("click", closeFilterModal);
  document.getElementById("filterModal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeFilterModal();
  });

  /* ================= Month navigation ================= */

  // viewDate dibagi antara Dashboard, Transaksi, & Rencana — ganti bulan
  // di satu halaman ikut mengubah data di halaman lain.
  function changeMonth(delta) {
    viewDate.setMonth(viewDate.getMonth() + delta);
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

  /* ================= Export Excel ================= */

  // UI + penyiapan data ada di sini (butuh state internal IIFE); pembuatan
  // file .xlsx didelegasikan ke window.FinanceExcel (generate-excel.js).

  const exportModal = document.getElementById("exportModal");

  function openExportModal() {
    exportModal.classList.add("open");
  }
  function closeExportModal() {
    exportModal.classList.remove("open");
  }

  function monthLabel(date) {
    return MONTH_NAMES[date.getMonth()] + " " + date.getFullYear();
  }

  function excelReady() {
    if (window.FinanceExcel && FinanceExcel.available()) return true;
    alert("Gagal memuat modul Excel. Cek koneksi internet.");
    return false;
  }

  function exportActiveMonthTransactions() {
    if (!excelReady()) return;
    const monthTx = transactions
      .filter((t) => isSameMonth(t.date, viewDate))
      .sort((a, b) => {
        const byDate = new Date(a.date) - new Date(b.date);
        return byDate !== 0 ? byDate : txTime(a) - txTime(b);
      });
    if (monthTx.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }
    const rows = monthTx.map((t) => ({
      Tanggal: t.date,
      Waktu: formatTime(txTime(t), true),
      Tipe: t.type === "income" ? "Pemasukan" : "Pengeluaran",
      Kategori: findCategory(t.type, t.category).label,
      Nominal: t.amount,
      Catatan: t.note || "",
    }));
    const ym = viewDate.getFullYear() + "-" + pad2(viewDate.getMonth() + 1);
    FinanceExcel.download("transaksi-" + ym + ".xlsx", "Transaksi " + monthLabel(viewDate), rows);
    closeExportModal();
  }

  function exportMonthlySummary() {
    if (!excelReady()) return;
    if (transactions.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }
    // Kelompokkan total income/expense per bulan (ym = "YYYY-MM").
    const byMonth = {};
    transactions.forEach((t) => {
      if (!byMonth[t.ym]) byMonth[t.ym] = { income: 0, expense: 0 };
      byMonth[t.ym][t.type] += t.amount;
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
  document.getElementById("exportTransactionsBtn").addEventListener("click", exportActiveMonthTransactions);
  document.getElementById("exportSummaryBtn").addEventListener("click", exportMonthlySummary);
  exportModal.addEventListener("click", (e) => {
    if (e.target === exportModal) closeExportModal();
  });

  /* ================= Init ================= */

  initTheme();
  renderDashboard();       // render awal (masih kosong sampai data Firebase tiba)
  subscribeFinance();      // mulai dengarkan data realtime dari /finance

  // Fallback: kalau Firebase tak merespons (mis. offline), jangan biarkan
  // user terjebak di layar loading terus-menerus.
  setTimeout(hideLoading, 10000);
})();
