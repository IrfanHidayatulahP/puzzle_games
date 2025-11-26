/**
 * controllers/sketch.js — Robust & compatible version
 * - Single source of truth for globals used by puzzle.js
 * - Fetch /api/levels, load images (proxied if remote)
 * - Set refImg.src to same URL canvas uses (no mismatch)
 * - Provide fallback initTiles / handleTileClick if puzzle.js not present
 */

const CANVAS_SIZE = 600;

// Shared global state (only defined here)
let img = null;             // alias expected by puzzle.js
let tiles = [];
let cols = 3;
let rows = 3;
let selected = -1;
let solved = false;
let tileW = 0;
let tileH = 0;

let levels = [];
let currentLevelIdx = 0;

let isLoading = true;

// --- p5 preload (optional audio) ---
function preload() {
  // keep minimal so preload doesn't break if audio missing
  try {
    // loadSound('/assets/mixkit-game-level-music-689.wav'); // optional
  } catch (e) {
    // ignore
  }
}

// --- setup ---
function setup() {
  const c = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
  c.parent('sketch-holder');

  // Wire UI safely
  const shuffleBtn = document.getElementById('shuffleBtn');
  if (shuffleBtn) shuffleBtn.addEventListener('click', () => {
    if (!isLoading) {
      if (typeof shuffleTiles === 'function') shuffleTiles();
      else shuffleTilesLocal();
    }
  });

  const solveBtn = document.getElementById('solveBtn');
  if (solveBtn) solveBtn.addEventListener('click', () => {
    if (!isLoading) return;
    // cheat: put correct positions
    tiles.forEach(t => t.currentIndex = t.correctIndex);
    solved = true;
    const nextBtn = document.getElementById('nextLevelBtn');
    if (nextBtn) nextBtn.style.display = 'block';
  });

  const nextBtn = document.getElementById('nextLevelBtn');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => loadLevel(currentLevelIdx + 1));
    nextBtn.style.display = 'none';
  }

  // fetch levels then load first level
  fetch('/api/levels')
    .then(r => {
      if (!r.ok) throw new Error('status ' + r.status);
      return r.json();
    })
    .then(data => {
      console.log('[levels] fetched', data);
      levels = data;
      if (!levels || levels.length === 0) {
        console.warn('[levels] empty - using fallback single level');
        levels = [{ level: 1, cols: 3, rows: 3, diff: 'Mudah', name: 'Fallback', desc: '', imageUrl: '/assets/ai-generated-8085814.jpg' }];
      }
      currentLevelIdx = 0;
      loadLevel(currentLevelIdx);
    })
    .catch(err => {
      console.error('[levels] fetch failed', err);
      // fallback
      levels = [{ level: 1, cols: 3, rows: 3, diff: 'Mudah', name: 'Fallback', desc: '', imageUrl: '/assets/ai-generated-8085814.jpg' }];
      currentLevelIdx = 0;
      loadLevel(currentLevelIdx);
    });
}

// --- draw ---
function draw() {
  background(240);

  if (isLoading || !img || tiles.length === 0) {
    fill(80);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(16);
    text('Memuat gambar... lihat Console / Network', width / 2, height / 2);
    return;
  }

  // render tiles in display order: tiles[i] is what's drawn at position i
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    const destX = (i % cols) * tileW;
    const destY = Math.floor(i / cols) * tileH;

    // Draw source rectangle from img to dest rectangle
    image(img, destX, destY, tileW, tileH, t.sx, t.sy, t.sW, t.sH);

    // grid lines
    stroke(255, 200);
    strokeWeight(1);
    noFill();
    rect(destX, destY, tileW, tileH);

    // highlight selected
    if (selected === i) {
      stroke(231, 76, 60);
      strokeWeight(3);
      noFill();
      rect(destX + 2, destY + 2, tileW - 4, tileH - 4);
      strokeWeight(1);
    }
  }

  // solved overlay
  if (solved) {
    fill(39, 174, 96, 200);
    noStroke();
    rect(0, 0, width, height);
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(32);
    text('LEVEL SELESAI!', width / 2, height / 2);
  }
}

