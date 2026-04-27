/* ═══════════════════════════════════════════════════════════════
   ROBERT: DETECTOR DE ESTAFAS — MEDIA GENERATION
   
   Genera:
   - Imagen compartible tipo tarjeta (Canvas 2D)
   - Video estilo TikTok (Canvas + MediaRecorder)
   ═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   GENERAR IMAGEN COMPARTIBLE
   Tarjeta oscura con resultado del análisis (1080x1920)
   ═══════════════════════════════════════════════════════════════ */
export async function generateShareImage(result) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  
  // ── Fondo oscuro con gradiente ──
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 1920);
  bgGrad.addColorStop(0, '#0a0a0f');
  bgGrad.addColorStop(0.5, '#12121a');
  bgGrad.addColorStop(1, '#0a0a0f');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1080, 1920);
  
  // ── Borde neón sutil ──
  ctx.strokeStyle = 'rgba(255, 26, 26, 0.3)';
  ctx.lineWidth = 4;
  roundRect(ctx, 30, 30, 1020, 1860, 30);
  ctx.stroke();
  
  // ── Brillo superior ──
  const topGlow = ctx.createRadialGradient(540, 200, 50, 540, 200, 400);
  topGlow.addColorStop(0, 'rgba(255, 26, 26, 0.15)');
  topGlow.addColorStop(1, 'rgba(255, 26, 26, 0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, 1080, 600);
  
  let y = 140;
  
  const logoImg = await loadLogo().catch(() => null);
  
  // ── Logo ──
  if (logoImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(540, y - 20, 45, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logoImg, 540 - 45, y - 65, 90, 90);
    ctx.restore();
  }
  y += 50;
  
  // ── "ROBERT" ──
  ctx.font = '900 64px Inter, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('ROBERT', 540, y);
  y += 40;
  
  // ── Subtítulo ──
  ctx.font = '600 22px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.letterSpacing = '4px';
  ctx.fillText('D E T E C T O R   D E   E S T A F A S', 540, y);
  y += 80;
  
  // ── Línea separadora ──
  const lineGrad = ctx.createLinearGradient(200, y, 880, y);
  lineGrad.addColorStop(0, 'rgba(255, 26, 26, 0)');
  lineGrad.addColorStop(0.5, 'rgba(255, 26, 26, 0.5)');
  lineGrad.addColorStop(1, 'rgba(255, 26, 26, 0)');
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(200, y);
  ctx.lineTo(880, y);
  ctx.stroke();
  y += 60;
  
  // ── ALERTA ──
  if (result.score >= 40) {
    ctx.font = '48px serif';
    ctx.fillText('🚨', 540, y);
    y += 50;
    
    ctx.font = '900 38px Inter, sans-serif';
    ctx.fillStyle = '#ff1a1a';
    ctx.fillText('¡ESTAFA DETECTADA!', 540, y);
    y += 50;
  } else {
    ctx.font = '48px serif';
    ctx.fillText('✅', 540, y);
    y += 50;
    
    ctx.font = '900 38px Inter, sans-serif';
    ctx.fillStyle = '#00ff88';
    ctx.fillText('MENSAJE SEGURO', 540, y);
    y += 50;
  }
  
  // ── SCORE CIRCLE ──
  y += 30;
  const centerX = 540;
  const centerY = y + 120;
  const radius = 110;
  
  // Background circle
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 12;
  ctx.stroke();
  
  // Score arc
  const scoreAngle = (result.score / 100) * Math.PI * 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + scoreAngle);
  
  const scoreColor = result.score >= 70 ? '#ff1a1a' : result.score >= 40 ? '#ffcc00' : '#00ff88';
  ctx.strokeStyle = scoreColor;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.stroke();
  
  // Score number
  ctx.font = '900 80px "JetBrains Mono", monospace';
  ctx.fillStyle = scoreColor;
  ctx.fillText(`${result.score}`, centerX, centerY + 15);
  
  ctx.font = '700 28px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText('% RIESGO', centerX, centerY + 55);
  
  y = centerY + radius + 60;
  
  // ── Nivel badge ──
  const levelText = result.level;
  const badgeWidth = 220;
  const badgeHeight = 50;
  const badgeX = centerX - badgeWidth / 2;
  
  ctx.fillStyle = result.score >= 70 ? 'rgba(255, 26, 26, 0.2)' : 
                  result.score >= 40 ? 'rgba(255, 204, 0, 0.2)' : 'rgba(0, 255, 136, 0.2)';
  roundRect(ctx, badgeX, y - 35, badgeWidth, badgeHeight, 25);
  ctx.fill();
  
  ctx.strokeStyle = result.score >= 70 ? 'rgba(255, 26, 26, 0.4)' : 
                    result.score >= 40 ? 'rgba(255, 204, 0, 0.4)' : 'rgba(0, 255, 136, 0.4)';
  ctx.lineWidth = 2;
  roundRect(ctx, badgeX, y - 35, badgeWidth, badgeHeight, 25);
  ctx.stroke();
  
  ctx.font = '800 22px Inter, sans-serif';
  ctx.fillStyle = scoreColor;
  ctx.fillText(`NIVEL: ${levelText}`, centerX, y);
  y += 50;
  
  // ── Tipo de estafa ──
  ctx.font = '600 26px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText(result.scamType, centerX, y);
  y += 80;
  
  // ── Frase impactante ──
  const phrases = [
    'Casi caigo en una estafa 💀',
    'Mira lo que me querían hacer 🚨',
    'No caigas en esto 🛡️',
    'Que no te engañen 💀',
    'Esto es una ESTAFA 🚫',
  ];
  const phrase = result.score >= 40 
    ? phrases[Math.floor(Math.random() * phrases.length)]
    : '¡Mi mensaje es seguro! ✅';
  
  ctx.font = '800 36px Inter, sans-serif';
  ctx.fillStyle = '#ffffff';
  wrapText(ctx, `"${phrase}"`, centerX, y, 900, 44);
  y += 80;
  
  // ── Timeline preview (solo 2 items) ──
  if (result.score >= 40 && result.timeline) {
    ctx.font = '700 24px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('💀 Esto pasará si continúas…', centerX, y);
    y += 45;
    
    const previewItems = result.timeline.slice(0, 3);
    ctx.textAlign = 'left';
    
    for (const item of previewItems) {
      const dotColor = item.color === 'green' ? '#00ff88' : 
                       item.color === 'yellow' ? '#ffcc00' : 
                       item.color === 'red' ? '#ff1a1a' : '#660000';
      
      // Dot
      ctx.beginPath();
      ctx.arc(120, y - 6, 6, 0, Math.PI * 2);
      ctx.fillStyle = dotColor;
      ctx.fill();
      
      // Day
      ctx.font = '600 18px Inter, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillText(item.day, 145, y);
      
      // Title
      ctx.font = '700 22px Inter, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(item.title, 145, y + 28);
      
      y += 70;
    }
    
    ctx.textAlign = 'center';
  }
  
  // ── Footer ──
  y = 1780;
  
  // Line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(200, y);
  ctx.lineTo(880, y);
  ctx.stroke();
  y += 40;
  
  ctx.font = '600 20px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillText('Analizado con Robert: Detector de Estafas', centerX, y);
  y += 30;
  
  ctx.font = '500 18px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillText('#NoTeDejesEstafar', centerX, y);
  
  return canvas.toDataURL('image/png', 0.95);
}

