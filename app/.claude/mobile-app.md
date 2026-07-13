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

Keenam app + hub sudah diport dengan fitur mendekati parity. Flutter SDK, JDK 17,
dan Android SDK (command-line tools) sudah terpasang di mesin dev — `flutter
analyze` sekarang **bersih total** ("No issues found!"), dan **build APK release
Android sudah berhasil** (`flutter build apk --release`), lihat "Build APK
Android" di bawah.

Folder `android/` & `ios/` **sudah digenerate** (lewat langkah yang sama dengan
`app/mobile/bootstrap.ps1`, lihat "Kenapa perlu bootstrap.ps1") dan ikut
disimpan di repo. iOS **belum pernah di-build** — itu wajib jalan di macOS
(Xcode), tidak bisa dari mesin dev Windows ini; lihat TODO.

Build pertama (`flutter build apk --release`) berhasil, **55.1MB**, ~16 menit
(sebagian besar waktu itu Gradle otomatis mengunduh komponen SDK yang belum
ada: NDK 28.2, Build-Tools 36, Platform 34, CMake — build kedua & seterusnya
akan jauh lebih cepat karena semua itu sudah ter-cache). Ada satu warning
non-blocking ("plugin `share_plus` masih pakai Kotlin Gradle Plugin lama") —
aman diabaikan untuk sekarang, cuma peringatan kompatibilitas ke depan dari tim
Flutter, bukan error.

Bug yang ditemukan & diperbaiki saat verifikasi pertama (`flutter analyze` +
`flutter build apk`):
- `Category` (kelas kita di `core/category.dart`) bentrok nama dengan kelas
  anotasi test bawaan `package:flutter/foundation.dart`. Fix: `hide Category`
  pada import itu di `kitchen/store.dart`, `note/store.dart`, `wishlist/store.dart`
  (bukan di file `material.dart` lain — `material.dart` ternyata tidak
  benar-benar mengekspor `Category`, sempat salah tambah `hide` di situ juga
  lalu ditarik balik).
- `const [FilteringTextInputFormatter.digitsOnly, ...]` gagal compile —
  `digitsOnly` itu `static final`, bukan `const`. Fix: buang `const` dari
  list itu di 4 tempat (field nominal Finance/Patungan/Wishlist).
- **`android/app/src/main/AndroidManifest.xml` tidak punya permission
  INTERNET** (`flutter create` cuma menambahkannya ke manifest `debug`/`profile`,
  bukan `main` yang dipakai build **release**) — tanpa ini, build release tidak
  bisa konek Firebase sama sekali. Sudah ditambahkan manual. **Kalau
  regenerate `android/` dari nol lewat `bootstrap.ps1`/`flutter create` lagi,
  WAJIB tambahkan ulang** baris ini, karena tooling Flutter tidak menaruhnya di
  situ secara default.

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

## Build APK Android

```powershell
cd app\mobile
flutter build apk --release
```

Menghasilkan `build/app/outputs/flutter-apk/app-release.apk` — **satu APK
universal** (semua ABI arm64-v8a/armeabi-v7a/x86/x86_64 digabung jadi satu
file, bukan `--split-per-abi`) supaya bisa dipakai satu link download yang
sama untuk device apa pun, sesuai kebutuhan tombol "Download APK Android" di
hub (`app/index.html`, lihat "Unduh Aplikasi Mobile" di `app/.claude/CLAUDE.md`).

**Signing**: `android/app/build.gradle.kts` masih pakai `signingConfigs.debug`
untuk build type `release` (bawaan `flutter create`, belum diganti keystore
sendiri) — cukup untuk sideload/dipakai sendiri, **tidak sah untuk submit ke
Play Store** (Play Store butuh app signing key sungguhan). Kalau nanti mau
rilis ke Play Store, ganti `signingConfig` dulu dengan keystore asli.

**Menyalin ke hub**: hasil build **wajib disalin manual** ke
`app/downloads/iyon-app.apk` (nama file tetap, ditimpa tiap build baru) supaya
tombol download di `app/index.html` selalu mengarah ke build terbaru:

```powershell
Copy-Item "build\app\outputs\flutter-apk\app-release.apk" "..\downloads\iyon-app.apk" -Force
```

**Belum diverifikasi jalan di device sungguhan** — mesin dev ini tidak punya
emulator maupun HP tersambung (setup Android SDK sengaja command-line-tools
saja, lihat README), jadi baru sebatas "build sukses tanpa error Gradle/compile".
Yang **belum** dikonfirmasi end-to-end: apakah Realtime Database benar-benar
konek dari APK terpasang (secara arsitektur seharusnya bisa — `Firebase.initializeApp(options: ...)`
eksplisit tidak butuh `google-services.json`, cukup `apiKey`/`projectId`/`databaseURL`
yang valid, appId cuma dipakai Analytics/FCM/Installations — tapi ini nalar,
bukan hasil tes nyata). **Install APK-nya di HP dan buka salah satu app
(mis. Kitchen) untuk konfirmasi Dashboard benar-benar memuat data dari
Firebase** sebelum menganggap ini "selesai".

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

- **Verifikasi di device sungguhan** — install `app/downloads/iyon-app.apk` di
  HP Android beneran, konfirmasi tiap app benar-benar bisa baca/tulis Firebase
  (bukan cuma "build sukses"). Lihat catatan di "Build APK Android".
- **iOS belum pernah di-build sama sekali** — wajib macOS + Xcode, tidak bisa
  dari mesin dev Windows ini. Opsi kalau tidak punya Mac: CI cloud macOS
  (Codemagic ada free tier khusus Flutter), lalu distribusi lewat TestFlight
  atau Ad-Hoc `.ipa` + Sideloadly (bisa diinstal dari Windows tanpa Mac,
  asal `.ipa`-nya sudah jadi). Sampai itu ada, tombol "Download untuk iPhone"
  di hub cuma munculkan popup "belum tersedia" — lihat `app/.claude/CLAUDE.md`
  bagian "Unduh Aplikasi Mobile".
- **`firebase_options.dart` masih memakai appId web** (`1:...:web:...`).
  Realtime Database **seharusnya** tetap jalan (`apiKey`/`projectId`/`databaseURL`
  valid, appId cuma dipakai Analytics/FCM/Installations — lihat "Build APK
  Android"), tapi **belum diverifikasi di device sungguhan**, dan **FCM tidak
  akan bisa register** sampai `flutterfire configure` dijalankan.
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
