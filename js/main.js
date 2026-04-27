/* ═══════════════════════════════════════════════════════════════
   ROBERT: DETECTOR DE ESTAFAS — MAIN JS
   Motor de análisis + UI + Compartir + Video
   ═══════════════════════════════════════════════════════════════ */

import { analyzeData } from './analyzer.js';
import { initParticles } from './particles.js';
import { generateShareImage, generateTikTokVideo } from './media.js';

/* ─── DOM ELEMENTS ─── */
const heroSection       = document.getElementById('hero-section');
const loadingSection    = document.getElementById('loading-section');
const resultSection     = document.getElementById('result-section');
const safeSection       = document.getElementById('safe-section');

const messageInput      = document.getElementById('message-input');
const charCount         = document.getElementById('char-count');
const analyzeBtn        = document.getElementById('analyze-btn');

const progressBar       = document.getElementById('progress-bar');
const loadingPercent    = document.getElementById('loading-percent');

// Result elements
const alertIcon         = document.getElementById('alert-icon');
const alertTitle        = document.getElementById('alert-title');
const alertSubtitle     = document.getElementById('alert-subtitle');
const gaugeFill         = document.getElementById('gauge-fill');
const gaugeNumber       = document.getElementById('gauge-number');
const levelBadge        = document.getElementById('level-badge');
const typeText          = document.getElementById('type-text');
const indicatorsGrid    = document.getElementById('indicators-grid');
const timeline          = document.getElementById('timeline');
const explanationCards  = document.getElementById('explanation-cards');
const originalTextBox   = document.getElementById('original-text-box');

// Share buttons
const btnShareWhatsapp  = document.getElementById('btn-share-whatsapp');
const btnCreateImage    = document.getElementById('btn-create-image');
const btnDownload       = document.getElementById('btn-download');
const btnTikTok         = document.getElementById('btn-tiktok');

// New analysis buttons
const btnNewAnalysis     = document.getElementById('btn-new-analysis');
const btnNewAnalysisSafe = document.getElementById('btn-new-analysis-safe');

// Tabs
const inputTabs          = document.querySelectorAll('.input-tab');

/* ─── STATE ─── */
let currentResult = null;
let selectedImages = [];

const imageUpload = document.getElementById('image-upload');
const uploadArea = document.getElementById('upload-area');
const imagePreviewContainer = document.getElementById('image-preview-container');
const textInputWrapper    = document.getElementById('text-input-wrapper');
const imageUploadWrapper  = document.getElementById('image-upload-wrapper');
const victimUploadWrapper = document.getElementById('victim-upload-wrapper');
const victimReportSection = document.getElementById('victim-report-section');


