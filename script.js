let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");
let cellSize = 20;
let currentColor = "#ff0000";
let currentTool = "pen"; // "pen" or "fill" or "eraser"
let penSize = 1; // ペン太さ（セル単位）
let penMode = "square"; // "square" or "circle"

// レイヤー管理
let layers = [];
let activeLayer = 0;
let layerHistories = [];
let layerRedoStacks = [];
let currentWidth = 16;
let currentHeight = 16;

// プロジェクト管理
let projects = [];
let activeProject = 0;

// isDrawingのグローバル宣言を追加
let isDrawing = false;

// プロジェクト構造: { frames, activeFrame, ... }
function createProject(w = 16, h = 16) {
    let cellSize = 20;
    let layers = [];
    let layerHistories = [];
    let layerRedoStacks = [];
    let off = document.createElement("canvas");
    off.width = w * cellSize;
    off.height = h * cellSize;
    layers.push(off);
    layerHistories.push([]);
    layerRedoStacks.push([]);
    // フレーム構造: { layers, activeLayer, layerHistories, layerRedoStacks }
    let frame = {
        layers,
        activeLayer: 0,
        layerHistories,
        layerRedoStacks,
    };
    return {
        frames: [frame],
        activeFrame: 0,
        width: w,
        height: h
    };
}

// プロジェクトUI
function updateProjectUI() {
    const list = document.getElementById("projectList");
    list.innerHTML = "";
    for (let i = 0; i < projects.length; i++) {
        const item = document.createElement("div");
        item.className = "project-item" + (i === activeProject ? " active" : "");
        item.onclick = () => {
            activeProject = i;
            updateProjectUI();
            updateFrameUI(); // ←追加
            updateLayerUI();
            redrawAll();
        };
        item.textContent = `画像${i + 1}`;
        // 削除ボタン
        const delBtn = document.createElement("button");
        delBtn.textContent = "削除";
        delBtn.className = "project-btn";
        delBtn.disabled = (projects.length === 1);
        delBtn.onclick = (e) => {
            e.stopPropagation();
            removeProjectAt(i);
        };
        item.appendChild(delBtn);
        list.appendChild(item);
    }
    document.getElementById("projectCount").textContent = `(${projects.length}枚)`;
}

function showNewProjectDialog(callback) {
    // すでにダイアログがあれば消す
    let old = document.getElementById("new-project-dialog");
    if (old) old.remove();

    const dialog = document.createElement("div");
    dialog.id = "new-project-dialog";
    dialog.style.position = "fixed";
    dialog.style.left = "0";
    dialog.style.top = "0";
    dialog.style.width = "100vw";
    dialog.style.height = "100vh";
    dialog.style.background = "rgba(0,0,0,0.3)";
    dialog.style.display = "flex";
    dialog.style.alignItems = "center";
    dialog.style.justifyContent = "center";
    dialog.style.zIndex = "3000";

    dialog.innerHTML = `
        <div style="background:#fff; border-radius:10px; box-shadow:0 2px 16px #0003; padding:28px 32px; min-width:240px; text-align:center;">
            <h3 style="margin-top:0;">新しい画像のサイズ</h3>
            <div style="margin-bottom:12px;">
                <label>幅: <input id="newProjW" type="number" min="1" max="256" value="16" style="width:60px;"></label>
                <label style="margin-left:12px;">高さ: <input id="newProjH" type="number" min="1" max="256" value="16" style="width:60px;"></label>
            </div>
            <button id="newProjOkBtn">作成</button>
            <button id="newProjCancelBtn" style="margin-left:12px;">キャンセル</button>
        </div>
    `;
    document.body.appendChild(dialog);

    dialog.querySelector("#newProjOkBtn").onclick = () => {
        const w = parseInt(dialog.querySelector("#newProjW").value, 10);
        const h = parseInt(dialog.querySelector("#newProjH").value, 10);
        dialog.remove();
        if (callback) callback(w, h);
    };
    dialog.querySelector("#newProjCancelBtn").onclick = () => {
        dialog.remove();
    };
}

function addProject() {
    showNewProjectDialog((w, h) => {
        if (!Number.isFinite(w) || w < 1) w = 16;
        if (!Number.isFinite(h) || h < 1) h = 16;
        projects.push(createProject(w, h));
        activeProject = projects.length - 1;
        updateProjectUI();
        updateFrameUI();
        updateLayerUI();
        redrawAll();
    });
}

function removeProjectAt(idx) {
    if (projects.length <= 1) return;
    projects.splice(idx, 1);
    if (activeProject >= projects.length) activeProject = projects.length - 1;
    updateProjectUI();
    updateFrameUI(); // ←追加
    updateLayerUI();
    redrawAll();
}

// 既存のレイヤー関連変数をプロジェクト経由に
function getCurrentProject() {
    return projects[activeProject];
}

