const MODE = document.body.dataset.mode || '24';
const CARD_COUNT = MODE === '36' ? 5 : 4;
const TARGET = MODE === '36' ? 36 : 24;

const state = {
  numbers: [],
  suits: [],
  originalNumbers: [],
  originalSuits: [],
  selectedIdx: null,
  selectedOp: null,
  steps: [],
  gamePhase: 'idle',
  interactionPhase: 'select-first'
};

const challenge = {
  active: false,
  score: 0,
  timeLeft: 120,
  generateCooldown: 0,
  timerId: null,
  cooldownId: null
};

const $ = (id) => document.getElementById(id);
const cardsContainer = $('cardsContainer');
const opsContainer = $('opsContainer');
const stepsList = $('stepsList');
const infoArea = $('infoArea');
const btnGenerate = $('btnGenerate');
const btnReset = $('btnReset');
const btnChallenge = $('btnChallenge');
const btnShuffle = $('btnShuffle');
const challengeHeader = $('challengeHeader');
const timerDisplay = $('timerDisplay');
const scoreDisplay = $('scoreDisplay');
const overlayInstructions = $('instructionsOverlay');
const overlayCountdown = $('countdownOverlay');
const overlayResult = $('resultOverlay');
const countdownNumber = $('countdownNumber');
const resultScore = $('resultScore');
const saveScoreForm = $('saveScoreForm');
const nicknameInput = $('nicknameInput');
const btnSaveScore = $('btnSaveScore');

function generateSuits(count) {
  const allSuits = ['♠', '♥', '♦', '♣'];
  if (count === 4) {
    const s = [...allSuits];
    for (let i = s.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [s[i], s[j]] = [s[j], s[i]];
    }
    return s;
  }
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

function isSolvable(nums) {
  if (nums.length === 1) return Math.abs(nums[0] - TARGET) < 0.0001;
  for (let i = 0; i < nums.length; i++) {
    for (let j = 0; j < nums.length; j++) {
      if (i === j) continue;
      const rest = nums.filter((_, k) => k !== i && k !== j);
      const a = nums[i], b = nums[j];
      if (isSolvable([a + b, ...rest])) return true;
      if (isSolvable([a * b, ...rest])) return true;
      if (isSolvable([a - b, ...rest]) || isSolvable([b - a, ...rest])) return true;
      if (b !== 0 && isSolvable([a / b, ...rest])) return true;
      if (a !== 0 && isSolvable([b / a, ...rest])) return true;
    }
  }
  return false;
}

function generateNumbers() {
  const nums = [];
  let attempts = 0;
  do {
    nums.length = 0;
    for (let i = 0; i < CARD_COUNT; i++) {
      nums.push(Math.floor(Math.random() * 10) + 1);
    }
    attempts++;
  } while (!isSolvable(nums) && attempts < 1000);
  const suits = generateSuits(CARD_COUNT);
  state.originalNumbers = [...nums];
  state.originalSuits = [...suits];
  state.numbers = [...nums];
  state.suits = [...suits];
  state.selectedIdx = null;
  state.selectedOp = null;
  state.steps = [];
  state.gamePhase = 'playing';
  state.interactionPhase = 'select-first';
  render();
}

function resetGame() {
  if (!challenge.active && state.gamePhase === 'idle') return;
  state.numbers = [...state.originalNumbers];
  state.suits = [...state.originalSuits];
  state.selectedIdx = null;
  state.selectedOp = null;
  state.steps = [];
  state.gamePhase = 'playing';
  state.interactionPhase = 'select-first';
  render();
}

function calculate(a, op, b) {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '×': return a * b;
    case '÷':
      if (b === 0) return NaN;
      return a / b;
    default: return NaN;
  }
}

function formatNum(n) {
  return Number.isInteger(n) ? n.toString() : parseFloat(n.toFixed(4)).toString();
}

