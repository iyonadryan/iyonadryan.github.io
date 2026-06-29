const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');

const roomLoading = document.getElementById('roomLoading');
const roomContent = document.getElementById('roomContent');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const roomNameDisplay = document.getElementById('roomNameDisplay');
const roomModeDisplay = document.getElementById('roomModeDisplay');
const roomCreatedDisplay = document.getElementById('roomCreatedDisplay');
const roomExpiredDisplay = document.getElementById('roomExpiredDisplay');
const playerGrid = document.getElementById('playerGrid');
const playersCount = document.getElementById('playersCount');
const btnReady = document.getElementById('btnReady');
const btnDeleteRoom = document.getElementById('btnDeleteRoom');
const deleteConfirmOverlay = document.getElementById('deleteConfirmOverlay');
const btnDeleteCancel = document.getElementById('btnDeleteCancel');
const btnDeleteConfirm = document.getElementById('btnDeleteConfirm');

const MAX_PLAYERS = 6;

function showOverlay(el) {
  el.style.display = 'flex';
}

function hideOverlay(el) {
  el.style.display = 'none';
}

function getPlayerColor(index) {
  const hue = (index * 47 + 17) % 360;
  return {
    bg: `hsla(${hue}, 55%, 45%, 0.25)`,
    border: `hsla(${hue}, 55%, 55%, 0.3)`,
    accent: `hsla(${hue}, 55%, 65%, 0.9)`
  };
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

function renderPlayers(playerObj) {
  playerGrid.innerHTML = '';
  const entries = playerObj ? Object.keys(playerObj) : [];
  const count = entries.length;
  let readyCount = 0;

  entries.forEach((name, i) => {
    const status = playerObj[name].status || 'undready';
    if (status === 'ready') readyCount++;

    const colors = getPlayerColor(i);
    const slot = document.createElement('div');
    slot.className = 'player-slot';
    slot.style.cssText = `
      background: ${colors.bg};
      border-color: ${colors.border};
    `;
    slot.innerHTML = `
      <span class="player-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></span>
      <span class="player-name" style="color:${colors.accent}">${name}</span>
      ${status === 'ready' ? '<span class="player-check">✓</span>' : ''}
    `;
    playerGrid.appendChild(slot);
  });

  for (let i = count; i < MAX_PLAYERS; i++) {
    const slot = document.createElement('div');
    slot.className = 'player-slot player-slot-empty';
    slot.innerHTML = `<span class="player-slot-empty-text">Kosong</span>`;
    playerGrid.appendChild(slot);
  }

  playersCount.textContent = `Ready: ${readyCount}/${count}`;

  const allReady = count >= 2 && readyCount === count;
  btnReady.disabled = !allReady;
}

btnDeleteRoom.addEventListener('click', () => {
  showOverlay(deleteConfirmOverlay);
});

btnDeleteCancel.addEventListener('click', () => {
  hideOverlay(deleteConfirmOverlay);
});

btnDeleteConfirm.addEventListener('click', () => {
  hideOverlay(deleteConfirmOverlay);
  btnDeleteRoom.disabled = true;
  btnDeleteRoom.textContent = '⏳ Menghapus...';

  db.ref('trial-error/24Card/battle/' + roomId).remove().then(() => {
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

  const roomRef = db.ref('trial-error/24Card/battle/' + roomId);

  roomRef.on('value', (snapshot) => {
    const data = snapshot.val();

    if (!data) {
      roomLoading.innerHTML = '<p>❌ Room tidak ditemukan atau sudah kadaluarsa.</p><a href="index.html" class="btn btn-secondary" style="margin-top:16px">← Kembali</a>';
      return;
    }

    roomLoading.style.display = 'none';
    roomContent.style.display = 'block';

    roomNameDisplay.textContent = data.name;
    roomModeDisplay.textContent = 'Mode ' + data.mode;
    roomCreatedDisplay.textContent = data.created ? formatTime(data.created) : '-';
    roomExpiredDisplay.textContent = data.expired ? formatTime(data.expired) : '-';

    const now = Date.now();
    if (data.expired && now > data.expired) {
      document.querySelector('.room-time-expired').textContent += ' (Kadaluarsa)';
      document.querySelector('.room-time-expired').style.color = '#e57373';
    }

    renderPlayers(data.players || {});
  }, (err) => {
    console.error(err);
    roomLoading.innerHTML = '<p>❌ Gagal memuat data room.</p><a href="index.html" class="btn btn-secondary" style="margin-top:16px">← Kembali</a>';
  });

  btnReady.addEventListener('click', () => {
    roomRef.once('value').then((snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      const players = data.players || {};
      const updates = {};

      Object.keys(players).forEach((name) => {
        updates['players/' + name + '/life'] = 100;
      });

      updates['status'] = 'play';

      btnReady.disabled = true;
      btnReady.textContent = '⏳ ...';

      roomRef.update(updates).then(() => {
        window.location.href = 'battle-host.html?roomId=' + roomId;
      }).catch((err) => {
        console.error(err);
        alert('Gagal memulai game. Coba lagi.');
        btnReady.disabled = false;
        btnReady.textContent = 'READY';
      });
    });
  });
}
