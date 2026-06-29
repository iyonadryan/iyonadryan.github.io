const duelInfoOverlay = document.getElementById('duelInfoOverlay');
const btnDuelInfo = document.getElementById('btnDuelInfo');
const btnDuelInfoOk = document.getElementById('btnDuelInfoOk');
const btnDuelCreate = document.getElementById('btnDuelCreate');
const btnDuelJoin = document.getElementById('btnDuelJoin');
const btnDuelQuick = document.getElementById('btnDuelQuick');

const duelCreateOverlay = document.getElementById('duelCreateOverlay');
const inputDuelCreateName = document.getElementById('inputDuelCreateName');
const inputDuelRoomName = document.getElementById('inputDuelRoomName');
const duelRoomNameError = document.getElementById('duelRoomNameError');
const duelModeError = document.getElementById('duelModeError');
const duelModePickerBtns = document.querySelectorAll('.mode-picker-btn');
const btnDuelCreateConfirm = document.getElementById('btnDuelCreateConfirm');
const btnDuelCreateCancel = document.getElementById('btnDuelCreateCancel');
let duelSelectedMode = null;

const duelJoinOverlay = document.getElementById('duelJoinOverlay');
const inputDuelPlayerName = document.getElementById('inputDuelPlayerName');
const inputDuelJoinRoomId = document.getElementById('inputDuelJoinRoomId');
const duelJoinError = document.getElementById('duelJoinError');
const btnDuelJoinConfirm = document.getElementById('btnDuelJoinConfirm');
const btnDuelJoinCancel = document.getElementById('btnDuelJoinCancel');
const btnDuelBrowseRooms = document.getElementById('btnDuelBrowseRooms');

const duelRoomListOverlay = document.getElementById('duelRoomListOverlay');
const duelRoomSearchInput = document.getElementById('duelRoomSearchInput');
const duelRoomListContainer = document.getElementById('duelRoomListContainer');
const btnDuelRefreshRooms = document.getElementById('btnDuelRefreshRooms');
const btnDuelRoomListClose = document.getElementById('btnDuelRoomListClose');

let duelCachedRooms = [];

function showOverlay(el) {
  el.style.display = 'flex';
}

function hideOverlay(el) {
  el.style.display = 'none';
}

btnDuelInfo.addEventListener('click', () => {
  showOverlay(duelInfoOverlay);
});

btnDuelInfoOk.addEventListener('click', () => {
  hideOverlay(duelInfoOverlay);
});

btnDuelCreate.addEventListener('click', (e) => {
  e.preventDefault();
  inputDuelCreateName.value = '';
  inputDuelRoomName.value = '';
  duelRoomNameError.textContent = '';
  duelModeError.textContent = '';
  inputDuelRoomName.style.borderColor = '';
  duelSelectedMode = null;
  duelModePickerBtns.forEach((b) => b.classList.remove('active'));
  btnDuelCreateConfirm.disabled = false;
  btnDuelCreateConfirm.textContent = 'Lanjutkan';
  showOverlay(duelCreateOverlay);
});

btnDuelCreateCancel.addEventListener('click', () => {
  hideOverlay(duelCreateOverlay);
});

duelModePickerBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    duelModePickerBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    duelSelectedMode = btn.dataset.mode;
    duelModeError.textContent = '';
  });
});

inputDuelCreateName.addEventListener('input', () => {
  duelRoomNameError.textContent = '';
  inputDuelCreateName.style.borderColor = '';
});

inputDuelRoomName.addEventListener('input', () => {
  duelRoomNameError.textContent = '';
  inputDuelRoomName.style.borderColor = '';
});

btnDuelCreateConfirm.addEventListener('click', () => {
  const playerName = inputDuelCreateName.value.trim();
  const roomName = inputDuelRoomName.value.trim();

  duelRoomNameError.textContent = '';
  inputDuelRoomName.style.borderColor = '';

  if (!playerName) {
    duelRoomNameError.textContent = 'Nama tidak boleh kosong!';
    inputDuelCreateName.style.borderColor = '#e57373';
    return;
  }

  if (!roomName) {
    duelRoomNameError.textContent = 'Nama room tidak boleh kosong!';
    inputDuelRoomName.style.borderColor = '#e57373';
    return;
  }

  if (!duelSelectedMode) {
    duelModeError.textContent = 'Pilih mode permainan!';
    return;
  }

  btnDuelCreateConfirm.disabled = true;
  btnDuelCreateConfirm.textContent = '⏳ Membuat...';

  generateUniqueRoomId('trial-error/24Card/duel/').then((roomId) => {
    const now = Date.now();

    db.ref('trial-error/24Card/duel/' + roomId).set({
      name: roomName,
      host: playerName,
      mode: duelSelectedMode,
      status: 'waiting',
      created: now,
      expired: now + 3600000,
      players: {
        [playerName]: { status: 'ready' }
      }
    }).then(() => {
      window.location.href = 'duel-room.html?roomId=' + roomId + '&host=' + encodeURIComponent(playerName);
    }).catch((err) => {
      console.error(err);
      alert('Gagal membuat room. Coba lagi.');
      btnDuelCreateConfirm.disabled = false;
      btnDuelCreateConfirm.textContent = 'Lanjutkan';
    });
  }).catch((err) => {
    console.error(err);
    alert('Gagal membuat room. Coba lagi.');
    btnDuelCreateConfirm.disabled = false;
    btnDuelCreateConfirm.textContent = 'Lanjutkan';
  });
});