/* ═══════════════════════════════════════════════════════════════
   INITIALIZATION
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  bindEvents();
});

/* ─── BIND EVENTS ─── */
function bindEvents() {
  // About Modal & Donate Modal
  const btnAbout = document.getElementById('btn-about');
  const btnDonate = document.getElementById('btn-donate');
  const aboutModal = document.getElementById('about-modal');
  const donateModal = document.getElementById('donate-modal');
  
  if (btnAbout && aboutModal) {
    btnAbout.addEventListener('click', () => aboutModal.classList.remove('hidden'));
    document.getElementById('modal-close-about')?.addEventListener('click', () => aboutModal.classList.add('hidden'));
    aboutModal.addEventListener('click', (e) => { if (e.target === aboutModal) aboutModal.classList.add('hidden'); });
  }
  
  if (btnDonate && donateModal) {
    btnDonate.addEventListener('click', () => donateModal.classList.remove('hidden'));
    document.getElementById('modal-close-donate')?.addEventListener('click', () => donateModal.classList.add('hidden'));
    donateModal.addEventListener('click', (e) => { if (e.target === donateModal) donateModal.classList.add('hidden'); });
  }

  // Payment Handlers
  const paymentBtns = document.querySelectorAll('.btn-payment');
  paymentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof showToast === 'function') {
        showToast('💙 Abriendo pasarela segura de Mercado Pago...');
      }
    });
  });
  // Character counter
  messageInput.addEventListener('input', () => {
    const len = messageInput.value.length;
    charCount.textContent = `${len.toLocaleString()} / 5,000`;
  });

  // Tabs switching logic
  inputTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      inputTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const tabType = tab.dataset.tab;
      textInputWrapper.style.display    = 'none';
      imageUploadWrapper.style.display  = 'none';
      if (victimUploadWrapper) victimUploadWrapper.style.display = 'none';

      if (tabType === 'link') {
        textInputWrapper.style.display = 'block';
        messageInput.focus();
      } else if (tabType === 'victim') {
        if (victimUploadWrapper) victimUploadWrapper.style.display = 'block';
        // Swap analyze button text
        analyzeBtn.querySelector('.btn-text').textContent = 'Generar Reporte OSINT';
        analyzeBtn.querySelector('.btn-icon').textContent = '🚨';
      } else {
        imageUploadWrapper.style.display = 'block';
        analyzeBtn.querySelector('.btn-text').textContent = 'Analizar ahora';
        analyzeBtn.querySelector('.btn-icon').textContent = '🔍';
      }

      if (tabType !== 'victim') {
        analyzeBtn.querySelector('.btn-text').textContent = tabType === 'link' ? 'Analizar ahora' : 'Analizar ahora';
        analyzeBtn.querySelector('.btn-icon').textContent = '🔍';
      }
    });
  });

  // Victim Back button
  document.getElementById('btn-victim-back')?.addEventListener('click', () => {
    victimReportSection.classList.add('hidden');
    heroSection.classList.remove('hidden');
    // Bug fix #2: reset analyze button text when going back
    analyzeBtn.querySelector('.btn-text').textContent = 'Analizar ahora';
    analyzeBtn.querySelector('.btn-icon').textContent = '🔍';
    // Re-activate the first tab visually
    inputTabs.forEach(t => t.classList.remove('active'));
    document.getElementById('tab-images')?.classList.add('active');
    imageUploadWrapper.style.display = 'block';
    textInputWrapper.style.display = 'none';
    if (victimUploadWrapper) victimUploadWrapper.style.display = 'none';
  });

  // Print report button
  document.getElementById('btn-print-report')?.addEventListener('click', () => {
    window.print();
  });

  // Bug fix #1: EXIF listener moved here (avoids DOMContentLoaded timing issue with ES modules)
  const victimPhoto = document.getElementById('victim-photo');
  const exifLabel   = document.getElementById('exif-upload-label');
  const exifText    = document.getElementById('exif-upload-text');
  if (victimPhoto && exifLabel) {
    victimPhoto.addEventListener('change', () => {
      if (victimPhoto.files.length > 0) {
        exifLabel.classList.add('has-file');
        exifText.textContent = '✅ ' + victimPhoto.files[0].name + ' — Lista para analizar';
      } else {
        exifLabel.classList.remove('has-file');
        exifText.textContent = 'Toca para subir la foto del estafador';
      }
    });
  }

  // Image Upload Logic
  if (imageUpload) {
    imageUpload.addEventListener('change', handleImageSelection);
  }
  
  if (uploadArea) {
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });
    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('dragover');
    });
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      if (e.dataTransfer.files) {
        addFiles(Array.from(e.dataTransfer.files));
      }
    });
  }

  // Analyze button
  analyzeBtn.addEventListener('click', startAnalysis);
  
  // Enter key (Ctrl+Enter to submit)
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      startAnalysis();
    }
  });

  // New analysis buttons
  btnNewAnalysis.addEventListener('click', resetToHome);
  btnNewAnalysisSafe.addEventListener('click', resetToHome);

  // Share buttons
  btnShareWhatsapp.addEventListener('click', shareWhatsApp);
  btnCreateImage.addEventListener('click', handleCreateImage);
  btnDownload.addEventListener('click', handleDownload);
  btnTikTok.addEventListener('click', handleTikTok);
}

/* ═══════════════════════════════════════════════════════════════
   IMAGE HANDLING
   ═══════════════════════════════════════════════════════════════ */
function handleImageSelection(e) {
  if (e.target.files) addFiles(Array.from(e.target.files));
}

function addFiles(files) {
  // Relaxed verification in case mobile screenshots don't set proper image/ type
  const validFiles = files.filter(f => f.type.startsWith('image/') || f.name.match(/\.(jpg|jpeg|png|webp|heic)$/i) || f.type === "");
  // Max 6 images
  if (selectedImages.length + validFiles.length > 6) {
    showToast('⚠️ Solo puedes subir hasta 6 capturas máximo');
  }
  const toAdd = validFiles.slice(0, 6 - selectedImages.length);
  selectedImages = [...selectedImages, ...toAdd];
  renderPreviews();
}

function removeImage(index) {
  selectedImages.splice(index, 1);
  renderPreviews();
}

function renderPreviews() {
  imagePreviewContainer.innerHTML = '';
  selectedImages.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    const div = document.createElement('div');
    div.className = 'image-preview-item';
    div.innerHTML = `
      <img src="${url}" alt="Preview">
      <button class="remove-image-btn" onclick="removeImage(${index})">❌</button>
    `;
    imagePreviewContainer.appendChild(div);
  });
}

/* ═══════════════════════════════════════════════════════════════
   VICTIM OSINT: BASE DE DATOS DE PREFIJOS TELEFÓNICOS
   ═══════════════════════════════════════════════════════════════ */
