# Generate SQL Query

Tool client-side utk bikin data dummy dari definisi kolom (nama + tipe data + opsi tiap tipe), lalu menghasilkan query SQL siap-eksekusi (`CREATE TABLE` opsional + `INSERT INTO`) utk **MySQL** atau **PostgreSQL**, plus preview tabel hasil generate di bawahnya. Semua diproses di browser, tidak ada request ke server manapun.

## Struktur file

`tool/generate-sql-query/{index.html, style.css, script.js}` — pola sama dgn tool lain di `tool/` (lihat `tool/.claude/CLAUDE.md`).

## Layout halaman

Grid 2 kolom (`.layout`, `400px 1fr`, collapse ke 1 kolom di bawah 900px):

- **Panel kiri (`builder`)** — nama tabel, tab mode (MySQL/PostgreSQL, `#modeTabs`), daftar kolom (`#columnList`) + tombol "+ Tambah Kolom", input jumlah baris, checkbox "Sertakan `CREATE TABLE`", tombol utama `.btn-grad` "⚡ Generate Query".
- **Panel kanan** — dua state yang saling `hidden`-toggle:
  - `#emptyPanel` — placeholder sebelum generate pertama kali.
  - `#outputPanel` — muncul stlh klik Generate: blok `<pre>` query SQL (`#sqlOutput`) + tombol salin (`#copyBtn`), lalu tabel preview (`#previewTable`) + catatan jumlah baris ditampilkan (`#previewNote`).

## Model kolom (`columns` array di `script.js`)

Tiap kolom: `{ id, name, type, options:{...}, nullable, hasDefault, defaultValue }`. `id` auto-increment string (`c1`, `c2`, ...) dipakai sbg key row data & dipakai cari elemen row lewat `data-col-id` — **bukan** index array, biar aman saat kolom dihapus di tengah.

Kolom default saat load (contoh starter): `id` (autoincrement), `nama` (fullname), `email` (email), `status` (enum), `created_at` (timestamp).

### Tipe data yang didukung (`TYPE_DEFS` + `TYPE_ORDER`)

| Tipe | Opsi | MySQL | PostgreSQL |
|---|---|---|---|
| `autoincrement` | `start` | `INT AUTO_INCREMENT PRIMARY KEY` | `SERIAL PRIMARY KEY` |
| `integer` | `min`, `max` | `INT` | `INTEGER` |
| `float` | `min`, `max`, `decimals` | `DECIMAL(12,n)` | `NUMERIC(12,n)` |
| `string` | `length` | `VARCHAR(n)` | `VARCHAR(n)` |
| `text` | `minWords`, `maxWords` | `TEXT` | `TEXT` |
| `boolean` | — | `BOOLEAN` | `BOOLEAN` |
| `date` | `startDate`, `endDate` | `DATE` | `DATE` |
| `timestamp` | `startDate`, `endDate` | `DATETIME` | `TIMESTAMP` |
| `uuid` | — | `CHAR(36)` | `UUID` |
| `enum` | `values` (pisah koma) | `ENUM('a','b',...)` | `VARCHAR(50) CHECK (col IN (...))` — Postgres asli tidak punya inline enum tanpa `CREATE TYPE`, jadi disederhanakan jadi `VARCHAR` + `CHECK` |
| `email` | — | `VARCHAR(255)` | `VARCHAR(255)` |
| `fullname` | — | `VARCHAR(150)` | `VARCHAR(150)` |

Field opsi per tipe dirender generik lewat `TYPE_DEFS[type].fields` (tiap field: `key`, `label`, `input` = tipe `<input>` HTML, `default`) — nambah tipe baru tinggal tambah entri baru di `TYPE_DEFS` + push nama tipenya ke `TYPE_ORDER`, tidak perlu ubah kode render.

Tiap kolom (kecuali `autoincrement`) punya checkbox **"Kadang NULL"** — kalau dicentang, ~15% baris utk kolom itu bernilai `NULL` (lihat `generateValue()`).

Tiap kolom juga punya checkbox **"Set Default Value"** — kalau dicentang, `renderColumns()` merender 1 input teks tambahan di bawahnya (`.col-default-value`) utk isi nilai default. Nilai ini **hanya memengaruhi klausa `DEFAULT` di `CREATE TABLE`** (`buildDefaultClause()`), tidak memengaruhi data dummy yg digenerate di `INSERT INTO` (krn INSERT selalu isi semua kolom scr eksplisit). Diabaikan utk tipe `autoincrement` (PK auto tidak butuh default manual). Format literal-nya otomatis menyesuaikan tipe kolom:
- `integer`/`float` → angka mentah tanpa kutip.
- `boolean` → dinormalisasi ke `TRUE`/`FALSE` (input `true`/`1` → `TRUE`, selain itu → `FALSE`).
- Kalau nilai yg diketik cocok keyword/fungsi SQL (`CURRENT_TIMESTAMP`, `CURRENT_DATE`, `CURRENT_TIME`, `NULL`, atau pola pemanggilan fungsi `nama(...)` mis. `NOW()`) → ditulis apa adanya tanpa kutip (`SQL_KEYWORD_DEFAULT`/`SQL_FUNCTION_CALL` regex).
- Tipe lain (string/text/enum/email/fullname/date/timestamp/uuid di luar kasus keyword di atas) → di-quote & di-escape sbg string literal.

