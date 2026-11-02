#!/usr/bin/env node
/* =========================================================
   Finance — scripts/backup.js
   Export seluruh /finance (transaksi per bulan, counters,
   plans, categories) ke JSON berstempel waktu. Hanya MEMBACA.

   Pakai:
     node scripts/backup.js --emulator            # emulator lokal
     node scripts/backup.js --prod                # produksi
     node scripts/backup.js --prod --out D:/backup
   Default folder: app/finance/web/backups/ (di-gitignore).
   ========================================================= */

const { parseArgs, resolveTarget, backup, summarizeData } = require("./lib");

(async () => {
  const { flags, opts } = parseArgs(process.argv.slice(2));
  const target = resolveTarget(flags, opts);
  console.log("Target :", target.name);
  const { file, data } = await backup(target, opts.out);
  const s = summarizeData(data);
  console.log("Backup :", file);
  console.log("Isi    :", s.transactions, "transaksi di", s.months, "bulan,", s.counters, "counter");
})().catch((e) => {
  console.error("GAGAL:", e.message);
  process.exit(1);
});
