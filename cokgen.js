// --- cokgen.js (Çokgen Aracı Mantığı) ---

window.PolygonTool = {
    // --- TEMEL DURUM ---
    toolElement: null, // Kanvas üzerine eklenen çokgenin ana taşıyıcısı (gerekirse)
    
    // Geçici çizim durumu
    state: {
        x: 0, 
        y: 0, 
        sideCount: 0, // Kaç kenarlı (3, 4, 5, 6, 7 veya 0=Çember)
        radius: 0,    // Köşe noktasına olan uzaklık (Poligonlar için) veya Yarıçap (Çember için)
        angle: 0,     // Döndürme açısı (derece)
        isDrawing: false, // İlk tıklama yapıldı mı?
        isDrawingCircle: false, // Çember çiziminde merkez tıklandı mı?
    },
    
    // Etkileşim durumu
    interactionMode: 'none', // 'dragging', 'rotating', 'resizing'
    startPos: { x: 0, y: 0 },
    startState: {}, 
    
    // --- SABİTLER ---
    PI_VALUE: 3, // Hesaplamalar için sabit Pi değeri
    PIXELS_PER_CM: 30, // cm hesaplaması için (app.js ile uyumlu)
    
    // --- ÇOKGEN NOKTALARI VE HESAPLAMA ---
    
    // Merkez (Center), Köşe (Vertex) koordinatlarını hesaplar
    calculateVertices: function(center, radius, sideCount, angle) {
        const vertices = [];
        const rotationRad = angle * (Math.PI / 180);
        
        for (let i = 0; i < sideCount; i++) {
            // Düzgün çokgenler için her köşe arasındaki açı (dış açı)
            const angleRad = (i * 2 * Math.PI / sideCount) + rotationRad;
            
            vertices.push({
                x: center.x + radius * Math.cos(angleRad),
                y: center.y + radius * Math.sin(angleRad)
            });
        }
        return vertices;
    },
    
    // --- ÇİZİM MANTIKLARI (app.js'e gönderilecek) ---
    
    // Geçici önizlemeyi çizer (Şu an kullanılmıyor, app.js mousemove'da yapılabilir)
    drawPreview: function(pos) {
        // Bu kısım boş bırakıldı, app.js'in mousemove'u ile uyum sağlaması için
    },

    // Kalıcı çizimi başlatır/sonlandırır
    handleDrawClick: function(pos, type) {
        
        // Temizliği garanti et
        this.state.isDrawing = false;
        // this.state.isDrawingCircle = false; // (Bu satırın SİLİNMİŞ olduğundan emin ol)
        this.tempPoints = [];
        
        // Çokgen tipini ayarla
        this.state.sideCount = type; 
        
        // Geçici noktaları tut (Merkezi 'null' olarak başlat)
        window.tempPolygonData = {
            center: null, // <-- KRİTİK DÜZELTME: 'pos' DEĞİL, 'null'
            type: type,
            color: window.currentLineColor,
        };
    },
    
    // Çizimi tamamlar ve app.js'e kaydeder (Çember ve Düzgün Çokgenler için 2. Tıklama)
    finalizeDraw: function(radius, rotation) { 
        if (!window.tempPolygonData) return;
        
        const center = window.tempPolygonData.center;
        const type = window.tempPolygonData.type; 
        
        if (radius < 5) {
             this.state.isDrawing = false;
             window.tempPolygonData = null;
             return; 
        }

        const mainCanvas = document.querySelector('canvas');
        const rect = mainCanvas.getBoundingClientRect();
        
        const centerOnCanvas = {
            x: center.x - rect.left,
            y: center.y - rect.top
        };
        
        if (window.drawnStrokes && window.redrawAllStrokes) {
            
            const centerLabel = window.nextPointChar;
            window.nextPointChar = window.advanceChar(centerLabel);

            window.drawnStrokes.push({
                type: 'polygon',
                subType: 'regular',
                sideCount: type,
                center: centerOnCanvas,
                radius: radius, 
                rotation: rotation, 
                color: window.currentLineColor, // <-- KRİTİK EKLENTİ (Renk)
                width: 3, // <-- KRİTİK EKLENTİ (Kalınlık)
                fillColor: 'rgba(0, 0, 0, 0.2)', 
                label: centerLabel
            });
            
            window.redrawAllStrokes();
        }
        
        this.state.isDrawing = false;
        window.tempPolygonData = null;
    },
    
    // Çember çizimini tamamlar (2. Tıklama)
    finalizeCircle: function(radius) { 
        if (!window.tempPolygonData) return;
        
        const center = window.tempPolygonData.center;

        if (radius < 5) {
             
             window.tempPolygonData = null;
             return; 
        }

        const mainCanvas = document.querySelector('canvas');
        const rect = mainCanvas.getBoundingClientRect();
        
        const centerOnCanvas = {
            x: center.x - rect.left,
            y: center.y - rect.top
        };
        
        if (window.drawnStrokes && window.redrawAllStrokes) {
            const centerLabel = window.nextPointChar;
            window.nextPointChar = window.advanceChar(centerLabel);
            
            window.drawnStrokes.push({
                type: 'arc', 
                cx: centerOnCanvas.x,
                cy: centerOnCanvas.y,
                radius: radius, 
                startAngle: 0,
                endAngle: 359.99, 
                color: window.currentLineColor, // <-- KRİTİK EKLENTİ (Renk)
                width: 3, // <-- KRİTİK EKLENTİ (Kalınlık)
                label: centerLabel
            });
            
            window.redrawAllStrokes();
        }
       
        window.tempPolygonData = null;
    },
    
// Bir çokgenin DÖNDÜRME tutamacının yerini hesaplar
    getRotateHandlePosition: function(polygon) {
        // Döndürme tutamacını, "merkez" ile "ilk köşe" arasına, yarıçaptan biraz DIŞARI koy
        const radius = polygon.radius + 25; // Merkezden 25px dışarı
        const angleRad = polygon.rotation * (Math.PI / 180); // Çokgenin mevcut açısı
        
        return {
            x: polygon.center.x + radius * Math.cos(angleRad),
            y: polygon.center.y + radius * Math.sin(angleRad)
        };
    },

    // Bir çokgenin BOYUTLANDIRMA tutamacının yerini hesaplar (ilk köşe)
    getResizeHandlePosition: function(polygon) {
        if (!polygon.vertices || polygon.vertices.length === 0) {
            // Eğer köşe hesaplanmadıysa, geçici olarak hesapla
            polygon.vertices = this.calculateVertices(polygon.center, polygon.radius, polygon.sideCount, polygon.rotation);
        }
        // 'vertices' dizisinin varlığını ve boş olmadığını tekrar kontrol et
        if (polygon.vertices && polygon.vertices.length > 0) {
             return polygon.vertices[0]; // İlk köşeyi döndür
        }
        // Acil durum (Eğer vertices hala tanımsızsa)
        return polygon.center; 
    },

getRotateHandlePosition: function(polygon) {
        // Döndürme tutamacını, "merkez" ile "ilk köşe" arasına, yarıçaptan biraz DIŞARI koy
        const radius = polygon.radius + 25; // Merkezden 25px dışarı
        const angleRad = polygon.rotation * (Math.PI / 180); // Çokgenin mevcut açısı
        
        return {
            x: polygon.center.x + radius * Math.cos(angleRad),
            y: polygon.center.y + radius * Math.sin(angleRad)
        };
    },

    // Bir çokgenin BOYUTLANDIRMA tutamacının yerini hesaplar (ilk köşe)
    getResizeHandlePosition: function(polygon) {
        if (!polygon.vertices || polygon.vertices.length === 0) {
            // Eğer köşe hesaplanmadıysa, geçici olarak hesapla
            polygon.vertices = this.calculateVertices(polygon.center, polygon.radius, polygon.sideCount, polygon.rotation);
        }
        // 'vertices' dizisinin varlığını ve boş olmadığını tekrar kontrol et
        if (polygon.vertices && polygon.vertices.length > 0) {
             return polygon.vertices[0]; // İlk köşeyi döndür
        }
        // Acil durum (Eğer vertices hala tanımsızsa)
        return polygon.center; 
    },

// 1. ÇEMBER HESAPLAMALARI (Pi = 3)
    getCircleInfo: function(radius) {
        const r_cm = (radius / (this.PIXELS_PER_CM || 30)).toFixed(1);
        
        // Çevre = 2 * pi * r
        const circumference = (2 * this.PI_VALUE * r_cm).toFixed(1); 
        // Alan = pi * r^2
        const area = (this.PI_VALUE * r_cm * r_cm).toFixed(1);
        
        return `Yarıçap: ${r_cm} cm\nÇevre: ${circumference} cm\nAlan: ${area} cm²`;
    },

    // 2. KENAR UZUNLUĞU HESAPLAMA
    getEdgeLength: function(v1, v2) {
        const dist_px = Math.sqrt(Math.pow(v1.x - v2.x, 2) + Math.pow(v1.y - v2.y, 2));
        const dist_cm = (dist_px / (this.PIXELS_PER_CM || 30)).toFixed(1);
        return `${dist_cm} cm`;
    },

    // 3. İÇ AÇI HESAPLAMA
    getInternalAngle: function(sideCount) {
        if (sideCount < 3) return "0°";
        const angle = ((sideCount - 2) * 180) / sideCount;
        return `${angle.toFixed(0)}°`;
    }

   };
// Araç kullanıma hazır olana kadar başlatma
// init() fonksiyonu şu an için gerekli değil, doğrudan mantığı app.js'e entegre edeceğiz.