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
├── poker.html               # Pilihan mode poker (host/mobile)
├── poker-room.html         # Room host poker — daftar pemain
├── poker-lobby.html        # Lobby mobile player poker
├── poker-host.html         # Meja utama Poker (Texas Hold'em) saat game berlangsung
├── poker-mobile.html       # Layar player Poker (hole cards + aksi taruhan)
├── poker-result.html       # Hasil akhir Poker (podium + ranking token)
├── leaderboard-score.html  # Top 25 skor
├── style.css               # Global styles (dipakai semua halaman)
├── style-battle.css        # Battle-specific styles
├── style-battle-mobile.css # Mobile player styles
├── style-battle-room.css   # Room waiting styles
├── style-battle-result.css # Result page styles
├── style-duel.css          # Duel mode styles
├── style-duel-room.css     # Duel room styles
├── style-duel-play.css     # Duel play styles
├── style-poker.css          # Poker mode-select styles
├── style-poker-host.css     # Meja Poker (community card, seat pemain)
├── style-poker-mobile.css   # Layar player Poker (hole card, tombol aksi taruhan)
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
├── poker.js                 # Poker navigation & room creation
├── poker-room.js            # Host room management poker
├── poker-lobby.js           # Mobile lobby poker
├── poker-rule.js             # Engine kombinasi kartu Poker (hand ranking, 5–10 tier)
├── poker-host.js             # Engine + render meja Poker (Texas Hold'em) — otoritas game state
├── poker-mobile.js           # Render player Poker + kirim aksi taruhan
├── poker-result.js           # Render hasil akhir Poker (podium + tabel ranking)
└── leaderboard-score.js    # Leaderboard rendering
```

> **Status Poker:** mode-select, host-room, mobile-lobby, gameplay Texas Hold'em penuh (deal, blind, giliran, bet/raise/call/fold/all-in, showdown), dan hasil akhir (`poker-result.html`) **semua sudah jalan**. Lihat [Mode Poker](#mode-poker) di bawah untuk detail engine, Firebase schema, & simplifikasi yang diambil.

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
| poker-lobby.html | style-battle-mobile.css *(reuse langsung — halaman ready-check sebelum game mulai, layoutnya masih sama kayak battle-lobby)* |
| poker-host.html | style-poker-host.css *(layout meja Poker: community card + seat pemain, sama sekali beda dari battle-host, jadi tidak reuse style-battle.css)* |
| poker-mobile.html | style-poker-mobile.css *(layout hole card + tombol taruhan, beda dari `poker-lobby.html` walau namanya mirip — jangan ketuker: `poker-lobby.html`+`style-battle-mobile.css` = layar ready-check, `poker-mobile.html`+`style-poker-mobile.css` = layar main sungguhan)* |
| poker-result.html | style-battle.css + style-battle-result.css *(WAJIB dua-duanya — `.scoreboard-table th/td` punya text-color ada di style-battle.css, bukan di style-battle-result.css; lupa include ini bikin header tabel "Rank/Name/Token" kebaca hitam gak ke-lihat di background gelap, kejadian nyata pas review pertama)* |

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
| Poker Card | Gameplay Texas Hold'em jalan penuh | Lihat [Mode Poker](#mode-poker) |
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
- Poker: `trial-error/24Card/poker/{roomId}/`
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

### Loading Screen Poker (chip bouncing)

Dipakai di `poker-host.html`/`poker-mobile.html` selagi nunggu snapshot Firebase pertama (ganti pola teks polos `⏳ Memuat...` yang dipakai battle/duel):

```css
@keyframes pokerChipBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-18px); }
}
.poker-loading-icon { animation: pokerChipBounce 0.8s ease-in-out infinite; }
```

```html
<div id="loadingScreen" class="poker-loading">
  <img src="img/chip-poker-icon.png" class="poker-loading-icon" alt="">
  <p>Memuat...</p>
