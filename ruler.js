// --- ruler.js (Evrensel Pointer ile Zıplamayan Versiyon) ---

window.RulerTool = {
    rulerElement: null,
    bodyElement: null,
    markingsElement: null,
    drawHandleElement: null,
    drawHandleLabel: null,
    
    // Cetvelin mevcut durumunu (state) sakla
    state: {
        x: 100,
        y: 100,
        width: 300, 
        angle: 0,   
        currentHandleX: 0, 
    },
    
    // Etkileşim durumu
    interactionMode: 'none', 
    startPos: { x: 0, y: 0 },
    startState: {}, 
    
    PIXELS_PER_CM: 30, 
    isDrawingLine: false,
    drawCanvas: null, 
    drawCtx: null,
    
    init: function() {
        if (this.rulerElement) return; 

        // Ana Konteyner
        this.rulerElement = document.createElement('div');
        this.rulerElement.className = 'ruler-container';
        
        // Sürüklenebilir Gövde
        this.bodyElement = document.createElement('div');
        this.bodyElement.className = 'ruler-body';
        this.rulerElement.appendChild(this.bodyElement);
        
        // İşaretler (cm, çizgiler)
        this.markingsElement = document.createElement('div');
        this.markingsElement.className = 'ruler-markings';
        this.bodyElement.appendChild(this.markingsElement);
        
        // Yeniden Boyutlandırma Tutamaçları
        const resizeLeft = document.createElement('div');
        resizeLeft.className = 'resize-handle left';
        this.rulerElement.appendChild(resizeLeft);
        
        const resizeRight = document.createElement('div');
        resizeRight.className = 'resize-handle right';
        this.rulerElement.appendChild(resizeRight);

        // Döndürme Tutamaçları
        const rotateTL = document.createElement('div');
        rotateTL.className = 'rotate-handle top-left';
        this.rulerElement.appendChild(rotateTL);
        
        const rotateBR = document.createElement('div');
        rotateBR.className = 'rotate-handle bottom-right';
        this.rulerElement.appendChild(rotateBR);
        
        // Çizim Tutamacı (Kırmızı)
        this.drawHandleElement = document.createElement('div');
        this.drawHandleElement.className = 'draw-handle';
        this.rulerElement.appendChild(this.drawHandleElement);

        // Çizim Etiketi
        this.drawHandleLabel = document.createElement('div');
        this.drawHandleLabel.className = 'draw-handle-label';
        this.drawHandleLabel.innerText = '0,0 cm';
        this.drawHandleElement.appendChild(this.drawHandleLabel);
        
        // Çizim Alanı (Katman)
        this.drawCanvas = document.createElement('canvas');
        this.drawCanvas.className = 'ruler-draw-canvas'; 
        this.drawCanvas.style.position = 'absolute';
        this.drawCanvas.style.top = '-10px'; 
        this.drawCanvas.style.bottom = 'auto'; 
        this.drawCanvas.style.left = '0';
        this.drawCanvas.style.pointerEvents = 'none'; 
        this.drawCtx = this.drawCanvas.getContext('2d');
        this.rulerElement.appendChild(this.drawCanvas);

        document.body.appendChild(this.rulerElement);
        this.rulerElement.style.display = 'none';
        
        this.addListeners();
        
        this.updateTransform();
        this.updateMarkings();
        this.updateDrawCanvasSize();
    },
    
    toggle: function() {
        if (!this.rulerElement) this.init(); 
        if (this.rulerElement.style.display === 'none') {
            this.show();
        } else {
            this.hide();
        }
    },
    
    show: function() {
        if (!this.rulerElement) return;
        this.rulerElement.style.display = 'flex';
        const startWidth = this.state.width || 300;
        this.state.x = (window.innerWidth / 2) - (startWidth / 2);
        this.state.y = (window.innerHeight / 2) - 30;
        this.updateTransform();
    },
    
    hide: function() {
        if (!this.rulerElement) return;
        this.rulerElement.style.display = 'none';
    },
    
    updateTransform: function() {
        if (!this.rulerElement) return;
        const { x, y, width, angle } = this.state;
        
        this.rulerElement.style.left = `${x}px`;
        this.rulerElement.style.top = `${y}px`;
        this.rulerElement.style.width = `${width}px`;
        this.rulerElement.style.transformOrigin = 'center center';
        this.rulerElement.style.transform = `rotate(${angle}deg)`;
            
        this.updateDrawCanvasSize();
    },
    
    updateDrawCanvasSize: function() {
        if (!this.drawCanvas) return;
        this.drawCanvas.width = this.state.width;
        this.drawCanvas.height = 10; 
    },

    // --- YENİ EVRENSEL POINTER LİSTENER'LARI ---
    addListeners: function() {
        const body = this.bodyElement;
        const resizeLeft = this.rulerElement.querySelector('.resize-handle.left');
        const resizeRight = this.rulerElement.querySelector('.resize-handle.right');
        const rotateTL = this.rulerElement.querySelector('.rotate-handle.top-left');
        const rotateBR = this.rulerElement.querySelector('.rotate-handle.bottom-right');
        const drawHandle = this.drawHandleElement;

        const handlePointerDown = this.onPointerDown.bind(this);

        // Eski mousedown ve touchstart silindi, pointerdown eklendi
        body.addEventListener('pointerdown', handlePointerDown);
        resizeLeft.addEventListener('pointerdown', handlePointerDown);
        resizeRight.addEventListener('pointerdown', handlePointerDown);
        rotateTL.addEventListener('pointerdown', handlePointerDown); 
        rotateBR.addEventListener('pointerdown', handlePointerDown); 
        drawHandle.addEventListener('pointerdown', handlePointerDown); 

        window.addEventListener('pointermove', this.onPointerMove.bind(this), { passive: false });
        window.addEventListener('pointerup', this.onPointerUp.bind(this), { passive: false });
        window.addEventListener('pointercancel', this.onPointerUp.bind(this)); // Hata durumunda da sıfırla
    },

    // TEMİZ KOORDİNAT OKUYUCU (Zıplama düşmanı)
    getPointerPos: function(e) {
        return { x: e.clientX, y: e.clientY };
    },

    // --- DOKUNMA/TIKLAMA BAŞLANGICI ---
    onPointerDown: function(e) {
        // Tarayıcının zıplamasına/sayfa kaydırmasına izin verme
        if (e.pointerType === 'touch') e.preventDefault(); 
        e.stopPropagation();


        // Aracı öne getir
        if (window.bringToolToFront) {
             window.bringToolToFront(this.rulerElement); 
        }

        const target = e.target;
        
        // KRİTİK: Parmağı cetvele kilitle ki dışarı taşsa da çalışsın
        target.setPointerCapture(e.pointerId);

        this.startPos = this.getPointerPos(e);
        this.startState = JSON.parse(JSON.stringify(this.state)); 

// 👇👇👇 EKLENECEK KISIM BURASI 👇👇👇
        // Dokunmanın başladığı an kanvasın konumunu dondur ve kaydet
        const mainCanvas = document.getElementById('drawing-canvas');
        this.activeRect = mainCanvas ? mainCanvas.getBoundingClientRect() : { left: 0, top: 0 };
        // 👆👆👆 ----------------------- 👆👆👆
        
        if (target.classList.contains('ruler-body')) {
            this.interactionMode = 'dragging';
            this.bodyElement.style.cursor = 'grabbing';
        } 
        else if (target.classList.contains('resize-handle') && target.classList.contains('left')) { 
            this.interactionMode = 'resizing-left';
        } 
        else if (target.classList.contains('resize-handle') && target.classList.contains('right')) { 
            this.interactionMode = 'resizing-right';
        } 
        else if (target.classList.contains('rotate-handle')) {
            this.interactionMode = 'rotating';
            // Pivotu (dönme merkezini) hesapla
            this.startState.centerX = this.state.x + this.state.width / 2;
            this.startState.centerY = this.state.y + 30; // 60px yükseklik / 2
        } 
        else if (target.classList.contains('draw-handle')) {
            if (window.currentTool === 'eraser') {
                window.isDrawing = false; 
                if (window.setActiveTool) window.setActiveTool('none'); 
            }        
            if (window.audio_draw) window.audio_draw.play();
            
            this.interactionMode = 'drawing';
            this.isDrawingLine = true;
            this.drawCtx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height); 
            this.drawHandleLabel.style.display = 'block';
            
            const startHandleX = parseFloat(this.drawHandleElement.style.left || '0');
            this.startState.handleX = startHandleX; 
        } 
        else {
            this.interactionMode = 'none';
        }
    },

    // --- HAREKET ETTİRME ---
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
            case 'resizing-left':
                this.handleResize(currentPos, 'left');
                break;
            case 'resizing-right':
                this.handleResize(currentPos, 'right');
                break;
            case 'rotating':
                this.handleRotate(e);
                break;
            case 'drawing':
                this.handleDraw(e);
                break;
        }
    },

    // --- BIRAKMA / BİTİRME (ZIPLAMA SAVAR VERSİYON) ---
    onPointerUp: function(e) {
        if (this.interactionMode === 'none') return; 

        // 1. Kilidi güvenle kaldır
        if (e.target && e.target.releasePointerCapture) {
             try { e.target.releasePointerCapture(e.pointerId); } catch(err) {}
        }

        // 2. Eğer taşıma modundaysak imleci düzelt
        if (this.interactionMode === 'dragging') {
            this.bodyElement.style.cursor = 'grab'; 
        }
        
        // 3. EĞER ÇİZİM YAPIYORSAK (KRİTİK KISIM)
        if (this.isDrawingLine) { 
            // Sesi durdur
            if (window.audio_draw) {
                window.audio_draw.pause(); 
                window.audio_draw.currentTime = 0; 
            }
            
            // --- SON POZİSYON GÜVENLİĞİ ---
            // 'finalizeDraw' fonksiyonu içinde asla 'e.clientX' okuma yapmıyoruz.
            // Zaten 'handleDraw' (pointermove) sırasında kaydedilen 'this.state.currentHandleX' 
            // değerini kullanıyoruz. Bu, parmağın kalktığı anki titremeyi çöpe atar.
            this.finalizeDraw(); 
            // ------------------------------
            
            this.drawHandleLabel.style.display = 'none';
            
            // 4. Görsel temizlik ve sıfırlama
            if(this.drawHandleElement) { 
                this.drawHandleElement.style.transition = 'left 0.1s ease-out';
                this.drawHandleElement.style.left = '0px'; 
                
                // Canvası temizle
                this.drawCtx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);
                
                // Durumu sıfırla (Çizim bitti)
                this.state.currentHandleX = 0; 
                this.isDrawingLine = false; 
            }
        }
        
        this.interactionMode = 'none'; 
    },

    handleDrag: function(dx, dy) {
        this.state.x = this.startState.x + dx;
        this.state.y = this.startState.y + dy;
        this.updateTransform();
    },

    handleRotate: function(e) {
        const currentPos = this.getPointerPos(e);
        const center = { x: this.startState.centerX, y: this.startState.centerY };
        
        const startAngle = Math.atan2(this.startPos.y - center.y, this.startPos.x - center.x);
        const currentAngle = Math.atan2(currentPos.y - center.y, currentPos.x - center.x);
        const angleDiff = currentAngle - startAngle; 
        
        this.state.angle = this.startState.angle + (angleDiff * 180 / Math.PI);
        this.updateTransform();
    },

    handleResize: function(currentPos, side) {
        const angleRad = this.state.angle * (Math.PI / 180);
        const cosAngle = Math.cos(angleRad);
        const sinAngle = Math.sin(angleRad);
        
        const dx = currentPos.x - this.startPos.x;
        const dy = currentPos.y - this.startPos.y;
        const projectedDelta = dx * cosAngle + dy * sinAngle;

        if (side === 'right') {
            let newWidth = this.startState.width + projectedDelta;
            if (newWidth < 50) newWidth = 50; 
            this.state.width = newWidth;
            
            this.state.x = this.startState.x;
            this.state.y = this.startState.y;
        } 
        else if (side === 'left') { 
            let deltaWidth = -projectedDelta; 
            let newWidth = this.startState.width + deltaWidth;
            let positionDelta = projectedDelta; 
            if (newWidth < 50) {
                deltaWidth = 50 - this.startState.width;
                newWidth = 50;
                positionDelta = -deltaWidth; 
            }
            this.state.width = newWidth;
            
            this.state.x = this.startState.x + (positionDelta * cosAngle);
            this.state.y = this.startState.y + (positionDelta * sinAngle);
        }
        this.updateTransform();
        this.updateMarkings(); 
    },

    updateMarkings: function() {
        if (!this.markingsElement) return; 
        this.markingsElement.innerHTML = ''; 
        const width = this.state.width;
        const cmCount = Math.floor(width / this.PIXELS_PER_CM);
        
        const zeroLabel = document.createElement('div');
        zeroLabel.className = 'ruler-label';
        zeroLabel.style.left = '0px';
        zeroLabel.innerText = '0';
        this.markingsElement.appendChild(zeroLabel);

        for (let cm = 1; cm <= cmCount; cm++) {
            const xPos = cm * this.PIXELS_PER_CM;
            
            const tickL = document.createElement('div');
            tickL.className = 'ruler-tick large';
            tickL.style.left = `${xPos}px`;
            this.markingsElement.appendChild(tickL);
            
            const label = document.createElement('div');
            label.className = 'ruler-label';
            label.style.left = `${xPos}px`;
            label.innerText = cm;
            this.markingsElement.appendChild(label);
            
            if (this.PIXELS_PER_CM > 20) {
                 const tickM = document.createElement('div');
                 tickM.className = 'ruler-tick medium';
                 tickM.style.left = `${xPos - this.PIXELS_PER_CM / 2}px`;
                 this.markingsElement.appendChild(tickM);
            }
        }
    },

    handleDraw: function(e) {
        const pos = this.getPointerPos(e);
        const centerX = this.state.x + (this.state.width / 2);
        const centerY = this.state.y + 30;
        const relativeX_to_center = pos.x - centerX;
        const relativeY_to_center = pos.y - centerY;
        const angleRad = -this.state.angle * (Math.PI / 180);
        const cosAngle = Math.cos(angleRad);
        const sinAngle = Math.sin(angleRad);
        const localX_from_center = (relativeX_to_center * cosAngle) - (relativeY_to_center * sinAngle);
        const localX_from_left = localX_from_center + (this.state.width / 2);
        let handleX = Math.max(0, Math.min(this.state.width, localX_from_left));
        
        this.state.currentHandleX = handleX; 
        
        this.drawHandleElement.style.transition = 'none'; 
        this.drawHandleElement.style.left = `${handleX}px`;
        
        const cm = (handleX / this.PIXELS_PER_CM).toFixed(1).replace('.', ',');
        this.drawHandleLabel.innerText = `${cm} cm`;
        
        this.drawCtx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);
        this.drawCtx.beginPath();
        this.drawCtx.moveTo(0, 4); 
        this.drawCtx.lineTo(handleX, 4); 
        this.drawCtx.strokeStyle = '#FFFFFF'; 
        this.drawCtx.lineWidth = 3; 
        this.drawCtx.stroke();
    },

    finalizeDraw: function() {
        const handleX = this.state.currentHandleX || 0; 
        if (handleX <= 0) return; 

        const angleRad = this.state.angle * (Math.PI / 180);
        const cosAngle = Math.cos(angleRad);
        const sinAngle = Math.sin(angleRad);
        
        const centerX = this.state.x + (this.state.width / 2);
        const centerY = this.state.y + 30; 

        const startX_local = 0;
        const startY_local = -6; 
        const endX_local = handleX;
        const endY_local = -6; 

        const s_rel_center_x = startX_local - (this.state.width / 2);
        const s_rel_center_y = startY_local - 30; 
        const e_rel_center_x = endX_local - (this.state.width / 2);
        const e_rel_center_y = endY_local - 30;

        const p1_rotated_x = s_rel_center_x * cosAngle - s_rel_center_y * sinAngle;
        const p1_rotated_y = s_rel_center_x * sinAngle + s_rel_center_y * cosAngle;
        const p2_rotated_x = e_rel_center_x * cosAngle - e_rel_center_y * sinAngle;
        const p2_rotated_y = e_rel_center_x * sinAngle + e_rel_center_y * cosAngle;

        const mainCanvas = document.getElementById('drawing-canvas');
        // CANLI rect bilgisini alıyoruz
        const rect = mainCanvas ? mainCanvas.getBoundingClientRect() : { left: 0, top: 0, width: 1, height: 1 };

        // --- KESİN ÇÖZÜM: KANVAS ESNEME (SCALE) ÇARPANI ---
        const scaleX = mainCanvas ? (mainCanvas.width / (rect.width || 1)) : 1;
        const scaleY = mainCanvas ? (mainCanvas.height / (rect.height || 1)) : 1;

        const p1 = { 
            x: ((p1_rotated_x + centerX) - rect.left) * scaleX, 
            y: ((p1_rotated_y + centerY) - rect.top) * scaleY 
        };
        const p2 = { 
            x: ((p2_rotated_x + centerX) - rect.left) * scaleX, 
            y: ((p2_rotated_y + centerY) - rect.top) * scaleY 
        };
        // -------------------------------------------------------------
        
        const cmText = (handleX / this.PIXELS_PER_CM).toFixed(1).replace('.', ',') + " cm";
        const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

        if (window.drawnStrokes && window.redrawAllStrokes) {
            window.drawnStrokes.push({
                type: 'straightLine', 
                p1: p1,
                p2: p2,
                color: window.isToolThemeBlack ? '#000000' : window.currentLineColor, 
                width: 3,
                lengthLabel: cmText, 
                lengthLabelPos: midPoint 
            });
            window.redrawAllStrokes(); 
        }
    }
}; // <--- İŞTE BURASI ÇOK ÖNEMLİ! (RulerTool nesnesini kapatır)

window.RulerTool.init();