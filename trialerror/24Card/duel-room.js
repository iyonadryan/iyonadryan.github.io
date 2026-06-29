const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');
const hostName = params.get('host');
const enemyName = params.get('enemy');
const myRole = hostName ? 'host' : (enemyName ? 'enemy' : null);
const myName = hostName || enemyName || '';

const roomLoading = document.getElementById('roomLoading');
const roomContent = document.getElementById('roomContent');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const roomNameDisplay = document.getElementById('roomNameDisplay');
const roomCreatedDisplay = document.getElementById('roomCreatedDisplay');
const roomExpiredDisplay = document.getElementById('roomExpiredDisplay');
const duelVsContainer = document.getElementById('duelVsContainer');
const btnReady = document.getElementById('btnReady');
const btnDeleteRoom = document.getElementById('btnDeleteRoom');
const deleteConfirmOverlay = document.getElementById('deleteConfirmOverlay');
const btnDeleteCancel = document.getElementById('btnDeleteCancel');
const btnDeleteConfirm = document.getElementById('btnDeleteConfirm');

let currentEnemyName = enemyName || '';
let roomHostName = hostName || '';

const leaveConfirmOverlay = document.getElementById('leaveConfirmOverlay');
const btnLeaveCancel = document.getElementById('btnLeaveCancel');
const btnLeaveConfirm = document.getElementById('btnLeaveConfirm');

function showOverlay(el) {
  el.style.display = 'flex';
}

function hideOverlay(el) {
  el.style.display = 'none';
}