// 既存の関数内の layers, activeLayer, layerHistories, layerRedoStacks, currentWidth, currentHeight を
// getCurrentProject() 経由でアクセスするように修正
// 例: let {layers, activeLayer, ...} = getCurrentProject();

// フレームUI
function updateFrameUI() {
    const list = document.getElementById("frameList");
    const p = getCurrentProject();
    list.innerHTML = "";
    for (let i = 0; i < p.frames.length; i++) {
        const item = document.createElement("div");
        item.className = "frame-item" + (i === p.activeFrame ? " active" : "");
        item.onclick = () => {
            p.activeFrame = i;
            updateFrameUI();
            updateLayerUI();
            redrawAll();
        };
        // サムネイル
        const thumb = document.createElement("canvas");
        thumb.className = "frame-thumb";
        thumb.width = 32;
        thumb.height = 32;
        let tctx = thumb.getContext("2d");
        tctx.clearRect(0, 0, 32, 32);
        // 合成
        for (let l = 0; l < p.frames[i].layers.length; l++) {
            tctx.drawImage(p.frames[i].layers[l], 0, 0, thumb.width, thumb.height);
        }
        item.appendChild(thumb);
        // ラベル
        const label = document.createElement("span");
        label.textContent = `F${i + 1}`;
        item.appendChild(label);
        // 削除
        const delBtn = document.createElement("button");
        delBtn.textContent = "削除";
        delBtn.className = "frame-btn";
        delBtn.disabled = (p.frames.length === 1);
        delBtn.onclick = (e) => {
            e.stopPropagation();
            removeFrameAt(i);
        };
        item.appendChild(delBtn);
        list.appendChild(item);
    }
    document.getElementById("frameCount").textContent = `(${p.frames.length}コマ)`;
}

function addFrame() {
    let p = getCurrentProject();
    let base = p.frames[p.activeFrame];
    // 新しいフレームは現在のフレームのレイヤーを複製
    let layers = base.layers.map(layer => {
        let c = document.createElement("canvas");
        c.width = layer.width;
        c.height = layer.height;
        c.getContext("2d").drawImage(layer, 0, 0);
        return c;
    });
    let layerHistories = layers.map(() => []);
    let layerRedoStacks = layers.map(() => []);
    let frame = {
        layers,
        activeLayer: 0,
        layerHistories,
        layerRedoStacks,
    };
    p.frames.splice(p.activeFrame + 1, 0, frame);
    p.activeFrame++;
    updateFrameUI();
    updateLayerUI();
    redrawAll();
}

function removeFrameAt(idx) {
    let p = getCurrentProject();
    if (p.frames.length <= 1) return;
    p.frames.splice(idx, 1);
    if (p.activeFrame >= p.frames.length) p.activeFrame = p.frames.length - 1;
    updateFrameUI();
    updateLayerUI();
    redrawAll();
}

function getCurrentFrame() {
    return getCurrentProject().frames[getCurrentProject().activeFrame];
}

// 既存のレイヤー関連は getCurrentFrame() 経由に
function updateLayerUI() {
    let { layers, activeLayer } = getCurrentFrame();
    document.getElementById("layerCount").textContent = `(${layers.length}枚)`;
    const list = document.getElementById("layerList");
    list.innerHTML = "";
    for (let i = layers.length - 1; i >= 0; i--) {
        const item = document.createElement("div");
        item.className = "layer-item" + (i === activeLayer ? " active" : "");
        item.onclick = (e) => {
            // ボタン押下時は無視
            if (e.target.classList.contains("layer-btn")) return;
            getCurrentFrame().activeLayer = i;
            updateLayerUI();
            redrawAll();
        };

        // プレビュー
        const thumb = document.createElement("canvas");
        thumb.className = "layer-thumb";
        thumb.width = 32;
        thumb.height = 32;
        // サムネイル描画
        let tctx = thumb.getContext("2d");
        tctx.clearRect(0, 0, 32, 32);
        tctx.drawImage(layers[i], 0, 0, thumb.width, thumb.height);
        item.appendChild(thumb);

        // ラベル
        const label = document.createElement("span");
        label.textContent = `レイヤー${i + 1}`;
        item.appendChild(label);

        // 上ボタン
        const upBtn = document.createElement("button");
        upBtn.textContent = "↑";
        upBtn.className = "layer-btn";
        upBtn.title = "上に移動";
        upBtn.disabled = (i === layers.length - 1);
        upBtn.onclick = (e) => {
            e.stopPropagation();
            if (i < layers.length - 1) {
                swapLayer(i, i + 1);
            }
        };
        item.appendChild(upBtn);

        // 下ボタン
        const downBtn = document.createElement("button");
        downBtn.textContent = "↓";
        downBtn.className = "layer-btn";
        downBtn.title = "下に移動";
        downBtn.disabled = (i === 0);
        downBtn.onclick = (e) => {
            e.stopPropagation();
            if (i > 0) {
                swapLayer(i, i - 1);
            }
        };
        item.appendChild(downBtn);

        // 削除ボタン
        const delBtn = document.createElement("button");
        delBtn.textContent = "削除";
        delBtn.className = "layer-btn";
        delBtn.title = "このレイヤーを削除";
        delBtn.disabled = (layers.length === 1);
        delBtn.onclick = (e) => {
            e.stopPropagation();
            removeLayerAt(i);
        };
        item.appendChild(delBtn);

        list.appendChild(item);
    }
}

