/* ═══════════════════════════════════════════════════════════════
   ROBERT: DETECTOR DE ESTAFAS — MAIN JS
   Motor de análisis + UI + Compartir
   ═══════════════════════════════════════════════════════════════ */

import { analyzeData } from './analyzer.js';
import { initParticles } from './particles.js';
import { PHONE_PREFIXES } from './prefixes.js';

/* ─── DOM ELEMENTS ─── */
const heroSection       = document.getElementById('hero-section');
const loadingSection    = document.getElementById('loading-section');
const resultSection     = document.getElementById('result-section');
const safeSection       = document.getElementById('safe-section');

// Secciones de contenido estático (se ocultan durante análisis)
const howItWorksSection = document.getElementById('how-it-works-section');
const examplesSection   = document.getElementById('examples-section');
const faqSection        = document.getElementById('faq-section');

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


// New analysis buttons
const btnNewAnalysis     = document.getElementById('btn-new-analysis');
const btnNewAnalysisSafe = document.getElementById('btn-new-analysis-safe');

// Tabs
const inputTabs          = document.querySelectorAll('.input-tab');

/* ─── STATE ─── */
let currentResult = null;
let selectedImages = [];
let tesseractWorker = null; // Worker persistente para mayor velocidad

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
  initRealTimeData();
  bindEvents();
});

async function initRealTimeData() {
  // Initial fetch
  fetchStats();
  fetchRecentScams();
  
  // Pre-load Tesseract worker in background
  initTesseract();

  // Set up polling (every 30 seconds for stats/feed)
  setInterval(() => {
    fetchStats();
    fetchRecentScams();
  }, 30000); 
}

async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    if (data.totalAnalyses !== undefined) {
      document.getElementById('stat-total-analyses').textContent = data.totalAnalyses.toLocaleString();
      document.getElementById('stat-scams-detected').textContent = data.scamsDetected.toLocaleString();
    }
  } catch (e) { console.error('Error fetching stats:', e); }
}

async function fetchRecentScams() {
  try {
    const res = await fetch('/api/recent');
    const scams = await res.json();
    renderRecentScams(scams);
  } catch (e) { console.error('Error fetching recent scams:', e); }
}

function renderRecentScams(scams) {
  const container = document.getElementById('recent-scams-feed');
  if (!container) return;
  
  if (!scams || scams.length === 0) {
    container.innerHTML = '<div class="feed-placeholder">Esperando reportes de la comunidad...</div>';
    return;
  }
  
  container.innerHTML = '';
  scams.forEach(scam => {
    const div = document.createElement('div');
    div.className = 'feed-item';
    const date = new Date(scam.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    div.innerHTML = `
      <div class="feed-item-info">
        <span class="feed-item-type">${scam.type}</span>
        <span class="feed-item-loc">📍 Origen: ${scam.location}</span>
      </div>
      <span class="feed-item-time">${date}</span>
    `;
    container.appendChild(div);
  });
}

async function initTesseract() {
  try {
    if (!tesseractWorker) {
      tesseractWorker = await Tesseract.createWorker('spa');
    }
  } catch (e) { console.error('Tesseract init error:', e); }
}

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
    charCount.textContent = `${len.toLocaleString()} / 3,000`;
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
    if (howItWorksSection) howItWorksSection.classList.remove('hidden');
    if (examplesSection) examplesSection.classList.remove('hidden');
    if (faqSection) faqSection.classList.remove('hidden');
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

  btnShareWhatsapp.addEventListener('click', shareWhatsApp);
  document.getElementById('btn-share-telegram')?.addEventListener('click', shareTelegram);
  document.getElementById('btn-share-twitter')?.addEventListener('click', shareTwitter);

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
  // Max 5 images (Groq limit)
  if (selectedImages.length + validFiles.length > 5) {
    showToast('⚠️ Solo puedes subir hasta 5 capturas máximo');
  }
  const toAdd = validFiles.slice(0, 5 - selectedImages.length);
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
// Los prefijos se importan ahora desde ./prefixes.js para mantener este archivo limpio.

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

  // Show loading — hide content sections and scroll to top
  heroSection.classList.add('hidden');
  if (howItWorksSection) howItWorksSection.classList.add('hidden');
  if (examplesSection) examplesSection.classList.add('hidden');
  if (faqSection) faqSection.classList.add('hidden');
  loadingSection.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  // Reset progress bar and loading steps
  progressBar.style.width = '0%';
  loadingPercent.textContent = '0%';
  document.querySelectorAll('.loading-step').forEach(s => s.classList.remove('active', 'done'));

  const loadingTitle = document.querySelector('.loading-title');
  if (loadingTitle) loadingTitle.textContent = 'Analizando metadatos EXIF y prefijos telefónicos…';

  // Update step texts for OSINT
  const stepTexts = [
    'Validando identificadores…',
    'Escaneando metadatos EXIF…',
    'Rastreando origen geográfico…',
    'Generando reporte oficial…'
  ];
  const stepElements = document.querySelectorAll('.loading-step .step-text');
  stepTexts.forEach((txt, idx) => {
    if (stepElements[idx]) stepElements[idx].textContent = txt;
  });

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

  // Run animation
  await runLoadingAnimation();

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

  // Silently add to blacklist using dedicated endpoint
  fetch('/api/report-victim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      phone: phone, 
      handle: handle,
      location: osint ? osint.country : "Desconocido"
    })
  }).then(() => {
    showToast('✅ Reporte enviado a la central de Robert', 'success');
    fetchStats();
    fetchRecentScams();
  }).catch(err => console.warn('Error en reporte silencioso:', err));
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

