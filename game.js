// ===== GAME LOGIC =====
const GAME = (() => {
  let paused = false;
  let started = false;
  let redFlashTimer = 0;
  let killFeedItems = [];
  let score = 0;
  let kills = 0;
  let startTime = 0;

  // Save system
  const SAVE_KEY = 'iraq_wars_save';

  function save() {
    const data = {
      selectedChar: window.UI?.selectedChar || 'infantry',
      selectedMap: window.UI?.selectedMap || 'basra',
      selectedDiff: window.UI?.selectedDiff || 'normal',
      score: ENGINE.getPlayer().score,
      kills: ENGINE.getPlayer().kills,
      timestamp: Date.now(),
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch(e) {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  }

  function startGame() {
    if (!window.THREE) { alert('جاري تحميل المحرك... يرجى الانتظار'); return; }
    const char = window.UI?.selectedChar || 'infantry';
    const map = window.UI?.selectedMap || 'basra';
    const diff = window.UI?.selectedDiff || 'normal';

    showScreen('game-screen');
    paused = false;
    started = true;
    startTime = Date.now();

    // Add crosshair
    const gameEl = document.getElementById('game-screen');
    if (!document.querySelector('.crosshair')) {
      const ch = document.createElement('div');
      ch.className = 'crosshair';
      gameEl.appendChild(ch);
    }

    // Init 3D engine
    ENGINE.init('game-canvas', char, map, diff);
    ENGINE.startTimer();

    // Objective text
    const objectives = {
      basra: 'الهدف: السيطرة على البصرة',
      baghdad: 'الهدف: تحرير بغداد',
      kuwait: 'الهدف: تحرير الكويت',
      fallujah: 'الهدف: اقتحام الفلوجة',
      mosul: 'الهدف: تأمين الموصل',
      tikrit: 'الهدف: اختراق تكريت',
    };
    const obj = document.getElementById('hud-objective');
    if (obj) obj.textContent = objectives[map] || 'الهدف: تحييد الأعداء';

    // Animate weapon slots
    updateWeaponSlots(char);

    save();
    console.log('[GAME] Started:', char, map, diff);
  }

  function updateWeaponSlots(char) {
    const slots = {
      infantry: ['🔫','💣','🗡️'],
      guard: ['🔫','🔭','🗡️'],
      tank: ['🛡️','💣','🔫'],
      pilot: ['🔫','💣','📡'],
    };
    const ws = slots[char] || slots.infantry;
    for (let i = 0; i < 3; i++) {
      const el = document.getElementById(`slot-${i+1}`);
      if (el) el.textContent = ws[i];
    }
  }

  function togglePause() {
    if (!started) return;
    paused = !paused;
    document.getElementById('pause-menu').classList.toggle('hidden', !paused);
    if (paused) ENGINE.stop ? null : null; // Could pause animation here
  }

  function resumeGame() {
    paused = false;
    document.getElementById('pause-menu').classList.add('hidden');
  }

  function shakeCamera(amount) { ENGINE.shakeCamera(amount); }

  function flashRed() {
    const overlay = document.getElementById('damage-overlay') || createDamageOverlay();
    overlay.style.opacity = '0.5';
    setTimeout(() => { overlay.style.opacity = '0'; }, 200);
  }

  function createDamageOverlay() {
    const d = document.createElement('div');
    d.id = 'damage-overlay';
    Object.assign(d.style, {
      position:'absolute', inset:'0', pointerEvents:'none', zIndex:'30',
      background:'radial-gradient(ellipse at center, transparent 30%, rgba(200,0,0,0.6) 100%)',
      opacity:'0', transition:'opacity 0.1s',
    });
    document.getElementById('game-screen').appendChild(d);
    return d;
  }

  function onKill() {
    kills++;
    const messages = ['تم القضاء على العدو!','العدو سقط!','نقطة للعراق!','أحسنت المقاتل!'];
    const msg = messages[Math.floor(Math.random() * messages.length)];
    addKillFeedItem(msg);

    // Award bonus
    if (kills % 5 === 0) {
      addKillFeedItem(`🌟 تسلسل ${kills} قتيل! مكافأة x2`);
      ENGINE.getPlayer().score += 500;
    }

    save();
  }

  function addKillFeedItem(msg) {
    const feed = document.getElementById('kill-feed');
    if (!feed) return;
    const item = document.createElement('div');
    item.className = 'kill-item';
    item.textContent = msg;
    feed.appendChild(item);
    setTimeout(() => { if(item.parentNode) item.parentNode.removeChild(item); }, 3000);
  }

  function playShootSound() {
    // Web Audio API beep as gunshot
    try {
      const ctx = window._audioCtx || (window._audioCtx = new (window.AudioContext || window.webkitAudioContext)());
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.3));
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = (window._settings?.sfx ?? 80) / 100 * 0.4;
      src.connect(gain); gain.connect(ctx.destination);
      src.start();
    } catch(e) {}
  }

  function playExplosionSound() {
    try {
      const ctx = window._audioCtx || (window._audioCtx = new (window.AudioContext || window.webkitAudioContext)());
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.15));
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = (window._settings?.sfx ?? 80) / 100 * 0.7;
      src.connect(gain); gain.connect(ctx.destination);
      src.start();
    } catch(e) {}
  }

  function showReloadNotice() {
    addKillFeedItem('🔄 لا ذخيرة! اضغط R للتعبئة');
  }

  function gameOver() {
    started = false;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(elapsed / 60), s = elapsed % 60;
    document.getElementById('go-score').textContent = ENGINE.getPlayer().score;
    document.getElementById('go-kills').textContent = ENGINE.getPlayer().kills;
    document.getElementById('go-time').textContent = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;

    const title = ENGINE.getPlayer().kills >= 5 ? '🏆 مهمة ناجحة!' : '☠️ انتهت اللعبة';
    document.getElementById('gameover-title').textContent = title;
    document.getElementById('game-over').classList.remove('hidden');
    ENGINE.stop();
  }

  function restartGame() {
    document.getElementById('game-over').classList.add('hidden');
    ENGINE.stop();
    startGame();
  }

  function quitToMenu() {
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('pause-menu').classList.add('hidden');
    ENGINE.stop();
    started = false;
    paused = false;
    showScreen('main-menu');
  }

  function startMission(type) {
    const missionMaps = {
      rescue: 'fallujah',
      convoy: 'kuwait',
      tank_assault: 'baghdad',
      air_support: 'basra',
    };
    window.UI.selectedMap = missionMaps[type] || 'baghdad';
    window.UI.selectedDiff = type === 'tank_assault' ? 'hard' : 'normal';
    showScreen('game-screen');
    setTimeout(startGame, 100);
  }

  // Background music using Web Audio
  function startBGMusic() {
    try {
      const ctx = window._audioCtx || (window._audioCtx = new (window.AudioContext || window.webkitAudioContext)());
      const vol = (window._settings?.music ?? 70) / 100 * 0.15;
      // Simple drumbeat
      const playDrum = (time, freq, dur) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        const g = ctx.createGain();
        g.gain.value = vol;
        osc.frequency.value = freq;
        env.gain.setValueAtTime(1, time);
        env.gain.exponentialRampToValueAtTime(0.001, time + dur);
        osc.connect(env); env.connect(g); g.connect(ctx.destination);
        osc.start(time); osc.stop(time + dur);
      };
      const bpm = 120;
      const beat = 60 / bpm;
      const now = ctx.currentTime;
      for (let i = 0; i < 32; i++) {
        const t = now + i * beat;
        if (i % 4 === 0) playDrum(t, 60, 0.3);
        if (i % 4 === 2) playDrum(t, 200, 0.1);
        if (i % 2 === 0) playDrum(t + beat*0.5, 1000, 0.05);
      }
    } catch(e) {}
  }

  return {
    startGame, togglePause, resumeGame,
    shakeCamera, flashRed, onKill,
    playShootSound, playExplosionSound,
    showReloadNotice, gameOver, restartGame,
    quitToMenu, startMission, startBGMusic,
    load, save,
    isPaused: () => paused,
    isStarted: () => started,
  };
})();

