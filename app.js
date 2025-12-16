// --- app.js EN ÜST SATIRI ---

// 1. Hareket Geçmişi (Buffer) - Zıplama Önleyici
window.touchHistoryBuffer = [];
window.lastSafeDrawPos = { x: 0, y: 0 };

// 2. Touch Move Kaydedici
document.addEventListener('touchmove', function(e) {
    if (e.touches.length === 1) {
        window.lastSafeDrawPos = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        };
    }
}, { passive: false });

// 3. TABLET/MOBİL SIÇRAMA ENGELLEYİCİ (AKILLI VERSİYON)
let lastTouchTime = 0;

// A) Dokunma Bitişini Kaydet
document.addEventListener('touchend', function(e) {
    lastTouchTime = new Date().getTime();
    
    // Tutamaçlarda varsayılanı engelle (Zıplamayı keser)
    if(e.target.closest('.draw-handle, .rotate-handle, .resize-handle')) {
        e.preventDefault(); 
    }
}, { passive: false });

// B) Tıklama Filtresi Fonksiyonu
const clickBlocker = function(e) {
    const timeSinceTouch = new Date().getTime() - lastTouchTime;
    
    // Eğer son 500ms içinde dokunmatik işlem yapıldıysa:
    if (timeSinceTouch < 500 && timeSinceTouch > 0) {
        
        // İZİN VERİLECEKLER LİSTESİ:
        // Butonlar, Araçlar, Renk Kutuları, Inputlar, Etiketler, Linkler
        if (e.target.closest('button, .tool-btn, input, label, a, .pwa-btn, .color-box')) {
            return; // İzin ver, engelleme
        }

        // Geri kalan her şeyi (Canvas tıklamaları vb.) engelle
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
};

// C) Filtreyi Uygula
document.addEventListener('click', clickBlocker, true);
document.addEventListener('mousedown', clickBlocker, true);

// 4. CSS İyileştirmesi
const style = document.createElement('style');
style.innerHTML = `
    button, .tool-btn, .pwa-btn, a, .color-box {
        touch-action: manipulation;
        cursor: pointer;
    }
`;
document.head.appendChild(style);

// -------------------------------------------------------------


// --- KANVAS AYARLARI ---
const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');
// --- RESİM YÜKLEME DEĞİŞKENLERİ ---
let backgroundImage = null; // Yüklenen resmi tutacak değişken
const uploadButton = document.getElementById('btn-upload');
const fileInput = document.getElementById('file-input');

// --- app.js (DÜZELTİLMİŞ BAŞLANGIÇ BÖLÜMÜ) ---

// --- SESLER (TÜMÜ İPTAL EDİLDİ / SESSİZ MOD) ---
// Gerçek ses dosyaları yerine, hiçbir iş yapmayan "sahte" bir oynatıcı tanımlıyoruz.
// Bu sayede alt satırlardaki hiçbir kodu silmenize gerek kalmaz, hepsi sessizce çalışır.

const silentAudio = { 
    play: function() {},   // Çal komutu gelirse: Hiçbir şey yapma.
    pause: function() {},  // Durdur komutu gelirse: Hiçbir şey yapma.
    currentTime: 0,        // Süre ayarı gelirse: Kabul et ama işleme.
    src: "" 
};

window.audio_click = silentAudio;
let audio_click_src_set = true; // Hata vermemesi için "ayarlandı" sayıyoruz.
window.audio_undo = silentAudio;
window.audio_draw = silentAudio;
window.audio_eraser = silentAudio;


// --- DEĞİŞKENLER ---
let isDrawing = false; 
let snapshotStart = null; 
const animateButton = document.getElementById('btn-animate');
let currentTool = 'none'; 
let isPinching = false;           // İki parmakla yakınlaştırma aktif mi?
let initialDistance = 0;          // Başlangıç parmak mesafesi (zoom için)
let initialScale = 0;             // Başlangıçta seçili nesnenin genişliği
let initialCenter = { x: 0, y:  0 }; // İki parmağın merkez noktası (pan için)
let currentPenColor = '#FFFFFF'; 
let currentPenWidth = 4;
window.currentLineColor = '#FFFFFF'; // Varsayılan Renk: BEYAZ
const SNAP_THRESHOLD = 10;
let returnToSnapshot = false; // İşlem bitince geri dönülecek mi? 

let drawnStrokes = []; 
window.drawnStrokes = drawnStrokes;
let nextPointChar = 'A'; 
window.nextPointChar = nextPointChar;

let lineStartPoint = null; 
let currentMousePos = { x: 0, y: 0 }; 
let snapTarget = null; 
let snapHoverTimer = null;

window.tempPolygonData = null; 

let isDrawingLine = false; 
let isDrawingInfinityLine = false; 
let isDrawingSegment = false; 
let isDrawingRay = false; 
let isMoving = false;         
let selectedItem = null;      
let selectedPointKey = null;  
let rotationPivot = null;     
let dragStartPos = { x: 0, y: 0 }; 
let originalStartPos = {};
let currentPDF = null;       // Yüklenen PDF dosyası
let currentPDFPage = 1;      // Şu anki sayfa
let totalPDFPages = 0;       // Toplam sayfa
let pdfImageStroke = null;   // Ekrana çizilen PDF sayfası

// --- HTML ELEMENTLERİ ---
const body = document.body;

// 1. Sol Panel Araçları
const penButton = document.getElementById('btn-kalem');
const eraserButton = document.getElementById('btn-silgi');
const lineButton = document.getElementById('btn-cizgi');
const rulerButton = document.getElementById('btn-cetvel');
const gonyeButton = document.getElementById('btn-gonye');
const aciolcerButton = document.getElementById('btn-aciolcer');
const pergelButton = document.getElementById('btn-pergel');
const polygonButton = document.getElementById('btn-cokgenler');
const oyunlarButton = document.getElementById('btn-oyunlar');

// 2. Alt Menü Butonları ve Seçenekler
const penOptions = document.getElementById('pen-options');
const colorBoxes = document.querySelectorAll('#pen-options .color-box');
const lineOptions = document.getElementById('line-options');
const pointButton = document.getElementById('btn-nokta');
const straightLineButton = document.getElementById('btn-d_cizgi');
const infinityLineButton = document.getElementById('btn-dogru');
const segmentButton = document.getElementById('btn-dogru_parcasi');
const rayButton = document.getElementById('btn-isin');
const lineColorOptions = document.querySelectorAll('#line-color-options .color-box');
const polygonOptions = document.getElementById('polygon-options');
const polygonPreviewLabel = document.getElementById('polygon-preview-label');
const circleButton = document.getElementById('btn-cember');
const regularPolygonButtons = document.querySelectorAll('#polygon-options button[data-sides]');
const polygonColorOptions = document.querySelectorAll('#polygon-color-options .color-box');
const oyunlarOptions = document.getElementById('oyunlar-options');

// 3. Sağ Panel Araçları
const undoButton = document.getElementById('btn-undo');
const clearAllButton = document.getElementById('btn-clear-all');
const moveButton = document.getElementById('btn-move');
const fillButton = document.getElementById('btn-fill');
const fillOptions = document.getElementById('fill-options');
const fillColorBoxes = document.querySelectorAll('#fill-options .color-box');
let currentFillColor = '#FF69B4';

// 4. Resim ve PDF Yükleme Araçları


const pdfControls = document.getElementById('pdf-controls');
const pageCountLabel = document.getElementById('page-count-label');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');




// --- GÖRSEL YARDIMCILAR ---
const snapIndicator = document.createElement('div');
snapIndicator.id = 'snap-indicator';
body.appendChild(snapIndicator);
const eraserPreview = document.createElement('div');
eraserPreview.className = 'eraser-cursor-preview';
body.appendChild(eraserPreview);


// --- YARDIMCI FONKSİYONLAR ---

function distance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function advanceChar(char) {
    let charCode = char.charCodeAt(0) + 1;
    if (charCode > 90) charCode = 65; 
    return String.fromCharCode(charCode);
}

function findSnapPoint(pos) {
    for (const stroke of drawnStrokes) {
        if (stroke.type === 'point') {
            if (distance(pos, stroke) < SNAP_THRESHOLD) return { x: stroke.x, y: stroke.y }; 
        } else if (stroke.type === 'straightLine' || stroke.type === 'segment') { 
            if (distance(pos, stroke.p1) < SNAP_THRESHOLD) return stroke.p1;
            if (distance(pos, stroke.p2) < SNAP_THRESHOLD) return stroke.p2;
        }
    }
    return null; 
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    redrawAllStrokes();
}

// --- app.js ---

function getEventPosition(e) {
    // DÜZELTME: Parmak kalkarken (touchend) yeni hesap yapma, son konumu kullan (Zıplamayı Önler)
    if (e.type === 'touchend' || e.type === 'touchcancel') return currentMousePos;

    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;

    // Dokunmatik ve Mouse ayrımı
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    // 2. HASSAS HESAPLAMA (ÖLÇEK DÜZELTMELİ)
    // (Tıklanan Yer - Canvas Başlangıcı) * (İç Çözünürlük / Görsel Boyut)
    return { 
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
    };
}
function drawDot(pos, color = '#00FFCC') {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 5, 0, 2 * Math.PI); 
    ctx.fillStyle = color;
    ctx.fill();
}

function drawLabel(text, pos, color = '#FF69B4') {
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = color; 
    ctx.fillText(text, pos.x + 8, pos.y + 5);
}

function drawInfinityLine(p1, p2, color, width, isRay = false) {
    const INFINITY = 5000;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag === 0) return { ux: 0, uy: 0 }; 
    const ux = dx / mag;
    const uy = dy / mag;
    const drawP1 = isRay ? p1 : { x: p1.x - ux * INFINITY, y: p1.y - uy * INFINITY };
    const drawP2 = { x: p1.x + ux * INFINITY, y: p1.y + uy * INFINITY };
    ctx.beginPath();
    ctx.moveTo(drawP1.x, drawP1.y);
    ctx.lineTo(drawP2.x, drawP2.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    return { ux, uy }; 
}

window.bringToolToFront = function(clickedElement) {
    const tools = [
        window.RulerTool ? window.RulerTool.rulerElement : null,
        window.GonyeTool ? window.GonyeTool.gonyeElement : null,
        window.AciolcerTool ? window.AciolcerTool.aciolcerElement : null,
        window.PergelTool ? window.PergelTool.pergelElement : null
    ];
    tools.forEach(tool => { if (tool) tool.style.zIndex = 5; });
    if (clickedElement) clickedElement.style.zIndex = 6;
}

