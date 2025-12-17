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
            this.drawHandle.style.transition = 'transform 0.05s ease-out';
            this.drawHandle.style.transform = 'translateX(-50%) translate(0px, 0px)';
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
        // (audio pause kodu sizde zaten vardı)
        window.audio_draw.pause();
        window.audio_draw.currentTime = 0;

        // --- KRİTİK FİNALİZE KONTROLÜ ---
        // Çizimi kalıcı olarak kaydetmeye zorla (Silgi aktif olsa bile)
        this.finalizeDraw();
        // --- KONTROL SONU ---
        
        this.state.isDrawing = false;
        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        
        // --- GECİKME VE KRİTİK DÜZELTME ---
        setTimeout(() => {
            this.previewCanvas.style.display = 'none'; // Önizlemeyi kapat
            
            // 1. Kırmızı çizgiyi sıfırla
            this.redLine.style.transition = 'transform 0.05s ease-out';
            this.redLine.style.transform = 'rotate(0deg)';
            
            // 2. HANDLE'I DÜZELT: Sadece BASE konumuna sıfırla
            this.drawHandle.style.transition = 'transform 0.05s ease-out';
            this.drawHandle.style.transform = 'translateX(-50%)'; 
            
            this.drawHandleLabel.style.display = 'none';
        }, 50); // 50ms gecikme
        // --- YENİ KOD SONU ---
    }
    if (this.interactionMode === 'dragging') {
        this.bodyElement.style.cursor = 'grab';
    }
    this.interactionMode = 'none';
},

    // --- 6. ÇİZİM MANTIĞI (DÜZELTİLDİ: Ters Döndürme Uygulandı) ---
    // --- aciolcer.js ---
// LÜTFEN MEVCUT handleDraw FONKSİYONUNUZU BU BLOK İLE DEĞİŞTİRİN:

    handleDraw: function(currPos) {
        // Sürükleme başladığını kaydet (Adım 1'deki "hiç çizim yapmama" sorununu çözer)
        this.state.hasDragged = true;

        const cx = this.state.x;
        const cy = this.state.y;

        // 1. Önizleme Çizgisi (Global - Her zaman doğru)
        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height); 
        this.previewCtx.beginPath();
        this.previewCtx.moveTo(cx, cy);
        this.previewCtx.lineTo(currPos.x, currPos.y);
        this.previewCtx.strokeStyle = '#FFFFFF';
        this.previewCtx.lineWidth = 3; 
        this.previewCtx.setLineDash([5, 5]);
        this.previewCtx.stroke();
        this.previewCtx.setLineDash([]);

        // 2. LOKAL Pozisyon Hesabı
        const gdx = currPos.x - cx;
        const gdy = currPos.y - cy;
        const rad = -this.state.angle * Math.PI / 180;
        const ldx = gdx * Math.cos(rad) - gdy * Math.sin(rad);
        const ldy = gdx * Math.sin(rad) + gdy * Math.cos(rad);

        // 3. Açıyı Hesapla (ZIT YÖN DÜZELTMESİ)
        let localAngleDeg;
        
        // Fare alt yarıya mı kaydı? (ldy > 0)
        if (ldy > 0) {
            // Evet, alt yarıda. En yakın kenara (0 veya 180) kilitle.
            if (ldx > 0) { // Alt-sağ
                localAngleDeg = 0;
            } else { // Alt-sol
                localAngleDeg = 180;
            }
        } else {
            // Hayır, üst yarıda (normal hesaplama)
            localAngleDeg = Math.atan2(-ldy, ldx) * 180 / Math.PI;
        }

        // 4. Butonu ve Etiketi LOKAL pozisyona taşı
        this.drawHandle.style.transform = `translateX(-50%) translate(${ldx}px, ${ldy + 5}px)`;
        this.drawHandleLabel.style.transform = `translateX(-50%) translate(${ldx}px, ${ldy - 20}px)`;

        // 5. Yeni Açıları Kaydet
        this.state.currentDrawAngleLocal = localAngleDeg;
        this.drawHandleLabel.innerText = `${localAngleDeg.toFixed(0)}°`;

        // Kırmızı çizgiyi döndür (Lokal açıya göre)
        this.redLine.style.transition = 'none';
        this.redLine.style.transform = `rotate(${-localAngleDeg}deg)`;
    },

    // --- aciolcer.js ---
// LÜTFEN MEVCUT finalizeDraw FONKSİYONUNUZU VE SONUNDAKİ
// '};' İŞARETİNİ BU BLOK İLE DEĞİŞTİRİN:

    finalizeDraw: function() {
        
        // --- DÜZELTME (0 Derece Hatası) ---
        if (!this.state.isDrawing) return;

        // "Sadece tıklayıp bıraktıysan" (hiç sürüklemediysen) çizim yapma.
        // Ama 0 dereceye sürüklediysen (hasDragged) çizim yap.
        if (this.state.currentDrawAngleLocal < 0.1 && !this.state.hasDragged) {
            return;
        }

     // --- DÜZELTME SONU ---

        const cx = this.state.x;
        const cy = this.state.y;

        // Lokal açıdan Global açıya geç
        const localAngleDeg = this.state.currentDrawAngleLocal;
        // (Lokal Y-yukarı açısını, Global Y-aşağı sistemine çevir ve aletin dönüşünü ekle)
        // Global = (360 - Lokal) + AletDönüşü
        const globalAngleRad = ((360 - localAngleDeg) + this.state.angle) * Math.PI / 180;

        // Ana kanvas ofsetini bul
        const mainCanvas = document.querySelector('canvas');
        const rect = mainCanvas.getBoundingClientRect();

        // P1 (Merkez) ve P2 (Işın ucu) hesapla
        const p1 = {
            x: cx - rect.left,
            y: cy - rect.top
        };
        const p2 = {
            x: p1.x + Math.cos(globalAngleRad) * 1000,
            y: p1.y + Math.sin(globalAngleRad) * 1000
        };

        // Kaydet
        if (window.drawnStrokes && window.redrawAllStrokes) {
            let l1 = '', l2 = '';
            if (window.nextPointChar && window.advanceChar) {
                l1 = window.nextPointChar; window.nextPointChar = window.advanceChar(l1);
                l2 = window.nextPointChar; window.nextPointChar = window.advanceChar(l2);
            }
            window.drawnStrokes.push({
                type: 'ray',
                p1: p1,
                p2: p2,
                color: window.isToolThemeBlack ? '#000000' : window.currentLineColor,
                width: 3,
                label1: l1, label2: l2
            });
            window.redrawAllStrokes();
        }
    }
}; // <-- Bu, window.AciolcerTool nesnesini kapatır

window.AciolcerTool.init();