window.GAME = GAME;

// Global helpers called from HTML
function startGame() { GAME.startGame(); }
function togglePause() { GAME.togglePause(); }
function resumeGame() { GAME.resumeGame(); }
function quitToMenu() { GAME.quitToMenu(); }
function restartGame() { GAME.restartGame(); }
function throwGrenade() { ENGINE.throwGrenade(); }
function reload() { ENGINE.reload(); }
function toggleAim() {
  const p = ENGINE.getPlayer();
  if (p) p.aiming = !p.aiming;
}
function toggleCrouch() {
  const p = ENGINE.getPlayer();
  if (p) p.crouched = !p.crouched;
}
function startFire() {
  const p = ENGINE.getPlayer();
  if (p) p.firing = true;
}
function stopFire() {
  const p = ENGINE.getPlayer();
  if (p) p.firing = false;
}
function startRun() {
  const p = ENGINE.getPlayer();
  if (p) p.running = true;
}
function stopRun() {
  const p = ENGINE.getPlayer();
  if (p) p.running = false;
}
function startMission(type) { GAME.startMission(type); }
function showSettings() { /* inline for now */ }
function setSetting(key, val) {
  window._settings = window._settings || {};
  window._settings[key] = val;
  const el = document.getElementById(key + '-val');
  if (el) el.textContent = val;
}