/* ═══════════════════════════════════════════════════════════════
   UTILIDADES COMPARTIDAS
   ═══════════════════════════════════════════════════════════════ */

function getSupportedMimeType() {
  for (const t of ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4']) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return 'video/webm';
}

function loadLogo() {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = '/logo.png';
  });
}

function clearCanvas(ctx, canvas) {
  ctx.fillStyle = '#05050f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeInOutQuad(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, y);
      line = word + ' ';
      y += lineHeight;
    } else { line = test; }
  }
  ctx.fillText(line.trim(), x, y);
}

// Fondo animado cinematic — grid + vignette (llamar primero en cada escena)
function drawBackground(ctx, canvas, time = 0, accentAlpha = 0.06) {
  const W = canvas.width, H = canvas.height;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0,   '#05050f');
  bg.addColorStop(0.5, '#0a0a1a');
  bg.addColorStop(1,   '#05050f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.strokeStyle = `rgba(255,26,26,${accentAlpha})`;
  ctx.lineWidth = 0.5;
  const GRID = 60;
  const offsetX = (time * 20) % GRID;
  const offsetY = (time * 10) % GRID;
  for (let x = -GRID + offsetX; x < W + GRID; x += GRID) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = -GRID + offsetY; y < H + GRID; y += GRID) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.restore();

  const glow = ctx.createRadialGradient(W/2, H*0.35, 0, W/2, H*0.35, 500);
  glow.addColorStop(0, 'rgba(255,26,26,0.08)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const vig = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.85);
  vig.addColorStop(0, 'transparent');
  vig.addColorStop(1, 'rgba(0,0,0,0.7)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

function drawFade(ctx, canvas, t, fadeIn = true) {
  if (fadeIn && t < 0.15) {
    ctx.fillStyle = `rgba(5,5,15,${1 - t / 0.15})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (!fadeIn && t > 0.85) {
    ctx.fillStyle = `rgba(5,5,15,${(t - 0.85) / 0.15})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawCard(ctx, x, y, w, h, r = 16, borderColor = 'rgba(255,26,26,0.35)') {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function shadowText(ctx, text, x, y, color = '#ff1a1a', blur = 18) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur  = blur;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════
   GENERAR VIDEO — VERSIÓN EXTENDIDA (sin audio para máx. compatibilidad)
   ═══════════════════════════════════════════════════════════════ */
export async function generateTikTokVideo(result, onProgress, screenshotFiles = []) {
  const canvas = document.createElement('canvas');
  canvas.width  = 720;
  canvas.height = 1280;
  const ctx = canvas.getContext('2d');

  const logoImg = await loadLogo().catch(() => null);

  // ── Pre-load screenshots as ImageBitmap ──
  const screenshots = [];
  for (const file of screenshotFiles.slice(0, 4)) {
    try {
      const bmp = await createImageBitmap(file);
      screenshots.push(bmp);
    } catch (e) { /* skip */ }
  }

  // ── IMPORTANT: Pre-draw first frame before capturing stream!
  // This prevents MediaRecorder from throwing an error about empty/uninitialized streams.
  clearCanvas(ctx, canvas);
  ctx.fillStyle = '#05050f'; 
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  if (!window.MediaRecorder) throw new Error('El navegador no soporta grabador de video.');

  const stream = (canvas.captureStream) ? canvas.captureStream(30) : (canvas.mozCaptureStream ? canvas.mozCaptureStream(30) : null);
  if (!stream) throw new Error('No se puede capturar el video en este navegador.');

  const recorder = new MediaRecorder(stream, {
    mimeType: getSupportedMimeType(),
    videoBitsPerSecond: 4000000
  });

  const chunks = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
      resolve(blob);
    };
    recorder.onerror = (e) => reject(e.error || new Error('MediaRecorder error'));
    
    try {
      recorder.start(100);
    } catch (e) {
      return reject(new Error('Error al iniciar grabación: ' + e.message));
    }

    const sceneList = [
      { duration: 3000, render: (t) => renderScene1(ctx, t, canvas, logoImg) },
      { duration: 6000, render: (t) => renderSceneWhatIsRobert(ctx, t, canvas) },
      { duration: 3500, render: (t) => renderScene2(ctx, t, canvas, result) },
      ...(screenshots.length > 0
        ? [{ duration: 4500, render: (t) => renderSceneScreenshots(ctx, t, canvas, screenshots) }]
        : []),
      { duration: 4500, render: (t) => renderScene3(ctx, t, canvas, result) },
      { duration: 6500, render: (t) => renderScene4(ctx, t, canvas, result) },
      { duration: 7000, render: (t) => renderSceneHowDetected(ctx, t, canvas, result) },
      { duration: 4500, render: (t) => renderScene5(ctx, t, canvas, result, logoImg) },
      { duration: 3500, render: (t) => renderScene6(ctx, t, canvas, logoImg) },
    ];

    const totalDuration = sceneList.reduce((s, sc) => s + sc.duration, 0);
    let elapsed   = 0;
    let lastFrame = null;
    let stopped   = false;

    function renderFrame(now) {
      if (stopped) return;

      // Prevenir el salto de lag inicial: el tiempo empieza exactamente en el primer render
      if (!lastFrame) {
        lastFrame = now;
        requestAnimationFrame(renderFrame);
        return;
      }

      // Limitar salto temporal por si hay una pausa larga de CPU
      const dt = Math.min(now - lastFrame, 100); 
      elapsed += dt;
      lastFrame = now;

      // ── Detener al terminar todas las escenas ──
      if (elapsed >= totalDuration) {
        stopped = true;
        // Renderizar último frame de la última escena
        sceneList[sceneList.length - 1].render(1);
        onProgress(100);
        recorder.requestData();
        setTimeout(() => recorder.stop(), 250);
        return;
      }

      // ── Encontrar escena activa ──
      let accum    = 0;
      let sceneIdx = 0;
      let sceneStart = 0;
      for (let i = 0; i < sceneList.length; i++) {
        if (elapsed < accum + sceneList[i].duration) {
          sceneIdx   = i;
          sceneStart = accum;
          break;
        }
        accum += sceneList[i].duration;
      }

      const t = (elapsed - sceneStart) / sceneList[sceneIdx].duration;
      sceneList[sceneIdx].render(Math.min(t, 1));
      onProgress((elapsed / totalDuration) * 99); // 99 hasta que pare de verdad

      requestAnimationFrame(renderFrame);
    }

    requestAnimationFrame(renderFrame);
  });
}

/* ═══════════════════════════════════════════════════════════════
   ESCENAS DE VIDEO — DISEÑO PROFESIONAL
   ═══════════════════════════════════════════════════════════════ */

// ESCENA 1 — Intro cinematica
function renderScene1(ctx, t, canvas, logoImg) {
  const W = canvas.width, H = canvas.height, cx = W/2;
  drawBackground(ctx, canvas, t * 0.5, 0.04 + t * 0.06);

  const fadeIn = easeOutCubic(Math.min(t * 2.5, 1));
  ctx.save();
  ctx.globalAlpha = fadeIn;

  // Línea horizontal animada
  const lineW = easeOutCubic(Math.min(t * 3, 1)) * 280;
  ctx.strokeStyle = '#ff1a1a';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - lineW, H*0.38); ctx.lineTo(cx + lineW, H*0.38); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - lineW*0.6, H*0.62); ctx.lineTo(cx + lineW*0.6, H*0.62); ctx.stroke();

  // Logo
  if (logoImg) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, H*0.42, 54, 0, Math.PI*2); ctx.clip();
    ctx.drawImage(logoImg, cx-54, H*0.42-54, 108, 108);
    ctx.restore();
    // Glow ring
    ctx.save();
    ctx.strokeStyle = `rgba(255,26,26,${0.5 * fadeIn})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, H*0.42, 62, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }

  // ROBERT
  ctx.textAlign = 'center';
  ctx.font = '900 72px Inter, sans-serif';
  ctx.fillStyle = '#ffffff';
  shadowText(ctx, 'ROBERT', cx, H*0.52, '#ff1a1a', 28);
  ctx.fillText('ROBERT', cx, H*0.52);

  // Subtítulo con espaciado
  ctx.font = '500 20px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.letterSpacing = '6px';
  ctx.fillText('D E T E C T O R   D E   E S T A F A S', cx, H*0.565);
  ctx.letterSpacing = '0px';

  ctx.restore();
  drawFade(ctx, canvas, t, true);
  drawFade(ctx, canvas, t, false);
}

// ESCENA 2 — ¿Qué es Robert?
function renderSceneWhatIsRobert(ctx, t, canvas) {
  const W = canvas.width, H = canvas.height, cx = W/2;
  drawBackground(ctx, canvas, t * 0.3, 0.05);

  ctx.textAlign = 'center';
  const headerAlpha = easeOutCubic(Math.min(t * 4, 1));
  ctx.globalAlpha = headerAlpha;

  ctx.font = '700 16px Inter, sans-serif';
  ctx.fillStyle = '#ff1a1a';
  ctx.letterSpacing = '4px';
  ctx.fillText('¿ Q U É   E S ?', cx, 200);
  ctx.letterSpacing = '0px';

  ctx.font = '900 52px Inter, sans-serif';
  ctx.fillStyle = '#ffffff';
  shadowText(ctx, 'ROBERT IA', cx, 265, '#ff1a1a', 20);
  ctx.fillText('ROBERT IA', cx, 265);

  // Línea
  const lw = easeOutCubic(Math.min(t * 3, 1)) * 220;
  ctx.strokeStyle = 'rgba(255,26,26,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx - lw, 285); ctx.lineTo(cx + lw, 285); ctx.stroke();

  ctx.globalAlpha = 1;

  // Bullets que aparecen progresivamente
  const bullets = [
    { icon: '🤖', title: 'Inteligencia Artificial', sub: 'Detecta fraudes con análisis contextual' },
    { icon: '🔍', title: '+50 Indicadores de Riesgo', sub: 'Psicología, urgencia, gramática y más' },
    { icon: '📊', title: 'Porcentaje de Riesgo Real', sub: 'Basado en miles de casos analizados' },
    { icon: '🛡️', title: 'Lista Negra Colectiva', sub: 'La comunidad reporta → todos se protegen' },
  ];

  bullets.forEach((b, i) => {
    const delay = 0.2 + i * 0.18;
    const bt = Math.max(0, Math.min((t - delay) * 3, 1));
    if (bt <= 0) return;
    const y = 340 + i * 200;
    ctx.globalAlpha = easeOutCubic(bt);
    const slideX = (1 - easeOutCubic(bt)) * 60;

    drawCard(ctx, 50 + slideX, y, 620, 155, 16);

    ctx.textAlign = 'left';
    ctx.font = '36px serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(b.icon, 88 + slideX, y + 60);

    ctx.font = '700 26px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(b.title, 148 + slideX, y + 58);

    ctx.font = '400 18px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(b.sub, 148 + slideX, y + 90);

    ctx.textAlign = 'center';
    ctx.globalAlpha = 1;
  });

  drawFade(ctx, canvas, t, true);
  drawFade(ctx, canvas, t, false);
}

// ESCENA 3 — "Analicé este mensaje"
function renderScene2(ctx, t, canvas, result) {
  const W = canvas.width, H = canvas.height, cx = W/2, cy = H/2;
  drawBackground(ctx, canvas, t * 0.4, 0.06);

  const full = '¿Es esta una estafa?';
  const chars = Math.floor(easeInOutQuad(Math.min(t * 1.8, 1)) * full.length);
  const display = full.substring(0, chars);

  ctx.textAlign = 'center';
  ctx.font = '800 48px Inter, sans-serif';
  ctx.fillStyle = '#ffffff';
  shadowText(ctx, display, cx, cy - 40, '#ff1a1a', 15);
  ctx.fillText(display, cx, cy - 40);

  // Cursor
  if (chars < full.length || Math.sin(t * 18) > 0) {
    const tw = ctx.measureText(display).width;
    ctx.fillStyle = '#ff1a1a';
    ctx.fillRect(cx + tw/2 + 4, cy - 82, 3, 48);
  }

  if (t > 0.55) {
    const a = easeOutCubic((t - 0.55) / 0.45);
    ctx.globalAlpha = a;
    ctx.font = '500 24px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('Robert I.A. analizó el mensaje…', cx, cy + 30);

    // Barra de scanning
    const barW = 500, barH = 4;
    const barX = cx - barW/2;
    const barY = cy + 65;
    roundRect(ctx, barX, barY, barW, barH, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill();
    const progress = Math.min((t - 0.55) / 0.45, 1);
    roundRect(ctx, barX, barY, barW * progress, barH, 2);
    ctx.fillStyle = '#ff1a1a'; ctx.fill();

    ctx.globalAlpha = 1;
  }

  drawFade(ctx, canvas, t, true);
  drawFade(ctx, canvas, t, false);
}

// ESCENA 4 — Screenshots
function renderSceneScreenshots(ctx, t, canvas, screenshots) {
  const W = canvas.width, H = canvas.height, cx = W/2;
  drawBackground(ctx, canvas, t*0.2, 0.04);

  ctx.textAlign = 'center';
  ctx.globalAlpha = easeOutCubic(Math.min(t*4,1));
  ctx.font = '700 16px Inter, sans-serif';
  ctx.fillStyle = '#ff1a1a';
  ctx.letterSpacing = '4px';
  ctx.fillText('E V I D E N C I A', cx, 120);
  ctx.letterSpacing = '0px';
  ctx.font = '800 38px Inter, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Capturas analizadas', cx, 175);
  const lw = easeOutCubic(Math.min(t*3,1))*200;
  ctx.strokeStyle='rgba(255,26,26,0.5)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(cx-lw,195); ctx.lineTo(cx+lw,195); ctx.stroke();
  ctx.globalAlpha = 1;

  const count = Math.min(screenshots.length, 2);
  const imgH  = count === 1 ? 820 : 390;
  const startY = 220;
  for (let i = 0; i < count; i++) {
    const delay = i * 0.25;
    const st = Math.max(0, Math.min((t - delay) * 3, 1));
    const bmp = screenshots[i];
    const aspect = bmp.width / bmp.height;
    const drawW = Math.min(620, imgH * aspect);
    const drawX = cx - drawW/2;
    const drawY = startY + i*(imgH+18);
    const offsetY = (1-easeOutCubic(st))*160;
    ctx.save();
    ctx.globalAlpha = easeOutCubic(st);
    ctx.shadowColor = 'rgba(255,26,26,0.5)';
    ctx.shadowBlur  = 24;
    drawCard(ctx, drawX-4, drawY+offsetY-4, drawW+8, imgH+8, 14, 'rgba(255,26,26,0.4)');
    ctx.shadowBlur = 0;
    ctx.drawImage(bmp, drawX, drawY+offsetY, drawW, imgH);
    ctx.restore();
  }

  drawFade(ctx, canvas, t, true);
  drawFade(ctx, canvas, t, false);
}

// ESCENA 5 — Score reveal
function renderScene3(ctx, t, canvas, result) {
  const W = canvas.width, H = canvas.height, cx = W/2;
  drawBackground(ctx, canvas, t*0.5, 0.05 + t*0.08);

  const score   = result.score || 0;
  const isScam  = score >= 40;
  const scoreColor = score >= 70 ? '#ff2244' : score >= 40 ? '#ffcc00' : '#00ff88';

  // Etiqueta RESULTADO
  ctx.globalAlpha = easeOutCubic(Math.min(t*4,1));
  ctx.textAlign = 'center';
  ctx.font = '600 18px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.letterSpacing = '4px';
  ctx.fillText('R E S U L T A D O', cx, 280);
  ctx.letterSpacing='0px';
  ctx.globalAlpha = 1;

  // Número animado
  const scoreProgress = easeOutCubic(Math.min(t*1.6,1));
  const displayScore  = Math.round(score * scoreProgress);
  ctx.font = '900 170px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = scoreColor;
  ctx.save();
  ctx.shadowColor = scoreColor;
  ctx.shadowBlur  = 40;
  ctx.fillText(`${displayScore}%`, cx, 520);
  ctx.restore();

  // Sublabel riesgo
  ctx.globalAlpha = easeOutCubic(Math.min(t*2,1));
  ctx.font = '600 22px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText('de probabilidad de ser estafa', cx, 565);
  ctx.globalAlpha = 1;

  // Nivel badge
  if (t > 0.35) {
    const ba = easeOutCubic((t-0.35)/0.25);
    ctx.globalAlpha = ba;
    drawCard(ctx, cx-160, 600, 320, 80, 40, scoreColor);
    ctx.font = '800 28px Inter, sans-serif';
    ctx.fillStyle = scoreColor;
    shadowText(ctx, `NIVEL: ${result.level || 'ALTO'}`, cx, 649, scoreColor, 12);
    ctx.fillText(`NIVEL: ${result.level || 'ALTO'}`, cx, 649);
    ctx.globalAlpha = 1;
  }

  // Sello ESTAFA
  if (t > 0.6 && isScam) {
    const st = (t - 0.6) / 0.2;
    const ss = st < 1 ? 1 + (1-easeOutCubic(st))*1.8 : 1;
    ctx.save();
    ctx.globalAlpha = Math.min(st*2, 0.9);
    ctx.translate(cx, 800);
    ctx.rotate(-0.12);
    ctx.scale(ss, ss);
    ctx.font = '900 64px Inter, sans-serif';
    ctx.strokeStyle = '#ff2244'; ctx.lineWidth=4;
    ctx.fillStyle   = 'rgba(255,34,68,0.12)';
    roundRect(ctx, -200, -60, 400, 80, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff2244';
    ctx.fillText('¡ E S T A F A !', 0, 0);
    ctx.restore();
  }

  drawFade(ctx, canvas, t, true);
  drawFade(ctx, canvas, t, false);
}

// ESCENA 6 — "Esto pasará si caes"
function renderScene4(ctx, t, canvas, result) {
  const W = canvas.width, H = canvas.height, cx = W/2;
  drawBackground(ctx, canvas, t*0.3, 0.07);

  const titleA = easeOutCubic(Math.min(t*3,1));
  ctx.globalAlpha = titleA;
  ctx.textAlign = 'center';
  ctx.font = '800 42px Inter, sans-serif';
  ctx.fillStyle = '#ff2244';
  shadowText(ctx, 'Si caes en esta trampa…', cx, 200, '#ff2244', 20);
  ctx.fillText('Si caes en esta trampa…', cx, 200);
  const lw = easeOutCubic(Math.min(t*4,1))*240;
  ctx.strokeStyle='rgba(255,34,68,0.5)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(cx-lw,218); ctx.lineTo(cx+lw,218); ctx.stroke();
  ctx.globalAlpha = 1;

  if (result.timeline) {
    const items = result.timeline.slice(0,4);
    items.forEach((item, i) => {
      const delay = 0.15 + i * 0.18;
      const it = Math.max(0, Math.min((t-delay)*3, 1));
      if (it <= 0) return;
      const y = 285 + i * 220;
      ctx.globalAlpha = easeOutCubic(it);
      const slideX = (1-easeOutCubic(it))*70;

      const dotColor = item.color==='green'?'#00ff88':item.color==='yellow'?'#ffcc00':'#ff2244';
      drawCard(ctx, 50+slideX, y, 620, 185, 16, `${dotColor}55`);

      // Dot + line
      ctx.fillStyle = dotColor;
      ctx.beginPath(); ctx.arc(92+slideX, y+50, 10, 0, Math.PI*2); ctx.fill();
      ctx.save(); ctx.shadowColor=dotColor; ctx.shadowBlur=12;
      ctx.fillStyle=dotColor; ctx.beginPath(); ctx.arc(92+slideX,y+50,10,0,Math.PI*2); ctx.fill();
      ctx.restore();

      ctx.textAlign='left';
      ctx.font='600 16px Inter, sans-serif';
      ctx.fillStyle='rgba(255,255,255,0.4)';
      ctx.fillText(item.day||'', 118+slideX, y+34);
      ctx.font='700 24px Inter, sans-serif';
      ctx.fillStyle='#ffffff';
      ctx.fillText(item.title||'', 118+slideX, y+62);
      ctx.font='400 17px Inter, sans-serif';
      ctx.fillStyle='rgba(255,255,255,0.5)';
      wrapText(ctx, (item.description||'').substring(0,90), 118+slideX, y+92, 530, 24);
      ctx.textAlign='center';
      ctx.globalAlpha=1;
    });
  }

  drawFade(ctx, canvas, t, true);
  drawFade(ctx, canvas, t, false);
}

// ESCENA 7 — Cómo lo detectó la IA
function renderSceneHowDetected(ctx, t, canvas, result) {
  const W = canvas.width, H = canvas.height, cx = W/2;
  drawBackground(ctx, canvas, t*0.35, 0.06);

  ctx.globalAlpha = easeOutCubic(Math.min(t*4,1));
  ctx.textAlign='center';
  ctx.font='700 16px Inter, sans-serif';
  ctx.fillStyle='#ff1a1a';
  ctx.letterSpacing='4px';
  ctx.fillText('D E T E C C I Ó N   I . A .', cx, 200);
  ctx.letterSpacing='0px';
  ctx.font='900 44px Inter, sans-serif';
  ctx.fillStyle='#ffffff';
  shadowText(ctx,'Indicadores de alerta',cx,260,'#ff1a1a',15);
  ctx.fillText('Indicadores de alerta',cx,260);
  const lw=easeOutCubic(Math.min(t*3,1))*200;
  ctx.strokeStyle='rgba(255,26,26,0.5)'; ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(cx-lw,282);ctx.lineTo(cx+lw,282);ctx.stroke();
  ctx.globalAlpha=1;

  // Tipo de estafa
  const scamType = result.scam_type||result.type||'Fraude';
  drawCard(ctx,50,308,620,90,16,'rgba(255,26,26,0.4)');
  ctx.textAlign='center';
  ctx.font='600 16px Inter, sans-serif';
  ctx.fillStyle='#ff6666';
  ctx.fillText('TIPO DE ESTAFA IDENTIFICADA', cx, 348);
  ctx.font='700 26px Inter, sans-serif';
  ctx.fillStyle='#ffffff';
  ctx.fillText(scamType, cx, 380);

  // Indicadores
  const indicators = (result.indicators||result.signals||[]).slice(0,4);
  indicators.forEach((ind,i)=>{
    const delay=0.2+i*0.18;
    const it=Math.max(0,Math.min((t-delay)*3,1));
    if(it<=0)return;
    const y=430+i*185;
    ctx.globalAlpha=easeOutCubic(it);
    const slideX=(1-easeOutCubic(it))*60;
    drawCard(ctx,50+slideX,y,620,155,14);
    ctx.textAlign='left';
    ctx.font='700 20px Inter, sans-serif';
    ctx.fillStyle='#ff6666';
    ctx.fillText('⚠  '+(ind.name||ind.title||ind.label||'Alerta detectada'),78+slideX,y+42);
    ctx.font='400 17px Inter, sans-serif';
    ctx.fillStyle='rgba(255,255,255,0.5)';
    const d=ind.description||ind.detail||'';
    if(d) wrapText(ctx,d.substring(0,80),78+slideX,y+76,550,24);
    ctx.textAlign='center';
    ctx.globalAlpha=1;
  });

  drawFade(ctx,canvas,t,true);
  drawFade(ctx,canvas,t,false);
}

// ESCENA 8 — "No dejes que te pase"
function renderScene5(ctx, t, canvas, result, logoImg) {
  const W=canvas.width, H=canvas.height, cx=W/2;
  drawBackground(ctx,canvas,t*0.4,0.065);

  const a=easeOutCubic(Math.min(t*3,1));
  ctx.globalAlpha=a;
  ctx.textAlign='center';
  ctx.font='800 54px Inter, sans-serif';
  ctx.fillStyle='#ffffff';
  shadowText(ctx,'No dejes que',cx,H*0.35,'#ff1a1a',18);
  ctx.fillText('No dejes que',cx,H*0.35);
  ctx.font='900 54px Inter, sans-serif';
  ctx.fillStyle='#ff2244';
  ctx.fillText('te pase a ti',cx,H*0.35+64);

  // Línea animada
  const lw=easeOutCubic(Math.min(t*2.5,1))*260;
  ctx.strokeStyle='#ff2244'; ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(cx-lw,H*0.35+80);ctx.lineTo(cx+lw,H*0.35+80);ctx.stroke();
  ctx.globalAlpha=1;

  if(t>0.3){
    const ba=easeOutCubic((t-0.3)/0.3);
    ctx.globalAlpha=ba;
    const scoreColor=result.score>=70?'#ff2244':result.score>=40?'#ffcc00':'#00ff88';
    drawCard(ctx, cx-200, H*0.55, 400, 220, 20, scoreColor+'88');
    ctx.font='900 110px "JetBrains Mono", monospace';
    ctx.fillStyle=scoreColor;
    ctx.save(); ctx.shadowColor=scoreColor; ctx.shadowBlur=40;
    ctx.fillText(`${result.score}%`,cx,H*0.55+130);
    ctx.restore();
    ctx.font='500 22px Inter, sans-serif';
    ctx.fillStyle='rgba(255,255,255,0.5)';
    ctx.fillText('de probabilidad de estafa',cx,H*0.55+175);
    ctx.globalAlpha=1;
  }

  if(t>0.65 && logoImg){
    const la=easeOutCubic((t-0.65)/0.25);
    ctx.globalAlpha=la;
    ctx.save();
    ctx.beginPath();ctx.arc(cx,H*0.87,42,0,Math.PI*2);ctx.clip();
    ctx.drawImage(logoImg,cx-42,H*0.87-42,84,84);
    ctx.restore();
    ctx.globalAlpha=1;
  }

  drawFade(ctx,canvas,t,true);
  drawFade(ctx,canvas,t,false);
}

// ESCENA 9 — CTA Final
function renderScene6(ctx, t, canvas, logoImg) {
  const W=canvas.width, H=canvas.height, cx=W/2;
  drawBackground(ctx,canvas,t*0.5,0.08+t*0.05);

  const a=easeOutCubic(Math.min(t*2.5,1));
  ctx.globalAlpha=a;

  // Logo grande
  if(logoImg){
    ctx.save();
    ctx.beginPath();ctx.arc(cx,H*0.35,75,0,Math.PI*2);ctx.clip();
    ctx.drawImage(logoImg,cx-75,H*0.35-75,150,150);
    ctx.restore();
    // Glow ring pulsante
    const pulse=0.3+0.3*Math.sin(t*6);
    ctx.save();
    ctx.strokeStyle=`rgba(255,26,26,${pulse})`;
    ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(cx,H*0.35,85,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }

  ctx.textAlign='center';
  ctx.font='900 64px Inter, sans-serif';
  ctx.fillStyle='#ffffff';
  shadowText(ctx,'ROBERT',cx,H*0.52,'#ff1a1a',28);
  ctx.fillText('ROBERT',cx,H*0.52);

  ctx.font='500 20px Inter, sans-serif';
  ctx.fillStyle='rgba(255,255,255,0.45)';
  ctx.letterSpacing='5px';
  ctx.fillText('D E T E C T O R   D E   E S T A F A S',cx,H*0.558);
  ctx.letterSpacing='0px';

  if(t>0.35){
    const b=easeOutCubic((t-0.35)/0.3);
    ctx.globalAlpha=b;
    // Tarjeta CTA
    drawCard(ctx,80,H*0.6,560,120,20,'rgba(255,26,26,0.6)');
    ctx.font='700 28px Inter, sans-serif';
    ctx.fillStyle='#ff2244';
    ctx.fillText('🔍  Analiza GRATIS ahora',cx,H*0.6+52);
    ctx.font='500 18px Inter, sans-serif';
    ctx.fillStyle='rgba(255,255,255,0.5)';
    ctx.fillText('robert.app  |  #NoTeDejesEstafar',cx,H*0.6+88);
    ctx.globalAlpha=1;
  }

  if(t>0.65){
    const c=easeOutCubic((t-0.65)/0.25);
    ctx.globalAlpha=c;
    ctx.font='600 18px Inter, sans-serif';
    ctx.fillStyle='rgba(255,255,255,0.25)';
    ctx.fillText('Comparte y protege a tus seres queridos ❤️',cx,H*0.82);
    ctx.globalAlpha=1;
  }

  drawFade(ctx,canvas,t,true);
  // No fade-out en la última escena
}
