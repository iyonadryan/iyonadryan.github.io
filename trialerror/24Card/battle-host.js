const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');

document.getElementById('hostRoomId').textContent = roomId || '----';

const countdownOverlay = document.getElementById('countdownOverlay');
const countdownNumber = document.getElementById('countdownNumber');
const mainContent = document.getElementById('mainContent');
const nextRoundOverlay = document.getElementById('nextRoundOverlay');
const btnNextRound = document.getElementById('btnNextRound');

let countdownInterval = null;
let countdownActive = false;
let timerInterval = null;
const roundTimer = document.getElementById('roundTimer');
const successPlayers = document.getElementById('successPlayers');
const successPlayersGrid = document.getElementById('successPlayersGrid');
const ROUND_DURATION = 30000;
let lastRoundScores = null;

if (!roomId) {
  mainContent.style.display = '';
  document.getElementById('infoArea').textContent = '❌ Room ID tidak valid.';
} else {
  const playsRef = db.ref('trial-error/24Card/battle/' + roomId + '/plays');

  playsRef.on('value', (snap) => {
    const plays = snap.val();
    if (plays) {
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      countdownActive = false;
      countdownOverlay.style.display = 'none';
      nextRoundOverlay.style.display = 'none';
      mainContent.style.display = '';
      renderLatestRound(plays);
    } else if (!countdownActive) {
      startCountdown();
    }
  });

  btnNextRound.addEventListener('click', createEmptyRound);
  document.getElementById('btnEndGame').addEventListener('click', () => {
    window.location.href = 'room.html?roomId=' + roomId;
  });
}

function startCountdown() {
  countdownActive = true;
  let count = 5;

  function animateNum(n) {
    countdownNumber.className = 'countdown-number';
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
      countdownNumber.className = 'countdown-number go';
      countdownNumber.textContent = 'GO!';
      countdownNumber.style.animation = 'none';
      void countdownNumber.offsetWidth;
      countdownNumber.style.animation = 'countdownPulse 1s ease-in-out';
    } else {
      clearInterval(countdownInterval);
      countdownInterval = null;
      countdownActive = false;
      countdownOverlay.style.display = 'none';
      mainContent.style.display = '';
      createNewRound();
    }
  }, 1000);
}

function startNextRoundCountdown(round) {
  countdownActive = true;
  countdownOverlay.style.display = '';
  mainContent.style.display = 'none';
  let count = 3;

  function animateNum(n) {
    countdownNumber.className = 'countdown-number';
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
      countdownNumber.className = 'countdown-number go';
      countdownNumber.textContent = 'GO!';
      countdownNumber.style.animation = 'none';
      void countdownNumber.offsetWidth;
      countdownNumber.style.animation = 'countdownPulse 1s ease-in-out';
    } else {
      clearInterval(countdownInterval);
      countdownInterval = null;
      countdownActive = false;
      countdownOverlay.style.display = 'none';
      mainContent.style.display = '';
      fillRoundWithData(round);
    }
  }, 1000);
}

function renderLatestRound(plays) {
  const roundNumbers = Object.keys(plays).map(Number).filter(n => !isNaN(n));
  if (roundNumbers.length === 0) return;

  const latestRound = Math.max(...roundNumbers);
  const roundData = plays[latestRound];

  document.getElementById('roundNumber').textContent = latestRound;

  if (roundData.status === 'onprogress') {
    if (!roundData.numbers) {
      startNextRoundCountdown(latestRound);
      return;
    }
    const items = roundData.numbers.split(',');
    const numbers = items.map(item => parseInt(item));
    const suits = items.map(item => item.replace(/[0-9]/g, ''));
    renderCards(numbers, suits);
    renderSuccessPlayers(roundData);
    if (roundData.expired) {
      startRoundTimer(roundData.expired, latestRound);
    }
  } else {
    roundTimer.style.display = '';
    roundTimer.innerHTML = '<div class="timer-circle expired"><span class="timer-circle-text">💣</span></div>';
    renderSuccessPlayers(roundData);
    document.getElementById('lastRoundNumber').textContent = latestRound;

    if (roundData.numbers) {
      const items = roundData.numbers.split(',');
      const pNumbers = items.map(item => parseInt(item));
      const pSuits = items.map(item => item.replace(/[0-9]/g, ''));
      const popupContainer = document.getElementById('popupCards');
      popupContainer.innerHTML = '';
      pNumbers.forEach((num, i) => {
        const suit = pSuits[i] || '';
        const label = cardLabel(num);
        const card = document.createElement('div');
        card.className = 'popup-card';
        card.innerHTML = `<span class="popup-card-value">${label}</span><span class="popup-card-suit">${suit}</span>`;
        card.style.color = isRedSuit(suit) ? '#d32f2f' : '#1a1a2e';
        popupContainer.appendChild(card);
      });
    }

    const playersRef = db.ref('trial-error/24Card/battle/' + roomId + '/players');
    playersRef.once('value').then((snap) => {
      const pd = snap.val() || {};
      const players = Object.keys(pd).map(name => ({
        name,
        successTs: (roundData.success && roundData.success[name]) || null,
        life: (pd[name] && pd[name].life) || 0
      }));
      const scores = calculateScores(players, roundData.timestamp || Date.now());
      lastRoundScores = scores;
      renderScoreboard('scoreboardBody', scores);
      nextRoundOverlay.style.display = '';
    });
  }
}