// --- mouse interaction ---
function mousePressed() {
  if (isLoading || !img || solved) return;
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;

  const c = Math.floor(mouseX / tileW);
  const r = Math.floor(mouseY / tileH);
  if (c < 0 || c >= cols || r < 0 || r >= rows) return;
  const idx = r * cols + c;

  // Prefer puzzle.js handler if exists; fallback to local
  if (typeof handleTileClick === 'function') {
    handleTileClick(idx);
  } else {
    handleTileClickLocal(idx);
  }
}

// --- load level (main) ---
function loadLevel(idx) {
  isLoading = true;
  solved = false;
  selected = -1;
  tiles = [];

  if (idx >= levels.length) {
    alert('Selamat! Semua level selesai.');
    const nextBtn = document.getElementById('nextLevelBtn');
    if (nextBtn) nextBtn.style.display = 'none';
    isLoading = false;
    return;
  }

  currentLevelIdx = idx;
  const config = levels[currentLevelIdx];

  // determine URL the canvas will load (proxy remote to avoid CORS)
  let canvasUrl = config.imageUrl || '';
  if (/^https?:\/\//i.test(canvasUrl)) {
    canvasUrl = '/api/image-proxy?url=' + encodeURIComponent(config.imageUrl);
  } else {
    // ensure absolute path for local asset
    if (!canvasUrl.startsWith('/')) canvasUrl = '/' + canvasUrl;
  }

  // set the reference image src to the SAME URL we will load for canvas,
  // so user sees the exact same image (avoids mismatch).
  const ref = document.getElementById('refImg');
  if (ref) {
    ref.src = canvasUrl;
  }

  // Update UI texts
  updateUI(config);

  console.log('[level] loading', currentLevelIdx, '->', config.imageUrl, 'canvasUrl=', canvasUrl);

  // use p5.loadImage (makes use of p5 lifecycle)
  loadImage(canvasUrl,
    (imgLoaded) => {
      console.log('[image] loaded', canvasUrl, 'original w/h:', imgLoaded.width, imgLoaded.height);
      // resize to canonical canvas size to keep tile math easy and deterministic
      try { imgLoaded.resize(CANVAS_SIZE, CANVAS_SIZE); } catch (e) {/* ignore */ }
      img = imgLoaded;
      // expose global alias expected by puzzle.js (if it references `img`)
      window.img = img;
      // set cols/rows from config
      cols = config.cols || 3;
      rows = config.rows || 3;
      // compute tile size for drawing
      tileW = Math.floor(width / cols);
      tileH = Math.floor(height / rows);

      // initialize tiles via puzzle.js if available, else local
      if (typeof initTiles === 'function') {
        // many versions of initTiles expect width/height or totalWidth/totalHeight
        try { initTiles(width, height); } catch (e) { initTiles(); }
      } else {
        initTilesLocal(width, height);
      }

      isLoading = false;
      console.log('[level] ready: cols=' + cols + ' rows=' + rows + ' tiles=' + tiles.length);
    },
    (err) => {
      console.error('[image] failed to load', canvasUrl, err);
      // fallback: create placeholder image so UI still shows something
      img = createGraphics(CANVAS_SIZE, CANVAS_SIZE);
      img.background(200);
      img.fill(80);
      img.textAlign(CENTER, CENTER);
      img.textSize(14);
      img.text('Gagal memuat gambar', CANVAS_SIZE / 2, CANVAS_SIZE / 2);
      window.img = img;
      // still init tiles from placeholder
      if (typeof initTiles === 'function') {
        try { initTiles(width, height); } catch (e) { initTiles(); }
      } else {
        initTilesLocal(width, height);
      }
      isLoading = false;
    }
  );
}

