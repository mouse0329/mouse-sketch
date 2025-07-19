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
function createProject(w = 16, h = 16, name = "") {
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
        height: h,
        name: name || `画像${projects.length + 1}`
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
        // 名前編集可能に
        const nameSpan = document.createElement("span");
        nameSpan.className = "project-name";
        nameSpan.textContent = projects[i].name || `画像${i + 1}`;
        nameSpan.title = "クリックで名前を編集";
        nameSpan.onclick = (e) => {
            e.stopPropagation();
            editProjectName(i, nameSpan);
        };
        item.appendChild(nameSpan);

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

// プロジェクト名編集用
function editProjectName(idx, spanEl) {
    const input = document.createElement("input");
    input.type = "text";
    input.value = projects[idx].name || `画像${idx + 1}`;
    input.className = "project-name-edit";
    input.style.width = "80px";
    input.onblur = () => {
        projects[idx].name = input.value.trim() || `画像${idx + 1}`;
        updateProjectUI();
    };
    input.onkeydown = (e) => {
        if (e.key === "Enter") input.blur();
    };
    spanEl.replaceWith(input);
    input.focus();
    input.select();
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
                <label>名前: <input id="newProjName" type="text" maxlength="32" value="画像${projects.length + 1}" style="width:120px;"></label>
            </div>
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
        const name = dialog.querySelector("#newProjName").value.trim();
        dialog.remove();
        if (callback) callback(w, h, name);
    };
    dialog.querySelector("#newProjCancelBtn").onclick = () => {
        dialog.remove();
    };
}

