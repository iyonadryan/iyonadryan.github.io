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
├── leaderboard-score.html  # Top 25 skor
├── style.css               # Global styles (dipakai semua halaman)
├── style-battle.css        # Battle-specific styles
├── style-battle-mobile.css # Mobile player styles
├── style-battle-room.css   # Room waiting styles
├── style-battle-result.css # Result page styles
├── style-duel.css          # Duel mode styles
├── style-duel-room.css     # Duel room styles
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
└── leaderboard-score.js    # Leaderboard rendering
```

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
      status: string
      life: number
      successTs: number | null
  plays:
    {roundNum}:
      status: string
      numbers: array
      timestamp: number
```

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

1. **File baru:** ikuti pola `nama-mode.html` + `nama-mode.js` + `style-nama-mode.css`
2. **CSS baru:** selalu extend dari `style.css`, jangan override variabel global
3. **Firebase:** selalu pakai path `trial-error/24Card/{mode}/`
4. **Room system:** selalu gunakan 4-digit ID + expiry 1 jam
5. **Teks UI:** selalu dalam Bahasa Indonesia
6. **Async Firebase:** pakai `.then()/.catch()`, bukan `async/await` (konsisten dengan kode lama)
7. **State:** gunakan object `state` terpusat, bukan variabel terpisah
8. **Solvability:** setiap mode yang generate kartu wajib run `isSolvable()` sebelum set diterima
9. **Emojis di button:** ikon emoji diperbolehkan untuk label tombol (sudah jadi pola di proyek ini)
10. **Tidak ada framework:** tetap Vanilla JS, tidak ada React/Vue/dll
