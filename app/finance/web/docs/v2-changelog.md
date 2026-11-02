# Finance Web Desktop: Changelog V2

Tanggal: 2 November 2026 · Scope: **`app/finance/web/` saja** (web desktop). Web mobile (`app/finance/`) tidak diubah. (APK Flutter `app/mobile/` sudah dihapus seluruhnya, 2 Nov 2026.)
Rencana & keputusan lengkap: [`v2-plan.md`](v2-plan.md) · Panduan migrasi: [`migration-guide.md`](migration-guide.md).

---

## Fitur baru

### Account Type (Bank / Cash / E-Money)
- Setiap transaksi baru punya sumber uang: `bank`, `cash`, atau `e_money`. Transaksi lama dianggap **Bank**.
- **Tab `🗂️ Semua | 🏦 Bank | 💵 Cash | 📱 E-Money`** di Dashboard (atas kartu saldo) dan Transaksi (atas grafik), dengan satu pilihan yang dipakai bersama kedua halaman. Tab memfilter saldo, pemasukan, pengeluaran, grafik, statistik, transaksi terbaru, dan tabel. Label saldo jadi "Saldo Bank Bulan Ini", dst.
- Form tambah punya pemilih Account type. Defaultnya mengikuti tab yang sedang dibuka.

### Kode transaksi otomatis
- Transaksi baru disimpan dengan **kode sebagai key**: `TB/TC/TE-YYYYMM-NNNNNN` (satuan & nota) dan `TF-{asal}{tujuan}-YYYYMM-NNNNNN` (pindah, mis. `TF-BC-202611-000001`).
- Bulan kode = bulan **tanggal transaksi** (bukan waktu input). Nomor urut per prefix per bulan, atomik lewat counter `/finance/counters/{prefix}-{YYYYMM}`, aman walau Iyon & Ciwul menyimpan bersamaan (teruji 30 simpan paralel). Nomor boleh bolong (mis. setelah hapus), tapi tidak pernah dobel.
- Kode tampil di tabel (baris ketiga), panel detail, modal edit, dan export, serta bisa dicari. Form menampilkan pratinjau kode. Transaksi lama tampil "—".
- **Kode, tanggal, account type, dan bentuk tidak bisa diubah.** Salah tanggal/account berarti hapus lalu buat baru.

### Nota (banyak item)
- Popup Tambah Transaksi → tab Manual punya mode **Satuan | Nota | Pindah**. Mode Nota membuka **halaman Buat Nota** (`#nota`, breadcrumb "Transaksi / Nota Baru").
- Item: nama, kategori, qty (boleh desimal), satuan (pilihan `pcs` / `kg` / `liter`; mis. 250 gram ditulis 0.25 kg), harga satuan, subtotal otomatis dibulatkan ke rupiah terdekat (0,25 × Rp 20.139 = 5.034,75 → Rp 5.035).
- **Penyesuaian**: potongan/biaya Rp atau %, Kurangi/Tambah, tombol cepat (Diskon, Promo, Voucher, Cashback, PPN 11%, Ongkir, Biaya layanan; pemasukan: Pajak, PPh, Biaya admin). Persen dihitung dari subtotal item.
- **Pratinjau struk** dengan TOTAL DIBAYAR / TOTAL DITERIMA dan rincian per kategori. Muncul peringatan kalau total ≤ 0, daftar error saat simpan, dan konfirmasi saat keluar dengan perubahan belum disimpan.
- Total per kategori (`rincian_kategori`) dihitung **proporsional** setelah penyesuaian. Sisa pembulatan masuk ke kategori terbesar, jadi jumlahnya selalu = total nota.
- Tabel: nota ≥ 2 item dapat badge "N item" dan bisa dibuka untuk melihat item. Nota 1 item tampil seperti satuan. Panel detail menampilkan struk. Edit nota di halaman yang sama (tanggal, account, dan jenis terkunci).

### Pindah account (aktif sejak 2 Nov 2026)
- Form Pindah (Dari ⇄ Ke, jumlah, biaya admin, ringkasan berkurang/bertambah), tampilan di tabel (⇄ di Semua, keluar di tab asal, masuk di tab tujuan), detail, edit, dan baris "Pindah masuk · keluar" di kartu saldo tab account.
- Pindah **bukan pemasukan/pengeluaran**. Hanya biaya admin yang dihitung sebagai pengeluaran kategori Lainnya di account asal.
- **Aktif**: `ENABLE_TRANSFER_DEFAULT = true` (`script.js`), keputusan user walau web mobile belum diperbarui. Di klien lama, pindah terbaca sebagai **pengeluaran sebesar nominal** (risiko diterima). Set ke `false` untuk mengunci lagi.