// --- ÇİZİM FONKSİYONU (REDRAW) ---
function redrawAllStrokes() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    
    for (const stroke of drawnStrokes) {
        if (stroke.type === 'pen') {
            ctx.beginPath();
            
            const points = stroke.path;
            
            // Eğer nokta sayısı azsa (1 veya 2), düz çizgi yeterlidir
            if (points.length < 3) {
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
            } else {
                // --- YUMUŞATMA ALGORİTMASI (Quadratic Curve) ---
                
                // İlk noktaya git
                ctx.moveTo(points[0].x, points[0].y);
                
                // Noktalar arasında döngü kur (Son 2 nokta hariç)
                for (let i = 1; i < points.length - 2; i++) {
                    const xc = (points[i].x + points[i + 1].x) / 2; // İki noktanın ortası (Kontrol Noktası)
                    const yc = (points[i].y + points[i + 1].y) / 2;
                    
                    // Eğriyi çiz: Mevcut noktayı (points[i]) "bükme noktası" olarak kullan,
                    // orta noktaya (xc, yc) kadar çiz.
                    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
                }
                
                // Son kalan 2 noktayı kavisli olarak birleştir
                ctx.quadraticCurveTo(
                    points[points.length - 2].x,
                    points[points.length - 2].y,
                    points[points.length - 1].x,
                    points[points.length - 1].y
                );
            }

            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.width;
            ctx.lineCap = 'round'; 
            ctx.lineJoin = 'round';
            ctx.stroke();
        }

        if (stroke.type === 'image') {
            ctx.save(); // Ayarları kaydet
            
            // Resmin merkezine git ve gerekirse döndür
            ctx.translate(stroke.x, stroke.y); 
            ctx.rotate(stroke.rotation * Math.PI / 180);

            // Resmi Çiz (Merkezi ortalayarak)
            ctx.drawImage(stroke.img, -stroke.width / 2, -stroke.height / 2, stroke.width, stroke.height);
            
            // Eğer "Taşı" aracı seçiliyse etrafına kutu çiz
            if (currentTool === 'move' && selectedItem === stroke) {
                // Çerçeve
                ctx.strokeStyle = '#00FFCC';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(-stroke.width / 2, -stroke.height / 2, stroke.width, stroke.height);
                ctx.setLineDash([]);

                // Sağ Alt Köşeye "Boyutlandırma Tutamacı" (Resize Handle)
                ctx.beginPath();
                ctx.arc(stroke.width / 2, stroke.height / 2, 10, 0, 2 * Math.PI);
                ctx.fillStyle = '#FF00FF';
                ctx.fill();
                ctx.stroke();
            }
            ctx.restore(); // Ayarları geri yükle
        }        

        else if (stroke.type === 'point') {
            drawDot(stroke);
            drawLabel(stroke.label, stroke);
        }
        else if (stroke.type === 'straightLine') { 
            ctx.beginPath();
            ctx.moveTo(stroke.p1.x, stroke.p1.y);
            ctx.lineTo(stroke.p2.x, stroke.p2.y);
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.width;
            ctx.lineCap = 'round';
            ctx.stroke();
            if (stroke.lengthLabel) drawLabel(stroke.lengthLabel, stroke.lengthLabelPos, '#FFFF00');
        }
        else if (stroke.type === 'line') { 
            const { ux, uy } = drawInfinityLine(stroke.p1, stroke.p2, stroke.color, stroke.width, false);
            if (ux === 0 && uy === 0) continue;
            drawDot(stroke.p1, stroke.color);
            drawDot(stroke.p2, stroke.color);
            drawLabel(stroke.label1, stroke.p1, '#FF69B4');
            drawLabel(stroke.label2, stroke.p2, '#FF69B4');
        }
        else if (stroke.type === 'segment') { 
            ctx.beginPath();
            ctx.moveTo(stroke.p1.x, stroke.p1.y);
            ctx.lineTo(stroke.p2.x, stroke.p2.y);
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.width || 3; 
            ctx.lineCap = 'round';
            ctx.stroke();
            drawLabel(stroke.label1, stroke.p1, '#FF69B4'); 
            drawLabel(stroke.label2, stroke.p2, '#FF69B4');
            if (stroke.lengthLabel) drawLabel(stroke.lengthLabel, stroke.lengthLabelPos, '#FFFF00'); 
        }
        else if (stroke.type === 'ray') { 
            const { ux, uy } = drawInfinityLine(stroke.p1, stroke.p2, stroke.color, stroke.width, true); 
            if (ux === 0 && uy === 0) continue;
            drawDot(stroke.p1, stroke.color);
            drawDot(stroke.p2, stroke.color);
            drawLabel(stroke.label1, stroke.p1, '#FF69B4');
            drawLabel(stroke.label2, stroke.p2, '#FF69B4');
        }
        else if (stroke.type === 'polygon') {
            if (!window.PolygonTool || typeof window.PolygonTool.calculateVertices !== 'function') continue;
            const vertices = window.PolygonTool.calculateVertices(stroke.center, stroke.radius, stroke.sideCount, stroke.rotation);
            stroke.vertices = vertices; 

            if (vertices.length > 0) {
                ctx.beginPath();
                ctx.moveTo(vertices[0].x, vertices[0].y);
                for (let i = 1; i < vertices.length; i++) ctx.lineTo(vertices[i].x, vertices[i].y);
                ctx.closePath();
            }
            
            ctx.fillStyle = stroke.fillColor || 'rgba(0, 0, 0, 0.2)'; 
            ctx.fill();
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.width || 3; 
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.stroke();

            drawDot(stroke.center, stroke.color);
            drawLabel(stroke.label, stroke.center, '#FF69B4');
            vertices.forEach(v => drawDot(v, stroke.color));
            
            if (stroke.showEdgeLabels) {
                for (let j = 0; j < vertices.length; j++) {
                    const v1 = vertices[j];
                    const v2 = vertices[(j + 1) % vertices.length];
                    const midPoint = { x: (v1.x + v2.x) / 2, y: (v1.y + v2.y) / 2 };
                    const edgeLabel = window.PolygonTool.getEdgeLength(v1, v2);
                    drawLabel(edgeLabel, midPoint, '#FF69B4');
                }
            }
            if (stroke.showAngleLabels) {
                const angleLabel = window.PolygonTool.getInternalAngle(stroke.sideCount);
                const arcRadius = 25; 
                for (let j = 0; j < vertices.length; j++) {
                    const v_current = vertices[j];
                    const v_prev = vertices[j === 0 ? vertices.length - 1 : j - 1];
                    const v_next = vertices[(j + 1) % vertices.length];
                    const startAngle = Math.atan2(v_prev.y - v_current.y, v_prev.x - v_current.x);
                    const endAngle = Math.atan2(v_next.y - v_current.y, v_next.x - v_current.x);
                    ctx.beginPath();
                    ctx.arc(v_current.x, v_current.y, arcRadius, endAngle, startAngle);
                    ctx.strokeStyle = '#FFFF00'; ctx.lineWidth = 2; ctx.stroke();
                    const angle_label_x = (v_current.x * 0.8) + (stroke.center.x * 0.2); 
                    const angle_label_y = (v_current.y * 0.8) + (stroke.center.y * 0.2); 
                    drawLabel(angleLabel, {x: angle_label_x, y: angle_label_y}, '#FFFF00');
                }
            }
            if (currentTool === 'move' && selectedItem === stroke) {
                const rotateHandlePos = window.PolygonTool.getRotateHandlePosition(stroke);
                ctx.beginPath(); ctx.arc(rotateHandlePos.x, rotateHandlePos.y, 10, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(0, 255, 0, 0.8)'; ctx.fill(); ctx.strokeStyle = '#0F0'; ctx.lineWidth = 2; ctx.stroke();
                const resizeHandlePos = vertices.length > 0 ? vertices[0] : stroke.center; 
                ctx.beginPath(); ctx.arc(resizeHandlePos.x, resizeHandlePos.y, 8, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(255, 0, 255, 0.8)'; ctx.fill(); ctx.strokeStyle = '#F0F'; ctx.lineWidth = 2; ctx.stroke();
            }
        }
        else if (stroke.type === 'arc') { // ÇEMBER / PERGEL
            const PI_RAD = Math.PI / 180;
            let startRad = stroke.startAngle * PI_RAD;
            let endRad = stroke.endAngle * PI_RAD;
            const totalAngleDrawn = Math.abs(stroke.endAngle - stroke.startAngle);

            if (totalAngleDrawn >= 359) { startRad = 0; endRad = 2 * Math.PI; }

            ctx.beginPath();
            ctx.arc(stroke.cx, stroke.cy, stroke.radius, startRad, endRad, false);
            if (totalAngleDrawn >= 359) ctx.closePath(); 
            
            if (stroke.fillColor && stroke.fillColor !== 'transparent' && totalAngleDrawn >= 359) {
                 ctx.fillStyle = stroke.fillColor;
                 ctx.fill();
            }

            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.width || 3; 
            ctx.lineCap = 'round'; 
            ctx.stroke();

            const centerPos = { x: stroke.cx, y: stroke.cy };
            drawDot(centerPos, stroke.color);
            if (stroke.label) drawLabel(stroke.label, centerPos, '#FF69B4'); 
            
            if (stroke.showCircleInfo) {
                ctx.beginPath();
                ctx.moveTo(centerPos.x, centerPos.y);
                ctx.lineTo(centerPos.x + stroke.radius, centerPos.y);
                ctx.strokeStyle = '#FF69B4'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]); ctx.stroke(); ctx.setLineDash([]); 

                const PI = window.PolygonTool.PI_VALUE || 3;
                const r_px = stroke.radius;
                const r_cm_raw = (r_px / (window.PolygonTool.PIXELS_PER_CM || 30));
                const r_cm_calc = parseFloat(r_cm_raw.toFixed(2)); 
                const r_cm_str = r_cm_raw.toFixed(2).replace('.', ','); 
                const circ_str = (2 * PI * r_cm_calc).toFixed(2).replace('.', ','); 
                const area_str = (PI * r_cm_calc * r_cm_calc).toFixed(2).replace('.', ',');

                const r_label = `r = ${r_cm_str} cm`;
                drawLabel(r_label, {x: centerPos.x + (r_px / 2) - 20, y: centerPos.y - 10}, '#FFFF00'); 
                let labelY = centerPos.y - 20;
                const labelX = centerPos.x + r_px + 10; 
                drawLabel(`Ç = 2 . π . r`, {x: labelX, y: labelY}, '#FFFF00'); labelY += 20; 
                drawLabel(`= 2 . ${PI} . ${r_cm_str} = ${circ_str} cm`, {x: labelX, y: labelY}, '#FFFF00'); labelY += 25; 
                drawLabel(`A = π . r²`, {x: labelX, y: labelY}, '#FFFF00'); labelY += 20;
                drawLabel(`= ${PI} . ${r_cm_str}² = ${area_str} cm²`, {x: labelX, y: labelY}, '#FFFF00'); labelY += 25; 
                drawLabel(`(π = ${PI} alındı)`, {x: labelX, y: labelY}, '#AAAAAA'); 
            }
        }
    } 
}

function undoLastStroke() {
    if (drawnStrokes.length > 0) {
        if (window.audio_undo) { window.audio_undo.currentTime = 0; window.audio_undo.play(); }
        drawnStrokes.pop(); 
        redrawAllStrokes(); 
    }
}

function clearAllStrokes() {
    if (drawnStrokes.length > 0) {
        if (window.audio_clear) window.audio_clear.play(); // Varsa ses
    }
    // --- DEĞİŞİKLİK BURADA: Sadece arka plan OLMAYANLARI temizle ---
    // Eğer stroke.isBackground true ise (PDF veya Resim), onu tut.
    drawnStrokes = drawnStrokes.filter(stroke => stroke.isBackground === true);
    
    window.drawnStrokes = drawnStrokes; 
    
    // Harf sayacını sıfırla
    nextPointChar = 'A';
    window.nextPointChar = 'A';
    
    redrawAllStrokes();
}

function findHit(pos) {
    for (let i = drawnStrokes.length - 1; i >= 0; i--) {
        const stroke = drawnStrokes[i];

if (stroke.type === 'image') {
            // 1. Önce Boyutlandırma Tutamacı (Sağ Alt Köşe)
            // Köşenin dünya koordinatlarını hesapla
            const halfW = stroke.width / 2;
            const halfH = stroke.height / 2;
            const cornerX = stroke.x + halfW; // Basit hesap (Döndürme yoksa)
            const cornerY = stroke.y + halfH;
            
            if (distance(pos, {x: cornerX, y: cornerY}) < 20) {
                return { item: stroke, pointKey: 'image_resize' };
            }

            // 2. Resmin Gövdesi (Taşıma İçin)
            // Basit bir dikdörtgen çarpışma testi
            if (pos.x > stroke.x - halfW && pos.x < stroke.x + halfW &&
                pos.y > stroke.y - halfH && pos.y < stroke.y + halfH) {
                return { item: stroke, pointKey: 'self' };
            }
        }

        if (currentTool === 'move' && selectedItem === stroke) {
            if (stroke.type === 'polygon') {
                const rotateHandlePos = 
window.PolygonTool.getRotateHandlePosition(stroke);
                if (distance(pos, rotateHandlePos) < 12) return { item: stroke, pointKey: 'rotate' }; 
                if (stroke.vertices && stroke.vertices.length > 0) {
                    const resizeHandlePos = stroke.vertices[0];
                    if (distance(pos, resizeHandlePos) < 10) return { item: stroke, pointKey: 'resize' }; 
                }
            }
        }
        
        if (currentTool === 'move' || currentTool === 'fill') { // Fill için de hit gerekli
            if (stroke.type === 'polygon' && stroke.vertices) {
                for (let j = 0; j < stroke.vertices.length; j++) {
                    if (distance(pos, stroke.vertices[j]) < SNAP_THRESHOLD) return { item: stroke, pointKey: 'toggle_angles' };
                }
                for (let j = 0; j < stroke.vertices.length; j++) {
                    const v1 = stroke.vertices[j];
                    const v2 = stroke.vertices[(j + 1) % stroke.vertices.length];
                    const lineLength = distance(v1, v2);
                    const steps = Math.max(1, Math.floor(lineLength / 5)); 
                    let hitEdge = false;
                    for (let step = 1; step < steps; step++) { 
                        const t = step / steps;
                        const sampleX = v1.x + (v2.x - v1.x) * t;
                        const sampleY = v1.y + (v2.y - v1.y) * t;
                        if (distance({x: sampleX, y: sampleY}, pos) < SNAP_THRESHOLD) { hitEdge = true; break; }
                    }
                    if (hitEdge) return { item: stroke, pointKey: 'toggle_edges' };
                }
            }
            if (stroke.type === 'arc' && stroke.cx) {
                const distToCenter = distance(pos, {x: stroke.cx, y: stroke.cy});
                if (Math.abs(distToCenter - stroke.radius) < SNAP_THRESHOLD) return { item: stroke, pointKey: 'toggle_circle_info' };
            }
        }

        if (stroke.type === 'point') {
            if (distance(pos, stroke) < SNAP_THRESHOLD) return { item: stroke, pointKey: 'self' };
        }
        if (stroke.p1 && distance(pos, stroke.p1) < SNAP_THRESHOLD) return { item: stroke, pointKey: 'p1' };
        if (stroke.p2 && distance(pos, stroke.p2) < SNAP_THRESHOLD) return { item: stroke, pointKey: 'p2' };
        if (stroke.type === 'arc' && stroke.cx && distance(pos, {x: stroke.cx, y: stroke.cy}) < SNAP_THRESHOLD) return { item: stroke, pointKey: 'center' };
        if (stroke.type === 'polygon' && stroke.center && distance(pos, stroke.center) < SNAP_THRESHOLD) return { item: stroke, pointKey: 'center' };
    }
    return null; 
}

// Global atamalar
window.redrawAllStrokes = redrawAllStrokes;
window.advanceChar = advanceChar;
window.distance = distance; 


// --- ARAÇ SEÇİMİ (TAMAMEN DÜZELTİLMİŞ VERSİYON) ---
function setActiveTool(tool) {
    // 1. Önceki tüm aktiflikleri temizle (Çizgi butonu dahil!)
    penButton.classList.remove('active');
    eraserButton.classList.remove('active');
    lineButton.classList.remove('active'); // <-- KRİTİK SATIR
    pointButton.classList.remove('active');
    straightLineButton.classList.remove('active');
    infinityLineButton.classList.remove('active');
    segmentButton.classList.remove('active');
    rayButton.classList.remove('active');
    rulerButton.classList.remove('active');
    gonyeButton.classList.remove('active');
    aciolcerButton.classList.remove('active');
    pergelButton.classList.remove('active');
    polygonButton.classList.remove('active');
    circleButton.classList.remove('active');
    moveButton.classList.remove('active');
    oyunlarButton.classList.remove('active');
    regularPolygonButtons.forEach(b => b.classList.remove('active'));
    
    if(fillButton) fillButton.classList.remove('active');
    if(animateButton) animateButton.classList.remove('active'); 

    // İmleçleri temizle
    body.classList.remove('cursor-pen');
    body.classList.remove('cursor-eraser');
    body.classList.remove('cursor-snapshot');

    // Menüleri gizle
    if (polygonOptions) { polygonOptions.classList.add('hidden'); polygonOptions.style.display = ''; }
    
    // Çizgi menüsünü, SADECE yeni seçilen araç bir çizgi aracı DEĞİLSE gizle
    // (Böylece alt araçlar arasında gezerken menü kapanmaz)
    const isLineTool = ['point', 'straightLine', 'line', 'segment', 'ray'].includes(tool);
    if (!isLineTool && lineOptions) { 
        lineOptions.classList.add('hidden'); 
        lineOptions.style.display = ''; 
    }

    if (oyunlarOptions) { oyunlarOptions.classList.add('hidden'); oyunlarOptions.style.display = ''; }
    if (fillOptions) { fillOptions.classList.add('hidden'); fillOptions.style.display = ''; }
    penOptions.classList.add('hidden'); 

    // Değişkenleri sıfırla
    isDrawing = false;
    lineStartPoint = null;
    isDrawingLine = false;
    isDrawingInfinityLine = false; 
    isDrawingSegment = false; 
    isDrawingRay = false; 
    
    window.tempPolygonData = null; 
    polygonPreviewLabel.classList.add('hidden'); 
    
    // Fiziksel Araçları gizle
    if (window.RulerTool) window.RulerTool.hide();
    if (window.GonyeTool) window.GonyeTool.hide();
    if (window.AciolcerTool) window.AciolcerTool.hide();
    if (window.PergelTool) window.PergelTool.hide();
    
    if (snapIndicator) snapIndicator.style.display = 'none';
    
    // Etkileşimleri kapat
    if (window.RulerTool) window.RulerTool.interactionMode = 'none';
    if (window.GonyeTool) window.GonyeTool.interactionMode = 'none';
    if (window.AciolcerTool) window.AciolcerTool.interactionMode = 'none';
    if (window.PergelTool) window.PergelTool.interactionMode = 'none';
    
    ctx.clearRect(0, 0, canvas.width, canvas.height); 
    redrawAllStrokes(); 

    // 2. Yeni aracı aktif et
    currentTool = tool;

    if (tool === 'pen') {
        penButton.classList.add('active');
        body.classList.add('cursor-pen');
        penOptions.classList.remove('hidden'); 
    } else if (tool === 'eraser') {
        eraserButton.classList.add('active');
        body.classList.add('cursor-eraser');
    } else if (tool === 'snapshot') { 
        if(animateButton) animateButton.classList.add('active');
        body.classList.add('cursor-snapshot');
    } 
    // --- ÇİZGİ ARAÇLARI GRUBU ---
    else if (tool === 'point') {
        lineButton.classList.add('active'); // Ana buton aktif
        pointButton.classList.add('active'); // Alt buton aktif
        lineOptions.classList.remove('hidden'); 
    } else if (tool === 'straightLine') { 
        lineButton.classList.add('active');
        straightLineButton.classList.add('active');
        lineOptions.classList.remove('hidden');
    } else if (tool === 'line') { 
        lineButton.classList.add('active');
        infinityLineButton.classList.add('active');
        lineOptions.classList.remove('hidden');
    } else if (tool === 'segment') { 
        lineButton.classList.add('active');
        segmentButton.classList.add('active');
        lineOptions.classList.remove('hidden');
    } else if (tool === 'ray') { 
        lineButton.classList.add('active');
        rayButton.classList.add('active');
        lineOptions.classList.remove('hidden');
    } 
    // --- DİĞER ARAÇLAR ---
    else if (tool === 'ruler') {
        rulerButton.classList.add('active');
        if (window.RulerTool) window.RulerTool.show();
    } else if (tool === 'gonye') {
        gonyeButton.classList.add('active');
        if (window.GonyeTool) window.GonyeTool.show();
    } else if (tool === 'aciolcer') {
        aciolcerButton.classList.add('active');
        if (window.AciolcerTool) window.AciolcerTool.show();
    } else if (tool === 'pergel') {
        pergelButton.classList.add('active');
        if (window.PergelTool) window.PergelTool.show();
    } else if (tool.startsWith('draw_polygon_')) { 
        polygonButton.classList.add('active');
    } else if (tool === 'move') {
        moveButton.classList.add('active');
    } else if (tool === 'fill') {
        if(fillButton) {
            fillButton.classList.add('active');
            fillOptions.classList.remove('hidden');
            fillOptions.style.display = 'flex';
            const buttonRect = fillButton.getBoundingClientRect();
            const panelRect = fillButton.parentElement.getBoundingClientRect();
            const topOffset = buttonRect.top - panelRect.top;
            fillOptions.style.top = `${topOffset}px`;
        }
    }
    
    redrawAllStrokes(); 
}
// --- BUTON OLAYLARI ---