</div>
```

Blok CSS ini di-duplikasi kecil di `style-poker-host.css` dan `style-poker-mobile.css` (bukan taruh di `style.css` global) karena ini pola visual spesifik Poker, bukan pattern lintas-mode.

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

## Mode Poker

Mode kartu Poker **Texas Hold'em** (icon: `img/chip-poker-icon.png`). Room system (create/join, max 6 player, min 2 player ready) di-clone 1:1 dari **Mode Battle**, hanya beda path Firebase dan tanpa mode-picker 24/36 (Poker cuma 1 varian). Gameplay-nya (deal, blind, giliran, taruhan, showdown) murni implementasi baru, tidak ada di mode lain.

### Kombinasi Kartu (poker-rule.js)

Engine hand-ranking generik (dipakai host untuk showdown), lihat isi file untuk detail penuh:

- Urutan terendah→tertinggi: `HIGH_CARD, DOUBLE (pair), TWO_PAIR, TRIPLE (three of a kind), STRIKE (straight, termasuk wheel A-2-3-4-5), FLUSH, FULL_HOUSE, FOUR_OF_A_KIND, STRAIGHT_FLUSH, ROYAL_FLUSH`.
- `evaluateHand(cards5)` → `{ rank, rankName, tiebreakers, cards }`. `compareHands(a, b)` bandingin rank → tiebreaker (kicker) → **suit** (lihat house-rule di bawah).
- `getBestHand(cards)` → cari 5 kartu terbaik dari >5 kartu (dipakai showdown Hold'em: 2 hole + 5 community = 7 kartu).
- `findWinners(players)` → nama pemenang (bisa lebih dari satu HANYA kalau 5 kartu-nya identik persis, mis. sama-sama "main board" — lihat house-rule suit di bawah).
- `createDeck()` / `shuffleDeck()`, `getCardImagePath(card)` → `img/cards/{rank}{suit}.png`, `getCardBackImagePath()` → `img/back/red-card.png`.
- `runPokerRuleSelfTest()` di console browser buat re-verifikasi kalau ada perubahan di engine ini.
- `HAND_RANK_SAMPLES` + `renderHandRankPreview()` — data & renderer buat popup petunjuk visual (dipakai bareng oleh `poker.html` Info Mode dan `poker-lobby.html` Petunjuk, jangan duplikasi lagi ke masing-masing file kayak sebelumnya).

> ⚠️ **House-rule suit tiebreak (BUKAN aturan poker resmi):** kalau `rank` DAN semua `tiebreakers` dua hand persis sama, `compareHands()` masih lanjut bandingin **suit** kartu (urutan `SUIT_RANK`: ♣ < ♦ < ♥ < ♠, konvensi bridge) dari kartu tertinggi ke terendah. Poker asli di titik ini harusnya seri & pot dibagi rata — proyek ini SENGAJA nambah tiebreak ini supaya showdown selalu punya 1 pemenang tunggal (konsisten sama simplifikasi "single pot, no side-pot"). `findWinners()` cuma balikin >1 nama kalau 5 kartu-nya bener2 identik (suit sama juga) — praktisnya cuma kejadian di skenario "main board" (semua pemain pakai 5 community card apa adanya).

### Struktur Room Poker di Firebase

```
poker/{roomId}:
  name: string
  status: "waiting" | "play"
  created, expired: timestamp
  players:
    {playerName}:
      status: "unready" | "ready"   # cuma dipakai fase lobby
      token: number                  # default 5000, di-set saat host klik READY di poker-room.html
      seat: number                   # assigned sekali (alfabetis) saat hand pertama, permanen dipakai buat urutan giliran
      inHand: boolean                # dapat kartu di hand berjalan ini?
      folded: boolean
      allIn: boolean
      bet: number                    # chip yang sudah masuk di betting round SAAT INI (reset tiap street)
      holeCards: [{rank,suit}, {rank,suit}] | null
      lastAction: string | null      # label buat ditampilkan di seat host, mis. "Call 25", "Raise 100"
  game:
    handNumber: number
    stage: "preflop" | "flop" | "turn" | "river" | "showdown" | "handover"
    deck: [{rank,suit}, ...]         # sisa kartu belum dibagi
    communityCards: [{rank,suit}, ...]  # nambah progresif: 0 → 3 (flop) → 4 (turn) → 5 (river)
    pot: number
    currentBet: number               # nilai bet yang harus di-match di street ini
    minRaise: number                 # increment minimal buat raise sah
    dealerSeat, sbSeat, bbSeat, turnSeat: number
    actedSeats: number[]             # seat yang udah act & match currentBet di street ini
    pendingAction: { seat, name, type, amount, ts } | null
    winners: string[] | null
    winningHandLabel: string | null
  result:                            # ditulis sekali oleh finishGame() saat game selesai
    {playerName}:
      token: number                  # token akhir saat game diselesaikan
      rank: number                   # 1 = juara, descending by token, seri = rank sama
```

> ⚠️ **Gotcha Firebase RTDB:** array kosong (`[]`) yang ditulis ke DB **hilang jadi `undefined`** pas dibaca ulang (RTDB memangkas node kosong). `actedSeats`/`communityCards` sering di-reset ke `[]` tiap street baru, jadi di `poker-host.js` selalu dinormalisasi ulang (`game.actedSeats = game.actedSeats || []`) sebelum dipakai. Ini bug nyata yang kejadian pas testing E2E pertama kali — kalau nambah field array baru yang bisa kosong, wajib pola normalisasi yang sama.

### Alur Poker

```
poker.html (pilih Host/Mobile)
  → Host: create/join room → poker-room.html (player grid, ready check, min 2 ready)
  → Mobile: join by ID / browse room → poker-lobby.html (toggle ready, listen status)
  → semua ready & host klik READY → players/{name}/token = 5000, status: 'play'
  → Host redirect ke poker-host.html, Mobile redirect ke poker-mobile.html

