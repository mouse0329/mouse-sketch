// ColorPickerPaletteDialog.js
// カラーピッカーUIでパレット追加ダイアログを置き換える
// showColorPickerPaletteDialog({ onAdd: ({hex, rgba, a}) => {...}, onClose: () => {...} })

function showColorPickerPaletteDialog({onAdd, onClose} = {}) {
    if (document.getElementById('color-picker-palette-dialog')) return;
    const dlg = document.createElement('div');
    dlg.id = 'color-picker-palette-dialog';
    dlg.style.position = 'fixed';
    dlg.style.left = '0';
    dlg.style.top = '0';
    dlg.style.width = '100vw';
    dlg.style.height = '100vh';
    dlg.style.background = 'rgba(0,0,0,0.25)';
    dlg.style.display = 'flex';
    dlg.style.alignItems = 'center';
    dlg.style.justifyContent = 'center';
    dlg.style.zIndex = '5000';

    dlg.innerHTML = `
      <div style="background:#fff;padding:18px 24px;border-radius:10px;min-width:350px;text-align:center;box-shadow:0 2px 16px #0003;">
        <h3 style="margin:0 0 8px 0;">パレットに色を追加</h3>
        <div id="colorPickerPalettePit" style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin-bottom:8px;"></div>
        <canvas id="colorPickerPaletteCanvas" width="350" height="320" style="display:block;margin:0 auto 8px auto;border-radius:8px;"></canvas>
        <div id="colorPickerPaletteInfo" style="margin-bottom:8px;font-size:14px;"></div>
        <input id="colorPickerPaletteHex" type="text" maxlength="9" style="width:110px;margin-bottom:8px;" placeholder="#RRGGBB">
        <div style="display:flex;gap:8px;justify-content:center;margin-top:8px;">
          <button id="colorPickerPaletteOkBtn">追加</button>
          <button id="colorPickerPaletteCancelBtn">キャンセル</button>
        </div>
      </div>
    `;
        // --- カラーパレット（色見本）を表示 ---
        const pit = dlg.querySelector('#colorPickerPalettePit');
        let palette = (window.PALETTE_COLORS && Array.isArray(PALETTE_COLORS)) ? window.PALETTE_COLORS : [];
        let selectedIdx = -1;
        // HEX欄・カラーピッカーと連動して選択枠を動かす
        function renderPit(selectedHex) {
          pit.innerHTML = '';
          palette.forEach((color, idx) => {
            const btn = document.createElement('button');
            btn.className = 'palette-color';
            btn.style.width = '28px';
            btn.style.height = '28px';
            btn.style.margin = '1px';
            btn.style.borderRadius = '6px';
            btn.style.border = (selectedIdx === idx) ? '3px solid #1976d2' : '1px solid #ccc';
            btn.style.boxSizing = 'border-box';
            if (color === 'transparent' || color === '#00000000') {
              btn.style.background = 'repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 50% / 8px 8px';
              btn.title = '透明';
            } else {
              btn.style.background = color;
              btn.title = color;
            }
            btn.onclick = () => {
              selectedIdx = idx;
              // 色をカラーピッカーに反映
              if (/^#([0-9a-fA-F]{6})$/.test(color)) {
                const r = parseInt(color.substr(1,2),16);
                const g = parseInt(color.substr(3,2),16);
                const b = parseInt(color.substr(5,2),16);
                const hsl = rgbToHsl(r,g,b);
                picker.hue = hsl[0];
                picker.sat = hsl[1];
                picker.light = hsl[2];
                picker.alpha = 1.0;
                picker.drawIndicators();
                updateInfo();
                hexInput.value = color;
              } else if (color === 'transparent' || color === '#00000000') {
                picker.hue = 0; picker.sat = 0; picker.light = 100; picker.alpha = 0;
                picker.drawIndicators();
                updateInfo();
                hexInput.value = '';
              }
              renderPit();
            };
            pit.appendChild(btn);
          });
        }
        // HEX欄・カラーピッカーの色と一致するパレット色を選択状態に
        function updateSelectedIdxByHex(hex) {
          selectedIdx = palette.findIndex(c => (c && c.toLowerCase && hex && c.toLowerCase() === hex.toLowerCase()));
        }
        // 初期選択
        updateSelectedIdxByHex('#000000');
        renderPit();
    document.body.appendChild(dlg);

    // ColorPicker.js クラスを使う
    const canvas = dlg.querySelector('#colorPickerPaletteCanvas');
    const info = dlg.querySelector('#colorPickerPaletteInfo');
    const picker = new ColorPicker(canvas, info);
    // 初期値セット（黒・不透明）
    picker.hue = 0;
    picker.sat = 0;
    picker.light = 0;
    picker.alpha = 1.0;
    picker.drawIndicators();
    const hexInput = dlg.querySelector('#colorPickerPaletteHex');
    function updateInfo() {
      const hsla = picker.getColorHSLA();
      const rgba = picker.getColorRGBA();
      const hex = rgbToHex(rgba[0],rgba[1],rgba[2]);
      info.innerHTML = `HEX: <b>${hex}</b>　RGBA: <b>rgba(${rgba[0]},${rgba[1]},${rgba[2]},${rgba[3].toFixed(2)})</b>`;
      hexInput.value = hex;
      updateSelectedIdxByHex(hex);
      renderPit();
    }
    canvas.addEventListener('mouseup', updateInfo);
    canvas.addEventListener('touchend', updateInfo);
    hexInput.addEventListener('change', function() {
      const val = hexInput.value.trim();
      if (/^#([0-9a-fA-F]{6})$/.test(val)) {
        const r = parseInt(val.substr(1,2),16);
        const g = parseInt(val.substr(3,2),16);
        const b = parseInt(val.substr(5,2),16);
        const hsl = rgbToHsl(r,g,b);
        picker.hue = hsl[0];
        picker.sat = hsl[1];
        picker.light = hsl[2];
        picker.drawIndicators();
        updateInfo();
      }
    });
    updateInfo();
    dlg.querySelector('#colorPickerPaletteOkBtn').onclick = () => {
      let hex = hexInput.value.trim();
      let rgba = picker.getColorRGBA();
      if (/^#([0-9a-fA-F]{6})$/.test(hex)) {
        const r = parseInt(hex.substr(1,2),16);
        const g = parseInt(hex.substr(3,2),16);
        const b = parseInt(hex.substr(5,2),16);
        rgba = [r,g,b,rgba[3]];
        hex = rgbToHex(r,g,b);
      } else {
        hex = rgbToHex(rgba[0],rgba[1],rgba[2]);
      }
      if (onAdd) onAdd({hex, rgba, a: rgba[3]});
      dlg.remove();
      if (onClose) onClose(true);
    };
    dlg.querySelector('#colorPickerPaletteCancelBtn').onclick = () => {
        dlg.remove();
        if (onClose) onClose(false);
    };
    dlg.addEventListener('click', (ev) => { if (ev.target === dlg) { dlg.remove(); if (onClose) onClose(false); } });
}