function createEmptyRound() {
  nextRoundOverlay.style.display = 'none';
  const roomRef = db.ref('trial-error/24Card/battle/' + roomId);

  if (lastRoundScores) {
    const updates = {};
    lastRoundScores.forEach(p => {
      updates['players/' + p.name + '/life'] = p.newLife;
    });
    roomRef.update(updates).catch(err => console.error(err));
  }

  const playsRef = db.ref('trial-error/24Card/battle/' + roomId + '/plays');

  playsRef.once('value').then((playsSnap) => {
    const plays = playsSnap.val() || {};
    const roundNumbers = Object.keys(plays).map(Number).filter(n => !isNaN(n));
    const round = roundNumbers.length > 0 ? Math.max(...roundNumbers) + 1 : 1;

    document.getElementById('roundNumber').textContent = round;
    playsRef.child(String(round)).set({ status: 'onprogress' }).catch((err) => {
      console.error(err);
    });
  });
}

function fillRoundWithData(round) {
  const roomRef = db.ref('trial-error/24Card/battle/' + roomId);

  roomRef.once('value').then((snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    const mode = data.mode || '24';
    document.getElementById('hostModeDisplay').textContent = mode;

    const target = mode === '36' ? 36 : 24;
    const cardCount = mode === '36' ? 5 : 4;

    const numbers = generateSolvableNumbers(cardCount, target);
    const suits = generateSuits(cardCount);
    const now = Date.now();

    const combined = numbers.map((n, i) => n + suits[i]).join(',');
    const playsRef = db.ref('trial-error/24Card/battle/' + roomId + '/plays');
    playsRef.child(String(round)).update({
      numbers: combined,
      timestamp: now,
      expired: now + 30000
    }).catch((err) => {
      console.error(err);
      document.getElementById('infoArea').textContent = '❌ Gagal memulai ronde.';
    });
  });
}

function createNewRound() {
  const roomRef = db.ref('trial-error/24Card/battle/' + roomId);

  roomRef.once('value').then((snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    const mode = data.mode || '24';
    document.getElementById('hostModeDisplay').textContent = mode;

    const target = mode === '36' ? 36 : 24;
    const cardCount = mode === '36' ? 5 : 4;

    const playsRef = db.ref('trial-error/24Card/battle/' + roomId + '/plays');

    playsRef.once('value').then((playsSnap) => {
      const plays = playsSnap.val() || {};
      const roundNumbers = Object.keys(plays).map(Number).filter(n => !isNaN(n));
      const round = roundNumbers.length > 0 ? Math.max(...roundNumbers) + 1 : 1;

      document.getElementById('roundNumber').textContent = round;

      const numbers = generateSolvableNumbers(cardCount, target);
      const suits = generateSuits(cardCount);
      const now = Date.now();

      const combined = numbers.map((n, i) => n + suits[i]).join(',');
      playsRef.child(String(round)).set({
        numbers: combined,
        timestamp: now,
        expired: now + 30000,
        status: 'onprogress'
      }).catch((err) => {
        console.error(err);
        document.getElementById('infoArea').textContent = '❌ Gagal memulai ronde.';
      });
    });
  });
}

function getPlayerColor(index) {
  const hue = (index * 47 + 17) % 360;
  return {
    bg: `hsla(${hue}, 55%, 45%, 0.25)`,
    border: `hsla(${hue}, 55%, 55%, 0.3)`,
    accent: `hsla(${hue}, 55%, 65%, 0.9)`
  };
}

