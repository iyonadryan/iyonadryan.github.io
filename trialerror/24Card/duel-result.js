const params  = new URLSearchParams(window.location.search);
const roomId  = params.get('roomId');
const myName  = params.get('name') || '';

document.getElementById('resultRoomId').textContent = roomId || '----';

if (!roomId) {
  document.getElementById('resultLoading').innerHTML = '<p>❌ Room ID tidak valid.</p>';
} else {
  db.ref('trial-error/24Card/duel/' + roomId + '/result').on('value', (snap) => {
    const result = snap.val();
    if (!result) return;

    document.getElementById('resultLoading').style.display = 'none';
    document.getElementById('resultContent').style.display  = '';

    const names = Object.keys(result).sort((a, b) => result[a].rank - result[b].rank);

    renderWinner(result, names);
    renderTable(result, names);

    db.ref('trial-error/24Card/duel/' + roomId).once('value').then((roomSnap) => {
      const data = roomSnap.val();
      if (data) renderTrackRecord(data, names);
    });
  });
}

function renderWinner(result, names) {
  const container = document.getElementById('winnerSection');
  container.innerHTML = '';

  const isDraw = names.length >= 2 && result[names[0]].rank === result[names[1]].rank;

  if (isDraw) {
    container.innerHTML = `
      <div class="duel-winner-emoji">🤝</div>
      <div class="duel-winner-label">Seri!</div>`;
    return;
  }

  const winner = names[0];
  const isMe   = winner === myName;
  container.innerHTML = `
    <div class="duel-winner-emoji">${isMe ? '🏆' : '💀'}</div>
    <div class="duel-winner-label" style="color:${isMe ? '#ffd54f' : 'rgba(255,255,255,0.6)'}">
      ${isMe ? 'Kamu Menang!' : 'Kamu Kalah!'}
    </div>
    `;
}

function renderTable(result, names) {
  const colors = { host: '#64b5f6', enemy: '#ef5350' };
  const tbody   = document.getElementById('resultBody');
  tbody.innerHTML = '';

  names.forEach((name, i) => {
    const p   = result[name];
    const col = colors[p.role] || '#fff';
    const lifeHtml = p.life > 0
      ? heartsHTML(p.life, 11) + ' ' + p.life
      : '<span style="color:#e57373;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:1px">Eliminated</span>';
    const rankIcon = i === 0 ? '🥇' : '🥈';
    const isMeBadge = name === myName
      ? '<span class="you-badge" style="background:#388e3c;color:#fff;font-size:0.55rem;font-weight:800;padding:1px 5px;border-radius:4px;margin-left:5px;vertical-align:middle">YOU</span>'
      : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-rank">${rankIcon}</td>
      <td class="col-name" style="color:${col};font-weight:700">${name}${isMeBadge}</td>
      <td class="col-life">${lifeHtml}</td>`;
    tbody.appendChild(tr);
  });
}

function renderTrackRecord(data, playerNames) {
  const plays = data.plays;
  if (!plays) return;

  const roundNumbers = Object.keys(plays).map(Number).filter((n) => !isNaN(n)).sort((a, b) => a - b);
  if (roundNumbers.length === 0) return;

  const head = document.getElementById('trackRecordHead');
  const body = document.getElementById('trackRecordBody');
  head.innerHTML = '';
  body.innerHTML = '';

  const headerRow = document.createElement('tr');
  headerRow.innerHTML = '<th>Round</th><th>Kartu</th>';
  playerNames.forEach((name) => {
    const th = document.createElement('th');
    th.textContent = name === myName ? name + ' ★' : name;
    headerRow.appendChild(th);
  });
  head.appendChild(headerRow);

  roundNumbers.forEach((round) => {
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
      const items        = roundData.numbers.split(',');
      const cardContainer = document.createElement('div');
      cardContainer.className = 'tr-cards-inner';
      items.forEach((item) => {
        const num   = parseInt(item);
        const suit  = item.replace(/[0-9]/g, '');
        const label = num === 1 ? 'A' : String(num);
        const isRed = suit === '♥' || suit === '♦';
        const mini  = document.createElement('div');
        mini.className = 'popup-card' + (isRed ? ' suit-red' : ' suit-black');
        mini.innerHTML = `<span class="popup-card-value">${label}</span><span class="popup-card-suit">${suit}</span>`;
        cardContainer.appendChild(mini);
      });
      cardsTd.appendChild(cardContainer);
    } else {
      cardsTd.textContent = '-';
    }
    tr.appendChild(cardsTd);

    playerNames.forEach((name) => {
      const td = document.createElement('td');
      if (successes[name] != null) {
        td.className  = 'tr-success';
        td.textContent = '✅';
      } else if (roundData.status === 'done') {
        td.className  = 'tr-fail';
        td.textContent = '❌';
      } else {
        td.textContent = '-';
      }
      tr.appendChild(td);
    });

    body.appendChild(tr);
  });

  document.getElementById('trackRecordContainer').style.display = '';
}

function heartsHTML(life, size) {
  const total = 10;
  const full  = Math.floor(life / 10);
  const rem   = life % 10;
  const s     = size || 12;
  let html    = '';
  for (let i = 0; i < total; i++) {
    let fill;
    if (i < full) {
      fill = '#e53935';
    } else if (i === full && rem > 0) {
      const pct    = (rem / 10) * 100;
      const gradId = 'hg_' + i + '_' + life;
      fill  = 'url(#' + gradId + ')';
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
