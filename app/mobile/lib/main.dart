import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'core/firebase_options.dart';
import 'hub/hub_page.dart';
import 'messaging/fcm_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // Format tanggal & angka gaya Indonesia (id_ID) dipakai di semua app —
  // padanan `toLocaleString("id-ID")` di versi web.
  await initializeDateFormatting('id_ID');

  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  await FcmService.instance.init();

  runApp(const IyonApp());
}

/// Root app. Yang tampil pertama adalah **hub** (padanan `app/index.html`) —
/// daftar aplikasi, bukan salah satu app langsung. Tiap app di-`push` sebagai
/// route sendiri dengan tema & store-nya sendiri (lihat `core/widgets/app_host.dart`).
class IyonApp extends StatelessWidget {
  const IyonApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      title: 'Iyon App',
      debugShowCheckedModeBanner: false,
      home: HubPage(),
    );
  }
}
