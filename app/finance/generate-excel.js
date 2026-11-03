/* =========================================================
   Finance App — generate-excel.js
   Helper pembuatan & unduh file Excel (.xlsx) memakai SheetJS.

   File ini SENGAJA generik & tanpa state aplikasi: ia hanya
   menerima data mentah (array of objects) dari script.js lalu
   membuat workbook & memicu unduhan. Alur data mengalir KELUAR
   dari IIFE script.js ke sini — bukan sebaliknya.

   Butuh global `XLSX` dari SheetJS CDN (di-load di index.html
   sebelum file ini). Dipakai web mobile & web desktop.
   ========================================================= */

window.FinanceExcel = (function () {
  // SheetJS versi gratis tidak bisa menulis style sel (mis. rata tengah), jadi
  // downloadStyled() pakai ExcelJS — dimuat dari CDN baru saat dibutuhkan.
  const EXCELJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
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

  // Apakah modul SheetJS berhasil dimuat (mis. gagal kalau offline)?
  function available() {
    return typeof XLSX !== "undefined";
  }

  // rows = array of objects; key tiap object jadi header kolom.
  function download(fileName, sheetName, rows) {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName); // memicu unduhan di browser
  }

  // Sama spt download(), plus opts.center = daftar header kolom yang rata
  // tengah (mis. ["Nota"]). Kalau ExcelJS gagal dimuat, jatuh ke download()
  // biasa (tanpa style) — export tidak pernah gagal karena style.
  async function downloadStyled(fileName, sheetName, rows, opts) {
    const center = (opts && opts.center) || [];
    try {
      await loadExcelJS();
    } catch (e) {
      download(fileName, sheetName, rows);
      return;
    }
    const keys = rows.length ? Object.keys(rows[0]) : [];
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(sheetName);
    ws.columns = keys.map((k) => ({ header: k, key: k }));
    rows.forEach((r) => ws.addRow(r));
    center.forEach((k) => {
      if (keys.indexOf(k) !== -1) ws.getColumn(k).alignment = { horizontal: "center" };
    });

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

  return { available, download, downloadStyled };
})();