function renderSuccessPlayers(roundData) {
  if (!roundData.success) {
    successPlayers.style.display = 'none';
    return;
  }
  const names = Object.keys(roundData.success);
  if (names.length === 0) {
    successPlayers.style.display = 'none';
    return;
  }
  successPlayers.style.display = '';
  successPlayersGrid.innerHTML = '';
  names.sort((a, b) => (roundData.success[a] - roundData.timestamp) - (roundData.success[b] - roundData.timestamp));
  names.forEach((name, i) => {
    const colors = getPlayerColor(i);
    const playerTs = roundData.success[name];
    const roundTs = roundData.timestamp;
    const timeTaken = Math.round((playerTs - roundTs) / 1000);
    const slot = document.createElement('div');
    slot.className = 'success-player-slot';
    slot.style.cssText = `background:${colors.bg};border-color:${colors.border}`;
    slot.innerHTML = `
      <span class="success-player-name" style="color:${colors.accent}">${name}</span>
      <span class="success-player-time">${timeTaken} 🕓</span>
    `;
    successPlayersGrid.appendChild(slot);
  });
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
      const gradId = 'hGrad_' + i + '_' + Date.now();
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

function renderScoreboard(bodyId, scores) {
  const colors = ['#64b5f6', '#ffb74d', '#ce93d8', '#ef9a9a', '#81c784', '#a1887f'];
  const clockSvg = '<svg class="clock-icon" viewBox="0 0 24 24" width="12" height="12" stroke="#fff" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" stroke-linecap="round"/></svg>';
  const tbody = document.getElementById(bodyId);
  if (!tbody) return;
  tbody.innerHTML = '';
  scores.forEach((p, i) => {
    const timeHtml = p.timeTaken != null ? p.timeTaken + '  ' + clockSvg : '💣';
    const scoreColor = p.score === 0 ? '#66bb6a' : '#e57373';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-rank">${i + 1}</td>
      <td class="col-name" style="color:${colors[i % colors.length]};font-weight:700">${p.name}</td>
      <td class="col-time">${timeHtml}</td>
      <td class="col-score" style="color:${scoreColor}">${p.score}</td>
      <td class="col-life">${heartsHTML(p.newLife, 11)} ${p.newLife}</td>`;
    tbody.appendChild(tr);
  });
}

function startRoundTimer(expired, round) {
  roundTimer.style.display = '';
  roundTimer.innerHTML = `
    <div class="timer-circle">
      <span class="timer-circle-text" id="timerCircleText">30</span>
    </div>
    <div class="timer-bar-track">
      <div class="timer-bar-fill" id="timerBarFill">
        <span class="timer-bomb">💣</span>
      </div>
    </div>
  `;

  const circleText = document.getElementById('timerCircleText');
  const barFill = document.getElementById('timerBarFill');

  function tick() {
    const remaining = expired - Date.now();
    if (remaining <= 0) {
      roundTimer.innerHTML = '<div class="timer-circle expired"><span class="timer-circle-text">💣</span></div>';
      clearInterval(timerInterval);
      timerInterval = null;
      const playsRef = db.ref('trial-error/24Card/battle/' + roomId + '/plays');
      playsRef.child(String(round)).update({ status: 'done' }).catch(err => console.error(err));
      return;
    }
    const remainingSec = Math.ceil(remaining / 1000);
    const pct = Math.max(0, Math.min(100, (remaining / ROUND_DURATION) * 100));
    circleText.textContent = remainingSec;
    barFill.style.width = pct + '%';
  }

  tick();
  timerInterval = setInterval(tick, 200);
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
    for (let i = 0; i < count; i++) {
      nums.push(Math.floor(Math.random() * 10) + 1);
    }
    attempts++;
  } while (!isSolvable(nums, target) && attempts < 1000);
  return nums;
}

function generateSuits(count) {
  const allSuits = ['♠', '♥', '♦', '♣'];
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(allSuits[Math.floor(Math.random() * allSuits.length)]);
  }
  return result;
}

function isRedSuit(suit) {
  return suit === '♥' || suit === '♦';
}

function cardLabel(n) {
  return n === 1 ? 'A' : String(n);
}

function renderCards(numbers, suits) {
  const container = document.getElementById('cardsContainer');
  container.innerHTML = '';

  numbers.forEach((num, i) => {
    const suit = suits[i] || '';
    const label = cardLabel(num);
    const card = document.createElement('div');
    card.className = `card ${isRedSuit(suit) ? 'suit-red' : 'suit-black'}`;
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
      </div>
    `;
    container.appendChild(card);
  });
}
