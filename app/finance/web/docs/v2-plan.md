# Finance App V1 → V2 — Rencana (Fase 1: Audit)

> Status: **Semua fase (1–9) selesai, 2 Nov 2026.** Ringkasan perubahan: `v2-changelog.md`. Sisa pekerjaan: lihat bagian "Belum" di changelog.
> Scope: **hanya `app/finance/web/` (web desktop)**. Desain: artifact "Finance App Desktop", halaman **Prototype V2** (`MainV2.dc.html` + varian `*V2.dc.html`).

## 0. Keputusan setelah review (2 Nov 2026)

| # | Keputusan |
|---|---|
| D1 | **Flutter (APK Android) diabaikan dulu.** Tidak diubah. Catatan perubahan untuknya tetap di §7. |
| D2 | **Web mobile (`app/finance/`) tidak diubah.** Kalau perlu, menyusul. Konsekuensinya: web mobile tetap bisa baca/tambah/hapus, tapi **edit record V2 dari web mobile akan ditolak rules** (lihat §4.2). Record lama tetap bisa diedit dari web mobile seperti biasa. |
| D3 | Transaksi baru dari web mobile/Flutter tetap tanpa kode (dibaca sebagai bank). |
| D4 | Pertanyaan yang belum dijawab dipakai **rekomendasi** dulu (bisa diubah): counter di `/finance/counters` (Q2), biaya admin → `lainnya-keluar` (Q4), tie-break urutan pakai `timestamp` (Q8). **Tidak ada commit otomatis**: commit/push oleh kamu (Q7). Q5 (baris "Pindah masuk/keluar") diputuskan saat Fase 6. Q6 (rules console) dibutuhkan **sebelum deploy rules**, bukan sebelum Fase 2. |

---

## 1. Hasil audit repo

### 1.1 Siapa saja yang baca/tulis `/finance`

Ternyata ada **3 klien** yang nulis ke node yang sama, dan semuanya ada di repo ini:

| Klien | Lokasi | Cara tulis transaksi | Catatan penting buat V2 |
|---|---|---|---|
| **Web desktop** (target V2) | `app/finance/web/` | `addTransaction` → key `dateTimeMs(tanggal, waktu)` +1, diklaim via `transaction()`. Edit pakai `.set()` field lengkap. | Sudah tulis `waktu`, `timestamp`, `by`. |
| **Web mobile** | `app/finance/` | Sama persis dengan desktop (desktop di-port dari sini). Edit pakai **`.set()`** dengan field V1 saja. | `FS_TO_TYPE[t.transaksi] \|\| "expense"` → record `transaksi: "pindah"` bakal **dihitung sebagai pengeluaran sebesar `nominal`**. |
| **App Flutter** | `app/mobile/lib/finance/` | Key = `DateTime.now().millisecondsSinceEpoch` (tanpa `waktu`). Edit pakai **`.set(tx.toMap())`** dengan field V1 saja. | `TxType.fromFs`: selain `"pemasukan"` = pengeluaran → sama, `pindah` jadi pengeluaran. `createdAt` & `timestamp` diambil dari **key** (`int.tryParse(id)`) → untuk key kode (`TB-…`) jadi **0 / 1970**. |

**Risiko terbesar yang ketemu saat audit:** dua klien lama mengedit dengan `.set()` (menimpa node). Kalau record V2 (punya `kode`, `account_type`, `bentuk`, `items`, `penyesuaian`, …) diedit dari web mobile atau Flutter, **semua field V2 hilang**. Flutter bahkan menulis `timestamp: 0` dan menghapus `waktu`. Lihat §7 dan pertanyaan **Q1**.

### 1.2 Infrastruktur

- **Tidak ada** `firebase.json`, file rules, `package.json`, test, linter, atau emulator di repo. Project murni HTML/CSS/JS statis (GitHub Pages), dibuka langsung tanpa build.
- **Rules Firebase dikelola di console**, dipakai bareng project 24Card. Menurut dokumentasi (`app/.claude/finance-app.md`): global `.read: true`, `.write: false`, kecuali `trial-error/24Card` dan `finance` yang `.write: true`. **Tidak ada auth**: semua data bisa dibaca publik. Isi rules persisnya belum saya lihat (lihat **Q6**).
- Mesin dev: Node 18.20, JDK 17 (dipakai Flutter) → **Firebase Emulator bisa jalan** (`firebase-tools@13`, mendukung Node 18).
- Semua klien memakai **satu listener `on("value")` di `/finance`** (seluruh pohon). Index `.indexOn` belum dipakai query apa pun, tapi aman ditambahkan.

### 1.3 Fitur bagian 6 yang SUDAH ada (jawaban Q5 di brief)

| Fitur | Status di web desktop |
|---|---|
| Halaman Analisis (Periode A vs B) | ✅ ada |
| Import Excel/CSV + template dropdown (ExcelJS) | ✅ ada, membuat record satuan, **belum** ada kolom Account Type |
| Pagination + search + limit 10/25/50 di Transaksi | ✅ ada (fase 4 tinggal **tambah kode ke search**) |
| Emoji/icon kategori + warna slot | ✅ ada |
| Panel detail transaksi, Edit/Hapus, Export Excel | ✅ ada, perlu baris Kode / struk nota / tampilan pindah |
| Info page | ✅ ada, perlu 2 kartu baru |
| Tab Account Type, kode transaksi, nota, penyesuaian, pindah | ❌ belum |
| Rules di repo, test, emulator, skrip migrasi | ❌ belum |

### 1.4 Selisih desain V2 vs spesifikasi brief

Brief yang dipakai kalau ada beda:

1. **Penyesuaian (diskon/PPN/dll.)**: tidak ada di desain. Halaman Nota di desain cuma punya item + TOTAL. Saya tambahkan bagian Penyesuaian + "TOTAL DIBAYAR/DITERIMA" mengikuti gaya komponen yang sudah ada (toggle, money-input, chip).
2. **Kode pindah**: di desain `TF-202610-000001` (tanpa asal/tujuan); brief `TF-BC-202611-000001` → ikut **brief**.
3. **Template Excel V2**: di desain sama persis dengan V1 (tanpa kolom Account Type) → ikut **brief** (tambah kolom).
4. **Nota di tabel bisa dibuka (expand item)**: tidak ada di desain → ikut brief (baris "N item" + expand).
5. Desain menyembunyikan **navigasi bulan & toggle user** di halaman Nota → saya ikuti.

