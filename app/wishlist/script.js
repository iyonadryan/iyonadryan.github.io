/* =========================================================
   Wishlist App — script.js
   Data wishlist & kategori disimpan di Firebase Realtime DB
   di bawah path /wishlist (lihat firebaseConfig di index.html).

   Struktur data:
     wishlist/
       items/
         <timestamp>/ { title, description, link, category, priority,
                         achieved, achievedAt, by, createdAt, updatedAt }
         // priority: "rendah" | "sedang" | "tinggi" — enum tetap, lihat
         //   PRIORITY_META (pola sama dgn PERIOD_META Routine App).
         // achieved: sudah didapat/tercapai — toggle low-stakes, TIDAK
         //   mengubah updatedAt (pola sama dgn togglePinBtn Note App).
         //   achievedAt diisi Date.now() saat ditandai, null saat dibatalkan.
         // by: "iyon" | "ciwul" — siapa yang bikin wishlist itu, dipilih manual
         //   tiap tambah/ubah (TIDAK ada konsep "pengguna aktif" device-level
         //   spt Finance/Routine App — lihat bagian "Dibuat oleh" di bawah).
       categories/
         <id>/ { id, label, icon, colorSlot } // 1 daftar flat, sama pola dgn Note/Kitchen App

   Preferensi tema disimpan lokal (localStorage).
   ========================================================= */

