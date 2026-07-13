# Iyon App Mobile (Flutter)

Port **Android & iOS** dari keenam app web di `app/` + hub-nya, dikerjakan di
`app/mobile/` sebagai satu project Flutter. Alasan memilih Flutter (bukan mis.
PWA/Capacitor): user ingin implementasi **FCM** ke depannya.

**Bukan app baru dengan data sendiri** — dia memakai **Firebase Realtime Database
yang sama persis** dengan versi web (project `iyon-adryanlf-trialerror`, node
`finance`/`kitchen`/`routine`/`patungan`/`note`/`wishlist`). Data nyambung dua
arah: catat di HP, muncul di web, dan sebaliknya. Konsekuensinya: **kalau skema
Firebase salah satu app web berubah, versi mobile-nya harus ikut diubah di
perubahan yang sama** (dan sebaliknya) — dua sisi ini tidak punya pipeline yang
menyinkronkan otomatis.

## Status saat ini

Keenam app + hub sudah diport dengan fitur mendekati parity. **Belum pernah
di-compile/di-run** — Flutter SDK tidak terpasang di mesin tempat port ini
ditulis, jadi `flutter analyze`/`flutter run` belum pernah jalan sekali pun.
Anggap ini "kode lengkap tapi belum terverifikasi": kemungkinan besar masih ada
error kecil (nama parameter API, import kurang) yang cuma ketahuan saat compile
pertama.

Folder `android/` & `ios/` **sengaja belum ada** — digenerate lewat
`app/mobile/bootstrap.ps1` (lihat "Kenapa perlu bootstrap.ps1").

## Struktur folder

```
app/mobile/
  pubspec.yaml
  bootstrap.ps1            # generate android/ + ios/ tanpa menimpa lib/
  README.md                # panduan setup untuk manusia
  lib/
    main.dart              # init Firebase + intl + FCM, lalu buka hub
    core/                  # dipakai bareng semua app
      firebase_options.dart  # config Firebase (masih appId web — lihat TODO)
      app_palette.dart       # padanan Dart dari :root/[data-theme=dark] tiap app
      app_theme.dart         # ThemeData + ThemeController (preferensi per-app)
      app_store.dart         # basis store: satu listener realtime -> rebuild -> render
      formatters.dart        # formatCurrency, slugify, dateKey, startOfWeek, ...
      users.dart             # USERS (Iyon/Ciwul/Both) + UserScope
      category.dart          # kategori flat (Kitchen/Note/Wishlist) + CategoryOwner
      widgets/
        app_host.dart        # pembungkus tiap app: tema + store + overlay
        app_shell.dart       # header + bottom nav 4 tab + tombol [+] tengah
        ui.dart              # kartu, tombol, chip, sheet, confirm dialog, dst.
        category_sheet.dart  # CRUD kategori — dipakai bertiga Kitchen/Note/Wishlist
        settings_common.dart # tema, "Semua Aplikasi", pengguna aktif, Tentang
    hub/hub_page.dart      # launcher (padanan app/index.html)
    messaging/fcm_service.dart
    finance/ kitchen/ routine/ patungan/ note/ wishlist/
```

Tiap folder app isinya `store.dart` (model + layer data Firebase) + file UI-nya.
Finance yang paling besar, jadi dia satu-satunya yang dipecah lagi jadi
`pages/` + `widgets/` + `ui_state.dart` + `excel_export.dart`.

## Pemetaan konsep web → Flutter

Port ini sengaja **meniru arsitektur versi web**, bukan mendesain ulang — supaya
kalau salah satu sisi berubah, padanannya gampang dicari.

| Versi web (`script.js`)                          | Versi Flutter                                  |
| ------------------------------------------------ | ---------------------------------------------- |
| `db.ref(path).on("value", ...)` → `renderAll()`  | `AppStore.subscribe()` → `notifyListeners()`   |
| `rebuildFromSnapshot(snap)`                      | `AppStore.rebuildFromSnapshot(root)`           |
| variabel closure di IIFE (`viewDate`, `currentFilter`) | `FinanceUiState` (ChangeNotifier)        |
| `localStorage["financeapp_theme"]`               | SharedPreferences, **key yang sama persis**    |
| CSS var `--color-primary`, `--series-N`          | `AppPalette` (via `ThemeExtension`, `context.palette`) |
| `.modal-overlay` + `.modal-sheet`                | `showAppSheet()` (bottom sheet)                |
| `#confirmModal` / `openConfirm()`                | `confirmDialog()`                              |
| `.nav-add` (tombol + tengah)                     | `AppShell.onAddTap`                            |
| `#loadingOverlay`                                | `LoadingOverlay` di `AppHost`                  |
| `generate-excel.js` (SheetJS)                    | `finance/excel_export.dart` (package `excel`)  |

