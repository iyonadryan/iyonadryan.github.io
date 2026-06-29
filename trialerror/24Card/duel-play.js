const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');
const isHost = !!params.get('host');
const myName = params.get('host') || params.get('enemy') || '';

const $ = (id) => document.getElementById(id);

const countdownOverlay = $('countdownOverlay');
const countdownNumber = $('countdownNumber');
const mainContent = $('mainContent');
const roundTimer = $('roundTimer');
const cardsContainer = $('cardsContainer');
const opsContainer = $('opsContainer');
const stepsList = $('stepsList');
const infoArea = $('infoArea');
const btnReset = $('btnReset');
const btnShuffle = $('btnShuffle');
const roundDoneOverlay = $('roundDoneOverlay');

const ROUND_DURATION = 30000;

let countdownInterval = null;
let countdownActive = false;
let timerInterval = null;
let currentRoundId = 0;
let roundInitialized = false;
let roundEndTriggered = false;
let hasSolved = false;

let gameTarget = 24;
let gameCardCount = 4;
let gameMode = '24';
let hostName = '';
let enemyName = '';

// Per-round local game state
let gameNumbers = [];
let gameSuits = [];
let ogNumbers = [];
let ogSuits = [];
let selectedIdx = null;
let selectedOp = null;
let gameSteps = [];
let gamePhase = 'idle';
let interactPhase = 'select-first';

// ── Utility ──────────────────────────────────────────────

function isRedSuit(suit) { return suit === '♥' || suit === '♦'; }
function cardLabel(n) { return n === 1 ? 'A' : String(n); }
function formatNum(n) {
  return Number.isInteger(n) ? n.toString() : parseFloat(n.toFixed(4)).toString();
}

function isSolvable(nums, target) {
  if (nums.length === 1) return Math.abs(nums[0] - target) < 0.0001;
  for (let i = 0; i < nums.length; i++) {
    for (let j = 0; j < nums.length; j++) {
      if (i === j) continue;
      const rest = nums.filter((_, k) => k !== i && k !== j);
      const a = nums[i], b = nums[j];
      if (isSolvable([a + b, ...rest], target)) return true;
      if (isSolvable([a * b, ...rest], target)) return true;
      if (isSolvable([a - b, ...rest], target) || isSolvable([b - a, ...rest], target)) return true;
      if (b !== 0 && isSolvable([a / b, ...rest], target)) return true;
      if (a !== 0 && isSolvable([b / a, ...rest], target)) return true;
    }
  }
  return false;
}

function generateSolvableNumbers(count, target) {
  const nums = [];
  let attempts = 0;
  do {
    nums.length = 0;
    for (let i = 0; i < count; i++) nums.push(Math.floor(Math.random() * 10) + 1);
    attempts++;
  } while (!isSolvable(nums, target) && attempts < 1000);
  return nums;
}

function generateSuits(count) {
  const all = ['♠', '♥', '♦', '♣'];
  return Array.from({ length: count }, () => all[Math.floor(Math.random() * all.length)]);
}

function heartsHTML(life, size) {
  const total = 10;
  const full = Math.floor(life / 10);
  const remainder = life % 10;
  const s = size || 12;
  let html = '';
  for (let i = 0; i < total; i++) {
    let fill;
    if (i < full) {
      fill = '#e53935';
    } else if (i === full && remainder > 0) {
      const pct = (remainder / 10) * 100;
      const gradId = 'hGrad_' + i + '_' + life;
      fill = 'url(#' + gradId + ')';
      html += `<svg viewBox="0 0 24 24" width="${s}" height="${s}" style="vertical-align:middle;margin:0 1px">
        <defs><linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="${pct}%" stop-color="#e53935"/>
          <stop offset="${pct}%" stop-color="rgba(255,255,255,0.15)"/>
        </linearGradient></defs>
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="${fill}"/></svg>`;
      continue;
    } else {
      fill = 'rgba(255,255,255,0.15)';
    }
    html += `<svg viewBox="0 0 24 24" width="${s}" height="${s}" style="vertical-align:middle;margin:0 1px"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="${fill}"/></svg>`;
  }
  return html;
}

