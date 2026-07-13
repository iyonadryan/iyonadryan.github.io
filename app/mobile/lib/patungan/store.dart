import 'package:flutter/foundation.dart';

import '../core/app_store.dart';

@immutable
class Participant {
  const Participant({
    required this.id,
    required this.name,
    required this.createdAt,
  });

  final String id;
  final String name;
  final int createdAt;

  Map<String, Object?> toMap() => {'name': name, 'createdAt': createdAt};
}

@immutable
class Expense {
  const Expense({
    required this.id,
    required this.description,
    required this.amount,
    required this.paidBy,
    required this.splitAmong,
    required this.createdAt,
  });

  final String id;
  final String description;
  final double amount;

  /// Id peserta yang menalangi bayar duluan.
  final String paidBy;

  /// Id peserta yang ikut menanggung. Split **selalu rata**
  /// (`amount / splitAmong.length`) — belum ada split custom per orang.
  final List<String> splitAmong;

  final int createdAt;

  factory Expense.fromMap(String id, Map<Object?, Object?> m) => Expense(
        id: id,
        description: m.str('description'),
        amount: m.decimal('amount'),
        paidBy: m.str('paidBy'),
        splitAmong: [
          for (final v in m.list('splitAmong'))
            if (v is String) v,
        ],
        createdAt: m.integer('createdAt'),
      );

  Map<String, Object?> toMap() => {
        'description': description,
        'amount': amount,
        'paidBy': paidBy,
        'splitAmong': splitAmong,
        'createdAt': createdAt,
      };

  double get share => splitAmong.isEmpty ? 0 : amount / splitAmong.length;
}

@immutable
class Trip {
  const Trip({
    required this.id,
    required this.name,
    required this.createdAt,
    required this.participants,
    required this.expenses,
  });

  final String id;
  final String name;
  final int createdAt;

  /// Nested di dalam trip (bukan node top-level terpisah) — supaya hapus trip
  /// otomatis ikut menghapus peserta & notanya lewat satu `remove()`.
  final List<Participant> participants;
  final List<Expense> expenses;

  factory Trip.fromMap(String id, Map<Object?, Object?> m) => Trip(
        id: id,
        name: m.str('name'),
        createdAt: m.integer('createdAt'),
        participants: [
          for (final e in (m.child('participants') ?? {}).entriesAsMaps())
            Participant(
              id: e.key,
              name: e.value.str('name'),
              createdAt: e.value.integer('createdAt'),
            ),
        ]..sort((a, b) => a.createdAt.compareTo(b.createdAt)),
        expenses: [
          for (final e in (m.child('expenses') ?? {}).entriesAsMaps())
            Expense.fromMap(e.key, e.value),
        ]..sort((a, b) => b.createdAt.compareTo(a.createdAt)),
      );

  double get total => expenses.fold(0, (s, e) => s + e.amount);

  Participant? participant(String id) {
    for (final p in participants) {
      if (p.id == id) return p;
    }
    return null;
  }

  String nameOf(String id) => participant(id)?.name ?? '—';
}

/// Siapa harus bayar ke siapa, berapa.
@immutable
class Settlement {
  const Settlement({
    required this.from,
    required this.to,
    required this.amount,
  });

  final String from;
  final String to;
  final double amount;
}

class PatunganStore extends AppStore {
  PatunganStore() : super('patungan');

  List<Trip> trips = [];

  @override
  void rebuildFromSnapshot(Map<Object?, Object?> root) {
    trips = [
      for (final e in (root.child('trips') ?? {}).entriesAsMaps())
        Trip.fromMap(e.key, e.value),
    ]..sort((a, b) => b.createdAt.compareTo(a.createdAt));
  }

  Trip? tripById(String id) {
    for (final t in trips) {
      if (t.id == id) return t;
    }
    return null;
  }

  int get totalExpenses =>
      trips.fold(0, (s, t) => s + t.expenses.length);

  double get totalAmount => trips.fold(0, (s, t) => s + t.total);

