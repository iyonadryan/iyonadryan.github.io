const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');
const playerName = params.get('name');

const mobileRoomId = document.getElementById('mobileRoomId');
const mobilePlayerName = document.getElementById('mobilePlayerName');
const mobileStatusText = document.getElementById('mobileStatusText');
const mobileStatusDisplay = document.getElementById('mobileStatusDisplay');
const btnPetunjuk = document.getElementById('btnPetunjuk');
const btnReady = document.getElementById('btnReady');
const btnLeave = document.getElementById('btnLeave');
const leaveConfirmOverlay = document.getElementById('leaveConfirmOverlay');
const btnLeaveCancel = document.getElementById('btnLeaveCancel');
const btnLeaveConfirm = document.getElementById('btnLeaveConfirm');
const petunjukOverlay = document.getElementById('petunjukOverlay');
const btnPetunjukOk = document.getElementById('btnPetunjukOk');

if (!roomId || !playerName) {
  document.querySelector('.mobile-screen').innerHTML = `
    <p style="color:rgba(255,255,255,0.5);text-align:center;padding:60px 0">
      ❌ Data tidak lengkap. <a href="index.html" style="color:#667eea">Kembali ke menu</a>
    </p>
  `;
} else {
  mobileRoomId.textContent = roomId;
  mobilePlayerName.textContent = playerName;

  const playerRef = db.ref('trial-error/24Card/battle/' + roomId + '/players/' + playerName);

  // Petunjuk
  btnPetunjuk.addEventListener('click', () => {
    showOverlay(petunjukOverlay);
  });

  btnPetunjukOk.addEventListener('click', () => {
    hideOverlay(petunjukOverlay);
  });

  // Real-time status listener
  playerRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    const status = data.status || 'undready';
    updateStatusDisplay(status);
  });

  function updateStatusDisplay(status) {
    const isReady = status === 'ready';

    mobileStatusText.textContent = isReady ? 'Ready' : 'Unready';
    mobileStatusText.className = isReady ? 'status-ready' : 'status-undready';

    btnReady.textContent = isReady ? 'Unready' : 'Ready';
    btnReady.className = 'mobile-btn ' + (isReady ? 'mobile-btn-orange' : 'mobile-btn-green');
    btnReady.disabled = false;
  }

  // Toggle Ready/Unready
  btnReady.addEventListener('click', () => {
    btnReady.disabled = true;
    btnReady.textContent = '⏳ ...';

    playerRef.once('value').then((snapshot) => {
      const data = snapshot.val();
      const currentStatus = data ? data.status : 'undready';
      const newStatus = currentStatus === 'ready' ? 'undready' : 'ready';

      return playerRef.update({ status: newStatus });
    }).catch((err) => {
      console.error(err);
      alert('Gagal update status. Coba lagi.');
      btnReady.disabled = false;
    });
  });

  // Leave Room
  btnLeave.addEventListener('click', () => {
    showOverlay(leaveConfirmOverlay);
  });

  btnLeaveCancel.addEventListener('click', () => {
    hideOverlay(leaveConfirmOverlay);
  });

  btnLeaveConfirm.addEventListener('click', () => {
    hideOverlay(leaveConfirmOverlay);
    btnLeave.disabled = true;
    btnLeave.textContent = '⏳ ...';

    playerRef.remove().then(() => {
      window.location.href = 'index.html';
    }).catch((err) => {
      console.error(err);
      alert('Gagal keluar room. Coba lagi.');
      btnLeave.disabled = false;
      btnLeave.textContent = 'Leave Room';
    });
  });
}

function showOverlay(el) {
  el.style.display = 'flex';
}

function hideOverlay(el) {
  el.style.display = 'none';
}
