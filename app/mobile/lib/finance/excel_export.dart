import 'dart:io';

import 'package:excel/excel.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../core/formatters.dart';
import 'models.dart';
import 'store.dart';

/// Export Excel — padanan `generate-excel.js` (`window.FinanceExcel`) di versi
/// web, yang di sana memakai SheetJS.
///
/// Sama seperti versi web, modul ini **generik & tanpa state app**: dia cuma
/// menerima baris data yang sudah disiapkan. Bedanya, di mobile file tidak
/// bisa "diunduh" — jadi setelah ditulis ke folder temporer, file-nya dibuka
/// lewat share sheet OS (user pilih sendiri mau disimpan ke mana / dikirim ke
/// siapa).
class FinanceExcel {
  const FinanceExcel._();

  static Future<void> _write(
    String fileName,
    String sheetName,
    List<String> headers,
    List<List<CellValue?>> rows,
  ) async {
    final book = Excel.createExcel();

    // Excel selalu membuat sheet default "Sheet1" — ganti namanya, jangan
    // tambah sheet baru lalu meninggalkan yang kosong.
    book.rename(book.getDefaultSheet()!, sheetName);
    final sheet = book[sheetName];

    sheet.appendRow([for (final h in headers) TextCellValue(h)]);
    for (final row in rows) {
      sheet.appendRow(row);
    }

    final bytes = book.encode();
    if (bytes == null) throw Exception('Gagal membuat file Excel.');

    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/$fileName');
    await file.writeAsBytes(bytes);

    await SharePlus.instance.share(
      ShareParams(files: [XFile(file.path)], text: fileName),
    );
  }

  /// Semua transaksi di satu bulan. Kolom Nominal ditulis sebagai **angka**
  /// (bukan teks "Rp ...") supaya bisa dijumlah langsung di Excel.
  static Future<void> transactionsForMonth(
    FinanceStore store,
    List<Transaction> visible,
    String ym,
  ) async {
    final rows = visible.where((t) => t.ym == ym).toList()
      ..sort((a, b) {
        final byDate = a.date.compareTo(b.date);
        return byDate != 0 ? byDate : a.createdAt.compareTo(b.createdAt);
      });

    if (rows.isEmpty) throw Exception('Tidak ada data untuk diekspor.');

    await _write(
      'transaksi-$ym.xlsx',
      'Transaksi',
      const ['Tanggal', 'Waktu', 'Tipe', 'Kategori', 'Nominal', 'Catatan'],
      [
        for (final t in rows)
          [
            TextCellValue(t.date),
            TextCellValue(formatTimeWithSeconds(t.createdAt)),
            TextCellValue(t.type.label),
            TextCellValue(store.findCategory(t.type, t.category).label),
            DoubleCellValue(t.amount),
            TextCellValue(t.note),
          ],
      ],
    );
  }

  /// Satu baris per bulan: pemasukan, pengeluaran, saldo.
  static Future<void> monthlySummary(List<Transaction> visible) async {
    if (visible.isEmpty) throw Exception('Tidak ada data untuk diekspor.');

    final byMonth = <String, ({double income, double expense})>{};
    for (final t in visible) {
      final cur = byMonth[t.ym] ?? (income: 0.0, expense: 0.0);
      byMonth[t.ym] = t.type == TxType.income
          ? (income: cur.income + t.amount, expense: cur.expense)
          : (income: cur.income, expense: cur.expense + t.amount);
    }

    final months = byMonth.keys.toList()..sort();

    await _write(
      'ringkasan-per-bulan.xlsx',
      'Ringkasan',
      const ['Bulan', 'Pemasukan', 'Pengeluaran', 'Saldo'],
      [
        for (final ym in months)
          [
            TextCellValue(ym),
            DoubleCellValue(byMonth[ym]!.income),
            DoubleCellValue(byMonth[ym]!.expense),
            DoubleCellValue(byMonth[ym]!.income - byMonth[ym]!.expense),
          ],
      ],
    );
  }
}
