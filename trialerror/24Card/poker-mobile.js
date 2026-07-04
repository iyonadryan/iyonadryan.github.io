const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');
const playerName = params.get('name');

const BET_STEP = 50;

const STAGE_LABELS = {
  preflop: 'Pre-Flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
  handover: 'Ronde Selesai'
};

const loadingScreen = document.getElementById('loadingScreen');
const gameContent = document.getElementById('gameContent');
const myNameEl = document.getElementById('myName');
const myTokenEl = document.getElementById('myToken');
const statusText = document.getElementById('statusText');
const mobileCommunity = document.getElementById('mobileCommunity');
const mobilePot = document.getElementById('mobilePot');
const mobileToCall = document.getElementById('mobileToCall');
const holeCardsRow = document.getElementById('holeCardsRow');
const btnToggleCards = document.getElementById('btnToggleCards');
const turnBanner = document.getElementById('turnBanner');
const actionButtons = document.getElementById('actionButtons');
const betAmountInput = document.getElementById('betAmountInput');
const btnBetMinus = document.getElementById('btnBetMinus');
const btnBetPlus = document.getElementById('btnBetPlus');
const btnFold = document.getElementById('btnFold');
const btnCheckCall = document.getElementById('btnCheckCall');
const btnBetRaise = document.getElementById('btnBetRaise');
const btnAllIn = document.getElementById('btnAllIn');
const foldedBanner = document.getElementById('foldedBanner');
const showdownBanner = document.getElementById('showdownBanner');

let cardsVisible = false;
let currentMe = null;
let currentGame = null;
let currentToCall = 0;
let actionsLocked = false;