penButton.addEventListener('click', () => setActiveTool(currentTool === 'pen' ? 'none' : 'pen'));
eraserButton.addEventListener('click', () => setActiveTool(currentTool === 'eraser' ? 'none' : 'eraser'));
rulerButton.addEventListener('click', () => { if (window.RulerTool) { window.RulerTool.toggle(); rulerButton.classList.toggle('active', !window.RulerTool.rulerElement.style.display); } });
gonyeButton.addEventListener('click', () => { if (window.GonyeTool) { window.GonyeTool.toggle(); gonyeButton.classList.toggle('active', !window.GonyeTool.gonyeElement.style.display); } });
aciolcerButton.addEventListener('click', () => { if (window.AciolcerTool) { window.AciolcerTool.toggle(); aciolcerButton.classList.toggle('active', !window.AciolcerTool.aciolcerElement.style.display); } });
pergelButton.addEventListener('click', () => { if (window.PergelTool) { window.PergelTool.toggle(); pergelButton.classList.toggle('active', !window.PergelTool.pergelElement.classList.contains('hidden')); } });
undoButton.addEventListener('click', undoLastStroke);
clearAllButton.addEventListener('click', clearAllStrokes);
moveButton.addEventListener('click', () => setActiveTool(currentTool === 'move' ? 'none' : 'move'));

pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';

if (prevPageBtn && nextPageBtn) {
    
    // Önceki Sayfa (<)
    prevPageBtn.addEventListener('click', () => {
        if (currentPDF && currentPDFPage > 1) {
            currentPDFPage--; // Sayfayı 1 azalt
            renderPDFPage(currentPDFPage); // Yeni sayfayı çiz
        }
    });

    // Sonraki Sayfa (>)
    nextPageBtn.addEventListener('click', () => {
        if (currentPDF && currentPDFPage < totalPDFPages) {
            currentPDFPage++; // Sayfayı 1 artır
            renderPDFPage(currentPDFPage); // Yeni sayfayı çiz
        }
    });
}

if (uploadButton && fileInput) {
    uploadButton.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // --- DURUM A: PDF YÜKLEME ---
        if (file.type === 'application/pdf') {
            const fileReader = new FileReader();
            fileReader.onload = async function() {
                const typedarray = new Uint8Array(this.result);
                try {
                    // 1. PDF'i Yükle
                    currentPDF = await pdfjsLib.getDocument(typedarray).promise;
                    totalPDFPages = currentPDF.numPages;
                    
                    // 2. KULLANICIYA BAŞLANGIÇ SAYFASINI SOR
                    let startPage = prompt(`Bu kitap ${totalPDFPages} sayfa. Hangi sayfadan başlamak istersiniz?`, "1");
                    
                    // Girdi kontrolü (Geçersizse veya İptal ise 1'den başla)
                    currentPDFPage = parseInt(startPage);
                    if (!currentPDFPage || currentPDFPage < 1 || currentPDFPage > totalPDFPages) {
                        currentPDFPage = 1;
                    }

                    // 3. Paneli Göster
                    pdfControls.classList.remove('hidden');
                    pdfControls.style.display = 'flex';
                    
                    // 4. Seçilen Sayfayı Çiz
                    renderPDFPage(currentPDFPage);

                } catch (error) {
                    console.error("PDF hatası:", error);
                    alert("PDF okunurken bir hata oluştu.");
                }
            };
            fileReader.readAsArrayBuffer(file);
        } 
        // --- DURUM B: EĞER DOSYA RESİM İSE (JPG, PNG) ---
        else {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    addToCanvasAsObject(img); // Ortak fonksiyonu çağır
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
        
        e.target.value = ''; 
    });
}

// Resmi veya PDF Sayfasını Hafızaya Ekleyen Ortak Fonksiyon
function addToCanvasAsObject(img) {
    let startWidth = 400;
    if (img.width < 400) startWidth = img.width;
    
    let scaleFactor = startWidth / img.width;
    let startHeight = img.height * scaleFactor;

    drawnStrokes.push({
        type: 'image',
        img: img,
        x: canvas.width / 2,
        y: canvas.height / 2,
        width: startWidth,
        height: startHeight,
        rotation: 0,
        isBackground: true // <--- İŞTE BU ETİKET EKSİKTİ!
    });
    
    redrawAllStrokes();
}

if(fillButton) fillButton.addEventListener('click', () => setActiveTool(currentTool === 'fill' ? 'none' : 'fill'));
if(fillColorBoxes) {
    fillColorBoxes.forEach(box => {
        const handler = (e) => {
            e.stopPropagation();
            fillColorBoxes.forEach(b => b.classList.remove('selected'));
            e.target.classList.add('selected');
            currentFillColor = e.target.dataset.color || e.target.style.backgroundColor;
            setActiveTool('fill');
        };
        box.addEventListener('click', handler);
        box.addEventListener('touchstart', handler, {passive:false});
    });
    if(fillColorBoxes.length>0) { fillColorBoxes[0].classList.add('selected'); currentFillColor = fillColorBoxes[0].dataset.color || fillColorBoxes[0].style.backgroundColor; }
}

colorBoxes.forEach(box => {
    box.addEventListener('click', (e) => {
        colorBoxes.forEach(b => b.classList.remove('selected'));
        e.target.classList.add('selected');
        currentPenColor = e.target.style.backgroundColor;
    });
});
colorBoxes[0].classList.add('selected');
currentPenColor = colorBoxes[0].style.backgroundColor;

lineButton.addEventListener('click', () => {
    if (lineButton.classList.contains('active')) { setActiveTool('none'); } 
    else {
        setActiveTool('none'); 
        lineOptions.classList.remove('hidden'); lineOptions.style.display = 'flex'; lineButton.classList.add('active'); 
        const buttonRect = lineButton.getBoundingClientRect();
        const panelRect = lineButton.parentElement.getBoundingClientRect();
        lineOptions.style.top = `${buttonRect.top - panelRect.top}px`;
    }
});

// Çokgen Renk Seçimi (Varsayılan Beyaz)
if (polygonColorOptions.length > 0) {
    polygonColorOptions[0].classList.add('selected');
    window.currentLineColor = polygonColorOptions[0].dataset.color || '#FFFFFF'; 
    
    polygonColorOptions.forEach(box => {
        const handleColorSelect = (e) => {
            e.stopPropagation(); e.preventDefault();
            polygonColorOptions.forEach(b => b.classList.remove('selected'));
            e.target.classList.add('selected');
            const color = e.target.dataset.color || e.target.style.backgroundColor;
            window.currentLineColor = color; 
            try { if (window.audio_select) { window.audio_select.currentTime=0; window.audio_select.play(); } else if (window.audio_click) { window.audio_click.currentTime=0; window.audio_click.play(); } } catch(err){}
        };
        box.addEventListener('click', handleColorSelect);
        box.addEventListener('touchstart', handleColorSelect, { passive: false });
    });
}

polygonButton.addEventListener('click', () => {
    if (polygonButton.classList.contains('active')) { setActiveTool('none'); } 
    else {
        setActiveTool('none'); 
        polygonOptions.classList.remove('hidden'); polygonOptions.style.display = 'flex'; polygonButton.classList.add('active'); 
        const buttonRect = polygonButton.getBoundingClientRect();
        const panelRect = polygonButton.parentElement.getBoundingClientRect();
        const menuHeight = polygonOptions.offsetHeight;
        const windowHeight = window.innerHeight;
        const margin = 10;
        let topOffset = buttonRect.top - panelRect.top;
        if (buttonRect.top + menuHeight > (windowHeight - margin)) {
            topOffset = (windowHeight - menuHeight - margin) - panelRect.top;
        }
        polygonOptions.style.top = `${topOffset}px`;
    }
});

oyunlarButton.addEventListener('click', () => {
    if (oyunlarButton.classList.contains('active')) { setActiveTool('none'); } 
    else {
        setActiveTool('none'); 
        oyunlarOptions.innerHTML = ''; 
        if (window.OyunListesi && window.OyunListesi.length > 0) {
            window.OyunListesi.forEach(oyun => {
                const linkElement = document.createElement('a');
                linkElement.href = oyun.link;
                linkElement.innerText = oyun.isim;
                linkElement.target = "_blank";
                oyunlarOptions.appendChild(linkElement);
            });
        } else { oyunlarOptions.innerText = "Oyun bulunamadı."; }
        oyunlarOptions.classList.remove('hidden'); oyunlarOptions.style.display = 'flex'; oyunlarButton.classList.add('active'); 
        setTimeout(() => {
            const buttonRect = oyunlarButton.getBoundingClientRect();
            const panelRect = oyunlarButton.parentElement.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const margin = 10; 
            let topOffset = buttonRect.top - panelRect.top;
            const menuHeight = oyunlarOptions.offsetHeight;
            if (buttonRect.top + menuHeight > (windowHeight - margin)) {
                topOffset = (windowHeight - menuHeight - margin) - panelRect.top;
                if (topOffset < 0) topOffset = 0; 
            }
            oyunlarOptions.style.top = `${topOffset}px`;
        }, 0); 
    }
});

circleButton.addEventListener('click', (e) => {
    e.stopPropagation();
    setActiveTool('draw_polygon_circle');
    window.PolygonTool.handleDrawClick(null, 0); 
    regularPolygonButtons.forEach(b => b.classList.remove('active'));
    circleButton.classList.add('active');
});

regularPolygonButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        const sides = parseInt(e.target.dataset.sides);
        setActiveTool(`draw_polygon_${sides}_sides`);
        window.PolygonTool.handleDrawClick(null, sides); 
        regularPolygonButtons.forEach(b => b.classList.remove('active'));
        circleButton.classList.remove('active');
        e.target.classList.add('active');
    });
});

pointButton.addEventListener('click', (e) => {
    e.stopPropagation(); 
    if (window.audio_select) window.audio_select.play();
    if (!audio_click_src_set) { audio_click.src = 'sesler/point-smooth-beep-230573.mp3'; audio_click_src_set = true; }
    setActiveTool(currentTool === 'point' ? 'none' : 'point');
});
straightLineButton.addEventListener('click', (e) => { e.stopPropagation(); if(window.audio_select) window.audio_select.play(); setActiveTool(currentTool === 'straightLine' ? 'none' : 'straightLine'); });
infinityLineButton.addEventListener('click', (e) => { e.stopPropagation(); if(window.audio_select) window.audio_select.play(); setActiveTool(currentTool === 'line' ? 'none' : 'line'); });
segmentButton.addEventListener('click', (e) => { e.stopPropagation(); if(window.audio_select) window.audio_select.play(); setActiveTool(currentTool === 'segment' ? 'none' : 'segment'); });
rayButton.addEventListener('click', (e) => { e.stopPropagation(); if(window.audio_select) window.audio_select.play(); setActiveTool(currentTool === 'ray' ? 'none' : 'ray'); });

lineColorOptions.forEach(box => {
    box.addEventListener('click', (e) => {
        e.stopPropagation();
        lineColorOptions.forEach(b => b.classList.remove('selected'));
        e.target.classList.add('selected');
        const color = e.target.dataset.color || e.target.style.backgroundColor;
        window.currentLineColor = color; 
    });
});
lineColorOptions[0].classList.add('selected');
window.currentLineColor = lineColorOptions[0].dataset.color || lineColorOptions[0].style.backgroundColor; 

// --- app.js: Canlandır Butonu (Dokunmatik ve Tıklama GARANTİLİ) ---
if (animateButton) {
    const toggleAnimate = (e) => {
        // Dokunmatik ekranlarda çift tetiklenmeyi ve diğer araçların araya girmesini önle
        if (e && e.cancelable) e.preventDefault(); 
        if (e) e.stopPropagation(); 

        // Modu Değiştir
        setActiveTool(currentTool === 'snapshot' ? 'none' : 'snapshot');
        
        // Görsel Ayarlar (Aktiflik Rengi ve İmleç)
        if (currentTool === 'snapshot') {
            animateButton.classList.add('active');
            body.classList.add('cursor-snapshot'); 
        } else {
            animateButton.classList.remove('active');
            body.classList.remove('cursor-snapshot');
        }
    };

    // 1. Standart Tıklama (Mouse için)
    animateButton.addEventListener('click', toggleAnimate);
    
    // 2. Parmak Dokunuşu (Akıllı Tahta için ŞART olan kısım)
    animateButton.addEventListener('touchstart', toggleAnimate, { passive: false });
}


// --- MOUSE OLAYLARI ---

