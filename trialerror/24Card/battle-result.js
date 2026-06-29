const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');

document.getElementById('resultRoomId').textContent = roomId || '----';

if (!roomId) {
  document.getElementById('resultLoading').innerHTML = '<p>❌ Room ID tidak valid.</p>';
} else {
  const resultRef = db.ref('trial-error/24Card/battle/' + roomId + '/result');

  resultRef.on('value', (snap) => {
    const result = snap.val();
    if (!result) return;

    document.getElementById('resultLoading').style.display = 'none';
    document.getElementById('resultContent').style.display = '';

    const names = Object.keys(result);
    names.sort((a, b) => result[a].rank - result[b].rank);

    renderPodium(result);

    const colors = ['#64b5f6', '#ffb74d', '#ce93d8', '#ef9a9a', '#81c784', '#a1887f'];
    const tbody = document.getElementById('resultBody');
    tbody.innerHTML = '';

    names.forEach((name, i) => {
      const p = result[name];
      const tr = document.createElement('tr');
      const lifeHtml = p.life > 0 ? heartsHTML(p.life, 11) + ' ' + p.life : '<span style="color:#e57373;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:1px">Eliminated</span>';
      tr.innerHTML = `
        <td class="col-rank">${p.rank}</td>
        <td class="col-name" style="color:${colors[i % colors.length]};font-weight:700">${name}</td>
        <td class="col-life">${lifeHtml}</td>
        <td class="col-time">${p.lastRound}</td>`;
      tbody.appendChild(tr);
    });

    const roomRef = db.ref('trial-error/24Card/battle/' + roomId);
    roomRef.once('value').then((snap) => {
      const data = snap.val();
      if (!data) return;
      renderTrackRecord(data, names);
    });
  });
}

function renderTrackRecord(data, playerNames) {
  const plays = data.plays;
  const players = data.players || {};
  if (!plays) return;

  const roundNumbers = Object.keys(plays).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
  if (roundNumbers.length === 0) return;

  const head = document.getElementById('trackRecordHead');
  const body = document.getElementById('trackRecordBody');
  head.innerHTML = '';
  body.innerHTML = '';

  const headerRow = document.createElement('tr');
  headerRow.innerHTML = '<th>Round</th><th>Cards</th>';
  playerNames.forEach(name => {
    const th = document.createElement('th');
    th.textContent = name;
    headerRow.appendChild(th);
  });
  head.appendChild(headerRow);

  roundNumbers.forEach(round => {
    const roundData = plays[round];
    const successes = roundData.success || {};

    const tr = document.createElement('tr');
    const roundTd = document.createElement('td');
    roundTd.className = 'tr-round';
    roundTd.textContent = round;
    tr.appendChild(roundTd);

    const cardsTd = document.createElement('td');
    cardsTd.className = 'tr-cards';
    if (roundData.numbers) {
      const items = roundData.numbers.split(',');
      const cardContainer = document.createElement('div');
      cardContainer.className = 'tr-cards-inner';
      items.forEach(item => {
        const num = parseInt(item);
        const suit = item.replace(/[0-9]/g, '');
        const label = num === 1 ? 'A' : String(num);
        const isRed = suit === '♥' || suit === '♦';
        const mini = document.createElement('div');
        mini.className = 'popup-card' + (isRed ? ' suit-red' : ' suit-black');
        mini.innerHTML = `<span class="popup-card-value">${label}</span><span class="popup-card-suit">${suit}</span>`;
        cardContainer.appendChild(mini);
      });
      cardsTd.appendChild(cardContainer);
    } else {
      cardsTd.textContent = '-';
    }
    tr.appendChild(cardsTd);

    playerNames.forEach(name => {
      const td = document.createElement('td');
      const lastRound = (players[name] && (players[name].lastRound || players[name].lastround)) || 0;
      if (round > lastRound) {
        td.className = 'tr-eliminated';
        td.textContent = 'ELIMINATED';
      } else if (successes[name] != null) {
        td.className = 'tr-success';
        td.textContent = '✅';
      } else {
        td.className = 'tr-fail';
        td.textContent = '❌';
      }
      tr.appendChild(td);
    });

    body.appendChild(tr);
  });
}

function renderPodium(result) {
  const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const container = document.getElementById('podiumContainer');
  container.innerHTML = '';

  const names = Object.keys(result);
  names.sort((a, b) => result[a].rank - result[b].rank);

  names.forEach((name) => {
    const p = result[name];
    const rank = p.rank;
    if (rank > 3) return;

    const medal = medals[rank];

    const item = document.createElement('div');
    item.className = 'podium-item podium-' + rank;

    const nameEl = document.createElement('span');
    nameEl.className = 'podium-name';
    nameEl.textContent = name;

    const block = document.createElement('div');
    block.className = 'podium-block';

    const medalEl = document.createElement('span');
    medalEl.className = 'podium-medal';
    medalEl.textContent = medal;
    block.appendChild(medalEl);

    item.appendChild(nameEl);
    item.appendChild(block);
    container.appendChild(item);
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