function swapLayer(i, j) {
    let f = getCurrentFrame();
    [f.layers[i], f.layers[j]] = [f.layers[j], f.layers[i]];
    [f.layerHistories[i], f.layerHistories[j]] = [f.layerHistories[j], f.layerHistories[i]];
    [f.layerRedoStacks[i], f.layerRedoStacks[j]] = [f.layerRedoStacks[j], f.layerRedoStacks[i]];
    // アクティブレイヤーも追従
    if (f.activeLayer === i) f.activeLayer = j;
    else if (f.activeLayer === j) f.activeLayer = i;
    updateLayerUI();
    redrawAll();
}

function removeLayerAt(idx) {
    let f = getCurrentFrame();
    if (f.layers.length <= 1) return;
    f.layers.splice(idx, 1);
    f.layerHistories.splice(idx, 1);
    f.layerRedoStacks.splice(idx, 1);
    if (f.activeLayer >= f.layers.length) f.activeLayer = f.layers.length - 1;
    updateLayerUI();
    redrawAll();
}

function addLayer() {
    let p = getCurrentProject();
    let f = getCurrentFrame();
    let off = document.createElement("canvas");
    off.width = p.width * cellSize;
    off.height = p.height * cellSize;
    f.layers.push(off);
    f.layerHistories.push([]);
    f.layerRedoStacks.push([]);
    f.activeLayer = f.layers.length - 1;
    saveHistory();
    updateLayerUI();
    redrawAll();
}

// removeLayerは従来通り（レイヤーリストの削除ボタンはremoveLayerAtを使う）
function removeLayer() {
    let f = getCurrentFrame();
    if (f.layers.length <= 1) return;
    f.layers.splice(f.activeLayer, 1);
    f.layerHistories.splice(f.activeLayer, 1);
    f.layerRedoStacks.splice(f.activeLayer, 1);
    f.activeLayer = Math.max(0, f.activeLayer - 1);
    updateLayerUI();
    redrawAll();
}

function selectLayer(idx) {
    getCurrentFrame().activeLayer = parseInt(idx);
    updateLayerUI();
}

// パレット色リスト（編集可能にするためletに変更）
let PALETTE_COLORS = [
    "#000000", "#444444", "#888888", "#cccccc", "#ffffff",
    "#ff0000", "#ffa500", "#ffff00", "#00ff00", "#00ffff",
    "#0000ff", "#ff00ff", "#800000", "#808000", "#008000",
    "#008080", "#000080", "#800080", "#c0c0c0", "#ff69b4"
];

// 塗りつぶしボタンのイベント
function setTool(tool) {
    currentTool = tool;
    // ボタンのactive状態を更新
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
    });
    // パレット下ツールバーも同期
    document.querySelectorAll('#palette-toolbar .tool-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
    });
}

function setPenSize(val) {
    penSize = parseInt(val) || 1;
    let el = document.getElementById("penSize");
    if (el) el.value = penSize;
    let el2 = document.getElementById("palette-penSize");
    if (el2) el2.value = penSize;
}
function setPenMode(val) {
    penMode = val;
    let el = document.getElementById("penMode");
    if (el) el.value = penMode;
    let el2 = document.getElementById("palette-penMode");
    if (el2) el2.value = penMode;
}

// 塗りつぶしアルゴリズム
function fillAt(x, y) {
    let p = getCurrentProject();
    let f = getCurrentFrame();
    let lctx = f.layers[f.activeLayer].getContext("2d");
    let imgData = lctx.getImageData(0, 0, p.width * cellSize, p.height * cellSize);
    let px = x * cellSize, py = y * cellSize;
    let target = getPixel(imgData, px, py);
    let fillColor = hexToRgba(currentColor);

    if (colorsMatch(target, fillColor)) return;

    let stack = [[x, y]];
    let visited = new Set();

    while (stack.length) {
        let [cx, cy] = stack.pop();
        if (cx < 0 || cy < 0 || cx >= p.width || cy >= p.height) continue;
        let key = `${cx},${cy}`;
        if (visited.has(key)) continue;
        visited.add(key);

        let sx = cx * cellSize, sy = cy * cellSize;
        let cur = getPixel(imgData, sx, sy);
        if (!colorsMatch(cur, target)) continue;

        // 塗る
        for (let dy = 0; dy < cellSize; dy++) {
            for (let dx = 0; dx < cellSize; dx++) {
                setPixel(imgData, sx + dx, sy + dy, fillColor);
            }
        }

        stack.push([cx + 1, cy]);
        stack.push([cx - 1, cy]);
        stack.push([cx, cy + 1]);
        stack.push([cx, cy - 1]);
    }
    lctx.putImageData(imgData, 0, 0);
    redrawAll();
}