canvas.addEventListener('mousedown', (e) => {

    // --- 1. FİZİKSEL ARAÇ KONTROLÜ ---
    const isToolElementClicked = e.target.closest('.ruler-container, .gonye-container, .aciolcer-container, #compass-container');
    if (isToolElementClicked) { 
        isDrawingLine = false;
        isDrawingInfinityLine = false;
        isDrawingSegment = false;
        isDrawingRay = false;
        lineStartPoint = null;
        window.tempPolygonData = null; 
        polygonPreviewLabel.classList.add('hidden');
        return; 
    }
    // --- FİZİKSEL ARAÇ KONTROLÜ SONU ---


    // --- 2. "TAŞI" MODU KONTROLÜ (GÜNCELLENDİ) ---
    // app.js'deki 'mousedown' -> 'move' bloğunu DEĞİŞTİRİN:

    // app.js'deki 'mousedown' -> 'move' bloğunu DEĞİŞTİRİN:

    // app.js'deki 'mousedown' -> 'move' bloğunu DEĞİŞTİRİN:

   if (currentTool === 'move') { // Taşıma Mantığı
        const pos = getEventPosition(e);
        const hit = findHit(pos);
        
        if (hit) { // Bir şey yakalandı
            
            // --- KRİTİK ETİKETLEME DÜZELTMESİ ---
            // (Artık diğer etiketleri kapatmıyoruz)
            
            if (hit.pointKey === 'toggle_edges') {
                hit.item.showEdgeLabels = !hit.item.showEdgeLabels; // Sadece kenarı aç/kapat
                redrawAllStrokes();
                return; // Taşıma işlemini başlatma
            }
            if (hit.pointKey === 'toggle_angles') {
                hit.item.showAngleLabels = !hit.item.showAngleLabels; // Sadece açıyı aç/kapat
                redrawAllStrokes();
                return; // Taşıma işlemini başlatma
            }
            if (hit.pointKey === 'toggle_circle_info') {
                hit.item.showCircleInfo = !hit.item.showCircleInfo; // Sadece çember bilgisini aç/kapat
                redrawAllStrokes();
                return; // Taşıma işlemini başlatma
            }
            // --- ETİKETLEME MANTIĞI SONU ---

            isMoving = true;
            selectedItem = hit.item;
            selectedPointKey = hit.pointKey; 
            dragStartPos = pos; 
            
            originalStartPos = {}; 
            if (hit.pointKey === 'self') {
                originalStartPos = { x: hit.item.x, y: hit.item.y };
            } else if (hit.pointKey === 'p1') {
                originalStartPos = { x: hit.item.p1.x, y: hit.item.p1.y };
            } else if (hit.pointKey === 'p2') {
                originalStartPos = { x: hit.item.p2.x, y: hit.item.p2.y };
            } else if (hit.pointKey === 'center') {
                originalStartPos = { x: (hit.item.cx || hit.item.center.x), y: (hit.item.cy || hit.item.center.y) };
            } else if (hit.pointKey === 'rotate' || hit.pointKey === 'resize') {
                originalStartPos = { radius: hit.item.radius, rotation: hit.item.rotation };
            }
            
            const itemType = hit.item.type;
            if ((itemType === 'line' || itemType === 'segment' || itemType === 'ray' || itemType === 'straightLine') && (hit.pointKey === 'p1' || hit.pointKey === 'p2')) {
                rotationPivot = (hit.pointKey === 'p1') ? hit.item.p2 : hit.item.p1;
                const movingPoint = (hit.pointKey === 'p1') ? hit.item.p1 : hit.item.p2;
                selectedItem.startRadius = distance(movingPoint, rotationPivot);
            } else {
                rotationPivot = null; 
            }
            
            redrawAllStrokes(); 
            return; 
            
        } else {
             // Hiçbir şeye tıklanmadıysa, seçimi iptal et ve TÜM etiketleri kapat
             if (selectedItem) {
                 selectedItem.showEdgeLabels = false;
                 selectedItem.showAngleLabels = false;
                 selectedItem.showCircleInfo = false;
             }
             selectedItem = null;
             redrawAllStrokes();
        }
    }
    // --- "TAŞI" MODU SONU ---


    // --- 3. DİĞER ÇİZİM ARAÇLARI KONTROLÜ ---
    
    if (currentTool === 'none') return;

    // --- YENİ EKLENEN KOD: Çizgi Menüsünü Kapat ---
    // Eğer seçili araç bir çizgi aracıysa menüyü gizle
    if (['point', 'straightLine', 'line', 'segment', 'ray'].includes(currentTool)) {
        if (lineOptions) {
            lineOptions.classList.add('hidden');
            lineOptions.style.display = 'none';
        }
    }
    
    const pos = getEventPosition(e);
    const snapPos = snapTarget || pos;

// --- CANLANDIRMA BAŞLANGICI ---
    if (currentTool === 'snapshot') {
        snapshotStart = snapPos; // Başlangıç noktasını al
        return;
    }

    switch (currentTool) {
        case 'pen':
            isDrawing = true; 
            drawnStrokes.push({ type: 'pen', path: [snapPos], color: currentPenColor, width: currentPenWidth });
            break;
            
        case 'point':
                        isDrawing = false; 
            drawnStrokes.push({ type: 'point', x: snapPos.x, y: snapPos.y, label: nextPointChar });
            nextPointChar = advanceChar(nextPointChar);
            redrawAllStrokes(); 
            break;

        case 'eraser':
            
            isDrawing = true; 
            break;

        case 'straightLine':
            if (!isDrawingLine) {
                isDrawingLine = true;
                lineStartPoint = snapPos; 
            } else {
                drawnStrokes.push({ type: 'straightLine', p1: lineStartPoint, p2: snapPos, color: currentLineColor, width: 3 });
                isDrawingLine = false;
                lineStartPoint = null;
                redrawAllStrokes();
            }
            break;
            
        case 'line': // Doğru
            if (!isDrawingInfinityLine) {
                isDrawingInfinityLine = true;
                lineStartPoint = pos;
            } else {
                const label1 = nextPointChar;
                const label2 = advanceChar(label1);
                nextPointChar = advanceChar(label2);
                drawnStrokes.push({ type: 'line', p1: lineStartPoint, p2: pos, color: currentLineColor, width: 3, label1: label1, label2: label2 });
                isDrawingInfinityLine = false;
                lineStartPoint = null;
                redrawAllStrokes();
            }
            break;

        case 'segment': // Doğru Parçası
            if (!isDrawingSegment) {
                isDrawingSegment = true;
                lineStartPoint = snapPos;
            } else {
                const label1 = nextPointChar;
                const label2 = advanceChar(label1);
                nextPointChar = advanceChar(label2);
                drawnStrokes.push({ type: 'segment', p1: lineStartPoint, p2: snapPos, color: currentLineColor, width: 3, label1: label1, label2: label2 });
                isDrawingSegment = false;
                lineStartPoint = null;
                redrawAllStrokes();
            }
            break;

        case 'ray': // Işın
            if (!isDrawingRay) {
                isDrawingRay = true;
                lineStartPoint = pos;
            } else {
                const label1 = nextPointChar;
                const label2 = advanceChar(label1);
                nextPointChar = advanceChar(label2);
                drawnStrokes.push({ type: 'ray', p1: lineStartPoint, p2: pos, color: currentLineColor, width: 3, label1: label1, label2: label2 });
                isDrawingRay = false;
                lineStartPoint = null;
                redrawAllStrokes();
            }
            break;
            
        // --- ÇOKGEN BLOĞU (Mousedown - Tıklama Başlangıcı ve Bitişi) ---
        case 'draw_polygon_circle':
        case 'draw_polygon_3_sides':
        case 'draw_polygon_4_sides':
        case 'draw_polygon_5_sides':
        case 'draw_polygon_6_sides':
        case 'draw_polygon_7_sides':
        case 'draw_polygon_8_sides':
            
            // 1. Tıklama (Merkezi ayarlama)
            if (window.tempPolygonData && window.tempPolygonData.center === null) 
            {
                 window.tempPolygonData.center = snapPos;
                 window.PolygonTool.state.isDrawing = true; 
                 polygonPreviewLabel.classList.remove('hidden');
            } 
            // 2. Tıklama (Çizimi bitirme - Click-Move-Click yöntemi)
            else if (window.tempPolygonData && window.tempPolygonData.center) 
            {
                const finalRadius = window.tempPolygonData.radius || 0;
                const finalRotation = window.tempPolygonData.rotation || 0;
                
                // Tipi al
                const currentType = window.tempPolygonData.type;

                // Çizimi kaydet
                if (currentType === 0) { 
                    window.PolygonTool.finalizeCircle(finalRadius);
                } else {
                    window.PolygonTool.finalizeDraw(finalRadius, finalRotation);
                }
                
                polygonPreviewLabel.classList.add('hidden');
                
                // --- DEĞİŞİKLİK: ARACI KAPATMA, YENİSİNİ BAŞLAT ---
                // setActiveTool('none'); // ESKİ KOD (SİLİNDİ)
                
                window.PolygonTool.handleDrawClick(null, currentType); // YENİ KOD
                
               
            }
            break;
        // --- ÇOKGEN BLOĞU SONU ---
    }
});

canvas.addEventListener('mousemove', (e) => {

    // 1. TAŞIMA (MOVE) MANTIĞI
    if (currentTool === 'move' && isMoving) {
        const pos = getEventPosition(e);
        const dx = pos.x - dragStartPos.x;
        const dy = pos.y - dragStartPos.y;
        
        if (selectedPointKey === 'image_resize') {
            const distFromCenterX = Math.abs(pos.x - selectedItem.x);
            const distFromCenterY = Math.abs(pos.y - selectedItem.y);
            selectedItem.width = Math.max(20, distFromCenterX * 2);
            selectedItem.height = Math.max(20, distFromCenterY * 2);
        }
        else if (selectedPointKey === 'rotate') {
            const center = selectedItem.center;
            const r_dx = pos.x - center.x;
            const r_dy = pos.y - center.y;
            const newAngleRad = Math.atan2(r_dy, r_dx); 
            selectedItem.rotation = newAngleRad * (180 / Math.PI);
        } 
        else if (selectedPointKey === 'resize') {
            const center = selectedItem.center;
            selectedItem.radius = distance(center, pos);
        } 
        else if (rotationPivot) { 
            const pivot = rotationPivot;
            const movingPointKey = selectedPointKey; 
            const r_dx = pos.x - pivot.x;
            const r_dy = pos.y - pivot.y;
            const currentAngle = Math.atan2(r_dy, r_dx);
            selectedItem[movingPointKey].x = pivot.x + Math.cos(currentAngle) * selectedItem.startRadius;
            selectedItem[movingPointKey].y = pivot.y + Math.sin(currentAngle) * selectedItem.startRadius;
        } 
        else {
            if (selectedPointKey === 'self') { 
                selectedItem.x = originalStartPos.x + dx;
                selectedItem.y = originalStartPos.y + dy;
            } else if (selectedPointKey === 'p1') {
                selectedItem.p1.x = originalStartPos.x + dx;
                selectedItem.p1.y = originalStartPos.y + dy;
            } else if (selectedPointKey === 'p2') {
                selectedItem.p2.x = originalStartPos.x + dx;
                selectedItem.p2.y = originalStartPos.y + dy;
            } else if (selectedPointKey === 'center') {
                if (selectedItem.type === 'arc') {
                    selectedItem.cx = originalStartPos.x + dx;
                    selectedItem.cy = originalStartPos.y + dy;
                } else if (selectedItem.type === 'polygon') {
                     selectedItem.center.x = originalStartPos.x + dx;
                     selectedItem.center.y = originalStartPos.y + dy;
                }
            }
        }
        
        redrawAllStrokes();
        return; 
    }

    // Araç Kontrolü
    // --- ESKİ HATALI SATIRI SİL, YERİNE BUNU YAPIŞTIR ---
if (currentTool === 'ruler' || currentTool === 'gonye' || currentTool === 'aciolcer' || currentTool === 'pergel') {
    // 1. Çizim bayrağını indir
    isDrawing = false;
    
    // 2. Yolu mutlaka kapat (Sıçramayı engelleyen asıl komut)
    if (ctx) ctx.beginPath();

    // 3. Varsa bu araçların kendi özel sürükleme/döndürme bayraklarını da sıfırla
    // (Kodunda bu değişkenlerin adları farklı olabilir ama mantık budur)
    // isRotating = false; 
    // isDraggingRuler = false; 

    return; // ŞİMDİ çıkış yapabilirsin
}
    if (currentTool === 'none') return;
    
    const pos = getEventPosition(e);
    currentMousePos = pos; 

    // Akıllı Yakalama
    clearTimeout(snapHoverTimer);
    snapHoverTimer = null;
    
    const canSnap = (currentTool === 'point' || currentTool === 'straightLine' || currentTool === 'pen' || currentTool === 'segment');
    
    if (canSnap) {
        const potentialSnap = findSnapPoint(pos);
        if (potentialSnap) {
            snapHoverTimer = setTimeout(() => {
                snapTarget = potentialSnap;
                snapIndicator.style.left = `${snapTarget.x}px`;
                snapIndicator.style.top = `${snapTarget.y}px`;
                snapIndicator.style.display = 'block';
            }, 25);
        } else {
            snapTarget = null;
            snapIndicator.style.display = 'none';
        }
    } else {
        snapTarget = null;
        snapIndicator.style.display = 'none';
    }

    // Temsili Silgi
    if (currentTool === 'eraser') {
        eraserPreview.style.left = `${pos.x}px`;
        eraserPreview.style.top = `${pos.y}px`;
        eraserPreview.style.display = 'block';
    } else {
        eraserPreview.style.display = 'none';
    }

    // --- ÖN İZLEMELER ---
    let previewActive = false;
    ctx.globalAlpha = 0.6; 
    ctx.setLineDash([8, 4]);

    const endPos = snapTarget || currentMousePos;

    if (currentTool === 'straightLine' && isDrawingLine) {
        redrawAllStrokes(); 
        ctx.beginPath();
        ctx.moveTo(lineStartPoint.x, lineStartPoint.y);
        ctx.lineTo(endPos.x, endPos.y);
        ctx.strokeStyle = currentLineColor;
        ctx.lineWidth = 3;
        ctx.stroke();
        previewActive = true; 
    }
    else if (currentTool === 'line' && isDrawingInfinityLine) {
        redrawAllStrokes();
        drawInfinityLine(lineStartPoint, currentMousePos, currentLineColor, 3, false);
        previewActive = true;
    }
    else if (currentTool === 'segment' && isDrawingSegment) {
        redrawAllStrokes(); 
        ctx.beginPath();
        ctx.moveTo(lineStartPoint.x, lineStartPoint.y);
        ctx.lineTo(endPos.x, endPos.y);
        ctx.strokeStyle = currentLineColor;
        ctx.lineWidth = 3;
        ctx.stroke();
        drawDot(lineStartPoint, currentLineColor);
        drawDot(endPos, currentLineColor);
        previewActive = true;
    }
    else if (currentTool === 'ray' && isDrawingRay) {
        redrawAllStrokes(); 
        drawInfinityLine(lineStartPoint, currentMousePos, currentLineColor, 3, true); 
        drawDot(lineStartPoint, currentLineColor);
        previewActive = true;
    }
    else if (window.tempPolygonData && window.tempPolygonData.center) {
        const center = window.tempPolygonData.center;
        const type = window.tempPolygonData.type;
        const currentRadius = distance(center, currentMousePos);
        const dx = currentMousePos.x - center.x;
        const dy = currentMousePos.y - center.y;
        const currentRotationRad = Math.atan2(dy, dx); 
        const currentRotationDeg = currentRotationRad * (180 / Math.PI); 

        window.tempPolygonData.rotation = currentRotationDeg; 
        window.tempPolygonData.radius = currentRadius; 

        redrawAllStrokes(); 
        ctx.beginPath();
        
        if (type === 0) { 
            ctx.arc(center.x, center.y, currentRadius, 0, 2 * Math.PI);
        } else { 
            const vertices = window.PolygonTool.calculateVertices(center, currentRadius, type, currentRotationDeg); 
            if (vertices.length > 0) {
                 ctx.moveTo(vertices[0].x, vertices[0].y);
                 for (let i = 1; i < vertices.length; i++) ctx.lineTo(vertices[i].x, vertices[i].y);
                 ctx.closePath();
            }
        }
        
        ctx.strokeStyle = window.currentLineColor;
        ctx.lineWidth = 3;
        ctx.stroke();
        drawDot(center, window.currentLineColor);
        previewActive = true; 
        
        polygonPreviewLabel.style.left = `${currentMousePos.x}px`;
        polygonPreviewLabel.style.top = `${currentMousePos.y}px`;
        polygonPreviewLabel.classList.remove('hidden');

        let labelText = "";
        const cmRadius = (currentRadius / (window.PolygonTool.PIXELS_PER_CM || 30)).toFixed(1);
        if (type === 0) labelText = `Yarıçap: ${cmRadius} cm`;
        else labelText = `Kenar: ${((2 * currentRadius * Math.sin(Math.PI / type)) / 30).toFixed(1)} cm`;
        polygonPreviewLabel.innerText = labelText;
    }

    // --- CANLANDIRMA (KUTU) ÖNİZLEMESİ ---
    // (Burası artık 'isDrawing' kontrolünün ÜSTÜNDE)
    else if (currentTool === 'snapshot' && snapshotStart) {
        redrawAllStrokes(); 
        
        const w = currentMousePos.x - snapshotStart.x;
        const h = currentMousePos.y - snapshotStart.y;
        
        ctx.save();
        ctx.setLineDash([5, 5]); 
        ctx.strokeStyle = '#FF0000'; 
        ctx.lineWidth = 2;
        ctx.strokeRect(snapshotStart.x, snapshotStart.y, w, h); 
        ctx.restore();
        
        previewActive = true; 
    }

    ctx.globalAlpha = 1.0;
    ctx.setLineDash([]);
    
    if (previewActive) return; 

    // --- ÇİZİM İŞLEMLERİ (KALEM/SİLGİ) ---
    // Bu kontrol artık Canlandırma'yı engellemeyecek
    if (!isDrawing) return;

    if (currentTool === 'pen') {
        drawnStrokes[drawnStrokes.length - 1].path.push(pos);
        redrawAllStrokes();
    } 
    else if (currentTool === 'eraser') {
        let strokesToKeep = [];
        let needsRedraw = false;
        
        for (const stroke of drawnStrokes) {
            let touched = false;

            if (stroke.type === 'pen') {
                for (const point of stroke.path) { if (distance(point, pos) < 10) { touched = true; break; } }
            } 
            else if (stroke.type === 'point') {
                if (distance(stroke, pos) < 10) { touched = true; }
            } 
            else if (stroke.type === 'straightLine' || stroke.type === 'line' || stroke.type === 'segment' || stroke.type === 'ray') {
                const p1 = stroke.p1; const p2 = stroke.p2;
                const steps = Math.max(1, Math.floor(distance(p1, p2) / 5)); 
                for (let i = 0; i <= steps; i++) {
                    const t = i / steps;
                    const sampleX = p1.x + (p2.x - p1.x) * t;
                    const sampleY = p1.y + (p2.y - p1.y) * t;
                    if (distance({x: sampleX, y: sampleY}, pos) < 10) { touched = true; break; }
                }
            }
            else if (stroke.type === 'arc') {
                const centerPos = { x: stroke.cx, y: stroke.cy };
                if (distance(centerPos, pos) < 10) { touched = true; } 
                else {
                    const steps = 30; 
                    for (let i = 0; i <= steps; i++) {
                        const angle = (stroke.startAngle + (i / steps) * (stroke.endAngle - stroke.startAngle)) * (Math.PI / 180);
                        const sampleX = stroke.cx + stroke.radius * Math.cos(angle);
                        const sampleY = stroke.cy + stroke.radius * Math.sin(angle);
                        if (distance({x: sampleX, y: sampleY}, pos) < 10) { touched = true; break; }
                    }
                }
            }
            else if (stroke.type === 'polygon') {
                if (stroke.center && distance(stroke.center, pos) < 10) { touched = true; } 
                else if (stroke.vertices) {
                    for (const v of stroke.vertices) { if (distance(v, pos) < 10) { touched = true; break; } }
                    if (!touched) {
                        for (let j = 0; j < stroke.vertices.length; j++) {
                            const v1 = stroke.vertices[j];
                            const v2 = stroke.vertices[(j + 1) % stroke.vertices.length];
                            const steps = Math.max(1, Math.floor(distance(v1, v2) / 5));
                            for (let i = 0; i <= steps; i++) {
                                const t = i / steps;
                                if (distance({x: v1.x + (v2.x - v1.x) * t, y: v1.y + (v2.y - v1.y) * t}, pos) < 10) { touched = true; break; }
                            }
                            if (touched) break;
                        }
                    }
                }
            } 
            else if (stroke.type === 'image') {
                // Arka plan koruması
                if (!stroke.isBackground) { 
                    const dx = pos.x - stroke.x;
                    const dy = pos.y - stroke.y;
                    const angleRad = -stroke.rotation * (Math.PI / 180);
                    const localX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
                    const localY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);
                    const halfW = stroke.width / 2;
                    const halfH = stroke.height / 2;
                    if (localX > -halfW && localX < halfW && localY > -halfH && localY < halfH) { touched = true; }
                }
            }

            if (touched) { needsRedraw = true; } else { strokesToKeep.push(stroke); }
        }

        if (needsRedraw) {
            drawnStrokes = strokesToKeep; 
            window.drawnStrokes = strokesToKeep;
            redrawAllStrokes(); 
        }
    }
}); // <--- 4. BURASI DOĞRU (Mousemove olayını kapatır)

