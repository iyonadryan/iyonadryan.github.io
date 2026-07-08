/* =========================================================
   Note App — script.js
   Data catatan & kategori disimpan di Firebase Realtime DB di
   bawah path /note (lihat firebaseConfig di index.html).

   Struktur data:
     note/
       notes/
         <timestamp>/ { title, content, category, pinned, by, createdAt, updatedAt }
       categories/
         <id>/ { id, label, icon, colorSlot } // 1 daftar flat, sama pola dgn Kitchen App

   by = "iyon" | "ciwul" — siapa yang bikin catatan itu, dipilih manual tiap
   tambah/ubah catatan (TIDAK ada konsep "pengguna aktif" device-level spt
   Finance/Routine App — lihat bagian "Dibuat oleh" di bawah). Preferensi
   tema disimpan lokal (localStorage).
   ========================================================= */

(function () {
  "use strict";

  const STORAGE_KEYS = { theme: "noteapp_theme" };

  /* ---------------- Pembuat catatan (Iyon / Ciwul) ---------------- */
  // Cuma dipakai utk lookup label/ikon badge "Dibuat oleh" — BUKAN pengguna
  // aktif device-level (app ini tidak scope tampilan per-user, semua catatan
  // selalu tampil ke siapa pun yang buka app; field `by` murni atribusi).
  const USERS = {
    iyon: { id: "iyon", label: "Iyon", icon: "../img/iyon.png" },
    ciwul: { id: "ciwul", label: "Ciwul", icon: "../img/ciwul.png" },
  };

  /* ---------------- Default categories (seed sekali kalau kosong) ---------------- */
  const DEFAULT_CATEGORIES = [
    { id: "aktivitas", label: "Aktivitas", icon: "📝", colorSlot: 1 },
    { id: "reminder", label: "Reminder", icon: "⏰", colorSlot: 2 },
    { id: "inspirasi", label: "Inspirasi", icon: "💡", colorSlot: 3 },
    { id: "lainnya", label: "Lainnya", icon: "📦", colorSlot: 4 },
  ];
  const FALLBACK_CATEGORY = { id: "", label: "Tanpa Kategori", icon: "📦", colorSlot: 8 };

  const MONTH_NAMES = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];

  /* ---------------- State ---------------- */
  let notes = [];
  let categories = [];
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

  const noteRef = db.ref(NOTE_PATH);

  let categoriesSeeded = false;
  function seedCategoriesIfEmpty(root) {
    if (categoriesSeeded) return;
    categoriesSeeded = true;
    if (root && root.categories) return;
    const updates = {};
    DEFAULT_CATEGORIES.forEach((cat) => {
      updates["categories/" + cat.id] = cat;
    });
    noteRef.update(updates).catch((e) => console.error("Seed kategori gagal:", e));
  }

  // Backfill sekali jalan: catatan lama (dibuat sebelum fitur multi-user ada)
  // belum punya field `by` — anggap semua milik "iyon" sekali jalan, pola sama
  // dgn migrateRoutineOwners() Routine App.
  let ownersMigrated = false;
  function migrateNoteOwners(root) {
    if (ownersMigrated) return;
    ownersMigrated = true;
    const notesObj = root.notes || {};
    const updates = {};
    Object.keys(notesObj).forEach((id) => {
      if (!notesObj[id].by) updates["notes/" + id + "/by"] = "iyon";
    });
    if (Object.keys(updates).length) noteRef.update(updates).catch((e) => console.error("Migrasi pemilik catatan gagal:", e));
  }

  function subscribeNote() {
    noteRef.on(
      "value",
      (snapshot) => {
        const root = snapshot.val() || {};
        seedCategoriesIfEmpty(root);
        migrateNoteOwners(root);
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
    const notesObj = root.notes || {};
    notes = Object.keys(notesObj).map((id) => {
      const n = notesObj[id] || {};
      return {
        id,
        title: n.title || "",
        content: n.content || "",
        category: n.category || "",
        pinned: !!n.pinned,
        by: n.by === "ciwul" ? "ciwul" : "iyon",
        createdAt: Number(n.createdAt) || 0,
        updatedAt: Number(n.updatedAt) || Number(n.createdAt) || 0,
      };
    });

    const categoriesObj = root.categories || {};
    categories = Object.keys(categoriesObj)
      .map((id) => categoriesObj[id])
      .sort((a, b) => (Number(a.colorSlot) || 0) - (Number(b.colorSlot) || 0));
  }

  // ---- Operasi tulis: Catatan ----

  function addNote(data) {
    const ts = Date.now();
    return noteRef.child("notes/" + ts).set({ ...data, createdAt: ts, updatedAt: ts });
  }

  function updateNote(id, data) {
    return noteRef.child("notes/" + id).update({ ...data, updatedAt: Date.now() });
  }

  function deleteNote(id) {
    return noteRef.child("notes/" + id).remove();
  }

  function toggleNotePinned(id, pinned) {
    return noteRef.child("notes/" + id + "/pinned").set(pinned);
  }

  // ---- Operasi tulis: Kategori ----

  function saveCategory(data) {
    return noteRef.child("categories/" + data.id).set(data);
  }

  function deleteCategory(id) {
    return noteRef.child("categories/" + id).remove();
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

  /* ================= Utilities ================= */

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function snippet(content) {
    const flat = content.replace(/\s+/g, " ").trim();
    return flat.length > 70 ? flat.slice(0, 70) + "…" : flat;
  }

  function formatDateLong(ms) {
    if (!ms) return "—";
    const d = new Date(ms);
    return d.getDate() + " " + MONTH_NAMES[d.getMonth()] + " " + d.getFullYear();
  }

  /* ================= Markdown ringan (isi catatan) =================
     Isi catatan sering ditempel dari rangkuman ber-markdown (heading,
     bold, list, blockquote, link). Render jadi HTML ala Notion di detail
     modal — bukan parser markdown lengkap, cukup buat pola yang lazim
     dipakai di catatan sehari-hari. Selalu escape HTML dulu (lewat
     escapeHtml) sebelum menyisipkan tag, supaya tetap aman dari XSS. */

  // Inline: link (markdown & bare URL) di-stash jadi placeholder duluan
  // biar isi URL/label tidak ikut kena regex bold/italic/code setelahnya.
  function inlineMarkdown(text) {
    const stash = [];
    function stash_(html) {
      stash.push(html);
      return "@@MD" + (stash.length - 1) + "@@";
    }

    let out = escapeHtml(text);

    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, label, url) =>
      stash_('<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + "</a>")
    );
    out = out.replace(/(https?:\/\/[^\s<]+)/g, (m, url) =>
      stash_('<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + "</a>")
    );
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/@@MD(\d+)@@/g, (m, i) => stash[Number(i)]);

    return out;
  }

  function renderMarkdownToHtml(content) {
    const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
    const parts = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed === "") {
        i++;
        continue;
      }

      if (/^-{3,}$/.test(trimmed)) {
        parts.push("<hr>");
        i++;
        continue;
      }

      const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        const level = Math.min(heading[1].length, 6);
        parts.push("<h" + level + ">" + inlineMarkdown(heading[2]) + "</h" + level + ">");
        i++;
        continue;
      }

      if (/^>\s?/.test(trimmed)) {
        const quoted = [];
        while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
          quoted.push("<p>" + inlineMarkdown(lines[i].trim().replace(/^>\s?/, "")) + "</p>");
          i++;
        }
        parts.push("<blockquote>" + quoted.join("") + "</blockquote>");
        continue;
      }

      if (/^\s*\d+\.\s+/.test(line)) {
        const items = [];
        while (i < lines.length) {
          const m = lines[i].match(/^\s*\d+\.\s+(.*)$/);
          if (!m) break;
          items.push("<li>" + inlineMarkdown(m[1]) + "</li>");
          i++;
        }
        parts.push("<ol>" + items.join("") + "</ol>");
        continue;
      }

      if (/^\s*[-*]\s+/.test(line)) {
        const topItems = [];
        while (i < lines.length) {
          const m = lines[i].match(/^(\s*)[-*]\s+(.*)$/);
          if (!m) break;
          const text = inlineMarkdown(m[2]);
          if (m[1].length >= 2 && topItems.length) {
            topItems[topItems.length - 1].nested.push(text);
          } else {
            topItems.push({ text, nested: [] });
          }
          i++;
        }
        const itemsHtml = topItems
          .map((item) => {
            const nestedHtml = item.nested.length ? "<ul>" + item.nested.map((n) => "<li>" + n + "</li>").join("") + "</ul>" : "";
            return "<li>" + item.text + nestedHtml + "</li>";
          })
          .join("");
        parts.push("<ul>" + itemsHtml + "</ul>");
        continue;
      }

      parts.push("<p>" + inlineMarkdown(line) + "</p>");
      i++;
    }

    return parts.join("");
  }

  /* ================= Render: all ================= */

  function renderAll() {
    renderDashboard();
    renderNoteFilterTabs();
    renderNoteList();
    renderPinnedList();
    if (document.getElementById("categoriesModal").classList.contains("open")) renderCategoriesModal();
    if (noteDetailModal.classList.contains("open") && currentDetailNoteId) {
      const note = notes.find((n) => n.id === currentDetailNoteId);
      if (note) renderNoteDetail(note);
      else closeNoteDetail(); // catatan dihapus dari device lain saat modal terbuka
    }
  }

  /* ================= Render: Dashboard & shared card ================= */

  function noteCardHTML(note) {
    const cat = getCategory(note.category);
    const creatorBadge = USERS[note.by]
      ? '<img class="creator-badge" src="' + USERS[note.by].icon + '" data-by="' + note.by + '" alt="' + USERS[note.by].label + '">'
      : "";
    return (
      '<div class="note-item" data-id="' + note.id + '">' +
      '<div class="note-icon" style="' + chipStyle(cat.colorSlot) + '">' + escapeHtml(cat.icon) + creatorBadge + "</div>" +
      '<div class="note-info">' +
      '<div class="note-title-row">' +
      '<p class="note-title">' + escapeHtml(note.title) + "</p>" +
      (note.pinned ? '<span class="note-pin">📌</span>' : "") +
      "</div>" +
      '<p class="note-snippet">' + escapeHtml(snippet(note.content)) + "</p>" +
      "</div>" +
      '<span class="note-category-badge" style="' + chipStyle(cat.colorSlot) + '">' + escapeHtml(cat.label) + "</span>" +
      "</div>"
    );
  }

  function renderDashboard() {
    document.getElementById("statNoteCount").textContent = notes.length;
    document.getElementById("statCategoryCount").textContent = categories.length;
    document.getElementById("statPinnedCount").textContent = notes.filter((n) => n.pinned).length;

    const recent = [...notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4);
    const recentEl = document.getElementById("recentNotes");
    recentEl.innerHTML = recent.length
      ? recent.map(noteCardHTML).join("")
      : '<p class="empty-state">Belum ada catatan. Tambahkan catatan pertamamu!</p>';

    const breakdownEl = document.getElementById("categoryBreakdown");
    const withCount = categories
      .map((c) => ({ ...c, count: notes.filter((n) => n.category === c.id).length }))
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

  /* ================= Render: Catatan ================= */

  function renderNoteFilterTabs() {
    const tabsEl = document.getElementById("noteFilterTabs");
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

  function renderNoteList() {
    const listEl = document.getElementById("noteList");
    let filtered = notes;
    if (activeCategoryFilter !== "all") filtered = filtered.filter((n) => n.category === activeCategoryFilter);
    if (searchQuery) {
      filtered = filtered.filter(
        (n) => n.title.toLowerCase().includes(searchQuery) || n.content.toLowerCase().includes(searchQuery)
      );
    }
    filtered = [...filtered].sort((a, b) => b.updatedAt - a.updatedAt);

    listEl.innerHTML = filtered.length
      ? filtered.map(noteCardHTML).join("")
      : '<p class="empty-state">Belum ada catatan pada kategori ini.</p>';
  }

  function renderPinnedList() {
    const listEl = document.getElementById("pinnedList");
    const pinned = notes.filter((n) => n.pinned).sort((a, b) => b.updatedAt - a.updatedAt);
    listEl.innerHTML = pinned.length
      ? pinned.map(noteCardHTML).join("")
      : '<p class="empty-state">Belum ada catatan yang disematkan. Sematkan catatan penting biar gampang ditemukan lagi.</p>';
  }

  [document.getElementById("recentNotes"), document.getElementById("noteList"), document.getElementById("pinnedList")].forEach(
    (container) => {
      container.addEventListener("click", (e) => {
        const badge = e.target.closest(".creator-badge");
        if (badge) {
          openCreatorInfo(badge.dataset.by);
          return;
        }
        const item = e.target.closest(".note-item");
        if (!item) return;
        const note = notes.find((n) => n.id === item.dataset.id);
        if (note) openNoteDetail(note);
      });
    }
  );

  /* ================= Note modal (add/edit) ================= */

  const noteModal = document.getElementById("noteModal");
  const noteForm = document.getElementById("noteForm");
  const noteByToggle = document.getElementById("noteByToggle");
  let editingNoteId = null;

  /* ---------------- Isi Catatan: editor layar penuh ----------------
     Textarea isi catatan tidak lagi langsung di dalam form modal — biar
     lega buat nulis panjang, ditaruh di editor terpisah yang menutupi
     seluruh layar (mirip Notion). `noteContentDraft` menyimpan nilai
     sementara sebelum form disubmit; textarea di form lama sudah dihapus
     dari index.html. */
  const contentEditorModal = document.getElementById("contentEditorModal");
  const contentEditorTextarea = document.getElementById("contentEditorTextarea");
  const noteContentPreviewEl = document.getElementById("noteContentPreview");
  let noteContentDraft = "";

  function renderContentPreview() {
    const isEmpty = !noteContentDraft;
    noteContentPreviewEl.textContent = isEmpty ? "Ketuk untuk menulis isi catatan…" : snippet(noteContentDraft);
    noteContentPreviewEl.classList.toggle("placeholder", isEmpty);
  }

  document.getElementById("openContentEditorBtn").addEventListener("click", () => {
    contentEditorTextarea.value = noteContentDraft;
    contentEditorModal.classList.add("open");
    contentEditorTextarea.focus();
  });

  document.getElementById("cancelContentEditorBtn").addEventListener("click", () => {
    contentEditorModal.classList.remove("open"); // buang draft perubahan, noteContentDraft tidak disentuh
  });

  document.getElementById("saveContentEditorBtn").addEventListener("click", () => {
    noteContentDraft = contentEditorTextarea.value.trim();
    renderContentPreview();
    contentEditorModal.classList.remove("open");
  });

  function populateCategorySelect(selectEl, selectedId) {
    selectEl.innerHTML = categories.map((c) => '<option value="' + c.id + '">' + escapeHtml(c.icon) + " " + escapeHtml(c.label) + "</option>").join("");
    if (selectedId) selectEl.value = selectedId;
  }

  // Set toggle 2-tombol (Dibuat oleh) ke satu nilai, opsional dikunci (dipakai
  // saat edit — pembuat tidak bisa diubah retroaktif).
  function setByToggleValue(toggleId, by, locked) {
    const toggle = document.getElementById(toggleId);
    toggle.querySelectorAll(".mode-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.by === by);
      b.disabled = locked;
    });
    toggle.classList.toggle("locked", locked);
  }

  noteByToggle.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return; // dikunci saat edit
      noteByToggle.querySelectorAll(".mode-btn").forEach((b) => b.classList.toggle("active", b === btn));
    });
  });

  // Baca toggle "Dibuat oleh" di modal (default "iyon" kalau entah kenapa
  // belum ada yang aktif).
  function noteFormBy() {
    const active = noteByToggle.querySelector(".mode-btn.active");
    return active ? active.dataset.by : "iyon";
  }

  function openNoteModal(note) {
    editingNoteId = note ? note.id : null;
    document.getElementById("noteModalTitle").textContent = note ? "Ubah Catatan" : "Tambah Catatan";
    document.getElementById("noteTitleInput").value = note ? note.title : "";
    document.getElementById("notePinnedInput").checked = note ? note.pinned : false;

    noteContentDraft = note ? note.content : "";
    renderContentPreview();

    populateCategorySelect(document.getElementById("noteCategoryInput"), note ? note.category : categories[0] && categories[0].id);

    setByToggleValue("noteByToggle", note ? note.by : "iyon", !!note);

    noteModal.classList.add("open");
  }

  function closeNoteModal() {
    noteModal.classList.remove("open");
    editingNoteId = null;
    noteContentDraft = "";
  }

  document.getElementById("cancelNoteBtn").addEventListener("click", closeNoteModal);
  noteModal.addEventListener("click", (e) => {
    if (e.target === noteModal) closeNoteModal();
  });

  document.getElementById("navAdd").addEventListener("click", () => openNoteModal(null));

  noteForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = {
      title: document.getElementById("noteTitleInput").value.trim(),
      content: noteContentDraft,
      category: document.getElementById("noteCategoryInput").value,
      pinned: document.getElementById("notePinnedInput").checked,
      by: noteFormBy(),
    };
    if (!data.title) return;
    if (!data.content) {
      alert("Isi catatan tidak boleh kosong.");
      return;
    }

    const action = editingNoteId ? updateNote(editingNoteId, data) : addNote(data);
    action.catch((err) => {
      console.error("Gagal menyimpan catatan:", err);
      alert("Gagal menyimpan catatan. Cek koneksi internet.");
    });
    closeNoteModal();
  });

  /* ================= Note detail modal ================= */

  const noteDetailModal = document.getElementById("noteDetailModal");
  let currentDetailNoteId = null;

  function renderNoteDetail(note) {
    const cat = getCategory(note.category);

    document.getElementById("detailIcon").style.cssText = chipStyle(cat.colorSlot);
    document.getElementById("detailIcon").textContent = cat.icon;
    document.getElementById("detailTitle").textContent = note.title;
    const badge = document.getElementById("detailCategoryBadge");
    badge.textContent = cat.label;
    badge.style.cssText = chipStyle(cat.colorSlot);

    document.getElementById("detailCreatedAt").textContent = formatDateLong(note.createdAt);
    document.getElementById("detailUpdatedAt").textContent = note.updatedAt && note.updatedAt !== note.createdAt ? formatDateLong(note.updatedAt) : "—";
    document.getElementById("detailBy").textContent = USERS[note.by] ? USERS[note.by].label : "—";

    document.getElementById("detailContent").innerHTML = renderMarkdownToHtml(note.content);

    const pinBtn = document.getElementById("togglePinBtn");
    pinBtn.classList.toggle("pinned", note.pinned);
    pinBtn.setAttribute("aria-label", note.pinned ? "Batal sematkan" : "Sematkan catatan");
  }

  function openNoteDetail(note) {
    currentDetailNoteId = note.id;
    renderNoteDetail(note);
    noteDetailModal.classList.add("open");
  }

  function closeNoteDetail() {
    noteDetailModal.classList.remove("open");
    currentDetailNoteId = null;
  }

  noteDetailModal.addEventListener("click", (e) => {
    if (e.target === noteDetailModal) closeNoteDetail();
  });

  document.getElementById("togglePinBtn").addEventListener("click", () => {
    const note = notes.find((n) => n.id === currentDetailNoteId);
    if (!note) return;
    toggleNotePinned(note.id, !note.pinned).catch((err) => console.error("Gagal ubah status sematkan:", err));
  });

  document.getElementById("editNoteBtn").addEventListener("click", () => {
    const note = notes.find((n) => n.id === currentDetailNoteId);
    closeNoteDetail();
    if (note) openNoteModal(note);
  });

  document.getElementById("deleteNoteBtn").addEventListener("click", () => {
    const note = notes.find((n) => n.id === currentDetailNoteId);
    if (!note) return;
    openConfirm("Hapus Catatan?", 'Apakah Anda yakin ingin menghapus catatan "' + note.title + '"? Tindakan ini tidak dapat dibatalkan.', () => {
      deleteNote(note.id).catch((err) => {
        console.error("Gagal menghapus catatan:", err);
        alert("Gagal menghapus catatan. Cek koneksi internet.");
      });
      closeNoteDetail();
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
        'Apakah Anda yakin ingin menghapus kategori "' + cat.label + '"? Catatan lama dengan kategori ini tetap tersimpan tapi tampil sebagai "Tanpa Kategori".',
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

  /* ================= Info pembuat catatan ================= */

  // Klik badge foto pembuat (di list) → popup read-only nama lengkapnya,
  // reuse gaya confirm-dialog. Bukan bagian dari sistem "pengguna aktif" —
  // cuma penjelas identitas visual badge.
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

  document.getElementById("noteSearchInput").addEventListener("input", (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderNoteList();
  });

  document.getElementById("noteFilterTabs").addEventListener("click", (e) => {
    const tab = e.target.closest(".filter-tab");
    if (!tab) return;
    activeCategoryFilter = tab.dataset.filter;
    renderNoteFilterTabs();
    renderNoteList();
  });

  /* ================= Init ================= */

  initTheme();
  subscribeNote();
})();