function calcResult(a, op, b) {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '×') return a * b;
  if (op === '÷') return b === 0 ? NaN : a / b;
  return NaN;
}

// ── Life display ─────────────────────────────────────────

function updateLifeDisplay(players) {
  const hLife = players[hostName] && players[hostName].life != null ? players[hostName].life : 100;
  const eLife = players[enemyName] && players[enemyName].life != null ? players[enemyName].life : 100;
  $('hostLifeValue').textContent = hLife;
  $('enemyLifeValue').textContent = eLife;
  $('hostLifeBar').style.width = Math.max(0, hLife) + '%';
  $('enemyLifeBar').style.width = Math.max(0, eLife) + '%';
}

// ── Render ────────────────────────────────────────────────

function renderCards() {
  cardsContainer.innerHTML = '';
  if (gameNumbers.length === 0) {
    for (let i = 0; i < gameCardCount; i++) {
      const card = document.createElement('div');
      card.className = 'card card-back';
      card.innerHTML = '<div class="card-back-inner"></div>';
      cardsContainer.appendChild(card);
    }
    return;
  }
  const isOver = gamePhase === 'won' || gamePhase === 'lost';
  gameNumbers.forEach((num, i) => {
    const suit = gameSuits[i];
    const label = cardLabel(num);
    const card = document.createElement('div');
    card.className = 'card ' + (isRedSuit(suit) ? 'suit-red' : 'suit-black');
    if (isOver) {
      card.classList.add(gamePhase === 'won' ? 'card-won' : 'card-lost');
      card.classList.add('card-disabled');
    } else if (selectedIdx === i && interactPhase !== 'select-first') {
      card.classList.add('card-selected');
    }
    card.innerHTML = `
      <div class="card-corner card-corner-top">
        <span class="corner-value">${label}</span>
        <span class="corner-suit">${suit}</span>
      </div>
      <div class="card-center">
        <span class="center-value">${label}</span>
        <span class="center-suit">${suit}</span>
      </div>
      <div class="card-corner card-corner-bottom">
        <span class="corner-suit">${suit}</span>
        <span class="corner-value">${label}</span>
      </div>`;
    card.addEventListener('click', () => handleCardClick(i));
    cardsContainer.appendChild(card);
  });
}

function renderOps() {
  const btns = opsContainer.querySelectorAll('.op-btn');
  btns.forEach((btn) => {
    const disabled = gamePhase !== 'playing' || interactPhase === 'select-first';
    btn.disabled = disabled;
    btn.classList.toggle('active', selectedOp === btn.dataset.op && interactPhase === 'select-second');
  });
}

function renderSteps() {
  stepsList.innerHTML = '';
  if (gameSteps.length === 0) {
    stepsList.innerHTML = '<div class="steps-empty">Belum ada langkah</div>';
    return;
  }
  gameSteps.forEach((step) => {
    const div = document.createElement('div');
    div.className = 'step-item';
    div.innerHTML = `${step.a} ${step.op} ${step.b} = <span class="step-result">${step.result}</span>`;
    stepsList.appendChild(div);
  });
}

function renderInfo() {
  infoArea.className = 'info';
  if (gamePhase === 'idle') {
    infoArea.textContent = 'Menunggu ronde dimulai...';
  } else if (gamePhase === 'won') {
    infoArea.className = 'info info-success';
    infoArea.textContent = `🎉 Berhasil membuat ${gameTarget}!`;
  } else if (gamePhase === 'lost') {
    infoArea.className = 'info info-error';
    infoArea.textContent = `😞 Tidak ada solusi. Nilai akhir: ${formatNum(gameNumbers[0])}`;
  } else if (interactPhase === 'select-first') {
    infoArea.textContent = 'Klik salah satu kartu untuk memulai';
  } else if (interactPhase === 'select-op') {
    const val = formatNum(gameNumbers[selectedIdx]);
    const suit = gameSuits[selectedIdx];
    infoArea.textContent = `Kartu ${val}${suit} dipilih. Pilih operasi`;
  } else {
    infoArea.textContent = `Pilih kartu kedua untuk ${selectedOp}`;
  }
}