canvas.addEventListener('mouseup', () => {

    if (currentTool === 'move' && isMoving) {
        // Taşıma sesini durdur
   
        isMoving = false;
        selectedPointKey = null;
        rotationPivot = null;
        originalStartPos = {};

        // --- YENİ EKLENEN: OTOMATİK GERİ DÖNÜŞ ---
        if (returnToSnapshot) {
            returnToSnapshot = false; // Notu sil
            setActiveTool('snapshot'); // Canlandır moduna geri dön
            
            // Butonu tekrar aktif göster
            if (animateButton) {
                animateButton.classList.add('active');
                body.classList.add('cursor-snapshot');
            }
        }
        // ----------------------------------------
        
        return;
    }

// --- SİHİRLİ KOPYALAMA (BİTİŞ) ---
    if (currentTool === 'snapshot' && snapshotStart) {
        const endPos = snapTarget || currentMousePos;
        
        let x = Math.min(snapshotStart.x, endPos.x);
        let y = Math.min(snapshotStart.y, endPos.y);
        let w = Math.abs(endPos.x - snapshotStart.x);
        let h = Math.abs(endPos.y - snapshotStart.y);

        // Yanlışlıkla tıklamaları engelle (Min 10px)
        if (w > 10 && h > 10) {
            redrawAllStrokes(); // Kutuyu sil, temiz görüntüyü al

            // 1. Bölgenin piksellerini al
            const imageData = ctx.getImageData(x, y, w, h);
            const data = imageData.data;

            // --- SİHİRLİ DÖNGÜ: Beyazları Şeffaf Yap ---
            // Her pikseli kontrol et (R, G, B, Alpha)
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                // Eğer renk beyaza çok yakınsa (Kağıt rengi)
                if (r > 230 && g > 230 && b > 230) {
                    data[i + 3] = 0; // Görünmez yap (Alpha = 0)
                }
            }

            // 2. Temizlenmiş veriyi geçici tuvale koy
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = w;
            tempCanvas.height = h;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(imageData, 0, 0);
            
            // 3. Resme çevir ve sahneye ekle
            const newImg = new Image();
            newImg.src = tempCanvas.toDataURL();
            
            newImg.onload = () => {
                const newObj = {
                    type: 'image',
                    img: newImg,
                    x: x + w / 2, 
                    y: y + h / 2,
                    width: w,
                    height: h,
                    rotation: 0
                };
                
                drawnStrokes.push(newObj);

                // --- GÜNCELLENEN KISIM BAŞLANGIÇ ---
                
                snapshotStart = null;
                
                // 1. Taşıma moduna geç (Parçayı tutabilmek için)
                setActiveTool('move'); 
                
                // 2. Yeni parçayı seçili yap ama sürüklemeyi başlatma (Siz tutacaksınız)
                selectedItem = newObj;
                isMoving = false; // <-- Otomatik yapışmasın, siz tutun
                
                // 3. "İş bitince beni geri döndür" notunu bırak
                returnToSnapshot = true; 
                
                // --- GÜNCELLENEN KISIM BİTİŞ ---
                redrawAllStrokes();
                
                if (window.audio_click) {
                    window.audio_click.currentTime = 0;
                    window.audio_click.play();
                }
            };
        }
        
        snapshotStart = null;
        return;
    }

    // 2. Silgiyi Otomatik Kapat ve Temizle
    if (currentTool === 'eraser') {
        
        isDrawingLine = false; 
        isDrawingInfinityLine = false; 
        isDrawingSegment = false; 
        isDrawingRay = false; 
        lineStartPoint = null; 
        redrawAllStrokes(); 
        isDrawing = false;
        setActiveTool('none'); 
        
        return; 
    }
    
    // 3. Fiziksel araç kontrolü
    if (currentTool === 'ruler' || currentTool === 'gonye' || currentTool === 'aciolcer' || currentTool === 'pergel') return;

    // Genel reset
    isDrawing = false;
    clearTimeout(snapHoverTimer);
    snapHoverTimer = null;
});



canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); 
    const pos = getEventPosition(e);
    const snapPos = snapTarget || pos;
    currentMousePos = pos; 

    // 1. FİZİKSEL ARAÇ KONTROLÜ (Çakışma Önleyici)
    const isToolElementClicked = e.target.closest('.ruler-container, .gonye-container, .aciolcer-container, #compass-container');
    if (isToolElementClicked) return; 

    // 2. YÜKSEK ÖNCELİK: CANLANDIRMA BAŞLANGICI
    if (currentTool === 'snapshot') {
        isDrawing = false;
        isMoving = false;
        isPinching = false;
        snapshotStart = snapPos;
        return; // İşlem başlatıldı, çık.
    }

    // 3. TAŞIMA (MOVE) VE PINCH ZOOM
    if (currentTool === 'move') {
        // A. İki Parmakla Zoom (Pinch)
        if (e.touches.length === 2 && selectedItem && selectedItem.type === 'image') {
            isPinching = true;
            isMoving = false; 
            const p1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            const p2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
            initialDistance = distance(p1, p2);
            initialScale = selectedItem.width; 
            initialCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            dragStartPos = initialCenter; 
            originalStartPos = { x: selectedItem.x, y: selectedItem.y }; 
            return; 
        }
        
        // B. Tek Parmakla Seçim ve Taşıma
        const hit = findHit(pos);
        if (hit) {
            if (hit.pointKey === 'toggle_edges') { hit.item.showEdgeLabels = !hit.item.showEdgeLabels; redrawAllStrokes(); return; }
            if (hit.pointKey === 'toggle_angles') { hit.item.showAngleLabels = !hit.item.showAngleLabels; redrawAllStrokes(); return; }
            if (hit.pointKey === 'toggle_circle_info') { hit.item.showCircleInfo = !hit.item.showCircleInfo; redrawAllStrokes(); return; }
                    
            isMoving = true; 
            selectedItem = hit.item; 
            selectedPointKey = hit.pointKey; 
            dragStartPos = pos; 
            rotationPivot = null; 

            originalStartPos = {}; 
            if (hit.pointKey === 'self') originalStartPos = { x: hit.item.x, y: hit.item.y };
            else if (hit.pointKey === 'p1') originalStartPos = { x: hit.item.p1.x, y: hit.item.p1.y };
            else if (hit.pointKey === 'p2') originalStartPos = { x: hit.item.p2.x, y: hit.item.p2.y };
            else if (hit.pointKey === 'center') { originalStartPos = { x: (hit.item.cx !== undefined ? hit.item.cx : hit.item.center.x), y: (hit.item.cy !== undefined ? hit.item.cy : hit.item.center.y) }; }
            else if (hit.pointKey === 'rotate' || hit.pointKey === 'resize' || hit.pointKey === 'image_resize') { 
                originalStartPos = { radius: hit.item.radius, rotation: hit.item.rotation, width: hit.item.width, height: hit.item.height }; 
            }
            
            const itemType = hit.item.type;
            if ((itemType === 'line' || itemType === 'segment' || itemType === 'ray' || itemType === 'straightLine') && (hit.pointKey === 'p1' || hit.pointKey === 'p2')) {
                rotationPivot = (hit.pointKey === 'p1') ? hit.item.p2 : hit.item.p1;
                const movingPoint = (hit.pointKey === 'p1') ? hit.item.p1 : hit.item.p2;
                selectedItem.startRadius = distance(movingPoint, rotationPivot);
            }
            return; 
        }
    }
    
    // 4. DOLDURMA (FILL)
    if (currentTool === 'fill') {
        const hit = findHit(pos); 
        if (hit && (hit.item.type === 'polygon' || hit.item.type === 'arc')) {
            hit.item.fillColor = (currentFillColor === 'transparent') ? null : currentFillColor;
            redrawAllStrokes(); 
            try { if (window.audio_click) { window.audio_click.currentTime = 0; window.audio_click.play(); } } catch(err){}
        }
        isDrawing = false; 
        return;
    }

    // Araç Kontrolleri
    if (currentTool === 'ruler' || currentTool === 'gonye' || currentTool === 'aciolcer' || currentTool === 'pergel') return;
    if (currentTool === 'none') return;

    // 5. ÇOKGEN MERKEZ TIKLAMA
    if (currentTool.startsWith('draw_polygon_')) {
        if (window.tempPolygonData && window.tempPolygonData.center === null) {
             window.tempPolygonData.center = snapPos;
             window.PolygonTool.state.isDrawing = true; 
             redrawAllStrokes(); 
             drawDot(snapPos, window.currentLineColor); 
             polygonPreviewLabel.classList.remove('hidden');
             polygonPreviewLabel.style.left = `${snapPos.x}px`;
             polygonPreviewLabel.style.top = `${snapPos.y - 40}px`;
             polygonPreviewLabel.innerText = "Merkez";
                     }
        return; 
    }

    // 6. ÇİZİM ARAÇLARI (İŞTE BU KISIM EKSİKTİ)