// ピクセル取得
function getPixel(imgData, x, y) {
    let idx = (y * imgData.width + x) * 4;
    return [
        imgData.data[idx],
        imgData.data[idx + 1],
        imgData.data[idx + 2],
        imgData.data[idx + 3]
    ];
}

// ピクセル設定
function setPixel(imgData, x, y, color) {
    let idx = (y * imgData.width + x) * 4;
    imgData.data[idx] = color[0];
    imgData.data[idx + 1] = color[1];
    imgData.data[idx + 2] = color[2];
    imgData.data[idx + 3] = color[3];
}

// 色比較
function colorsMatch(a, b) {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

// HEX→RGBA
function hexToRgba(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    let num = parseInt(hex, 16);
    return [
        (num >> 16) & 255,
        (num >> 8) & 255,
        num & 255,
        255
    ];
}

function handleMouseDown(e) {
    isDrawing = true;
    // 修正: スクロールやズーム時も正しい座標を取得
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX / cellSize);
    const y = Math.floor((e.clientY - rect.top) * scaleY / cellSize);
    if (currentTool === "fill") {
        fillAt(x, y);
        saveHistory();
        isDrawing = false;
    } else {
        // 修正: drawDotにx, yを直接渡す
        drawDotXY(x, y);
    }
}

function handleMouseMove(e) {
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX / cellSize);
    const y = Math.floor((e.clientY - rect.top) * scaleY / cellSize);
    drawDotXY(x, y);
}

function handleMouseUp(e) {
    if (isDrawing) {
        saveHistory();
    }
    isDrawing = false;
}

// タッチイベント対応（複数指やスクロール誤動作防止、指が外れても描画継続）
let lastTouch = null;

// タッチイベント対応（ズレ補正: ページスクロール量・ズーム倍率対応）
function getTouchPos(e) {
    const rect = canvas.getBoundingClientRect();
    let touch = e.touches && e.touches[0] ? e.touches[0] : e.changedTouches[0];
    // ズーム倍率補正
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    // ページスクロール・ズーム補正後の座標
    return {
        x: Math.floor((touch.clientX - rect.left) * scaleX / cellSize),
        y: Math.floor((touch.clientY - rect.top) * scaleY / cellSize)
    };
}

function handleTouchStart(e) {
    if (e.touches.length > 1) return; // 2本指以上は無視（ピンチズーム等）
    e.preventDefault();
    isDrawing = true;
    let pos = getTouchPos(e);
    lastTouch = pos;
    if (currentTool === "fill") {
        fillAt(pos.x, pos.y);
        saveHistory();
        isDrawing = false;
    } else {
        drawDotTouch(pos.x, pos.y);
    }
}

function handleTouchMove(e) {
    if (!isDrawing) return;
    if (e.touches.length > 1) return;
    e.preventDefault();
    let pos = getTouchPos(e);
    // 連続した点を補間して滑らかに
    if (lastTouch) {
        let dx = pos.x - lastTouch.x;
        let dy = pos.y - lastTouch.y;
        let steps = Math.max(Math.abs(dx), Math.abs(dy));
        for (let i = 1; i <= steps; i++) {
            let ix = Math.round(lastTouch.x + (dx * i) / steps);
            let iy = Math.round(lastTouch.y + (dy * i) / steps);
            drawDotTouch(ix, iy);
        }
    } else {
        drawDotTouch(pos.x, pos.y);
    }
    lastTouch = pos;
}

function handleTouchEnd(e) {
    if (isDrawing) {
        saveHistory();
    }
    isDrawing = false;
    lastTouch = null;
}

// drawDotXYをdrawPenShape/範囲チェックのみの最小形にしてみる
function drawDotXY(x, y) {
    let p = getCurrentProject();
    let f = getCurrentFrame();
    // 範囲外は何もしない
    if (!f || !p) return;
    // 修正: p.width, p.height, f.layers, f.activeLayer の型・値を明示的にチェック
    if (
        typeof x !== "number" || typeof y !== "number" ||
        x < 0 || y < 0 ||
        !Number.isFinite(p.width) || !Number.isFinite(p.height) ||
        x >= p.width || y >= p.height ||
        !Array.isArray(f.layers) ||
        typeof f.activeLayer !== "number" ||
        !f.layers[f.activeLayer]
    ) return;
    let lctx = f.layers[f.activeLayer].getContext("2d");
    if (!lctx) return;
    if (currentTool === "eraser") {
        drawPenShape(lctx, x, y, "#00000000", true);
    } else {
        drawPenShape(lctx, x, y, currentColor, false);
    }
    redrawAll();
}