function renderButtons() {
  btnReset.disabled = gamePhase === 'idle' || gamePhase === 'won';
  btnShuffle.disabled = gamePhase !== 'playing';
}

function render() {
  renderCards();
  renderOps();
  renderSteps();
  renderInfo();
  renderButtons();
}

// ── Game interaction ──────────────────────────────────────

function handleCardClick(index) {
  if (gamePhase !== 'playing') return;

  if (interactPhase === 'select-first') {
    selectedIdx = index;
    interactPhase = 'select-op';
    render();
    return;
  }

  if (interactPhase === 'select-op') {
    if (index === selectedIdx) {
      selectedIdx = null;
      interactPhase = 'select-first';
    } else {
      selectedIdx = index;
    }
    render();
    return;
  }

  if (interactPhase === 'select-second') {
    if (index === selectedIdx) {
      selectedOp = null;
      interactPhase = 'select-op';
      render();
      return;
    }
    const aVal = gameNumbers[selectedIdx];
    const bVal = gameNumbers[index];
    const result = calcResult(aVal, selectedOp, bVal);
    if (!isFinite(result) || isNaN(result)) {
      infoArea.textContent = '⚠️ Pembagian dengan nol!';
      infoArea.className = 'info info-error';
      return;
    }
    gameSteps.push({ a: formatNum(aVal), op: selectedOp, b: formatNum(bVal), result: formatNum(result) });
    const lo = Math.min(selectedIdx, index);
    const hi = Math.max(selectedIdx, index);
    gameNumbers.splice(hi, 1);
    gameSuits.splice(hi, 1);
    gameNumbers.splice(lo, 1, result);
    gameSuits.splice(lo, 1, '');
    selectedIdx = null;
    selectedOp = null;
    interactPhase = 'select-first';

    if (gameNumbers.length === 1) {
      gamePhase = Math.abs(gameNumbers[0] - gameTarget) < 0.0001 ? 'won' : 'lost';
      if (gamePhase === 'won') {
        onSolved();
        roundTimer.style.display = '';
        roundTimer.innerHTML = '<div class="timer-goodjob">GOOD JOB</div>';
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
      }
    }
    render();
  }
}

function handleOpClick(op) {
  if (gamePhase !== 'playing' || interactPhase !== 'select-op') return;
  selectedOp = op;
  interactPhase = 'select-second';
  render();
}

function onSolved() {
  if (hasSolved) return;
  hasSolved = true;
  db.ref('trial-error/24Card/duel/' + roomId + '/plays/' + currentRoundId + '/success/' + myName)
    .set(Date.now())
    .catch((err) => console.error(err));
}

function resetGame() {
  if (gamePhase === 'idle' || gamePhase === 'won') return;
  gameNumbers = [...ogNumbers];
  gameSuits = [...ogSuits];
  selectedIdx = null;
  selectedOp = null;
  gameSteps = [];
  gamePhase = 'playing';
  interactPhase = 'select-first';
  render();
}

function shufflePositions() {
  if (gamePhase !== 'playing') return;
  for (let k = gameNumbers.length - 1; k > 0; k--) {
    const l = Math.floor(Math.random() * (k + 1));
    [gameNumbers[k], gameNumbers[l]] = [gameNumbers[l], gameNumbers[k]];
    [gameSuits[k], gameSuits[l]] = [gameSuits[l], gameSuits[k]];
  }
}

