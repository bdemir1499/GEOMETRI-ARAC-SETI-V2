// --- ruler.js (Tüm Eksik Fonksiyonları ve Düzeltmeleri İçeren Tam Sürüm) ---

// 1. Ana Cetvel Nesnesi
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
        width: 300, // Başlangıç genişliği (px)
        angle: 0,   // Başlangıç açısı (derece)
        currentHandleX: 0, // Çizim tutamacının mevcut pozisyonu
    },
    
    // Etkileşim durumu
    interactionMode: 'none', // 'dragging', 'resizing-left', 'resizing-right', 'rotating', 'drawing'
    startPos: { x: 0, y: 0 },
    startState: {}, // Tıklama anındaki durumu saklar
    
    PIXELS_PER_CM: 30, // 1 cm = 30 piksel
    isDrawingLine: false,
    drawCanvas: null, // Çizim için ayrı bir katman (canvas)
    drawCtx: null,
    
    // 1. Madde: Cetveli oluştur ve sayfaya ekle (init)
    init: function() {
        if (this.rulerElement) return; // Zaten oluşturulmuş

        // Ana Konteyner
        this.rulerElement = document.createElement('div');
        this.rulerElement.className = 'ruler-container';
        
        // 4. Madde: Sürüklenebilir Gövde
        this.bodyElement = document.createElement('div');
        this.bodyElement.className = 'ruler-body';
        this.rulerElement.appendChild(this.bodyElement);
        
        // 3. Madde: İşaretler (cm, çizgiler)
        this.markingsElement = document.createElement('div');
        this.markingsElement.className = 'ruler-markings';
        this.bodyElement.appendChild(this.markingsElement);
        
        // 5. Madde: Yeniden Boyutlandırma (Uzatma) Tutamaçları
        const resizeLeft = document.createElement('div');
        resizeLeft.className = 'resize-handle left';
        this.rulerElement.appendChild(resizeLeft);
        
        const resizeRight = document.createElement('div');
        resizeRight.className = 'resize-handle right';
        this.rulerElement.appendChild(resizeRight);

        // 7. Madde: Döndürme Tutamaçları
        const rotateTL = document.createElement('div');
        rotateTL.className = 'rotate-handle top-left';
        this.rulerElement.appendChild(rotateTL);
        
        const rotateBR = document.createElement('div');
        rotateBR.className = 'rotate-handle bottom-right';
        this.rulerElement.appendChild(rotateBR);
        
        // 8. Madde: Çizim Tutamacı (Kırmızı)
        this.drawHandleElement = document.createElement('div');
        this.drawHandleElement.className = 'draw-handle';
        this.rulerElement.appendChild(this.drawHandleElement);

        // 9. Madde: Çizim Etiketi
        this.drawHandleLabel = document.createElement('div');
        this.drawHandleLabel.className = 'draw-handle-label';
        this.drawHandleLabel.innerText = '0.0 cm';
        this.drawHandleElement.appendChild(this.drawHandleLabel);
        
        // 8. Madde (Çizim Alanı): 
        // Çizimi göstermek için cetvelin üstüne ayrı bir canvas ekle
        this.drawCanvas = document.createElement('canvas');
        this.drawCanvas.className = 'ruler-draw-canvas'; 
        this.drawCanvas.style.position = 'absolute';
        
        // Çizim Çizgisini ÜSTE Taşı
        this.drawCanvas.style.top = '-10px'; // 10px Dışarıda (üstte)
        this.drawCanvas.style.bottom = 'auto'; // Altı sıfırla
        
        this.drawCanvas.style.left = '0';
        this.drawCanvas.style.pointerEvents = 'none'; // Tıklanamaz
        this.drawCtx = this.drawCanvas.getContext('2d');
        this.rulerElement.appendChild(this.drawCanvas);

        // Cetveli sayfaya (body) ekle
        document.body.appendChild(this.rulerElement);
        
        // Başlangıçta gizle
        this.rulerElement.style.display = 'none';
        
        // Olay dinleyicilerini (Event Listeners) bağla
        this.addListeners();
        
        // Durumu (konum, genişlik) güncelle
        this.updateTransform();
        this.updateMarkings();
        this.updateDrawCanvasSize();
    },
    
    // Cetveli göster/gizle (Toggle)
    toggle: function() {
        if (!this.rulerElement) this.init(); 
        if (this.rulerElement.style.display === 'none') {
            this.show();
        } else {
            this.hide();
        }
    },
    
    // Ekrana Gelmeme Hatası Düzeltmesi
    show: function() {
        if (!this.rulerElement) return; // Güvenlik kontrolü
        this.rulerElement.style.display = 'flex';
        const startWidth = this.state.width || 300;
        this.state.x = (window.innerWidth / 2) - (startWidth / 2);
        this.state.y = (window.innerHeight / 2) - 30; // 30 = 60px yüksekliğin yarısı
        this.updateTransform();
    },
    
    hide: function() {
        if (!this.rulerElement) return; // Güvenlik kontrolü
        this.rulerElement.style.display = 'none';
    },
    
    // Akıcı Olmama Hatası Düzeltmesi
    updateTransform: function() {
        if (!this.rulerElement) return; // Güvenlik kontrolü
        const { x, y, width, angle } = this.state;
        
        this.rulerElement.style.left = `${x}px`;
        this.rulerElement.style.top = `${y}px`;
        this.rulerElement.style.width = `${width}px`;
        
        // DÜZELTME: Zıplamayı önlemek için merkezi her zaman 'center' yap
        this.rulerElement.style.transformOrigin = 'center center';
        this.rulerElement.style.transform = `rotate(${angle}deg)`;
            
        this.updateDrawCanvasSize();
    },
    
    // Cetvelin çizim alanını (canvas) yeniden boyutlandır
    updateDrawCanvasSize: function() {
        if (!this.drawCanvas) return; // Güvenlik kontrolü
        this.drawCanvas.width = this.state.width;
        this.drawCanvas.height = 10; // Dışarıdaki kanvasın yüksekliği
    },

    // Tıklama Sorunu Düzeltmesi
    addListeners: function() {
        
        const body = this.bodyElement;
        const resizeLeft = this.rulerElement.querySelector('.resize-handle.left');
        const resizeRight = this.rulerElement.querySelector('.resize-handle.right');
        const rotateTL = this.rulerElement.querySelector('.rotate-handle.top-left');
        const rotateBR = this.rulerElement.querySelector('.rotate-handle.bottom-right');
        const drawHandle = this.drawHandleElement;

        const handleMouseDown = this.onMouseDown.bind(this);

        // --- Mouse Olayları ---
        body.addEventListener('mousedown', handleMouseDown);
        resizeLeft.addEventListener('mousedown', handleMouseDown);
        resizeRight.addEventListener('mousedown', handleMouseDown);
        rotateTL.addEventListener('mousedown', handleMouseDown); 
        rotateBR.addEventListener('mousedown', handleMouseDown); 
        drawHandle.addEventListener('mousedown', handleMouseDown); 

        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('mouseup', this.onMouseUp.bind(this));
        
        // --- Dokunmatik (Touch) Olayları ---
        body.addEventListener('touchstart', handleMouseDown, { passive: false });
        resizeLeft.addEventListener('touchstart', handleMouseDown, { passive: false });
        resizeRight.addEventListener('touchstart', handleMouseDown, { passive: false });
        rotateTL.addEventListener('touchstart', handleMouseDown, { passive: false }); 
        rotateBR.addEventListener('touchstart', handleMouseDown, { passive: false }); 
        drawHandle.addEventListener('touchstart', handleMouseDown, { passive: false }); 

        window.addEventListener('touchmove', this.onMouseMove.bind(this), { passive: false });
        window.addEventListener('touchend', this.onMouseUp.bind(this));
    },

    getEventPos: function(e) {
    if (e.touches || e.changedTouches) {
            // Eğer ekranda hala parmak varsa onu al
            if (e.touches && e.touches.length > 0) {
                return { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
            // Eğer parmak kalktıysa (touchend), kalkan parmağın son konumunu al
            if (e.changedTouches && e.changedTouches.length > 0) {
                return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
            }
        }
        // Fare olayı ise normal al
        return { x: e.clientX, y: e.clientY };
    },

    // MOUSE/TOUCH BAŞLANGICI (DÜZELTME: Güvenli Merkezden Dönme)
    onMouseDown: function(e) {
    e.preventDefault(); 
    e.stopPropagation();
    window.bringToolToFront(this.rulerElement); 
    window.bringToolToFront(this.rulerElement); 
    
       const target = e.target;
    this.startPos = this.getEventPos(e);
    this.startState = JSON.parse(JSON.stringify(this.state)); 
    
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
    // **** DÜZELTME (Merkezden Dönme) ****
    else if (target.classList.contains('rotate-handle')) {
        this.interactionMode = 'rotating';
        // Pivotu (dönme merkezini) hesapla
        this.startState.centerX = this.state.x + this.state.width / 2;
        this.startState.centerY = this.state.y + 30; // 60px yükseklik / 2
    } 
    // **** DÖNDÜRME MANTIĞI SONU ****
    
else if (target.classList.contains('draw-handle')) {
    if (window.currentTool === 'eraser') {
        window.isDrawing = false; // app.js'deki silgi bayrağını temizle
        window.setActiveTool('none'); // <-- DEĞİŞİKLİK BURADA
    }        

window.audio_draw.play();
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

    // MOUSE/TOUCH HAREKETİ (Ana yönlendirici)
    onMouseMove: function(e) {
        if (this.interactionMode === 'none') return;
        
        const currentPos = this.getEventPos(e);
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

    // MOUSE/TOUCH BİTİŞİ (DÜZELTME: Zıplama Kodu Kaldırıldı)
   // --- ruler.js ---
// LÜTFEN MEVCUT onMouseUp FONKSİYONUNUZU BU BLOK İLE DEĞİŞTİRİN:

    onMouseUp: function(e) {
    if (this.interactionMode === 'none') return; 

    if (this.interactionMode === 'dragging') {
        this.bodyElement.style.cursor = 'grab'; 
    }
    
    if (this.isDrawingLine) { 
        // 1. Sesi durdur
        window.audio_draw.pause(); 
        window.audio_draw.currentTime = 0; 
        
        // --- KRİTİK FİNALİZE KONTROLÜ ---
        // Çizimi kalıcı olarak kaydetmeye zorla (Silgi aktif olsa bile)
        this.finalizeDraw(); 
        // --- KONTROL SONU ---
        
        // 2. Çizimi kaydet (Hata düzeltildi: finalizeDraw ÖNCE çağrılır)
        this.drawHandleLabel.style.display = 'none';
        
        // 3. Handle'ı sıfırla (Görsel ve State)
        if(this.drawHandleElement) { 
            this.drawHandleElement.style.transition = 'left 0.05s ease-out';
            this.drawHandleElement.style.left = '0px'; 
            
            this.isDrawingLine = false; 
            this.drawCtx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);
            
            // KRİTİK: Bir sonraki çizim için state'i sıfırla
            this.state.currentHandleX = 0; 
        }
    }
    
    this.interactionMode = 'none'; 
},

    // --- MANTIK FONKSİYONLARI (TÜMÜ EKLENDİ) ---

    // 4. Madde: Sürükleme Mantığı
    handleDrag: function(dx, dy) {
        this.state.x = this.startState.x + dx;
        this.state.y = this.startState.y + dy;
        this.updateTransform();
    },

    // 7. Madde: Döndürme Mantığı (DÜZELTME: Merkezden Dönme)
    handleRotate: function(e) {
        const currentPos = this.getEventPos(e);
        // Merkezi (pivotu) startState'den al
        const center = { x: this.startState.centerX, y: this.startState.centerY };
        
        // Orijinal tıklama anındaki açı
        const startAngle = Math.atan2(this.startPos.y - center.y, this.startPos.x - center.x);
        // Farenin şu anki açısı
        const currentAngle = Math.atan2(currentPos.y - center.y, currentPos.x - center.x);
        
        // İkisi arasındaki fark
        const angleDiff = currentAngle - startAngle; 
        
        // Yeni açıyı ayarla
        this.state.angle = this.startState.angle + (angleDiff * 180 / Math.PI);
        this.updateTransform();
    },

    // 5. & 6. Madde: Yeniden Boyutlandırma Mantığı (Çalışan Kod)
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

    // 3. & 11. Madde: Cetvel İşaretlerini Güncelle
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

    // 8. & 9. Madde: Çizim Tutamacı Mantığı (Çalışan Kod)
    handleDraw: function(e) {
        
        const pos = this.getEventPos(e);
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
    // ... (hesaplama bitti) ...
    
    this.state.currentHandleX = handleX; 
    
    this.drawHandleElement.style.transition = 'none'; 
    this.drawHandleElement.style.left = `${handleX}px`;
    
    // --- KRİTİK DÜZELTME (Virgül Ekle) ---
    const cm = (handleX / this.PIXELS_PER_CM).toFixed(1).replace('.', ',');
    this.drawHandleLabel.innerText = `${cm} cm`;
    // --- DÜZELTME SONU ---
    
    // Çizgiyi (üste taşınan) kanvasa çiz
    this.drawCtx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);
    this.drawCtx.beginPath();
    this.drawCtx.moveTo(0, 4); 
    this.drawCtx.lineTo(handleX, 4); 
    this.drawCtx.strokeStyle = '#FFFFFF'; 
    this.drawCtx.lineWidth = 3; 
    this.drawCtx.stroke();
},

    // 8. Madde: Çizimi ana kanvasa (app.js) gönderme (Zıplama Hatası Düzeltildi)
    // --- ruler.js ---
// LÜTFEN MEVCUT finalizeDraw FONKSİYONUNUZU BU BLOK İLE DEĞİŞTİRİN:

finalizeDraw: function() {
    
    const handleX = this.state.currentHandleX || 0; 
    if (handleX <= 0) return; 

    // ... (p1 ve p2 hesaplamaları sizde mevcut olmalı) ...
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

    const p1 = {
        x: p1_rotated_x + centerX,
        y: p1_rotated_y + centerY
    };
    const p2 = {
        x: p2_rotated_x + centerX,
        y: p2_rotated_y + centerY
    };
    
    // --- YENİ EKLENEN KISIM (Etiket Verisi) ---
    // 1. Uzunluğu "X,X cm" formatında hesapla (virgül kullanarak)
    const cmText = (handleX / this.PIXELS_PER_CM).toFixed(1).replace('.', ',') + " cm";
    
    // 2. Orta noktayı hesapla
    const midPoint = { 
        x: (p1.x + p2.x) / 2, 
        y: (p1.y + p2.y) / 2 
    };
    // --- YENİ EKLENEN KISIM SONU ---

    if (window.drawnStrokes && window.redrawAllStrokes) {
        window.drawnStrokes.push({
            type: 'straightLine', 
            p1: p1,
            p2: p2,
            color: window.isToolThemeBlack ? '#000000' : window.currentLineColor, 
            width: 3,
            lengthLabel: cmText, // <-- YENİ SATIR
            lengthLabelPos: midPoint // <-- YENİ SATIR
        });
        window.redrawAllStrokes(); 
    } else {
        console.error("Hata: drawnStrokes veya redrawAllStrokes globalda bulunamadı!");
    }
}, // <-- finalizeDraw fonksiyonu burada biter

// LÜTFEN KODUNUZUN KALANINI OLDUĞU GİBİ BIRAKIN
// (window.RulerTool.init(); satırını SİLMEYİN)
}; // <-- Ana Nesnenin Kapanışı

// 'null' hatasını önlemek için init()'i hemen çağır
window.RulerTool.init();