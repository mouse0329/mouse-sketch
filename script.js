let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");

// --- フレーム＆レイヤー構造 ---
let frames = [];
let activeFrame = 0;
let activeLayer = 0;
let currentWidth = 16;
let currentHeight = 16;
let cellSize = 20;
let currentColor = "#ff0000";

// --- フレームUI ---
function updateFrameUI() {
    const frameList = document.getElementById("frameList");
    frameList.innerHTML = "";
    for (let i = 0; i < frames.length; i++) {
        const item = document.createElement("button");
        item.textContent = `F${i + 1}`;
        item.className = "frame-btn" + (i === activeFrame ? " active" : "");
        item.onclick = () => {
            activeFrame = i;
            activeLayer = 0;
            updateFrameUI();
            updateLayerUI();
            redrawAll();
        };
        frameList.appendChild(item);
    }
    document.getElementById("frameCount").textContent = `(${frames.length}フレーム)`;
}

function addFrame() {
    frames.push(createEmptyFrame());
    activeFrame = frames.length - 1;
    activeLayer = 0;
    updateFrameUI();
    updateLayerUI();
    redrawAll();
}

function removeFrame() {
    if (frames.length <= 1) return;
    frames.splice(activeFrame, 1);
    if (activeFrame >= frames.length) activeFrame = frames.length - 1;
    activeLayer = 0;
    updateFrameUI();
    updateLayerUI();
    redrawAll();
}

function createEmptyFrame() {
    return {
        layers: [createEmptyLayer()],
        layerHistories: [[]],
        layerRedoStacks: [[]]
    };
}

function createEmptyLayer() {
    let off = document.createElement("canvas");
    off.width = currentWidth * cellSize;
    off.height = currentHeight * cellSize;
    return off;
}

// --- レイヤーUI（現在のフレームのみ） ---
function updateLayerUI() {
    const frame = frames[activeFrame];
    document.getElementById("layerCount").textContent = `(${frame.layers.length}枚)`;
    const list = document.getElementById("layerList");
    list.innerHTML = "";
    for (let i = frame.layers.length - 1; i >= 0; i--) {
        const item = document.createElement("div");
        item.className = "layer-item" + (i === activeLayer ? " active" : "");
        item.onclick = (e) => {
            if (e.target.classList.contains("layer-btn")) return;
            activeLayer = i;
            updateLayerUI();
            redrawAll();
        };
        const thumb = document.createElement("canvas");
        thumb.className = "layer-thumb";
        thumb.width = 32;
        thumb.height = 32;
        let tctx = thumb.getContext("2d");
        tctx.clearRect(0, 0, 32, 32);
        tctx.drawImage(frame.layers[i], 0, 0, thumb.width, thumb.height);
        item.appendChild(thumb);

        const label = document.createElement("span");
        label.textContent = `レイヤー${i + 1}`;
        item.appendChild(label);

        const upBtn = document.createElement("button");
        upBtn.textContent = "↑";
        upBtn.className = "layer-btn";
        upBtn.title = "上に移動";
        upBtn.disabled = (i === frame.layers.length - 1);
        upBtn.onclick = (e) => {
            e.stopPropagation();
            if (i < frame.layers.length - 1) swapLayer(i, i + 1);
        };
        item.appendChild(upBtn);

        const downBtn = document.createElement("button");
        downBtn.textContent = "↓";
        downBtn.className = "layer-btn";
        downBtn.title = "下に移動";
        downBtn.disabled = (i === 0);
        downBtn.onclick = (e) => {
            e.stopPropagation();
            if (i > 0) swapLayer(i, i - 1);
        };
        item.appendChild(downBtn);

        const delBtn = document.createElement("button");
        delBtn.textContent = "削除";
        delBtn.className = "layer-btn";
        delBtn.title = "このレイヤーを削除";
        delBtn.disabled = (frame.layers.length === 1);
        delBtn.onclick = (e) => {
            e.stopPropagation();
            removeLayerAt(i);
        };
        item.appendChild(delBtn);

        list.appendChild(item);
    }
}

function swapLayer(i, j) {
    const frame = frames[activeFrame];
    [frame.layers[i], frame.layers[j]] = [frame.layers[j], frame.layers[i]];
    [frame.layerHistories[i], frame.layerHistories[j]] = [frame.layerHistories[j], frame.layerHistories[i]];
    [frame.layerRedoStacks[i], frame.layerRedoStacks[j]] = [frame.layerRedoStacks[j], frame.layerRedoStacks[i]];
    if (activeLayer === i) activeLayer = j;
    else if (activeLayer === j) activeLayer = i;
    updateLayerUI();
    redrawAll();
}

function removeLayerAt(idx) {
    const frame = frames[activeFrame];
    if (frame.layers.length <= 1) return;
    frame.layers.splice(idx, 1);
    frame.layerHistories.splice(idx, 1);
    frame.layerRedoStacks.splice(idx, 1);
    if (activeLayer >= frame.layers.length) activeLayer = frame.layers.length - 1;
    updateLayerUI();
    redrawAll();
}