if (!roomId || !playerName) {
  document.querySelector('.poker-mobile-screen').innerHTML = `
    <p style="color:rgba(255,255,255,0.5);text-align:center;padding:60px 0">
      ❌ Data tidak lengkap. <a href="index.html" style="color:#667eea">Kembali ke menu</a>
    </p>
  `;
} else {
  myNameEl.textContent = playerName;
  const roomRef = db.ref('trial-error/24Card/poker/' + roomId);
  const finishedOverlay = document.getElementById('finishedOverlay');
  const finishedResult = document.getElementById('finishedResult');
  const finishedEmoji = document.getElementById('finishedEmoji');

  roomRef.on('value', (snap) => {
    const data = snap.val();
    if (!data) return;
    loadingScreen.style.display = 'none';

    if (data.status === 'finished') {
      gameContent.style.display = 'none';
      finishedOverlay.style.display = '';
      const myResult = data.result && data.result[playerName];
      if (myResult) {
        finishedEmoji.textContent = myResult.rank === 1 ? '🏆' : '🏁';
        finishedResult.textContent = `Kamu finish di posisi #${myResult.rank} dengan ${myResult.token} token.`;
      } else {
        finishedResult.textContent = 'Permainan telah diselesaikan oleh host.';
      }
      return;
    }

    gameContent.style.display = '';
    render(data);
  }, (err) => {
    console.error(err);
    loadingScreen.innerHTML = '<p>❌ Gagal memuat data room.</p>';
  });

  btnToggleCards.addEventListener('click', () => {
    cardsVisible = !cardsVisible;
    renderHoleCards();
  });

  btnBetMinus.addEventListener('click', () => stepBetAmount(-BET_STEP));
  btnBetPlus.addEventListener('click', () => stepBetAmount(BET_STEP));

  btnFold.addEventListener('click', () => sendAction('fold'));
  btnCheckCall.addEventListener('click', () => sendAction(currentToCall > 0 ? 'call' : 'check'));
  btnBetRaise.addEventListener('click', () => {
    sendAction(currentGame && currentGame.currentBet > 0 ? 'raise' : 'bet', Number(betAmountInput.value));
  });
  btnAllIn.addEventListener('click', () => sendAction('allin'));

  function stepBetAmount(delta) {
    const maxTarget = (currentMe.bet || 0) + currentMe.token;
    let value = Number(betAmountInput.value || 0) + delta;
    value = Math.max(Number(betAmountInput.min || 0), Math.min(value, maxTarget));
    betAmountInput.value = value;
  }

  function sendAction(type, amount) {
    if (actionsLocked) return;
    actionsLocked = true;
    setActionButtonsDisabled(true);

    db.ref('trial-error/24Card/poker/' + roomId + '/game/pendingAction').set({
      seat: currentMe.seat,
      name: playerName,
      type,
      amount: amount || 0,
      ts: Date.now()
    }).catch((err) => {
      console.error(err);
      alert('Gagal mengirim aksi. Coba lagi.');
      actionsLocked = false;
      setActionButtonsDisabled(false);
    });
  }

  function setActionButtonsDisabled(disabled) {
    [btnFold, btnCheckCall, btnBetRaise, btnAllIn, btnBetMinus, btnBetPlus].forEach((b) => { b.disabled = disabled; });
  }

  function render(data) {
    const players = data.players || {};
    const game = data.game || null;
    const me = players[playerName];
    if (!me) return;

    currentMe = me;
    currentGame = game;

    myTokenEl.textContent = me.token != null ? me.token : 0;
    renderHoleCards();
    renderCommunity(game ? game.communityCards : []);

    mobilePot.textContent = game ? game.pot : 0;
    currentToCall = game ? Math.max(0, game.currentBet - (me.bet || 0)) : 0;
    mobileToCall.textContent = currentToCall;

    if (!game) {
      statusText.textContent = 'Menunggu host memulai permainan...';
      hideAllPanels();
      return;
    }

    if (me.folded) {
      statusText.textContent = 'Menunggu ronde berikutnya';
      hideAllPanels();
      foldedBanner.style.display = '';
      return;
    }

    if (game.stage === 'showdown' || game.stage === 'handover') {
      statusText.textContent = STAGE_LABELS[game.stage];
      hideAllPanels();
      showdownBanner.style.display = '';
      if (game.winners) {
        showdownBanner.textContent = game.winners.includes(playerName)
          ? `🏆 Kamu menang dengan ${game.winningHandLabel}!`
          : `${game.winners.join(' & ')} menang dengan ${game.winningHandLabel}`;
      } else {
        showdownBanner.textContent = 'Ronde selesai.';
      }
      return;
    }

    statusText.textContent = STAGE_LABELS[game.stage] || game.stage;
    hideAllPanels();

    const isMyTurn = game.turnSeat === me.seat && !me.allIn;
    turnBanner.style.display = isMyTurn ? '' : 'none';
    actionButtons.style.display = isMyTurn ? '' : 'none';

    if (isMyTurn) {
      actionsLocked = false;
      setActionButtonsDisabled(false);

      btnCheckCall.textContent = currentToCall > 0 ? `Call ${currentToCall}` : 'Check';
      btnBetRaise.textContent = game.currentBet > 0 ? 'Raise' : 'Bet';

      const maxTarget = (me.bet || 0) + me.token;
      const minTarget = Math.min(
        game.currentBet > 0 ? game.currentBet + game.minRaise : BET_STEP,
        maxTarget
      );

      betAmountInput.min = minTarget;
      betAmountInput.max = maxTarget;
      if (!betAmountInput.value || Number(betAmountInput.value) < minTarget) {
        betAmountInput.value = minTarget;
      }

      const canRaise = maxTarget > game.currentBet;
      btnBetRaise.disabled = !canRaise;
    }
  }

  function hideAllPanels() {
    turnBanner.style.display = 'none';
    actionButtons.style.display = 'none';
    foldedBanner.style.display = 'none';
    showdownBanner.style.display = 'none';
  }

  function renderHoleCards() {
    holeCardsRow.innerHTML = '';
    const cards = currentMe && currentMe.holeCards ? currentMe.holeCards : [];
    cards.forEach((card) => {
      const img = document.createElement('img');
      img.className = 'poker-hole-card';
      img.src = cardsVisible ? getCardImagePath(card) : getCardBackImagePath();
      holeCardsRow.appendChild(img);
    });
    btnToggleCards.textContent = cardsVisible ? '🙈 Sembunyikan' : '👁 Lihat Kartu';
    btnToggleCards.style.display = cards.length ? '' : 'none';
  }

  function renderCommunity(cards) {
    mobileCommunity.innerHTML = '';
    (cards || []).forEach((card) => {
      const img = document.createElement('img');
      img.className = 'poker-mobile-community-card';
      img.src = getCardImagePath(card);
      mobileCommunity.appendChild(img);
    });
  }
}