if (['point', 'straightLine', 'line', 'segment', 'ray'].includes(currentTool)) {
        if (lineOptions) {
            lineOptions.classList.add('hidden');
            lineOptions.style.display = 'none';
        }
    }

    if (currentTool === 'pen') {
        isDrawing = true;
        drawnStrokes.push({ type: 'pen', path: [snapPos], color: currentPenColor, width: currentPenWidth });
    }
    else if (currentTool === 'point') {
        
        isDrawing = false;
        drawnStrokes.push({ type: 'point', x: snapPos.x, y: snapPos.y, label: nextPointChar });
        nextPointChar = advanceChar(nextPointChar);
        redrawAllStrokes();
    }
    else if (currentTool === 'eraser') {
        
        isDrawing = true; 
    }
    else if (currentTool === 'straightLine') {
        
        isDrawingLine = true; lineStartPoint = snapPos;
        redrawAllStrokes(); drawDot(snapPos, currentLineColor);
    }
    else if (currentTool === 'line') {
                isDrawingInfinityLine = true; lineStartPoint = pos; 
        redrawAllStrokes(); drawDot(pos, currentLineColor);
    }
    else if (currentTool === 'segment') {
                isDrawingSegment = true; lineStartPoint = snapPos; 
        redrawAllStrokes(); drawDot(snapPos, currentLineColor);
    }
    else if (currentTool === 'ray') {
                isDrawingRay = true; lineStartPoint = pos; 
        redrawAllStrokes(); drawDot(pos, currentLineColor);
    }
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault(); // Sayfa kaymasını engelle
    
    // -----------------------------------------------------------
    // 1. HESAPLAMA VE SIÇRAMA ÖNLEYİCİ (EN KRİTİK KISIM)
    // -----------------------------------------------------------
    const pos = getEventPosition(e);
    currentMousePos = pos; 
    const endPos = snapTarget || currentMousePos;

    // --- Time Machine: Sıçrama Engelleyici Tampon ---
    if (isDrawing) {
        if (!window.touchHistoryBuffer) window.touchHistoryBuffer = [];
        
        window.touchHistoryBuffer.push({ x: currentMousePos.x, y: currentMousePos.y });
        
        // ÖNCEKİ KODDA BURASI 5 İDİ, ŞİMDİ 12 YAPIYORUZ
        // (Daha geriye gidebilmek için hafızayı arttırdık)
        if (window.touchHistoryBuffer.length > 12) {
            window.touchHistoryBuffer.shift();
        }
    }
    // -----------------------------------------------------------

    // 2. PINCH ZOOM (İKİ PARMAK)
    if (isPinching) {
        const p1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        const p2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };

        const currentDistance = distance(p1, p2);
        const currentCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

        const scaleFactor = currentDistance / initialDistance;
        const newWidth = Math.max(50, initialScale * scaleFactor);
        const newHeight = selectedItem.height * (newWidth / selectedItem.width); 

        const dx_center = currentCenter.x - initialCenter.x;
        const dy_center = currentCenter.y - initialCenter.y;

        selectedItem.width = newWidth;
        selectedItem.height = newHeight;
        selectedItem.x = originalStartPos.x + dx_center;
        selectedItem.y = originalStartPos.y + dy_center;

        redrawAllStrokes();
        return;
    }

    // 3. SNAPSHOT (EKRAN GÖRÜNTÜSÜ) ÖNİZLEME
    else if (currentTool === 'snapshot' && snapshotStart) {
        redrawAllStrokes(); 
        const w = currentMousePos.x - snapshotStart.x;
        const h = currentMousePos.y - snapshotStart.y;
        
        ctx.save();
        ctx.setLineDash([5, 5]); 
        ctx.strokeStyle = '#FF0000'; 
        ctx.lineWidth = 2;
        ctx.strokeRect(snapshotStart.x, snapshotStart.y, w, h); 
        ctx.restore();
        return; 
    }

    // 4. FİZİKİ ARAÇ ENGELLEYİCİLERİ
    // (Buffer yukarıda dolduğu için buradaki return sorun yaratmaz)
    if (currentTool === 'ruler' || currentTool === 'gonye' || currentTool === 'aciolcer' || currentTool === 'pergel') return;
    if (currentTool === 'none') return;

    // 5. TAŞIMA (MOVE) MANTIĞI
    if (currentTool === 'move' && isMoving) {
        const dx = pos.x - dragStartPos.x;
        const dy = pos.y - dragStartPos.y;
        
        if (selectedPointKey === 'image_resize') {
            const distFromCenterX = Math.abs(pos.x - selectedItem.x);
            const distFromCenterY = Math.abs(pos.y - selectedItem.y);
            selectedItem.width = Math.max(20, distFromCenterX * 2);
            selectedItem.height = Math.max(20, distFromCenterY * 2);
        }
        else if (selectedPointKey === 'rotate') {
            const center = selectedItem.center;
            const r_dx = pos.x - center.x;
            const r_dy = pos.y - center.y;
            const newAngleRad = Math.atan2(r_dy, r_dx); 
            selectedItem.rotation = newAngleRad * (180 / Math.PI);
        } 
        else if (selectedPointKey === 'resize') {
            const center = selectedItem.center;
            selectedItem.radius = distance(center, pos);
        } 
        else if (rotationPivot) { 
            const pivot = rotationPivot;
            const movingPointKey = selectedPointKey; 
            const r_dx = pos.x - pivot.x;
            const r_dy = pos.y - pivot.y;
            const currentAngle = Math.atan2(r_dy, r_dx);
            selectedItem[movingPointKey].x = pivot.x + Math.cos(currentAngle) * selectedItem.startRadius;
            selectedItem[movingPointKey].y = pivot.y + Math.sin(currentAngle) * selectedItem.startRadius;
        } 
        else {
            if (selectedPointKey === 'self') { 
                selectedItem.x = originalStartPos.x + dx;
                selectedItem.y = originalStartPos.y + dy;
            } else if (selectedPointKey === 'p1') {
                selectedItem.p1.x = originalStartPos.x + dx;
                selectedItem.p1.y = originalStartPos.y + dy;
            } else if (selectedPointKey === 'p2') {
                selectedItem.p2.x = originalStartPos.x + dx;
                selectedItem.p2.y = originalStartPos.y + dy;
            } else if (selectedPointKey === 'center') {
                if (selectedItem.type === 'arc') {
                    selectedItem.cx = originalStartPos.x + dx;
                    selectedItem.cy = originalStartPos.y + dy;
                } else if (selectedItem.type === 'polygon') {
                     selectedItem.center.x = originalStartPos.x + dx;
                     selectedItem.center.y = originalStartPos.y + dy;
                }
            }
        }
        redrawAllStrokes();
        return; 
    }

    // 6. AKILLI YAKALAMA (SNAP)
    let snapTargetLocal = null;
    const canSnap = (currentTool === 'point' || currentTool === 'straightLine' || currentTool === 'pen' || currentTool === 'segment' || currentTool.startsWith('draw_polygon_'));
    if (canSnap) {
        snapTargetLocal = findSnapPoint(pos);
        if (snapTargetLocal) { 
            snapIndicator.style.left = `${snapTargetLocal.x}px`; 
            snapIndicator.style.top = `${snapTargetLocal.y}px`; 
            snapIndicator.style.display = 'block'; 
            snapTarget = snapTargetLocal; 
        } else { 
            snapIndicator.style.display = 'none'; 
            snapTarget = null;
        }
    } else {
        snapTarget = null;
        snapIndicator.style.display = 'none';
    }

    // 7. CANLI ÖNİZLEMELER (Lines, Polygons vb.)
    let previewActive = false;
    ctx.globalAlpha = 0.6; 
    ctx.setLineDash([10, 5]);

    const drawEndPos = snapTarget || pos;

    if (currentTool === 'straightLine' && isDrawingLine) {
        redrawAllStrokes(); ctx.beginPath();
        ctx.moveTo(lineStartPoint.x, lineStartPoint.y); ctx.lineTo(drawEndPos.x, drawEndPos.y);
        ctx.strokeStyle = currentLineColor; ctx.lineWidth = 3; ctx.stroke();
        drawDot(lineStartPoint, currentLineColor); drawDot(drawEndPos, currentLineColor);
        previewActive = true; 
    }
    else if (currentTool === 'line' && isDrawingInfinityLine) {
        redrawAllStrokes();
        drawInfinityLine(lineStartPoint, pos, currentLineColor, 3, false);
        drawDot(lineStartPoint, currentLineColor); drawDot(pos, currentLineColor);
        previewActive = true;
    }
    else if (currentTool === 'segment' && isDrawingSegment) {
        redrawAllStrokes(); 
        ctx.beginPath(); ctx.moveTo(lineStartPoint.x, lineStartPoint.y); ctx.lineTo(drawEndPos.x, drawEndPos.y);
        ctx.strokeStyle = currentLineColor; ctx.lineWidth = 3; ctx.stroke();
        drawDot(lineStartPoint, currentLineColor); drawDot(drawEndPos, currentLineColor);
        previewActive = true;
    }
    else if (currentTool === 'ray' && isDrawingRay) {
        redrawAllStrokes(); 
        drawInfinityLine(lineStartPoint, pos, currentLineColor, 3, true); 
        drawDot(lineStartPoint, currentLineColor); drawDot(pos, currentLineColor);
        previewActive = true;
    }
    // --- ÇOKGEN ÖNİZLEMESİ (Senin attığın kısım) ---
    else if (window.tempPolygonData && window.tempPolygonData.center) {
        const center = window.tempPolygonData.center;
        const type = window.tempPolygonData.type;
        const currentRadius = distance(center, pos);
        const dx = pos.x - center.x; const dy = pos.y - center.y;
        const currentRotationRad = Math.atan2(dy, dx); 
        const currentRotationDeg = currentRotationRad * (180 / Math.PI); 

        window.tempPolygonData.rotation = currentRotationDeg; 
        window.tempPolygonData.radius = currentRadius; 

        redrawAllStrokes(); 
        
        ctx.beginPath();
        if (type === 0) ctx.arc(center.x, center.y, currentRadius, 0, 2 * Math.PI);
        else {
            const vertices = window.PolygonTool.calculateVertices(center, currentRadius, type, currentRotationDeg); 
            if (vertices.length > 0) {
                 ctx.moveTo(vertices[0].x, vertices[0].y);
                 for (let i = 1; i < vertices.length; i++) ctx.lineTo(vertices[i].x, vertices[i].y);
                 ctx.closePath();
            }
        }
        ctx.strokeStyle = window.currentLineColor; ctx.lineWidth = 3; ctx.stroke();
        drawDot(center, window.currentLineColor);
        previewActive = true; 
        
        polygonPreviewLabel.style.left = `${pos.x}px`;
        polygonPreviewLabel.style.top = `${pos.y - 50}px`;
        polygonPreviewLabel.classList.remove('hidden');
        const cmRadius = (currentRadius / (window.PolygonTool.PIXELS_PER_CM || 30)).toFixed(1);
        let labelText = (type === 0) ? `Yarıçap: ${cmRadius} cm` : `Kenar: ${((2 * currentRadius * Math.sin(Math.PI / type)) / 30).toFixed(1)} cm`;
        polygonPreviewLabel.innerText = labelText;
    }

    ctx.globalAlpha = 1.0; 
    ctx.setLineDash([]); 
    
    // Eğer önizleme yapıldıysa fonksiyondan çık
    if (previewActive) return; 

    // 8. KALEM VE SİLGİ (ÇİZİM AŞAMASI)
    if (!isDrawing) return;
    
    if (currentTool === 'pen') {
        drawnStrokes[drawnStrokes.length - 1].path.push(pos);
        redrawAllStrokes();
    }
    
    // --- SİLGİ ---
    else if (currentTool === 'eraser') {
        let strokesToKeep = [];
        let needsRedraw = false;
        
        for (const stroke of drawnStrokes) {
            let touched = false;

            // Silgi mantığı (Her tür için)
            if (stroke.type === 'pen') {
                for (const point of stroke.path) { 
                    if (distance(point, pos) < 15) { touched = true; break; } 
                }
            } 
            else if (stroke.type === 'point') {
                if (distance(stroke, pos) < 15) { touched = true; }
            } 
            else if (stroke.type === 'straightLine' || stroke.type === 'line' || stroke.type === 'segment' || stroke.type === 'ray') {
                const p1 = stroke.p1; const p2 = stroke.p2;
                const dist = distance(p1, p2);
                const steps = Math.max(1, Math.floor(dist / 5)); 
                for (let i = 0; i <= steps; i++) {
                    const t = i / steps;
                    const sx = p1.x + (p2.x - p1.x) * t;
                    const sy = p1.y + (p2.y - p1.y) * t;
                    if (distance({x: sx, y: sy}, pos) < 15) { touched = true; break; }
                }
            }
            else if (stroke.type === 'arc') {
                const centerPos = { x: stroke.cx, y: stroke.cy };
                if (distance(centerPos, pos) < 15) { touched = true; } 
                else {
                    const steps = 60; 
                    const startRad = stroke.startAngle * (Math.PI / 180);
                    const endRad = stroke.endAngle * (Math.PI / 180);
                    for (let i = 0; i <= steps; i++) {
                        const t = i / steps;
                        const angle = startRad + t * (endRad - startRad);
                        const sx = stroke.cx + stroke.radius * Math.cos(angle);
                        const sy = stroke.cy + stroke.radius * Math.sin(angle);
                        if (distance({x: sx, y: sy}, pos) < 15) { touched = true; break; }
                    }
                }
            }
            else if (stroke.type === 'polygon') {
                if (stroke.center && distance(stroke.center, pos) < 15) { touched = true; } 
                else if (stroke.vertices) {
                    for (const v of stroke.vertices) { 
                        if (distance(v, pos) < 15) { touched = true; break; } 
                    }
                    if (!touched) {
                        for (let j = 0; j < stroke.vertices.length; j++) {
                            const v1 = stroke.vertices[j];
                            const v2 = stroke.vertices[(j + 1) % stroke.vertices.length];
                            const distV = distance(v1, v2);
                            const steps = Math.max(1, Math.floor(distV / 5));
                            for (let i = 0; i <= steps; i++) {
                                const t = i / steps;
                                const sx = v1.x + (v2.x - v1.x) * t;
                                const sy = v1.y + (v2.y - v1.y) * t;
                                if (distance({x: sx, y: sy}, pos) < 15) { touched = true; break; }
                            }
                            if (touched) break;
                        }
                    }
                }
            } 
            else if (stroke.type === 'image') {
                if (!stroke.isBackground) { 
                    const dx = pos.x - stroke.x;
                    const dy = pos.y - stroke.y;
                    const angleRad = -stroke.rotation * (Math.PI / 180);
                    const localX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
                    const localY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);
                    if (localX > -stroke.width/2 && localX < stroke.width/2 && localY > -stroke.height/2 && localY < stroke.height/2) {
                        touched = true;
                    }
                }
            }

            if (touched) {
                needsRedraw = true;
                try { if (window.audio_click) { window.audio_click.currentTime = 0; window.audio_click.play(); } } catch(e){}
            } else {
                strokesToKeep.push(stroke);
            }
        }

        if (needsRedraw) {
            drawnStrokes = strokesToKeep; 
            window.drawnStrokes = strokesToKeep;
            redrawAllStrokes(); 
        }
    }

}); 