function addLayer() {
    const frame = frames[activeFrame];
    frame.layers.push(createEmptyLayer());
    frame.layerHistories.push([]);
    frame.layerRedoStacks.push([]);
    activeLayer = frame.layers.length - 1;
    saveHistory();
    updateLayerUI();
    redrawAll();
}

// removeLayerは従来通り（レイヤーリストの削除ボタンはremoveLayerAtを使う）
function removeLayer() {
    if (layers.length <= 1) return;
    layers.splice(activeLayer, 1);
    layerHistories.splice(activeLayer, 1);
    layerRedoStacks.splice(activeLayer, 1);
    activeLayer = Math.max(0, activeLayer - 1);
    updateLayerUI();
    redrawAll();
}

function selectLayer(idx) {
    activeLayer = parseInt(idx);
    updateLayerUI();
}

// --- 描画 ---
let isDrawing = false;
function drawDot(e) {
    if (isPlaying) return;
    const frame = frames[activeFrame];
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cellSize);
    const y = Math.floor((e.clientY - rect.top) / cellSize);
    let lctx = frame.layers[activeLayer].getContext("2d");
    lctx.fillStyle = currentColor;
    lctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    redrawAll();
}

function handleMouseDown(e) { isDrawing = true; drawDot(e); }
function handleMouseMove(e) { if (!isDrawing) return; drawDot(e); }
function handleMouseUp(e) { if (isDrawing) { saveHistory(); } isDrawing = false; }

// --- キャンバス初期化 ---
function initCanvas() {
    const w = parseInt(document.getElementById("canvasWidth").value);
    const h = parseInt(document.getElementById("canvasHeight").value);
    currentWidth = w;
    currentHeight = h;
    canvas.width = w * cellSize;
    canvas.height = h * cellSize;
    // フレーム構造で初期化
    frames = [createEmptyFrame()];
    activeFrame = 0;
    activeLayer = 0;
    saveHistory();
    redrawAll();

    canvas.onmousedown = handleMouseDown;
    canvas.onmousemove = handleMouseMove;
    canvas.onmouseup = handleMouseUp;
    canvas.onmouseleave = handleMouseUp;
    canvas.onclick = null;
}

// --- 合成描画 ---
function redrawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const frame = frames[activeFrame];
    for (let i = 0; i < frame.layers.length; i++) {
        ctx.drawImage(frame.layers[i], 0, 0);
    }
    drawGrid(currentWidth, currentHeight);
}

// --- 履歴 ---
function saveHistory() {
    const frame = frames[activeFrame];
    let arr = frame.layerHistories[activeLayer];
    arr.push(frame.layers[activeLayer].toDataURL());
    if (arr.length > 50) arr.shift();
    frame.layerRedoStacks[activeLayer] = [];
}

function undo() {
    const frame = frames[activeFrame];
    let arr = frame.layerHistories[activeLayer];
    let redoArr = frame.layerRedoStacks[activeLayer];
    if (!arr || arr.length < 2) return;
    redoArr.push(arr.pop());
    let img = new Image();
    img.onload = () => {
        let lctx = frame.layers[activeLayer].getContext("2d");
        lctx.clearRect(0, 0, frame.layers[activeLayer].width, frame.layers[activeLayer].height);
        lctx.drawImage(img, 0, 0);
        redrawAll();
    };
    img.src = arr[arr.length - 1];
}

function redo() {
    const frame = frames[activeFrame];
    let arr = frame.layerHistories[activeLayer];
    let redoArr = frame.layerRedoStacks[activeLayer];
    if (!redoArr || redoArr.length === 0) return;
    let imgURL = redoArr.pop();
    arr.push(imgURL);
    let img = new Image();
    img.onload = () => {
        let lctx = frame.layers[activeLayer].getContext("2d");
        lctx.clearRect(0, 0, frame.layers[activeLayer].width, frame.layers[activeLayer].height);
        lctx.drawImage(img, 0, 0);
        redrawAll();
    };
    img.src = imgURL;
}

// --- エクスポート ---
function exportImage(type) {
    // 現在のフレームの合成結果をエクスポート
    let mime = `image/${type}`;
    let tmp = document.createElement("canvas");
    tmp.width = canvas.width;
    tmp.height = canvas.height;
    let tctx = tmp.getContext("2d");
    const frame = frames[activeFrame];
    for (let i = 0; i < frame.layers.length; i++) {
        tctx.drawImage(frame.layers[i], 0, 0);
    }
    let link = document.createElement("a");
    link.download = `nezumi-drawing.${type}`;
    link.href = tmp.toDataURL(mime);
    link.click();
}