function shuffleWithAnimation() {
  if (gamePhase !== 'playing') return;
  const cards = cardsContainer.querySelectorAll('.card');
  cards.forEach((c) => c.classList.add('card-shuffling'));
  setTimeout(() => {
    shufflePositions();
    render();
  }, 500);
}

// ── Init round ────────────────────────────────────────────

function initRound(numbers, suits) {
  ogNumbers = [...numbers];
  ogSuits = [...suits];
  gameNumbers = [...numbers];
  gameSuits = [...suits];
  selectedIdx = null;
  selectedOp = null;
  gameSteps = [];
  gamePhase = 'playing';
  interactPhase = 'select-first';
  hasSolved = false;
  render();
}

// ── Round timer ───────────────────────────────────────────

function startRoundTimer(expired, round) {
  if (timerInterval) clearInterval(timerInterval);
  roundTimer.style.display = '';
  roundTimer.innerHTML = `
    <div class="timer-circle">
      <span class="timer-circle-text" id="timerCircleText">30</span>
    </div>
    <div class="timer-bar-track">
      <div class="timer-bar-fill" id="timerBarFill">
        <span class="timer-bomb">💣</span>
      </div>
    </div>`;

  const circleText = $('timerCircleText');
  const barFill = $('timerBarFill');

  function tick() {
    const remaining = expired - Date.now();
    if (remaining <= 0) {
      roundTimer.innerHTML = '<div class="timer-circle expired"><span class="timer-circle-text">💣</span></div>';
      clearInterval(timerInterval);
      timerInterval = null;
      if (isHost) endRound(round);
      return;
    }
    circleText.textContent = Math.ceil(remaining / 1000);
    barFill.style.width = Math.max(0, Math.min(100, (remaining / ROUND_DURATION) * 100)) + '%';
  }

  tick();
  timerInterval = setInterval(tick, 200);
}

// ── Round end (host only) ─────────────────────────────────

function endRound(round) {
  const roundRef = db.ref('trial-error/24Card/duel/' + roomId + '/plays/' + round);

  roundRef.once('value').then((snap) => {
    const roundData = snap.val();
    if (!roundData || roundData.status === 'done') return;

    const success = roundData.success || {};
    const ts = roundData.timestamp || 0;

    return db.ref('trial-error/24Card/duel/' + roomId + '/players').once('value').then((pSnap) => {
      const players = pSnap.val() || {};
      const hLife = players[hostName] && players[hostName].life != null ? players[hostName].life : 100;
      const eLife = players[enemyName] && players[enemyName].life != null ? players[enemyName].life : 100;

      const duelResult = calculateDuelScores(
        { name: hostName,  life: hLife, successTs: success[hostName]  || null },
        { name: enemyName, life: eLife, successTs: success[enemyName] || null },
        ts
      );

      const hostFinalLife  = duelResult.host.newLife;
      const enemyFinalLife = duelResult.enemy.newLife;
      // score positif = 0 (tidak kena penalti), negatif = penalti
      const hostDealt  = -duelResult.enemy.score; // damage yang host kasih ke enemy
      const enemyDealt = -duelResult.host.score;  // damage yang enemy kasih ke host

      const updates = {};
      updates['plays/' + round + '/status'] = 'done';
      updates['plays/' + round + '/result'] = { hostDealt, enemyDealt, hostFinalLife, enemyFinalLife };
      updates['players/' + hostName  + '/life'] = hostFinalLife;
      updates['players/' + enemyName + '/life'] = enemyFinalLife;
      return db.ref('trial-error/24Card/duel/' + roomId).update(updates);
    });
  }).catch((err) => console.error(err));
}

// ── Round done overlay ────────────────────────────────────

