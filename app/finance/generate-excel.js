/* =========================================================
   Finance App — generate-excel.js
   Helper pembuatan & unduh file Excel (.xlsx) memakai SheetJS.

   File ini SENGAJA generik & tanpa state aplikasi: ia hanya
   menerima data mentah (array of objects) dari script.js lalu
   membuat workbook & memicu unduhan. Alur data mengalir KELUAR
   dari IIFE script.js ke sini — bukan sebaliknya.

   Butuh global `XLSX` dari SheetJS CDN (di-load di index.html
   sebelum file ini).
   ========================================================= */

window.FinanceExcel = {
  // Apakah modul SheetJS berhasil dimuat (mis. gagal kalau offline)?
  available: function () {
    return typeof XLSX !== "undefined";
  },

  // rows = array of objects; key tiap object jadi header kolom.
  download: function (fileName, sheetName, rows) {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName); // memicu unduhan di browser
  },
};
