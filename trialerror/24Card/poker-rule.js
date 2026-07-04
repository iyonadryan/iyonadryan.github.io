/**
 * poker-rule.js — Engine kombinasi kartu Poker (5-card hand ranking)
 *
 * Urutan kombinasi dari terendah ke tertinggi:
 *  0. High Card
 *  1. Double        (Pair / satu pasang)
 *  2. Two Pair       (dua pasang)
 *  3. Triple         (Three of a Kind / tiga kembar)
 *  4. Strike         (Straight / lima kartu berurutan)
 *  5. Flush          (lima kartu se-suit)
 *  6. Full House     (Triple + Double)
 *  7. Four of a Kind (empat kembar)
 *  8. Straight Flush (Strike + Flush)
 *  9. Royal Flush    (Strike A-K-Q-J-10 + Flush)
 *
 * Kartu direpresentasikan sebagai { rank, suit }, contoh: { rank: 'A', suit: '♠' }.
 * Asset gambar kartu: img/cards/{rank}{suit}.png (mis. img/cards/A♠.png)
 * Asset gambar belakang kartu: img/back/red-card.png
 */

const POKER_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const POKER_SUITS = ['♠', '♥', '♦', '♣'];

const POKER_RANK_VALUE = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

/**
 * Urutan simbol/suit dari terendah ke tertinggi: ♣ < ♦ < ♥ < ♠.
 * Poker standar sebenarnya TIDAK punya urutan suit (hand rank sama + tiebreaker sama = seri,
 * pot dibagi rata) — ini house-rule tambahan khusus proyek ini supaya tiap showdown selalu
 * ada satu pemenang tunggal (hindari kompleksitas split-pot di UI). Dipakai compareHands()
 * sebagai tiebreak PALING TERAKHIR, cuma kepake kalau rank & tiebreakers-nya bener2 identik.
 */
const SUIT_RANK = { '♣': 1, '♦': 2, '♥': 3, '♠': 4 };

const HAND_RANKS = {
  HIGH_CARD: 0,
  DOUBLE: 1,
  TWO_PAIR: 2,
  TRIPLE: 3,
  STRIKE: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  FOUR_OF_A_KIND: 7,
  STRAIGHT_FLUSH: 8,
  ROYAL_FLUSH: 9
};

const HAND_LABELS = {
  0: 'High Card',
  1: 'Double',
  2: 'Two Pair',
  3: 'Triple',
  4: 'Strike',
  5: 'Flush',
  6: 'Full House',
  7: 'Four of a Kind',
  8: 'Straight Flush',
  9: 'Royal Flush'
};

// --- Asset helper ---

function getCardImagePath(card) {
  return `img/cards/${card.rank}${card.suit}.png`;
}

function getCardBackImagePath() {
  return 'img/back/red-card.png';
}

// --- Deck helper ---

function createDeck() {
  const deck = [];
  POKER_RANKS.forEach((rank) => {
    POKER_SUITS.forEach((suit) => {
      deck.push({ rank, suit });
    });
  });
  return deck;
}

function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// --- Hand evaluation ---

function detectStraight(uniqueValuesDesc) {
  if (uniqueValuesDesc.length !== 5) return null;

  if (uniqueValuesDesc[0] - uniqueValuesDesc[4] === 4) {
    return uniqueValuesDesc[0];
  }

  // Wheel: A-5-4-3-2, Ace berperan sebagai nilai 1 (high card-nya 5)
  if (uniqueValuesDesc.join(',') === '14,5,4,3,2') {
    return 5;
  }

  return null;
}

/**
 * Evaluasi 5 kartu menjadi { rank, rankName, tiebreakers, cards }.
 * `tiebreakers` dipakai compareHands() untuk membedakan hand dengan `rank` yang sama
 * (mis. Double As vs Double Raja), diurutkan dari yang paling menentukan.
 */
