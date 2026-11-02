# Panduan Migrasi Data Finance V1 → V2

Panduan ini untuk **mengisi field V2 ke transaksi lama** di database produksi. Skripnya ada di `app/finance/web/scripts/`.

> **Migrasi ini opsional.** Web desktop V2 sudah membaca transaksi lama dengan benar tanpa migrasi: `account_type` kosong dibaca sebagai `bank`, `bentuk` kosong sebagai `satuan`, dan `kode` kosong tampil `—`. Migrasi hanya membuat datanya "lengkap" di database, misalnya supaya klien lain atau export mentah tidak perlu tahu aturan default itu.

---

## Ringkas

```bash
cd app/finance/web
node scripts/backup.js --prod                                # 1. backup (hanya baca)
node scripts/backfill-account-type.js --prod                 # 2. dry-run: lihat apa yang akan ditulis
node scripts/backfill-account-type.js --prod --apply         # 3. tulis (ketik YA)
node scripts/backfill-account-type.js --prod                 # 4. cek: harus "Tidak ada yang perlu diubah"
```

Tidak perlu `npm install`. Cukup Node 18+ dan koneksi internet.

---

## Pengaman yang sudah ada di skrip

- **Target wajib eksplisit**: `--prod` (produksi) atau `--emulator` (Firebase Emulator lokal). Tanpa salah satunya, skrip menolak jalan.
- **Default dry-run**: tanpa `--apply`, skrip hanya mencetak ringkasan + contoh perubahan.
- **`--apply` minta konfirmasi** (ketik `YA` persis). Setelah itu skrip **otomatis backup dulu** ke `backups/finance-prod-<waktu>.json`, menghitung ulang rencana dari data backup itu (supaya tidak selisih dengan data terbaru), baru menulis.
- **Hanya menambah field yang belum ada.** Key tidak diubah (tidak ada re-key), field lain tidak disentuh, nilai yang sudah ada tidak ditimpa. Penulisan memakai multi-path `PATCH` ke path field-nya saja.
- **Idempoten**: aman dijalankan ulang. Jalan kedua seharusnya "Tidak ada yang perlu diubah".
- Folder `backups/` di-gitignore, jadi file backup tidak ikut ter-commit atau ter-publish ke GitHub Pages.

---

## Apa yang diisi

| Opsi | Field | Aturan |
|---|---|---|
| (selalu) | `account_type` | Kosong → `"bank"`. Pengecualian: record ber-key kode (mis. `TC-202611-000003`) yang field-nya hilang (pernah diedit web mobile) → diambil dari key (`TC` → `cash`). Record pindah tidak diberi `account_type`. |
| `--bentuk` | `bentuk` | Kosong → `"satuan"` (key `TF-…` → `"pindah"`, punya `items` → `"nota"`). |
| `--kode` | `kode` + `/finance/counters` | Record ber-key kode tanpa field `kode` → `kode = key`. Record lama (key timestamp) → `T{B\|C\|E}-{YYYYMM}-{NNNNNN}` sesuai account-nya, **urut `timestamp` per prefix per bulan** (bulan dari `tanggal`), **melanjutkan nomor tertinggi yang sudah terpakai** bulan itu. Lalu counter di-seed ke nomor tertinggi supaya transaksi baru melanjutkan. **Default mati.** |

Contoh dry-run dengan data backup 30 Okt 2026 (83 transaksi): tanpa opsi → 83 field `account_type`. Dengan `--bentuk --kode` → 252 field + 3 counter.

### Soal `--kode` (baca dulu sebelum dipakai)

- **Key tetap timestamp.** `kode` hanya jadi field, jadi path record lama tidak berubah.
- Kalau bulan itu **sudah ada transaksi V2 berkode** (dibuat lewat web desktop), nomor untuk transaksi lama **dilanjutkan setelahnya**, bukan disisipkan dari 000001. Artinya urutan nomor tidak selalu kronologis antara data lama dan baru, tapi **tidak pernah dobel**. Skrip memberi peringatan untuk kasus ini.
- **Web mobile & APK Android masih menyimpan edit dengan `.set()`** (menimpa seluruh record dengan field V1). Kalau transaksi lama yang sudah diberi `kode` diedit dari HP, field `kode` hilang lagi. `account_type` yang hilang tidak masalah karena fallback-nya tetap bank. Karena itu `--kode` sebaiknya dipakai **setelah** klien mobile diperbarui (lihat `v2-plan.md` §7).
- Transaksi baru dari web mobile/APK tetap tanpa kode sampai klien itu diperbarui. Backfill hanya mencakup data sampai saat skrip dijalankan.

---

## Langkah detail

1. **Pilih waktu sepi**: tidak ada yang sedang input transaksi (desktop/HP).
2. **Backup manual** (selain backup otomatis saat `--apply`):
   ```bash
   node scripts/backup.js --prod
   ```
   Simpan juga salinannya di tempat lain (mis. Google Drive). Bisa juga export dari Firebase console: Realtime Database → node `finance` → ⋮ → *Export JSON*.
3. **Dry-run** dan baca ringkasannya:
   ```bash
   node scripts/backfill-account-type.js --prod
   ```
   Cek angka "Record diperiksa" kira-kira sama dengan jumlah transaksi, dan contoh perubahan masuk akal.
4. **Apply**:
   ```bash
   node scripts/backfill-account-type.js --prod --apply
   # opsional: tambah --bentuk dan/atau --kode
   ```
   Ketik `YA`. Skrip mencetak lokasi file backup lalu jumlah field yang ditulis.
5. **Verifikasi**: jalankan dry-run lagi dan pastikan hasilnya "Tidak ada yang perlu diubah". Buka web desktop dan cek Dashboard/Transaksi masih normal.

## Rollback

Kalau ada yang salah, kembalikan isi node `finance` dari file backup:

- Firebase console → Realtime Database → node **`finance`** → ⋮ → **Import JSON** → pilih file `backups/finance-prod-<waktu>.json`.
- **Perhatian:** import JSON **mengganti seluruh isi node `finance`**, termasuk transaksi yang dibuat setelah backup. Pastikan tidak ada input baru sejak backup, atau catat dulu transaksi barunya.
- Import harus di node `finance`, **bukan root**. Root berisi data app lain (kitchen, routine, 24Card, dll.).

## Uji tanpa produksi

Flag `--emulator` masih ada di skrip (target Firebase Emulator lokal 127.0.0.1:9000), tapi tooling emulator & test otomatisnya sudah dihapus dari repo (2 Nov 2026) setelah migrasi selesai. Untuk menguji lagi, pasang `firebase-tools` lalu jalankan `npx firebase emulators:start --only database`.

---

## Riwayat eksekusi di produksi

| Tanggal | Perintah | Hasil |
|---|---|---|
| 2 Nov 2026 (sebelumnya) | `backfill-account-type.js --prod --apply` (default) | Ke-144 transaksi sudah berisi `account_type: "bank"` saat dicek. Kemungkinan dijalankan lebih dulu oleh user. |
| 2 Nov 2026 10:45 WIB | `backup.js --prod` → `backfill-account-type.js --prod --bentuk` (dry-run) → `--apply` | Backup `backups/finance-prod-2026-11-02T03-45-09-961Z.json` & `…03-45-49-674Z.json` (otomatis). **144 field `bentuk: "satuan"` ditulis.** Diverifikasi terhadap backup: 0 field lain berubah, 0 key berubah, plans/categories sama. Dry-run ulang → 0. |

`--kode` belum dijalankan (ditunda sampai web mobile/APK diperbarui).