function showRoundDone(roundData, round) {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  roundTimer.style.display = 'none';

  $('doneRoundNum').textContent = round;

  const success = roundData.success || {};
  const ts = roundData.timestamp || 0;
  const result = roundData.result || {};

  const hostSolveTs = success[hostName] || null;
  const enemySolveTs = success[enemyName] || null;
  const hostTimeSec = hostSolveTs ? ((hostSolveTs - ts) / 1000).toFixed(1) : null;
  const enemyTimeSec = enemySolveTs ? ((enemySolveTs - ts) / 1000).toFixed(1) : null;

  const hostDealt = result.hostDealt || 0;
  const enemyDealt = result.enemyDealt || 0;
  const hostFinalLife = result.hostFinalLife != null ? result.hostFinalLife : '?';
  const enemyFinalLife = result.enemyFinalLife != null ? result.enemyFinalLife : '?';

  // hLifeNum = life akhir HOST, eLifeNum = life akhir ENEMY
  const hLifeNum = typeof hostFinalLife  === 'number' ? hostFinalLife  : 0;
  const eLifeNum = typeof enemyFinalLife === 'number' ? enemyFinalLife : 0;

  // Penalti yang DITERIMA tiap player (bukan yang diberikan)
  // enemyDealt = damage yang enemy berikan ke HOST → penalti yang host terima
  // hostDealt  = damage yang host berikan ke ENEMY → penalti yang enemy terima
  const hostPenalty  = enemyDealt; // penalti yang diterima host
  const enemyPenalty = hostDealt;  // penalti yang diterima enemy

  const clockSvg = '<svg class="clock-icon" viewBox="0 0 24 24" width="12" height="12" stroke="#fff" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" stroke-linecap="round"/></svg>';

  const hostTimeHtml  = hostTimeSec  !== null ? `${hostTimeSec}  ${clockSvg}` : '💣';
  const enemyTimeHtml = enemyTimeSec !== null ? `${enemyTimeSec}  ${clockSvg}` : '💣';

  const hostScoreColor  = hostPenalty  > 0 ? '#e57373' : '#66bb6a';
  const enemyScoreColor = enemyPenalty > 0 ? '#e57373' : '#66bb6a';

  const youBadge = '<span class="you-badge">YOU</span>';

  let html = '';
  html += `<div class="duel-round-result-row">
    <div class="duel-result-player">
      <span class="duel-result-name duel-result-blue">♦ ${hostName}${myName === hostName ? youBadge : ''}</span>
      <span class="duel-result-time">${hostTimeHtml}</span>
    </div>
    <span class="duel-result-score ${hostPenalty > 0 ? 'dealt' : 'safe'}">-${hostPenalty}</span>
    <span class="duel-result-life">${heartsHTML(hLifeNum, 11)} ${hLifeNum}</span>
  </div>`;
  html += `<div class="duel-round-result-row">
    <div class="duel-result-player">
      <span class="duel-result-name duel-result-red">♠ ${enemyName}${myName === enemyName ? youBadge : ''}</span>
      <span class="duel-result-time">${enemyTimeHtml}</span>
    </div>
    <span class="duel-result-score ${enemyPenalty > 0 ? 'dealt' : 'safe'}">-${enemyPenalty}</span>
    <span class="duel-result-life">${heartsHTML(eLifeNum, 11)} ${eLifeNum}</span>
  </div>`;

  $('roundResultContent').innerHTML = html;

  const gameOver = (typeof hostFinalLife === 'number' && hostFinalLife <= 0) ||
                   (typeof enemyFinalLife === 'number' && enemyFinalLife <= 0);
  if (gameOver) {
    roundDoneOverlay.style.display = 'none';
    showGameOver();
    return;
  }

  $('hostControls').style.display = isHost ? '' : 'none';
  $('enemyWaiting').style.display = isHost ? 'none' : '';
  roundDoneOverlay.style.display = '';
}