// <-- FONKSİYON BURADA SAĞLAM ŞEKİLDE KAPANIYOR
canvas.addEventListener('touchend', (e) => { 
    if (e && e.cancelable) e.preventDefault();

    // =========================================================================
    // 1. ADIM: AKILLI SIÇRAMA ENGELLEYİCİ (KALEM KORUMALI)
    // =========================================================================
    
    let finalSafePos = currentMousePos;
    const buffer = window.touchHistoryBuffer;

    // KURAL: Eğer araç KALEM (Pen) ise ASLA geriye sarma! Olduğu gibi bırak.
    // Çünkü kalemle yazı yazarken son milisaniyeler önemlidir.
    if (currentTool === 'pen') {
        // Kalemde son konum neyse o kalır, müdahale etme.
        if (buffer && buffer.length > 0) {
            finalSafePos = buffer[buffer.length - 1]; // En son nokta
        }
    } 
    // Diğer araçlar (Cetvel, Gönye, Taşıma vb.) için geriye sar (Zıplamayı önle)
    else {
        if (buffer && buffer.length >= 6) {
            // 6 kare geriye git (Tutamaçları sabitler)
            finalSafePos = buffer[buffer.length - 6]; 
        } 
        else if (buffer && buffer.length > 0) {
            finalSafePos = buffer[0];
        }
    }

    // Karar verilen güvenli konumu kullan
    const endPos = snapTarget || finalSafePos;

    // Buffer'ı temizle
    window.touchHistoryBuffer = [];
    
    // ... (Kodun geri kalanı aynen devam eder: Snapshot, Ruler vb.) ...


// --- 3. KOPYALAMA İŞLEMİ (DOKUNMATİK BİTİŞ) ---
    if (currentTool === 'snapshot' && snapshotStart) {
        // --- ESKİ 'const endPos...' SATIRINI SİL, YERİNE BUNU YAPIŞTIR ---

    let finalPosition = currentMousePos;

    // Eğer çizim yapıldıysa ve elimizde güvenli bir yedek konum varsa onu kullan
    // (Tabletin uydurduğu son sıçrama noktasını kullanma)
    if (window.lastValidDrawPos && window.lastValidDrawPos.x !== 0) {
        finalPosition = window.lastValidDrawPos;
    }

    // snapTarget (mıknatıs) varsa öncelik onundur, yoksa güvenli konumu al
    const endPos = snapTarget || finalPosition;

// ---------------------------------------------------------------
// (Kodun geri kalanı aynen devam eder: if (isDrawingLine && lineStartPoint) ... )
        
        // Seçilen alanı hesapla
        let rawX = Math.min(snapshotStart.x, endPos.x);
        let rawY = Math.min(snapshotStart.y, endPos.y);
        let rawW = Math.abs(endPos.x - snapshotStart.x);
        let rawH = Math.abs(endPos.y - snapshotStart.y);

        // Çok küçük dokunuşları yoksay
        if (rawW > 10 && rawH > 10) {
            redrawAllStrokes(); // Kutuyu sil

            // O bölgenin görüntüsünü al
            const imageData = ctx.getImageData(rawX, rawY, rawW, rawH);
            const data = imageData.data;

            // --- SİHİRLİ DÖNGÜ: BEYAZLARI TEMİZLE ---
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i + 1], b = data[i + 2];
                if (r > 230 && g > 230 && b > 230) { // Beyaza yakınsa
                    data[i + 3] = 0; // Görünmez yap
                }
            }

            // Yeni resim oluştur
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = rawW;
            tempCanvas.height = rawH;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(imageData, 0, 0);
            
            const newImg = new Image();
            newImg.src = tempCanvas.toDataURL();
            
            newImg.onload = () => {
                const newObj = {
                    type: 'image',
                    img: newImg,
                    x: rawX + rawW / 2, 
                    y: rawY + rawH / 2,
                    width: rawW,
                    height: rawH,
                    rotation: 0
                };
                
                drawnStrokes.push(newObj);

                // OTOMATİK TAŞIMA MODUNA GEÇ
                snapshotStart = null;
                setActiveTool('move'); 
                selectedItem = newObj;
                isMoving = false; 
                
                // Sürükleme bitince geri dönmesi için işaret koy
                returnToSnapshot = true; 
                
                redrawAllStrokes();
                if (window.audio_click) window.audio_click.play();
            };
        }
        
        snapshotStart = null;
        return;
    }

// --- app.js: touchend içine (En başa) ekleyin ---

    // 3. AKILLI KIRPMA ve TEMİZLEME (DOKUNMATİK BİTİŞ)
    if (currentTool === 'snapshot' && snapshotStart) {
        
        
        // 1. Kullanıcının çizdiği kaba kutuyu al
        let rawX = Math.min(snapshotStart.x, endPos.x);
        let rawY = Math.min(snapshotStart.y, endPos.y);
        let rawW = Math.abs(endPos.x - snapshotStart.x);
        let rawH = Math.abs(endPos.y - snapshotStart.y);

        // Çok küçük dokunuşları yoksay
        if (rawW > 10 && rawH > 10) {
            redrawAllStrokes(); // Kutuyu ekrandan sil

            // 2. O bölgenin ham verisini al
            const imageData = ctx.getImageData(rawX, rawY, rawW, rawH);
            const data = imageData.data;

            // --- AKILLI ALGORİTMA: Şeklin Gerçek Sınırlarını Bul ---
            let minX = rawW, minY = rawH, maxX = 0, maxY = 0;
            let found = false;

            // Tüm pikselleri tara ve dolu (beyaz olmayan) yerleri bul
            for (let y = 0; y < rawH; y++) {
                for (let x = 0; x < rawW; x++) {
                    const i = (y * rawW + x) * 4;
                    const r = data[i], g = data[i+1], b = data[i+2];

                    // Beyaz değilse (yani bir şekil/yazı ise)
                    if (r < 240 || g < 240 || b < 240) { 
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                        found = true;
                    } else {
                        // Beyazsa şeffaf yap (Temizleme işlemi)
                        data[i + 3] = 0; 
                    }
                }
            }

            // Eğer boş bir yer seçildiyse işlem yapma
            if (!found) { snapshotStart = null; return; }

            // 3. Sadece dolu kısmı kesip al (Trim)
            const realW = maxX - minX + 1;
            const realH = maxY - minY + 1;
            
            // Boşlukları atılmış yeni bir tuval oluştur
            const cutCanvas = document.createElement('canvas');
            cutCanvas.width = realW;
            cutCanvas.height = realH;
            const cutCtx = cutCanvas.getContext('2d');

            // Oraya temizlenmiş veriyi yapıştır
            cutCtx.putImageData(imageData, -minX, -minY); 

            // 4. Resme çevir ve sahneye ekle
            const newImg = new Image();
            newImg.src = cutCanvas.toDataURL();
            
            newImg.onload = () => {
                const newObj = {
                    type: 'image',
                    img: newImg,
                    x: rawX + minX + realW / 2, 
                    y: rawY + minY + realH / 2,
                    width: realW,
                    height: realH,
                    rotation: 0
                };
                
                drawnStrokes.push(newObj);

                // Otomatik Taşıma Moduna Geç
                snapshotStart = null;
                setActiveTool('move'); 
                selectedItem = newObj;
                isMoving = false; // Kendimiz tutacağız
                
                // Geri dönüş biletini hazırla
                if (typeof returnToSnapshot !== 'undefined') {
                    returnToSnapshot = true; 
                }
                
                redrawAllStrokes();
                
                if (window.audio_click) window.audio_click.play();
            };
        }
        
        snapshotStart = null;
        return;
    }

if (isPinching) {
    isPinching = false;
    isMoving = false; // Zoom bitince taşıma da bitsin

    // Güncel boyutları kaydet (Aksi halde bir sonraki taşıma bozulur)
    selectedItem.originalWidth = selectedItem.width;
    selectedItem.originalHeight = selectedItem.height;

    redrawAllStrokes();
    return;
}
if (currentTool === 'ruler' || currentTool === 'gonye' || currentTool === 'aciolcer' || currentTool === 'pergel') {
    // 1. Hayalet olayları engelle
    if (e && e.cancelable) e.preventDefault();
    
    // 2. TÜM HAREKET BAYRAKLARINI ZORLA İNDİR
    isDrawing = false;
    isMoving = false;      
    if (typeof isRotating !== 'undefined') isRotating = false;   
    if (typeof isResizing !== 'undefined') isResizing = false;   
    
    // 3. Çizim yolunu kapat (Sıçramayı keser)
    if (ctx) ctx.beginPath();
    
    // 4. Son durumu ekrana çiz
    redrawAllStrokes(); 
    
    return;
}
    // 1. Taşıma Durdur
    if (currentTool === 'move' && isMoving) {
        
        isMoving = false;
        selectedPointKey = null;
        rotationPivot = null;
        originalStartPos = {};

        // --- YENİ EKLENEN: OTOMATİK GERİ DÖNÜŞ ---
        
        
        // ----------------------------------------
        
        return;
    }

// --- SİHİRLİ KOPYALAMA (BİTİŞ) ---
    if (currentTool === 'snapshot' && snapshotStart) {
        const endPos = snapTarget || currentMousePos;
        
        let x = Math.min(snapshotStart.x, endPos.x);
        let y = Math.min(snapshotStart.y, endPos.y);
        let w = Math.abs(endPos.x - snapshotStart.x);
        let h = Math.abs(endPos.y - snapshotStart.y);

        // Yanlışlıkla tıklamaları engelle (Min 10px)
        if (w > 10 && h > 10) {
            redrawAllStrokes(); // Kutuyu sil, temiz görüntüyü al

            // 1. Bölgenin piksellerini al
            const imageData = ctx.getImageData(x, y, w, h);
            const data = imageData.data;

            // --- SİHİRLİ DÖNGÜ: Beyazları Şeffaf Yap ---
            // Her pikseli kontrol et (R, G, B, Alpha)
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                // Eğer renk beyaza çok yakınsa (Kağıt rengi)
                if (r > 230 && g > 230 && b > 230) {
                    data[i + 3] = 0; // Görünmez yap (Alpha = 0)
                }
            }

            // 2. Temizlenmiş veriyi geçici tuvale koy
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = w;
            tempCanvas.height = h;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(imageData, 0, 0);
            
            // 3. Resme çevir ve sahneye ekle
            const newImg = new Image();
            newImg.src = tempCanvas.toDataURL();
            
            newImg.onload = () => {
                const newObj = {
                    type: 'image',
                    img: newImg,
                    x: x + w / 2, 
                    y: y + h / 2,
                    width: w,
                    height: h,
                    rotation: 0
                };
                
                drawnStrokes.push(newObj);
// --- GÜNCELLENEN KISIM BAŞLANGIÇ ---
                
                snapshotStart = null;
                
                // 1. Taşıma moduna geç (Parçayı tutabilmek için)
                setActiveTool('move'); 
                
                // 2. Yeni parçayı seçili yap ama sürüklemeyi başlatma (Siz tutacaksınız)
                selectedItem = newObj;
                isMoving = false; // <-- Otomatik yapışmasın, siz tutun
                
                // 3. "İş bitince beni geri döndür" notunu bırak
                returnToSnapshot = true; 
                
                // --- GÜNCELLENEN KISIM BİTİŞ ---                                
                redrawAllStrokes();
                
                if (window.audio_click) {
                    window.audio_click.currentTime = 0;
                    window.audio_click.play();
                }
            };
        }
        
        snapshotStart = null;
        return;
    }

    // 2. Silgi Temizle
    if (currentTool === 'eraser') {
        
        isDrawing = false; setActiveTool('none'); return; 
    }

   

    // --- ÇİZGİLERİ KAYDET ---
    if (isDrawingLine && lineStartPoint) {
        try { if (window.audio_draw) { window.audio_draw.pause(); window.audio_draw.currentTime = 0; } } catch(e){}
        drawnStrokes.push({ type: 'straightLine', p1: lineStartPoint, p2: endPos, color: currentLineColor, width: 3 });
        isDrawingLine = false; lineStartPoint = null; redrawAllStrokes();
    }
    else if (isDrawingInfinityLine && lineStartPoint) {
        try { if (window.audio_draw) { window.audio_draw.pause(); window.audio_draw.currentTime = 0; } } catch(e){}
        const label1 = nextPointChar; const label2 = advanceChar(label1); nextPointChar = advanceChar(label2);
        drawnStrokes.push({ type: 'line', p1: lineStartPoint, p2: endPos, color: currentLineColor, width: 3, label1: label1, label2: label2 });
        isDrawingInfinityLine = false; lineStartPoint = null; redrawAllStrokes();
    }
    else if (isDrawingSegment && lineStartPoint) {
        try { if (window.audio_draw) { window.audio_draw.pause(); window.audio_draw.currentTime = 0; } } catch(e){}
        const label1 = nextPointChar; const label2 = advanceChar(label1); nextPointChar = advanceChar(label2);
        drawnStrokes.push({ type: 'segment', p1: lineStartPoint, p2: endPos, color: currentLineColor, width: 3, label1: label1, label2: label2 });
        isDrawingSegment = false; lineStartPoint = null; redrawAllStrokes();
    }
    else if (isDrawingRay && lineStartPoint) {
        try { if (window.audio_draw) { window.audio_draw.pause(); window.audio_draw.currentTime = 0; } } catch(e){}
        const label1 = nextPointChar; const label2 = advanceChar(label1); nextPointChar = advanceChar(label2);
        drawnStrokes.push({ type: 'ray', p1: lineStartPoint, p2: endPos, color: currentLineColor, width: 3, label1: label1, label2: label2 });
        isDrawingRay = false; lineStartPoint = null; redrawAllStrokes();
    }

    // --- ÇOKGENLERİ KAYDET (Mouse - Sürükle Bırak Modu) ---
    else if (currentTool.startsWith('draw_polygon_')) {
        if (window.tempPolygonData && window.tempPolygonData.center) {
            const finalRadius = window.tempPolygonData.radius || 0;
            const finalRotation = window.tempPolygonData.rotation || 0;
            
            // SADECE EĞER SÜRÜKLEME YAPILDIYSA KAYDET (Yarıçap > 5)
            // Eğer sadece tıkladıysanız (yarıçap küçükse) işlem yapma, 2. tıklamayı bekle.
            if (finalRadius > 5) {
                const currentType = window.tempPolygonData.type;
                
                if (currentType === 0) window.PolygonTool.finalizeCircle(finalRadius);
                else window.PolygonTool.finalizeDraw(finalRadius, finalRotation);
                
                polygonPreviewLabel.classList.add('hidden');
                
                // Hemen yeni bir çizim için hazırlık yap
                window.PolygonTool.handleDrawClick(null, currentType);
                
                
            }
        }
    }

    isDrawing = false;
if (ctx) ctx.beginPath(); 
snapTarget = null; 
snapIndicator.style.display = 'none';
});

// --- TOUCHCANCEL (ARAMA GELİNCE ÇİZİMİ İPTAL ETME) ---
canvas.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    // İşlemi iptal et ve temizle
    isDrawing = false;
    isMoving = false;
    snapshotStart = null;
    snapTarget = null;
    snapIndicator.style.display = 'none';
}, { passive: false });

