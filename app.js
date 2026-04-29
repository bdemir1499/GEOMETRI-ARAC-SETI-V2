// app.js dosyasının başına ekle
function getGlobalCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}


// --- 3. ADIM: TAHTA (KISA LİNK) GİRİŞ KONTROLÜ ---
const urlParams = new URLSearchParams(window.location.search);
const odaPin = urlParams.get('oda');

if (odaPin) {
    console.log("Tahta Modu Aktif! Oda PIN:", odaPin);
    
    // Tahta tarafında arayüzü sadeleştir (İsteğe bağlı CSS için)
    document.body.classList.add('tahta-modu');
    
    // Sayfa yüklendiğinde Firebase'den kontrol et
    window.addEventListener('load', () => {
        // Firebase kütüphanesinin yüklenmesini bekle
        const checkFirebase = setInterval(() => {
            if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
                clearInterval(checkFirebase);
                const database = firebase.database();
                
                database.ref('odalar/' + odaPin).once('value', (snapshot) => {
                    if (!snapshot.exists()) {
                        alert("Bu kodun süresi dolmuş veya hatalı! Lütfen tekrar kod alın.");
                        window.location.href = "index.html"; 
                    } else {
                        // Oda varsa, başlangıç sayfasını hafızaya al
                        window.bekleyenSayfa = snapshot.val().sayfaNo || 1;
                    }
                });
            }
        }, 500);
    });
}
// ----------------------------------------------

function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}


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