// ペン形状描画
function drawPenShape(ctx, cx, cy, color, isErase) {
    const px = cx * cellSize;
    const py = cy * cellSize;
    const size = penSize * cellSize;
    if (isErase) {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        if (penMode === "circle") {
            ctx.beginPath();
            ctx.arc(px + cellSize / 2, py + cellSize / 2, (size) / 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.clearRect(px - Math.floor((penSize - 1) / 2) * cellSize, py - Math.floor((penSize - 1) / 2) * cellSize, size, size);
        }
        ctx.restore();
    } else {
        ctx.save();
        ctx.fillStyle = color;
        if (penMode === "circle") {
            ctx.beginPath();
            ctx.arc(px + cellSize / 2, py + cellSize / 2, (size) / 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(px - Math.floor((penSize - 1) / 2) * cellSize, py - Math.floor((penSize - 1) / 2) * cellSize, size, size);
        }
        ctx.restore();
    }
}

// 初期化
window.onload = () => {
    // プロジェクト初期化
    projects = [createProject()];
    activeProject = 0;
    updateProjectUI();
    updateFrameUI(); // ←追加
    updateLayerUI();
    initCanvas();
    setTool("pen");
    createPalette();

    document.getElementById("penSize").value = penSize;
    document.getElementById("penMode").value = penMode;

    canvas.onmousemove = handleMouseMove;
    canvas.onmouseup = handleMouseUp;
    canvas.onmouseleave = handleMouseUp;
    // タッチイベント
    canvas.ontouchstart = handleTouchStart;
    canvas.ontouchmove = handleTouchMove;
    canvas.ontouchend = handleTouchEnd;
    canvas.ontouchcancel = handleTouchEnd;
    // パッシブでないリスナーでスクロール抑止
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
};

function drawGrid(w, h) {
    ctx.save();
    ctx.strokeStyle = "#ccc";
    for (let i = 0; i <= w; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, h * cellSize);
        ctx.stroke();
    }
    for (let i = 0; i <= h; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(w * cellSize, i * cellSize);
        ctx.stroke();
    }
    ctx.restore();
}

function redrawAll() {
    let p = getCurrentProject();
    let f = getCurrentFrame();
    canvas.width = p.width * cellSize;
    canvas.height = p.height * cellSize;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < f.layers.length; i++) {
        ctx.drawImage(f.layers[i], 0, 0);
    }
    drawGrid(p.width, p.height);
}

function saveHistory() {
    let f = getCurrentFrame();
    let arr = f.layerHistories[f.activeLayer];
    arr.push(f.layers[f.activeLayer].toDataURL());
    if (arr.length > 50) arr.shift();
    f.layerRedoStacks[f.activeLayer] = [];
}

function undo() {
    let f = getCurrentFrame();
    let arr = f.layerHistories[f.activeLayer];
    let redoArr = f.layerRedoStacks[f.activeLayer];
    if (!arr || arr.length < 2) return;
    redoArr.push(arr.pop());
    let img = new Image();
    img.onload = () => {
        let lctx = f.layers[f.activeLayer].getContext("2d");
        lctx.clearRect(0, 0, f.layers[f.activeLayer].width, f.layers[f.activeLayer].height);
        lctx.drawImage(img, 0, 0);
        redrawAll();
    };
    img.src = arr[arr.length - 1];
}

function redo() {
    let f = getCurrentFrame();
    let arr = f.layerHistories[f.activeLayer];
    let redoArr = f.layerRedoStacks[f.activeLayer];
    if (!redoArr || redoArr.length === 0) return;
    let imgURL = redoArr.pop();
    arr.push(imgURL);
    let img = new Image();
    img.onload = () => {
        let lctx = f.layers[f.activeLayer].getContext("2d");
        lctx.clearRect(0, 0, f.layers[f.activeLayer].width, f.layers[f.activeLayer].height);
        lctx.drawImage(img, 0, 0);
        redrawAll();
    };
    img.src = imgURL;
}

