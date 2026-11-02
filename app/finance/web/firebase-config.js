/* =========================================================
   Finance App (Desktop) — firebase-config.js
   Config + inisialisasi Firebase. SAMA PERSIS dengan versi
   mobile (../index.html). Di-load di akhir <body> setelah SDK
   Firebase, sebelum script.js.

   Catatan: config web Firebase memang bukan rahasia (selalu
   bisa dilihat dari browser). Keamanan data diatur oleh rules
   Realtime Database di Firebase console.
   ========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyAzjLIkaqXKZ4L1xJe7U-vx8t1ITkNGt08",
  authDomain: "iyon-adryanlf-trialerror.firebaseapp.com",
  databaseURL: "https://iyon-adryanlf-trialerror.firebaseio.com",
  projectId: "iyon-adryanlf-trialerror",
  storageBucket: "iyon-adryanlf-trialerror.firebasestorage.app",
  messagingSenderId: "519669963248",
  appId: "1:519669963248:web:feab50008d27c2a7226535",
  measurementId: "G-4MFLB4B68F",
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
// Root data : /finance
const FINANCE_PATH = "finance";