// --- Join Room ---
btnDuelJoin.addEventListener('click', (e) => {
  e.preventDefault();
  inputDuelPlayerName.value = '';
  inputDuelJoinRoomId.value = '';
  duelJoinError.textContent = '';
  inputDuelJoinRoomId.style.borderColor = '';
  btnDuelJoinConfirm.disabled = false;
  btnDuelJoinConfirm.textContent = 'Join Room';
  showOverlay(duelJoinOverlay);
});

btnDuelJoinCancel.addEventListener('click', () => {
  hideOverlay(duelJoinOverlay);
});

inputDuelJoinRoomId.addEventListener('input', () => {
  inputDuelJoinRoomId.value = inputDuelJoinRoomId.value.replace(/\D/g, '').slice(0, 4);
  duelJoinError.textContent = '';
  inputDuelJoinRoomId.style.borderColor = '';
});

btnDuelJoinConfirm.addEventListener('click', () => {
  const playerName = inputDuelPlayerName.value.trim();
  const roomId = inputDuelJoinRoomId.value.trim();
  duelJoinError.textContent = '';
  inputDuelPlayerName.style.borderColor = '';
  inputDuelJoinRoomId.style.borderColor = '';

  if (!playerName) {
    duelJoinError.textContent = 'Nama tidak boleh kosong!';
    inputDuelPlayerName.style.borderColor = '#e57373';
    return;
  }

  if (!roomId || roomId.length !== 4) {
    duelJoinError.textContent = 'Masukkan 4 angka ID room!';
    inputDuelJoinRoomId.style.borderColor = '#e57373';
    return;
  }

  btnDuelJoinConfirm.disabled = true;
  btnDuelJoinConfirm.textContent = '⏳ Bergabung...';

  db.ref('trial-error/24Card/duel/' + roomId).once('value').then((snapshot) => {
    const data = snapshot.val();
    if (!data) {
      duelJoinError.textContent = 'Room tidak ditemukan!';
      inputDuelJoinRoomId.style.borderColor = '#e57373';
      btnDuelJoinConfirm.disabled = false;
      btnDuelJoinConfirm.textContent = 'Join Room';
      return;
    }

    if (data.status !== 'waiting') {
      duelJoinError.textContent = 'Room sudah mulai bermain!';
      btnDuelJoinConfirm.disabled = false;
      btnDuelJoinConfirm.textContent = 'Join Room';
      return;
    }

    const players = data.players || {};
    const playerKeys = Object.keys(players);
    if (playerKeys.length >= 2) {
      alert('Room sudah penuh! Silakan cari room lain yang masih tersedia.');
      btnDuelJoinConfirm.disabled = false;
      btnDuelJoinConfirm.textContent = 'Join Room';
      return;
    }

    if (players[playerName]) {
      duelJoinError.textContent = 'Nama sudah dipakai di room ini!';
      inputDuelPlayerName.style.borderColor = '#e57373';
      btnDuelJoinConfirm.disabled = false;
      btnDuelJoinConfirm.textContent = 'Join Room';
      return;
    }

    const updates = {};
    updates['players/' + playerName] = { status: 'unready' };
    updates['enemy'] = playerName;

    db.ref('trial-error/24Card/duel/' + roomId).update(updates).then(() => {
      window.location.href = 'duel-room.html?roomId=' + roomId + '&enemy=' + encodeURIComponent(playerName);
    }).catch((err) => {
      console.error(err);
      alert('Gagal bergabung. Coba lagi.');
      btnDuelJoinConfirm.disabled = false;
      btnDuelJoinConfirm.textContent = 'Join Room';
    });
  }).catch((err) => {
    console.error(err);
    alert('Gagal memeriksa room. Coba lagi.');
    btnDuelJoinConfirm.disabled = false;
    btnDuelJoinConfirm.textContent = 'Join Room';
  });
});

btnDuelQuick.addEventListener('click', (e) => {
  e.preventDefault();
  alert('Fitur Quick Match akan datang!');
});

// --- Browse Rooms ---
btnDuelBrowseRooms.addEventListener('click', () => {
  hideOverlay(duelJoinOverlay);
  loadDuelRoomList();
  showOverlay(duelRoomListOverlay);
});

btnDuelRoomListClose.addEventListener('click', () => {
  hideOverlay(duelRoomListOverlay);
});

