class ColorPicker {
  constructor(canvas, infoElem) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.infoElem = infoElem;

    this.width = canvas.width;
    this.height = canvas.height;
    this.centerX = this.width/2 - 30 + 5; // 横幅10px拡大分+5px右寄せ
    this.centerY = this.height/2;
    this.radius = 150;
    this.ringThickness = 20;
    this.holeRadius = 30;

    this.hue = 0;
    this.sat = 50;
    this.light = 50;
    this.alpha = 1.0;

    this.draggingHue = false;
    this.draggingSL = false;
    this.draggingAlpha = false;

    this.squareSize = 200;
    this.squareStartX = this.centerX - this.squareSize/2;
    this.squareStartY = this.centerY - this.squareSize/2;

    this.alphaWidth = 20;
    this.alphaHeight = this.squareSize;
    this.alphaX = this.squareStartX + this.squareSize + 70;
    this.alphaY = this.squareStartY;

    this.bgCanvas = document.createElement('canvas');
    this.bgCanvas.width = this.width;
    this.bgCanvas.height = this.height;
    this.bgCtx = this.bgCanvas.getContext('2d');

    this.drawBackground();
    this.drawIndicators();
    this.addEvents();
  }

  drawBackground() {
    for(let angle=0; angle<360; angle+=1) {
      const rad = angle * Math.PI / 180;
      const outerX = this.centerX + Math.cos(rad) * (this.radius + this.ringThickness/2);
      const outerY = this.centerY + Math.sin(rad) * (this.radius + this.ringThickness/2);
      this.bgCtx.strokeStyle = `hsl(${angle},100%,50%)`;
      this.bgCtx.lineWidth = this.ringThickness;
      this.bgCtx.beginPath();
      this.bgCtx.moveTo(this.centerX + Math.cos(rad) * (this.radius - this.ringThickness/2),
                        this.centerY + Math.sin(rad) * (this.radius - this.ringThickness/2));
      this.bgCtx.lineTo(outerX, outerY);
      this.bgCtx.stroke();
    }
    this.bgCtx.clearRect(this.centerX-this.holeRadius, this.centerY-this.holeRadius,
                         this.holeRadius*2, this.holeRadius*2);
  }

  drawIndicators() {
    this.ctx.clearRect(0,0,this.width,this.height);
    this.ctx.drawImage(this.bgCanvas,0,0);

    // S/L四角
    for(let y=0; y<this.squareSize; y++) {
      for(let x=0; x<this.squareSize; x++) {
        const s = x / this.squareSize * 100;
        const l = 100 - y / this.squareSize * 100;
        this.ctx.fillStyle = `hsla(${this.hue},${s}%,${l}%,${this.alpha})`;
        this.ctx.fillRect(this.squareStartX+x, this.squareStartY+y, 1, 1);
      }
    }

    // 円周丸印
    const rad = this.hue * Math.PI / 180;
    const hueX = this.centerX + Math.cos(rad) * this.radius;
    const hueY = this.centerY + Math.sin(rad) * this.radius;
    this.ctx.beginPath();
    this.ctx.arc(hueX, hueY, 8, 0, Math.PI*2);
    this.ctx.strokeStyle = "#000";
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    // S/L丸印
    const slX = this.squareStartX + this.sat/100 * this.squareSize;
    const slY = this.squareStartY + (100-this.light)/100 * this.squareSize;
    this.ctx.beginPath();
    this.ctx.arc(slX, slY, 6, 0, Math.PI*2);
    this.ctx.strokeStyle = "#000";
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Alphaスライダー
    const alphaTop = this.alphaY + (1-this.alpha) * this.alphaHeight;
    this.ctx.fillStyle = `rgba(0,0,0,0.2)`;
    this.ctx.fillRect(this.alphaX, this.alphaY, this.alphaWidth, this.alphaHeight);
    this.ctx.fillStyle = `rgba(0,0,0,1)`;
    this.ctx.fillRect(this.alphaX, alphaTop-3, this.alphaWidth, 6); // 丸印代わり

    if(this.infoElem){
      this.infoElem.textContent = `H: ${Math.round(this.hue)}°, S: ${Math.round(this.sat)}%, L: ${Math.round(this.light)}%, A: ${this.alpha.toFixed(2)}`;
    }
  }

  addEvents() {
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', () => this.onMouseUp());
    this.canvas.addEventListener('mouseleave', () => this.onMouseUp());
  }

  onMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dx = x - this.centerX;
    const dy = y - this.centerY;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if(dist >= this.radius - this.ringThickness/2 && dist <= this.radius + this.ringThickness/2){
      this.draggingHue = true;
      this.updateHue(x, y);
      return;
    }
    if(x >= this.squareStartX && x <= this.squareStartX+this.squareSize &&
       y >= this.squareStartY && y <= this.squareStartY+this.squareSize){
      this.draggingSL = true;
      this.updateSL(x, y);
      return;
    }
    if(x >= this.alphaX && x <= this.alphaX+this.alphaWidth &&
       y >= this.alphaY && y <= this.alphaY+this.alphaHeight){
      this.draggingAlpha = true;
      this.updateAlpha(y);
    }
  }

  onMouseMove(e) {
    if(!this.draggingHue && !this.draggingSL && !this.draggingAlpha) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if(this.draggingHue) this.updateHue(x, y);
    if(this.draggingSL) this.updateSL(x, y);
    if(this.draggingAlpha) this.updateAlpha(y);
  }

  onMouseUp() {
    this.draggingHue = false;
    this.draggingSL = false;
    this.draggingAlpha = false;
  }

  updateHue(x, y) {
    this.hue = Math.atan2(y-this.centerY, x-this.centerX) * 180 / Math.PI;
    if(this.hue < 0) this.hue += 360;
    this.drawIndicators();
  }

  updateSL(x, y) {
    this.sat = Math.min(100, Math.max(0, (x - this.squareStartX)/this.squareSize*100));
    this.light = Math.min(100, Math.max(0, 100 - (y - this.squareStartY)/this.squareSize*100));
    this.drawIndicators();
  }

  updateAlpha(y) {
    this.alpha = Math.min(1, Math.max(0, 1 - (y - this.alphaY)/this.alphaHeight));
    this.drawIndicators();
  }

  getColorHSLA() {
    return `hsla(${this.hue}, ${this.sat}%, ${this.light}%, ${this.alpha})`;
  }

  getColorRGBA() {
    const h = this.hue/360;
    const s = this.sat/100;
    const l = this.light/100;
    let r,g,b;
    if(s===0){
      r=g=b=l;
    } else {
      const q = l<0.5 ? l*(1+s) : l+s-l*s;
      const p = 2*l-q;
      const hue2rgb=(p,q,t)=>{
        if(t<0) t+=1;
        if(t>1) t-=1;
        if(t<1/6) return p+(q-p)*6*t;
        if(t<1/2) return q;
        if(t<2/3) return p+(q-p)*(2/3 - t)*6;
        return p;
      };
      r=hue2rgb(p,q,h+1/3);
      g=hue2rgb(p,q,h);
      b=hue2rgb(p,q,h-1/3);
    }
    r=Math.round(r*255);
    g=Math.round(g*255);
    b=Math.round(b*255);
    return [r, g, b, this.alpha];
  }

  // 文字列で欲しい場合はこちらを使う
  getColorRGBAString() {
    const [r, g, b, a] = this.getColorRGBA();
    return `rgba(${r},${g},${b},${a})`;
  }
}
