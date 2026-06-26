const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');
const playerName = params.get('name');

const countdownOverlay = document.getElementById('countdownOverlay');
const countdownNumber = document.getElementById('countdownNumber');
const mainContent = document.getElementById('mainContent');
const lifeContainer = document.getElementById('lifeContainer');

let countdownInterval = null;
let countdownActive = false;
let timerInterval = null;
const roundTimer = document.getElementById('roundTimer');
const cardsContainer = document.getElementById('cardsContainer');
const opsContainer = document.getElementById('opsContainer');
const stepsList = document.getElementById('stepsList');
const infoArea = document.getElementById('infoArea');
const btnReset = document.getElementById('btnReset');
const btnShuffle = document.getElementById('btnShuffle');
const ROUND_DURATION = 30000;

let gameNumbers = [];
let gameSuits = [];
let ogNumbers = [];
let ogSuits = [];
let selectedIdx = null;
let selectedOp = null;
let gameSteps = [];
let gamePhase = 'idle';
let interactPhase = 'select-first';
let gameTarget = 24;
let gameCardCount = 4;
let currentRound = null;

if (!roomId || !playerName) {
  mainContent.style.display = '';
} else {
  const playerRef = db.ref('trial-error/24Card/battle/' + roomId + '/players/' + playerName);

  playerRef.on('value', (snap) => {
    const data = snap.val();
    console.log('Player data:', data);
    if (!data) return;

    const life = data.life || 0;
    renderHearts(life);
  });

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
      mainContent.style.display = '';
      renderLatestRound(plays);
    } else if (!countdownActive) {
      startCountdown();
    }
  });

  const roomRef = db.ref('trial-error/24Card/battle/' + roomId);
  roomRef.once('value').then((snap) => {
    const data = snap.val();
    if (!data) return;
    const mode = data.mode || '24';
    gameTarget = mode === '36' ? 36 : 24;
    gameCardCount = mode === '36' ? 5 : 4;
    if (mode === '24' && cardsContainer) {
      cardsContainer.classList.add('grid-4');
    }
  });
}

function renderHearts(life) {
  if (!lifeContainer) return;
  lifeContainer.innerHTML = '';
  const totalHearts = 10;
  const full = Math.floor(life / 10);
  const remainder = life % 10;

  const svgNamespace = 'http://www.w3.org/2000/svg';
  const gradId = 'heartGrad_' + Date.now();

  for (let i = 0; i < totalHearts; i++) {
    const svg = document.createElementNS(svgNamespace, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '28');
    svg.setAttribute('height', '28');

    let fillColor;
    if (i < full) {
      fillColor = '#e53935';
    } else if (i === full && remainder > 0) {
      const pct = (remainder / 10) * 100;
      fillColor = 'url(#' + gradId + ')';

      const defs = document.createElementNS(svgNamespace, 'defs');
      const grad = document.createElementNS(svgNamespace, 'linearGradient');
      grad.setAttribute('id', gradId);
      grad.setAttribute('x1', '0%');
      grad.setAttribute('y1', '0%');
      grad.setAttribute('x2', '100%');
      grad.setAttribute('y2', '0%');

      const stop1 = document.createElementNS(svgNamespace, 'stop');
      stop1.setAttribute('offset', pct + '%');
      stop1.setAttribute('stop-color', '#e53935');
      const stop2 = document.createElementNS(svgNamespace, 'stop');
      stop2.setAttribute('offset', pct + '%');
      stop2.setAttribute('stop-color', 'rgba(255,255,255,0.15)');

      grad.appendChild(stop1);
      grad.appendChild(stop2);
      defs.appendChild(grad);
      svg.appendChild(defs);
    } else {
      fillColor = 'rgba(255,255,255,0.15)';
    }

    const path = document.createElementNS(svgNamespace, 'path');
    path.setAttribute('d', 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z');
    path.setAttribute('fill', fillColor);
    svg.appendChild(path);

    const heart = document.createElement('span');
    heart.className = 'heart';
    heart.appendChild(svg);
    lifeContainer.appendChild(heart);
  }
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
    }
  }, 1000);
}

function renderLatestRound(plays) {
  const roundNumbers = Object.keys(plays).map(Number).filter(n => !isNaN(n));
  if (roundNumbers.length === 0) return;

  const latestRound = Math.max(...roundNumbers);
  currentRound = latestRound;
  const roundData = plays[latestRound];

  if (roundData.success && roundData.success[playerName]) {
    roundTimer.style.display = '';
    roundTimer.innerHTML = '<div class="timer-goodjob">GOOD JOB</div>';
    gamePhase = 'idle';
    render();
    return;
  }

  if (roundData.status === 'onprogress') {
    const items = roundData.numbers.split(',');
    const numbers = items.map(item => parseInt(item));
    const suits = items.map(item => item.replace(/[0-9]/g, ''));
    initRound(numbers, suits);
    if (roundData.expired) {
      startRoundTimer(roundData.expired);
    }
  } else {
    roundTimer.style.display = '';
    roundTimer.innerHTML = '<div class="timer-circle expired"><span class="timer-circle-text">💣</span></div>';
    gamePhase = 'idle';
    render();
  }
}

function startRoundTimer(expired) {
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

function isRedSuit(suit) {
  return suit === '♥' || suit === '♦';
}

function cardLabel(n) {
  return n === 1 ? 'A' : String(n);
}

function formatNum(n) {
  return Number.isInteger(n) ? n.toString() : parseFloat(n.toFixed(4)).toString();
}

function calculate(a, op, b) {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '×': return a * b;
    case '÷': return b === 0 ? NaN : a / b;
    default: return NaN;
  }
}