btnDuelRefreshRooms.addEventListener('click', () => {
  loadDuelRoomList();
});

duelRoomSearchInput.addEventListener('input', () => {
  renderDuelRoomList(duelRoomSearchInput.value.trim().toLowerCase());
});

function loadDuelRoomList() {
  duelRoomListContainer.innerHTML = '<p class="room-list-loading">⏳ Memuat daftar room...</p>';
  duelRoomSearchInput.value = '';
  duelCachedRooms = [];

  db.ref('trial-error/24Card/duel/').once('value').then((snapshot) => {
    const all = snapshot.val();
    if (!all) {
      duelRoomListContainer.innerHTML = '<p class="room-list-empty">Belum ada room tersedia.</p>';
      return;
    }

    const now = Date.now();
    const expiredRooms = [];

    Object.keys(all).sort((a, b) => Number(a) - Number(b)).forEach((roomId) => {
      const room = all[roomId];
      if (!room.expired || now > room.expired) {
        expiredRooms.push(roomId);
        return;
      }
      if (room.status !== 'waiting') return;

      const players = room.players || {};
      const playerCount = Object.keys(players).length;
      if (playerCount >= 2) return;

      duelCachedRooms.push({ roomId, name: room.name, host: room.host || '-' });
    });

    expiredRooms.forEach((roomId) => {
      db.ref('trial-error/24Card/duel/' + roomId).remove().catch((err) => {
        console.error('Gagal hapus expired room ' + roomId, err);
      });
    });

    renderDuelRoomList('');
  }).catch((err) => {
    console.error(err);
    duelRoomListContainer.innerHTML = '<p class="room-list-empty">Gagal memuat daftar room.</p>';
  });
}

function renderDuelRoomList(filter) {
  let filtered = duelCachedRooms;
  if (filter) {
    filtered = duelCachedRooms.filter((r) => r.roomId.includes(filter) || r.name.toLowerCase().includes(filter));
  }

  if (!filtered.length) {
    duelRoomListContainer.innerHTML = '<p class="room-list-empty">Tidak ada room yang cocok.</p>';
    return;
  }

  let html = '';
  filtered.forEach((r) => {
    html += `
      <div class="room-list-item" data-room-id="${r.roomId}">
        <div class="room-list-left">
          <span class="room-list-id">#${r.roomId}</span>
          <span class="room-list-name">${r.name}</span>
        </div>
        <div class="room-list-right">
          <span class="room-list-players"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="vertical-align:middle;margin-right:2px"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg> ${r.host}</span>
        </div>
      </div>
    `;
  });

  duelRoomListContainer.innerHTML = html;

  duelRoomListContainer.querySelectorAll('.room-list-item').forEach((item) => {
    item.addEventListener('click', () => {
      const roomId = item.dataset.roomId;
      const playerName = inputDuelPlayerName.value.trim();

      if (!playerName) {
        hideOverlay(duelRoomListOverlay);
        showOverlay(duelJoinOverlay);
        inputDuelJoinRoomId.value = roomId;
        duelJoinError.textContent = 'Masukkan nama terlebih dahulu!';
        inputDuelPlayerName.style.borderColor = '#e57373';
        return;
      }

      hideOverlay(duelRoomListOverlay);

      const roomRef = db.ref('trial-error/24Card/duel/' + roomId);
      roomRef.once('value').then((snapshot) => {
        const data = snapshot.val();
        if (!data || data.status !== 'waiting') {
          alert('Room tidak tersedia.');
          return;
        }
        const players = data.players || {};
        if (Object.keys(players).length >= 2) {
          alert('Room sudah penuh! Silakan cari room lain yang masih tersedia.');
          return;
        }
        if (players[playerName]) {
          alert('Nama sudah dipakai di room ini!');
          return;
        }
        const updates = {};
        updates['players/' + playerName] = { status: 'unready' };
        updates['enemy'] = playerName;

        db.ref('trial-error/24Card/duel/' + roomId).update(updates).then(() => {
          window.location.href = 'duel-room.html?roomId=' + roomId + '&enemy=' + encodeURIComponent(playerName);
        }).catch((err) => {
          console.error(err);
          alert('Gagal bergabung. Coba lagi.');
        });
      }).catch((err) => {
        console.error(err);
        alert('Gagal memeriksa room.');
      });
    });
  });
}

// --- Utility ---
function randomRoomId() {
  let id = '';
  for (let i = 0; i < 4; i++) {
    id += Math.floor(Math.random() * 10);
  }
  return id;
}

function generateUniqueRoomId(basePath) {
  return new Promise((resolve, reject) => {
    function tryGenerate() {
      const id = randomRoomId();
      db.ref(basePath + id).once('value').then((snap) => {
        if (snap.val()) {
          tryGenerate();
        } else {
          resolve(id);
        }
      }).catch(reject);
    }
    tryGenerate();
  });
}