function getEventPosition(e) {
    if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
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
            
            // Eğer "Taşı" aracı seçiliyse etrafına kutu ve kulpları çiz
            if (currentTool === 'move' && selectedItem === stroke) {
                // 1. Kesikli Çerçeve
                ctx.strokeStyle = '#00FFCC';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(-stroke.width / 2, -stroke.height / 2, stroke.width, stroke.height);
                ctx.setLineDash([]);

                // 2. Sağ Alt Köşe: Boyutlandırma Kulpu (Pembe)
                ctx.beginPath();
                ctx.arc(stroke.width / 2, stroke.height / 2, 10, 0, 2 * Math.PI);
                ctx.fillStyle = '#FF00FF';
                ctx.fill();
                ctx.stroke();

                // 3. YENİ: Üst Orta: Döndürme Kulpu (Altın Sarısı)
                // Çerçevenin 30 piksel üzerine bir çubuk uzatıyoruz
                const handleDist = stroke.height / 2 + 30; 
                
                ctx.beginPath();
                ctx.moveTo(0, -stroke.height / 2); // Çerçeveden başla
                ctx.lineTo(0, -handleDist); // Yukarı çık
                ctx.strokeStyle = '#00FFCC';
                ctx.stroke();

                // Altın Topuz
                ctx.beginPath();
                ctx.arc(0, -handleDist, 12, 0, 2 * Math.PI); 
                ctx.fillStyle = '#FFD700'; // Altın Rengi
                ctx.fill();
                ctx.stroke();
                
                // İçine Dönüş Sembolü (↻)
                ctx.fillStyle = '#000';
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('↻', 0, -handleDist + 1);
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
            const halfW = stroke.width / 2;
            const halfH = stroke.height / 2;
            const angleRad = stroke.rotation * (Math.PI / 180);

            // --- A. DÖNDÜRME KULPU (Rotate Handle) ALGILAMA ---
            // Kulp, merkezin "yukarısında" (local Y = -handleDist)
            const handleDist = halfH + 30;
            
            // Kulpun dünya üzerindeki gerçek yerini hesapla (Trigonometri)
            const rotX = stroke.x + Math.sin(angleRad) * handleDist;
            const rotY = stroke.y - Math.cos(angleRad) * handleDist;

            // Eğer bu noktaya yakın tıklanırsa:
            if (distance(pos, {x: rotX, y: rotY}) < 25) {
                return { item: stroke, pointKey: 'image_rotate' }; // Yeni Anahtar
            }

            // --- B. BOYUTLANDIRMA KULPU (Resize Handle) ---
            // Sağ alt köşe (Local: halfW, halfH) döndürülmüş hali
            const resLocalX = halfW * Math.cos(angleRad) - halfH * Math.sin(angleRad);
            const resLocalY = halfW * Math.sin(angleRad) + halfH * Math.cos(angleRad);
            const resX = stroke.x + resLocalX;
            const resY = stroke.y + resLocalY;

            if (distance(pos, {x: resX, y: resY}) < 25) {
                return { item: stroke, pointKey: 'image_resize' };
            }

            // --- C. RESİM GÖVDESİ (Taşıma) ---
            // Tıklanan noktanın, resmin dönüş açısına göre "içerde" olup olmadığına bak
            const dx = pos.x - stroke.x;
            const dy = pos.y - stroke.y;
            // Ters açı ile döndürerek kontrol et
            const localClickX = dx * Math.cos(-angleRad) - dy * Math.sin(-angleRad);
            const localClickY = dx * Math.sin(-angleRad) + dy * Math.cos(-angleRad);

            if (localClickX > -halfW && localClickX < halfW && localClickY > -halfH && localClickY < halfH) {
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
                    // PDF kapatma butonunu da göster
const closePdfBtn = document.getElementById('btn-close-pdf');
if (closePdfBtn) {
  closePdfBtn.classList.remove('hidden');
  closePdfBtn.style.display = 'flex';

  // Kapatma işlevi
  closePdfBtn.onclick = () => {
    pdfControls.classList.add('hidden');
    closePdfBtn.classList.add('hidden');
    currentPDF = null; // PDF’i sıfırla
    ctx.clearRect(0, 0, canvas.width, canvas.height); // PDF görüntüsünü temizle
    redrawAllStrokes(); // Çizimleri yeniden çiz
  };
}

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
// PDF/Resim için ortak "PDF kapat" butonunu göster ve handler ekle
const closePdfBtn = document.getElementById('btn-close-pdf');
if (closePdfBtn) {
  // Önce gizli sınıfı kaldır ve mobilde görünür yap
  closePdfBtn.classList.remove('hidden');
  closePdfBtn.style.display = 'flex';

  // Önceki handler varsa kaldır (çift eklenmeyi önlemek için)
  closePdfBtn.onclick = null;
  closePdfBtn.removeEventListener && closePdfBtn.removeEventListener('click', () => {});

  // Yeni kapatma işlevi
  closePdfBtn.onclick = () => {
    // Paneli gizle
    if (pdfControls) pdfControls.classList.add('hidden');
    // Butonu gizle
    closePdfBtn.classList.add('hidden');
    closePdfBtn.style.display = '';

    // Eğer resmi arka plan olarak tutuyorsan onu kaldır veya sıfırla
    // Burada isBackground true olanları tutuyoruz; ihtiyacına göre değiştir
    drawnStrokes = drawnStrokes.filter(s => s.isBackground === true);
    window.drawnStrokes = drawnStrokes;

    // PDF/Resim değişkenlerini sıfırla
    currentPDF = null;
    pdfImageStroke = null;

    // Kanvası temizle ve yeniden çiz
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    redrawAllStrokes();
  };
}

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

canvas.addEventListener('pointerdown', (e) => {
    // 1. Tarayıcıyı sabitle
    if (e.pointerType === 'touch') e.preventDefault();
    canvas.setPointerCapture(e.pointerId);

    // 2. Koordinatları tek seferde al (Zıplamayı bitiren temiz veri)
    const pos = getPointerPos(e); 
    const snapPos = snapTarget || pos;
    currentMousePos = pos; // Mobil için konum bilgisini güncelle

    // --- 1. FİZİKSEL ARAÇ KONTROLÜ ---
    const isToolElementClicked = e.target.closest('.ruler-container, .gonye-container, .aciolcer-container, #compass-container');
    if (isToolElementClicked) { 
        isDrawingLine = isDrawingInfinityLine = isDrawingSegment = isDrawingRay = false;
        lineStartPoint = null;
        window.tempPolygonData = null; 
        polygonPreviewLabel.classList.add('hidden');
        return; 
    }

    // --- 2. "TAŞI" MODU KONTROLÜ ---
    if (currentTool === 'move') {
        // BURADA: getEventPosition(e) yerine en üstteki 'pos'u kullanıyoruz
        const hit = findHit(pos); 
        
        if (hit) {
            // Etiket Aç/Kapat Mantığı (Burası aynı kalıyor)
            if (hit.pointKey === 'toggle_edges') { hit.item.showEdgeLabels = !hit.item.showEdgeLabels; redrawAllStrokes(); return; }
            if (hit.pointKey === 'toggle_angles') { hit.item.showAngleLabels = !hit.item.showAngleLabels; redrawAllStrokes(); return; }
            if (hit.pointKey === 'toggle_circle_info') { hit.item.showCircleInfo = !hit.item.showCircleInfo; redrawAllStrokes(); return; }

            isMoving = true;
            selectedItem = hit.item;
            selectedPointKey = hit.pointKey; 
            dragStartPos = pos; 
            
            // Başlangıç konumlarını kaydet
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
            if (selectedItem) {
                selectedItem.showEdgeLabels = selectedItem.showAngleLabels = selectedItem.showCircleInfo = false;
            }
            selectedItem = null;
            redrawAllStrokes();
        }
    }

    // --- 3. DİĞER ÇİZİM ARAÇLARI KONTROLÜ ---
    if (currentTool === 'none') return;

    // Çizgi menüsü kapatma
    if (['point', 'straightLine', 'line', 'segment', 'ray'].includes(currentTool)) {
        if (lineOptions) { lineOptions.classList.add('hidden'); lineOptions.style.display = 'none'; }
    }

    // CANLANDIRMA BAŞLANGICI (snapshot)
    if (currentTool === 'snapshot') {
        snapshotStart = snapPos; 
        return;
    }

    // ARAÇLARIN BAŞLATILMASI
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
            if (!isDrawingLine) { isDrawingLine = true; lineStartPoint = snapPos; }
            break;
        case 'line':
            if (!isDrawingInfinityLine) { isDrawingInfinityLine = true; lineStartPoint = pos; }
            break;
        case 'segment':
            if (!isDrawingSegment) { isDrawingSegment = true; lineStartPoint = snapPos; }
            break;
        case 'ray':
            if (!isDrawingRay) { isDrawingRay = true; lineStartPoint = pos; }
            break;
        case 'draw_polygon_circle':
        case 'draw_polygon_3_sides':
        case 'draw_polygon_4_sides':
        case 'draw_polygon_5_sides':
        case 'draw_polygon_6_sides':
        case 'draw_polygon_7_sides':
        case 'draw_polygon_8_sides':
            if (window.tempPolygonData && window.tempPolygonData.center === null) {
                 window.tempPolygonData.center = snapPos;
                 window.PolygonTool.state.isDrawing = true; 
                 polygonPreviewLabel.classList.remove('hidden');
            } else if (window.tempPolygonData && window.tempPolygonData.center) {
                const finalRadius = window.tempPolygonData.radius || 0;
                const finalRotation = window.tempPolygonData.rotation || 0;
                const currentType = window.tempPolygonData.type;
                if (currentType === 0) window.PolygonTool.finalizeCircle(finalRadius);
                else window.PolygonTool.finalizeDraw(finalRadius, finalRotation);
                polygonPreviewLabel.classList.add('hidden');
                window.PolygonTool.handleDrawClick(null, currentType);
            }
            break;
    }
}, { passive: false });


canvas.addEventListener('pointermove', (e) => {
    // 1. GÜVENLİK: Sadece ana dokunuşu takip et (Zıplama önleyici)
    if (!e.isPrimary) return; 

    // 2. MERKEZİ KOORDİNAT HESABI: 
    // Tüm proje bu 'pos' değişkenini "tek gerçek" kabul edecek.
    const pos = getPointerPos(e); 
    currentMousePos = pos; // app.js'in geri kalanı için senkronize et

    // --- 1. TAŞIMA (MOVE) MANTIĞI ---
    if (currentTool === 'move' && isMoving) {
        const dx = pos.x - dragStartPos.x;
        const dy = pos.y - dragStartPos.y;
        
        // A. Resim Boyutlandırma (Resize)
        if (selectedPointKey === 'image_resize') {
            const distFromCenterX = Math.abs(pos.x - selectedItem.x);
            const distFromCenterY = Math.abs(pos.y - selectedItem.y);
            selectedItem.width = Math.max(20, distFromCenterX * 2);
            selectedItem.height = Math.max(20, distFromCenterY * 2);
        }
        // B. Resim Döndürme (Rotate)
        else if (selectedPointKey === 'image_rotate') {
             const r_dx = pos.x - selectedItem.x;
             const r_dy = pos.y - selectedItem.y;
             const angleRad = Math.atan2(r_dy, r_dx);
             selectedItem.rotation = angleRad * (180 / Math.PI) + 90;
        }        
        // C. Çokgen Döndürme
        else if (selectedPointKey === 'rotate') {
            const center = selectedItem.center;
            const r_dx = pos.x - center.x;
            const r_dy = pos.y - center.y;
            selectedItem.rotation = Math.atan2(r_dy, r_dx) * (180 / Math.PI);
        } 
        // D. Çokgen/Çember Boyutlandırma
        else if (selectedPointKey === 'resize') {
            selectedItem.radius = distance(selectedItem.center, pos);
        } 
        // E. Çizgi Döndürme (Pivot)
        else if (rotationPivot) { 
            const r_dx = pos.x - rotationPivot.x;
            const r_dy = pos.y - rotationPivot.y;
            const currentAngle = Math.atan2(r_dy, r_dx);
            selectedItem[selectedPointKey].x = rotationPivot.x + Math.cos(currentAngle) * selectedItem.startRadius;
            selectedItem[selectedPointKey].y = rotationPivot.y + Math.sin(currentAngle) * selectedItem.startRadius;
        } 
        // F. Genel Yer Değiştirme (Sürükleme)
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

    // KRİTİK: Fiziksel araçlar çalışırken app.js'in koordinat sistemini meşgul etme!
    const isPhysicalTool = ['ruler', 'gonye', 'aciolcer', 'pergel'].includes(currentTool);
    if (isPhysicalTool) return;
    if (currentTool === 'none') return;

    // --- 2. AKILLI YAKALAMA (SNAP) SİSTEMİ ---
    clearTimeout(snapHoverTimer);
    snapHoverTimer = null;
    
    if (['point', 'straightLine', 'pen', 'segment'].includes(currentTool)) {
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
    }

    // --- 3. SİLGİ ÖNİZLEMESİ ---
    if (currentTool === 'eraser') {
        eraserPreview.style.left = `${pos.x}px`;
        eraserPreview.style.top = `${pos.y}px`;
        eraserPreview.style.display = 'block';
    }

    // --- 4. ÇİZİM ÖN İZLEMELERİ ---
    let previewActive = false;
    const endPos = snapTarget || pos;

    if (isDrawingLine || isDrawingInfinityLine || isDrawingSegment || isDrawingRay) {
        redrawAllStrokes();
        ctx.globalAlpha = 0.6; ctx.setLineDash([8, 4]);
        
        if (currentTool === 'straightLine' || currentTool === 'segment') {
            ctx.beginPath();
            ctx.moveTo(lineStartPoint.x, lineStartPoint.y);
            ctx.lineTo(endPos.x, endPos.y);
            ctx.strokeStyle = currentLineColor; ctx.lineWidth = 3; ctx.stroke();
            if(currentTool === 'segment') { drawDot(lineStartPoint, currentLineColor); drawDot(endPos, currentLineColor); }
        } else if (currentTool === 'line') {
            drawInfinityLine(lineStartPoint, pos, currentLineColor, 3, false);
        } else if (currentTool === 'ray') {
            drawInfinityLine(lineStartPoint, pos, currentLineColor, 3, true);
            drawDot(lineStartPoint, currentLineColor);
        }
        ctx.globalAlpha = 1.0; ctx.setLineDash([]);
        previewActive = true;
    }
    // E. Çokgen ve Çember Önizleme
    else if (window.tempPolygonData && window.tempPolygonData.center) {
        const center = window.tempPolygonData.center;
        const currentRadius = distance(center, pos);
        const currentRotationDeg = Math.atan2(pos.y - center.y, pos.x - center.x) * (180 / Math.PI); 

        window.tempPolygonData.rotation = currentRotationDeg; 
        window.tempPolygonData.radius = currentRadius; 

        redrawAllStrokes(); 
        ctx.globalAlpha = 0.6; ctx.setLineDash([8, 4]);
        ctx.beginPath();
        if (window.tempPolygonData.type === 0) { 
            ctx.arc(center.x, center.y, currentRadius, 0, 2 * Math.PI);
        } else { 
            const vertices = window.PolygonTool.calculateVertices(center, currentRadius, window.tempPolygonData.type, currentRotationDeg); 
            if (vertices.length > 0) {
                 ctx.moveTo(vertices[0].x, vertices[0].y);
                 for (let i = 1; i < vertices.length; i++) ctx.lineTo(vertices[i].x, vertices[i].y);
                 ctx.closePath();
            }
        }
        ctx.strokeStyle = window.currentLineColor; ctx.lineWidth = 3; ctx.stroke();
        drawDot(center, window.currentLineColor);
        
        polygonPreviewLabel.style.left = `${pos.x}px`;
        polygonPreviewLabel.style.top = `${pos.y}px`;
        polygonPreviewLabel.classList.remove('hidden');
        const cmRadius = (currentRadius / 30).toFixed(1);
        polygonPreviewLabel.innerText = window.tempPolygonData.type === 0 ? `Yarıçap: ${cmRadius} cm` : `Kenar: ${((2 * currentRadius * Math.sin(Math.PI / window.tempPolygonData.type)) / 30).toFixed(1)} cm`;
        
        ctx.globalAlpha = 1.0; ctx.setLineDash([]);
        previewActive = true; 
    }

    if (previewActive) return; 

    // --- 5. AKTİF ÇİZİM (KALEM / SİLGİ) ---
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
            } else if (stroke.type === 'point') {
                if (distance(stroke, pos) < 10) touched = true;
            } else if (['straightLine', 'line', 'segment', 'ray'].includes(stroke.type)) {
                const steps = Math.max(1, Math.floor(distance(stroke.p1, stroke.p2) / 5)); 
                for (let i = 0; i <= steps; i++) {
                    const t = i / steps;
                    if (distance({x: stroke.p1.x + (stroke.p2.x - stroke.p1.x) * t, y: stroke.p1.y + (stroke.p2.y - stroke.p1.y) * t}, pos) < 10) { touched = true; break; }
                }
            }
            if (touched) needsRedraw = true; else strokesToKeep.push(stroke);
        }
        if (needsRedraw) { drawnStrokes = strokesToKeep; window.drawnStrokes = strokesToKeep; redrawAllStrokes(); }
    }
}, { passive: false });