const PHONE_PREFIXES = [
  { prefix: '+1 204', country: 'Canadá', city: 'Manitoba' },
  { prefix: '+1 647', country: 'Canadá', city: 'Toronto, Ontario' },
  { prefix: '+1 514', country: 'Canadá', city: 'Montreal, Quebec' },
  { prefix: '+1 604', country: 'Canadá', city: 'Vancouver, BC' },
  { prefix: '+1', country: 'Estados Unidos / Canadá', city: 'Norteamérica' },
  { prefix: '+57 310', country: 'Colombia', city: 'Línea Claro' },
  { prefix: '+57 311', country: 'Colombia', city: 'Línea Claro' },
  { prefix: '+57 312', country: 'Colombia', city: 'Línea Claro' },
  { prefix: '+57 313', country: 'Colombia', city: 'Línea Claro' },
  { prefix: '+57 314', country: 'Colombia', city: 'Línea Claro' },
  { prefix: '+57 315', country: 'Colombia', city: 'Línea Tigo' },
  { prefix: '+57 316', country: 'Colombia', city: 'Línea Tigo' },
  { prefix: '+57 317', country: 'Colombia', city: 'Línea Tigo' },
  { prefix: '+57 318', country: 'Colombia', city: 'Línea Tigo' },
  { prefix: '+57 319', country: 'Colombia', city: 'Línea ETB' },
  { prefix: '+57 320', country: 'Colombia', city: 'Línea Tigo' },
  { prefix: '+57 321', country: 'Colombia', city: 'Línea Tigo' },
  { prefix: '+57 322', country: 'Colombia', city: 'Línea Tigo' },
  { prefix: '+57 323', country: 'Colombia', city: 'Línea Tigo' },
  { prefix: '+57 324', country: 'Colombia', city: 'Línea Tigo' },
  { prefix: '+57 300', country: 'Colombia', city: 'Línea Claro (Bogotá)' },
  { prefix: '+57 301', country: 'Colombia', city: 'Línea Claro' },
  { prefix: '+57 302', country: 'Colombia', city: 'Línea Claro' },
  { prefix: '+57 303', country: 'Colombia', city: 'Línea Claro' },
  { prefix: '+57 304', country: 'Colombia', city: 'Línea Claro' },
  { prefix: '+57 305', country: 'Colombia', city: 'Línea Claro' },
  { prefix: '+57 350', country: 'Colombia', city: 'Línea Movistar' },
  { prefix: '+57 351', country: 'Colombia', city: 'Línea Movistar' },
  { prefix: '+57 352', country: 'Colombia', city: 'Línea Movistar' },
  { prefix: '+57', country: 'Colombia', city: 'Colombia' },
  { prefix: '+52 55', country: 'México', city: 'Ciudad de México' },
  { prefix: '+52 33', country: 'México', city: 'Guadalajara, Jalisco' },
  { prefix: '+52 81', country: 'México', city: 'Monterrey, Nuevo León' },
  { prefix: '+52', country: 'México', city: 'México' },
  { prefix: '+54 11', country: 'Argentina', city: 'Buenos Aires' },
  { prefix: '+54', country: 'Argentina', city: 'Argentina' },
  { prefix: '+55 11', country: 'Brasil', city: 'São Paulo' },
  { prefix: '+55 21', country: 'Brasil', city: 'Río de Janeiro' },
  { prefix: '+55', country: 'Brasil', city: 'Brasil' },
  { prefix: '+51 1', country: 'Perú', city: 'Lima' },
  { prefix: '+51', country: 'Perú', city: 'Perú' },
  { prefix: '+56 2', country: 'Chile', city: 'Santiago' },
  { prefix: '+56', country: 'Chile', city: 'Chile' },
  { prefix: '+58 212', country: 'Venezuela', city: 'Caracas' },
  { prefix: '+58', country: 'Venezuela', city: 'Venezuela' },
  { prefix: '+593 2', country: 'Ecuador', city: 'Quito' },
  { prefix: '+593', country: 'Ecuador', city: 'Ecuador' },
  { prefix: '+591', country: 'Bolivia', city: 'Bolivia' },
  { prefix: '+595', country: 'Paraguay', city: 'Paraguay' },
  { prefix: '+598', country: 'Uruguay', city: 'Uruguay' },
  { prefix: '+507', country: 'Panamá', city: 'Panamá' },
  { prefix: '+506', country: 'Costa Rica', city: 'Costa Rica' },
  { prefix: '+503', country: 'El Salvador', city: 'El Salvador' },
  { prefix: '+504', country: 'Honduras', city: 'Honduras' },
  { prefix: '+502', country: 'Guatemala', city: 'Guatemala' },
  { prefix: '+505', country: 'Nicaragua', city: 'Nicaragua' },
  { prefix: '+53', country: 'Cuba', city: 'Cuba' },
  { prefix: '+509', country: 'Haití', city: 'Haití' },
  { prefix: '+1 809', country: 'República Dominicana', city: 'Santo Domingo' },
  { prefix: '+34 91', country: 'España', city: 'Madrid' },
  { prefix: '+34 93', country: 'España', city: 'Barcelona' },
  { prefix: '+34', country: 'España', city: 'España' },
  { prefix: '+44 20', country: 'Reino Unido', city: 'Londres' },
  { prefix: '+44', country: 'Reino Unido', city: 'Reino Unido' },
  { prefix: '+33 1', country: 'Francia', city: 'París' },
  { prefix: '+33', country: 'Francia', city: 'Francia' },
  { prefix: '+49 30', country: 'Alemania', city: 'Berlín' },
  { prefix: '+49', country: 'Alemania', city: 'Alemania' },
  { prefix: '+39 06', country: 'Italia', city: 'Roma' },
  { prefix: '+39', country: 'Italia', city: 'Italia' },
  { prefix: '+7 495', country: 'Rusia', city: 'Moscú' },
  { prefix: '+7', country: 'Rusia / Kazajistán', city: 'Rusia' },
  { prefix: '+86 10', country: 'China', city: 'Pekín' },
  { prefix: '+86 21', country: 'China', city: 'Shanghái' },
  { prefix: '+86', country: 'China', city: 'China' },
  { prefix: '+91 11', country: 'India', city: 'Nueva Delhi' },
  { prefix: '+91 22', country: 'India', city: 'Bombay / Mumbai' },
  { prefix: '+91', country: 'India', city: 'India' },
  { prefix: '+234 1', country: 'Nigeria', city: 'Lagos' },
  { prefix: '+234 9', country: 'Nigeria', city: 'Abuja' },
  { prefix: '+234', country: 'Nigeria', city: 'Nigeria' },
  { prefix: '+27 11', country: 'Sudáfrica', city: 'Johannesburgo' },
  { prefix: '+27', country: 'Sudáfrica', city: 'Sudáfrica' },
  { prefix: '+20 2', country: 'Egipto', city: 'El Cairo' },
  { prefix: '+20', country: 'Egipto', city: 'Egipto' },
  { prefix: '+212', country: 'Marruecos', city: 'Marruecos' },
  { prefix: '+54', country: 'Argentina', city: 'Argentina' },
  { prefix: '+971 4', country: 'Emiratos Árabes', city: 'Dubái' },
  { prefix: '+971', country: 'Emiratos Árabes', city: 'Emiratos Árabes Unidos' },
  { prefix: '+966 11', country: 'Arabia Saudita', city: 'Riad' },
  { prefix: '+966', country: 'Arabia Saudita', city: 'Arabia Saudita' },
  { prefix: '+82 2', country: 'Corea del Sur', city: 'Seúl' },
  { prefix: '+82', country: 'Corea del Sur', city: 'Corea del Sur' },
  { prefix: '+81 3', country: 'Japón', city: 'Tokio' },
  { prefix: '+81', country: 'Japón', city: 'Japón' },
  { prefix: '+63 2', country: 'Filipinas', city: 'Manila' },
  { prefix: '+63', country: 'Filipinas', city: 'Filipinas' },
  { prefix: '+62 21', country: 'Indonesia', city: 'Yakarta' },
  { prefix: '+62', country: 'Indonesia', city: 'Indonesia' },
  { prefix: '+60 3', country: 'Malasia', city: 'Kuala Lumpur' },
  { prefix: '+60', country: 'Malasia', city: 'Malasia' },
  { prefix: '+66 2', country: 'Tailandia', city: 'Bangkok' },
  { prefix: '+66', country: 'Tailandia', city: 'Tailandia' },
  { prefix: '+880', country: 'Bangladés', city: 'Daca' },
  { prefix: '+92 51', country: 'Pakistán', city: 'Islamabad' },
  { prefix: '+92', country: 'Pakistán', city: 'Pakistán' },
  { prefix: '+961', country: 'Líbano', city: 'Beirut' },
  { prefix: '+90 212', country: 'Turquía', city: 'Estambul' },
  { prefix: '+90', country: 'Turquía', city: 'Turquía' },
  { prefix: '+380', country: 'Ucrania', city: 'Ucrania' },
  { prefix: '+48', country: 'Polonia', city: 'Polonia' },
  { prefix: '+31', country: 'Países Bajos', city: 'Países Bajos' },
  { prefix: '+32', country: 'Bélgica', city: 'Bélgica' },
  { prefix: '+41', country: 'Suiza', city: 'Suiza' },
  { prefix: '+43', country: 'Austria', city: 'Austria' },
  { prefix: '+46', country: 'Suecia', city: 'Estocolmo' },
  { prefix: '+47', country: 'Noruega', city: 'Oslo' },
  { prefix: '+45', country: 'Dinamarca', city: 'Copenhague' },
  { prefix: '+358', country: 'Finlandia', city: 'Helsinki' },
  { prefix: '+351', country: 'Portugal', city: 'Lisboa' },
  { prefix: '+30', country: 'Grecia', city: 'Atenas' },
  { prefix: '+40', country: 'Rumanía', city: 'Bucarest' },
  { prefix: '+420', country: 'República Checa', city: 'Praga' },
  { prefix: '+36', country: 'Hungría', city: 'Budapest' },
];

