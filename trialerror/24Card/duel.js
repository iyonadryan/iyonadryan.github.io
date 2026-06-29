const duelInfoOverlay = document.getElementById('duelInfoOverlay');
const btnDuelInfo = document.getElementById('btnDuelInfo');
const btnDuelInfoOk = document.getElementById('btnDuelInfoOk');
const btnDuelCreate = document.getElementById('btnDuelCreate');
const btnDuelJoin = document.getElementById('btnDuelJoin');
const btnDuelQuick = document.getElementById('btnDuelQuick');
const duelPlayerName = document.getElementById('duelPlayerName');

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
  const name = duelPlayerName.value.trim();
  if (!name) {
    duelPlayerName.style.borderColor = '#e57373';
    duelPlayerName.focus();
    return;
  }
  duelPlayerName.style.borderColor = '';
  alert('Fitur Create Room akan datang!');
});

btnDuelJoin.addEventListener('click', (e) => {
  e.preventDefault();
  const name = duelPlayerName.value.trim();
  if (!name) {
    duelPlayerName.style.borderColor = '#e57373';
    duelPlayerName.focus();
    return;
  }
  duelPlayerName.style.borderColor = '';
  alert('Fitur Join Room akan datang!');
});

btnDuelQuick.addEventListener('click', (e) => {
  e.preventDefault();
  const name = duelPlayerName.value.trim();
  if (!name) {
    duelPlayerName.style.borderColor = '#e57373';
    duelPlayerName.focus();
    return;
  }
  duelPlayerName.style.borderColor = '';
  alert('Fitur Quick Match akan datang!');
});

duelPlayerName.addEventListener('input', () => {
  duelPlayerName.style.borderColor = '';
});
