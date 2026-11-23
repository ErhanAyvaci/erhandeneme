/* =====================================================================
   Yörünge Ağı — 3D sahne, uçuş, efektler, kamera, HUD
   Gerektirir: THREE (+addons), SIM, PROG, MODELS, HANGAR, TEX
   ===================================================================== */
(function () {
  'use strict';
  const T = window.THREE;
  const S = window.SIM, P = window.PROG, H = window.HANGAR;
  const MD = window.MODELS(T);
  const { RE, PAD_ANG, W_E } = S;
  const clamp = S.clamp;
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = id => document.getElementById(id);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const DT = 1 / 50;
  const D2R = Math.PI / 180;

  /* ================= RENDERER / SAHNE ================= */
  const canvas = $('c');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
  const PR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(PR);
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(55, innerWidth / innerHeight, 0.3, 5e9);
  const pmrem = new T.PMREMGenerator(renderer);
  const envDay = pmrem.fromScene(new window.RoomEnvironment(), 0.04).texture;
  const envNightScene = new window.RoomEnvironment();
  envNightScene.traverse(o => { if (o.material) { const m = o.material; if (m.emissive) m.emissiveIntensity = (m.emissiveIntensity || 1) * 0.03; if (m.color) m.color.multiplyScalar(0.05); } });
  const envNight = pmrem.fromScene(envNightScene, 0.04).texture;
  scene.environment = envDay;
  // ışıma (bloom) son işleme
  let composer = null, bloom = null;
  try {
    composer = new window.EffectComposer(renderer);
    composer.addPass(new window.RenderPass(scene, camera));
    bloom = new window.UnrealBloomPass(new T.Vector2(innerWidth / 2, innerHeight / 2), 0.5, 0.45, 0.97);
    composer.addPass(bloom);
    composer.addPass(new window.OutputPass());
  } catch (e) { composer = null; }

  /* ================= GRAFİK KALİTESİ ================= */
  const QUALITY = {
    low: { pr: 1, shadows: false, bloom: false, part: 0.45, name: 'Düşük' },
    med: { pr: Math.min(window.devicePixelRatio || 1, 1.5), shadows: true, bloom: true, part: 0.75, name: 'Orta' },
    high: { pr: Math.min(window.devicePixelRatio || 1, 2), shadows: true, bloom: true, part: 1, name: 'Yüksek' },
  };
  let QUAL = QUALITY.high;
  function applyQuality(q) {
    QUAL = QUALITY[q] || QUALITY.high;
    renderer.setPixelRatio(QUAL.pr);
    renderer.setSize(innerWidth, innerHeight);
    if (composer) composer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = QUAL.shadows;
  }

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
  const engineLight = new T.PointLight(0xffa860, 0, 0, 2);
  scene.add(engineLight);
  const padLights = [];
  for (let i = 0; i < 3; i++) { const l = new T.PointLight(0xfff0d8, 0, 400, 2); scene.add(l); padLights.push(l); }

  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    if (composer) composer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    for (const ps of [fireP, smokeP]) ps && (ps.mat.uniforms.scale.value = innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360)));
  });

  // Kayan orijin: tüm nesneler odak noktasına (F) göre konumlandırılır
  const F = new T.Vector3();
  let NOWT = -10;
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

  /* ================= DÜNYA (gerçek dokular) ================= */
  const SITES = {
    cape: { lat: 28.5618, lon: -80.5772, name: 'Cape Canaveral' },
    cape39a: { lat: 28.5618, lon: -80.5772, name: 'Cape Canaveral' },
    starbase: { lat: 25.9972, lon: -97.1560, name: 'Starbase' },
  };
  // SphereGeometry ile uyumlu yerel birim vektör (kutup = +Y)
  function localVec(lat, lon) {
    const la = lat * D2R, ph = (lon + 180) * D2R;
    return new T.Vector3(-Math.cos(ph) * Math.cos(la), Math.sin(la), Math.sin(ph) * Math.cos(la));
  }
  function siteQuat(site) {
    const s = SITES[site] || SITES.cape;
    const U = localVec(s.lat, s.lon);
    const ph = (s.lon + 180) * D2R;
    const E = new T.Vector3(Math.sin(ph), 0, Math.cos(ph)).normalize();
    const W = new T.Vector3().crossVectors(E, U);
    const m = new T.Matrix4().set(E.x, E.y, E.z, 0, U.x, U.y, U.z, 0, W.x, W.y, W.z, 0, 0, 0, 0, 1);
    return new T.Quaternion().setFromRotationMatrix(m);
  }
  const earthGroup = new T.Group();
  scene.add(earthGroup);
  let curSite = null;
  let earth, clouds, atmo, stars, sunSprite, dayPixels = null, texLoaded = false;
  const texCache = {};
  function loadTex(key, srgb) {
    if (texCache[key]) return texCache[key];
    const t = new T.Texture();
    const img = new Image();
    img.onload = () => { t.image = img; t.needsUpdate = true; if (key === 'day') { readDayPixels(img); } };
    img.src = (window.TEX && window.TEX[key]) || '';
    if (srgb) t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 8;
    texCache[key] = t;
    return t;
  }
  // yüksek çözünürlüklü dokular arka planda yüklenir
  let hiDayPending = null;
  function upgradeTextures() {
    const sc = document.createElement('script'); sc.src = 'js/textures-hi.js'; sc.async = true;
    sc.onload = () => {
      const H0 = window.TEX_HI || {};
      for (const k of Object.keys(H0)) {
        const t = texCache[k]; if (!t) continue;
        const img = new Image();
        img.onload = () => { t.image = img; t.needsUpdate = true; if (k === 'day') { if (mode === 'hangar') readDayPixels(img); else hiDayPending = img; } };
        img.src = H0[k];
      }
    };
    document.body.appendChild(sc);
  }
  function readDayPixels(img) {
    try {
      const c = document.createElement('canvas'); c.width = 2048; c.height = 1024;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, 2048, 1024);
      dayPixels = g.getImageData(0, 0, 2048, 1024).data;
      texLoaded = true;
      if (curSite) rebuildSiteCap(curSite);
    } catch (e) { dayPixels = null; }
  }
  function sampleDay(lat, lon) {
    if (!dayPixels) return null;
    let u = ((lon + 180) / 360) % 1; if (u < 0) u += 1;
    const v = clamp((90 - lat) / 180, 0, 0.9999);
    const x = Math.floor(u * 2048), y = Math.floor(v * 1024), i = (y * 2048 + x) * 4;
    return [dayPixels[i] / 255, dayPixels[i + 1] / 255, dayPixels[i + 2] / 255];
  }
  const LOGV = `#include <common>
    #include <logdepthbuf_pars_vertex>`;
  function buildEarth() {
    const day = loadTex('day', true), night = loadTex('night', true), water = loadTex('water'), cl = loadTex('clouds');
    const mat = new T.ShaderMaterial({
      uniforms: { dayMap: { value: day }, nightMap: { value: night }, waterMap: { value: water }, sunDir: { value: SUN } },
      vertexShader: `${LOGV}
        varying vec2 vUv; varying vec3 vN; varying vec3 vW;
        void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform sampler2D dayMap; uniform sampler2D nightMap; uniform sampler2D waterMap; uniform vec3 sunDir;
        varying vec2 vUv; varying vec3 vN; varying vec3 vW;
        void main(){
          vec3 N = normalize(vN); float d = dot(N, sunDir);
          vec3 dayC = texture2D(dayMap, vUv).rgb;
          float lit = clamp(d * 1.15 + 0.04, 0.0, 1.0);
          vec3 col = dayC * (lit * 1.25 + 0.006);
          vec3 tw = mix(vec3(1.0), vec3(1.0, 0.62, 0.42), smoothstep(0.3, 0.0, d) * step(-0.05, d) * 0.55);
          col *= tw;
          float nf = smoothstep(0.06, -0.18, d);
          vec3 nl = texture2D(nightMap, vUv).rgb;
          col += nl * nl * nf * vec3(1.0, 0.78, 0.48) * 2.2;
          float wat = texture2D(waterMap, vUv).r;
          vec3 V = normalize(cameraPosition - vW);
          vec3 Hh = normalize(sunDir + V);
          float spec = pow(max(dot(N, Hh), 0.0), 70.0) * wat * step(0.0, d);
          col += vec3(1.0, 0.92, 0.8) * spec * 0.9;
          float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
          col += vec3(0.22, 0.42, 0.95) * rim * clamp(d + 0.25, 0.0, 1.0) * 0.55;
          gl_FragColor = vec4(col, 1.0);
          #include <logdepthbuf_fragment>
        }`,
    });
    earth = new T.Mesh(new T.SphereGeometry(RE - 160, 384, 192), mat);
    earthGroup.add(earth);
    const cmat = new T.ShaderMaterial({
      uniforms: { map: { value: cl }, sunDir: { value: SUN } },
      vertexShader: `${LOGV}
        varying vec2 vUv; varying vec3 vN;
        void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform sampler2D map; uniform vec3 sunDir; varying vec2 vUv; varying vec3 vN;
        void main(){ float a = texture2D(map, vUv).r; float d = dot(normalize(vN), sunDir);
          float lit = clamp(d * 1.3 + 0.08, 0.02, 1.0);
          vec3 c = mix(vec3(1.0, 0.7, 0.5), vec3(1.0), smoothstep(0.0, 0.3, d)) * lit;
          gl_FragColor = vec4(c, a * 0.92);
          #include <logdepthbuf_fragment>
        }`,
      transparent: true, depthWrite: false,
    });
    clouds = new T.Mesh(new T.SphereGeometry(RE + 7000, 256, 128), cmat);
    earthGroup.add(clouds);
    const atmoMat = new T.ShaderMaterial({
      uniforms: { sun: { value: SUN } },
      vertexShader: `${LOGV}
        varying vec3 vN; varying vec3 vV; varying vec3 vWN;
        void main(){ vN = normalize(normalMatrix*normal); vWN = normalize(mat3(modelMatrix)*normal);
          vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix*mv;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform vec3 sun; varying vec3 vN; varying vec3 vV; varying vec3 vWN;
        void main(){ float f = 1.0 - abs(dot(vN, vV)); float i = pow(f, 6.0) * 0.6;
          float day = clamp(dot(vWN, sun)*1.3+0.3, 0.0, 1.0);
          vec3 col = mix(vec3(0.25,0.5,1.0), vec3(0.6,0.82,1.0), f)*day;
          gl_FragColor = vec4(col*i*1.6, i);
          #include <logdepthbuf_fragment>
        }`,
      side: T.BackSide, blending: T.AdditiveBlending, transparent: true, depthWrite: false,
    });
    atmo = new T.Mesh(new T.SphereGeometry(RE * 1.014, 128, 64), atmoMat);
    earthGroup.add(atmo);
    // yıldızlar
    const sg = new T.BufferGeometry(), N = 5000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 1e9, s = Math.sqrt(1 - u * u);
      pos[i * 3] = r * s * Math.cos(th); pos[i * 3 + 1] = r * u; pos[i * 3 + 2] = r * s * Math.sin(th);
      const b = 0.35 + Math.random() ** 3 * 0.9, tint = Math.random();
      col[i * 3] = b * (tint > 0.8 ? 1 : 0.85); col[i * 3 + 1] = b * 0.9; col[i * 3 + 2] = b * (tint < 0.3 ? 1 : 0.85);
    }
    sg.setAttribute('position', new T.BufferAttribute(pos, 3));
    sg.setAttribute('color', new T.BufferAttribute(col, 3));
    stars = new T.Points(sg, new T.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false }));
    stars.frustumCulled = false;
    scene.add(stars);
    const sc = document.createElement('canvas'); sc.width = sc.height = 128;
    const g = sc.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.12, 'rgba(255,240,200,0.85)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    sunSprite = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(sc), blending: T.AdditiveBlending, depthWrite: false, fog: false, color: 0xffffff }));
    sunSprite.scale.set(9e7, 9e7, 1);
    scene.add(sunSprite);
  }

  /* --- Yerel yüzey parçası (eğrisel kapak) --- */
  function capGeometry(radius, rings, segs, colorFn) {
    const pos = [], col = [], idx = [];
    pos.push(0, 0, 0); const c0 = colorFn(0, 0, 0); col.push(c0[0] ** 2.2, c0[1] ** 2.2, c0[2] ** 2.2);
    for (let i = 1; i <= rings; i++) {
      const s = radius * Math.pow(i / rings, 2.3);
      const a = s / RE;
      for (let j = 0; j < segs; j++) {
        const ph = j / segs * Math.PI * 2;
        const e = Math.sin(a) * RE * Math.cos(ph), n = Math.sin(a) * RE * Math.sin(ph);
        pos.push(e, RE * Math.cos(a) - RE, n);
        const c = colorFn(s * Math.cos(ph), s * Math.sin(ph), s);
        col.push(c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2);
      }
    }
    for (let j = 0; j < segs; j++) idx.push(0, 1 + (j + 1) % segs, 1 + j);
    for (let i = 1; i < rings; i++) {
      const b0 = 1 + (i - 1) * segs, b1 = 1 + i * segs;
      for (let j = 0; j < segs; j++) { const j1 = (j + 1) % segs; idx.push(b0 + j, b0 + j1, b1 + j, b0 + j1, b1 + j1, b1 + j); }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  /* --- Gerçek kıyı şeridi (enlem → boylam tabloları, yaklaşık) --- */
  const COAST = {
    cape: {
      shift: 1900, // oyun için rampa ~1.9 km iç kesime alındı (LZ'ler karada kalsın)
      coast: [[28.10, -80.57], [28.20, -80.590], [28.30, -80.603], [28.40, -80.598], [28.42, -80.585], [28.44, -80.556], [28.46, -80.528], [28.48, -80.535], [28.52, -80.552], [28.56, -80.566], [28.60, -80.585], [28.65, -80.620], [28.70, -80.655], [28.75, -80.697], [28.80, -80.745], [28.95, -80.84]],
      water: [
        // Banana River
        { lat: [28.10, 28.645], e: [[28.10, -80.598], [28.2, -80.605], [28.3, -80.616], [28.40, -80.612], [28.44, -80.600], [28.50, -80.591], [28.56, -80.598], [28.62, -80.615], [28.645, -80.640]], w: [[28.10, -80.625], [28.2, -80.640], [28.3, -80.655], [28.40, -80.655], [28.50, -80.650], [28.56, -80.655], [28.62, -80.655], [28.645, -80.645]] },
        // Indian River
        { lat: [28.05, 28.95], e: [[28.05, -80.63], [28.2, -80.660], [28.35, -80.700], [28.45, -80.705], [28.56, -80.705], [28.65, -80.712], [28.75, -80.725], [28.95, -80.80]], w: [[28.05, -80.67], [28.2, -80.700], [28.35, -80.730], [28.45, -80.745], [28.56, -80.760], [28.65, -80.790], [28.75, -80.800], [28.95, -80.85]] },
        // Mosquito Lagoon
        { lat: [28.66, 28.95], e: [[28.66, -80.640], [28.75, -80.690], [28.85, -80.75], [28.95, -80.82]], w: [[28.66, -80.660], [28.75, -80.730], [28.85, -80.79], [28.95, -80.835]] },
        // Port Canaveral kanalı
        { lat: [28.405, 28.415], e: [[28.405, -80.59], [28.415, -80.59]], w: [[28.405, -80.64], [28.415, -80.64]] },
      ],
      land: [0.16, 0.30, 0.12], land2: [0.30, 0.34, 0.18], sand: [0.62, 0.58, 0.44],
    },
    starbase: {
      shift: 500,
      coast: [[25.70, -97.16], [25.80, -97.150], [25.90, -97.142], [25.957, -97.145], [26.00, -97.150], [26.05, -97.155], [26.07, -97.160], [26.15, -97.168], [26.30, -97.180], [26.50, -97.25]],
      water: [
        // South Bay / Laguna Madre
        { lat: [25.99, 26.50], e: [[25.99, -97.190], [26.02, -97.176], [26.06, -97.172], [26.072, -97.170], [26.10, -97.172], [26.3, -97.190], [26.5, -97.27]], w: [[25.99, -97.200], [26.02, -97.225], [26.06, -97.215], [26.08, -97.210], [26.10, -97.220], [26.3, -97.330], [26.5, -97.38]] },
        // Brazos Santiago geçidi
        { lat: [26.066, 26.074], e: [[26.066, -97.150], [26.074, -97.150]], w: [[26.066, -97.175], [26.074, -97.175]] },
      ],
      river: true,
      land: [0.40, 0.37, 0.26], land2: [0.50, 0.45, 0.32], sand: [0.74, 0.68, 0.52], flats: [0.58, 0.54, 0.42],
    },
  };
  function tableAt(tab, lat) {
    if (lat <= tab[0][0]) return tab[0][1];
    for (let i = 1; i < tab.length; i++) if (lat <= tab[i][0]) { const a = tab[i - 1], b = tab[i]; return lerp(a[1], b[1], (lat - a[0]) / (b[0] - a[0])); }
    return tab[tab.length - 1][1];
  }
  // 0 = kara, 1 = okyanus, 2 = lagün/nehir; d = kıyıya uzaklık (m)
  function surfaceClass(site, e, north) {
    const s0 = SITES[site] || SITES.cape, C = COAST[site] || COAST.cape;
    const kx = 111320 * Math.cos(s0.lat * D2R), ky = 110574;
    const lat = s0.lat + north / ky, lon = s0.lon + (e - C.shift) / kx;
    const cl = tableAt(C.coast, lat);
    const dc = (lon - cl) * kx;
    if (dc > 0) return { k: 1, d: dc };
    let best = -dc;
    for (const w of C.water) {
      if (lat < w.lat[0] || lat > w.lat[1]) continue;
      const le = tableAt(w.e, lat), lw = tableAt(w.w, lat);
      if (lon < le && lon > lw) return { k: 2, d: Math.min(le - lon, lon - lw) * kx };
      best = Math.min(best, Math.abs(lon - le) * kx, Math.abs(lon - lw) * kx);
    }
    if (C.river) {
      // Rio Grande: güney sınırında kıvrımlı nehir
      const rl = 25.957 + 0.006 * Math.sin((lon + 97.15) * 260) - 0.02 * Math.max(0, -(lon + 97.15)) * 4;
      const dr = Math.abs(lat - rl) * ky;
      if (dr < 55 && lon < cl) return { k: 2, d: 55 - dr };
      best = Math.min(best, dr - 55);
    }
    return { k: 0, d: best, lat, lon };
  }
  function siteColorFn(site) {
    const s0 = SITES[site] || SITES.cape, C = COAST[site] || COAST.cape;
    return (e, z, s) => {
      const north = -z;
      // uzak bölge: gerçek doku
      let far = null;
      if (s > 25000 && dayPixels) {
        const d = s / RE, th = Math.atan2(e, north), la1 = s0.lat * D2R, lo1 = s0.lon * D2R;
        const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(th));
        const lo2 = lo1 + Math.atan2(Math.sin(th) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
        far = sampleDay(la2 / D2R, lo2 / D2R);
      }
      const sc = surfaceClass(site, e, north);
      const nz = vnoise(e / 900, north / 900, 3.3) * 0.6 + vnoise(e / 160, north / 160, 8.1) * 0.4;
      let c;
      if (sc.k === 1) { const dpt = clamp(sc.d / 30000, 0, 1); const sh = clamp(sc.d / 900, 0, 1); c = [lerp(0.2, lerp(0.07, 0.02, dpt), sh), lerp(0.36, lerp(0.25, 0.09, dpt), sh), lerp(0.38, lerp(0.32, 0.2, dpt), sh)]; }
      else if (sc.k === 2) { const sh = clamp(sc.d / 300, 0, 1); c = [lerp(0.14, 0.06, sh), lerp(0.26, 0.19, sh), lerp(0.24, 0.22, sh)]; }
      else {
        c = [lerp(C.land[0], C.land2[0], nz), lerp(C.land[1], C.land2[1], nz), lerp(C.land[2], C.land2[2], nz)];
        const sw = 1 - clamp((sc.d - 60) / 520, 0, 1);
        if (sw > 0) c = [lerp(c[0], C.sand[0], sw), lerp(c[1], C.sand[1], sw), lerp(c[2], C.sand[2], sw)];
        if (C.flats) { const fl = vnoise(e / 2500 + 4, north / 2500, 2.2); if (fl > 0.6) { const k = clamp((fl - 0.6) * 4, 0, 1); c = [lerp(c[0], C.flats[0], k), lerp(c[1], C.flats[1], k), lerp(c[2], C.flats[2], k)]; } }
        else if (sc.d > 600 && vnoise(e / 3000, north / 3000, 6.6) > 0.7) c = [c[0] * 0.75, c[1] * 0.9, c[2] * 0.7];
      }
      if (far) { const w = clamp((s - 30000) / 50000, 0, 1); c = [lerp(c[0], far[0], w), lerp(c[1], far[1], w), lerp(c[2], far[2], w)]; }
      return c;
    };
  }
  const oceanColor = (e, n) => { const nz = vnoise(e / 700, n / 700, 5.5); return [0.03 + nz * 0.02, 0.1 + nz * 0.04, 0.2 + nz * 0.05]; };
  const waveNormal = MD.canvasTex(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const f = (a, b) => Math.sin(a * 0.15 + b * 0.05) * 0.5 + Math.sin(a * 0.07 - b * 0.21) * 0.3 + Math.sin((a + b) * 0.33) * 0.2;
      const dx = f(x + 1, y) - f(x - 1, y), dy = f(x, y + 1) - f(x, y - 1);
      const i = (y * w + x) * 4; img.data[i] = 128 + dx * 90; img.data[i + 1] = 128 + dy * 90; img.data[i + 2] = 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { color: false, repeat: [600, 600] });

  let siteCap, shipCap, falconPad, starTower, starTower2, starExtras, lzPads = [], droneShipV, fairingShipV;
  function rebuildSiteCap(site) {
    if (!siteCap) return;
    const old = siteCap.geometry;
    siteCap.geometry = capGeometry(170000, 170, 260, siteColorFn(site));
    old.dispose();
  }
  function buildSites() {
    siteCap = new T.Mesh(capGeometry(170000, 170, 260, siteColorFn('cape')), new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
    siteCap.receiveShadow = true; scene.add(siteCap);
    shipCap = new T.Mesh(capGeometry(90000, 80, 120, oceanColor), new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.15, normalMap: waveNormal, normalScale: new T.Vector2(0.4, 0.4) }));
    shipCap.visible = false; shipCap.receiveShadow = true; scene.add(shipCap);
    falconPad = MD.falconPad(); scene.add(falconPad.g);
    for (const d of [1100, 1400, 1700]) { const g = MD.landingZone(); g.userData.d = d; lzPads.push(g); scene.add(g); }
    starTower = MD.mechazilla(98, true); scene.add(starTower.g);
    starTower2 = MD.mechazilla(98, false); scene.add(starTower2.g);
    starExtras = MD.starbaseExtras(); scene.add(starExtras);
    droneShipV = MD.droneShip('YÖRÜNGE AĞI I'); droneShipV.g.visible = false; scene.add(droneShipV.g);
    fairingShipV = MD.fairingShip(); fairingShipV.g.visible = false; scene.add(fairingShipV.g);
  }
  function setSite(site) {
    const key = site === 'starbase' ? 'starbase' : 'cape';
    earthGroup.quaternion.copy(siteQuat(key));
    if (curSite !== key) { curSite = key; rebuildSiteCap(key); }
  }
  function placeSurface(obj, d, h, yaw) {
    const p = surfacePoint(d, h);
    placeAt(obj, p[0], p[1], 0);
    obj.rotation.set(0, yaw || 0, p[2] - Math.PI / 2, 'ZYX');
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
      const seed = new Float32Array(max); for (let i = 0; i < max; i++) seed[i] = Math.random();
      g.setAttribute('seed', new T.BufferAttribute(seed, 1));
      this.geo = g;
      this.mat = new T.ShaderMaterial({
        uniforms: { scale: { value: innerHeight / (2 * Math.tan(55 * Math.PI / 360)) }, tint: { value: new T.Color(1, 1, 1) } },
        vertexShader: `#include <common>
          #include <logdepthbuf_pars_vertex>
          attribute float size; attribute vec4 color; attribute float seed; varying vec4 vC; varying float vS; uniform float scale;
          void main(){ vC = color; vS = seed; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv;
            gl_PointSize = size > 0.0 ? clamp(size*scale/max(0.1,-mv.z), 1.0, 1500.0) : 0.0;
            #include <logdepthbuf_vertex>
          }`,
        fragmentShader: `#include <common>
          #include <logdepthbuf_pars_fragment>
          varying vec4 vC; varying float vS; uniform vec3 tint;
          float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float nn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
            return mix(mix(hh(i), hh(i+vec2(1.0,0.0)), f.x), mix(hh(i+vec2(0.0,1.0)), hh(i+vec2(1.0,1.0)), f.x), f.y); }
          float fb(vec2 p){ float a = 0.0, w = 0.5; for (int k = 0; k < 4; k++) { a += w * nn(p); p *= 2.07; w *= 0.5; } return a; }
          void main(){ vec2 c = gl_PointCoord-0.5;
            float an = vS * 6.2831; c = mat2(cos(an), -sin(an), sin(an), cos(an)) * c;
            float d = length(c)*2.0; if(d>1.0) discard;
            float n = fb(c * 3.2 + vS * 37.0);
            ${additive
              ? 'float a = (1.0-d*d); a *= a * (0.55 + 0.9 * n); gl_FragColor = vec4(vC.rgb*vC.a*a, 1.0);'
              : 'float a = smoothstep(1.0, 0.2, d + (n - 0.5) * 0.85); float sh = 0.78 + 0.45 * (n - 0.45) - c.y * 0.3; gl_FragColor = vec4(vC.rgb * tint * sh, vC.a * a);'}
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
      if (QUAL.part < 1 && Math.random() > QUAL.part) return;
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



  /* ================= ROKET GÖRSELLERİ ================= */
  let mission = null, ctxCur = null, vis = new Map(), debris = [], sats3d = [], camFocusId = null;
  let fairingAll = [], payloadMesh = null, payloadTop = 0;
  const trails = new Map();

  function withPlume(pv) {
    pv.plume = makePlume(pv.engineType, pv.plumeR, pv.plumeL);
    return pv;
  }
  function buildMissionVisuals(m, ctx) {
    const d = m.def, st = d.stages, P0 = ctx.plan;
    const fl = id => (ctx.flights && ctx.flights[id]) || 0;
    const cores = P0.cores || [];
    const ti = P.has('m_block5');
    for (const p of m.stack.parts) {
      if (p.role === 'booster') {
        const core = d.key === 'fh' ? cores[2] : cores[0];
        const flights = core ? fl(core.id) : 0;
        if (d.key === 'ss') p.vis = withPlume(MD.superHeavy(st[0], { flights }));
        else p.vis = withPlume(MD.falconBooster(st[0], { flights, fins: m.mode !== 'exp' || d.key !== 'f1', legs: m.mode === 'rtls' || m.mode === 'asds' || (d.key === 'f1' && m.mode !== 'exp'), titanium: ti }));
        if (core) p.vis.serial = core.id;
      } else if (p.role === 'upper') {
        p.vis = withPlume(d.key === 'ss' ? MD.ship(st[1], { flights: P0.ship ? P0.ship.flights : 0 }) : MD.falconUpper(st[1], d.key === 'f1'));
      } else if (p.role === 'sideL' || p.role === 'sideR') {
        const core = p.role === 'sideL' ? cores[0] : cores[1];
        p.vis = withPlume(MD.falconBooster(d.sides, { nose: true, side: true, flights: core ? fl(core.id) : 0, fins: m.sideMode !== 'exp', legs: m.sideMode !== 'exp', titanium: ti, sideAttach: p.role === 'sideL' ? 1 : -1 }));
      }
    }
    fairingAll = []; payloadMesh = null;
    const kind = P0.kind;
    if (kind === 'dragon') {
      const dv = MD.dragon(P0.contract && P0.contract.type === 'crew');
      payloadMesh = dv.g;
    } else if (m.fairingMass) {
      const fr = d.key === 'f1' ? 0.75 : 2.6;
      fairingAll = MD.fairingHalves(fr, d.payloadLen);
      if (kind === 'starlink') payloadMesh = MD.payloadStack(m.satsPlanned, d.key === 'f1' ? 0.9 : 2.6, d.payloadLen * 0.55);
      else {
        const g = new T.Group();
        const w = d.key === 'f1' ? 0.8 : 2.4;
        const body = new T.Mesh(new T.BoxGeometry(w, d.payloadLen * 0.45, w), MD.M.alu); body.position.y = d.payloadLen * 0.25; g.add(body);
        const foil = new T.Mesh(new T.BoxGeometry(w * 1.02, d.payloadLen * 0.2, w * 1.02), new T.MeshStandardMaterial({ color: 0xd4a43a, metalness: 0.9, roughness: 0.3 })); foil.position.y = d.payloadLen * 0.35; g.add(foil);
        payloadMesh = g;
      }
    }
  }
  function craftGroup(c) {
    let v = vis.get(c.id);
    if (v) return v;
    const g = new T.Group(); scene.add(g);
    v = { g, craft: c };
    if (c.type === 'fairing') {
      const h = c.side < 0 ? fairingAll[1] : fairingAll[0];
      if (h) { g.add(h); h.position.set(0, 0, 0); v.fairing = h; }
    }
    vis.set(c.id, v);
    return v;
  }
  function attach(v, pv, x, y) {
    if (!pv || !pv.g) return;
    if (pv.g.parent !== v.g) v.g.add(pv.g);
    pv.g.position.set(x, y, 0);
    if (pv.plume && pv.plume.parent !== pv.g) { pv.g.add(pv.plume); pv.plume.position.y = pv.plumeY || 0; }
  }
  function layoutCraft(v) {
    const c = v.craft, d = mission.def;
    let y = 0;
    const booster = c.parts.find(p => p.role === 'booster');
    const upper = c.parts.find(p => p.role === 'upper');
    if (booster) { attach(v, booster.vis, 0, 0); y = booster.def.len; }
    for (const p of c.parts) {
      if (p.role === 'sideL' || p.role === 'sideR') {
        const off = c.type === 'side' ? 0 : (p.role === 'sideL' ? -1 : 1) * (d.sides.dia + 0.45);
        attach(v, p.vis, off, 0);
      }
    }
    if (upper) {
      attach(v, upper.vis, 0, y);
      const top = y + upper.def.len;
      payloadTop = top;
      if (payloadMesh && !mission.deployed) attach(v, { g: payloadMesh }, 0, top);
      if (!mission.fairingDone) for (const h of fairingAll) attach(v, { g: h }, 0, top);
    }
    v.layoutKey = layoutKeyOf(c);
  }
  const layoutKeyOf = c => c.parts.map(p => p.role).join(',') + (mission.fairingDone ? 'F' : '') + (mission.deployed ? 'D' : '');

  function syncVisuals(dtReal, time) {
    const m = mission; if (!m) return;
    const ids = new Set();
    const night = sunElevAt(F) < 0.02;
    let bestThr = 0, bestPos = null, bestCol = null;
    for (const c of m.crafts) {
      ids.add(c.id);
      const v = craftGroup(c);
      if (v.layoutKey !== layoutKeyOf(c)) layoutCraft(v);
      v.g.visible = c.alive;
      if (!c.alive) continue;
      const e = toEF(c.x, c.y);
      v.ef = e;
      placeAt(v.g, e[0], e[1], 0);
      v.g.rotation.set(0, 0, c.dir + efRot() - Math.PI / 2);
      if (c.caught) {
        v.settle = Math.min(1, (v.settle || 0) + dtReal * 0.6);
        const s = v.settle;
        v.g.translateY(-1.6 * Math.min(1, s * 1.6));
        if (s < 0.7) v.g.translateX(Math.sin(time * 40) * 0.08 * (1 - s));
      }
      if (c.tipped) {
        v.tip = (v.tip || 0) + dtReal;
        if (v.tipDir === undefined) v.tipDir = Math.random() < 0.5 ? -1 : 1;
        v.g.rotateX(v.tipDir * Math.min(1.5, v.tip * v.tip * 0.35));
        if (v.tip > 2.5 && v.tip < 2.6) { const p0 = surfacePoint(c.downrange(), 4); for (let i = 0; i < 40; i++) smokeP.spawn(p0[0] + rnd(-10, 10), p0[1], rnd(-10, 10), rnd(-5, 5), rnd(2, 8), rnd(-5, 5), rnd(2, 5), 5, 25, [0.9, 0.92, 0.95], [0.8, 0.82, 0.85], 0.6, 0, 0.5, 0); }
      }
      if (c.splashed) {
        v.splash = (v.splash || 0) + dtReal;
        const s = v.splash;
        v.g.translateY(-Math.min(30, Math.max(0, s - 6) * 1.5));
        v.g.rotateZ(Math.min(1.45, s * 0.35));
        if (s < 8 && Math.random() < 0.5) { const p0 = surfacePoint(c.downrange(), 0); smokeP.spawn(p0[0] + rnd(-8, 8), p0[1], rnd(-8, 8), 0, 3, 0, rnd(2, 4), 6, 22, [0.9, 0.92, 0.95], [0.8, 0.82, 0.85], 0.5, 0, 0.5, 0); }
        if (s > 30) v.g.visible = false;
      }
      const h = c.alt();
      const pr = S.pres(h);
      for (const p of c.parts) {
        const pv = p.vis; if (!pv) continue;
        const thr = p.firing && p.prop > 0 && !c.landed && !c.caught ? c.throttle * p.engFrac * p.cap * (p.health || 1) : 0;
        const eff = p.engFrac < 1 ? Math.sqrt(p.engFrac) : 1;
        updatePlume(pv.plume, thr > 0 ? Math.max(0.25, Math.min(1, thr / (p.def.landThrFrac && c.state === 'final' ? p.def.landThrFrac : 1))) : 0, pr, time);
        if (pv.plume && thr > 0) pv.plume.scale.set(eff, 1, eff);
        if (pv.bell) { const tgt = thr > 0 && h > 40000 ? 1 : 0; pv.bellHeat = lerp(pv.bellHeat || 0, tgt, dtReal * 0.4); pv.bell.emissive.setRGB(1, 0.35, 0.1); pv.bell.emissiveIntensity = pv.bellHeat * 2.5; }
        if (pv.fins && pv.fins.length) {
          const tgt = c.finsOut || (c.rec && c.type !== 'upper') ? 1 : 0;
          pv.finT = lerp(pv.finT || 0, tgt, Math.min(1, dtReal * 2.5));
          for (const f of pv.fins) f.rotation.z = -pv.finT * Math.PI / 2;
        }
        if (pv.legs && pv.legs.length) {
          const tgt = c.legsOut ? 1 : 0;
          pv.legT = lerp(pv.legT || 0, tgt, Math.min(1, dtReal * 1.4));
          for (const l of pv.legs) l.rotation.z = -pv.legT * 108 * Math.PI / 180;
        }
        if (pv.flaps && c.ship) {
          const act = c.state === 'reentry' || (c.state === 'final' && !c.burnLit);
          for (let i = 0; i < pv.flaps.length; i++) pv.flaps[i].rotation.x = act ? Math.sin(time * 1.3 + i) * 0.18 : 0;
        }
        const heat = clamp((c.heat - 4e7) / 6e8, 0, 1) * (c.ship ? 0.25 : 1);
        for (const mt of pv.mats) { if (!mt.emissive || mt === pv.bell) continue; mt.emissive.setRGB(1.0, 0.32, 0.08); mt.emissiveIntensity = heat * 2.2; }
        if (thr > 0) {
          emitExhaust(c, p, v, thr, h, dtReal);
          const w = thr * (p.def.thrVac / 8e6);
          if (w > bestThr && v.g.position.length() < 3000) { bestThr = w; const ax = axisOf(v); bestPos = [e[0] - ax[0] * 8, e[1] - ax[1] * 8]; bestCol = pv.engineType === 'raptor' ? 0xb0a0ff : 0xffa860; }
        }
      }
      if (c.heat > 6e7 && c.alive && !c.landed) emitPlasma(c, v, dtReal);
      if (v.fairing && c.chute && !v.chute) { v.chute = MD.parachute(); v.chute.position.y = 4; v.g.add(v.chute); }
      if (v.chute) { v.chute.rotation.z = -v.g.rotation.z + (c.upAng() + efRot()) - Math.PI / 2; }
      let tr = trails.get(c.id);
      if (!tr) { tr = { pts: [], last: -1e9, name: c.name, type: c.type }; trails.set(c.id, tr); }
      if (m.t - tr.last > 1) { tr.last = m.t; tr.pts.push([c.downrange(), Math.max(0, h), e[0], e[1]]); if (tr.pts.length > 4000) tr.pts.shift(); }
    }
    for (const [id, v] of vis) if (!ids.has(id)) { scene.remove(v.g); vis.delete(id); }
    // motor ışığı (geceleri zemini aydınlatır)
    if (bestPos) {
      engineLight.color.set(bestCol);
      engineLight.intensity = Math.min(60000, 9000 * bestThr) * (night ? 1 : 0.2);
      engineLight.position.set(bestPos[0] - F.x, bestPos[1] - F.y, -F.z);
    } else engineLight.intensity = 0;
    // yakalama kolları
    const armAnim = (tw, kind) => {
      if (!tw) return;
      const b = m.crafts.find(c => c.rec && c.rec.kind === kind);
      let tgt = 1;
      if (b && b.caught) tgt = 0;
      else if (b && b.state === 'final' && b.alt() < 3000) tgt = 1.25;
      tw.open = lerp(tw.open === undefined ? 1 : tw.open, tgt, Math.min(1, dtReal * (tgt === 0 ? 3.0 : 0.8)));
      for (const a of tw.arms) a.rotation.y = a.userData.side * tw.open * 0.6;
    };
    if (m.key === 'ss') { armAnim(starTower, 'catch'); armAnim(starTower2, 'shipcatch'); }
    // TE geri yatma (geri sayım)
    if (falconPad.anim.te) falconPad.anim.te.rotation.z = m.t > -6 ? Math.min(0.32, (m.t + 6) * 0.12) : 0;
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
    // duman izi (atmosferde) — iniş yanışında çok daha az
    const desc = c.rec && c.vUp() < 0;
    if (rr > 0.002 && !(desc && Math.random() < 0.8)) {
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
    jellyfish(c, v, thr, h, dt);
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
    const lead = c.ship && c.state !== 'final' ? null : ((ax[0] * fx + ax[1] * fy) > 0 ? c.length : 0);
    const big = mission.key === 'ss' ? 2.5 : 1;
    const n = Math.ceil(k * 6 * dt * 60);
    for (let i = 0; i < n; i++) {
      const L0 = lead === null ? Math.random() * c.length : lead;
      const px = e[0] + ax[0] * L0 + fx * 5 + rnd(-2, 2) * big, py = e[1] + ax[1] * L0 + fy * 5 + rnd(-2, 2) * big;
      const sp = rnd(120, 380);
      fireP.spawn(px, py, rnd(-2, 2) * big, -fx * sp, -fy * sp, rnd(-15, 15), rnd(0.2, 0.6), 3 * big, 12 * big,
        [1, 0.6, 0.85], [1, 0.25, 0.05], 0.5 + 0.5 * k, 0, 1.5, 0);
    }
  }

  /* --- Patlama ve parçalanma --- */
  function explodeFX(c, why, reentry) {
    const v = vis.get(c.id);
    c.deadEF = toEF(c.x, c.y); c.deadDir = c.dir + efRot();
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
      const mat = (srcMats[Math.floor(Math.random() * srcMats.length)] || MD.M.white).clone();
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
    scheduleBlasts(mid, ax, big, vx * keep, vy * keep, inAir, c.length, reentry);
    if (v) v.g.visible = false;
    shake = Math.max(shake, h < 2000 ? 1.4 : 0.6);
    audio.boom(h < 3000 ? 1 : 0.4, camDistTo(mid[0], mid[1], 0));
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



  /* --- Yük bırakma --- */
  function deploySatsFX(c, kind) {
    const v = vis.get(c.id); if (!v) return;
    const isSS = mission.key === 'ss';
    if (kind === 'starlink') {
      const n = Math.min(36, Math.max(2, mission.satsPlanned));
      const gen = ctxCur && ctxCur.plan.gen;
      for (let i = 0; i < n; i++) {
        const g = MD.satellite(gen);
        for (const p of g.userData.panels) p.scale.x = 0.05;
        g.position.set(isSS ? 4.6 : rnd(-1, 1), isSS ? 33 + rnd(-2, 2) : payloadTop + i * 0.3, rnd(-0.6, 0.6));
        v.g.add(g);
        sats3d.push({ g, t: -(isSS ? i * 0.6 : 0), vel: isSS ? [rnd(0.4, 0.9), rnd(-0.1, 0.1), rnd(-0.2, 0.2)] : [rnd(-0.3, 0.3), rnd(0.05, 0.6), rnd(-0.3, 0.3)], spin: [rnd(-0.2, 0.2), rnd(-0.2, 0.2), rnd(-0.2, 0.2)] });
      }
      if (payloadMesh) payloadMesh.visible = false;
    } else if (kind === 'dragon' && payloadMesh) {
      // Dragon ayrılır, burun kapağı açılır ve uzay istasyonuna yanaşır
      const g = payloadMesh; payloadMesh = null;
      const iss = MD.station();
      iss.position.set(-45, payloadTop + 130, -60); iss.rotation.set(0, 0, -Math.PI / 2);
      v.g.add(iss);
      sats3d.push({ g, t: 0, vel: [0, 0, 0], spin: [0, 0, 0], dock: { iss, from: g.position.clone(), T: 32 }, keep: true });
      sats3d.push({ g: iss, t: 0, vel: [0, 0, 0], spin: [0, 0, 0], keep: true, life: 120 });
    } else if (payloadMesh) {
      // tek yük (röle / ticari uydu): kademeden ayrılıp uzaklaşır
      const g = payloadMesh; payloadMesh = null;
      sats3d.push({ g, t: 0, vel: [0, 0.5, 0], spin: [0, 0.02, 0], keep: true });
    }
  }
  function updateSats(dt) {
    for (let i = sats3d.length - 1; i >= 0; i--) {
      const s = sats3d[i]; s.t += dt;
      if (s.t < 0) { s.g.visible = false; continue; }
      s.g.visible = true;
      if (s.dock) {
        const d = s.dock, k = clamp(s.t / d.T, 0, 1), e = k * k * (3 - 2 * k);
        const port = d.iss.localToWorld(d.iss.userData.port.clone()); s.g.parent.worldToLocal(port);
        const tgt = port.clone().add(new T.Vector3(0, -8.1, 0).applyQuaternion(s.g.quaternion).multiplyScalar(0));
        s.g.position.lerpVectors(d.from, tgt, e);
        const lookDir = new T.Vector3().subVectors(port, d.from).normalize();
        s.g.quaternion.slerp(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), lookDir), Math.min(1, dt * 0.8));
        if (s.g.userData.nose) s.g.userData.nose.rotation.x = -Math.min(1.9, s.t * 0.4);
        if (k >= 1 && !d.done) { d.done = true; banner('DRAGON İSTASYONA KENETLENDİ', 'good'); log('Dragon uzay istasyonuna kenetlendi', 'good'); }
        if (s.t > 150) { s.g.parent && s.g.parent.remove(s.g); sats3d.splice(i, 1); }
        continue;
      }
      s.g.position.x += s.vel[0] * dt; s.g.position.y += s.vel[1] * dt; s.g.position.z += s.vel[2] * dt;
      s.g.rotation.x += s.spin[0] * dt; s.g.rotation.y += s.spin[1] * dt; s.g.rotation.z += s.spin[2] * dt;
      if (s.g.userData.panels) for (const p of s.g.userData.panels) { p.scale.x = clamp((s.t - 3) / 4, 0.05, 1); }
      if (s.t > 150) { s.g.parent && s.g.parent.remove(s.g); sats3d.splice(i, 1); }
    }
  }

  /* ================= TAKIMYILDIZ & AĞ (Dünya grubunda) ================= */
  const CMAX = 6000;
  let constPts, footPts, netLayer;
  const constData = [];
  function buildConstellation() {
    const mk = (size, color, add) => {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(new Float32Array(CMAX * 3), 3).setUsage(T.DynamicDrawUsage));
      const m = new T.ShaderMaterial({
        uniforms: { scale: { value: 1 }, size: { value: size }, color: { value: new T.Color(color) } },
        vertexShader: `${LOGV}
          uniform float scale; uniform float size;
          void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv;
            gl_PointSize = clamp(size*scale/max(1.0,-mv.z), 1.5, 600.0);
            #include <logdepthbuf_vertex>
          }`,
        fragmentShader: `#include <common>
          #include <logdepthbuf_pars_fragment>
          uniform vec3 color;
          void main(){ float d = length(gl_PointCoord-0.5)*2.0; if(d>1.0) discard;
            ${add ? 'float a = (1.0-d)*0.045; gl_FragColor = vec4(color*a, 1.0);' : 'gl_FragColor = vec4(color*1.4, smoothstep(1.0,0.3,d));'}
            #include <logdepthbuf_fragment>
          }`,
        transparent: true, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending,
      });
      const p = new T.Points(g, m); p.frustumCulled = false; p.renderOrder = 5; earthGroup.add(p); return p;
    };
    constPts = mk(45000, 0xffffff, false);
    footPts = mk(1.9e6, 0x3fd0ff, true);
    netLayer = new T.Group(); earthGroup.add(netLayer);
  }
  function rebuildConstData() {
    constData.length = 0;
    const st = P.state;
    let i = 0;
    for (const [sk, sh] of Object.entries(st.shells)) {
      const inc = P.SHELLS[sk].inc * D2R;
      for (const [g, n] of Object.entries(sh)) for (let k = 0; k < n && i < CMAX; k++, i++) {
        constData.push({ inc: inc * (1 + (hash3(i, 3, 3) - 0.5) * 0.02), raan: hash3(i, 1, 2) * Math.PI * 2, ph: hash3(i, 5, 9) * Math.PI * 2, r: RE + 540000 + (sk === 's97' ? 20000 : sk === 's70' ? 10000 : 0), big: g === 'v2m' || g === 'v3' });
      }
    }
  }
  function updateConstellation(time, show) {
    constPts.visible = footPts.visible = show && constData.length > 0;
    if (netLayer) netLayer.visible = show;
    if (!show) return;
    const n = constData.length;
    const pa = constPts.geometry.attributes.position.array, fa = footPts.geometry.attributes.position.array;
    for (let i = 0; i < n; i++) {
      const d = constData[i];
      const u = d.ph + Math.sqrt(S.MU / d.r ** 3) * 60 * time;
      const ci = Math.cos(d.inc), si = Math.sin(d.inc), cr = Math.cos(d.raan), sr = Math.sin(d.raan);
      // yerel çerçeve: kutup +Y, ekvator XZ
      const ax = cr, az = sr, bx = -sr * ci, by = si, bz = cr * ci;
      const cu = Math.cos(u), su = Math.sin(u);
      const x = ax * cu + bx * su, y = by * su, z = az * cu + bz * su;
      pa[i * 3] = x * d.r; pa[i * 3 + 1] = y * d.r; pa[i * 3 + 2] = z * d.r;
      const rr = RE + 4000;
      fa[i * 3] = x * rr; fa[i * 3 + 1] = y * rr; fa[i * 3 + 2] = z * rr;
    }
    constPts.geometry.setDrawRange(0, n); footPts.geometry.setDrawRange(0, n);
    constPts.geometry.attributes.position.needsUpdate = true; footPts.geometry.attributes.position.needsUpdate = true;
    const sc = innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360));
    constPts.material.uniforms.scale.value = sc; footPts.material.uniforms.scale.value = sc;
  }
  // bölge kapsama diskleri, yer istasyonları, GEO röleler
  function rebuildNetLayer() {
    if (!netLayer) return;
    while (netLayer.children.length) { const c = netLayer.children.pop(); c.geometry && c.geometry.dispose(); }
    const net = P.network();
    for (const r of net.regions) {
      const pos = localVec(r.lat, r.lon);
      if (r.cov < 0.02 && !r.station) continue;
      const col = r.served > 0.4 ? 0x3ee08f : 0xffc24a;
      const disc = new T.Mesh(new T.SphereGeometry(RE + 12000, 40, 6, 0, Math.PI * 2, 0, r.r * D2R), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.1 + 0.25 * Math.max(r.served, r.cov * 0.3), depthWrite: false }));
      disc.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), pos);
      netLayer.add(disc);
      if (r.station) {
        const s = new T.Mesh(new T.SphereGeometry(90000, 12, 8), new T.MeshBasicMaterial({ color: 0x4fc3ff }));
        s.position.copy(pos).multiplyScalar(RE + 20000); netLayer.add(s);
      }
    }
    const relayLon = { am: -75, emea: 15, apac: 120 };
    for (const [k, n] of Object.entries(P.state.relays)) if (n) {
      const p = localVec(0, relayLon[k]).multiplyScalar(RE + 35786000);
      const s = new T.Mesh(new T.OctahedronGeometry(400000), new T.MeshBasicMaterial({ color: 0xffd36b }));
      s.position.copy(p); netLayer.add(s);
      for (const r of net.regions) if (r.sector === k && r.station) {
        const q = localVec(r.lat, r.lon).multiplyScalar(RE);
        netLayer.add(new T.Line(new T.BufferGeometry().setFromPoints([p, q]), new T.LineBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.35 })));
      }
    }
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
    // Prosedürel ses: motor gürlemesi + çatırtı, ses hızında gecikme (Doppler), havada sönümlenme, rüzgâr, ses patlamaları
    let ctx = null, master, engDelay, engLP, rumLP, rumG, crG, engG, windG, muted = false;
    const SOS = 343;
    function noise(sec, kind) {
      const len = ctx.sampleRate * sec, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
        else if (kind === 'crackle') d[i] = w * (Math.random() < 0.025 ? 1 : 0.2);
        else d[i] = w;
      }
      return b;
    }
    function loop(buf) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; }
    function init() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain(); master.gain.value = muted ? 0 : 0.6; master.connect(ctx.destination);
        // motor zinciri
        const bus = ctx.createGain();
        rumLP = ctx.createBiquadFilter(); rumLP.type = 'lowpass'; rumLP.frequency.value = 180;
        rumG = ctx.createGain(); rumG.gain.value = 1;
        loop(noise(4, 'brown')).connect(rumLP); rumLP.connect(rumG); rumG.connect(bus);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.5;
        crG = ctx.createGain(); crG.gain.value = 0.4;
        loop(noise(3, 'crackle')).connect(bp); bp.connect(crG); crG.connect(bus);
        engDelay = ctx.createDelay(30); engDelay.delayTime.value = 0;
        engLP = ctx.createBiquadFilter(); engLP.type = 'lowpass'; engLP.frequency.value = 8000;
        engG = ctx.createGain(); engG.gain.value = 0;
        bus.connect(engDelay); engDelay.connect(engLP); engLP.connect(engG); engG.connect(master);
        // rüzgâr
        const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 900; hp.Q.value = 0.3;
        windG = ctx.createGain(); windG.gain.value = 0;
        loop(noise(3, 'white')).connect(hp); hp.connect(windG); windG.connect(master);
      } catch (e) { ctx = null; }
    }
    function engine(level, dist, raptor, air) {
      if (!ctx) return;
      const t = ctx.currentTime;
      engDelay.delayTime.setTargetAtTime(clamp(dist / SOS, 0, 28), t, 0.6);
      engLP.frequency.setTargetAtTime(clamp(9000 / (1 + dist / 900), 90, 9000) * (0.25 + 0.75 * air), t, 0.3);
      rumLP.frequency.setTargetAtTime(raptor ? 120 : 190, t, 0.5);
      crG.gain.setTargetAtTime(raptor ? 0.25 : 0.45, t, 0.5);
      engG.gain.setTargetAtTime(clamp(level, 0, 1.2), t, 0.15);
    }
    function wind(q) { if (ctx) windG.gain.setTargetAtTime(clamp(q / 35000, 0, 1) * 0.18, ctx.currentTime, 0.3); }
    function set(v) { if (ctx) engG.gain.setTargetAtTime(v, ctx.currentTime, 0.15); }
    function burst(v, dist, decay, freq, at) {
      if (!ctx) return;
      const len = ctx.sampleRate * Math.min(3, decay * 6), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * decay));
      const s = ctx.createBufferSource(); s.buffer = b;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = freq / (1 + dist / 3000);
      const g = ctx.createGain(); g.gain.value = v / (1 + dist / 2500);
      s.connect(lp); lp.connect(g); g.connect(master);
      s.start(ctx.currentTime + Math.min(25, dist / SOS) + (at || 0));
    }
    function boom(v, dist) { burst(v * 1.6, dist || 0, 0.5, 520); burst(v * 0.8, dist || 0, 1.2, 160, 0.05); }
    function sonic(dist) { for (let k = 0; k < 3; k++) burst(1.4, dist || 0, 0.05, 260, k * 0.33); }
    function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.6, ctx.currentTime, 0.05); }
    return { init, set, engine, wind, boom, sonic, setMuted, get muted() { return muted; } };
  })();
  // kameradan dünya noktasına uzaklık (EF koordinatı)
  const camDistTo = (x, y, z) => Math.hypot(x - F.x - camera.position.x, y - F.y - camera.position.y, (z || 0) - F.z - camera.position.z);
  function updateAudio() {
    if (!mission || mode !== 'flight' || cam.map) { audio.set(0); audio.wind(0); return; }
    let best = 0, bd = 0, br = false, bair = 1;
    for (const k of mission.crafts) {
      if (!k.alive || !k.thrust) continue;
      const v = vis.get(k.id); if (!v || !v.ef) continue;
      const d = camDistTo(v.ef[0], v.ef[1], 0);
      const air = clamp(S.rho(k.alt()) / 1.225 * 4, 0, 1);
      const onb = k.id === camFocusId && (cam.mode === 'onboard' || d < 400) ? 0.12 : 0;
      const lv = Math.min(1.2, Math.sqrt(k.thrust / 7e6)) * Math.max(air, onb) / (1 + d / 1500);
      if (lv > best) { best = lv; bd = d; br = mission.key === 'ss'; bair = air; }
    }
    audio.engine(best, bd, br, bair);
    const f = focusCraft();
    audio.wind(f && f.alive && (cam.mode === 'onboard' || cam.mode === 'chase') ? f.q : 0);
  }



  /* ================= KAMERA ================= */
  const cam = { yaw: 0.45, pitch: 0.08, dist: 120, tdist: 120, mapYaw: 0.6, mapPitch: 0.5, mapDist: RE * 3.4, map: false, mode: 'chase' };
  const CAM_MODES = ['chase', 'ground', 'tracker', 'onboard'];
  const CAM_NAMES = { chase: 'Takip kamerası', ground: 'Yer kamerası', tracker: 'Uzak takip (teleobjektif)', onboard: 'Araç üstü kamera' };
  let shake = 0, drag = null, pinch = null;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId || pinch) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (cam.map || mode === 'hangar') { cam.mapYaw -= dx * 0.005; cam.mapPitch = clamp(cam.mapPitch + dy * 0.005, -1.45, 1.45); }
    else { cam.yaw -= dx * 0.006; cam.pitch = clamp(cam.pitch + dy * 0.006, -1.4, 1.5); }
  });
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoom(Math.pow(1.0015, e.deltaY)); }, { passive: false });
  canvas.addEventListener('touchstart', e => { if (e.touches.length === 2) pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }, { passive: true });
  canvas.addEventListener('touchmove', e => { if (e.touches.length === 2 && pinch) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); zoom(pinch / d); pinch = d; } }, { passive: true });
  canvas.addEventListener('touchend', () => { pinch = null; });
  function zoom(k) {
    if (cam.map || mode === 'hangar') cam.mapDist = clamp(cam.mapDist * k, RE * 1.15, RE * 14);
    else cam.tdist = clamp(cam.tdist * k, 6, 4e6);
  }
  function craftAnchor(c) {
    if (!c.alive && !c.deadEF) { c.deadEF = toEF(c.x, c.y); c.deadDir = c.dir + efRot(); }
    const e = c.deadEF || toEF(c.x, c.y);
    const da = c.deadEF ? c.deadDir : c.dir + efRot();
    return { e, ax: [Math.cos(da), Math.sin(da)] };
  }
  function updateCamera(dtReal) {
    if (mode === 'hangar' || cam.map) {
      F.set(0, 0, 0);
      if (mode === 'hangar') cam.mapYaw += dtReal * 0.025;
      const d = cam.mapDist;
      camera.up.set(0, 0, 1);
      camera.position.set(Math.cos(cam.mapPitch) * Math.cos(cam.mapYaw) * d, Math.cos(cam.mapPitch) * Math.sin(cam.mapYaw) * d, Math.sin(cam.mapPitch) * d);
      camera.lookAt(0, 0, 0);
      if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); }
      return;
    }
    const c = focusCraft();
    let fx, fy, ax = [0, 1], L = 30;
    if (c) {
      const a = craftAnchor(c); ax = a.ax; L = c.length || 20;
      fx = a.e[0] + ax[0] * L * 0.45; fy = a.e[1] + ax[1] * L * 0.45;
      cam.lastF = [fx, fy];
    } else if (cam.lastF) { fx = cam.lastF[0]; fy = cam.lastF[1]; } else { fx = 0; fy = RE; }
    F.set(fx, fy, 0);
    cam.dist = lerp(cam.dist, cam.tdist, Math.min(1, dtReal * 4));
    const r = Math.hypot(fx, fy), up = [fx / r, fy / r], east = [up[1], -up[0]];
    let fov = 55;
    let mode2 = cam.mode;
    const h = r - RE;
    const dr = c ? c.downrange() : 0;
    // yer/teleobjektif kamera konumu (sabit yer noktası)
    let gp = null;
    if (mode2 === 'ground' || mode2 === 'tracker') {
      let d0, z0, h0;
      if (mode2 === 'ground') {
        if (mission.shipD !== undefined && Math.abs(dr - mission.shipD) < 15000) { d0 = mission.shipD - 260; z0 = 180; h0 = 12; }
        else if (Math.abs(dr) < 12000) { d0 = (c && c.rec && c.rec.kind === 'rtls') ? 1400 + 450 : (Math.abs(dr - 350) < 2000 && c && c.ship ? 700 : -420); z0 = 380; h0 = 3; }
      } else { d0 = Math.abs(dr) < 60000 ? -9000 : dr - 30000; z0 = 14000; h0 = 20; }
      if (d0 !== undefined) {
        const p = surfacePoint(d0, h0);
        gp = [p[0] - fx, p[1] - fy, z0];
      } else mode2 = 'chase';
    }
    let ox, oy, oz, upv = [up[0], up[1], 0];
    if (gp) {
      ox = gp[0]; oy = gp[1]; oz = gp[2];
      const dist = Math.hypot(ox, oy, oz);
      fov = clamp(2 * Math.atan(L * 1.8 / dist) / D2R, 0.4, 55);
    } else if (mode2 === 'onboard' && c && c.alive) {
      const side = [ax[1], -ax[0]];
      const rr = (c.type === 'stack' || c.type === 'booster' || c.type === 'upper') ? (mission.key === 'ss' ? 5.2 : mission.def.stages[0].dia / 2 + 0.6) : 2;
      ox = ax[0] * L * 0.42 + side[0] * rr * 0.2; oy = ax[1] * L * 0.42 + side[1] * rr * 0.2; oz = rr;
      camera.position.set(ox, oy, oz);
      camera.up.set(ax[0], ax[1], 0);
      camera.lookAt(-ax[0] * L * 3, -ax[1] * L * 3, 0);
      fov = 70;
      if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
      return;
    } else {
      const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch), cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
      ox = (east[0] * sy * cp + up[0] * sp) * cam.dist; oy = (east[1] * sy * cp + up[1] * sp) * cam.dist; oz = cy * cp * cam.dist;
      const camR = Math.hypot(fx + ox, fy + oy, oz);
      const minR = RE + 2;
      if (camR < minR) { const k = (minR - r) / cam.dist; ox = (east[0] * sy * cp + up[0] * Math.max(sp, k)) * cam.dist; oy = (east[1] * sy * cp + up[1] * Math.max(sp, k)) * cam.dist; }
    }
    if (shake > 0) { const s = shake * (gp ? 0.0 : 0.6); ox += rnd(-1, 1) * s; oy += rnd(-1, 1) * s; oz += rnd(-1, 1) * s; shake = Math.max(0, shake - dtReal * 0.8); if (gp) fov *= 1 + rnd(-1, 1) * shake * 0.01; }
    camera.position.set(ox, oy, oz);
    camera.up.set(upv[0], upv[1], 0);
    camera.lookAt(0, 0, 0);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    void h;
  }
  function focusCraft() { if (!mission) return null; return mission.crafts.find(c => c.id === camFocusId) || null; }
  function setFocus(c, keepDist) {
    if (!c) return;
    camFocusId = c.id; mission.focusId = c.id;
    if (!keepDist) cam.tdist = clamp((c.length || 30) * (c.type === 'fairing' ? 3 : 2.3), 15, 400);
  }

  /* ================= GÜNEŞ / GÖKYÜZÜ ================= */
  let sunHour = 10, sunWeek = 20;
  function updateSun() {
    const site = SITES[curSite || 'cape'];
    const doy = ((sunWeek - 1) % 52) * 7 + 3;
    const decl = 23.44 * Math.sin(2 * Math.PI * (doy - 81) / 365);
    const hour = mode === 'flight' && mission ? sunHour + Math.max(0, mission.t + 10) / 3600 : sunHour;
    const subLon = site.lon - (hour - 12) * 15;
    const v = localVec(decl, subLon).applyQuaternion(earthGroup.quaternion);
    SUN.copy(v).normalize();
  }
  function sunElevAt(pos) { const l = pos.length() || 1; return (pos.x * SUN.x + pos.y * SUN.y + pos.z * SUN.z) / l; }
  const tmpC = new T.Color(), cDay = new T.Color(0x6fa6dc), cDayHi = new T.Color(0x1d3f78), cTw = new T.Color(0xd8774a), cNight = new T.Color(0x02040a);
  function updateSky() {
    const cw = new T.Vector3().copy(camera.position).add(F);
    const hc = cw.length() - RE;
    const el = sunElevAt(cw);
    const day = clamp((el + 0.08) / 0.25, 0, 1);
    const tw = clamp(1 - Math.abs(el - 0.02) / 0.12, 0, 1);
    tmpC.copy(cDay).lerp(cDayHi, clamp(hc / 25000, 0, 1));
    tmpC.lerp(cTw, tw * 0.45 * (1 - clamp(hc / 30000, 0, 1)));
    tmpC.lerp(cNight, 1 - day);
    tmpC.lerp(cNight, clamp((hc - 25000) / 45000, 0, 1));
    scene.background = tmpC.clone();
    if (hc < 40000 && mode !== 'hangar') {
      if (!scene.fog) scene.fog = new T.FogExp2(tmpC.clone(), 0);
      scene.fog.color.copy(tmpC);
      const wx = wxState();
      scene.fog.density = 2.0e-5 * Math.exp(-hc / 7000) * (wx && wx.fog ? 6 : wx && (wx.rain || wx.storm) ? 2.2 : 1);
    } else scene.fog = null;
    stars.position.copy(camera.position);
    stars.material.opacity = clamp(clamp((hc - 25000) / 40000, 0, 1) + (1 - day), 0, 1) * 0.95;
    sunSprite.position.set(SUN.x * 1e9 + camera.position.x, SUN.y * 1e9 + camera.position.y, SUN.z * 1e9 + camera.position.z);
    sunSprite.material.opacity = clamp((hc - 6000) / 30000, 0.25, 1) * clamp(el * 8 + 1, 0, 1);
    clouds.visible = hc > 9000;
    atmo.visible = hc > 15000 || mode === 'hangar';
    earthGroup.position.set(-F.x, -F.y, -F.z);
    clouds.rotation.y += 0.0000015;
    const sd = 600;
    sunLight.position.set(SUN.x * sd, SUN.y * sd, SUN.z * sd); sunLight.target.position.set(0, 0, 0);
    const fEl = sunElevAt(F.length() > 1 ? F : cw);
    sunLight.intensity = 3.4 * clamp((fEl + 0.03) / 0.12, 0, 1);
    sunLight.color.setRGB(1, lerp(0.62, 0.95, clamp(fEl / 0.25, 0, 1)), lerp(0.42, 0.88, clamp(fEl / 0.25, 0, 1)));
    const fAlt = F.length() - RE;
    const sh = QUAL.shadows && !cam.map && mode !== 'hangar' && fAlt < 3000 && sunLight.intensity > 0.3;
    sunLight.castShadow = sh;
    if (sh) {
      const ext = clamp(cam.dist * 1.2, 60, 400);
      const s = sunLight.shadow.camera; s.left = -ext; s.right = ext; s.top = ext; s.bottom = -ext; s.near = 1; s.far = 1400; s.updateProjectionMatrix();
    }
    hemi.intensity = (0.08 + 0.45 * day) * (0.4 + 0.6 * clamp(1 - hc / 50000, 0, 1)) + (mode === 'hangar' ? 0.3 : 0);
    renderer.toneMappingExposure = mode === 'hangar' ? 1.1 : lerp(1.15, 1.05, day);
    scene.environment = (mode === 'hangar' || day > 0.3 || hc > 60000) ? envDay : envNight;
    if (smokeP) { const k = 0.12 + 0.88 * day; smokeP.mat.uniforms.tint.value.setRGB(k, k, k * 1.05); }
    return { hc, day };
  }

  function updateStatics(sky) {
    const inFlight = mode === 'flight' && !cam.map;
    const lowCam = sky && sky.hc < 45000;
    const ss = mission ? mission.key === 'ss' : P.state.sel.rocket === 'ss';
    placeSurface(siteCap, 0, 0); siteCap.visible = inFlight && lowCam;
    placeSurface(falconPad.g, 0, 0); falconPad.g.visible = inFlight && !ss;
    for (const g of lzPads) { placeSurface(g, g.userData.d, 0); g.visible = inFlight && !ss; }
    placeSurface(starTower.g, 0, 0); starTower.g.visible = inFlight && ss;
    placeSurface(starExtras, 0, 0); starExtras.visible = inFlight && ss;
    placeSurface(starTower2.g, 350, 0); starTower2.g.visible = inFlight && ss;
    if (mission && mission.shipD !== undefined) {
      droneShipV.g.visible = inFlight; shipCap.visible = inFlight && lowCam;
      placeSurface(droneShipV.g, mission.shipD, 0);
      const ph = mission.t * 2 * Math.PI / 9;
      droneShipV.g.translateY(mission.waves * 0.5 * Math.sin(ph));
      droneShipV.g.rotateX(Math.sin(ph * 0.7) * mission.waves * 0.006);
      placeSurface(shipCap, mission.shipD, -0.6);
      // Octagrabber: inişten sonra booster'ın altına girip sabitler
      const lb = P.has('k_octa') && mission.crafts.find(c => c.rec && c.rec.kind === 'asds' && c.landed && !c.tipped && c.alive);
      if (lb) {
        if (!droneShipV.octa) {
          const og = new T.Group();
          const body = new T.Mesh(new T.BoxGeometry(3.2, 0.9, 3.2), new T.MeshStandardMaterial({ color: 0x9a1f1f, roughness: 0.6, metalness: 0.4 }));
          body.position.y = 0.45; og.add(body);
          const strip = new T.Mesh(new T.BoxGeometry(3.3, 0.18, 3.3), new T.MeshStandardMaterial({ color: 0xffc400, roughness: 0.5 }));
          strip.position.y = 0.92; og.add(strip);
          droneShipV.g.add(og); droneShipV.octa = og;
        }
        if (lb.octaT === undefined) lb.octaT = mission.t;
        const k = clamp((mission.t - lb.octaT - 4) / 14, 0, 1), e = k * k * (3 - 2 * k);
        const dx = lb.downrange() - mission.shipD;
        droneShipV.octa.visible = true;
        droneShipV.octa.position.set(lerp(-34, dx, e), 3, lerp(9, 0, e));
        if (k >= 1 && !lb.octaDone) { lb.octaDone = true; log('Octagrabber booster\'ı güverteye sabitledi', 'good'); }
      } else if (droneShipV.octa) droneShipV.octa.visible = false;
    } else { droneShipV.g.visible = false; shipCap.visible = false; }
    if (mission && mission.fairingShipD !== undefined) {
      fairingShipV.g.visible = inFlight; placeSurface(fairingShipV.g, mission.fairingShipD, 1);
      if (!shipCap.visible && lowCam) { shipCap.visible = inFlight; placeSurface(shipCap, mission.fairingShipD, -0.6); }
    } else fairingShipV.g.visible = false;
    if (shipCap.visible) { waveNormal.offset.x = (performance.now() / 1000) * 0.002; waveNormal.offset.y = (performance.now() / 1000) * 0.0013; }
    // gece projektörleri
    const night = sky && sky.day < 0.35 && inFlight && Math.abs(F.length() - RE) < 30000;
    const srcs = ss ? starTower.lights : falconPad.lights;
    const grp = ss ? starTower.g : falconPad.g;
    grp.updateMatrixWorld();
    for (let i = 0; i < padLights.length; i++) {
      const L = srcs[i];
      if (!L || !night) { padLights[i].intensity = 0; continue; }
      const v = new T.Vector3(L.pos[0], L.pos[1], L.pos[2]).applyMatrix4(grp.matrixWorld);
      padLights[i].position.copy(v);
      padLights[i].intensity = 5000 * (1 - sky.day);
    }
  }


  /* ================= GÖREV AKIŞI ================= */
  let mode = 'hangar', warp = 1, simAcc = 0, endTimer = null, autoCamTimer = 0, paused = false;
  function setPaused(v) { paused = v; $('h-pause').textContent = paused ? '▶' : '⏸'; banner(paused ? 'DURAKLATILDI' : 'DEVAM', 'info'); }
  function setMuted(v) { P.state.opts.muted = v; P.save(); audio.setMuted(v); const b = $('h-mute'); if (b) b.textContent = v ? '🔇' : '🔊'; }
  const WARPS = [1, 2, 5, 10, 25, 50, 100];
  const keys = {};
  const PHASES = { countdown: 'Geri sayım', ascent1: '1. kademe yükselişi', meco: 'MECO', ascent2: '2. kademe yanışı', orbit: 'Yörüngede', failed: 'Görev başarısız', failed2: 'Yörünge kaybedildi' };
  const STATES = { coast: 'süzülüyor', boostback: 'geri dönüş yanışı', descent: 'alçalıyor', entry: 'giriş yanışı', final: 'son yaklaşma', expended: 'tek kullanımlık', falling: 'düşüyor', orbitcoast: 'yörüngede — dönüş penceresi', deorbit: 'yörüngeden çıkış yanışı', reentry: 'göbek üstü süzülme' };

  function startLaunch(ctx) {
    audio.init();
    ctxCur = ctx;
    const P0 = ctx.plan;
    setSite(ctx.site);
    sunHour = ctx.hour + 0.5; sunWeek = ctx.week;
    vis.forEach(v => scene.remove(v.g)); vis.clear();
    mission = new S.Mission(P0.rocket, Object.assign({}, ctx.simOpts));
    mission.autoDeploy = false;
    mission.on(onEvent);
    buildMissionVisuals(mission, ctx);
    trails.clear(); $('log').innerHTML = '';
    for (const d of debris) scene.remove(d.mesh); debris = [];
    sats3d = []; fireP.clear(); smokeP.clear();
    setFocus(mission.stack);
    cam.tdist = cam.dist = mission.stack.length * 3.4; cam.yaw = 0.35; cam.pitch = 0.1; cam.map = false; cam.mode = 'chase';
    warp = 1; simAcc = 0; autoCamTimer = 0; paused = false; $('h-pause').textContent = '⏸';
    if (starTower) starTower.open = 1; if (starTower2) starTower2.open = 1;
    mode = 'flight';
    $('hangar').classList.add('hidden'); $('result').classList.add('hidden'); $('hud').classList.remove('hidden');
    const w = P0.weather;
    $('h-wx').textContent = `${String(ctx.hour).padStart(2, '0')}:00 · rüzgâr ${w.wind} · jet ${w.jet} · dalga ${w.waves} m`;
    log(`${P0.rocket === 'f1' ? 'Falcon 1' : mission.def.name} — ${P0.desc || ''}`);
    log(`Kurtarma: ${S.MODE_NAMES[P0.mode]}${P0.cores.length ? ' · Booster ' + P0.cores.map(c => c.id).join(', ') : ''}`);
    if (P0.risks.length) for (const r of P0.risks) log('⚠ ' + r.text, 'bad');
    if (isTouch) $('touch').classList.remove('hidden');
    bcData = []; bcLast = -1e9; blasts = []; pipTarget = null; holdShown = false; wxFlash = 0;
    $('hold').classList.add('hidden'); $('manual-panel').classList.add('hidden');
    if (w.storm || w.rain || w.fog) log(w.storm ? '⛈ Fırtına: alçak bulut tabanı, şimşek' : w.rain ? '🌧 Yağmurlu, alçak bulutlar' : '🌫 Sisli', '');
    if (ctx.sandbox) log('🧪 Serbest mod — ekonomi etkilenmez');
    window.TUT.show();
  }

  function log(text, cls) {
    const t = mission ? mission.t : 0;
    const el = document.createElement('div');
    if (cls) el.className = cls;
    el.innerHTML = `<b>${fmtT(t)}</b>${String(text).replace(/</g, '&lt;')}`;
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
    const autoCam = P.state.opts.cinematic;
    switch (type) {
      case 'ignition': log('Motor ateşlemesi'); break;
      case 'liftoff': log('KALKIŞ!', 'good'); banner('KALKIŞ', 'good'); voice.say('Kalkış!', true); if (autoCam) { cam.mode = 'ground'; cam.autoGround = true; } if (ctxCur && ctxCur.padDamage) setTimeout(padDamageFX, 1200); break;
      case 'maxq': log('Max-Q — en yüksek aerodinamik yük (' + (d.q / 1000).toFixed(1) + ' kPa)'); banner('MAX-Q'); voice.say('Maks Q'); if (cam.mode === 'ground') cam.mode = 'chase'; break;
      case 'meco': log('MECO — ana motorlar sustu'); banner('MECO'); voice.say('Ana motorlar kapandı'); break;
      case 'hotstage': log('Sıcak kademe ayrılması — Ship motorları ateşlendi'); banner('SICAK AYRILMA'); break;
      case 'sideSep': log('Yan boosterlar ayrıldı (BECO)'); banner('YAN BOOSTER AYRILMASI'); puffs(c, 'side'); break;
      case 'stageSep': log('Kademe ayrılması'); banner('KADEME AYRILMASI'); voice.say('Kademe ayrılması'); puffs(c, 'stage'); break;
      case 'ses': log('2. kademe ateşlemesi (SES-1)'); break;
      case 'fairing': log('Burun konisi ayrıldı'); banner('BURUN KONİSİ AYRILDI'); break;
      case 'chute': log(nm + ': paraşüt açıldı'); if (mission.fairingShipD === undefined) mission.fairingShipD = c.downrange() + 900; break;
      case 'fairingRec': log(nm + (d.ok ? ': ağlı gemiye indi ✓' : ': denize düştü (ıslak, kısmen kurtarıldı)'), d.ok ? 'good' : ''); break;
      case 'seco': log('SECO — Apoapsis ' + (isFinite(d.orbit.ap) ? (d.orbit.ap / 1000).toFixed(0) : '∞') + ' km, Periapsis ' + (d.orbit.pe / 1000).toFixed(0) + ' km', d.ok ? 'good' : 'bad'); break;
      case 'orbit': banner(d.partial ? 'DÜŞÜK YÖRÜNGE' : 'YÖRÜNGEYE ULAŞILDI', d.partial ? 'bad' : 'good'); log('YÖRÜNGEDEYİZ!', 'good'); voice.say(d.partial ? 'Düşük yörünge' : 'Yörüngeye ulaştık'); break;
      case 'deploy': {
        const txt = d.kind === 'starlink' ? d.n + ' uydu yörüngeye bırakıldı' : d.kind === 'dragon' ? 'Dragon ayrıldı — istasyona yöneliyor' : 'Yük ayrıldı';
        log(txt, 'good'); banner(txt.toUpperCase(), 'good'); deploySatsFX(c, d.kind); break;
      }
      case 'engineOut': log(d.total ? 'MOTOR ARIZASI — itki kaybı!' : `${d.n} motor arızası — kalan motorlarla devam`, 'bad'); banner('MOTOR ARIZASI', 'bad'); engineOutFX(c); break;
      case 'gridfins': log(nm + ': ızgara kanatçıkları açıldı'); break;
      case 'boostback': log(nm + ': geri dönüş yanışı başladı'); break;
      case 'boostbackEnd': log(nm + ': geri dönüş yanışı bitti'); break;
      case 'entryBurn': log(nm + ': giriş yanışı başladı'); break;
      case 'entryBurnEnd': log(nm + ': giriş yanışı bitti'); break;
      case 'deorbit': log('Ship: yörüngeden çıkış yanışı'); banner('YÖRÜNGEDEN ÇIKIŞ'); for (const s0 of sats3d) s0.g.parent && s0.g.parent.remove(s0.g); sats3d = []; break;
      case 'deorbitEnd': log('Ship atmosfere giriyor — ısı kalkanı önde'); break;
      case 'flip': log('Ship: dikey konuma çevrilme manevrası'); banner('ÇEVRİLME MANEVRASI'); break;
      case 'final':
        log(nm + ': son yaklaşma — iniş hazırlığı');
        if (!c.ship) { const v0 = vis.get(c.id); audio.sonic(v0 && v0.ef ? camDistTo(v0.ef[0], v0.ef[1], 0) : 3000); }
        if (autoCam) {
          const f = focusCraft();
          const busy = f && f.rec && f.alive && !f.landed && !f.caught && f !== c;
          if (!busy && !(c.side === 'R' && m.crafts.find(k => k.side === 'L' && k.alive && !k.landed))) {
            setFocus(c); cam.tdist = c.length * 3.2; banner(nm.toUpperCase() + ' İNİŞE GELİYOR');
          }
        }
        break;
      case 'landingBurn': log(nm + ': iniş yanışı' + (c.manualBurn ? ' (manuel)' : '')); if (autoCam && c.id === camFocusId && (c.rec.kind === 'rtls' || c.rec.kind === 'asds' || c.rec.kind === 'catch' || c.rec.kind === 'shipcatch')) cam.mode = 'ground'; break;
      case 'legs': log(nm + ': iniş bacakları açıldı'); break;
      case 'landed': log(nm + ' İNDİ! (' + Math.abs(d.dx).toFixed(1) + ' m sapma)', 'good'); banner(nm.toUpperCase() + ' İNDİ!', 'good'); voice.say(c.manualLand ? 'Elle iniş başarılı!' : 'Booster indi!', true); landFX(c); autoCamTimer = 7; break;
      case 'splashdown': log(nm + ' okyanusa kontrollü indi — test başarılı (booster devrilip batıyor)', 'good'); banner('OKYANUS İNİŞ TESTİ BAŞARILI', 'good'); autoCamTimer = 8; break;
      case 'caught': log(nm + (d.ship ? ' YÖRÜNGEDEN DÖNÜP YAKALANDI!' : ' KULE TARAFINDAN YAKALANDI!'), 'good'); banner('YAKALANDI!', 'good'); voice.say('Yakalandı!', true); autoCamTimer = 8; landFX(c); break;
      case 'explode': explodeFX(c, d.why, d.reentry); if (c.id === camFocusId) { autoCamTimer = 6; voice.say('Araç kaybedildi', true); } break;
      case 'manualTakeover': log(nm + ': ELLE KONTROL — W/S gaz, A/D yönelim', 'good'); banner('ELLE İNİŞ: KONTROL SENDE', 'good'); voice.say('Elle kontrol'); setFocus(c); m.camLock = true; warp = 1; break;
      case 'tipover': banner(nm.toUpperCase() + ' DEVRİLDİ', 'bad'); voice.say('Booster devrildi', true); shake = Math.max(shake, 0.5); break;
      case 'upperDeorbit': log('Üst kademe: yörüngeden çıkış yanışı (uzay çöpü bırakmıyoruz)'); break;
      case 'upperDeorbitEnd': log('Üst kademe atmosfere girip okyanus üzerinde yanacak', 'good'); break;
      case 'msg': log(d.text, d.bad ? 'bad' : ''); if (d.bad) banner(d.text.length > 48 ? d.text.slice(0, 46) + '…' : d.text, 'bad'); break;
      case 'end': clearTimeout(endTimer);
        if (d.ok && (d.kind === 'moon' || d.kind === 'mars')) { endTimer = setTimeout(() => startPlanet(d.kind, d), 4000); banner(d.kind === 'moon' ? 'AY TRANSFER YANIŞI' : 'MARS TRANSFER YANIŞI', 'good'); log('Yakıt deposundan ikmal yapıldı — transfer yörüngesi', 'good'); break; }
        endTimer = setTimeout(() => finishMission(d), d.ok ? (d.kind === 'dragon' ? 36000 : 3500) : 7000); if (d.ok && d.kind === 'dragon') { setFocus(mission.stack); cam.tdist = 260; cam.mode = 'chase'; } break;
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
    for (let i = 0; i < 30; i++) {
      const y = rnd(0.5, 0.95) * c.length;
      smokeP.spawn(e[0] + ax[0] * y, e[1] + ax[1] * y, rnd(-1, 1) * big, rnd(-4, 4), rnd(-4, 4), rnd(-4, 4), rnd(2, 5), 1.5 * big, 10 * big, [1, 1, 1], [0.9, 0.9, 0.92], 0.35, 0, 0.6, -0.8);
    }
  }
  function padDamageFX() {
    const p0 = surfacePoint(0, 2), up = [Math.cos(p0[2]), Math.sin(p0[2])], east = [up[1], -up[0]];
    log('Rampa hasarı: OLM altındaki beton parçalandı!', 'bad'); banner('RAMPA HASAR GÖRDÜ', 'bad');
    for (let i = 0; i < 28; i++) {
      const s0 = rnd(0.4, 2.2);
      const mesh = new T.Mesh(new T.DodecahedronGeometry(s0, 0), new T.MeshStandardMaterial({ color: 0x8a8781, roughness: 1, flatShading: true }));
      mesh.material.emissive = new T.Color(0, 0, 0); scene.add(mesh);
      const th = Math.random() * Math.PI * 2, sp = rnd(20, 70), upv = rnd(15, 60);
      debris.push({ mesh, p: [p0[0] + rnd(-8, 8) * east[0], p0[1] + rnd(-8, 8) * east[1], rnd(-8, 8)], v: [east[0] * Math.cos(th) * sp + up[0] * upv, east[1] * Math.cos(th) * sp + up[1] * upv, Math.sin(th) * sp], w: [rnd(-6, 6), rnd(-6, 6), rnd(-6, 6)], life: 60, hot: 0, rest: false, big: 0.8 });
    }
    for (let i = 0; i < 80; i++) { const th = Math.random() * Math.PI * 2, sp = rnd(10, 50); smokeP.spawn(p0[0], p0[1], 0, east[0] * Math.cos(th) * sp + up[0] * rnd(5, 25), east[1] * Math.cos(th) * sp + up[1] * rnd(5, 25), Math.sin(th) * sp, rnd(6, 14), 10, 60, [0.6, 0.56, 0.5], [0.5, 0.48, 0.45], 0.7, 0, 0.4, 0); }
  }
  function engineOutFX(c) {
    const v = vis.get(c.id); if (!v || !v.ef) return;
    const ax = axisOf(v), e = v.ef, side = [ax[1], -ax[0]];
    for (let i = 0; i < 50; i++) {
      const sp = rnd(20, 80);
      fireP.spawn(e[0] + ax[0] * 2 + side[0] * 1.5, e[1] + ax[1] * 2 + side[1] * 1.5, rnd(-1, 1), side[0] * sp + rnd(-10, 10), side[1] * sp + rnd(-10, 10), rnd(-20, 20), rnd(0.3, 1), 2, 8, [1, 0.9, 0.6], [0.7, 0.2, 0], 1, 0, 1.5, 0);
    }
    shake = Math.max(shake, 0.6); audio.boom(0.35, camDistTo(e[0], e[1], 0));
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
  function keyAction(code) {
    if (mode === 'planet' && PL.st) {
      if (code === 'Space' && !PL.st.done) { PL.st.auto = !PL.st.auto; banner(PL.st.auto ? 'OTOMATİK İNİŞ' : 'ELLE KONTROL'); }
      if (code === 'KeyO') setPaused(!paused);
      if (code === 'Comma') warp = Math.max(1, warp / 2); if (code === 'Period') warp = Math.min(4, warp * 2);
      return;
    }
    if (mode !== 'flight' || !mission) return;
    const m = mission;
    switch (code) {
      case 'Space': m.cmd('stage'); break;
      case 'KeyT': m.cmd('autopilot'); break;
      case 'KeyL': m.cmd('landBurn'); break;
      case 'KeyC': m.cmd('catch'); break;
      case 'KeyP': if (m.phase === 'orbit') m.deploy(); break;
      case 'KeyK': m.cmd('fts'); break;
      case 'KeyZ': m.cmd('throttleSet', 1); break;
      case 'KeyX': m.cmd('throttleSet', 0); break;
      case 'KeyV': cycleFocus(1); break;
      case 'KeyB': cycleFocus(-1); break;
      case 'KeyN': { const i = (CAM_MODES.indexOf(cam.mode) + 1) % CAM_MODES.length; cam.mode = CAM_MODES[i]; banner(CAM_NAMES[cam.mode]); break; }
      case 'KeyM': cam.map = !cam.map; break;
      case 'KeyI': pipOn = !pipOn; banner(pipOn ? 'BÖLÜNMÜŞ EKRAN AÇIK' : 'BÖLÜNMÜŞ EKRAN KAPALI'); break;
      case 'KeyH': $('keys').classList.toggle('hidden'); break;
      case 'KeyO': setPaused(!paused); break;
      case 'KeyU': setMuted(!P.state.opts.muted); break;
      case 'Comma': changeWarp(-1); break;
      case 'Period': changeWarp(1); break;
      case 'Escape': abortMission(); break;
    }
  }
  addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    if (e.code === 'Space' && (mode === 'flight' || mode === 'planet')) e.preventDefault();
    if (!keys[e.code]) keyAction(e.code);
    keys[e.code] = true;
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  document.querySelectorAll('#touch button').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', e => { e.preventDefault(); keys[k] = true; keyAction(k); });
    b.addEventListener('pointerup', () => { keys[k] = false; });
    b.addEventListener('pointerleave', () => { keys[k] = false; });
  });
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
      if (c.firingParts().length) mw = Math.min(mw, c.state === 'deorbit' ? 2 : 10);
      if (c.rec && (c.state === 'final' || (c.state === 'descent' && c.alt() < 30000) || (c.state === 'reentry' && c.alt() < 40000))) mw = Math.min(mw, c.id === camFocusId ? 2 : 5);
      if (c.alt() < 60000 && c.vUp() < 0 && c.type !== 'fairing' && !c.chute) mw = Math.min(mw, 10);
    }
    const f = focusCraft();
    if (f && f.rec && f.state === 'final' && !m.autoLand && !f.burnLit) mw = 1;
    if (f && f.rec && (f.rec.kind === 'catch' || f.rec.kind === 'shipcatch') && f.burnLit && f.alt() < 400) mw = 1;
    if (m.phase === 'countdown') mw = Math.min(mw, 5);
    if (m.result) mw = 1;
    return mw;
  }
  function changeWarp(d) { let i = WARPS.indexOf(warp); i = clamp(i + d, 0, WARPS.length - 1); warp = WARPS[i]; }
  document.querySelectorAll('.warp-btns button').forEach(b => b.addEventListener('click', () => changeWarp(+b.dataset.w)));
  function abortMission() {
    if (!mission || mission.result) return;
    if (!confirm('Görevi iptal edip kontrol merkezine dönmek istiyor musun? Fırlatma maliyeti geri alınamaz.')) return;
    mission.failReason = 'Görev iptal edildi';
    mission.finish(false);
  }
  function autoLogic(dtReal) {
    const m = mission;
    const f = focusCraft();
    if (!f || !f.alive || f.landed || f.caught) {
      autoCamTimer -= dtReal;
      if (autoCamTimer <= 0 || !f) {
        const s = m.stack;
        const pend = m.crafts.find(c => c.rec && c.alive && !c.landed && !c.caught && c.state === 'final' && c.id !== camFocusId);
        if (pend && P.state.opts.cinematic) setFocus(pend);
        else if (s && s.alive) { if (camFocusId !== s.id) { setFocus(s); cam.tdist = s.length * 2.5; } }
        else { const any = m.crafts.find(c => c.alive && c.type !== 'fairing'); if (any && any !== f) setFocus(any); }
        if (cam.mode === 'ground') cam.mode = 'chase';
        autoCamTimer = 1e9;
      }
    }
    if (m.phase === 'orbit' && !m.deployed) {
      const onStack = camFocusId === m.stack.id;
      if ((onStack && m.t - m.orbitT > 5) || m.t - m.orbitT > 70) m.deploy();
    }
    if (cam.autoGround && cam.mode === 'ground' && m.phase !== 'countdown' && m.t > 22 && (!f || f.type === 'stack')) { cam.mode = 'chase'; cam.autoGround = false; }
    warp = Math.min(warp, maxWarp());
  }
  function finishMission(r) {
    const applied = P.applyResult(ctxCur, r);
    const won = P.state.won && P.state.achievements.a_win === P.state.week;
    H.showResult(r, applied, won ? 'DÜNYA BAĞLANDI! 🌍' : null);
  }
  function backToHangar() {
    $('result').classList.add('hidden'); $('hud').classList.add('hidden'); $('hangar').classList.remove('hidden'); $('touch').classList.add('hidden');
    vis.forEach(v => scene.remove(v.g)); vis.clear();
    for (const d of debris) scene.remove(d.mesh); debris = [];
    for (const s of sats3d) s.g.parent && s.g.parent.remove(s.g); sats3d = [];
    mission = null; ctxCur = null; mode = 'hangar'; cam.map = false; warp = 1; cam.mode = 'chase';
    voice.stop(); blasts = []; cloudDeck.visible = false;
    if (hiDayPending) { const im = hiDayPending; hiDayPending = null; setTimeout(() => readDayPixels(im), 50); }
    for (const id of ['bcast', 'manual-panel', 'pip-frame', 'pip-label', 'hold', 'planet']) $(id).classList.add('hidden');
    fireP.clear(); smokeP.clear(); audio.set(0); engineLight.intensity = 0;
    setSite(P.state.sel.rocket === 'ss' ? 'starbase' : 'cape'); sunHour = 11; sunWeek = P.state.week;
    rebuildConstData(); rebuildNetLayer();
    H.render();
    window.TUT.show();
  }
  $('btn-back').onclick = backToHangar;
  $('h-pause').onclick = () => setPaused(!paused);
  $('h-mute').onclick = () => setMuted(!P.state.opts.muted);

  /* ================= HUD ================= */
  let hudT = 0;
  const fmtD = m => (Math.abs(m) >= 10000 ? (m / 1000).toFixed(1) + ' km' : m.toFixed(0) + ' m');
  function updateHUD(dtReal) {
    const m = mission; if (!m) return;
    hudT -= dtReal;
    const c = focusCraft();
    updateLandPanel(c);
    updateManualPanel(c);
    if (hudT > 0) return;
    hudT = 0.1;
    $('h-clock').textContent = fmtT(m.t);
    $('h-phase').textContent = PHASES[m.phase] || m.phase;
    $('h-warp').textContent = paused ? 'DURDU' : warp + '×' + (warp >= maxWarp() && maxWarp() < 100 ? ' (sınır)' : '');
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
  }
  function partName(p) {
    return { booster: mission.key === 'ss' ? 'Super Heavy' : '1. kademe', upper: mission.key === 'ss' ? 'Ship' : '2. kademe', sideL: 'Yan B. (Sol)', sideR: 'Yan B. (Sağ)' }[p.role] || p.role;
  }
  function updateLandPanel(c) {
    const p = $('land-panel');
    if (!c || !c.rec || !c.alive || c.landed || c.caught || (c.state !== 'final' && !((c.state === 'descent' || c.state === 'reentry') && c.alt() < 20000))) { p.classList.add('hidden'); return; }
    p.classList.remove('hidden');
    const isCatch = c.rec.kind === 'catch' || c.rec.kind === 'shipcatch';
    $('lp-title').textContent = c.rec.kind === 'shipcatch' ? 'SHIP YAKALAMA' : isCatch ? 'KULE YAKALAMA' : (c.rec.kind === 'asds' ? 'DRONE GEMİYE İNİŞ' : c.rec.kind === 'ocean' ? 'OKYANUS İNİŞ TESTİ' : 'RAMPAYA İNİŞ');
    $('lp-dx').textContent = Math.abs(c.downrange() - c.rec.target).toFixed(0) + ' m';
    const hint = $('lp-hint');
    if (c.state !== 'final') { $('lp-stop').textContent = '—'; $('lp-needle').style.left = '2%'; hint.className = 'lp-hint'; hint.textContent = c.ship ? 'Göbek üstü süzülme — kanatçıklar yönlendiriyor' : 'Giriş & süzülme — ızgara kanatçıkları yönlendiriyor'; return; }
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



  /* ================= HAVA GÖRSELLERİ ================= */
  const cloudDeck = (() => {
    const geo = new T.PlaneGeometry(160000, 160000, 1, 1); geo.rotateX(-Math.PI / 2);
    const mat = new T.ShaderMaterial({
      uniforms: { cover: { value: 0.3 }, light: { value: 1 }, dark: { value: 0 }, sun: { value: new T.Vector3(0, 1, 0) }, off: { value: new T.Vector2() } },
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec2 vP; varying vec2 vL; uniform vec2 off;
        void main(){ vP = position.xz + off; vL = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <logdepthbuf_pars_fragment>
        varying vec2 vP; varying vec2 vL; uniform float cover, light, dark;
        float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float nn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(hh(i), hh(i+vec2(1.0,0.0)), f.x), mix(hh(i+vec2(0.0,1.0)), hh(i+vec2(1.0,1.0)), f.x), f.y); }
        float fb(vec2 p){ float a = 0.0, w = 0.5; for (int k = 0; k < 6; k++) { a += w * nn(p); p = p * 2.03 + 17.1; w *= 0.5; } return a; }
        void main(){
          vec2 p = vP / 2600.0;
          float n = fb(p);
          float a = smoothstep(1.0 - cover - 0.08, 1.0 - cover + 0.18, n);
          float edge = 1.0 - smoothstep(55000.0, 80000.0, length(vL));
          float sh = 0.72 + 0.4 * fb(p * 2.3 + 5.0);
          vec3 c = mix(vec3(0.85, 0.87, 0.9), vec3(0.32, 0.34, 0.38), dark) * sh * light;
          gl_FragColor = vec4(c, a * 0.92 * edge);
          #include <logdepthbuf_fragment>
        }`,
      transparent: true, depthWrite: false, side: T.DoubleSide,
    });
    const m = new T.Mesh(geo, mat); m.renderOrder = 4; m.visible = false; m.frustumCulled = false;
    scene.add(m);
    return m;
  })();
  const wxCanvas = document.createElement('canvas'); $('wx-fx').appendChild(wxCanvas);
  const wxCtx = wxCanvas.getContext('2d');
  let wxFlash = 0, wxNextBolt = 5;
  function wxState() { return ctxCur && ctxCur.weather ? ctxCur.weather : null; }
  function cloudBase(w) { return w.storm ? 900 : w.rain ? 1200 : 1800; }
  function updateWeatherFX(dtReal, sky) {
    const w = wxState();
    const inFlight = mode === 'flight' && !cam.map && w;
    const W = innerWidth, H = innerHeight;
    if (wxCanvas.width !== W || wxCanvas.height !== H) { wxCanvas.width = W; wxCanvas.height = H; }
    wxCtx.clearRect(0, 0, W, H);
    if (!inFlight) { cloudDeck.visible = false; return; }
    const base = cloudBase(w), cover = clamp(w.cloud / 100, 0, 1) * (w.storm ? 1.1 : 1);
    cloudDeck.visible = cover > 0.12 && sky.hc < 120000;
    placeSurface(cloudDeck, 0, base);
    const u = cloudDeck.material.uniforms;
    u.cover.value = cover * 0.85; u.light.value = 0.1 + 0.95 * sky.day + wxFlash * 2; u.dark.value = w.storm ? 0.8 : w.rain ? 0.5 : 0.1;
    u.off.value.x += dtReal * (w.wind || 3) * 0.6;
    const hc = sky.hc;
    // buluttan geçiş
    const thick = 350;
    const inCloud = cover > 0.25 ? clamp(1 - Math.abs(hc - base) / thick, 0, 1) * cover : 0;
    if (inCloud > 0.02) { const k = 0.25 + 0.75 * sky.day; wxCtx.fillStyle = `rgba(${200 * k | 0},${205 * k | 0},${212 * k | 0},${Math.min(0.92, inCloud * 1.1)})`; wxCtx.fillRect(0, 0, W, H); }
    // yağmur (bulut tabanının altında)
    if ((w.rain || w.storm) && hc < base) {
      const n = w.storm ? 420 : 220, fall = w.storm ? 1.6 : 1.1;
      wxCtx.strokeStyle = `rgba(190,205,225,${0.18 + 0.2 * sky.day})`; wxCtx.lineWidth = 1;
      wxCtx.beginPath();
      const t = performance.now() / 1000;
      for (let i = 0; i < n; i++) {
        const sx = (hash3(i, 7, 1) * W + t * 60 * (w.wind || 3) * 0.1) % W, sp = 900 + hash3(i, 3, 2) * 700;
        const sy = ((hash3(i, 5, 9) * H) + t * sp * fall) % H;
        wxCtx.moveTo(sx, sy); wxCtx.lineTo(sx - 4 - (w.wind || 3) * 0.6, sy + 18 + hash3(i, 1, 1) * 14);
      }
      wxCtx.stroke();
    }
    // sis
    if (w.fog && hc < 2500) { const k = 0.3 + 0.7 * sky.day; wxCtx.fillStyle = `rgba(${170 * k | 0},${178 * k | 0},${186 * k | 0},${0.55 * (1 - hc / 2500)})`; wxCtx.fillRect(0, 0, W, H); }
    // şimşek
    if (w.storm) {
      wxNextBolt -= dtReal;
      if (wxNextBolt <= 0) { wxFlash = 1; wxNextBolt = rnd(3, 11); setTimeout(() => audio.boom(0.25, rnd(3000, 9000)), rnd(800, 3000)); }
    }
    if (wxFlash > 0) { wxCtx.fillStyle = `rgba(220,230,255,${wxFlash * 0.35})`; wxCtx.fillRect(0, 0, W, H); hemi.intensity += wxFlash * 2; wxFlash = Math.max(0, wxFlash - dtReal * 4); }
  }

  /* ================= SIRALI PATLAMA ================= */
  let blasts = [];
  function scheduleBlasts(mid, ax, big, vx, vy, inAir, len, reentry) {
    if (reentry) return;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) blasts.push({ at: time + 0.35 + i * rnd(0.25, 0.6), p: [mid[0] + ax[0] * rnd(-0.5, 0.5) * len, mid[1] + ax[1] * rnd(-0.5, 0.5) * len], big: big * rnd(0.6, 1.1), v: [vx, vy], inAir });
    if (inAir) blasts.push({ at: time + 0.15, p: mid.slice(), big, v: [vx, vy], inAir, fireball: true });
  }
  function updateBlasts() {
    for (let i = blasts.length - 1; i >= 0; i--) {
      const b = blasts[i]; if (time < b.at) continue;
      blasts.splice(i, 1);
      const big = b.big, p = b.p;
      if (b.fireball) {
        // yanan yakıt bulutu: yavaş yükselen turuncu küre, sonra koyu duman
        const r0 = Math.hypot(p[0], p[1]), up = [p[0] / r0, p[1] / r0];
        for (let k = 0; k < 140; k++) {
          const th = Math.random() * Math.PI * 2, ph = Math.acos(rnd(-1, 1)), sp = rnd(4, 22) * big;
          fireP.spawn(p[0], p[1], 0, b.v[0] * 0.3 + Math.sin(ph) * Math.cos(th) * sp, b.v[1] * 0.3 + Math.sin(ph) * Math.sin(th) * sp, Math.cos(ph) * sp,
            rnd(2.5, 5.5), rnd(14, 26) * big, rnd(60, 110) * big, [1, 0.75, 0.35], [0.55, 0.12, 0.02], 0.85, 0, 0.7, -6);
        }
        for (let k = 0; k < 90; k++) {
          const sh = rnd(0.06, 0.16);
          smokeP.spawn(p[0] + up[0] * rnd(0, 40) * big, p[1] + up[1] * rnd(0, 40) * big, rnd(-20, 20) * big, up[0] * rnd(8, 25) + rnd(-6, 6), up[1] * rnd(8, 25) + rnd(-6, 6), rnd(-6, 6),
            rnd(20, 45), rnd(30, 50) * big, rnd(140, 260) * big, [sh, sh, sh], [0.3, 0.29, 0.28], 0.8, 0, 0.25, -3);
        }
        continue;
      }
      for (let k = 0; k < 60; k++) {
        const th = Math.random() * Math.PI * 2, ph = Math.acos(rnd(-1, 1)), sp = rnd(15, 60) * big;
        fireP.spawn(p[0], p[1], 0, b.v[0] + Math.sin(ph) * Math.cos(th) * sp, b.v[1] + Math.sin(ph) * Math.sin(th) * sp, Math.cos(ph) * sp,
          rnd(0.5, 1.6), rnd(5, 10) * big, rnd(20, 40) * big, [1, 0.92, 0.7], [0.9, 0.2, 0.03], 1, 0, 1.8, 0);
      }
      flashLight.userData = { e: p, t: 0.6, max: 40 * big };
      shake = Math.max(shake, 0.5);
      audio.boom(0.45, camDistTo(p[0], p[1], 0));
    }
  }

  /* ================= ALACAKARANLIK "DENİZANASI" ================= */
  function sunlitAt(px, py, pz) {
    const r = Math.hypot(px, py, pz), h = Math.max(0, r - RE);
    const el = (px * SUN.x + py * SUN.y + pz * SUN.z) / r;
    return el > -Math.sin(Math.acos(RE / (RE + h)));
  }
  function jellyfish(c, v, thr, h, dt) {
    if (h < 25000 || h > 220000 || !v.ef) return;
    const e = v.ef;
    const gr = Math.hypot(e[0], e[1]);
    const groundEl = (e[0] / gr * SUN.x + e[1] / gr * SUN.y);
    if (groundEl > 0.03 || groundEl < -0.32) return;
    if (!sunlitAt(e[0], e[1], 0)) return;
    if (Math.random() > dt * 8 * thr) return;
    const ax = axisOf(v), big = mission.key === 'ss' ? 2 : 1;
    const sp = rnd(150, 450);
    fireP.spawn(e[0] - ax[0] * 30, e[1] - ax[1] * 30, rnd(-10, 10), -ax[0] * sp + rnd(-60, 60), -ax[1] * sp + rnd(-60, 60), rnd(-80, 80),
      rnd(25, 45), 200 * big, rnd(1800, 3200) * big, [0.55, 0.75, 1.0], [0.75, 0.55, 0.9], 0.035, 0, 0.12, 0);
  }

  /* ================= SESLİ ANONS ================= */
  const voice = (() => {
    const ok = typeof window.speechSynthesis !== 'undefined';
    let v = null, lastCount = null;
    function pick() { if (!ok || v) return; const vs = speechSynthesis.getVoices(); v = vs.find(x => /^tr/i.test(x.lang)) || null; }
    if (ok) { pick(); speechSynthesis.onvoiceschanged = pick; }
    function enabled() { return ok && P.state.opts.voice !== false && !P.state.opts.muted && mode === 'flight'; }
    function say(text, urgent) {
      if (!enabled()) return;
      try {
        if (urgent) speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text); u.lang = 'tr-TR'; if (v) u.voice = v; u.rate = 1.05; u.pitch = 0.95; u.volume = 0.9;
        speechSynthesis.speak(u);
      } catch (e) { /* yok say */ }
    }
    const NUM = ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz', 'on'];
    function countdown(t) {
      if (t >= 0 || t < -10.5) { lastCount = null; return; }
      const n = Math.ceil(-t);
      if (n !== lastCount && n <= 10 && n >= 1) { lastCount = n; say(n === 10 ? 'T eksi on' : NUM[n], true); }
    }
    function stop() { if (ok) try { speechSynthesis.cancel(); } catch (e) { /* */ } }
    return { say, countdown, stop };
  })();

  /* ================= CANLI YAYIN ŞERİDİ ================= */
  let bcData = [], bcLast = -1e9;
  const bcCv = $('bc-chart'), bcG = bcCv.getContext('2d');
  function updateBroadcast() {
    const el = $('bcast');
    const on = mode === 'flight' && mission && P.state.opts.broadcast !== false && !cam.map;
    el.classList.toggle('hidden', !on);
    if (!on) return;
    const m = mission, s = m.stack && m.stack.alive ? m.stack : m.crafts.find(c => c.alive && (c.type === 'upper' || c.type === 'stack')) || focusCraft();
    if (!s) return;
    if (m.t - bcLast >= 1 && m.t > -1) { bcLast = m.t; bcData.push([m.t, s.airSpeed(), Math.max(0, s.alt())]); if (bcData.length > 900) bcData.shift(); }
    const W = bcCv.width, H = bcCv.height;
    bcG.clearRect(0, 0, W, H);
    if (bcData.length > 1) {
      const mv = Math.max(500, ...bcData.map(d => d[1])), mh = Math.max(5000, ...bcData.map(d => d[2]));
      const draw = (k, mx, col) => { bcG.strokeStyle = col; bcG.lineWidth = 2; bcG.beginPath(); bcData.forEach((d, i) => { const x = i / (bcData.length - 1) * (W - 4) + 2, y = H - 4 - d[k] / mx * (H - 10); i ? bcG.lineTo(x, y) : bcG.moveTo(x, y); }); bcG.stroke(); };
      draw(2, mh, '#ffd36b'); draw(1, mv, '#4fc3ff');
      bcG.fillStyle = 'rgba(200,220,255,0.7)'; bcG.font = '10px sans-serif'; bcG.fillText('hız', 4, 10); bcG.fillStyle = '#ffd36b'; bcG.fillText('irtifa', 28, 10);
    }
    const b = m.crafts.find(c => c.rec && !c.ship && c.type !== 'fairing');
    const bs = b ? (b.landed ? 'indi ✓' : b.caught ? 'yakalandı ✓' : b.splashed ? 'okyanusta' : !b.alive ? 'kayıp' : STATES[b.state] || '') : '';
    const html = `<span>${PHASES[m.phase] || m.phase}</span><span>HIZ <b>${(s.airSpeed() * 3.6).toFixed(0)}</b> km/sa</span><span>İRTİFA <b>${(Math.max(0, s.alt()) / 1000).toFixed(1)}</b> km</span>${b ? `<span>BOOSTER <b>${bs}</b></span>` : ''}`;
    const tx = $('bc-text'); if (tx._h !== html) { tx.innerHTML = html; tx._h = html; }
  }

  /* ================= BÖLÜNMÜŞ EKRAN (PiP) ================= */
  const pipCam = new T.PerspectiveCamera(45, 1.6, 0.3, 5e9);
  let pipOn = true, pipTarget = null;
  function choosePip() {
    const m = mission; if (!m || cam.map || !pipOn || QUAL === QUALITY.low) return null;
    const f = focusCraft();
    const live = c => c && c.alive && c.type !== 'fairing';
    const boosters = m.crafts.filter(c => c.rec && c.id !== camFocusId && c.alive && !c.landed && !c.caught && !c.splashed && c.type !== 'fairing');
    if (f && (f.type === 'stack' || f.type === 'upper' || f.ship) && boosters.length) return boosters[0];
    if (f && f.rec) {
      const up = m.crafts.find(c => (c.type === 'upper' || (c.ship && c.state !== 'final')) && c.id !== camFocusId && live(c));
      if (up && up.alt() > 1000) return up;
      const other = boosters.find(c => c.id !== f.id);
      if (other) return other;
    }
    return null;
  }
  function pipRect() { const w = Math.round(Math.min(340, innerWidth * 0.26)), h = Math.round(w * 0.6); return { x: innerWidth - w - 260, y: 130, w, h }; }
  function renderPip() {
    const c = choosePip();
    const fr = $('pip-frame'), lb = $('pip-label');
    if (!c || innerWidth < 900) { fr.classList.add('hidden'); lb.classList.add('hidden'); pipTarget = null; return; }
    const v = vis.get(c.id); if (!v || !v.ef) return;
    pipTarget = c;
    const R0 = pipRect();
    const e = v.ef, ax = axisOf(v), L = c.length || 30;
    const cx = e[0] + ax[0] * L * 0.45 - F.x, cy = e[1] + ax[1] * L * 0.45 - F.y;
    const r = Math.hypot(e[0], e[1]), up = [e[0] / r, e[1] / r], east = [up[1], -up[0]];
    const d = L * 3.2, yaw = 0.7, pit = 0.12;
    pipCam.position.set(cx + (east[0] * Math.sin(yaw) + up[0] * pit) * d, cy + (east[1] * Math.sin(yaw) + up[1] * pit) * d, Math.cos(yaw) * d - F.z);
    pipCam.up.set(up[0], up[1], 0);
    pipCam.lookAt(cx, cy, -F.z);
    pipCam.aspect = R0.w / R0.h; pipCam.updateProjectionMatrix();
    const low = c.alt() < 45000;
    const capVis = siteCap.visible, shVis = shipCap.visible, fog = scene.fog;
    if (low) { siteCap.visible = true; if (mission.shipD !== undefined) shipCap.visible = true; }
    scene.fog = null;
    const yb = innerHeight - R0.y - R0.h;
    renderer.setScissorTest(true);
    renderer.setScissor(R0.x, R0.y, R0.w, R0.h); renderer.setViewport(R0.x, R0.y, R0.w, R0.h);
    const ac = renderer.autoClear; renderer.autoClear = false; renderer.clear(true, true, false);
    renderer.render(scene, pipCam);
    renderer.autoClear = ac;
    renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight);
    siteCap.visible = capVis; shipCap.visible = shVis; scene.fog = fog;
    fr.classList.remove('hidden'); lb.classList.remove('hidden');
    Object.assign(fr.style, { left: R0.x + 'px', top: yb + 'px', width: R0.w + 'px', height: R0.h + 'px', right: 'auto', bottom: 'auto' });
    Object.assign(lb.style, { left: (R0.x + 6) + 'px', top: (yb + 6) + 'px' });
    const txt = `${c.name} · ${(Math.max(0, c.alt()) / 1000).toFixed(1)} km · ${c.speed().toFixed(0)} m/s`;
    if (lb.textContent !== txt) lb.textContent = txt;
  }

  /* ================= HANGAR 3D ÖNİZLEME ================= */
  const pvScene = new T.Scene();
  pvScene.environment = envDay;
  const pvCam = new T.PerspectiveCamera(30, 0.6, 0.5, 4000);
  const pvSun = new T.DirectionalLight(0xfff2e0, 2.6); pvSun.position.set(60, 120, 90); pvScene.add(pvSun);
  pvScene.add(new T.HemisphereLight(0x9cc4ff, 0x222018, 0.7));
  let pvWant = null, pvKey = null, pvGroup = null, pvParts = [], pvT = 0, pvH = 70;
  function buildPreview(key) {
    if (pvGroup) pvScene.remove(pvGroup);
    pvGroup = new T.Group(); pvParts = [];
    const d = S.ROCKETS[key]; if (!d) return;
    const st = d.stages;
    const add = (o, x, y, from) => { pvGroup.add(o); o.position.set(x, y, 0); pvParts.push({ o, x, y, from }); };
    let y = 0;
    if (key === 'ss') {
      const b = MD.superHeavy(st[0], {}); add(b.g, 0, 0, [0, -40]); y = b.len || st[0].len;
      const sh = MD.ship(st[1], {}); add(sh.g, 0, y, [0, 60]); y += st[1].len;
    } else {
      const b = MD.falconBooster(st[0], { fins: key !== 'f1', legs: key !== 'f1' }); add(b.g, 0, 0, [0, -40]); y = st[0].len;
      if (key === 'fh') for (const sd of [-1, 1]) { const sb = MD.falconBooster(d.sides, { nose: true, side: true, fins: true, legs: true, sideAttach: sd }); add(sb.g, sd * (d.sides.dia + 0.45), 0, [sd * 30, 0]); }
      const u = MD.falconUpper(st[1], key === 'f1'); add(u.g, 0, y, [0, 40]); y += st[1].len;
      const halves = MD.fairingHalves(key === 'f1' ? 0.75 : 2.6, d.payloadLen);
      halves.forEach((h, i) => add(h, 0, y, [i ? -18 : 18, 30]));
      y += d.payloadLen;
    }
    pvH = y;
    // rampa zemini
    const pad = new T.Mesh(new T.CylinderGeometry(pvH * 0.35, pvH * 0.38, 1, 48), new T.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.9 }));
    pad.position.y = -0.5; pvGroup.add(pad);
    pvScene.add(pvGroup);
    pvT = 0;
  }
  function renderPreview(dtReal) {
    const el = $('preview');
    if (mode !== 'hangar' || el.classList.contains('hidden')) return;
    const key = pvWant || P.state.sel.rocket;
    if (key !== pvKey) { pvKey = key; buildPreview(key); $('pv-label').textContent = (P.ROCKET_INFO[key] || {}).name || ''; }
    const rc = el.getBoundingClientRect();
    if (rc.width < 80 || rc.height < 120) return;
    pvT = Math.min(1, pvT + dtReal * 0.6);
    for (const p of pvParts) {
      const k = 1 - Math.pow(1 - clamp((pvT - (p.y / pvH) * 0.4) / 0.6, 0, 1), 3);
      p.o.position.set(p.x + p.from[0] * (1 - k), p.y + p.from[1] * (1 - k), 0);
    }
    pvGroup.rotation.y += dtReal * 0.35;
    pvCam.aspect = rc.width / rc.height;
    const fitH = pvH * 1.25, fitW = pvH * 0.6;
    const dist = Math.max(fitH / (2 * Math.tan(pvCam.fov * D2R / 2)), fitW / (2 * Math.tan(pvCam.fov * D2R / 2)) / pvCam.aspect);
    pvCam.position.set(0, pvH * 0.55, dist); pvCam.lookAt(0, pvH * 0.5, 0); pvCam.updateProjectionMatrix();
    const x = rc.left, yb = innerHeight - rc.bottom;
    renderer.setScissorTest(true);
    renderer.setScissor(x, yb, rc.width, rc.height); renderer.setViewport(x, yb, rc.width, rc.height);
    const ac = renderer.autoClear; renderer.autoClear = false; renderer.clear(false, true, false);
    const bg = pvScene.background; pvScene.background = null;
    renderer.render(pvScene, pvCam);
    pvScene.background = bg; renderer.autoClear = ac;
    renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight);
  }

  /* ================= GERİ SAYIM BEKLEMESİ ================= */
  let holdShown = false;
  function checkHold() {
    const m = mission, h = ctxCur && ctxCur.hold;
    if (!m || !h || h.done || m.t < h.t || m.holding) return;
    m.holding = true; holdShown = true;
    $('hold-text').innerHTML = `<b>${h.sensor}</b> beklenmedik değer okudu (T${m.t.toFixed(0)} s).<br>Uçuş direktörü karar bekliyor: iptal edersen fırlatma masrafının %85'i geri alınır ve booster hazıra döner. Devam edersen arıza riski yaklaşık <b>%${Math.round(h.risk * 100)}</b>.`;
    $('hold').classList.remove('hidden');
    banner('GERİ SAYIM DURDURULDU', 'bad'); log('HOLD — ' + h.sensor, 'bad'); voice.say('Bekleme. Geri sayım durduruldu.', true);
    warp = 1;
  }
  $('hold-abort').onclick = () => {
    const h = ctxCur.hold; h.done = true; $('hold').classList.add('hidden');
    const sb = ctxCur.sandbox;
    const refund = sb ? 0 : P.abortLaunch(ctxCur);
    clearTimeout(endTimer); voice.stop();
    if (mission) mission.result = mission.result || { ok: false, aborted: true };
    backToHangar();
    if (!sb) setTimeout(() => alert(`Fırlatma iptal edildi. ${H.money(refund)} iade edildi.`), 50);
  };
  $('hold-go').onclick = () => {
    const h = ctxCur.hold; h.done = true; $('hold').classList.add('hidden');
    mission.holding = false;
    if (Math.random() < h.risk && !mission.engineFail) { mission.engineFail = { t: rnd(12, 80), part: 'booster', count: 1 }; }
    log('Uçuş direktörü: devam kararı — geri sayım sürüyor'); voice.say('Devam kararı. Geri sayım sürüyor.');
  };

  /* ================= ELLE İNİŞ PANELİ ================= */
  function updateManualPanel(c) {
    const p = $('manual-panel');
    const on = c && c.manualLand && c.alive && !c.landed && !c.caught && !c.splashed;
    p.classList.toggle('hidden', !on);
    if (!on) return;
    $('land-panel').classList.add('hidden');
    const a = c.airVel ? c.airVel() : [0, 0];
    const h = c.alt() - (c.rec.kind === 'asds' ? 3 : c.rec.kind === 'catch' ? 40 : 0);
    $('mp-alt').textContent = h.toFixed(0) + ' m';
    const vz = c.vUp(); const vzEl = $('mp-vz'); vzEl.textContent = vz.toFixed(1) + ' m/s'; vzEl.style.color = h < 300 && vz < -Math.max(3, h * 0.12) ? 'var(--bad)' : '';
    const as = c.airSpeed(), vx = Math.sqrt(Math.max(0, as * as - vz * vz)); void a;
    $('mp-vx').textContent = Math.abs(vx).toFixed(1) + ' m/s';
    $('mp-dx').textContent = (c.downrange() - c.rec.target).toFixed(0) + ' m';
    $('mp-thr').style.width = ((c.manThr || 0) * 100) + '%';
  }

  /* ================= ETKİLEŞİMLİ EĞİTİM ================= */
  window.TUT = (() => {
    const STEPS = [
      { sel: '[data-tab=contracts]', text: '👋 Hoş geldin! Şirketin Falcon 1 ile başlıyor. İlk gelir için <b>Sözleşmeler</b> sekmesini aç.', when: t => t === 'contracts' },
      { sel: '[data-acc]', text: 'Bir sözleşmeyi <b>Kabul et</b>: ödülün %30\'u hemen avans olarak gelir.', ev: 'accept' },
      { sel: '[data-tab=launch]', text: 'Şimdi <b>Fırlatma</b> sekmesine dön.', when: t => t === 'launch' },
      { sel: '#b-launch', text: 'Yük olarak <b>Sözleşme yükü</b>nü seç, hava durumuna bak ve <b>FIRLAT</b>.', ev: 'launch' },
      { sel: '.hud-right', text: 'Uçuştasın! Sol panel telemetri, sağda kameralar ve zaman hızı. <kbd>.</kbd> ile zamanı hızlandır, <kbd>V</kbd> ile araç değiştir, <kbd>N</kbd> ile sinematik açı. Uçuş bitince sonuç ekranı gelir.', next: true, flight: true },
      { sel: '#btn-week', text: 'Her hafta bir kez fırlatabilirsin. <b>Haftayı bitir</b> ile zaman ilerler: fabrikalar üretir, Ar-Ge ilerler, aboneler öder. Falcon 1 ile 2 başarılı uçuştan sonra <b>Ar-Ge</b>\'de iniş teknolojileri açılır. İyi şanslar!', next: true },
    ];
    const box = $('tut');
    let hl = null;
    function st() { return P.state.tutorial || (P.state.tutorial = { step: 0, done: false }); }
    function active() { const t = st(); return !t.done && P.state.opts.tutorial !== false && t.step < STEPS.length; }
    function show() {
      if (hl) { hl.classList.remove('tut-hl'); hl = null; }
      if (!active()) { box.classList.add('hidden'); return; }
      const s = STEPS[st().step];
      const inFlight = mode === 'flight' || mode === 'planet';
      if (!!s.flight !== inFlight || !$('result').classList.contains('hidden') || !$('report').classList.contains('hidden') || !$('help').classList.contains('hidden') || !$('newgame').classList.contains('hidden')) { box.classList.add('hidden'); return; }
      const el = document.querySelector(s.sel);
      $('tut-text').innerHTML = s.text;
      $('tut-next').style.display = s.next ? '' : 'none';
      box.classList.remove('hidden');
      if (el) {
        hl = el; el.classList.add('tut-hl');
        const r = el.getBoundingClientRect(), bw = Math.min(340, innerWidth * 0.92);
        let x = clamp(r.left, 8, innerWidth - bw - 8), y = r.bottom + 10;
        if (y + 160 > innerHeight) y = Math.max(8, r.top - 170);
        box.style.left = x + 'px'; box.style.top = y + 'px';
      } else { box.style.left = '30%'; box.style.top = '40%'; }
    }
    function adv() { const t = st(); P.tutorialAdvance(t.step + 1); if (st().step >= STEPS.length) { t.done = true; P.save(); } show(); }
    $('tut-next').onclick = adv;
    $('tut-skip').onclick = () => { st().done = true; P.save(); show(); };
    return {
      update(tab) { if (!active()) { show(); return; } const s = STEPS[st().step]; if (s.when && s.when(tab)) { adv(); return; } setTimeout(show, 30); },
      ping(ev) { if (!active()) return; const s = STEPS[st().step]; if (s.ev === ev) adv(); },
      show,
    };
  })();

  /* ================= AY / MARS İNİŞ SAHNESİ ================= */
  const PL = { scene: null, cam: new T.PerspectiveCamera(50, 1, 0.5, 2e6), st: null };
  function planetTexture(kind) {
    return MD.canvasTex(1024, 1024, (g, w, h) => {
      const moon = kind === 'moon';
      g.fillStyle = moon ? '#8d8d8d' : '#a4532d'; g.fillRect(0, 0, w, h);
      const img = g.getImageData(0, 0, w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const n = vnoise(x / 40, y / 40, 1) * 0.5 + vnoise(x / 9, y / 9, 2) * 0.3 + vnoise(x / 160, y / 160, 3) * 0.6;
        const i = (y * w + x) * 4, k = 0.7 + n * 0.45;
        img.data[i] *= k; img.data[i + 1] *= k * (moon ? 1 : 0.95); img.data[i + 2] *= k * (moon ? 1.02 : 0.9);
      }
      g.putImageData(img, 0, 0);
      for (let i = 0; i < (moon ? 260 : 70); i++) {
        const x = Math.random() * w, y = Math.random() * h, r = Math.pow(Math.random(), 3) * (moon ? 60 : 40) + 2;
        const gr = g.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r);
        gr.addColorStop(0, moon ? 'rgba(40,40,40,0.55)' : 'rgba(60,20,8,0.45)'); gr.addColorStop(0.8, moon ? 'rgba(90,90,90,0.25)' : 'rgba(120,50,20,0.2)'); gr.addColorStop(0.95, moon ? 'rgba(200,200,200,0.18)' : 'rgba(230,150,100,0.15)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
    }, { repeat: [24, 24] });
  }
  function startPlanet(kind, r) {
    const moon = kind === 'moon';
    const sc = new T.Scene();
    sc.background = new T.Color(moon ? 0x000000 : 0xc89a72);
    if (!moon) sc.fog = new T.Fog(0xc89a72, 4000, 60000);
    sc.environment = envDay;
    const sun = new T.DirectionalLight(0xffffff, moon ? 3.4 : 2.4); sun.position.set(-400, 300, 200); sc.add(sun);
    sc.add(new T.HemisphereLight(moon ? 0x404850 : 0xe0b090, 0x201510, moon ? 0.15 : 0.6));
    const tex = planetTexture(kind);
    const ground = new T.Mesh(new T.PlaneGeometry(120000, 120000, 1, 1), new T.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 }));
    ground.rotation.x = -Math.PI / 2; sc.add(ground);
    // kayalar
    const rockM = new T.MeshStandardMaterial({ color: moon ? 0x777777 : 0x7a3a20, roughness: 1, flatShading: true });
    for (let i = 0; i < 160; i++) { const s0 = Math.pow(Math.random(), 2) * 4 + 0.4; const rk = new T.Mesh(new T.DodecahedronGeometry(s0, 0), rockM); rk.position.set(rnd(-600, 600), s0 * 0.3, rnd(-600, 600)); rk.rotation.set(rnd(0, 3), rnd(0, 3), 0); sc.add(rk); }
    if (moon) { const stars0 = new T.Points(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(Array.from({ length: 3000 }, () => rnd(-1, 1) * 9e5), 3)), new T.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: false })); sc.add(stars0); const earthB = new T.Mesh(new T.SphereGeometry(18000, 32, 16), new T.MeshBasicMaterial({ map: loadTex('day', true) })); earthB.position.set(200000, 160000, -500000); sc.add(earthB); }
    // hedef işareti
    const pad = new T.Mesh(new T.RingGeometry(18, 22, 48), new T.MeshBasicMaterial({ color: 0x3ee08f, transparent: true, opacity: 0.7, side: T.DoubleSide })); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.2; sc.add(pad);
    const shipV = MD.ship(S.ROCKETS.ss.stages[1], { flights: 1 });
    const plume = makePlume('raptor', 2.2, 30); plume.position.y = shipV.plumeY || -2; shipV.g.add(plume);
    sc.add(shipV.g);
    const dust = new Particles(2500, false); scene.remove(dust.pts); sc.add(dust.pts);
    const g = moon ? 1.62 : 3.71;
    PL.scene = sc;
    PL.st = { kind, r, g, x: moon ? -1600 : -2600, h: moon ? 2600 : 4200, vx: moon ? 55 : 120, vz: moon ? -45 : -110, ang: 0, thr: 0, fuel: 1, auto: true, ship: shipV, plume, dust, done: false, t: 0, msg: null, pad };
    mode = 'planet'; warp = 1;
    $('hud').classList.add('hidden'); $('planet').classList.remove('hidden'); $('bcast').classList.add('hidden');
    $('pl-title').textContent = moon ? '🌕 AY İNİŞİ' : '🔴 MARS İNİŞİ';
    banner(moon ? 'AY YÜZEYİNE ALÇALMA' : 'MARS ATMOSFERİNE GİRİŞ', 'good');
    voice.say(moon ? 'Ay yüzeyine alçalma başladı.' : 'Mars inişi başladı.');
    fireP.clear(); smokeP.clear();
  }
  function stepPlanet(dt) {
    const s = PL.st; if (!s || s.done) return;
    s.t += dt;
    const moon = s.kind === 'moon';
    const amax = s.g * 3.2;
    if (s.auto) {
      // basit otomatik iniş: yatay hızı sıfırla, dikey hızı irtifaya göre ayarla
      const tgtVx = clamp(-s.x * 0.05, -40, 40);
      s.ang = clamp((s.vx - tgtVx) * 0.03, -0.45, 0.45);
      const tgtVz = -Math.max(1.5, Math.min(60, s.h * 0.09));
      const need = (tgtVz - s.vz) * 1.2 + s.g;
      s.thr = clamp(need / (amax * Math.cos(s.ang)), 0, 1);
    } else {
      if (keys.KeyW || keys.ArrowUp) s.thr = clamp(s.thr + dt * 0.7, 0, 1);
      if (keys.KeyS || keys.ArrowDown) s.thr = clamp(s.thr - dt * 0.7, 0, 1);
      if (keys.KeyA || keys.ArrowLeft) s.ang = clamp(s.ang - dt * 0.5, -0.6, 0.6);
      else if (keys.KeyD || keys.ArrowRight) s.ang = clamp(s.ang + dt * 0.5, -0.6, 0.6);
      else s.ang *= Math.exp(-dt * 0.8);
    }
    if (s.fuel <= 0) s.thr = 0;
    const a = s.thr > 0.02 ? Math.max(0.25, s.thr) * amax : 0;
    s.fuel = Math.max(0, s.fuel - (a / amax) * dt / 75);
    const drag = moon ? 0 : 0.0009 * Math.exp(-s.h / 11000);
    s.vx += (-Math.sin(s.ang) * a - drag * s.vx * Math.abs(s.vx)) * dt;
    s.vz += (Math.cos(s.ang) * a - s.g - drag * s.vz * Math.abs(s.vz) * Math.sign(1)) * dt;
    s.x += s.vx * dt; s.h += s.vz * dt;
    if (s.h <= 0) {
      s.h = 0; s.done = true;
      const ok = Math.abs(s.vz) < 3.5 && Math.abs(s.vx) < 2.5 && Math.abs(s.ang) < 0.18;
      s.ok = ok;
      if (ok) { banner(moon ? 'AY\'A İNDİK! 🌕' : 'MARS\'A İNDİK! 🔴', 'good'); voice.say(moon ? 'İniş başarılı. Ay yüzeyindeyiz.' : 'İniş başarılı. Mars yüzeyindeyiz.', true); s.thr = 0; }
      else { banner('SERT İNİŞ — GEMİ KAYBEDİLDİ', 'bad'); voice.say('Gemi kaybedildi.', true); s.ship.g.visible = false; for (let i = 0; i < 300; i++) { const th = Math.random() * 6.28, sp = rnd(5, 60); s.dust.spawn(s.x, rnd(0, 20), 0, Math.cos(th) * sp, rnd(5, 50), Math.sin(th) * sp, rnd(2, 6), 6, 40, [1, 0.6, 0.2], [0.2, 0.18, 0.16], 1, 0, 0.6, 0); } audio.boom(1, 200); }
      setTimeout(() => endPlanet(ok), 4500);
    }
    // toz
    if (a > 0 && s.h < 80) {
      const n = Math.ceil(dt * 120 * s.thr * (1 - s.h / 80));
      const col = moon ? [0.6, 0.6, 0.6] : [0.7, 0.42, 0.28];
      for (let i = 0; i < n; i++) { const th = Math.random() * 6.28, sp = rnd(20, 70) * (moon ? 1.5 : 1); s.dust.spawn(s.x, 1, 0, Math.cos(th) * sp, rnd(1, 6), Math.sin(th) * sp, moon ? rnd(1.5, 3) : rnd(3, 7), 3, 26, col, col, 0.55, 0, moon ? 0.1 : 0.6, moon ? s.g : 0.5); }
    }
  }
  function renderPlanet(dtReal) {
    const s = PL.st; if (!s) return;
    if (!paused) { let k = Math.min(dtReal, 0.05) * warp; while (k > 0) { const d = Math.min(k, 0.02); stepPlanet(d); k -= d; } }
    const sh = s.ship;
    sh.g.position.set(s.x, s.h + 0.5, 0); sh.g.rotation.z = s.ang;
    updatePlume(s.plume, s.done && s.ok ? 0 : s.thr, s.kind === 'moon' ? 0 : 600, time);
    if (sh.flaps) for (const f of sh.flaps) f.rotation.x = 0;
    const F0 = F.clone(); F.set(0, 0, 0);
    s.dust.mat.uniforms.scale.value = innerHeight / (2 * Math.tan(PL.cam.fov * Math.PI / 360));
    s.dust.update(Math.min(dtReal, 0.05));
    F.copy(F0);
    const d = clamp(90 + s.h * 0.12, 90, 900);
    PL.cam.position.set(s.x + d * 0.55, s.h + 30 + d * 0.18, d * 0.85);
    PL.cam.lookAt(s.x, s.h + 20, 0);
    PL.cam.aspect = innerWidth / innerHeight; PL.cam.updateProjectionMatrix();
    renderer.toneMappingExposure = 1.05;
    renderer.render(PL.scene, PL.cam);
    $('pl-alt').textContent = s.h.toFixed(0) + ' m';
    $('pl-vz').textContent = s.vz.toFixed(1) + ' m/s'; $('pl-vz').style.color = s.h < 200 && s.vz < -6 ? 'var(--bad)' : '';
    $('pl-vx').textContent = s.vx.toFixed(1) + ' m/s';
    $('pl-fuel').textContent = '%' + (s.fuel * 100).toFixed(0);
    $('pl-thr').style.width = (s.thr * 100) + '%';
    $('pl-hint').textContent = s.auto ? 'Otomatik iniş — Boşluk: elle kontrole geç' : 'W/S gaz · A/D eğim · Boşluk: otomatik · hedef: <3.5 m/s dikey, <2.5 m/s yatay';
  }
  function endPlanet(ok) {
    const s = PL.st; if (!s) return;
    const r = s.r; r.landed = ok;
    if (!ok) r.reason = (s.kind === 'moon' ? 'Ay' : 'Mars') + ' yüzeyine sert iniş';
    PL.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    PL.scene = null; PL.st = null;
    $('planet').classList.add('hidden');
    mode = 'flight';
    finishMission(r);
  }

  /* ================= ANA DÖNGÜ ================= */
  let last = performance.now(), time = 0, fpsAcc = 0, fpsN = 0, lowQ = false;
  function frame(now) {
    requestAnimationFrame(frame);
    const dtReal = Math.min(0.05, (now - last) / 1000); last = now; time += dtReal;
    // basit uyarlanabilir kalite
    fpsAcc += dtReal; fpsN++;
    if (fpsAcc > 4) {
      const fps = fpsN / fpsAcc;
      if (fps < 24 && !lowQ && P.state.opts.autoQuality !== false) {
        const order = ['high', 'med', 'low'], cur = P.state.opts.quality || 'high', i = order.indexOf(cur);
        if (i < 2) { P.state.opts.quality = order[i + 1]; P.save(); applyQuality(P.state.opts.quality); if (mode === 'flight') banner('Grafik kalitesi: ' + QUAL.name); }
        else lowQ = true;
      }
      fpsAcc = 0; fpsN = 0;
    }
    if (mode === 'planet') {
      renderPlanet(dtReal);
      return;
    }
    if (mode === 'flight' && mission) { checkHold(); voice.countdown(mission.t); }
    if (mode === 'flight' && mission && !paused) {
      inputStep(dtReal);
      autoLogic(dtReal);
      simAcc += dtReal * warp;
      let steps = Math.floor(simAcc / DT);
      steps = Math.min(steps, 6000);
      simAcc -= steps * DT;
      if (simAcc > DT * 4) simAcc = 0;
      for (let i = 0; i < steps; i++) mission.step(DT);
      NOWT = mission.t;
    }
    updateSun();
    updateCamera(dtReal);
    if (mission) syncVisuals(dtReal, time);
    const pdt = paused ? 0 : (mode === 'flight' ? Math.min(dtReal * Math.min(warp, 4), 0.2) : dtReal);
    updateAudio();
    const psc = innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360));
    fireP.mat.uniforms.scale.value = psc; smokeP.mat.uniforms.scale.value = psc;
    fireP.update(pdt); smokeP.update(pdt);
    updateDebris(pdt);
    updateBlasts();
    updateSats(dtReal);
    updateConstellation(time, mode === 'hangar' || cam.map);
    updateMapLines(cam.map && mode === 'flight');
    const fl = flashLight.userData;
    if (fl && fl.e) {
      fl.t += dtReal;
      flashLight.intensity = Math.max(0, 1 - fl.t / 1.5) * 4e5;
      flashLight.position.set(fl.e[0] - F.x, fl.e[1] - F.y, -F.z);
      if (fl.t > 1.5) { fl.e = null; flashLight.intensity = 0; }
    }
    const sky = updateSky();
    updateStatics(sky);
    updateWeatherFX(dtReal, sky);
    if (mode === 'flight') { updateHUD(dtReal); updateBroadcast(); }
    if (bloom) bloom.strength = mode === "hangar" ? 0.3 : 0.5;
    if (composer && QUAL.bloom) composer.render(); else renderer.render(scene, camera);
    if (mode === 'flight' && mission) renderPip(); else { $('pip-frame').classList.add('hidden'); $('pip-label').classList.add('hidden'); }
    if (mode === 'hangar') renderPreview(dtReal);
  }

  /* ================= BAŞLANGIÇ ================= */
  function init() {
    $('load-text').textContent = 'Dünya ve fırlatma sahası hazırlanıyor…';
    setTimeout(() => {
      P.load();
      applyQuality(P.state.opts.quality || 'high');
      audio.setMuted(!!P.state.opts.muted);
      buildEarth();
      buildSites();
      fireP = new Particles(9000, true);
      smokeP = new Particles(9000, false);
      buildConstellation();
      buildMapLines();
      setSite(P.state.sel.rocket === 'ss' ? 'starbase' : 'cape');
      sunHour = 11; sunWeek = P.state.week;
      rebuildConstData(); rebuildNetLayer();
      H.init({
        launch: startLaunch,
        onWeek: () => { sunWeek = P.state.week; rebuildConstData(); rebuildNetLayer(); },
        onStation: rebuildNetLayer,
        onSelect: () => setSite(P.state.sel.rocket === 'ss' ? 'starbase' : 'cape'),
        onSettings: () => { applyQuality(P.state.opts.quality || 'high'); setMuted(!!P.state.opts.muted); },
        onPreview: k => { pvWant = k; },
      });
      H.render();
      $('loading').classList.add('hidden');
      if (!P.state.stats.launches) $('help').classList.remove('hidden');
      requestAnimationFrame(frame);
      setTimeout(upgradeTextures, 1500);
    }, 30);
  }
  // test / hata ayıklama erişimi
  window.GAME = {
    get mission() { return mission; }, get mode() { return mode; }, startPlanet, get PL() { return PL; }, voice, get ctx() { return ctxCur; }, P, setWarp: w => { warp = w; }, startLaunch, backToHangar,
    setFocus: id => { const c = mission && mission.crafts.find(k => k.id === id); if (c) setFocus(c); }, cam, setHour: h => { sunHour = h; },
  };
  init();
})();
