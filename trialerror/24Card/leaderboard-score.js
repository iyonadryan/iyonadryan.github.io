const db = firebase.database();

function getStars(score) {
  if (score >= 20) return '⭐⭐⭐';
  if (score >= 10) return '⭐⭐';
  return '⭐';
}

function getMedal(index) {
  if (index === 0) return '🥇';
  if (index === 1) return '🥈';
  if (index === 2) return '🥉';
  return index + 1;
}

function formatTimestamp(ms) {
  if (!ms) return '-';
  const d = new Date(ms);
  return d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
}

function render(tbody, data) {
  const sorted = Object.keys(data)
    .map(key => ({
      name: key,
      score: data[key].score || 0,
      timestamp: data[key].timestamp || null
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.timestamp || 0) - (a.timestamp || 0);
    })
    .slice(0, 25);

  tbody.innerHTML = sorted.map((item, i) => {
    const medal = getMedal(i);
    const stars = getStars(item.score);
    return `
      <tr>
        <td class="col-rank">${medal}</td>
        <td class="col-name">${item.name}</td>
        <td class="col-score">${stars} ${item.score}</td>
        <td class="col-time">${formatTimestamp(item.timestamp)}</td>
      </tr>
    `;
  }).join('');
}

function loadLeaderboard(mode) {
  const path = `trial-error/24Card/${mode}Mode`;
  const tbody = document.getElementById('lbBody');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px;color:rgba(255,255,255,0.3)">Memuat data...</td></tr>';

  db.ref(path).once('value').then(snapshot => {
    const data = snapshot.val();
    if (!data || Object.keys(data).length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px;color:rgba(255,255,255,0.3)">Belum ada data</td></tr>';
      return;
    }
    render(tbody, data);
  }).catch(err => {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px;color:#e57373">Gagal memuat data</td></tr>';
  });
}

document.querySelectorAll('.lb-tab').forEach(tab => {
  tab.addEventListener('click', function () {
    document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
    this.classList.add('active');
    loadLeaderboard(this.dataset.mode);
  });
});

loadLeaderboard('24');
