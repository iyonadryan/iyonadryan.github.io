# Tool (bengkel/utilitas mandiri)

`tool/` — folder kumpulan alat/utilitas web mandiri (client-side, jalan langsung di browser). Beda dari `app/` (lihat `app/.claude/CLAUDE.md`) yang khusus aplikasi Firebase-backed personal (Iyon/Ciwul) dgn hub launcher (`app/index.html`), multi-user, dashboard, dst — tool di sini berdiri sendiri, tidak terhubung ke Firebase project yang sama, dan biasanya tidak butuh konsep "pengguna aktif"/kategori/tema tersimpan spt app/. Fokusnya murni: satu tool = satu tugas spesifik yang diselesaikan sepenuhnya di browser.

## Kenapa folder terpisah dari `app/`

Tool pertama (`pdf-editor/`) sempat dipertimbangkan masuk `app/` krn pola foldernya mirip, tapi sifatnya beda: bukan app pribadi yang dipakai berulang dgn data tersimpan (spt Note/Wishlist/dst), melainkan utilitas sekali-pakai per sesi (buka file → olah → unduh → selesai, tidak ada data yang persist). Menaruhnya di `app/` akan salah kaprah krn `app/.claude/CLAUDE.md` & hub-nya didesain khusus utk ekosistem app Iyon/Ciwul. `tool/` jadi kategori ketiga yang sejajar dgn `app/` di root repo, bukan sub-bagian dari `app/`.

## Struktur folder

```
tool/
  .claude/
    CLAUDE.md          # file ini
    pdf-editor.md       # dokumentasi Bengkel PDF
  pdf-editor/
    index.html
    style.css
    script.js
```

## Dokumentasi per-tool dikonsolidasi (pola sama dgn `app/.claude/`)

Tiap tool **tidak punya folder `.claude/` sendiri** di dalam foldernya — dokumentasi ditaruh sbg file terpisah di `tool/.claude/<nama-tool>.md` (mis. `pdf-editor.md`). Folder `tool/` sendiri (bukan tool spesifik mana pun) punya `tool/.claude/CLAUDE.md` ini utk hal lintas-tool (struktur folder, konvensi bersama, TODO hub).

## Status saat ini

- **`pdf-editor/`** — Bengkel PDF, editor PDF client-side (upload/gabung PDF, reorder/rotate/hapus/ekstrak halaman, tambah teks & tanda tangan overlay lalu "terapkan"/bake ke PDF, isi form AcroForm, unduh hasil). Lihat `tool/.claude/pdf-editor.md` utk detail lengkap.
- **Belum ada halaman hub/launcher** (`tool/index.html`) yang mengumpulkan link ke tiap tool — beda dari `app/index.html` utk `app/`. Tiap tool diakses langsung lewat URL foldernya masing-masing (mis. `/tool/pdf-editor/`).
- **Belum terhubung** dari portfolio utama (`index.html` di root) maupun dari hub `app/index.html` — berdiri sendiri.
- Tidak ada dependency Firebase/backend sama sekali di `tool/` — semua tool di sini murni client-side (beda dari semua app di `app/` yang selalu terhubung Firebase Realtime Database sejak awal).

## Rencana / TODO ke depan

- Tambah tool baru: bikin folder baru di dalam `tool/` (mis. `tool/<nama-tool>/`), dokumentasi langsung dibuat di `tool/.claude/<nama-tool>.md` — **jangan** bikin folder `.claude/` terpisah di dalam folder tool itu sendiri (lihat "Dokumentasi per-tool dikonsolidasi").
- Pertimbangkan bikin `tool/index.html` sbg halaman hub kalau jumlah tool bertambah, mirip pola `app/index.html` (link relatif, bukan absolut — lihat alasan di `app/.claude/CLAUDE.md` bagian "Kenapa link relatif", alasan yang sama berlaku di sini krn workflow user juga buka file langsung lewat `file://`).
- Belum dipikirkan apakah tool-tool ini nanti di-link dari portfolio utama atau dari `app/index.html` — saat ini berdiri sendiri, diakses langsung via URL.

## Catatan implementasi

- Semua teks UI berbahasa Indonesia, konsisten dgn `app/`.
- **Wajib**: setiap kali ada perubahan struktur/fitur di tool manapun dalam `tool/`, update dokumen tool terkait (`tool/.claude/<nama-tool>.md`) di perubahan yang sama. Update file ini (`tool/.claude/CLAUDE.md`) juga kalau ada perubahan lintas-tool (tool baru ditambahkan, struktur folder berubah, dst) — pola sama persis dgn kewajiban update `app/.claude/CLAUDE.md`.