function showGameOver() {
  if (!isHost) return;

  db.ref('trial-error/24Card/duel/' + roomId + '/players').once('value').then((pSnap) => {
    const players = pSnap.val() || {};
    const hLife = players[hostName]  && players[hostName].life  != null ? players[hostName].life  : 0;
    const eLife = players[enemyName] && players[enemyName].life != null ? players[enemyName].life : 0;

    let hostRank, enemyRank;
    if (hLife > eLife)      { hostRank = 1; enemyRank = 2; }
    else if (eLife > hLife) { enemyRank = 1; hostRank = 2; }
    else                    { hostRank = 1; enemyRank = 1; }

    const result = {};
    result[hostName]  = { life: hLife, rank: hostRank,  role: 'host' };
    result[enemyName] = { life: eLife, rank: enemyRank, role: 'enemy' };

    return db.ref('trial-error/24Card/duel/' + roomId).update({ status: 'finished', result: result });
  }).catch((err) => console.error(err));
}

// ── Next round (host) ─────────────────────────────────────

function createNextRound() {
  roundDoneOverlay.style.display = 'none';
  const playsRef = db.ref('trial-error/24Card/duel/' + roomId + '/plays');
  playsRef.once('value').then((snap) => {
    const plays = snap.val() || {};
    const roundNums = Object.keys(plays).map(Number).filter((n) => !isNaN(n));
    const nextRound = roundNums.length > 0 ? Math.max(...roundNums) + 1 : 1;
    return playsRef.child(String(nextRound)).set({ status: 'onprogress' });
  }).catch((err) => console.error(err));
}

// ── Countdown ─────────────────────────────────────────────

function startCountdown(from) {
  if (countdownActive) return;
  countdownActive = true;
  countdownOverlay.style.display = '';
  mainContent.style.display = 'none';
  let count = from || 5;

  function animateNum(n, extraClass) {
    countdownNumber.className = 'countdown-number' + (extraClass ? ' ' + extraClass : '');
    countdownNumber.textContent = String(n);
    countdownNumber.style.animation = 'none';
    void countdownNumber.offsetWidth;
    countdownNumber.style.animation = 'countdownPulse 1s ease-in-out';
  }

  animateNum(count);

  countdownInterval = setInterval(() => {
    count--;
    if (count > 0) {
      animateNum(count);
    } else if (count === 0) {
      animateNum('GO!', 'go');
    } else {
      clearInterval(countdownInterval);
      countdownInterval = null;
      countdownActive = false;
      countdownOverlay.style.display = 'none';
      mainContent.style.display = '';
      if (isHost) fillRoundWithCards(currentRoundId);
    }
  }, 1000);
}

function fillRoundWithCards(round) {
  const numbers = generateSolvableNumbers(gameCardCount, gameTarget);
  const suits = generateSuits(gameCardCount);
  const now = Date.now();
  const combined = numbers.map((n, i) => n + suits[i]).join(',');
  db.ref('trial-error/24Card/duel/' + roomId + '/plays/' + round).update({
    numbers: combined,
    timestamp: now,
    expired: now + ROUND_DURATION
  }).catch((err) => console.error(err));
}

// ── Firebase listeners ────────────────────────────────────

