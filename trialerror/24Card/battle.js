const infoOverlay = document.getElementById('infoOverlay');
const btnInfoOk = document.getElementById('btnInfoOk');
const btnInfoMode = document.getElementById('btnInfoMode');
const btnHost = document.getElementById('btnHost');
const btnMobile = document.getElementById('btnMobile');

const createRoomOverlay = document.getElementById('createRoomOverlay');
const inputRoomName = document.getElementById('inputRoomName');
const modePickerBtns = document.querySelectorAll('.mode-picker-btn');
const btnCreateRoom = document.getElementById('btnCreateRoom');
const btnCreateCancel = document.getElementById('btnCreateCancel');
const roomNameError = document.getElementById('roomNameError');
const modeError = document.getElementById('modeError');
const inputRoomId = document.getElementById('inputRoomId');
const btnJoinRoom = document.getElementById('btnJoinRoom');
const roomIdError = document.getElementById('roomIdError');

const mobileOverlay = document.getElementById('mobileOverlay');
const inputPlayerName = document.getElementById('inputPlayerName');
const inputMobileRoomId = document.getElementById('inputMobileRoomId');
const btnJoinMobile = document.getElementById('btnJoinMobile');
const btnMobileCancel = document.getElementById('btnMobileCancel');
const mobileError = document.getElementById('mobileError');
const btnBrowseRooms = document.getElementById('btnBrowseRooms');

const roomListOverlay = document.getElementById('roomListOverlay');
const roomListContainer = document.getElementById('roomListContainer');
const btnRoomListClose = document.getElementById('btnRoomListClose');

let selectedMode = null;

function showOverlay(el) {
  el.style.display = 'flex';
}

function hideOverlay(el) {
  el.style.display = 'none';
}

// Info Mode
btnInfoMode.addEventListener('click', () => {
  showOverlay(infoOverlay);
});
btnInfoOk.addEventListener('click', () => {
  hideOverlay(infoOverlay);
});

// Host
btnHost.addEventListener('click', (e) => {
  e.preventDefault();
  resetCreateForm();
  showOverlay(createRoomOverlay);
});

// Mobile
btnMobile.addEventListener('click', (e) => {
  e.preventDefault();
  resetMobileForm();
  showOverlay(mobileOverlay);
});

// --- Host: Create Room ---
inputRoomId.addEventListener('input', () => {
  inputRoomId.value = inputRoomId.value.replace(/\D/g, '').slice(0, 4);
  roomIdError.textContent = '';
  inputRoomId.style.borderColor = '';
});

btnCreateCancel.addEventListener('click', () => {
  hideOverlay(createRoomOverlay);
});

modePickerBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    modePickerBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMode = btn.dataset.mode;
    modeError.textContent = '';
  });
});

function resetCreateForm() {
  inputRoomName.value = '';
  roomNameError.textContent = '';
  modeError.textContent = '';
  selectedMode = null;
  modePickerBtns.forEach((b) => b.classList.remove('active'));
  inputRoomName.style.borderColor = '';
  inputRoomId.value = '';
  roomIdError.textContent = '';
  inputRoomId.style.borderColor = '';
  btnJoinRoom.disabled = false;
  btnJoinRoom.textContent = 'Gunakan Room';
  btnCreateRoom.disabled = false;
  btnCreateRoom.textContent = '+ Create Room';
}

btnCreateRoom.addEventListener('click', () => {
  const name = inputRoomName.value.trim();
  let valid = true;

  roomNameError.textContent = '';
  modeError.textContent = '';
  inputRoomName.style.borderColor = '';

  if (!name) {
    roomNameError.textContent = 'Nama room tidak boleh kosong!';
    inputRoomName.style.borderColor = '#e57373';
    valid = false;
  }

  if (!selectedMode) {
    modeError.textContent = 'Pilih mode permainan!';
    valid = false;
  }

  if (!valid) return;

  const roomId = generateRoomId();
  const now = Date.now();

  btnCreateRoom.disabled = true;
  btnCreateRoom.textContent = '⏳ Membuat...';

  db.ref('trial-error/24Card/battle/' + roomId).set({
    name: name,
    mode: selectedMode,
    status: 'waiting',
    created: now,
    expired: now + 3600000
  }).then(() => {
    window.location.href = 'room.html?roomId=' + roomId;
  }).catch((err) => {
    console.error(err);
    alert('Gagal membuat room. Coba lagi.');
    btnCreateRoom.disabled = false;
    btnCreateRoom.textContent = '+ Create Room';
  });
});

