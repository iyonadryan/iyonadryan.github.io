/**
 * poker-host.js — Meja utama Poker (Texas Hold'em) di layar host.
 *
 * Host adalah otoritas tunggal: men-deal kartu, mengelola blind, giliran, dan
 * kemajuan ronde (preflop → flop → turn → river → showdown), lalu menulis
 * hasilnya ke Firebase. Player di poker-mobile.html hanya mengirim "niat aksi"
 * (game/pendingAction) yang diproses di sini.
 *
 * Simplifikasi versi pertama (didokumentasikan supaya sadar batasannya):
 *  - Single pot saja, belum ada side-pot buat all-in dengan stack timpang.
 *  - Blind tetap (tidak naik seiring waktu/ronde).
 *  - Tidak ada auto-fold/timeout giliran (sesuai permintaan: tanpa countdown).
 */

const SMALL_BLIND = 25;
const BIG_BLIND = 50;

const STAGE_LABELS = {
  preflop: 'Pre-Flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
  handover: 'Ronde Selesai'
};

// --- Pure game-state helpers (tidak menyentuh DOM/Firebase, gampang di-tes) ---

function nextSeatAfter(seat, sortedSeats) {
  if (sortedSeats.length === 0) return null;
  const idx = sortedSeats.indexOf(seat);
  if (idx === -1) {
    const greater = sortedSeats.find((s) => s > seat);
    return greater !== undefined ? greater : sortedSeats[0];
  }
  return sortedSeats[(idx + 1) % sortedSeats.length];
}

function getHandSeats(players) {
  return Object.keys(players)
    .filter((name) => players[name].inHand && !players[name].folded)
    .map((name) => ({ name, seat: players[name].seat }));
}

function getActableSeats(players) {
  return getHandSeats(players).filter(({ name }) => !players[name].allIn);
}

/** Deal kartu baru + posting blind. `previousGame` null kalau ini hand pertama di room ini. */
function dealNewHand(playersInput, previousGame) {
  const players = JSON.parse(JSON.stringify(playersInput));
  const names = Object.keys(players).sort();

  names.forEach((name, i) => {
    if (players[name].seat === undefined || players[name].seat === null) {
      players[name].seat = i;
    }
  });

  const activeList = names
    .map((name) => ({ name, seat: players[name].seat, token: players[name].token || 0 }))
    .filter((p) => p.token > 0)
    .sort((a, b) => a.seat - b.seat);

  if (activeList.length < 2) {
    return { error: 'Minimal 2 pemain dengan token tersisa untuk memulai ronde.' };
  }

  const activeSeats = activeList.map((p) => p.seat);
  const seatToName = {};
  activeList.forEach((p) => { seatToName[p.seat] = p.name; });

  const dealerSeat = previousGame && previousGame.dealerSeat !== undefined && activeSeats.includes(nextSeatAfter(previousGame.dealerSeat, activeSeats))
    ? nextSeatAfter(previousGame.dealerSeat, activeSeats)
    : activeSeats[0];

  let sbSeat, bbSeat, firstToAct;
  if (activeList.length === 2) {
    sbSeat = dealerSeat;
    bbSeat = nextSeatAfter(dealerSeat, activeSeats);
    firstToAct = dealerSeat;
  } else {
    sbSeat = nextSeatAfter(dealerSeat, activeSeats);
    bbSeat = nextSeatAfter(sbSeat, activeSeats);
    firstToAct = nextSeatAfter(bbSeat, activeSeats);
  }

  names.forEach((name) => {
    players[name].folded = false;
    players[name].allIn = false;
    players[name].bet = 0;
    players[name].lastAction = null;
    players[name].holeCards = null;
    players[name].inHand = false;
  });

  const deck = shuffleDeck(createDeck());
  activeList.forEach((p) => {
    players[p.name].holeCards = deck.splice(0, 2);
    players[p.name].inHand = true;
  });

  function postBlind(seat, amount) {
    const name = seatToName[seat];
    const posted = Math.min(amount, players[name].token);
    players[name].token -= posted;
    players[name].bet = posted;
    if (players[name].token === 0) players[name].allIn = true;
    return posted;
  }

  const sbPosted = postBlind(sbSeat, SMALL_BLIND);
  const bbPosted = postBlind(bbSeat, BIG_BLIND);

  let game = {
    handNumber: (previousGame && previousGame.handNumber ? previousGame.handNumber : 0) + 1,
    stage: 'preflop',
    deck,
    communityCards: [],
    pot: sbPosted + bbPosted,
    currentBet: bbPosted,
    minRaise: BIG_BLIND,
    dealerSeat,
    sbSeat,
    bbSeat,
    turnSeat: firstToAct,
    actedSeats: [],
    pendingAction: null,
    winners: null,
    winningHandLabel: null
  };

  if (getActableSeats(players).length < 2 && getHandSeats(players).length >= 2) {
    return advanceStage(players, game);
  }

  return { players, game };
}

