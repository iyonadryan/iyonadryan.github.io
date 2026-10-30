/* =========================================================
   Finance App (Desktop) — excel-template.js
   Pembuat file template import (.xlsx) yang punya dropdown
   (data validation) di kolom Tipe & Kategori.

   SheetJS versi gratis tidak bisa menulis data validation,
   jadi bagian ini pakai ExcelJS — di-load dari CDN baru saat
   tombol "Download Template" diklik (tidak membebani halaman).

   Sama seperti generate-excel.js: generik & tanpa state app,
   data (daftar kategori dll.) dikirim dari script.js.
   ========================================================= */

window.FinanceTemplate = (function () {
  const EXCELJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
  const MAX_ROWS = 500; // jumlah baris yang diberi dropdown

  let loading = null;

  function loadExcelJS() {
    if (typeof ExcelJS !== "undefined") return Promise.resolve();
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = EXCELJS_URL;
        s.onload = () => resolve();
        s.onerror = () => {
          loading = null;
          reject(new Error("Gagal memuat ExcelJS"));
        };
        document.head.appendChild(s);
      });
    }
    return loading;
  }

  function styleHeader(row) {
    row.font = { bold: true, color: { argb: "FFFFFFFF" } };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E7490" } };
    row.alignment = { vertical: "middle" };
    row.height = 22;
  }

  // opts = { types: ["Pengeluaran", "Pemasukan"], categories: ["Makanan (keluar)", ...],
  //          examples: [[tanggal, waktu, tipe, kategori, nominal, catatan], ...] }
  async function download(fileName, opts) {
    await loadExcelJS();
    const wb = new ExcelJS.Workbook();
    wb.creator = "Finance App";

    // --- Sheet 1: Transaksi (yang diisi user) ---
    const ws = wb.addWorksheet("Transaksi", { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = [
      { header: "Tanggal", key: "tanggal", width: 14 },
      { header: "Waktu", key: "waktu", width: 12 },
      { header: "Tipe", key: "tipe", width: 16 },
      { header: "Kategori", key: "kategori", width: 28 },
      { header: "Nominal", key: "nominal", width: 14 },
      { header: "Catatan", key: "catatan", width: 36 },
    ];
    styleHeader(ws.getRow(1));
    // Tanggal & Waktu diformat teks supaya Excel tidak mengubahnya jadi
    // angka serial (importer tetap menerima serial kalau terlanjur).
    ws.getColumn(1).numFmt = "@";
    ws.getColumn(2).numFmt = "@";
    ws.getColumn(5).numFmt = "0";

    // --- Sheet 2: Panduan ---
    const guide = wb.addWorksheet("Panduan");
    guide.columns = [{ width: 26 }, { width: 16 }, { width: 16 }, { width: 28 }, { width: 14 }, { width: 36 }];
    const lines = [
      ["Cara mengisi template import transaksi"],
      [],
      ["1. Isi data di sheet \"Transaksi\", satu baris = satu transaksi, mulai baris 2."],
      ["2. Tanggal: format YYYY-MM-DD, contoh 2026-10-30."],
      ["3. Waktu: format HH:MM:SS (24 jam), contoh 08:00:00."],
      ["4. Tipe & Kategori: pilih dari dropdown. Kategori harus sesuai tipenya (keluar = Pengeluaran, masuk = Pemasukan)."],
      ["5. Nominal: angka saja tanpa titik/koma/Rp, contoh 35000."],
      ["6. Catatan: boleh dikosongkan."],
      ["7. Kalau ada satu baris saja yang salah, tidak ada transaksi yang disimpan — perbaiki lalu import ulang."],
      [],
      ["Contoh pengisian:"],
      ["Tanggal", "Waktu", "Tipe", "Kategori", "Nominal", "Catatan"],
    ].concat(opts.examples || []);
    lines.forEach((l) => guide.addRow(l));
    guide.getRow(1).font = { bold: true, size: 14 };
    styleHeader(guide.getRow(12));

    // --- Sheet 3 (tersembunyi): sumber daftar dropdown ---
    const list = wb.addWorksheet("Daftar", { state: "hidden" });
    opts.types.forEach((t, i) => (list.getCell(i + 1, 1).value = t));
    opts.categories.forEach((c, i) => (list.getCell(i + 1, 2).value = c));

    const typeRef = "Daftar!$A$1:$A$" + opts.types.length;
    const catRef = "Daftar!$B$1:$B$" + Math.max(1, opts.categories.length);
    for (let r = 2; r <= MAX_ROWS + 1; r++) {
      ws.getCell("C" + r).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [typeRef],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "Tipe tidak valid",
        error: "Pilih Pengeluaran atau Pemasukan dari daftar.",
      };
      ws.getCell("D" + r).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [catRef],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "Kategori tidak valid",
        error: "Pilih kategori dari daftar.",
      };
    }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return { download };
})();
