/* ═══════════════════════════════════════════════════════════════
   ROBERT: DETECTOR DE ESTAFAS — PARTÍCULAS DE FONDO
   Canvas animado con partículas flotantes en red conectada
   ═══════════════════════════════════════════════════════════════ */

export function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  let particles = [];
  let animationId;
  
  // ─── Configuración ───
  const CONFIG = {
    particleCount: getParticleCount(),
    maxDistance: 120,
    speed: 0.3,
    particleSize: 1.5,
    color: { r: 255, g: 26, b: 26 },   // Rojo neón
    colorAlt: { r: 255, g: 100, b: 100 }, // Rojo claro
    lineOpacity: 0.15,
    particleOpacity: 0.6,
    mouseRadius: 150,
  };
  
  let mouse = { x: null, y: null };
  
  // ─── Responsive particle count ───
  function getParticleCount() {
    const w = window.innerWidth;
    if (w < 480) return 30;
    if (w < 768) return 50;
    return 70;
  }
  
  // ─── Resize handler ───
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    CONFIG.particleCount = getParticleCount();
    initParticlesArray();
  }
  
  // ─── Create particles ───
  function initParticlesArray() {
    particles = [];
    for (let i = 0; i < CONFIG.particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * CONFIG.speed,
        vy: (Math.random() - 0.5) * CONFIG.speed,
        size: Math.random() * CONFIG.particleSize + 0.5,
        opacity: Math.random() * 0.4 + 0.2,
        useAltColor: Math.random() > 0.7,
      });
    }
  }
  
  // ─── Animation loop ───
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update & draw particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      
      // Move
      p.x += p.vx;
      p.y += p.vy;
      
      // Bounce off edges
      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      
      // Mouse interaction (gentle push)
      if (mouse.x !== null) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONFIG.mouseRadius) {
          const force = (CONFIG.mouseRadius - dist) / CONFIG.mouseRadius * 0.02;
          p.vx += dx * force;
          p.vy += dy * force;
        }
      }
      
      // Limit speed
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > CONFIG.speed * 2) {
        p.vx = (p.vx / speed) * CONFIG.speed * 2;
        p.vy = (p.vy / speed) * CONFIG.speed * 2;
      }
      
      // Draw particle
      const color = p.useAltColor ? CONFIG.colorAlt : CONFIG.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${p.opacity})`;
      ctx.fill();
      
      // Draw connections
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < CONFIG.maxDistance) {
          const opacity = (1 - dist / CONFIG.maxDistance) * CONFIG.lineOpacity;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(${CONFIG.color.r}, ${CONFIG.color.g}, ${CONFIG.color.b}, ${opacity})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    
    animationId = requestAnimationFrame(animate);
  }
  
  // ─── Events ───
  window.addEventListener('resize', () => {
    cancelAnimationFrame(animationId);
    resize();
    animate();
  });
  
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  
  window.addEventListener('mouseout', () => {
    mouse.x = null;
    mouse.y = null;
  });
  
  // Touch support for mobile
  window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
    }
  }, { passive: true });
  
  window.addEventListener('touchend', () => {
    mouse.x = null;
    mouse.y = null;
  });
  
  // ─── Init ───
  resize();
  animate();
}
