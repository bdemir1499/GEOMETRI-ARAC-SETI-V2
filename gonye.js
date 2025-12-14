// --- gonye.js (BÖLÜM 1/3) ---
// (Kurulum, HTML Oluşturma ve Durum Değişkenleri)

// 1. Ana Gönye Nesnesi
window.GonyeTool = {
    gonyeElement: null,
    bodyElement: null,
    markingsElement: null,
    drawHandleElement: null,
    drawHandleLabel: null,
    
    // Gönyenin durumu (state)
    state: {
        x: 100,
        y: 100,
        width: 200,
        height: 346, // 200 * 1.732 (30-60-90 oranı)
        angle: 0,
        currentHandleY: 0, // Dikey çizim
    },
    
    // Etkileşim durumu
    interactionMode: 'none', // 'dragging', 'rotating', 'drawing'
    startPos: { x: 0, y: 0 },
    startState: {}, 
    
    PIXELS_PER_CM: 30, // Cetvel ile aynı ölçek
    isDrawingLine: false,
    drawCanvas: null, 
    drawCtx: null,
    
    // 1. Madde: Gönyeyi oluştur ve sayfaya ekle (init)
    init: function() {
        if (this.gonyeElement) return; // Zaten oluşturulmuş

        // Ana Konteyner
        this.gonyeElement = document.createElement('div');
        this.gonyeElement.className = 'gonye-container';
        
        // 3. Madde: Sürüklenebilir Gövde
        this.bodyElement = document.createElement('div');
        this.bodyElement.className = 'gonye-body';
        this.gonyeElement.appendChild(this.bodyElement);
        
        // 6. Madde: İşaretler (cm, çizgiler)
        this.markingsElement = document.createElement('div');
        this.markingsElement.className = 'gonye-markings';
        this.bodyElement.appendChild(this.markingsElement);
        
        // 5. Madde: Köşe Etiketleri
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

        // 7. Madde: Döndürme Butonu (Tek tane)
        const rotateA = document.createElement('div');
        rotateA.className = 'gonye-rotate-handle';
        this.gonyeElement.appendChild(rotateA);
        
        // 8. Madde: Çizim Tutamacı (Kırmızı)
        this.drawHandleElement = document.createElement('div');
        this.drawHandleElement.className = 'gonye-draw-handle';
        this.gonyeElement.appendChild(this.drawHandleElement);

        // 8. Madde: Çizim Etiketi
        this.drawHandleLabel = document.createElement('div');
        this.drawHandleLabel.className = 'gonye-draw-label';
        this.drawHandleLabel.innerText = '0.0 cm';
        this.drawHandleElement.appendChild(this.drawHandleLabel);
        // --- YENİ: BOYUTLANDIRMA TUTAMACI ---
        this.resizeHandle = document.createElement('div');
        this.resizeHandle.className = 'gonye-resize-handle';
        this.gonyeElement.appendChild(this.resizeHandle);
        // 8. Madde (Çizim Alanı): 
        // Çizimi göstermek için ayrı bir canvas
        this.drawCanvas = document.createElement('canvas');
        this.drawCanvas.style.position = 'absolute';
        this.drawCanvas.style.top = '0';
        this.drawCanvas.style.left = '-10px'; // Sol kenarın 10px dışı
        this.drawCanvas.style.pointerEvents = 'none'; // Tıklanamaz
        this.drawCtx = this.drawCanvas.getContext('2d');
        this.gonyeElement.appendChild(this.drawCanvas);

        // Gönyeyi sayfaya (body) ekle
        document.body.appendChild(this.gonyeElement);
        
        // Başlangıçta gizle
        this.gonyeElement.style.display = 'none';
        
        // Olay dinleyicilerini (Event Listeners) bağla
        this.addListeners();
        
        // Durumu (konum, genişlik) güncelle
        this.updateTransform();
        this.updateMarkings();
        this.updateDrawCanvasSize();
    },
    
    // Gönyeyi göster/gizle (Toggle)
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
    
    // Gönyenin CSS transform'unu (konum, döndürme) uygula
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
    
    // Gönyenin çizim alanını (canvas) yeniden boyutlandır
    updateDrawCanvasSize: function() {
        if (!this.drawCanvas) return;
        this.drawCanvas.width = 10; // Çizgi kalınlığı için
        this.drawCanvas.height = this.state.height;
    }
};
// --- gonye.js (BÖLÜM 2/3) ---
// (Ana Olay Dinleyicileri - Mousedown, Mousemove, Mouseup)