function exportGif() {
    loadGifJs(() => {
        let tmp = document.createElement("canvas");
        tmp.width = canvas.width;
        tmp.height = canvas.height;
        let tctx = tmp.getContext("2d");
        let gif = new window.GIF({
            workers: 2,
            quality: 10,
            width: tmp.width,
            height: tmp.height,
            workerScript: 'lib/gif.worker.js'
        });
        for (let f = 0; f < frames.length; f++) {
            tctx.clearRect(0, 0, tmp.width, tmp.height);
            for (let l = 0; l < frames[f].layers.length; l++) {
                tctx.drawImage(frames[f].layers[l], 0, 0);
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

// --- アニメーション再生 ---
let animTimer = null;
let animFrame = 0;
let isPlaying = false;

function playAnimation() {
    if (isPlaying || frames.length === 0) return;
    isPlaying = true;
    setEditEnabled(false);
    document.getElementById("playBtn").disabled = true;
    document.getElementById("stopBtn").disabled = false;
    animFrame = 0;
    showAnimFrame(animFrame);
    let speed = parseInt(document.getElementById("animSpeed").value) || 300;
    animTimer = setInterval(() => {
        animFrame = (animFrame + 1) % frames.length;
        showAnimFrame(animFrame);
    }, speed);
}

function stopAnimation() {
    isPlaying = false;
    setEditEnabled(true);
    document.getElementById("playBtn").disabled = false;
    document.getElementById("stopBtn").disabled = true;
    if (animTimer) clearInterval(animTimer);
    animTimer = null;
    redrawAll();
    document.getElementById("animFrameInfo").textContent = "";
}

function showAnimFrame(frameIdx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const frame = frames[frameIdx];
    for (let i = 0; i < frame.layers.length; i++) {
        ctx.drawImage(frame.layers[i], 0, 0);
    }
    drawGrid(currentWidth, currentHeight);
    document.getElementById("animFrameInfo").textContent = `フレーム ${frameIdx + 1} / ${frames.length}`;
}

// アニメーション再生中は編集禁止
function setEditEnabled(enabled) {
    canvas.style.pointerEvents = enabled ? "auto" : "none";
    document.getElementById("layerList").style.pointerEvents = enabled ? "auto" : "none";
    document.getElementById("colorPicker").disabled = !enabled;
    document.getElementById("controls").querySelectorAll("button,input").forEach(el => {
        if (el.id !== "stopBtn" && el.id !== "playBtn" && el.type !== "color") el.disabled = !enabled;
    });
    document.getElementById("layer-controls").querySelectorAll("button").forEach(el => {
        el.disabled = !enabled && el.textContent !== "レイヤー追加";
    });
}

// --- グリッド描画 ---
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

// --- gif.jsのローカルを動的に読み込む ---
function loadGifJs(callback) {
    if (window.GIF) {
        callback();
        return;
    }
    let script = document.createElement('script');
    script.src = 'lib/gif.js'; // ローカルパス
    script.onload = callback;
    document.body.appendChild(script);
}

// --- 初期化 ---
window.onload = () => {
    // フレームUI追加
    if (!document.getElementById("frame-controls")) {
        const frameDiv = document.createElement("div");
        frameDiv.id = "frame-controls";
        frameDiv.innerHTML = `
            <button onclick="addFrame()">フレーム追加</button>
            <button onclick="removeFrame()">フレーム削除</button>
            <span id="frameCount"></span>
            <div id="frameList" style="display:inline-block"></div>
        `;
        document.body.insertBefore(frameDiv, document.getElementById("layer-controls"));
    }
    initCanvas();
    updateFrameUI();
    updateLayerUI();
    document.getElementById("playBtn").disabled = false;
    document.getElementById("stopBtn").disabled = true;
    isDrawing = false;
};

function initCanvas() {
    const w = parseInt(document.getElementById("canvasWidth").value);
    const h = parseInt(document.getElementById("canvasHeight").value);
    currentWidth = w;
    currentHeight = h;
    canvas.width = w * cellSize;
    canvas.height = h * cellSize;
    // レイヤー初期化
    layers = [];
    layerHistories = [];
    layerRedoStacks = [];
    let off = document.createElement("canvas");
    off.width = w * cellSize;
    off.height = h * cellSize;
    layers.push(off);
    layerHistories.push([]);
    layerRedoStacks.push([]);
    activeLayer = 0;
    saveHistory();
    updateLayerUI();
    redrawAll();

    canvas.onmousedown = handleMouseDown;
    canvas.onmousemove = handleMouseMove;
    canvas.onmouseup = handleMouseUp;
    canvas.onmouseleave = handleMouseUp;
    // 既存のonclickは不要なので削除
    canvas.onclick = null;
}

// 初期化
window.onload = () => {
    updateLayerUI();
    initCanvas();
    document.getElementById("playBtn").disabled = false;
    document.getElementById("stopBtn").disabled = true;
};
