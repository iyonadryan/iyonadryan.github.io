# Iyon App — Mobile (Flutter)

Versi Android & iOS dari kumpulan aplikasi web di [`app/`](../). Keenam app
(Finance, Kitchen, Routine, Patungan, Note, Wishlist) + hub-nya diport ke satu
project Flutter, memakai **Firebase Realtime Database yang sama persis** dengan
versi web (project `iyon-adryanlf-trialerror`, node `finance`/`kitchen`/dst.).

Artinya: **data-nya nyambung**. Catat transaksi di HP, langsung muncul di web,
dan sebaliknya — bukan dua aplikasi terpisah dengan data masing-masing.

Dokumentasi arsitektur lengkap ada di [`app/.claude/mobile-app.md`](../.claude/mobile-app.md).

---

## Setup pertama kali

Folder ini **belum punya `android/` dan `ios/`** — dua folder itu digenerate
tooling Flutter (Gradle & Xcode project tidak bisa ditulis tangan dengan andal).
Yang sudah ada di sini: seluruh kode Dart (`lib/`), `pubspec.yaml`, dan script
bootstrap-nya.

### 1. Install Flutter

Butuh **Flutter 3.35+ / Dart 3.9+**. Ikuti
<https://docs.flutter.dev/get-started/install/windows>, lalu pastikan:

```powershell
flutter --version
flutter doctor
```

`flutter doctor` harus hijau untuk Android toolchain (butuh Android Studio +
Android SDK). Untuk iOS butuh macOS + Xcode — tidak bisa dari Windows.

### 2. Generate folder native + install dependency

```powershell
cd app\mobile
.\bootstrap.ps1
```

Script ini menjalankan `flutter create` di folder **temp** (bukan di sini),
lalu menyalin hanya `android/` + `ios/` ke project. Itu disengaja: `flutter
create .` langsung di folder ini akan **menimpa `lib/main.dart` dan
`pubspec.yaml`** yang sudah berisi kode app.

Script ini juga menyalin `app/img/*.png` (ikon Iyon/Ciwul/Both) ke
`assets/img/`, dan menjalankan `flutter pub get`.

### 3. Sambungkan Firebase (WAJIB)

`lib/core/firebase_options.dart` sekarang masih memakai **appId versi web**.
Realtime Database umumnya tetap jalan dengan itu, tapi **FCM tidak akan bisa
register** sampai appId Android/iOS yang benar terpasang.

```powershell
dart pub global activate flutterfire_cli
flutterfire configure --project=iyon-adryanlf-trialerror
```

Perintah itu menimpa `firebase_options.dart` dengan nilai asli per platform,
sekaligus menaruh `google-services.json` (Android) dan `GoogleService-Info.plist`
(iOS). Dua file itu sudah masuk `.gitignore` — jangan di-commit.

### 4. Jalankan

```powershell
flutter run
```

---

## Yang perlu dicek di Firebase Console

Rules-nya masih sama dengan versi web: **publik, tanpa auth**. Tiap node app
(`finance`, `kitchen`, `routine`, `patungan`, `note`, `wishlist`) perlu
`.write: true`. Kalau tulis data diam-diam gagal, itu yang pertama dicek.

FCM juga butuh setup tambahan sebelum benar-benar bisa kirim notifikasi:
- **Android**: cukup `google-services.json` (langkah 3).
- **iOS**: APNs key di Firebase Console + capability *Push Notifications* di Xcode.

---

## Status FCM

Baru **hook**-nya (`lib/messaging/fcm_service.dart`): minta izin, ambil token,
pasang listener foreground/background/tap. Belum ada notifikasi nyata yang
ditampilkan, dan token belum dikirim ke mana pun.

Untuk melanjutkan, tiga hal yang belum ada:
1. Simpan token ke Firebase (mis. node `devices/<token>`) supaya pengirim tahu
   harus menyasar siapa.
2. Tambah `flutter_local_notifications` — Android tidak menampilkan notif
   otomatis kalau app sedang di foreground.
3. Deep-link dari `message.data` ke app + halaman yang relevan.

Kandidat pemakaian (dari TODO app web): reminder rutinitas (Routine), reminder
catatan (Note), peringatan budget hampir habis (Finance).
