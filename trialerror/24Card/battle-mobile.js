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
const ROUND_DURATION = 30000;

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
    if (data && data.mode === '24' && cardsContainer) {
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
  const roundData = plays[latestRound];

  if (roundData.status === 'onprogress') {
    const items = roundData.numbers.split(',');
    const numbers = items.map(item => parseInt(item));
    const suits = items.map(item => item.replace(/[0-9]/g, ''));
    renderCards(numbers, suits);
    if (roundData.expired) {
      startRoundTimer(roundData.expired);
    }
  } else {
    roundTimer.style.display = '';
    roundTimer.innerHTML = '<div class="timer-circle expired"><span class="timer-circle-text">💣</span></div>';
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

function renderCards(numbers, suits) {
  const container = document.getElementById('cardsContainer');
  if (container) {
    container.innerHTML = '';
    numbers.forEach((num, i) => {
      const suit = suits[i] || '';
      const label = cardLabel(num);
      const card = document.createElement('div');
      card.className = 'card ' + (isRedSuit(suit) ? 'suit-red' : 'suit-black');
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
}
