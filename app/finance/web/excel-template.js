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

  // Header Tanggal/Waktu menyertakan format; importer mengabaikan teks dalam kurung.
  const HEADER_TANGGAL = "Tanggal (yyyy-mm-dd)";
  const HEADER_WAKTU = "Waktu (hh:mm:ss)";

  // opts = { accounts: ["bank", "cash", "e_money"], types: ["Pengeluaran", "Pemasukan"],
  //          categories: ["Makanan (keluar)", ...],
  //          examples: [[tanggal, waktu, account, tipe, kategori, nominal, catatan], ...],
  //          now: [tanggal, waktu] — diisi di baris 2 sheet Transaksi sbg contoh format }
  async function download(fileName, opts) {
    await loadExcelJS();
    const wb = new ExcelJS.Workbook();
    wb.creator = "Finance App";

    // --- Sheet 1: Transaksi (yang diisi user) ---
    const ws = wb.addWorksheet("Transaksi", { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = [
      { header: HEADER_TANGGAL, key: "tanggal", width: 22 },
      { header: HEADER_WAKTU, key: "waktu", width: 18 },
      { header: "Account Type", key: "account_type", width: 15 },
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
    ws.getColumn(6).numFmt = "0";
    // Baris 2: Tanggal & Waktu saat template diunduh, cuma contoh format —
    // ditimpa user. Kalau dibiarkan (kolom lain kosong), importer melewatinya.
    if (opts.now) {
      ws.getCell("A2").value = opts.now[0];
      ws.getCell("B2").value = opts.now[1];
    }

    // --- Sheet 2: Panduan ---
    const guide = wb.addWorksheet("Panduan");
    guide.columns = [{ width: 26 }, { width: 12 }, { width: 15 }, { width: 16 }, { width: 28 }, { width: 14 }, { width: 36 }];
    const exampleHeader = [HEADER_TANGGAL, HEADER_WAKTU, "Account Type", "Tipe", "Kategori", "Nominal", "Catatan"];
    const lines = [
      ["Cara mengisi template import transaksi"],
      [],
      ["1. Isi data di sheet \"Transaksi\", satu baris = satu transaksi, mulai baris 2. Baris 2 sudah berisi contoh Tanggal & Waktu (saat template diunduh) — timpa dengan data kamu. Baris yang cuma berisi Tanggal & Waktu diabaikan saat import."],
      ["2. Tanggal: format YYYY-MM-DD, contoh 2026-10-30."],
      ["3. Waktu: format HH:MM:SS (24 jam), contoh 08:00:00."],
      ["4. Account Type: pilih dari dropdown — bank (rekening), cash (tunai), e_money (dompet digital). Kosong = bank."],
      ["5. Tipe & Kategori: pilih dari dropdown. Kategori harus sesuai tipenya (keluar = Pengeluaran, masuk = Pemasukan)."],
      ["6. Nominal: angka saja tanpa titik/koma/Rp, contoh 35000."],
      ["7. Catatan: boleh dikosongkan."],
      ["8. Kode transaksi dibuat otomatis per baris (urut sesuai urutan baris), tidak perlu diisi."],
      ["9. Kalau ada satu baris saja yang salah, tidak ada transaksi yang disimpan — perbaiki lalu import ulang."],
      ["10. Import hanya untuk transaksi SATUAN (satu baris = satu transaksi). Nota (banyak item) dan pindah account tidak bisa diimport — buat lewat tab Manual di aplikasi."],
      [],
      ["Contoh pengisian:"],
      exampleHeader,
    ].concat(opts.examples || []);
    lines.forEach((l) => guide.addRow(l));
    guide.getRow(1).font = { bold: true, size: 14 };
    styleHeader(guide.getRow(lines.indexOf(exampleHeader) + 1));

    // --- Sheet 3 (tersembunyi): sumber daftar dropdown ---
    const list = wb.addWorksheet("Daftar", { state: "hidden" });
    opts.types.forEach((t, i) => (list.getCell(i + 1, 1).value = t));
    opts.categories.forEach((c, i) => (list.getCell(i + 1, 2).value = c));
    opts.accounts.forEach((a, i) => (list.getCell(i + 1, 3).value = a));

    const typeRef = "Daftar!$A$1:$A$" + opts.types.length;
    const catRef = "Daftar!$B$1:$B$" + Math.max(1, opts.categories.length);
    const acctRef = "Daftar!$C$1:$C$" + opts.accounts.length;
    for (let r = 2; r <= MAX_ROWS + 1; r++) {
      ws.getCell("C" + r).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [acctRef],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "Account Type tidak valid",
        error: "Pilih bank, cash, atau e_money dari daftar.",
      };
      ws.getCell("D" + r).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [typeRef],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "Tipe tidak valid",
        error: "Pilih Pengeluaran atau Pemasukan dari daftar.",
      };
      ws.getCell("E" + r).dataValidation = {
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
