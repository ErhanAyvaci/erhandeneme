/* =====================================================================
   Yörünge Ağı — 3D görselleştirme, efektler, arayüz, ilerleme
   Gerektirir: window.THREE, window.RoomEnvironment, window.SIM
   ===================================================================== */
(function () {
  'use strict';
  const T = window.THREE;
  const S = window.SIM;
  const { RE, PAD_ANG, W_E, ROCKETS, MODE_NAMES } = S;
  const clamp = S.clamp;
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = id => document.getElementById(id);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const DT = 1 / 50;

  /* ================= KAYIT / İLERLEME ================= */
  const SAVE_KEY = 'yorunge-agi-kayit-v1';
  const DEFAULT_STATE = {
    money: 100e6, sats: 0, launches: 0, recovered: 0,
    unlocked: { f1: true }, success: { f1: 0, f9: 0, fh: 0, ss: 0 }, firstDone: {},
    cores: { f9: 0, fh: 0, ss: 0 }, flights: { f9: 0, fh: 0, ss: 0 },
    sel: 'f1', mode: { f1: 'exp', f9: 'asds', fh: 'asds', ss: 'catch' }, won: false,
  };
  let state = loadState();
  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && typeof s.money === 'number') return Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)), s);
    } catch (e) { /* yok say */ }
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
  function saveState() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* yok say */ } }
  const coverage = n => 1 - Math.exp(-n / 550);
  const SAT_INCOME = 1.2e6, FIRST_BONUS = 25e6, SUB_INCOME = 30e6;
  const coreCount = k => (k === 'fh' ? 3 : 1);
  function launchCost(k) {
    const d = ROCKETS[k];
    if (!d.reuseCost) return d.launchCost;
    const n = coreCount(k), ready = Math.min(n, state.cores[k] || 0);
    return d.reuseCost + (d.launchCost - d.reuseCost) * (n - ready) / n;
  }
  const money = v => (v < 0 ? '-' : '') + '$' + (Math.abs(v) >= 1e9 ? (Math.abs(v) / 1e9).toFixed(2) + ' Mr' : (Math.abs(v) / 1e6).toFixed(1) + ' M');

  /* ================= RENDERER / SAHNE ================= */
  const canvas = $('c');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(55, innerWidth / innerHeight, 0.3, 5e9);
  const pmrem = new T.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new window.RoomEnvironment(), 0.04).texture;

  const SUN = new T.Vector3(0.42, 0.78, 0.46).normalize();
  const sunLight = new T.DirectionalLight(0xfff2e0, 3.2);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight, sunLight.target);
  const hemi = new T.HemisphereLight(0x9cc4ff, 0x2a2a22, 0.5);
  scene.add(hemi);
  const flashLight = new T.PointLight(0xff9040, 0, 0, 1.2);
  scene.add(flashLight);

  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    for (const ps of [fireP, smokeP]) ps && (ps.mat.uniforms.scale.value = innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360)));
  });

  // Kayan orijin: tüm nesneler odak noktasına (F) göre konumlandırılır
  const F = new T.Vector3();
  let NOWT = -10; // dünya dönüş açısı için zaman
  const efRot = () => W_E * (NOWT + 10);
  function toEF(x, y) { const a = efRot(), c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; }
  function placeAt(obj, X, Y, Z) { obj.position.set(X - F.x, Y - F.y, (Z || 0) - F.z); }
  function surfacePoint(d, h) { const a = PAD_ANG - d / RE, r = RE + (h || 0); return [r * Math.cos(a), r * Math.sin(a), a]; }

  /* ================= GÜRÜLTÜ ================= */
  function hash3(x, y, z) { let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
  function vnoise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
      l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v), w);
  }
  function fbm(x, y, z, oct) { let a = 0, f = 1, amp = 0.5; for (let i = 0; i < oct; i++) { a += amp * vnoise(x * f, y * f, z * f); f *= 2.03; amp *= 0.5; } return a; }

  /* ================= DÜNYA ================= */
  function makeEarthTextures() {
    const W = 1024, H = 512;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const sp = document.createElement('canvas'); sp.width = W; sp.height = H;
    const cl = document.createElement('canvas'); cl.width = W; cl.height = H;
    const ctx = cv.getContext('2d'), sctx = sp.getContext('2d'), cctx = cl.getContext('2d');
    const img = ctx.createImageData(W, H), simg = sctx.createImageData(W, H), cimg = cctx.createImageData(W, H);
    for (let j = 0; j < H; j++) {
      const lat = (0.5 - j / H) * Math.PI;
      for (let i = 0; i < W; i++) {
        const lon = (i / W) * 2 * Math.PI;
        const x = Math.cos(lat) * Math.cos(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.sin(lon);
        const n = fbm(x * 1.6 + 7, y * 1.6 + 3, z * 1.6 + 1, 6);
        const m = fbm(x * 3 + 21, y * 3 + 9, z * 3 + 4, 4);
        const k = (j * W + i) * 4;
        let r, g, b, spec = 0;
        const alat = Math.abs(lat) / (Math.PI / 2);
        if (n < 0.53) {
          const dpt = clamp((0.53 - n) * 5, 0, 1);
          r = lerp(30, 6, dpt); g = lerp(95, 30, dpt); b = lerp(140, 75, dpt); spec = 255;
        } else {
          const e = clamp((n - 0.53) * 6, 0, 1);
          const dry = clamp((m - 0.45) * 3 + (1 - Math.abs(alat - 0.28) * 4) * 0.35, 0, 1);
          r = lerp(52, 182, dry); g = lerp(96, 152, dry); b = lerp(42, 96, dry);
          r = lerp(r, 120, e * 0.6); g = lerp(g, 110, e * 0.6); b = lerp(b, 95, e * 0.6);
        }
        if (alat > 0.82 || (alat > 0.72 && n > 0.5)) { r = g = 238; b = 245; spec = 30; }
        img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
        simg.data[k] = simg.data[k + 1] = simg.data[k + 2] = spec; simg.data[k + 3] = 255;
        const c = fbm(x * 4 + 50, y * 6 + 50, z * 4 + 50, 5);
        const ca = clamp((c - 0.5) * 3.2, 0, 1);
        cimg.data[k] = cimg.data[k + 1] = cimg.data[k + 2] = 255; cimg.data[k + 3] = ca * 235;
      }
    }
    ctx.putImageData(img, 0, 0); sctx.putImageData(simg, 0, 0); cctx.putImageData(cimg, 0, 0);
    const map = new T.CanvasTexture(cv); map.colorSpace = T.SRGBColorSpace; map.anisotropy = 8;
    const specMap = new T.CanvasTexture(sp);
    const cloudMap = new T.CanvasTexture(cl); cloudMap.colorSpace = T.SRGBColorSpace;
    return { map, specMap, cloudMap };
  }

  let earth, clouds, atmo, stars, sunSprite;
  function buildEarth() {
    const tx = makeEarthTextures();
    earth = new T.Mesh(new T.SphereGeometry(RE - 160, 512, 256),
      new T.MeshPhongMaterial({ map: tx.map, specularMap: tx.specMap, specular: 0x2a3440, shininess: 22 }));
    earth.rotation.x = Math.PI / 2;
    scene.add(earth);
    clouds = new T.Mesh(new T.SphereGeometry(RE + 5000, 256, 128),
      new T.MeshLambertMaterial({ map: tx.cloudMap, transparent: true, depthWrite: false, opacity: 0.9 }));
    clouds.rotation.x = Math.PI / 2;
    scene.add(clouds);
    // atmosfer parıltısı
    const atmoMat = new T.ShaderMaterial({
      uniforms: { sun: { value: SUN } },
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vN; varying vec3 vV; varying vec3 vWN;
        void main(){ vN = normalize(normalMatrix*normal); vWN = normalize(mat3(modelMatrix)*normal);
          vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix*mv;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform vec3 sun; varying vec3 vN; varying vec3 vV; varying vec3 vWN;
        void main(){ float f = 1.0 - abs(dot(vN, vV)); float i = pow(f, 3.0);
          float day = clamp(dot(vWN, sun)*1.2+0.35, 0.0, 1.0);
          vec3 col = mix(vec3(0.25,0.5,1.0), vec3(0.55,0.8,1.0), f)*day;
          gl_FragColor = vec4(col*i*1.6, i);
          #include <logdepthbuf_fragment>
        }`,
      side: T.BackSide, blending: T.AdditiveBlending, transparent: true, depthWrite: false,
    });
    atmo = new T.Mesh(new T.SphereGeometry(RE * 1.028, 128, 64), atmoMat);
    scene.add(atmo);
    // yıldızlar
    const sg = new T.BufferGeometry(), N = 4000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 1e9;
      const s = Math.sqrt(1 - u * u);
      pos[i * 3] = r * s * Math.cos(th); pos[i * 3 + 1] = r * u; pos[i * 3 + 2] = r * s * Math.sin(th);
      const b = 0.4 + Math.random() * 0.6, tint = Math.random();
      col[i * 3] = b * (tint > 0.8 ? 1 : 0.85); col[i * 3 + 1] = b * 0.9; col[i * 3 + 2] = b * (tint < 0.3 ? 1 : 0.85);
    }
    sg.setAttribute('position', new T.BufferAttribute(pos, 3));
    sg.setAttribute('color', new T.BufferAttribute(col, 3));
    stars = new T.Points(sg, new T.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false }));
    stars.frustumCulled = false;
    scene.add(stars);
    // güneş
    const sc = document.createElement('canvas'); sc.width = sc.height = 128;
    const g = sc.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.15, 'rgba(255,240,200,0.8)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    sunSprite = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(sc), blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    sunSprite.scale.set(9e7, 9e7, 1);
    scene.add(sunSprite);
  }

  /* --- Yerel yüzey parçası (eğrisel kapak) --- */
  function capGeometry(radius, rings, segs, colorFn) {
    const pos = [], col = [], idx = [];
    pos.push(0, 0, 0); const c0 = colorFn(0, 0); col.push(c0[0] ** 2.2, c0[1] ** 2.2, c0[2] ** 2.2);
    for (let i = 1; i <= rings; i++) {
      const s = radius * Math.pow(i / rings, 2.3);
      const a = s / RE;
      for (let j = 0; j < segs; j++) {
        const ph = j / segs * Math.PI * 2;
        const e = Math.sin(a) * RE * Math.cos(ph), n = Math.sin(a) * RE * Math.sin(ph);
        const y = RE * Math.cos(a) - RE;
        pos.push(e, y, n);
        const c = colorFn(s * Math.cos(ph), s * Math.sin(ph), s);
        col.push(c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2);
      }
    }
    for (let j = 0; j < segs; j++) idx.push(0, 1 + (j + 1) % segs, 1 + j);
    for (let i = 1; i < rings; i++) {
      const b0 = 1 + (i - 1) * segs, b1 = 1 + i * segs;
      for (let j = 0; j < segs; j++) {
        const j1 = (j + 1) % segs;
        idx.push(b0 + j, b0 + j1, b1 + j, b0 + j1, b1 + j1, b1 + j);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  const coastE = n => 2600 + 420 * Math.sin(n / 2300) + 180 * Math.sin(n / 610 + 1.3) + 900 * Math.sin(n / 9000);
  function siteColor(e, n) {
    const ce = coastE(n);
    const nz = vnoise(e / 900, n / 900, 3.3) * 0.6 + vnoise(e / 160, n / 160, 8.1) * 0.4;
    if (e > ce) {
      const dpt = clamp((e - ce) / 30000, 0, 1);
      if (e - ce < 60) return [0.78, 0.74, 0.6];
      return [lerp(0.07, 0.02, dpt), lerp(0.25, 0.09, dpt), lerp(0.32, 0.2, dpt)];
    }
    if (ce - e < 140) return [0.8, 0.75, 0.6];
    // lagün
    const lag = vnoise(e / 4000 + 9, n / 4000, 1.7);
    if (lag > 0.72 && e < ce - 1500) return [0.08, 0.22, 0.26];
    return [lerp(0.16, 0.34, nz), lerp(0.24, 0.36, nz), lerp(0.1, 0.2, nz)];
  }
  const oceanColor = (e, n) => { const nz = vnoise(e / 700, n / 700, 5.5); return [0.03 + nz * 0.02, 0.1 + nz * 0.04, 0.2 + nz * 0.05]; };

  let siteCap, shipCap, falconSite, starSite, lzPads = [], droneShip, towerArms = null;
  const mats = {
    white: new T.MeshStandardMaterial({ color: 0xf1f1ee, roughness: 0.42, metalness: 0.05, envMapIntensity: 0.7 }),
    black: new T.MeshStandardMaterial({ color: 0x18191b, roughness: 0.6, metalness: 0.2, envMapIntensity: 0.5 }),
    engine: new T.MeshStandardMaterial({ color: 0x4a4744, roughness: 0.35, metalness: 0.85, side: T.DoubleSide }),
    niobium: new T.MeshStandardMaterial({ color: 0x6b5a4a, roughness: 0.3, metalness: 0.9, side: T.DoubleSide }),
    steel: new T.MeshStandardMaterial({ color: 0xc9cdd2, roughness: 0.28, metalness: 0.92, envMapIntensity: 1.0 }),
    tile: new T.MeshStandardMaterial({ color: 0x121315, roughness: 0.85, metalness: 0.1 }),
    alu: new T.MeshStandardMaterial({ color: 0xd8dbe0, roughness: 0.35, metalness: 0.55 }),
    concrete: new T.MeshStandardMaterial({ color: 0x9a9893, roughness: 0.95 }),
    darkConcrete: new T.MeshStandardMaterial({ color: 0x5b5a57, roughness: 0.95 }),
    paint: new T.MeshStandardMaterial({ color: 0xf5f3e8, roughness: 0.8 }),
    deck: new T.MeshStandardMaterial({ color: 0x3e4247, roughness: 0.85, metalness: 0.3 }),
    sat: new T.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.4, metalness: 0.7 }),
    solar: new T.MeshStandardMaterial({ color: 0x14254a, roughness: 0.25, metalness: 0.6, emissive: 0x050a18, side: T.DoubleSide }),
  };

  function latticeTexture(rep) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'); g.clearRect(0, 0, 128, 128);
    g.strokeStyle = '#d8d8d8'; g.lineWidth = 9;
    g.strokeRect(4, 4, 120, 120);
    g.lineWidth = 6; g.beginPath(); g.moveTo(0, 0); g.lineTo(128, 128); g.moveTo(128, 0); g.lineTo(0, 128); g.stroke();
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.colorSpace = T.SRGBColorSpace;
    return t;
  }
  function gridFinTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); g.fillStyle = '#2a2a2a'; g.fillRect(0, 0, 64, 64);
    g.clearRect(6, 6, 52, 52); g.strokeStyle = '#3a3a3a'; g.lineWidth = 3;
    for (let i = 0; i < 64; i += 9) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.moveTo(i, 64); g.lineTo(i + 64, 0); g.moveTo(i - 64, 0); g.lineTo(i, 64); g.moveTo(i - 64, 64); g.lineTo(i, 0); g.stroke(); }
    return new T.CanvasTexture(c);
  }
  function sootTexture(level) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 512;
    const g = c.getContext('2d'); g.fillStyle = '#f1f1ee'; g.fillRect(0, 0, 64, 512);
    for (let i = 0; i < 140 * level; i++) {
      const x = Math.random() * 64, y = Math.random() * 512, h = 20 + Math.random() * 200;
      const gr = g.createLinearGradient(0, y, 0, y + h);
      const a = (0.08 + Math.random() * 0.18) * Math.min(1, level);
      gr.addColorStop(0, 'rgba(40,36,32,0)'); gr.addColorStop(0.5, `rgba(40,36,32,${a})`); gr.addColorStop(1, 'rgba(40,36,32,0)');
      g.fillStyle = gr; g.fillRect(x, y, 1 + Math.random() * 5, h);
    }
    const gb = g.createLinearGradient(0, 512, 0, 300); gb.addColorStop(0, `rgba(30,26,22,${0.55 * Math.min(1, level)})`); gb.addColorStop(1, 'rgba(30,26,22,0)');
    g.fillStyle = gb; g.fillRect(0, 300, 64, 212);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  const latMat = new T.MeshStandardMaterial({ map: latticeTexture([1, 12]), alphaTest: 0.5, side: T.DoubleSide, color: 0xb9bcc0, roughness: 0.7, metalness: 0.4 });
  const finMat = new T.MeshStandardMaterial({ map: gridFinTexture(), alphaTest: 0.4, side: T.DoubleSide, color: 0x555555, roughness: 0.5, metalness: 0.7 });

  function box(w, h, d, mat, x, y, z) { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = m.receiveShadow = true; return m; }
  function cyl(rt, rb, h, mat, y, seg, open) { const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 32, 1, !!open), mat); m.position.y = y; m.castShadow = m.receiveShadow = true; return m; }

  function buildSites() {
    const capG = capGeometry(160000, 130, 180, siteColor);
    siteCap = new T.Mesh(capG, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
    siteCap.receiveShadow = true;
    scene.add(siteCap);
    shipCap = new T.Mesh(capGeometry(90000, 80, 120, oceanColor), new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.1 }));
    shipCap.visible = false; shipCap.receiveShadow = true;
    scene.add(shipCap);

    // --- Falcon rampası (SLC-40 benzeri) ---
    falconSite = new T.Group();
    falconSite.add(box(70, 1.2, 70, mats.concrete, 0, -0.5, 0));
    falconSite.add(box(14, 1.25, 40, mats.darkConcrete, 0, -0.58, -24));
    const tw = new T.Group();
    const towerMesh = new T.Mesh(new T.BoxGeometry(7, 78, 7), latMat); towerMesh.position.y = 39; towerMesh.castShadow = true;
    tw.add(towerMesh);
    for (let y = 20; y <= 70; y += 25) tw.add(box(7.4, 0.6, 7.4, mats.darkConcrete, 0, y, 0));
    tw.add(box(5, 1, 1, mats.darkConcrete, 4.5, 62, 0));
    tw.position.set(-11, 0, 0);
    falconSite.add(tw);
    for (let i = 0; i < 4; i++) { const p = box(1.8, 30, 1.8, mats.alu, (i % 2 ? 20 : -20), 15, (i < 2 ? 22 : -22)); falconSite.add(p); } // paratoner direkleri
    // binalar
    const bld = [[-1800, 160, 120, 140, -400], [-900, 40, 60, 25, 300], [-2400, 30, 80, 60, 900], [-600, 18, 40, 30, -700]];
    for (const b of bld) falconSite.add(box(b[2], b[1], b[3], mats.alu, b[0], b[1] / 2, b[4]));
    scene.add(falconSite);
    // iniş pistleri
    for (const d of [1100, 1400, 1700]) {
      const g = new T.Group();
      const disk = new T.Mesh(new T.CylinderGeometry(45, 45, 0.6, 48), mats.concrete); disk.position.y = -0.25; disk.receiveShadow = true; g.add(disk);
      const ring = new T.Mesh(new T.RingGeometry(26, 29, 48), mats.paint); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.07; g.add(ring);
      const bar1 = new T.Mesh(new T.PlaneGeometry(3, 22), mats.paint); bar1.rotation.x = -Math.PI / 2; bar1.position.y = 0.08; g.add(bar1);
      const bar2 = bar1.clone(); bar2.rotation.z = Math.PI / 2; g.add(bar2);
      g.userData.d = d; lzPads.push(g); scene.add(g);
    }
    // --- Starship kulesi (Mechazilla) ---
    starSite = new T.Group();
    starSite.add(box(120, 1.2, 120, mats.concrete, 0, -0.5, 0));
    // fırlatma masası
    const olm = new T.Group();
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; olm.add(box(2.2, 16, 2.2, mats.alu, Math.cos(a) * 8.5, 8, Math.sin(a) * 8.5)); }
    const table = new T.Mesh(new T.TorusGeometry(7.6, 1.6, 12, 40), mats.alu); table.rotation.x = Math.PI / 2; table.position.y = 18.5; table.castShadow = true; olm.add(table);
    olm.add(cyl(9.4, 9.4, 1.4, mats.darkConcrete, 19.3, 40, true));
    starSite.add(olm);
    const tower = new T.Mesh(new T.BoxGeometry(12, 146, 12), new T.MeshStandardMaterial({ map: latticeTexture([2, 22]), alphaTest: 0.5, side: T.DoubleSide, color: 0x9da2a8, roughness: 0.6, metalness: 0.5 }));
    tower.position.set(-20, 73, 0); tower.castShadow = true; starSite.add(tower);
    starSite.add(box(13, 6, 13, mats.alu, -20, 148, 0));
    // kollar
    const armH = 98;
    const carriage = box(14, 8, 14, mats.alu, -20, armH, 0); starSite.add(carriage);
    const arms = [];
    for (const side of [-1, 1]) {
      const pivot = new T.Group(); pivot.position.set(-14, armH, side * 5.6);
      const arm = box(26, 3.2, 1.6, new T.MeshStandardMaterial({ color: 0x8e949b, roughness: 0.5, metalness: 0.6 }), 13, 0, 0);
      pivot.add(arm);
      const pad = box(4, 1.2, 1.2, mats.black, 14, 1.6, -side * 1.0); pivot.add(pad);
      pivot.userData.side = side;
      starSite.add(pivot); arms.push(pivot);
    }
    towerArms = { arms, open: 1, target: 1 };
    scene.add(starSite);
    // drone gemi
    droneShip = new T.Group();
    droneShip.add(box(91, 5, 52, mats.deck, 0, 0.5, 0));
    const mark = new T.Mesh(new T.RingGeometry(18, 21, 48), mats.paint); mark.rotation.x = -Math.PI / 2; mark.position.y = 3.05; droneShip.add(mark);
    for (const z of [-26, 26]) droneShip.add(box(91, 4, 1.2, mats.alu, 0, 4.5, z));
    for (const x of [-38, 38]) for (const z of [-20, 20]) droneShip.add(box(8, 6, 8, mats.alu, x, 6, z));
    droneShip.visible = false;
    scene.add(droneShip);
  }

  function placeSurface(obj, d, h) {
    const p = surfacePoint(d, h);
    placeAt(obj, p[0], p[1], 0);
    obj.rotation.set(0, 0, p[2] - Math.PI / 2);
  }

  /* ================= EFEKTLER: PARÇACIKLAR ================= */
  class Particles {
    constructor(max, additive) {
      this.max = max; this.i = 0;
      this.p = new Float64Array(max * 3); this.v = new Float32Array(max * 3);
      this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
      this.s0 = new Float32Array(max); this.s1 = new Float32Array(max);
      this.c = new Float32Array(max * 8); this.drag = new Float32Array(max); this.grav = new Float32Array(max);
      const g = new T.BufferGeometry();
      this.pos = new Float32Array(max * 3); this.size = new Float32Array(max); this.col = new Float32Array(max * 4);
      g.setAttribute('position', new T.BufferAttribute(this.pos, 3).setUsage(T.DynamicDrawUsage));
      g.setAttribute('size', new T.BufferAttribute(this.size, 1).setUsage(T.DynamicDrawUsage));
      g.setAttribute('color', new T.BufferAttribute(this.col, 4).setUsage(T.DynamicDrawUsage));
      this.geo = g;
      this.mat = new T.ShaderMaterial({
        uniforms: { scale: { value: innerHeight / (2 * Math.tan(55 * Math.PI / 360)) } },
        vertexShader: `#include <common>
          #include <logdepthbuf_pars_vertex>
          attribute float size; attribute vec4 color; varying vec4 vC; uniform float scale;
          void main(){ vC = color; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv;
            gl_PointSize = size > 0.0 ? clamp(size*scale/max(0.1,-mv.z), 1.0, 1500.0) : 0.0;
            #include <logdepthbuf_vertex>
          }`,
        fragmentShader: `#include <common>
          #include <logdepthbuf_pars_fragment>
          varying vec4 vC;
          void main(){ vec2 c = gl_PointCoord-0.5; float d = length(c)*2.0; if(d>1.0) discard;
            float a = (1.0-d*d); a *= a;
            ${additive ? 'gl_FragColor = vec4(vC.rgb*vC.a*a, 1.0);' : 'gl_FragColor = vec4(vC.rgb, vC.a*a);'}
            #include <logdepthbuf_fragment>
          }`,
        transparent: true, depthWrite: false,
        blending: additive ? T.AdditiveBlending : T.NormalBlending,
      });
      this.pts = new T.Points(g, this.mat); this.pts.frustumCulled = false;
      this.pts.renderOrder = additive ? 3 : 2;
      scene.add(this.pts);
    }
    spawn(px, py, pz, vx, vy, vz, life, s0, s1, c0, c1, a0, a1, drag, grav) {
      const i = this.i; this.i = (this.i + 1) % this.max;
      this.p[i * 3] = px; this.p[i * 3 + 1] = py; this.p[i * 3 + 2] = pz;
      this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
      this.life[i] = life; this.maxLife[i] = life; this.s0[i] = s0; this.s1[i] = s1;
      const c = this.c; c[i * 8] = c0[0]; c[i * 8 + 1] = c0[1]; c[i * 8 + 2] = c0[2]; c[i * 8 + 3] = a0;
      c[i * 8 + 4] = c1[0]; c[i * 8 + 5] = c1[1]; c[i * 8 + 6] = c1[2]; c[i * 8 + 7] = a1;
      this.drag[i] = drag || 0; this.grav[i] = grav || 0;
    }
    update(dt) {
      const p = this.p, v = this.v;
      const ux = F.x, uy = F.y, uz = F.z, ul = Math.hypot(ux, uy, uz) || 1;
      const gx = -ux / ul, gy = -uy / ul, gz = -uz / ul;
      for (let i = 0; i < this.max; i++) {
        if (this.life[i] <= 0) { this.size[i] = 0; continue; }
        this.life[i] -= dt;
        const k = Math.exp(-this.drag[i] * dt), g = this.grav[i] * dt;
        v[i * 3] = v[i * 3] * k + gx * g; v[i * 3 + 1] = v[i * 3 + 1] * k + gy * g; v[i * 3 + 2] = v[i * 3 + 2] * k + gz * g;
        p[i * 3] += v[i * 3] * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt;
        const t = 1 - Math.max(0, this.life[i]) / this.maxLife[i];
        this.pos[i * 3] = p[i * 3] - F.x; this.pos[i * 3 + 1] = p[i * 3 + 1] - F.y; this.pos[i * 3 + 2] = p[i * 3 + 2] - F.z;
        this.size[i] = this.life[i] > 0 ? lerp(this.s0[i], this.s1[i], Math.sqrt(t)) : 0;
        const c = this.c;
        this.col[i * 4] = lerp(c[i * 8], c[i * 8 + 4], t); this.col[i * 4 + 1] = lerp(c[i * 8 + 1], c[i * 8 + 5], t);
        this.col[i * 4 + 2] = lerp(c[i * 8 + 2], c[i * 8 + 6], t); this.col[i * 4 + 3] = lerp(c[i * 8 + 3], c[i * 8 + 7], t);
      }
      this.geo.attributes.position.needsUpdate = true; this.geo.attributes.size.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
    }
    clear() { this.life.fill(0); }
  }
  let fireP, smokeP;

  /* ================= MOTOR ALEVİ ================= */
  const plumeGeo = (() => { const g = new T.CylinderGeometry(1, 2.4, 1, 28, 12, true); g.translate(0, -0.5, 0); return g; })();
  function plumeMaterial(core, outer, alpha) {
    return new T.ShaderMaterial({
      uniforms: { uCore: { value: new T.Color(core) }, uOuter: { value: new T.Color(outer) }, uTime: { value: 0 }, uI: { value: 1 }, uVac: { value: 0 }, uA: { value: alpha } },
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec2 vUv; varying float vF;
        void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.0);
          vec3 n = normalize(normalMatrix*normal); vF = pow(abs(dot(n, normalize(-mv.xyz))), 1.4);
          gl_Position = projectionMatrix*mv;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform vec3 uCore; uniform vec3 uOuter; uniform float uTime; uniform float uI; uniform float uVac; uniform float uA;
        varying vec2 vUv; varying float vF;
        void main(){ float t = vUv.y;
          float fl = 0.82 + 0.18*sin(uTime*71.0 + t*37.0 + vUv.x*20.0)*sin(uTime*43.0 - t*19.0);
          float a = pow(t, mix(1.3, 2.6, uVac)) * vF * uI * fl * uA;
          float dia = (1.0-uVac) * 0.5 * pow(max(0.0, sin(t*34.0 - uTime*4.0)), 10.0) * smoothstep(0.35, 0.9, t);
          vec3 col = mix(uOuter, uCore, pow(t, 2.5));
          gl_FragColor = vec4(col*(a + dia*vF*uI), 1.0);
          #include <logdepthbuf_fragment>
        }`,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    });
  }
  function makePlume(type, r, len) {
    const g = new T.Group();
    const isR = type === 'raptor';
    const outer = new T.Mesh(plumeGeo, plumeMaterial(isR ? 0xc9b8ff : 0xfff1c0, isR ? 0x6a4cff : 0xff7a1a, isR ? 0.75 : 0.9));
    const core = new T.Mesh(plumeGeo, plumeMaterial(0xffffff, isR ? 0xa98cff : 0xffc060, 1.0));
    outer.renderOrder = core.renderOrder = 4;
    g.add(outer, core);
    g.userData = { r, len, outer, core, isR };
    g.visible = false;
    return g;
  }
  function updatePlume(pl, thr, p, time) {
    if (!pl) return;
    if (thr <= 0.01) { pl.visible = false; return; }
    pl.visible = true;
    const u = pl.userData, vac = 1 - p;
    const L = u.len * (0.55 + 0.45 * thr) * (1 + 2.6 * vac);
    const W = u.r * (1 + 2.4 * vac * vac);
    u.outer.scale.set(W, L, W);
    u.core.scale.set(u.r * 0.55, L * 0.42, u.r * 0.55);
    for (const m of [u.outer, u.core]) { m.material.uniforms.uTime.value = time; m.material.uniforms.uI.value = clamp(0.4 + 0.6 * thr, 0, 1) * (1 - vac * 0.35); m.material.uniforms.uVac.value = vac; }
  }

  /* ================= ROKET MODELLERİ ================= */
  function cloneMat(m, list) { const c = m.clone(); list.push(c); return c; }
  function bells(g, mat, n, ringR, exitR, h, y) {
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      const b = new T.Mesh(new T.CylinderGeometry(exitR * 0.38, exitR, h, 18, 1, true), mat);
      b.position.set(Math.cos(a) * ringR, y + h / 2, Math.sin(a) * ringR); b.castShadow = true;
      g.add(b);
    }
  }
  // Falcon tipi 1. kademe (F9 / FH çekirdek / FH yan / F1)
  function buildFalconBooster(def, opts) {
    const g = new T.Group(), ml = [];
    const r = def.dia / 2, L = def.len, f1 = def.engines === 1;
    const reuse = opts.flights || 0;
    const body = cloneMat(mats.white, ml);
    if (f1) { body.color.set(0xdfe2e6); body.metalness = 0.35; }
    if (reuse > 0) { body.map = sootTexture(Math.min(1.4, 0.4 + reuse * 0.35)); }
    const blk = cloneMat(mats.black, ml), eng = cloneMat(mats.engine, ml);
    const interH = opts.nose ? 0 : (f1 ? 1.2 : 6.7);
    const bodyH = L - interH - (opts.nose ? 6.5 : 0) - 1.4;
    g.add(cyl(r, r, bodyH, body, 1.4 + bodyH / 2, 40));
    g.add(cyl(r * 0.98, r * 0.98, 0.6, blk, 1.1, 32)); // oktaweb
    if (opts.nose) {
      const nose = new T.Mesh(new T.ConeGeometry(r, 6.5, 40), cloneMat(mats.white, ml)); nose.position.y = L - 3.25; nose.castShadow = true; g.add(nose);
    } else g.add(cyl(r, r, interH, blk, L - interH / 2, 40));
    if (f1) bells(g, eng, 1, 0, 0.55, 1.2, 0);
    else { bells(g, eng, 8, r * 0.66, 0.42, 1.3, 0); bells(g, eng, 1, 0, 0.42, 1.3, 0); }
    // ızgara kanatçıklar
    const fins = [], legs = [];
    if (def.recoverable) {
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * Math.PI * 2 + Math.PI / 4;
        const pv = new T.Group(); pv.position.set(Math.cos(a) * r, L - (opts.nose ? 8.5 : 1.8), Math.sin(a) * r); pv.rotation.y = -a;
        const fin = new T.Mesh(new T.BoxGeometry(0.15, 1.5, 1.3), finMat); fin.position.y = 0.75; fin.castShadow = true;
        pv.add(fin); g.add(pv); fins.push(pv);
      }
      const legMat = cloneMat(mats.black, ml);
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * Math.PI * 2;
        const pv = new T.Group(); pv.position.set(Math.cos(a) * (r + 0.1), 2.6, Math.sin(a) * (r + 0.1)); pv.rotation.y = -a;
        const leg = new T.Mesh(new T.BoxGeometry(0.35, 9.4, 0.55), legMat); leg.position.y = 4.7; leg.castShadow = true;
        pv.add(leg);
        const foot = box(0.9, 0.3, 0.9, mats.engine, 0, 9.4, 0); pv.add(foot);
        g.add(pv); legs.push(pv);
      }
    }
    return { g, mats: ml, fins, legs, plume: makePlume('merlin', f1 ? 0.55 : r * 0.92, f1 ? 12 : 26), len: L, r, bodyMat: body };
  }
  function buildFalconUpper(def, isF1) {
    const g = new T.Group(), ml = [];
    const r = def.dia / 2, L = def.len;
    const body = cloneMat(isF1 ? mats.alu : mats.white, ml);
    g.add(cyl(r, r, L, body, L / 2, 40));
    const nz = cloneMat(mats.niobium, ml);
    const bell = new T.Mesh(new T.CylinderGeometry(0.35, isF1 ? 0.4 : 1.55, isF1 ? 0.9 : 3.0, 28, 1, true), nz);
    bell.position.y = isF1 ? -0.45 : -1.5; g.add(bell);
    return { g, mats: ml, plume: makePlume('merlin', isF1 ? 0.4 : 1.5, isF1 ? 6 : 14), len: L, r, plumeY: isF1 ? -0.9 : -3.0 };
  }
  function buildFairing(fr, flen, ml) {
    const halves = [];
    const cylL = flen * 0.5;
    const pts = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new T.Vector2(fr * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - 0.06 * t), cylL + t * (flen - cylL))); }
    for (const side of [0, 1]) {
      const hg = new T.Group();
      const m = cloneMat(mats.white, ml);
      const c = new T.Mesh(new T.CylinderGeometry(fr, fr * 0.8, cylL, 32, 1, true, side * Math.PI, Math.PI), m);
      c.position.y = cylL / 2; c.material.side = T.DoubleSide; c.castShadow = true; hg.add(c);
      const o = new T.Mesh(new T.LatheGeometry(pts, 32, side * Math.PI, Math.PI), m); o.castShadow = true; hg.add(o);
      halves.push(hg);
    }
    return halves;
  }
  function buildPayloadStack(n, w, h) {
    const g = new T.Group();
    const k = Math.min(24, n);
    for (let i = 0; i < k; i++) { const b = box(w, h / k * 0.8, w * 0.5, mats.sat, 0, (i + 0.5) * h / k, 0); g.add(b); }
    return g;
  }
  function buildSuperHeavy(def, opts) {
    const g = new T.Group(), ml = [];
    const r = 4.5, L = def.len;
    const st = cloneMat(mats.steel, ml);
    if ((opts.flights || 0) > 0) st.color.set(0xb7b2aa);
    g.add(cyl(r, r, L - 4.3, st, 2.5 + (L - 4.3) / 2, 48));
    const ring = cloneMat(mats.black, ml);
    g.add(cyl(r, r, 1.8, ring, L - 0.9, 48));
    const ventMat = cloneMat(mats.engine, ml);
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const vb = box(0.9, 1.2, 0.2, ventMat, Math.cos(a) * (r + 0.05), L - 0.9, Math.sin(a) * (r + 0.05)); vb.rotation.y = -a + Math.PI / 2; g.add(vb); }
    g.add(cyl(r * 0.98, r, 2.5, cloneMat(mats.black, ml), 1.25, 40));
    const eng = cloneMat(mats.engine, ml);
    bells(g, eng, 3, 1.1, 0.65, 1.6, -0.6); bells(g, eng, 10, 2.5, 0.62, 1.6, -0.6); bells(g, eng, 20, 3.85, 0.55, 1.5, -0.5);
    const fins = [];
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + Math.PI / 4;
      const pv = new T.Group(); pv.position.set(Math.cos(a) * r, L - 6, Math.sin(a) * r); pv.rotation.y = -a;
      const fin = new T.Mesh(new T.BoxGeometry(4.5, 0.5, 3.5), finMat); fin.position.x = 2.2; fin.castShadow = true;
      pv.add(fin); g.add(pv);
    }
    // şaseler
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; const ch = box(0.4, L - 12, 0.6, st, Math.cos(a) * (r + 0.15), L / 2, Math.sin(a) * (r + 0.15)); ch.rotation.y = -a; g.add(ch); }
    return { g, mats: ml, fins, legs: [], plume: makePlume('raptor', 4.2, 55), len: L, r, plumeY: -0.6 };
  }
  function buildShip(def) {
    const g = new T.Group(), ml = [];
    const r = 4.5, L = def.len;
    const st = cloneMat(mats.steel, ml), tile = cloneMat(mats.tile, ml);
    g.add(cyl(r, r, 38, st, 2 + 19, 48));
    const tiles = new T.Mesh(new T.CylinderGeometry(r + 0.04, r + 0.04, 38, 48, 1, true, Math.PI * 0.5, Math.PI), tile);
    tiles.position.y = 21; g.add(tiles);
    const pts = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new T.Vector2(r * Math.cos(t * Math.PI / 2) ** 0.8 + 0.001, 40 + t * 12)); }
    const nose = new T.Mesh(new T.LatheGeometry(pts, 48), st); nose.castShadow = true; g.add(nose);
    const ntile = new T.Mesh(new T.LatheGeometry(pts.map(p => new T.Vector2(p.x + 0.04, p.y)), 48, Math.PI * 0.5, Math.PI), tile); g.add(ntile);
    g.add(cyl(r, r, 2, cloneMat(mats.black, ml), 1, 40));
    // kanatçıklar
    for (const s of [-1, 1]) {
      const af = box(4.2, 9, 0.5, tile, s * (r + 2), 7, 0); g.add(af);
      const ff = box(2.6, 6, 0.4, tile, s * (r + 1.2) * Math.cos(0.25), 45, 0); ff.rotation.z = -s * 0.22; g.add(ff);
    }
    // PEZ kapısı
    g.add(box(0.2, 3, 6, cloneMat(mats.black, ml), r + 0.02, 33, 0));
    const eng = cloneMat(mats.engine, ml), nz = cloneMat(mats.niobium, ml);
    bells(g, eng, 3, 1.0, 0.65, 1.5, -1.2);
    bells(g, nz, 3, 2.8, 1.15, 2.6, -2.3);
    return { g, mats: ml, fins: [], legs: [], plume: makePlume('raptor', 3.3, 30), len: L, r, plumeY: -1.5 };
  }

  /* ================= GÖREV GÖRSELLERİ ================= */
  let mission = null, vis = new Map(), debris = [], sats3d = [], camFocusId = null;
  let fairingHalves = [], fairingAll = [], payloadMesh = null;
  const trails = new Map();

  function buildMissionVisuals(m) {
    const d = m.def, st = d.stages;
    for (const p of m.stack.parts) {
      if (p.role === 'booster') {
        p.vis = d.key === 'ss' ? buildSuperHeavy(st[0], { flights: state.flights.ss }) : buildFalconBooster(st[0], { flights: state.cores[d.key] > 0 ? state.flights[d.key] : 0 });
      } else if (p.role === 'upper') {
        p.vis = d.key === 'ss' ? buildShip(st[1]) : buildFalconUpper(st[1], d.key === 'f1');
      } else if (p.role === 'sideL' || p.role === 'sideR') {
        p.vis = buildFalconBooster(d.sides, { nose: true, flights: state.cores.fh > 1 ? state.flights.fh : 0 });
      }
    }
    fairingHalves = []; payloadMesh = null;
    if (d.fairing) {
      const ml = [];
      const fr = d.key === 'f1' ? 0.75 : 2.6;
      fairingHalves = buildFairing(fr, d.payloadLen, ml); fairingAll = fairingHalves.slice();
      payloadMesh = buildPayloadStack(m.satsPlanned, d.key === 'f1' ? 0.9 : 2.6, d.payloadLen * 0.55);
    }
  }
  function craftGroup(c) {
    let v = vis.get(c.id);
    if (v) return v;
    const g = new T.Group(); scene.add(g);
    v = { g, craft: c, parts: [], fairing: null, heatMats: [] };
    if (c.type === 'fairing') {
      const h = c.side < 0 ? fairingAll[1] : fairingAll[0];
      if (h) { g.add(h); h.position.set(0, 0, 0); v.fairing = h; }
    }
    vis.set(c.id, v);
    return v;
  }
  function layoutCraft(v) {
    const c = v.craft, d = mission.def;
    // parçaları gruba bağla
    let y = 0;
    const booster = c.parts.find(p => p.role === 'booster');
    const upper = c.parts.find(p => p.role === 'upper');
    const placed = [];
    if (booster) { attach(v, booster.vis, 0, 0); y = booster.def.len; placed.push(booster); }
    for (const p of c.parts) {
      if (p.role === 'sideL' || p.role === 'sideR') {
        const off = c.type === 'side' ? 0 : (p.role === 'sideL' ? -1 : 1) * (d.sides.dia + 0.45);
        attach(v, p.vis, off, 0); placed.push(p);
      }
    }
    if (upper) {
      attach(v, upper.vis, 0, y);
      const top = y + upper.def.len;
      if (payloadMesh && !mission.satsDeployed) attach(v, { g: payloadMesh }, 0, top);
      if (!mission.fairingDone) {
        for (const h of fairingHalves) attach(v, { g: h }, 0, top);
      }
    }
    v.layoutKey = c.parts.map(p => p.role).join(',') + (mission.fairingDone ? 'F' : '') + (mission.satsDeployed ? 'D' : '');
  }
  function attach(v, pv, x, y) {
    if (!pv || !pv.g) return;
    if (pv.g.parent !== v.g) v.g.add(pv.g);
    pv.g.position.set(x, y, 0);
    if (pv.plume && pv.plume.parent !== pv.g) { pv.g.add(pv.plume); pv.plume.position.y = pv.plumeY || 0; }
  }

  function syncVisuals(dtReal, time) {
    const m = mission; if (!m) return;
    const ids = new Set();
    for (const c of m.crafts) {
      ids.add(c.id);
      const v = craftGroup(c);
      const key = c.parts.map(p => p.role).join(',') + (m.fairingDone ? 'F' : '') + (m.satsDeployed ? 'D' : '');
      if (v.layoutKey !== key) layoutCraft(v);
      v.g.visible = c.alive;
      if (!c.alive) continue;
      const e = toEF(c.x, c.y);
      v.ef = e;
      placeAt(v.g, e[0], e[1], 0);
      let dir = c.dir + efRot();
      v.g.rotation.set(0, 0, dir - Math.PI / 2);
      // yakalama sonrası oturma animasyonu
      if (c.caught) {
        v.settle = Math.min(1, (v.settle || 0) + dtReal * 0.6);
        const s = v.settle;
        v.g.position.y += 0; // eksen yönünde küçük çökme
        const shake = s < 0.7 ? Math.sin(time * 40) * 0.08 * (1 - s) : 0;
        v.g.translateY(-1.6 * Math.min(1, s * 1.6)); v.g.translateX(shake);
      }
      const h = c.alt();
      const pr = S.pres(h);
      for (const p of c.parts) {
        const pv = p.vis; if (!pv) continue;
        const thr = p.firing && p.prop > 0 && !c.landed && !c.caught ? c.throttle * p.engFrac * p.cap : 0;
        const eff = p.engFrac < 1 ? Math.sqrt(p.engFrac) : 1;
        updatePlume(pv.plume, thr > 0 ? Math.max(0.25, thr) : 0, pr, time);
        if (pv.plume && thr > 0) pv.plume.scale.set(eff, 1, eff);
        // ızgara kanatçık & bacak animasyonları
        if (pv.fins && pv.fins.length) {
          const tgt = c.finsOut || c.rec ? 1 : 0;
          pv.finT = lerp(pv.finT || 0, tgt, Math.min(1, dtReal * 2.5));
          for (const f of pv.fins) f.rotation.z = -pv.finT * Math.PI / 2;
        }
        if (pv.legs && pv.legs.length) {
          const tgt = c.legsOut ? 1 : 0;
          pv.legT = lerp(pv.legT || 0, tgt, Math.min(1, dtReal * 1.4));
          for (const l of pv.legs) l.rotation.z = -pv.legT * 108 * Math.PI / 180;
        }
        // ısınma parlaması
        const heat = clamp((c.heat - 4e7) / 6e8, 0, 1);
        for (const mt of pv.mats) { if (!mt.emissive) continue; mt.emissive.setRGB(1.0, 0.32, 0.08); mt.emissiveIntensity = heat * 2.2; }
        if (thr > 0) emitExhaust(c, p, v, thr, h, dtReal);
      }
      if (c.heat > 6e7 && c.alive) emitPlasma(c, v, dtReal);
      if (v.fairing) { /* burun konisi parçası */ }
      // iz kaydı
      let tr = trails.get(c.id);
      if (!tr) { tr = { pts: [], last: -1e9, name: c.name, type: c.type }; trails.set(c.id, tr); }
      if (m.t - tr.last > 1) { tr.last = m.t; tr.pts.push([c.downrange(), Math.max(0, h), e[0], e[1]]); if (tr.pts.length > 4000) tr.pts.shift(); }
    }
    for (const [id, v] of vis) {
      if (!ids.has(id)) { scene.remove(v.g); vis.delete(id); }
    }
    // yakalama kolları
    if (towerArms && m.key === 'ss') {
      const b = m.crafts.find(c => c.rec && c.rec.kind === 'catch');
      let tgt = 1;
      if (b && (b.caught)) tgt = 0;
      else if (b && b.state === 'final' && b.alt() < 3000) tgt = 1.25;
      towerArms.open = lerp(towerArms.open, tgt, Math.min(1, dtReal * (tgt === 0 ? 3.0 : 0.8)));
      for (const a of towerArms.arms) a.rotation.y = a.userData.side * towerArms.open * 0.6;
    }
  }

  function axisOf(v) { const a = v.g.rotation.z + Math.PI / 2; return [Math.cos(a), Math.sin(a)]; }
  function emitExhaust(c, p, v, thr, h, dt) {
    const ax = axisOf(v), e = v.ef;
    const rr = S.rho(h) / 1.225;
    const big = mission.key === 'ss' ? 2.6 : (p.def.engines === 1 && p.role === 'booster' ? 0.6 : 1);
    const isUpper = p.role === 'upper';
    // alev parçacıkları
    const nf = Math.min(6, Math.ceil(thr * 4 * dt * 60));
    const ox = (p.vis.g.position.x || 0);
    const wx = e[0] + Math.cos(v.g.rotation.z) * ox, wy = e[1] + Math.sin(v.g.rotation.z) * ox;
    const off = (p.vis.plumeY ? -p.vis.plumeY : 0) + 0.5;
    const bx = wx - ax[0] * off, by = wy - ax[1] * off;
    if (!isUpper || h < 90000) {
      for (let i = 0; i < nf; i++) {
        const sp = rnd(60, 160);
        fireP.spawn(bx + rnd(-1, 1) * big, by + rnd(-1, 1) * big, rnd(-1, 1) * big,
          -ax[0] * sp + rnd(-8, 8), -ax[1] * sp + rnd(-8, 8), rnd(-8, 8),
          rnd(0.15, 0.4), 3 * big, 9 * big, [1, 0.85, 0.5], [1, 0.3, 0.05], 0.8, 0, 2, 0);
      }
    }
    // duman izi (atmosferde)
    if (rr > 0.002) {
      const ns = Math.min(5, Math.ceil(thr * rr * 3 * dt * 60 + Math.random() * 0.6));
      for (let i = 0; i < ns; i++) {
        const sp = rnd(30, 90), k = Math.random();
        const sx = bx - ax[0] * k * 25 * big, sy = by - ax[1] * k * 25 * big;
        const shade = rnd(0.72, 0.92);
        smokeP.spawn(sx + rnd(-2, 2) * big, sy + rnd(-2, 2) * big, rnd(-2, 2) * big,
          -ax[0] * sp + rnd(-6, 6), -ax[1] * sp + rnd(-6, 6), rnd(-6, 6),
          rnd(8, 22) * (0.5 + rr * 0.5), 5 * big, rnd(40, 75) * big * (1.3 - rr * 0.4), [shade, shade, shade * 1.02], [shade * 0.9, shade * 0.9, shade * 0.95], 0.55 * Math.min(1, rr * 2), 0, 0.9, 0);
      }
    }
    // kalkış buharı
    if (h < 160 && c.type === 'stack') {
      const n = Math.ceil(dt * 60 * 4 * thr);
      const surf = surfacePoint(0, 1), up = [Math.cos(surf[2]), Math.sin(surf[2])], east = [up[1], -up[0]];
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2, sp = rnd(25, 70) * big;
        const dx = Math.cos(ang), dz = Math.sin(ang);
        smokeP.spawn(surf[0] + east[0] * dx * 8 * big, surf[1] + east[1] * dx * 8 * big, dz * 8 * big,
          east[0] * dx * sp + up[0] * rnd(2, 12), east[1] * dx * sp + up[1] * rnd(2, 12), dz * sp,
          rnd(7, 14), 10 * big, rnd(50, 90) * big, [0.95, 0.95, 0.95], [0.82, 0.82, 0.84], 0.75, 0, 0.35, 0);
      }
    }
    // iniş tozu / buharı
    if (c.rec && h < 120 && thr > 0) {
      const surfH = c.rec.kind === 'catch' ? 20 : (c.rec.kind === 'asds' ? 3 : 0);
      const sp0 = surfacePoint(c.downrange(), surfH), up = [Math.cos(sp0[2]), Math.sin(sp0[2])], east = [up[1], -up[0]];
      const n = Math.ceil(dt * 60 * 3 * thr * (1 - h / 140));
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2, sp = rnd(30, 60) * big, dx = Math.cos(ang), dz = Math.sin(ang);
        smokeP.spawn(sp0[0], sp0[1], 0, east[0] * dx * sp + up[0] * rnd(3, 10), east[1] * dx * sp + up[1] * rnd(3, 10), dz * sp,
          rnd(4, 9), 8 * big, 45 * big, [0.85, 0.82, 0.76], [0.75, 0.72, 0.68], 0.6, 0, 0.5, 0);
      }
    }
  }
  function emitPlasma(c, v, dt) {
    const k = clamp((c.heat - 6e7) / 6e8, 0, 1);
    const av = c.airVel(); const ai = Math.hypot(av[0], av[1]) || 1;
    const a = efRot(), ca = Math.cos(a), sa = Math.sin(a);
    const fx = (av[0] * ca - av[1] * sa) / ai, fy = (av[0] * sa + av[1] * ca) / ai; // akış yönü (EF)
    const e = v.ef, ax = axisOf(v);
    // öndeki uç: hareket yönüne bakan uç
    const lead = (ax[0] * fx + ax[1] * fy) > 0 ? c.length : 0;
    const big = mission.key === 'ss' ? 2.5 : 1;
    const n = Math.ceil(k * 6 * dt * 60);
    for (let i = 0; i < n; i++) {
      const px = e[0] + ax[0] * lead + rnd(-2, 2) * big, py = e[1] + ax[1] * lead + rnd(-2, 2) * big;
      const sp = rnd(120, 380);
      fireP.spawn(px, py, rnd(-2, 2) * big, -fx * sp, -fy * sp, rnd(-15, 15), rnd(0.2, 0.6), 3 * big, 12 * big,
        [1, 0.6, 0.85], [1, 0.25, 0.05], 0.5 + 0.5 * k, 0, 1.5, 0);
    }
  }

  /* --- Patlama ve parçalanma --- */
  function explodeFX(c, why, reentry) {
    const v = vis.get(c.id);
    const e = v && v.ef ? v.ef : toEF(c.x, c.y);
    const ax = v ? axisOf(v) : [0, 1];
    const a = efRot(), ca = Math.cos(a), sa = Math.sin(a);
    // EF hızı ~ hava hızı (dönen çerçeve)
    const av = c.airVel(); const vx = av[0] * ca - av[1] * sa, vy = av[0] * sa + av[1] * ca;
    const big = mission.key === 'ss' ? 3 : (c.length < 20 ? 0.6 : 1.2);
    const h = c.alt();
    const inAir = S.rho(h) > 0.0005;
    const keep = reentry ? 0.85 : (h < 200 ? 0.0 : 0.25);
    const mid = [e[0] + ax[0] * c.length * 0.4, e[1] + ax[1] * c.length * 0.4];
    // ateş topu
    for (let i = 0; i < 160; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(rnd(-1, 1)), sp = rnd(10, 70) * big;
      const dx = Math.sin(ph) * Math.cos(th), dy = Math.sin(ph) * Math.sin(th), dz = Math.cos(ph);
      const L = rnd(-0.5, 0.5) * c.length;
      fireP.spawn(mid[0] + ax[0] * L, mid[1] + ax[1] * L, 0, vx * keep + dx * sp, vy * keep + dy * sp, dz * sp,
        rnd(0.8, 2.6), rnd(6, 14) * big, rnd(25, 55) * big, [1, 0.9, 0.6], [0.8, 0.15, 0.02], 1, 0, 1.6, 0);
    }
    // kıvılcımlar
    for (let i = 0; i < 120; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(rnd(-1, 1)), sp = rnd(60, 220) * big;
      fireP.spawn(mid[0], mid[1], 0, vx * keep + Math.sin(ph) * Math.cos(th) * sp, vy * keep + Math.sin(ph) * Math.sin(th) * sp, Math.cos(ph) * sp,
        rnd(0.8, 2.2), 1.2 * big, 0.6 * big, [1, 0.95, 0.7], [1, 0.4, 0.1], 1, 0, 0.6, 9.8);
    }
    // duman
    if (inAir) for (let i = 0; i < 120; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(rnd(-1, 1)), sp = rnd(5, 40) * big;
      const sh = rnd(0.08, 0.25);
      smokeP.spawn(mid[0] + rnd(-5, 5) * big, mid[1] + rnd(-5, 5) * big, rnd(-5, 5) * big,
        vx * keep * 0.5 + Math.sin(ph) * Math.cos(th) * sp, vy * keep * 0.5 + Math.sin(ph) * Math.sin(th) * sp + 3, Math.cos(ph) * sp,
        rnd(8, 26), rnd(15, 30) * big, rnd(70, 140) * big, [sh, sh * 0.95, sh * 0.9], [0.35, 0.34, 0.33], 0.85, 0, 0.5, -1.5);
    }
    // şok dalgası halkası
    for (let i = 0; i < 70; i++) {
      const th = i / 70 * Math.PI * 2, sp = 260 * big;
      smokeP.spawn(mid[0], mid[1], 0, Math.cos(th) * sp + vx * keep, Math.sin(th) * sp * 0.3 + vy * keep, Math.sin(th) * sp, 1.6, 8 * big, 30 * big, [1, 1, 1], [0.9, 0.9, 0.9], inAir ? 0.35 : 0.0, 0, 1.6, 0);
    }
    flashLight.userData = { e: mid, t: 0, max: 60 * big };
    // enkaz
    const n = mission.key === 'ss' ? 26 : 18;
    const srcMats = [];
    if (v) v.g.traverse(o => { if (o.isMesh && o.material && !o.material.isShaderMaterial) srcMats.push(o.material); });
    for (let i = 0; i < n; i++) {
      const s = rnd(0.6, 2.6) * big;
      const geo = Math.random() < 0.5 ? new T.BoxGeometry(s, s * rnd(0.5, 2.5), s * 0.3) : new T.CylinderGeometry(s * 0.6, s * 0.6, s * rnd(1, 3), 10, 1, true, 0, rnd(1, 3));
      const mat = (srcMats[Math.floor(Math.random() * srcMats.length)] || mats.white).clone();
      if (mat.side !== undefined) mat.side = T.DoubleSide;
      mat.emissive = new T.Color(1, 0.35, 0.1); mat.emissiveIntensity = reentry ? 2.5 : 1.2;
      const mesh = new T.Mesh(geo, mat); mesh.castShadow = true;
      scene.add(mesh);
      const L = rnd(0, 1) * c.length;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(rnd(-1, 1)), sp = rnd(20, 90) * (reentry ? 0.6 : 1);
      debris.push({
        mesh, p: [e[0] + ax[0] * L, e[1] + ax[1] * L, rnd(-2, 2)],
        v: [vx * keep + Math.sin(ph) * Math.cos(th) * sp, vy * keep + Math.sin(ph) * Math.sin(th) * sp, Math.cos(ph) * sp],
        w: [rnd(-4, 4), rnd(-4, 4), rnd(-4, 4)], life: 90, hot: reentry ? 1 : 0.6, rest: false, big,
      });
    }
    if (v) v.g.visible = false;
    shake = Math.max(shake, h < 2000 ? 1.4 : 0.6);
    audio.boom(h < 3000 ? 1 : 0.4);
  }
  function updateDebris(dt) {
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.life -= dt;
      if (d.life <= 0) { scene.remove(d.mesh); d.mesh.geometry.dispose(); debris.splice(i, 1); continue; }
      const r = Math.hypot(d.p[0], d.p[1], d.p[2]);
      const h = r - RE;
      if (!d.rest) {
        const g = 9.8, ux = d.p[0] / r, uy = d.p[1] / r, uz = d.p[2] / r;
        const sp = Math.hypot(d.v[0], d.v[1], d.v[2]);
        const kd = Math.min(0.9, S.rho(h) * sp * 0.004);
        for (let k = 0; k < 3; k++) d.v[k] -= d.v[k] * kd * dt;
        d.v[0] -= ux * g * dt; d.v[1] -= uy * g * dt; d.v[2] -= uz * g * dt;
        for (let k = 0; k < 3; k++) d.p[k] += d.v[k] * dt;
        d.mesh.rotation.x += d.w[0] * dt; d.mesh.rotation.y += d.w[1] * dt; d.mesh.rotation.z += d.w[2] * dt;
        const ground = groundHeightAt(d.p);
        if (h <= ground) {
          d.rest = true; d.v = [0, 0, 0];
          const s = (RE + ground) / r; d.p[0] *= s; d.p[1] *= s; d.p[2] *= s;
        }
        d.hot = Math.max(0, d.hot - dt * 0.12);
        if (d.hot > 0.2 && Math.random() < 0.5) fireP.spawn(d.p[0], d.p[1], d.p[2], 0, 0, 0, rnd(0.3, 0.8), 2 * d.big, 5 * d.big, [1, 0.6, 0.2], [0.6, 0.1, 0], d.hot, 0, 1, 0);
        if (S.rho(h) > 0.01 && Math.random() < 0.35) smokeP.spawn(d.p[0], d.p[1], d.p[2], 0, 0, 0, rnd(4, 9), 2 * d.big, 12 * d.big, [0.2, 0.2, 0.2], [0.4, 0.4, 0.4], 0.5, 0, 0.5, -1);
      } else if (Math.random() < 0.15 && d.life > 60) {
        smokeP.spawn(d.p[0], d.p[1], d.p[2], 0, 0, 0, rnd(6, 12), 3 * d.big, 25 * d.big, [0.15, 0.15, 0.15], [0.45, 0.45, 0.45], 0.5, 0, 0.3, -2);
      }
      d.mesh.material.emissiveIntensity = d.hot * 2.4;
      d.mesh.position.set(d.p[0] - F.x, d.p[1] - F.y, d.p[2] - F.z);
    }
  }
  function groundHeightAt(p) {
    if (!mission) return 0;
    const a = Math.atan2(p[1], p[0]);
    const dr = RE * S.wrapPi(PAD_ANG - a);
    for (const s of mission.structures) if (Math.abs(dr - s.d) < s.r && Math.abs(p[2]) < s.r) return s.top;
    if (mission.shipD !== undefined && Math.abs(dr - mission.shipD) < 45 && Math.abs(p[2]) < 26) return 3;
    return 0;
  }

  /* --- Uydu bırakma --- */
  function deploySatsFX(c) {
    const v = vis.get(c.id); if (!v) return;
    const n = Math.min(40, mission.satsPlanned);
    const isSS = mission.key === 'ss';
    const top = isSS ? 33 : c.length - mission.def.payloadLen * 0.6;
    for (let i = 0; i < n; i++) {
      const g = new T.Group();
      const body = box(2.6, 0.2, 1.3, mats.sat, 0, 0, 0); g.add(body);
      const panel = new T.Mesh(new T.PlaneGeometry(8, 2.4), mats.solar); panel.position.x = 5.4; panel.rotation.x = Math.PI / 2; g.add(panel);
      panel.scale.x = 0.05;
      g.position.set(isSS ? 4.6 : rnd(-1, 1), top + (isSS ? rnd(-2, 2) : i * 0.3), rnd(-0.6, 0.6));
      v.g.add(g);
      const delay = isSS ? i * 0.6 : 0;
      sats3d.push({ g, panel, t: -delay, vel: isSS ? [rnd(0.4, 0.9), rnd(-0.1, 0.1), rnd(-0.2, 0.2)] : [rnd(-0.3, 0.3), rnd(0.05, 0.6), rnd(-0.3, 0.3)], spin: [rnd(-0.2, 0.2), rnd(-0.2, 0.2), rnd(-0.2, 0.2)] });
    }
    if (payloadMesh) payloadMesh.visible = false;
  }
  function updateSats(dt) {
    for (let i = sats3d.length - 1; i >= 0; i--) {
      const s = sats3d[i]; s.t += dt;
      if (s.t < 0) { s.g.visible = false; continue; }
      s.g.visible = true;
      s.g.position.x += s.vel[0] * dt; s.g.position.y += s.vel[1] * dt; s.g.position.z += s.vel[2] * dt;
      s.g.rotation.x += s.spin[0] * dt; s.g.rotation.y += s.spin[1] * dt; s.g.rotation.z += s.spin[2] * dt;
      s.panel.scale.x = clamp((s.t - 3) / 4, 0.05, 1); s.panel.position.x = 1.3 + 4 * s.panel.scale.x;
      if (s.t > 120) { s.g.parent && s.g.parent.remove(s.g); sats3d.splice(i, 1); }
    }
  }

  /* ================= TAKIMYILDIZ (HARİTA) ================= */
  const CMAX = 4000;
  let constPts, footPts, constData = [];
  function buildConstellation() {
    const mk = (size, color, add) => {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(new Float32Array(CMAX * 3), 3).setUsage(T.DynamicDrawUsage));
      const m = new T.ShaderMaterial({
        uniforms: { scale: { value: 1 }, size: { value: size }, color: { value: new T.Color(color) } },
        vertexShader: `#include <common>
          #include <logdepthbuf_pars_vertex>
          uniform float scale; uniform float size;
          void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv;
            gl_PointSize = clamp(size*scale/max(1.0,-mv.z), 1.5, 600.0);
            #include <logdepthbuf_vertex>
          }`,
        fragmentShader: `#include <common>
          #include <logdepthbuf_pars_fragment>
          uniform vec3 color;
          void main(){ float d = length(gl_PointCoord-0.5)*2.0; if(d>1.0) discard; float a = ${add ? '(1.0-d)*0.05' : 'smoothstep(1.0,0.3,d)'};
            gl_FragColor = vec4(color*${add ? 'a' : '1.0'}, ${add ? '1.0' : 'smoothstep(1.0,0.3,d)'});
            #include <logdepthbuf_fragment>
          }`,
        transparent: true, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending,
      });
      const p = new T.Points(g, m); p.frustumCulled = false; p.renderOrder = 5; scene.add(p); return p;
    };
    constPts = mk(40000, 0xffffff, false);
    footPts = mk(1.9e6, 0x3fd0ff, true);
    for (let i = 0; i < CMAX; i++) {
      const shell = i % 3;
      constData.push({ inc: [53, 70, 97.6][shell] * Math.PI / 180 * (i % 7 === 0 ? 0.8 : 1), raan: hash3(i, 1, 2) * Math.PI * 2, ph: hash3(i, 5, 9) * Math.PI * 2, r: RE + 540000 + shell * 20000 });
    }
  }
  function updateConstellation(time, n, show) {
    constPts.visible = footPts.visible = show && n > 0;
    if (!show) return;
    n = Math.min(CMAX, n);
    const pa = constPts.geometry.attributes.position.array, fa = footPts.geometry.attributes.position.array;
    for (let i = 0; i < n; i++) {
      const d = constData[i];
      const w = Math.sqrt(S.MU / d.r ** 3) * 60; // görsel olarak 60x hızlı
      const u = d.ph + w * time;
      // yörünge düzlemi: z kutup ekseni
      const xo = Math.cos(u), yo = Math.sin(u);
      const ci = Math.cos(d.inc), si = Math.sin(d.inc), cr = Math.cos(d.raan), sr = Math.sin(d.raan);
      const x = xo * cr - yo * ci * sr, y = xo * sr + yo * ci * cr, z = yo * si;
      pa[i * 3] = x * d.r - F.x; pa[i * 3 + 1] = y * d.r - F.y; pa[i * 3 + 2] = z * d.r - F.z;
      const rr = RE + 3000;
      fa[i * 3] = x * rr - F.x; fa[i * 3 + 1] = y * rr - F.y; fa[i * 3 + 2] = z * rr - F.z;
    }
    constPts.geometry.setDrawRange(0, n); footPts.geometry.setDrawRange(0, n);
    constPts.geometry.attributes.position.needsUpdate = true; footPts.geometry.attributes.position.needsUpdate = true;
    const sc = innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360));
    constPts.material.uniforms.scale.value = sc; footPts.material.uniforms.scale.value = sc;
  }
  // harita görünümünde yörünge çizgileri
  let orbitLine, trailLines = [];
  function buildMapLines() {
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(361 * 3), 3));
    orbitLine = new T.Line(g, new T.LineBasicMaterial({ color: 0x4fc3ff, transparent: true, opacity: 0.8 }));
    orbitLine.frustumCulled = false; scene.add(orbitLine);
    for (let i = 0; i < 6; i++) {
      const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.BufferAttribute(new Float32Array(4000 * 3), 3));
      const l = new T.Line(tg, new T.LineBasicMaterial({ color: [0xffd36b, 0xff8a3d, 0x9cf5c6, 0xff9a92, 0xcccccc, 0xcccccc][i] }));
      l.frustumCulled = false; scene.add(l); trailLines.push(l);
    }
  }
  function updateMapLines(show) {
    orbitLine.visible = false; for (const l of trailLines) l.visible = false;
    if (!show || !mission) return;
    const s = mission.stack;
    if (s && s.alive && s.alt() > 30000) {
      const o = s.orbit();
      if (o.a && o.e < 1) {
        const ex = S.orbitOf; // e vektörü
        const r = Math.hypot(s.x, s.y), vv = s.vx * s.vx + s.vy * s.vy, rv = s.x * s.vx + s.y * s.vy;
        const evx = ((vv - S.MU / r) * s.x - rv * s.vx) / S.MU, evy = ((vv - S.MU / r) * s.y - rv * s.vy) / S.MU;
        const w = Math.atan2(evy, evx) + efRot();
        const pa = orbitLine.geometry.attributes.position.array, p = o.a * (1 - o.e * o.e);
        for (let i = 0; i <= 360; i++) { const th = i / 360 * Math.PI * 2; const rr = p / (1 + o.e * Math.cos(th)); pa[i * 3] = rr * Math.cos(th + w) - F.x; pa[i * 3 + 1] = rr * Math.sin(th + w) - F.y; pa[i * 3 + 2] = -F.z; }
        orbitLine.geometry.attributes.position.needsUpdate = true; orbitLine.visible = true;
        void ex;
      }
    }
    let k = 0;
    for (const [, tr] of trails) {
      if (k >= trailLines.length) break;
      const l = trailLines[k++], pa = l.geometry.attributes.position.array;
      const n = Math.min(4000, tr.pts.length);
      for (let i = 0; i < n; i++) { const q = tr.pts[tr.pts.length - n + i]; pa[i * 3] = q[2] - F.x; pa[i * 3 + 1] = q[3] - F.y; pa[i * 3 + 2] = -F.z; }
      l.geometry.setDrawRange(0, n); l.geometry.attributes.position.needsUpdate = true; l.visible = n > 1;
    }
  }

  /* ================= SES ================= */
  const audio = (() => {
    let ctx = null, rumble, rumbleG, crackG, master;
    function init() {
      if (ctx) return;
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
        const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
        let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
        rumble = ctx.createBufferSource(); rumble.buffer = buf; rumble.loop = true;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
        rumbleG = ctx.createGain(); rumbleG.gain.value = 0;
        rumble.connect(lp); lp.connect(rumbleG); rumbleG.connect(master);
        const wb = ctx.createBuffer(1, len, ctx.sampleRate), wd = wb.getChannelData(0);
        for (let i = 0; i < len; i++) wd[i] = (Math.random() * 2 - 1) * (Math.random() < 0.02 ? 1 : 0.25);
        const cr = ctx.createBufferSource(); cr.buffer = wb; cr.loop = true;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.6;
        crackG = ctx.createGain(); crackG.gain.value = 0;
        cr.connect(bp); bp.connect(crackG); crackG.connect(master);
        rumble.start(); cr.start();
      } catch (e) { ctx = null; }
    }
    function set(level) {
      if (!ctx) return;
      const t = ctx.currentTime;
      rumbleG.gain.setTargetAtTime(level * 0.9, t, 0.15);
      crackG.gain.setTargetAtTime(level * 0.35, t, 0.1);
    }
    function boom(v) {
      if (!ctx) return;
      const len = ctx.sampleRate * 2.5, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.5));
      const s = ctx.createBufferSource(); s.buffer = buf;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
      const g = ctx.createGain(); g.gain.value = v * 1.4;
      s.connect(lp); lp.connect(g); g.connect(master); s.start();
    }
    function sonic() {
      if (!ctx) return;
      for (let k = 0; k < 3; k++) {
        const len = ctx.sampleRate * 0.5, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.06));
        const s = ctx.createBufferSource(); s.buffer = buf;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
        const g = ctx.createGain(); g.gain.value = 1.2; s.connect(lp); lp.connect(g); g.connect(master);
        s.start(ctx.currentTime + k * 0.35);
      }
    }
    return { init, set, boom, sonic };
  })();

  /* ================= KAMERA ================= */
  const cam = { yaw: 0.45, pitch: 0.08, dist: 120, tdist: 120, mapYaw: 0.6, mapPitch: 0.5, mapDist: RE * 3.2, map: false };
  let shake = 0, drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
    if (cam.map || mode === 'hangar') { cam.mapYaw -= dx * 0.005; cam.mapPitch = clamp(cam.mapPitch + dy * 0.005, -1.45, 1.45); }
    else { cam.yaw -= dx * 0.006; cam.pitch = clamp(cam.pitch + dy * 0.006, -1.4, 1.5); }
  });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const k = Math.pow(1.0015, e.deltaY);
    if (cam.map || mode === 'hangar') cam.mapDist = clamp(cam.mapDist * k, RE * 1.15, RE * 12);
    else cam.tdist = clamp(cam.tdist * k, 6, 4e6);
  }, { passive: false });

  function updateCamera(dtReal) {
    if (mode === 'hangar' || cam.map) {
      F.set(0, 0, 0);
      if (mode === 'hangar') cam.mapYaw += dtReal * 0.03;
      const d = cam.mapDist;
      camera.up.set(0, 0, 1);
      camera.position.set(Math.cos(cam.mapPitch) * Math.cos(cam.mapYaw) * d, Math.cos(cam.mapPitch) * Math.sin(cam.mapYaw) * d, Math.sin(cam.mapPitch) * d);
      camera.lookAt(0, 0, 0);
      return;
    }
    const c = focusCraft();
    let fx, fy;
    if (c) {
      const e = toEF(c.x, c.y);
      const da = c.dir + efRot();
      const ax = [Math.cos(da), Math.sin(da)];
      const L = c.length || 20;
      fx = e[0] + ax[0] * L * 0.45; fy = e[1] + ax[1] * L * 0.45;
      cam.lastF = [fx, fy];
    } else if (cam.lastF) { fx = cam.lastF[0]; fy = cam.lastF[1]; } else { fx = 0; fy = RE; }
    F.set(fx, fy, 0);
    cam.dist = lerp(cam.dist, cam.tdist, Math.min(1, dtReal * 4));
    const r = Math.hypot(fx, fy), up = [fx / r, fy / r], east = [up[1], -up[0]];
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch), cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    let ox = (east[0] * sy * cp + up[0] * sp) * cam.dist, oy = (east[1] * sy * cp + up[1] * sp) * cam.dist, oz = cy * cp * cam.dist;
    // yerin altına inme
    const camR = Math.hypot(fx + ox, fy + oy, oz);
    const minR = RE + 2 + (mission && Math.abs(c ? c.downrange() : 0) < 200 && mission.key === 'ss' ? 1 : 0);
    if (camR < minR) { const k = (minR - r) / cam.dist; ox = (east[0] * sy * cp + up[0] * Math.max(sp, k)) * cam.dist; oy = (east[1] * sy * cp + up[1] * Math.max(sp, k)) * cam.dist; }
    if (shake > 0) { ox += rnd(-1, 1) * shake * 0.6; oy += rnd(-1, 1) * shake * 0.6; oz += rnd(-1, 1) * shake * 0.6; shake = Math.max(0, shake - dtReal * 0.8); }
    camera.position.set(ox, oy, oz);
    camera.up.set(up[0], up[1], 0);
    camera.lookAt(0, 0, 0);
  }
  function focusCraft() {
    if (!mission) return null;
    return mission.crafts.find(c => c.id === camFocusId) || null;
  }
  function setFocus(c, keepDist) {
    if (!c) return;
    camFocusId = c.id; mission.focusId = c.id;
    if (!keepDist) cam.tdist = clamp((c.length || 30) * (c.type === 'fairing' ? 3 : 2.3), 15, 400);
  }

  /* ================= ATMOSFER / GÖKYÜZÜ ================= */
  const skyLow = new T.Color(0x78acdf), skyMid = new T.Color(0x1d3f78), skyHigh = new T.Color(0x010207), tmpC = new T.Color();
  function updateSky() {
    const cw = new T.Vector3().copy(camera.position).add(F);
    const hc = cw.length() - RE;
    if (hc < 25000) tmpC.copy(skyLow).lerp(skyMid, clamp(hc / 25000, 0, 1));
    else tmpC.copy(skyMid).lerp(skyHigh, clamp((hc - 25000) / 45000, 0, 1));
    // gece tarafında koyulaş
    const day = clamp(cw.clone().normalize().dot(SUN) * 3 + 0.6, 0.05, 1);
    tmpC.multiplyScalar(day);
    scene.background = tmpC.clone();
    if (hc < 40000) {
      if (!scene.fog) scene.fog = new T.FogExp2(tmpC.clone(), 0);
      scene.fog.color.copy(tmpC);
      scene.fog.density = 2.2e-5 * Math.exp(-hc / 7000);
    } else scene.fog = null;
    stars.position.copy(camera.position);
    stars.material.opacity = clamp((hc - 25000) / 40000, 0, 1) * 0.95 + (1 - day) * 0.5;
    sunSprite.position.set(SUN.x * 1e9 + camera.position.x, SUN.y * 1e9 + camera.position.y, SUN.z * 1e9 + camera.position.z);
    sunSprite.material.opacity = clamp((hc - 10000) / 40000, 0.15, 1);
    clouds.visible = hc > 9000;
    atmo.visible = hc > 15000;
    // kayan orijin uygulaması
    earth.position.set(-F.x, -F.y, -F.z); clouds.position.copy(earth.position); atmo.position.copy(earth.position);
    clouds.rotation.z += 0.000002;
    // güneş ışığı ve gölge
    const sd = 600;
    sunLight.position.set(SUN.x * sd, SUN.y * sd, SUN.z * sd); sunLight.target.position.set(0, 0, 0);
    const fAlt = F.length() - RE;
    const sh = !cam.map && mode !== 'hangar' && fAlt < 3000;
    sunLight.castShadow = sh;
    if (sh) {
      const ext = clamp(cam.dist * 1.2, 60, 400);
      const s = sunLight.shadow.camera; s.left = -ext; s.right = ext; s.top = ext; s.bottom = -ext; s.near = 1; s.far = 1400; s.updateProjectionMatrix();
    }
    hemi.intensity = 0.35 + 0.3 * clamp(1 - hc / 50000, 0, 1);
    return hc;
  }

  function updateStatics() {
    placeSurface(siteCap, 0, 0);
    const ss = mission ? mission.key === 'ss' : state.sel === 'ss';
    placeSurface(falconSite, 0, 0); falconSite.visible = !ss && mode !== 'hangar';
    placeSurface(starSite, 0, 0); starSite.visible = ss && mode !== 'hangar';
    for (const g of lzPads) { placeSurface(g, g.userData.d, 0); g.visible = mode !== 'hangar' && !ss; }
    siteCap.visible = mode !== 'hangar' && !cam.map;
    if (mission && mission.shipD !== undefined) {
      droneShip.visible = mode !== 'hangar' && !cam.map;
      shipCap.visible = droneShip.visible;
      placeSurface(droneShip, mission.shipD, 0);
      droneShip.position.addScaledVector(new T.Vector3(Math.cos(droneShip.rotation.z + Math.PI / 2), Math.sin(droneShip.rotation.z + Math.PI / 2), 0), Math.sin(performance.now() / 1300) * 0.25);
      placeSurface(shipCap, mission.shipD, -0.6);
    } else { droneShip.visible = false; shipCap.visible = false; }
  }

  /* ================= GÖREV AKIŞI ================= */
  let mode = 'hangar', warp = 1, simAcc = 0, missionCost = 0, endTimer = null, autoCamTimer = 0, logLines = [];
  const WARPS = [1, 2, 5, 10, 25, 50, 100];
  const keys = {};
  const PHASES = { countdown: 'Geri sayım', ascent1: '1. kademe yükselişi', meco: 'MECO', ascent2: '2. kademe yanışı', orbit: 'Yörüngede', failed: 'Görev başarısız', failed2: 'Yörünge kaybedildi' };
  const STATES = { coast: 'süzülüyor', boostback: 'geri dönüş yanışı', descent: 'alçalıyor', entry: 'giriş yanışı', final: 'son yaklaşma', expended: 'tek kullanımlık', falling: 'düşüyor' };

  function startMission() {
    const k = state.sel, md = state.mode[k] || Object.keys(ROCKETS[k].modes)[0];
    const cost = launchCost(k);
    if (state.money < cost) return;
    audio.init();
    state.money -= cost; missionCost = cost; state.launches++;
    saveState();
    mission = new S.Mission(k, md, { autopilot: $('opt-auto').checked, autoLand: $('opt-autoland').checked });
    mission.autoDeploy = false;
    mission.on(onEvent);
    buildMissionVisuals(mission);
    vis.forEach(v => scene.remove(v.g)); vis.clear();
    trails.clear(); logLines = []; $('log').innerHTML = '';
    for (const d of debris) scene.remove(d.mesh); debris = [];
    sats3d = []; fireP.clear(); smokeP.clear();
    setFocus(mission.stack);
    cam.tdist = cam.dist = mission.stack.length * 2.2; cam.yaw = 0.5; cam.pitch = 0.05; cam.map = false;
    warp = 1; simAcc = 0; autoCamTimer = 0;
    if (towerArms) towerArms.open = 1;
    mode = 'flight';
    $('hangar').classList.add('hidden'); $('result').classList.add('hidden'); $('hud').classList.remove('hidden');
    log('Görev başladı: ' + mission.def.name + ' — ' + MODE_NAMES[md] + ' — ' + mission.satsPlanned + ' uydu');
  }

  function log(text, cls) {
    const t = mission ? mission.t : 0;
    const el = document.createElement('div');
    if (cls) el.className = cls;
    el.innerHTML = `<b>${fmtT(t)}</b>${text}`;
    const L = $('log'); L.insertBefore(el, L.firstChild);
    while (L.children.length > 40) L.removeChild(L.lastChild);
  }
  let bannerT = null;
  function banner(text, cls) {
    const b = $('banner'); b.textContent = text; b.className = 'show ' + (cls || 'info');
    clearTimeout(bannerT); bannerT = setTimeout(() => { b.className = ''; }, 3200);
  }
  function fmtT(t) {
    const s = Math.abs(t), hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = Math.floor(s % 60);
    return (t < 0 ? 'T- ' : 'T+ ') + [hh, mm, ss].map(x => String(x).padStart(2, '0')).join(':');
  }

  function onEvent(type, d, m) {
    const c = d.craft;
    const nm = c ? c.name : '';
    const autoCam = $('opt-cam').checked;
    switch (type) {
      case 'ignition': log('Motor ateşlemesi'); break;
      case 'liftoff': log('KALKIŞ!', 'good'); banner('KALKIŞ', 'good'); break;
      case 'maxq': log('Max-Q — en yüksek aerodinamik yük (' + (d.q / 1000).toFixed(1) + ' kPa)'); banner('MAX-Q'); break;
      case 'meco': log('MECO — ana motorlar sustu'); banner('MECO'); break;
      case 'hotstage': log('Sıcak kademe ayrılması — Ship motorları ateşlendi'); banner('SICAK AYRILMA'); break;
      case 'sideSep': log('Yan boosterlar ayrıldı (BECO)'); banner('YAN BOOSTER AYRILMASI'); puffs(c, 'side'); break;
      case 'stageSep': log('Kademe ayrılması'); banner('KADEME AYRILMASI'); puffs(c, 'stage'); break;
      case 'ses': log('2. kademe ateşlemesi (SES-1)'); break;
      case 'fairing': log('Burun konisi ayrıldı'); banner('BURUN KONİSİ AYRILDI'); break;
      case 'seco': log('SECO — Apoapsis ' + (d.orbit.ap / 1000).toFixed(0) + ' km, Periapsis ' + (d.orbit.pe / 1000).toFixed(0) + ' km', d.ok ? 'good' : 'bad'); break;
      case 'orbit': banner('YÖRÜNGEYE ULAŞILDI', 'good'); log('YÖRÜNGEDEYİZ!', 'good'); break;
      case 'deploy': log(d.n + ' uydu yörüngeye bırakıldı', 'good'); banner(d.n + ' UYDU BIRAKILDI', 'good'); deploySatsFX(c); break;
      case 'gridfins': log(nm + ': ızgara kanatçıkları açıldı'); break;
      case 'boostback': log(nm + ': geri dönüş yanışı başladı'); break;
      case 'boostbackEnd': log(nm + ': geri dönüş yanışı bitti'); break;
      case 'entryBurn': log(nm + ': giriş yanışı başladı'); if (autoCam && c.id !== camFocusId && !mission.camLock) { /* izlemek için V */ } break;
      case 'entryBurnEnd': log(nm + ': giriş yanışı bitti'); break;
      case 'final':
        log(nm + ': son yaklaşma — iniş hazırlığı');
        audio.sonic();
        if (autoCam && (!focusCraft() || focusCraft().type === 'upper' || focusCraft().type === 'stack' || !focusCraft().rec || focusCraft().landed || focusCraft().caught)) {
          if (!(c.side === 'R' && m.crafts.find(k => k.side === 'L' && k.alive && !k.landed))) { setFocus(c); cam.tdist = c.length * 3.2; banner(nm.toUpperCase() + ' İNİŞE GELİYOR'); }
        }
        break;
      case 'landingBurn': log(nm + ': iniş yanışı' + (d.craft.manualBurn ? ' (manuel)' : '')); break;
      case 'legs': log(nm + ': iniş bacakları açıldı'); break;
      case 'landed': log(nm + ' İNDİ! (' + Math.abs(d.dx).toFixed(1) + ' m sapma)', 'good'); banner(nm.toUpperCase() + ' İNDİ!', 'good'); state.recovered++; landFX(c); autoCamTimer = 6; break;
      case 'caught': log(nm + ' KULE TARAFINDAN YAKALANDI!', 'good'); banner('YAKALANDI!', 'good'); state.recovered++; autoCamTimer = 7; landFX(c); break;
      case 'explode': explodeFX(c, d.why, d.reentry); if (c.id === camFocusId) autoCamTimer = 6; break;
      case 'msg': log(d.text, d.bad ? 'bad' : ''); if (d.bad) banner(d.text.length > 48 ? d.text.slice(0, 46) + '…' : d.text, 'bad'); break;
      case 'end': clearTimeout(endTimer); endTimer = setTimeout(() => showResult(d), 3500); break;
    }
  }
  function puffs(c, kind) {
    const v = vis.get(c.id); if (!v || !v.ef) return;
    const ax = axisOf(v), e = v.ef, big = mission.key === 'ss' ? 2.5 : 1;
    const y = kind === 'side' ? mission.def.stages[0].len * 0.5 : 0;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, sp = rnd(5, 25);
      smokeP.spawn(e[0] - ax[0] * (2 - y), e[1] - ax[1] * (2 - y), 0, Math.cos(a) * sp, Math.sin(a) * sp, rnd(-20, 20), rnd(1.5, 4), 1 * big, 8 * big, [1, 1, 1], [0.9, 0.9, 0.9], 0.6, 0, 0.8, 0);
    }
  }
  function landFX(c) {
    const v = vis.get(c.id); if (!v || !v.ef) return;
    const ax = axisOf(v), e = v.ef, big = mission.key === 'ss' ? 2.5 : 1;
    // tahliye buharı
    for (let i = 0; i < 80; i++) {
      const y = rnd(0.4, 0.95) * c.length;
      smokeP.spawn(e[0] + ax[0] * y, e[1] + ax[1] * y, 0, rnd(-6, 6), rnd(-6, 6), rnd(-6, 6), rnd(3, 8), 2 * big, 18 * big, [1, 1, 1], [0.9, 0.9, 0.92], 0.5, 0, 0.6, -0.8);
    }
  }

  function inputStep(dtReal) {
    const m = mission; if (!m) return;
    const c = m.focus();
    if (c && c.manual) {
      const rate = 0.12;
      if (keys.KeyA || keys.ArrowLeft) m.cmd('pitch', rate);
      else if (keys.KeyD || keys.ArrowRight) m.cmd('pitch', -rate);
      else m.cmd('pitch', 0);
      if (keys.KeyW || keys.ShiftLeft || keys.ArrowUp) m.cmd('throttle', 0.6 * dtReal);
      if (keys.KeyS || keys.ControlLeft || keys.ArrowDown) m.cmd('throttle', -0.6 * dtReal);
    }
  }
  addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    keys[e.code] = true;
    if (mode !== 'flight' || !mission) return;
    const m = mission;
    switch (e.code) {
      case 'Space': e.preventDefault(); m.cmd('stage'); break;
      case 'KeyT': m.cmd('autopilot'); break;
      case 'KeyL': m.cmd('landBurn'); break;
      case 'KeyC': m.cmd('catch'); break;
      case 'KeyP': if (m.phase === 'orbit') m.deploy(); break;
      case 'KeyK': m.cmd('fts'); break;
      case 'KeyZ': m.cmd('throttleSet', 1); break;
      case 'KeyX': m.cmd('throttleSet', 0); break;
      case 'KeyV': cycleFocus(1); break;
      case 'KeyB': cycleFocus(-1); break;
      case 'KeyM': cam.map = !cam.map; break;
      case 'KeyH': $('keys').classList.toggle('hidden'); break;
      case 'Comma': changeWarp(-1); break;
      case 'Period': changeWarp(1); break;
      case 'Escape': abortMission(); break;
    }
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  function cycleFocus(dir) {
    const list = mission.crafts.filter(c => c.alive && c.type !== 'fairing');
    if (!list.length) return;
    let i = list.findIndex(c => c.id === camFocusId);
    i = (i + dir + list.length) % list.length;
    setFocus(list[i]); mission.camLock = true;
  }
  function maxWarp() {
    const m = mission; if (!m) return 1;
    let mw = 100;
    for (const c of m.crafts) {
      if (!c.alive || c.landed || c.caught) continue;
      if (c.firingParts().length) mw = Math.min(mw, 10);
      if (c.rec && (c.state === 'final' || (c.state === 'descent' && c.alt() < 30000))) mw = Math.min(mw, c.id === camFocusId ? 2 : 5);
      if (c.alt() < 60000 && c.vUp() < 0 && c.type !== 'fairing') mw = Math.min(mw, 10);
    }
    const f = focusCraft();
    if (f && f.rec && f.state === 'final' && !m.autoLand && !f.burnLit) mw = 1;
    if (f && f.rec && f.rec.kind === 'catch' && f.burnLit && f.alt() < 400) mw = 1;
    if (m.phase === 'countdown') mw = Math.min(mw, 5);
    if (m.result) mw = 1;
    return mw;
  }
  function changeWarp(d) {
    let i = WARPS.indexOf(warp); i = clamp(i + d, 0, WARPS.length - 1);
    warp = WARPS[i];
  }
  document.querySelectorAll('.warp-btns button').forEach(b => b.addEventListener('click', () => changeWarp(+b.dataset.w)));
  function abortMission() {
    if (!mission || mission.result) return;
    if (!confirm('Görevi iptal edip hangara dönmek istiyor musun? Fırlatma maliyeti geri alınamaz.')) return;
    mission.finish(false); mission.result.reason = 'Görev iptal edildi';
  }

  function autoLogic(dtReal) {
    const m = mission;
    const f = focusCraft();
    // odak kaybolduysa
    if (!f || !f.alive || f.landed || f.caught) {
      autoCamTimer -= dtReal;
      if (autoCamTimer <= 0 || !f) {
        const s = m.stack;
        const pend = m.crafts.find(c => c.rec && c.alive && !c.landed && !c.caught && c.state === 'final' && c.id !== camFocusId);
        if (pend && $('opt-cam').checked) setFocus(pend);
        else if (s && s.alive) { if (camFocusId !== s.id) { setFocus(s); cam.tdist = s.length * 2.5; } }
        else { const any = m.crafts.find(c => c.alive && c.type !== 'fairing'); if (any && any !== f) setFocus(any); }
        autoCamTimer = 1e9;
      }
    }
    // uydu bırakma: kamera üst kademedeyken veya 60 sn sonra
    if (m.phase === 'orbit' && !m.satsDeployed) {
      const onStack = camFocusId === m.stack.id;
      if ((onStack && m.t - m.orbitT > 5) || m.t - m.orbitT > 70) m.deploy();
    }
    warp = Math.min(warp, maxWarp());
  }

  function showResult(r) {
    const m = mission;
    const k = m.key;
    const lines = [];
    let income = 0;
    if (r.ok) {
      const before = state.sats;
      const satInc = r.sats * SAT_INCOME;
      state.sats += r.sats;
      const sub = coverage(state.sats) * SUB_INCOME;
      income += satInc + sub;
      lines.push([r.sats + ' uydu × $1.2 M', satInc, 'pos']);
      lines.push(['Abonelik geliri (kapsama %' + (coverage(state.sats) * 100).toFixed(1) + ')', sub, 'pos']);
      if (!state.firstDone[k]) { state.firstDone[k] = true; income += FIRST_BONUS; lines.push(['İlk başarılı uçuş bonusu', FIRST_BONUS, 'pos']); }
      state.success[k] = (state.success[k] || 0) + 1;
      void before;
    }
    // booster durumu
    const recs = m.crafts.filter(c => c.rec);
    const rec = recs.filter(c => c.landed || c.caught).length;
    const lost = recs.length - rec;
    if (ROCKETS[k].reuseCost) {
      const n = coreCount(k);
      const reusedBefore = Math.min(n, state.cores[k] || 0);
      state.cores[k] = rec;
      state.flights[k] = rec > 0 ? (reusedBefore > 0 ? state.flights[k] + 1 : 1) : 0;
    }
    lines.push(['Fırlatma maliyeti', -missionCost, 'neg']);
    for (const c of recs) lines.push([c.name + (c.caught ? ' — yakalandı' : c.landed ? ' — indi' : ' — kayıp'), c.landed || c.caught ? 'Yeniden kullanılabilir ✓' : 'Kaybedildi ✗', c.landed || c.caught ? 'pos' : 'neg']);
    if (m.mode === 'exp') lines.push(['1. kademe', 'Tek kullanımlık', '']);
    state.money += income;
    const net = income - missionCost;
    lines.push(['Net', net, net >= 0 ? 'pos' : 'neg', 'total']);
    const won = !state.won && coverage(state.sats) >= 0.95;
    if (won) state.won = true;
    saveState();
    $('res-title').textContent = won ? 'DÜNYA BAĞLANDI! 🌍' : r.ok ? 'GÖREV BAŞARILI' : 'GÖREV BAŞARISIZ';
    $('res-title').className = r.ok ? 'good' : 'bad';
    $('res-sub').textContent = won ? 'Uydu ağın gezegenin %95\'ini kapsıyor. Herkes internete bağlı!' : r.ok ? `Yörünge: ${(r.orbit.pe / 1000).toFixed(0)} × ${(r.orbit.ap / 1000).toFixed(0)} km · Toplam uydu: ${state.sats}` : (r.reason || '');
    $('res-lines').innerHTML = lines.map(l => `<div class="${l[3] || ''}"><span>${l[0]}</span><b class="${l[2]}">${typeof l[1] === 'number' ? (l[1] >= 0 ? '+' : '') + money(l[1]) : l[1]}</b></div>`).join('');
    $('result').classList.remove('hidden');
    void lost;
  }
  function backToHangar() {
    $('result').classList.add('hidden'); $('hud').classList.add('hidden'); $('hangar').classList.remove('hidden');
    vis.forEach(v => scene.remove(v.g)); vis.clear();
    for (const d of debris) scene.remove(d.mesh); debris = [];
    mission = null; mode = 'hangar'; cam.map = false; warp = 1;
    fireP.clear(); smokeP.clear(); audio.set(0);
    renderHangar();
  }

  /* ================= HUD ================= */
  let hudT = 0;
  const fmtD = m => (Math.abs(m) >= 10000 ? (m / 1000).toFixed(1) + ' km' : m.toFixed(0) + ' m');
  function updateHUD(dtReal) {
    const m = mission; if (!m) return;
    hudT -= dtReal;
    const c = focusCraft();
    updateLandPanel(c);
    if (hudT > 0) return;
    hudT = 0.1;
    $('h-clock').textContent = fmtT(m.t);
    $('h-phase').textContent = PHASES[m.phase] || m.phase;
    $('h-warp').textContent = warp + '×' + (warp >= maxWarp() && maxWarp() < 100 ? ' (sınır)' : '');
    if (c) {
      $('h-name').textContent = c.name;
      $('h-state').textContent = c.landed ? 'indi' : c.caught ? 'yakalandı' : !c.alive ? 'kayıp' : (c.rec || c.state === 'expended' ? STATES[c.state] || '' : '');
      const h = c.alt(), o = c.orbit();
      $('h-alt').textContent = fmtD(h);
      $('h-spd').textContent = c.airSpeed().toFixed(0) + ' m/s';
      $('h-ospd').textContent = c.speed().toFixed(0) + ' m/s';
      $('h-vz').textContent = c.vUp().toFixed(0) + ' m/s';
      $('h-dr').textContent = fmtD(c.downrange());
      $('h-ap').textContent = h > 20000 && isFinite(o.ap) ? (o.ap / 1000).toFixed(0) + ' km' : '—';
      $('h-pe').textContent = h > 20000 ? (o.pe / 1000).toFixed(0) + ' km' : '—';
      $('h-q').textContent = (c.q / 1000).toFixed(1) + ' kPa';
      $('h-g').textContent = ((c.acc || 0) / 9.81).toFixed(2) + ' g';
      $('h-pitch').textContent = (c.pitchFromVertical() * 180 / Math.PI).toFixed(1) + '°';
      $('h-thr').style.width = (c.firingParts().length ? c.throttle * 100 : 0) + '%';
      $('h-ctrl').textContent = c.manual ? 'MANUEL (A/D, W/S)' : c.rec ? 'Otomatik kurtarma' : 'Otopilot';
      $('h-fuel').innerHTML = c.parts.map(p => `<div class="bar-row fuel"><label>${partName(p)}</label><div class="bar"><div style="width:${(p.prop / p.def.prop * 100).toFixed(1)}%"></div></div></div>`).join('');
    }
    // kamera seçici
    const cams = $('h-cams');
    const list = m.crafts.filter(k => k.type !== 'fairing');
    const html = list.map(k => `<button data-id="${k.id}" class="${k.id === camFocusId ? 'sel' : ''} ${!k.alive ? 'dead' : ''} ${k.landed || k.caught ? 'ok' : ''}">${k.name}</button>`).join('');
    if (cams._h !== html) { cams.innerHTML = html; cams._h = html; cams.querySelectorAll('button').forEach(b => b.onclick = () => { const k = m.crafts.find(q => q.id === +b.dataset.id); if (k) { setFocus(k); m.camLock = true; } }); }
    drawProfile();
    // ses seviyesi
    let lvl = 0;
    for (const k of m.crafts) {
      if (!k.alive || !k.thrust) continue;
      const v = vis.get(k.id); if (!v) continue;
      const dist = v.g.position.length() + cam.dist * 0.2;
      const T0 = k.thrust / 8e6;
      const air = 0.2 + 0.8 * clamp(S.rho(k.alt()) / 1.225 * 3, 0, 1);
      lvl += Math.min(1, Math.sqrt(T0)) * air / (1 + dist / 400);
    }
    audio.set(clamp(lvl, 0, 1));
  }
  function partName(p) {
    return { booster: mission.key === 'ss' ? 'Super Heavy' : '1. kademe', upper: mission.key === 'ss' ? 'Ship' : '2. kademe', sideL: 'Yan B. (Sol)', sideR: 'Yan B. (Sağ)' }[p.role] || p.role;
  }
  function updateLandPanel(c) {
    const p = $('land-panel');
    if (!c || !c.rec || !c.alive || c.landed || c.caught || (c.state !== 'final' && !(c.state === 'descent' && c.alt() < 20000))) { p.classList.add('hidden'); return; }
    p.classList.remove('hidden');
    const isCatch = c.rec.kind === 'catch';
    $('lp-title').textContent = isCatch ? 'KULE YAKALAMA' : (c.rec.kind === 'asds' ? 'DRONE GEMİYE İNİŞ' : 'RAMPAYA İNİŞ');
    $('lp-dx').textContent = Math.abs(c.downrange() - c.rec.target).toFixed(0) + ' m';
    const hint = $('lp-hint');
    if (c.state !== 'final') { $('lp-stop').textContent = '—'; $('lp-needle').style.left = '2%'; hint.className = 'lp-hint'; hint.textContent = 'Giriş & süzülme — ızgara kanatçıkları yönlendiriyor'; return; }
    if (!c.burnLit) {
      const hEff = c.alt() - (isCatch ? 40 : 0);
      $('lp-stop').textContent = (c.stop100 !== undefined ? c.stop100.toFixed(0) : '—') + ' m';
      // ibre: erken (stop80 >> 0) ... ideal (stop80 ~ 0) ... geç (stop100 < 0)
      let x;
      const s80 = c.stop80 || hEff, s100 = c.stop100 || hEff;
      if (s80 > 60) x = 44 * (1 - clamp(s80 / Math.max(300, hEff), 0, 1));
      else if (s100 > 0) x = 44 + 22 * clamp((60 - s80) / (60 + Math.max(1, s100 - s80 + 60)), 0, 1) * 1.0;
      else x = 67 + 30 * clamp(-s100 / 300, 0, 1);
      $('lp-needle').style.left = clamp(x, 1, 98) + '%';
      const auto = mission.autoLand;
      if (auto) { hint.className = 'lp-hint'; hint.textContent = 'Otomatik iniş yanışı etkin'; }
      else if (s80 <= 60 && s100 > -60) { hint.className = 'lp-hint go'; hint.textContent = 'ŞİMDİ! L — iniş yanışını ateşle'; }
      else if (s100 <= -60) { hint.className = 'lp-hint go'; hint.textContent = 'GEÇ! Hemen L!'; }
      else { hint.className = 'lp-hint'; hint.textContent = 'Bekle… ibre İDEAL bölgeye girince L'; }
    } else {
      $('lp-stop').textContent = 'yanış sürüyor';
      $('lp-needle').style.left = '55%';
      if (isCatch) {
        const ready = c.catchReady;
        hint.className = 'lp-hint' + (ready && !mission.autoLand ? ' go' : '');
        hint.textContent = mission.autoLand ? 'Otomatik yakalama' : ready ? 'C — KOLLARI KAPAT!' : 'Kollara yaklaşıyor… (' + (c.alt() - 40).toFixed(0) + ' m)';
      } else { hint.className = 'lp-hint'; hint.textContent = 'İniş yanışı — bacaklar ' + (c.legsOut ? 'açık' : 'kapalı'); }
    }
  }
  const prof = $('profile'), pctx = prof.getContext('2d');
  function drawProfile() {
    const W = prof.width, H = prof.height;
    pctx.clearRect(0, 0, W, H);
    let maxD = 10000, maxH = 10000, minD = 0;
    for (const [, tr] of trails) for (const q of tr.pts) { maxD = Math.max(maxD, q[0]); minD = Math.min(minD, q[0]); maxH = Math.max(maxH, q[1]); }
    const sx = d => 8 + (d - minD) / (maxD - minD) * (W - 16), sy = h => H - 14 - h / maxH * (H - 24);
    pctx.strokeStyle = 'rgba(255,255,255,0.12)'; pctx.beginPath(); pctx.moveTo(0, sy(0)); pctx.lineTo(W, sy(0)); pctx.stroke();
    const cols = ['#ffd36b', '#ff8a3d', '#9cf5c6', '#ff9a92', '#cccccc', '#cccccc'];
    let i = 0;
    for (const [id, tr] of trails) {
      if (tr.type === 'fairing') continue;
      pctx.strokeStyle = cols[i++ % cols.length]; pctx.lineWidth = id === camFocusId ? 2 : 1.2;
      pctx.beginPath();
      tr.pts.forEach((q, j) => (j ? pctx.lineTo(sx(q[0]), sy(q[1])) : pctx.moveTo(sx(q[0]), sy(q[1]))));
      pctx.stroke();
    }
    pctx.fillStyle = 'rgba(200,220,255,0.6)'; pctx.font = '10px sans-serif';
    pctx.fillText('irtifa ' + (maxH / 1000).toFixed(0) + ' km', 6, 11);
    pctx.fillText('menzil ' + (maxD / 1000).toFixed(0) + ' km', W - 80, H - 3);
  }

  /* ================= HANGAR ARAYÜZÜ ================= */
  function reqMet(k) {
    const r = ROCKETS[k].unlock.req; if (!r) return true;
    return Object.entries(r).every(([kk, n]) => (state.success[kk] || 0) >= n);
  }
  function reqText(k) {
    const r = ROCKETS[k].unlock.req; if (!r) return '';
    return Object.entries(r).map(([kk, n]) => `${ROCKETS[kk].name}: ${Math.min(n, state.success[kk] || 0)}/${n} başarılı görev`).join(', ');
  }
  function renderHangar() {
    $('st-money').textContent = money(state.money);
    $('st-sats').textContent = state.sats;
    const cv = coverage(state.sats) * 100;
    $('st-cov').textContent = cv.toFixed(1) + '%';
    $('st-launch').textContent = state.launches;
    $('st-rec').textContent = state.recovered;
    $('cov-fill').style.width = Math.min(100, cv / 95 * 100) + '%';
    $('cov-label').textContent = cv.toFixed(1) + '% / 95%';
    const list = $('rocket-list');
    list.innerHTML = '';
    for (const k of Object.keys(ROCKETS)) {
      const d = ROCKETS[k];
      const un = !!state.unlocked[k];
      const el = document.createElement('div');
      el.className = 'rcard' + (state.sel === k ? ' sel' : '') + (un ? '' : ' locked');
      const maxS = Math.max(...Object.values(d.modes).map(x => x.sats));
      el.innerHTML = `<h4>${d.name} <small>${d.year}</small></h4><p>${d.desc}</p><p>En fazla <b>${maxS}</b> uydu · Başarılı: ${state.success[k] || 0}</p>` +
        (un ? (state.cores[k] ? `<span class="badge">♻ ${state.cores[k]} booster hazır</span>` : '') :
          `<div class="lock">🔒 ${reqText(k)}${d.unlock.cost ? ' · ' + money(d.unlock.cost) : ''}</div><button class="unlock-btn" ${reqMet(k) && state.money >= d.unlock.cost ? '' : 'disabled'}>Kilidi aç (${money(d.unlock.cost)})</button>`);
      el.onclick = ev => {
        if (ev.target.classList.contains('unlock-btn')) {
          if (reqMet(k) && state.money >= d.unlock.cost) { state.money -= d.unlock.cost; state.unlocked[k] = true; state.sel = k; saveState(); }
        } else if (un) { state.sel = k; saveState(); }
        renderHangar();
      };
      list.appendChild(el);
    }
    const k = state.sel, d = ROCKETS[k];
    $('sel-name').textContent = d.name;
    $('sel-desc').textContent = d.desc;
    const st = d.stages;
    const height = st[0].len + st[1].len + d.payloadLen;
    const liftT = (st[0].thrSL + (d.sides ? 2 * d.sides.thrSL : 0)) / 1000;
    const mass = (st[0].dry + st[0].prop + st[1].dry + st[1].prop + (d.sides ? 2 * (d.sides.dry + d.sides.prop) : 0)) / 1000;
    const specs = [['Yükseklik', height.toFixed(0) + ' m'], ['Çap', st[0].dia + ' m'], ['Kalkış itkisi', (liftT / 1000).toFixed(1) + ' MN'], ['Kalkış kütlesi', mass.toFixed(0) + ' t'],
      ['1. kademe motor', st[0].engines + (d.engineType === 'raptor' ? ' Raptor' : ' Merlin')], ['Isp (vakum)', st[1].ispVac + ' s'], ['Hedef yörünge', (d.targetAlt / 1000) + ' km'], ['Yeniden kullanım', d.reuseCost ? 'Evet' : 'Hayır']];
    $('sel-specs').innerHTML = specs.map(s => `<div><span>${s[0]}</span><b>${s[1]}</b></div>`).join('');
    const ml = $('mode-list'); ml.innerHTML = '';
    if (!d.modes[state.mode[k]]) state.mode[k] = Object.keys(d.modes)[0];
    for (const [mk, mv] of Object.entries(d.modes)) {
      const b = document.createElement('button');
      b.className = 'mode-btn' + (state.mode[k] === mk ? ' sel' : '');
      b.innerHTML = `<span>${MODE_NAMES[mk]}${k === 'fh' ? (mk === 'asds' ? ' + yanlar rampaya' : ' (yanlar rampaya)') : ''}</span><small>${mv.sats} uydu</small>`;
      b.onclick = () => { state.mode[k] = mk; saveState(); renderHangar(); };
      ml.appendChild(b);
    }
    const cost = launchCost(k);
    $('sel-cost').textContent = money(cost) + (d.reuseCost && state.cores[k] ? ' (♻)' : '');
    const sats = d.modes[state.mode[k]].sats;
    $('sel-income').textContent = money(sats * SAT_INCOME + coverage(state.sats + sats) * SUB_INCOME + (state.firstDone[k] ? 0 : FIRST_BONUS));
    const can = state.money >= cost;
    $('btn-launch').disabled = !can || !state.unlocked[k];
    $('launch-warn').textContent = !can ? 'Yetersiz bütçe! Daha ucuz bir roketle görev yap ya da booster kurtar.' : '';
    if (!can && !Object.keys(ROCKETS).some(kk => state.unlocked[kk] && state.money >= launchCost(kk))) {
      $('launch-warn').textContent = 'İflas! Hiçbir fırlatmayı karşılayamıyorsun — devlet desteği olarak $20 M alındı.';
      state.money += 20e6; saveState(); setTimeout(renderHangar, 1500);
    }
  }
  $('btn-launch').onclick = startMission;
  $('btn-back').onclick = backToHangar;
  $('btn-reset').onclick = e => { e.preventDefault(); if (confirm('Tüm ilerleme silinsin mi?')) { state = JSON.parse(JSON.stringify(DEFAULT_STATE)); saveState(); renderHangar(); } };
  $('btn-help').onclick = e => { e.preventDefault(); $('help').classList.remove('hidden'); };
  $('btn-help-close').onclick = () => $('help').classList.add('hidden');

  /* ================= ANA DÖNGÜ ================= */
  let last = performance.now(), time = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dtReal = Math.min(0.05, (now - last) / 1000); last = now; time += dtReal;
    let dtSim = 0;
    if (mode === 'flight' && mission) {
      inputStep(dtReal);
      autoLogic(dtReal);
      simAcc += dtReal * warp;
      let steps = Math.floor(simAcc / DT);
      steps = Math.min(steps, 6000);
      simAcc -= steps * DT;
      if (simAcc > DT * 4) simAcc = 0;
      for (let i = 0; i < steps; i++) mission.step(DT);
      dtSim = steps * DT;
      NOWT = mission.t;
    }
    updateCamera(dtReal);
    if (mission) syncVisuals(dtReal, time);
    updateStatics();
    const pdt = mode === 'flight' ? Math.min(dtReal * Math.min(warp, 4), 0.2) : dtReal;
    fireP.update(pdt); smokeP.update(pdt);
    updateDebris(pdt);
    updateSats(dtReal);
    const showC = mode === 'hangar' || cam.map;
    updateConstellation(time, state.sats + (mission && mission.satsDeployed && !mission.result ? mission.satsDeployed : 0), showC);
    updateMapLines(cam.map && mode === 'flight');
    // patlama ışığı
    const fl = flashLight.userData;
    if (fl && fl.e) {
      fl.t += dtReal;
      flashLight.intensity = Math.max(0, 1 - fl.t / 1.5) * 4e5;
      flashLight.position.set(fl.e[0] - F.x, fl.e[1] - F.y, -F.z);
      if (fl.t > 1.5) { fl.e = null; flashLight.intensity = 0; }
    }
    updateSky();
    if (mode === 'flight') updateHUD(dtReal);
    void dtSim;
    renderer.render(scene, camera);
  }

  /* ================= BAŞLANGIÇ ================= */
  function init() {
    $('load-text').textContent = 'Dünya dokusu oluşturuluyor…';
    setTimeout(() => {
      buildEarth();
      buildSites();
      fireP = new Particles(9000, true);
      smokeP = new Particles(9000, false);
      buildConstellation();
      buildMapLines();
      renderHangar();
      $('loading').classList.add('hidden');
      if (!state.launches) $('help').classList.remove('hidden');
      requestAnimationFrame(frame);
    }, 30);
  }
  // test/hata ayıklama erişimi
  window.GAME = { get mission() { return mission; }, get state() { return state; }, setWarp: w => { warp = w; }, startMission, backToHangar, setFocus: id => { const c = mission && mission.crafts.find(k => k.id === id); if (c) setFocus(c); }, cam };
  init();
})();