// 静止画またはアニメーションエクスポート
function exportImage(type) {
    let p = getCurrentProject();
    let frames = p.frames;
    let mime = (type === "jpg" || type === "jpeg") ? "image/jpeg" : `image/${type}`;
    let isAnimation = frames.length > 1;

    if (!isAnimation) {
        // 1フレームのみ: 通常の静止画
        let tmp = document.createElement("canvas");
        tmp.width = p.width * cellSize;
        tmp.height = p.height * cellSize;
        let tctx = tmp.getContext("2d");
        let f = getCurrentFrame();
        for (let i = 0; i < f.layers.length; i++) {
            tctx.drawImage(f.layers[i], 0, 0);
        }
        let link = document.createElement("a");
        link.download = `nezumi-drawing.${type}`;
        if (type === "jpg" || type === "jpeg") {
            link.href = tmp.toDataURL(mime, 0.92);
        } else {
            link.href = tmp.toDataURL(mime);
        }
        link.click();
    } else if (type === "webp" && typeof window.WebCodecs !== "undefined") {
        // WEBPアニメーション: WebCodecs APIでアニメーションwebpを生成（対応ブラウザのみ）
        exportWebpAnimation(frames, p.width * cellSize, p.height * cellSize);
    } else {
        // 複数フレーム: 各フレームを個別に保存（連番ファイル名）
        for (let fi = 0; fi < frames.length; fi++) {
            let tmp = document.createElement("canvas");
            tmp.width = p.width * cellSize;
            tmp.height = p.height * cellSize;
            let tctx = tmp.getContext("2d");
            let f = frames[fi];
            for (let li = 0; li < f.layers.length; li++) {
                tctx.drawImage(f.layers[li], 0, 0);
            }
            let link = document.createElement("a");
            link.download = `nezumi-animation-f${fi + 1}.${type}`;
            if (type === "jpg" || type === "jpeg") {
                link.href = tmp.toDataURL(mime, 0.92);
            } else {
                link.href = tmp.toDataURL(mime);
            }
            setTimeout(() => link.click(), fi * 100);
        }
    }
}

// WEBPアニメーション生成（WebCodecs API利用、対応ブラウザのみ）
async function exportWebpAnimation(frames, width, height) {
    if (!window.WebCodecs || !window.VideoEncoder) {
        alert("このブラウザはWebCodecsによるWEBPアニメーションに対応していません。");
        return;
    }
    const chunks = [];
    const encoder = new VideoEncoder({
        output: chunk => chunks.push(chunk),
        error: e => console.error(e)
    });
    encoder.configure({
        codec: "vp8",
        width,
        height,
        framerate: 5
    });
    for (let fi = 0; fi < frames.length; fi++) {
        let tmp = document.createElement("canvas");
        tmp.width = width;
        tmp.height = height;
        let tctx = tmp.getContext("2d");
        let f = frames[fi];
        for (let li = 0; li < f.layers.length; li++) {
            tctx.drawImage(f.layers[li], 0, 0);
        }
        let bitmap = await createImageBitmap(tmp);
        encoder.encode(bitmap, { keyFrame: true, duration: 200 });
        bitmap.close();
    }
    await encoder.flush();
    encoder.close();

    // WebMとして保存（WebCodecsはWebPアニメーションではなくWebM動画を生成）
    const webmBlob = new Blob(chunks.map(c => c.byteLength ? c : c.data), { type: "video/webm" });
    const link = document.createElement("a");
    link.download = "nezumi-animation.webp";
    link.href = URL.createObjectURL(webmBlob);
    link.click();
}

// アニメーションGIFエクスポート（全フレーム合成）
function exportGif() {
    loadGifJs(() => {
        let p = getCurrentProject();
        let tmp = document.createElement("canvas");
        tmp.width = p.width * cellSize;
        tmp.height = p.height * cellSize;
        let tctx = tmp.getContext("2d");
        let gif = new window.GIF({
            workers: 2,
            quality: 10,
            width: tmp.width,
            height: tmp.height,
            workerScript: 'lib/gif.worker.js'
        });
        for (let fi = 0; fi < p.frames.length; fi++) {
            tctx.clearRect(0, 0, tmp.width, tmp.height);
            let f = p.frames[fi];
            for (let li = 0; li < f.layers.length; li++) {
                tctx.drawImage(f.layers[li], 0, 0);
            }
            gif.addFrame(tmp, { copy: true, delay: 300 });
        }
        gif.on('finished', function (blob) {
            let link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'nezumi-animation.gif';
            link.click();
        });
        gif.render();
    });
}

// APNGエクスポート（全フレーム合成、apng-jsを利用）
function exportApng() {
    // apng-jsが必要（https://github.com/davidmz/apng-js）
    if (typeof window.encodeAPNG !== "function") {
        loadApngJs(() => exportApng());
        return;
    }
    let p = getCurrentProject();
    let frames = p.frames;
    let width = p.width * cellSize;
    let height = p.height * cellSize;
    let pngFrames = [];
    let delays = [];
    for (let fi = 0; fi < frames.length; fi++) {
        let tmp = document.createElement("canvas");
        tmp.width = width;
        tmp.height = height;
        let tctx = tmp.getContext("2d");
        let f = frames[fi];
        for (let li = 0; li < f.layers.length; li++) {
            tctx.drawImage(f.layers[li], 0, 0);
        }
        // PNGバイナリデータ
        let dataUrl = tmp.toDataURL("image/png");
        let bin = atob(dataUrl.split(',')[1]);
        let arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        pngFrames.push(arr);
        delays.push(300); // 300ms/frame
    }
    encodeAPNG(pngFrames, delays, width, height).then(blob => {
        let link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "nezumi-animation.apng";
        link.click();
    });
}