/**
 * Comprime una imagen usando canvas para mantenerse bajo el límite de 4MB de Groq.
 */
function compressImage(file, maxWidth = 1200, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width *= maxWidth / height;
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convertimos a JPEG con calidad controlada
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

// Para usar la funcion global de remove
window.removeImage = removeImage;

/* ═══════════════════════════════════════════════════════════════
   ANALISIS DE IMÁGENES: OCR LOCAL TESSERACT.JS
   ═══════════════════════════════════════════════════════════════ */
async function extractTextFromImages(files) {
  let combinedText = '';
  showToast('👁️ Analizando capturas con Visión Artificial...');
  
  try {
    // Asegurar que el worker esté listo
    if (!tesseractWorker) await initTesseract();
    
    for (const file of files) {
      const url = URL.createObjectURL(file);
      try {
        const result = await tesseractWorker.recognize(url);
        combinedText += result.data.text + '\n';
      } catch (err) {
        console.error('Error procesando imagen individual:', err);
        // Si falla una imagen, intentamos seguir con las demás
      }
      URL.revokeObjectURL(url);
      showToast(`👁️ Analizado: ${file.name.substring(0, 15)}...`, 'info');
    }
  } catch (e) {
    console.error('Error fatal al extraer texto:', e);
    // Si el worker muere, lo matamos del todo para que se recree en el próximo intento
    if (tesseractWorker) {
      await tesseractWorker.terminate();
      tesseractWorker = null;
    }
    throw new Error('Error en el motor de visión. Intenta de nuevo.');
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
    const text = messageInput.value.replace(/\s+/g, ' ').trim();
    if (!text) {
      showToast('⚠️ Pega un link o mensaje para analizar');
      messageInput.focus();
      return;
    }
    payload = { message: text.substring(0, 3000) };
  } else {
    if (selectedImages.length === 0) {
      showToast('📸 Sube al menos 1 captura de pantalla');
      return;
    }
  }

  // Show loading IMMEDIATELY, before OCR handles heavy processing
  heroSection.classList.add('hidden');
  if (howItWorksSection) howItWorksSection.classList.add('hidden');
  if (examplesSection) examplesSection.classList.add('hidden');
  if (faqSection) faqSection.classList.add('hidden');
  loadingSection.classList.remove('hidden');
  resultSection.classList.add('hidden');
  safeSection.classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Reset progress bar and loading steps
  progressBar.style.width = '0%';
  loadingPercent.textContent = '0%';
  document.querySelectorAll('.loading-step').forEach(s => s.classList.remove('active', 'done'));

  // Reset loading title and steps for standard analysis
  const loadingTitle = document.querySelector('.loading-title');
  if (loadingTitle) {
    loadingTitle.textContent = activeTab === 'link' ? 'Analizando texto o enlace…' : 'Analizando capturas de pantalla…';
  }
  
  const stepTexts = activeTab === 'link' ? [
    'Escaneando patrones de estafa…',
    'Verificando base de datos de fraudes…',
    'Analizando manipulación emocional…',
    'Generando simulación predictiva…'
  ] : [
    'Procesando capturas con Visión Artificial…',
    'Comparando con la base de datos global…',
    'Analizando manipulación visual…',
    'Generando dictamen predictivo…'
  ];
  const stepElements = document.querySelectorAll('.loading-step .step-text');
  stepTexts.forEach((txt, idx) => {
    if (stepElements[idx]) stepElements[idx].textContent = txt;
  });

  try {
    if (activeTab !== 'link') {
      // 1. Convertir y COMPRIMIR imágenes para el análisis visual (Groq limit: 4MB total)
      showToast('📸 Procesando y comprimiendo capturas...', 'info');
      const compressedImages = await Promise.all(selectedImages.map(file => compressImage(file)));
      payload.images = compressedImages;

      // 2. Extraer texto con OCR local como apoyo (opcional, pero útil para highlights)
      try {
        const extractedText = await extractTextFromImages(selectedImages);
        payload.message = extractedText;
      } catch (ocrErr) {
        console.warn('OCR local falló, continuando solo con visión:', ocrErr);
        payload.message = ""; // El backend usará solo las imágenes
      }
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

    // Update stats after analysis
    fetchStats();
    fetchRecentScams();

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
  
  // Ensure steps are clean
  steps.forEach(s => s.classList.remove('active', 'done'));
  
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
  
  // No longer resetting progress bar here to avoid the jump back to 0%
  // It will be reset at the start of the next analysis.
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
  
  // Highlight if it's a known scammer from blacklist (if backend provided reasoning hint)
  if (result.reasoning && result.reasoning.includes('LISTA NEGRA')) {
    osintSection.querySelector('.osint-warning').innerHTML = `
      <span class="warning-icon">🔥</span>
      <strong style="color:#ff1a1a;">ESTAFADOR CONFIRMADO:</strong> Este identificador ya está registrado en nuestra base de datos criminal.
    `;
    osintSection.querySelector('.osint-warning').style.background = 'rgba(255, 0, 0, 0.15)';
  }
  
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

function shareTelegram() {
  if (!currentResult) return;
  
  const text = `🚨 ALERTA DE ESTAFA 🚨\n\n` +
    `Analicé un mensaje sospechoso con Robert: Detector de Estafas\n\n` +
    `📊 Riesgo: ${currentResult.score}% (${currentResult.level})\n` +
    `🎣 Tipo: ${currentResult.scamType}\n\n` +
    `🛡️ Analiza tus mensajes en:` +
    `\n${window.location.href}`;
  
  const url = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

function shareTwitter() {
  if (!currentResult) return;
  
  const text = `🚨 ALERTA DE ESTAFA: Analicé un mensaje con Robert AI y el riesgo es del ${currentResult.score}%.\n\nProtege tus ahorros aquí 👇\n#NoTeDejesEstafar #RobertAI`;
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`;
  window.open(url, '_blank');
}



/* ═══════════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════════ */
function resetToHome() {
  resultSection.classList.add('hidden');
  safeSection.classList.add('hidden');
  loadingSection.classList.add('hidden');
  victimReportSection.classList.add('hidden');
  heroSection.classList.remove('hidden');
  if (howItWorksSection) howItWorksSection.classList.remove('hidden');
  if (examplesSection) examplesSection.classList.remove('hidden');
  if (faqSection) faqSection.classList.remove('hidden');
  
  // Limpiar inputs de texto
  messageInput.value = '';
  charCount.textContent = '0 / 3,000';
  
  // Limpiar imágenes y previsualizaciones
  selectedImages = [];
  if (imagePreviewContainer) imagePreviewContainer.innerHTML = '';
  if (imageUpload) imageUpload.value = '';
  
  // Limpiar sección Victim (OSINT)
  if (victimUploadWrapper) {
    const vPhone = document.getElementById('victim-phone');
    const vHandle = document.getElementById('victim-handle');
    const vPhoto = document.getElementById('victim-photo');
    const vExifText = document.getElementById('exif-upload-text');
    const vExifLabel = document.getElementById('exif-upload-label');
    
    if (vPhone) vPhone.value = '';
    if (vHandle) vHandle.value = '';
    if (vPhoto) vPhoto.value = '';
    if (vExifText) vExifText.textContent = 'Toca para subir la foto del estafador';
    if (vExifLabel) vExifLabel.classList.remove('has-file');
  }

  currentResult = null;
  
  // Limpiar estados de carga
  progressBar.style.width = '0%';
  loadingPercent.textContent = '0%';
  document.querySelectorAll('.loading-step').forEach(s => s.classList.remove('active', 'done'));

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'ℹ️';
  if (type === 'error') icon = '❌';
  if (type === 'success') icon = '✅';
  if (type === 'warning') icon = '⚠️';
  
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  document.body.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
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