function addProject() {
    showNewProjectDialog((w, h, name) => {
        if (!Number.isFinite(w) || w < 1) w = 16;
        if (!Number.isFinite(h) || h < 1) h = 16;
        projects.push(createProject(w, h, name));
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
// 透明色を先頭に追加（#00000000は透明）
let PALETTE_COLORS = [
    "transparent", // ←透明色
    "#000000", "#444444", "#888888", "#cccccc", "#ffffff",
    "#ff0000", "#ffa500", "#ffff00", "#00ff00", "#00ffff",
    "#0000ff", "#ff00ff", "#800000", "#808000", "#008000",
    "#008080", "#000080", "#800080", "#c0c0c0", "#ff69b4"
];

let currentAlpha = 1.0; // 0.0～1.0

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

// HEX→RGBA
function hexToRgba(hex, alpha = 1.0) {
    if (hex === "transparent" || hex === "#00000000") return [0, 0, 0, 0];
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    let num = parseInt(hex, 16);
    return [
        (num >> 16) & 255,
        (num >> 8) & 255,
        num & 255,
        Math.round(255 * alpha)
    ];
}

// 塗りつぶしアルゴリズム
function fillAt(x, y) {
    let p = getCurrentProject();
    let f = getCurrentFrame();
    let lctx = f.layers[f.activeLayer].getContext("2d");
    let imgData = lctx.getImageData(0, 0, p.width * cellSize, p.height * cellSize);
    let px = x * cellSize, py = y * cellSize;
    let target = getPixel(imgData, px, py);
    // 透明色対応
    let fillColor = (currentColor === "transparent" || currentColor === "#00000000" || currentAlpha === 0)
        ? [0, 0, 0, 0]
        : hexToRgba(currentColor, currentAlpha);

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
    if (!f || !p) return;
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
    // 透明色対応
    if (currentTool === "eraser" || currentColor === "transparent" || currentColor === "#00000000" || currentAlpha === 0) {
        drawPenShape(lctx, x, y, "#00000000", true);
    } else {
        // RGBA色で描画
        let rgba = hexToRgba(currentColor, currentAlpha);
        lctx.save();
        lctx.globalAlpha = rgba[3] / 255;
        drawPenShape(lctx, x, y, `rgba(${rgba[0]},${rgba[1]},${rgba[2]},${rgba[3] / 255})`, false);
        lctx.restore();
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
function drawDotTouch(x, y) {
    let p = getCurrentProject();
    let f = getCurrentFrame();
    if (x < 0 || y < 0 || x >= p.width || y >= p.height) return;
    let lctx = f.layers[f.activeLayer].getContext("2d");
    // 透明色対応
    if (currentTool === "eraser" || currentColor === "transparent" || currentColor === "#00000000" || currentAlpha === 0) {
        drawPenShape(lctx, x, y, "#00000000", true);
    } else {
        let rgba = hexToRgba(currentColor, currentAlpha);
        lctx.save();
        lctx.globalAlpha = rgba[3] / 255;
        drawPenShape(lctx, x, y, `rgba(${rgba[0]},${rgba[1]},${rgba[2]},${rgba[3] / 255})`, false);
        lctx.restore();
    }
    redrawAll();
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

    // ファイル名にプロジェクト名を利用
    let baseName = (p.name || `nezumi-drawing`).replace(/[\\/:*?"<>|]/g, "_");

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
        link.download = `${baseName}.${type}`;
        if (type === "jpg" || type === "jpeg") {
            link.href = tmp.toDataURL(mime, 0.92);
        } else {
            link.href = tmp.toDataURL(mime);
        }
        link.click();
    } else if (type === "webp" && typeof window.WebCodecs !== "undefined") {
        exportWebpAnimation(frames, p.width * cellSize, p.height * cellSize, baseName);
    } else {
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
            link.download = `${baseName}-f${fi + 1}.${type}`;
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
async function exportWebpAnimation(frames, width, height, baseName = "nezumi-animation") {
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
    link.download = `${baseName}.webm`;
    link.href = URL.createObjectURL(webmBlob);
    link.click();
}

// アニメーションGIFエクスポート（全フレーム合成）
function exportGif() {
    let p = getCurrentProject();
    let frames = p.frames;
    let width = p.width * cellSize;
    let height = p.height * cellSize;
    const canvasImages = frames.map(f => {
        let tmp = document.createElement("canvas");
        tmp.width = width;
        tmp.height = height;
        let tctx = tmp.getContext("2d");
        for (let li = 0; li < f.layers.length; li++) {
            tctx.drawImage(f.layers[li], 0, 0);
        }
        return tmp.toDataURL("image/png");
    });
    Promise.all(canvasImages.map(src => {
        return new Promise(resolve => {
            const img = new Image();
            img.src = src;
            img.onload = () => resolve(img);
        });
    })).then(images => {
        const validImages = images.filter(img => img.width > 0 && img.height > 0);
        if (validImages.length === 0) {
            alert("GIFに変換できる画像がありません。");
            return;
        }
        // ファイル名をプロジェクト名から生成
        const baseName = (p.name || `nezumi-animation`).replace(/[\\/:*?"<>|]/g, "_");
        convertToGIF(validImages, 300, baseName + ".gif");
    });
}

function exportApng() {
    let p = getCurrentProject();
    let frames = p.frames;
    let width = p.width * cellSize;
    let height = p.height * cellSize;
    const images = frames.map(f => {
        let tmp = document.createElement("canvas");
        tmp.width = width;
        tmp.height = height;
        let tctx = tmp.getContext("2d");
        for (let li = 0; li < f.layers.length; li++) {
            tctx.drawImage(f.layers[li], 0, 0);
        }
        let img = new Image();
        img.src = tmp.toDataURL("image/png");
        return img;
    });
    const baseName = (p.name || `nezumi-animation`).replace(/[\\/:*?"<>|]/g, "_");
    convertToAPNG(images, width, height, 300, baseName + ".apng");
}

// 編集用ファイル保存
function saveProjectFile() {
    // すべてのプロジェクト・フレーム・レイヤーをシリアライズ
    const data = {
        projects: projects.map(p => ({
            width: p.width,
            height: p.height,
            name: p.name || "",
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
            projects = data.projects.map((pdata, idx) => {
                let p = createProject(pdata.width, pdata.height, pdata.name || `画像${idx + 1}`);
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
                        img.onload = (() => {
                            let ctx2 = c.getContext("2d");
                            ctx2.clearRect(0, 0, c.width, c.height);
                            ctx2.drawImage(img, 0, 0);
                        });
                        img.onload();
                        f.layers.push(c);
                        f.layerHistories.push([]);
                        f.layerRedoStacks.push([]);
                    }
                    return f;
                });
                p.activeFrame = pdata.activeFrame;
                p.name = pdata.name || `画像${idx + 1}`;
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

// パレット生成関数を修正（パレット下ツールバーにも透明度スライダー追加）
function createPalette() {
    const palette = document.getElementById("color-palette");
    if (!palette) return;
    palette.innerHTML = "";

    PALETTE_COLORS.forEach((color, idx) => {
        const btn = document.createElement("button");
        btn.className = "palette-color";
        if (color === "transparent" || color === "#00000000") {
            btn.style.background = "repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 50% / 16px 16px";
            btn.title = "透明";
            btn.innerHTML = '<span style="font-size:13px;color:#888;">透明</span>';
        } else {
            btn.style.background = color;
            btn.title = color;
        }
        btn.onclick = () => {
            currentColor = color;
            // カラーピッカーも同期（透明色は黒に戻す）
            if (color === "transparent" || color === "#00000000") {
                document.getElementById("colorPicker").value = "#000000";
            } else {
                document.getElementById("colorPicker").value = color;
            }
            document.querySelectorAll(".palette-color").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
        };
        // 透明色は削除不可
        if (idx !== 0) {
            const delBtn = document.createElement("span");
            delBtn.textContent = "×";
            delBtn.className = "palette-del-btn";
            delBtn.title = "この色をパレットから削除";
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if (PALETTE_COLORS.length > 2) {
                    PALETTE_COLORS.splice(idx, 1);
                    createPalette();
                }
            };
            btn.appendChild(delBtn);
        }
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
        <button class="tool-btn${currentTool === 'pen' ? ' active' : ''}" data-tool="pen" onclick="setTool('pen')"><span class="material-icons" style="vertical-align: middle;">edit</span>ペン</button>
        <button class="tool-btn${currentTool === 'eraser' ? ' active' : ''}" data-tool="eraser" onclick="setTool('eraser')"><span class="material-icons" style="vertical-align: middle;">delete</span>消しゴム</button>
        <button class="tool-btn${currentTool === 'fill' ? ' active' : ''}" data-tool="fill" onclick="setTool('fill')"><span class="material-icons" style="vertical-align: middle;">format_color_fill</span>塗りつぶし</button>
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
        <label style="margin-left:8px;">
            透明度:
            <input type="range" id="palette-alphaSlider" min="0" max="100" value="${Math.round(currentAlpha * 100)}" style="vertical-align: middle; width:70px;">
            <span id="palette-alphaValue">${Math.round(currentAlpha * 100)}%</span>
        </label>
    `;
    toolBar.querySelector("#palette-penSize").onchange = (e) => setPenSize(e.target.value);
    toolBar.querySelector("#palette-penMode").onchange = (e) => setPenMode(e.target.value);
    toolBar.querySelectorAll(".tool-btn").forEach(btn => {
        btn.onclick = () => setTool(btn.dataset.tool);
    });
    // 透明度スライダーイベント
    toolBar.querySelector("#palette-alphaSlider").oninput = (e) => {
        setAlpha(e.target.value);
        toolBar.querySelector("#palette-alphaValue").textContent = `${e.target.value}%`;
        // メインツールバーのスライダーも同期
        let mainAlpha = document.getElementById("alphaSlider");
        let mainAlphaVal = document.getElementById("alphaValue");
        if (mainAlpha) mainAlpha.value = e.target.value;
        if (mainAlphaVal) mainAlphaVal.textContent = `${e.target.value}%`;
    };
}

// 透明度スライダーの値をセット
function setAlpha(val) {
    let v = Math.max(0, Math.min(100, parseInt(val, 10) || 0));
    currentAlpha = v / 100;
    // メインツールバーのスライダーも同期
    let mainAlpha = document.getElementById("alphaSlider");
    let mainAlphaVal = document.getElementById("alphaValue");
    if (mainAlpha) mainAlpha.value = v;
    if (mainAlphaVal) mainAlphaVal.textContent = `${v}%`;
    // パレットツールバーも同期
    let palAlpha = document.getElementById("palette-alphaSlider");
    let palAlphaVal = document.getElementById("palette-alphaValue");
    if (palAlpha) palAlpha.value = v;
    if (palAlphaVal) palAlphaVal.textContent = `${v}%`;
}

// カラーピッカーで透明色を選択できるようにする（透明色は黒に戻す）
document.addEventListener("DOMContentLoaded", () => {
    const colorPicker = document.getElementById("colorPicker");
    if (colorPicker) {
        colorPicker.oninput = (e) => {
            currentColor = e.target.value;
            document.querySelectorAll(".palette-color").forEach(b => b.classList.remove("selected"));
        };
    }
    // 透明度スライダーイベント
    const alphaSlider = document.getElementById("alphaSlider");
    const alphaValue = document.getElementById("alphaValue");
    if (alphaSlider && alphaValue) {
        alphaSlider.oninput = (e) => {
            setAlpha(e.target.value);
            alphaValue.textContent = `${e.target.value}%`;
            // パレットツールバーのスライダーも同期
            let palAlpha = document.getElementById("palette-alphaSlider");
            let palAlphaVal = document.getElementById("palette-alphaValue");
            if (palAlpha) palAlpha.value = e.target.value;
            if (palAlphaVal) palAlphaVal.textContent = `${e.target.value}%`;
        };
    }
});

// GIF変換関数（外部画像配列→GIF生成）
async function convertToGIF(images, delay = 200, filename = "nezumi-animation.gif") {
    const gif = new window.GIF({
        workers: 2,
        quality: 10,
        workerScript: 'lib/gif.worker.js'
    });
    images.forEach(img => gif.addFrame(img, { delay }));
    gif.on('finished', blob => {
        const url = URL.createObjectURL(blob);
        // ダウンロードリンク生成
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 1000);
    });
    gif.render();
}

function convertToAPNG(images, width, height, delay = 200, filename = "nezumi-animation.apng") {
    const frames = [];
    const durations = [];
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    images.forEach(img => {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const rgba = ctx.getImageData(0, 0, width, height).data.buffer;
        frames.push(rgba);
        durations.push(delay);
    });
    const apng = window.UPNG.encode(frames, width, height, 0, durations);
    const url = URL.createObjectURL(new Blob([apng], { type: "image/apng" }));
    // ダウンロードリンク生成
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 1000);
}

// 画像パス配列からImageオブジェクト配列を生成
async function loadImages(imagePaths) {
    const images = await Promise.all(imagePaths.map(src => {
        return new Promise(resolve => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = src;
            img.onload = () => resolve(img);
        });
    }));
    return images;
}

// 使用例（必要に応じて呼び出し）
// const imagePaths = ['frame1.jpg', 'frame2.jpg', 'frame3.jpg'];
// loadImages(imagePaths).then(images => {
//     convertToGIF(images, 200);
//     convertToAPNG(images, 200, 200, 200);
// });
// 以下は既存のスクリプト。変更なし。
function toggleSection(id) {
    const section = document.getElementById(id);
    const content = section.querySelector('.section-content');
    const btn = section.querySelector('.toggle-btn');
    if (content.style.display === "none") {
        content.style.display = "";
        btn.textContent = "▼";
    } else {
        content.style.display = "none";
        btn.textContent = "▲";
    }
}
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('.section.collapsible .section-content').forEach(el => el.style.display = "");
    document.querySelectorAll('.section.collapsible .toggle-btn').forEach(el => el.textContent = "▼");
});
window.addEventListener('resize', updateMenuBtnDisplay);
document.addEventListener('DOMContentLoaded', updateMenuBtnDisplay);
function toggleSideMenu(forceOpen) {
    const sidebar = document.getElementById('sidebar');
    const mainContainer = document.getElementById('main-container');
    const openBtn = document.getElementById('menu-toggle-btn');
    const closeBtn = document.getElementById('menu-toggle-btn-close');
    const isOpen = sidebar.classList.contains('open');
    let willOpen = typeof forceOpen === "boolean" ? forceOpen : !isOpen;
    if (willOpen) {
        sidebar.classList.add('open');
        mainContainer.classList.add('sidebar-open');
        document.body.style.overflow = "hidden";
        document.body.style.touchAction = "none";
        if (window.innerWidth <= 900) {
            closeBtn.style.display = "block";
            openBtn.style.display = "none";
        }
    } else {
        sidebar.classList.remove('open');
        mainContainer.classList.remove('sidebar-open');
        document.body.style.overflow = "";
        document.body.style.touchAction = "";
        if (window.innerWidth <= 900) {
            closeBtn.style.display = "none";
            openBtn.style.display = "block";
        }
    }
}
function updateMenuBtnDisplay() {
    const sidebar = document.getElementById('sidebar');
    const mainContainer = document.getElementById('main-container');
    const openBtn = document.getElementById('menu-toggle-btn');
    const closeBtn = document.getElementById('menu-toggle-btn-close');
    if (window.innerWidth > 900) {
        sidebar.classList.remove('open');
        mainContainer.classList.remove('sidebar-open');
        closeBtn.style.display = "none";
        openBtn.style.display = "none";
        document.body.style.overflow = "";
        document.body.style.touchAction = "";
    } else {
        if (sidebar.classList.contains('open')) {
            closeBtn.style.display = "block";
            openBtn.style.display = "none";
        } else {
            closeBtn.style.display = "none";
            openBtn.style.display = "block";
        }
    }
}
document.addEventListener('click', function (e) {
    if (window.innerWidth > 900) return;
    const sidebar = document.getElementById('sidebar');
    const mainContainer = document.getElementById('main-container');
    const btn = document.getElementById('menu-toggle-btn');
    const closeBtn = document.getElementById('menu-toggle-btn-close');
    if (!sidebar.contains(e.target) && e.target !== btn && e.target !== closeBtn) {
        sidebar.classList.remove('open');
        mainContainer.classList.remove('sidebar-open');
        closeBtn.style.display = "none";
        btn.style.display = "block";
        document.body.style.overflow = "";
        document.body.style.touchAction = "";
    }
});