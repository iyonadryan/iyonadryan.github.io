let CUSTOM_TARGET = 24;
let CUSTOM_CARD_COUNT = 4;

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

const $ = (id) => document.getElementById(id);
const cardsContainer = $('cardsContainer');
const opsContainer = $('opsContainer');
const stepsList = $('stepsList');
const infoArea = $('infoArea');
const btnGenerate = $('btnGenerate');
const btnReset = $('btnReset');
const btnShuffle = $('btnShuffle');
const setupScreen = $('setupScreen');
const gameScreen = $('gameScreen');
const inputTarget = $('inputTarget');
const inputCardCount = $('inputCardCount');
const setupError = $('setupError');
const gameTargetInfo = $('gameTargetInfo');
const impossibleOverlay = $('impossibleOverlay');

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

function startGame() {
  const target = parseInt(inputTarget.value);
  const count = parseInt(inputCardCount.value);

  setupError.textContent = '';

  if (isNaN(target) || target < 1 || target > 100) {
    setupError.textContent = '⚠️ Target harus di antara 1 - 100';
    return;
  }
  if (isNaN(count) || count < 2 || count > 10) {
    setupError.textContent = '⚠️ Jumlah kartu harus di antara 2 - 10';
    return;
  }

  CUSTOM_TARGET = target;
  CUSTOM_CARD_COUNT = count;

  cardsContainer.classList.remove('grid-4');
  if (count === 4 || count === 8 || count === 10) {
    cardsContainer.classList.add('grid-4');
  }

  setupScreen.style.display = 'none';
  gameScreen.style.display = '';
  gameTargetInfo.textContent = `Gabungkan ${count} angka menjadi ${target}!`;

  generateNumbers();
}

function generateNumbers() {
  const nums = [];
  let attempts = 0;
  do {
    nums.length = 0;
    for (let i = 0; i < CUSTOM_CARD_COUNT; i++) {
      nums.push(Math.floor(Math.random() * 10) + 1);
    }
    attempts++;
    if (attempts > 10000) {
      impossibleOverlay.style.display = 'flex';
      return;
    }
  } while (!isSolvable(nums, CUSTOM_TARGET));

  const suits = generateSuits(CUSTOM_CARD_COUNT);
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
  if (state.gamePhase === 'idle') return;
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
if (CUSTOM_CARD_COUNT === 4 || CUSTOM_CARD_COUNT === 8 || CUSTOM_CARD_COUNT === 10) {
  cardsContainer.classList.add('grid-4');
}
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
      if (Math.abs(finalVal - CUSTOM_TARGET) < 0.0001) {
        state.gamePhase = 'won';
      } else {
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
    for (let i = 0; i < CUSTOM_CARD_COUNT; i++) {
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
    infoArea.textContent = `🎉 Selamat! Kamu berhasil membuat ${CUSTOM_TARGET}!`;
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
  btnGenerate.textContent = state.gamePhase === 'idle' ? '🎲 Generate' : '🎲 Generate Ulang';
  btnReset.disabled = state.gamePhase === 'idle';
  btnShuffle.disabled = state.gamePhase !== 'playing';
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

$('btnStartCustom').addEventListener('click', startGame);
$('btnImpossibleRetry').addEventListener('click', () => {
  impossibleOverlay.style.display = 'none';
  setupScreen.style.display = '';
  gameScreen.style.display = 'none';
});

[inputTarget, inputCardCount].forEach(inp => {
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startGame();
  });
});

opsContainer.querySelectorAll('.op-btn').forEach((btn) => {
  btn.addEventListener('click', () => handleOpClick(btn.dataset.op));
});

btnGenerate.addEventListener('click', generateNumbers);
btnReset.addEventListener('click', resetGame);
btnShuffle.addEventListener('click', shuffleWithAnimation);

if (CUSTOM_CARD_COUNT === 4 || CUSTOM_CARD_COUNT === 8 || CUSTOM_CARD_COUNT === 10) {
  cardsContainer.classList.add('grid-4');
}
render();
