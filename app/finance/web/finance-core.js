/* =========================================================
   Finance App (Desktop) — finance-core.js
   Modul MURNI untuk V2: tanpa DOM, tanpa Firebase. Semua
   perhitungan yang harus bisa dites ada di sini:
   - kode transaksi (format, parse, validasi)
   - hitung nota: subtotal, penyesuaian, alokasi proporsional
   - builder payload record (satuan / nota / pindah)
   - normalizer record lama (V1) → bentuk internal V2
   - agregasi: filter account, saldo, total, per kategori

   Format UMD: di browser jadi global `FinanceCore` (classic
   <script>, tetap bisa dibuka lewat file:// tanpa server),
   di Node bisa di-`require()` untuk test.
   ========================================================= */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FinanceCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------------- Konstanta ---------------- */

  const ACCOUNT_TYPES = ["bank", "cash", "e_money"];
  const ACCOUNT_LETTER = { bank: "B", cash: "C", e_money: "E" };
  const LETTER_ACCOUNT = { B: "bank", C: "cash", E: "e_money" };
  const BENTUK = ["satuan", "nota", "pindah"];
  const DEFAULT_ACCOUNT = "bank"; // record lama tanpa account_type
  // Biaya admin pindah dicatat sbg pengeluaran kategori "Lainnya" bawaan
  // (ada di semua klien & tidak bisa dihapus).
  const TRANSFER_FEE_CATEGORY = "lainnya-keluar";

  const KODE_RE = /^(T[BCE]|TF-(?:BC|BE|CB|CE|EB|EC))-(\d{4})(\d{2})-(\d{6})$/;
  const MAX_SEQ = 999999;

  const EFEK = ["kurang", "tambah"];
  const MODE = ["nominal", "persen"];

  /* ---------------- Util kecil ---------------- */

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function isIsoDate(s) {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  function isTime(s) {
    const m = /^(\d{2}):(\d{2}):(\d{2})$/.exec(String(s));
    return !!m && Number(m[1]) < 24 && Number(m[2]) < 60 && Number(m[3]) < 60;
  }

  // "HH:MM:SS" waktu lokal dari ms.
  function formatTime(ms) {
    const d = new Date(ms);
    return pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
  }

  function toNumber(v) {
    const n = typeof v === "number" ? v : Number(v);
    return isFinite(n) ? n : NaN;
  }

  /* ================= Kode transaksi ================= */

  // "2026-11-01" → "202611"
  function yyyymmOf(tanggal) {
    if (!isIsoDate(tanggal)) throw new Error("Tanggal tidak valid: " + tanggal);
    return tanggal.slice(0, 4) + tanggal.slice(5, 7);
  }

  // Prefix kode dari isi record: "TB" | "TC" | "TE" | "TF-BC" | ...
  function kodePrefix(rec) {
    if (rec.bentuk === "pindah") {
      const a = ACCOUNT_LETTER[rec.dari], b = ACCOUNT_LETTER[rec.ke];
      if (!a || !b) throw new Error("Account dari/ke tidak valid");
      if (a === b) throw new Error("Account dari dan ke tidak boleh sama");
      return "TF-" + a + b;
    }
    const l = ACCOUNT_LETTER[rec.account_type];
    if (!l) throw new Error("account_type tidak valid: " + rec.account_type);
    return "T" + l;
  }

  // Key node counter: "TB-202611". Satu counter per prefix per bulan.
  function counterKey(prefix, yyyymm) {
    return prefix + "-" + yyyymm;
  }

  function formatKode(prefix, yyyymm, seq) {
    if (!Number.isInteger(seq) || seq < 1 || seq > MAX_SEQ) throw new Error("Nomor urut di luar rentang: " + seq);
    const kode = prefix + "-" + yyyymm + "-" + String(seq).padStart(6, "0");
    if (!KODE_RE.test(kode)) throw new Error("Kode tidak valid: " + kode);
    return kode;
  }

  // Kode untuk sebuah record + nomor urut (dari counter). Murni — nomor urut
  // diambil oleh data layer lewat transaction counter.
  function generateKode(rec, seq) {
    return formatKode(kodePrefix(rec), yyyymmOf(rec.tanggal), seq);
  }

  // Pratinjau di form (nomor = counter saat ini + 1; bukan jaminan).
  function previewKode(rec, currentCounter) {
    try {
      return generateKode(rec, (Number(currentCounter) || 0) + 1);
    } catch (e) {
      return "—";
    }
  }

  function parseKode(kode) {
    const m = KODE_RE.exec(String(kode));
    if (!m) return null;
    const prefix = m[1];
    const transfer = prefix.startsWith("TF-");
    return {
      kode,
      prefix,
      transfer,
      account_type: transfer ? null : LETTER_ACCOUNT[prefix[1]],
      dari: transfer ? LETTER_ACCOUNT[prefix[3]] : null,
      ke: transfer ? LETTER_ACCOUNT[prefix[4]] : null,
      yyyymm: m[2] + m[3],
      ym: m[2] + "-" + m[3],
      seq: Number(m[4]),
      counterKey: counterKey(prefix, m[2] + m[3]),
    };
  }

  /* ================= Nota ================= */

  // Alokasi `total` ke kategori secara proporsional terhadap `bases`
  // (array [category, base] urut kemunculan). Sisa pembulatan masuk ke
  // kategori dgn base terbesar (seri → yang muncul duluan), sehingga
  // jumlah hasil == total SELALU.
  function allocateProportional(bases, total) {
    const out = {};
    if (!bases.length) return out;
    const sumBase = bases.reduce((s, b) => s + b[1], 0);
    let largest = 0;
    bases.forEach((b, i) => {
      if (b[1] > bases[largest][1]) largest = i;
    });
    if (sumBase <= 0) {
      bases.forEach((b) => (out[b[0]] = 0));
      out[bases[0][0]] = total;
      return out;
    }
    let allocated = 0;
    bases.forEach((b) => {
      const v = Math.round((b[1] * total) / sumBase);
      out[b[0]] = v;
      allocated += v;
    });
    out[bases[largest][0]] += total - allocated;
    return out;
  }

  // Kategori dgn nilai terbesar (seri → urutan objek).
  function topCategory(rincian) {
    let best = null;
    Object.keys(rincian).forEach((k) => {
      if (best === null || rincian[k] > rincian[best]) best = k;
    });
    return best;
  }

  // Hitung nota dari input mentah form.
  //   items: [{ nama, category, qty, satuan, harga }]
  //   penyesuaian: [{ label, efek: "kurang"|"tambah", mode: "nominal"|"persen", nilai }]
  // Hasil: angka turunan + daftar error (kosong = valid).
  function computeNota(input) {
    const errors = [];
    const rawItems = input.items || [];
    const rawAdj = input.penyesuaian || [];
    if (!rawItems.length) errors.push("Nota minimal berisi 1 item.");

    const items = rawItems.map((it, i) => {
      const qty = toNumber(it.qty);
      const harga = toNumber(it.harga);
      const n = i + 1;
      if (!String(it.nama || "").trim()) errors.push("Item " + n + ": nama wajib diisi.");
      if (!it.category) errors.push("Item " + n + ": kategori wajib dipilih.");
      if (!(qty > 0)) errors.push("Item " + n + ": qty harus lebih dari 0.");
      if (!(harga >= 0) || !Number.isInteger(harga)) errors.push("Item " + n + ": harga satuan harus angka Rupiah ≥ 0.");
      const subtotal = qty > 0 && harga >= 0 ? Math.round(qty * harga) : 0;
      return {
        nama: String(it.nama || "").trim(),
        category: it.category || "",
        qty: qty > 0 ? qty : 0,
        satuan: String(it.satuan || "").trim(),
        harga: harga >= 0 ? harga : 0,
        subtotal,
      };
    });
    const subtotal = items.reduce((s, it) => s + it.subtotal, 0);

    const penyesuaian = rawAdj.map((p, i) => {
      const n = i + 1;
      const nilai = toNumber(p.nilai);
      if (!String(p.label || "").trim()) errors.push("Penyesuaian " + n + ": label wajib diisi.");
      if (EFEK.indexOf(p.efek) === -1) errors.push("Penyesuaian " + n + ": efek tidak valid.");
      if (MODE.indexOf(p.mode) === -1) errors.push("Penyesuaian " + n + ": mode tidak valid.");
      if (!(nilai >= 0)) errors.push("Penyesuaian " + n + ": nilai harus ≥ 0.");
      if (p.mode === "nominal" && nilai >= 0 && !Number.isInteger(nilai)) errors.push("Penyesuaian " + n + ": nilai Rupiah harus bilangan bulat.");
      // Persen selalu dihitung dari subtotal item (bukan dari penyesuaian lain).
      const jumlah = !(nilai >= 0) ? 0 : p.mode === "persen" ? Math.round((subtotal * nilai) / 100) : Math.round(nilai);
      return {
        label: String(p.label || "").trim(),
        efek: p.efek,
        mode: p.mode,
        nilai: nilai >= 0 ? nilai : 0,
        jumlah,
      };
    });
    const total_penyesuaian = penyesuaian.reduce((s, p) => s + (p.efek === "tambah" ? p.jumlah : -p.jumlah), 0);
    const nominal = subtotal + total_penyesuaian;
    if (nominal < 0) errors.push("Total nota tidak boleh negatif.");
    else if (rawItems.length && nominal === 0) errors.push("Total nota harus lebih dari 0.");

    // Basis alokasi: subtotal per kategori, urut kemunculan item.
    const order = [];
    const base = {};
    items.forEach((it) => {
      if (!it.category) return;
      if (!(it.category in base)) {
        base[it.category] = 0;
        order.push(it.category);
      }
      base[it.category] += it.subtotal;
    });
    const rincian_kategori = nominal >= 0 ? allocateProportional(order.map((c) => [c, base[c]]), nominal) : {};

    return {
      items,
      penyesuaian,
      subtotal,
      total_penyesuaian,
      nominal,
      rincian_kategori,
      category: topCategory(rincian_kategori),
      errors,
      valid: errors.length === 0,
    };
  }

  // Array → objek ber-id stabil { i1: …, i2: … } (bukan array, spt spesifikasi).
  function toIdMap(list, prefix) {
    const out = {};
    list.forEach((x, i) => (out[prefix + (i + 1)] = x));
    return out;
  }

  // Objek ber-id → array urut numerik id (i2 sebelum i10).
  function fromIdMap(obj, prefix) {
    if (!obj || typeof obj !== "object") return [];
    return Object.keys(obj)
      .filter((k) => obj[k] && typeof obj[k] === "object")
      .sort((a, b) => (Number(a.slice(prefix.length)) || 0) - (Number(b.slice(prefix.length)) || 0))
      .map((k) => Object.assign({ id: k }, obj[k]));
  }

  /* ================= Builder payload record ================= */

  function validateCommon(f, errors) {
    if (!isIsoDate(f.tanggal)) errors.push("Tanggal tidak valid.");
    if (!isTime(f.waktu)) errors.push("Waktu tidak valid.");
    if (f.by !== "iyon" && f.by !== "ciwul") errors.push('"Dibuat oleh" wajib dipilih.');
  }

  function typeToFs(type) {
    return type === "income" ? "pemasukan" : "pengeluaran";
  }

  // Field record TANPA `kode` — kode ditempel data layer setelah dapat nomor.
  // f: { type: "income"|"expense", account_type, category, nominal, catatan, by, tanggal, waktu, timestamp }
  function buildSatuan(f) {
    const errors = [];
    validateCommon(f, errors);
    if (ACCOUNT_TYPES.indexOf(f.account_type) === -1) errors.push("Account type tidak valid.");
    if (f.type !== "income" && f.type !== "expense") errors.push("Jenis transaksi tidak valid.");
    if (!f.category) errors.push("Kategori wajib dipilih.");
    const nominal = toNumber(f.nominal);
    if (!(nominal > 0) || !Number.isInteger(nominal)) errors.push("Jumlah harus angka Rupiah lebih dari 0.");
    return {
      errors,
      record: {
        bentuk: "satuan",
        account_type: f.account_type,
        transaksi: typeToFs(f.type),
        category: f.category,
        nominal,
        catatan: f.catatan || "",
        by: f.by,
        tanggal: f.tanggal,
        waktu: f.waktu,
        timestamp: f.timestamp,
      },
    };
  }

  // f: { type, account_type, judul, items, penyesuaian, by, tanggal, waktu, timestamp }
  function buildNota(f) {
    const errors = [];
    validateCommon(f, errors);
    if (ACCOUNT_TYPES.indexOf(f.account_type) === -1) errors.push("Account type tidak valid.");
    if (f.type !== "income" && f.type !== "expense") errors.push("Jenis transaksi tidak valid.");
    if (!String(f.judul || "").trim()) errors.push("Judul nota wajib diisi.");
    const calc = computeNota(f);
    calc.errors.forEach((e) => errors.push(e));
    return {
      errors,
      calc,
      record: {
        bentuk: "nota",
        account_type: f.account_type,
        transaksi: typeToFs(f.type),
        judul: String(f.judul || "").trim(),
        by: f.by,
        tanggal: f.tanggal,
        waktu: f.waktu,
        timestamp: f.timestamp,
        items: toIdMap(calc.items, "i"),
        penyesuaian: toIdMap(calc.penyesuaian, "p"),
        subtotal: calc.subtotal,
        total_penyesuaian: calc.total_penyesuaian,
        nominal: calc.nominal,
        // Dual-write utk klien lama (baca `category` + `nominal`).
        category: calc.category,
        rincian_kategori: calc.rincian_kategori,
      },
    };
  }

  // f: { dari, ke, nominal, biaya_admin, catatan, by, tanggal, waktu, timestamp }
  function buildPindah(f) {
    const errors = [];
    validateCommon(f, errors);
    if (ACCOUNT_TYPES.indexOf(f.dari) === -1 || ACCOUNT_TYPES.indexOf(f.ke) === -1) errors.push("Account dari/ke tidak valid.");
    else if (f.dari === f.ke) errors.push("Account asal dan tujuan tidak boleh sama.");
    const nominal = toNumber(f.nominal);
    const fee = f.biaya_admin === "" || f.biaya_admin == null ? 0 : toNumber(f.biaya_admin);
    if (!(nominal > 0) || !Number.isInteger(nominal)) errors.push("Jumlah dipindah harus angka Rupiah lebih dari 0.");
    if (!(fee >= 0) || !Number.isInteger(fee)) errors.push("Biaya admin harus angka Rupiah ≥ 0.");
    return {
      errors,
      record: {
        bentuk: "pindah",
        transaksi: "pindah",
        dari: f.dari,
        ke: f.ke,
        nominal,
        biaya_admin: fee >= 0 ? fee : 0,
        catatan: f.catatan || "",
        by: f.by,
        tanggal: f.tanggal,
        waktu: f.waktu,
        timestamp: f.timestamp,
      },
    };
  }

  // Field yang TERKUNCI setelah dibuat (spesifikasi §5). Data layer menolak
  // update yang menyentuh field ini.
  const LOCKED_FIELDS = ["kode", "tanggal", "account_type", "bentuk", "dari", "ke"];

  /* ================= Normalizer (record mentah → internal) ================= */

  // Bentuk internal yang dipakai UI. Record V1 (tanpa field baru) tetap valid:
  // account_type → bank, bentuk → satuan, kode → null (UI tampilkan "—").
  //
  // Rules tidak memvalidasi isi record, jadi record V2 bisa saja kehilangan
  // field V2-nya (mis. diedit web mobile yang menimpa pakai .set() field V1).
  // Kalau key-nya berformat kode, kode/account_type/dari/ke/bentuk pindah
  // dipulihkan dari key. Item nota yang hilang tidak bisa dipulihkan — total
  // & kategori utama tetap terbaca dari nominal/category.
  function normalizeRecord(ym, key, raw) {
    raw = Object.assign({}, raw || {});
    const fromKey = parseKode(key);
    if (fromKey) {
      if (!raw.kode) raw.kode = key;
      if (fromKey.transfer) {
        if (!raw.bentuk) raw.bentuk = "pindah";
        if (!raw.dari) raw.dari = fromKey.dari;
        if (!raw.ke) raw.ke = fromKey.ke;
      } else if (!raw.account_type) {
        raw.account_type = fromKey.account_type;
      }
    }
    const bentuk = BENTUK.indexOf(raw.bentuk) !== -1 ? raw.bentuk : raw.transaksi === "pindah" ? "pindah" : "satuan";
    const type = bentuk === "pindah" ? "transfer" : raw.transaksi === "pemasukan" ? "income" : "expense";
    const numericKey = /^\d+$/.test(key) ? Number(key) : 0;
    const timestamp = Number(raw.timestamp) || numericKey;
    const amount = Number(raw.nominal) || 0;
    const items = bentuk === "nota" ? fromIdMap(raw.items, "i") : [];
    const penyesuaian = bentuk === "nota" ? fromIdMap(raw.penyesuaian, "p") : [];

    let rincian = {};
    if (type !== "transfer") {
      if (raw.rincian_kategori && typeof raw.rincian_kategori === "object") {
        Object.keys(raw.rincian_kategori).forEach((k) => (rincian[k] = Number(raw.rincian_kategori[k]) || 0));
      } else if (raw.category) {
        rincian[raw.category] = amount;
      }
    }

    return {
      id: key,
      ym,
      kode: raw.kode || null,
      legacy: !raw.kode,
      bentuk,
      type,
      account_type: type === "transfer" ? null : ACCOUNT_TYPES.indexOf(raw.account_type) !== -1 ? raw.account_type : DEFAULT_ACCOUNT,
      dari: type === "transfer" ? raw.dari : null,
      ke: type === "transfer" ? raw.ke : null,
      fee: type === "transfer" ? Number(raw.biaya_admin) || 0 : 0,
      amount,
      category: raw.category || (type === "transfer" ? null : topCategory(rincian)),
      rincian,
      note: raw.catatan || "",
      title: raw.judul || "",
      items,
      penyesuaian,
      subtotal: Number(raw.subtotal) || 0,
      totalAdjust: Number(raw.total_penyesuaian) || 0,
      date: raw.tanggal || ym,
      time: isTime(raw.waktu) ? raw.waktu : timestamp ? formatTime(timestamp) : "00:00:00",
      timestamp,
      by: raw.by || "ciwul",
    };
  }

  /* ================= Agregasi ================= */

  // Tampil di filter account? Pindah tampil di tab `dari` DAN `ke`.
  function matchesAccount(tx, acct) {
    if (!acct || acct === "all") return true;
    if (tx.type === "transfer") return tx.dari === acct || tx.ke === acct;
    return tx.account_type === acct;
  }

  // Kontribusi ke total pemasukan/pengeluaran. Pindah bukan pemasukan/
  // pengeluaran — kecuali biaya admin (pengeluaran di account asal).
  function flowOf(tx) {
    if (tx.type === "transfer") return { income: 0, expense: tx.fee };
    return tx.type === "income" ? { income: tx.amount, expense: 0 } : { income: 0, expense: tx.amount };
  }

  // Nilai per kategori { type, byCat } — nota pakai rincian_kategori.
  function categoryAmounts(tx) {
    if (tx.type === "transfer") {
      return tx.fee > 0 ? { type: "expense", byCat: { [TRANSFER_FEE_CATEGORY]: tx.fee } } : { type: "expense", byCat: {} };
    }
    return { type: tx.type, byCat: tx.rincian };
  }

  // Ringkasan sekumpulan record untuk satu filter account.
  //   income/expense: hanya record milik account itu (pindah: biaya admin di asal)
  //   transferIn/out: nominal pindah masuk/keluar account itu (0 utk "all")
  //   balance: income − expense + transferIn − transferOut
  function summarize(list, acct) {
    const all = !acct || acct === "all";
    let income = 0, expense = 0, transferIn = 0, transferOut = 0;
    list.forEach((tx) => {
      if (tx.type === "transfer") {
        if (all || tx.dari === acct) expense += tx.fee;
        if (!all && tx.dari === acct) transferOut += tx.amount;
        if (!all && tx.ke === acct) transferIn += tx.amount;
        return;
      }
      if (!all && tx.account_type !== acct) return;
      if (tx.type === "income") income += tx.amount;
      else expense += tx.amount;
    });
    return { income, expense, transferIn, transferOut, balance: income - expense + transferIn - transferOut };
  }

  // Total per kategori untuk satu tipe ("income"|"expense").
  function totalsByCategory(list, type) {
    const out = {};
    list.forEach((tx) => {
      const c = categoryAmounts(tx);
      if (c.type !== type) return;
      Object.keys(c.byCat).forEach((k) => (out[k] = (out[k] || 0) + c.byCat[k]));
    });
    return out;
  }

  // Jumlah pemakaian satu kategori (expense) — dipakai Rencana.
  function expenseInCategory(tx, categoryId) {
    const c = categoryAmounts(tx);
    if (c.type !== "expense") return 0;
    if (categoryId === "semua") return flowOf(tx).expense;
    return c.byCat[categoryId] || 0;
  }

  // Urut kronologis: tanggal → waktu → timestamp (key kode tidak kronologis).
  function compareChrono(a, b) {
    return a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || (a.timestamp || 0) - (b.timestamp || 0);
  }

  return {
    ACCOUNT_TYPES,
    ACCOUNT_LETTER,
    BENTUK,
    DEFAULT_ACCOUNT,
    TRANSFER_FEE_CATEGORY,
    KODE_RE,
    LOCKED_FIELDS,
    isIsoDate,
    isTime,
    yyyymmOf,
    kodePrefix,
    counterKey,
    formatKode,
    generateKode,
    previewKode,
    parseKode,
    allocateProportional,
    topCategory,
    computeNota,
    toIdMap,
    fromIdMap,
    buildSatuan,
    buildNota,
    buildPindah,
    normalizeRecord,
    matchesAccount,
    flowOf,
    categoryAmounts,
    summarize,
    totalsByCategory,
    expenseInCategory,
    compareChrono,
  };
});
