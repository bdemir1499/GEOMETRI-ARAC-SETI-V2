let drawnStrokes = [];
window.drawnStrokes = drawnStrokes;
let isDrawing = false;
let isDrawingRectangle = false;
let isDrawingPolygon = false;
let rectStartPoint = null;
let globalScale = 1;
let lastDist = 0;
let pointers = new Map();
let offsetX = 0; // BUNU EKLE
let offsetY = 0; // BUNU EKLE
const MIN_SCALE = 0.5; 
const MAX_SCALE = 5.0;
let initialWidth = 0;
let initialHeight = 0;
let isPenActive = false; // Avuç içi reddi için
let penActiveTimer = null;


// Sayfa açıldığında kırmızı butonun yanlışlıkla görünmesini engellemek için:
const closePdfBtn = document.getElementById('btn-close-pdf');
if (closePdfBtn) {
    closePdfBtn.classList.add('hidden');
    closePdfBtn.style.display = 'none'; // Kesin olarak gizle
}




function getGlobalCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}

function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    let cX = e.clientX;
    let cY = e.clientY;

    // --- SENİN MEVCUT HATA KORUMA MANTIĞIN (DOKUNULMADI) ---
    if (cX === undefined || cX === null || isNaN(cX)) {
        if (e.targetTouches && e.targetTouches.length > 0) {
            cX = e.targetTouches[0].clientX;
            cY = e.targetTouches[0].clientY;
        } else if (e.touches && e.touches.length > 0) {
            cX = e.touches[0].clientX;
            cY = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            cX = e.changedTouches[0].clientX;
            cY = e.changedTouches[0].clientY;
        } else {
            cX = 0; 
            cY = 0;
        }
    }

    // --- YENİ DÜZELTİLMİŞ HESAPLAMA (ÖZELLİK KAYBI YOK) ---
    return {
        // (cX - rect.left) ile ham koordinatı bulup, 
        // kanvasın iç çözünürlüğü ile ekrandaki boyutu arasındaki orana (canvas.width / rect.width) çarpıyoruz.
        x: ((cX || 0) - rect.left) * (canvas.width / rect.width),
        y: ((cY || 0) - rect.top) * (canvas.height / rect.height)
    };
}

// --- GRAFİK TABLET SİMÜLATÖRÜ ---
function getPointerInfo(e) {
    // BURAYI false YAPTIK!
    const testModuAcik = false; 

    // Eğer test modu açıksa ve fare kullanılıyorsa, onu "Kalem" gibi kandır
    if (testModuAcik && e.pointerType === 'mouse') {
        return {
            type: 'pen',
            pressure: Math.random() * 0.8 + 0.2
        };
    }
    
    return {
        type: e.pointerType,
        pressure: e.pressure || 1 
    };
}


// --- KANVAS AYARLARI ---

const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');

function setupCanvasResolution() {
    const rect = canvas.getBoundingClientRect();
    
    // Kanvasın iç piksel sayısını, ekrandaki gerçek boyutuyla birebir eşitle
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // Eğer çizimlerin varsa, çözünürlük değişince silinmemesi için yeniden çizdir
    if (typeof redrawAllStrokes === 'function') {
        redrawAllStrokes();
    }
}

// 1. Uygulama ilk açıldığında çalıştır
setupCanvasResolution();

// 2. Ekran boyutu her değiştiğinde (yükle butonu sonrası veya yan çevirince) çalıştır
window.addEventListener('resize', setupCanvasResolution);

// PARDUS KESİN ÇÖZÜM: Tarayıcının kaydırma ve yakınlaştırma yapmasını yasakla
canvas.style.touchAction = 'none';
canvas.style.userSelect = 'none';
document.body.style.overscrollBehavior = 'none';


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
// --- DİKDÖRTGEN BUTONU TANIMLAMASI ---
const dikdortgenButton = document.getElementById('btn-dikdortgen');

if (dikdortgenButton) {
    dikdortgenButton.addEventListener('click', () => {
        if (typeof window.setActiveTool === 'function') {
            window.setActiveTool('draw_rectangle');
        } else {
            window.currentTool = 'draw_rectangle';
        }
    });
}
// --------------------------------------

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