function formatTime(ts) {
  const d = new Date(ts);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}:${mins}`;
}

function renderPlayers(playerObj, roomEnemyName, roomHost) {
  duelVsContainer.innerHTML = '';
  const players = playerObj || {};
  currentEnemyName = roomEnemyName !== undefined ? roomEnemyName : currentEnemyName;
  roomHostName = roomHost || roomHostName;

  const hostEl = document.createElement('div');
  hostEl.className = 'duel-vs-card duel-vs-host';
  hostEl.innerHTML = `
    <div class="duel-vs-icon">
      <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
    </div>
    <span class="duel-vs-name">${roomHostName}</span>
    <span class="duel-vs-check">✓</span>
  `;
  duelVsContainer.appendChild(hostEl);

  const vsEl = document.createElement('div');
  vsEl.className = 'duel-vs-divider';
  vsEl.textContent = '⚔️';
  duelVsContainer.appendChild(vsEl);

  const enemyEl = document.createElement('div');
  enemyEl.className = 'duel-vs-card duel-vs-enemy';
  if (currentEnemyName) {
    const enemyStatus = players[currentEnemyName] ? players[currentEnemyName].status : '';
    const isEnemyReady = enemyStatus === 'ready';
    enemyEl.innerHTML = `
      <div class="duel-vs-icon">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
      </div>
      <span class="duel-vs-name">${currentEnemyName}</span>
      ${isEnemyReady ? '<span class="duel-vs-check">✓</span>' : ''}
    `;
  } else {
    enemyEl.classList.add('duel-vs-empty');
    enemyEl.innerHTML = `<span class="duel-vs-name">Waiting Enemy...</span>`;
  }
  duelVsContainer.appendChild(enemyEl);

  if (myRole === 'host') {
    const enemyIsReady = currentEnemyName && players[currentEnemyName] && players[currentEnemyName].status === 'ready';
    btnReady.disabled = !enemyIsReady;
  }
}

btnDeleteRoom.addEventListener('click', () => {
  if (myRole === 'enemy') {
    showOverlay(leaveConfirmOverlay);
    return;
  }
  showOverlay(deleteConfirmOverlay);
});

btnLeaveCancel.addEventListener('click', () => {
  hideOverlay(leaveConfirmOverlay);
});

btnLeaveConfirm.addEventListener('click', () => {
  hideOverlay(leaveConfirmOverlay);
  const updates = {};
  updates['players/' + myName] = null;
  updates['enemy'] = null;
  db.ref('trial-error/24Card/duel/' + roomId).update(updates).then(() => {
    window.location.href = 'index.html';
  }).catch((err) => {
    console.error(err);
    alert('Gagal leave room. Coba lagi.');
  });
});

btnDeleteCancel.addEventListener('click', () => {
  hideOverlay(deleteConfirmOverlay);
});

btnDeleteConfirm.addEventListener('click', () => {
  hideOverlay(deleteConfirmOverlay);
  btnDeleteRoom.disabled = true;
  btnDeleteRoom.textContent = '⏳ Menghapus...';

  db.ref('trial-error/24Card/duel/' + roomId).remove().then(() => {
    window.location.href = 'index.html';
  }).catch((err) => {
    console.error(err);
    alert('Gagal menghapus room. Coba lagi.');
    btnDeleteRoom.disabled = false;
    btnDeleteRoom.textContent = '🗑️ Hapus Room';
  });
});

if (!roomId) {
  roomLoading.innerHTML = '<p>❌ Room ID tidak ditemukan.</p><a href="index.html" class="btn btn-secondary" style="margin-top:16px">← Kembali</a>';
} else {
  roomIdDisplay.textContent = roomId;

  const roomRef = db.ref('trial-error/24Card/duel/' + roomId);

  if (myRole === 'enemy') {
    btnDeleteRoom.textContent = '🚪 Leave Room';
    btnReady.textContent = 'Ready';
    btnReady.className = 'btn btn-ready btn-ready-duel';
    btnReady.disabled = false;
  }

  roomRef.on('value', (snapshot) => {
    const data = snapshot.val();

    if (!data) {
      roomLoading.innerHTML = '<p>❌ Room tidak ditemukan atau sudah kadaluarsa.</p><a href="index.html" class="btn btn-secondary" style="margin-top:16px">← Kembali</a>';
      return;
    }

    roomLoading.style.display = 'none';
    roomContent.style.display = 'block';

    roomNameDisplay.textContent = data.name;
    roomCreatedDisplay.textContent = data.created ? formatTime(data.created) : '-';
    roomExpiredDisplay.textContent = data.expired ? formatTime(data.expired) : '-';

    renderPlayers(data.players || {}, data.enemy || '', data.host || '');

    if (myRole === 'enemy') {
      const myStatus = data.players && data.players[myName] ? data.players[myName].status : '';
      const isReady = myStatus === 'ready';
      btnReady.textContent = isReady ? 'Unready' : 'Ready';
      btnReady.className = 'btn btn-ready ' + (isReady ? 'btn-ready-unready' : 'btn-ready-duel');
    }

    if (myRole === 'host') {
      const enemyIsReady = data.enemy && data.players && data.players[data.enemy] && data.players[data.enemy].status === 'ready';
      btnReady.textContent = 'READY';
      btnReady.className = 'btn btn-ready btn-ready-duel';
      btnReady.disabled = !enemyIsReady;
    }
  }, (err) => {
    console.error(err);
    roomLoading.innerHTML = '<p>❌ Gagal memuat data room.</p><a href="index.html" class="btn btn-secondary" style="margin-top:16px">← Kembali</a>';
  });

  btnReady.addEventListener('click', () => {
    if (myRole === 'enemy') {
      const playerRef = db.ref('trial-error/24Card/duel/' + roomId + '/players/' + myName);
      playerRef.once('value').then((snap) => {
        const data = snap.val();
        const currentStatus = data ? data.status : 'unready';
        const newStatus = currentStatus === 'ready' ? 'unready' : 'ready';
        return playerRef.update({ status: newStatus });
      }).catch((err) => {
        console.error(err);
        alert('Gagal update status. Coba lagi.');
      });
      return;
    }

    alert('Fitur Duel masih dalam pengembangan. Silakan tunggu update selanjutnya.');
  });
}
