import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

/// Handler pesan saat app **mati / di background**. Wajib top-level (bukan
/// closure atau method) — dijalankan di isolate terpisah oleh plugin.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // TODO(fcm): isi saat notifikasi sungguhan dipakai. Kalau nanti perlu akses
  // Firebase di sini, panggil `Firebase.initializeApp()` dulu — isolate ini
  // TIDAK mewarisi inisialisasi dari main().
  debugPrint('[FCM] background message: ${message.messageId}');
}

/// Hook FCM — struktur sudah siap, logic notifikasi belum diisi.
///
/// **Status sekarang**: minta izin, ambil token, dan pasang listener foreground
/// / tap. Belum ada notifikasi lokal yang benar-benar ditampilkan saat app
/// dibuka (Android tidak menampilkan notif otomatis kalau app di foreground —
/// butuh `flutter_local_notifications`, sengaja belum ditambahkan supaya
/// dependency tetap minimal sampai fiturnya dipakai).
///
/// **Sebelum ini bisa jalan** (lihat README):
/// 1. `flutterfire configure` — `lib/core/firebase_options.dart` sekarang masih
///    memakai appId **web**; FCM tidak akan bisa register sampai appId
///    Android/iOS yang benar terpasang.
/// 2. iOS: butuh APNs key di Firebase Console + capability Push Notifications
///    di Xcode.
///
/// Rencana pemakaian (dari TODO app web): reminder rutinitas (Routine),
/// reminder catatan (Note), peringatan budget hampir habis (Finance).
class FcmService {
  FcmService._();

  static final FcmService instance = FcmService._();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;

  String? _token;

  /// Token perangkat ini. Belum dikirim ke mana pun — nanti perlu disimpan ke
  /// Firebase (mis. `devices/<token>`) supaya server tahu harus kirim ke siapa.
  String? get token => _token;

  Future<void> init() async {
    final settings = await _messaging.requestPermission();
    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      debugPrint('[FCM] izin notifikasi ditolak — hook tidak dipasang.');
      return;
    }

    try {
      _token = await _messaging.getToken();
      debugPrint('[FCM] token: $_token');
    } on Exception catch (e) {
      // Paling sering: appId belum benar (masih placeholder web). Jangan sampai
      // ini menjatuhkan app — FCM belum fitur inti.
      debugPrint('[FCM] gagal ambil token: $e');
    }

    FirebaseMessaging.onMessage.listen((message) {
      // TODO(fcm): tampilkan notifikasi lokal / update badge in-app.
      debugPrint('[FCM] foreground: ${message.notification?.title}');
    });

    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      // TODO(fcm): deep-link ke app & halaman yang relevan berdasarkan
      // `message.data` (mis. {"app": "routine", "routineId": "..."}).
      debugPrint('[FCM] dibuka dari notifikasi: ${message.data}');
    });
  }
}