function handleCardClick(index) {
  if (state.gamePhase !== 'playing') return;
  if (state.interactionPhase === 'select-first') {
    state.selectedIdx = index;
    state.interactionPhase = 'select-op';
    render();
    return;
  }
  if (state.interactionPhase === 'select-op') {
    if (index === state.selectedIdx) {
      state.selectedIdx = null;
      state.interactionPhase = 'select-first';
    } else {
      state.selectedIdx = index;
    }
    render();
    return;
  }
  if (state.interactionPhase === 'select-second') {
    if (index === state.selectedIdx) {
      state.selectedOp = null;
      state.interactionPhase = 'select-op';
      render();
      return;
    }
    const aVal = state.numbers[state.selectedIdx];
    const bVal = state.numbers[index];
    const op = state.selectedOp;
    const result = calculate(aVal, op, bVal);

    if (!isFinite(result) || isNaN(result)) {
      infoArea.textContent = '⚠️ Hasil tidak valid (pembagian dengan nol)!';
      infoArea.className = 'info info-error';
      return;
    }

    state.steps.push({
      a: formatNum(aVal),
      op,
      b: formatNum(bVal),
      result: formatNum(result)
    });

    const firstIdx = Math.min(state.selectedIdx, index);
    const secondIdx = Math.max(state.selectedIdx, index);
    state.numbers.splice(secondIdx, 1);
    state.suits.splice(secondIdx, 1);
    state.numbers.splice(firstIdx, 1, result);

    state.selectedIdx = null;
    state.selectedOp = null;
    state.interactionPhase = 'select-first';

    if (state.numbers.length === 1) {
      const finalVal = state.numbers[0];
      if (Math.abs(finalVal - TARGET) < 0.0001) {
        if (challenge.active) {
          challenge.score++;
          updateScoreDisplay();
          startGenerateCooldown();
          generateNumbers();
          return;
        }
        state.gamePhase = 'won';
      } else {
        if (challenge.active) {
          generateNumbers();
          return;
        }
        state.gamePhase = 'lost';
      }
    }

    render();
  }
}

function handleOpClick(op) {
  if (state.gamePhase !== 'playing') return;
  if (state.interactionPhase !== 'select-op') return;
  state.selectedOp = op;
  state.interactionPhase = 'select-second';
  render();
}

function render() {
  renderCards();
  renderOps();
  renderSteps();
  renderInfo();
  renderButtons();
}

