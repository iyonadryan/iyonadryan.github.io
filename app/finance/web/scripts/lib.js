/* =========================================================
   Finance — scripts/lib.js
   Util bersama skrip migrasi (Node 18+, tanpa dependency).
   Akses database lewat REST API Realtime Database — node
   /finance memang terbuka baca/tulis (lihat database.rules.json),
   jadi tidak perlu SDK/login.

   Target WAJIB eksplisit:
     --emulator   → Firebase Emulator lokal (127.0.0.1:9000)
     --prod       → database produksi
   Tanpa salah satunya skrip menolak jalan.
   ========================================================= */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const PROD_URL = "https://iyon-adryanlf-trialerror.firebaseio.com";
const EMULATOR_URL = "http://127.0.0.1:9000";
const NAMESPACE = "iyon-adryanlf-trialerror"; // ns yg dipakai app (index.html?emulator)
const ROOT = "finance";

function parseArgs(argv) {
  const flags = new Set();
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const [k, v] = a.slice(2).split("=");
    if (v !== undefined) opts[k] = v;
    else if (["out", "host"].includes(k) && argv[i + 1] && !argv[i + 1].startsWith("--")) opts[k] = argv[++i];
    else flags.add(k);
  }
  return { flags, opts };
}

// Target database dari flag. Melempar kalau tidak eksplisit / dua-duanya.
function resolveTarget(flags, opts) {
  const emu = flags.has("emulator"), prod = flags.has("prod");
  if (emu === prod) {
    throw new Error("Pilih target secara eksplisit: --emulator (lokal) ATAU --prod (produksi).");
  }
  if (emu) {
    const base = opts.host ? "http://" + opts.host : EMULATOR_URL;
    return { name: "EMULATOR " + base, url: (p) => base + "/" + p + ".json?ns=" + NAMESPACE, prod: false };
  }
  return { name: "PRODUKSI " + PROD_URL, url: (p) => PROD_URL + "/" + p + ".json", prod: true };
}

async function request(target, method, p, body) {
  const res = await fetch(target.url(p), {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(method + " " + p + " → HTTP " + res.status + ": " + text);
  return text ? JSON.parse(text) : null;
}

const getFinance = (target) => request(target, "GET", ROOT);

// Multi-path update (PATCH) di bawah /finance, dipecah per `chunk` path.
async function patchPaths(target, updates, chunk = 400) {
  const keys = Object.keys(updates);
  for (let i = 0; i < keys.length; i += chunk) {
    const part = {};
    keys.slice(i, i + chunk).forEach((k) => (part[k] = updates[k]));
    await request(target, "PATCH", ROOT, part);
  }
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

// Simpan backup /finance ke JSON berstempel waktu. Resolve → path file.
async function backup(target, outDir) {
  const data = await getFinance(target);
  const dir = path.resolve(outDir || path.join(__dirname, "..", "backups"));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "finance-" + (target.prod ? "prod" : "emulator") + "-" + stamp() + ".json");
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return { file, data };
}

function isMonthKey(k) {
  return /^\d{4}-\d{2}$/.test(k);
}

// Statistik singkat isi /finance (utk log).
function summarizeData(data) {
  const months = Object.keys(data || {}).filter(isMonthKey);
  const tx = months.reduce((s, m) => s + Object.keys(data[m] || {}).length, 0);
  return { months: months.length, transactions: tx, counters: Object.keys((data || {}).counters || {}).length };
}

// Konfirmasi interaktif: user harus mengetik `expected` persis.
function confirm(question, expected) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(String(answer).trim() === expected);
    });
  });
}

module.exports = { parseArgs, resolveTarget, request, getFinance, patchPaths, backup, isMonthKey, summarizeData, confirm, stamp };