Aturan yang ikut terbawa (sengaja): **fungsi tulis tidak pernah memanggil render
manual** — cukup tulis ke Firebase, listener realtime yang memantulkan hasilnya
balik ke UI.

### Tema per-app

Tiap app punya tema & preferensi light/dark **sendiri**, sama seperti web (ganti
tema di Finance tidak mengubah Kitchen). Diwujudkan lewat `AppHost` yang
membungkus tiap route dengan `Theme(data: buildAppTheme(spec.palette(...)))`.
Nilai warnanya disalin **persis** dari `css/base.css` masing-masing app —
kalau CSS berubah, `app_palette.dart` harus ikut diubah manual.

Tombol "Iyon App" di Pengaturan tiap app tetap **gradient ungu hub** (`HubGradient`),
hardcode dan bukan warna primary app-nya — mempertahankan permintaan eksplisit
user di versi web.

### Pengguna aktif (Iyon/Ciwul/Both)

Cuma **Finance & Routine** yang punya (`AppHost.userScopeKey` diisi). Kitchen &
Patungan tidak punya konsep pembuat sama sekali; Note & Wishlist punya field
`by` tapi itu **atribusi murni** — tidak pernah menyembunyikan data siapa pun.
Pembagian ini sama persis dengan versi web.

### Migrasi data

Migrasi backfill yang ada di versi web ikut diport (dengan guard "sekali jalan"
yang sama): `_migrateLegacyPlans` & `_migrateTransactionOwners` (Finance),
`_migrateOwners` (Routine, Note), `_seedCategoriesIfEmpty` (Finance, Kitchen,
Note, Wishlist). Ini **wajib** ada — kalau tidak, app mobile bisa menulis data
berskema baru ke database yang isinya masih skema lama.

## Kenapa perlu `bootstrap.ps1`

`flutter create .` langsung di `app/mobile/` akan **menimpa `lib/main.dart` dan
`pubspec.yaml`** yang sudah berisi kode app. Jadi script-nya menjalankan
`flutter create` ke folder **temp**, lalu menyalin **hanya** `android/` + `ios/`
ke sini. Dia juga menyalin `app/img/*.png` ke `assets/img/` — di web ikon
pengguna direferensikan sbg `../img/iyon.png`, di Flutter harus jadi asset
terdaftar di `pubspec.yaml`.

## Perbedaan yang disengaja dari versi web

- **Markdown Note App**: web memakai parser buatan sendiri
  (`renderMarkdownToHtml`/`inlineMarkdown`) karena project-nya sengaja tanpa
  dependency. Di Flutter dipakai `flutter_markdown` — tidak ada alasan menulis
  parser sendiri di sini.
- **Export Excel**: di web file-nya diunduh browser. Di mobile tidak ada konsep
  itu — file ditulis ke folder temporer lalu dibuka lewat **share sheet OS**
  (user pilih sendiri mau disimpan/dikirim ke mana).
- **Drag-reorder rencana** (Finance): web memakai Pointer Events + transform
  manual. Di Flutter dipakai `ReorderableListView` bawaan. Perilaku akhirnya
  sama (urutan ditulis ke field `sort`), implementasinya jauh lebih pendek.
- **Editor isi catatan** (Note): web memakai overlay full-screen custom. Di
  Flutter dipakai route `fullscreenDialog` — tab Tulis/Preview-nya tetap sama.

## Rencana / TODO ke depan

- **Compile pertama belum pernah jalan** — jalankan `flutter analyze` lalu
  `flutter run` dan beresi error yang muncul. Ini pekerjaan pertama sebelum apa
  pun yang lain.
- **`firebase_options.dart` masih memakai appId web** (`1:...:web:...`).
  Realtime Database umumnya tetap jalan, tapi **FCM tidak akan bisa register**
  sampai `flutterfire configure` dijalankan.
- **FCM baru hook** (`messaging/fcm_service.dart`): izin + token + listener
  sudah ada, tapi belum ada notifikasi nyata. Yang belum: simpan token ke
  Firebase, tambah `flutter_local_notifications` (Android tidak menampilkan
  notif otomatis saat app di foreground), deep-link dari `message.data`.
- **Auth**: sama seperti versi web, database masih publik readable/writable.
  Fitur pengguna aktif cuma preferensi tampilan, **bukan** proteksi akses.
- Belum ada testing otomatis maupun CI.

## Catatan implementasi

- Semua teks UI berbahasa Indonesia, konsisten dengan versi web.
- **Wajib**: setiap perubahan struktur/fitur di `app/mobile/` diupdate juga di
  dokumen ini pada perubahan yang sama — berlaku di semua project dalam repo
  `iyonadryan.github.io`.
- **Wajib**: perubahan skema Firebase di app web mana pun harus dicerminkan di
  `store.dart` app itu di sisi mobile (dan sebaliknya). Dua sisi ini berbagi
  database yang sama; skema yang menyimpang akan merusak salah satunya diam-diam.
