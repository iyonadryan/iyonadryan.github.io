const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');

document.getElementById('resultRoomId').textContent = roomId || '----';

if (!roomId) {
  document.getElementById('resultLoading').innerHTML = '<p>❌ Room ID tidak valid.</p>';
} else {
  const resultRef = db.ref('trial-error/24Card/poker/' + roomId + '/result');

  resultRef.on('value', (snap) => {
    const result = snap.val();
    if (!result) return;

    document.getElementById('resultLoading').style.display = 'none';
    document.getElementById('resultContent').style.display = '';

    const names = Object.keys(result);
    names.sort((a, b) => result[a].rank - result[b].rank);

    renderPodium(result);

    const colors = ['#ffd54f', '#64b5f6', '#ce93d8', '#ef9a9a', '#81c784', '#a1887f'];
    const tbody = document.getElementById('resultBody');
    tbody.innerHTML = '';

    names.forEach((name, i) => {
      const p = result[name];
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="col-rank">${p.rank}</td>
        <td class="col-name" style="color:${colors[i % colors.length]};font-weight:700">${name}</td>
        <td class="col-life">💰 ${p.token}</td>`;
      tbody.appendChild(tr);
    });
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