(function () {
  "use strict";

  const STORAGE_KEYS = { theme: "wishlistapp_theme" };

  /* ---------------- Pembuat wishlist (Iyon / Ciwul) ---------------- */
  // Cuma dipakai utk lookup label/ikon badge "Dibuat oleh" — BUKAN pengguna
  // aktif device-level (app ini tidak scope tampilan per-user, semua item
  // selalu tampil ke siapa pun yang buka app; field `by` murni atribusi).
  // Pola identik dgn Note App.
  const USERS = {
    iyon: { id: "iyon", label: "Iyon", icon: "../img/iyon.png" },
    ciwul: { id: "ciwul", label: "Ciwul", icon: "../img/ciwul.png" },
  };

  /* ---------------- Default categories (seed sekali kalau kosong) ---------------- */
  const DEFAULT_CATEGORIES = [
    { id: "elektronik", label: "Elektronik", icon: "📱", colorSlot: 1 },
    { id: "fashion", label: "Fashion", icon: "👕", colorSlot: 2 },
    { id: "hobi", label: "Hobi", icon: "🎨", colorSlot: 3 },
    { id: "lainnya", label: "Lainnya", icon: "📦", colorSlot: 4 },
  ];
  const FALLBACK_CATEGORY = { id: "", label: "Tanpa Kategori", icon: "📦", colorSlot: 8 };

  /* ---------------- Prioritas (enum tetap, bukan kategori bikinan user) ---------------- */
  // Warna fixed (--priority-*) independen dari palet kategorikal --series-1..8
  // (yang divalidasi lewat skill dataviz) — sama alasan dgn PERIOD_META Routine
  // App: cuma 3 nilai enum tetap, bukan kategori terbuka.
  // Urutan naik (Rendah→Tinggi) — dipakai tab filter prioritas, sama urutan
  // dgn toggle Rendah/Sedang/Tinggi di modal Tambah/Ubah. Urutan sortir list
  // (Tinggi dulu) diatur terpisah lewat PRIORITY_WEIGHT, lihat sortByPriorityThenDate().
  const PRIORITY_ORDER = ["rendah", "sedang", "tinggi"];
  const PRIORITY_WEIGHT = { tinggi: 3, sedang: 2, rendah: 1 };
  const PRIORITY_META = {
    tinggi: { label: "Tinggi", varName: "--priority-tinggi" },
    sedang: { label: "Sedang", varName: "--priority-sedang" },
    rendah: { label: "Rendah", varName: "--priority-rendah" },
  };

  const MONTH_NAMES = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];

  /* ---------------- State ---------------- */
  let items = [];
  let categories = [];
  let activeCategoryFilter = "all";
  let activePriorityFilter = "all";
  let searchQuery = "";

  function getCategory(id) {
    return categories.find((c) => c.id === id) || FALLBACK_CATEGORY;
  }

  function getPriorityMeta(p) {
    return PRIORITY_META[p] || PRIORITY_META.sedang;
  }

  function slugify(text) {
    return String(text)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "kategori";
  }

  function uniqueSlug(base) {
    let slug = base;
    let n = 2;
    while (categories.some((c) => c.id === slug)) {
      slug = base + "-" + n;
      n++;
    }
    return slug;
  }

  /* ================= Firebase data layer ================= */

  const wishlistRef = db.ref(WISHLIST_PATH);

  let categoriesSeeded = false;
  function seedCategoriesIfEmpty(root) {
    if (categoriesSeeded) return;
    categoriesSeeded = true;
    if (root && root.categories) return;
    const updates = {};
    DEFAULT_CATEGORIES.forEach((cat) => {
      updates["categories/" + cat.id] = cat;
    });
    wishlistRef.update(updates).catch((e) => console.error("Seed kategori gagal:", e));
  }

  function subscribeWishlist() {
    wishlistRef.on(
      "value",
      (snapshot) => {
        const root = snapshot.val() || {};
        seedCategoriesIfEmpty(root);
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
    const itemsObj = root.items || {};
    items = Object.keys(itemsObj).map((id) => {
      const it = itemsObj[id] || {};
      return {
        id,
        title: it.title || "",
        description: it.description || "",
        link: it.link || "",
        category: it.category || "",
        priority: PRIORITY_META[it.priority] ? it.priority : "sedang",
        achieved: !!it.achieved,
        achievedAt: Number(it.achievedAt) || 0,
        by: it.by === "ciwul" ? "ciwul" : "iyon",
        createdAt: Number(it.createdAt) || 0,
        updatedAt: Number(it.updatedAt) || Number(it.createdAt) || 0,
      };
    });

    const categoriesObj = root.categories || {};
    categories = Object.keys(categoriesObj)
      .map((id) => categoriesObj[id])
      .sort((a, b) => (Number(a.colorSlot) || 0) - (Number(b.colorSlot) || 0));
  }

  // ---- Operasi tulis: Wishlist ----

  function addWishlist(data) {
    const ts = Date.now();
    return wishlistRef.child("items/" + ts).set({ ...data, achieved: false, achievedAt: null, createdAt: ts, updatedAt: ts });
  }

  function updateWishlist(id, data) {
    return wishlistRef.child("items/" + id).update({ ...data, updatedAt: Date.now() });
  }

  function deleteWishlist(id) {
    return wishlistRef.child("items/" + id).remove();
  }

  function toggleAchieved(id, achieved) {
    return wishlistRef.child("items/" + id).update({ achieved, achievedAt: achieved ? Date.now() : null });
  }

  // ---- Operasi tulis: Kategori ----

  function saveCategory(data) {
    return wishlistRef.child("categories/" + data.id).set(data);
  }

  function deleteCategory(id) {
    return wishlistRef.child("categories/" + id).remove();
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

  /* ================= Category / priority color helpers ================= */

  function chipStyle(slot) {
    return "background: color-mix(in srgb, var(--series-" + slot + ") 18%, var(--color-surface)); color: var(--series-" + slot + ");";
  }

  function swatchStyle(slot) {
    return "background: var(--series-" + slot + ");";
  }

  function priorityChipStyle(priority) {
    const v = getPriorityMeta(priority).varName;
    return "background: color-mix(in srgb, var(" + v + ") 18%, var(--color-surface)); color: var(" + v + ");";
  }

  /* ================= Utilities ================= */

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function snippet(text) {
    const flat = String(text || "").replace(/\s+/g, " ").trim();
    return flat.length > 70 ? flat.slice(0, 70) + "…" : flat;
  }

  function formatDateLong(ms) {
    if (!ms) return "—";
    const d = new Date(ms);
    return d.getDate() + " " + MONTH_NAMES[d.getMonth()] + " " + d.getFullYear();
  }

  // Link disimpan apa adanya (tampil persis ketikan user), tapi kalau belum
  // ada skema http(s) di depannya, href-nya di-prefix "https://" biar link
  // tetap bisa diklik walau user males ngetik protokolnya.
  function normalizeLink(url) {
    const trimmed = String(url || "").trim();
    if (!trimmed) return "";
    return /^https?:\/\//i.test(trimmed) ? trimmed : "https://" + trimmed;
  }

  /* ================= Render: all ================= */

  function renderAll() {
    renderDashboard();
    renderWishlistFilterTabs();
    renderWishlistPriorityFilterTabs();
    renderWishlistList();
    renderAchievedList();
    if (document.getElementById("categoriesModal").classList.contains("open")) renderCategoriesModal();
    if (wishlistDetailModal.classList.contains("open") && currentDetailItemId) {
      const item = items.find((i) => i.id === currentDetailItemId);
      if (item) renderWishlistDetail(item);
      else closeWishlistDetail(); // item dihapus dari device lain saat modal terbuka
    }
  }

  /* ================= Render: Dashboard & shared card ================= */

  function itemCardHTML(item) {
    const cat = getCategory(item.category);
    const pMeta = getPriorityMeta(item.priority);
    const creatorBadge = USERS[item.by]
      ? '<img class="creator-badge" src="' + USERS[item.by].icon + '" data-by="' + item.by + '" alt="' + USERS[item.by].label + '">'
      : "";
    return (
      '<div class="wishlist-item" data-id="' + item.id + '">' +
      '<div class="wishlist-icon" style="' + chipStyle(cat.colorSlot) + '">' + escapeHtml(cat.icon) + creatorBadge + "</div>" +
      '<div class="wishlist-info">' +
      '<p class="wishlist-title">' + escapeHtml(item.title) + "</p>" +
      (item.description ? '<p class="wishlist-snippet">' + escapeHtml(snippet(item.description)) + "</p>" : "") +
      "</div>" +
      '<div class="wishlist-badges">' +
      '<span class="wishlist-category-badge" style="' + chipStyle(cat.colorSlot) + '">' + escapeHtml(cat.label) + "</span>" +
      '<span class="wishlist-priority-badge" style="' + priorityChipStyle(item.priority) + '">' + escapeHtml(pMeta.label) + "</span>" +
      "</div>" +
      "</div>"
    );
  }

  function renderDashboard() {
    const active = items.filter((i) => !i.achieved);
    const achievedItems = items.filter((i) => i.achieved);

    document.getElementById("statActiveCount").textContent = active.length;
    document.getElementById("statCategoryCount").textContent = categories.length;
    document.getElementById("statAchievedCount").textContent = achievedItems.length;

    const recent = [...active].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4);
    const recentEl = document.getElementById("recentWishlist");
    recentEl.innerHTML = recent.length
      ? recent.map(itemCardHTML).join("")
      : '<p class="empty-state">Belum ada wishlist. Tambahkan keinginan pertamamu!</p>';

    const breakdownEl = document.getElementById("categoryBreakdown");
    const withCount = categories
      .map((c) => ({ ...c, count: items.filter((i) => i.category === c.id).length }))
      .filter((c) => c.count > 0);
    breakdownEl.innerHTML = withCount.length
      ? withCount
          .map(
            (c) =>
              '<span class="breakdown-chip"><span class="chip-swatch" style="' +
              swatchStyle(c.colorSlot) +
              '"></span>' +
              escapeHtml(c.label) +
              ' <span class="chip-count">' +
              c.count +
              "</span></span>"
          )
          .join("")
      : '<p class="empty-state">Belum ada data kategori.</p>';
  }

  /* ================= Render: Wishlist (aktif) & Tercapai ================= */

  function renderWishlistFilterTabs() {
    const tabsEl = document.getElementById("wishlistFilterTabs");
    let html = '<button class="filter-tab' + (activeCategoryFilter === "all" ? " active" : "") + '" data-filter="all">Semua</button>';
    html += categories
      .map(
        (c) =>
          '<button class="filter-tab' +
          (activeCategoryFilter === c.id ? " active" : "") +
          '" data-filter="' +
          c.id +
          '">' +
          escapeHtml(c.icon) +
          " " +
          escapeHtml(c.label) +
          "</button>"
      )
      .join("");
    tabsEl.innerHTML = html;
  }

  // Tab filter kedua (di bawah kategori) — beririsan (AND) dgn filter kategori
  // & search. Pakai attribute data-priority terpisah dari data-filter (yg
  // dibaca listener klik) semata utk CSS pewarnaan per-tombol, sama pola dgn
  // .priority-toggle di modal Tambah/Ubah (lihat components.css).
  function renderWishlistPriorityFilterTabs() {
    const tabsEl = document.getElementById("wishlistPriorityFilterTabs");
    let html = '<button class="filter-tab' + (activePriorityFilter === "all" ? " active" : "") + '" data-filter="all">Semua</button>';
    html += PRIORITY_ORDER.map(
      (p) =>
        '<button class="filter-tab' +
        (activePriorityFilter === p ? " active" : "") +
        '" data-filter="' +
        p +
        '" data-priority="' +
        p +
        '">' +
        escapeHtml(getPriorityMeta(p).label) +
        "</button>"
    ).join("");
    tabsEl.innerHTML = html;
  }

  // Urutan default: prioritas tinggi dulu, lalu yg terbaru — jadi wishlist
  // penting selalu kelihatan duluan tanpa perlu filter tambahan.
  function sortByPriorityThenDate(list) {
    return [...list].sort((a, b) => {
      const w = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      return w !== 0 ? w : b.createdAt - a.createdAt;
    });
  }

  function renderWishlistList() {
    const listEl = document.getElementById("wishlistList");
    let filtered = items.filter((i) => !i.achieved);
    if (activeCategoryFilter !== "all") filtered = filtered.filter((i) => i.category === activeCategoryFilter);
    if (activePriorityFilter !== "all") filtered = filtered.filter((i) => i.priority === activePriorityFilter);
    if (searchQuery) {
      filtered = filtered.filter(
        (i) => i.title.toLowerCase().includes(searchQuery) || i.description.toLowerCase().includes(searchQuery)
      );
    }
    filtered = sortByPriorityThenDate(filtered);

    listEl.innerHTML = filtered.length
      ? filtered.map(itemCardHTML).join("")
      : '<p class="empty-state">Belum ada wishlist pada kategori/prioritas ini.</p>';
  }

  function renderAchievedList() {
    const listEl = document.getElementById("achievedList");
    const achievedItems = items
      .filter((i) => i.achieved)
      .sort((a, b) => b.achievedAt - a.achievedAt);

    listEl.innerHTML = achievedItems.length
      ? achievedItems.map(itemCardHTML).join("")
      : '<p class="empty-state">Belum ada wishlist yang tercapai. Tandai "Sudah Didapat" kalau sudah kesampaian!</p>';
  }

  [document.getElementById("recentWishlist"), document.getElementById("wishlistList"), document.getElementById("achievedList")].forEach(
    (container) => {
      container.addEventListener("click", (e) => {
        const badge = e.target.closest(".creator-badge");
        if (badge) {
          openCreatorInfo(badge.dataset.by);
          return;
        }
        const el = e.target.closest(".wishlist-item");
        if (!el) return;
        const item = items.find((i) => i.id === el.dataset.id);
        if (item) openWishlistDetail(item);
      });
    }
  );

  /* ================= Wishlist modal (add/edit) ================= */

  const wishlistModal = document.getElementById("wishlistModal");
  const wishlistForm = document.getElementById("wishlistForm");
  const wishlistByToggle = document.getElementById("wishlistByToggle");
  const priorityToggle = document.getElementById("priorityToggle");
  let editingItemId = null;

  function populateCategorySelect(selectEl, selectedId) {
    selectEl.innerHTML = categories.map((c) => '<option value="' + c.id + '">' + escapeHtml(c.icon) + " " + escapeHtml(c.label) + "</option>").join("");
    if (selectedId) selectEl.value = selectedId;
  }

  function setPriorityToggleValue(priority) {
    priorityToggle.querySelectorAll(".mode-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.priority === priority);
    });
  }

  priorityToggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".mode-btn");
    if (!btn) return;
    setPriorityToggleValue(btn.dataset.priority);
  });

  function wishlistFormPriority() {
    const active = priorityToggle.querySelector(".mode-btn.active");
    return active ? active.dataset.priority : "sedang";
  }

  // Set toggle 2-tombol (Dibuat oleh) ke satu nilai, opsional dikunci (dipakai
  // saat edit — pembuat tidak bisa diubah retroaktif). Pola identik dgn Note App.
  function setByToggleValue(toggleId, by, locked) {
    const toggle = document.getElementById(toggleId);
    toggle.querySelectorAll(".mode-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.by === by);
      b.disabled = locked;
    });
    toggle.classList.toggle("locked", locked);
  }

  wishlistByToggle.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return; // dikunci saat edit
      wishlistByToggle.querySelectorAll(".mode-btn").forEach((b) => b.classList.toggle("active", b === btn));
    });
  });

  // Baca toggle "Dibuat oleh" di modal (default "iyon" kalau entah kenapa
  // belum ada yang aktif).
  function wishlistFormBy() {
    const active = wishlistByToggle.querySelector(".mode-btn.active");
    return active ? active.dataset.by : "iyon";
  }

  function openWishlistModal(item) {
    editingItemId = item ? item.id : null;
    document.getElementById("wishlistModalTitle").textContent = item ? "Ubah Wishlist" : "Tambah Wishlist";
    document.getElementById("wishlistTitleInput").value = item ? item.title : "";
    document.getElementById("wishlistDescInput").value = item ? item.description : "";
    document.getElementById("wishlistLinkInput").value = item ? item.link : "";

    populateCategorySelect(document.getElementById("wishlistCategoryInput"), item ? item.category : categories[0] && categories[0].id);
    setPriorityToggleValue(item ? item.priority : "sedang");

    setByToggleValue("wishlistByToggle", item ? item.by : "iyon", !!item);

    wishlistModal.classList.add("open");
  }

  function closeWishlistModal() {
    wishlistModal.classList.remove("open");
    editingItemId = null;
  }

  document.getElementById("cancelWishlistBtn").addEventListener("click", closeWishlistModal);
  wishlistModal.addEventListener("click", (e) => {
    if (e.target === wishlistModal) closeWishlistModal();
  });

  document.getElementById("navAdd").addEventListener("click", () => openWishlistModal(null));

  wishlistForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = {
      title: document.getElementById("wishlistTitleInput").value.trim(),
      description: document.getElementById("wishlistDescInput").value.trim(),
      link: normalizeLink(document.getElementById("wishlistLinkInput").value),
      category: document.getElementById("wishlistCategoryInput").value,
      priority: wishlistFormPriority(),
      by: wishlistFormBy(),
    };
    if (!data.title) return;

    const action = editingItemId ? updateWishlist(editingItemId, data) : addWishlist(data);
    action.catch((err) => {
      console.error("Gagal menyimpan wishlist:", err);
      alert("Gagal menyimpan wishlist. Cek koneksi internet.");
    });
    closeWishlistModal();
  });

  /* ================= Wishlist detail modal ================= */

  const wishlistDetailModal = document.getElementById("wishlistDetailModal");
  let currentDetailItemId = null;

  function renderWishlistDetail(item) {
    const cat = getCategory(item.category);
    const pMeta = getPriorityMeta(item.priority);

    document.getElementById("detailIcon").style.cssText = chipStyle(cat.colorSlot);
    document.getElementById("detailIcon").textContent = cat.icon;
    document.getElementById("detailTitle").textContent = item.title;

    const catBadge = document.getElementById("detailCategoryBadge");
    catBadge.textContent = cat.label;
    catBadge.style.cssText = chipStyle(cat.colorSlot);

    const priBadge = document.getElementById("detailPriorityBadge");
    priBadge.textContent = pMeta.label;
    priBadge.style.cssText = priorityChipStyle(item.priority);

    document.getElementById("detailCreatedAt").textContent = formatDateLong(item.createdAt);
    document.getElementById("detailUpdatedAt").textContent = item.updatedAt && item.updatedAt !== item.createdAt ? formatDateLong(item.updatedAt) : "—";
    document.getElementById("detailBy").textContent = USERS[item.by] ? USERS[item.by].label : "—";

    const achievedNote = document.getElementById("detailAchievedNote");
    achievedNote.hidden = !item.achieved;
    if (item.achieved) document.getElementById("detailAchievedText").textContent = "Tercapai pada " + formatDateLong(item.achievedAt);

    const descWrap = document.getElementById("detailDescWrap");
    if (item.description) {
      descWrap.hidden = false;
      document.getElementById("detailDescText").textContent = item.description;
    } else {
      descWrap.hidden = true;
    }

    const linkWrap = document.getElementById("detailLinkWrap");
    if (item.link) {
      linkWrap.hidden = false;
      const linkEl = document.getElementById("detailLink");
      linkEl.href = item.link;
      linkEl.textContent = item.link;
    } else {
      linkWrap.hidden = true;
    }

    const achievedBtn = document.getElementById("toggleAchievedBtn");
    achievedBtn.classList.toggle("achieved", item.achieved);
    achievedBtn.textContent = item.achieved ? "✅" : "🎁";
    achievedBtn.setAttribute("aria-label", item.achieved ? "Batal tandai sudah didapat" : "Tandai sudah didapat");
  }

  function openWishlistDetail(item) {
    currentDetailItemId = item.id;
    renderWishlistDetail(item);
    wishlistDetailModal.classList.add("open");
  }

  function closeWishlistDetail() {
    wishlistDetailModal.classList.remove("open");
    currentDetailItemId = null;
  }

  wishlistDetailModal.addEventListener("click", (e) => {
    if (e.target === wishlistDetailModal) closeWishlistDetail();
  });

  document.getElementById("detailCloseIconBtn").addEventListener("click", closeWishlistDetail);
  document.getElementById("closeWishlistDetailBtn").addEventListener("click", closeWishlistDetail);

  document.getElementById("toggleAchievedBtn").addEventListener("click", () => {
    const item = items.find((i) => i.id === currentDetailItemId);
    if (!item) return;
    toggleAchieved(item.id, !item.achieved).catch((err) => console.error("Gagal ubah status tercapai:", err));
  });

  document.getElementById("editWishlistBtn").addEventListener("click", () => {
    const item = items.find((i) => i.id === currentDetailItemId);
    closeWishlistDetail();
    if (item) openWishlistModal(item);
  });

  document.getElementById("deleteWishlistBtn").addEventListener("click", () => {
    const item = items.find((i) => i.id === currentDetailItemId);
    if (!item) return;
    openConfirm("Hapus Wishlist?", 'Apakah Anda yakin ingin menghapus wishlist "' + item.title + '"? Tindakan ini tidak dapat dibatalkan.', () => {
      deleteWishlist(item.id).catch((err) => {
        console.error("Gagal menghapus wishlist:", err);
        alert("Gagal menghapus wishlist. Cek koneksi internet.");
      });
      closeWishlistDetail();
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

  /* ================= Kategori (popup CRUD) ================= */

  const categoriesModal = document.getElementById("categoriesModal");

  function renderCategoriesModal() {
    const listEl = document.getElementById("categoriesListEl");
    listEl.innerHTML = categories.length
      ? categories
          .map(
            (c) =>
              '<div class="category-row" data-id="' +
              c.id +
              '">' +
              '<span class="category-swatch" style="' +
              swatchStyle(c.colorSlot) +
              '"></span>' +
              '<span class="category-row-icon">' +
              escapeHtml(c.icon) +
              "</span>" +
              '<div class="category-row-text"><p class="category-row-label">' +
              escapeHtml(c.label) +
              "</p></div>" +
              '<div class="category-actions">' +
              '<button type="button" class="cat-btn cat-edit" aria-label="Ubah kategori">✏️</button>' +
              '<button type="button" class="cat-btn cat-delete" aria-label="Hapus kategori">🗑️</button>' +
              "</div>" +
              "</div>"
          )
          .join("")
      : '<p class="empty-state">Belum ada kategori.</p>';
  }

  document.getElementById("categoriesBtn").addEventListener("click", () => {
    renderCategoriesModal();
    categoriesModal.classList.add("open");
  });

  document.getElementById("cancelCategoriesBtn").addEventListener("click", () => categoriesModal.classList.remove("open"));
  categoriesModal.addEventListener("click", (e) => {
    if (e.target === categoriesModal) categoriesModal.classList.remove("open");
  });

  document.getElementById("categoriesListEl").addEventListener("click", (e) => {
    const row = e.target.closest(".category-row");
    if (!row) return;
    const cat = categories.find((c) => c.id === row.dataset.id);
    if (!cat) return;

    if (e.target.classList.contains("cat-edit")) {
      openCategoryModal(cat);
    } else if (e.target.classList.contains("cat-delete")) {
      openConfirm(
        "Hapus Kategori?",
        'Apakah Anda yakin ingin menghapus kategori "' + cat.label + '"? Wishlist lama dengan kategori ini tetap tersimpan tapi tampil sebagai "Tanpa Kategori".',
        () => {
          deleteCategory(cat.id).catch((err) => console.error("Gagal menghapus kategori:", err));
        }
      );
    }
  });

  /* ---- Modal tambah/edit kategori ---- */

  const categoryModal = document.getElementById("categoryModal");
  const categoryForm = document.getElementById("categoryForm");
  let editingCategoryId = null;
  let chosenColorSlot = 1;

  function renderSlotPicker(selectedSlot) {
    const picker = document.getElementById("categorySlotPicker");
    chosenColorSlot = selectedSlot;
    let html = "";
    for (let slot = 1; slot <= 8; slot++) {
      html +=
        '<button type="button" class="slot-option' +
        (slot === selectedSlot ? " selected" : "") +
        '" data-slot="' +
        slot +
        '" style="' +
        swatchStyle(slot) +
        '" aria-label="Pilih warna ' +
        slot +
        '"></button>';
    }
    picker.innerHTML = html;
  }

  document.getElementById("categorySlotPicker").addEventListener("click", (e) => {
    const btn = e.target.closest(".slot-option");
    if (!btn) return;
    renderSlotPicker(Number(btn.dataset.slot));
  });

  function nextAvailableSlot() {
    for (let slot = 1; slot <= 8; slot++) {
      if (!categories.some((c) => Number(c.colorSlot) === slot)) return slot;
    }
    return 1;
  }

  function openCategoryModal(cat) {
    editingCategoryId = cat ? cat.id : null;
    document.getElementById("categoryModalTitle").textContent = cat ? "Ubah Kategori" : "Tambah Kategori";
    document.getElementById("categoryLabelInput").value = cat ? cat.label : "";
    document.getElementById("categoryIconInput").value = cat ? cat.icon : "";
    renderSlotPicker(cat ? Number(cat.colorSlot) : nextAvailableSlot());
    categoryModal.classList.add("open");
  }

  function closeCategoryModal() {
    categoryModal.classList.remove("open");
    editingCategoryId = null;
  }

  document.getElementById("addCategoryBtn").addEventListener("click", () => openCategoryModal(null));
  document.getElementById("cancelCategoryBtn").addEventListener("click", closeCategoryModal);
  categoryModal.addEventListener("click", (e) => {
    if (e.target === categoryModal) closeCategoryModal();
  });

  categoryForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const label = document.getElementById("categoryLabelInput").value.trim();
    const icon = document.getElementById("categoryIconInput").value.trim();
    if (!label || !icon) return;

    const id = editingCategoryId || uniqueSlug(slugify(label));
    saveCategory({ id, label, icon, colorSlot: chosenColorSlot }).catch((err) => {
      console.error("Gagal menyimpan kategori:", err);
      alert("Gagal menyimpan kategori. Cek koneksi internet.");
    });
    closeCategoryModal();
  });

  /* ================= Info pembuat wishlist ================= */

  // Klik badge foto pembuat (di list) → popup read-only nama lengkapnya,
  // reuse gaya confirm-dialog. Bukan bagian dari sistem "pengguna aktif" —
  // cuma penjelas identitas visual badge. Pola identik dgn Note App.
  const creatorInfoModal = document.getElementById("creatorInfoModal");

  function openCreatorInfo(by) {
    const user = USERS[by] || { label: by, icon: "" };
    const iconEl = document.getElementById("creatorInfoIcon");
    iconEl.innerHTML = user.icon
      ? '<img src="' + user.icon + '" alt="' + user.label + '" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">'
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

  /* ================= Wiring ================= */

  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      goToPage(el.dataset.nav);
    });
  });

  document.getElementById("themeToggle").addEventListener("click", toggleTheme);
  document.getElementById("settingsThemeToggle").addEventListener("click", toggleTheme);

  document.getElementById("wishlistSearchInput").addEventListener("input", (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderWishlistList();
  });

  document.getElementById("wishlistFilterTabs").addEventListener("click", (e) => {
    const tab = e.target.closest(".filter-tab");
    if (!tab) return;
    activeCategoryFilter = tab.dataset.filter;
    renderWishlistFilterTabs();
    renderWishlistList();
  });

  document.getElementById("wishlistPriorityFilterTabs").addEventListener("click", (e) => {
    const tab = e.target.closest(".filter-tab");
    if (!tab) return;
    activePriorityFilter = tab.dataset.filter;
    renderWishlistPriorityFilterTabs();
    renderWishlistList();
  });

  /* ================= Init ================= */

  initTheme();
  subscribeWishlist();
})();
