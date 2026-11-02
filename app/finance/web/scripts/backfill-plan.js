/* =========================================================
   Finance — scripts/backfill-plan.js
   Logika MURNI backfill (tanpa jaringan): dari isi /finance
   hasilkan daftar update multi-path. Dites di tests/backfill.test.js.

   Aturan:
   - Hanya MENAMBAH field yang belum ada. Tidak mengubah key,
     tidak menyentuh field lain, tidak menimpa nilai yang ada.
   - account_type kosong → "bank". Pengecualian: key berformat
     kode (record V2 yang field-nya tertimpa klien lama) →
     account dari prefix key (TC → cash). Pindah tidak diberi
     account_type (memang tidak punya).
   - opt.bentuk: bentuk kosong → "satuan" (key TF → "pindah",
     punya items → "nota").
   - opt.kode: kode kosong → key berformat kode: kode = key;
     record lama (key timestamp): kode T{B|C|E}-{YYYYMM}-{NNNNNN}
     urut timestamp per prefix per bulan (bulan dari `tanggal`),
     melanjutkan nomor tertinggi yang sudah ada (counter atau
     kode yang sudah dipakai), lalu counter di-seed supaya
     transaksi baru melanjutkan nomornya.
   - Idempoten: dijalankan ulang → tidak ada update.
   ========================================================= */

const Core = require("../finance-core.js");

function isMonthKey(k) {
  return /^\d{4}-\d{2}$/.test(k);
}

function planBackfill(data, opt) {
  opt = opt || {};
  data = data || {};
  const updates = {};
  const samples = [];
  const warnings = [];
  const stats = { scanned: 0, accountDefault: 0, accountFromKey: 0, bentuk: 0, kodeFromKey: 0, kode: 0, counters: 0 };
  const add = (p, value, note) => {
    updates[p] = value;
    if (samples.length < 10) samples.push(p + " = " + JSON.stringify(value) + (note ? "   (" + note + ")" : ""));
  };

  const counters = data.counters || {};
  const maxSeq = {}; // counterKey → nomor tertinggi yang sudah dipakai
  const bump = (k) => {
    const p = Core.parseKode(k);
    if (p) maxSeq[p.counterKey] = Math.max(maxSeq[p.counterKey] || 0, p.seq);
  };
  Object.keys(counters).forEach((k) => (maxSeq[k] = Math.max(maxSeq[k] || 0, Number(counters[k]) || 0)));

  const legacyForKode = [];
  Object.keys(data)
    .filter(isMonthKey)
    .sort()
    .forEach((ym) => {
      const month = data[ym] || {};
      Object.keys(month).forEach((id) => {
        const rec = month[id];
        if (!rec || typeof rec !== "object") return;
        stats.scanned++;
        const fromKey = Core.parseKode(id);
        const isTransfer = fromKey ? fromKey.transfer : rec.bentuk === "pindah" || rec.transaksi === "pindah";
        const base = ym + "/" + id + "/";
        bump(id);
        bump(rec.kode);

        if (!isTransfer && !rec.account_type) {
          if (fromKey) {
            add(base + "account_type", fromKey.account_type, "dari key");
            stats.accountFromKey++;
          } else {
            add(base + "account_type", Core.DEFAULT_ACCOUNT, "default bank");
            stats.accountDefault++;
          }
        }

        if (opt.bentuk && !rec.bentuk) {
          const bentuk = isTransfer ? "pindah" : rec.items && typeof rec.items === "object" ? "nota" : "satuan";
          add(base + "bentuk", bentuk);
          stats.bentuk++;
        }

        if (opt.kode && !rec.kode) {
          if (fromKey) {
            add(base + "kode", id, "dari key");
            stats.kodeFromKey++;
          } else if (!isTransfer) {
            legacyForKode.push({ ym, id, rec, account: rec.account_type || Core.DEFAULT_ACCOUNT });
          }
        }
      });
    });

  if (opt.kode) {
    const groups = {};
    legacyForKode.forEach((x) => {
      const tanggal = x.rec.tanggal;
      if (!Core.isIsoDate(tanggal)) {
        warnings.push(x.ym + "/" + x.id + ": tanggal tidak valid (" + tanggal + "), kode dilewati");
        return;
      }
      if (tanggal.slice(0, 7) !== x.ym) {
        warnings.push(x.ym + "/" + x.id + ": tanggal " + tanggal + " beda dgn node bulan, kode ikut tanggal");
      }
      const prefix = Core.kodePrefix({ bentuk: "satuan", account_type: x.account });
      const yyyymm = Core.yyyymmOf(tanggal);
      const ck = Core.counterKey(prefix, yyyymm);
      (groups[ck] = groups[ck] || { prefix, yyyymm, items: [] }).items.push(x);
    });
    Object.keys(groups)
      .sort()
      .forEach((ck) => {
        const g = groups[ck];
        const ts = (x) => Number(x.rec.timestamp) || Number(x.id) || 0;
        g.items.sort((a, b) => ts(a) - ts(b) || a.id.localeCompare(b.id));
        let seq = maxSeq[ck] || 0;
        if (seq) warnings.push(ck + ": nomor sudah terpakai sampai " + seq + ", kode transaksi lama dilanjutkan dari " + (seq + 1));
        g.items.forEach((x) => {
          seq++;
          add(x.ym + "/" + x.id + "/kode", Core.formatKode(g.prefix, g.yyyymm, seq));
          stats.kode++;
        });
        maxSeq[ck] = seq;
      });
    // Counter di-seed ke nomor tertinggi yang terpakai (hanya naik).
    Object.keys(maxSeq)
      .sort()
      .forEach((ck) => {
        if ((Number(counters[ck]) || 0) < maxSeq[ck]) {
          add("counters/" + ck, maxSeq[ck], "seed counter");
          stats.counters++;
        }
      });
  }

  return { updates, stats, samples, warnings };
}

module.exports = { planBackfill };