// --- YAPIŞTIRMA (PASTE) DESTEĞİ (CTRL+V) ---
window.addEventListener('paste', (e) => {
    // Panodaki verileri al
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;

    // Verileri tara (Resim var mı?)
    for (let index in items) {
        const item = items[index];
        
        // Eğer bu bir dosya ise ve tipi 'image' içeriyorsa
        if (item.kind === 'file' && item.type.indexOf('image/') !== -1) {
            const blob = item.getAsFile();
            const reader = new FileReader();

            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    // Resmi makul bir boyuta getir (Dosya yüklemedeki mantığın aynısı)
                    let startWidth = 300; 
                    let scaleFactor = startWidth / img.width;
                    let startHeight = img.height * scaleFactor;

                    // Resmi Hafızaya 'image' nesnesi olarak ekle
                    drawnStrokes.push({
                        type: 'image',
                        img: img,
                        x: canvas.width / 2, // Ekranın ortasına koy
                        y: canvas.height / 2,
                        width: startWidth,
                        height: startHeight,
                        rotation: 0
                    });

                    redrawAllStrokes(); // Ekrana çiz
                    
                    // İşlem başarılı sesi (İsteğe bağlı)
                    if (window.audio_click) { 
                        window.audio_click.currentTime = 0; 
                        window.audio_click.play(); 
                    }
                };
                img.src = event.target.result;
            };
            
            reader.readAsDataURL(blob);
            e.preventDefault(); // Sayfanın varsayılan yapıştırma davranışını engelle
        }
    }
});

// --- app.js EN ALTINA EKLEYİN (EKSİK OLAN PARÇALAR) ---

function updatePageLabel() {
    if(pageCountLabel) pageCountLabel.innerText = `Sayfa: ${currentPDFPage} / ${totalPDFPages}`;
}

// Belirli bir sayfayı render et ve ekrandaki nesneyi güncelle
async function renderPDFPage(num) {
    if (!currentPDF) return;
    
    updatePageLabel();
    
    const page = await currentPDF.getPage(num);
    // Kalite Ayarı (4.0 = Yüksek Kalite)
    const viewport = page.getViewport({ scale: 4.0 }); 

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.height = viewport.height;
    tempCanvas.width = viewport.width;

    await page.render({
        canvasContext: tempCtx,
        viewport: viewport
    }).promise;

    const img = new Image();
    img.onload = () => {
        // EĞER ekranda zaten bir PDF sayfası varsa, onun RESMİNİ değiştir (Konumunu koru)
        if (pdfImageStroke && drawnStrokes.includes(pdfImageStroke)) {
            pdfImageStroke.img = img; // Sadece resmi güncelle
            redrawAllStrokes();
        } else {
            // Ekranda yoksa (ilk kez veya silinmişse) yeni ekle
            addNewImageToCanvas(img, true);
        }
    };
    img.src = tempCanvas.toDataURL();
}

// --- app.js İÇİNDEKİ addNewImageToCanvas FONKSİYONU ---

function addNewImageToCanvas(img, isPDF = false) {
    let startWidth = 400; 
    if (img.width < 400) startWidth = img.width;
    
    let scaleFactor = startWidth / img.width;
    let startHeight = img.height * scaleFactor;

    const newStroke = {
        type: 'image',
        img: img, 
        x: canvas.width / 2,
        y: canvas.height / 2,
        width: startWidth,
        height: startHeight,
        rotation: 0,
        isBackground: true // <--- BU SATIR ÇOK ÖNEMLİ (SİLMEK İÇİN GEREKLİ)
    };
    
    // Listeye ekle
    drawnStrokes.push(newStroke);
    
    // Eğer bu bir PDF ise, referansını sakla
    if (isPDF) {
        pdfImageStroke = newStroke;
        // PDF yüklendiğinde kapatma butonunu GÖSTER
        const closeBtn = document.getElementById('btn-close-pdf');
        if(closeBtn) closeBtn.classList.remove('hidden');
    }
    
    redrawAllStrokes();
}

// --- ARAÇ RENGİ DEĞİŞTİRME MANTIĞI (SİYAH / NEON / TOK MAVİ) ---
const toolColorBtn = document.getElementById('btn-tool-color');
let isBlackTheme = false;
window.isToolThemeBlack = false; // Diğer dosyalar için global değişken

if (toolColorBtn) {
    toolColorBtn.addEventListener('click', () => {
        isBlackTheme = !isBlackTheme;
        window.isToolThemeBlack = isBlackTheme; // Durumu kaydet
        
        // Buton yazısını güncelle
        toolColorBtn.innerText = isBlackTheme ? "Araç Rengi: Neon" : "Araç Rengi: Siyah";
        
        // O an ekranda açık olan tüm fiziksel araçları bul ve rengini değiştir
        const elements = document.querySelectorAll('.ruler-container, .gonye-container, .aciolcer-container, #compass-container');
        
        elements.forEach(el => {
            if (isBlackTheme) {
                el.classList.add('tool-black-theme');
            } else {
                el.classList.remove('tool-black-theme');
            }
        });
    });
}

// --- ARAÇLAR AÇILDIĞINDA RENGİ HATIRLA (YAMA) ---
// Sayfa tamamen yüklendikten sonra araçların 'show' fonksiyonlarına ekleme yapıyoruz
window.addEventListener('load', () => {
    const toolsList = [
        { objName: 'RulerTool', elementProp: 'rulerElement' },
        { objName: 'GonyeTool', elementProp: 'gonyeElement' },
        { objName: 'AciolcerTool', elementProp: 'aciolcerElement' },
        { objName: 'PergelTool', elementProp: 'pergelElement' }
    ];

    toolsList.forEach(toolInfo => {
        const toolObj = window[toolInfo.objName];
        if (toolObj && toolObj.show) {
            // Orijinal show fonksiyonunu sakla
            const originalShow = toolObj.show.bind(toolObj);
            
            // Yeni show fonksiyonu tanımla
            toolObj.show = function() {
                originalShow(); // Önce normal açılma işlemini yap
                
                // Sonra tema rengini kontrol et ve uygula
                if (this[toolInfo.elementProp]) {
                    if (window.isToolThemeBlack) {
                        this[toolInfo.elementProp].classList.add('tool-black-theme');
                    } else {
                        this[toolInfo.elementProp].classList.remove('tool-black-theme');
                    }
                }
            };
        }
    });
});

// --- YARDIM VİDEOLARI SİSTEMİ ---

// 1. VİDEO LİSTESİ (Burayı kendi dosya isimlerine göre düzenle)
const tutorialVideos = [
    { baslik: "Cetvel Kullanımı", dosya: "cetvel-vid.mp4" },
    { baslik: "Gönye Kullanımı", dosya: "gonye-vid.mp4" },
    { baslik: "Açı Ölçer Kullanımı", dosya: "aciolcer-vid.mp4" },
    { baslik: "Pergel Kullanımı", dosya: "pergel-vid.mp4" },
    { baslik: "Canlandırma (Kopyalama)", dosya: "canlandir-vid.mp4" },
    { baslik: "Cizgi Menusu Kullanımı", dosya: "cizgi-vid.mp4" },
    { baslik: "Cokgenler", dosya: "cokgenler-vid.mp4" },
    { baslik: "Kalem", dosya: "kalem-vid.mp4" },
    { baslik: "Kitap v resim yukleme", dosya: "kitap-yukleme-vid.mp4" },
    { baslik: "Oyunlar", dosya: "oyunlar-vid.mp4" }
];

// Elementleri Seç
const helpBtn = document.getElementById('btn-help');
const helpModal = document.getElementById('help-modal');
const closeHelpBtn = document.getElementById('close-help');
const videoListContainer = document.getElementById('video-list-container');
const videoPlayer = document.getElementById('main-video-player');
const videoTitleLabel = document.getElementById('video-title-label');

// Listeyi Oluştur
function loadVideoList() {
    videoListContainer.innerHTML = ''; 
    tutorialVideos.forEach((vid) => {
        const btn = document.createElement('button');
        btn.className = 'video-item-btn';
        btn.innerText = `▶ ${vid.baslik}`;
        btn.onclick = () => {
            // Tüm butonların rengini sıfırla, buna renk ver
            document.querySelectorAll('.video-item-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Videoyu oynat (GitHub klasör adı: videolar)
            videoPlayer.src = `videolar/${vid.dosya}`;
            videoTitleLabel.innerText = vid.baslik;
            videoPlayer.play();
        };
        videoListContainer.appendChild(btn);
    });
}

// Açma/Kapama Olayları
if (helpBtn && helpModal) {
    helpBtn.addEventListener('click', () => {
        helpModal.classList.remove('hidden');
        loadVideoList();
    });

    closeHelpBtn.addEventListener('click', () => {
        helpModal.classList.add('hidden');
        videoPlayer.pause();
        videoPlayer.src = ""; // Videoyu durdur ve sıfırla
    });
}

// --- KESİN ÇÖZÜM: PDF KAPATMA BUTONU (Global Dinleyici) ---

document.addEventListener('click', function(e) {
    // Tıklanan öğe bizim kırmızı buton mu (veya içindeki X işareti mi)?
    const btn = e.target.closest('#btn-close-pdf');

    if (btn) {
        // Evet, butona basıldı!
        console.log("PDF Kapatılıyor..."); // Kontrol için konsola yazar
        
        // 1. Tıklamanın arkadaki Canvas'a geçmesini engelle
        e.preventDefault();
        e.stopPropagation();

        // 2. Listeden 'isBackground' olanları (PDF/Resim) temizle
        if (window.drawnStrokes) {
            window.drawnStrokes = window.drawnStrokes.filter(stroke => stroke.isBackground !== true);
            // Yerel değişkeni de güncelle
            if (typeof drawnStrokes !== 'undefined') drawnStrokes = window.drawnStrokes;
        }

        // 3. PDF Değişkenlerini Sıfırla (Hata vermemesi için kontrollerle)
        if (typeof currentPDF !== 'undefined') currentPDF = null;
        if (typeof pdfImageStroke !== 'undefined') pdfImageStroke = null;
        if (typeof currentPDFPage !== 'undefined') currentPDFPage = 1;
        if (typeof totalPDFPages !== 'undefined') totalPDFPages = 0;
        if (typeof backgroundImage !== 'undefined') backgroundImage = null;

        // 4. Sayfa Değiştirme Butonlarını Gizle
        const controls = document.getElementById('pdf-controls');
        if (controls) {
            controls.classList.add('hidden');
            controls.style.display = 'none';
        }

        // 5. Kırmızı Butonu Gizle
        btn.classList.add('hidden');

        // 6. Ekranı Temizle ve Kalanları (Çizimleri) Yeniden Çiz
        if (typeof redrawAllStrokes === 'function') {
            const canvas = document.getElementById('drawing-canvas');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            redrawAllStrokes();
        }
        
        // 7. Ses Efekti
        try {
            if (window.audio_click) {
                window.audio_click.currentTime = 0;
                window.audio_click.play();
            }
        } catch(err) {}
    }
}, true); 


// 'true' parametresi olayı en başta yakalamasını sağlar (Capture Phase)
// --- BAŞLANGIÇ ---
// --- AKILLI EKRAN BOYUTLANDIRMA (ADRES ÇUBUĞU ZIPLAMASINI ENGELLER) ---
let lastWindowWidth = window.innerWidth;

// --- EKRAN BOYUTLANDIRMA (KESİN UYUM) ---
function resizeCanvas() {
    // Tarayıcının iç genişlik ve yüksekliğini al
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Canvas'ın HTML özelliğini (iç çözünürlüğünü) güncelle
    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        
        // Boyut değişince çizimler silinir, onları tekrar çiz
        redrawAllStrokes();
    }
}

// Hem yüklenince, hem ekran dönünce, hem de adres çubuğu oynayınca çalıştır
window.addEventListener('load', resizeCanvas);
window.addEventListener('resize', resizeCanvas);
// DÜZELTME: Fiziksel araçların (Cetvel vb.) butonlarından parmak çekince oluşan zıplamayı engelle
document.addEventListener('touchend', (e) => {
    if (e.target.closest('.ruler-container, .gonye-container, .aciolcer-container, #compass-container')) {
        e.preventDefault();
    }
}, { passive: false });

window.addEventListener('orientationchange', () => {
    setTimeout(resizeCanvas, 200); // Ekran dönmesi bitince çalıştır
});

// Mobil tarayıcılarda adres çubuğu gizlenince oluşan boşluğu doldurmak için:
setInterval(() => {
    if (Math.abs(canvas.height - window.innerHeight) > 10) {
        resizeCanvas();
    }
}, 1000);

// --- AKILLI PWA YÜKLEME PENCERESİ (HAFIZALI VERSİYON) ---

(function() {
    let deferredPrompt; 
    const popup = document.getElementById('install-popup');
    const installBtn = document.getElementById('btn-popup-install');
    const closeBtn = document.getElementById('btn-popup-close');
    const iosInstructions = document.getElementById('ios-instructions');
    const pwaText = document.getElementById('pwa-text');

    // 1. KONTROL: Uygulama zaten yüklü mü veya "Yüklü" modunda mı çalışıyor?
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    
    // 2. KONTROL: Kullanıcı daha önce "Hayır" dedi mi veya yükledi mi?
    const isDismissed = localStorage.getItem('pwa_popup_seen') === 'true';

    // 3. Cihaz iOS mu?
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    // --- EĞER UYGULAMA YÜKLÜYSE VEYA REDDEDİLDİYSE HİÇBİR ŞEY YAPMA ---
    if (isStandalone || isDismissed) {
        return; // Kod buradan aşağıya inmez, pencere açılmaz.
    }

    // --- SENARYO 1: ANDROID / HARMONYOS / CHROME ---
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault(); 
        deferredPrompt = e; 
        
        // Şartlar uygunsa pencereyi aç
        popup.style.display = 'flex';
    });

    // --- SENARYO 2: IOS (IPAD/IPHONE) ---
    if (isIos && !isStandalone) {
        setTimeout(() => {
            popup.style.display = 'flex';
        }, 1000);
    }

    // --- BUTON İŞLEMLERİ ---

    // 1. "Evet, İndir" Butonu
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            
            // A) Android/HarmonyOS
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                
                // Eğer kullanıcı kabul ederse hafızaya al ve bir daha sorma
                if (outcome === 'accepted') {
                    localStorage.setItem('pwa_popup_seen', 'true'); // <--- HAFIZAYA KAYDET
                    popup.style.display = 'none';
                }
                deferredPrompt = null;
            }
            // B) iOS
            else if (isIos) {
                pwaText.style.display = 'none'; 
                iosInstructions.style.display = 'block'; 
                installBtn.style.display = 'none'; 
                closeBtn.innerText = "Tamam, Anladım"; 
            }
        });
    }

    // 2. "Hayır / Kapat" Butonu
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            // Kullanıcı "Hayır" dedi, bunu hafızaya yaz ve bir daha sorma
            localStorage.setItem('pwa_popup_seen', 'true'); // <--- HAFIZAYA KAYDET
            popup.style.display = 'none';
        });
    }

    // 3. Uygulama Yüklendiği Anda
    window.addEventListener('appinstalled', () => {
        localStorage.setItem('pwa_popup_seen', 'true'); // <--- HAFIZAYA KAYDET
        popup.style.display = 'none';
        deferredPrompt = null;
    });

})();