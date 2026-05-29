// ===== UI MANAGEMENT =====
const UI = (() => {
  let selectedChar = 'infantry';
  let selectedMap = 'basra';
  let selectedEra = 'iran';
  let selectedDiff = 'normal';
  let menuCanvas, menuCtx;
  let menuAnimId;

  // ===== SCREEN MANAGEMENT =====
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');

    if (id === 'main-menu') startMenuAnimation();
    else stopMenuAnimation();
  }

  // ===== LOADING SCREEN =====
  function initLoading() {
    const fill = document.getElementById('load-fill');
    const text = document.getElementById('load-text');
    const msgs = [
      'تحميل الموارد...',
      'إعداد الخرائط...',
      'تجهيز الجنود...',
      'تحميل الأسلحة...',
      'تهيئة المحرك...',
      'جاهز للقتال!',
    ];
    let progress = 0;
    let msgIdx = 0;

    const interval = setInterval(() => {
      progress += Math.random() * 18 + 8;
      if (progress >= 100) { progress = 100; clearInterval(interval); }

      if (fill) fill.style.width = progress + '%';
      msgIdx = Math.min(Math.floor(progress / 100 * msgs.length), msgs.length - 1);
      if (text) text.textContent = msgs[msgIdx];

      if (progress >= 100) {
        setTimeout(() => {
          loadThreeJS(() => {
            const ls = document.getElementById('loading-screen');
            ls.style.opacity = '0';
            ls.style.transition = 'opacity 0.8s';
            setTimeout(() => {
              ls.style.display = 'none';
              showScreen('main-menu');
              GAME.startBGMusic();
            }, 800);
          });
        }, 400);
      }
    }, 200);
  }

  // ===== LOAD THREE.JS =====
  function loadThreeJS(callback) {
    if (window.THREE) { callback(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    script.onload = callback;
    script.onerror = () => {
      console.warn('Three.js CDN failed, trying fallback');
      const s2 = document.createElement('script');
      s2.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js';
      s2.onload = callback;
      s2.onerror = () => { console.error('Three.js failed to load'); callback(); };
      document.head.appendChild(s2);
    };
    document.head.appendChild(script);
  }

  // ===== MENU BACKGROUND ANIMATION =====
  function startMenuAnimation() {
    menuCanvas = document.getElementById('bg-canvas');
    if (!menuCanvas) return;
    menuCtx = menuCanvas.getContext('2d');
    menuCanvas.width = window.innerWidth;
    menuCanvas.height = window.innerHeight;

    const objects = [];

    // Tanks
    for (let i = 0; i < 6; i++) {
      objects.push({
        type: 'tank', emoji: '🪖',
        x: Math.random() * menuCanvas.width,
        y: menuCanvas.height * 0.5 + Math.random() * menuCanvas.height * 0.3,
        speed: 0.3 + Math.random() * 0.5,
        size: 20 + Math.random() * 20,
        opacity: 0.2 + Math.random() * 0.3,
      });
    }

    // Helicopters
    for (let i = 0; i < 4; i++) {
      objects.push({
        type: 'heli', emoji: '🚁',
        x: Math.random() * menuCanvas.width,
        y: Math.random() * menuCanvas.height * 0.4,
        speed: 0.8 + Math.random() * 0.6,
        size: 24 + Math.random() * 16,
        opacity: 0.2 + Math.random() * 0.2,
        goRight: Math.random() > 0.5,
      });
    }

    // Stars/particles
    const stars = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: Math.random() * menuCanvas.width,
        y: Math.random() * menuCanvas.height,
        r: Math.random() * 1.5,
        opacity: Math.random(),
      });
    }

    // Smoke particles
    const smoke = [];
    for (let i = 0; i < 20; i++) {
      smoke.push({
        x: Math.random() * menuCanvas.width,
        y: menuCanvas.height * (0.4 + Math.random() * 0.5),
        r: 10 + Math.random() * 30,
        vy: -0.2 - Math.random() * 0.3,
        opacity: 0.03 + Math.random() * 0.05,
        vx: (Math.random() - 0.5) * 0.3,
      });
    }

    let t = 0;

    function animateMenu() {
      menuAnimId = requestAnimationFrame(animateMenu);
      t += 0.01;
      const w = menuCanvas.width, h = menuCanvas.height;
      menuCtx.clearRect(0, 0, w, h);

      // Background gradient
      const grad = menuCtx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0a0800');
      grad.addColorStop(0.4, '#1a1200');
      grad.addColorStop(0.7, '#2a1a00');
      grad.addColorStop(1, '#0a0800');
      menuCtx.fillStyle = grad;
      menuCtx.fillRect(0, 0, w, h);

      // Horizon glow (fire/sunset)
      const horizGrad = menuCtx.createRadialGradient(w/2, h*0.55, 0, w/2, h*0.55, w*0.6);
      horizGrad.addColorStop(0, 'rgba(200,80,0,0.15)');
      horizGrad.addColorStop(0.3, 'rgba(150,40,0,0.08)');
      horizGrad.addColorStop(1, 'transparent');
      menuCtx.fillStyle = horizGrad;
      menuCtx.fillRect(0, 0, w, h);

      // Stars
      for (const s of stars) {
        menuCtx.globalAlpha = s.opacity * (0.5 + 0.5 * Math.sin(t * 2 + s.x));
        menuCtx.fillStyle = '#FFE080';
        menuCtx.beginPath();
        menuCtx.arc(s.x, s.y, s.r, 0, Math.PI*2);
        menuCtx.fill();
      }

      // Smoke
      for (const s of smoke) {
        menuCtx.globalAlpha = s.opacity;
        menuCtx.fillStyle = '#888888';
        menuCtx.beginPath();
        menuCtx.arc(s.x, s.y, s.r, 0, Math.PI*2);
        menuCtx.fill();
        s.y += s.vy; s.x += s.vx; s.r += 0.1; s.opacity *= 0.998;
        if (s.y < h * 0.2 || s.r > 60) {
          s.x = Math.random() * w;
          s.y = h * (0.5 + Math.random() * 0.4);
          s.r = 10 + Math.random() * 20;
          s.opacity = 0.03 + Math.random() * 0.05;
        }
      }

      // Ground
      menuCtx.globalAlpha = 1;
      const groundGrad = menuCtx.createLinearGradient(0, h*0.55, 0, h);
      groundGrad.addColorStop(0, '#2a1f00');
      groundGrad.addColorStop(1, '#150f00');
      menuCtx.fillStyle = groundGrad;
      menuCtx.fillRect(0, h*0.55, w, h*0.45);

      // Desert texture lines
      menuCtx.strokeStyle = 'rgba(100,80,0,0.15)';
      menuCtx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const y = h * 0.6 + i * h * 0.05;
        menuCtx.beginPath();
        menuCtx.moveTo(0, y);
        for (let x = 0; x < w; x += 40) {
          menuCtx.lineTo(x + 20, y + Math.sin(x/80 + t + i) * 2);
          menuCtx.lineTo(x + 40, y);
        }
        menuCtx.stroke();
      }

      // Objects (tanks & helicopters)
      menuCtx.font = 'bold 30px serif';
      menuCtx.textAlign = 'center';
      for (const obj of objects) {
        menuCtx.globalAlpha = obj.opacity * (0.8 + 0.2 * Math.sin(t + obj.x));
        menuCtx.font = `${obj.size}px serif`;
        menuCtx.fillText(obj.emoji, obj.x, obj.y);

        if (obj.type === 'tank') {
          obj.x += obj.speed;
          if (obj.x > w + 50) obj.x = -50;
        } else if (obj.type === 'heli') {
          obj.x += obj.goRight ? obj.speed : -obj.speed;
          obj.y += Math.sin(t * 2 + obj.x/100) * 0.5;
          if (obj.x > w + 50) obj.x = -50;
          if (obj.x < -50) obj.x = w + 50;
        }
      }

      // Explosion flashes
      if (Math.random() < 0.005) {
        const ex = Math.random() * w;
        const ey = h * (0.45 + Math.random() * 0.2);
        const eg = menuCtx.createRadialGradient(ex, ey, 0, ex, ey, 40);
        eg.addColorStop(0, 'rgba(255,200,0,0.6)');
        eg.addColorStop(0.3, 'rgba(255,100,0,0.3)');
        eg.addColorStop(1, 'transparent');
        menuCtx.globalAlpha = 1;
        menuCtx.fillStyle = eg;
        menuCtx.beginPath(); menuCtx.arc(ex, ey, 40, 0, Math.PI*2); menuCtx.fill();
      }

      // Iraq flag overlay at top
      menuCtx.globalAlpha = 0.06;
      menuCtx.fillStyle = '#CE1126';
      menuCtx.fillRect(0, 0, w, h*0.33);
      menuCtx.fillStyle = '#FFFFFF';
      menuCtx.fillRect(0, h*0.33, w, h*0.33);
      menuCtx.fillStyle = '#000000';
      menuCtx.fillRect(0, h*0.66, w, h*0.34);

      menuCtx.globalAlpha = 1;
    }

    animateMenu();
  }

  function stopMenuAnimation() {
    if (menuAnimId) { cancelAnimationFrame(menuAnimId); menuAnimId = null; }
  }

  // ===== SELECTION HANDLERS =====
  function selectChar(el, charId) {
    document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    selectedChar = charId;
  }

  function selectMap(el, mapId) {
    document.querySelectorAll('.map-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    selectedMap = mapId;
  }

  function selectEra(eraId, el) {
    document.querySelectorAll('.campaign-era').forEach(e => e.classList.remove('selected'));
    if (el && el.classList) el.classList.add('selected');
    selectedEra = eraId;
    document.getElementById('campaign-actions').classList.remove('hidden');

    // Map era to default map
    const eraMap = { iran:'basra', gulf:'kuwait', postwar:'baghdad', invasion:'fallujah' };
    selectedMap = eraMap[eraId] || 'baghdad';
  }

  function setDiff(diffId, el) {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
    selectedDiff = diffId;
  }

  // Resize canvas on window resize
  window.addEventListener('resize', () => {
    if (menuCanvas) { menuCanvas.width = window.innerWidth; menuCanvas.height = window.innerHeight; }
  });

  // ===== INIT =====
  document.addEventListener('DOMContentLoaded', () => {
    initLoading();
    const saved = GAME.load();
    if (saved) {
      selectedChar = saved.selectedChar || 'infantry';
      selectedMap = saved.selectedMap || 'basra';
      selectedDiff = saved.selectedDiff || 'normal';
    }
  });

  return {
    showScreen,
    selectChar, selectMap, selectEra, setDiff,
    get selectedChar() { return selectedChar; },
    get selectedMap() { return selectedMap; },
    get selectedDiff() { return selectedDiff; },
    set selectedChar(v) { selectedChar = v; },
    set selectedMap(v) { selectedMap = v; },
    set selectedDiff(v) { selectedDiff = v; },
  };
})();

window.UI = UI;

// Global helpers
function showScreen(id) { UI.showScreen(id); }
function selectChar(el, id) { UI.selectChar(el, id); }
function selectMap(el, id) { UI.selectMap(el, id); }
function selectEra(id, el) { UI.selectEra(id, el); }
function setDiff(id, el) { UI.setDiff(id, el); }