// --- app.js içindeki 'pointerup' olayının nihai ve zıplamayan hali ---
// --- app.js içindeki 'pointerup' olayının nihai ve zıplamayan tam hali ---
canvas.addEventListener('pointerup', (e) => {
    // 1. Tarayıcı kilitlerini kaldır ve standart hareketleri engelle
    canvas.releasePointerCapture(e.pointerId);
    if (e.pointerType === 'touch' && e.cancelable) e.preventDefault();

    // -----------------------------------------------------------------
    // KRİTİK: Zıplamayı bitiren altın kural!
    // Parmağını kaldırdığın an etkinlikten (e) gelen hatalı koordinatı OKUMUYORUZ.
    // 'pointermove' sırasında kaydedilen son "kararlı" konumu (currentMousePos) kullanıyoruz.
    // -----------------------------------------------------------------
    const finalPos = snapTarget || currentMousePos;

    // --- A) FİZİKSEL ARAÇLAR İÇİN GÜVENLİK DUVARI ---
    const isPhysicalTool = ['ruler', 'gonye', 'aciolcer', 'pergel'].includes(currentTool);
    
    if (isPhysicalTool) {
        // BURADAKİ TÜM finalizeDraw ÇAĞRILARINI SİLDİK! 
        // Her araç kendi çizimini kendisi sorunsuz kaydedecek.
        isDrawing = false;
        redrawAllStrokes();
        return; // app.js burada durur, tahtaya fazladan çizgi atmaz.
    }

    // --- B) TAŞIMA (MOVE) MANTIĞI ---
    if (currentTool === 'move' && isMoving) {
        isMoving = false;
        selectedPointKey = null;
        if (returnToSnapshot) {
            returnToSnapshot = false;
            setActiveTool('snapshot');
            if (typeof animateButton !== 'undefined' && animateButton) animateButton.classList.add('active');
            document.body.classList.add('cursor-snapshot');
        }
        redrawAllStrokes();
        return;
    }

    // --- C) NORMAL ÇİZGİLERİ KAYDET ---
    if (lineStartPoint && finalPos) {
        if (isDrawingLine) {
            drawnStrokes.push({ type: 'straightLine', p1: lineStartPoint, p2: finalPos, color: currentLineColor, width: 3 });
        }
        else if (isDrawingInfinityLine) {
            const l1 = nextPointChar; const l2 = advanceChar(l1); nextPointChar = advanceChar(l2);
            drawnStrokes.push({ type: 'line', p1: lineStartPoint, p2: finalPos, color: currentLineColor, width: 3, label1: l1, label2: l2 });
        }
        else if (isDrawingSegment) {
            const l1 = nextPointChar; const l2 = advanceChar(l1); nextPointChar = advanceChar(l2);
            drawnStrokes.push({ type: 'segment', p1: lineStartPoint, p2: finalPos, color: currentLineColor, width: 3, label1: l1, label2: l2 });
        }
        else if (isDrawingRay) {
            const l1 = nextPointChar; const l2 = advanceChar(l1); nextPointChar = advanceChar(l2);
            drawnStrokes.push({ type: 'ray', p1: lineStartPoint, p2: finalPos, color: currentLineColor, width: 3, label1: l1, label2: l2 });
        }
    }

    // --- D) ÇOKGENLERİ BİTİR ---
    if (currentTool && currentTool.startsWith('draw_polygon_')) {
        if (window.tempPolygonData && window.tempPolygonData.center) {
            const finalRadius = window.tempPolygonData.radius || 0;
            if (finalRadius > 5) {
                const currentType = window.tempPolygonData.type;
                if (currentType === 0) window.PolygonTool.finalizeCircle(finalRadius);
                else window.PolygonTool.finalizeDraw(finalRadius, window.tempPolygonData.rotation);
                
                if (typeof polygonPreviewLabel !== 'undefined' && polygonPreviewLabel) polygonPreviewLabel.classList.add('hidden');
                window.tempPolygonData.center = null;
                if (window.PolygonTool && window.PolygonTool.handleDrawClick) window.PolygonTool.handleDrawClick(null, currentType);
            }
        }
    }

    // --- GENEL SIFIRLAMA ---
    isDrawing = false;
    isDrawingLine = isDrawingInfinityLine = isDrawingSegment = isDrawingRay = false;
    lineStartPoint = null;
    snapTarget = null;
    if (typeof snapIndicator !== 'undefined' && snapIndicator) snapIndicator.style.display = 'none';
    
    redrawAllStrokes();

}, { passive: false });