window.GonyeTool.addListeners = function() {
    
    const body = this.bodyElement;
    const rotateA = this.gonyeElement.querySelector('.gonye-rotate-handle');
    const drawHandle = this.drawHandleElement;
    const resizeHandle = this.resizeHandle; // <-- YENİ

    const handleMouseDown = this.onMouseDown.bind(this);

    // --- Mouse ---
    body.addEventListener('mousedown', handleMouseDown);
    rotateA.addEventListener('mousedown', handleMouseDown);
    drawHandle.addEventListener('mousedown', handleMouseDown);
    resizeHandle.addEventListener('mousedown', handleMouseDown); // <-- YENİ

    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
    
    // --- Dokunmatik ---
    body.addEventListener('touchstart', handleMouseDown, { passive: false });
    rotateA.addEventListener('touchstart', handleMouseDown, { passive: false });
    drawHandle.addEventListener('touchstart', handleMouseDown, { passive: false });
    resizeHandle.addEventListener('touchstart', handleMouseDown, { passive: false }); // <-- YENİ

    window.addEventListener('touchmove', this.onMouseMove.bind(this), { passive: false });
    window.addEventListener('touchend', this.onMouseUp.bind(this));
};

// Olaydan X/Y pozisyonunu al (Mouse veya Touch)
window.GonyeTool.getEventPos = function(e) {
        // Dokunmatik olay mı?
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
    };

// MOUSE/TOUCH BAŞLANGICI
window.GonyeTool.onMouseDown = function(e) {
    e.preventDefault(); 
    e.stopPropagation();
    window.bringToolToFront(this.gonyeElement); 
    
    const target = e.target;
    this.startPos = this.getEventPos(e);
    this.startState = JSON.parse(JSON.stringify(this.state)); 
    
    if (target.classList.contains('gonye-body')) {
        this.interactionMode = 'dragging';
        this.bodyElement.style.cursor = 'grabbing';
    } 
    else if (target.classList.contains('gonye-rotate-handle')) {
        this.interactionMode = 'rotating';
        // 7. Madde: Merkezden döndürme
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
            window.setActiveTool('none'); // <-- DÜZELTİLDİ
        }

window.audio_draw.play(); // <-- SESİ BAŞLAT
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
};

// MOUSE/TOUCH HAREKETİ (Ana yönlendirici)
window.GonyeTool.onMouseMove = function(e) {
    if (this.interactionMode === 'none') return;
    
    const currentPos = this.getEventPos(e);
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
            this.handleDraw(e);
            break;
    }
};

// MOUSE/TOUCH BİTİŞİ
window.GonyeTool.onMouseUp = function(e) {
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
        const pos = currentMousePos;   // app.js içinde zaten güncelleniyor
this.finalizeDraw(pos.x, pos.y);

        // --- KONTROL SONU ---

        // 2. Etiketi gizle 
        this.drawHandleLabel.style.display = 'none';
        
        // --- KRİTİK DÜZELTME (Handle'ı Geri Çek) ---
        // Çizim kaydından hemen sonra, temiz ve tek bir blokta geri dönüş yapılır.
        if(this.drawHandleElement) { 
                        
            // Bayrakları ve önizlemeyi temizle
            this.isDrawingLine = false;
            this.drawCtx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);
        }
        // --- DÜZELTME SONU ---
    }
    
    this.interactionMode = 'none';
};
// --- gonye.js (BÖLÜM 3/3) ---
// (Karmaşık Etkileşim Mantığı - Drag, Rotate, Draw)

// 3. Madde: Sürükleme Mantığı
window.GonyeTool.handleDrag = function(dx, dy) {
    this.state.x = this.startState.x + dx;
    this.state.y = this.startState.y + dy;
    this.updateTransform();
};

// 7. Madde: Döndürme Mantığı
window.GonyeTool.handleRotate = function(currentPos) {
    const center = { x: this.startState.centerX, y: this.startState.centerY };
    
    const startAngle = Math.atan2(this.startPos.y - center.y, this.startPos.x - center.x);
    const currentAngle = Math.atan2(currentPos.y - center.y, currentPos.x - center.x);
    
    const angleDiff = currentAngle - startAngle; 
    
    this.state.angle = this.startState.angle + (angleDiff * 180 / Math.PI);
    this.updateTransform();
};

// 6. Madde: Cetvel İşaretlerini Güncelle
window.GonyeTool.updateMarkings = function() {
    if (!this.markingsElement) return; 
    this.markingsElement.innerHTML = ''; 
    const height = this.state.height;
    const cmCount = Math.floor(height / this.PIXELS_PER_CM);
    
    // Etiketleri (A, B, C) yeniden ekle (işaretler silindiği için)
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
    
    // 0 Etiketi (B köşesi)
    const zeroLabel = document.createElement('div');
    zeroLabel.className = 'gonye-label';
    zeroLabel.style.top = `${height}px`; // En altta
    zeroLabel.innerText = '0';
    this.markingsElement.appendChild(zeroLabel);

    for (let cm = 1; cm <= cmCount; cm++) {
        const yPos = height - (cm * this.PIXELS_PER_CM);
        
        // Ana CM işareti
        const tickL = document.createElement('div');
        tickL.className = 'gonye-tick large';
        tickL.style.top = `${yPos}px`;
        this.markingsElement.appendChild(tickL);
        
        // Ana CM Etiketi
        const label = document.createElement('div');
        label.className = 'gonye-label';
        label.style.top = `${yPos}px`;
        label.innerText = cm;
        this.markingsElement.appendChild(label);
        
        // 0.5 CM işareti
        if (this.PIXELS_PER_CM > 20) {
             const tickM = document.createElement('div');
             tickM.className = 'gonye-tick medium';
             tickM.style.top = `${yPos + this.PIXELS_PER_CM / 2}px`;
             this.markingsElement.appendChild(tickM);
        }
    }
    
    // Başlangıçta tutamacı B'ye (0 hizası) ayarla
    this.drawHandleElement.style.top = `${height - 20}px`; // 20 = tutamaç yüksekliği
};

