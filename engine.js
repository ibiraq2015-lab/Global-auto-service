// ===== IRAQ WARS GAME ENGINE =====
// Three.js based 3D engine

const ENGINE = (() => {
  let scene, camera, renderer, clock;
  let player, enemies = [], projectiles = [], vehicles = [], particles = [];
  let terrain, skybox;
  let isRunning = false;
  let animId = null;

  // Config
  const SETTINGS = {
    gravity: -20,
    playerSpeed: 8,
    runSpeed: 14,
    jumpForce: 10,
    bulletSpeed: 80,
    enemySpeed: 4,
    maxEnemies: 15,
    mapSize: 200,
  };

  // Player state
  const PLAYER = {
    hp: 100, maxHp: 100,
    ammo: 31, maxAmmo: 120,
    score: 0, kills: 0,
    pos: new THREE.Vector3(0, 1.7, 0),
    vel: new THREE.Vector3(),
    yaw: 0, pitch: 0,
    onGround: true, running: false, crouched: false,
    aiming: false, firing: false,
    activeWeapon: 0,
    weapons: ['AK-47','قنبلة','سكين'],
    grenades: 3,
    invincible: false,
    lastShot: 0,
    char: 'infantry',
    map: 'basra',
    difficulty: 'normal',
  };

  // Input
  const INPUT = {
    keys: {}, joystick: { x:0, y:0 },
    mouse: { dx:0, dy:0, down:false },
    touch: {},
  };

  // THREE not yet loaded flag
  let threeLoaded = false;

  // ===== INIT =====
  function init(canvasId, charType, mapType, diff) {
    PLAYER.char = charType;
    PLAYER.map = mapType;
    PLAYER.difficulty = diff;

    // Apply char stats
    const charStats = {
      infantry: { hp:100, speed:1.0, fireRate:0.15 },
      guard:    { hp:130, speed:0.9, fireRate:0.12 },
      tank:     { hp:80,  speed:0.8, fireRate:0.10 },
      pilot:    { hp:70,  speed:1.2, fireRate:0.10 },
    };
    const cs = charStats[charType] || charStats.infantry;
    PLAYER.maxHp = PLAYER.hp = cs.hp;
    PLAYER.speedMult = cs.speed;
    PLAYER.fireRate = cs.fireRate;

    const diffMult = { easy:0.5, normal:1.0, hard:1.5, impossible:2.5 };
    PLAYER.diffMult = diffMult[diff] || 1.0;

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x8B7355, 0.015);

    // Camera
    camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    camera.position.copy(PLAYER.pos);

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;

    clock = new THREE.Clock();

    buildLighting();
    buildTerrain(mapType);
    buildSky(mapType);
    buildBuildings(mapType);
    spawnEnemies(mapType);
    spawnVehicles();

    setupInput(canvas);
    setupResize(canvas);

    isRunning = true;
    loop();
    threeLoaded = true;
  }

  // ===== LIGHTING =====
  function buildLighting() {
    const ambient = new THREE.AmbientLight(0xFFE0A0, 0.4);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xFFD070, 1.2);
    sun.position.set(50, 80, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 400;
    sun.shadow.camera.left = -100;
    sun.shadow.camera.right = 100;
    sun.shadow.camera.top = 100;
    sun.shadow.camera.bottom = -100;
    scene.add(sun);

    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x8B7355, 0.3);
    scene.add(hemi);
  }

  // ===== TERRAIN =====
  function buildTerrain(mapType) {
    const mapColors = {
      basra: { ground:0x8B7355, rock:0x6B5535 },
      baghdad: { ground:0x7A6B4A, rock:0x5A4B2A },
      kuwait: { ground:0xC2A87A, rock:0xA28B5A },
      fallujah: { ground:0x9B8B6A, rock:0x7A6B4A },
      mosul: { ground:0x7A8B6A, rock:0x5A6B4A },
      tikrit: { ground:0x8B7A55, rock:0x6B5A35 },
    };
    const cols = mapColors[mapType] || mapColors.basra;

    // Ground
    const groundGeo = new THREE.PlaneGeometry(SETTINGS.mapSize * 2, SETTINGS.mapSize * 2, 50, 50);
    // Slight terrain bumps
    const verts = groundGeo.attributes.position;
    for (let i = 0; i < verts.count; i++) {
      const x = verts.getX(i), z = verts.getZ(i);
      if (Math.abs(x) > 20 || Math.abs(z) > 20) {
        verts.setY(i, Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2 + (Math.random() - 0.5) * 1.5);
      }
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshLambertMaterial({ color: cols.ground });
    terrain = new THREE.Mesh(groundGeo, groundMat);
    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;
    scene.add(terrain);

    // Road
    const roadGeo = new THREE.PlaneGeometry(8, SETTINGS.mapSize * 2);
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    road.receiveShadow = true;
    scene.add(road);

    // Rocks scattered
    for (let i = 0; i < 40; i++) {
      const s = 0.5 + Math.random() * 2;
      const geo = new THREE.DodecahedronGeometry(s, 0);
      const mat = new THREE.MeshLambertMaterial({ color: cols.rock });
      const rock = new THREE.Mesh(geo, mat);
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 70;
      rock.position.set(Math.cos(angle)*dist, s*0.5, Math.sin(angle)*dist);
      rock.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
      rock.castShadow = true;
      scene.add(rock);
    }
  }

  // ===== SKY =====
  function buildSky(mapType) {
    const skyColors = {
      basra: 0xE8C870,   // dusty orange
      baghdad: 0xB0C4DE,
      kuwait: 0xF0D080,
      fallujah: 0xD0A060,
      mosul: 0xA0B8C8,
      tikrit: 0xC8B070,
    };
    const skyColor = skyColors[mapType] || 0xC8A870;
    scene.background = new THREE.Color(skyColor);

    // Simple cube skybox planes with gradient
    const skyGeo = new THREE.SphereGeometry(400, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: { topColor: { value: new THREE.Color(0x4080B0) }, bottomColor: { value: new THREE.Color(skyColor) }, offset: { value: 20 }, exponent: { value: 0.6 } },
      vertexShader: `varying vec3 vWorldPos; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vWorldPos=wp.xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 topColor,bottomColor; uniform float offset,exponent; varying vec3 vWorldPos; void main(){ float h=normalize(vWorldPos+vec3(0,offset,0)).y; gl_FragColor=vec4(mix(bottomColor,topColor,max(pow(max(h,0.0),exponent),0.0)),1.0); }`,
      side: THREE.BackSide,
    });
    skybox = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skybox);

    // Sun disc
    const sunGeo = new THREE.CircleGeometry(8, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xFFFF80 });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(80, 60, -200);
    sun.lookAt(0, 0, 0);
    scene.add(sun);
  }

  // ===== BUILDINGS =====
  function buildBuildings(mapType) {
    const buildingData = {
      basra: { count:15, maxH:6, color:0xC8B090 },
      baghdad: { count:25, maxH:12, color:0xB8A880 },
      kuwait: { count:10, maxH:8, color:0xD8C8A0 },
      fallujah: { count:20, maxH:5, color:0xB09870 },
      mosul: { count:18, maxH:7, color:0xA89870 },
      tikrit: { count:12, maxH:6, color:0xC0A878 },
    };
    const bd = buildingData[mapType] || buildingData.basra;

    for (let i = 0; i < bd.count; i++) {
      const w = 4 + Math.random() * 8;
      const h = 3 + Math.random() * bd.maxH;
      const d = 4 + Math.random() * 8;
      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshLambertMaterial({
        color: bd.color + Math.floor(Math.random() * 0x101010 - 0x080808),
      });
      const building = new THREE.Mesh(geo, mat);
      const angle = Math.random() * Math.PI * 2;
      const dist = 15 + Math.random() * 60;
      building.position.set(Math.cos(angle)*dist, h/2, Math.sin(angle)*dist);
      building.castShadow = true;
      building.receiveShadow = true;
      building.userData = { type:'building', hp:200, isBuilding:true };
      scene.add(building);

      // Windows
      const winGeo = new THREE.BoxGeometry(0.8, 0.8, 0.05);
      const winMat = new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xFFFF80 : 0x2040A0 });
      for (let ww = 0; ww < 3; ww++) {
        const win = new THREE.Mesh(winGeo, winMat);
        win.position.copy(building.position);
        win.position.x += (Math.random()-0.5)*w*0.6;
        win.position.y = building.position.y + (Math.random()-0.5)*h*0.5;
        win.position.z += d/2 + 0.05;
        scene.add(win);
      }
    }

    // Sandbag barriers
    for (let i = 0; i < 20; i++) {
      const geo = new THREE.BoxGeometry(2, 0.8, 0.6);
      const mat = new THREE.MeshLambertMaterial({ color: 0x8B7355 });
      const barrier = new THREE.Mesh(geo, mat);
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * 25;
      barrier.position.set(Math.cos(angle)*dist, 0.4, Math.sin(angle)*dist);
      barrier.rotation.y = Math.random() * Math.PI;
      barrier.castShadow = true;
      barrier.userData = { type:'cover', isCollidable:true };
      scene.add(barrier);
    }
  }

  // ===== ENEMIES =====
  function spawnEnemies(mapType) {
    const enemyConfigs = {
      iran: { color:0x4A6A3A, helmet:0x3A5A2A, count:8, hp:60, accuracy:0.3 },
      gulf: { color:0x8B7355, helmet:0x6B5335, count:6, hp:50, accuracy:0.25 },
      invasion: { color:0x5A7A5A, helmet:0x4A6A4A, count:10, hp:80, accuracy:0.4 },
    };
    const mapToEra = { basra:'iran', kuwait:'gulf', baghdad:'invasion', fallujah:'invasion', mosul:'invasion', tikrit:'invasion' };
    const era = mapToEra[mapType] || 'invasion';
    const cfg = enemyConfigs[era];

    const count = Math.min(cfg.count + Math.floor(PLAYER.diffMult * 3), SETTINGS.maxEnemies);

    for (let i = 0; i < count; i++) {
      spawnEnemy(cfg);
    }
  }

  function spawnEnemy(cfg) {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.CapsuleGeometry(0.35, 1.0, 4, 8);
    const bodyMat = new THREE.MeshLambertMaterial({ color: cfg.color });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.25, 8, 8);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xC8A878 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.85;
    group.add(head);

    // Helmet
    const helmetGeo = new THREE.SphereGeometry(0.27, 8, 6, 0, Math.PI*2, 0, Math.PI*0.6);
    const helmetMat = new THREE.MeshLambertMaterial({ color: cfg.helmet });
    const helmet = new THREE.Mesh(helmetGeo, helmetMat);
    helmet.position.y = 0.88;
    group.add(helmet);

    // Weapon
    const gunGeo = new THREE.BoxGeometry(0.08, 0.08, 0.7);
    const gunMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const gun = new THREE.Mesh(gunGeo, gunMat);
    gun.position.set(0.3, 0.3, 0.3);
    group.add(gun);

    // Place enemy
    const angle = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 60;
    group.position.set(Math.cos(angle)*dist, 0.85, Math.sin(angle)*dist);

    group.userData = {
      type: 'enemy',
      hp: cfg.hp * PLAYER.diffMult,
      maxHp: cfg.hp * PLAYER.diffMult,
      accuracy: cfg.accuracy,
      state: 'patrol',
      patrolTarget: new THREE.Vector3(
        (Math.random()-0.5)*SETTINGS.mapSize,
        0.85,
        (Math.random()-0.5)*SETTINGS.mapSize
      ),
      lastShot: 0,
      shotDelay: (1.5 + Math.random()*2) / PLAYER.diffMult,
      alertRadius: 30,
      attackRadius: 20,
      speed: SETTINGS.enemySpeed * (0.8 + Math.random()*0.4),
      inCover: false,
      coverTimer: 0,
      vel: new THREE.Vector3(),
    };

    scene.add(group);
    enemies.push(group);
  }

  // ===== VEHICLES =====
  function spawnVehicles() {
    // Tank
    spawnTank(-15, 0, 20, 0x4A5A3A);
    // Humvee (enemy)
    spawnHumvee(25, 0, -15, 0x8B7355, true);
  }

  function spawnTank(x, y, z, color) {
    const group = new THREE.Group();
    // Hull
    const hullGeo = new THREE.BoxGeometry(3.5, 1.2, 5);
    const hullMat = new THREE.MeshLambertMaterial({ color });
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.castShadow = true;
    group.add(hull);
    // Turret
    const turretGeo = new THREE.CylinderGeometry(0.9, 1.0, 0.8, 8);
    const turret = new THREE.Mesh(turretGeo, hullMat);
    turret.position.y = 1.0;
    group.add(turret);
    // Barrel
    const barrelGeo = new THREE.CylinderGeometry(0.08, 0.08, 3);
    const barrel = new THREE.Mesh(barrelGeo, new THREE.MeshLambertMaterial({ color:0x222222 }));
    barrel.rotation.z = Math.PI/2;
    barrel.position.set(1.5, 1.2, 0);
    group.add(barrel);
    // Tracks
    for (const side of [-1.8, 1.8]) {
      const trackGeo = new THREE.BoxGeometry(0.6, 0.8, 5.2);
      const track = new THREE.Mesh(trackGeo, new THREE.MeshLambertMaterial({ color:0x222222 }));
      track.position.set(side, -0.2, 0);
      group.add(track);
    }
    group.position.set(x, 0.8, z);
    group.userData = { type:'vehicle', vehicleType:'tank', hp:500, maxHp:500, occupied:false, speed:5, isEnemy:false };
    scene.add(group);
    vehicles.push(group);
  }

  function spawnHumvee(x, y, z, color, isEnemy) {
    const group = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(2.2, 1.5, 4);
    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    group.add(body);
    // Cabin
    const cabinGeo = new THREE.BoxGeometry(2.0, 1.0, 2.5);
    const cabin = new THREE.Mesh(cabinGeo, bodyMat);
    cabin.position.set(0, 1.25, -0.3);
    group.add(cabin);
    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12);
    const wheelMat = new THREE.MeshLambertMaterial({ color:0x222222 });
    for (const [wx,wz] of [[-1.2,-1.5],[1.2,-1.5],[-1.2,1.5],[1.2,1.5]]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI/2;
      wheel.position.set(wx, -0.3, wz);
      group.add(wheel);
    }
    group.position.set(x, 0.7, z);
    group.userData = { type:'vehicle', vehicleType:'humvee', hp:200, maxHp:200, occupied:false, speed:12, isEnemy };
    if (isEnemy) {
      group.userData.state = 'patrol';
      group.userData.patrolTarget = new THREE.Vector3((Math.random()-0.5)*80, 0.7, (Math.random()-0.5)*80);
    }
    scene.add(group);
    vehicles.push(group);
  }

  // ===== INPUT =====
  function setupInput(canvas) {
    window.addEventListener('keydown', e => { INPUT.keys[e.code] = true; if(e.code==='Escape') window.GAME?.togglePause(); });
    window.addEventListener('keyup', e => { INPUT.keys[e.code] = false; });

    // Mouse look
    canvas.addEventListener('click', () => { canvas.requestPointerLock && canvas.requestPointerLock(); });
    document.addEventListener('pointerlockchange', () => {});
    document.addEventListener('mousemove', e => {
      if (document.pointerLockElement === canvas) {
        INPUT.mouse.dx = e.movementX;
        INPUT.mouse.dy = e.movementY;
      }
    });
    document.addEventListener('mousedown', e => { if(e.button===0) PLAYER.firing = true; });
    document.addEventListener('mouseup', e => { if(e.button===0) PLAYER.firing = false; });

    // Joystick
    const jArea = document.getElementById('joystick-area');
    const jThumb = document.getElementById('joystick-thumb');
    if (jArea) {
      let jTouch = null;
      jArea.addEventListener('touchstart', e => {
        jTouch = e.changedTouches[0];
        e.preventDefault();
      }, { passive:false });
      jArea.addEventListener('touchmove', e => {
        if (!jTouch) return;
        const t = [...e.changedTouches].find(t => t.identifier === jTouch.identifier);
        if (!t) return;
        const rect = jArea.getBoundingClientRect();
        const cx = rect.left + rect.width/2;
        const cy = rect.top + rect.height/2;
        const dx = t.clientX - cx;
        const dy = t.clientY - cy;
        const dist = Math.min(Math.sqrt(dx*dx+dy*dy), 45);
        const angle = Math.atan2(dy, dx);
        INPUT.joystick.x = Math.cos(angle) * dist/45;
        INPUT.joystick.y = Math.sin(angle) * dist/45;
        if (jThumb) { jThumb.style.transform = `translate(calc(-50% + ${Math.cos(angle)*dist}px), calc(-50% + ${Math.sin(angle)*dist}px)`; }
        e.preventDefault();
      }, { passive:false });
      jArea.addEventListener('touchend', e => {
        INPUT.joystick.x = 0; INPUT.joystick.y = 0;
        jTouch = null;
        if (jThumb) jThumb.style.transform = 'translate(-50%,-50%)';
      });
    }

    // Camera touch look
    canvas.addEventListener('touchstart', e => {
      for (const t of e.changedTouches) INPUT.touch[t.identifier] = { x:t.clientX, y:t.clientY };
    });
    canvas.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        const prev = INPUT.touch[t.identifier];
        if (prev) {
          INPUT.mouse.dx = (t.clientX - prev.x) * 1.5;
          INPUT.mouse.dy = (t.clientY - prev.y) * 1.5;
          INPUT.touch[t.identifier] = { x:t.clientX, y:t.clientY };
        }
      }
    });
    canvas.addEventListener('touchend', e => {
      for (const t of e.changedTouches) delete INPUT.touch[t.identifier];
      INPUT.mouse.dx = 0; INPUT.mouse.dy = 0;
    });
  }

  function setupResize(canvas) {
    window.addEventListener('resize', () => {
      if (!renderer || !camera) return;
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
  }

  // ===== MAIN LOOP =====
  function loop() {
    if (!isRunning) return;
    animId = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);

    updatePlayer(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateVehicles(dt);
    updateParticles(dt);
    updateCamera();
    updateHUD();
    drawMinimap();

    renderer.render(scene, camera);

    // Clear mouse delta after use
    INPUT.mouse.dx = 0; INPUT.mouse.dy = 0;
  }

  // ===== PLAYER UPDATE =====
  function updatePlayer(dt) {
    const speed = PLAYER.running ? SETTINGS.runSpeed : SETTINGS.playerSpeed;
    const sp = speed * (PLAYER.crouched ? 0.5 : 1.0) * (PLAYER.speedMult || 1.0);

    // Camera yaw/pitch from mouse or touch
    const sensitivity = 0.003;
    PLAYER.yaw -= INPUT.mouse.dx * sensitivity;
    PLAYER.pitch -= INPUT.mouse.dy * sensitivity;
    PLAYER.pitch = Math.max(-Math.PI/3, Math.min(Math.PI/3, PLAYER.pitch));

    // Movement direction
    const dir = new THREE.Vector3();
    const jx = INPUT.joystick.x, jy = INPUT.joystick.y;
    if (INPUT.keys['KeyW'] || jy < -0.2) dir.z = -1;
    if (INPUT.keys['KeyS'] || jy > 0.2) dir.z = 1;
    if (INPUT.keys['KeyA'] || jx < -0.2) dir.x = -1;
    if (INPUT.keys['KeyD'] || jx > 0.2) dir.x = 1;
    if (INPUT.keys['ShiftLeft']) PLAYER.running = true;

    if (dir.length() > 0) {
      dir.normalize();
      dir.applyEuler(new THREE.Euler(0, PLAYER.yaw, 0));
      PLAYER.vel.x = dir.x * sp;
      PLAYER.vel.z = dir.z * sp;
    } else {
      PLAYER.vel.x *= 0.8;
      PLAYER.vel.z *= 0.8;
      PLAYER.running = false;
    }

    // Gravity
    if (!PLAYER.onGround) PLAYER.vel.y += SETTINGS.gravity * dt;
    else if (INPUT.keys['Space']) { PLAYER.vel.y = SETTINGS.jumpForce; PLAYER.onGround = false; }

    // Move
    PLAYER.pos.addScaledVector(PLAYER.vel, dt);

    // Ground collision
    if (PLAYER.pos.y < 1.7) {
      PLAYER.pos.y = 1.7;
      PLAYER.vel.y = 0;
      PLAYER.onGround = true;
    }

    // Map bounds
    const bound = SETTINGS.mapSize - 5;
    PLAYER.pos.x = Math.max(-bound, Math.min(bound, PLAYER.pos.x));
    PLAYER.pos.z = Math.max(-bound, Math.min(bound, PLAYER.pos.z));

    // Shooting
    if ((PLAYER.firing || INPUT.keys['KeyF']) && PLAYER.ammo > 0) {
      const now = performance.now() / 1000;
      if (now - PLAYER.lastShot > (PLAYER.fireRate || 0.15)) {
        shoot();
        PLAYER.lastShot = now;
      }
    }

    // Crouch
    if (INPUT.keys['KeyC']) PLAYER.crouched = !INPUT.keys['KeyC'] ? PLAYER.crouched : true;
    else PLAYER.crouched = false;
  }

  function shoot() {
    if (PLAYER.ammo <= 0) { window.GAME?.showReloadNotice(); return; }
    PLAYER.ammo--;

    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyEuler(new THREE.Euler(PLAYER.pitch, PLAYER.yaw, 0, 'YXZ'));
    // Spread
    const spread = PLAYER.aiming ? 0.01 : 0.04;
    dir.x += (Math.random()-0.5) * spread;
    dir.y += (Math.random()-0.5) * spread;
    dir.normalize();

    const geo = new THREE.SphereGeometry(0.05, 4, 4);
    const mat = new THREE.MeshBasicMaterial({ color:0xFFDD00 });
    const bullet = new THREE.Mesh(geo, mat);
    bullet.position.copy(PLAYER.pos);
    bullet.position.y -= 0.1;
    bullet.userData = {
      vel: dir.multiplyScalar(SETTINGS.bulletSpeed),
      life: 2.0, isPlayerBullet: true, damage: 25,
    };
    scene.add(bullet);
    projectiles.push(bullet);

    // Muzzle flash
    spawnMuzzleFlash(PLAYER.pos.clone().add(dir.clone().multiplyScalar(0.5)));

    // Camera shake
    window.GAME?.shakeCamera(0.03);

    // Sound (visual only)
    window.GAME?.playShootSound();
  }

  // ===== ENEMIES UPDATE =====
  function updateEnemies(dt) {
    const now = performance.now() / 1000;
    const playerPos = PLAYER.pos;

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (!e.parent) { enemies.splice(i, 1); continue; }

      const ud = e.userData;
      const dist = e.position.distanceTo(playerPos);

      // State machine
      if (dist < ud.alertRadius) ud.state = 'chase';
      if (dist < ud.attackRadius) ud.state = 'attack';
      if (dist > ud.alertRadius * 1.5) ud.state = 'patrol';

      if (ud.state === 'patrol') {
        // Move toward patrol target
        const pdist = e.position.distanceTo(ud.patrolTarget);
        if (pdist < 2) {
          ud.patrolTarget.set(
            (Math.random()-0.5) * SETTINGS.mapSize,
            0.85,
            (Math.random()-0.5) * SETTINGS.mapSize
          );
        }
        const pdir = ud.patrolTarget.clone().sub(e.position).normalize();
        e.position.addScaledVector(pdir, ud.speed * 0.5 * dt);
        e.lookAt(ud.patrolTarget);
      }
      else if (ud.state === 'chase') {
        const cdir = playerPos.clone().sub(e.position).normalize();
        e.position.addScaledVector(cdir, ud.speed * dt);
        e.lookAt(playerPos);
      }
      else if (ud.state === 'attack') {
        e.lookAt(playerPos);

        // Cover behavior
        ud.coverTimer -= dt;
        if (ud.coverTimer <= 0) {
          ud.inCover = !ud.inCover;
          ud.coverTimer = 1 + Math.random() * 2;
        }

        if (!ud.inCover && now - ud.lastShot > ud.shotDelay) {
          enemyShoot(e, playerPos);
          ud.lastShot = now;
        }

        // Slight strafing
        if (!ud.inCover) {
          const side = new THREE.Vector3(-Math.sin(e.rotation.y), 0, Math.cos(e.rotation.y));
          e.position.addScaledVector(side, Math.sin(now * 2 + i) * ud.speed * 0.3 * dt);
        }
      }

      // Clamp to ground
      e.position.y = 0.85;
    }
  }

  function enemyShoot(enemy, target) {
    const dir = target.clone().sub(enemy.position).normalize();
    const accuracy = enemy.userData.accuracy;
    dir.x += (Math.random()-0.5) * (1 - accuracy) * 0.5;
    dir.y += (Math.random()-0.5) * (1 - accuracy) * 0.3;
    dir.normalize();

    const geo = new THREE.SphereGeometry(0.04, 4, 4);
    const mat = new THREE.MeshBasicMaterial({ color:0xFF4400 });
    const bullet = new THREE.Mesh(geo, mat);
    bullet.position.copy(enemy.position);
    bullet.position.y += 0.3;
    bullet.userData = { vel: dir.clone().multiplyScalar(50), life:2.5, isPlayerBullet:false, damage: 10 * PLAYER.diffMult };
    scene.add(bullet);
    projectiles.push(bullet);

    spawnMuzzleFlash(enemy.position.clone().add(new THREE.Vector3(0, 0.3, 0)));
  }

  // ===== PROJECTILES =====
  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.userData.life -= dt;
      if (p.userData.life <= 0) { scene.remove(p); projectiles.splice(i, 1); continue; }

      const prevPos = p.position.clone();
      p.position.addScaledVector(p.userData.vel, dt);

      // Ground
      if (p.position.y < 0) { createExplosionEffect(p.position, 0.3); scene.remove(p); projectiles.splice(i, 1); continue; }

      // Gravity on bullets
      p.userData.vel.y -= 5 * dt;

      // Hit detection
      if (p.userData.isPlayerBullet) {
        // Check enemy hits
        for (let j = enemies.length - 1; j >= 0; j--) {
          const e = enemies[j];
          if (p.position.distanceTo(e.position) < 0.8) {
            e.userData.hp -= p.userData.damage;
            createHitEffect(p.position.clone());
            scene.remove(p); projectiles.splice(i, 1);
            if (e.userData.hp <= 0) killEnemy(j);
            break;
          }
        }
      } else {
        // Hit player
        if (p.position.distanceTo(PLAYER.pos) < 0.6 && !PLAYER.invincible) {
          takeDamage(p.userData.damage);
          scene.remove(p); projectiles.splice(i, 1);
        }
      }
    }
  }

  function killEnemy(idx) {
    const e = enemies[idx];
    createExplosionEffect(e.position.clone(), 0.5);
    scene.remove(e);
    enemies.splice(idx, 1);
    PLAYER.score += 100;
    PLAYER.kills++;
    window.GAME?.onKill();

    // Respawn after delay if difficulty allows
    if (PLAYER.diffMult >= 1.5) {
      setTimeout(() => {
        const cfg = { color:0x4A6A3A, helmet:0x3A5A2A, hp:60, accuracy:0.35 };
        spawnEnemy(cfg);
      }, 8000);
    }
  }

  function takeDamage(dmg) {
    if (PLAYER.invincible) return;
    PLAYER.hp = Math.max(0, PLAYER.hp - dmg);
    window.GAME?.shakeCamera(0.08);
    window.GAME?.flashRed();
    if (PLAYER.hp <= 0) window.GAME?.gameOver();
  }

  // ===== VEHICLES UPDATE =====
  function updateVehicles(dt) {
    for (const v of vehicles) {
      if (!v.parent || !v.userData.isEnemy) continue;
      const ud = v.userData;
      const pdist = v.position.distanceTo(ud.patrolTarget || PLAYER.pos);
      if (pdist < 5) {
        ud.patrolTarget = new THREE.Vector3((Math.random()-0.5)*80, v.position.y, (Math.random()-0.5)*80);
      }
      const dir = (ud.patrolTarget || PLAYER.pos).clone().sub(v.position).normalize();
      v.position.addScaledVector(dir, ud.speed * dt * 0.3);
      v.lookAt((ud.patrolTarget || PLAYER.pos));
    }
  }

  // ===== PARTICLES =====
  function spawnMuzzleFlash(pos) {
    const geo = new THREE.SphereGeometry(0.15, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color:0xFFAA00 });
    const flash = new THREE.Mesh(geo, mat);
    flash.position.copy(pos);
    flash.userData = { life:0.05 };
    scene.add(flash);
    particles.push(flash);
  }

  function createExplosionEffect(pos, scale) {
    for (let i = 0; i < 10; i++) {
      const geo = new THREE.SphereGeometry(scale * (0.2 + Math.random()*0.3), 4, 4);
      const mat = new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xFF6600 : 0xFFAA00 });
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(pos);
      const vel = new THREE.Vector3((Math.random()-0.5)*8,(Math.random())*5,(Math.random()-0.5)*8);
      p.userData = { vel, life:0.6 + Math.random()*0.4, gravity:true };
      scene.add(p);
      particles.push(p);
    }
    // Smoke
    for (let i = 0; i < 5; i++) {
      const geo = new THREE.SphereGeometry(scale * 0.4, 4, 4);
      const mat = new THREE.MeshBasicMaterial({ color:0x444444, transparent:true, opacity:0.6 });
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(pos);
      p.position.y += scale;
      p.userData = { vel:new THREE.Vector3((Math.random()-0.5)*2, 2+Math.random()*2,(Math.random()-0.5)*2), life:1.5, smoke:true };
      scene.add(p);
      particles.push(p);
    }
    window.GAME?.shakeCamera(scale * 0.15);
  }

  function createHitEffect(pos) {
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.SphereGeometry(0.05, 4, 4);
      const mat = new THREE.MeshBasicMaterial({ color:0xFF0000 });
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(pos);
      p.userData = { vel:new THREE.Vector3((Math.random()-0.5)*5,(Math.random())*3,(Math.random()-0.5)*5), life:0.3 };
      scene.add(p);
      particles.push(p);
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.userData.life -= dt;
      if (p.userData.life <= 0) { scene.remove(p); particles.splice(i, 1); continue; }
      if (p.userData.vel) p.position.addScaledVector(p.userData.vel, dt);
      if (p.userData.gravity) p.userData.vel.y -= 10 * dt;
      if (p.userData.smoke) {
        p.scale.multiplyScalar(1 + dt * 0.5);
        p.material.opacity *= 0.97;
      }
    }
  }

  // ===== CAMERA =====
  let camShake = 0;
  function updateCamera() {
    const targetPos = PLAYER.pos.clone();
    targetPos.y += PLAYER.crouched ? 0.2 : 0;
    camera.position.copy(targetPos);

    if (camShake > 0) {
      camera.position.x += (Math.random()-0.5) * camShake;
      camera.position.y += (Math.random()-0.5) * camShake;
      camShake *= 0.8;
    }

    camera.rotation.order = 'YXZ';
    camera.rotation.y = PLAYER.yaw;
    camera.rotation.x = PLAYER.pitch;
  }

  function shakeCamera(amount) { camShake = Math.max(camShake, amount); }

  // ===== HUD UPDATE =====
  function updateHUD() {
    const hb = document.getElementById('health-bar');
    const hv = document.getElementById('health-val');
    const av = document.getElementById('hud-ammo');
    const sv = document.getElementById('score-val');

    if (hb) hb.style.width = (PLAYER.hp / PLAYER.maxHp * 100) + '%';
    if (hv) hv.textContent = PLAYER.hp;
    if (av) av.textContent = `${PLAYER.ammo} / ${PLAYER.maxAmmo}`;
    if (sv) sv.textContent = PLAYER.score;

    // Health color
    if (hb) {
      const pct = PLAYER.hp / PLAYER.maxHp;
      hb.style.background = pct > 0.5 ? 'linear-gradient(90deg,#00cc44,#44ff66)' :
        pct > 0.25 ? 'linear-gradient(90deg,#cc8800,#ffaa00)' : 'linear-gradient(90deg,#cc0000,#ff4400)';
    }
  }

  // ===== MINIMAP =====
  function drawMinimap() {
    const c = document.getElementById('minimap-canvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,20,0,0.85)';
    ctx.fillRect(0, 0, w, h);

    const scale = w / (SETTINGS.mapSize * 2);
    const ox = w/2, oy = h/2;

    // Grid
    ctx.strokeStyle = 'rgba(100,120,80,0.3)';
    ctx.lineWidth = 0.5;
    for (let i = -SETTINGS.mapSize; i <= SETTINGS.mapSize; i += 20) {
      const x = ox + i * scale;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      const y = oy + i * scale;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Enemies
    ctx.fillStyle = '#ff4444';
    for (const e of enemies) {
      const ex = ox + (e.position.x - PLAYER.pos.x) * scale * 3;
      const ey = oy + (e.position.z - PLAYER.pos.z) * scale * 3;
      if (ex > 0 && ex < w && ey > 0 && ey < h) {
        ctx.beginPath(); ctx.arc(ex, ey, 2.5, 0, Math.PI*2); ctx.fill();
      }
    }

    // Vehicles
    ctx.fillStyle = '#4488ff';
    for (const v of vehicles) {
      const vx = ox + (v.position.x - PLAYER.pos.x) * scale * 3;
      const vy = oy + (v.position.z - PLAYER.pos.z) * scale * 3;
      if (vx > 0 && vx < w && vy > 0 && vy < h) {
        ctx.fillRect(vx-3, vy-3, 6, 6);
      }
    }

    // Player
    ctx.fillStyle = '#44ff88';
    ctx.beginPath(); ctx.arc(ox, oy, 4, 0, Math.PI*2); ctx.fill();
    // Direction indicator
    ctx.strokeStyle = '#44ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox - Math.sin(PLAYER.yaw)*12, oy - Math.cos(PLAYER.yaw)*12);
    ctx.stroke();

    // Border
    ctx.strokeStyle = 'rgba(200,168,75,0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, w, h);
  }

  // ===== TIMER =====
  let gameTime = 525; // 8:45
  let timerInterval = null;
  function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!isRunning) return;
      gameTime--;
      const m = Math.floor(gameTime / 60);
      const s = gameTime % 60;
      const el = document.getElementById('hud-timer');
      if (el) el.textContent = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
      if (gameTime <= 0) window.GAME?.gameOver();
    }, 1000);
  }

  // ===== PUBLIC API =====
  return {
    init, shakeCamera,
    getPlayer: () => PLAYER,
    getEnemies: () => enemies,
    startTimer,
    stop: () => {
      isRunning = false;
      if (animId) cancelAnimationFrame(animId);
      clearInterval(timerInterval);
    },
    reload: () => {
      if (PLAYER.ammo < PLAYER.maxAmmo) {
        setTimeout(() => {
          const refill = Math.min(31, PLAYER.maxAmmo - PLAYER.ammo);
          PLAYER.ammo += refill;
          PLAYER.maxAmmo -= refill;
        }, 2000);
      }
    },
    throwGrenade: () => {
      if (PLAYER.grenades <= 0) return;
      PLAYER.grenades--;
      const dir = new THREE.Vector3(0, 0.5, -1).applyEuler(new THREE.Euler(PLAYER.pitch, PLAYER.yaw, 0, 'YXZ'));
      const geo = new THREE.SphereGeometry(0.12, 6, 6);
      const mat = new THREE.MeshLambertMaterial({ color:0x446633 });
      const grenade = new THREE.Mesh(geo, mat);
      grenade.position.copy(PLAYER.pos);
      grenade.userData = { vel:dir.multiplyScalar(20), life:2.5, isGrenade:true, damage:80, isPlayerBullet:true };
      scene.add(grenade);
      projectiles.push(grenade);
    },
  };
})();

// Expose globally
window.ENGINE = ENGINE;
