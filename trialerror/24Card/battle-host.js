const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');

document.getElementById('hostRoomId').textContent = roomId || '----';

const countdownOverlay = document.getElementById('countdownOverlay');
const countdownNumber = document.getElementById('countdownNumber');
const mainContent = document.getElementById('mainContent');

let countdownInterval = null;

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
      countdownOverlay.style.display = 'none';
      mainContent.style.display = '';
      renderLatestRound(plays);
    } else if (!mainContent.style.display) {
      startCountdown();
    }
  });
}

function startCountdown() {
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
      countdownOverlay.style.display = 'none';
      mainContent.style.display = '';
      createNewRound();
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
    const numbers = roundData.numbers.split(',').map(Number);
    const suits = roundData.suits ? roundData.suits.split(',') : [];
    renderCards(numbers, suits);
  }
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

      playsRef.child(String(round)).set({
        numbers: numbers.join(','),
        suits: suits.join(','),
        timestamp: now,
        status: 'onprogress'
      }).catch((err) => {
        console.error(err);
        document.getElementById('infoArea').textContent = '❌ Gagal memulai ronde.';
      });
    });
  });
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
