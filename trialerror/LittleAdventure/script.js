(function () {
  "use strict";

  // ================= Konfigurasi sprite =================
  // Sprite sheet karakter: 3 kolom x 4 baris, tiap frame 32x32px asli.
  // Baris:  0 = jalan bawah, 1 = jalan kiri, 2 = jalan kanan, 3 = jalan atas
  // Kolom:  0 & 2 = kaki melangkah, 1 = tengah/idle (dipakai juga sbg pose diam)
  // Semua file di CHARACTER_FILES (lihat bawah) sama persis formatnya
  // (32x32/frame, 3x4), jadi ganti karakter cuma perlu ganti backgroundImage.
  const FRAME_SRC = 32; // px, ukuran asli 1 frame di file PNG
  const SHEET_COLS = 3;
  const SHEET_ROWS = 4;
  const SCALE = 1.5; // pixel-art diperbesar 1.5x biar keliatan jelas di layar
  const FRAME = FRAME_SRC * SCALE; // ukuran 1 frame setelah discale (48px)

  // Daftar semua file sprite yang tersedia per gender, dari isi folder
  // img/character/Male & img/character/Female apa adanya (banyak file tidak
  // punya keempat varian -1/-2/-3/-4 lengkap, mis. "Male 18" cuma ada -1) —
  // makanya daftarnya ditulis apa adanya sbg data, bukan digenerate dari pola
  // angka yang diasumsikan.
  const CHARACTER_FILES = {
    Male: [
      "Male 01-1.png", "Male 01-2.png", "Male 01-3.png", "Male 01-4.png",
      "Male 02-1.png", "Male 02-2.png", "Male 02-3.png", "Male 02-4.png",
      "Male 03-1.png", "Male 03-2.png", "Male 03-3.png", "Male 03-4.png",
      "Male 04-1.png", "Male 04-2.png", "Male 04-3.png", "Male 04-4.png",
      "Male 05-1.png", "Male 05-2.png", "Male 05-3.png", "Male 05-4.png",
      "Male 06-1.png", "Male 06-2.png", "Male 06-3.png", "Male 06-4.png",
      "Male 07-1.png", "Male 07-2.png", "Male 07-3.png", "Male 07-4.png",
      "Male 08-1.png", "Male 08-2.png", "Male 08-3.png", "Male 08-4.png",
      "Male 09-1.png", "Male 09-2.png", "Male 09-3.png", "Male 09-4.png",
      "Male 10-1.png", "Male 10-2.png", "Male 10-3.png", "Male 10-4.png",
      "Male 11-1.png", "Male 11-2.png", "Male 11-3.png", "Male 11-4.png",
      "Male 12-1.png", "Male 12-2.png", "Male 12-3.png", "Male 12-4.png",
      "Male 13-1.png", "Male 13-2.png", "Male 13-3.png", "Male 13-4.png",
      "Male 14-1.png", "Male 14-2.png", "Male 14-3.png", "Male 14-4.png",
      "Male 15-1.png", "Male 15-2.png", "Male 15-3.png", "Male 15-4.png",
      "Male 16-1.png", "Male 16-2.png", "Male 16-3.png", "Male 16-4.png",
      "Male 17-1.png", "Male 17-2.png", "Male 17-3.png", "Male 17-4.png",
      "Male 18-1.png",
    ],
    Female: [
      "Female 01-1.png", "Female 01-2.png", "Female 01-3.png", "Female 01-4.png",
      "Female 02-1.png", "Female 02-2.png", "Female 02-3.png", "Female 02-4.png",
      "Female 03-1.png", "Female 03-2.png", "Female 03-3.png", "Female 03-4.png",
      "Female 04-1.png", "Female 04-2.png", "Female 04-3.png", "Female 04-4.png",
      "Female 05-1.png", "Female 05-2.png", "Female 05-3.png", "Female 05-4.png",
      "Female 06-1.png", "Female 06-2.png", "Female 06-3.png", "Female 06-4.png",
      "Female 07-1.png", "Female 07-2.png", "Female 07-3.png", "Female 07-4.png",
      "Female 08-1.png", "Female 08-2.png", "Female 08-3.png", "Female 08-4.png",
      "Female 09-1.png", "Female 09-2.png", "Female 09-3.png", "Female 09-4.png",
      "Female 10-1.png", "Female 10-2.png", "Female 10-3.png", "Female 10-4.png",
      "Female 11-1.png", "Female 11-2.png", "Female 11-3.png", "Female 11-4.png",
      "Female 12-1.png", "Female 12-2.png", "Female 12-3.png", "Female 12-4.png",
      "Female 13-1.png", "Female 13-2.png", "Female 13-3.png", "Female 13-4.png",
      "Female 14-1.png", "Female 14-2.png", "Female 14-3.png", "Female 14-4.png",
      "Female 15-1.png", "Female 15-2.png", "Female 15-3.png", "Female 15-4.png",
      "Female 16-1.png", "Female 16-2.png", "Female 16-3.png", "Female 16-4.png",
      "Female 17-1.png", "Female 17-2.png", "Female 17-3.png", "Female 17-4.png",
      "Female 18-1.png", "Female 18-2.png", "Female 18-3.png", "Female 18-4.png",
      "Female 19-1.png", "Female 19-2.png", "Female 19-3.png", "Female 19-4.png",
      "Female 20-1.png", "Female 20-2.png", "Female 20-3.png", "Female 20-4.png",
      "Female 21-1.png", "Female 21-2.png", "Female 21-3.png", "Female 21-4.png",
      "Female 22-1.png", "Female 22-2.png", "Female 22-3.png", "Female 22-4.png",
      "Female 23-1.png", "Female 24-1.png", "Female 25-1.png",
    ],
  };
  const THUMB_SIZE = 48; // px, ukuran tiap kotak preview di grid pilih karakter

  function characterPath(gender, file) {
    return `img/character/${gender}/${file}`;
  }

  let currentGender = "Male"; // gender karakter yang lagi dipakai
  let currentFile = CHARACTER_FILES.Male[0]; // file spesifik yang lagi dipakai
  let pickerGender = currentGender; // tab gender yang lagi ditampilkan di picker (belum tentu dipakai)

  const ROW = { down: 0, left: 1, right: 2, up: 3 };

  // Urutan kolom saat animasi jalan: tengah -> kiri -> tengah -> kanan,
  // berulang selama tombol arah ditahan. Kolom 1 juga dipakai sbg idle.
  const WALK_FRAMES = [1, 0, 1, 2];
  const IDLE_FRAME = 1;
  const FRAME_DURATION = 140; // ms per pergantian frame animasi jalan
  const SPEED = 2.4; // px per frame animasi (~60fps) saat bergerak
  const WALK_SLOW_FACTOR = 0.5; // dikali ke SPEED, dibagi ke FRAME_DURATION saat Shift ditahan (jalan pelan)

  // ================= Konfigurasi peta dunia =================
  // Gambar peta (persegi, hasil tile map) — diskalakan pakai SCALE yang SAMA
  // dgn karakter di atas, supaya rasio karakter thd peta tetap konsisten.
  const MAP_SRC = "img/samplemap.png";
  const MAP_SRC_SIZE = 1920; // px, ukuran asli map (persegi: 1920x1920)

  // Dunia (#worldLayer) jauh lebih besar dari jendela kamera (#gameWorld)
  // supaya ada ruang buat karakter jalan-jalan & kameranya kelihatan geser.
  // Ukurannya sekarang mengikuti ukuran peta setelah discale (bukan lagi
  // angka arbitrer) — karakter dibatasi persis ke tepi gambar peta.
  const WORLD_WIDTH = MAP_SRC_SIZE * SCALE;
  const WORLD_HEIGHT = MAP_SRC_SIZE * SCALE;
  // 0-1: seberapa cepat kamera "mengejar" posisi target (karakter di tengah).
  // Makin kecil, makin nge-lag/lambat & smooth; makin besar, makin ketat
  // nempel ke karakter (1 = langsung nempel tanpa jeda sama sekali).
  const CAMERA_SMOOTH = 0.08;

  const KEY_TO_DIR = {
    ArrowUp: "up", w: "up", W: "up",
    ArrowDown: "down", s: "down", S: "down",
    ArrowLeft: "left", a: "left", A: "left",
    ArrowRight: "right", d: "right", D: "right",
  };

  const character = document.getElementById("character");
  const viewport = document.getElementById("gameWorld");
  const worldLayer = document.getElementById("worldLayer");

  const changeCharacterBtn = document.getElementById("changeCharacterBtn");
  const characterPickerOverlay = document.getElementById("characterPickerOverlay");
  const closePickerBtn = document.getElementById("closePickerBtn");
  const genderTabs = document.getElementById("genderTabs");
  const characterGrid = document.getElementById("characterGrid");

  const chatInput = document.getElementById("chatInput");
  const speechBubble = document.getElementById("speechBubble");
  const BUBBLE_DURATION = 4000; // ms, bubble ilang otomatis stlh sekian lama

  let x = 0; // posisi karakter dalam koordinat dunia (bukan koordinat layar)
  let y = 0;
  let camX = 0; // posisi kamera (pojok kiri-atas jendela) dalam koordinat dunia
  let camY = 0;
  let facing = "down";
  let moving = false;
  let walkFrameIndex = 0;
  let lastWalkFrameTime = 0;

  // Arah yang lagi ditahan, disimpan berurutan (bukan Set) supaya arah yang
  // "menang" selalu yang PALING BARU ditekan & masih ditahan — jadi kalau
  // user menekan dua arah sekaligus (mis. Kanan lalu Atas), karakter ngikut
  // arah terakhir, dan begitu dilepas otomatis balik ke arah sebelumnya yang
  // masih ditahan (bukan langsung berhenti total).
  let heldDirections = [];

  // Tahan Shift = jalan pelan (mode "sneak/walk"). Kecepatan gerak & animasi
  // sama-sama diperlambat setengah kali lipat (dikali 0.5) selagi ditahan.
  let shiftHeld = false;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function addDirection(dir) {
    const idx = heldDirections.indexOf(dir);
    if (idx !== -1) heldDirections.splice(idx, 1);
    heldDirections.push(dir);
  }

  function removeDirection(dir) {
    const idx = heldDirections.indexOf(dir);
    if (idx !== -1) heldDirections.splice(idx, 1);
  }

  window.addEventListener("keydown", (e) => {
    if (document.activeElement === chatInput) return; // lagi ngetik chat, jangan dianggap tombol gerak
    const dir = KEY_TO_DIR[e.key];
    if (!dir) return;
    e.preventDefault(); // tombol panah jangan sampai scroll halaman
    addDirection(dir);
  });

  window.addEventListener("keyup", (e) => {
    const dir = KEY_TO_DIR[e.key];
    if (!dir) return;
    removeDirection(dir);
  });

  window.addEventListener("keydown", (e) => {
    if (document.activeElement === chatInput) return; // lagi ngetik chat, jangan dianggap tombol jalan-pelan
    if (e.key === "Shift") shiftHeld = true;
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "Shift") shiftHeld = false;
  });

  // Kalau window kehilangan fokus (alt-tab dll), lepas semua tombol supaya
  // karakter tidak "nyangkut" jalan terus walau tombolnya sudah tidak ditekan.
  window.addEventListener("blur", () => {
    heldDirections = [];
    shiftHeld = false;
  });

  function setSpriteFrame(row, col) {
    character.style.backgroundPosition = `-${col * FRAME}px -${row * FRAME}px`;
  }

  function updateMovement(dt) {
    const dir = heldDirections[heldDirections.length - 1];
    moving = !!dir;
    if (!moving) return;

    facing = dir;
    const speed = shiftHeld ? SPEED * WALK_SLOW_FACTOR : SPEED;
    const dist = speed * dt;
    if (dir === "up") y -= dist;
    if (dir === "down") y += dist;
    if (dir === "left") x -= dist;
    if (dir === "right") x += dist;

    // Karakter dibatasi ke batas DUNIA (bukan lagi batas jendela kamera).
    x = clamp(x, 0, WORLD_WIDTH - FRAME);
    y = clamp(y, 0, WORLD_HEIGHT - FRAME);

    character.style.transform = `translate(${x}px, ${y}px)`;
  }

  // Kamera "mengejar" titik yang bikin karakter tepat di tengah jendela,
  // tapi tidak langsung nempel — didekati sedikit demi sedikit tiap frame
  // (exponential smoothing) supaya gerakannya smooth & sedikit "tertinggal"
  // dari karakter, baru menyusul pelan-pelan sampai karakter balik ke tengah
  // begitu ia berhenti.
  function updateCamera(dt) {
    const viewW = viewport.clientWidth;
    const viewH = viewport.clientHeight;

    const targetCamX = clamp(x + FRAME / 2 - viewW / 2, 0, WORLD_WIDTH - viewW);
    const targetCamY = clamp(y + FRAME / 2 - viewH / 2, 0, WORLD_HEIGHT - viewH);

    // 1 - (1-smooth)^dt: versi CAMERA_SMOOTH yang disesuaikan ke delta time,
    // supaya kecepatan "mengejar" tetap konsisten walau framerate beda-beda.
    const t = 1 - Math.pow(1 - CAMERA_SMOOTH, dt);
    camX += (targetCamX - camX) * t;
    camY += (targetCamY - camY) * t;

    worldLayer.style.transform = `translate(${-camX}px, ${-camY}px)`;
  }

  function updateAnimation(time) {
    if (!moving) {
      walkFrameIndex = 0;
      lastWalkFrameTime = time;
      setSpriteFrame(ROW[facing], IDLE_FRAME);
      return;
    }

    // Shift ditahan -> animasi jalan ikut diperlambat (durasi per frame dibagi
    // WALK_SLOW_FACTOR, bukan dikali, krn makin besar durasi = makin lambat).
    const frameDuration = shiftHeld ? FRAME_DURATION / WALK_SLOW_FACTOR : FRAME_DURATION;
    if (time - lastWalkFrameTime >= frameDuration) {
      walkFrameIndex = (walkFrameIndex + 1) % WALK_FRAMES.length;
      lastWalkFrameTime = time;
    }
    setSpriteFrame(ROW[facing], WALK_FRAMES[walkFrameIndex]);
  }

  // ================= Ganti karakter (picker Male/Female) =================
  function setCharacterSprite(gender, file) {
    currentGender = gender;
    currentFile = file;
    character.style.backgroundImage = `url("${characterPath(gender, file)}")`;
  }

  // Isi ulang grid thumbnail sesuai tab gender yang lagi ditampilkan
  // (pickerGender) — tiap thumbnail nge-crop pose idle-bawah (baris 0,
  // kolom tengah) dari sprite sheet-nya sendiri lewat background-position,
  // jadi tidak perlu file preview terpisah.
  function renderCharacterGrid() {
    characterGrid.innerHTML = "";
    CHARACTER_FILES[pickerGender].forEach((file) => {
      const thumb = document.createElement("button");
      thumb.type = "button";
      thumb.className = "character-thumb";
      if (pickerGender === currentGender && file === currentFile) {
        thumb.classList.add("selected");
      }
      thumb.title = file.replace(".png", "");
      thumb.style.backgroundImage = `url("${characterPath(pickerGender, file)}")`;
      thumb.style.backgroundSize = `${THUMB_SIZE * SHEET_COLS}px ${THUMB_SIZE * SHEET_ROWS}px`;
      thumb.style.backgroundPosition = `-${IDLE_FRAME * THUMB_SIZE}px -${ROW.down * THUMB_SIZE}px`;
      thumb.addEventListener("click", () => {
        setCharacterSprite(pickerGender, file);
        closeCharacterPicker();
      });
      characterGrid.appendChild(thumb);
    });
  }

  function openCharacterPicker() {
    pickerGender = currentGender;
    genderTabs.querySelectorAll(".gender-tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.gender === pickerGender);
    });
    renderCharacterGrid();
    characterPickerOverlay.classList.add("open");
  }

  function closeCharacterPicker() {
    characterPickerOverlay.classList.remove("open");
  }

  changeCharacterBtn.addEventListener("click", openCharacterPicker);
  closePickerBtn.addEventListener("click", closeCharacterPicker);
  characterPickerOverlay.addEventListener("click", (e) => {
    if (e.target === characterPickerOverlay) closeCharacterPicker();
  });
  genderTabs.querySelectorAll(".gender-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      pickerGender = tab.dataset.gender;
      genderTabs.querySelectorAll(".gender-tab").forEach((t) => t.classList.toggle("active", t === tab));
      renderCharacterGrid();
    });
  });

  // ================= Ngomong (chat bubble) =================
  const BUBBLE_MAX_CHARS_PER_LINE = 30;
  let bubbleHideTimer = null;

  function openChatInput() {
    chatInput.hidden = false;
    chatInput.value = "";
    chatInput.focus();
  }

  function closeChatInput() {
    chatInput.hidden = true;
    chatInput.blur();
  }

  // Pecah teks jadi baris maks BUBBLE_MAX_CHARS_PER_LINE karakter, greedy
  // word-wrap (pecah di spasi selama muat). Kata yang sendirian sudah lebih
  // panjang dari batas (jarang, tapi bisa terjadi) dipaksa dipotong per
  // BUBBLE_MAX_CHARS_PER_LINE juga, supaya tidak ada satu baris pun yang
  // kepanjangan.
  function wrapText(text, maxChars) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let current = "";
    words.forEach((word) => {
      if (word.length > maxChars) {
        if (current) {
          lines.push(current);
          current = "";
        }
        for (let i = 0; i < word.length; i += maxChars) {
          lines.push(word.slice(i, i + maxChars));
        }
        return;
      }
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > maxChars) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    });
    if (current) lines.push(current);
    return lines;
  }

  function showSpeechBubble(text) {
    speechBubble.textContent = wrapText(text, BUBBLE_MAX_CHARS_PER_LINE).join("\n");
    speechBubble.classList.add("visible");
    clearTimeout(bubbleHideTimer);
    bubbleHideTimer = setTimeout(() => {
      speechBubble.classList.remove("visible");
    }, BUBBLE_DURATION);
  }

  // Enter di luar chat input = buka input; Enter di dalam chat input = submit
  // (tutup input, tampilkan bubble kalau ada teksnya, batal kalau kosong).
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (document.activeElement === chatInput) {
      const text = chatInput.value.trim();
      closeChatInput();
      if (text) showSpeechBubble(text);
    } else {
      openChatInput();
    }
  });

  let lastTime = 0;
  function loop(time) {
    // Normalisasi delta time ke satuan "per frame 60fps" supaya SPEED tetap
    // konsisten walau refresh rate layar beda-beda.
    const dt = lastTime ? (time - lastTime) / (1000 / 60) : 1;
    lastTime = time;

    updateMovement(dt);
    updateCamera(dt);
    updateAnimation(time);

    requestAnimationFrame(loop);
  }

  function init() {
    character.style.width = `${FRAME}px`;
    character.style.height = `${FRAME}px`;
    character.style.backgroundImage = `url("${characterPath(currentGender, currentFile)}")`;
    character.style.backgroundSize = `${FRAME * SHEET_COLS}px ${FRAME * SHEET_ROWS}px`;

    worldLayer.style.width = `${WORLD_WIDTH}px`;
    worldLayer.style.height = `${WORLD_HEIGHT}px`;
    worldLayer.style.backgroundImage = `url("${MAP_SRC}")`;
    worldLayer.style.backgroundSize = `${WORLD_WIDTH}px ${WORLD_HEIGHT}px`;

    // Mulai di tengah dunia, menghadap bawah, pose idle.
    x = (WORLD_WIDTH - FRAME) / 2;
    y = (WORLD_HEIGHT - FRAME) / 2;
    character.style.transform = `translate(${x}px, ${y}px)`;
    setSpriteFrame(ROW.down, IDLE_FRAME);

    // Kamera langsung pas di tengah karakter sejak awal (tanpa animasi
    // "mengejar" pas load pertama kali).
    const viewW = viewport.clientWidth;
    const viewH = viewport.clientHeight;
    camX = clamp(x + FRAME / 2 - viewW / 2, 0, WORLD_WIDTH - viewW);
    camY = clamp(y + FRAME / 2 - viewH / 2, 0, WORLD_HEIGHT - viewH);
    worldLayer.style.transform = `translate(${-camX}px, ${-camY}px)`;

    requestAnimationFrame(loop);
  }

  init();
})();