/** Terapkan satu aksi pemain (fold/check/call/bet/raise/allin) lalu majukan state permainan. */
function applyAction(playersInput, gameInput, action) {
  const players = JSON.parse(JSON.stringify(playersInput));
  const game = JSON.parse(JSON.stringify(gameInput));
  // Firebase RTDB memangkas array kosong ([]) jadi undefined saat dibaca ulang — normalisasi di sini.
  game.actedSeats = game.actedSeats || [];
  game.communityCards = game.communityCards || [];
  game.deck = game.deck || [];

  const name = action.name;
  const p = players[name];
  if (!p || p.seat !== game.turnSeat) {
    return { players, game, error: 'Bukan giliran pemain ini.' };
  }

  const myBet = p.bet || 0;
  const toCall = game.currentBet - myBet;
  const wasBetOpen = game.currentBet > 0;
  let actedSeats = [...game.actedSeats];

  if (action.type === 'fold') {
    p.folded = true;
    p.lastAction = 'Fold';
  } else if (action.type === 'check') {
    if (toCall > 0) return { players, game, error: 'Tidak bisa check, masih ada bet yang harus di-call.' };
    actedSeats.push(p.seat);
    p.lastAction = 'Check';
  } else if (action.type === 'call') {
    const amount = Math.min(toCall, p.token);
    p.token -= amount;
    p.bet = myBet + amount;
    game.pot += amount;
    if (p.token === 0) p.allIn = true;
    actedSeats.push(p.seat);
    p.lastAction = p.allIn ? `All In (${p.bet})` : `Call ${amount}`;
  } else if (action.type === 'bet' || action.type === 'raise') {
    const maxTarget = myBet + p.token;
    const minLegalTarget = game.currentBet + game.minRaise;
    let target = Math.min(Math.max(action.amount || 0, 0), maxTarget);
    const isAllIn = target >= maxTarget;
    if (isAllIn) target = maxTarget;
    if (!isAllIn && target < minLegalTarget) {
      return { players, game, error: `Minimal ${wasBetOpen ? 'raise' : 'bet'} ke ${minLegalTarget}.` };
    }
    const added = target - myBet;
    p.token -= added;
    p.bet = target;
    game.pot += added;
    if (isAllIn) p.allIn = true;

    if (target > game.currentBet) {
      game.minRaise = Math.max(game.minRaise, target - game.currentBet);
      game.currentBet = target;
      actedSeats = [p.seat];
    } else {
      actedSeats.push(p.seat);
    }
    p.lastAction = isAllIn ? `All In ${target}` : (wasBetOpen ? `Raise ${target}` : `Bet ${target}`);
  } else if (action.type === 'allin') {
    const target = myBet + p.token;
    game.pot += p.token;
    p.bet = target;
    p.token = 0;
    p.allIn = true;
    if (target > game.currentBet) {
      game.minRaise = Math.max(game.minRaise, target - game.currentBet);
      game.currentBet = target;
      actedSeats = [p.seat];
    } else {
      actedSeats.push(p.seat);
    }
    p.lastAction = `All In ${target}`;
  } else {
    return { players, game, error: 'Aksi tidak dikenal: ' + action.type };
  }

  game.actedSeats = actedSeats;
  game.pendingAction = null;

  return resolveAfterAction(players, game);
}

