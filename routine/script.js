/* =========================================================
   Routine App — script.js
   Data rutinitas & status cek disimpan di Firebase Realtime DB
   di bawah path /routine (lihat firebaseConfig di index.html).

   Struktur data:
     routine/
       routines/
         <timestamp>/ { name, period, icon, days, createdAt }
         // period: "harian" | "mingguan" | "bulanan"
         // days: array angka 0-6 (0=Minggu … 6=Sabtu, konvensi Date.getDay()),
         //   HANYA relevan kalau period === "harian". [] = mode "Tiap Hari"
         //   (aktif tiap hari); non-kosong = mode "Hari Tertentu" (cuma aktif
         //   di hari-hari itu, mis. [1,4] = "Senin & Kamis" utk rutinitas
         //   "Puasa Senin Kamis"). Diabaikan (selalu []) utk mingguan/bulanan.
       completions/
         <routineId>/
           <periodKey>: true
           // periodKey tergantung period rutinitas itu (lihat periodKeyFor()):
           //   harian     -> "YYYY-MM-DD" (tanggal lokal hari ini)
           //   mingguan   -> "YYYY-MM-DD" Senin minggu berjalan
           //   bulanan    -> "YYYY-MM"

   Preferensi tema disimpan lokal (localStorage).
   ========================================================= */