function evaluateHand(cards) {
  if (!cards || cards.length !== 5) {
    throw new Error('evaluateHand butuh tepat 5 kartu');
  }

  const values = cards.map((c) => POKER_RANK_VALUE[c.rank]).sort((a, b) => b - a);
  const isFlush = cards.every((c) => c.suit === cards[0].suit);
  const uniqueValues = [...new Set(values)];
  const straightHigh = detectStraight(uniqueValues);
  const isStraight = straightHigh !== null;

  const freq = {};
  values.forEach((v) => { freq[v] = (freq[v] || 0) + 1; });
  const groups = Object.keys(freq)
    .map((v) => ({ value: Number(v), count: freq[v] }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  let rank;
  let tiebreakers;

  if (isStraight && isFlush) {
    rank = straightHigh === 14 ? HAND_RANKS.ROYAL_FLUSH : HAND_RANKS.STRAIGHT_FLUSH;
    tiebreakers = [straightHigh];
  } else if (groups[0].count === 4) {
    rank = HAND_RANKS.FOUR_OF_A_KIND;
    tiebreakers = groups.map((g) => g.value);
  } else if (groups[0].count === 3 && groups[1].count === 2) {
    rank = HAND_RANKS.FULL_HOUSE;
    tiebreakers = groups.map((g) => g.value);
  } else if (isFlush) {
    rank = HAND_RANKS.FLUSH;
    tiebreakers = values;
  } else if (isStraight) {
    rank = HAND_RANKS.STRIKE;
    tiebreakers = [straightHigh];
  } else if (groups[0].count === 3) {
    rank = HAND_RANKS.TRIPLE;
    tiebreakers = groups.map((g) => g.value);
  } else if (groups[0].count === 2 && groups[1].count === 2) {
    rank = HAND_RANKS.TWO_PAIR;
    tiebreakers = groups.map((g) => g.value);
  } else if (groups[0].count === 2) {
    rank = HAND_RANKS.DOUBLE;
    tiebreakers = groups.map((g) => g.value);
  } else {
    rank = HAND_RANKS.HIGH_CARD;
    tiebreakers = values;
  }

  return { rank, rankName: HAND_LABELS[rank], tiebreakers, cards };
}

/**
 * Bandingkan 2 hasil evaluateHand(). > 0 kalau handA menang, < 0 kalau handB menang, 0 kalau seri
 * (seri sungguhan cuma mungkin kalau 5 kartu-nya identik persis, mis. sama2 "main board" di Hold'em).
 */
function compareHands(handA, handB) {
  if (handA.rank !== handB.rank) return handA.rank - handB.rank;

  for (let i = 0; i < handA.tiebreakers.length; i++) {
    const diff = handA.tiebreakers[i] - handB.tiebreakers[i];
    if (diff !== 0) return diff;
  }

  // Rank & tiebreaker identik — house-rule tiebreak terakhir pakai urutan suit (lihat SUIT_RANK).
  const sortDesc = (cards) => [...cards].sort((a, b) => POKER_RANK_VALUE[b.rank] - POKER_RANK_VALUE[a.rank]);
  const suitsA = sortDesc(handA.cards).map((c) => SUIT_RANK[c.suit]);
  const suitsB = sortDesc(handB.cards).map((c) => SUIT_RANK[c.suit]);

  for (let i = 0; i < suitsA.length; i++) {
    if (suitsA[i] !== suitsB[i]) return suitsA[i] - suitsB[i];
  }

  return 0;
}

function combinations(arr, size) {
  const results = [];
  function helper(start, combo) {
    if (combo.length === size) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  }
  helper(0, []);
  return results;
}

/** Cari 5 kartu terbaik dari kumpulan kartu (>5, mis. 2 kartu tangan + 5 kartu komunitas ala Texas Hold'em). */
function getBestHand(cards) {
  if (cards.length === 5) return evaluateHand(cards);
  if (cards.length < 5) throw new Error('getBestHand butuh minimal 5 kartu');

  let best = null;
  combinations(cards, 5).forEach((combo) => {
    const evaluated = evaluateHand(combo);
    if (!best || compareHands(evaluated, best) > 0) best = evaluated;
  });
  return best;
}

/** players: [{ name, cards }]. Return array nama pemenang (lebih dari satu kalau seri). */
function findWinners(players) {
  const evaluated = players.map((p) => ({ name: p.name, hand: getBestHand(p.cards) }));

  let best = evaluated[0].hand;
  evaluated.forEach((e) => {
    if (compareHands(e.hand, best) > 0) best = e.hand;
  });

  return evaluated
    .filter((e) => compareHands(e.hand, best) === 0)
    .map((e) => e.name);
}

// --- Self-test (buka console browser & panggil runPokerRuleSelfTest() untuk verifikasi) ---

function runPokerRuleSelfTest() {
  const tests = [
    { name: 'Royal Flush', cards: c(['A♠', 'K♠', 'Q♠', 'J♠', '10♠']), expected: HAND_RANKS.ROYAL_FLUSH },
    { name: 'Straight Flush', cards: c(['9♥', '8♥', '7♥', '6♥', '5♥']), expected: HAND_RANKS.STRAIGHT_FLUSH },
    { name: 'Four of a Kind', cards: c(['K♠', 'K♥', 'K♦', 'K♣', '2♣']), expected: HAND_RANKS.FOUR_OF_A_KIND },
    { name: 'Full House', cards: c(['J♠', 'J♥', 'J♦', '4♣', '4♠']), expected: HAND_RANKS.FULL_HOUSE },
    { name: 'Flush', cards: c(['2♦', '5♦', '9♦', 'J♦', 'K♦']), expected: HAND_RANKS.FLUSH },
    { name: 'Strike (Straight)', cards: c(['9♠', '8♥', '7♦', '6♣', '5♠']), expected: HAND_RANKS.STRIKE },
    { name: 'Strike Wheel (A-2-3-4-5)', cards: c(['A♠', '2♥', '3♦', '4♣', '5♠']), expected: HAND_RANKS.STRIKE },
    { name: 'Triple', cards: c(['7♠', '7♥', '7♦', 'K♣', '2♠']), expected: HAND_RANKS.TRIPLE },
    { name: 'Two Pair', cards: c(['Q♠', 'Q♥', '4♦', '4♣', '2♠']), expected: HAND_RANKS.TWO_PAIR },
    { name: 'Double', cards: c(['10♠', '10♥', 'K♦', '4♣', '2♠']), expected: HAND_RANKS.DOUBLE },
    { name: 'High Card', cards: c(['A♠', 'J♥', '8♦', '4♣', '2♠']), expected: HAND_RANKS.HIGH_CARD }
  ];

  let allPass = true;
  tests.forEach((t) => {
    const result = evaluateHand(t.cards);
    const pass = result.rank === t.expected;
    if (!pass) allPass = false;
    console.log(`${pass ? '✅' : '❌'} ${t.name} → terdeteksi: ${result.rankName}`);
  });

  // Sanity check compareHands: Double As harus menang lawan Double Raja
  const doubleAces = evaluateHand(c(['A♠', 'A♥', '9♦', '4♣', '2♠']));
  const doubleKings = evaluateHand(c(['K♠', 'K♥', '9♦', '4♣', '2♠']));
  const compareOk = compareHands(doubleAces, doubleKings) > 0;
  console.log(`${compareOk ? '✅' : '❌'} compareHands: Double As > Double Raja`);
  if (!compareOk) allPass = false;

  // Sanity check suit tiebreak: Two Pair identik nilai, beda suit tertinggi → ♠ menang lawan ♥
  const twoPairSpadeHigh = evaluateHand(c(['Q♠', 'Q♥', '7♦', '7♣', '3♠']));
  const twoPairHeartHigh = evaluateHand(c(['Q♥', 'Q♦', '7♥', '7♣', '3♦']));
  const suitTiebreakOk = compareHands(twoPairSpadeHigh, twoPairHeartHigh) > 0;
  console.log(`${suitTiebreakOk ? '✅' : '❌'} compareHands: Two Pair kicker ♠ > Two Pair kicker ♥ (suit tiebreak)`);
  if (!suitTiebreakOk) allPass = false;

  console.log(allPass ? '✅ Semua test pass!' : '❌ Ada test yang gagal, cek log di atas.');
  return allPass;

  // Helper lokal: ubah shorthand string ("A♠") jadi object { rank, suit }
  function c(shorthand) {
    return shorthand.map((s) => {
      const suit = s.slice(-1);
      const rank = s.slice(0, -1);
      return { rank, suit };
    });
  }
}

// --- Petunjuk visual (dipakai di popup Info Mode poker.html & Petunjuk poker-lobby.html) ---

const HAND_RANK_SAMPLES = [
  { label: 'High Card', desc: 'Kartu tertinggi kalau gak ada kombinasi lain', cards: ['A♠', 'J♥', '8♦', '4♣', '2♠'], highlight: [0] },
  { label: 'Double', desc: '2 kartu angka sama (Pair)', cards: ['K♠', 'K♥', '9♦', '5♣', '2♠'], highlight: [0, 1] },
  { label: 'Two Pair', desc: '2 pasang kartu angka sama', cards: ['Q♠', 'Q♥', '7♦', '7♣', '3♠'], highlight: [0, 1, 2, 3] },
  { label: 'Triple', desc: '3 kartu angka sama', cards: ['8♠', '8♥', '8♦', 'K♣', '2♠'], highlight: [0, 1, 2] },
  { label: 'Strike', desc: '5 kartu berurutan, suit bebas (Straight)', cards: ['9♠', '8♥', '7♦', '6♣', '5♠'], highlight: [0, 1, 2, 3, 4] },
  { label: 'Flush', desc: '5 kartu suit sama, tidak berurutan', cards: ['2♦', '5♦', '9♦', 'J♦', 'K♦'], highlight: [0, 1, 2, 3, 4] },
  { label: 'Full House', desc: 'Triple + Double sekaligus', cards: ['J♠', 'J♥', 'J♦', '4♣', '4♠'], highlight: [0, 1, 2, 3, 4] },
  { label: 'Four of a Kind', desc: '4 kartu angka sama', cards: ['7♠', '7♥', '7♦', '7♣', '2♠'], highlight: [0, 1, 2, 3] },
  { label: 'Straight Flush', desc: 'Strike + Flush sekaligus', cards: ['9♥', '8♥', '7♥', '6♥', '5♥'], highlight: [0, 1, 2, 3, 4] },
  { label: 'Royal Flush', desc: 'Strike A-K-Q-J-10 + Flush', cards: ['A♠', 'K♠', 'Q♠', 'J♠', '10♠'], highlight: [0, 1, 2, 3, 4] }
];

/** Render daftar kombinasi kartu ke dalam elemen #handRankPreview (dipakai popup Info Mode / Petunjuk). */
function renderHandRankPreview() {
  const container = document.getElementById('handRankPreview');
  if (!container) return;

  container.innerHTML = HAND_RANK_SAMPLES.map((hand, i) => {
    const cardsHtml = hand.cards.map((shorthand, idx) => {
      const card = { rank: shorthand.slice(0, -1), suit: shorthand.slice(-1) };
      const isHighlighted = hand.highlight.includes(idx);
      const style = isHighlighted
        ? 'width:28px;border-radius:4px;box-shadow:0 0 0 2px #ffd54f,0 0 10px 2px rgba(255,213,79,0.65);'
        : 'width:28px;border-radius:4px;box-shadow:0 2px 4px rgba(0,0,0,0.4);opacity:0.5;';
      return `<img src="${getCardImagePath(card)}" style="${style}">`;
    }).join('');

    return `
      <div style="margin-bottom:14px">
        <div style="display:flex;align-items:baseline;gap:7px;margin-bottom:6px;flex-wrap:wrap">
          <span style="color:rgba(255,255,255,0.35);font-weight:700;font-size:0.72rem">${i}</span>
          <span style="color:#fff;font-weight:700;font-size:0.82rem">${hand.label}</span>
          <span style="color:rgba(255,255,255,0.5);font-size:0.72rem">— ${hand.desc}</span>
        </div>
        <div style="display:flex;gap:4px">${cardsHtml}</div>
      </div>
    `;
  }).join('');
}