function resolvePhoneOsint(phone) {
  // Normalise: remove spaces/dashes for matching
  const clean = phone.replace(/[\s\-()]/g, '');
  // Sort by prefix length descending for most specific match
  const sorted = [...PHONE_PREFIXES].sort((a, b) => b.prefix.replace(/\s/g,'').length - a.prefix.replace(/\s/g,'').length);
  for (const entry of sorted) {
    const cleanPrefix = entry.prefix.replace(/\s/g, '');
    if (clean.startsWith(cleanPrefix)) {
      return entry;
    }
  }
  return null;
}

/* Bug fix #1: EXIF listener is now in bindEvents() — this block removed */

async function startVictimOsint() {
  const phone      = document.getElementById('victim-phone')?.value.trim();
  const handle     = document.getElementById('victim-handle')?.value.trim();
  const photoInput = document.getElementById('victim-photo');
  const photoFile  = photoInput?.files[0] || null;

  if (!phone && !handle && !photoFile) {
    showToast('⚠️ Ingresa el teléfono, @usuario o una foto del estafador');
    return;
  }

  // Show loading
  heroSection.classList.add('hidden');
  loadingSection.classList.remove('hidden');
  const loadingTitle = document.querySelector('.loading-title');
  if (loadingTitle) loadingTitle.textContent = 'Analizando metadatos EXIF y prefijos telefónicos…';

  // Try EXIF extraction if photo uploaded
  let gpsCoords = null;
  if (photoFile) {
    try {
      showToast('📸 Escaneando metadatos GPS de la imagen…');
      // exifr is loaded as a global via CDN script tag
      const exifData = await window.exifr.parse(photoFile, { gps: true });
      if (exifData && exifData.latitude != null && exifData.longitude != null) {
        gpsCoords = { lat: exifData.latitude, lng: exifData.longitude };
      }
    } catch (e) {
      console.warn('EXIF parse error:', e);
    }
  }

  setTimeout(() => {
    loadingSection.classList.add('hidden');

    // ── Phone prefix OSINT ──
    let osint = null;
    if (phone) osint = resolvePhoneOsint(phone);

    const locationStr = osint
      ? `${osint.country} · Operadora de Origen: ${osint.city} (puede variar por portabilidad numérica)`
      : (phone ? 'Prefijo no registrado / Internacional' : 'No se proporcionó teléfono');

    const searchQuery   = osint ? `${osint.city}, ${osint.country}` : (phone || handle || 'world');
    const encodedQuery  = encodeURIComponent(searchQuery);
    const mapZoom       = osint ? 7 : 2;

    // ── Fill report ──
    document.getElementById('report-date').textContent   = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }) + ' (Hora Colombia)';
    document.getElementById('report-id').textContent     = 'RBT-' + Date.now().toString(36).toUpperCase();
    document.getElementById('report-phone').textContent  = phone  || 'No proporcionado';
    document.getElementById('report-handle').textContent = handle || 'No proporcionado';
    document.getElementById('report-location').textContent = locationStr;

    // ── GPS EXIF block ──
    const gpsBlock = document.getElementById('report-gps-block');
    if (gpsCoords) {
      const latStr  = gpsCoords.lat.toFixed(6);
      const lngStr  = gpsCoords.lng.toFixed(6);
      const mapsUrl = `https://www.google.com/maps?q=${latStr},${lngStr}`;
      const embedUrl = `https://maps.google.com/maps?q=${latStr},${lngStr}&t=&z=16&ie=UTF8&iwloc=&output=embed`;

      document.getElementById('report-lat').textContent  = latStr;
      document.getElementById('report-lng').textContent  = lngStr;
      const gpsLink = document.getElementById('report-gps-link');
      gpsLink.href        = mapsUrl;
      gpsLink.textContent = `📍 ${latStr}, ${lngStr}`;

      document.getElementById('report-gps-map').innerHTML =
        `<iframe src="${embedUrl}" title="GPS exacto del estafador" loading="lazy" style="width:100%;height:100%;border:none;"></iframe>`;

      gpsBlock.style.display = 'block';
      showToast('🎯 ¡Coordenadas GPS reales encontradas en la imagen!');
    } else {
      gpsBlock.style.display = 'none';
      if (photoFile) {
        showToast('ℹ️ La foto no contiene coordenadas GPS (WhatsApp las elimina automáticamente)');
      }
    }

    // ── Prefix map (only show if phone was provided) ──
    const prefixBlock  = document.getElementById('report-prefix-block');
    const mapContainer = document.getElementById('report-map-container');

    if (phone) {
      prefixBlock.style.display = 'block';
      mapContainer.innerHTML = `<iframe 
        src="https://maps.google.com/maps?q=${encodedQuery}&t=&z=${mapZoom}&ie=UTF8&iwloc=&output=embed"
        title="Rastreo OSINT por prefijo"
        loading="lazy"
        style="width:100%;height:100%;border:none;">
      </iframe>`;
    } else {
      // No phone — hide the whole geographic block
      prefixBlock.style.display = 'none';
    }

    // Show report
    victimReportSection.classList.remove('hidden');

    // Silently add to blacklist
    if (phone) {
      fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `REPORTE VÍCTIMA. Número: ${phone}. Alias: ${handle || 'N/A'}. GPS: ${gpsCoords ? `${gpsCoords.lat},${gpsCoords.lng}` : 'N/A'}. Ubicación prefijo: ${locationStr}` })
      }).catch(() => {});
    }
  }, 2500);
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