function boot() {
  if (!roomId || !myName) {
    countdownOverlay.style.display = 'none';
    mainContent.style.display = '';
    infoArea.textContent = '❌ Parameter tidak valid.';
    return;
  }

  db.ref('trial-error/24Card/duel/' + roomId).once('value').then((snap) => {
    const data = snap.val();
    if (!data) {
      countdownOverlay.style.display = 'none';
      mainContent.style.display = '';
      infoArea.textContent = '❌ Room tidak ditemukan.';
      return;
    }

    hostName = data.host || '';
    enemyName = data.enemy || '';
    gameMode = data.mode || '24';
    gameTarget = gameMode === '36' ? 36 : 24;
    gameCardCount = gameMode === '36' ? 5 : 4;

    $('hostNameDisplay').textContent = hostName;
    $('enemyNameDisplay').textContent = enemyName;
    $('modeDisplay').textContent = 'Mode ' + gameMode;

    if (myName === hostName) $('hostNameDisplay').classList.add('is-me');
    else $('enemyNameDisplay').classList.add('is-me');

    // Mode 24 → 4 kartu sejajar 1 baris; mode 36 → default 3+2
    if (gameMode === '24') cardsContainer.classList.add('grid-4');

    // Status listener — redirect keduanya saat game selesai
    db.ref('trial-error/24Card/duel/' + roomId + '/status').on('value', (sSnap) => {
      if (sSnap.val() === 'finished') {
        window.location.href = 'duel-result.html?roomId=' + roomId + '&name=' + encodeURIComponent(myName);
      }
    });

    // Life listener
    db.ref('trial-error/24Card/duel/' + roomId + '/players').on('value', (pSnap) => {
      updateLifeDisplay(pSnap.val() || {});
    });

    // Plays listener
    const playsRef = db.ref('trial-error/24Card/duel/' + roomId + '/plays');

    playsRef.on('value', (snap) => {
      const plays = snap.val();

      if (!plays) {
        if (isHost && !countdownActive) {
          playsRef.child('1').set({ status: 'onprogress' }).catch((err) => console.error(err));
        }
        return;
      }

      const roundNums = Object.keys(plays).map(Number).filter((n) => !isNaN(n));
      if (roundNums.length === 0) return;

      const latestRound = Math.max(...roundNums);
      const roundData = plays[latestRound];

      // New round detected — reset local state
      if (latestRound !== currentRoundId) {
        currentRoundId = latestRound;
        roundInitialized = false;
        roundEndTriggered = false;
        hasSolved = false;
        roundDoneOverlay.style.display = 'none';
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        roundTimer.style.display = 'none';
      }

      $('roundNumber').textContent = latestRound;

      if (roundData.status === 'onprogress') {
        if (!roundData.numbers) {
          if (!countdownActive && !roundInitialized) startCountdown(latestRound === 1 ? 5 : 3);
        } else {
          if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
          countdownActive = false;
          countdownOverlay.style.display = 'none';
          mainContent.style.display = '';

          if (!roundInitialized) {
            roundInitialized = true;
            const items = roundData.numbers.split(',');
            const numbers = items.map((item) => parseInt(item));
            const suits = items.map((item) => item.replace(/[0-9]/g, ''));
            initRound(numbers, suits);
            if (roundData.expired) startRoundTimer(roundData.expired, latestRound);
          }

          // Segera akhiri ronde saat ada yang solve
          if (isHost && !roundEndTriggered && roundData.success && Object.keys(roundData.success).length > 0) {
            roundEndTriggered = true;
            if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
            endRound(latestRound);
          }
        }
      } else if (roundData.status === 'done') {
        if (roundDoneOverlay.style.display === 'none' || !roundDoneOverlay.style.display) {
          if ($('gameOverOverlay').style.display === '') return;
          showRoundDone(roundData, latestRound);
        }
      }
    });

  }).catch((err) => {
    console.error(err);
    countdownOverlay.style.display = 'none';
    mainContent.style.display = '';
    infoArea.textContent = '❌ Gagal memuat room.';
  });
}

// ── Button listeners ──────────────────────────────────────

if (opsContainer) {
  opsContainer.querySelectorAll('.op-btn').forEach((btn) => {
    btn.addEventListener('click', () => handleOpClick(btn.dataset.op));
  });
}
btnReset.addEventListener('click', resetGame);
btnShuffle.addEventListener('click', shuffleWithAnimation);

$('btnNextRound').addEventListener('click', createNextRound);

$('btnEndDuel').addEventListener('click', () => {
  roundDoneOverlay.style.display = 'none';
  db.ref('trial-error/24Card/duel/' + roomId + '/players').once('value').then((snap) => {
    const players = snap.val() || {};
    const hLife = players[hostName] && players[hostName].life != null ? players[hostName].life : 0;
    const eLife = players[enemyName] && players[enemyName].life != null ? players[enemyName].life : 0;
    showGameOver();
  }).catch((err) => console.error(err));
});

// ── Start ─────────────────────────────────────────────────

boot();
