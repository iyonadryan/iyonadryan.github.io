import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

/// Padanan `formatCurrency()` di `script.js`: "Rp " + pemisah ribuan gaya
/// Indonesia, tanpa desimal.
String formatCurrency(num? value) {
  final n = (value ?? 0).round();
  return 'Rp ${NumberFormat.decimalPattern('id_ID').format(n)}';
}

/// Angka polos dengan titik ribuan, tanpa prefix "Rp".
String formatThousands(num? value) =>
    NumberFormat.decimalPattern('id_ID').format((value ?? 0).round());

/// Membuang titik ribuan dari teks input lalu jadikan angka.
/// Padanan `parseFloat(value.replace(/\./g, ""))` di versi web.
double parseAmount(String raw) =>
    double.tryParse(raw.replaceAll('.', '').trim()) ?? 0;

/// Padanan `formatAmountInput()`: format ribuan realtime saat user mengetik
/// nominal. Dipakai di field jumlah Finance, Patungan, dan Wishlist.
class ThousandsInputFormatter extends TextInputFormatter {
  const ThousandsInputFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) {
      return const TextEditingValue(text: '');
    }
    final formatted = formatThousands(int.parse(digits));
    // Kursor selalu ditaruh di akhir — cukup untuk field nominal yang
    // umumnya diketik dari kiri ke kanan tanpa menyisip di tengah.
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}

// --- Tanggal ---------------------------------------------------------------

/// "YYYY-MM" — kunci bulan, dipakai path Firebase Finance & perbandingan
/// kronologis (string "YYYY-MM" bisa dibandingkan langsung).
String ymKey(DateTime d) => DateFormat('yyyy-MM').format(d);

/// "YYYY-MM-DD" — tanggal lokal, dipakai field `tanggal` & `periodKey` harian.
String dateKey(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

/// Senin dari minggu yang memuat [d]. Konvensi Senin–Minggu, sama dengan
/// `startOfWeek()` di Finance & Routine App.
DateTime startOfWeek(DateTime d) {
  final day = DateTime(d.year, d.month, d.day);
  return day.subtract(Duration(days: (day.weekday - DateTime.monday) % 7));
}

String formatMonthLong(DateTime d) => DateFormat('MMMM yyyy', 'id_ID').format(d);
String formatDateShort(DateTime d) => DateFormat('d MMM', 'id_ID').format(d);
String formatDateLong(DateTime d) => DateFormat('d MMMM yyyy', 'id_ID').format(d);
String formatTime(DateTime d) => DateFormat('HH:mm').format(d);
String formatTimeWithSeconds(DateTime d) => DateFormat('HH:mm:ss').format(d);

DateTime fromMillis(int? ms) =>
    DateTime.fromMillisecondsSinceEpoch(ms ?? 0);

/// Cuplikan teks untuk kartu list (~70 karakter), whitespace dirapikan jadi
/// satu spasi. Padanan `snippet()` di Note & Wishlist App.
String snippet(String? text, {int max = 70}) {
  final clean = (text ?? '').replaceAll(RegExp(r'\s+'), ' ').trim();
  if (clean.length <= max) return clean;
  return '${clean.substring(0, max).trimRight()}…';
}

/// Padanan `slugify()`: lowercase, spasi jadi `-`, buang karakter lain.
String slugify(String label) => label
    .toLowerCase()
    .trim()
    .replaceAll(RegExp(r'[^a-z0-9\s-]'), '')
    .replaceAll(RegExp(r'\s+'), '-')
    .replaceAll(RegExp(r'-+'), '-');

/// Slug yang belum dipakai — kalau bentrok, tambah sufiks angka.
/// Padanan `uniqueSlug()` di Kitchen/Note/Wishlist App.
String uniqueSlug(String base, Set<String> taken) {
  if (base.isEmpty) base = 'kategori';
  if (!taken.contains(base)) return base;
  var i = 2;
  while (taken.contains('$base-$i')) {
    i++;
  }
  return '$base-$i';
}