function resolveAfterAction(players, game) {
  const handSeats = getHandSeats(players);

  if (handSeats.length === 1) {
    const winnerName = handSeats[0].name;
    players[winnerName].token += game.pot;
    game.pot = 0;
    game.stage = 'handover';
    game.winners = [winnerName];
    game.winningHandLabel = 'Menang (lawan fold)';
    game.turnSeat = null;
    return { players, game };
  }

  const actableSeats = getActableSeats(players);
  const roundClosed = actableSeats.every(
    (s) => game.actedSeats.includes(s.seat) && (players[s.name].bet || 0) === game.currentBet
  );

  if (actableSeats.length <= 1 || roundClosed) {
    return advanceStage(players, game);
  }

  const actableSeatNums = actableSeats.map((s) => s.seat).sort((a, b) => a - b);
  game.turnSeat = nextSeatAfter(game.turnSeat, actableSeatNums);
  return { players, game };
}

function advanceStage(players, game) {
  function resetBetsForNewStreet() {
    getHandSeats(players).forEach(({ name }) => { players[name].bet = 0; });
    game.currentBet = 0;
    game.minRaise = BIG_BLIND;
    game.actedSeats = [];
  }

  if (game.stage === 'preflop') {
    game.communityCards.push(...game.deck.splice(0, 3));
    game.stage = 'flop';
    resetBetsForNewStreet();
  } else if (game.stage === 'flop') {
    game.communityCards.push(...game.deck.splice(0, 1));
    game.stage = 'turn';
    resetBetsForNewStreet();
  } else if (game.stage === 'turn') {
    game.communityCards.push(...game.deck.splice(0, 1));
    game.stage = 'river';
    resetBetsForNewStreet();
  } else if (game.stage === 'river') {
    return resolveShowdown(players, game);
  }

  if (getActableSeats(players).length < 2 && getHandSeats(players).length >= 2) {
    return advanceStage(players, game);
  }

  const actableSeatNums = getActableSeats(players).map((s) => s.seat).sort((a, b) => a - b);
  if (actableSeatNums.length > 0) {
    game.turnSeat = nextSeatAfter(game.dealerSeat, actableSeatNums);
  }

  return { players, game };
}

function resolveShowdown(players, game) {
  const handSeats = getHandSeats(players);
  const contenders = handSeats.map(({ name }) => ({
    name,
    cards: [...players[name].holeCards, ...game.communityCards]
  }));

  const winnerNames = findWinners(contenders);
  const winningCards = contenders.find((c) => c.name === winnerNames[0]).cards;
  const winningHand = getBestHand(winningCards);

  const share = Math.floor(game.pot / winnerNames.length);
  let remainder = game.pot - share * winnerNames.length;
  winnerNames.forEach((name) => {
    players[name].token += share + remainder;
    remainder = 0;
  });

  game.pot = 0;
  game.stage = 'showdown';
  game.winners = winnerNames;
  game.winningHandLabel = winningHand.rankName;
  game.turnSeat = null;

  return { players, game };
}

// --- DOM & Firebase glue (dilewati kalau dijalankan sebagai module test di Node) ---

