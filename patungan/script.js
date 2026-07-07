/* =========================================================
   Patungan App — script.js
   Data trip/peserta/nota disimpan di Firebase Realtime DB di
   bawah path /patungan (lihat firebaseConfig di index.html).

   Struktur data:
     patungan/
       trips/
         <tripId>/                    # key = Date.now() saat input
           name:      "Liburan ke Bali"
           createdAt: 1719...
           participants/
             <participantId>/ { name, createdAt }
           expenses/
             <expenseId>/ { description, amount, paidBy: participantId,
                             splitAmong: [participantId, ...], createdAt }

   Menghapus trip otomatis ikut menghapus participants/expenses di
   dalamnya (nested, bukan node terpisah) — satu delete beres semua.

   Preferensi tema disimpan lokal (localStorage). TIDAK ada konsep
   "pengguna aktif" (Iyon/Ciwul) spt Finance/Routine App — peserta
   di sini bebas siapa saja per trip (bukan cuma 2 orang tetap).
   ========================================================= */

(function () {
  "use strict";

  const STORAGE_KEYS = { theme: "patunganapp_theme" };

  /* ---------------- State ---------------- */
  let trips = []; // [{ id, name, createdAt, participants: [...], expenses: [...] }]

  function findTrip(id) {
    return trips.find((t) => t.id === id);
  }

  function findParticipant(trip, id) {
    return trip ? trip.participants.find((p) => p.id === id) : null;
  }

  /* ================= Firebase data layer ================= */

  const patunganRef = db.ref(PATUNGAN_PATH);

  function subscribePatungan() {
    patunganRef.on(
      "value",
      (snapshot) => {
        rebuildFromSnapshot(snapshot.val() || {});
        renderAll();
        hideLoading();
      },
      (err) => {
        console.error("Gagal membaca data dari Firebase:", err);
        hideLoading();
      }
    );
  }

  function rebuildFromSnapshot(root) {
    const tripsObj = root.trips || {};
    trips = Object.keys(tripsObj).map((id) => {
      const t = tripsObj[id] || {};

      const participantsObj = t.participants || {};
      const participants = Object.keys(participantsObj).map((pid) => ({
        id: pid,
        name: (participantsObj[pid] || {}).name || "",
        createdAt: Number((participantsObj[pid] || {}).createdAt) || 0,
      }));

      const expensesObj = t.expenses || {};
      const expenses = Object.keys(expensesObj).map((eid) => {
        const e = expensesObj[eid] || {};
        return {
          id: eid,
          description: e.description || "",
          amount: Number(e.amount) || 0,
          paidBy: e.paidBy || "",
          splitAmong: Array.isArray(e.splitAmong) ? e.splitAmong : [],
          createdAt: Number(e.createdAt) || 0,
        };
      });

      return {
        id,
        name: t.name || "",
        createdAt: Number(t.createdAt) || 0,
        participants,
        expenses,
      };
    });
  }

  // ---- Operasi tulis: Trip ----

  function addTrip(name) {
    const ts = Date.now();
    return patunganRef.child("trips/" + ts).set({ name, createdAt: ts });
  }

  function updateTripName(id, name) {
    return patunganRef.child("trips/" + id + "/name").set(name);
  }

  function deleteTrip(id) {
    return patunganRef.child("trips/" + id).remove();
  }

  // ---- Operasi tulis: Peserta ----

  function addParticipant(tripId, name) {
    const ts = Date.now();
    return patunganRef.child("trips/" + tripId + "/participants/" + ts).set({ name, createdAt: ts });
  }

  function deleteParticipant(tripId, participantId) {
    return patunganRef.child("trips/" + tripId + "/participants/" + participantId).remove();
  }

  // ---- Operasi tulis: Pengeluaran ----

  function addExpense(tripId, data) {
    const ts = Date.now();
    return patunganRef.child("trips/" + tripId + "/expenses/" + ts).set({ ...data, createdAt: ts });
  }

  function updateExpense(tripId, expenseId, data) {
    // .update() (merge), bukan .set() — createdAt asli dipertahankan supaya
    // urutan list (sort by createdAt) tidak lompat ke atas tiap kali diedit.
    return patunganRef.child("trips/" + tripId + "/expenses/" + expenseId).update(data);
  }

  function deleteExpense(tripId, expenseId) {
    return patunganRef.child("trips/" + tripId + "/expenses/" + expenseId).remove();
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

  /* ================= Bottom nav / paging ================= */

  function goToPage(pageId) {
    document.querySelectorAll(".page").forEach((el) => el.classList.remove("active"));
    document.getElementById(pageId).classList.add("active");
    document.querySelectorAll("[data-nav]").forEach((el) => el.classList.toggle("active", el.dataset.nav === pageId));
    window.scrollTo(0, 0);
  }

  /* ================= Currency helpers ================= */

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

  function parseAmountInput(input) {
    return parseInt(input.value.replace(/[^\d]/g, ""), 10) || 0;
  }

  /* ================= Trip helpers ================= */

  function tripTotal(trip) {
    return trip.expenses.reduce((sum, e) => sum + e.amount, 0);
  }

  // Saldo tiap peserta: net > 0 = harus MENERIMA (dia nombokin duluan),
  // net < 0 = harus MEMBAYAR (masih nunggak ke yang lain).
  function calcBalances(trip) {
    const net = {};
    trip.participants.forEach((p) => (net[p.id] = 0));
    trip.expenses.forEach((exp) => {
      if (!exp.splitAmong.length) return;
      const share = exp.amount / exp.splitAmong.length;
      if (net[exp.paidBy] !== undefined) net[exp.paidBy] += exp.amount;
      exp.splitAmong.forEach((pid) => {
        if (net[pid] !== undefined) net[pid] -= share;
      });
    });
    return trip.participants.map((p) => ({ id: p.id, name: p.name, net: net[p.id] }));
  }

  // Simplifikasi hutang: cocokkan kreditor (net > 0) terbesar dgn debitor
  // (net < 0) terbesar berulang kali, supaya jumlah transaksi settlement
  // seminimal mungkin (pola umum "Splitwise-style debt simplification").
  function simplifyDebts(balances) {
    const creditors = balances.filter((b) => b.net > 1).map((b) => ({ ...b })).sort((a, b) => b.net - a.net);
    const debtors = balances.filter((b) => b.net < -1).map((b) => ({ ...b, net: -b.net })).sort((a, b) => b.net - a.net);
    const settlements = [];
    let i = 0;
    let j = 0;
    while (i < debtors.length && j < creditors.length) {
      const amount = Math.min(debtors[i].net, creditors[j].net);
      if (amount > 1) settlements.push({ from: debtors[i].name, to: creditors[j].name, amount: Math.round(amount) });
      debtors[i].net -= amount;
      creditors[j].net -= amount;
      if (debtors[i].net <= 1) i++;
      if (creditors[j].net <= 1) j++;
    }
    return settlements;
  }

  /* ================= Render: all ================= */

  function renderAll() {
    renderDashboard();
    renderTripList();
    renderHistory();
    if (tripDetailModal.classList.contains("open") && currentDetailTripId) {
      const trip = findTrip(currentDetailTripId);
      if (trip) renderTripDetail(trip);
      else closeTripDetail(); // trip dihapus dari device lain saat modal terbuka
    }
  }

  /* ================= Render: Dashboard ================= */

  function tripCardHTML(trip) {
    return (
      '<div class="trip-item" data-id="' + trip.id + '">' +
      '<div class="trip-icon">🧾</div>' +
      '<div class="trip-info">' +
      '<p class="trip-name">' + escapeHtml(trip.name) + "</p>" +
      '<p class="trip-meta">' + trip.participants.length + " peserta &middot; " + trip.expenses.length + " nota</p>" +
      "</div>" +
      '<div class="trip-total">' + formatCurrency(tripTotal(trip)) + "</div>" +
      "</div>"
    );
  }

  function renderDashboard() {
    document.getElementById("statTripCount").textContent = trips.length;
    const totalExpenseCount = trips.reduce((sum, t) => sum + t.expenses.length, 0);
    const totalAmount = trips.reduce((sum, t) => sum + tripTotal(t), 0);
    document.getElementById("statExpenseCount").textContent = totalExpenseCount;
    document.getElementById("statTotalAmount").textContent = formatCurrency(totalAmount);

    const recent = [...trips].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
    const recentEl = document.getElementById("recentTrips");
    recentEl.innerHTML = recent.length ? recent.map(tripCardHTML).join("") : '<p class="empty-state">Belum ada trip. Tambahkan trip pertamamu!</p>';
  }

  /* ================= Render: Trip list ================= */

  function renderTripList() {
    const listEl = document.getElementById("tripList");
    const sorted = [...trips].sort((a, b) => b.createdAt - a.createdAt);
    listEl.innerHTML = sorted.length ? sorted.map(tripCardHTML).join("") : '<p class="empty-state">Belum ada trip. Tambahkan trip pertamamu!</p>';
  }

  [document.getElementById("recentTrips"), document.getElementById("tripList")].forEach((container) => {
    container.addEventListener("click", (e) => {
      const item = e.target.closest(".trip-item");
      if (!item) return;
      const trip = findTrip(item.dataset.id);
      if (trip) openTripDetail(trip);
    });
  });

  /* ================= Trip modal (add/edit nama) ================= */

  const tripModal = document.getElementById("tripModal");
  const tripForm = document.getElementById("tripForm");
  let editingTripId = null;

  function openTripModal(trip) {
    editingTripId = trip ? trip.id : null;
    document.getElementById("tripModalTitle").textContent = trip ? "Ubah Nama Trip" : "Tambah Trip";
    document.getElementById("tripNameInput").value = trip ? trip.name : "";
    tripModal.classList.add("open");
  }

  function closeTripModal() {
    tripModal.classList.remove("open");
    editingTripId = null;
  }

  document.getElementById("cancelTripBtn").addEventListener("click", closeTripModal);
  tripModal.addEventListener("click", (e) => {
    if (e.target === tripModal) closeTripModal();
  });

  tripForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("tripNameInput").value.trim();
    if (!name) return;

    const action = editingTripId ? updateTripName(editingTripId, name) : addTrip(name);
    action.catch((err) => {
      console.error("Gagal menyimpan trip:", err);
      alert("Gagal menyimpan trip. Cek koneksi internet.");
    });
    closeTripModal();
  });

  document.getElementById("navAdd").addEventListener("click", () => openTripModal(null));

  /* ================= Trip detail modal ================= */

  const tripDetailModal = document.getElementById("tripDetailModal");
  let currentDetailTripId = null;

  function renderTripDetail(trip) {
    document.getElementById("detailTripName").textContent = trip.name;
    document.getElementById("detailTripMeta").textContent = trip.participants.length + " peserta · " + trip.expenses.length + " nota";

    const participantListEl = document.getElementById("participantList");
    participantListEl.innerHTML = trip.participants.length
      ? trip.participants
          .map(
            (p) =>
              '<span class="participant-chip" data-id="' +
              p.id +
              '">' +
              escapeHtml(p.name) +
              '<button type="button" data-id="' +
              p.id +
              '" aria-label="Hapus peserta">✕</button></span>'
          )
          .join("")
      : '<p class="empty-state">Belum ada peserta. Tambahkan peserta dulu sebelum mencatat nota.</p>';

    const expenseListEl = document.getElementById("expenseList");
    const sortedExpenses = [...trip.expenses].sort((a, b) => b.createdAt - a.createdAt);
    expenseListEl.innerHTML = sortedExpenses.length
      ? sortedExpenses
          .map((exp) => {
            const payer = findParticipant(trip, exp.paidBy);
            return (
              '<div class="expense-item" data-id="' +
              exp.id +
              '">' +
              '<div class="expense-info">' +
              '<p class="expense-desc">' +
              escapeHtml(exp.description) +
              "</p>" +
              '<p class="expense-meta">Dibayar ' +
              escapeHtml(payer ? payer.name : "?") +
              " &middot; dibagi " +
              exp.splitAmong.length +
              " orang</p>" +
              "</div>" +
              '<div class="expense-amount">' +
              formatCurrency(exp.amount) +
              "</div>" +
              "</div>"
            );
          })
          .join("")
      : '<p class="empty-state">Belum ada nota. Tambahkan pengeluaran pertama trip ini.</p>';
  }

  function openTripDetail(trip) {
    currentDetailTripId = trip.id;
    renderTripDetail(trip);
    tripDetailModal.classList.add("open");
  }

  function closeTripDetail() {
    tripDetailModal.classList.remove("open");
    currentDetailTripId = null;
  }

  tripDetailModal.addEventListener("click", (e) => {
    if (e.target === tripDetailModal) closeTripDetail();
  });

  document.getElementById("editTripBtn").addEventListener("click", () => {
    const trip = findTrip(currentDetailTripId);
    if (trip) openTripModal(trip);
  });

  document.getElementById("deleteTripBtn").addEventListener("click", () => {
    const trip = findTrip(currentDetailTripId);
    if (!trip) return;
    openConfirm("Hapus Trip?", 'Apakah Anda yakin ingin menghapus trip "' + trip.name + '"? Semua peserta & nota di dalamnya ikut terhapus.', () => {
      deleteTrip(trip.id).catch((err) => {
        console.error("Gagal menghapus trip:", err);
        alert("Gagal menghapus trip. Cek koneksi internet.");
      });
      closeTripDetail();
    });
  });

  /* ---- Peserta ---- */

  document.getElementById("addParticipantBtn").addEventListener("click", () => {
    const input = document.getElementById("participantNameInput");
    const name = input.value.trim();
    if (!name || !currentDetailTripId) return;
    const trip = findTrip(currentDetailTripId);
    if (trip && trip.participants.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      alert('Peserta bernama "' + name + '" sudah ada di trip ini.');
      return;
    }
    addParticipant(currentDetailTripId, name).catch((err) => console.error("Gagal menambah peserta:", err));
    input.value = "";
  });

  document.getElementById("participantNameInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("addParticipantBtn").click();
    }
  });

  document.getElementById("participantList").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-id]");
    if (!btn) return;
    const trip = findTrip(currentDetailTripId);
    if (!trip) return;
    const participant = findParticipant(trip, btn.dataset.id);
    if (!participant) return;

    const inUse = trip.expenses.some((exp) => exp.paidBy === participant.id || exp.splitAmong.includes(participant.id));
    if (inUse) {
      alert('Peserta "' + participant.name + '" masih terlibat di salah satu nota — hapus/ubah nota itu dulu sebelum menghapus peserta ini.');
      return;
    }
    openConfirm("Hapus Peserta?", 'Hapus "' + participant.name + '" dari trip ini?', () => {
      deleteParticipant(trip.id, participant.id).catch((err) => console.error("Gagal menghapus peserta:", err));
    });
  });

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

  /* ================= Expense modal (add/edit) ================= */

  const expenseModal = document.getElementById("expenseModal");
  const expenseForm = document.getElementById("expenseForm");
  const expenseAmountInput = document.getElementById("expenseAmountInput");
  let editingExpenseId = null;

  expenseAmountInput.addEventListener("input", function () {
    formatAmountInput(this);
  });

  function populateExpenseParticipantFields(trip, expense) {
    const paidBySelect = document.getElementById("expensePaidByInput");
    paidBySelect.innerHTML = trip.participants.map((p) => '<option value="' + p.id + '">' + escapeHtml(p.name) + "</option>").join("");
    if (expense) paidBySelect.value = expense.paidBy;

    const splitList = document.getElementById("expenseSplitList");
    const checkedIds = expense ? expense.splitAmong : trip.participants.map((p) => p.id);
    splitList.innerHTML = trip.participants
      .map(
        (p) =>
          '<label class="split-row"><input type="checkbox" value="' +
          p.id +
          '"' +
          (checkedIds.includes(p.id) ? " checked" : "") +
          ">" +
          escapeHtml(p.name) +
          "</label>"
      )
      .join("");
  }

  function openExpenseModal(expense) {
    const trip = findTrip(currentDetailTripId);
    if (!trip) return;
    if (!trip.participants.length) {
      alert("Tambahkan peserta dulu sebelum mencatat nota.");
      return;
    }

    editingExpenseId = expense ? expense.id : null;
    document.getElementById("expenseModalTitle").textContent = expense ? "Ubah Pengeluaran" : "Tambah Pengeluaran";
    document.getElementById("expenseDescInput").value = expense ? expense.description : "";
    expenseAmountInput.value = expense ? Math.round(expense.amount).toLocaleString("id-ID") : "";
    document.getElementById("deleteExpenseBtn").hidden = !expense;

    populateExpenseParticipantFields(trip, expense);

    expenseModal.classList.add("open");
  }

  function closeExpenseModal() {
    expenseModal.classList.remove("open");
    editingExpenseId = null;
  }

  document.getElementById("addExpenseBtn").addEventListener("click", () => openExpenseModal(null));
  document.getElementById("cancelExpenseBtn").addEventListener("click", closeExpenseModal);
  expenseModal.addEventListener("click", (e) => {
    if (e.target === expenseModal) closeExpenseModal();
  });

  document.getElementById("expenseList").addEventListener("click", (e) => {
    const item = e.target.closest(".expense-item");
    if (!item) return;
    const trip = findTrip(currentDetailTripId);
    const expense = trip && trip.expenses.find((ex) => ex.id === item.dataset.id);
    if (expense) openExpenseModal(expense);
  });

  document.getElementById("deleteExpenseBtn").addEventListener("click", () => {
    const trip = findTrip(currentDetailTripId);
    const expense = trip && trip.expenses.find((ex) => ex.id === editingExpenseId);
    if (!trip || !expense) return;
    openConfirm("Hapus Nota?", 'Hapus pengeluaran "' + expense.description + '"?', () => {
      deleteExpense(trip.id, expense.id).catch((err) => console.error("Gagal menghapus nota:", err));
      closeExpenseModal();
    });
  });

  expenseForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const trip = findTrip(currentDetailTripId);
    if (!trip) return;

    const splitAmong = [...document.querySelectorAll("#expenseSplitList input:checked")].map((el) => el.value);
    if (!splitAmong.length) {
      alert("Pilih minimal satu peserta untuk berbagi nota ini.");
      return;
    }

    const data = {
      description: document.getElementById("expenseDescInput").value.trim(),
      amount: parseAmountInput(expenseAmountInput),
      paidBy: document.getElementById("expensePaidByInput").value,
      splitAmong,
    };
    if (!data.description || !data.amount) return;

    const action = editingExpenseId ? updateExpense(trip.id, editingExpenseId, data) : addExpense(trip.id, data);
    action.catch((err) => {
      console.error("Gagal menyimpan nota:", err);
      alert("Gagal menyimpan nota. Cek koneksi internet.");
    });
    closeExpenseModal();
  });

  /* ================= Ringkasan (summary modal) ================= */

  const summaryModal = document.getElementById("summaryModal");

  document.getElementById("viewSummaryBtn").addEventListener("click", () => {
    const trip = findTrip(currentDetailTripId);
    if (!trip) return;
    renderSummary(trip);
    summaryModal.classList.add("open");
  });

  function renderSummary(trip) {
    document.getElementById("summaryTripName").textContent = trip.name;
    const balances = calcBalances(trip);

    const balanceListEl = document.getElementById("balanceList");
    balanceListEl.innerHTML = balances.length
      ? balances
          .map((b) => {
            const cls = b.net > 0.5 ? "positive" : b.net < -0.5 ? "negative" : "";
            const sign = b.net > 0.5 ? "+" : b.net < -0.5 ? "-" : "";
            return (
              '<div class="balance-row"><span>' +
              escapeHtml(b.name) +
              '</span><span class="balance-amount ' +
              cls +
              '">' +
              sign +
              formatCurrency(Math.abs(b.net)) +
              "</span></div>"
            );
          })
          .join("")
      : '<p class="empty-state">Belum ada peserta.</p>';

    const settlements = simplifyDebts(balances);
    const settlementListEl = document.getElementById("settlementList");
    settlementListEl.innerHTML = settlements.length
      ? settlements
          .map(
            (s) =>
              '<div class="settlement-row"><span>' +
              escapeHtml(s.from) +
              '</span><span class="settlement-arrow">&rarr;</span><span>' +
              escapeHtml(s.to) +
              '</span><span class="settlement-amount">' +
              formatCurrency(s.amount) +
              "</span></div>"
          )
          .join("")
      : '<p class="empty-state">Semua sudah impas &mdash; tidak ada yang perlu dibayar.</p>';
  }

  document.getElementById("closeSummaryBtn").addEventListener("click", () => summaryModal.classList.remove("open"));
  summaryModal.addEventListener("click", (e) => {
    if (e.target === summaryModal) summaryModal.classList.remove("open");
  });

  /* ================= Render: Riwayat ================= */

  function renderHistory() {
    const allExpenses = [];
    trips.forEach((trip) => {
      trip.expenses.forEach((exp) => {
        const payer = findParticipant(trip, exp.paidBy);
        allExpenses.push({ ...exp, tripName: trip.name, payerName: payer ? payer.name : "?" });
      });
    });
    allExpenses.sort((a, b) => b.createdAt - a.createdAt);

    const listEl = document.getElementById("historyList");
    listEl.innerHTML = allExpenses.length
      ? allExpenses
          .map(
            (exp) =>
              '<div class="history-item">' +
              '<div class="history-info">' +
              '<p class="history-desc">' +
              escapeHtml(exp.description) +
              "</p>" +
              '<p class="history-meta"><span class="history-trip-badge">' +
              escapeHtml(exp.tripName) +
              "</span>Dibayar " +
              escapeHtml(exp.payerName) +
              "</p>" +
              "</div>" +
              '<div class="history-amount">' +
              formatCurrency(exp.amount) +
              "</div>" +
              "</div>"
          )
          .join("")
      : '<p class="empty-state">Belum ada pengeluaran tercatat.</p>';
  }

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

  /* ================= Init ================= */

  initTheme();
  subscribePatungan();
})();
