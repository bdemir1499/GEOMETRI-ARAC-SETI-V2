// --- aciolcer.js (Referans Dondurma ile Zıplama Engelleyici Sürüm) ---

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
        radius: 150, 
        angle: 0,
        currentDrawAngleLocal: 0,
        isDrawing: false,
        hasDragged: false
    },

    interactionMode: 'none',
    startPos: { x: 0, y: 0 },
    startState: {},
    activeRect: null, // Kanvas konumunu dondurmak için

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
        const centerX = this.state.radius;

        for (let angle = 0; angle <= 180; angle += 10) {
            const angleRad = angle * (Math.PI / 180);
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
        
        for (let angle = 0; angle <= 180; angle += 5) {
            const tick = document.createElement('div');
            tick.className = 'aciolcer-tick';
            const isLarge = (angle % 10 === 0);
            tick.classList.add(isLarge ? 'large' : 'small');
            const angleRad = angle * (Math.PI / 180);
            const tickCenterRadius = radius - (isLarge ? 7.5 : 4); 
            const tickX = centerX + Math.cos(angleRad) * tickCenterRadius;
            const tickY = radius - Math.sin(angleRad) * tickCenterRadius;
            tick.style.left = `${tickX}px`;
            tick.style.top = `${tickY}px`;
            tick.style.transform = `translate(-50%, -50%) rotate(${-angle + 90}deg)`;
            this.markingsElement.appendChild(tick);
        }
    },

    toggle: function() {
        if (!this.aciolcerElement) this.init();
        if (this.aciolcerElement.style.display === 'none') {
            this.show();
        } else {
            this.hide();
        }
    },
    
    show: function() {
        if (!this.aciolcerElement) this.init(); 
        const isVisible = this.aciolcerElement.style.display === 'block' || this.aciolcerElement.style.display === 'flex';
        if (isVisible) {
            this.hide();
        } else {
            this.aciolcerElement.style.display = 'block'; 
            this.state.x = window.innerWidth / 2;
            this.state.y = window.innerHeight / 2;
            this.updateTransform();
        }
    },
    
    hide: function() {
        if (!this.aciolcerElement) return;
        this.aciolcerElement.style.display = 'none';
        if (this.previewCanvas) {
            this.previewCanvas.style.display = 'none';
            this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        }
        if (this.interactionMode === 'drawing') {
            this.interactionMode = 'none';
            this.state.isDrawing = false;
            this.redLine.style.transition = 'transform 0.05s ease-out';
            this.redLine.style.transform = 'rotate(0deg)';
            this.drawHandle.style.transition = 'transform 0.05s ease-out';
            this.drawHandle.style.transform = 'translateX(-50%) translate(0px, 0px)';
            this.drawHandleLabel.style.display = 'none';
        }
    },

    updateTransform: function() {
        if (!this.aciolcerElement) return;
        const radius = this.state.radius;
        const width = radius * 2;
        this.aciolcerElement.style.setProperty('--radius-px', `${radius}px`);
        this.aciolcerElement.style.setProperty('--width-px', `${width}px`);
        this.aciolcerElement.style.left = `${this.state.x}px`;
        this.aciolcerElement.style.top = `${this.state.y}px`;
        this.aciolcerElement.style.transform = `translate(-50%, -100%) rotate(${this.state.angle}deg)`;
    },

    addListeners: function() {
        const body = this.bodyElement;
        const rotate = this.rotateHandle;
        const draw = this.drawHandle;
        const resize = this.resizeHandle;
        const boundPointerDown = this.onPointerDown.bind(this);

        body.addEventListener('pointerdown', boundPointerDown);
        rotate.addEventListener('pointerdown', boundPointerDown);
        draw.addEventListener('pointerdown', boundPointerDown);
        resize.addEventListener('pointerdown', boundPointerDown);

        window.addEventListener('pointermove', this.onPointerMove.bind(this), { passive: false });
        window.addEventListener('pointerup', this.onPointerUp.bind(this), { passive: false });
        window.addEventListener('pointercancel', this.onPointerUp.bind(this));
    },

    getPointerPos: function(e) {
        return { x: e.clientX, y: e.clientY };
    },

    // --- 2. DOKUNMA BAŞLANGICI (REFERANSI DONDURUYORUZ) ---
    onPointerDown: function(e) {
        if (e.pointerType === 'touch') e.preventDefault(); 
        e.stopPropagation();

                
        if (window.bringToolToFront) window.bringToolToFront(this.aciolcerElement); 

        const target = e.target;
        target.setPointerCapture(e.pointerId);

        this.startPos = this.getPointerPos(e);
        this.startState = JSON.parse(JSON.stringify(this.state));

// 👇👇👇 EKLENECEK KISIM BURASI 👇👇👇
        // Dokunmanın başladığı an kanvasın konumunu dondur ve kaydet
        const mainCanvas = document.getElementById('drawing-canvas');
        this.activeRect = mainCanvas ? mainCanvas.getBoundingClientRect() : { left: 0, top: 0 };
        // 👆👆👆 ----------------------- 👆👆👆


        if (target === this.bodyElement) {
            this.interactionMode = 'dragging';
            this.bodyElement.style.cursor = 'grabbing';
        } else if (target === this.rotateHandle) {
            this.interactionMode = 'rotating';
        } else if (target === this.resizeHandle) {
            this.interactionMode = 'resizing';
        } else if (target === this.drawHandle) {
            if (window.currentTool === 'eraser') {
                window.isDrawing = false; 
                if (window.setActiveTool) window.setActiveTool('none'); 
            }
            if (window.audio_draw) window.audio_draw.play();
            this.interactionMode = 'drawing';
            this.state.isDrawing = true; 
            this.state.hasDragged = false; 
            this.previewCanvas.style.display = 'block';
            this.previewCanvas.width = window.innerWidth;
            this.previewCanvas.height = window.innerHeight;
            this.drawHandle.style.transition = 'none';
            this.drawHandleLabel.style.display = 'block';
            this.drawHandleLabel.style.transition = 'none';
        }
    },

    onPointerMove: function(e) {
        if (this.interactionMode === 'none') return;
        if (!e.isPrimary) return; 

        const currPos = this.getPointerPos(e);
        const dx = currPos.x - this.startPos.x;
        const dy = currPos.y - this.startPos.y;

        switch (this.interactionMode) {
            case 'dragging':
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
                const angleRad = this.state.angle * Math.PI / 180;
                const projectedDelta = (dx * -Math.sin(angleRad)) + (dy * Math.cos(angleRad));
                let newRadius = this.startState.radius + projectedDelta;
                if (newRadius < 50) newRadius = 50;
                this.state.radius = newRadius;
                this.updateTransform();
                this.createLabels();
                break;
            case 'drawing':
                this.handleDraw(currPos);
                break;
        }
    },

    onPointerUp: function(e) {
        if (this.interactionMode === 'none') return;

        // 1. Kilidi kaldır (Parmağı serbest bırak)
        if (e.target && e.target.releasePointerCapture) {
             try { e.target.releasePointerCapture(e.pointerId); } catch(err) {}
        }

        if (this.interactionMode === 'drawing') {
            // Sesi durdur
            if (window.audio_draw) {
                window.audio_draw.pause();
                window.audio_draw.currentTime = 0;
            }

            // --- SON POZİSYON GÜVENLİĞİ ---
            // finalizeDraw'ı çağırıyoruz. Bu fonksiyon asla 'e.clientX' okumaz,
            // sadece 'handleDraw' (pointermove) anında kaydedilen 'this.state.currentDrawAngleLocal'
            // değerini kullanır. Titreme böylece sisteme sızamaz.
            this.finalizeDraw(); 
            
            // finalizeDraw bittikten sonra çizim durumunu kapatıyoruz
            this.state.isDrawing = false;
            
            // Görsel temizlik
            if (this.previewCtx) {
                this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
            }

            setTimeout(() => {
                this.previewCanvas.style.display = 'none'; 
                this.redLine.style.transition = 'transform 0.1s ease-out';
                this.redLine.style.transform = 'rotate(0deg)';
                this.drawHandle.style.transition = 'transform 0.1s ease-out';
                this.drawHandle.style.transform = 'translateX(-50%)'; 
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
        const cx = this.state.x; const cy = this.state.y;
        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height); 
        this.previewCtx.beginPath();
        this.previewCtx.moveTo(cx, cy);
        this.previewCtx.lineTo(currPos.x, currPos.y);
        this.previewCtx.strokeStyle = '#FFFFFF';
        this.previewCtx.lineWidth = 3; this.previewCtx.setLineDash([5, 5]);
        this.previewCtx.stroke(); this.previewCtx.setLineDash([]);
        const gdx = currPos.x - cx; const gdy = currPos.y - cy;
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

    // --- 3. FİNAL ÇİZİM (CANLI REFERANS KULLANAN KISIM) ---
    finalizeDraw: function() {
        if (!this.state.isDrawing) return;
        // Eğer çok küçük bir hareketse veya hiç sürüklenmemişse ışını çizme
        if (Math.abs(this.state.currentDrawAngleLocal) < 0.1 && !this.state.hasDragged) return;

        const cx = this.state.x; 
        const cy = this.state.y;
        const localAngleDeg = this.state.currentDrawAngleLocal;
        const globalAngleRad = ((360 - localAngleDeg) + this.state.angle) * Math.PI / 180;

        const mainCanvas = document.getElementById('drawing-canvas');
        const rect = mainCanvas ? mainCanvas.getBoundingClientRect() : { left: 0, top: 0, width: 1, height: 1 };

        // --- KESİN ÇÖZÜM: KANVAS ESNEME (SCALE) ÇARPANI ---
        const scaleX = mainCanvas ? (mainCanvas.width / (rect.width || 1)) : 1;
        const scaleY = mainCanvas ? (mainCanvas.height / (rect.height || 1)) : 1;

        // Ekranda aracın bulunduğu ham DOM koordinatları
        const p1_dom_x = cx;
        const p1_dom_y = cy;
        const p2_dom_x = cx + Math.cos(globalAngleRad) * 1000;
        const p2_dom_y = cy + Math.sin(globalAngleRad) * 1000;

        // Scale çarpanı ile esnemeyi hesaba katarak kanvasa aktarma
        const p1 = { 
            x: (p1_dom_x - rect.left) * scaleX, 
            y: (p1_dom_y - rect.top) * scaleY 
        };
        const p2 = { 
            x: (p2_dom_x - rect.left) * scaleX, 
            y: (p2_dom_y - rect.top) * scaleY 
        };
        // -------------------------------------------------------------

        if (window.drawnStrokes && window.redrawAllStrokes) {
            let l1 = '', l2 = '';
            if (window.nextPointChar && window.advanceChar) {
                l1 = window.nextPointChar; window.nextPointChar = window.advanceChar(l1);
                l2 = window.nextPointChar; window.nextPointChar = window.advanceChar(l2);
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
}; // <--- İŞTE BURASI ÇOK ÖNEMLİ! (AciolcerTool nesnesini kapatır)

window.AciolcerTool.init();