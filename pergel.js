// --- pergel.js (Tüm Hatalar Giderilmiş Nihai Sürüm) ---

window.PergelTool = {
    // HTML Elementleri
    pergelElement: null,
    handleTop: null,
    needleTip: null,
    penTip: null,
    penResizeHandle: null, // YENİ
    leftLeg: null,
    rightLeg: null,
    radiusLabel: null, // "cm" etiketini göstermek için
    
    // Önizleme Kanvası
    previewCanvas: null,
    previewCtx: null,

    // GÖRSEL SABİTLER (pergel.css'den)
    LEG_LENGTH_PX: 239, // PIVOT DÜZELTMESİ. BU DEĞERDE KALMALI
    JOINT_OFFSET_Y_PERCENT: 0.08, // BU DEĞERDE KALMALI

    // Durum (State)
    state: {
        pivot: { x: 400, y: 300 }, // SİVRİ UCUN (İğne) konumu
        radius: 100, // Kalem ucu ile iğne ucu arasındaki PİKSEL mesafe
        rotation: 0, // Kalem ucunun pivot etrafındaki açısı (Derece)
        isDrawing: false,
        startDrawAngle: 0, 
        previousDrawAngle: 0,
        isFlipped: false,
        lastTapTime: 0
    },

    // Etkileşim
    interactionMode: 'none', // 'dragging' (pivotu taşı), 'resizing' (yarıçapı ayarla), 'drawing' (çizim)
    startPos: { x: 0, y: 0 },
    startState: {},

    // --- 1. BAŞLATMA ---
    init: function() {
        this.pergelElement = document.getElementById("compass-container");
        if (!this.pergelElement) {
            console.error("Pergel HTML'i bulunamadı!");
            return;
        }

        // 1.1. Etkileşim Noktalarını Bul
        this.handleTop = this.pergelElement.querySelector(".handle-top");
        this.needleTip = this.pergelElement.querySelector(".needle-tip");
        this.penTip = this.pergelElement.querySelector(".pen-tip");
        this.penResizeHandle = this.pergelElement.querySelector(".pen-resize-handle"); // YENİ
        this.leftLeg = this.pergelElement.querySelector(".left-leg");
        this.rightLeg = this.pergelElement.querySelector(".right-leg");

// --- YENİ: TURUNCU BOYUTLANDIRMA BUTONU OLUŞTUR ---
        this.scaleHandle = document.createElement('div');
        this.scaleHandle.className = 'pergel-scale-handle';
        this.pergelElement.appendChild(this.scaleHandle);

        // YENİ: Kontrole eklendi
        if (!this.handleTop || !this.needleTip || !this.penTip || !this.penResizeHandle || !this.leftLeg || !this.rightLeg) { 
            console.error("Pergel HTML parçaları (.pen-resize-handle dahil) bulunamadı!");
            return;
        }

        // 1.2. Gerçek zamanlı 'cm' etiketini oluştur
        this.radiusLabel = document.createElement('div');
        this.radiusLabel.className = 'pergel-radius-label'; 
        this.radiusLabel.style.position = 'fixed';
        this.radiusLabel.style.display = 'none';
        this.radiusLabel.style.background = '#fff';
        this.radiusLabel.style.color = '#000';
        this.radiusLabel.style.padding = '2px 5px';
        this.radiusLabel.style.borderRadius = '3px';
        this.radiusLabel.style.pointerEvents = 'none';
        this.radiusLabel.style.zIndex = '1002';
        document.body.appendChild(this.radiusLabel);

        // 1.3. Çizim Önizleme Kanvasını Oluştur
        this.previewCanvas = document.createElement('canvas');
        this.previewCanvas.className = 'pergel-preview-canvas';
        this.previewCanvas.style.position = 'fixed';
        this.previewCanvas.style.top = '0';
        this.previewCanvas.style.left = '0';
        this.previewCanvas.style.pointerEvents = 'none';
        this.previewCanvas.style.zIndex = '100'; // Pergelin (20) altında
        document.body.appendChild(this.previewCanvas);
        
        // DÜZELTME: 'd' yerine '2d'
        this.previewCtx = this.previewCanvas.getContext('2d');
        
        this.previewCanvas.style.display = 'none'; // Başlangıçta gizli

        // 1.4. Olay Dinleyicilerini Ekle
        this.addListeners();
        // 1.5. CSS'i state'e göre ayarla
        this.updateTransform();
    },

toggle: function() {
        if (!this.pergelElement) this.init();
        if (!this.pergelElement) return;

        // .hidden sınıfını kontrol et
        const isHidden = this.pergelElement.classList.contains('hidden');
        
        if (isHidden) {
            this.show();
        } else {
            this.hide();
        }
    },

    // --- 2. GÖSTER / GİZLE (app.js çağırır) ---
    show: function() {
        if (!this.pergelElement) this.init();
        if (!this.pergelElement) return;

        this.pergelElement.classList.remove('hidden');
        this.state.pivot = { x: window.innerWidth / 2 - 50, y: window.innerHeight / 2 };
        this.state.radius = 100;
        this.state.rotation = 0;
        this.state.previousDrawAngle = 0; // Sıfırla
        this.updateTransform();
    },

    hide: function() {
        if (!this.pergelElement) return;
        this.pergelElement.classList.add('hidden');
    },
    
    // Bu fonksiyonu ruler.js, gonye.js ve pergel.js dosyalarındaki 
    // mevcut "getEventPos" (veya getPos) fonksiyonunun yerine yapıştırın.
    
    getPos: function(e) {
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
    },

    // --- 3. OLAY DİNLEYİCİLERİ (DÜZELTİLMİŞ) ---
    addListeners: function() {
        const boundDown = this.onMouseDown.bind(this);

        const parts = [
            this.needleTip, 
            this.leftLeg, 
            this.rightLeg, 
            this.penTip, 
            this.penResizeHandle, 
            this.handleTop,
            this.scaleHandle // Turuncu buton (Varsa)
        ];

        parts.forEach(part => {
            if (part) {
                part.addEventListener('mousedown', boundDown);
                part.addEventListener('touchstart', boundDown, { passive: false });
            }
        });

        // HATA BURADAYDI: Buradan önceki bir '},' fazlalığı kodu bölüyordu.
        
        // Mouse Çift Tıklama
        if (this.handleTop) {
            this.handleTop.addEventListener('dblclick', this.onFlip.bind(this));
        }

        // Hareket ve Bırakma olaylarını tanımla
        this.boundOnMouseMove = this.onMouseMove.bind(this);
        this.boundOnMouseUp = this.onMouseUp.bind(this);
    }, // <-- FONKSİYON BURADA BİTMELİ

    onMouseDown: function(e) {
        e.preventDefault(); 
        e.stopPropagation();
        
        // Çift Dokunma Kontrolü
        if (e.type === 'touchstart' && e.target === this.handleTop) {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - this.state.lastTapTime;
            if (tapLength < 400 && tapLength > 0) {
                this.onFlip(e); 
                this.state.lastTapTime = 0; 
                return; 
            }
            this.state.lastTapTime = currentTime;
        }

        if (window.currentTool === 'eraser') {
            window.isDrawing = false; 
            window.setActiveTool('none'); 
        }

        this.state.isDrawing = false; 
        window.bringToolToFront(this.pergelElement);
        
        const target = e.target;
        this.startPos = this.getPos(e);
        this.startState = JSON.parse(JSON.stringify(this.state)); 

        let interactionStarted = false;

        // 1. TURUNCU BUTON (PERGELİ BÜYÜTME) - YENİ EKLENEN KISIM
        if (target === this.scaleHandle) {
            this.interactionMode = 'scaling_tool'; // Yeni mod
            // Başlangıç boyutlarını kaydet
            this.startState.width = this.pergelElement.offsetWidth;
            this.startState.height = this.pergelElement.offsetHeight;
            interactionStarted = true;
        }
        // 2. PEMBE BUTON (AYAKLARI AÇMA)
        else if (target === this.penResizeHandle) {
            this.interactionMode = 'resizing';
            if (this.radiusLabel) this.radiusLabel.style.display = 'block';
            interactionStarted = true;
        } 
        // 3. TEPE (ÇİZİM)
        else if (target === this.handleTop) { 
            window.audio_draw.play(); 
            this.interactionMode = 'drawing';
            this.state.isDrawing = true; 
            
            const currPos = this.getPos(e);
            const d_dx = currPos.x - this.state.pivot.x;
            const d_dy = currPos.y - this.state.pivot.y;
            const current_raw_angle = Math.atan2(d_dy, d_dx) * 180 / Math.PI;
            
            this.state.startAngle = this.state.rotation; 
            this.state.previousDrawAngle = current_raw_angle;
            
            if (this.previewCanvas) {
                this.previewCanvas.style.display = 'block';
                this.previewCanvas.width = window.innerWidth;
                this.previewCanvas.height = window.innerHeight;
            }
            if (this.previewCtx) this.previewCtx.lineDashOffset = 0;
            interactionStarted = true;
        }
        // 4. DİĞER PARÇALAR (TAŞIMA)
        else if (target === this.needleTip || target === this.penTip || target === this.leftLeg || target === this.rightLeg) {
            this.interactionMode = 'dragging';
            this.startState.containerX = parseFloat(this.pergelElement.style.left || 0);
            this.startState.containerY = parseFloat(this.pergelElement.style.top || 0);
            interactionStarted = true;
        }
        
        if (interactionStarted) {
            document.addEventListener('mousemove', this.boundOnMouseMove);
            document.addEventListener('mouseup', this.boundOnMouseUp);
            document.addEventListener('touchmove', this.boundOnMouseMove, { passive: false });
            document.addEventListener('touchend', this.boundOnMouseUp);
        }
    },

    onMouseMove: function(e) {
        if (this.interactionMode === 'none') return; 
        const currPos = this.getPos(e);
        const dx = currPos.x - this.startPos.x;
        const dy = currPos.y - this.startPos.y;

        switch (this.interactionMode) {
            // 1. PERGELİ BÜYÜTME (TURUNCU BUTON) - YENİ EKLENEN KISIM
            case 'scaling_tool':
                // Sol üstte olduğu için: Yukarı/Sola çekince büyüsün, Aşağı/Sağa çekince küçülsün
                // (Veya tam tersi, mantığa göre ayarlayalım: Aşağı çekince büyüsün)
                
                // Yüksekliği farenin dikey hareketi kadar değiştir
                // (Buton sol üstteyse 'dy' ters etki yapabilir, deneyerek ayarladık)
                let newHeight = this.startState.height - dy; 
                
                // Minimum boyut sınırı (Çok küçülmesin)
                if (newHeight < 200) newHeight = 200; 
                
                // Genişliği orantılı ayarla (En/Boy oranı ~0.8)
                let newWidth = newHeight * 0.8;
                
                // CSS'i güncelle
                this.pergelElement.style.width = `${newWidth}px`;
                this.pergelElement.style.height = `${newHeight}px`;
                
                // Bacakları ve yapıyı yeni boyuta göre güncelle
                this.updateTransform(); 
                break;

            // 2. TAŞIMA
            case 'dragging':
                this.state.pivot.x = this.startState.pivot.x + dx;
                this.state.pivot.y = this.startState.pivot.y + dy;
                this.pergelElement.style.left = `${this.startState.containerX + dx}px`;
                this.pergelElement.style.top = `${this.startState.containerY + dy}px`;
                break;

            // 3. AYAKLARI AÇMA (PEMBE BUTON)
            case 'resizing':
                const r_dx = currPos.x - this.state.pivot.x;
                const r_dy = currPos.y - this.state.pivot.y;
                this.state.radius = Math.sqrt(r_dx * r_dx + r_dy * r_dy);
                this.state.rotation = Math.atan2(r_dy, r_dx) * 180 / Math.PI;
                
                if (this.radiusLabel) { 
                    this.radiusLabel.innerText = `${(this.state.radius / 30).toFixed(1)} cm`; 
                    this.radiusLabel.style.left = `${currPos.x + 15}px`;
                    this.radiusLabel.style.top = `${currPos.y}px`;
                }
                this.updateTransform();
                break;

            // 4. ÇİZİM
            case 'drawing':
                const d_dx = currPos.x - this.state.pivot.x;
                const d_dy = currPos.y - this.state.pivot.y;
                let current_raw_angle = Math.atan2(d_dy, d_dx) * 180 / Math.PI;
                let previous_angle = this.state.previousDrawAngle; 
                let accumulated_angle = this.state.rotation; 
                
                let delta = current_raw_angle - previous_angle;
                if (delta > 180) { delta -= 360; } 
                else if (delta < -180) { delta += 360; }
                
                accumulated_angle += delta;
                this.state.rotation = accumulated_angle;
                this.state.previousDrawAngle = current_raw_angle; 
                
                this.updateTransform();
                this.drawPreviewArc(); 
                break;
        }
    },

    // DÜZELTME: "Stuck Mode" (Takılı Kalma)
    onMouseUp: function(e) {
    document.removeEventListener('mousemove', this.boundOnMouseMove);
    document.removeEventListener('mouseup', this.boundOnMouseUp);
    
    // Dokunmatik dinleyicileri de kaldır
    document.removeEventListener('touchmove', this.boundOnMouseMove);
    document.removeEventListener('touchend', this.boundOnMouseUp);

    if (this.interactionMode === 'none') return;

    if (this.interactionMode === 'drawing') {
        // Sesi durdur
        window.audio_draw.pause();
        window.audio_draw.currentTime = 0;

        // --- KRİTİK FİNALİZE KONTROLÜ ---
        // Çizimi kalıcı olarak kaydetmeye ZORLA (Silgi aktif olsa bile)
        this.finalizeDraw();
        // --- KONTROL SONU ---
        
        this.state.isDrawing = false;
        
        // --- KRİTİK DÜZELTME: GÖRSEL TEMİZLİĞİ GECİKTİR ---
        setTimeout(() => {
            if (this.previewCanvas) this.previewCanvas.style.display = 'none';
            if (this.previewCtx) this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        }, 50); // 50ms gecikme
        // --- YENİ KOD SONU ---
    }
    if (this.interactionMode === 'resizing') {
        if (this.radiusLabel) this.radiusLabel.style.display = 'none';
    }
    
    this.interactionMode = 'none';
},

onFlip: function(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }

        // 1. VARSA AKTİF ÇİZİMİ VE SESİ ÖLDÜR
        this.state.isDrawing = false;
        this.interactionMode = 'none';
        
        // Sesi sustur
        if (window.audio_draw) {
            window.audio_draw.pause();
            window.audio_draw.currentTime = 0;
        }
        
        // Önizleme Kanvasını Tamamen Temizle ve Gizle
        if (this.previewCtx && this.previewCanvas) {
            this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
            this.previewCanvas.style.display = 'none';
        }
        
        // "Hafızaya Kaydetme" riskine karşı başlangıç açısını sıfırla
        this.state.startDrawAngle = 0;
        this.state.previousDrawAngle = 0;

        // 2. Durumu (Yönü) Ters Çevir
        this.state.isFlipped = !this.state.isFlipped;

        // 3. Görsel Parçaların Yerini Değiştir
        if (this.state.isFlipped) {
            this.leftLeg.appendChild(this.penTip);
            this.leftLeg.appendChild(this.penResizeHandle);
            this.rightLeg.appendChild(this.needleTip);
        } else {
            this.leftLeg.appendChild(this.needleTip);
            this.rightLeg.appendChild(this.penTip);
            this.rightLeg.appendChild(this.penResizeHandle);
        }

        // 4. Matematiksel Konumu Güncelle (Pivotu diğer uca taşı)
        const PI_RAD = Math.PI / 180;
        const oldPen = {
            x: this.state.pivot.x + this.state.radius * Math.cos(this.state.rotation * PI_RAD),
            y: this.state.pivot.y + this.state.radius * Math.sin(this.state.rotation * PI_RAD)
        };

        this.state.pivot = oldPen; 
        this.state.rotation = this.state.rotation + 180; 
        
        // Açıyı normalize et (0-360 arası)
        this.state.rotation = this.state.rotation % 360;

        // Çizim durumu değişkenlerini güncelle
        this.state.previousDrawAngle = this.state.rotation;
        this.state.startAngle = this.state.rotation;

        this.updateTransform();
    },

    // --- 5. GÖRSEL GÜNCELLEME (Ters Gelme Hatası Düzeltildi) ---
    // --- 5. GÖRSEL GÜNCELLEME (DÜZELTİLMİŞ) ---
    updateTransform: function() {
        if (!this.pergelElement) return;

        const PI_RAD = Math.PI / 180;
        const pivot = this.state.pivot;
        
        // --- DÜZELTME BAŞLIYOR ---
        // Bacak boyunu (L) sabit sayı yerine, pergelin o anki yüksekliğine göre hesapla
        const containerHeight = this.pergelElement.offsetHeight;
        const L = containerHeight * 0.8; // Yüksekliğin %80'i bacak olsun
        // --- DÜZELTME BİTTİ ---

        const pen = {
            x: pivot.x + this.state.radius * Math.cos(this.state.rotation * PI_RAD),
            y: pivot.y + this.state.radius * Math.sin(this.state.rotation * PI_RAD)
        };

        let R = this.state.radius;
        if (R > L * 2) {
             R = L * 2; 
             this.state.radius = R;
        }
        const h = Math.sqrt(Math.max(0, L * L - (R / 2) * (R / 2)));
        const M = { x: (pivot.x + pen.x) / 2, y: (pivot.y + pen.y) / 2 };
        const v_dx = (R === 0) ? 0 : (pen.x - pivot.x) / R;
        const v_dy = (R === 0) ? 0 : (pen.y - pivot.y) / R;
        
        let v_perp_x = v_dy;
        let v_perp_y = -v_dx;

        if (v_dx < 0) {
            v_perp_x = -v_perp_x;
            v_perp_y = -v_perp_y;
        }
        
        const joint = {
            x: M.x + v_perp_x * h,
            y: M.y + v_perp_y * h
        };

        const angleToPivotRad = Math.atan2(pivot.y - joint.y, pivot.x - joint.x);
        const angleToPenRad = Math.atan2(pen.y - joint.y, pen.x - joint.x);
        
        let cssAngleLeft, cssAngleRight;

        if (this.state.isFlipped) {
            cssAngleLeft = angleToPenRad * (180 / Math.PI) - 90;
            cssAngleRight = angleToPivotRad * (180 / Math.PI) - 90;
        } else {
            cssAngleLeft = angleToPivotRad * (180 / Math.PI) - 90;
            cssAngleRight = angleToPenRad * (180 / Math.PI) - 90;
        }

        this.pergelElement.style.setProperty('--angle-left', `${cssAngleLeft}deg`);
        this.pergelElement.style.setProperty('--angle-right', `${cssAngleRight}deg`);

        const containerWidth = this.pergelElement.offsetWidth;
        
        // --- HATA DÜZELTİLDİ: Burada 'const containerHeight = ...' satırı SİLİNDİ. ---
        // (Çünkü en başta zaten tanımlamıştık)

        const jointOffsetX = containerWidth / 2;
        const jointOffsetY = containerHeight * this.JOINT_OFFSET_Y_PERCENT; 
        const containerX = joint.x - jointOffsetX;
        const containerY = joint.y - jointOffsetY;

        this.pergelElement.style.left = `${containerX}px`;
        this.pergelElement.style.top = `${containerY}px`;
        this.pergelElement.style.transform = 'none'; 
    },
    
    // --- 6. ÇİZİM ---
    
    // Anlık önizleme (Sürüklerken)
    drawPreviewArc: function() {
        if (!this.previewCtx) return; // Güvenlik
        
        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        this.previewCtx.lineDashOffset = (this.previewCtx.lineDashOffset - 0.5) % 16;
        
        this.previewCtx.beginPath();
        this.previewCtx.arc(
            this.state.pivot.x,
            this.state.pivot.y,
            this.state.radius,
            this.state.startAngle * (Math.PI / 180), 
            this.state.rotation * (Math.PI / 180), 
            false // 180 derece hatası düzeltildiği için yön hep 'false'
        );
        this.previewCtx.strokeStyle = "rgba(255, 0, 255, 0.7)"; 
        this.previewCtx.lineWidth = 3;
        this.previewCtx.setLineDash([5, 5]);
        this.previewCtx.stroke();
        this.previewCtx.setLineDash([]);
    },
    
    // Çizimi bitir (Ana kanvasa gönder)
    finalizeDraw: function() {
        if (!this.state.isDrawing) return;

        // --- HATA AYIKLAMA BAŞLANGIÇ ---
        console.log("Pergel: finalizeDraw() çağrıldı. (Çizim bitti, kaydetmeye çalışıyor...)");

        
        const mainCanvas = document.querySelector('canvas');
        if (!mainCanvas) {
             console.error("Pergel HATASI: Ana <canvas> bulunamadı!");
             return; 
        }
        
        const rect = mainCanvas.getBoundingClientRect();

        // ANA KONTROL: app.js (motor) bulunabiliyor mu?
        if (window.drawnStrokes && window.redrawAllStrokes) {
            
            console.log("Pergel BAŞARILI: app.js motoru bulundu (drawnStrokes ve redrawAllStrokes OK).");

            // --- YENİ KOD BAŞLANGICI ---
            // Merkez noktası için bir etiket al
            const centerLabel = window.nextPointChar;
            window.nextPointChar = window.advanceChar(centerLabel);
            // --- YENİ KOD SONU ---

            window.drawnStrokes.push({
                type: 'arc',
                cx: this.startState.pivot.x - rect.left, // 'state' -> 'startState' olarak değişti
                cy: this.startState.pivot.y - rect.top, // 'state' -> 'startState' olarak değişti
                radius: this.state.radius,
                startAngle: this.state.startAngle, // Derece
                endAngle: this.state.rotation, // Derece (Birikmiş)
                color: window.isToolThemeBlack ? '#000000' : window.currentLineColor,
                width: 3,
                label: centerLabel // <- YENİ EKLENEN SATIR
            });
            
            console.log("Pergel: Çizim hafızaya (drawnStrokes) eklendi.");
            
            window.redrawAllStrokes(); 
            
            console.log("Pergel: redrawAllStrokes() çağrıldı. Çizimin şimdi görünmesi lazım.");
            
        } else {
            // SORUN %99 BURADA
            console.error("Pergel KRİTİK HATA: app.js motoru bulunamadı!");
            console.log("window.drawnStrokes şu anda:", window.drawnStrokes);
            console.log("window.redrawAllStrokes şu anda:", window.redrawAllStrokes);
            console.error("Lütfen app.js dosyasının HTML'de pergel.js'den ÖNCE yüklendiğinden emin olun!");
        }
        // --- HATA AYIKLAMA SONU ---
    }
};

// Aracı hemen başlat
window.PergelTool.init();