### Halaman lain
- **Analisis, Statistik Dashboard, Rencana, hitungan Kategori, filter kategori, pencarian** memakai rincian per kategori item nota. Pindah tidak dihitung, kecuali biaya admin.
- **Info**: kartu Account Type dan Format Kode Transaksi.
- **Edit transaksi satuan**: sekarang bisa ubah kategori, jumlah, catatan, waktu, dan dibuat oleh (sebelumnya hanya jumlah & catatan). Penyimpanan memakai update parsial, tidak lagi menimpa seluruh record.
- **Import Excel**: template punya kolom **Account Type** (dropdown, kosong = bank). Tiap baris jadi transaksi berkode, berurutan sesuai baris. Urutan kolom = Export Excel, jadi file export bisa diimport ulang.
- **Export Excel**: kolom Kode dan Account Type.
- Simpan diblokir dengan pesan jelas kalau sedang offline (kode butuh server).
- Saldo negatif ditulis "−Rp 45.000".

## Perubahan data (Firebase `/finance`)

- **Hanya menambah field.** Record lama tidak diubah dan tidak di-re-key. Field baru: `kode`, `account_type`, `bentuk`, `judul`, `items{i1..}`, `penyesuaian{p1..}`, `subtotal`, `total_penyesuaian`, `rincian_kategori`, `dari`, `ke`, `biaya_admin`, plus node `/finance/counters`.
- `nominal` selalu total bersih. Nota juga menulis `category` (kategori terbesar) supaya klien lama tetap membaca total & kategori utama.
- Rules Firebase: hanya ditambah `.indexOn` di `finance/$bulan` (sudah dipublish). **Tidak ada `.validate`** (keputusan user), jadi kode dan field terkunci dijaga di sisi aplikasi desktop.
- Kalau record berkode kehilangan field V2 (mis. diedit web mobile), desktop **memulihkan kode/account/dari/ke dari key**.

## File

| Baru | Fungsi |
|---|---|
| `finance-core.js` | Logika murni: kode, hitung nota, alokasi, saldo, normalizer record lama |
| `finance-data.js` | Tulis Firebase: counter atomik + klaim key, update parsial |
| `scripts/` | `backup.js`, `backfill-account-type.js`, `backfill-plan.js`, `lib.js` |
| `.gitignore` | Mengecualikan `backups/` (backup data produksi) |
| `docs/` | `v2-plan.md`, `v2-changelog.md`, `migration-guide.md` |

Diubah: `index.html`, `script.js`, `excel-template.js`, `css/components.css`, `css/pages.css`.

Runtime tetap statis tanpa build, tanpa dependency.

> **Dibersihkan 2 Nov 2026:** tooling testing (`tests/`, `package.json`, `package-lock.json`, `firebase.json`, `database.rules.json`, kait dev `index.html?emulator` + override flag Pindah via emulator) dihapus setelah semua fase lulus. Rules Firebase yang berlaku = yang ada di console (salinan rules console + `.indexOn` di `finance/$bulan`).

## Pengujian

- (Tooling sudah dihapus; hasil terakhir sebelum dihapus) `npm run test:all`: **31 unit** (kode, nota & pembulatan, builder, normalizer, saldo/filter/kategori, logika backfill) + **16 integrasi emulator** (2 penulis bersamaan, klaim key, update parsial, edit nota, klien lama + pemulihan, record lama, rules app lain tidak berubah, skrip backup/backfill).
- Uji UI end-to-end di emulator per fase (satuan, nota, pindah, import) + **QA akhir**: 6 halaman + 10 modal/halaman × terang/gelap × lebar 1440/1024/768/390 → tidak ada error konsol dan tidak ada scroll horizontal level halaman.

## Belum / batasan yang diketahui

- **Web mobile menghitung transaksi pindah sebagai pengeluaran sebesar nominal** (Pindah sudah aktif di desktop, klien mobile belum diperbarui; keputusan user).
- **Web mobile belum diperbarui**: membaca total dengan benar, tapi mengedit transaksi berkode akan menghapus field V2 (desktop bisa memulihkan kode/account dari key, tapi item nota hilang). Transaksi baru dari web mobile tetap tanpa kode (dibaca Bank). Daftar perubahan untuk klien itu ada di `v2-plan.md` §7.
- **Migrasi data lama sudah dijalankan** (2 Nov 2026, lihat `migration-guide.md` → Riwayat): 144 transaksi punya `account_type: bank` + `bentuk: satuan`. `--kode` **belum** dijalankan (ditunda sampai klien mobile diperbarui).
- **Import "Kode Nota"** (beberapa baris jadi satu nota) ditunda. Catatan desain di `v2-plan.md` §6.
- Belum ada tombol Hapus di halaman Nota (hapus dari tabel).
- Tampilan di layar HP (390px) bisa dipakai (tabel & baris penyesuaian di-scroll), tapi app ini tetap dirancang untuk desktop.
