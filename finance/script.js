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

  // Dengarkan seluruh subtree /finance secara realtime.
  function subscribeFinance() {
    financeRef.on(
      "value",
      (snapshot) => {
        rebuildFromSnapshot(snapshot.val() || {});
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
        Object.keys(plansObj).forEach((cat) => {
          const p = plansObj[cat] || {};
          pl.push({ id: cat, category: cat, limit: Number(p.limit) || 0 });
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

  // Ubah transaksi yang sudah ada. Kalau tanggalnya berubah, node-nya
  // pindah ke path bulan/hari yang baru (key/timestamp dipertahankan).
  function updateTransaction(oldTx, data) {
    const ts = Number(oldTx.id) || Date.now();
    const record = {
      transaksi: TYPE_TO_FS[data.type],
      category: data.category,
      nominal: data.amount,
      catatan: data.note || "",
      tanggal: data.date,
      timestamp: ts,
    };
    const parts = pathParts(data.date);
    const newPath = FINANCE_PATH + "/" + parts.ym + "/" + parts.dd + "/" + oldTx.id;
    const oldPath = FINANCE_PATH + "/" + oldTx.ym + "/" + oldTx.day + "/" + oldTx.id;
    if (newPath === oldPath) {
      return db.ref(newPath).set(record);
    }
    return db.ref(newPath).set(record).then(function () {
      return db.ref(oldPath).remove();
    });
  }

  function deleteTransaction(tx) {
    return db.ref(FINANCE_PATH + "/" + tx.ym + "/" + tx.day + "/" + tx.id).remove();
  }

  function savePlan(category, limit) {
    return db.ref(FINANCE_PATH + "/plans/" + category).set({
      category: category,
      limit: limit,
    });
  }

  function deletePlan(category) {
    return db.ref(FINANCE_PATH + "/plans/" + category).remove();
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
    return CATEGORIES[type].find((c) => c.id === id) || { label: id, icon: "❓" };
  }

  function isSameMonth(dateStr, ref) {
    const d = new Date(dateStr);
    return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
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

    if (plans.length === 0) {
      container.innerHTML = '<p class="empty-state">Belum ada rencana anggaran. Tambahkan untuk mulai mengatur budget kategori.</p>';
      return;
    }

    plans.forEach((plan) => {
      const cat = findCategory("expense", plan.category);
      const spent = transactions
        .filter((t) => t.type === "expense" && t.category === plan.category && isSameMonth(t.date, viewDate))
        .reduce((s, t) => s + t.amount, 0);

      const pct = Math.min(100, Math.round((spent / plan.limit) * 100));
      let fillClass = "";
      if (pct >= 100) fillClass = "over";
      else if (pct >= 80) fillClass = "warning";

      const card = document.createElement("div");
      card.className = "plan-card";
      card.innerHTML = `
        <div class="plan-top">
          <span class="plan-category">${cat.icon} ${cat.label}</span>
          <button class="plan-delete" data-id="${plan.id}">Hapus</button>
        </div>
        <div class="plan-progress-track">
          <div class="plan-progress-fill ${fillClass}" style="width:${pct}%"></div>
        </div>
        <div class="plan-footer">
          <span class="plan-amounts">${formatCurrency(spent)} / ${formatCurrency(plan.limit)}</span>
          <span class="plan-percent">${pct}%</span>
        </div>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll(".plan-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        deletePlan(btn.dataset.id); // render diperbarui otomatis oleh listener
      });
    });
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

  function openTransactionModal() {
    editingTx = null;
    transactionModalTitle.textContent = "Tambah Transaksi";
    transactionForm.reset();
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

    const op = editingTx ? updateTransaction(editingTx, data) : addTransaction(data);
    op.catch((err) => {
      console.error("Gagal menyimpan transaksi:", err);
      alert("Gagal menyimpan transaksi. Cek koneksi internet.");
    });
    closeTransactionModal();
  });

  document.getElementById("cancelTransactionBtn").addEventListener("click", closeTransactionModal);
  document.getElementById("fabAdd").addEventListener("click", openTransactionModal);
  document.getElementById("amountInput").addEventListener("input", function () {
    formatAmountInput(this);
  });
  document.getElementById("planLimitInput").addEventListener("input", function () {
    formatAmountInput(this);
  });

  /* ================= Delete confirmation modal ================= */

  const confirmModal = document.getElementById("confirmModal");
  let pendingDeleteTx = null;

  function openDeleteConfirm(tx) {
    pendingDeleteTx = tx;
    confirmModal.classList.add("open");
  }

  function closeDeleteConfirm() {
    confirmModal.classList.remove("open");
    pendingDeleteTx = null;
  }

  document.getElementById("cancelDeleteBtn").addEventListener("click", closeDeleteConfirm);

  document.getElementById("confirmDeleteBtn").addEventListener("click", () => {
    if (pendingDeleteTx) {
      deleteTransaction(pendingDeleteTx).catch((err) => {
        console.error("Gagal menghapus transaksi:", err);
        alert("Gagal menghapus transaksi. Cek koneksi internet.");
      });
    }
    closeDeleteConfirm();
  });

  /* ================= Plan modal ================= */

  const planModal = document.getElementById("planModal");
  const planForm = document.getElementById("planForm");
  const planCategoryInput = document.getElementById("planCategoryInput");

  function openPlanModal() {
    populateCategorySelect(planCategoryInput, "expense");
    planForm.reset();
    planModal.classList.add("open");
  }

  function closePlanModal() {
    planModal.classList.remove("open");
  }

  planForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const rawLimit = document.getElementById("planLimitInput").value.replace(/\./g, "");
    const limit = parseFloat(rawLimit);
    if (!limit || limit <= 0) return;

    // Disimpan per-kategori: menambah kategori yang sama akan menimpa limit lama.
    savePlan(planCategoryInput.value, limit).catch((err) => {
      console.error("Gagal menyimpan rencana:", err);
      alert("Gagal menyimpan rencana. Cek koneksi internet.");
    });
    closePlanModal();
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

  document.querySelectorAll(".filter-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      currentFilter = tab.dataset.filter;
      document.querySelectorAll(".filter-tab").forEach((t) => t.classList.toggle("active", t === tab));
      selectedCategories = [];
      updateFilterButton();
      renderAllTransactions();
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

  /* ================= Init ================= */

  initTheme();
  renderDashboard();       // render awal (masih kosong sampai data Firebase tiba)
  subscribeFinance();      // mulai dengarkan data realtime dari /finance

  // Fallback: kalau Firebase tak merespons (mis. offline), jangan biarkan
  // user terjebak di layar loading terus-menerus.
  setTimeout(hideLoading, 10000);
})();
