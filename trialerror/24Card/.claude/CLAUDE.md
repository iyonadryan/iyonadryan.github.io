# CLAUDE.md — 24Card Mini Game

Dokumen ini mendeskripsikan pola, konvensi, dan arsitektur proyek 24Card agar setiap perubahan tetap konsisten.

---

## Tech Stack

- **Frontend:** HTML5 + CSS3 + Vanilla JavaScript (tanpa framework)
- **Database:** Firebase Realtime Database v8.10.1
- **Bahasa UI:** Indonesia (semua teks, label, error message)
- **Design System:** Glass-morphism, gradient purple-blue `135deg, #0f0c29, #302b63, #24243e`

---

## Struktur File

```
24Card/
├── index.html              # Halaman utama / menu
├── 24.html                 # Mode 24 (4 kartu → target 24)
├── 36.html                 # Mode 36 (5 kartu → target 36)
├── custom-mode.html        # Mode custom (target & jumlah kartu bebas)
├── battle.html             # Pilihan mode battle (host/mobile)
├── battle-room.html        # Room host — daftar pemain
├── battle-lobby.html       # Lobby mobile player
├── battle-host.html        # Layar host saat game berlangsung
├── battle-mobile.html      # Layar mobile player saat game berlangsung
├── battle-result.html      # Hasil akhir battle
├── duel.html               # Mode duel 1v1
├── duel-room.html          # Room waiting duel
├── duel-play.html          # Layar permainan duel (host & enemy)
├── duel-result.html        # Hasil akhir duel
├── poker.html               # Pilihan mode poker (host/mobile) [WIP]
├── poker-room.html         # Room host poker — daftar pemain [WIP]
├── poker-lobby.html        # Lobby mobile player poker [WIP]
├── leaderboard-score.html  # Top 25 skor
├── style.css               # Global styles (dipakai semua halaman)
├── style-battle.css        # Battle-specific styles
├── style-battle-mobile.css # Mobile player styles
├── style-battle-room.css   # Room waiting styles
├── style-battle-result.css # Result page styles
├── style-duel.css          # Duel mode styles
├── style-duel-room.css     # Duel room styles
├── style-duel-play.css     # Duel play styles
├── style-poker.css          # Poker mode-select styles [WIP]
├── script.js               # Core game logic (mode 24 & 36)
├── custom-mode.js          # Custom game mode logic
├── battle.js               # Battle navigation & room creation
├── battle-room.js          # Host room management
├── battle-lobby.js         # Mobile lobby
├── battle-host.js          # Host gameplay & round management
├── battle-mobile.js        # Mobile player gameplay
├── battle-result.js        # Result page rendering
├── battle-score.js         # Score calculation (shared utility)
├── duel.js                 # Duel navigation & room creation
├── duel-room.js            # Duel room logic
├── duel-play.js            # Duel gameplay logic (host & enemy)
├── duel-score.js           # Duel scoring formula (calculateDuelScores)
├── duel-result.js          # Duel result page rendering
├── poker.js                 # Poker navigation & room creation [WIP]
├── poker-room.js            # Host room management poker [WIP]
├── poker-lobby.js           # Mobile lobby poker [WIP]
└── leaderboard-score.js    # Leaderboard rendering
```