---

## 2. Arsitektur yang diusulkan

```
app/finance/web/
  finance-core.js        ← BARU. Modul murni (tanpa DOM/Firebase): generateKode, parseKode,
                            hitung nota/penyesuaian/alokasi, saldo, normalizer record V1→V2.
                            Format UMD: jalan di browser (classic <script>, tetap bisa dibuka tanpa
                            server) DAN di Node (require) untuk test.
  finance-data.js        ← BARU (opsional, bisa tetap di script.js). Wrapper Firebase:
                            nextKode() via transaction counter, saveRecord, updateRecord, deleteRecord.
  script.js              ← UI (sudah ada), dipindah supaya pakai core + data layer.
  nota.html? → TIDAK. Halaman Nota = view baru `#nota` di index.html (SPA, sesuai desain: menu Transaksi
               tetap aktif + breadcrumb). Edit nota = `#nota/<YYYY-MM>/<kode>`.
  database.rules.json    ← BARU. Draf rules (lihat §4). Deploy manual oleh kamu.
  firebase.json          ← BARU. Hanya untuk emulator (database + rules).
  package.json           ← BARU, dev-only: firebase-tools, firebase@8.10.1 (SDK sama dgn browser).
  tests/
    core.test.js         ← unit test modul murni (node:test, bawaan Node 18, tanpa dependency)
    emulator/*.test.js   ← integrasi di Emulator: counter 2 penulis bersamaan, rules, record lama
  scripts/
    backup.js            ← export /finance (+ counters) ke JSON berstempel waktu
    backfill-account-type.js  ← --dry-run (default) | --apply, --bentuk, --kode
  docs/
    v2-plan.md           ← file ini
    v2-changelog.md      ← fase 9
    migration-guide.md   ← fase 8
```

- `node_modules/` di-gitignore (perlu `.gitignore` baru di `app/finance/web/`, karena di root belum ada).
- **Lint**: belum ada linter. Usul: per fase pakai `node --check` + `node --test`. ESLint baru ditambahkan kalau kamu mau (dependency tambahan).

---

## 3. Kode transaksi & counter

- Format: `T{B|C|E}-{YYYYMM}-{NNNNNN}` dan `TF-{asal}{tujuan}-{YYYYMM}-{NNNNNN}`, dengan 6 digit (Q-brief #1: pakai **6 digit**).
- Bulan diambil dari `tanggal` (bukan waktu input).
- **Lokasi counter: usul `/finance/counters/{prefix}-{YYYYMM}`**, bukan `/counters` di root (lihat **Q2**). Alasannya:
  1. Rules sekarang cuma mengizinkan tulis di `finance` dan `trial-error/24Card`; `/counters` di root bakal ditolak kecuali rules root diubah.
  2. Nama `/counters` di root terlalu generik untuk database yang dipakai banyak app.
  3. Sudah dicek: ketiga klien aman dengan key baru `counters` di bawah `/finance`. Web memakai regex `^\d{4}-\d{2}$` untuk node bulan, dan Flutter melewati child yang bukan `Map`.
- Alur simpan (`nextKode` + `saveRecord`):
  1. `transaction()` di `/finance/counters/TB-202611` → `(cur || 0) + 1` → nomor urut.
  2. Tulis record di `/finance/2026-11/TB-202611-000007` **lewat `transaction()` juga** (`cur === null ? record : abort`). Jadi kalau ada data tak terduga di key itu (mis. counter belum di-seed setelah backfill `--kode`), record lama **tidak tertimpa**: counter naik lagi lalu coba nomor berikutnya.
  3. Kalau langkah 2 gagal (koneksi putus setelah counter naik), nomor jadi **bolong**, tapi tidak akan dobel. Ini didokumentasikan.
  - Catatan: brief minta "multi-path update", tapi RTDB tidak bisa menggabungkan `transaction()` dan `update()` secara atomik. Karena itu langkah 2 pakai transaction-on-key. Hasilnya setara: tidak ada dobel dan tidak ada timpa.
- **Offline** (Q-brief #3): Firebase JS SDK di web **tidak punya penyimpanan offline persisten**, cuma antrean di memori selama tab terbuka. `transaction()` selalu butuh server. **V1 juga sudah begitu** (klaim key transaksi sekarang pakai `transaction()`), jadi V2 **tidak menambah batasan baru** di web. Usul tambahan: cek `.info/connected` sebelum simpan, dan kalau offline tampilkan pesan "Butuh koneksi internet untuk membuat kode transaksi", supaya tidak menggantung diam-diam.
- **Hapus** (Q-brief #4): semua klien hard-delete (`.remove()`), tidak ada soft-delete/arsip. Nomor tidak dipakai ulang dan counter tidak turun.

---

## 4. Skema & rules

### 4.1 Normalizer baca (di `finance-core.js`)

`normalizeRecord(ym, key, raw)` → objek internal V2:
- `account_type` kosong → `"bank"`; `bentuk` kosong → `"satuan"`; `kode` kosong → `null` (UI tampil `—`).
- `transaksi: "pindah"` → `type: "transfer"`. Selain itu tetap `income`/`expense`.
- Nota: `items`/`penyesuaian` objek → array terurut by id (`i1, i2, …`, urut numerik).
- `rincian_kategori` kosong (satuan / record lama) → `{ [category]: nominal }`, supaya semua agregasi kategori cukup baca satu field.

### 4.2 Draf rules (`database.rules.json`)

- Hanya menambah `.validate` di bawah `finance`. **Tidak** mengubah `.read`/`.write` global, 24Card, maupun pola auth (tetap tanpa auth, sama seperti sekarang). Saya butuh salinan rules console yang sekarang sebagai basis supaya path lain tidak berubah (**Q6**).
- Validasi record di `/finance/$bulan/$id` (`$bulan` cocok `^\d{4}-\d{2}$`):
  - Kalau ada: `account_type` ∈ {bank, cash, e_money}; `bentuk` ∈ {satuan, nota, pindah}.
  - **Key bentuk kode** (`T…`): `kode` wajib dan `== $id`, cocok regex, prefix sesuai `account_type`/`dari`+`ke`, bulan di kode == `$bulan`.
  - **Record V2 yang sudah ada**: `kode`, `tanggal`, `account_type`, `bentuk`, `dari`, `ke` tidak boleh berubah atau hilang.
  - **Record lama (key angka)**: `account_type` dan `kode` boleh **ditambahkan sekali** (untuk backfill), setelah itu terkunci. Field lain tetap bebas seperti sekarang.
  - Hapus record tetap boleh (`.validate` tidak berlaku saat delete).
- `/finance/counters/$k`: angka bulat, dan `newData > data` (hanya boleh naik).
- **Efek samping positif:** rules "kode tidak boleh hilang" otomatis **menolak** edit `.set()` dari web mobile/Flutter terhadap record V2. Edit gagal dengan error, bukan diam-diam menghapus field V2. Ini jaring pengaman sampai klien lama dipatch (Q1).
- **Kontradiksi kecil di brief**: "kode harus sama dengan key" vs backfill `--kode` "beri kode ke record lama tanpa re-key". Solusi di atas: aturan `kode == key` hanya berlaku untuk key berformat kode, dan record lama boleh punya `kode ≠ key`.
- `.indexOn: ["timestamp", "account_type", "tanggal"]` di `/finance/$bulan`.
- Semua rules diuji di emulator, termasuk record lama tanpa field baru, klien lama yang `.set()` record V2, dan counter turun/naik.
- **Deploy ke produksi: oleh kamu** (paste ke console atau `firebase deploy --only database`). Saya tidak akan deploy.

---

## 5. Logika bisnis (modul murni + test)

- **Nota**: `items.subtotal = round(qty × harga)`, `subtotal = Σ`, `penyesuaian.jumlah = round(persen × subtotal / 100)` atau nilai Rp, `total_penyesuaian = Σtambah − Σkurang`, `nominal = subtotal + total_penyesuaian`, wajib ≥ 0 dan minimal 1 item.
- **Alokasi proporsional (Opsi A)**: `alloc[c] = round(base[c] × nominal / subtotal)`, lalu sisa pembulatan ke kategori terbesar (tie → urutan kategori pertama muncul), sehingga `Σ rincian_kategori == nominal` **selalu**. Edge case: `subtotal == 0` → semua nominal ke kategori item pertama. Diuji dengan angka yang sengaja menghasilkan sisa pembulatan (mis. 3 kategori 33,33%).
- `category` top-level = kategori terbesar di `rincian_kategori` (dual-write untuk klien lama).
- **Saldo per account**: pemasukan `+`, pengeluaran `−`, pindah `dari −(nominal+biaya_admin)`, `ke +nominal`.
- **Total pemasukan/pengeluaran & per kategori** (Dashboard, Analisis, Rencana, hitungan Kategori): pindah tidak dihitung, kecuali `biaya_admin` sebagai pengeluaran (kategori lihat Q4). Nota memakai `rincian_kategori`.
- **Urutan kronologis**: list Transaksi sekarang diurut `tanggal` → `waktu` → key. Key kode tidak kronologis, jadi tie-break diganti **`timestamp`** (lihat Q8). "Transaksi Terbaru" tetap urut `timestamp` (waktu input).
- **Edit** (V2): boleh ubah catatan, nominal/item/penyesuaian, kategori, `by`, waktu. Terkunci: `tanggal`, `account_type`, `bentuk`, `dari`, `ke`, `kode`. Edit pakai **`update()` field yang berubah saja**, bukan `.set()`. Catatan: di V1 `by` & kategori terkunci, di V2 jadi boleh diubah sesuai brief.

---

## 6. Fase pengerjaan (mengikuti brief §9)

| Fase | Isi | File utama | Risiko / catatan |
|---|---|---|---|
| **1** | Audit + rencana (ini) | `docs/v2-plan.md` | — |
| **2** | Fondasi: `finance-core.js` + unit test, normalizer, data layer counter, `database.rules.json`, `firebase.json`, `package.json`, emulator test (counter 2 penulis, rules, record lama) | file baru di `web/` | Tidak menyentuh UI. Butuh `npm install` (dev only). |
| **3** | Account Type + kode untuk **satuan**: simpan/baca, tab Account Type (Dashboard & Transaksi, state dibagi), kolom kode, search kode, panel detail, Edit dgn field terkunci, kartu Info | `script.js`, `index.html`, `css/*` | Mulai menulis record berkey kode ke produksi **saat kamu memakai app**. Butuh Q1/Q2/Q6 beres dulu. |
| **4** | Pagination/search/limit | — | **Sudah ada**; cukup tambah kode ke search (masuk fase 3). |
| **5** | Nota: halaman `#nota` (info, tabel item, penyesuaian, struk), simpan/edit/hapus, tabel "N item" + expand, struk di panel detail, integrasi `rincian_kategori` ke Dashboard/Analisis/Rencana/Kategori | `script.js`, `index.html`, `css/pages.css` | Paling besar. |
| **6** | Pindah account di balik `ENABLE_TRANSFER = false` (konstanta di `script.js`): form, simpan, tampil di tabel/detail (muncul di tab `dari` & `ke`), saldo | `script.js`, `index.html` | Record pindah yang sudah ada tetap dibaca walau flag mati. |
| **7** | Import: kolom Account Type (dropdown, kosong → bank) + kode otomatis berurutan | `excel-template.js`, `script.js` | Import tetap all-or-nothing validasi; nomor bisa bolong kalau koneksi putus di tengah. |
| **8** | `scripts/backup.js`, `scripts/backfill-account-type.js` (`--dry-run` default, `--apply` + konfirmasi, `--bentuk`, `--kode` + seed counter), `docs/migration-guide.md` | `scripts/` | Diuji ke emulator saja. Produksi = kamu yang jalankan. |
| **9** | Hardening: test menyeluruh, QA light/dark + responsif (screenshot headless), `docs/v2-changelog.md`, update `app/.claude/finance-app.md` | — | — |

Tiap fase: `node --check` + `npm test` (unit + emulator).

### Import "Kode Nota" (ditunda, catatan desain)
Kolom opsional `Kode Nota` (bebas, mis. `N1`). Baris dengan nilai sama digabung jadi satu nota: Tipe/Tanggal/Account/Dibuat oleh harus sama dalam satu grup (kalau beda → error per baris). Kolom `Nama item`, `Qty`, `Satuan`, `Harga satuan` mengisi item. Penyesuaian lewat baris khusus `Tipe = Penyesuaian` dengan Efek/Mode/Nilai. `Nominal` diabaikan untuk baris nota (dihitung). Belum dikerjakan.

---

## 7. Yang perlu diubah di klien lama (tanpa saya ubah, kecuali kamu izinkan: Q1)

**Web mobile (`app/finance/script.js`):**
1. `updateTransaction`: ganti `.set()` → `.update({ nominal, catatan })`, supaya field V2 tidak hilang.
2. `rebuildFromSnapshot`: `transaksi: "pindah"` jangan jadi `expense`. Minimal di-skip, atau dihitung `biaya_admin` saja.
3. Nota: pakai `rincian_kategori` di statistik/rencana kalau ada (kalau tidak, total masuk ke `category` utama, angkanya kurang presisi per kategori tapi totalnya benar).
4. Tampilkan `kode` & `account_type` (opsional). Transaksi baru dari mobile **tetap tanpa kode** (key timestamp, dibaca sebagai bank) sampai mobile ikut generate kode (Q3).

**Flutter (`app/mobile/lib/finance/`):**
1. `updateTransaction`: `.set(toMap())` → `.update({nominal, catatan})`. Sekarang ini juga **menghapus `waktu`** di record lama (bug yang sudah ada).
2. `createdAt`/`timestamp`: baca field `timestamp`, jangan `int.tryParse(id)` (untuk key kode hasilnya 0).
3. `TxType.fromFs`: tangani `"pindah"` (enum baru / skip).
4. Baca `account_type` (default bank), `bentuk`, `kode`, `rincian_kategori`.
5. Tambah transaksi: idealnya tulis `waktu` + pakai kode/counter yang sama.

**Sampai klien lama dipatch:** rules (§4.2) menolak edit klien lama terhadap record V2, sehingga data aman tapi edit dari mobile gagal. Pindah tetap di balik flag. Record satuan/nota V2 terbaca klien lama dengan benar untuk total (`nominal`, `category` dual-write).

---

## 8. Risiko tersisa

- Klien lama mengedit record V2 → **hilang data** kalau rules belum dideploy dan klien belum dipatch. **Mitigasi wajib sebelum fase 3 dipakai di produksi**: deploy rules **atau** patch `update()` di kedua klien.
- Record dari klien lama tetap tanpa kode → data campuran (ada yang `—`). Backfill `--kode` hanya menutup data sampai saat dijalankan.
- Nomor kode bisa bolong (koneksi putus, hapus). Ini memang diizinkan brief.
- Rules dikelola di console bersama 24Card: salah paste bisa berdampak ke 24Card. Draf saya hanya menyentuh `finance`, dan perlu kamu review.
- Tooling baru (`package.json`, `node_modules`) di repo GitHub Pages: tidak ikut ke runtime, tapi file `package.json`/`firebase.json`/rules ikut ter-publish (tidak rahasia).

---

## 9. Progres

### Fase 2 — Fondasi (selesai, 2 Nov 2026)

File baru (UI belum disentuh, `index.html`/`script.js` belum memuat modul ini):

- `finance-core.js` — modul murni (UMD): `generateKode`/`formatKode`/`parseKode`/`previewKode`, `computeNota` (subtotal, penyesuaian Rp/%, alokasi proporsional + sisa pembulatan ke kategori terbesar), `buildSatuan`/`buildNota`/`buildPindah`, `normalizeRecord` (V1 → V2: bank/satuan/kode null), `summarize` (saldo per account + transfer in/out), `totalsByCategory`, `expenseInCategory`, `matchesAccount`, `compareChrono`.
- `finance-data.js` — `saveNew` (counter `transaction()` + klaim key via `transaction()` → tidak pernah menimpa, nomor bisa bolong tapi tidak dobel), `update` (parsial, field terkunci ditolak), `updateNota`, `remove`, `currentCounter`.
- `database.rules.json` — **draf, belum dideploy**. Basisnya rules yang didokumentasikan (`.read` true, `.write` false, 24Card & finance writable); **perlu dicocokkan dulu dengan rules console** sebelum deploy (Q6).
- `firebase.json` (emulator saja), `package.json` (dev-only: `firebase@8.10.1`, `firebase-tools@13.35.1`), `.gitignore` (`node_modules/`, log, `backups/`).
- `tests/core.test.js` (23 test) dan `tests/emulator/emulator.test.js` (16 test).

Cara menjalankan (butuh Java di PATH, sudah ada JDK 17):

```bash
cd app/finance/web
npm install          # sekali saja
npm run test:all     # node --check + unit test + test emulator (project demo-finance, bukan produksi)
```

Hasil: **23/23 unit, 16/16 emulator lulus.** Yang diuji di emulator:
- 2 penulis × 15 simpan bersamaan → 30 kode unik, counter = 30, nomor 1..30 tanpa dobel.
- Key sudah terisi (counter belum di-seed) → pakai nomor berikutnya, data lama tidak tertimpa.
- Update parsial menjaga field V2; edit nota mengganti item & menghitung ulang rincian.
- Rules: kode == key, prefix ↔ account/dari-ke, bulan kode ↔ node ↔ tanggal, enum account/bentuk, field terkunci, klien lama `.set()` ke record V2 **ditolak** (data utuh), record V1 tetap bisa ditulis/diedit/dihapus, backfill account_type/kode sekali lalu terkunci, counter hanya naik & bulat, plans/categories tidak terpengaruh, root tetap tertutup.

Catatan/temuan:
- **Contoh `rincian_kategori` di brief (makanan 73900 / belanja 17115) tidak proporsional.** Dengan aturan Opsi A hasilnya **makanan 73654 / belanja 17361** (Σ tetap 91015). Yang dipakai: aturannya.
- Total nota **0** juga ditolak (bukan cuma negatif), sama spt satuan yang wajib > 0. Bilang kalau nota Rp 0 perlu diizinkan.
- Rules **tidak bisa melarang hapus counter** (`.write: true` di `finance` menurun ke bawah dan tidak bisa dicabut). Kalau counter terhapus, `saveNew` tetap aman: klaim key menolak nomor yang sudah dipakai lalu lanjut ke nomor berikutnya.
- Di emulator, rules hanya berlaku di namespace instance default (`demo-finance-default-rtdb`), dan test sudah diarahkan ke sana.
- Record lama yang sudah di-backfill lalu diedit web mobile (`.set()` tanpa field baru) akan **kehilangan** `account_type`/`kode` hasil backfill. Rules sengaja mengizinkan ini supaya web mobile tetap bisa edit. `account_type` aman (fallback bank), tapi `kode` hilang. Ini alasan tambahan `--kode` default mati.

### Rules console diterima (2 Nov 2026) — Q6 selesai

- Rules asli **beda dari dokumentasi lama**: root `.read` ternyata `false`, dan ada path lain (`trial-error/littleAdventure`, `kitchen`, `routine`, `patungan`, `note`, `wishlist`, `undangan`), semuanya `.read/.write: true`. Dokumentasi di `app/.claude/finance-app.md` sudah dibetulkan.
- `database.rules.json` disusun ulang dari rules console. Sudah dicek otomatis: **identik dengan console** kalau tambahan di `finance` (`counters`, `$bulan` → `.indexOn` + `.validate`) dibuang.
- Test emulator ditambah: root tetap tertutup (baca & tulis), `finance` bisa dibaca, semua app lain tetap bebas baca/tulis. **17/17 lulus**, unit 23/23.
- Data lama: backup lokal 30 Okt (83 transaksi) semua key angka, bulan `tanggal` cocok dgn node, belum ada field V2 → aman. Pembacaan langsung ke produksi untuk data terbaru tidak saya lakukan (ditolak izin). Sejak 30 Okt hanya klien V1 yang menulis (key angka), jadi seharusnya tetap aman.

**Cara deploy (oleh kamu):**
1. Firebase console → Realtime Database → tab **Rules**.
2. Simpan dulu isi yang sekarang (sudah kamu punya, yang dikirim ke saya) sebagai cadangan.
3. Ganti seluruh isinya dengan isi `app/finance/web/database.rules.json` → **Publish**.
4. Rollback = paste lagi rules lama → Publish.

Efek setelah deploy: **tidak ada perubahan perilaku untuk app yang ada sekarang**. Web mobile, Flutter, dan desktop V1 menulis key angka dan tetap lolos, sedangkan app lain tidak tersentuh. Validasi baru baru "terasa" setelah record V2 (berkode) mulai ditulis di Fase 3.

### Keputusan: rules TANPA `.validate`, cukup `.indexOn` (2 Nov 2026)

- Atas keputusan kamu, `database.rules.json` sekarang **persis rules console + `"$bulan": { ".indexOn": ["timestamp", "account_type", "tanggal"] }`** di dalam `finance`. Semua validasi (`counters` & `$bulan/$id`) dihapus. Ini menggantikan §4.2.
- Konsekuensi yang diterima:
  1. Edit `.set()` dari web mobile/Flutter terhadap record V2 **tidak ditolak** dan menghapus field V2 di database.
  2. Kode/field terkunci & counter hanya dijaga di sisi aplikasi desktop (`finance-data.js`: klaim key via `transaction()`, update parsial, field terkunci ditolak), bukan oleh server.
- Mitigasi (sudah dibuat): `normalizeRecord` memulihkan `kode`, `account_type`, `bentuk: pindah`, `dari`, `ke` **dari key** kalau key berformat kode tapi field-nya hilang. Transaksi satuan tetap terbaca 100% benar. Item/penyesuaian nota yang terhapus tidak bisa dipulihkan, tapi total (`nominal`) & kategori utama (`category`) tetap ada.
- Test disesuaikan: unit **24/24** (tambah tes pemulihan dari key), emulator **11/11** (counter 2 penulis, klaim key, update parsial, edit nota, klien lama `.set()` + pemulihan, record lama, plans/categories/counters bisa ditulis, root tertutup, app lain tidak berubah).
- Deploy tetap sama caranya (paste isi `database.rules.json` ke console → Publish). Efeknya praktis nol untuk app yang ada: hanya menambah index.

### Fase 3 — Account Type + kode untuk satuan (selesai, 2 Nov 2026)

**Mulai fase ini, web desktop menulis transaksi berkode ke produksi** (record baru = key `TB/TC/TE-YYYYMM-NNNNNN`, counter di `/finance/counters`).

Perubahan (`index.html`, `script.js`, `css/components.css`, `css/pages.css`):
- `script.js` memakai `FinanceCore` + `FinanceData`: `rebuildFromSnapshot` → `Core.normalizeRecord` (record lama = bank/satuan/kode "—"), simpan baru → `addSatuan` (`Data.saveNew`, kode atomik), edit → `Data.update` parsial (bukan `.set()`), hapus → `Data.remove`. Fungsi lama `addTransaction` (key tanggal+waktu) dihapus.
- **Tab Account Type** `Semua | Bank | Cash | E-Money` di atas kartu saldo (Dashboard) dan di atas kartu grafik (Transaksi), satu state `acctFilter` untuk keduanya. Tab memfilter saldo/pemasukan/pengeluaran (`Core.summarize`), grafik, statistik, transaksi terbaru, tabel. Label "Saldo {Account} Bulan Ini". Ganti tab → halaman 1.
- **Tabel**: baris ketiga = kode (monospace kecil, "—" utk record lama). **Search** ikut mencari kode (+ judul nota nanti). **Panel detail**: baris Kode + Account.
- **Form tambah (Manual)**: pemilih Account type (default = tab yang sedang aktif, kalau "Semua" → Bank) + pratinjau kode ("Kode transaksi: TC-202610-000001 · dibuat otomatis", bulan ikut tanggal, nomor = counter + 1 → hanya perkiraan). Simpan diblokir dgn pesan jelas kalau `.info/connected` = offline.
- **Edit (sesuai brief, desain V2 masih spt V1)**: terkunci Kode/Account/Tanggal/Jenis (kotak "Tidak dapat diubah"); bisa diubah Kategori, Jumlah, Catatan, Waktu, Dibuat oleh. Hanya field yang berubah yang dikirim. Nota/pindah → pesan "belum tersedia" (fase berikutnya).
- **Info**: kartu Account Type + Format Kode Transaksi (lebar penuh), lalu Tentang (1) + Semua Aplikasi (2).
- **Export Excel**: tambah kolom Kode & Account Type.
- **Import**: sekarang membuat record berkode (`addSatuan`, berurutan sesuai baris), sementara semua `bank` — kolom Account Type di Fase 7.
- Siap nota: statistik Dashboard pakai `Core.totalsByCategory`, Rencana pakai `Core.expenseInCategory`, hitungan Kategori ikut `rincian_kategori`.
- Saldo negatif ditulis "−Rp 45.000" (dulu "Rp -45.000").
- **Kait dev `?emulator`** di `index.html`: buka `index.html?emulator` → aplikasi pakai Firebase Emulator lokal (127.0.0.1:9000), bukan produksi. Dipakai untuk uji UI yang menulis data.

Uji: `npm run test:all` (24 unit + 11 emulator lulus) + uji UI di emulator dgn data backup 30 Okt: tab & label saldo benar (record lama = Bank), default account ikut tab, pratinjau kode berubah saat tanggal diganti (`TC-202611-…` → `TC-202610-000001`), record baru tersimpan di `/finance/2026-10/TC-202610-000001` + counter `TC-202610: 1`, cari kode ketemu, edit mengubah nominal & `by` saja, edit record lama hanya mengubah `catatan` (tidak menambah `account_type`). Screenshot light/dark OK.

Yang belum (fase berikutnya): Nota (5), Pindah (6, flag `ENABLE_TRANSFER`), kolom Account Type di import/template (7), skrip backfill (8). Analisis belum memakai `rincian_kategori` (dikerjakan bareng Nota).

### Fase 5 — Nota (selesai, 2 Nov 2026)

Perubahan (`index.html`, `script.js`, `css/components.css`, `css/pages.css`):
- **Popup Tambah Transaksi → tab Manual punya mode `Satuan | Nota | Pindah`.** Tombol Pindah tersembunyi selama `ENABLE_TRANSFER = false` (konstanta di `script.js`, Fase 6). Mode Nota = penjelasan singkat + tombol **"Buka Halaman Nota ↗"** → popup tertutup, halaman Nota terbuka dgn jenis/account/pembuat yang sudah dipilih di popup. (Desain menulis "dibuat di tab baru"; di sini halaman tersendiri dalam aplikasi, sesuai brief.)
- **Halaman Nota** = view `#nota` (baru) / `#nota/<YYYY-MM>/<kode>` (edit), breadcrumb "Transaksi / Nota Baru", menu Transaksi tetap aktif, navigasi bulan & toggle user disembunyikan (spt desain). Bisa dibuka langsung lewat URL (dibuka setelah data pertama tiba).
  - Kartu **Informasi Nota**: judul, tanggal, waktu (ganti tanggal → waktu reset 00:00:00, sama spt satuan), jenis, dibuat oleh, account type + pratinjau kode.
  - Kartu **Item Nota**: `# | Nama | Kategori | Qty | Satuan | Harga satuan | Subtotal | hapus`, "+ Tambah item" (kategori ikut item terakhir), satuan bebas + datalist (pcs, kg, gram, liter, pak, dus, botol, porsi), qty desimal (koma/titik), minimal 1 item.
  - **Penyesuaian** (tidak ada di desain, dibuat sesuai brief): "+ Potongan/Biaya", baris label · Kurangi/Tambah · Rp/% · nilai · hasil · hapus, tombol cepat (pengeluaran: Diskon %, Promo, Voucher, Cashback, PPN 11%, Ongkir, Biaya layanan; pemasukan: Pajak %, PPh %, Biaya admin). Persen dari subtotal.
  - **Pratinjau struk** (kanan): judul, tanggal·waktu·account·pembuat, chip kode, item ("5 kg × Rp 14.000"), subtotal, penyesuaian, **TOTAL DIBAYAR / TOTAL DITERIMA**, rincian per kategori dgn bar.
  - Validasi: peringatan langsung kalau total ≤ 0; daftar error lengkap (dari `Core.buildNota`) muncul saat Simpan dan ikut diperbarui saat dibetulkan. Keluar halaman dgn perubahan belum disimpan → konfirmasi.
  - Simpan baru → `Data.saveNew` (kode atomik); edit → `Data.updateNota` (update parsial: judul, by, waktu, items, penyesuaian, angka turunan, category, rincian). **Edit mengunci tanggal, account type, dan jenis** (jenis tidak ada di daftar "boleh diedit" brief + kategori item bergantung padanya). Setelah simpan → halaman Transaksi, bulan & baris nota terpilih.
- **Tabel Transaksi**: nota ≥ 2 item → judul + badge "N item", baris kedua "Kategori utama · N kategori", tombol ⌄ membuka daftar item + penyesuaian di bawah baris. **Nota 1 item tampil spt satuan** (tanpa badge/expand). Kolom aksi dilebarkan (88 → 124px).
- **Panel detail**: nota → judul + "Nota pengeluaran · N item", struk ringkas (item, subtotal, penyesuaian, total, per kategori) menggantikan kotak Catatan.
- **Edit** dari tabel: satuan → modal edit, nota → halaman Nota mode edit.
- **Agregasi pakai `rincian_kategori`**: Analisis (per kategori, ringkasan), Dashboard (statistik), Rencana, hitungan Kategori (Fase 3), **filter kategori** (nota cocok kalau salah satu kategori item dipilih), **pencarian** (+ nama item). Export: Catatan = "Judul (nota N item)", Kategori = kategori utama.

Uji (Firebase Emulator, data backup 30 Okt): popup → mode Nota → halaman Nota (hash `#nota`, nav Transaksi aktif, toggle user tersembunyi, tombol Pindah tersembunyi); simpan kosong → 4 error; isi contoh brief → subtotal 86.500, penyesuaian +4.515, **total 91.015**, kode `TB-202611-000001`; tersimpan dgn `items` i1,i2, `penyesuaian` p1 (Rp) & p2 (11% → 9.515), `rincian_kategori` makanan 73.654 + belanja 17.361 (Σ = 91.015), `category` makanan; tabel badge "2 item", expand 4 baris; edit (qty 3→4, hapus diskon) → 102.120, rincian 77.700 + 24.420, kode/tanggal/account/timestamp tetap; statistik Dashboard terpecah per kategori; buka langsung `#nota/2026-11/TB-202611-000001` (dark, user Iyon) OK; batal dgn perubahan → konfirmasi muncul. `npm run test:all`: 24 unit + 11 emulator lulus.

Catatan: belum ada tombol "Hapus" di halaman Nota (hapus tetap dari tabel, seluruh nota terhapus sekaligus).

### Fase 6 — Pindah account (selesai, 2 Nov 2026) — **masih dikunci flag**

- **Flag**: `ENABLE_TRANSFER_DEFAULT = false` di `script.js`. Selama false, tombol mode Pindah di popup tersembunyi dan submit ditolak. **Untuk uji, flag hanya bisa dinyalakan di emulator**: `index.html?emulator&transfer` (`USE_EMULATOR` dari `index.html` + query `transfer`). Di produksi tidak ada cara menyalakannya lewat URL. Nyalakan permanen (ubah ke `true`) setelah web mobile/APK bisa membaca `transaksi: "pindah"` (§7).
- **Record pindah yang sudah ada tetap dibaca & ditampilkan walau flag mati** (tabel, detail, saldo, edit, hapus).
- **Form Pindah** (popup → Manual → Pindah): Dari (3 pilihan) · tombol tukar · Ke (3 pilihan, opsi = Dari dinonaktifkan; memilih Dari yang sama dgn Ke → otomatis ditukar), Jumlah dipindah, Biaya admin (opsional), ringkasan ("Bank berkurang Rp 502.500 / Cash bertambah Rp 500.000" + catatan bukan pemasukan/pengeluaran), Catatan, Tanggal (ganti → waktu 00:00:00), Waktu, Dibuat oleh (state sama dgn Satuan/Import), tombol **Pindahkan**, pratinjau kode `TF-BC-…`. Simpan → `Core.buildPindah` + `Data.saveNew`.
- **Tabel**: tile ⇄ (kategori semu `TRANSFER_CATEGORY`), judul = catatan atau "Pindah Bank → Cash", sub "Pindah account · Bank → Cash". Nominal relatif ke tab: **Semua** "⇄ Rp 500.000" (warna aksen), **tab asal** "− Rp 502.500" (nominal + biaya admin), **tab tujuan** "+ Rp 500.000". Pindah muncul di tab asal **dan** tujuan, sekali di Semua. Tab tipe Pemasukan/Pengeluaran tidak menampilkan pindah; filter kategori aktif juga mengecualikan pindah.
- **Panel detail**: "Bank → Cash · Pindah account", ringkasan berkurang/bertambah/biaya admin, catatan, kode/tanggal/waktu/dibuat oleh.
- **Edit**: dari/ke/tanggal/kode terkunci; bisa ubah jumlah, biaya admin, catatan, waktu, dibuat oleh (modal edit yang sama; field kategori disembunyikan, field biaya admin muncul).
- **Saldo** (Q5 → diputuskan pakai rekomendasi): kartu saldo di tab Bank/Cash/E-Money menampilkan baris kecil **"Pindah masuk Rp X · keluar Rp Y"** hanya kalau ada pindah, supaya jelas kenapa saldo ≠ pemasukan − pengeluaran. Tab Semua: pindah saling meniadakan, hanya biaya admin yang masuk pengeluaran.
- **Biaya admin** = pengeluaran kategori `lainnya-keluar` di account asal (Q4): ikut statistik Dashboard, Rencana (kategori Lainnya & "Semua"), dan **Analisis** (pool pengeluaran: pindah ikut hanya sebesar biaya admin).
- **Export**: Account Type "bank → cash", Kategori kosong, Catatan + "(biaya admin N)".

Uji (emulator): flag mati → tombol tersembunyi, record pindah lama E-Money→Bank 100rb tetap terhitung (Bank +100rb, E-Money −100rb, Semua tidak berubah). Flag nyala → awal Bank→Cash (Bank dinonaktifkan di Ke), pilih Dari=Cash → tertukar jadi Cash→Bank + kode `TF-CB-…`, tombol tukar kembali ke `TF-BC-…`; simpan 500rb + biaya 2.500 → `TF-BC-202611-000001` dgn field sesuai skema; tabel per tab sesuai (⇄ / −502.500 / +500.000); edit biaya → 0, dari/ke/kode tetap; saldo Bank 9.600.000 (gaji 10jt + masuk 100rb − keluar 500rb), Cash 450.000. `npm run test:all` 24 + 11 lulus.

### Fase 7 — Account Type di import (selesai, 2 Nov 2026)

- **Template** (`excel-template.js`): kolom baru **Account Type** di kolom C (setelah Waktu) dgn dropdown `bank / cash / e_money` (sumber: sheet tersembunyi `Daftar` kolom C). Urutan kolom sekarang **Tanggal, Waktu, Account Type, Tipe, Kategori, Nominal, Catatan**, sama dgn urutan Export Excel, jadi file export bisa diimport ulang (kolom Kode & Dibuat oleh diabaikan importer). Panduan: aturan Account Type + catatan kode dibuat otomatis, contoh baris ikut kolom baru (cash & bank).
- **Parser** (`parseImportRows`): kolom Account Type **opsional** (header `Account Type` / `account_type` / `Account`). File lama tanpa kolom ini → semua baris `bank`. Nilai diterima: `bank`, `cash`, `e_money` + label `Bank`, `Cash`, `E-Money`/`emoney` (huruf besar/kecil bebas). Kosong → `bank`. Lainnya → error per baris: `Account Type harus bank, cash, atau e_money (kosong = bank), bukan "…"`. Tetap all-or-nothing.
- **Simpan**: tiap baris → record satuan berkode sesuai account-nya (`addSatuan`), **berurutan sesuai urutan baris**, sehingga nomor urut per prefix per bulan mengikuti urutan baris.
- **Popup Import Berhasil**: tambah baris "Account" (mis. "Bank 1 · Cash 2 · E-Money 2"). Teks bantuan tab Import menyebut kolom baru.
- Dukungan "Kode Nota" (gabung baris jadi satu nota) tetap **ditunda**, catatan desainnya ada di §6.

Uji (emulator): file dgn account `dompet` → popup gagal (baris 3, pesan di atas), **tidak ada yang tersimpan**; file benar 5 baris (cash / kosong / "E-Money" / "Cash" / e_money bulan lain) → `TC-202610-000001` (R2), `TB-202610-000001` (R3 kosong=bank), `TE-202610-000001` (R4), `TC-202610-000002` (R5), `TE-202611-000001` (R6, node bulan 2026-11); file format lama (tanpa kolom) → `TB-202610-000002` bank; template: sheet Transaksi/Panduan/Daftar(hidden), validasi C2:C501 → `Daftar!$C$1:$C$3` (account), D → tipe, E → kategori. `npm run test:all` 24 + 11 lulus.

### Fase 8 — Skrip backup + backfill + panduan migrasi (selesai, 2 Nov 2026)

File baru:
- `scripts/lib.js`: util REST API Realtime Database (tanpa SDK/login; node `finance` terbuka). **Target wajib eksplisit** `--emulator` (127.0.0.1:9000, ns `iyon-adryanlf-trialerror`, sama dgn `index.html?emulator`) atau `--prod`; tanpa/keduanya → skrip menolak. Backup, PATCH multi-path ber-chunk, konfirmasi interaktif.
- `scripts/backup.js`: export seluruh `/finance` (termasuk `counters`, plans, categories) ke `backups/finance-<prod|emulator>-<waktu>.json`. Hanya membaca.
- `scripts/backfill-plan.js`: logika murni rencana backfill (dites unit).
- `scripts/backfill-account-type.js`: default **dry-run** (ringkasan + contoh + peringatan). `--apply` → konfirmasi ketik `YA` → **backup otomatis** → rencana dihitung ulang dari data backup → PATCH. Opsi `--bentuk`, `--kode` (default mati). Idempoten.
- `docs/migration-guide.md`: langkah produksi, pengaman, aturan tiap field, catatan `--kode`, rollback (Import JSON ke node `finance`, bukan root), uji di emulator.
- `tests/backfill.test.js` (7 unit) + `tests/emulator/scripts.test.js` (5 integrasi, menjalankan skrip sbg proses terpisah ke emulator). `npm test` sekarang juga menjalankan `tests/backfill.test.js`; `npm run check` ikut cek sintaks skrip.

Aturan backfill (ringkas, detail di panduan):
- `account_type` kosong → `bank`; record ber-key kode yg field-nya hilang → dari prefix key (TC → cash); pindah dilewati.
- `--bentuk`: kosong → `satuan` (key TF → `pindah`, ada `items` → `nota`).
- `--kode`: key kode → `kode = key`; record lama → `T{B|C|E}-{YYYYMM}-{NNNNNN}` urut `timestamp` per prefix per bulan (bulan dari `tanggal`, peringatan kalau beda dgn node), **lanjut dari nomor tertinggi yg sudah terpakai** (counter atau kode/key yg ada) → tidak pernah dobel; counter di-seed ke nomor tertinggi. Tanggal tidak valid → dilewati + peringatan.
- Tidak pernah re-key, tidak menyentuh field lain, tidak menimpa nilai yang ada.

Uji: `npm run test:all` → **31 unit + 16 emulator lulus**. Integrasi: tanpa target → ditolak; backup = isi `/finance` persis; dry-run tidak menulis; `--apply` + jawaban selain `YA` → batal tanpa menulis; `--apply --bentuk --kode` + `YA` → backup dibuat, key utuh, field lama utuh, kode lama lanjut setelah `TB-202607-000001` yg sudah ada (000002, 000003 urut timestamp), counter 3, jalan ulang → "Tidak ada yang perlu diubah". Dry-run ke emulator berisi backup 30 Okt: 83 `account_type`; dgn `--bentuk --kode` 252 field + 3 counter.

**Belum dijalankan ke produksi**, dan itu dilakukan oleh kamu (lihat `docs/migration-guide.md`).

### Fase 9 — Hardening (selesai, 2 Nov 2026)

- QA otomatis di emulator (data backup + contoh cash/e-money/nota/pindah): 6 halaman + 10 modal/halaman (tambah satuan/nota/pindah/import, filter, edit satuan/pindah, konfirmasi hapus, edit nota, pilih rentang) × terang/gelap × lebar 1440/1024/768/390, cek error konsol + scroll horizontal level halaman.
- Temuan & perbaikan (semua di layar sempit): tooltip grafik keluar tepi kanan di 390px → dibatasi dalam kotak grafik (`renderLineChart`); preset Analisis tidak bisa turun baris → `seg-wrap`; baris penyesuaian nota terjepit → bisa di-scroll horizontal (min 620px), hasil tidak terlipat; tabel Transaksi menyempit di 768px → min-width 760px (scroll).
- Sapuan ulang: tidak ada temuan. `npm run test:all`: 31 unit + 16 emulator lulus.
- `docs/v2-changelog.md` ditulis.

### Setelah Fase 9 (2 Nov 2026)

- **Pindah account diaktifkan** (`ENABLE_TRANSFER_DEFAULT = true`) atas keputusan user; web mobile/APK dibiarkan dulu (di sana pindah terbaca sbg pengeluaran sebesar nominal).
- **Migrasi dijalankan ke produksi**: `account_type` ternyata sudah terisi `bank` di 144 transaksi (kemungkinan dijalankan lebih dulu); `--bentuk` → 144 field `bentuk: "satuan"`. Detail di `migration-guide.md` → Riwayat. `--kode` belum.

### Versi Flutter/APK dihapus (2 Nov 2026)

Atas keputusan user, project Flutter `app/mobile/`, file `app/downloads/iyon-app.apk`, dan section "Unduh Aplikasi Mobile" di hub `app/index.html` dihapus. Semua catatan soal Flutter/APK di dokumen ini (mis. §1.1 dan §7) sekarang hanya riwayat. Klien lain selain web desktop tinggal **web mobile** (`app/finance/`).