Di poker-host.html:
  → klik "Mulai Permainan" → dealNewHand() → shuffle 52 kartu, assign seat (sekali, alfabetis),
    rotate dealer, post small/big blind, deal 2 hole card/player, stage='preflop'
  → dengar game/pendingAction (ditulis player dari poker-mobile.html) → applyAction() →
    validasi giliran (seat === turnSeat) → proses fold/check/call/bet/raise/allin →
    cek betting round selesai → advanceStage() (flop→turn→river) atau resolveShowdown()
  → showdown: getBestHand() tiap player + findWinners() → bagi pot, reveal semua hole card yang gak fold
  → klik "Ronde Berikutnya" → dealNewHand() lagi (dealer geser ke seat aktif berikutnya)
  → game selesai lewat DUA jalur, keduanya panggil finishGame() yang sama:
    1. Otomatis: cuma tersisa 1 player dengan token > 0 setelah hand selesai → tombol "Ronde Berikutnya"
       diganti "🏆 Lihat Hasil Akhir" (langsung panggil finishGame(), tanpa popup konfirmasi)
    2. Manual: tombol "🏁 Selesaikan Permainan" (selalu tampil begitu ada `game`, bisa dipencet
       kapan saja termasuk di tengah hand) → popup konfirmasi → finishGame()
  → finishGame() tulis poker/{roomId}/result/{name} = {token, rank} (rank descending by token,
    seri = rank sama) + status:'finished', lalu redirect host ke poker-result.html?roomId=

Di poker-mobile.html:
  → render hole card sendiri (default kartu ditutup, tombol "👁 Lihat Kartu" toggle lokal, TIDAK ditulis ke Firebase)
  → kalau game/turnSeat === seat sendiri → tampil tombol aksi grid 2×2 (Fold+Check/Call baris atas,
    Bet/Raise+All In baris bawah — poker-action-allin SENGAJA tidak span 2 kolom biar rapi)
  → klik aksi → tulis game/pendingAction (host yang proses & clear lagi)
  → dengar room status — kalau 'finished', tampilkan overlay inline (finishedOverlay) berisi rank &
    token akhir sendiri, TIDAK redirect ke poker-result.html (beda dari host; pola ini nyontek
    battle-mobile.js yang juga cuma overlay inline, bukan redirect kayak duel-play.js)

Di poker.html (popup Info Mode) DAN poker-lobby.html (popup Petunjuk) — kontennya sengaja dibikin
IDENTIK di kedua tempat (biar user paham aturan baik dari layar pilih Host/Mobile maupun pas nunggu
di lobby), render daftar 10 tingkatan kombinasi kartu (High Card → Royal Flush) LENGKAP dengan:
  - contoh 5 kartu asli per tingkatan (pakai getCardImagePath() dari poker-rule.js, lihat
    HAND_RANK_SAMPLES + renderHandRankPreview() — keduanya di poker-rule.js, dipanggil dari
    poker.js dan poker-lobby.js, JANGAN duplikasi ulang ke masing-masing file)
  - deskripsi singkat tiap tingkatan (mis. "Full House — Triple + Double sekaligus")
  - efek glow kuning (box-shadow) di kartu yang BENERAN bagian dari kombinasi (`highlight`
    index array per entry), kartu sisanya di-dim opacity 0.5 — biar user langsung paham kartu
    mana yang "kepake" tanpa baca teks
  - urutan simbol/suit (♣ < ♦ < ♥ < ♠) buat jelasin house-rule tiebreak di atas
  - penjelasan arti tombol aksi taruhan (Fold/Check/Call/Bet/Raise/All In) dengan badge warna
    yang match sama warna tombol asli di poker-mobile.html
```

### Aturan Blind & Giliran

- Small blind = 25, big blind = 50 (`SMALL_BLIND`/`BIG_BLIND` di `poker-host.js`, tetap/tidak naik).
- **Heads-up (2 player):** dealer = small blind, dealer act duluan preflop (aturan poker standar).
- **3+ player:** SB = seat setelah dealer, BB = setelah SB, first-to-act preflop = setelah BB (UTG). Post-flop, first-to-act = SB (atau seat aktif berikutnya kalau SB sudah fold/all-in).
- Round taruhan selesai kalau semua `actableSeats` (belum fold, belum all-in) sudah ada di `actedSeats` DAN `bet`-nya match `currentBet`. Termasuk kasus "BB option" (BB tetap dapat giliran meski semua orang cuma call).
- Kalau tersisa ≤1 `actableSeats` (sisanya all-in semua) → sisa community card langsung di-deal semua tanpa nunggu aksi, lanjut ke showdown ("run it out").

### Simplifikasi versi pertama (sengaja, demi scope)

- **Single pot saja** — belum ada side-pot buat all-in dengan stack timpang (kalau 3+ player dan salah satu all-in duluan dengan chip lebih sedikit, dia tetap ikut "menang" dari seluruh pot gabungan, bukan cuma porsi yang dia sanggup match). Aman buat head-up (2 player), tapi bisa nggak akurat kalau 3+ player.
- Blind tetap, tidak naik seiring waktu/ronde (belum ada struktur tournament).
- Tanpa auto-fold/timeout giliran — sesuai permintaan, tidak ada countdown di mode ini.

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