> **[WIP]** = tampilan mode-select, host-room, dan mobile-lobby sudah jadi. Layar gameplay (`poker-host.html`/`poker-mobile.html`) dan `poker-result.html` **belum dibuat**, menunggu aturan main Poker difinalisasi. Lihat [Alur Poker](#alur-poker-wip) di bawah.

### Aturan CSS per Halaman

Setiap halaman selalu include `style.css` + CSS spesifiknya:

| Halaman | CSS Tambahan |
|---|---|
| 24.html, 36.html, custom-mode.html | *(hanya style.css)* |
| battle.html, battle-host.html, battle-mobile.html | style-battle.css |
| battle-room.html | style-battle-room.css |
| battle-lobby.html | style-battle-mobile.css |
| battle-result.html | style-battle.css + style-battle-result.css |
| duel.html | style-battle.css + style-duel.css |
| duel-room.html | style-battle-room.css + style-duel-room.css |
| duel-play.html | style-battle.css + style-duel-play.css |
| duel-result.html | style-battle.css + style-battle-result.css |
| poker.html | style-battle.css + style-poker.css |
| poker-room.html | style-battle-room.css *(reuse langsung — belum ada style-poker-room.css)* |
| poker-lobby.html | style-battle-mobile.css *(reuse langsung — belum ada style-poker-mobile.css)* |

> Kenapa `poker.html` tetap include `style-battle.css`: file itu isinya bukan cuma "battle", tapi juga komponen generik yang dipakai lintas mode (`.overlay`, `.create-room-form`, `.battle-popup-rules`, `.room-divider`, `.btn-join`, `.btn-cancel`, dsb) — pola yang sama dipakai `duel.html` (`style-battle.css` + `style-duel.css`). Class **tampilan utama** tiap mode (title, subtitle, options, tombol besar) HARUS ada di file `style-{mode}.css` sendiri, jangan pinjam class `.battle-title`/`.battle-btn`/dst milik mode lain — itu yang bikin `poker.html` sebelumnya salah pakai `style-battle.css` doang. `poker-room.html`/`poker-lobby.html` untuk saat ini masih reuse CSS battle 100% karena layout-nya identik (grid player, ready system) — kalau nanti butuh styling unik (misal warna token/chip khas poker), baru dipisah jadi `style-poker-room.css`/`style-poker-mobile.css` seperti pola `style-duel-room.css`.

---

## Menu Utama (index.html)

- Grup pertama `.menu-options`: 5 tombol mode inti (24, 36, Custom, Battle, Duel).
- Divider `.menu-divider` ("OTHER MODE") + grup kedua `.menu-options`: mode-mode baru/eksperimental, dipisah biar gampang nambah tanpa ganggu 5 tombol utama. Ukuran tombol tetap pakai class `.menu-btn` yang sama (auto center & auto-wrap lewat flex).
- Tiap mode baru di grup ini dapat warna border sendiri lewat class `.menu-btn-{mode}` (lihat `.menu-btn-poker` = ungu `#ab47bc`, `.menu-btn-ceki` = teal `#26a69a`) supaya gampang dibedain.
- Icon tombol pakai `<img class="menu-btn-icon-img">` (56×56px) kalau ada asset custom di `img/`, bukan emoji — dipakai sejak Poker Card (`img/chip-poker-icon.png`) dan Ceki Card (`img/poker-cards.png`).

### Status mode di menu

| Mode | Status | Keterangan |
|---|---|---|
| Poker Card | WIP, sudah ada `poker.html` | Lihat [Mode Poker](#mode-poker-wip) |
| Ceki Card | **Coming soon**, belum ada halaman | Tombol pakai pola "Coming Soon" di bawah, klik cuma munculin alert |

### Pola Tombol "Coming Soon"

Dipakai untuk fitur yang tombolnya sudah ditaruh di UI tapi belum diimplementasi (dulu dipakai `duel.js` untuk tombol Quick Match, sekarang juga `index.html` untuk Ceki Card):

```javascript
btnX.addEventListener('click', (e) => {
  e.preventDefault();
  alert('Fitur X masih tahap rencana, stay tuned!');
});
```

- Tombol tetap `<a href="#">`, jangan dihapus dari DOM — biar kelihatan sebagai preview fitur mendatang.
- Kasih visual redup (`opacity: 0.6`, naik dikit pas `:hover`) di CSS supaya user ngerti belum aktif, tanpa perlu badge/overlay tambahan.
- **Jangan** bikin halaman/JS/Firebase path kosong buat mode yang statusnya masih "coming soon" — tunggu sampai mode itu beneran mau dikerjain (lihat [Mode Poker](#mode-poker-wip) sebagai contoh kapan baru mulai bikin file sungguhan).

---

## Konvensi Penamaan

### JavaScript

| Pola | Contoh |
|---|---|
| State object | `state`, `challenge`, `gameState` |
| Konstanta mode | `CARD_COUNT`, `TARGET`, `MODE` |
| Firebase ref | `db` |
| Room identifier | `roomId` (4 digit angka) |
| Pemain | `playerName` |
| Generator | `generateNumbers()`, `generateSuits()`, `generateUniqueRoomId()` |
| Renderer | `renderCards()`, `renderOps()`, `renderSteps()`, `renderInfo()` |
| Event handler | `handleCardClick()`, `handleOpClick()` |
| Modal | `showOverlay()`, `hideOverlay()` |
| Kalkulasi | `calculate()`, `calculateScores()` |
| Inisialisasi | `startChallenge()`, `startCountdown()`, `startTimer()` |
| Formatting | `formatNum()`, `formatTime()` |
| Boolean check | `isSolvable()`, `isRedSuit()` |

### CSS Classes

| Kategori | Contoh Class |
|---|---|
| Kartu | `.card`, `.card-selected`, `.card-disabled`, `.card-won`, `.card-lost` |
| Suit warna | `.suit-red`, `.suit-black` |
| Tombol | `.btn-primary`, `.btn-secondary`, `.btn-challenge` |
| Modal | `.overlay` |
| Layout | `.container` |
| Challenge | `.challenge-header`, `.challenge-timer`, `.challenge-score` |
| Room | `.room-*` |
| Pemain | `.player-*` |
| History | `.steps`, `.step-item` |
| Leaderboard | `.lb-*` |
| Mobile | `.mobile-*` |
| Duel | `.duel-*` |

---

## State Management

### State Object Utama (script.js / custom-mode.js)

```javascript
const state = {
  numbers: [],           // Nilai kartu saat ini
  suits: [],             // Suit kartu saat ini
  originalNumbers: [],   // Nilai awal (untuk reset)
  originalSuits: [],     // Suit awal (untuk reset)
  selectedIdx: null,     // Index kartu pertama yang dipilih
  selectedOp: null,      // Operasi dipilih: '+', '−', '×', '÷'
  steps: [],             // Riwayat kalkulasi
  gamePhase: '',         // 'idle' | 'playing' | 'won' | 'lost'
  interactionPhase: ''   // 'select-first' | 'select-op' | 'select-second'
}
```

### Challenge Object (script.js — mode 24/36 saja)

```javascript
const challenge = {
  active: false,
  score: 0,
  timeLeft: 120,
  generateCooldown: 0,
  timerId: null,
  cooldownId: null
}
```

### Alur State Game

```
idle → playing (kartu dipilih pertama)
  → select-first → select-op → select-second
  → kalkulasi hasil
  → jika tersisa 1 kartu & = target → won
  → jika tidak ada solusi → lost
```

---

## Pola Firebase

Firebase config di-embed langsung di tiap HTML yang butuh real-time sync.
- Database path: `trial-error/24Card/`
- Battle: `trial-error/24Card/battle/{roomId}/`
- Duel: `trial-error/24Card/duel/{roomId}/`
- Poker: `trial-error/24Card/poker/{roomId}/` [WIP]
- Leaderboard: `trial-error/24Card/leaderboard/`

### Read Once (untuk load awal / cek keberadaan room)

```javascript
db.ref('path').once('value').then((snapshot) => {
  const data = snapshot.val();
  // handle data
});
```

### Real-Time Listener (untuk live sync)

```javascript
db.ref('path').on('value', (snap) => {
  const data = snap.val();
  // reactive update UI
});
```

### Struktur Room Battle di Firebase

```
battle/{roomId}:
  name: string
  mode: "24" | "36"
  status: "waiting" | "playing" | "finished"
  created: timestamp
  expired: timestamp (created + 3600000)
  players:
    {playerName}:
      status: "unready" | "ready"
      life: number
      successTs: number | null
  plays:
    {roundNum}:
      status: string
      numbers: array
      timestamp: number
```

> ⚠️ Nilai status pemain yang benar adalah **`"unready"`** (bukan `"undready"` — typo lama yang sudah diperbaiki di `battle.js`/`battle-room.js`/`battle-lobby.js`/`poker.js`/`poker-room.js`/`poker-lobby.js` dan class CSS `.status-unready` di `style-battle-mobile.css`). Jangan pakai `"undready"` lagi di mode baru.

### Room ID

- 4 digit angka (0000–9999)
- Dibuat via `randomRoomId()`, dicek unik via `generateUniqueRoomId()`
- Expired otomatis setelah 1 jam

---

## Pola UI Berulang

### DOM Shorthand (dipakai di hampir semua JS)

```javascript
const $ = (id) => document.getElementById(id);
```

### Overlay / Modal

```javascript
function showOverlay(el) { el.style.display = 'flex'; }
function hideOverlay(el) { el.style.display = 'none'; }
```

### Button Loading State

```javascript
btn.disabled = true;
btn.textContent = '⏳ Loading...';
// ... async operation ...
btn.disabled = false;
btn.textContent = 'Teks Asli';
```

### Input Error State

```javascript
if (!value) {
  errorEl.textContent = 'Pesan error dalam bahasa Indonesia';
  inputEl.style.borderColor = '#e57373';
  return;
}
```

### Kartu (Rendering)

- Suit menggunakan Unicode: ♠ ♥ ♦ ♣
- Merah: ♥ ♦ | Hitam: ♠ ♣
- Nilai "1" ditampilkan sebagai "A" di UI
- Tiap kartu punya: corner (nilai + suit) + center (nilai + suit)

### Warna Pemain (Battle Room)

```javascript
const colors = {
  bg: `hsla(${hue}, 55%, 45%, 0.25)`,
  border: `hsla(${hue}, 55%, 55%, 0.3)`,
  accent: `hsla(${hue}, 55%, 65%, 0.9)`
};
```
Setiap pemain dapat hue berbeda berdasarkan offset index.

---

## Sistem Skor Battle

File: `battle-score.js` → fungsi `calculateScores(players, roundTimestamp)`

- **Life awal:** 100
- **Pemain pertama solve:** 0 penalti
- **Solver berikutnya:** -2 base + -1 per 5 detik lebih lambat
- **Tidak solve:** `floor(jumlahPemain × -2.5)` penalti
- **Tidak ada yang solve:** semua dapat setengah penalti
- **Eliminasi:** life = 0

---

## Sistem Skor Duel

File: `duel-score.js` → fungsi `calculateDuelScores(host, enemy, roundTimestamp)`

- **Life awal:** 100
- **Waktu per ronde:** 30 detik
- **Keduanya tidak solve:** keduanya -5
- **Satu player solve dalam T detik:** lawan menerima `-(5 + ((30-T)/30) × 15)` → range **-5 s/d -20**; solver tidak kena penalti
- **Keduanya solve:** masing-masing menerima penalti dari waktu solve lawan
- **Game over:** player dengan life lebih tinggi menang; seri jika sama

### Struktur Room Duel di Firebase

```
duel/{roomId}:
  host: string
  enemy: string
  mode: "24" | "36"
  status: "waiting" | "play" | "finished"
  created: timestamp
  expired: timestamp
  players:
    {playerName}:
      life: number
      status: string
  plays:
    {roundNum}:
      status: "onprogress" | "done"
      numbers: string (e.g. "3♠,7♥,2♦,12♣")
      timestamp: number
      expired: number
      success:
        {playerName}: timestamp
      result:
        hostDealt: number
        enemyDealt: number
        hostFinalLife: number
        enemyFinalLife: number
  result:
    {playerName}:
      life: number
      rank: number
      role: "host" | "enemy"
```

### Alur Duel

```
duel-room.html (waiting) → host klik READY → status: 'play'
  → keduanya redirect ke duel-play.html
  → countdown ronde pertama (5 detik), berikutnya (3 detik)
  → 30 detik per ronde, siapa solve duluan → ronde langsung done
  → popup ronde selesai (host bisa lanjut atau akhiri)
  → salah satu life = 0 → showGameOver → tulis result + status: 'finished'
  → keduanya redirect ke duel-result.html
```

### Identifikasi Peran di duel-play.html

- URL host: `?roomId=XXXX&host=NAME`
- URL enemy: `?roomId=XXXX&enemy=NAME`
- `isHost = !!params.get('host')`
- Host = ♦ biru, Enemy = ♠ merah

---

## Mode Poker [WIP]

Mode baru bertema kartu poker (icon: `img/chip-poker-icon.png`, chip poker bergambar spade). Room system (create/join, max 6 player, min 2 player ready) di-clone 1:1 dari **Mode Battle**, hanya beda path Firebase dan tanpa mode-picker 24/36 (Poker cuma 1 varian).

### Struktur Room Poker di Firebase

```
poker/{roomId}:
  name: string
  status: "waiting" | "play"
  created: timestamp
  expired: timestamp (created + 3600000)
  players:
    {playerName}:
      status: "unready" | "ready"
      token: number   # default 5000, di-set saat host klik READY
```

Tidak ada field `mode` (beda dengan battle/duel) karena Poker belum punya varian aturan.

### Alur Poker (sejauh ini)

```
poker.html (pilih Host/Mobile)
  → Host: create/join room → poker-room.html (player grid, ready check, min 2 ready)
  → Mobile: join by ID / browse room → poker-lobby.html (toggle ready, listen status)
  → semua ready & host klik READY → players/{name}/token = 5000, status: 'play'
  → redirect ke poker-host.html (host) / poker-mobile.html (mobile) — BELUM DIBUAT
```

### Yang masih menyusul

- `poker-host.html` / `poker-host.js` — layar meja utama saat game berlangsung
- `poker-mobile.html` / `poker-mobile.js` — layar player saat game berlangsung
- `poker-result.html` / `poker-result.js` — hasil akhir
- Aturan main (giliran, taruhan, kombinasi kartu menang, dsb) — belum didefinisikan
- Nyawa pemain pakai istilah **`token`** (bukan `life`), default **5000**, bukan skor 0–100 seperti Battle/Duel

---

## CSS Design Tokens

```css
/* Background utama */
background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);

/* Glass-morphism container */
background: rgba(255, 255, 255, 0.07);
backdrop-filter: blur(16px);
border: 1px solid rgba(255, 255, 255, 0.1);

/* Warna aksen */
--gold: #ffd54f;
--error-red: #e57373;
--button-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
```

---

## Algoritma Solvability

Fungsi `isSolvable(nums, target)` di `script.js` dan `custom-mode.js`:
- Rekursif, mencoba semua kombinasi operasi (+, −, ×, ÷) pada semua pasangan angka
- Dipanggil setiap kali generate set kartu baru
- **Wajib dipakai** di mode baru apapun yang memerlukan generate kartu

---

## Aturan Konsistensi untuk Feature Baru

1. **File baru:** ikuti pola `nama-mode.html` + `nama-mode.js` + `style-nama-mode.css`. Class tampilan utama (title, subtitle, options, tombol besar) milik mode itu sendiri **wajib** ada di `style-nama-mode.css` sendiri — **jangan** pinjam class mode lain (mis. `.battle-title`, `.battle-btn`) walau visualnya kebetulan sama persis. Komponen generik lintas-mode (overlay, form, popup rules, tombol form) boleh tetap reuse dari `style-battle.css` (lihat pola `duel.html`).
2. **CSS baru:** selalu extend dari `style.css`, jangan override variabel global
3. **Firebase:** selalu pakai path `trial-error/24Card/{mode}/`
4. **Room system:** selalu gunakan 4-digit ID + expiry 1 jam
5. **Teks UI:** selalu dalam Bahasa Indonesia
6. **Async Firebase:** pakai `.then()/.catch()`, bukan `async/await` (konsisten dengan kode lama)
7. **State:** gunakan object `state` terpusat, bukan variabel terpisah
8. **Solvability:** setiap mode yang generate kartu wajib run `isSolvable()` sebelum set diterima
9. **Emojis di button:** ikon emoji diperbolehkan untuk label tombol (sudah jadi pola di proyek ini)
10. **Tidak ada framework:** tetap Vanilla JS, tidak ada React/Vue/dll
11. **Selalu update CLAUDE.md:** setiap ada perubahan/fitur/fix yang mengubah struktur file, konvensi, atau state proyek, dokumen ini **wajib** diupdate di commit/perubahan yang sama — supaya jadi track record proyek yang selalu akurat, bukan cuma dibaca sesekali.
