/* =========================================================
   Finance App (Desktop) — finance-data.js
   Layer tulis Firebase untuk record V2 (berkode). Tidak tahu
   apa-apa soal UI; perhitungan ada di finance-core.js.

   Dipakai di browser (global `FinanceData`); `db`
   (firebase.database()) disuntik dari luar.

   Alur simpan record baru:
   1. transaction() counter /finance/counters/{prefix}-{YYYYMM}
      → nomor urut (null dianggap 0). Atomik antar perangkat.
   2. transaction() di /finance/{YYYY-MM}/{kode}: hanya menulis
      kalau node masih kosong. Kalau ternyata sudah terisi
      (mis. counter belum di-seed setelah backfill), ulangi
      langkah 1 → tidak pernah menimpa record lain.
   Kalau langkah 2 gagal setelah counter naik (koneksi putus),
   nomor itu BOLONG — boleh, yang dilarang cuma nomor DOBEL.
   ========================================================= */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./finance-core.js"));
  else root.FinanceData = factory(root.FinanceCore);
})(typeof self !== "undefined" ? self : this, function (Core) {
  "use strict";

  const MAX_ATTEMPTS = 5;

  function create(db, rootPath) {
    const base = rootPath || "finance";
    const ref = (p) => db.ref(base + (p ? "/" + p : ""));

    // Naikkan counter secara atomik, hasilnya nomor urut baru.
    function nextSeq(key) {
      return ref("counters/" + key)
        .transaction((cur) => (Number(cur) || 0) + 1)
        .then((res) => {
          if (!res.committed) throw new Error("Counter " + key + " gagal dinaikkan");
          return res.snapshot.val();
        });
    }

    function currentCounter(key) {
      return ref("counters/" + key)
        .once("value")
        .then((s) => Number(s.val()) || 0);
    }

    // Simpan record baru (payload dari Core.buildSatuan/buildNota/buildPindah,
    // tanpa `kode`). Resolve → kode yang dipakai.
    function saveNew(record) {
      const prefix = Core.kodePrefix(record);
      const yyyymm = Core.yyyymmOf(record.tanggal);
      const ym = record.tanggal.slice(0, 7);
      const key = Core.counterKey(prefix, yyyymm);

      const attempt = (n) =>
        nextSeq(key).then((seq) => {
          const kode = Core.formatKode(prefix, yyyymm, seq);
          const payload = Object.assign({ kode }, record);
          return ref(ym + "/" + kode)
            .transaction((cur) => (cur === null ? payload : undefined))
            .then((res) => {
              if (res.committed) return kode;
              if (n + 1 >= MAX_ATTEMPTS) throw new Error("Gagal mendapat kode unik untuk " + key);
              return attempt(n + 1); // key sudah terisi → ambil nomor berikutnya
            });
        });
      return attempt(0);
    }

    // Update sebagian field (BUKAN .set()) — field V2 lain tidak tersentuh.
    // Field terkunci (kode, tanggal, account_type, bentuk, dari, ke) ditolak.
    function update(ym, id, fields) {
      const locked = Object.keys(fields).filter((k) => Core.LOCKED_FIELDS.indexOf(k) !== -1);
      if (locked.length) return Promise.reject(new Error("Field terkunci tidak boleh diubah: " + locked.join(", ")));
      return ref(ym + "/" + id).update(fields);
    }

    // Ganti isi nota (items/penyesuaian) — node anak diganti utuh supaya item
    // yang dihapus ikut hilang, field lain lewat update biasa.
    function updateNota(ym, id, record) {
      const fields = {};
      ["judul", "by", "waktu", "items", "penyesuaian", "subtotal", "total_penyesuaian", "nominal", "category", "rincian_kategori"].forEach((k) => {
        if (k in record) fields[k] = record[k];
      });
      return update(ym, id, fields);
    }

    function remove(ym, id) {
      return ref(ym + "/" + id).remove();
    }

    return { nextSeq, currentCounter, saveNew, update, updateNota, remove };
  }

  return { create };
});