// Para usar la funcion global de remove
window.removeImage = removeImage;

/* ═══════════════════════════════════════════════════════════════
   ANALISIS DE IMÁGENES: OCR LOCAL TESSERACT.JS
   ═══════════════════════════════════════════════════════════════ */
async function extractTextFromImages(files) {
  let combinedText = '';
  // Convertimos las imágenes subidas en texto mediante Tesseract JS local
  // Informamos al usuario en la notificación
  showToast('👁️ Leyendo imágenes con Visión Artificial...');
  
  for (const file of files) {
    try {
      const url = URL.createObjectURL(file);
      const result = await Tesseract.recognize(url, 'spa');
      combinedText += result.data.text + '\n';
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error al extraer texto:', e);
    }
  }
  return combinedText.trim();
}

/* ═══════════════════════════════════════════════════════════════
   ANALYSIS FLOW
   ═══════════════════════════════════════════════════════════════ */
async function startAnalysis() {
  const activeTab = document.querySelector('.input-tab.active').dataset.tab;
  let payload = {};

  // Route victim tab to its own flow
  if (activeTab === 'victim') {
    startVictimOsint();
    return;
  }

  if (activeTab === 'link') {
    const text = messageInput.value.trim();
    if (!text) {
      showToast('⚠️ Pega un link o mensaje para analizar');
      messageInput.focus();
      return;
    }
    payload = { message: text };
  } else {
    if (selectedImages.length === 0) {
      showToast('📸 Sube al menos 1 captura de pantalla');
      return;
    }
  }

  // Show loading IMMEDIATELY, before OCR handles heavy processing
  heroSection.classList.add('hidden');
  loadingSection.classList.remove('hidden');
  resultSection.classList.add('hidden');
  safeSection.classList.add('hidden');

  try {
    if (activeTab !== 'link') {
      // Extraer texto de las capturas con OCR localmente
      const extractedText = await extractTextFromImages(selectedImages);
      
      if (!extractedText || extractedText.length < 5) {
        throw new Error('No se pudo leer texto en las imágenes. Intenta con fotos más claras.');
      }
      payload = { message: extractedText };
    }

    // Run analysis and animation concurrently
    const [_, analysisResult] = await Promise.all([
      runLoadingAnimation(),
      analyzeData(payload)
    ]);

    currentResult = analysisResult;

    // Hide loading, show result
    loadingSection.classList.add('hidden');

    if (currentResult.score >= 40) {
      showDangerResult(currentResult);
    } else {
      showSafeResult(currentResult);
    }

    // Scroll to top of result
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (error) {
    console.error('Analysis failed:', error);
    resetToHome();
    showToast('❌ ' + error.message);
  }
}

/* ─── LOADING ANIMATION ─── */
async function runLoadingAnimation() {
  const steps = [
    document.getElementById('step-1'),
    document.getElementById('step-2'),
    document.getElementById('step-3'),
    document.getElementById('step-4')
  ];
  
  let progress = 0;
  
  for (let i = 0; i < steps.length; i++) {
    steps[i].classList.add('active');
    
    // Animate progress from current to next checkpoint
    const target = ((i + 1) / steps.length) * 100;
    await animateProgress(progress, target, 600 + Math.random() * 400);
    progress = target;
    
    steps[i].classList.remove('active');
    steps[i].classList.add('done');
    
    await sleep(200);
  }
  
  // Reset steps for next time
  steps.forEach(s => {
    s.classList.remove('active', 'done');
  });
  progressBar.style.width = '0%';
  loadingPercent.textContent = '0%';
}

function animateProgress(from, to, duration) {
  return new Promise(resolve => {
    const start = performance.now();
    function frame(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = from + (to - from) * eased;
      
      progressBar.style.width = `${current}%`;
      loadingPercent.textContent = `${Math.round(current)}%`;
      
      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

/* ═══════════════════════════════════════════════════════════════
   RENDER DANGER RESULT
   ═══════════════════════════════════════════════════════════════ */
function showDangerResult(result) {
  resultSection.classList.remove('hidden');

  // Alert styling based on level
  if (result.level === 'ALTO') {
    alertIcon.textContent = '🚨';
    alertTitle.textContent = '¡ALERTA DE ESTAFA DETECTADA!';
    alertSubtitle.textContent = 'Este mensaje contiene múltiples indicadores de fraude';
  } else {
    alertIcon.textContent = '⚠️';
    alertTitle.textContent = 'MENSAJE SOSPECHOSO DETECTADO';
    alertSubtitle.textContent = 'Se encontraron algunos indicadores de posible fraude';
  }

  // Gauge animation
  const circumference = 2 * Math.PI * 85; // ~534
  const offset = circumference - (result.score / 100) * circumference;
  
  // Reset gauge
  gaugeFill.style.transition = 'none';
  gaugeFill.setAttribute('stroke-dashoffset', circumference);
  
  // Apply color classes
  gaugeFill.classList.remove('medium', 'low');
  gaugeNumber.classList.remove('medium', 'low');
  
  if (result.level === 'MEDIO') {
    gaugeFill.classList.add('medium');
    gaugeNumber.classList.add('medium');
  }

  // Force reflow then animate
  void gaugeFill.offsetWidth;
  gaugeFill.style.transition = 'stroke-dashoffset 2s ease';
  
  setTimeout(() => {
    gaugeFill.setAttribute('stroke-dashoffset', offset);
  }, 100);

  // Animate number
  animateNumber(gaugeNumber, 0, result.score, 2000);

  // Level badge
  levelBadge.textContent = result.level;
  levelBadge.className = 'level-badge';
  if (result.level === 'ALTO') levelBadge.classList.add('level-high');
  else if (result.level === 'MEDIO') levelBadge.classList.add('level-medium');
  else levelBadge.classList.add('level-low');

  // Scam type
  typeText.textContent = result.scamType;

  // Indicators
  renderIndicators(result.indicators);

  // Timeline
  renderTimeline(result.timeline);

  // Explanation
  renderExplanation(result.explanations);

  // Original text with highlights
  renderOriginalText(result.originalText, result.flaggedWords);
  
  // OSINT
  renderOSINT(result);
}

/* ─── RENDER SAFE RESULT ─── */
function showSafeResult(result) {
  safeSection.classList.remove('hidden');
  
  const safeScoreNum = document.getElementById('safe-score-number');
  const safeSubtitle = document.getElementById('safe-subtitle');
  
  animateNumber(safeScoreNum, 0, result.score, 1500);
  safeSubtitle.textContent = result.score < 15 
    ? 'No se detectaron patrones significativos de estafa'
    : 'Se detectaron indicadores menores, pero no parece ser una estafa clara';
}

/* ═══════════════════════════════════════════════════════════════
   RENDER HELPERS
   ═══════════════════════════════════════════════════════════════ */
function renderIndicators(indicators) {
  indicatorsGrid.innerHTML = '';
  indicators.forEach((ind, i) => {
    const card = document.createElement('div');
    card.className = 'indicator-card';
    card.style.animationDelay = `${i * 0.1}s`;
    card.innerHTML = `
      <div class="indicator-icon">${ind.icon}</div>
      <div class="indicator-content">
        <h4>${ind.title}</h4>
        <p>${ind.description}</p>
      </div>
    `;
    indicatorsGrid.appendChild(card);
  });
}

function renderTimeline(items) {
  timeline.innerHTML = '';
  items.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = 'timeline-item';
    el.style.animationDelay = `${i * 0.15}s`;
    el.innerHTML = `
      <div class="timeline-dot ${item.color}"></div>
      <div class="timeline-day">${item.day}</div>
      <div class="timeline-content">
        <h4>${item.title}</h4>
        <p>${item.description}</p>
      </div>
    `;
    timeline.appendChild(el);
  });
}

function renderExplanation(explanations) {
  explanationCards.innerHTML = '';
  explanations.forEach((exp, i) => {
    const card = document.createElement('div');
    card.className = 'explanation-card';
    card.style.animationDelay = `${i * 0.1}s`;
    card.innerHTML = `
      <span class="card-icon">${exp.icon}</span>
      <div>
        <h4>${exp.title}</h4>
        <p>${exp.description}</p>
      </div>
    `;
    explanationCards.appendChild(card);
  });
}

function renderOriginalText(text, flaggedWords) {
  let html = escapeHtml(text);
  
  // Highlight flagged words
  flaggedWords.forEach(word => {
    const regex = new RegExp(`(${escapeRegex(word)})`, 'gi');
    html = html.replace(regex, '<span class="highlight-word">$1</span>');
  });
  
  originalTextBox.innerHTML = html;
}

function renderOSINT(result) {
  const osintSection = document.getElementById('osint-section');
  const chipsContainer = document.getElementById('osint-chips');
  const locationLabel = document.getElementById('osint-location-label');
  const mapWrapper = document.getElementById('map-frame-wrapper');
  
  // Validate if we have any identifiers or location
  const hasIdentifiers = result.extractedIdentifiers && result.extractedIdentifiers.length > 0;
  const hasLocation = result.osint_location && result.osint_location.trim().length > 0;
  
  if (!hasIdentifiers && !hasLocation) {
    osintSection.classList.add('hidden');
    return;
  }
  
  osintSection.classList.remove('hidden');
  
  // Render Chips
  chipsContainer.innerHTML = '';
  if (hasIdentifiers) {
    result.extractedIdentifiers.forEach(id => {
      const isPhone = /^[+\d\s-]{7,20}$/.test(id);
      const isLink = id.includes('http') || id.includes('.com');
      let icon = '🏷️';
      if (isPhone) icon = '📱';
      if (isLink) icon = '🔗';
      
      const chip = document.createElement('div');
      chip.className = 'osint-chip';
      chip.innerHTML = `<span class="chip-label">${icon}</span> <span>${escapeHtml(id)}</span>`;
      chipsContainer.appendChild(chip);
    });
  } else {
    chipsContainer.innerHTML = '<span style="color:var(--text-secondary);font-size:0.9rem;">No se detectaron identificadores claros.</span>';
  }
  
  // Render Map
  if (hasLocation) {
    locationLabel.innerHTML = `Origen detectado: <strong>${escapeHtml(result.osint_location)}</strong>`;
    // Embed Google Maps using the location string query
    const encodedLocation = encodeURIComponent(result.osint_location);
    mapWrapper.innerHTML = `<iframe src="https://maps.google.com/maps?q=${encodedLocation}&t=&z=4&ie=UTF8&iwloc=&output=embed" title="OSINT Map" loading="lazy"></iframe>`;
  } else {
    locationLabel.innerHTML = `Origen detectado: <strong>Desconocido</strong>`;
    // Default vague map (world view)
    mapWrapper.innerHTML = `<iframe src="https://maps.google.com/maps?q=world&t=&z=2&ie=UTF8&iwloc=&output=embed" title="OSINT Map" loading="lazy" style="filter: grayscale(1) opacity(0.3);"></iframe>`;
  }
}

/* ═══════════════════════════════════════════════════════════════
   SHARE FUNCTIONALITY
   ═══════════════════════════════════════════════════════════════ */
function shareWhatsApp() {
  if (!currentResult) return;
  
  const text = `🚨 *ALERTA DE ESTAFA* 🚨\n\n` +
    `Analicé un mensaje sospechoso con Robert: Detector de Estafas\n\n` +
    `📊 *Riesgo: ${currentResult.score}%* (${currentResult.level})\n` +
    `🎣 *Tipo: ${currentResult.scamType}*\n\n` +
    `💀 Si caes en esto...\n` +
    currentResult.timeline.map(t => `• ${t.day}: ${t.title}`).join('\n') +
    `\n\n🛡️ Analiza tus mensajes en:` +
    `\n${window.location.href}` +
    `\n\n#NoTeDejesEstafar #Robert`;
  
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

async function handleCreateImage() {
  if (!currentResult) return;
  
  showToast('🖼️ Generando imagen…');
  
  try {
    const dataUrl = await generateShareImage(currentResult);
    showImageModal(dataUrl);
  } catch (err) {
    console.error(err);
    showToast('❌ Error al generar la imagen');
  }
}

async function handleDownload() {
  if (!currentResult) return;
  
  showToast('📥 Preparando descarga…');
  
  try {
    const dataUrl = await generateShareImage(currentResult);
    
    const link = document.createElement('a');
    link.download = `robert-estafa-${currentResult.score}pct.png`;
    link.href = dataUrl;
    link.click();
    
    showToast('✅ Imagen descargada');
  } catch (err) {
    console.error(err);
    showToast('❌ Error al descargar');
  }
}

async function handleTikTok() {
  if (!currentResult) return;

  // ── Crear modal de progreso ──
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content" id="video-modal-content">
      <h3>🎥 Generando video…</h3>
      <div class="video-progress">
        <p>Creando animaciones…</p>
        <div class="progress-bar-container">
          <div class="progress-bar" id="video-progress-bar" style="width:0%"></div>
        </div>
        <p class="loading-percent" id="video-progress-pct">0%</p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const modalContent = overlay.querySelector('#video-modal-content');

  try {
    const blob = await generateTikTokVideo(
      currentResult,
      (progress) => {
        const progEl = overlay.querySelector('#video-progress-bar');
        const percEl = overlay.querySelector('#video-progress-pct');
        if (progEl) progEl.style.width = `${Math.round(progress)}%`;
        if (percEl) percEl.textContent  = `${Math.round(progress)}%`;
      },
      selectedImages
    );

    // ── Video listo — reemplazar contenido del modal ──
    const url = URL.createObjectURL(blob);
    modalContent.innerHTML = `
      <h3>🎥 ¡Video listo!</h3>
      <video src="${url}" controls autoplay
        style="width:100%;max-height:60vh;border-radius:12px;margin-bottom:16px;">
      </video>
      <div class="modal-actions">
        <button class="modal-btn-primary" id="btn-download-video">📥 Descargar Video</button>
        <button class="modal-btn-secondary" id="btn-close-video">Cerrar</button>
      </div>
    `;
    modalContent.querySelector('#btn-download-video').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href     = url;
      a.download = 'robert-estafa.webm';
      a.click();
    });
    modalContent.querySelector('#btn-close-video').addEventListener('click', () => {
      overlay.remove();
      URL.revokeObjectURL(url);
    });

  } catch (err) {
    console.error('Video error:', err);
    overlay.remove();
    showToast('❌ Error: ' + err.message);
  }
}


/* ═══════════════════════════════════════════════════════════════
   MODALS
   ═══════════════════════════════════════════════════════════════ */
function showImageModal(dataUrl) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content">
      <h3>🖼️ Imagen lista para compartir</h3>
      <img src="${dataUrl}" alt="Resultado Robert" class="modal-image" />
      <div class="modal-actions">
        <button class="modal-btn-primary" id="modal-download-img">📥 Descargar</button>
        <button class="modal-btn-secondary" id="modal-close">Cerrar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  overlay.querySelector('#modal-download-img').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `robert-estafa-${currentResult.score}pct.png`;
    link.href = dataUrl;
    link.click();
  });
  
  overlay.querySelector('#modal-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

function showVideoModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content">
      <h3>🎥 Generando video TikTok…</h3>
      <div class="video-progress">
        <p>Creando animaciones…</p>
        <div class="progress-bar-container">
          <div class="progress-bar" id="video-progress-bar" style="width:0%"></div>
        </div>
        <p class="loading-percent" id="video-progress-pct">0%</p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

/* ═══════════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════════ */
function resetToHome() {
  resultSection.classList.add('hidden');
  safeSection.classList.add('hidden');
  loadingSection.classList.add('hidden');
  heroSection.classList.remove('hidden');
  
  messageInput.value = '';
  charCount.textContent = '0 / 5,000';
  currentResult = null;
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function animateNumber(element, from, to, duration) {
  const start = performance.now();
  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(from + (to - from) * eased);
    element.textContent = current;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}


function showToast(message) {
  // Remove existing toast
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