Utk PostgreSQL, klausa `DEFAULT` sengaja ditaruh **sebelum** constraint `CHECK` enum (urutan standar definisi kolom: `type [DEFAULT ...] [CHECK ...]`) — makanya tipe dasar (`sqlBaseType()`) & constraint (`sqlConstraint()`) dipisah jadi 2 fungsi drpd 1 fungsi `sqlType()` yg dulu menggabungkan keduanya jadi satu string.

## Generator nilai dummy (`generateValue()`)

- `fullname`/`email` pakai daftar nama Indonesia (`FIRST_NAMES`/`LAST_NAMES`) — email diturunkan dari nama (lowercase, spasi→titik) + angka acak + domain dari `EMAIL_DOMAINS`.
- `string` pakai generator suku kata acak (`randomToken`, dari `SYLLABLES`) dipotong pas sesuai `length` — bukan string acak murni, biar keliatan "kata" bukan sampah karakter.
- `text` pakai kumpulan kata dari `LOREM_WORDS`, jumlah kata acak antara `minWords`–`maxWords`.
- `date`/`timestamp` acak antara `startDate`–`endDate` (kalau terbalik/invalid, otomatis di-swap/fallback ke `2020-01-01`–hari ini).
- `uuid` pakai `crypto.randomUUID()` kalau tersedia, fallback manual v4 generator.
- `enum` random pilih salah satu dari `values` (split koma, trim, filter kosong).
- **Default value ikut muncul di data dummy, bukan cuma di `CREATE TABLE`**: kalau kolom `hasDefault` aktif & `defaultValue` terisi, ~30% baris utk kolom itu memakai nilai default apa adanya (`parsedDefaultValue()`) drpd nilai acak — biar keliatan efeknya langsung di preview & `INSERT`, bukan cuma di skema tabel. Utk keyword `CURRENT_TIMESTAMP`/`NOW()`/`CURRENT_DATE`, nilai dummy-nya pakai waktu saat generate (bukan literal teks keyword-nya) krn di eksekusi nyata itu jg yg bakal ke-generate. Fitur ini independen dr "Kadang NULL" (bisa dicentang bareng, NULL dicek lebih dulu).
- **Tombol "Isi Semua" (`.default-all-btn`, state `col.forceDefaultAll`)** — muncul di sebelah input Default Value begitu "Set Default Value" dicentang. Toggle button (bukan aksi sekali-jalan): aktif → **100% baris** kolom itu dipaksa pakai nilai default (`generateValue()` cek `forceDefaultAll` di paling awal, sebelum cek "Kadang NULL" sekalipun — jadi override total, bukan lagi probabilitas 30%). Klik lagi → nonaktif, balik ke campuran acak + ~30% default seperti biasa. Otomatis di-reset ke `false` kalau checkbox "Set Default Value" dimatikan (krn gak ada default utk dipaksa).

## Query yang dihasilkan (`buildCreateTable`, `buildInsert`)

- Identifier (nama tabel & kolom) selalu di-quote: backtick `` ` `` di MySQL, double-quote `"` di PostgreSQL (`quoteIdent()`), supaya query tetap valid walau nama tabrakan reserved word.
- `CREATE TABLE` hanya disertakan kalau checkbox "Sertakan CREATE TABLE" aktif (default: aktif).
- `INSERT INTO` selalu 1 statement multi-row (`INSERT ... VALUES (...), (...), ...;`) — bukan 1 statement per baris, biar ringkas & lazim dieksekusi sekali jalan.
- Nilai string/enum/email/fullname/text di-escape (petik satu digandakan `''`) lewat `escapeSQLString()`. Boolean jadi `TRUE`/`FALSE` (bukan `1`/`0`) di kedua mode — MySQL menerima keduanya sbg alias.
- Baris `NULL` (dari opsi "Kadang NULL") jadi keyword `NULL` tanpa kutip.

## Preview hasil (`renderPreview()`)