(function () {
  "use strict";

  const STORAGE_KEYS = { theme: "routineapp_theme" };

  /* ---------------- Metadata periode (enum tetap, bukan kategori bikinan user) ---------------- */
  const PERIOD_ORDER = ["harian", "mingguan", "bulanan"];
  const PERIOD_META = {
    harian: { label: "Harian", icon: "🔁", varName: "--color-primary" },
    mingguan: { label: "Mingguan", icon: "📆", varName: "--period-mingguan" },
    bulanan: { label: "Bulanan", icon: "🗓️", varName: "--period-bulanan" },
  };

  const MONTH_NAMES = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];

  // Index 0 = Minggu, sama konvensi dgn Date.getDay().
  const DAY_ABBR = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const DAY_FULL = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  /* ---------------- State ---------------- */
  let routines = [];
  let completions = {}; // { [routineId]: { [periodKey]: true } }
  let activePeriodFilter = "all";

  function getMeta(period) {
    return PERIOD_META[period] || PERIOD_META.harian;
  }

  /* ================= Date / period-key helpers ================= */

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function dateStr(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  // Awal minggu (Senin) dari sebuah tanggal — sama konvensi dgn Finance App.
  function startOfWeek(ref) {
    const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
    const offset = (d.getDay() + 6) % 7; // Minggu(0)→6, Senin(1)→0, dst.
    d.setDate(d.getDate() - offset);
    return d;
  }

  function periodKeyFor(period, now) {
    if (period === "bulanan") return now.getFullYear() + "-" + pad2(now.getMonth() + 1);
    if (period === "mingguan") return dateStr(startOfWeek(now));
    return dateStr(now); // harian -> reset tiap hari
  }

  function isDone(routine, now) {
    const key = periodKeyFor(routine.period, now);
    return !!(completions[routine.id] && completions[routine.id][key]);
  }

  // Rutinitas harian mode "Tiap Hari" (days kosong) selalu aktif; mode "Hari
  // Tertentu" (days terisi) cuma aktif kalau hari ini (now.getDay()) ada di
  // daftar days-nya, mis. days=[1,4] ("Puasa Senin Kamis") cuma aktif Senin & Kamis.
  function isRoutineActiveToday(routine, now) {
    return !routine.days.length || routine.days.includes(now.getDay());
  }

  function routinesForToday(now) {
    return routines.filter((r) => r.period === "harian" && isRoutineActiveToday(r, now));
  }

  function routinesForWeek() {
    return routines.filter((r) => r.period === "mingguan");
  }

  function routinesForMonth() {
    return routines.filter((r) => r.period === "bulanan");
  }

  /* ================= Firebase data layer ================= */

  const routineRef = db.ref(ROUTINE_PATH);

  function subscribeRoutine() {
    routineRef.on(
      "value",
      (snapshot) => {
        const root = snapshot.val() || {};
        rebuildFromSnapshot(root);
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
    const routinesObj = root.routines || {};
    routines = Object.keys(routinesObj).map((id) => {
      const r = routinesObj[id] || {};
      return {
        id,
        name: r.name || "",
        period: PERIOD_META[r.period] ? r.period : "harian",
        icon: r.icon || "",
        days: Array.isArray(r.days) ? r.days.map(Number) : [],
        createdAt: Number(r.createdAt) || 0,
      };
    });

    completions = root.completions || {};
  }

  // ---- Operasi tulis: Rutinitas ----

  function addRoutine(data) {
    const ts = Date.now();
    return routineRef.child("routines/" + ts).set({ ...data, createdAt: ts });
  }

  function updateRoutine(id, data) {
    return routineRef.child("routines/" + id).update(data);
  }

  function deleteRoutine(id) {
    return routineRef.update({
      ["routines/" + id]: null,
      ["completions/" + id]: null,
    });
  }

  // ---- Operasi tulis: status cek ----

  function toggleCompletion(routineId, periodKey, done) {
    return routineRef.child("completions/" + routineId + "/" + periodKey).set(done ? true : null);
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

  /* ================= Period color helpers ================= */

  function periodChipStyle(period) {
    const v = getMeta(period).varName;
    return "background: color-mix(in srgb, var(" + v + ") 18%, var(--color-surface)); color: var(" + v + ");";
  }

  function periodSwatchStyle(period) {
    return "background: var(" + getMeta(period).varName + ");";
  }

  // Badge/label periode: rutinitas harian mode "Hari Tertentu" menampilkan
  // nama hari-nya langsung (mis. "Sen, Kam") supaya lebih informatif drpd
  // cuma "Harian" generik. `full` = pakai nama hari lengkap (dipakai di
  // popup detail), default singkatan (dipakai di badge kartu/list yg sempit).
  function routinePeriodLabel(routine, full) {
    if (routine.period === "harian" && routine.days.length) {
      const names = full ? DAY_FULL : DAY_ABBR;
      return [...routine.days].sort((a, b) => a - b).map((d) => names[d]).join(", ");
    }
    return getMeta(routine.period).label;
  }

  /* ================= Render: all ================= */

  function renderAll() {
    renderDashboard();
    renderRoutineFilterTabs();
    renderRoutineList();
    renderCheckLists();
  }

  /* ================= Render: Dashboard ================= */

  function routineCardHTML(routine) {
    const meta = getMeta(routine.period);
    const icon = routine.icon || meta.icon;
    return (
      '<div class="routine-item" data-id="' + routine.id + '">' +
      '<div class="routine-icon" style="' + periodChipStyle(routine.period) + '">' + escapeHtml(icon) + "</div>" +
      '<div class="routine-info">' +
      '<p class="routine-name">' + escapeHtml(routine.name) + "</p>" +
      "</div>" +
      '<span class="routine-period-badge" style="' + periodChipStyle(routine.period) + '">' + escapeHtml(routinePeriodLabel(routine)) + "</span>" +
      "</div>"
    );
  }

  function renderDashboard() {
    document.getElementById("statRoutineCount").textContent = routines.length;

    const now = new Date();
    const todayLeft = routinesForToday(now).filter((r) => !isDone(r, now)).length;
    const weekLeft = routinesForWeek().filter((r) => !isDone(r, now)).length;
    document.getElementById("statTodayLeft").textContent = todayLeft;
    document.getElementById("statWeekLeft").textContent = weekLeft;

    const recent = [...routines].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
    const recentEl = document.getElementById("recentRoutines");
    recentEl.innerHTML = recent.length
      ? recent.map(routineCardHTML).join("")
      : '<p class="empty-state">Belum ada rutinitas. Tambahkan rutinitas pertamamu!</p>';

    const breakdownEl = document.getElementById("periodBreakdown");
    const withCount = PERIOD_ORDER.map((p) => ({
      period: p,
      label: PERIOD_META[p].label,
      count: routines.filter((r) => r.period === p).length,
    })).filter((p) => p.count > 0);
    breakdownEl.innerHTML = withCount.length
      ? withCount
          .map(
            (p) =>
              '<span class="breakdown-chip"><span class="chip-swatch" style="' +
              periodSwatchStyle(p.period) +
              '"></span>' +
              escapeHtml(p.label) +
              ' <span class="chip-count">' +
              p.count +
              "</span></span>"
          )
          .join("")
      : '<p class="empty-state">Belum ada data periode.</p>';
  }

  /* ================= Render: Rutinitas ================= */

  function renderRoutineFilterTabs() {
    const tabsEl = document.getElementById("routineFilterTabs");
    let html = '<button class="filter-tab' + (activePeriodFilter === "all" ? " active" : "") + '" data-filter="all">Semua</button>';
    html += PERIOD_ORDER.map(
      (p) =>
        '<button class="filter-tab tab-' +
        p +
        (activePeriodFilter === p ? " active" : "") +
        '" data-filter="' +
        p +
        '">' +
        PERIOD_META[p].icon +
        " " +
        PERIOD_META[p].label +
        "</button>"
    ).join("");
    tabsEl.innerHTML = html;
  }

  function renderRoutineList() {
    const listEl = document.getElementById("routineList");
    let filtered = routines;
    if (activePeriodFilter !== "all") filtered = filtered.filter((r) => r.period === activePeriodFilter);
    filtered = [...filtered].sort((a, b) => b.createdAt - a.createdAt);

    listEl.innerHTML = filtered.length
      ? filtered.map(routineCardHTML).join("")
      : '<p class="empty-state">Belum ada rutinitas pada periode ini.</p>';
  }

  /* ================= Routine modal (add/edit) ================= */

  const routineModal = document.getElementById("routineModal");
  const routineForm = document.getElementById("routineForm");
  const routinePeriodInput = document.getElementById("routinePeriodInput");
  const dailyModeField = document.getElementById("dailyModeField");
  const dailyDaysField = document.getElementById("dailyDaysField");
  const dailyModeToggle = document.getElementById("dailyModeToggle");
  const dailyDaysPicker = document.getElementById("dailyDaysPicker");
  let editingRoutineId = null;
  let currentDailyMode = "setiap"; // "setiap" | "tertentu" — cuma state UI, tidak disimpan langsung (disimpulkan dari `days.length` saat dibuka lagi)
  let selectedDays = [];

  function setDailyMode(mode) {
    currentDailyMode = mode;
    dailyModeToggle.querySelectorAll(".mode-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.mode === mode));
    updatePeriodFieldsVisibility();
  }

  function renderDayPicker() {
    dailyDaysPicker.querySelectorAll(".day-chip").forEach((chip) => {
      chip.classList.toggle("selected", selectedDays.includes(Number(chip.dataset.day)));
    });
  }

  function updatePeriodFieldsVisibility() {
    const isHarian = routinePeriodInput.value === "harian";
    dailyModeField.hidden = !isHarian;
    dailyDaysField.hidden = !isHarian || currentDailyMode !== "tertentu";
  }

  routinePeriodInput.addEventListener("change", updatePeriodFieldsVisibility);

  dailyModeToggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".mode-btn");
    if (!btn) return;
    setDailyMode(btn.dataset.mode);
  });

  dailyDaysPicker.addEventListener("click", (e) => {
    const chip = e.target.closest(".day-chip");
    if (!chip) return;
    const day = Number(chip.dataset.day);
    const idx = selectedDays.indexOf(day);
    if (idx === -1) selectedDays.push(day);
    else selectedDays.splice(idx, 1);
    renderDayPicker();
  });

  function openRoutineModal(routine) {
    editingRoutineId = routine ? routine.id : null;
    document.getElementById("routineModalTitle").textContent = routine ? "Ubah Rutinitas" : "Tambah Rutinitas";
    document.getElementById("routineNameInput").value = routine ? routine.name : "";
    routinePeriodInput.value = routine ? routine.period : "harian";
    document.getElementById("routineIconInput").value = routine ? routine.icon : "";

    selectedDays = routine ? routine.days.slice() : [];
    renderDayPicker();
    setDailyMode(selectedDays.length ? "tertentu" : "setiap");
    updatePeriodFieldsVisibility();

    routineModal.classList.add("open");
  }

  function closeRoutineModal() {
    routineModal.classList.remove("open");
    editingRoutineId = null;
  }

  document.getElementById("cancelRoutineBtn").addEventListener("click", closeRoutineModal);
  routineModal.addEventListener("click", (e) => {
    if (e.target === routineModal) closeRoutineModal();
  });

  routineForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const period = routinePeriodInput.value;
    const isDailyTertentu = period === "harian" && currentDailyMode === "tertentu";
    if (isDailyTertentu && !selectedDays.length) {
      alert("Pilih minimal satu hari untuk mode Hari Tertentu.");
      return;
    }

    const data = {
      name: document.getElementById("routineNameInput").value.trim(),
      period,
      icon: document.getElementById("routineIconInput").value.trim(),
      // Selalu disertakan (walau kosong) supaya update() bersih menimpa `days`
      // lama kalau period/mode diganti — bukan cuma di-skip merge.
      days: isDailyTertentu ? [...selectedDays].sort((a, b) => a - b) : [],
    };
    if (!data.name) return;

    const action = editingRoutineId ? updateRoutine(editingRoutineId, data) : addRoutine(data);
    action.catch((err) => {
      console.error("Gagal menyimpan rutinitas:", err);
      alert("Gagal menyimpan rutinitas. Cek koneksi internet.");
    });
    closeRoutineModal();
  });

  /* ================= Routine detail modal ================= */

  const routineDetailModal = document.getElementById("routineDetailModal");
  let currentDetailRoutineId = null;

  function formatDateLong(ms) {
    const d = new Date(ms);
    return d.getDate() + " " + MONTH_NAMES[d.getMonth()] + " " + d.getFullYear();
  }

  function openRoutineDetail(routine) {
    currentDetailRoutineId = routine.id;
    const meta = getMeta(routine.period);
    const icon = routine.icon || meta.icon;

    document.getElementById("detailIcon").style.cssText = periodChipStyle(routine.period);
    document.getElementById("detailIcon").textContent = icon;
    document.getElementById("detailName").textContent = routine.name;
    const badge = document.getElementById("detailPeriodBadge");
    badge.textContent = routinePeriodLabel(routine);
    badge.style.cssText = periodChipStyle(routine.period);

    document.getElementById("detailCreatedAt").textContent = routine.createdAt ? formatDateLong(routine.createdAt) : "—";

    const daysWrap = document.getElementById("detailDaysWrap");
    if (routine.period === "harian") {
      daysWrap.hidden = false;
      document.getElementById("detailDaysText").textContent = routine.days.length
        ? [...routine.days].sort((a, b) => a - b).map((d) => DAY_FULL[d]).join(", ")
        : "Setiap hari";
    } else {
      daysWrap.hidden = true;
    }

    routineDetailModal.classList.add("open");
  }

  function closeRoutineDetail() {
    routineDetailModal.classList.remove("open");
    currentDetailRoutineId = null;
  }

  routineDetailModal.addEventListener("click", (e) => {
    if (e.target === routineDetailModal) closeRoutineDetail();
  });

  document.getElementById("editRoutineBtn").addEventListener("click", () => {
    const routine = routines.find((r) => r.id === currentDetailRoutineId);
    closeRoutineDetail();
    if (routine) openRoutineModal(routine);
  });

  document.getElementById("deleteRoutineBtn").addEventListener("click", () => {
    const routine = routines.find((r) => r.id === currentDetailRoutineId);
    if (!routine) return;
    openConfirm("Hapus Rutinitas?", 'Apakah Anda yakin ingin menghapus rutinitas "' + routine.name + '"? Riwayat cek rutinitas ini juga akan terhapus.', () => {
      deleteRoutine(routine.id).catch((err) => {
        console.error("Gagal menghapus rutinitas:", err);
        alert("Gagal menghapus rutinitas. Cek koneksi internet.");
      });
      closeRoutineDetail();
    });
  });

  [document.getElementById("recentRoutines"), document.getElementById("routineList")].forEach((container) => {
    container.addEventListener("click", (e) => {
      const item = e.target.closest(".routine-item");
      if (!item) return;
      const routine = routines.find((r) => r.id === item.dataset.id);
      if (routine) openRoutineDetail(routine);
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

  /* ================= Cek Rutinitas (checklist) ================= */

  function checkItemHTML(routine, now) {
    const meta = getMeta(routine.period);
    const icon = routine.icon || meta.icon;
    const done = isDone(routine, now);
    return (
      '<div class="check-item' +
      (done ? " done" : "") +
      '" data-id="' +
      routine.id +
      '">' +
      '<button type="button" class="check-mark" aria-label="Tandai selesai">' +
      (done ? "✓" : "") +
      "</button>" +
      '<span class="check-icon">' +
      escapeHtml(icon) +
      "</span>" +
      '<div class="check-info">' +
      '<p class="check-name">' +
      escapeHtml(routine.name) +
      "</p>" +
      "</div>" +
      "</div>"
    );
  }

  function renderCheckGroup(elId, list, now, emptyText) {
    const el = document.getElementById(elId);
    const sorted = [...list].sort((a, b) => {
      const aDone = isDone(a, now);
      const bDone = isDone(b, now);
      if (aDone !== bDone) return aDone ? 1 : -1;
      return a.createdAt - b.createdAt;
    });
    el.innerHTML = sorted.length ? sorted.map((r) => checkItemHTML(r, now)).join("") : '<p class="empty-state">' + emptyText + "</p>";
  }

  function renderCheckLists() {
    const now = new Date();
    renderCheckGroup("checkToday", routinesForToday(now), now, "Belum ada rutinitas harian untuk hari ini.");
    renderCheckGroup("checkWeek", routinesForWeek(), now, "Belum ada rutinitas mingguan.");
    renderCheckGroup("checkMonth", routinesForMonth(), now, "Belum ada rutinitas bulanan.");
  }

  document.querySelectorAll(".check-list").forEach((container) => {
    container.addEventListener("click", (e) => {
      const item = e.target.closest(".check-item");
      if (!item) return;
      const routine = routines.find((r) => r.id === item.dataset.id);
      if (!routine) return;
      const now = new Date();
      const key = periodKeyFor(routine.period, now);
      const done = isDone(routine, now);
      toggleCompletion(routine.id, key, !done).catch((err) => console.error("Gagal update status cek:", err));
    });
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

  document.getElementById("navAdd").addEventListener("click", () => openRoutineModal(null));

  document.getElementById("routineFilterTabs").addEventListener("click", (e) => {
    const tab = e.target.closest(".filter-tab");
    if (!tab) return;
    activePeriodFilter = tab.dataset.filter;
    renderRoutineFilterTabs();
    renderRoutineList();
  });

  /* ================= Init ================= */

  initTheme();
  subscribeRoutine();
})();