function redrawAllStrokes() {
    // 1. ÖNCE KOORDİNATLARI SIFIRLA VE TÜM EKRANI SİL
    ctx.setTransform(1, 0, 0, 1, 0, 0); 
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // SADECE BU SATIRI EKLE:
    if (!window.drawnStrokes || window.drawnStrokes.length === 0) return;

    ctx.save();
    // (Buradaki translate ve scale satırlarını tamamen sildik. Zemin artık sabit!)

    // 3. NESNELERİ ÇİZ (For döngüsü başlıyor)
    for (const stroke of drawnStrokes) {
        
        // --- KALEM (PEN) GRAFİK TABLET DESTEKLİ ---
        if (stroke.type === 'pen') {
            const points = stroke.path;
            
            if (points.length < 2) {
                // Sadece tıklandıysa tek bir nokta koy
                ctx.beginPath();
                ctx.arc(points[0].x, points[0].y, (stroke.baseWidth * (points[0].p || 1)) / 2, 0, Math.PI * 2);
                ctx.fillStyle = stroke.color;
                ctx.fill();
            } else {
                // Çizgiyi basınç hassasiyetiyle çiz
                for (let i = 1; i < points.length; i++) {
                    ctx.beginPath();
                    ctx.moveTo(points[i - 1].x, points[i - 1].y);
                    ctx.lineTo(points[i].x, points[i].y);
                    ctx.strokeStyle = stroke.color;
                    
                    // Basıncı genişliğe uygula (En az %20 kalınlık olsun)
                    let currentPressure = points[i].p !== undefined ? points[i].p : 1;
                    let dynamicWidth = stroke.baseWidth * Math.max(0.2, currentPressure);
                    
                    ctx.lineWidth = dynamicWidth;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.stroke();
                }
            }
        }

       // --- RESİM / PDF VE CANLANDIR (SNAPSHOT) KOPYASI ---
        else if (stroke.type === 'image') {
            let imgToDraw = null;

            // 1. KAYNAK KONTROLÜ (Kayıp olan Canlandır kodunu geri ekledik)
            if (stroke.img && stroke.img instanceof HTMLImageElement) {
                imgToDraw = stroke.img; // PDF veya Dosya yüklemesi
            } else if (stroke.imgData) {
                if (!stroke.imgObj) {
                    stroke.imgObj = new Image();
                    stroke.imgObj.src = stroke.imgData;
                    // Resim yüklendiğinde ekranı tazele
                    stroke.imgObj.onload = () => { if (window.redrawAllStrokes) window.redrawAllStrokes(); };
                }
                imgToDraw = stroke.imgObj; // Canlandır kopyası
            }

            // 2. ÇİZİM MANTIĞI
            if (imgToDraw && (imgToDraw.complete || imgToDraw.readyState >= 2)) {
                ctx.save();
                const centerX = stroke.x + (stroke.width / 2);
                const centerY = stroke.y + (stroke.height / 2);
                ctx.translate(centerX, centerY);
                ctx.rotate((stroke.rotation || 0) * Math.PI / 180);
                
                ctx.drawImage(imgToDraw, -stroke.width / 2, -stroke.height / 2, stroke.width, stroke.height);
                
                if (typeof currentTool !== 'undefined' && currentTool === 'move' && selectedItem === stroke) {
                    ctx.strokeStyle = '#00FFCC'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
                    ctx.strokeRect(-stroke.width / 2, -stroke.height / 2, stroke.width, stroke.height);
                    ctx.setLineDash([]);
                }
                ctx.restore();
            }
        }

        // --- NOKTA ---
        else if (stroke.type === 'point') {
            drawDot(stroke);
            drawLabel(stroke.label, stroke);
        }

        // --- DÜZ ÇİZGİ ---
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

        // --- DOĞRU ---
        else if (stroke.type === 'line') { 
            const { ux, uy } = drawInfinityLine(stroke.p1, stroke.p2, stroke.color, stroke.width, false);
            if (ux !== 0 || uy !== 0) {
                drawDot(stroke.p1, stroke.color);
                drawDot(stroke.p2, stroke.color);
                drawLabel(stroke.label1, stroke.p1, '#FF69B4');
                drawLabel(stroke.label2, stroke.p2, '#FF69B4');
            }
        }

        // --- DOĞRU PARÇASI ---
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

        // --- IŞIN ---
        else if (stroke.type === 'ray') { 
            const { ux, uy } = drawInfinityLine(stroke.p1, stroke.p2, stroke.color, stroke.width, true); 
            if (ux !== 0 || uy !== 0) {
                drawDot(stroke.p1, stroke.color);
                drawDot(stroke.p2, stroke.color);
                drawLabel(stroke.label1, stroke.p1, '#FF69B4');
                drawLabel(stroke.label2, stroke.p2, '#FF69B4');
            }
        }

        // --- ÇOKGENLER ---
        else if (stroke.type === 'polygon') {
            if (window.PolygonTool && typeof window.PolygonTool.calculateVertices === 'function') {
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
                if (typeof currentTool !== 'undefined' && currentTool === 'move' && selectedItem === stroke) {
                    const rotateHandlePos = window.PolygonTool.getRotateHandlePosition(stroke);
                    ctx.beginPath(); ctx.arc(rotateHandlePos.x, rotateHandlePos.y, 10, 0, 2 * Math.PI);
                    ctx.fillStyle = 'rgba(0, 255, 0, 0.8)'; ctx.fill(); ctx.strokeStyle = '#0F0'; ctx.lineWidth = 2; ctx.stroke();
                    const resizeHandlePos = vertices.length > 0 ? vertices[0] : stroke.center; 
                    ctx.beginPath(); ctx.arc(resizeHandlePos.x, resizeHandlePos.y, 8, 0, 2 * Math.PI);
                    ctx.fillStyle = 'rgba(255, 0, 255, 0.8)'; ctx.fill(); ctx.strokeStyle = '#F0F'; ctx.lineWidth = 2; ctx.stroke();
                }
            }
        }


else if (stroke.type === 'rectangle') {
            ctx.save();
            const centerX = stroke.x + stroke.width / 2;
            const centerY = stroke.y + stroke.height / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate((stroke.rotation || 0) * Math.PI / 180);

            // 1. Dikdörtgeni Çiz
            ctx.beginPath();
            ctx.rect(-stroke.width / 2, -stroke.height / 2, stroke.width, stroke.height);
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = 3;
            ctx.stroke();

            // 2. Kenar Uzunluklarını Yazdır (Önizlemedeki gibi kalıcı olur)
            if (stroke.showEdgeLabels) {
                ctx.font = "14px Arial";
                ctx.fillStyle = stroke.color;
                ctx.textAlign = "center";
                
                const wCm = (stroke.width / 30).toFixed(1).replace('.', ',');
                const hCm = (stroke.height / 30).toFixed(1).replace('.', ',');

                // Üst Kenar CM
                ctx.fillText(`${wCm} cm`, 0, -stroke.height / 2 - 10);
                
                // Sol Kenar CM (Dikey yazdırmak için döndürüyoruz)
                ctx.save();
                ctx.translate(-stroke.width / 2 - 25, 0);
                ctx.rotate(-Math.PI / 2);
                ctx.fillText(`${hCm} cm`, 0, 0);
                ctx.restore();
            }

            // 3. Köşe Harflerini Yazdır (A, B, C, D)
            if (stroke.labels) {
                ctx.font = "bold 16px Arial";
                ctx.fillStyle = "#FF69B4"; // Pembe harfler
                ctx.fillText(stroke.labels[0], -stroke.width/2 - 15, -stroke.height/2 - 5); // Sol Üst
                ctx.fillText(stroke.labels[1], stroke.width/2 + 10, -stroke.height/2 - 5);  // Sağ Üst
                ctx.fillText(stroke.labels[2], stroke.width/2 + 10, stroke.height/2 + 15);  // Sağ Alt
                ctx.fillText(stroke.labels[3], -stroke.width/2 - 15, stroke.height/2 + 15); // Sol Alt
            }

            // 4. "Taşı" Modu Aktifse Butonları Çiz
            if (currentTool === 'move' && selectedItem === stroke) {
                // Döndürme (Yeşil)
                ctx.fillStyle = '#0F0'; ctx.beginPath(); ctx.arc(0, -stroke.height/2 - 30, 12, 0, 7); ctx.fill();
                // Boyutlandırma (Pembe)
                ctx.fillStyle = '#F0F'; ctx.beginPath(); ctx.arc(stroke.width/2, stroke.height/2, 12, 0, 7); ctx.fill();
            }
            
            // 5. Açı Tıklandıysa 90 Derece Sembolünü Çiz
            if (stroke.showAngleLabels) {
                ctx.font = "bold 14px Arial"; ctx.fillStyle = "yellow";
                ctx.fillText("90°", -stroke.width/2 + 15, -stroke.height/2 + 20);
            }
            ctx.restore();
        }



        // --- ÇEMBER / PERGEL ---
        else if (stroke.type === 'arc') { 
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
                const labelX = centerPos.x + r_px + 30; 
                drawLabel(`Ç = 2 . π . r`, {x: labelX, y: labelY}, '#FFFF00'); labelY += 20; 
                drawLabel(`= 2 . ${PI} . ${r_cm_str} = ${circ_str} cm`, {x: labelX, y: labelY}, '#FFFF00'); labelY += 25; 
                drawLabel(`A = π . r²`, {x: labelX, y: labelY}, '#FFFF00'); labelY += 20;
                drawLabel(`= ${PI} . ${r_cm_str}² = ${area_str} cm²`, {x: labelX, y: labelY}, '#FFFF00'); labelY += 25; 
                drawLabel(`(π = ${PI} alındı)`, {x: labelX, y: labelY}, '#AAAAAA'); 
            }
        }
    } // <-- FOR DÖNGÜSÜ BURADA KAPANIYOR

    ctx.restore();

    // --- YENİ EKLENEN KISIM: OTOMATİK HARF SENKRONİZASYONU ---
    // Ekranda o an var olan en yüksek harfi bulur
    let maxCode = 64; 
    drawnStrokes.forEach(s => {
        if (s.label && s.label.charCodeAt(0) > maxCode) maxCode = s.label.charCodeAt(0);
        if (s.label1 && s.label1.charCodeAt(0) > maxCode) maxCode = s.label1.charCodeAt(0);
        if (s.label2 && s.label2.charCodeAt(0) > maxCode) maxCode = s.label2.charCodeAt(0);
    });
    
    // Sıradaki harfe geçer (Z'yi geçerse A'ya döner)
    let nextCode = maxCode + 1;
    if (nextCode > 90) nextCode = 65; 
    
    // Tüm sistemi (Pergel, Çokgenler ve Kalem) tek bir harfe senkronize eder
    nextPointChar = String.fromCharCode(nextCode);
    window.nextPointChar = nextPointChar;
    // ---------------------------------------------------------

} // <-- FONKSİYON BURADA KAPANIYOR

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
            const angleRad = (stroke.rotation || 0) * (Math.PI / 180);

            // --- KRİTİK DÜZELTME: Resmin gerçek merkezini hesapla ---
            const centerX = stroke.x + halfW;
            const centerY = stroke.y + halfH;

            // --- A. DÖNDÜRME KULPU (Rotate Handle) ALGILAMA ---
            const handleDist = halfH + 30;
            const rotX = centerX + Math.sin(angleRad) * handleDist;
            const rotY = centerY - Math.cos(angleRad) * handleDist;

            if (distance(pos, {x: rotX, y: rotY}) < 25) {
                return { item: stroke, pointKey: 'image_rotate' }; 
            }

            // --- B. BOYUTLANDIRMA KULPU (Resize Handle) ---
            const resLocalX = halfW * Math.cos(angleRad) - halfH * Math.sin(angleRad);
            const resLocalY = halfW * Math.sin(angleRad) + halfH * Math.cos(angleRad);
            const resX = centerX + resLocalX;
            const resY = centerY + resLocalY;

            if (distance(pos, {x: resX, y: resY}) < 25) {
                return { item: stroke, pointKey: 'image_resize' };
            }

            // --- C. RESİM GÖVDESİ (Taşıma) ---
            const dx = pos.x - centerX;
            const dy = pos.y - centerY;
            const localClickX = dx * Math.cos(-angleRad) - dy * Math.sin(-angleRad);
            const localClickY = dx * Math.sin(-angleRad) + dy * Math.cos(-angleRad);

            if (localClickX > -halfW && localClickX < halfW && localClickY > -halfH && localClickY < halfH) {
                return { item: stroke, pointKey: 'self' };
            }
        }        if (currentTool === 'move' && selectedItem === stroke) {
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

// --- DİKDÖRTGEN YAKALAMA (TABLET UYUMLU) ---
        if (stroke.type === 'rectangle') {
            const centerX = stroke.x + stroke.width / 2;
            const centerY = stroke.y + stroke.height / 2;
            const angleRad = (stroke.rotation || 0) * (Math.PI / 180);

            // A. Döndürme Butonu (Yeşil - Üstte)
            const rotX = centerX + Math.sin(angleRad) * (stroke.height / 2 + 35);
            const rotY = centerY - Math.cos(angleRad) * (stroke.height / 2 + 35);
            if (distance(pos, {x: rotX, y: rotY}) < 30) return { item: stroke, pointKey: 'image_rotate' };

            // B. Boyutlandırma Butonu (Pembe - Sağ Alt)
            const resX = centerX + (stroke.width / 2 * Math.cos(angleRad) - stroke.height / 2 * Math.sin(angleRad));
            const resY = centerY + (stroke.width / 2 * Math.sin(angleRad) + stroke.height / 2 * Math.cos(angleRad));
            if (distance(pos, {x: resX, y: resY}) < 30) return { item: stroke, pointKey: 'image_resize' };

            // C. Köşeler (90 Derece Açı Gösterme - 30px hassasiyet)
            const corners = [
                {x: -stroke.width/2, y: -stroke.height/2}, {x: stroke.width/2, y: -stroke.height/2},
                {x: stroke.width/2, y: stroke.height/2}, {x: -stroke.width/2, y: stroke.height/2}
            ];
            for (let c of corners) {
                const cornerX = centerX + (c.x * Math.cos(angleRad) - c.y * Math.sin(angleRad));
                const cornerY = centerY + (c.x * Math.sin(angleRad) + c.y * Math.cos(angleRad));
                if (distance(pos, {x: cornerX, y: cornerY}) < 30) return { item: stroke, pointKey: 'toggle_angles' };
            }

            // D. Gövde (Merkezden Taşıma)
            const dx = pos.x - centerX;
            const dy = pos.y - centerY;
            const localX = dx * Math.cos(-angleRad) - dy * Math.sin(-angleRad);
            const localY = dx * Math.sin(-angleRad) + dy * Math.cos(-angleRad);
            if (Math.abs(localX) < stroke.width / 2 && Math.abs(localY) < stroke.height / 2) {
                return { item: stroke, pointKey: 'self' };
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

if (stroke.type === 'rectangle') {
            const centerX = stroke.x + stroke.width / 2;
            const centerY = stroke.y + stroke.height / 2;
            const angleRad = (stroke.rotation || 0) * (Math.PI / 180);

            // A. Döndürme Butonu (Yeşil)
            const rotX = centerX + Math.sin(angleRad) * (stroke.height / 2 + 30);
            const rotY = centerY - Math.cos(angleRad) * (stroke.height / 2 + 30);
            if (distance(pos, {x: rotX, y: rotY}) < 20) return { item: stroke, pointKey: 'image_rotate' };

            // B. Boyutlandırma Butonu (Pembe)
            const resX = centerX + (stroke.width / 2 * Math.cos(angleRad) - stroke.height / 2 * Math.sin(angleRad));
            const resY = centerY + (stroke.width / 2 * Math.sin(angleRad) + stroke.height / 2 * Math.cos(angleRad));
            if (distance(pos, {x: resX, y: resY}) < 20) return { item: stroke, pointKey: 'image_resize' };

            // C. Köşeye Tıklama (Açı Gösterme)
            if (distance(pos, {x: stroke.x, y: stroke.y}) < 20) return { item: stroke, pointKey: 'toggle_angles' };

            // D. Gövdeden Tutma (Merkezden Taşıma)
            const dx = pos.x - centerX; const dy = pos.y - centerY;
            const localX = dx * Math.cos(-angleRad) - dy * Math.sin(-angleRad);
            const localY = dx * Math.sin(-angleRad) + dy * Math.cos(-angleRad);
            if (Math.abs(localX) < stroke.width / 2 && Math.abs(localY) < stroke.height / 2) {
                return { item: stroke, pointKey: 'self' };
            }
        }            if (stroke.type === 'arc' && stroke.cx) {
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

// --- BU SATIRI EKLE ---
    if (eraserPreview) eraserPreview.style.display = 'none'; 
    // ----------------------

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

// --- BURAYA DİKDÖRTGEN SIFIRLAMASINI EKLEYİN ---
    isDrawingRectangle = false;
    rectStartPoint = null;
    
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
    if (window.PergelTool) {
        window.PergelTool.show(); // Pergelin görünür olmasını sağlar
        // Pergelin en üstte görünmesi için:
        if (window.bringToolToFront) {
            window.bringToolToFront(window.PergelTool.pergelElement);
        }
    }
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
pergelButton.addEventListener('click', () => {
    setActiveTool(currentTool === 'pergel' ? 'none' : 'pergel');
});
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

// --- YENİ: Sayfa numarasına tıklayınca hızlı gitme kutusunu aç ---
if (pageCountLabel) {
    pageCountLabel.style.cursor = 'pointer'; // Fareyle üzerine gelince tıklanabilir el işareti çıksın
    pageCountLabel.addEventListener('click', () => {
        if (!currentPDF) return;
        
        const gitSayfa = prompt(`${totalPDFPages} sayfa arasından gitmek istediğiniz numarayı yazın:`, currentPDFPage);
        if (gitSayfa !== null) {
            const num = parseInt(gitSayfa);
            if (num > 0 && num <= totalPDFPages) {
                currentPDFPage = num;
                renderPDFPage(currentPDFPage);
            } else {
                alert("Geçersiz sayfa numarası girdiniz!");
            }
        }
    });
}

if (uploadButton && fileInput) {
    uploadButton.onclick = () => fileInput.click();

    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // --- DURUM A: PDF DOSYASI ---
        if (file.type === 'application/pdf') {
            const fileReader = new FileReader();
            fileReader.onload = async function() {
                const typedarray = new Uint8Array(this.result);
                try {
                    currentPDF = await pdfjsLib.getDocument(typedarray).promise;
                    totalPDFPages = currentPDF.numPages;
                    currentPDFPage = 1; 

                    // Kırmızı kapatma butonunu buradan SİLDİK. Sadece sayfaları değiştirme panelini açıyoruz:
                    if (pdfControls) pdfControls.classList.remove('hidden');

                    // Sayfayı ekrana çiz (Buton işlem bitince addNewImageToCanvas içinde açılacak)
                    renderPDFPage(currentPDFPage);

                    // --- YENİ: SAYFA SEÇİM PENCERESİNİ AÇ ---
                    setTimeout(() => {
                        const sayfaGrisi = prompt(`Bu PDF toplam ${totalPDFPages} sayfadır.\nKaçıncı sayfadan devam etmek istersiniz?`, "1");
                        if (sayfaGrisi !== null) {
                            const hedefSayfa = parseInt(sayfaGrisi);
                            if (hedefSayfa > 0 && hedefSayfa <= totalPDFPages) {
                                currentPDFPage = hedefSayfa;
                                renderPDFPage(currentPDFPage);
                            }
                        }
                    }, 500);

                } catch (error) {
                    console.error("PDF açılırken hata oluştu:", error);
                }
            };
            fileReader.readAsArrayBuffer(file);
        }


        // --- DURUM B: RESİM DOSYASI ---
        else if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    // Resim hazır olduğunda kanvasa ekle (Buton da burada açılacak)
                    addNewImageToCanvas(img, false);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }        
        e.target.value = ''; // Aynı dosyayı tekrar seçebilmek için temizle
    };
}

function addToCanvasAsObject(img) {
    let startWidth = 400;
    if (img.width < 400) startWidth = img.width;
    
    let scaleFactor = startWidth / img.width;
    let startHeight = img.height * scaleFactor;

    drawnStrokes.push({
        type: 'image',
        img: img,
        // --- TAM ORTALAMA HESABI ---
        x: (canvas.width / 2) - (startWidth / 2),
        y: (canvas.height / 2) - (startHeight / 2),
        width: startWidth,
        height: startHeight,
        rotation: 0,
        isBackground: true 
    });

    // --- BUTONU GÖSTERME VE KAPATMA İŞLEVİ FONKSİYONUN İÇİNE ALINDI ---
    if (closePdfBtn) {
        // 1. Butonu SADECE resim eklendiğinde görünür yap
        closePdfBtn.classList.remove('hidden');
        closePdfBtn.style.display = 'flex';

        // 2. Kapatma işlevini tanımla
        closePdfBtn.onclick = () => {
            // Kontrol panelini ve butonun kendisini gizle
            if (typeof pdfControls !== 'undefined' && pdfControls) {
                pdfControls.classList.add('hidden');
            }
            closePdfBtn.classList.add('hidden');
            closePdfBtn.style.display = 'none';

            // Arka plan olan öğeleri kaldır
            drawnStrokes = drawnStrokes.filter(s => !s.isBackground && !s.isPDFPage);
            window.drawnStrokes = drawnStrokes;

            // Değişkenleri sıfırla
            currentPDF = null;
            if (typeof pdfImageStroke !== 'undefined') pdfImageStroke = null;

            // Ekranı temizle ve kalan çizimleri tekrar çiz
            redrawAllStrokes();
        };
    }
    
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

canvas.addEventListener('pointerdown', (e) => {

    // 1. Tarayıcıyı sabitle
    if (e.cancelable) e.preventDefault();
    // NOT: setPointerCapture komutu Vestel tahtaları kilitlediği için tamamen kaldırıldı.

    // --- KRİTİK EKLENTİ: HAYALET PARMAK SIFIRLAYICI ---
    // Eğer dokunmatik ekrandaysak ve ekrana sadece 1 parmak değiyorsa,
    // hafızada kalmış eski görünmez parmakları tamamen temizle!
    if (e.pointerType === 'touch' && e.touches && e.touches.length === 1) {
        pointers.clear();
        lastDist = 0;
    }

    // --- PARDUS ÇİFT SİNYAL (HAYALET FARE) ENGELLEYİCİ ---
    if (e.pointerType === 'touch') {
        // Gerçek parmak değdiyse, sistemdeki sahte fareleri sil
        for (let key of pointers.keys()) {
            if (pointers.get(key).pointerType === 'mouse') pointers.delete(key);
        }
    } else if (e.pointerType === 'mouse') {
        // Fare sinyali geldiyse ama ekranda parmak varsa, fareyi reddet!
        let hasTouch = false;
        for (let p of pointers.values()) {
            if (p.pointerType === 'touch' || p.pointerType === 'pen') hasTouch = true;
        }
        if (hasTouch) return; // İşlemi iptal et, hayalet fareyi içeri alma
    }
    // ----------------------------------------------------

    // --- BUNU EKLE: Parmağı ekrana değdiği an kaydet ---
    pointers.set(e.pointerId, e); 
    // ------------------------------------------------

    // 2. Koordinatları tek seferde al (Zıplamayı bitiren temiz veri)
    const pos = getPointerPos(e); 
    const snapPos = snapTarget || pos;
    currentMousePos = pos; // Mobil için konum bilgisini güncelle

    // --- AVUÇ İÇİ REDDİ (PALM REJECTION) KONTROLÜ ---
    const currentPointer = getPointerInfo(e);
    
    if (currentPointer.type === 'pen') {
        isPenActive = true;
        clearTimeout(penActiveTimer);
        // Kalem kalktıktan sonra 1 saniye daha elleri reddetmeye devam et
        penActiveTimer = setTimeout(() => { isPenActive = false; }, 1000); 
    } else if (currentPointer.type === 'touch' && isPenActive) {
        // Kalem kullanılıyorken ekrana el/avuç içi değerse işlemi İPTAL ET
        console.log("Avuç içi reddedildi.");
        return; 
    }
    // -----------------------------------------------


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

        // Seçilen nesneyi en üste taşı (Z-Index mantığı)
        drawnStrokes = drawnStrokes.filter(s => s !== hit.item);
        drawnStrokes.push(hit.item);
        window.drawnStrokes = drawnStrokes;


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
            } else if (hit.pointKey === 'rotate' || hit.pointKey === 'resize' || hit.pointKey === 'image_resize') {
                originalStartPos = { radius: hit.item.radius, rotation: hit.item.rotation };

                // --- TABLET İÇİN KRİTİK EKLEME ---
                if (selectedItem.type === 'rectangle') {
                    initialWidth = selectedItem.width;
                    initialHeight = selectedItem.height;
                }
                // --------------------------------
                
                // --- KRİTİK EKLEME: Dikdörtgen boyutlarını kaydet ---
                if (hit.item.type === 'rectangle') {
                    initialWidth = hit.item.width;
                    initialHeight = hit.item.height;
                }
                // --------------------------------------------------
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
            // YENİ: Kalemin basıncını al
            const pInfoDown = getPointerInfo(e);
            const pressureDown = pInfoDown.type === 'pen' ? pInfoDown.pressure : 1;
            
            // YENİ: Basınç değerini (p) koordinatla birlikte kaydet
            drawnStrokes.push({ 
                type: 'pen', 
                path: [{x: snapPos.x, y: snapPos.y, p: pressureDown}], 
                color: currentPenColor, 
                baseWidth: currentPenWidth 
            });
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

        case 'draw_rectangle':
            // Şartı (!isDrawingRectangle) kaldırıyoruz; direkt başlatıyoruz.
            isDrawingRectangle = true; 
            rectStartPoint = pos; 
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

// PARDUS KORUMASI: Sürükleme sırasında tarayıcının araya girmesini kesin engelle
    if (e.cancelable) e.preventDefault();

// --- AVUÇ İÇİ REDDİ (SÜREKLİ GÜNCELLEME) ---
    const currentPointerMove = getPointerInfo(e);
    
    // Eğer kalem ekrana değiyorsa VEYA havadan ekranın üzerinde geziniyorsa (hover)
    if (currentPointerMove.type === 'pen') {
        isPenActive = true;
        clearTimeout(penActiveTimer); // Eski sayacı iptal et
        
        // Kalem tamamen uzaklaşana kadar bu 1 saniye ASLA bitmez
        penActiveTimer = setTimeout(() => { isPenActive = false; }, 1000); 
    } 
    // Kalem aktifken (veya uzaklaşalı henüz 1 saniye olmamışken) bir el/parmak değerse REDDET
    else if (currentPointerMove.type === 'touch' && isPenActive) {
        return; // İşlemi anında iptal et, aşağıdaki kodları hiç okuma!
    }

    // -------------------------------------------

// --- PARDUS ÇİFT SİNYAL ENGELLEYİCİ ---
    if (e.pointerType === 'mouse') {
        let hasTouch = false;
        for (let p of pointers.values()) {
            if (p.pointerType === 'touch' || p.pointerType === 'pen') hasTouch = true;
        }
        if (hasTouch) return; // Hayalet farenin hareket etmesini engelle!
    }

    // --------------------------------------


    // --- YENİ: PARMAK TAKİBİ VE ZOOM ---
    pointers.set(e.pointerId, e); // Her zaman parmağı kaydet

   // --- TABLET: İKİ PARMAK ZOOM (SADECE RESİM/PDF BÜYÜR) ---
    // --- PARDUS VE TABLET: İKİ PARMAK ZOOM (SADECE RESİM/PDF BÜYÜR) ---
    if (pointers.size === 2 || (e.touches && e.touches.length === 2)) {
        let p1x, p1y, p2x, p2y;
        
        // Pardus gibi parmakları e.touches içine paketleyen sistemler için
        if (e.touches && e.touches.length === 2) {
            p1x = e.touches[0].clientX; p1y = e.touches[0].clientY;
            p2x = e.touches[1].clientX; p2y = e.touches[1].clientY;
        } else {
            // Standart modern tablet ve PC'ler için
            const p = Array.from(pointers.values());
            p1x = p[0].clientX; p1y = p[0].clientY;
            p2x = p[1].clientX; p2y = p[1].clientY;
        }

        const currentDist = Math.hypot(p1x - p2x, p1y - p2y);

        if (lastDist > 0) {
            const delta = currentDist - lastDist;
            const zoomSpeed = 0.003; 
            const zoomStep = 1 + (delta * zoomSpeed);

            const bgStrokes = drawnStrokes.filter(s => s.isBackground === true);
            if (bgStrokes.length > 0) {
                bgStrokes.forEach(bg => {
                    const newW = bg.width * zoomStep;
                    const newH = bg.height * zoomStep;
                    bg.x = bg.x - (newW - bg.width) / 2;
                    bg.y = bg.y - (newH - bg.height) / 2;
                    bg.width = newW;
                    bg.height = newH;
                });
                redrawAllStrokes();
            }
        }
        lastDist = currentDist; 
        return; 
    }

   // 1. GÜVENLİK: Tek parmaklı işlemlerde sadece ana dokunuşu takip et
    // 1. GÜVENLİK (Pardus Yaması): Pardus isPrimary değerini tanımsız (undefined) gönderebilir.
    // 1. GÜVENLİK (Pardus Yaması 2.0): Sadece ekranda birden fazla parmak varsa ana parmağı dikkate al.
    if (pointers.size > 1 && e.isPrimary === false) return; 

    // KOORDİNATLARI AL VE SİSTEME KAYDET (Canlandır ve diğer araçlar için şart)
    const pos = getPointerPos(e); 
    currentMousePos = pos;

    

    
    // --- 1. TAŞIMA (MOVE) MANTIĞI ---
    if (currentTool === 'move' && isMoving) {
        const dx = pos.x - dragStartPos.x;
        const dy = pos.y - dragStartPos.y;

// --- DİKDÖRTGEN HAREKET MANTIĞI ---
        if (selectedItem.type === 'rectangle') {
            if (selectedPointKey === 'self') {
                selectedItem.x = originalStartPos.x + dx;
                selectedItem.y = originalStartPos.y + dy;
            } 
            else if (selectedPointKey === 'image_rotate') {
                const centerX = selectedItem.x + selectedItem.width / 2;
                const centerY = selectedItem.y + selectedItem.height / 2;
                selectedItem.rotation = Math.atan2(pos.y - centerY, pos.x - centerX) * (180 / Math.PI) + 90;
            } 
            else if (selectedPointKey === 'image_resize') {
                const centerX = selectedItem.x + selectedItem.width / 2;
                const centerY = selectedItem.y + selectedItem.height / 2;
                const angleRad = (selectedItem.rotation || 0) * (Math.PI / 180);

                // Farenin merkeze göre olan uzaklığını bul
                const dx_real = pos.x - centerX;
                const dy_real = pos.y - centerY;

                // Bu uzaklığı dikdörtgenin açısına göre döndür (Yerel X ve Y)
                const localX = dx_real * Math.cos(-angleRad) - dy_real * Math.sin(-angleRad);
                const localY = dx_real * Math.sin(-angleRad) + dy_real * Math.cos(-angleRad);

                // Yeni genişlik ve yüksekliği, farenin merkezden uzaklığının tam 2 katı yap
                // Böylece pembe buton tam mouse ucunda kalır
                const newW = Math.max(40, Math.abs(localX) * 2);
                const newH = Math.max(40, Math.abs(localY) * 2);

                // Sol üst köşeyi (x, y) merkez sabit kalacak şekilde güncelle
                selectedItem.x = centerX - (newW / 2);
                selectedItem.y = centerY - (newH / 2);
                selectedItem.width = newW;
                selectedItem.height = newH;
            }
        }

        
       // A. Resim Boyutlandırma (Resize)
        if (selectedPointKey === 'image_resize') {
            const centerX = selectedItem.x + (selectedItem.width / 2);
            const centerY = selectedItem.y + (selectedItem.height / 2);
            const newW = Math.max(20, Math.abs(pos.x - centerX) * 2);
            const newH = Math.max(20, Math.abs(pos.y - centerY) * 2);
            
            // Merkez noktası sabit kalarak büyüme/küçülme yapar
            selectedItem.x = centerX - (newW / 2);
            selectedItem.y = centerY - (newH / 2);
            selectedItem.width = newW;
            selectedItem.height = newH;
        }
        // B. Resim Döndürme (Rotate)
        else if (selectedPointKey === 'image_rotate') {
             const centerX = selectedItem.x + (selectedItem.width / 2);
             const centerY = selectedItem.y + (selectedItem.height / 2);
             const r_dx = pos.x - centerX;
             const r_dy = pos.y - centerY;
             selectedItem.rotation = Math.atan2(r_dy, r_dx) * (180 / Math.PI) + 90;
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


// --- DİKDÖRTGEN CANLI ÇİZİM VE ANLIK CM ÖNİZLEMESİ ---
    else if (isDrawingRectangle && rectStartPoint) {
        redrawAllStrokes(); // Eski çizimleri koru

        // Mıknatıs (snap) uyumlu canlı koordinatlar
        const widthPx = Math.abs(endPos.x - rectStartPoint.x);
        const heightPx = Math.abs(endPos.y - rectStartPoint.y);

        const widthCm = (widthPx / 30).toFixed(1).replace('.', ',');
        const heightCm = (heightPx / 30).toFixed(1).replace('.', ',');

        const startX = Math.min(rectStartPoint.x, endPos.x);
        const startY = Math.min(rectStartPoint.y, endPos.y);

        // Kesikli ve şeffaf önizleme çizgisi (Şov kısmı)
        ctx.globalAlpha = 0.6; 
        ctx.setLineDash([8, 4]);

        ctx.beginPath();
        ctx.rect(startX, startY, widthPx, heightPx);
        ctx.strokeStyle = window.currentLineColor || '#000000';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Çizgileri normale döndür
        ctx.globalAlpha = 1.0; 
        ctx.setLineDash([]);

        // Anlık CM Etiketlerini Yazdır
        ctx.font = "16px Arial";
        ctx.fillStyle = window.currentLineColor || '#000000';
        ctx.textAlign = "center";
        ctx.fillText(`${widthCm} cm`, startX + (widthPx / 2), startY - 10); 
        ctx.textAlign = "right";
        ctx.fillText(`${heightCm} cm`, startX - 10, startY + (heightPx / 2) + 5); 

        previewActive = true; // SİHRİ GERİ GETİREN KİLİT BURASI!
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


// F. CANLANDIR (SNAPSHOT) ÖNİZLEMESİ
    else if (currentTool === 'snapshot' && typeof snapshotStart !== 'undefined' && snapshotStart) {
        redrawAllStrokes(); // Ekranı temizle ve alttaki çizimleri geri getir
        ctx.globalAlpha = 1.0;
        ctx.setLineDash([6, 6]); // Kesikli çizgi efekti
        ctx.strokeStyle = '#00ffcc'; // Turkuaz renk
        ctx.lineWidth = 2;
        
        // Seçim dikdörtgenini çiz
        ctx.strokeRect(
            snapshotStart.x, 
            snapshotStart.y, 
            pos.x - snapshotStart.x, 
            pos.y - snapshotStart.y
        );
        ctx.setLineDash([]); // Çizgiyi normale döndür
        previewActive = true; 
    }

    if (previewActive) return; 

    // --- 5. AKTİF ÇİZİM (KALEM / SİLGİ) ---
    if (!isDrawing) return;

    if (currentTool === 'pen') {
        // YENİ: Hareket halindeki basıncı al
        const pInfoMove = getPointerInfo(e);
        const pressureMove = pInfoMove.type === 'pen' ? pInfoMove.pressure : 1;

        // YENİ: Yeni noktayı ve o anki basıncı (p) yola ekle
        drawnStrokes[drawnStrokes.length - 1].path.push({x: pos.x, y: pos.y, p: pressureMove});
        redrawAllStrokes();
    } 
   else if (currentTool === 'eraser') {
        let strokesToKeep = [];
        let needsRedraw = false;
        
        for (const stroke of drawnStrokes) {
            let touched = false;
            
            // 1. Kalem ve Nokta
            if (stroke.type === 'pen') {
                for (const point of stroke.path) { if (distance(point, pos) < 15) { touched = true; break; } }
            } else if (stroke.type === 'point') {
                if (distance(stroke, pos) < 15) touched = true;
            } 
            // 2. Çizgiler ve Işınlar
            else if (['straightLine', 'line', 'segment', 'ray'].includes(stroke.type)) {
                const steps = Math.max(1, Math.floor(distance(stroke.p1, stroke.p2) / 5)); 
                for (let i = 0; i <= steps; i++) {
                    const t = i / steps;
                    if (distance({x: stroke.p1.x + (stroke.p2.x - stroke.p1.x) * t, y: stroke.p1.y + (stroke.p2.y - stroke.p1.y) * t}, pos) < 15) { touched = true; break; }
                }
            }



            // 3. Çember ve Pergel Çizimleri
            else if (stroke.type === 'arc') {
                const distToCenter = distance(pos, {x: stroke.cx, y: stroke.cy});
                // Çizginin üstüne veya tam merkeze değerse siler
                if (distToCenter < 15 || Math.abs(distToCenter - stroke.radius) < 15) touched = true;
            }
            // 4. Çokgenler
            else if (stroke.type === 'polygon' && stroke.vertices) {
                // Çokgenin merkezine dokunursa siler
                if (stroke.center && distance(pos, stroke.center) < 15) touched = true;
                else {
                    // Çokgenin kenar çizgilerine dokunursa siler
                    for (let j = 0; j < stroke.vertices.length; j++) {
                        const v1 = stroke.vertices[j];
                        const v2 = stroke.vertices[(j + 1) % stroke.vertices.length];
                        const steps = Math.max(1, Math.floor(distance(v1, v2) / 5)); 
                        for (let step = 0; step <= steps; step++) { 
                            const t = step / steps;
                            if (distance({x: v1.x + (v2.x - v1.x) * t, y: v1.y + (v2.y - v1.y) * t}, pos) < 15) { touched = true; break; }
                        }
                        if (touched) break;
                    }
                }
            }
            // 5. Canlandır Kopyaları (PDF ARKA PLANI HARİÇ)
            else if (stroke.type === 'image' && !stroke.isBackground) {
                // Döndürülmüş olsa bile kopyanın sınırlarını hesaplar ve siler
                const dx = pos.x - stroke.x;
                const dy = pos.y - stroke.y;
                const angleRad = (stroke.rotation || 0) * (Math.PI / 180);
                const localX = dx * Math.cos(-angleRad) - dy * Math.sin(-angleRad);
                const localY = dx * Math.sin(-angleRad) + dy * Math.cos(-angleRad);
                const halfW = stroke.width / 2;
                const halfH = stroke.height / 2;
                if (localX > -halfW && localX < halfW && localY > -halfH && localY < halfH) {
                    touched = true;
                }
            }


// 6. Dikdörtgenleri Sil
            else if (stroke.type === 'rectangle') {
                const centerX = stroke.x + stroke.width / 2;
                const centerY = stroke.y + stroke.height / 2;
                const dx = pos.x - centerX;
                const dy = pos.y - centerY;
                const angleRad = (stroke.rotation || 0) * (Math.PI / 180);
                
                // Fare konumunu dikdörtgenin açısına göre yerelleştir (Döndürülmüş dikdörtgeni de siler)
                const localX = dx * Math.cos(-angleRad) - dy * Math.sin(-angleRad);
                const localY = dx * Math.sin(-angleRad) + dy * Math.cos(-angleRad);
                
                const halfW = stroke.width / 2;
                const halfH = stroke.height / 2;

                // Silgi kenarlara veya merkeze 15 piksel yaklaştıysa sil
                const nearEdge = (Math.abs(Math.abs(localX) - halfW) < 15 && Math.abs(localY) < halfH + 15) ||
                                 (Math.abs(Math.abs(localY) - halfH) < 15 && Math.abs(localX) < halfW + 15);
                const nearCenter = Math.abs(localX) < 20 && Math.abs(localY) < 20;

                if (nearEdge || nearCenter) touched = true;
            }


            if (touched) needsRedraw = true; 
            else strokesToKeep.push(stroke);
        }
        
        if (needsRedraw) { 
            drawnStrokes = strokesToKeep; 
            window.drawnStrokes = strokesToKeep; 
            redrawAllStrokes(); 
        }
    }
}, { passive: false });


canvas.addEventListener('pointerup', (e) => {
    // 1. Tarayıcı kilitlerini kaldır (Pardus Korumalı)
   
    if (e.pointerType === 'touch' && e.cancelable) e.preventDefault();

// --- PARDUS ÇİFT SİNYAL ENGELLEYİCİ ---
    if (e.pointerType === 'mouse') {
        let hasTouch = false;
        for (let p of pointers.values()) {
            if (p.pointerType === 'touch' || p.pointerType === 'pen') hasTouch = true;
        }
        if (hasTouch) return; // Hayalet fare kalkış yapmasın
    }
    // --------------------------------------


// --- BUNLARI EKLE: Kalkan parmağı sil ve zoom'u sıfırla ---
    pointers.delete(e.pointerId); 
    if (pointers.size < 2) lastDist = 0; 
    // -----------------------------------------------------------

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


// --- E) CANLANDIR (SNAPSHOT) BÖLÜMÜ (GÜNCEL NOKTA ATIŞI KESİM) ---
    if (currentTool === 'snapshot' && snapshotStart && currentMousePos) {
        const x = Math.min(snapshotStart.x, currentMousePos.x);
        const y = Math.min(snapshotStart.y, currentMousePos.y);
        const w = Math.abs(currentMousePos.x - snapshotStart.x);
        const h = Math.abs(currentMousePos.y - snapshotStart.y);

        if (w > 10 && h > 10) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = w;
            tempCanvas.height = h;
            const tempCtx = tempCanvas.getContext('2d');

            // --- 1. ARKA PLANI (PDF/RESİM) KES ---
            const bgLayer = document.getElementById('pdf-canvas') || document.querySelector('.pdf-page-canvas');
            if (bgLayer) {
                // Tablet/PC Çözünürlük farkını hesapla
                const sX = bgLayer.width / bgLayer.offsetWidth;
                const sY = bgLayer.height / bgLayer.offsetHeight;
                // Kaynak kanvasta (x,y) noktasından kes, hedefte (0,0) noktasına tam boyutta bas
                tempCtx.drawImage(bgLayer, x * sX, y * sY, w * sX, h * sY, 0, 0, w, h);
            }

            // --- 2. ÇİZİMLERİ KES ---
            tempCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h);

            const finalImage = tempCanvas.toDataURL('image/png');
            const rect = canvas.getBoundingClientRect();
            
            // Yüzen kutuyu oluştur (Yeşil ve pembe butonlu araç)
            olusturYuzenKopya(finalImage, x + rect.left, y + rect.top, w, h);
            
            snapshotStart = null; // Seçimi sıfırla (Burası kritik: İkinci kez yapınca karışmasın)
            setActiveTool('move'); // İşlem bitince taşıma moduna geç
        }
    }


    // --- DİKDÖRTGENİ TAMAMLAMA VE SİSTEME KAYDETME (TEK NESNE MODU) ---
if (isDrawingRectangle && rectStartPoint && finalPos) {
    const widthPx = Math.abs(finalPos.x - rectStartPoint.x);
    const heightPx = Math.abs(finalPos.y - rectStartPoint.y);

    if (widthPx > 10 && heightPx > 10) {
        const startX = Math.min(rectStartPoint.x, finalPos.x);
        const startY = Math.min(rectStartPoint.y, finalPos.y);
        const color = window.isToolThemeBlack ? '#000000' : (window.currentLineColor || '#000000');

        // 4 köşe harfini bir diziye alıyoruz
        const rectLabels = [nextPointChar];
        for (let i = 0; i < 3; i++) {
            nextPointChar = advanceChar(nextPointChar);
            rectLabels.push(nextPointChar);
        }
        nextPointChar = advanceChar(nextPointChar); // Bir sonraki çizim için harfi hazırla

        // ARTIK 4 AYRI SEGMENT DEĞİL, TEK BİR RECTANGLE KAYDEDİYORUZ
        drawnStrokes.push({ 
            type: 'rectangle', 
            x: startX, 
            y: startY, 
            width: widthPx, 
            height: heightPx, 
            rotation: 0, 
            color: color, 
            labels: rectLabels,
            showEdgeLabels: true, // CM değerlerini otomatik gösterir
            showAngleLabels: false // Tıklayınca açılması için başlangıçta kapalı
        });

        window.nextPointChar = nextPointChar; 
    }
}

// --- AKILLI TAHTA NOKTA KOYMA YAMASI ---
    if (currentTool === 'pen' && isDrawing) {
        const lastStroke = drawnStrokes[drawnStrokes.length - 1];
        // Eğer kalemle sadece tek bir noktaya dokunulup çekildiyse (hareket yoksa)
        if (lastStroke && lastStroke.type === 'pen' && lastStroke.path.length === 1) {
            // Görünür olması için yanına hayali bir nokta daha ekle
            const p = lastStroke.path[0];
            lastStroke.path.push({ x: p.x + 0.1, y: p.y + 0.1 });
        }
    }

    // --- GENEL SIFIRLAMA ---
    isDrawing = false;
    isDrawingLine = isDrawingInfinityLine = isDrawingSegment = isDrawingRay = false;
    isDrawingRectangle = false; // Takılı kalmayı kökten çözen kilit!
    lineStartPoint = null;
    rectStartPoint = null;      // Hafızayı temizle
    snapTarget = null;
    
    if (typeof snapIndicator !== 'undefined' && snapIndicator) snapIndicator.style.display = 'none';

    redrawAllStrokes();

}, { passive: false });


canvas.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
        e.preventDefault();
        
        const zoomStep = e.deltaY > 0 ? 0.95 : 1.05; 

        // SADECE ARKA PLANI (PDF/RESİM) BUL VE BÜYÜT/KÜÇÜLT
        const bgStrokes = drawnStrokes.filter(s => s.isBackground === true);
        if (bgStrokes.length > 0) {
            bgStrokes.forEach(bg => {
                const newW = bg.width * zoomStep;
                const newH = bg.height * zoomStep;
                // Merkezden büyütmek için x ve y koordinatlarını da kaydır
                bg.x = bg.x - (newW - bg.width) / 2;
                bg.y = bg.y - (newH - bg.height) / 2;
                bg.width = newW;
                bg.height = newH;
            });
            redrawAllStrokes();
        }
    }
}, { passive: false });
// --- POINTERCANCEL (KESİNTİ DURUMUNDA SIFIRLAMA) ---
canvas.addEventListener('pointercancel', (e) => {
// --- BUNLARI EKLE ---
    pointers.delete(e.pointerId);
    lastDist = 0;
    // --------------------

    // İşlemi iptal et ve tüm bayrakları (flag) indir
    isDrawing = false;
    isMoving = false;
    isPinching = false; // Varsa zoom işlemini de durdur
isDrawingRectangle = false; 
    rectStartPoint = null;
    
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


// --- BUNLARI EKLE: Tablet ekranından dışarı taşan parmakları zorla sil ---
canvas.addEventListener('pointerout', (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) lastDist = 0; });
canvas.addEventListener('pointerleave', (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) lastDist = 0; });


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

async function renderPDFPage(num) {
    if (!currentPDF) return;
    
    const page = await currentPDF.getPage(num);
    const viewport = page.getViewport({ scale: 2.0 }); // Netlik için 2x kalite

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
        addNewImageToCanvas(img, true);
    };
    img.src = tempCanvas.toDataURL();
    
    if(pageCountLabel) pageCountLabel.innerText = `Sayfa: ${num} / ${totalPDFPages}`;
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
        // --- 1. KRİTİK DÜZELTME: TAM ORTALAMA HESABI ---
        x: (canvas.width / 2) - (startWidth / 2),
        y: (canvas.height / 2) - (startHeight / 2),
        width: startWidth,
        height: startHeight,
        rotation: 0,
        isBackground: true 
    };
    
    // --- KRİTİK EKLENTİ: ESKİ SAYFAYI TEMİZLE ---
    // Eğer eklenen şey bir PDF sayfasıysa ve daha önce eklenmiş bir sayfa varsa,
    // eskisini hafızadan tamamen sil (Böylece üst üste binmezler)
    if (isPDF && typeof pdfImageStroke !== 'undefined' && pdfImageStroke !== null) {
        drawnStrokes = drawnStrokes.filter(stroke => stroke !== pdfImageStroke);
        window.drawnStrokes = drawnStrokes;
    }
    // --------------------------------------------

    drawnStrokes.push(newStroke);
    
    if (isPDF) {
        pdfImageStroke = newStroke; // Yeni sayfayı sisteme tanıt
    }
    
    // --- 2. KRİTİK DÜZELTME: BUTONU DOĞRU ZAMANDA GÖSTER ---
    // Resim veya PDF ekrana "gerçekten" çizildiği an bu buton görünür olacak
    const closeBtn = document.getElementById('btn-close-pdf');
    if(closeBtn) {
        closeBtn.classList.remove('hidden');
        closeBtn.style.display = 'flex';
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

    // Gerçekten ekran döndüyse veya boyut değiştiyse güncelle
    lastWindowWidth = newWidth;
    canvas.width = newWidth;
    canvas.height = newHeight;
    redrawAllStrokes();

// canvas.height = newHeight; satırının hemen altına ekle
setupCanvasResolution();
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

// =======================================================
// CANLANDIR (SNAPSHOT) - TABLET/PC UYUMLU YÜZEN KOPYA
// =======================================================
function olusturYuzenKopya(imgSrc, startX, startY, width, height) {
    // 1. Ana Kapsayıcı Kutu
    const container = document.createElement('div');
    container.className = 'yuzen-kopya-container'; // Global dokunma engelleri için sınıf
    container.style.position = 'absolute';
    container.style.left = startX + 'px';
    container.style.top = startY + 'px';
    container.style.width = width + 'px';
    container.style.height = height + 'px';
    container.style.border = '2px dashed #00ffcc';
    container.style.cursor = 'grab';
    container.style.zIndex = '9999';
    container.style.boxSizing = 'border-box';
    container.style.transformOrigin = 'center center';
    container.style.touchAction = 'none'; // KRİTİK: Tablette sayfa kaymasını yasaklar
    container.dataset.rotation = '0'; 

    // 2. Kopyalanan Resim
    const img = document.createElement('img');
    img.src = imgSrc;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.display = 'block';
    img.style.pointerEvents = 'none'; 
    container.appendChild(img);

    // 3. Döndürme (Yeşil) Butonu ve Sapı
    const rotateLine = document.createElement('div');
    rotateLine.style.position = 'absolute';
    rotateLine.style.top = '-20px';
    rotateLine.style.left = '50%';
    rotateLine.style.width = '2px';
    rotateLine.style.height = '20px';
    rotateLine.style.backgroundColor = '#00ff00';
    rotateLine.style.transform = 'translateX(-50%)';
    container.appendChild(rotateLine);

    const rotateBtn = document.createElement('div');
    rotateBtn.className = 'rotate-handle'; // Tablette kaymayı durduran mevcut sınıfınız
    rotateBtn.style.position = 'absolute';
    rotateBtn.style.top = '-40px';
    rotateBtn.style.left = '50%';
    rotateBtn.style.transform = 'translateX(-50%)';
    rotateBtn.style.width = '30px';
    rotateBtn.style.height = '30px';
    rotateBtn.style.backgroundColor = '#00ff00'; 
    rotateBtn.style.borderRadius = '50%';
    rotateBtn.style.cursor = 'grab';
    rotateBtn.style.border = '2px solid white';
    rotateBtn.style.boxShadow = '0px 2px 5px rgba(0,0,0,0.5)';
    rotateBtn.style.touchAction = 'none'; // KRİTİK
    container.appendChild(rotateBtn);

    // 4. Yeniden Boyutlandırma (Pembe) Butonu
    const resizeBtn = document.createElement('div');
    resizeBtn.className = 'resize-handle'; // Tablette kaymayı durduran mevcut sınıfınız
    resizeBtn.style.position = 'absolute';
    resizeBtn.style.bottom = '-15px';
    resizeBtn.style.right = '-15px';
    resizeBtn.style.width = '30px';
    resizeBtn.style.height = '30px';
    resizeBtn.style.backgroundColor = '#ff00ff'; 
    resizeBtn.style.borderRadius = '50%';
    resizeBtn.style.cursor = 'nwse-resize';
    resizeBtn.style.border = '2px solid white';
    resizeBtn.style.boxShadow = '0px 2px 5px rgba(0,0,0,0.5)';
    resizeBtn.style.touchAction = 'none'; // KRİTİK
    container.appendChild(resizeBtn);

    document.body.appendChild(container);

    // --- TABLET UYUMLU ETKİLEŞİM MANTIĞI ---
    let mode = 'none'; 
    let startEvtX, startEvtY, initialLeft, initialTop, initialWidth, initialHeight, initialRotation, centerX, centerY;
    let activePointerId = null; // Parmağı takip etmek için kilit ID'si

    // Döndürmeye Başla
    rotateBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation(); e.preventDefault();
        mode = 'rotate';
        activePointerId = e.pointerId;
        rotateBtn.setPointerCapture(activePointerId); // KRİTİK: Parmağı yeşil butona kilitle!

        const rect = container.getBoundingClientRect();
        centerX = rect.left + rect.width / 2;
        centerY = rect.top + rect.height / 2;
        initialRotation = parseFloat(container.dataset.rotation) || 0;
        container.dataset.startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
    });

    // Boyutlandırmaya Başla
    resizeBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation(); e.preventDefault();
        mode = 'resize';
        activePointerId = e.pointerId;
        resizeBtn.setPointerCapture(activePointerId); // KRİTİK: Parmağı pembe butona kilitle!

        startEvtX = e.clientX; startEvtY = e.clientY;
        initialWidth = container.offsetWidth; initialHeight = container.offsetHeight;
    });

    // Sürüklemeye Başla
    container.addEventListener('pointerdown', (e) => {
        if (e.target === rotateBtn || e.target === resizeBtn) return;
        e.stopPropagation(); e.preventDefault();
        mode = 'drag';
        activePointerId = e.pointerId;
        container.setPointerCapture(activePointerId); // KRİTİK: Parmağı resme kilitle!

        container.style.cursor = 'grabbing';
        startEvtX = e.clientX; startEvtY = e.clientY;
        initialLeft = container.offsetLeft; initialTop = container.offsetTop;
    });

    // Hareket Etme (Move)
    const onMove = (e) => {
        if (mode === 'none') return;
        if (e.pointerId !== activePointerId) return; // İkinci parmakla yapılan müdahaleleri engeller
        e.preventDefault();

        if (mode === 'drag') {
            container.style.left = (initialLeft + (e.clientX - startEvtX)) + 'px';
            container.style.top = (initialTop + (e.clientY - startEvtY)) + 'px';
        } else if (mode === 'resize') {
            const newWidth = Math.max(30, initialWidth + (e.clientX - startEvtX));
            container.style.width = newWidth + 'px';
            container.style.height = initialHeight * (newWidth / initialWidth) + 'px'; 
        } else if (mode === 'rotate') {
            const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
            const finalRotation = initialRotation + (currentAngle - parseFloat(container.dataset.startAngle));
            container.style.transform = `rotate(${finalRotation}deg)`;
            container.dataset.rotation = finalRotation;
        }
    };

    // Parmağı Kaldırma (Bırakma)
    const onUp = (e) => {
        if (mode === 'none') return;
        
        // Kilidi serbest bırak
        if (e.target.hasPointerCapture && e.target.hasPointerCapture(e.pointerId)) {
            e.target.releasePointerCapture(e.pointerId);
        }
        
        if (mode === 'drag') container.style.cursor = 'grab'; 
        mode = 'none'; 
        activePointerId = null;
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp); // Tarayıcı hatasında da bırak

    // --- BOŞLUĞA TIKLAYINCA ANA KANVASA MÜHÜRLE (TABLET ÇOKLU KOPYA ÖNLEYİCİ) ---
    setTimeout(() => {
        let isStamped = false; // Çoklu kopyayı engelleyen kilit

        const disariTiklama = (e) => {
            // 1. Eğer zaten mühürlendiyse veya tıklanan yer kutunun içindeyse işlem yapma
            if (isStamped || container.contains(e.target)) return;

            // 2. Kilidi hemen kapat (Birden fazla kopya oluşmasını engeller)
            isStamped = true;
            window.removeEventListener('pointerdown', disariTiklama, true);

            const rect = canvas.getBoundingClientRect();
            
            if (window.drawnStrokes) {
                // Sadece dikdörtgen içindeki alanı kanvasa mühürle
                window.drawnStrokes.push({
                    type: 'image',
                    imgData: imgSrc, 
                    // --- KAYMAYI SIFIRLAYAN KESİN KOORDİNATLAR ---
                    x: parseFloat(container.style.left) - rect.left,
                    y: parseFloat(container.style.top) - rect.top,
                    width: parseFloat(container.style.width),
                    height: parseFloat(container.style.height),
                    rotation: parseFloat(container.dataset.rotation) || 0,
                    isBackground: false 
                });

                // Ekranı güncelle ve kopyayı kalıcı hale getir
                if (window.redrawAllStrokes) window.redrawAllStrokes(); 
            }
            
            // 3. Yüzen kutuyu ve diğer izleyicileri temizle
            container.remove();
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };

        // 'true' parametresi ile olay yakalama (capture) modunda dinliyoruz
        window.addEventListener('pointerdown', disariTiklama, true); 
    }, 200);
}

// Dosyanın en altına ekle
window.addEventListener('load', () => {
    setTimeout(setupCanvasResolution, 500);
});