  /// Saldo net tiap peserta: yang menalangi dapat `+amount`, tiap peserta di
  /// `splitAmong` dapat `-amount/n`. Positif = harus **menerima**, negatif =
  /// harus **membayar**.
  Map<String, double> calcBalances(Trip trip) {
    final balances = {for (final p in trip.participants) p.id: 0.0};

    for (final e in trip.expenses) {
      balances[e.paidBy] = (balances[e.paidBy] ?? 0) + e.amount;
      for (final id in e.splitAmong) {
        balances[id] = (balances[id] ?? 0) - e.share;
      }
    }
    return balances;
  }

  /// Greedy debt-simplification ala Splitwise: cocokkan kreditor & debitor
  /// terbesar berulang, supaya jumlah transaksi settlement seminimal mungkin
  /// (bukan tiap orang bayar ke tiap orang).
  List<Settlement> simplifyDebts(Map<String, double> balances) {
    // Toleransi pembulatan — saldo di bawah 1 rupiah dianggap impas.
    const epsilon = 1.0;

    final creditors = <MapEntry<String, double>>[];
    final debtors = <MapEntry<String, double>>[];

    balances.forEach((id, value) {
      if (value > epsilon) creditors.add(MapEntry(id, value));
      if (value < -epsilon) debtors.add(MapEntry(id, -value));
    });

    creditors.sort((a, b) => b.value.compareTo(a.value));
    debtors.sort((a, b) => b.value.compareTo(a.value));

    final out = <Settlement>[];
    var ci = 0;
    var di = 0;
    var creditLeft = creditors.isEmpty ? 0.0 : creditors.first.value;
    var debtLeft = debtors.isEmpty ? 0.0 : debtors.first.value;

    while (ci < creditors.length && di < debtors.length) {
      final pay = creditLeft < debtLeft ? creditLeft : debtLeft;
      out.add(
        Settlement(
          from: debtors[di].key,
          to: creditors[ci].key,
          amount: pay,
        ),
      );

      creditLeft -= pay;
      debtLeft -= pay;

      if (creditLeft <= epsilon) {
        ci++;
        if (ci < creditors.length) creditLeft = creditors[ci].value;
      }
      if (debtLeft <= epsilon) {
        di++;
        if (di < debtors.length) debtLeft = debtors[di].value;
      }
    }

    return out;
  }

  /// Peserta masih dipakai di nota mana pun di trip ini? Kalau ya, hapusnya
  /// diblok — tidak ada fallback yang masuk akal untuk nota yang "pembayarnya
  /// sudah tidak ada".
  bool participantInUse(Trip trip, String participantId) => trip.expenses.any(
        (e) =>
            e.paidBy == participantId || e.splitAmong.contains(participantId),
      );

  // --- Tulis ----------------------------------------------------------------

  Future<void> saveTripName(String id, String name) {
    final now = DateTime.now().millisecondsSinceEpoch;
    return ref.child('trips/$id').update({
      'name': name,
      if (tripById(id) == null) 'createdAt': now,
    });
  }

  /// Hapus trip = cascade otomatis (peserta & nota nested di dalamnya).
  Future<void> deleteTrip(String id) => ref.child('trips/$id').remove();

  Future<void> addParticipant(String tripId, Participant p) =>
      ref.child('trips/$tripId/participants/${p.id}').set(p.toMap());

  Future<void> deleteParticipant(String tripId, String participantId) =>
      ref.child('trips/$tripId/participants/$participantId').remove();

  /// `.update()` (bukan `.set()`) supaya `createdAt` asli tetap — kalau tidak,
  /// nota melompat urutan tiap diedit.
  Future<void> saveExpense(String tripId, Expense e) =>
      ref.child('trips/$tripId/expenses/${e.id}').update(e.toMap());

  Future<void> deleteExpense(String tripId, String expenseId) =>
      ref.child('trips/$tripId/expenses/$expenseId').remove();
}