// apng-jsのローカルを動的に読み込む
function loadApngJs(callback) {
    if (window.encodeAPNG) {
        callback();
        return;
    }
    let script = document.createElement('script');
    script.src = 'lib/apng-js.min.js'; // apng-jsのパス
    script.onload = callback;
    document.body.appendChild(script);
}

// 編集用ファイル保存
function saveProjectFile() {
    // すべてのプロジェクト・フレーム・レイヤーをシリアライズ
    const data = {
        projects: projects.map(p => ({
            width: p.width,
            height: p.height,
            activeFrame: p.activeFrame,
            frames: p.frames.map(f => ({
                activeLayer: f.activeLayer,
                layers: f.layers.map(layer => layer.toDataURL())
            }))
        })),
        activeProject
    };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const link = document.createElement("a");
    link.download = "nezumi-sketch.msketch";
    link.href = URL.createObjectURL(blob);
    link.click();
}

// 編集用ファイルロード
function loadProjectFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            // プロジェクト復元
            projects = data.projects.map(pdata => {
                let p = createProject(pdata.width, pdata.height);
                p.frames = pdata.frames.map(fdata => {
                    let f = {
                        layers: [],
                        activeLayer: fdata.activeLayer,
                        layerHistories: [],
                        layerRedoStacks: []
                    };
                    for (let l = 0; l < fdata.layers.length; l++) {
                        let img = new Image();
                        img.src = fdata.layers[l];
                        let c = document.createElement("canvas");
                        c.width = pdata.width * cellSize;
                        c.height = pdata.height * cellSize;
                        // 画像のロードを同期化
                        img.onload = (() => {
                            let ctx2 = c.getContext("2d");
                            ctx2.clearRect(0, 0, c.width, c.height);
                            ctx2.drawImage(img, 0, 0);
                        });
                        // 即時描画（onloadでなくても大抵OK）
                        img.onload();
                        f.layers.push(c);
                        f.layerHistories.push([]);
                        f.layerRedoStacks.push([]);
                    }
                    return f;
                });
                p.activeFrame = pdata.activeFrame;
                return p;
            });
            activeProject = data.activeProject || 0;
            updateProjectUI();
            updateFrameUI();
            updateLayerUI();
            redrawAll();
        } catch (e) {
            alert("ファイルの読み込みに失敗しました。");
        }
    };
    reader.readAsText(file);
}

// 初期化
window.onload = () => {
    // プロジェクト初期化
    projects = [createProject()];
    activeProject = 0;
    updateProjectUI();
    updateFrameUI(); // ←追加
    updateLayerUI();
    initCanvas();
    setTool("pen");
    createPalette();

    document.getElementById("penSize").value = penSize;
    document.getElementById("penMode").value = penMode;

    canvas.onmousemove = handleMouseMove;
    canvas.onmouseup = handleMouseUp;
    canvas.onmouseleave = handleMouseUp;
    // タッチイベント
    canvas.ontouchstart = handleTouchStart;
    canvas.ontouchmove = handleTouchMove;
    canvas.ontouchend = handleTouchEnd;
    canvas.ontouchcancel = handleTouchEnd;
    // パッシブでないリスナーでスクロール抑止
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
};

function initCanvas() {
    const w = parseInt(16);
    const h = parseInt(16);
    let p = getCurrentProject();
    p.width = w;
    p.height = h;
    canvas.width = w * cellSize;
    canvas.height = h * cellSize;
    // レイヤー初期化
    p.layers = [];
    p.layerHistories = [];
    p.layerRedoStacks = [];
    let off = document.createElement("canvas");
    off.width = w * cellSize;
    off.height = h * cellSize;
    p.layers.push(off);
    p.layerHistories.push([]);
    p.layerRedoStacks.push([]);
    p.activeLayer = 0;
    saveHistory();
    updateFrameUI(); // ←追加
    updateLayerUI();
    redrawAll();

    // 既存のイベントリスナーを一度解除してから再登録（多重登録防止）
    canvas.onmousedown = null;
    canvas.onmousemove = null;
    canvas.onmouseup = null;
    canvas.onmouseleave = null;
    canvas.ontouchstart = null;
    canvas.ontouchmove = null;
    canvas.ontouchend = null;
    canvas.ontouchcancel = null;
    canvas.removeEventListener('touchstart', handleTouchStart);
    canvas.removeEventListener('touchmove', handleTouchMove);
    canvas.removeEventListener('touchend', handleTouchEnd);
    canvas.removeEventListener('touchcancel', handleTouchEnd);

    canvas.onmousedown = handleMouseDown;
    canvas.onmousemove = handleMouseMove;
    canvas.onmouseup = handleMouseUp;
    canvas.onmouseleave = handleMouseUp;
    // タッチイベント
    canvas.ontouchstart = handleTouchStart;
    canvas.ontouchmove = handleTouchMove;
    canvas.ontouchend = handleTouchEnd;
    canvas.ontouchcancel = handleTouchEnd;
    // パッシブでないリスナーでスクロール抑止
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
}