function renderCards() {
  cardsContainer.innerHTML = '';
  if (state.numbers.length === 0) {
    for (let i = 0; i < CARD_COUNT; i++) {
      const card = document.createElement('div');
      card.className = 'card card-back';
      card.innerHTML = '<div class="card-back-inner"></div>';
      cardsContainer.appendChild(card);
    }
    return;
  }
  const isGameOver = state.gamePhase === 'won' || state.gamePhase === 'lost';
  state.numbers.forEach((num, i) => {
    const suit = state.suits[i];
    const label = cardLabel(num);
    const card = document.createElement('div');
    card.className = `card ${isRedSuit(suit) ? 'suit-red' : 'suit-black'}`;
    if (isGameOver) {
      card.classList.add(state.gamePhase === 'won' ? 'card-won' : 'card-lost');
      card.classList.add('card-disabled');
    } else if (state.selectedIdx === i && state.interactionPhase !== 'select-first') {
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
  const btns = opsContainer.querySelectorAll('.op-btn');
  btns.forEach((btn) => {
    const op = btn.dataset.op;
    const disabled = state.gamePhase !== 'playing' || state.interactionPhase === 'select-first';
    btn.disabled = disabled;
    btn.classList.toggle('active', state.selectedOp === op && state.interactionPhase === 'select-second');
  });
}

function renderSteps() {
  stepsList.innerHTML = '';
  if (state.steps.length === 0) {
    stepsList.innerHTML = '<div class="steps-empty">Belum ada langkah</div>';
    return;
  }
  state.steps.forEach((step) => {
    const div = document.createElement('div');
    div.className = 'step-item';
    const line = `${step.a} ${step.op} ${step.b} = <span class="step-result">${step.result}</span>`;
    div.innerHTML = line;
    stepsList.appendChild(div);
  });
}

function renderInfo() {
  infoArea.className = 'info';
  if (state.gamePhase === 'idle') {
    infoArea.innerHTML = 'Klik <strong>Generate</strong> untuk memulai!';
    return;
  }
  if (state.gamePhase === 'won') {
    infoArea.className = 'info info-success';
    infoArea.textContent = `🎉 Selamat! Kamu berhasil membuat ${TARGET}!`;
    return;
  }
  if (state.gamePhase === 'lost') {
    infoArea.className = 'info info-error';
    infoArea.textContent = `😞 Nilai akhir: ${formatNum(state.numbers[0])}. Coba lagi!`;
    return;
  }
  if (state.interactionPhase === 'select-first') {
    infoArea.textContent = 'Klik salah satu kartu untuk memulai';
  } else if (state.interactionPhase === 'select-op') {
    const val = formatNum(state.numbers[state.selectedIdx]);
    const suit = state.suits[state.selectedIdx];
    infoArea.textContent = `Kartu ${val}${suit} dipilih. Pilih operasi (+, −, ×, ÷)`;
  } else if (state.interactionPhase === 'select-second') {
    infoArea.textContent = `Pilih kartu kedua untuk ${state.selectedOp}`;
  }
}

function renderButtons() {
  if (challenge.active) {
    btnGenerate.disabled = challenge.generateCooldown > 0;
    btnGenerate.textContent = challenge.generateCooldown > 0
      ? `🔒 ${challenge.generateCooldown}s`
      : '🎲 Ganti';
    btnReset.disabled = false;
    btnShuffle.disabled = false;
    btnChallenge.style.display = 'none';
    return;
  }
  btnGenerate.textContent = state.gamePhase === 'idle' ? '🎲 Generate' : '🎲 Generate Ulang';
  btnReset.disabled = state.gamePhase === 'idle';
  btnShuffle.disabled = state.gamePhase !== 'playing';
  btnChallenge.style.display = '';
}

function showOverlay(el) {
  el.style.display = 'flex';
}

function hideOverlay(el) {
  el.style.display = 'none';
}

function updateTimerDisplay() {
  const mins = Math.floor(challenge.timeLeft / 60);
  const secs = challenge.timeLeft % 60;
  timerDisplay.textContent = `⏱️ ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  timerDisplay.classList.toggle('warning', challenge.timeLeft <= 30);
}

function updateScoreDisplay() {
  scoreDisplay.textContent = `⭐ ${challenge.score}`;
}

function updateGenerateButton() {
  btnGenerate.disabled = challenge.generateCooldown > 0;
  btnGenerate.textContent = challenge.generateCooldown > 0
    ? `🔒 ${challenge.generateCooldown}s`
    : '🎲 Ganti';
}

function startGenerateCooldown() {
  if (challenge.cooldownId) clearInterval(challenge.cooldownId);
  challenge.generateCooldown = 10;
  updateGenerateButton();
  challenge.cooldownId = setInterval(() => {
    challenge.generateCooldown--;
    if (challenge.generateCooldown <= 0) {
      clearInterval(challenge.cooldownId);
      challenge.cooldownId = null;
      btnGenerate.textContent = '🎲 Ganti';
      btnGenerate.disabled = false;
    } else {
      btnGenerate.textContent = `🔒 ${challenge.generateCooldown}s`;
    }
  }, 1000);
}

function startTimer() {
  updateTimerDisplay();
  challenge.timerId = setInterval(() => {
    challenge.timeLeft--;
    updateTimerDisplay();
    if (challenge.timeLeft <= 0) {
      endChallenge();
    }
  }, 1000);
}

function startChallenge() {
  challenge.active = false;
  challenge.score = 0;
  challenge.timeLeft = 120;
  challenge.generateCooldown = 0;
  showOverlay(overlayInstructions);
}

function onChallengeReady() {
  hideOverlay(overlayInstructions);
  showOverlay(overlayCountdown);
  document.getElementById('btnChallengeReady').disabled = true;

  let count = 5;
  countdownNumber.className = 'countdown-number';
  countdownNumber.textContent = String(count);
  countdownNumber.style.animation = 'none';
  void countdownNumber.offsetWidth;
  countdownNumber.style.animation = 'countdownPulse 1s ease-in-out';

  const ci = setInterval(() => {
    count--;
    if (count > 0) {
      countdownNumber.className = 'countdown-number';
      countdownNumber.textContent = String(count);
      countdownNumber.style.animation = 'none';
      void countdownNumber.offsetWidth;
      countdownNumber.style.animation = 'countdownPulse 1s ease-in-out';
    } else if (count === 0) {
      countdownNumber.className = 'countdown-number go';
      countdownNumber.textContent = 'GO!';
      countdownNumber.style.animation = 'none';
      void countdownNumber.offsetWidth;
      countdownNumber.style.animation = 'countdownPulse 1s ease-in-out';
    } else {
      clearInterval(ci);
      hideOverlay(overlayCountdown);
      document.getElementById('btnChallengeReady').disabled = false;
      beginChallenge();
    }
  }, 1000);
}

function beginChallenge() {
  challenge.active = true;
  challengeHeader.style.display = 'flex';
  btnChallenge.style.display = 'none';
  startGenerateCooldown();
  generateNumbers();
  startTimer();
  updateScoreDisplay();
}

function endChallenge() {
  challenge.active = false;
  if (challenge.timerId) {
    clearInterval(challenge.timerId);
    challenge.timerId = null;
  }
  if (challenge.cooldownId) {
    clearInterval(challenge.cooldownId);
    challenge.cooldownId = null;
  }
  challengeHeader.style.display = 'none';
  btnChallenge.style.display = '';
  state.numbers = [];
  state.suits = [];
  state.originalNumbers = [];
  state.originalSuits = [];
  state.selectedIdx = null;
  state.selectedOp = null;
  state.steps = [];
  state.gamePhase = 'idle';
  state.interactionPhase = 'select-first';
  render();
  resultScore.textContent = challenge.score;
  const starsContainer = $('resultStars');
  starsContainer.innerHTML = '';
  for (let i = 0; i < challenge.score; i++) {
    const star = document.createElement('span');
    star.className = 'result-star';
    star.textContent = '★';
    star.style.animationDelay = `${i * 0.08}s`;
    starsContainer.appendChild(star);
  }
  showOverlay(overlayResult);
  if (saveScoreForm) {
    const starCount = challenge.score;
    const starDuration = starCount * 0.08 + 0.3;
    setTimeout(() => {
      saveScoreForm.style.display = 'flex';
    }, starDuration * 1000 + 300);
  }
}

function onChallengeRetry() {
  hideOverlay(overlayResult);
  if (saveScoreForm) saveScoreForm.style.display = 'none';
  if (nicknameInput) nicknameInput.value = '';
  startChallenge();
}

function saveScoreToFirebase() {
  if (!nicknameInput) return;
  const nickname = nicknameInput.value.trim();
  if (!nickname) {
    nicknameInput.style.borderColor = '#e57373';
    nicknameInput.placeholder = 'Nickname tidak boleh kosong!';
    return;
  }
  nicknameInput.style.borderColor = '';
  const path = `trial-error/24Card/${MODE}Mode/${nickname}`;
  db.ref(path).set({
    score: challenge.score,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  }).then(() => {
    window.location.href = 'leaderboard-score.html';
  }).catch(err => {
    console.error(err);
    alert('Gagal menyimpan score. Coba lagi.');
  });
}

function shufflePositions() {
  if (state.gamePhase !== 'playing') return;
  for (let k = state.numbers.length - 1; k > 0; k--) {
    const l = Math.floor(Math.random() * (k + 1));
    [state.numbers[k], state.numbers[l]] = [state.numbers[l], state.numbers[k]];
    [state.suits[k], state.suits[l]] = [state.suits[l], state.suits[k]];
  }
}

function shuffleWithAnimation() {
  if (state.gamePhase !== 'playing') return;
  const cards = cardsContainer.querySelectorAll('.card');
  cards.forEach(c => c.classList.add('card-shuffling'));
  setTimeout(() => {
    shufflePositions();
    render();
  }, 500);
}

if (btnChallenge) {
  btnChallenge.addEventListener('click', startChallenge);
}
if ($('btnChallengeReady')) {
  $('btnChallengeReady').addEventListener('click', onChallengeReady);
}
if ($('btnChallengeCancel')) {
  $('btnChallengeCancel').addEventListener('click', () => hideOverlay(overlayInstructions));
}
if ($('btnResultRetry')) {
  $('btnResultRetry').addEventListener('click', onChallengeRetry);
}

if (btnSaveScore) {
  btnSaveScore.addEventListener('click', saveScoreToFirebase);
}

opsContainer.querySelectorAll('.op-btn').forEach((btn) => {
  btn.addEventListener('click', () => handleOpClick(btn.dataset.op));
});

btnGenerate.addEventListener('click', () => {
  if (challenge.active) {
    startGenerateCooldown();
  }
  generateNumbers();
});

btnReset.addEventListener('click', resetGame);

btnShuffle.addEventListener('click', shuffleWithAnimation);

render();
