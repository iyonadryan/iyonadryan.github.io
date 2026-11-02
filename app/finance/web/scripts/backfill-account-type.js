#!/usr/bin/env node
/* =========================================================
   Finance — scripts/backfill-account-type.js
   Isi field V2 yang belum ada di record lama /finance/*:
     account_type (selalu), bentuk (--bentuk), kode (--kode).
   Tidak mengubah key, tidak menyentuh field lain. Idempoten.

   Pakai (WAJIB pilih target):
     node scripts/backfill-account-type.js --emulator            # DRY-RUN (default)
     node scripts/backfill-account-type.js --emulator --apply    # tulis (konfirmasi "YA")
     node scripts/backfill-account-type.js --prod                # DRY-RUN ke produksi
     node scripts/backfill-account-type.js --prod --apply [--bentuk] [--kode]

   Saat --apply: konfirmasi interaktif → backup otomatis ke
   backups/ → rencana dihitung ulang dari data backup (supaya
   tidak ada selisih dgn data terbaru) → tulis multi-path PATCH.
   Detail aturan: scripts/backfill-plan.js. Panduan: docs/migration-guide.md.
   ========================================================= */

const { parseArgs, resolveTarget, getFinance, patchPaths, backup, summarizeData, confirm } = require("./lib");
const { planBackfill } = require("./backfill-plan");

function printPlan(plan) {
  const s = plan.stats;
  console.log("Record diperiksa      :", s.scanned);
  console.log("account_type → bank   :", s.accountDefault);
  console.log("account_type dari key :", s.accountFromKey);
  console.log("bentuk                :", s.bentuk);
  console.log("kode (dari key)       :", s.kodeFromKey);
  console.log("kode (record lama)    :", s.kode);
  console.log("counter di-seed       :", s.counters);
  if (plan.samples.length) {
    console.log("\nContoh perubahan:");
    plan.samples.forEach((x) => console.log("  " + x));
  }
  if (plan.warnings.length) {
    console.log("\nPeringatan:");
    plan.warnings.forEach((w) => console.log("  ! " + w));
  }
}

(async () => {
  const { flags, opts } = parseArgs(process.argv.slice(2));
  const target = resolveTarget(flags, opts);
  const apply = flags.has("apply");
  const opt = { bentuk: flags.has("bentuk"), kode: flags.has("kode") };
  console.log("Target :", target.name);
  console.log("Mode   :", apply ? "APPLY (menulis)" : "DRY-RUN (tidak menulis)");
  console.log("Opsi   : account_type" + (opt.bentuk ? " + bentuk" : "") + (opt.kode ? " + kode + seed counter" : "") + "\n");

  const data = (await getFinance(target)) || {};
  const s = summarizeData(data);
  console.log("Data   :", s.transactions, "transaksi di", s.months, "bulan,", s.counters, "counter\n");
  const plan = planBackfill(data, opt);
  printPlan(plan);
  const total = Object.keys(plan.updates).length;
  console.log("\nTotal field yang akan ditulis:", total);

  if (!total) {
    console.log("Tidak ada yang perlu diubah (sudah ter-backfill).");
    return;
  }
  if (!apply) {
    console.log("DRY-RUN: tidak ada yang ditulis. Jalankan ulang dengan --apply untuk menulis.");
    return;
  }

  const ok = await confirm("\nTulis " + total + " field ke " + target.name + "? Ketik YA untuk lanjut: ", "YA");
  if (!ok) {
    console.log("Dibatalkan. Tidak ada yang ditulis.");
    return;
  }

  const bk = await backup(target, opts.out);
  console.log("Backup :", bk.file);
  // Hitung ulang dari data backup (diambil tepat sebelum menulis).
  const fresh = planBackfill(bk.data || {}, opt);
  const n = Object.keys(fresh.updates).length;
  await patchPaths(target, fresh.updates);
  console.log("Selesai:", n, "field ditulis. Jalankan ulang tanpa --apply untuk memastikan hasilnya 0.");
})().catch((e) => {
  console.error("GAGAL:", e.message);
  process.exit(1);
});