// --- POINTERCANCEL (KESİNTİ DURUMUNDA SIFIRLAMA) ---
canvas.addEventListener('pointercancel', (e) => {
    // İşlemi iptal et ve tüm bayrakları (flag) indir
    isDrawing = false;
    isMoving = false;
    isPinching = false; // Varsa zoom işlemini de durdur
    
    // Geçici verileri temizle
    snapshotStart = null;
    snapTarget = null;
    lineStartPoint = null;
    window.tempPolygonData = null;

    // Arayüz elemanlarını gizle
    if (snapIndicator) snapIndicator.style.display = 'none';
    if (polygonPreviewLabel) polygonPreviewLabel.classList.add('hidden');
    if (eraserPreview) eraserPreview.style.display = 'none';

    // Yarım kalan önizlemeleri ekrandan temizlemek için
    redrawAllStrokes(); 
    
    console.log("Pointer işlemi bir sistem kesintisi nedeniyle iptal edildi.");
});


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
}, true); // 'true' parametresi olayı en başta yakalamasını sağlar (Capture Phase)


// --- BAŞLANGIÇ ---
// --- AKILLI EKRAN BOYUTLANDIRMA (ADRES ÇUBUĞU ZIPLAMASINI ENGELLER) ---
let lastWindowWidth = window.innerWidth;