if (typeof document !== 'undefined') {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('roomId');

  const loadingScreen = document.getElementById('loadingScreen');
  const tableContent = document.getElementById('tableContent');
  const hostRoomId = document.getElementById('hostRoomId');
  const potDisplay = document.getElementById('potDisplay');
  const stageDisplay = document.getElementById('stageDisplay');
  const communityCards = document.getElementById('communityCards');
  const playersTable = document.getElementById('playersTable');
  const btnStartGame = document.getElementById('btnStartGame');
  const btnNextRound = document.getElementById('btnNextRound');
  const btnViewResult = document.getElementById('btnViewResult');
  const btnEndGame = document.getElementById('btnEndGame');
  const winnerBanner = document.getElementById('winnerBanner');
  const gameOverBanner = document.getElementById('gameOverBanner');
  const endGameConfirmOverlay = document.getElementById('endGameConfirmOverlay');
  const btnEndGameCancel = document.getElementById('btnEndGameCancel');
  const btnEndGameConfirm = document.getElementById('btnEndGameConfirm');

  function showOverlay(el) { el.style.display = 'flex'; }
  function hideOverlay(el) { el.style.display = 'none'; }

  if (!roomId) {
    loadingScreen.innerHTML = '<p>❌ Room ID tidak ditemukan.</p><a href="index.html" class="btn btn-secondary" style="margin-top:16px">← Kembali</a>';
  } else {
    hostRoomId.textContent = roomId;
    const roomRef = db.ref('trial-error/24Card/poker/' + roomId);

    roomRef.on('value', (snap) => {
      const data = snap.val();
      if (!data) {
        loadingScreen.innerHTML = '<p>❌ Room tidak ditemukan atau sudah kadaluarsa.</p><a href="index.html" class="btn btn-secondary" style="margin-top:16px">← Kembali</a>';
        return;
      }
      loadingScreen.style.display = 'none';
      tableContent.style.display = '';
      renderTable(data);
    }, (err) => {
      console.error(err);
      loadingScreen.innerHTML = '<p>❌ Gagal memuat data room.</p>';
    });

    roomRef.child('game/pendingAction').on('value', (snap) => {
      const action = snap.val();
      if (!action) return;

      roomRef.once('value').then((roomSnap) => {
        const data = roomSnap.val();
        if (!data || !data.game || !data.game.pendingAction) return;
        if (JSON.stringify(data.game.pendingAction) !== JSON.stringify(action)) return;

        const result = applyAction(data.players, data.game, action);
        if (result.error) {
          console.warn('Aksi ditolak:', result.error);
          roomRef.child('game/pendingAction').set(null);
          return;
        }
        roomRef.update({ players: result.players, game: result.game }).catch((err) => console.error(err));
      });
    });

    btnStartGame.addEventListener('click', startNewHand);
    btnNextRound.addEventListener('click', startNewHand);
    btnViewResult.addEventListener('click', finishGame);

    btnEndGame.addEventListener('click', () => showOverlay(endGameConfirmOverlay));
    btnEndGameCancel.addEventListener('click', () => hideOverlay(endGameConfirmOverlay));
    btnEndGameConfirm.addEventListener('click', () => {
      hideOverlay(endGameConfirmOverlay);
      finishGame();
    });

    function finishGame() {
      btnEndGame.disabled = true;
      btnViewResult.disabled = true;

      roomRef.once('value').then((snap) => {
        const data = snap.val();
        if (!data) return;

        const players = data.players || {};
        const list = Object.keys(players).map((name) => ({ name, token: players[name].token || 0 }));
        list.sort((a, b) => b.token - a.token);

        const updates = { status: 'finished' };
        let currentRank = 0;
        list.forEach((p, i) => {
          if (i === 0 || p.token !== list[i - 1].token) currentRank = i + 1;
          updates['result/' + p.name + '/token'] = p.token;
          updates['result/' + p.name + '/rank'] = currentRank;
        });

        roomRef.update(updates).then(() => {
          window.location.href = 'poker-result.html?roomId=' + roomId;
        }).catch((err) => {
          console.error(err);
          alert('Gagal menyelesaikan game. Coba lagi.');
          btnEndGame.disabled = false;
          btnViewResult.disabled = false;
        });
      });
    }

    function startNewHand() {
      btnStartGame.disabled = true;
      btnNextRound.disabled = true;

      roomRef.once('value').then((snap) => {
        const data = snap.val();
        if (!data) return;

        const result = dealNewHand(data.players || {}, data.game || null);
        if (result.error) {
          alert(result.error);
          btnStartGame.disabled = false;
          btnNextRound.disabled = false;
          return;
        }

        roomRef.update({ players: result.players, game: result.game }).catch((err) => {
          console.error(err);
          alert('Gagal memulai ronde. Coba lagi.');
          btnStartGame.disabled = false;
          btnNextRound.disabled = false;
        });
      });
    }

    function renderTable(data) {
      const players = data.players || {};
      const game = data.game || null;

      potDisplay.textContent = game ? game.pot : 0;
      stageDisplay.textContent = game ? (STAGE_LABELS[game.stage] || game.stage) : 'Menunggu';

      renderCommunityCards(game ? game.communityCards : []);
      renderPlayersTable(players, game);

      const isHandOver = !!game && (game.stage === 'showdown' || game.stage === 'handover');

      btnStartGame.style.display = !game ? '' : 'none';
      btnStartGame.disabled = false;

      const withChips = Object.keys(players).filter((n) => (players[n].token || 0) > 0);
      const isGameOver = isHandOver && withChips.length <= 1;

      btnNextRound.style.display = (isHandOver && !isGameOver) ? '' : 'none';
      btnNextRound.disabled = false;
      btnViewResult.style.display = isGameOver ? '' : 'none';
      btnViewResult.disabled = false;
      btnEndGame.style.display = game ? '' : 'none';
      btnEndGame.disabled = false;

      if (isHandOver && game.winners) {
        winnerBanner.style.display = '';
        winnerBanner.textContent = `🏆 ${game.winners.join(' & ')} menang dengan ${game.winningHandLabel}!`;
      } else {
        winnerBanner.style.display = 'none';
      }

      if (isGameOver) {
        gameOverBanner.style.display = '';
        gameOverBanner.textContent = withChips.length === 1
          ? `🎉 ${withChips[0]} adalah JUARA! (${players[withChips[0]].token} token)`
          : 'Permainan selesai.';
      } else {
        gameOverBanner.style.display = 'none';
      }
    }

    function renderCommunityCards(cards) {
      communityCards.innerHTML = '';
      for (let i = 0; i < 5; i++) {
        const slot = document.createElement('div');
        slot.className = 'poker-community-slot';
        if (cards && cards[i]) {
          const img = document.createElement('img');
          img.src = getCardImagePath(cards[i]);
          img.className = 'poker-community-card';
          slot.appendChild(img);
        }
        communityCards.appendChild(slot);
      }
    }

    function renderPlayersTable(players, game) {
      playersTable.innerHTML = '';
      const names = Object.keys(players).sort((a, b) => (players[a].seat || 0) - (players[b].seat || 0));

      names.forEach((name) => {
        const p = players[name];
        const seat = document.createElement('div');
        seat.className = 'poker-seat';
        if (game && game.turnSeat === p.seat) seat.classList.add('poker-seat-turn');
        if (p.folded) seat.classList.add('poker-seat-folded');
        if (!p.token && !p.inHand) seat.classList.add('poker-seat-out');

        const tags = [];
        if (game && game.dealerSeat === p.seat) tags.push('<span class="poker-tag poker-tag-dealer">D</span>');
        if (game && game.sbSeat === p.seat) tags.push('<span class="poker-tag poker-tag-sb">SB</span>');
        if (game && game.bbSeat === p.seat) tags.push('<span class="poker-tag poker-tag-bb">BB</span>');

        let cardsHtml = '';
        if (p.inHand && !p.folded) {
          const revealHole = game && game.stage === 'showdown' && p.holeCards;
          const cards = revealHole ? p.holeCards : [null, null];
          cardsHtml = '<div class="poker-seat-cards">' + cards.map((c) =>
            `<img class="poker-seat-card" src="${c ? getCardImagePath(c) : getCardBackImagePath()}">`
          ).join('') + '</div>';
        }

        seat.innerHTML = `
          <div class="poker-seat-tags">${tags.join('')}</div>
          <div class="poker-seat-name">${name}</div>
          <div class="poker-seat-token">💰 ${p.token || 0}</div>
          ${p.bet ? `<div class="poker-seat-bet">Bet: ${p.bet}</div>` : ''}
          ${p.allIn ? '<div class="poker-seat-badge poker-badge-allin">ALL IN</div>' : ''}
          ${p.folded ? '<div class="poker-seat-badge poker-badge-folded">FOLD</div>' : ''}
          ${p.lastAction ? `<div class="poker-seat-action">${p.lastAction}</div>` : ''}
          ${cardsHtml}
        `;
        playersTable.appendChild(seat);
      });
    }
  }
}