// 8. Madde: Çizim Tutamacı Mantığı
window.GonyeTool.handleDraw = function(e) {
    
    const pos = this.getEventPos(e);
    
    // Farenin pozisyonunu, gönyenin döndürülmüş 'lokal' koordinatına çevir
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
    // ... (hesaplama bitti) ...
    
    this.state.currentHandleY = handleY; 
    
   
    
    // --- KRİTİK DÜZELTME (Hesaplamayı Eşitle) ---
    // (Eski cm hesaplamasını siliyoruz)
    
    // 1. finalizeDraw'daki gibi yerel bitiş noktasını bul
    const startY_local = this.state.height;
    const endY_local = handleY + 10; // Tutamacın ortası
    
    // 2. Gerçek piksel uzunluğunu hesapla
    const lengthPx = Math.abs(startY_local - endY_local);
    
    // 3. Pikseli CM'ye çevir ve virgül kullan
    const cm = (lengthPx / this.PIXELS_PER_CM).toFixed(1).replace('.', ',');
    // --- DÜZELTME SONU ---
    
    this.drawHandleLabel.innerText = `${cm} cm`;
    
    // Çizgiyi anlık (preview) çiz
    this.drawCtx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);
    this.drawCtx.beginPath();
    this.drawCtx.moveTo(4, this.state.height); // B (0) noktası
    this.drawCtx.lineTo(4, endY_local); // Tutamacın ortası (endY_local kullandık)
    this.drawCtx.strokeStyle = '#FFFFFF'; 
    this.drawCtx.lineWidth = 3; 
    this.drawCtx.stroke();
};

// 8. Madde: Çizimi ana kanvasa (app.js) gönderme
window.GonyeTool.finalizeDraw = function(x, y) {
    // Eğer parametre verilmişse, son pozisyonu kullan
    const handleY = (typeof y !== 'undefined') ? y : (this.state.currentHandleY || 0);

    const startX_local = 4; 
    const startY_local = this.state.height; 
    const endX_local = (typeof x !== 'undefined') ? x : 4;
    const endY_local = handleY + 10;

        if (Math.abs(startY_local - endY_local) < 1) return; 

        // ... (p1 ve p2 hesaplamaları sizde mevcut olmalı) ...
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
        
        // --- YENİ EKLENEN KISIM (Etiket Verisi) ---
        // 1. Uzunluğu "X,X cm" formatında hesapla (virgül kullanarak)
        const lengthPx = window.distance(p1, p2);
        const cmText = (lengthPx / this.PIXELS_PER_CM).toFixed(1).replace('.', ',') + " cm";

        // 2. Orta noktayı hesapla
        const midPoint = { 
            x: (p1.x + p2.x) / 2, 
            y: (p1.y + p2.y) / 2 
        };
        // --- YENİ EKLENEN KISIM SONU ---
        
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
                lengthLabel: cmText, // <-- YENİ SATIR
                lengthLabelPos: midPoint // <-- YENİ SATIR
            });
            window.redrawAllStrokes(); 
        } else {
            console.error("Hata: drawnStrokes veya redrawAllStrokes globalda bulunamadı!");
        }
    },

// 9. Madde: Boyutlandırma Mantığı
window.GonyeTool.handleResize = function(dx, dy) {
    const angleRad = this.state.angle * (Math.PI / 180);
    const cosAngle = Math.cos(angleRad);
    const sinAngle = Math.sin(angleRad);
    
    // Hareketi gönyenin açısına göre hesapla
    const projectedDelta = (dx * cosAngle) + (dy * sinAngle);

    let newWidth = this.startState.width + projectedDelta;
    if (newWidth < 100) newWidth = 100;
    
    // Orantılı yükseklik (Dik üçgen formunu koru)
    const newHeight = newWidth * 1.732;
    
    this.state.width = newWidth;
    this.state.height = newHeight;
    
    this.updateTransform();
    this.updateMarkings();
    
    // Kırmızı tutamacı yeni boyuta göre ayarla
    if (this.drawHandleElement) {
        this.drawHandleElement.style.top = `${newHeight - 20}px`;
        this.state.currentHandleY = newHeight - 20;
        this.drawHandleLabel.innerText = "0,0 cm";
    }
};

// 'null' hatasını önlemek için init()'i hemen çağır
window.GonyeTool.init();