function resizeCanvas() {
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;

    // Eğer genişlik değişmediyse (Sadece adres çubuğu inip kalktıysa) işlem yapma!
    // Bu sayede çizim sırasında ekranın titremesini/zıplamasını engelleriz.
    if (newWidth === lastWindowWidth && Math.abs(newHeight - canvas.height) < 150) {
        return; 
    }

    // Gerçekten ekran döndüyse veya boyut değiştiyse güncelle
    lastWindowWidth = newWidth;
    canvas.width = newWidth;
    canvas.height = newHeight;
    redrawAllStrokes();
}

window.addEventListener('load', resizeCanvas);
window.addEventListener('resize', resizeCanvas);

// --- app.js EN ALT SATIR (EDGE, CHROME, TABLET UYUMLU FİNAL) ---

{
    let deferredPrompt; 
    const installPopup = document.getElementById('install-popup');
    const btnInstall = document.getElementById('btn-popup-install');
    const btnClose = document.getElementById('btn-popup-close');
    const iosInstructions = document.getElementById('ios-instructions');

    // 1. Tarayıcı sinyali (Install Prompt)
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        // Popup'ı göster
        if (installPopup) installPopup.style.display = 'flex';
    });

    // 2. iOS (iPhone/iPad) Kontrolü
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator.standalone);

    if (isIos && !isInStandaloneMode) {
        setTimeout(() => {
            if (installPopup) {
                installPopup.style.display = 'flex';
                if (btnInstall) btnInstall.style.display = 'none'; // iPhone'da butonu gizle
                if (iosInstructions) iosInstructions.style.display = 'block'; // Tarifi göster
            }
        }, 3000);
    }

    // --- BUTONLARI ÇALIŞTIRAN FONKSİYON (EDGE DOKUNMATİK HATASI ÇÖZÜMÜ) ---
    const activateButton = (btn, actionCallback) => {
        if (!btn) return;

        const handler = async (e) => {
            // Edge'in dokunmayı yutmasını engelle
            e.stopPropagation(); 
            e.preventDefault(); 
            
            // İşlemi gerçekleştir
            await actionCallback();
        };

        // Hem tıklama hem parmak dokunuşunu dinle
        btn.addEventListener('click', handler);
        btn.addEventListener('touchstart', handler, { passive: false });
    };

    // --- BUTONLARA GÖREVLERİNİ VER ---

    // A) Yükle Butonu
    activateButton(btnInstall, async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log("Sonuç:", outcome);
            deferredPrompt = null;
        }
        if (installPopup) installPopup.style.display = 'none';
    });

    // B) Kapat (Hayır) Butonu
    activateButton(btnClose, async () => {
        if (installPopup) installPopup.style.display = 'none';
    });
}