// --- update UI helper ---
function updateUI(config) {
  const levelTitle = document.getElementById('levelTitle');
  if (levelTitle) levelTitle.textContent = 'Level ' + (config.level || (currentLevelIdx + 1));
  const puzzleName = document.getElementById('puzzleName');
  if (puzzleName) puzzleName.textContent = config.name || '';
  const puzzleDesc = document.getElementById('puzzleDesc');
  if (puzzleDesc) puzzleDesc.textContent = config.desc || '';
  const gridSize = document.getElementById('gridSize');
  if (gridSize) gridSize.textContent = `${cols} x ${rows}`;
  const diffBadge = document.getElementById('diffBadge');
  if (diffBadge) diffBadge.textContent = config.diff || '';
  // hide next button until solved
  const nextBtn = document.getElementById('nextLevelBtn');
  if (nextBtn) nextBtn.style.display = 'none';
}

// -------------------- Fallback local implementations --------------------

// If your puzzle.js provides initTiles/shuffleTiles/handleTileClick, those will be used.
// These are safe fallbacks if puzzle.js missing or different.

function initTilesLocal(totalWidth, totalHeight) {
  tiles = [];
  const imgW = (img && img.width) ? img.width : totalWidth;
  const imgH = (img && img.height) ? img.height : totalHeight;
  const srcTileW = Math.floor(imgW / cols);
  const srcTileH = Math.floor(imgH / rows);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      tiles.push({
        sx: c * srcTileW,
        sy: r * srcTileH,
        sW: srcTileW,
        sH: srcTileH,
        correctIndex: idx,
        currentIndex: idx
      });
    }
  }

  // set drawing tile size
  tileW = Math.floor(totalWidth / cols);
  tileH = Math.floor(totalHeight / rows);

  shuffleTilesLocal();
}

function shuffleTilesLocal() {
  const order = tiles.map(t => t.correctIndex);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const newTiles = [];
  for (let pos = 0; pos < order.length; pos++) {
    const correctIdxAtPos = order[pos];
    const tileObj = tiles.find(tt => tt.correctIndex === correctIdxAtPos);
    const clone = Object.assign({}, tileObj);
    clone.currentIndex = pos;
    newTiles[pos] = clone;
  }
  tiles = newTiles;
  selected = -1;
  solved = checkSolvedLocal();
  console.log('[puzzle] shuffled local; tiles:', tiles.length);
}

function checkSolvedLocal() {
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i].currentIndex !== tiles[i].correctIndex) return false;
  }
  return true;
}

function swapTilesLocal(idxA, idxB) {
  if (idxA < 0 || idxB < 0 || idxA >= tiles.length || idxB >= tiles.length) return;
  const tmp = tiles[idxA];
  tiles[idxA] = tiles[idxB];
  tiles[idxB] = tmp;
  // update indices
  tiles[idxA].currentIndex = idxA;
  tiles[idxB].currentIndex = idxB;

  if (checkSolvedLocal()) {
    solved = true;
    const nextBtn = document.getElementById('nextLevelBtn');
    if (nextBtn) nextBtn.style.display = 'block';
  }
}

// local click handler fallback
function handleTileClickLocal(idx) {
  if (selected === -1) {
    selected = idx;
  } else if (selected === idx) {
    selected = -1;
  } else {
    swapTilesLocal(selected, idx);
    selected = -1;
  }
}

// -------------------- Expose / bridge to other modules --------------------
// If puzzle.js defines its own functions (initTiles, shuffleTiles, handleTileClick),
// keep them available; otherwise expose our fallback names so UI can call them.
window.loadLevel = loadLevel;
window.applyLevelConfig = (cfg) => { loadLevelIndexFromConfig(cfg); }; // optional bridge
window.loadNextLevel = () => loadLevel(currentLevelIdx + 1);

// helper: accept a direct config object and apply (convenience)
function loadLevelIndexFromConfig(cfg) {
  // find matching index in levels
  const idx = levels.findIndex(l => l.level === cfg.level);
  if (idx >= 0) loadLevel(idx);
  else {
    // temporarily treat cfg as single-level config
    levels[currentLevelIdx] = cfg;
    loadLevel(currentLevelIdx);
  }
}
