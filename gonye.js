// --- gonye.js (Evrensel Pointer ile Zıplamayan Versiyon) ---

window.GonyeTool = {
    gonyeElement: null,
    bodyElement: null,
    markingsElement: null,
    drawHandleElement: null,
    drawHandleLabel: null,
    resizeHandle: null,
    
    // Gönyenin durumu (state)
    state: {
        x: 100,
        y: 100,
        width: 200,
        height: 346, // 200 * 1.732 (30-60-90 oranı)
        angle: 0,
        currentHandleY: 0, 
    },
    
    // Etkileşim durumu
    interactionMode: 'none', 
    startPos: { x: 0, y: 0 },
    startState: {}, 
    
    PIXELS_PER_CM: 30, 
    isDrawingLine: false,
    drawCanvas: null, 
    drawCtx: null,
    
    // --- 1. KURULUM ---
    init: function() {
        if (this.gonyeElement) return;

        this.gonyeElement = document.createElement('div');
        this.gonyeElement.className = 'gonye-container';
        
        this.bodyElement = document.createElement('div');
        this.bodyElement.className = 'gonye-body';
        this.gonyeElement.appendChild(this.bodyElement);
        
        this.markingsElement = document.createElement('div');
        this.markingsElement.className = 'gonye-markings';
        this.bodyElement.appendChild(this.markingsElement);
        
        // Köşe Etiketleri
        const labelA = document.createElement('div');
        labelA.className = 'gonye-corner-label';
        labelA.id = 'gonye-label-a';
        labelA.innerText = 'A';
        this.markingsElement.appendChild(labelA);
        
        const labelB = document.createElement('div');
        labelB.className = 'gonye-corner-label';
        labelB.id = 'gonye-label-b';
        labelB.innerText = 'B';
        this.markingsElement.appendChild(labelB);
        
        const labelC = document.createElement('div');
        labelC.className = 'gonye-corner-label';
        labelC.id = 'gonye-label-c';
        labelC.innerText = 'C';
        this.markingsElement.appendChild(labelC);

        // Döndürme Butonu
        const rotateA = document.createElement('div');
        rotateA.className = 'gonye-rotate-handle';
        this.gonyeElement.appendChild(rotateA);
        
        // Çizim Tutamacı
        this.drawHandleElement = document.createElement('div');
        this.drawHandleElement.className = 'gonye-draw-handle';
        this.gonyeElement.appendChild(this.drawHandleElement);

        // Çizim Etiketi
        this.drawHandleLabel = document.createElement('div');
        this.drawHandleLabel.className = 'gonye-draw-label';
        this.drawHandleLabel.innerText = '0,0 cm';
        this.drawHandleElement.appendChild(this.drawHandleLabel);
        
        // Boyutlandırma Tutamacı
        this.resizeHandle = document.createElement('div');
        this.resizeHandle.className = 'gonye-resize-handle';
        this.gonyeElement.appendChild(this.resizeHandle);
        
        // Çizim Alanı
        this.drawCanvas = document.createElement('canvas');
        this.drawCanvas.style.position = 'absolute';
        this.drawCanvas.style.top = '0';
        this.drawCanvas.style.left = '-10px'; 
        this.drawCanvas.style.pointerEvents = 'none'; 
        this.drawCtx = this.drawCanvas.getContext('2d');
        this.gonyeElement.appendChild(this.drawCanvas);

        document.body.appendChild(this.gonyeElement);
        this.gonyeElement.style.display = 'none';
        
        this.addListeners();
        
        this.updateTransform();
        this.updateMarkings();
        this.updateDrawCanvasSize();
    },
    
    toggle: function() {
        if (!this.gonyeElement) this.init(); 
        if (this.gonyeElement.style.display === 'none') {
            this.show();
        } else {
            this.hide();
        }
    },
    
    show: function() {
        if (!this.gonyeElement) return;
        this.gonyeElement.style.display = 'flex';
        this.state.x = (window.innerWidth / 2) - (this.state.width / 2);
        this.state.y = (window.innerHeight / 2) - (this.state.height / 2);
        this.updateTransform();
    },
    
    hide: function() {
        if (!this.gonyeElement) return;
        this.gonyeElement.style.display = 'none';
    },
    
    updateTransform: function() {
        if (!this.gonyeElement) return; 
        const { x, y, width, height, angle } = this.state;
        
        this.gonyeElement.style.left = `${x}px`;
        this.gonyeElement.style.top = `${y}px`;
        this.gonyeElement.style.width = `${width}px`;
        this.gonyeElement.style.height = `${height}px`;
        
        this.gonyeElement.style.transformOrigin = 'center center';
        this.gonyeElement.style.transform = `rotate(${angle}deg)`;
            
        this.updateDrawCanvasSize();
    },
    
    updateDrawCanvasSize: function() {
        if (!this.drawCanvas) return;
        this.drawCanvas.width = 10; 
        this.drawCanvas.height = this.state.height;
    },

    // --- 2. EVRENSEL POINTER OLAYLARI (Zıplama Çözümü) ---
    addListeners: function() {
        const body = this.bodyElement;
        const rotateA = this.gonyeElement.querySelector('.gonye-rotate-handle');
        const drawHandle = this.drawHandleElement;
        const resizeHandle = this.resizeHandle; 

        const handlePointerDown = this.onPointerDown.bind(this);

        // Mousedown/Touchstart silindi, Pointer bağlandı
        body.addEventListener('pointerdown', handlePointerDown);
        rotateA.addEventListener('pointerdown', handlePointerDown);
        drawHandle.addEventListener('pointerdown', handlePointerDown);
        resizeHandle.addEventListener('pointerdown', handlePointerDown);

        window.addEventListener('pointermove', this.onPointerMove.bind(this), { passive: false });
        window.addEventListener('pointerup', this.onPointerUp.bind(this), { passive: false });
        window.addEventListener('pointercancel', this.onPointerUp.bind(this));
    },

    // Temiz koordinat okuyucu
    getPointerPos: function(e) {
        return { x: e.clientX, y: e.clientY };
    },

    // DOKUNMA/TIKLAMA BAŞLANGICI
    onPointerDown: function(e) {
        if (e.pointerType === 'touch') e.preventDefault(); 
        e.stopPropagation();
        
        if (window.bringToolToFront) window.bringToolToFront(this.gonyeElement); 
        
        const target = e.target;

        // KRİTİK: Zıplamayı engelleyen ve hedefi parmağa kilitleyen kod
        target.setPointerCapture(e.pointerId);

        this.startPos = this.getPointerPos(e);
        this.startState = JSON.parse(JSON.stringify(this.state)); 
        
        if (target.classList.contains('gonye-body')) {
            this.interactionMode = 'dragging';
            this.bodyElement.style.cursor = 'grabbing';
        } 
        else if (target.classList.contains('gonye-rotate-handle')) {
            this.interactionMode = 'rotating';
            this.startState.centerX = this.state.x + this.state.width / 2;
            this.startState.centerY = this.state.y + this.state.height / 2;
        } 
        else if (target === this.resizeHandle) {
            this.interactionMode = 'resizing';
            this.startState.width = this.state.width;
            this.startState.height = this.state.height;
        }
        else if (target.classList.contains('gonye-draw-handle')) {
            if (window.currentTool === 'eraser') {
                window.isDrawing = false; 
                if (window.setActiveTool) window.setActiveTool('none'); 
            }
            if (window.audio_draw) window.audio_draw.play(); 
            
            this.interactionMode = 'drawing';
            this.isDrawingLine = true;
            this.drawCtx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height); 
            this.drawHandleLabel.style.display = 'block';
            
            const startHandleY = parseFloat(this.drawHandleElement.style.top || '0');
            this.startState.handleY = startHandleY; 
        } 
        else {
            this.interactionMode = 'none';
        }
    },

    // HAREKET ETTİRME
    onPointerMove: function(e) {
        if (this.interactionMode === 'none') return;
        if (!e.isPrimary) return; // İkinci parmak sapmalarını önle
        
        const currentPos = this.getPointerPos(e);
        const dx = currentPos.x - this.startPos.x;
        const dy = currentPos.y - this.startPos.y;
        
        switch (this.interactionMode) {
            case 'dragging':
                this.handleDrag(dx, dy);
                break;
            case 'rotating':
                this.handleRotate(currentPos);
                break;
            case 'resizing':
                this.handleResize(dx, dy);
                break;
            case 'drawing':
                this.handleDraw(currentPos); // Olay yerine temiz koordinatı gönder
                break;
        }
    },

    // BIRAKMA / BİTİRME
    onPointerUp: function(e) {
        if (this.interactionMode === 'none') return;

        // Kilidi güvenle kaldır
        if (e.target && e.target.releasePointerCapture) {
             try { e.target.releasePointerCapture(e.pointerId); } catch(err) {}
        }

        if (this.interactionMode === 'dragging') {
            this.bodyElement.style.cursor = 'grab';
        }
        
        if (this.isDrawingLine) {
            if (window.audio_draw) {
                window.audio_draw.pause();
                window.audio_draw.currentTime = 0;
            }
            
            this.finalizeDraw();
            
            this.drawHandleLabel.style.display = 'none';
            
            if(this.drawHandleElement) { 
                this.drawHandleElement.style.transition = 'top 0.05s ease-out';
                this.drawHandleElement.style.top = `${this.state.height - 20}px`; 
                
                this.isDrawingLine = false;
                this.drawCtx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);
            }
        }
        
        this.interactionMode = 'none';
    },

    // --- 3. MANTIK FONKSİYONLARI ---
    handleDrag: function(dx, dy) {
        this.state.x = this.startState.x + dx;
        this.state.y = this.startState.y + dy;
        this.updateTransform();
    },

    handleRotate: function(currentPos) {
        const center = { x: this.startState.centerX, y: this.startState.centerY };
        
        const startAngle = Math.atan2(this.startPos.y - center.y, this.startPos.x - center.x);
        const currentAngle = Math.atan2(currentPos.y - center.y, currentPos.x - center.x);
        
        const angleDiff = currentAngle - startAngle; 
        
        this.state.angle = this.startState.angle + (angleDiff * 180 / Math.PI);
        this.updateTransform();
    },

    handleResize: function(dx, dy) {
        const angleRad = this.state.angle * (Math.PI / 180);
        const cosAngle = Math.cos(angleRad);
        const sinAngle = Math.sin(angleRad);
        
        const projectedDelta = (dx * cosAngle) + (dy * sinAngle);

        let newWidth = this.startState.width + projectedDelta;
        if (newWidth < 100) newWidth = 100;
        
        const newHeight = newWidth * 1.732;
        
        this.state.width = newWidth;
        this.state.height = newHeight;
        
        this.updateTransform();
        this.updateMarkings();
        
        if (this.drawHandleElement) {
            this.drawHandleElement.style.top = `${newHeight - 20}px`;
            this.state.currentHandleY = newHeight - 20;
            this.drawHandleLabel.innerText = "0,0 cm";
        }
    },

    updateMarkings: function() {
        if (!this.markingsElement) return; 
        this.markingsElement.innerHTML = ''; 
        const height = this.state.height;
        const cmCount = Math.floor(height / this.PIXELS_PER_CM);
        
        const labelA = document.createElement('div');
        labelA.className = 'gonye-corner-label';
        labelA.id = 'gonye-label-a';
        labelA.innerText = 'A';
        this.markingsElement.appendChild(labelA);
        
        const labelB = document.createElement('div');
        labelB.className = 'gonye-corner-label';
        labelB.id = 'gonye-label-b';
        labelB.innerText = 'B';
        this.markingsElement.appendChild(labelB);
        
        const labelC = document.createElement('div');
        labelC.className = 'gonye-corner-label';
        labelC.id = 'gonye-label-c';
        labelC.innerText = 'C';
        this.markingsElement.appendChild(labelC);
        
        const zeroLabel = document.createElement('div');
        zeroLabel.className = 'gonye-label';
        zeroLabel.style.top = `${height}px`; 
        zeroLabel.innerText = '0';
        this.markingsElement.appendChild(zeroLabel);

        for (let cm = 1; cm <= cmCount; cm++) {
            const yPos = height - (cm * this.PIXELS_PER_CM);
            
            const tickL = document.createElement('div');
            tickL.className = 'gonye-tick large';
            tickL.style.top = `${yPos}px`;
            this.markingsElement.appendChild(tickL);
            
            const label = document.createElement('div');
            label.className = 'gonye-label';
            label.style.top = `${yPos}px`;
            label.innerText = cm;
            this.markingsElement.appendChild(label);
            
            if (this.PIXELS_PER_CM > 20) {
                 const tickM = document.createElement('div');
                 tickM.className = 'gonye-tick medium';
                 tickM.style.top = `${yPos + this.PIXELS_PER_CM / 2}px`;
                 this.markingsElement.appendChild(tickM);
            }
        }
        
        this.drawHandleElement.style.top = `${height - 20}px`; 
    },

    handleDraw: function(pos) {
        // Parametre olarak artık 'e' değil, 'pos' (temiz koordinat) geliyor
        const centerX = this.state.x + (this.state.width / 2);
        const centerY = this.state.y + (this.state.height / 2);
        const relativeX_to_center = pos.x - centerX;
        const relativeY_to_center = pos.y - centerY;
        const angleRad = -this.state.angle * (Math.PI / 180);
        const cosAngle = Math.cos(angleRad);
        const sinAngle = Math.sin(angleRad);
        const localY_from_center = (relativeX_to_center * sinAngle) + (relativeY_to_center * cosAngle);
        const localY_from_top = localY_from_center + (this.state.height / 2);
        let handleY = Math.max(0, Math.min(this.state.height - 20, localY_from_top)); 
        
        this.state.currentHandleY = handleY; 
        
        this.drawHandleElement.style.transition = 'none'; 
        this.drawHandleElement.style.top = `${handleY}px`;
        
        const startY_local = this.state.height;
        const endY_local = handleY + 10; 
        
        const lengthPx = Math.abs(startY_local - endY_local);
        const cm = (lengthPx / this.PIXELS_PER_CM).toFixed(1).replace('.', ',');
        
        this.drawHandleLabel.innerText = `${cm} cm`;
        
        this.drawCtx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);
        this.drawCtx.beginPath();
        this.drawCtx.moveTo(4, this.state.height); 
        this.drawCtx.lineTo(4, endY_local); 
        this.drawCtx.strokeStyle = '#FFFFFF'; 
        this.drawCtx.lineWidth = 3; 
        this.drawCtx.stroke();
    },

    finalizeDraw: function() {
        const handleY = this.state.currentHandleY || 0; 
        
        const startX_local = 4; 
        const startY_local = this.state.height; 
        const endX_local = 4;
        const endY_local = handleY + 10; 

        if (Math.abs(startY_local - endY_local) < 1) return; 

        const angleRad = this.state.angle * (Math.PI / 180);
        const cosAngle = Math.cos(angleRad);
        const sinAngle = Math.sin(angleRad);
        
        const centerX = this.state.x + (this.state.width / 2);
        const centerY = this.state.y + (this.state.height / 2);

        const s_rel_center_x = startX_local - (this.state.width / 2);
        const s_rel_center_y = startY_local - (this.state.height / 2);
        const e_rel_center_x = endX_local - (this.state.width / 2);
        const e_rel_center_y = endY_local - (this.state.height / 2);

        const p1_rotated_x = s_rel_center_x * cosAngle - s_rel_center_y * sinAngle;
        const p1_rotated_y = s_rel_center_x * sinAngle + s_rel_center_y * cosAngle;
        const p2_rotated_x = e_rel_center_x * cosAngle - e_rel_center_y * sinAngle;
        const p2_rotated_y = e_rel_center_x * sinAngle + e_rel_center_y * cosAngle;

        const p1 = { x: p1_rotated_x + centerX, y: p1_rotated_y + centerY };
        const p2 = { x: p2_rotated_x + centerX, y: p2_rotated_y + centerY };
        
        const lengthPx = window.distance(p1, p2);
        const cmText = (lengthPx / this.PIXELS_PER_CM).toFixed(1).replace('.', ',') + " cm";

        const midPoint = { 
            x: (p1.x + p2.x) / 2, 
            y: (p1.y + p2.y) / 2 
        };
        
        if (window.drawnStrokes && window.redrawAllStrokes) {
            const label1 = window.nextPointChar;
            window.nextPointChar = window.advanceChar(label1);
            const label2 = window.nextPointChar;
            window.nextPointChar = window.advanceChar(label2);
            
            window.drawnStrokes.push({
                type: 'segment', 
                p1: p1,
                p2: p2,
                color: window.isToolThemeBlack ? '#000000' : window.currentLineColor, 
                width: 3,
                label1: label1,
                label2: label2,
                lengthLabel: cmText,
                lengthLabelPos: midPoint
            });
            window.redrawAllStrokes(); 
        } else {
            console.error("Hata: drawnStrokes veya redrawAllStrokes globalda bulunamadı!");
        }
    }
};

window.GonyeTool.init();