// --- app.js EN ALTA EKLE: DÖNDÜRME FONKSİYONU ---

/**
 * Bir HTML elementine döndürme özelliği ekler.
 * @param {HTMLElement} element - Döndürülecek olan kopya kutusu (div)
 */

// ==========================================
// --- TARAYICI DOKUNMATİK ÇAKIŞMA ÇÖZÜMÜ ---
// ==========================================
// Tarayıcının adres çubuğu veya "sayfayı yenile" hareketinin
// döndürme (rotate) ve taşıma işlemlerini bozmasını engeller.
window.addEventListener('touchmove', function(e) {
    // Eğer dokunulan şey döndürme kulpuysa veya kopyalanan resimse:
    if (e.target.closest('.rotate-handle') || 
        e.target.classList.contains('rotate-handle') ||
        e.target.closest('.resize-handle') ||
        e.target.tagName.toLowerCase() === 'img') {
        
        // Tarayıcıya "Karışma, kaydırma yapma!" diyoruz.
        e.preventDefault(); 
    }
}, { passive: false }); // passive: false çok önemlidir, tarayıcıyı durdurmaya izin verir.
// ==========================================


// =========================================================
// MOBİL TARAYICI ZIPLAMA ÇÖZÜMÜ: KATI EKRAN KİLİDİ (app.js)
// =========================================================
function lockScreenSize() {
    // Ekranın o anki gerçek piksel boyutunu al
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Kanvası ve body'yi bu piksel değerine beton gibi sabitle (100vh yerine px kullan)
    const canvas = document.getElementById('drawing-canvas');
    if (canvas) {
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        canvas.width = w;   // İç çizim çözünürlüğünü kilitle
        canvas.height = h;
    }

    document.body.style.width = w + 'px';
    document.body.style.height = h + 'px';
    document.documentElement.style.width = w + 'px';
    document.documentElement.style.height = h + 'px';
}

// 1. Sayfa yüklendiğinde boyutları kilitle
window.addEventListener('load', lockScreenSize);

// 2. Tablet yan çevrilirse (yatay/dikey) yeni boyuta göre tekrar kilitle
window.addEventListener('orientationchange', () => {
    setTimeout(lockScreenSize, 300);
});

// KRİTİK NOKTA: 'resize' eventini (adres çubuğu hareketlerini) DİNLEMİYORUZ!
// Böylece adres çubuğu kaybolsa/çıksa bile sayfa esnemez, çizgiler zıplamaz.

