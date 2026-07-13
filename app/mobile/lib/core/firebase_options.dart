import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

/// Config Firebase project `iyon-adryanlf-trialerror` — project yang SAMA
/// dengan versi web (app/finance/index.html dst.) dan 24Card, cuma beda path
/// node di Realtime Database.
///
/// PENTING — placeholder, wajib diganti sebelum rilis:
/// nilai di bawah disalin dari config **web** (`firebase.initializeApp` inline
/// di `<head>` tiap index.html). `apiKey`, `projectId`, `databaseURL`, dan
/// `messagingSenderId` memang sama lintas platform, tapi **`appId` berbeda per
/// platform** (web `1:...:web:...`, Android `1:...:android:...`, iOS
/// `1:...:ios:...`). Realtime Database umumnya tetap jalan dengan appId web,
/// tapi **FCM tidak akan bisa register** sampai appId aslinya benar.
///
/// Cara benerinnya (sekali jalan, lihat README):
///     dart pub global activate flutterfire_cli
///     flutterfire configure --project=iyon-adryanlf-trialerror
///
/// Perintah itu akan menimpa file ini dengan nilai asli per platform sekaligus
/// menaruh `google-services.json` (Android) & `GoogleService-Info.plist` (iOS).
class DefaultFirebaseOptions {
  const DefaultFirebaseOptions._();

  static const String _apiKey = 'AIzaSyAzjLIkaqXKZ4L1xJe7U-vx8t1ITkNGt08';
  static const String _projectId = 'iyon-adryanlf-trialerror';
  static const String _messagingSenderId = '519669963248';
  static const String _databaseUrl =
      'https://iyon-adryanlf-trialerror.firebaseio.com';
  static const String _storageBucket =
      'iyon-adryanlf-trialerror.firebasestorage.app';

  /// TODO(flutterfire): ganti dengan appId Android asli (`1:...:android:...`).
  static const FirebaseOptions android = FirebaseOptions(
    apiKey: _apiKey,
    appId: '1:519669963248:web:feab50008d27c2a7226535',
    messagingSenderId: _messagingSenderId,
    projectId: _projectId,
    databaseURL: _databaseUrl,
    storageBucket: _storageBucket,
  );

  /// TODO(flutterfire): ganti dengan appId iOS asli (`1:...:ios:...`).
  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: _apiKey,
    appId: '1:519669963248:web:feab50008d27c2a7226535',
    messagingSenderId: _messagingSenderId,
    projectId: _projectId,
    databaseURL: _databaseUrl,
    storageBucket: _storageBucket,
    iosBundleId: 'com.iyonadryan.iyonMobile',
  );

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: _apiKey,
    appId: '1:519669963248:web:feab50008d27c2a7226535',
    messagingSenderId: _messagingSenderId,
    projectId: _projectId,
    authDomain: 'iyon-adryanlf-trialerror.firebaseapp.com',
    databaseURL: _databaseUrl,
    storageBucket: _storageBucket,
  );

  static FirebaseOptions get currentPlatform {
    if (kIsWeb) return web;
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError(
          'Platform ${defaultTargetPlatform.name} belum dikonfigurasi. '
          'Jalankan `flutterfire configure` untuk menambahkannya.',
        );
    }
  }
}
