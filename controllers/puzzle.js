// controllers/puzzle.js
// NOTE: This file expects shared globals from sketch.js:
//   - img (global image object), cols, rows, tiles, selected, solved
// It does NOT redeclare those variables to avoid duplicate 'let' errors.

/* Utility functions for puzzle logic (no top-level let/var to avoid duplication) */

function initTiles(totalWidth, totalHeight) {
    // tiles, cols, rows, selected, solved are expected to exist as globals (declared in sketch.js)
    tiles = [];
    solved = false;
    selected = -1;

    const imgW = (typeof img !== 'undefined' && img && img.width) ? img.width : totalWidth;
    const imgH = (typeof img !== 'undefined' && img && img.height) ? img.height : totalHeight;
    const srcTileW = imgW / cols;
    const srcTileH = imgH / rows;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const idx = r * cols + c;
            tiles.push({
                sx: Math.floor(c * srcTileW),
                sy: Math.floor(r * srcTileH),
                sW: Math.ceil(srcTileW),
                sH: Math.ceil(srcTileH),
                correctIndex: idx,
                currentIndex: idx
            });
        }
    }

    // local tileW/tileH used only here (no global declaration)
    // but other code can compute from canvas width/cols when needed
    shuffleTiles();
}

function shuffleTiles() {
    if (!tiles || tiles.length === 0) return;
    let indices = tiles.map(t => t.correctIndex);
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    for (let i = 0; i < tiles.length; i++) tiles[i].currentIndex = indices[i];
    selected = -1;
    solved = checkSolved();
}

function checkSolved() {
    if (!tiles) return false;
    for (let i = 0; i < tiles.length; i++) {
        if (tiles[i].currentIndex !== tiles[i].correctIndex) return false;
    }
    return true;
}

function swapTiles(idxA, idxB) {
    if (!tiles) return;
    const tmp = tiles[idxA].currentIndex;
    tiles[idxA].currentIndex = tiles[idxB].currentIndex;
    tiles[idxB].currentIndex = tmp;
    if (checkSolved()) {
        solved = true;
        const nextBtn = document.getElementById('nextLevelBtn');
        if (nextBtn) nextBtn.style.display = 'block';
    }
}

function handleTileClick(idx) {
    if (selected === -1) selected = idx;
    else if (selected === idx) selected = -1;
    else {
        swapTiles(selected, idx);
        selected = -1;
    }
}