Menampilkan **maks 10 baris pertama** dari hasil generate di `<table>`, kalau jumlah baris yg digenerate lebih besar dari itu, baris ke-11 diganti 1 baris ringkasan lintas-kolom (`colspan`) berbunyi **"… N data lainnya"** (N = sisa baris yg tidak ditampilkan). Ini murni simulasi tampilan JS di browser — **tidak benar-benar menjalankan query** ke database manapun (`tool/` tidak ada backend/DB).

Tabel preview dibungkus `.table-scroll` (`overflow:auto`) — kalau kolom terlalu banyak/lebar, **tabel ini sendiri yg discroll horizontal, bukan halamannya**. Ini disengaja, beda dgn blok `<pre>` query SQL di atasnya (`.sql-box`) yg sebaliknya **wrap teks** (`white-space:pre-wrap; overflow-wrap:anywhere`) drpd scroll — krn `<pre>` dgn `white-space:pre` + baris panjang (mis. UUID/banyak kolom) bisa memaksa grid track `.layout` (kolom `1fr`) melebar mengikuti intrinsic content width-nya, bikin **seluruh halaman** ikut bisa digeser kanan-kiri (bug yg pernah kejadian). Fix-nya 2 lapis: `.panel{ min-width:0 }` biar grid item gak lagi maksa track melebar ikut konten, + `body{ overflow-x:hidden }` sbg jaring pengaman terakhir.

## Validasi

`validateColumns()` dipanggil sblm generate: minimal 1 kolom, nama kolom tidak boleh kosong, dan tidak boleh duplikat (case-insensitive) — gagal → `showToast()` pesan error, tidak lanjut generate.

## Batas jumlah baris

Input `#rowCount` dibatasi maks **5000** baris (`Math.min(5000, ...)` di handler Generate) — murni pertimbangan performa render string SQL + tabel preview di browser, bukan limit dari sisi database manapun.

## Identitas visual

Struktur token & pola CSS-nya ikut konvensi "Identitas visual bersama" di `tool/.claude/CLAUDE.md` (nama variable `--accent`/`--accent-light`/`--accent-strong`/`--accent-mid`, dst, + pola tombol gradient `background-size:200% auto` + shift `background-position` saat hover) — **tapi nilai warna `--accent*`-nya sengaja DIUBAH dari teal (standar semua tool lain) jadi oranye-kuning**, atas permintaan eksplisit user yg kasih contoh gradient sendiri. Jadi tool ini satu-satunya yg palet warnanya beda dari "keluarga" `tool/` lainnya:

- Terang: `--accent:#FF8008`, `--accent-light:#FFEDD5`, `--accent-strong:#C2650A`, `--accent-mid:#FFC837`.
- Gelap (`[data-theme="dark"]`): `--accent:#FFB020`, `--accent-light:rgba(255,176,32,0.18)`, `--accent-strong:#FFC837`, `--accent-mid:#FF8008`.
- Semua elemen yg pakai `var(--accent)` ikut kena efeknya scr otomatis: tab mode aktif (`.mode-tab.active`), checkbox (`accent-color` di `.checkbox-row input[type=checkbox]`), tombol toggle "Isi Semua" aktif (`.default-all-btn.active`), outline fokus input, dan hover row tabel preview (`--accent-light`).
- Tombol utama pakai class `.btn-grad` (bukan `.btn-brass` seperti `bento-image/`) dgn gradient **hardcoded** `#FF8008 → #FFC837 → #FF8008` (bukan lewat `var(--accent-strong)`/`var(--accent-mid)` seperti pola awal) — krn user kasih kode CSS `.btn-grad` literal sbg acuan warna, bukan cuma bentuk. `box-shadow` glow-nya jg diselaraskan ke rgba oranye (bukan rgba teal spt tool lain).
- **Kalau nanti mau nyamain lagi ke identitas teal standar** (atau ganti warna lagi), tinggal ubah 4 variable `--accent*` di `:root`/`[data-theme="dark"]` + gradient hardcoded di `.btn-grad` — gak ada tempat lain yg pakai warna hardcoded selain situ.

Tema gelap/terang punya toggle + localStorage key sendiri: `generatesqlquery_theme` (independen dari tool lain, sesuai konvensi tiap tool punya key sendiri-sendiri).

## Batasan / catatan

- Enum utk PostgreSQL disederhanakan jadi `VARCHAR + CHECK` (bukan `CREATE TYPE ... AS ENUM`) — kalau user butuh enum asli Postgres, harus ubah manual query hasil generate.
- Tidak ada opsi foreign key / relasi antar tabel — tool ini fokus 1 tabel per generate.
- Tidak ada penyimpanan/riwayat kolom antar sesi (refresh halaman = balik ke kolom starter default) — sesuai filosofi `tool/` yang sifatnya sekali-pakai per sesi.
