/* =========================================================
   Kitchen App — script.js
   Data resep & belanja disimpan di Firebase Realtime DB di
   bawah path /kitchen (lihat firebaseConfig di index.html).

   Struktur data:
     kitchen/
       recipes/
         <pushId>/ { name, category, servings, time, ingredients: [{name, qty}],
                     steps: [string], note, createdAt }
       categories/
         <id>/ { id, label, icon, colorSlot } // 1 daftar (tidak dipisah expense/income)
       shopping/
         <pushId>/ { name, qty, done, createdAt }

   Preferensi tema disimpan lokal (localStorage).
   ========================================================= */

(function () {
  "use strict";

  const STORAGE_KEYS = { theme: "kitchenapp_theme" };

  /* ---------------- Default categories (seed sekali kalau kosong) ---------------- */
  const DEFAULT_CATEGORIES = [
    { id: "sarapan", label: "Sarapan", icon: "🍳", colorSlot: 1 },
    { id: "makan-siang", label: "Makan Siang", icon: "🍛", colorSlot: 2 },
    { id: "makan-malam", label: "Makan Malam", icon: "🍽️", colorSlot: 3 },
    { id: "camilan", label: "Camilan", icon: "🍪", colorSlot: 4 },
    { id: "minuman", label: "Minuman", icon: "🥤", colorSlot: 5 },
    { id: "dessert", label: "Dessert", icon: "🍰", colorSlot: 6 },
    { id: "lauk", label: "Lauk", icon: "🍗", colorSlot: 7 },
    { id: "lainnya", label: "Lainnya", icon: "📦", colorSlot: 8 },
  ];
  const FALLBACK_CATEGORY = { id: "", label: "Tanpa Kategori", icon: "📦", colorSlot: 8 };

  /* ---------------- State ---------------- */
  let recipes = [];
  let categories = [];
  let shopping = [];
  let activeCategoryFilter = "all";
  let searchQuery = "";

  function getCategory(id) {
    return categories.find((c) => c.id === id) || FALLBACK_CATEGORY;
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

  const kitchenRef = db.ref(KITCHEN_PATH);

  let categoriesSeeded = false;
  function seedCategoriesIfEmpty(root) {
    if (categoriesSeeded) return;
    categoriesSeeded = true;
    if (root && root.categories) return;
    const updates = {};
    DEFAULT_CATEGORIES.forEach((cat) => {
      updates["categories/" + cat.id] = cat;
    });
    kitchenRef.update(updates).catch((e) => console.error("Seed kategori gagal:", e));
  }

  function subscribeKitchen() {
    kitchenRef.on(
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
    const recipesObj = root.recipes || {};
    recipes = Object.keys(recipesObj).map((id) => {
      const r = recipesObj[id] || {};
      return {
        id,
        name: r.name || "",
        category: r.category || "",
        servings: r.servings || "",
        time: r.time || "",
        ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
        steps: Array.isArray(r.steps) ? r.steps : [],
        note: r.note || "",
        createdAt: Number(r.createdAt) || 0,
      };
    });

    const categoriesObj = root.categories || {};
    categories = Object.keys(categoriesObj)
      .map((id) => categoriesObj[id])
      .sort((a, b) => (Number(a.colorSlot) || 0) - (Number(b.colorSlot) || 0));

    const shoppingObj = root.shopping || {};
    shopping = Object.keys(shoppingObj).map((id) => {
      const s = shoppingObj[id] || {};
      return { id, name: s.name || "", qty: s.qty || "", done: !!s.done, createdAt: Number(s.createdAt) || 0 };
    });
  }

  // ---- Operasi tulis: Resep ----

  function addRecipe(data) {
    const ts = Date.now();
    return kitchenRef.child("recipes/" + ts).set({ ...data, createdAt: ts });
  }

  function updateRecipe(id, data) {
    return kitchenRef.child("recipes/" + id).update(data);
  }

  function deleteRecipe(id) {
    return kitchenRef.child("recipes/" + id).remove();
  }

  // ---- Operasi tulis: Kategori ----

  function saveCategory(data) {
    return kitchenRef.child("categories/" + data.id).set(data);
  }

  function deleteCategory(id) {
    return kitchenRef.child("categories/" + id).remove();
  }

  // ---- Operasi tulis: Belanja ----

  function addShoppingItem(data) {
    const ts = Date.now();
    return kitchenRef.child("shopping/" + ts).set({ ...data, createdAt: ts });
  }

  function toggleShoppingItem(id, done) {
    return kitchenRef.child("shopping/" + id + "/done").set(done);
  }

  function deleteShoppingItem(id) {
    return kitchenRef.child("shopping/" + id).remove();
  }

  function clearDoneShopping() {
    const updates = {};
    shopping.filter((s) => s.done).forEach((s) => (updates["shopping/" + s.id] = null));
    if (Object.keys(updates).length) return kitchenRef.update(updates);
    return Promise.resolve();
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

  /* ================= Category color helpers ================= */

  function chipStyle(slot) {
    return "background: color-mix(in srgb, var(--series-" + slot + ") 18%, var(--color-surface)); color: var(--series-" + slot + ");";
  }

  function swatchStyle(slot) {
    return "background: var(--series-" + slot + ");";
  }

  /* ================= Render: all ================= */

  function renderAll() {
    renderDashboard();
    renderRecipeFilterTabs();
    renderRecipeList();
    renderShoppingList();
    if (document.getElementById("categoriesModal").classList.contains("open")) renderCategoriesModal();
  }

  /* ================= Render: Dashboard ================= */

  function recipeCardHTML(recipe) {
    const cat = getCategory(recipe.category);
    const metaParts = [];
    if (recipe.time) metaParts.push("⏱ " + escapeHtml(recipe.time));
    if (recipe.servings) metaParts.push("🍽 " + escapeHtml(recipe.servings));
    return (
      '<div class="recipe-item" data-id="' + recipe.id + '">' +
      '<div class="recipe-icon" style="' + chipStyle(cat.colorSlot) + '">' + escapeHtml(cat.icon) + "</div>" +
      '<div class="recipe-info">' +
      '<p class="recipe-name">' + escapeHtml(recipe.name) + "</p>" +
      '<p class="recipe-meta">' + (metaParts.join(" &middot; ") || "&mdash;") + "</p>" +
      "</div>" +
      '<span class="recipe-category-badge" style="' + chipStyle(cat.colorSlot) + '">' + escapeHtml(cat.label) + "</span>" +
      "</div>"
    );
  }

  function renderDashboard() {
    document.getElementById("statRecipeCount").textContent = recipes.length;
    document.getElementById("statCategoryCount").textContent = categories.length;
    document.getElementById("statShoppingCount").textContent = shopping.filter((s) => !s.done).length;

    const recent = [...recipes].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
    const recentEl = document.getElementById("recentRecipes");
    recentEl.innerHTML = recent.length
      ? recent.map(recipeCardHTML).join("")
      : '<p class="empty-state">Belum ada resep. Tambahkan resep pertamamu!</p>';

    const breakdownEl = document.getElementById("categoryBreakdown");
    const withCount = categories
      .map((c) => ({ ...c, count: recipes.filter((r) => r.category === c.id).length }))
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

  /* ================= Render: Resep ================= */

  function renderRecipeFilterTabs() {
    const tabsEl = document.getElementById("recipeFilterTabs");
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

  function renderRecipeList() {
    const listEl = document.getElementById("recipeList");
    let filtered = recipes;
    if (activeCategoryFilter !== "all") filtered = filtered.filter((r) => r.category === activeCategoryFilter);
    if (searchQuery) filtered = filtered.filter((r) => r.name.toLowerCase().includes(searchQuery));
    filtered = [...filtered].sort((a, b) => b.createdAt - a.createdAt);

    listEl.innerHTML = filtered.length
      ? filtered.map(recipeCardHTML).join("")
      : '<p class="empty-state">Belum ada resep pada kategori ini.</p>';
  }

  /* ================= Recipe modal (add/edit) ================= */

  const recipeModal = document.getElementById("recipeModal");
  const recipeForm = document.getElementById("recipeForm");
  let editingRecipeId = null;

  function populateCategorySelect(selectEl, selectedId) {
    selectEl.innerHTML = categories.map((c) => '<option value="' + c.id + '">' + escapeHtml(c.icon) + " " + escapeHtml(c.label) + "</option>").join("");
    if (selectedId) selectEl.value = selectedId;
  }

  function ingredientRowHTML(ing) {
    ing = ing || { name: "", qty: "" };
    return (
      '<div class="repeat-row">' +
      '<input type="text" class="ing-name" placeholder="Nama bahan" value="' + escapeHtml(ing.name) + '">' +
      '<input type="text" class="ing-qty" placeholder="Jumlah" value="' + escapeHtml(ing.qty) + '">' +
      '<button type="button" class="repeat-remove" aria-label="Hapus bahan">✕</button>' +
      "</div>"
    );
  }

  function stepRowHTML(text) {
    return (
      '<div class="repeat-row">' +
      '<span class="step-index">1</span>' +
      '<input type="text" class="step-text" placeholder="Deskripsikan langkah ini" value="' + escapeHtml(text || "") + '">' +
      '<button type="button" class="repeat-remove" aria-label="Hapus langkah">✕</button>' +
      "</div>"
    );
  }

  function renumberSteps() {
    document.querySelectorAll("#stepRows .repeat-row").forEach((row, i) => {
      row.querySelector(".step-index").textContent = i + 1;
    });
  }

  document.getElementById("addIngredientBtn").addEventListener("click", () => {
    document.getElementById("ingredientRows").insertAdjacentHTML("beforeend", ingredientRowHTML());
  });

  document.getElementById("addStepBtn").addEventListener("click", () => {
    document.getElementById("stepRows").insertAdjacentHTML("beforeend", stepRowHTML());
    renumberSteps();
  });

  document.getElementById("ingredientRows").addEventListener("click", (e) => {
    if (e.target.classList.contains("repeat-remove")) e.target.closest(".repeat-row").remove();
  });

  document.getElementById("stepRows").addEventListener("click", (e) => {
    if (e.target.classList.contains("repeat-remove")) {
      e.target.closest(".repeat-row").remove();
      renumberSteps();
    }
  });

  function openRecipeModal(recipe) {
    editingRecipeId = recipe ? recipe.id : null;
    document.getElementById("recipeModalTitle").textContent = recipe ? "Ubah Resep" : "Tambah Resep";
    document.getElementById("recipeNameInput").value = recipe ? recipe.name : "";
    document.getElementById("recipeServingsInput").value = recipe ? recipe.servings : "";
    document.getElementById("recipeTimeInput").value = recipe ? recipe.time : "";
    document.getElementById("recipeNoteInput").value = recipe ? recipe.note : "";

    populateCategorySelect(document.getElementById("recipeCategoryInput"), recipe ? recipe.category : categories[0] && categories[0].id);

    const ingredientRows = document.getElementById("ingredientRows");
    const stepRows = document.getElementById("stepRows");
    const ingredients = recipe && recipe.ingredients.length ? recipe.ingredients : [{ name: "", qty: "" }];
    const steps = recipe && recipe.steps.length ? recipe.steps : [""];
    ingredientRows.innerHTML = ingredients.map(ingredientRowHTML).join("");
    stepRows.innerHTML = steps.map(stepRowHTML).join("");
    renumberSteps();

    recipeModal.classList.add("open");
  }

  function closeRecipeModal() {
    recipeModal.classList.remove("open");
    editingRecipeId = null;
  }

  document.getElementById("cancelRecipeBtn").addEventListener("click", closeRecipeModal);
  recipeModal.addEventListener("click", (e) => {
    if (e.target === recipeModal) closeRecipeModal();
  });

  recipeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const ingredients = [...document.querySelectorAll("#ingredientRows .repeat-row")]
      .map((row) => ({ name: row.querySelector(".ing-name").value.trim(), qty: row.querySelector(".ing-qty").value.trim() }))
      .filter((ing) => ing.name);
    const steps = [...document.querySelectorAll("#stepRows .repeat-row")]
      .map((row) => row.querySelector(".step-text").value.trim())
      .filter((s) => s);

    const data = {
      name: document.getElementById("recipeNameInput").value.trim(),
      category: document.getElementById("recipeCategoryInput").value,
      servings: document.getElementById("recipeServingsInput").value.trim(),
      time: document.getElementById("recipeTimeInput").value.trim(),
      ingredients,
      steps,
      note: document.getElementById("recipeNoteInput").value.trim(),
    };
    if (!data.name) return;

    const action = editingRecipeId ? updateRecipe(editingRecipeId, data) : addRecipe(data);
    action.catch((err) => {
      console.error("Gagal menyimpan resep:", err);
      alert("Gagal menyimpan resep. Cek koneksi internet.");
    });
    closeRecipeModal();
  });

  /* ================= Recipe detail modal ================= */

  const recipeDetailModal = document.getElementById("recipeDetailModal");
  let currentDetailRecipeId = null;

  function openRecipeDetail(recipe) {
    currentDetailRecipeId = recipe.id;
    const cat = getCategory(recipe.category);

    document.getElementById("detailIcon").style.cssText = chipStyle(cat.colorSlot);
    document.getElementById("detailIcon").textContent = cat.icon;
    document.getElementById("detailName").textContent = recipe.name;
    const badge = document.getElementById("detailCategoryBadge");
    badge.textContent = cat.label;
    badge.style.cssText = chipStyle(cat.colorSlot);

    document.getElementById("detailServings").textContent = recipe.servings || "—";
    document.getElementById("detailTime").textContent = recipe.time || "—";

    const ingList = document.getElementById("detailIngredients");
    ingList.innerHTML = recipe.ingredients.length
      ? recipe.ingredients
          .map((ing) => '<li><span class="ing-name">' + escapeHtml(ing.name) + '</span><span class="ing-qty">' + escapeHtml(ing.qty) + "</span></li>")
          .join("")
      : '<li><span class="ing-name">Belum ada bahan tercatat.</span></li>';

    const stepList = document.getElementById("detailSteps");
    stepList.innerHTML = recipe.steps.length
      ? recipe.steps.map((s) => "<li>" + escapeHtml(s) + "</li>").join("")
      : "<li>Belum ada langkah tercatat.</li>";

    const noteWrap = document.getElementById("detailNoteWrap");
    if (recipe.note) {
      noteWrap.hidden = false;
      document.getElementById("detailNote").textContent = recipe.note;
    } else {
      noteWrap.hidden = true;
    }

    recipeDetailModal.classList.add("open");
  }

  function closeRecipeDetail() {
    recipeDetailModal.classList.remove("open");
    currentDetailRecipeId = null;
  }

  recipeDetailModal.addEventListener("click", (e) => {
    if (e.target === recipeDetailModal) closeRecipeDetail();
  });

  document.getElementById("editRecipeBtn").addEventListener("click", () => {
    const recipe = recipes.find((r) => r.id === currentDetailRecipeId);
    closeRecipeDetail();
    if (recipe) openRecipeModal(recipe);
  });

  document.getElementById("deleteRecipeBtn").addEventListener("click", () => {
    const recipe = recipes.find((r) => r.id === currentDetailRecipeId);
    if (!recipe) return;
    openConfirm("Hapus Resep?", 'Apakah Anda yakin ingin menghapus resep "' + recipe.name + '"? Tindakan ini tidak dapat dibatalkan.', () => {
      deleteRecipe(recipe.id).catch((err) => {
        console.error("Gagal menghapus resep:", err);
        alert("Gagal menghapus resep. Cek koneksi internet.");
      });
      closeRecipeDetail();
    });
  });

  [document.getElementById("recentRecipes"), document.getElementById("recipeList")].forEach((container) => {
    container.addEventListener("click", (e) => {
      const item = e.target.closest(".recipe-item");
      if (!item) return;
      const recipe = recipes.find((r) => r.id === item.dataset.id);
      if (recipe) openRecipeDetail(recipe);
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

  /* ================= Belanja (shopping list) ================= */

  function renderShoppingList() {
    const listEl = document.getElementById("shoppingList");
    const sorted = [...shopping].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return a.createdAt - b.createdAt;
    });

    listEl.innerHTML = sorted.length
      ? sorted
          .map(
            (item) =>
              '<div class="shopping-item' +
              (item.done ? " done" : "") +
              '" data-id="' +
              item.id +
              '">' +
              '<button type="button" class="shopping-check" aria-label="Tandai selesai">' +
              (item.done ? "✓" : "") +
              "</button>" +
              '<div class="shopping-info">' +
              '<p class="shopping-name">' +
              escapeHtml(item.name) +
              "</p>" +
              (item.qty ? '<p class="shopping-qty">' + escapeHtml(item.qty) + "</p>" : "") +
              "</div>" +
              '<button type="button" class="shopping-delete" aria-label="Hapus">🗑️</button>' +
              "</div>"
          )
          .join("")
      : '<p class="empty-state">Daftar belanja kosong. Tambahkan bahan yang perlu dibeli.</p>';

    document.getElementById("clearDoneBtn").hidden = !shopping.some((s) => s.done);
  }

  document.getElementById("shoppingList").addEventListener("click", (e) => {
    const row = e.target.closest(".shopping-item");
    if (!row) return;
    const id = row.dataset.id;
    const item = shopping.find((s) => s.id === id);
    if (!item) return;

    if (e.target.classList.contains("shopping-check")) {
      toggleShoppingItem(id, !item.done).catch((err) => console.error("Gagal update status belanja:", err));
    } else if (e.target.classList.contains("shopping-delete")) {
      deleteShoppingItem(id).catch((err) => console.error("Gagal menghapus item belanja:", err));
    }
  });

  document.getElementById("clearDoneBtn").addEventListener("click", () => {
    clearDoneShopping().catch((err) => console.error("Gagal membersihkan daftar belanja:", err));
  });

  const shoppingModal = document.getElementById("shoppingModal");
  const shoppingForm = document.getElementById("shoppingForm");

  function openShoppingModal() {
    shoppingForm.reset();
    shoppingModal.classList.add("open");
  }

  function closeShoppingModal() {
    shoppingModal.classList.remove("open");
  }

  document.getElementById("addShoppingBtn").addEventListener("click", openShoppingModal);
  document.getElementById("cancelShoppingBtn").addEventListener("click", closeShoppingModal);
  shoppingModal.addEventListener("click", (e) => {
    if (e.target === shoppingModal) closeShoppingModal();
  });

  shoppingForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("shoppingNameInput").value.trim();
    if (!name) return;
    const qty = document.getElementById("shoppingQtyInput").value.trim();
    addShoppingItem({ name, qty, done: false }).catch((err) => {
      console.error("Gagal menambah item belanja:", err);
      alert("Gagal menambah item belanja. Cek koneksi internet.");
    });
    closeShoppingModal();
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
        'Apakah Anda yakin ingin menghapus kategori "' + cat.label + '"? Resep lama dengan kategori ini tetap tersimpan tapi tampil sebagai "Tanpa Kategori".',
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

  document.getElementById("navAdd").addEventListener("click", () => openRecipeModal(null));

  document.getElementById("recipeSearchInput").addEventListener("input", (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderRecipeList();
  });

  document.getElementById("recipeFilterTabs").addEventListener("click", (e) => {
    const tab = e.target.closest(".filter-tab");
    if (!tab) return;
    activeCategoryFilter = tab.dataset.filter;
    renderRecipeFilterTabs();
    renderRecipeList();
  });

  /* ================= Init ================= */

  initTheme();
  subscribeKitchen();
})();
