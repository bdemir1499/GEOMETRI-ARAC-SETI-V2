// --- pergel.js (Referans Dondurma ile Zıplamayan Nihai Sürüm) ---

window.PergelTool = {
    // HTML Elementleri
    pergelElement: null,
    handleTop: null,
    needleTip: null,
    penTip: null,
    penResizeHandle: null, 
    leftLeg: null,
    rightLeg: null,
    radiusLabel: null, 
    scaleHandle: null,
    
    // Önizleme Kanvası
    previewCanvas: null,
    previewCtx: null,

    // GÖRSEL SABİTLER 
    LEG_LENGTH_PX: 239, 
    JOINT_OFFSET_Y_PERCENT: 0.08, 

    // Durum (State)
    state: {
        pivot: { x: 400, y: 300 }, 
        radius: 100, 
        rotation: 0, 
        isDrawing: false,
        startDrawAngle: 0, 
        previousDrawAngle: 0,
        isFlipped: false,
        lastTapTime: 0
    },

    // Etkileşim
    interactionMode: 'none', 
    startPos: { x: 0, y: 0 },
    startState: {},
    activeRect: null, // Kanvas konumunu dondurmak için

    // --- 1. BAŞLATMA ---
    init: function() {
        this.pergelElement = document.getElementById("compass-container");
        if (!this.pergelElement) {
            console.error("Pergel HTML'i bulunamadı!");
            return;
        }

        this.handleTop = this.pergelElement.querySelector(".handle-top");
        this.needleTip = this.pergelElement.querySelector(".needle-tip");
        this.penTip = this.pergelElement.querySelector(".pen-tip");
        this.penResizeHandle = this.pergelElement.querySelector(".pen-resize-handle"); 
        this.leftLeg = this.pergelElement.querySelector(".left-leg");
        this.rightLeg = this.pergelElement.querySelector(".right-leg");

        this.scaleHandle = document.createElement('div');
        this.scaleHandle.className = 'pergel-scale-handle';
        this.pergelElement.appendChild(this.scaleHandle);

        if (!this.handleTop || !this.needleTip || !this.penTip || !this.penResizeHandle || !this.leftLeg || !this.rightLeg) { 
            console.error("Pergel HTML parçaları bulunamadı!");
            return;
        }

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

        this.previewCanvas = document.createElement('canvas');
        this.previewCanvas.className = 'pergel-preview-canvas';
        this.previewCanvas.style.position = 'fixed';
        this.previewCanvas.style.top = '0';
        this.previewCanvas.style.left = '0';
        this.previewCanvas.style.pointerEvents = 'none';
        this.previewCanvas.style.zIndex = '100'; 
        document.body.appendChild(this.previewCanvas);
        
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.previewCanvas.style.display = 'none'; 

        this.addListeners();
        this.updateTransform();
    },

    toggle: function() {
        if (!this.pergelElement) this.init();
        if (!this.pergelElement) return;
        const isHidden = this.pergelElement.classList.contains('hidden');
        isHidden ? this.show() : this.hide();
    },

    show: function() {
        if (!this.pergelElement) this.init();
        this.pergelElement.classList.remove('hidden');
        this.state.pivot = { x: window.innerWidth / 2 - 50, y: window.innerHeight / 2 };
        this.state.radius = 100;
        this.state.rotation = 0;
        this.state.previousDrawAngle = 0; 
        this.updateTransform();
    },

    hide: function() {
        if (!this.pergelElement) return;
        this.pergelElement.classList.add('hidden');
    },
    
    getPointerPos: function(e) {
        return { x: e.clientX, y: e.clientY };
    },

    addListeners: function() {
        const boundPointerDown = this.onPointerDown.bind(this);
        const parts = [this.needleTip, this.leftLeg, this.rightLeg, this.penTip, this.penResizeHandle, this.handleTop, this.scaleHandle];

        parts.forEach(part => {
            if (part) part.addEventListener('pointerdown', boundPointerDown);
        });
        
        if (this.handleTop) {
            this.handleTop.addEventListener('dblclick', this.onFlip.bind(this));
        }

        window.addEventListener('pointermove', this.onPointerMove.bind(this), { passive: false });
        window.addEventListener('pointerup', this.onPointerUp.bind(this), { passive: false });
        window.addEventListener('pointercancel', this.onPointerUp.bind(this));
    },

    // --- 2. DOKUNMA BAŞLANGICI (REFERANSI DONDURUYORUZ) ---
    onPointerDown: function(e) {
        if (e.pointerType === 'touch') e.preventDefault(); 
        e.stopPropagation();
        
        const target = e.target;

        if (target.setPointerCapture) target.setPointerCapture(e.pointerId);

        // --- 1. TABLET İÇİN ÇİFT TIKLAMA ALGILAYICI ---
        if (target === this.handleTop) {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - (this.state.lastTapTime || 0);
            if (tapLength < 400 && tapLength > 0) {
                this.onFlip(e); 
                this.state.lastTapTime = 0; 
                return; 
            }
            this.state.lastTapTime = currentTime;
        }

        if (window.currentTool === 'eraser') {
            window.isDrawing = false; 
            if (window.setActiveTool) window.setActiveTool('none'); 
        }

        this.state.isDrawing = false; 
        if (window.bringToolToFront) window.bringToolToFront(this.pergelElement);
        
        this.startPos = this.getPointerPos(e);
        this.startState = JSON.parse(JSON.stringify(this.state)); 

// 👇👇👇 EKLENECEK KISIM BURASI 👇👇👇
        // Dokunmanın başladığı an kanvasın konumunu dondur ve kaydet
        const mainCanvas = document.getElementById('drawing-canvas');
        this.activeRect = mainCanvas ? mainCanvas.getBoundingClientRect() : { left: 0, top: 0 };
        // 👆👆👆 ----------------------- 👆👆👆

        if (target === this.scaleHandle) {
            this.interactionMode = 'scaling_tool'; 
            this.startState.width = this.pergelElement.offsetWidth;
            this.startState.height = this.pergelElement.offsetHeight;
        }
        else if (target === this.penResizeHandle) {
            this.interactionMode = 'resizing';
            if (this.radiusLabel) this.radiusLabel.style.display = 'block';
        } 
        else if (target === this.handleTop) { 
            if (window.audio_draw) window.audio_draw.play(); 
            this.interactionMode = 'drawing';
            this.state.isDrawing = true; 
            const currPos = this.getPointerPos(e);
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
        }
        else if (target === this.needleTip || target === this.penTip || target === this.leftLeg || target === this.rightLeg) {
            this.interactionMode = 'dragging';
            this.startState.containerX = parseFloat(this.pergelElement.style.left || 0);
            this.startState.containerY = parseFloat(this.pergelElement.style.top || 0);
        }
    },

    onPointerMove: function(e) {
        if (this.interactionMode === 'none') return; 
        if (!e.isPrimary) return; 
        
        const currPos = this.getPointerPos(e);
        const dx = currPos.x - this.startPos.x;
        const dy = currPos.y - this.startPos.y;

        switch (this.interactionMode) {
            case 'scaling_tool':
                let newHeight = this.startState.height - dy; 
                if (newHeight < 200) newHeight = 200; 
                this.pergelElement.style.width = `${newHeight * 0.8}px`;
                this.pergelElement.style.height = `${newHeight}px`;
                this.updateTransform(); 
                break;
            case 'dragging':
                this.state.pivot.x = this.startState.pivot.x + dx;
                this.state.pivot.y = this.startState.pivot.y + dy;
                this.pergelElement.style.left = `${this.startState.containerX + dx}px`;
                this.pergelElement.style.top = `${this.startState.containerY + dy}px`;
                break;
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
            case 'drawing':
                const d_dx = currPos.x - this.state.pivot.x;
                const d_dy = currPos.y - this.state.pivot.y;
                let current_raw_angle = Math.atan2(d_dy, d_dx) * 180 / Math.PI;
                let delta = current_raw_angle - this.state.previousDrawAngle;
                if (delta > 180) delta -= 360; 
                else if (delta < -180) delta += 360;
                this.state.rotation += delta;
                this.state.previousDrawAngle = current_raw_angle; 
                this.updateTransform();
                this.drawPreviewArc(); 
                break;
        }
    },

    // --- BIRAKMA VE BİTİRME (ZIPLAMA VE TİTREME SAVAR) ---
    onPointerUp: function(e) {
        if (this.interactionMode === 'none') return;

        // 1. Kilidi kaldır (Parmağı serbest bırak)
        if (e.target && e.target.releasePointerCapture) {
             try { e.target.releasePointerCapture(e.pointerId); } catch(err) {}
        }

        // 2. Eğer çizim yapılıyorsa mühürle
        if (this.interactionMode === 'drawing') {
            if (window.audio_draw) { 
                window.audio_draw.pause(); 
                window.audio_draw.currentTime = 0; 
            }

            // --- SON POZİSYON GÜVENLİĞİ ---
            // finalizeDraw fonksiyonuna girdiğimizde, fonksiyon zaten en son 
            // 'onPointerMove' anında kaydedilen 'this.state.rotation' 
            // ve 'this.state.radius' değerlerini kullanacaktır.
            this.finalizeDraw();
            
            // Çizim durumunu mühürleme bittikten sonra kapatıyoruz
            this.state.isDrawing = false;
            
            // Görsel temizlik (50ms gecikme tabletteki görsel takılmaları engeller)
            setTimeout(() => {
                if (this.previewCanvas) this.previewCanvas.style.display = 'none';
                if (this.previewCtx) {
                    this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
                }
            }, 50); 
        }

        // 3. Boyutlandırma etiketini temizle
        if (this.interactionMode === 'resizing') {
            if (this.radiusLabel) this.radiusLabel.style.display = 'none';
        }
        
        this.interactionMode = 'none';
    },

    onFlip: function(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }

// --- 2. KESİN ÇÖZÜM: 500ms KORUMA KALKANI (COOLDOWN) ---
        const now = new Date().getTime();
        if (this.lastFlipTime && now - this.lastFlipTime < 500) return; 
        this.lastFlipTime = now;
        // -------------------------------------------------------

        this.state.isDrawing = false;
        this.interactionMode = 'none';
        if (window.audio_draw) { window.audio_draw.pause(); window.audio_draw.currentTime = 0; }
        if (this.previewCtx) this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        this.state.isFlipped = !this.state.isFlipped;
        if (this.state.isFlipped) {
            this.leftLeg.appendChild(this.penTip); this.leftLeg.appendChild(this.penResizeHandle);
            this.rightLeg.appendChild(this.needleTip);
        } else {
            this.leftLeg.appendChild(this.needleTip);
            this.rightLeg.appendChild(this.penTip); this.rightLeg.appendChild(this.penResizeHandle);
        }
        const PI_RAD = Math.PI / 180;
        const oldPen = {
            x: this.state.pivot.x + this.state.radius * Math.cos(this.state.rotation * PI_RAD),
            y: this.state.pivot.y + this.state.radius * Math.sin(this.state.rotation * PI_RAD)
        };
        this.state.pivot = oldPen; 
        this.state.rotation = (this.state.rotation + 180) % 360; 
        this.state.previousDrawAngle = this.state.rotation;
        this.state.startAngle = this.state.rotation;
        this.updateTransform();
    },

    updateTransform: function() {
        if (!this.pergelElement) return;
        const PI_RAD = Math.PI / 180;
        const pivot = this.state.pivot;
        const containerHeight = this.pergelElement.offsetHeight;
        const L = containerHeight * 0.8; 
        const pen = {
            x: pivot.x + this.state.radius * Math.cos(this.state.rotation * PI_RAD),
            y: pivot.y + this.state.radius * Math.sin(this.state.rotation * PI_RAD)
        };
        let R = this.state.radius;
        if (R > L * 2) { R = L * 2; this.state.radius = R; }
        const h = Math.sqrt(Math.max(0, L * L - (R / 2) * (R / 2)));
        const M = { x: (pivot.x + pen.x) / 2, y: (pivot.y + pen.y) / 2 };
        const v_dx = (R === 0) ? 0 : (pen.x - pivot.x) / R;
        const v_dy = (R === 0) ? 0 : (pen.y - pivot.y) / R;
        let v_perp_x = v_dy; let v_perp_y = -v_dx;
        if (v_dx < 0) { v_perp_x = -v_perp_x; v_perp_y = -v_perp_y; }
        const joint = { x: M.x + v_perp_x * h, y: M.y + v_perp_y * h };
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
        this.pergelElement.style.left = `${joint.x - (this.pergelElement.offsetWidth / 2)}px`;
        this.pergelElement.style.top = `${joint.y - (containerHeight * this.JOINT_OFFSET_Y_PERCENT)}px`;
        this.pergelElement.style.transform = 'none'; 
    },
    
    drawPreviewArc: function() {
        if (!this.previewCtx) return; 
        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        this.previewCtx.beginPath();
        this.previewCtx.arc(this.state.pivot.x, this.state.pivot.y, this.state.radius, this.state.startAngle * (Math.PI / 180), this.state.rotation * (Math.PI / 180), false);
        this.previewCtx.strokeStyle = "rgba(255, 0, 255, 0.7)"; this.previewCtx.lineWidth = 3; this.previewCtx.stroke();
    },
    
   // --- 3. FİNAL ÇİZİM (CANLI REFERANS KULLANAN KISIM) ---
    finalizeDraw: function() {
        if (!this.state.isDrawing) return;

        // --- HARF YIĞILMASI / ÇİFT TIKLAMA HATASI ÇÖZÜMÜ ---
        // Eğer pergelin tepesine sadece tıklandıysa (hiç döndürülüp çizim yapılmadıysa)
        // boşuna harf atamasını ve görünmez çember çizmesini tamamen engeller!
        if (Math.abs(this.state.rotation - this.state.startAngle) < 0.5) {
            this.state.isDrawing = false;
            return;
        }

        const mainCanvas = document.getElementById('drawing-canvas');
        const rect = mainCanvas ? mainCanvas.getBoundingClientRect() : { left: 0, top: 0, width: 1, height: 1 };

        // --- KESİN ÇÖZÜM: KANVAS ESNEME (SCALE) ÇARPANI ---
        const scaleX = mainCanvas ? (mainCanvas.width / (rect.width || 1)) : 1;
        const scaleY = mainCanvas ? (mainCanvas.height / (rect.height || 1)) : 1;
        
        // Yarıçap (radius) için x ve y esnemelerinin ortalamasını alıyoruz
        const scaleAvg = (scaleX + scaleY) / 2;

        if (window.drawnStrokes && window.redrawAllStrokes) {
            const centerLabel = window.nextPointChar;
            window.nextPointChar = window.advanceChar(centerLabel);

            window.drawnStrokes.push({
                type: 'arc',
                // Esneme (Scale) çarpanı ile %100 nokta atışı koordinat
                cx: (this.state.pivot.x - rect.left) * scaleX, 
                cy: (this.state.pivot.y - rect.top) * scaleY, 
                radius: this.state.radius * scaleAvg,
                startAngle: this.state.startAngle, 
                endAngle: this.state.rotation, 
                color: window.isToolThemeBlack ? '#000000' : window.currentLineColor,
                width: 3,
                label: centerLabel 
            });
            
            window.redrawAllStrokes(); 
        }
    }
};

window.PergelTool.init();