// --- Host: Join existing room ---
btnJoinRoom.addEventListener('click', () => {
  const roomId = inputRoomId.value.trim();
  roomIdError.textContent = '';
  inputRoomId.style.borderColor = '';

  if (!roomId || roomId.length !== 4) {
    roomIdError.textContent = 'Masukkan 4 angka ID room!';
    inputRoomId.style.borderColor = '#e57373';
    return;
  }

  btnJoinRoom.disabled = true;
  btnJoinRoom.textContent = '⏳ Memeriksa...';

  db.ref('trial-error/24Card/battle/' + roomId).once('value').then((snapshot) => {
    const data = snapshot.val();
    if (!data) {
      roomIdError.textContent = 'Room tidak ditemukan!';
      inputRoomId.style.borderColor = '#e57373';
      btnJoinRoom.disabled = false;
      btnJoinRoom.textContent = 'Gunakan Room';
    } else {
      window.location.href = 'room.html?roomId=' + roomId;
    }
  }).catch((err) => {
    console.error(err);
    alert('Gagal memeriksa room. Coba lagi.');
    btnJoinRoom.disabled = false;
    btnJoinRoom.textContent = 'Gunakan Room';
  });
});

// --- Mobile: Join Room ---
inputMobileRoomId.addEventListener('input', () => {
  inputMobileRoomId.value = inputMobileRoomId.value.replace(/\D/g, '').slice(0, 4);
  mobileError.textContent = '';
  inputMobileRoomId.style.borderColor = '';
});

function resetMobileForm() {
  inputPlayerName.value = '';
  inputMobileRoomId.value = '';
  mobileError.textContent = '';
  inputMobileRoomId.style.borderColor = '';
  inputPlayerName.style.borderColor = '';
  btnJoinMobile.disabled = false;
  btnJoinMobile.textContent = 'Join Room';
}

btnMobileCancel.addEventListener('click', () => {
  hideOverlay(mobileOverlay);
});

btnJoinMobile.addEventListener('click', () => {
  const name = inputPlayerName.value.trim();
  const roomId = inputMobileRoomId.value.trim();
  mobileError.textContent = '';
  inputPlayerName.style.borderColor = '';
  inputMobileRoomId.style.borderColor = '';

  if (!name) {
    mobileError.textContent = 'Nama tidak boleh kosong!';
    inputPlayerName.style.borderColor = '#e57373';
    return;
  }

  if (!roomId || roomId.length !== 4) {
    mobileError.textContent = 'Masukkan 4 angka ID room!';
    inputMobileRoomId.style.borderColor = '#e57373';
    return;
  }

  btnJoinMobile.disabled = true;
  btnJoinMobile.textContent = '⏳ Bergabung...';

  db.ref('trial-error/24Card/battle/' + roomId).once('value').then((snapshot) => {
    const data = snapshot.val();
    if (!data) {
      mobileError.textContent = 'Room tidak ditemukan!';
      inputMobileRoomId.style.borderColor = '#e57373';
      btnJoinMobile.disabled = false;
      btnJoinMobile.textContent = 'Join Room';
      return;
    }

    if (data.status !== 'waiting') {
      mobileError.textContent = 'Room sudah mulai bermain!';
      btnJoinMobile.disabled = false;
      btnJoinMobile.textContent = 'Join Room';
      return;
    }

    const players = data.players || {};
    const playerCount = Object.keys(players).length;
    if (playerCount >= 6) {
      mobileError.textContent = 'Room sudah penuh (6/6)!';
      btnJoinMobile.disabled = false;
      btnJoinMobile.textContent = 'Join Room';
      return;
    }

    if (players[name]) {
      mobileError.textContent = 'Nama sudah dipakai di room ini!';
      inputPlayerName.style.borderColor = '#e57373';
      btnJoinMobile.disabled = false;
      btnJoinMobile.textContent = 'Join Room';
      return;
    }

    db.ref('trial-error/24Card/battle/' + roomId + '/players/' + name).set({
      status: 'undready'
    }).then(() => {
      window.location.href = 'mobile.html?roomId=' + roomId + '&name=' + encodeURIComponent(name);
    }).catch((err) => {
      console.error(err);
      alert('Gagal bergabung. Coba lagi.');
      btnJoinMobile.disabled = false;
      btnJoinMobile.textContent = 'Join Room';
    });
  }).catch((err) => {
    console.error(err);
    alert('Gagal memeriksa room. Coba lagi.');
    btnJoinMobile.disabled = false;
    btnJoinMobile.textContent = 'Join Room';
  });
});