// パレット生成関数を追加
function createPalette() {
    const palette = document.getElementById("color-palette");
    if (!palette) return;
    palette.innerHTML = "";

    PALETTE_COLORS.forEach((color, idx) => {
        const btn = document.createElement("button");
        btn.className = "palette-color";
        btn.style.background = color;
        btn.title = color;
        btn.onclick = () => {
            currentColor = color;
            document.getElementById("colorPicker").value = color;
            document.querySelectorAll(".palette-color").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
        };
        // 削除ボタン
        const delBtn = document.createElement("span");
        delBtn.textContent = "×";
        delBtn.className = "palette-del-btn";
        delBtn.title = "この色をパレットから削除";
        delBtn.onclick = (e) => {
            e.stopPropagation();
            if (PALETTE_COLORS.length > 1) {
                PALETTE_COLORS.splice(idx, 1);
                createPalette();
            }
        };
        btn.appendChild(delBtn);
        palette.appendChild(btn);
    });

    // 色追加ボタン
    const addBtn = document.createElement("button");
    addBtn.className = "palette-add-btn";
    addBtn.title = "パレットに色を追加";
    addBtn.innerHTML = "+";
    addBtn.onclick = (ev) => {
        ev.stopPropagation();
        const input = document.createElement("input");
        input.type = "color";
        input.style.display = "none";
        let added = false;
        input.oninput = (e) => {
            if (!added) {
                PALETTE_COLORS.push(e.target.value);
                createPalette();
                added = true;
                input.remove();
            }
        };
        input.addEventListener("blur", () => {
            if (!added) input.remove();
        });
        input.addEventListener("click", ev => ev.stopPropagation());
        document.body.appendChild(input);
        input.focus();
        input.click();
    };
    palette.appendChild(addBtn);

    // パレット下にツール切り替え・太さUIを設置
    let toolBar = document.getElementById("palette-toolbar");
    if (!toolBar) {
        toolBar = document.createElement("div");
        toolBar.id = "palette-toolbar";
        toolBar.className = "palette-toolbar";
        palette.parentNode.appendChild(toolBar);
    }
    toolBar.innerHTML = `
        <button class="tool-btn${currentTool === 'pen' ? ' active' : ''}" data-tool="pen" onclick="setTool('pen')">ペン</button>
        <button class="tool-btn${currentTool === 'eraser' ? ' active' : ''}" data-tool="eraser" onclick="setTool('eraser')">消しゴム</button>
        <button class="tool-btn${currentTool === 'fill' ? ' active' : ''}" data-tool="fill" onclick="setTool('fill')">塗りつぶし</button>
        <label style="margin-left:8px;">
            太さ:
            <select id="palette-penSize">
                <option value="1"${penSize == 1 ? ' selected' : ''}>1</option>
                <option value="2"${penSize == 2 ? ' selected' : ''}>2</option>
                <option value="3"${penSize == 3 ? ' selected' : ''}>3</option>
                <option value="4"${penSize == 4 ? ' selected' : ''}>4</option>
            </select>
        </label>
        <label style="margin-left:8px;">
            <select id="palette-penMode">
                <option value="square"${penMode === 'square' ? ' selected' : ''}>四角ペン</option>
                <option value="circle"${penMode === 'circle' ? ' selected' : ''}>丸ペン</option>
            </select>
        </label>
    `;
    toolBar.querySelector("#palette-penSize").onchange = (e) => setPenSize(e.target.value);
    toolBar.querySelector("#palette-penMode").onchange = (e) => setPenMode(e.target.value);
    toolBar.querySelectorAll(".tool-btn").forEach(btn => {
        btn.onclick = () => setTool(btn.dataset.tool);
    });
}

// 初期化
window.onload = () => {
    // プロジェクト初期化
    projects = [createProject()];
    activeProject = 0;
    updateProjectUI();
    updateFrameUI(); // ←追加
    updateLayerUI();
    initCanvas();
    setTool("pen");
    createPalette();

    document.getElementById("penSize").value = penSize;
    document.getElementById("penMode").value = penMode;

    canvas.onmousemove = handleMouseMove;
    canvas.onmouseup = handleMouseUp;
    canvas.onmouseleave = handleMouseUp;
    // タッチイベント
    canvas.ontouchstart = handleTouchStart;
    canvas.ontouchmove = handleTouchMove;
    canvas.ontouchend = handleTouchEnd;
    canvas.ontouchcancel = handleTouchEnd;
    // パッシブでないリスナーでスクロール抑止
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    createPalette();
};