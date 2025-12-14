window.AciolcerTool = {
    aciolcerElement: null,
    bodyElement: null,
    markingsElement: null,
    rotateHandle: null,
    redLine: null,
    drawHandle: null,
    drawHandleLabel: null,
    previewCanvas: null,
    previewCtx: null,
    resizeHandle: null,

    // Durum
    state: {
        x: 300, y: 300,
    radius: 150, // Yarıçapı state'e al
    angle: 0,
        currentDrawAngleLocal: 0,
        isDrawing: false,
        hasDragged: false
    },

    interactionMode: 'none',
    startPos: { x: 0, y: 0 },
    startState: {},

    // --- 1. BAŞLATMA ---
    init: function() {
        if (this.aciolcerElement) return;

        this.aciolcerElement = document.createElement('div');
        this.aciolcerElement.className = 'aciolcer-container';

        this.bodyElement = document.createElement('div');
        this.bodyElement.className = 'aciolcer-body';
        this.aciolcerElement.appendChild(this.bodyElement);

        this.markingsElement = document.createElement('div');
        this.markingsElement.className = 'aciolcer-markings';
        this.bodyElement.appendChild(this.markingsElement);

        this.redLine = document.createElement('div');
        this.redLine.className = 'aciolcer-red-line';
        this.markingsElement.appendChild(this.redLine);

        this.rotateHandle = document.createElement('div');
        this.rotateHandle.className = 'aciolcer-rotate-handle';
        this.aciolcerElement.appendChild(this.rotateHandle);

        this.drawHandle = document.createElement('div');
        this.drawHandle.className = 'aciolcer-draw-handle';
        this.aciolcerElement.appendChild(this.drawHandle);
        
        this.drawHandleLabel = document.createElement('div');
        this.drawHandleLabel.className = 'aciolcer-draw-label';
        this.aciolcerElement.appendChild(this.drawHandleLabel);
        this.resizeHandle = document.createElement('div');
        this.resizeHandle.className = 'aciolcer-resize-handle';
        this.aciolcerElement.appendChild(this.resizeHandle);

        this.previewCanvas = document.createElement('canvas');
        this.previewCanvas.className = 'aciolcer-preview-canvas';
        this.previewCanvas.style.position = 'fixed';
        this.previewCanvas.style.top = '0';
        this.previewCanvas.style.left = '0';
        this.previewCanvas.style.pointerEvents = 'none';
        this.previewCanvas.style.zIndex = '100';
        document.body.appendChild(this.previewCanvas);
        this.previewCtx = this.previewCanvas.getContext('2d');

        this.createLabels();

        document.body.appendChild(this.aciolcerElement);
        this.aciolcerElement.style.display = 'none';
        this.previewCanvas.style.display = 'none';

        this.addListeners();
        this.updateTransform();
    },

    createLabels: function() {
         if (!this.markingsElement) return;
        this.markingsElement.innerHTML = '';
        this.markingsElement.appendChild(this.redLine);

        const radius = this.state.radius;
        const centerX = this.state.radius; // Merkez X, yarıçap kadardır

        // 1. DÖNGÜ: SAYI ETİKETLERİNİ OLUŞTUR (Dışarıda)
        for (let angle = 0; angle <= 180; angle += 10) {
            const angleRad = angle * (Math.PI / 180);
            
            // Etiketler yayın 20px DIŞINDADIR
            const labelRadius = radius + 20; 
            
            const labelX = centerX + Math.cos(angleRad) * labelRadius;
            const labelY = radius - Math.sin(angleRad) * labelRadius;

            const label = document.createElement('div');
            label.className = 'aciolcer-label';
            label.innerText = angle + '°';
            label.style.left = `${labelX}px`;
            label.style.top = `${labelY}px`;
            this.markingsElement.appendChild(label);
        }
        
        // 2. DÖNGÜ: ÇİZGİLERİ (TICK) OLUŞTUR (Yay üzerinde)
        // (Resimdeki [image_058243.png] hatayı düzeltir)
        for (let angle = 0; angle <= 180; angle += 5) {
            const tick = document.createElement('div');
            tick.className = 'aciolcer-tick';
            
            const isLarge = (angle % 10 === 0);
            tick.classList.add(isLarge ? 'large' : 'small');
            
            const angleRad = angle * (Math.PI / 180);
            
            // Çizgilerin merkezi, tam olarak yayın ÜZERİNDE olacak
            // (Büyük çizgiler 15px, küçükler 8px)
            const tickCenterRadius = radius - (isLarge ? 7.5 : 4); 
            
            const tickX = centerX + Math.cos(angleRad) * tickCenterRadius;
            const tickY = radius - Math.sin(angleRad) * tickCenterRadius;

            tick.style.left = `${tickX}px`;
            tick.style.top = `${tickY}px`;
            
            // Çizgiyi yayın açısına göre döndür
            tick.style.transform = `translate(-50%, -50%) rotate(${-angle + 90}deg)`;

            this.markingsElement.appendChild(tick);
        }
    },

    // --- 3. GÖSTER/GİZLE ---
    toggle: function() {
        if (!this.aciolcerElement) this.init();
        this.aciolcerElement.style.display = (this.aciolcerElement.style.display === 'none') ? 'block' : 'none';
    },
    show: function() {
        if (!this.aciolcerElement) {
             this.init(); // Eğer yoksa, önce oluştur
        }
        
        // Zaten görünür müyüm?
        const isVisible = this.aciolcerElement.style.display === 'block' || this.aciolcerElement.style.display === 'flex';
        
        if (isVisible) {
            // Zaten görünürüm, demek ki bu 2. tıklama (kapat komutu)
            this.hide();
        } else {
            // Görünür değilim, demek ki 1. tıklama (aç komutu)
            this.aciolcerElement.style.display = 'block'; 
            
            // Gösterildiğinde merkeze al
            this.state.x = window.innerWidth / 2;
            this.state.y = window.innerHeight / 2;
            this.updateTransform();
        }
    },
    hide: function() {
        if (!this.aciolcerElement) return;
        this.aciolcerElement.style.display = 'none';
        
        // DÜZELTME: Önizleme kanvasını da mutlaka gizle
        if (this.previewCanvas) {
            this.previewCanvas.style.display = 'none';
            this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        }
        
        // DÜZELTME: Eğer çizim yaparken kapatılırsa (veya 2. kez tıklanırsa), çizimi iptal et
        if (this.interactionMode === 'drawing') {
            this.interactionMode = 'none';
            this.state.isDrawing = false;
            this.redLine.style.transition = 'transform 0.05s ease-out';
            this.redLine.style.transform = 'rotate(0deg)';
           
            this.drawHandleLabel.style.display = 'none';
        }
    },

    updateTransform: function() {
    if (!this.aciolcerElement) return;

    // CSS Değişkenlerini ayarla
    const radius = this.state.radius;
    const width = radius * 2;
    this.aciolcerElement.style.setProperty('--radius-px', `${radius}px`);
    this.aciolcerElement.style.setProperty('--width-px', `${width}px`);

    // Konum ve rotasyonu ayarla
    this.aciolcerElement.style.left = `${this.state.x}px`;
    this.aciolcerElement.style.top = `${this.state.y}px`;
    this.aciolcerElement.style.transform = `translate(-50%, -100%) rotate(${this.state.angle}deg)`;
},

    // --- 4. OLAY DİNLEYİCİLERİ ---
    addListeners: function() {
        const body = this.bodyElement;
        const rotate = this.rotateHandle;
        const draw = this.drawHandle;
        const boundDown = this.onDown.bind(this);

        body.addEventListener('mousedown', boundDown);
        rotate.addEventListener('mousedown', boundDown);
        draw.addEventListener('mousedown', boundDown);
const resize = this.resizeHandle;
    resize.addEventListener('mousedown', boundDown);
    resize.addEventListener('touchstart', boundDown, { passive: false });
        body.addEventListener('touchstart', boundDown, { passive: false });
        rotate.addEventListener('touchstart', boundDown, { passive: false });
        draw.addEventListener('touchstart', boundDown, { passive: false });

        window.addEventListener('mousemove', this.onMove.bind(this));
        window.addEventListener('touchmove', this.onMove.bind(this), { passive: false });
        window.addEventListener('mouseup', this.onUp.bind(this));
        window.addEventListener('touchend', this.onUp.bind(this));
    },

    getPos: function(e) {
        if (e.touches || e.changedTouches) {
            if (e.touches && e.touches.length > 0) {
                return { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
            if (e.changedTouches && e.changedTouches.length > 0) {
                return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
            }
        }
        return { x: e.clientX, y: e.clientY };
    },

    // --- 5. ETKİLEŞİM MANTIĞI ---
    
    onDown: function(e) {
    e.preventDefault(); e.stopPropagation();
    
    // Bu satırın z-index için sizde olması gerekiyor:
    window.bringToolToFront(this.aciolcerElement); 

        
    this.startPos = this.getPos(e);
    this.startState = JSON.parse(JSON.stringify(this.state));
    const target = e.target;

    if (target === this.bodyElement) {
        this.interactionMode = 'dragging';
        this.bodyElement.style.cursor = 'grabbing';
        
    } else if (target === this.rotateHandle) {
        this.interactionMode = 'rotating';
        
    // --- YENİ 'resizing' KODU BURADA (else if olarak) ---
    } else if (target === this.resizeHandle) {
        this.interactionMode = 'resizing';
    // --- YENİ KODUN SONU ---
        
    } else if (target === this.drawHandle) {
    if (window.currentTool === 'eraser') {
            window.isDrawing = false; 
            window.setActiveTool('none'); // <-- DÜZELTİLDİ
        }
        window.audio_draw.play();
        this.interactionMode = 'drawing';
        this.state.isDrawing = true; // SIFIRLANDIKTAN SONRA YENİDEN BAŞLATILIYOR
        
        // Bu satırın 0-derece hatası için sizde olması gerekiyor:
        this.state.hasDragged = false; 
        
        this.previewCanvas.style.display = 'block';
        this.previewCanvas.width = window.innerWidth;
        this.previewCanvas.height = window.innerHeight;
        this.drawHandle.style.transition = 'none';
        this.drawHandleLabel.style.display = 'block';
        this.drawHandleLabel.style.transition = 'none';
    }
},

    onMove: function(e) {
        if (this.interactionMode === 'none') return;
        const currPos = this.getPos(e);
        
        // --- DÜZELTME ---
        // dx ve dy'yi switch bloğunun DIŞINDA, EN ÜSTTE tanımla
        // Bu, 'Cannot access dx' hatasını çözer.
        const dx = currPos.x - this.startPos.x;
        const dy = currPos.y - this.startPos.y;

        switch (this.interactionMode) {
            case 'dragging':
                // dx ve dy'yi doğrudan kullan (yeniden tanımlama)
                this.state.x = this.startState.x + dx;
                this.state.y = this.startState.y + dy;
                this.updateTransform();
                break;
                
            case 'rotating':
                const cx = this.startState.x;
                const cy = this.startState.y;
                const a1 = Math.atan2(this.startPos.y - cy, this.startPos.x - cx);
                const a2 = Math.atan2(currPos.y - cy, currPos.x - cx);
                this.state.angle = this.startState.angle + (a2 - a1) * 180 / Math.PI;
                this.updateTransform();
                break;
                
            case 'resizing':
                // dx ve dy'yi yeniden tanımlamadan kullan
                const angleRad = this.state.angle * Math.PI / 180;
                const cosAngle = Math.cos(angleRad);
                const sinAngle = Math.sin(angleRad);
                
                const projectedDelta = (dx * -sinAngle) + (dy * cosAngle);

                let newRadius = this.startState.radius + projectedDelta;
                
                if (newRadius < 50) newRadius = 50;
                
                this.state.radius = newRadius;
                this.updateTransform();
                this.createLabels();
                break;
                
            case 'drawing':
                // Bu fonksiyon kendi hesaplamasını yapar (dx/dy kullanmaz)
                this.handleDraw(currPos);
                break;
        }
    },

  onUp: function(e) {
    if (this.interactionMode === 'drawing') {
      window.audio_draw.pause();
      window.audio_draw.currentTime = 0;

      const pos = currentMousePos;
      this.finalizeDraw(pos.x, pos.y);

      this.state.isDrawing = false;
      this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);

      setTimeout(() => {
        this.previewCanvas.style.display = 'none';
        this.redLine.style.transition = 'transform 0.05s ease-out';
        this.redLine.style.transform = 'rotate(0deg)';
        this.drawHandleLabel.style.display = 'none';
      }, 50);
    }
    if (this.interactionMode === 'dragging') {
      this.bodyElement.style.cursor = 'grab';
    }
    this.interactionMode = 'none';
  },

  handleDraw: function(currPos) {
    this.state.hasDragged = true;
    const cx = this.state.x;
    const cy = this.state.y;

    this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
    this.previewCtx.beginPath();
    this.previewCtx.moveTo(cx, cy);
    this.previewCtx.lineTo(currPos.x, currPos.y);
    this.previewCtx.strokeStyle = '#FFFFFF';
    this.previewCtx.lineWidth = 3;
    this.previewCtx.setLineDash([5, 5]);
    this.previewCtx.stroke();
    this.previewCtx.setLineDash([]);

    const gdx = currPos.x - cx;
    const gdy = currPos.y - cy;
    const rad = -this.state.angle * Math.PI / 180;
    const ldx = gdx * Math.cos(rad) - gdy * Math.sin(rad);
    const ldy = gdx * Math.sin(rad) + gdy * Math.cos(rad);

    let localAngleDeg;
    if (ldy > 0) {
      localAngleDeg = ldx > 0 ? 0 : 180;
    } else {
      localAngleDeg = Math.atan2(-ldy, ldx) * 180 / Math.PI;
    }

    this.drawHandle.style.transform = `translateX(-50%) translate(${ldx}px, ${ldy + 5}px)`;
    this.drawHandleLabel.style.transform = `translateX(-50%) translate(${ldx}px, ${ldy - 20}px)`;

    this.state.currentDrawAngleLocal = localAngleDeg;
    this.drawHandleLabel.innerText = `${localAngleDeg.toFixed(0)}°`;

    this.redLine.style.transition = 'none';
    this.redLine.style.transform = `rotate(${-localAngleDeg}deg)`;
  },

  finalizeDraw: function(x, y) {
    if (!this.state.isDrawing) return;

    const mainCanvas = document.querySelector('canvas');
    const rect = mainCanvas.getBoundingClientRect();
    const p1 = { x: this.state.x - rect.left, y: this.state.y - rect.top };

    if (typeof x === 'number' && typeof y === 'number') {
      const p2 = { x: x - rect.left, y: y - rect.top };
      window.drawnStrokes.push({
        type: 'ray',
        p1,
        p2,
        color: window.isToolThemeBlack ? '#000000' : window.currentLineColor,
        width: 3
      });
      window.redrawAllStrokes();
      return;
    }

    const localAngleDeg = this.state.currentDrawAngleLocal;
    const globalAngleRad = ((360 - localAngleDeg) + this.state.angle) * Math.PI / 180;
    const p2 = {
      x: p1.x + Math.cos(globalAngleRad) * 1000,
      y: p1.y + Math.sin(globalAngleRad) * 1000
    };

    if (window.drawnStrokes && window.redrawAllStrokes) {
      let l1 = '', l2 = '';
      if (window.nextPointChar && window.advanceChar) {
        l1 = window.nextPointChar;
        window.nextPointChar = window.advanceChar(l1);
        l2 = window.nextPointChar;
        window.nextPointChar = window.advanceChar(l2);
      }
      window.drawnStrokes.push({
        type: 'ray',
        p1,
        p2,
        color: window.isToolThemeBlack ? '#000000' : window.currentLineColor,
        width: 3,
        label1: l1,
        label2: l2
      });
      window.redrawAllStrokes();
    }
  }
}; // ✅ tüm fonksiyonlar tek nesne içinde

// Nesne tanımı kapandıktan sonra init çağrısı yapılabilir
window.AciolcerTool.init();