// --- Mobile: Browse Rooms ---
btnBrowseRooms.addEventListener('click', () => {
  hideOverlay(mobileOverlay);
  loadRoomList();
  showOverlay(roomListOverlay);
});

btnRoomListClose.addEventListener('click', () => {
  hideOverlay(roomListOverlay);
});

function loadRoomList() {
  roomListContainer.innerHTML = '<p class="room-list-loading">⏳ Memuat daftar room...</p>';

  db.ref('trial-error/24Card/battle/').once('value').then((snapshot) => {
    const all = snapshot.val();
    if (!all) {
      roomListContainer.innerHTML = '<p class="room-list-empty">Belum ada room tersedia.</p>';
      return;
    }

    let html = '';
    const now = Date.now();

    Object.keys(all).sort((a, b) => Number(a) - Number(b)).forEach((roomId) => {
      const room = all[roomId];
      if (room.status !== 'waiting') return;
      if (room.expired && now > room.expired) return;

      const players = room.players || {};
      const playerCount = Object.keys(players).length;

      html += `
        <div class="room-list-item" data-room-id="${roomId}">
          <div class="room-list-left">
            <span class="room-list-id">#${roomId}</span>
            <span class="room-list-name">${room.name}</span>
          </div>
          <div class="room-list-right">
            <span class="room-list-players"><svg class="room-list-player-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg> ${playerCount}/6</span>
          </div>
        </div>
      `;
    });

    if (!html) {
      roomListContainer.innerHTML = '<p class="room-list-empty">Tidak ada room yang tersedia saat ini.</p>';
      return;
    }

    roomListContainer.innerHTML = html;

    roomListContainer.querySelectorAll('.room-list-item').forEach((item) => {
      item.addEventListener('click', () => {
        const roomId = item.dataset.roomId;
        const name = inputPlayerName.value.trim();

        if (!name) {
          hideOverlay(roomListOverlay);
          showOverlay(mobileOverlay);
          inputMobileRoomId.value = roomId;
          mobileError.textContent = 'Masukkan nama terlebih dahulu!';
          inputPlayerName.style.borderColor = '#e57373';
          return;
        }

        hideOverlay(roomListOverlay);

        const roomRef = db.ref('trial-error/24Card/battle/' + roomId);
        roomRef.once('value').then((snapshot) => {
          const data = snapshot.val();
          if (!data || data.status !== 'waiting') {
            alert('Room tidak tersedia.');
            return;
          }
          const players = data.players || {};
          if (Object.keys(players).length >= 6) {
            alert('Room sudah penuh!');
            return;
          }
          if (players[name]) {
            alert('Nama sudah dipakai di room ini!');
            return;
          }
          db.ref('trial-error/24Card/battle/' + roomId + '/players/' + name).set({
            status: 'undready'
          }).then(() => {
            window.location.href = 'mobile.html?roomId=' + roomId + '&name=' + encodeURIComponent(name);
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
  }).catch((err) => {
    console.error(err);
    roomListContainer.innerHTML = '<p class="room-list-empty">Gagal memuat daftar room.</p>';
  });
}

// --- Utility ---
function generateRoomId() {
  let id = '';
  for (let i = 0; i < 4; i++) {
    id += Math.floor(Math.random() * 10);
  }
  return id;
}
