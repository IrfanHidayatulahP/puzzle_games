// controllers/ui.js (safer)
window.addEventListener('load', () => {
    const gridSelect = document.getElementById('gridSelect');
    const shuffleBtn = document.getElementById('shuffleBtn');
    const autoSolveBtn = document.getElementById('autoSolveBtn');
    const refImg = document.getElementById('refImg');

    // set dropdown awal (jika ada)
    if (gridSelect) {
        gridSelect.value = (typeof cols !== 'undefined') ? cols : 3;
        gridSelect.addEventListener('change', () => {
            const v = parseInt(gridSelect.value);
            if (!isNaN(v)) {
                cols = v;
                if (typeof initTiles === 'function') initTiles(width, height);
            }
        });
    }

    if (shuffleBtn) {
        shuffleBtn.addEventListener('click', () => {
            if (typeof shuffleTiles === 'function') shuffleTiles();
        });
    }

    if (autoSolveBtn) {
        autoSolveBtn.addEventListener('click', () => {
            if (typeof showSolution === 'function') showSolution();
        });
    }

    // function to set reference image (may be called from sketch)
    window.setReferenceImage = (dataUrl) => {
        if (refImg) refImg.src = dataUrl;
    };
});