function shufflePositions() {
  if (gamePhase !== 'playing') return;
  for (let k = gameNumbers.length - 1; k > 0; k--) {
    const l = Math.floor(Math.random() * (k + 1));
    [gameNumbers[k], gameNumbers[l]] = [gameNumbers[l], gameNumbers[k]];
    [gameSuits[k], gameSuits[l]] = [gameSuits[l], gameSuits[k]];
  }
}

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
  render();
}

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
    const op = selectedOp;
    const result = calculate(aVal, op, bVal);
    if (!isFinite(result) || isNaN(result)) {
      infoArea.textContent = '⚠️ Pembagian dengan nol!';
      infoArea.className = 'info info-error';
      return;
    }
    gameSteps.push({ a: formatNum(aVal), op, b: formatNum(bVal), result: formatNum(result) });
    const firstIdx = Math.min(selectedIdx, index);
    const secondIdx = Math.max(selectedIdx, index);
    gameNumbers.splice(secondIdx, 1);
    gameSuits.splice(secondIdx, 1);
    gameNumbers.splice(firstIdx, 1, result);
    selectedIdx = null;
    selectedOp = null;
    interactPhase = 'select-first';
    if (gameNumbers.length === 1) {
      const finalVal = gameNumbers[0];
      gamePhase = Math.abs(finalVal - gameTarget) < 0.0001 ? 'won' : 'lost';
      if (gamePhase === 'won') {
        if (currentRound && roomId && playerName) {
          const successRef = db.ref('trial-error/24Card/battle/' + roomId + '/plays/' + currentRound + '/success');
          successRef.update({ [playerName]: Date.now() }).catch(err => console.error(err));
        }
        if (timerInterval) {
          clearInterval(timerInterval);
          timerInterval = null;
        }
        roundTimer.style.display = '';
        roundTimer.innerHTML = '<div class="timer-goodjob">GOOD JOB</div>';
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

function resetGame() {
  if (gamePhase === 'idle') return;
  gameNumbers = [...ogNumbers];
  gameSuits = [...ogSuits];
  selectedIdx = null;
  selectedOp = null;
  gameSteps = [];
  gamePhase = 'playing';
  interactPhase = 'select-first';
  render();
}

function shuffleWithAnimation() {
  if (gamePhase !== 'playing') return;
  const cards = cardsContainer.querySelectorAll('.card');
  cards.forEach(c => c.classList.add('card-shuffling'));
  setTimeout(() => {
    shufflePositions();
    render();
  }, 500);
}

function render() {
  renderCards();
  renderOps();
  renderSteps();
  renderInfo();
  renderButtons();
}

function renderCards() {
  if (!cardsContainer) return;
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
  const isGameOver = gamePhase === 'won' || gamePhase === 'lost';
  gameNumbers.forEach((num, i) => {
    const suit = gameSuits[i];
    const label = cardLabel(num);
    const card = document.createElement('div');
    card.className = 'card ' + (isRedSuit(suit) ? 'suit-red' : 'suit-black');
    if (isGameOver) {
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
      </div>
    `;
    card.addEventListener('click', () => handleCardClick(i));
    cardsContainer.appendChild(card);
  });
}

function renderOps() {
  if (!opsContainer) return;
  const btns = opsContainer.querySelectorAll('.op-btn');
  btns.forEach((btn) => {
    const op = btn.dataset.op;
    const disabled = gamePhase !== 'playing' || interactPhase === 'select-first';
    btn.disabled = disabled;
    btn.classList.toggle('active', selectedOp === op && interactPhase === 'select-second');
  });
}

function renderSteps() {
  if (!stepsList) return;
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
  if (!infoArea) return;
  infoArea.className = 'info';
  if (gamePhase === 'idle') {
    infoArea.innerHTML = 'Menunggu host...';
    return;
  }
  if (gamePhase === 'won') {
    infoArea.className = 'info info-success';
    infoArea.textContent = `🎉 Selamat! Kamu berhasil membuat ${gameTarget}!`;
    return;
  }
  if (gamePhase === 'lost') {
    infoArea.className = 'info info-error';
    infoArea.textContent = `😞 Nilai akhir: ${formatNum(gameNumbers[0])}. Coba lagi!`;
    return;
  }
  if (interactPhase === 'select-first') {
    infoArea.textContent = 'Klik salah satu kartu untuk memulai';
  } else if (interactPhase === 'select-op') {
    const val = formatNum(gameNumbers[selectedIdx]);
    const suit = gameSuits[selectedIdx];
    infoArea.textContent = `Kartu ${val}${suit} dipilih. Pilih operasi (+, −, ×, ÷)`;
  } else if (interactPhase === 'select-second') {
    infoArea.textContent = `Pilih kartu kedua untuk ${selectedOp}`;
  }
}

function renderButtons() {
  if (!btnReset || !btnShuffle) return;
  btnReset.disabled = gamePhase !== 'playing';
  btnShuffle.disabled = gamePhase !== 'playing';
}

if (opsContainer) {
  opsContainer.querySelectorAll('.op-btn').forEach((btn) => {
    btn.addEventListener('click', () => handleOpClick(btn.dataset.op));
  });
}
if (btnReset) btnReset.addEventListener('click', resetGame);
if (btnShuffle) btnShuffle.addEventListener('click', shuffleWithAnimation);
