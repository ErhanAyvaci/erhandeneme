/* =====================================================================
   Detaylı prosedürel 3D modeller (roketler, kapsül, tesisler, gemiler)
   Kullanım: const MD = window.MODELS(THREE)
   Tüm roket grupları: orijin = en alt nokta (motor çıkışı), +Y ekseni yukarı
   ===================================================================== */
window.MODELS = function (T) {
  'use strict';
  const PI = Math.PI;

  /* ---------------- Doku üreticileri ---------------- */
  function canvasTex(w, h, draw, opts) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); draw(g, w, h);
    const t = new T.CanvasTexture(c);
    if (!opts || opts.color !== false) t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    if (opts && opts.repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
    return t;
  }
  const rnd = (a, b) => a + Math.random() * (b - a);

  // Falcon gövdesi: beyaz, ince panel çizgileri, dikey yazı, isteğe bağlı kurum
  function falconBodyTex(text, soot, len) {
    return canvasTex(256, 2048, (g, w, h) => {
      g.fillStyle = '#f3f3f0'; g.fillRect(0, 0, w, h);
      // panel/kaynak çizgileri
      g.strokeStyle = 'rgba(0,0,0,0.07)'; g.lineWidth = 2;
      const rings = Math.round(len / 3.2);
      for (let i = 1; i < rings; i++) { const y = h * i / rings; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.strokeStyle = 'rgba(0,0,0,0.05)';
      for (let x = 0; x < w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      // yazı (dikey)
      if (text) {
        g.save(); g.translate(w * 0.75, h * 0.18); g.rotate(PI / 2);
        g.fillStyle = '#111'; g.font = 'bold 54px Arial, sans-serif'; g.fillText(text, 0, 0);
        g.restore();
      }
      if (soot > 0) {
        for (let i = 0; i < 260 * soot; i++) {
          const x = Math.random() * w, y = Math.random() * h, hh = 40 + Math.random() * 420;
          const gr = g.createLinearGradient(0, y, 0, y + hh);
          const a = (0.06 + Math.random() * 0.16) * Math.min(1, soot);
          gr.addColorStop(0, 'rgba(45,38,30,0)'); gr.addColorStop(0.5, `rgba(45,38,30,${a})`); gr.addColorStop(1, 'rgba(45,38,30,0)');
          g.fillStyle = gr; g.fillRect(x, y, 1 + Math.random() * 7, hh);
        }
        const gb = g.createLinearGradient(0, h, 0, h * 0.55);
        gb.addColorStop(0, `rgba(30,25,20,${0.7 * Math.min(1, soot)})`); gb.addColorStop(1, 'rgba(30,25,20,0)');
        g.fillStyle = gb; g.fillRect(0, h * 0.55, w, h * 0.45);
        const gt = g.createLinearGradient(0, 0, 0, h * 0.12);
        gt.addColorStop(0, `rgba(30,25,20,${0.5 * Math.min(1, soot)})`); gt.addColorStop(1, 'rgba(30,25,20,0)');
        g.fillStyle = gt; g.fillRect(0, 0, w, h * 0.12);
      }
    });
  }
  const carbonTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#1d1e20'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) { const v = ((x / 4 + y / 4) % 2) ? 30 : 24; g.fillStyle = `rgb(${v},${v},${v + 2})`; g.fillRect(x, y, 4, 4); }
  }, { repeat: [6, 3] });
  // paslanmaz çelik: yatay kaynak halkaları + dikey parlak çizgiler
  function steelTex(len) {
    return canvasTex(512, 2048, (g, w, h) => {
      g.fillStyle = '#c7cbd0'; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x++) { const v = 190 + Math.round((Math.sin(x * 0.7) * 0.5 + Math.random() * 0.8) * 14); g.fillStyle = `rgba(${v},${v + 3},${v + 7},0.5)`; g.fillRect(x, 0, 1, h); }
      const rings = Math.round(len / 1.83);
      for (let i = 1; i < rings; i++) {
        const y = h * i / rings;
        g.fillStyle = 'rgba(80,70,60,0.35)'; g.fillRect(0, y - 1.5, w, 3);
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, y + 1.5, w, 1);
        // ısı lekesi
        if (Math.random() < 0.4) { g.fillStyle = `rgba(150,120,90,${rnd(0.05, 0.15)})`; g.fillRect(0, y - 6, w, 10); }
      }
      // dikey kaynaklar
      for (let i = 0; i < rings; i++) { const x = (i * 137) % w; g.fillStyle = 'rgba(90,80,70,0.25)'; g.fillRect(x, h * i / rings, 2, h / rings); }
    });
  }
  // altıgen ısı kalkanı karoları
  const hexTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#2a2b2e'; g.fillRect(0, 0, w, h);
    const s = 16, hx = s * Math.sqrt(3);
    for (let row = -1; row < h / (s * 1.5) + 1; row++) {
      for (let col = -1; col < w / hx + 1; col++) {
        const cx = col * hx + (row % 2 ? hx / 2 : 0), cy = row * s * 1.5;
        const v = 14 + Math.floor(Math.random() * 10) + (Math.random() < 0.03 ? 30 : 0);
        g.fillStyle = `rgb(${v},${v},${v + 1})`;
        g.beginPath();
        for (let k = 0; k < 6; k++) { const a = PI / 6 + k * PI / 3; g.lineTo(cx + Math.cos(a) * (s - 1.5), cy + Math.sin(a) * (s - 1.5)); }
        g.closePath(); g.fill();
      }
    }
  }, { repeat: [3, 10] });
  const ventTex = canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#5c5f63'; g.fillRect(0, 0, w, h);
    for (let x = 4; x < w; x += 16) { g.fillStyle = '#0b0b0c'; g.fillRect(x, 10, 9, h - 20); }
  }, { repeat: [8, 1] });
  const latticeTex = (rep, col) => canvasTex(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128); g.strokeStyle = col || '#d8d8d8'; g.lineWidth = 9; g.strokeRect(4, 4, 120, 120);
    g.lineWidth = 6; g.beginPath(); g.moveTo(0, 0); g.lineTo(128, 128); g.moveTo(128, 0); g.lineTo(0, 128); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.moveTo(0, 64); g.lineTo(128, 64); g.stroke();
  }, { repeat: rep });
  const gridFinTex = canvasTex(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    g.strokeStyle = '#bbb'; g.lineWidth = 3;
    for (let i = -128; i < 256; i += 11) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.moveTo(i, 128); g.lineTo(i + 128, 0); g.stroke(); }
    g.lineWidth = 12; g.strokeRect(6, 6, 116, 116);
  });
  const solarTex = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#0d1a3a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(150,170,220,0.35)'; g.lineWidth = 1;
    for (let x = 0; x < w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });

  /* ---------------- Malzemeler ---------------- */
  const M = {
    white: new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.05, envMapIntensity: 0.7 }),
    black: new T.MeshStandardMaterial({ color: 0x18191b, roughness: 0.6, metalness: 0.2, envMapIntensity: 0.5 }),
    carbon: new T.MeshStandardMaterial({ map: carbonTex, color: 0xffffff, roughness: 0.45, metalness: 0.3 }),
    engine: new T.MeshStandardMaterial({ color: 0x55524e, roughness: 0.32, metalness: 0.9, side: T.DoubleSide }),
    engineDark: new T.MeshStandardMaterial({ color: 0x2c2a28, roughness: 0.5, metalness: 0.7, side: T.DoubleSide }),
    copper: new T.MeshStandardMaterial({ color: 0x8a5a3c, roughness: 0.35, metalness: 0.9, side: T.DoubleSide }),
    niobium: new T.MeshStandardMaterial({ color: 0x4d4440, roughness: 0.28, metalness: 0.9, side: T.DoubleSide, emissive: 0x000000 }),
    alu: new T.MeshStandardMaterial({ color: 0xd8dbe0, roughness: 0.35, metalness: 0.6 }),
    ti: new T.MeshStandardMaterial({ map: gridFinTex, alphaTest: 0.4, side: T.DoubleSide, color: 0x6c6f72, roughness: 0.4, metalness: 0.85 }),
    alFin: new T.MeshStandardMaterial({ map: gridFinTex, alphaTest: 0.4, side: T.DoubleSide, color: 0x2f3134, roughness: 0.5, metalness: 0.6 }),
    tile: new T.MeshStandardMaterial({ map: hexTex, color: 0xffffff, roughness: 0.9, metalness: 0.05 }),
    vent: new T.MeshStandardMaterial({ map: ventTex, color: 0xffffff, roughness: 0.6, metalness: 0.6 }),
    concrete: new T.MeshStandardMaterial({ color: 0x9a9893, roughness: 0.95 }),
    darkConcrete: new T.MeshStandardMaterial({ color: 0x5b5a57, roughness: 0.95 }),
    paint: new T.MeshStandardMaterial({ color: 0xf5f3e8, roughness: 0.8 }),
    yellow: new T.MeshStandardMaterial({ color: 0xe3b81f, roughness: 0.6 }),
    deck: new T.MeshStandardMaterial({ color: 0x3e4247, roughness: 0.85, metalness: 0.3 }),
    hull: new T.MeshStandardMaterial({ color: 0x24282d, roughness: 0.6, metalness: 0.4 }),
    sat: new T.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.35, metalness: 0.75 }),
    solar: new T.MeshStandardMaterial({ map: solarTex, color: 0xffffff, roughness: 0.25, metalness: 0.6, side: T.DoubleSide }),
    lattice: new T.MeshStandardMaterial({ map: latticeTex([2, 26]), alphaTest: 0.5, side: T.DoubleSide, color: 0xa7abb0, roughness: 0.6, metalness: 0.5 }),
    latticeRed: new T.MeshStandardMaterial({ map: latticeTex([1, 16], '#c8c8c8'), alphaTest: 0.5, side: T.DoubleSide, color: 0x9da2a8, roughness: 0.6, metalness: 0.5 }),
    lamp: new T.MeshBasicMaterial({ color: 0xfff2d0 }),
    redLamp: new T.MeshBasicMaterial({ color: 0xff2a1a }),
    net: new T.MeshStandardMaterial({ color: 0x223322, roughness: 0.9, transparent: true, opacity: 0.55, side: T.DoubleSide }),
    water: new T.MeshStandardMaterial({ color: 0x0c2a3a, roughness: 0.25, metalness: 0.2 }),
    latticeRust: new T.MeshStandardMaterial({ map: latticeTex([2, 30], '#c8c8c8'), alphaTest: 0.5, side: T.DoubleSide, color: 0x9a4a32, roughness: 0.7, metalness: 0.4 }),
    tiFrame: new T.MeshStandardMaterial({ color: 0x5e6266, roughness: 0.38, metalness: 0.9 }),
    alFrame: new T.MeshStandardMaterial({ color: 0x2c2e31, roughness: 0.5, metalness: 0.6 }),
  };
  const cm = (m, list) => { const c = m.clone(); list.push(c); return c; };

  /* ---------------- Geometri yardımcıları ---------------- */
  function mesh(geo, mat, x, y, z) { const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; return m; }
  function box(w, h, d, mat, x, y, z) { return mesh(new T.BoxGeometry(w, h, d), mat, x, y, z); }
  function cyl(rt, rb, h, mat, y, seg, open, ts, tl) { return mesh(new T.CylinderGeometry(rt, rb, h, seg || 40, 1, !!open, ts, tl), mat, 0, y); }
  // çan şekilli nozul (Lathe), çıkış ağzı y=0'da, boğaz yukarıda
  function bellGeo(rt, re, len, seg) {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const r = rt + (re - rt) * (1 - Math.pow(1 - t, 1.9));
      pts.push(new T.Vector2(r, len * (1 - t)));
    }
    return new T.LatheGeometry(pts, seg || 24);
  }
  function ogivePts(r, len, n, base) {
    const pts = [];
    const rho = (r * r + len * len) / (2 * r);
    for (let i = 0; i <= n; i++) {
      const y = len * i / n;
      const rr = Math.sqrt(Math.max(0, rho * rho - y * y)) + r - rho;
      pts.push(new T.Vector2(Math.max(0.001, rr), (base || 0) + y));
    }
    return pts;
  }

  /* ---------------- Prosedürel normal haritaları ---------------- */
  function normalTex(w, h, drawHeight, strength, repeat) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); drawHeight(g, w, h);
    const src = g.getImageData(0, 0, w, h).data, out = g.createImageData(w, h), o = out.data;
    const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) / 255 * strength, dy = (H(x, y + 1) - H(x, y - 1)) / 255 * strength;
      const l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
      o[i] = (-dx / l * 0.5 + 0.5) * 255; o[i + 1] = (dy / l * 0.5 + 0.5) * 255; o[i + 2] = (1 / l * 0.5 + 0.5) * 255; o[i + 3] = 255;
    }
    g.putImageData(out, 0, 0);
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping; if (repeat) t.repeat.set(repeat[0], repeat[1]);
    return t;
  }
  // Falcon gövdesi: panel dikişleri, stringer çizgileri, perçin sıraları
  const panelN = normalTex(256, 512, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#5a5a5a'; for (let y = 0; y < h; y += 128) g.fillRect(0, y, w, 3);
    g.fillStyle = '#727272'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 2, h);
    g.fillStyle = '#a8a8a8'; for (let y = 0; y < h; y += 128) for (let x = 3; x < w; x += 8) { g.fillRect(x, y + 6, 2, 2); g.fillRect(x, y - 8, 2, 2); }
  }, 3.5, [3, 1]);
  // paslanmaz çelik: kaynak halkaları ve hafif dalgalanma
  const weldN = normalTex(256, 256, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x++) { const v = 128 + Math.round(Math.sin(x * 0.11) * 10 + Math.random() * 6); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, h); }
    g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, w, 4); g.fillStyle = '#9a9a9a'; g.fillRect(0, 4, w, 2);
    g.fillStyle = '#a0a0a0'; g.fillRect(w * 0.37, 0, 3, h);
  }, 4, [4, 1]);
  // ısı kalkanı karoları: aralıklarda girinti
  const hexN = normalTex(512, 512, (g, w, h) => {
    g.fillStyle = '#404040'; g.fillRect(0, 0, w, h);
    const s = 16, hx = s * Math.sqrt(3);
    for (let row = -1; row < h / (s * 1.5) + 1; row++) for (let col = -1; col < w / hx + 1; col++) {
      const cx = col * hx + (row % 2 ? hx / 2 : 0), cy = row * s * 1.5;
      const hv = 150 + Math.floor(Math.random() * 30); g.fillStyle = `rgb(${hv},${hv},${hv})`;
      g.beginPath(); for (let k = 0; k < 6; k++) { const a = PI / 6 + k * PI / 3; g.lineTo(cx + Math.cos(a) * (s - 2), cy + Math.sin(a) * (s - 2)); } g.closePath(); g.fill();
    }
  }, 5, [3, 10]);
  // rejeneratif soğutma boruları (nozul)
  const tubeTex = canvasTex(256, 64, (g, w, h) => {
    for (let x = 0; x < w; x += 4) { const v = 90 + (x % 8 ? 25 : 0); g.fillStyle = `rgb(${v + 30},${v},${v - 20})`; g.fillRect(x, 0, 4, h); }
  }, { repeat: [6, 1] });
  const tubeN = normalTex(128, 32, (g, w, h) => { for (let x = 0; x < w; x++) { const v = 128 + Math.round(Math.sin(x / 4 * PI * 2) * 90); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, h); } }, 3, [12, 1]);
  // oktaweb alt plakası
  const octaTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#26282b'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#43464a'; g.lineWidth = 6;
    g.beginPath(); for (let k = 0; k <= 8; k++) { const a = k / 8 * PI * 2 + PI / 8; g.lineTo(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92); } g.stroke();
    for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2 + PI / 8; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(a) * 124, 128 + Math.sin(a) * 124); g.stroke(); }
    g.fillStyle = 'rgba(120,110,90,0.35)'; for (let i = 0; i < 400; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  });
  // altın termal folyo (buruşuk)
  const foilTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c8962e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { const x = Math.random() * w, y = Math.random() * h; g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,230,150' : '110,70,15'},${rnd(0.15, 0.4)})`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-30, 30), y + rnd(-30, 30)); g.lineTo(x + rnd(-30, 30), y + rnd(-30, 30)); g.fill(); }
  });
  const radiatorTex = canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#e9ecef'; g.fillRect(0, 0, w, h); g.fillStyle = '#b9bec4'; for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 2); });
  const decalTex = canvasTex(512, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#1b3f8f'; g.beginPath(); g.arc(60, 64, 44, 0, PI * 2); g.fill();
    g.strokeStyle = '#4fc3ff'; g.lineWidth = 7; g.beginPath(); g.ellipse(60, 64, 58, 18, -0.4, 0, PI * 2); g.stroke();
    g.fillStyle = '#111'; g.font = 'bold 58px Arial, sans-serif'; g.fillText('YÖRÜNGE AĞI', 128, 84);
  });

  /* ---------------- Motor modelleri (gimbal pivotlu) ---------------- */
  const detailOf = (list, o) => { o.userData.detail = true; if (list) list.push(o); return o; };
  const tubeMat = new T.MeshStandardMaterial({ map: tubeTex, normalMap: tubeN, color: 0xffffff, roughness: 0.4, metalness: 0.85, side: T.DoubleSide });
  const kestrelMat = new T.MeshStandardMaterial({ color: 0xb08a3a, roughness: 0.35, metalness: 0.95, side: T.DoubleSide });
  // pivot = boğaz noktası; nozul aşağı doğru uzanır
  function merlinEngine(re, len, bellMat, details, vac) {
    const pv = new T.Group();
    const bell = new T.Mesh(bellGeo(re * 0.32, re, len, 28), vac ? bellMat : tubeMat); bell.position.y = -len; bell.castShadow = true; pv.add(bell);
    if (vac) { const reg = new T.Mesh(bellGeo(re * 0.32, re * 0.55, len * 0.28, 24), tubeMat); reg.position.y = -len * 0.28; pv.add(reg); }
    const ch = new T.Mesh(new T.CylinderGeometry(re * 0.24, re * 0.3, len * 0.28, 16), M.engine); ch.position.y = len * 0.12; pv.add(ch);
    const dome = new T.Mesh(new T.SphereGeometry(re * 0.26, 12, 8, 0, PI * 2, 0, PI / 2), M.engine); dome.position.y = len * 0.26; pv.add(dome);
    // turbopompa ve egzoz borusu
    const tp = detailOf(details, new T.Mesh(new T.CylinderGeometry(re * 0.13, re * 0.13, len * 0.3, 10), M.engineDark)); tp.position.set(re * 0.36, len * 0.12, 0); pv.add(tp);
    if (!vac) {
      const ex = detailOf(details, new T.Mesh(new T.CylinderGeometry(re * 0.07, re * 0.09, len * 0.75, 8), M.engineDark));
      ex.position.set(re * 0.62, -len * 0.3, 0); ex.rotation.z = 0.16; pv.add(ex);
    }
    // gimbal aktüatörleri
    for (const s of [-1, 1]) {
      const ac = detailOf(details, new T.Mesh(new T.CylinderGeometry(re * 0.035, re * 0.035, len * 0.5, 6), M.alu));
      ac.position.set(s * re * 0.2, len * 0.02, re * 0.3); ac.rotation.x = 0.5; pv.add(ac);
    }
    return pv;
  }
  function raptorEngine(re, len, vac, details) {
    const pv = new T.Group();
    const bell = new T.Mesh(bellGeo(re * 0.3, re, len, 28), vac ? M.niobium : tubeMat); bell.position.y = -len; bell.castShadow = true; pv.add(bell);
    const ch = new T.Mesh(new T.CylinderGeometry(re * 0.22, re * 0.28, len * 0.3, 14), M.engine); ch.position.y = len * 0.14; pv.add(ch);
    // iki turbopompa (yakıt/oksitleyici) ve manifold
    for (const s of [-1, 1]) { const tp = detailOf(details, new T.Mesh(new T.CylinderGeometry(re * 0.16, re * 0.14, len * 0.42, 10), s > 0 ? M.engineDark : M.engine)); tp.position.set(s * re * 0.3, len * 0.3, 0); pv.add(tp); }
    const man = detailOf(details, new T.Mesh(new T.TorusGeometry(re * 0.3, re * 0.05, 6, 16), M.engine)); man.rotation.x = PI / 2; man.position.y = len * 0.02; pv.add(man);
    return pv;
  }
  function engineCluster(g, n, ring, re, len, y, matOuter, matInner, rot, opts) {
    opts = opts || {};
    const list = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * PI * 2 + (rot || 0);
      const e = opts.type === 'raptor' ? raptorEngine(re, len, opts.vac, opts.details) : merlinEngine(re, len, matOuter, opts.details, opts.vac);
      e.position.set(Math.cos(a) * ring, y + len, Math.sin(a) * ring);
      g.add(e); list.push(e);
    }
    return list;
  }
  // ızgara kanatçık: kalın çerçeve + kafes; iç grup kanatçık ekseni etrafında döner
  function gridFin(w, h, t, mat, details) {
    const roll = new T.Group();
    const lat = new T.Mesh(new T.PlaneGeometry(w * 0.92, h * 0.92), mat); lat.rotation.y = PI / 2; roll.add(lat);
    const lat2 = lat.clone(); lat2.position.x = t * 0.4; roll.add(lat2);
    const fm = mat === M.ti ? M.tiFrame : M.alFrame;
    for (const [bw, bh, x, y] of [[w, t, 0, h / 2], [w, t, 0, -h / 2], [t, h, -w / 2, 0], [t, h, w / 2, 0]]) {
      const b = new T.Mesh(new T.BoxGeometry(t * 1.4, bh === t ? t : bh, bw === t ? t : bw), fm); b.position.set(0, y, x); b.castShadow = true; roll.add(b);
    }
    roll.position.y = h / 2;
    return roll;
  }
  // eksik karolu ısı kalkanı (hasarlı Ship)
  const hexTexDamaged = canvasTex(512, 512, (g, w, h) => {
    g.drawImage(hexTex.image, 0, 0);
    for (let i = 0; i < 40; i++) { const x = Math.random() * w, y = Math.random() * h; g.fillStyle = Math.random() < 0.5 ? '#d9d4cc' : '#8a8580'; g.beginPath(); g.arc(x, y, rnd(8, 20), 0, PI * 2); g.fill(); }
  }, { repeat: [3, 10] });

  /* ---------------- Falcon 1. kademe ---------------- */
  function falconBooster(def, o) {
    o = o || {};
    const g = new T.Group(), ml = [], details = [];
    const r = def.dia / 2, L = def.len, f1 = def.engines === 1;
    const soot = o.flights ? Math.min(1.5, 0.35 + o.flights * 0.3) : 0;
    const body = cm(M.white, ml);
    body.map = falconBodyTex(f1 ? 'FALCON 1' : (o.side ? '' : 'FALCON 9'), soot, L);
    body.normalMap = panelN; body.normalScale = new T.Vector2(0.5, 0.5);
    if (f1) { body.color.set(0xe8ebef); body.metalness = 0.4; body.roughness = 0.3; }
    const interH = o.nose ? 0 : (f1 ? 1.0 : 6.7);
    const noseH = o.nose ? 6.5 : 0;
    const bodyH = L - interH - noseH - 2.2;
    g.add(cyl(r, r, bodyH, body, 2.2 + bodyH / 2, 56));
    // motor bölmesi, ısı kalkanı ve oktaweb
    const eng = cm(M.engine, ml);
    const skirt = cyl(r, r * 0.985, 1.0, cm(M.black, ml), 1.7, 48); g.add(skirt);
    const base = mesh(new T.CircleGeometry(r * 0.99, 48), new T.MeshStandardMaterial({ map: octaTex, roughness: 0.7, metalness: 0.4, side: T.DoubleSide }), 0, 1.2, 0); base.rotation.x = PI / 2; g.add(base);
    let gimbals;
    if (f1) gimbals = engineCluster(g, 1, 0, 0.55, 1.2, 0, eng, null, 0, { details });
    else { gimbals = engineCluster(g, 1, 0, 0.44, 1.25, -0.05, eng, null, 0, { details }).concat(engineCluster(g, 8, r * 0.66, 0.44, 1.25, -0.05, eng, null, PI / 8, { details })); }
    // termal battaniye halkası (motorlar arası)
    if (!f1) { const bl = detailOf(details, mesh(new T.TorusGeometry(r * 0.66, 0.06, 6, 40), cm(M.engineDark, ml), 0, 1.15, 0)); bl.rotation.x = PI / 2; g.add(bl); }
    // kablo kanalı, tank hatları, logo
    if (!f1) {
      const rw = box(0.32, bodyH * 0.92, 0.26, cm(M.alu, ml), 0, 2.2 + bodyH / 2, r + 0.1); rw.material.color.set(0xcfd2d6); g.add(rw);
      const lx = detailOf(details, cyl(0.12, 0.12, bodyH * 0.55, cm(M.alu, ml), 2.2 + bodyH * 0.3, 8)); lx.position.set(-(r + 0.08), 2.2 + bodyH * 0.3, 0.3); g.add(lx);
      if (!o.side) { const dec = new T.Mesh(new T.PlaneGeometry(3.2, 0.8), new T.MeshStandardMaterial({ map: decalTex, transparent: true, roughness: 0.5 })); dec.position.set(0, 2.2 + bodyH * 0.25, r + 0.01); g.add(detailOf(details, dec)); }
    }
    if (o.nose) {
      const nm = cm(M.white, ml);
      const nose = mesh(new T.LatheGeometry(ogivePts(r, noseH, 16, 0), 48), nm, 0, L - noseH, 0); g.add(nose);
      g.add(cyl(r * 1.01, r * 1.01, 0.5, cm(M.black, ml), L - noseH + 0.25, 48));
    } else {
      const inter = cm(M.carbon, ml);
      g.add(cyl(r, r, interH, inter, L - interH / 2, 56));
      if (!f1) {
        g.add(cyl(r * 1.01, r * 1.01, 0.3, cm(M.alu, ml), L - interH, 48));
        // azot soğuk gaz itici kümeleri (nozullu)
        for (const s of [-1, 1]) {
          const pod = box(0.7, 0.8, 0.45, M.black, s * (r + 0.15), L - 1.6, 0); g.add(pod);
          for (const dy of [-0.2, 0.2]) { const nz = detailOf(details, mesh(new T.ConeGeometry(0.08, 0.22, 8, 1, true), M.engine, s * (r + 0.42), L - 1.6 + dy, 0)); nz.rotation.z = s * PI / 2; g.add(nz); }
        }
        // ayırma pistonları (üst halka)
        for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + PI / 8; g.add(detailOf(details, box(0.22, 0.45, 0.22, M.engineDark, Math.cos(a) * (r - 0.3), L + 0.05, Math.sin(a) * (r - 0.3)))); }
      }
    }
    if (o.sideAttach) for (const y of [6, L - 9]) g.add(box(0.5, 1.2, 0.8, M.alu, o.sideAttach * (r + 0.2), y, 0));
    const fins = [], legs = [];
    if (o.fins) {
      const finMat = o.titanium ? M.ti : M.alFin;
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * PI * 2 + PI / 4;
        const fy = L - (o.nose ? 9 : (f1 ? 1.6 : 2.2));
        const pv = new T.Group(); pv.position.set(Math.cos(a) * r, fy, Math.sin(a) * r); pv.rotation.y = -a;
        const s = f1 ? 0.6 : 1;
        const roll = gridFin(1.35 * s, 1.6 * s, 0.14 * s, finMat, details);
        pv.add(roll, box(0.3, 0.4, 0.4, M.engineDark, 0, 0, 0));
        pv.userData.roll = roll;
        g.add(pv); fins.push(pv);
        // aktüatör muhafazası
        g.add(detailOf(details, box(0.35, 0.7, 0.55, M.black, Math.cos(a) * (r + 0.12), fy - 0.45, Math.sin(a) * (r + 0.12))));
      }
    }
    let post = null;
    if (o.legs) {
      const legMat = cm(M.carbon, ml);
      const s = f1 ? 0.45 : 1;
      const struts = [];
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * PI * 2;
        const pv = new T.Group(); pv.position.set(Math.cos(a) * (r + 0.12), 2.6 * s + 0.2, Math.sin(a) * (r + 0.12)); pv.rotation.y = -a;
        // A-çerçeve bacak: iki kiriş + çapraz + ayak
        const leg = new T.Mesh(new T.BoxGeometry(0.34 * s, 9.4 * s, 0.24 * s), legMat); leg.position.set(0, 4.7 * s, 0.25 * s); leg.castShadow = true;
        const leg2 = leg.clone(); leg2.position.z = -0.25 * s;
        const web = box(0.3 * s, 8.6 * s, 0.4 * s, legMat, -0.02, 4.6 * s, 0);
        const foot = mesh(new T.CylinderGeometry(0.62 * s, 0.7 * s, 0.22 * s, 14), M.engineDark, 0, 9.45 * s, 0);
        const tip = box(0.45 * s, 0.5 * s, 0.75 * s, M.engineDark, 0, 9.1 * s, 0);
        pv.add(leg, leg2, web, foot, tip); g.add(pv); legs.push(pv);
        // teleskopik amortisör: gövdeden bacağa
        const sleeve = mesh(new T.CylinderGeometry(0.16 * s, 0.16 * s, 1, 10), M.engineDark), rod = mesh(new T.CylinderGeometry(0.09 * s, 0.09 * s, 1, 8), M.alu);
        g.add(sleeve, rod);
        struts.push({ pv, sleeve, rod, anchor: new T.Vector3(Math.cos(a) * (r + 0.05), 2.6 * s + 0.2 + 7.6 * s, Math.sin(a) * (r + 0.05)), p: new T.Vector3(0, 6.4 * s, 0) });
      }
      const up = new T.Vector3(0, 1, 0), A = new T.Vector3(), B = new T.Vector3(), D = new T.Vector3();
      post = () => {
        for (const st of struts) {
          st.pv.updateMatrix();
          A.copy(st.anchor); B.copy(st.p).applyMatrix4(st.pv.matrix);
          D.subVectors(B, A); const len = D.length(); D.normalize();
          const q = new T.Quaternion().setFromUnitVectors(up, D);
          const ls = Math.min(len, 4.2 * s), lr = Math.max(0.05, len - ls * 0.9);
          st.sleeve.quaternion.copy(q); st.sleeve.scale.set(1, ls, 1); st.sleeve.position.copy(A).addScaledVector(D, ls / 2);
          st.rod.quaternion.copy(q); st.rod.scale.set(1, lr, 1); st.rod.position.copy(B).addScaledVector(D, -lr / 2);
        }
      };
      post();
    }
    return { g, mats: ml, fins, legs, gimbals, details, post, len: L, r, plume: null, plumeR: f1 ? 0.55 : r * 0.92, plumeL: f1 ? 12 : 26, plumeY: -0.05, engineType: 'merlin', bodyMat: body };
  }
  function falconUpper(def, f1) {
    const g = new T.Group(), ml = [], details = [];
    const r = def.dia / 2, L = def.len;
    const body = cm(M.white, ml);
    body.map = falconBodyTex('', 0, L); body.normalMap = panelN; body.normalScale = new T.Vector2(0.4, 0.4);
    if (f1) { body.color.set(0xe8ebef); body.metalness = 0.4; }
    g.add(cyl(r, r, L, body, L / 2, 56));
    g.add(cyl(r * 1.005, r * 1.005, 0.25, cm(M.black, ml), L - 0.2, 48));
    // yük adaptörü halkası
    g.add(cyl(r * 0.62, r * 0.9, 0.6, cm(M.alu, ml), L + 0.3, 40));
    const nb = cm(M.niobium, ml);
    let gimbals;
    if (f1) {
      // Kestrel: altın renkli küçük nozul, açık borular
      const k = new T.Group(); k.position.y = 0;
      const bell = new T.Mesh(bellGeo(0.12, 0.42, 0.9, 28), kestrelMat); bell.position.y = -0.9; k.add(bell);
      for (let i = 0; i < 3; i++) { const a = i / 3 * PI * 2; const pipe = detailOf(details, mesh(new T.CylinderGeometry(0.03, 0.03, 0.5, 6), M.alu, Math.cos(a) * 0.2, -0.1, Math.sin(a) * 0.2)); k.add(pipe); }
      g.add(k); gimbals = [k];
      return { g, mats: ml, len: L, r, gimbals, details, plumeR: 0.4, plumeL: 6, plumeY: -0.9, engineType: 'merlin', bell: nb };
    }
    // MVac: rejeneratif üst kısım + radyatif niyobyum uzantı
    const e = merlinEngine(1.6, 3.2, nb, details, true); e.position.y = 0; g.add(e); gimbals = [e];
    e.children[0].material = nb;
    const tex = detailOf(details, mesh(new T.CylinderGeometry(0.1, 0.13, 1.6, 8), M.engineDark, 0.75, -0.6, 0)); tex.rotation.z = 0.12; g.add(tex);
    const aft = mesh(new T.CircleGeometry(r * 0.98, 40), cm(M.engineDark, ml), 0, 0.02, 0); aft.rotation.x = PI / 2; g.add(aft);
    // COPV kubbeleri ve RCS
    for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + PI / 4; g.add(detailOf(details, mesh(new T.SphereGeometry(0.28, 10, 8), M.carbon, Math.cos(a) * r * 0.55, 0.35, Math.sin(a) * r * 0.55))); }
    for (const s of [-1, 1]) g.add(detailOf(details, box(0.4, 0.5, 0.3, M.black, s * (r + 0.1), L - 1.2, 0)));
    return { g, mats: ml, len: L, r, gimbals, details, plumeR: 1.5, plumeL: 14, plumeY: -3.2, engineType: 'merlin', bell: nb };
  }

  function fairingHalves(fr, flen) {
    const halves = [], ml = [];
    const cylL = flen * 0.48;
    const og = ogivePts(fr, flen - cylL, 20, cylL);
    for (const side of [0, 1]) {
      const hg = new T.Group();
      const m = cm(M.white, ml); m.side = T.DoubleSide;
      const c = mesh(new T.CylinderGeometry(fr, fr, cylL - 0.8, 40, 1, true, side * PI, PI), m, 0, 0.8 + (cylL - 0.8) / 2, 0); hg.add(c);
      const boat = mesh(new T.CylinderGeometry(fr, fr * 0.72, 0.8, 40, 1, true, side * PI, PI), m, 0, 0.4, 0); hg.add(boat);
      const o = mesh(new T.LatheGeometry(og, 40, side * PI, PI), m); hg.add(o);
      const seam = box(0.06, cylL, 0.06, M.black, 0, cylL / 2, (side ? -1 : 1) * 0.0); seam.position.x = (side ? -1 : 1) * 0.0; hg.add(seam);
      hg.userData.mats = ml;
      halves.push(hg);
    }
    return halves;
  }
  function payloadStack(n, w, h) {
    const g = new T.Group();
    const k = Math.min(30, Math.max(3, n));
    for (let i = 0; i < k; i++) {
      const b = box(w, h / k * 0.8, w * 0.48, M.sat, 0, (i + 0.5) * h / k, 0); g.add(b);
      const s = box(w * 0.9, h / k * 0.12, w * 0.46, M.solar, 0, (i + 0.85) * h / k, 0); g.add(s);
    }
    g.add(cyl(0.25, 0.25, h, M.alu, h / 2, 8));
    return g;
  }
  /* ---------------- Starship ---------------- */
  function steelMat(len, flights, ml) {
    const st = cm(M.alu, ml);
    st.map = steelTex(len); st.color.set(flights ? 0xd2c8bb : 0xffffff); st.metalness = 0.92; st.roughness = 0.3; st.envMapIntensity = 1.0;
    st.normalMap = weldN.clone(); st.normalMap.needsUpdate = true; st.normalMap.repeat.set(4, Math.round(len / 1.83)); st.normalScale = new T.Vector2(0.35, 0.35);
    if (flights) { st.emissive = new T.Color(0x000000); st.color.lerp(new T.Color(0xb8a48a), Math.min(0.5, flights * 0.06)); }
    return st;
  }
  function superHeavy(def, o) {
    o = o || {};
    const g = new T.Group(), ml = [], details = [];
    const r = 4.5, L = def.len;
    const st = steelMat(L, o.flights, ml);
    g.add(cyl(r, r, L - 6, st, 3.5 + (L - 6) / 2, 72));
    // sıcak ayrılma halkası
    g.add(cyl(r, r, 2.0, cm(M.vent, ml), L - 1.0, 72));
    g.add(cyl(r * 1.005, r * 1.005, 0.3, cm(M.alu, ml), L - 2.1, 72));
    // motor bölmesi + dış motor kalkanları
    g.add(cyl(r, r * 1.02, 3.0, cm(M.engineDark, ml), 2.0, 72));
    const plate = mesh(new T.CircleGeometry(r, 64), new T.MeshStandardMaterial({ map: octaTex, roughness: 0.7, metalness: 0.4, side: T.DoubleSide }), 0, 0.6, 0); plate.rotation.x = PI / 2; g.add(plate);
    const eng = cm(M.engine, ml);
    const gimbals = engineCluster(g, 3, 1.1, 0.66, 1.7, -1.1, eng, null, 0, { type: 'raptor', details })
      .concat(engineCluster(g, 10, 2.55, 0.64, 1.7, -1.1, eng, null, 0.3, { type: 'raptor', details }));
    engineCluster(g, 20, 3.85, 0.56, 1.4, -0.8, eng, null, 0.1, { type: 'raptor', details });
    for (let i = 0; i < 20; i++) { const a = i / 20 * PI * 2 + 0.1; { const _o = detailOf(details, box(0.9, 1.2, 0.25, M.engineDark, Math.cos(a) * 4.35, 1.0, Math.sin(a) * 4.35)); _o.rotation.y = -a + PI / 2; g.add(_o); } }
    // şaseler, yakıt transfer tüpü, COPV, QD plakası
    for (const s of [-1, 1]) g.add(box(0.5, L - 14, 0.9, st, s * (r + 0.2), L / 2 - 2, 0));
    const tube = cyl(0.45, 0.45, L - 10, cm(M.alu, ml), L / 2, 12); tube.position.z = r + 0.3; g.add(tube);
    g.add(detailOf(details, box(2.4, 3.2, 0.5, M.engineDark, 0, 5.5, -(r + 0.2))));
    for (let i = 0; i < 6; i++) g.add(detailOf(details, box(0.3, L - 20, 0.2, M.alu, Math.cos(i * 1.05 + 0.4) * (r + 0.05), L / 2 - 1, Math.sin(i * 1.05 + 0.4) * (r + 0.05))));
    // 3 büyük ızgara kanatçık
    const fins = [];
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * PI * 2 + PI / 2;
      const pv = new T.Group(); pv.position.set(Math.cos(a) * r, L - 5.5, Math.sin(a) * r); pv.rotation.y = -a;
      const roll = gridFin(4.2, 5.2, 0.45, M.ti, details);
      pv.add(roll, box(1.2, 1.4, 1.6, M.engineDark, 0.3, 0, 0)); pv.userData.roll = roll;
      g.add(pv); fins.push(pv);
    }
    // yakalama pimleri
    for (const s of [-1, 1]) { g.add(box(1.2, 0.8, 1.4, M.engineDark, 0, L - 8, s * (r + 0.6))); g.add(box(0.6, 0.6, 0.6, M.yellow, 0, L - 7.4, s * (r + 1.1))); }
    return { g, mats: ml, fins, legs: [], gimbals, details, len: L, r, plumeR: 4.2, plumeL: 55, plumeY: -1.1, engineType: 'raptor' };
  }
  function flapGeo(w1, w2, h, t) {
    const sh = new T.Shape();
    sh.moveTo(0, 0); sh.lineTo(w1, 0); sh.lineTo(w2, h); sh.quadraticCurveTo(w2 * 0.4, h * 1.08, 0, h);
    const geo = new T.ExtrudeGeometry(sh, { depth: t, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 1 });
    geo.translate(0, 0, -t / 2);
    return geo;
  }
  function ship(def, o) {
    o = o || {};
    const g = new T.Group(), ml = [], details = [];
    const r = 4.5, L = def.len;
    const st = steelMat(40, o.flights, ml);
    const tile = cm(M.tile, ml); tile.normalMap = hexN; tile.normalScale = new T.Vector2(0.8, 0.8);
    if (o.missingTiles) tile.map = hexTexDamaged;
    g.add(cyl(r, r, 38, st, 2 + 19, 72));
    g.add(mesh(new T.CylinderGeometry(r + 0.06, r + 0.06, 38, 72, 1, true, PI * 0.5, PI), tile, 0, 21, 0));
    const og = ogivePts(r, 12, 28, 40);
    g.add(mesh(new T.LatheGeometry(og, 72), st));
    g.add(mesh(new T.LatheGeometry(og.map(p => new T.Vector2(p.x + 0.06, p.y)), 72, PI * 0.5, PI), tile));
    g.add(cyl(r, r * 1.01, 2.2, cm(M.engineDark, ml), 1.1, 72));
    // kanatçıklar + menteşe kaportaları
    const aftGeo = flapGeo(9.5, 6.5, 5.2, 0.5), fwdGeo = flapGeo(6.5, 3.5, 3.6, 0.4);
    const flaps = [];
    for (const s of [-1, 1]) {
      const af = new T.Group(); af.position.set(s * r, 4.5, -0.8);
      const am = new T.Mesh(aftGeo, tile); am.rotation.z = s > 0 ? -PI / 2 : PI / 2; am.castShadow = true; af.add(am); g.add(af); flaps.push(af);
      g.add(box(1.4, 9.8, 1.6, tile, s * (r + 0.4), 9.3, -0.8));
      const ff = new T.Group(); ff.position.set(s * r * 0.8, 42.5, -1.2); ff.rotation.z = s * 0.22;
      const fm = new T.Mesh(fwdGeo, tile); fm.rotation.z = s > 0 ? -PI / 2 : PI / 2; fm.castShadow = true; ff.add(fm); g.add(ff); flaps.push(ff);
      const fc = box(1.1, 6.8, 1.3, tile, s * (r * 0.8 + 0.4), 45.8, -1.2); fc.rotation.z = s * 0.22; g.add(fc);
    }
    // yük kapısı (PEZ), RCS, tank hatları
    const door = box(0.2, 3.2, 6.5, cm(M.engineDark, ml), 0, 32, 0); door.position.z = -r - 0.05; door.rotation.y = PI / 2; g.add(door);
    for (const y of [8, 36]) for (const s of [-1, 1]) g.add(detailOf(details, box(0.5, 0.7, 0.4, M.engineDark, s * (r + 0.1), y, 1.8)));
    g.add(detailOf(details, box(0.4, 30, 0.3, M.alu, 0, 20, r + 0.08)));
    // motorlar: 3 deniz seviyesi (gimbal) + 3 vakum
    const eng = cm(M.engine, ml), nb = cm(M.niobium, ml);
    const gimbals = engineCluster(g, 3, 1.05, 0.66, 1.6, -1.6, eng, null, 0, { type: 'raptor', details });
    const rv = engineCluster(g, 3, 2.85, 1.2, 2.9, -2.9, nb, null, PI / 3, { type: 'raptor', vac: true, details });
    for (const e of rv) e.children[0].material = nb;
    return { g, mats: ml, fins: [], legs: [], flaps, gimbals, details, len: L, r, plumeR: 3.3, plumeL: 30, plumeY: -2.0, engineType: 'raptor', bell: nb };
  }

  /* ---------------- Dragon ---------------- */
  function dragon(crew) {
    const g = new T.Group(), ml = [], details = [];
    const w = cm(M.white, ml);
    // gövde (trunk): yarısı güneş paneli, yarısı radyatör
    g.add(cyl(1.85, 1.85, 3.7, w, 1.85, 56));
    g.add(mesh(new T.CylinderGeometry(1.87, 1.87, 2.6, 56, 1, true, 0, PI), M.solar, 0, 2.0, 0));
    g.add(mesh(new T.CylinderGeometry(1.87, 1.87, 2.6, 56, 1, true, PI, PI), new T.MeshStandardMaterial({ map: radiatorTex, roughness: 0.6 }), 0, 2.0, 0));
    for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + PI / 4; const f = box(0.08, 1.4, 0.7, w, Math.cos(a) * 1.95, 0.8, Math.sin(a) * 1.95); f.rotation.y = -a; g.add(f); }
    g.add(cyl(1.9, 1.9, 0.12, cm(M.alu, ml), 3.66, 56));
    // kapsül
    const pts = [new T.Vector2(0.01, 0), new T.Vector2(1.85, 0.25), new T.Vector2(1.9, 0.5), new T.Vector2(1.25, 3.1), new T.Vector2(0.75, 3.6), new T.Vector2(0.01, 3.62)];
    g.add(mesh(new T.LatheGeometry(pts, 56), w, 0, 3.7, 0));
    g.add(cyl(1.9, 1.86, 0.25, cm(M.black, ml), 3.82, 56));
    // SuperDraco çiftleri, Draco iticileri, pencereler
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * PI * 2;
      const sd = box(0.55, 1.0, 0.22, M.engineDark, Math.cos(a) * 1.45, 5.6, Math.sin(a) * 1.45); sd.rotation.y = -a + PI / 2; sd.rotation.z = 0.32; g.add(sd);
      for (const dx of [-0.13, 0.13]) { const nz = detailOf(details, mesh(new T.CylinderGeometry(0.06, 0.09, 0.2, 8), M.engine, Math.cos(a) * 1.5 + Math.sin(a) * dx, 5.05, Math.sin(a) * 1.5 - Math.cos(a) * dx)); g.add(nz); }
    }
    for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2 + 0.2, y = i % 2 ? 6.5 : 4.4, rr = i % 2 ? 1.0 : 1.72; { const _o = detailOf(details, box(0.12, 0.12, 0.06, M.black, Math.cos(a) * rr, y, Math.sin(a) * rr)); _o.rotation.y = -a + PI / 2; g.add(_o); } }
    if (crew) for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + 0.6; const win = box(0.38, 0.38, 0.06, new T.MeshStandardMaterial({ color: 0x0a1520, roughness: 0.05, metalness: 0.9 }), Math.cos(a) * 1.58, 5.0, Math.sin(a) * 1.58); win.rotation.y = -a + PI / 2; win.rotation.x = -0.22; g.add(win); }
    const hinge = new T.Group(); hinge.position.set(0, 7.3, -0.75); g.add(hinge);
    hinge.add(mesh(new T.SphereGeometry(0.78, 28, 14, 0, PI * 2, 0, PI / 2), w, 0, 0, 0.75));
    g.add(cyl(0.45, 0.5, 0.25, M.alu, 7.35, 24));
    { const _o = detailOf(details, mesh(new T.TorusGeometry(0.48, 0.05, 6, 24), M.engineDark, 0, 7.48, 0)); _o.rotation.x = PI / 2; g.add(_o); }
    g.userData.nose = hinge;
    return { g, mats: ml, len: 8.1, details };
  }

  /* ---------------- Uydular ---------------- */
  function satellite(gen) {
    const g = new T.Group();
    const big = gen === 'v2m' || gen === 'v3';
    const s = gen === 'v3' ? 2.0 : big ? 1.4 : 1;
    // yassı gövde, altında faz dizili antenler
    g.add(box(2.8 * s, 0.22 * s, 1.4 * s, M.sat));
    for (const x of [-0.8, 0.1]) g.add(box(0.75 * s, 0.04, 0.75 * s, M.engineDark, x * s, -0.13 * s, 0));
    if (gen !== 'v09' && gen !== 'v10') for (const x of [-1.2, 1.2]) g.add(mesh(new T.CylinderGeometry(0.1 * s, 0.12 * s, 0.25 * s, 10), M.alu, x * s, 0.22 * s, 0.5 * s)); // lazer terminalleri
    { const _o = mesh(new T.CylinderGeometry(0.06 * s, 0.1 * s, 0.25 * s, 8), M.engine, -1.45 * s, 0, 0); _o.rotation.z = PI / 2; g.add(_o); } // Hall iticisi
    g.add(box(0.2 * s, 0.15 * s, 0.2 * s, M.black, 0.9 * s, 0.18 * s, -0.4 * s)); // yıldız izleyici
    const arm = cyl(0.05, 0.05, 1.2, M.alu, 0, 6); arm.rotation.z = PI / 2; arm.position.x = 1.9 * s; g.add(arm);
    const panel = new T.Mesh(new T.PlaneGeometry(8 * s, 2.6 * s), M.solar); panel.rotation.x = PI / 2; panel.position.x = 5.4 * s; g.add(panel);
    if (big) { const p2 = panel.clone(); p2.position.x = -5.4 * s; g.add(p2); }
    g.userData.panels = g.children.filter(c => c.geometry && c.geometry.type === 'PlaneGeometry');
    return g;
  }
  // GEO haberleşme / röle uydusu
  function geoSat(scale) {
    const s = scale || 1, g = new T.Group();
    const foil = new T.MeshStandardMaterial({ map: foilTex, color: 0xffffff, roughness: 0.35, metalness: 0.9 });
    g.add(box(1.8 * s, 2.6 * s, 1.8 * s, foil, 0, 1.3 * s, 0));
    g.add(box(1.82 * s, 0.4 * s, 1.82 * s, new T.MeshStandardMaterial({ map: radiatorTex, roughness: 0.5 }), 0, 2.2 * s, 0));
    // çanak antenler
    const dish = new T.LatheGeometry([new T.Vector2(0.01, 0), new T.Vector2(0.4, 0.04), new T.Vector2(0.8, 0.16), new T.Vector2(1.0, 0.27)].map(p => p.multiplyScalar(s)), 24);
    for (const sd of [-1, 1]) { const d = mesh(dish, M.paint, sd * 1.25 * s, 1.6 * s, 0); d.rotation.z = sd * PI / 2; g.add(d); }
    g.add(mesh(new T.CylinderGeometry(0.06 * s, 0.06 * s, 0.6 * s, 8), M.alu, 0, 2.8 * s, 0));
    // katlı güneş kanatları (3'er panel)
    const wings = [];
    for (const sd of [-1, 1]) {
      const wg = new T.Group(); wg.position.set(0, 1.3 * s, sd * 0.95 * s);
      for (let i = 0; i < 3; i++) { const p = new T.Mesh(new T.PlaneGeometry(1.6 * s, 2.2 * s), M.solar); p.position.z = sd * (1.4 + i * 2.3) * s; p.rotation.x = PI / 2; wg.add(p); }
      { const _o = mesh(new T.CylinderGeometry(0.04 * s, 0.04 * s, 1.0 * s, 6), M.alu, 0, 0, sd * 0.5 * s); _o.rotation.x = PI / 2; wg.add(_o); }
      g.add(wg); wings.push(wg);
    }
    { const _o = mesh(new T.ConeGeometry(0.3 * s, 0.6 * s, 12, 1, true), M.engine, 0, -0.2 * s, 0); _o.rotation.x = PI; g.add(_o); }
    g.userData.wings = wings;
    return g;
  }

  function station() {
    const g = new T.Group();
    const truss = new T.Mesh(new T.BoxGeometry(2.4, 2.4, 108), M.lattice); g.add(truss);
    const arr = new T.MeshStandardMaterial({ map: solarTex, color: 0xd9b36a, roughness: 0.35, metalness: 0.6, side: T.DoubleSide, emissive: 0x1a1204 });
    for (const z of [-50, -38, 38, 50]) for (const s of [-1, 1]) {
      const p = new T.Mesh(new T.PlaneGeometry(11, 34), arr); p.position.set(0, s * 19, z); g.add(p);
      g.add(mesh(new T.CylinderGeometry(0.15, 0.15, 36, 6), M.alu, 0, s * 19, z));
    }
    const rad = new T.MeshStandardMaterial({ map: radiatorTex, roughness: 0.5, side: T.DoubleSide });
    for (const z of [-22, 22]) for (let i = 0; i < 3; i++) { const r = new T.Mesh(new T.PlaneGeometry(3, 12), rad); r.position.set(0, -8 - i * 3.2, z); r.rotation.y = PI / 2; g.add(r); }
    // modüller (X ekseni boyunca) + yan modüller
    const mods = [[-16, 4.2, 9], [-6, 4.4, 10], [5, 4.2, 9], [15, 3.6, 7], [23, 3.6, 6]];
    for (const [x, r, l] of mods) {
      const m = mesh(new T.CylinderGeometry(r * 0.5, r * 0.5, l, 24), M.white, x, -4, 0); m.rotation.z = PI / 2; g.add(m);
      for (const dx of [-l / 2 + 0.5, l / 2 - 0.5]) { const ring = mesh(new T.CylinderGeometry(r * 0.52, r * 0.52, 0.3, 24), M.alu, x + dx, -4, 0); ring.rotation.z = PI / 2; g.add(ring); }
    }
    for (const z of [-5, 5]) { const m = mesh(new T.CylinderGeometry(2, 2, 7, 20), M.white, -6, -4, z); m.rotation.x = PI / 2; g.add(m); }
    g.add(mesh(new T.SphereGeometry(2.4, 16, 12), M.white, 28, -4, 0));
    const port = cyl(0.8, 0.8, 1.5, M.alu, 0, 12); port.position.set(31, -4, 0); port.rotation.z = PI / 2; g.add(port);
    const arm = box(14, 0.6, 0.6, M.white, -2, 2, 6); arm.rotation.y = 0.4; g.add(arm);
    g.userData.port = new T.Vector3(32.5, -4, 0);
    return g;
  }

  /* ---------------- Tesisler ---------------- */
  function floodLight(g, x, y, z, lights, dir) {
    const pole = box(0.4, y, 0.4, M.alu, x, y / 2, z); g.add(pole);
    const head = box(2.2, 1.2, 0.6, M.engineDark, x, y, z); g.add(head);
    const lamp = box(2.0, 1.0, 0.1, M.lamp, x + (dir ? dir[0] * 0.35 : 0), y, z + (dir ? dir[1] * 0.35 : 0.35)); g.add(lamp);
    lights.push({ pos: [x, y, z], lamp });
  }
  // kafes kule: 4 köşe dikmesi + kafes yüzler + kat platformları
  function trussTower(w, h, mat, platMat, step) {
    const g = new T.Group();
    const faces = new T.Mesh(new T.BoxGeometry(w, h, w), mat); faces.position.y = h / 2; faces.castShadow = true; g.add(faces);
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) g.add(box(w * 0.07, h, w * 0.07, M.alu, x * w / 2, h / 2, z * w / 2));
    for (let y = step; y < h; y += step) g.add(box(w * 1.06, 0.45, w * 1.06, platMat, 0, y, 0));
    return g;
  }
  function pipe(g, pts, r, mat) {
    for (let i = 1; i < pts.length; i++) {
      const a = new T.Vector3(...pts[i - 1]), b = new T.Vector3(...pts[i]), d = b.clone().sub(a), L = d.length();
      const m = mesh(new T.CylinderGeometry(r, r, L, 10), mat); m.position.copy(a).addScaledVector(d, 0.5);
      m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); g.add(m);
    }
  }
  function falconPad(kind) {
    const is39 = kind === '39a';
    const g = new T.Group(), lights = [], anim = {};
    g.add(box(110, 1.2, 110, M.concrete, 0, -0.5, 0));
    // alev çukuru (koyu yarık + beton duvarlar) ve fırlatma tablası
    g.add(box(16, 1.25, 56, M.darkConcrete, 0, -0.48, -34));
    g.add(box(14, 0.2, 52, new T.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 }), 0, 0.15, -34));
    for (const s of [-1, 1]) g.add(box(1.2, 3, 54, M.concrete, s * 7.6, 1.2, -34));
    const mountW = is39 ? 16 : 8;
    g.add(box(mountW, 3.2, 8, M.engineDark, 0, 1.6, 0));
    for (const s of [-1, 1]) for (const t of [-1, 1]) g.add(box(0.8, 3.2, 0.8, M.alu, s * (mountW / 2 - 0.5), 1.6, t * 3.5));
    // ses bastırma su sistemi (deluge) boruları
    const dl = new T.MeshStandardMaterial({ color: 0x8a8f94, roughness: 0.5, metalness: 0.7 });
    const ring = mesh(new T.TorusGeometry(mountW * 0.8, 0.35, 8, 40), dl, 0, 0.6, 0); ring.rotation.x = PI / 2; g.add(ring);
    pipe(g, [[mountW * 0.8, 0.6, 0], [40, 0.6, 10], [70, 0.6, 30]], 0.45, dl);
    anim.deluge = { r: mountW * 0.8 };
    // TE (transporter-erector) — geri yatar
    const te = new T.Group(); te.position.set(is39 ? -9 : -5.6, 0.5, 0);
    const teMesh = new T.Mesh(new T.BoxGeometry(is39 ? 4 : 2.8, 62, is39 ? 12 : 3.2), M.lattice); teMesh.position.y = 31; teMesh.castShadow = true; te.add(teMesh);
    for (let y = 8; y < 60; y += 12) { const arm = box(3.4, 0.5, is39 ? 10 : 0.5, M.alu, 2.2, y, 0); te.add(arm); }
    for (let y = 4; y < 60; y += 6) te.add(box(0.15, 0.15, 0.15, M.redLamp, -1.6, y, 1.6));
    g.add(te); anim.te = te;
    // sabit servis kulesi + mürettebat erişim kolu
    const fss = new T.Group(); fss.position.set(is39 ? -26 : -22, 0, 0);
    const towerH = is39 ? 90 : 80;
    fss.add(trussTower(is39 ? 12 : 9, towerH, is39 ? M.latticeRust : M.lattice, M.darkConcrete, 11));
    // mürettebat erişim kolu ve "beyaz oda"
    const cab = new T.Group(); cab.position.set(0, is39 ? 76 : 66, 0);
    const tube = box(is39 ? 18 : 14, 2.6, 2.6, M.white, (is39 ? 18 : 14) / 2, 0, 0); cab.add(tube);
    const wr = box(3.2, 3.4, 3.4, M.white, is39 ? 18.4 : 14.4, 0, 0); cab.add(wr);
    for (let i = 1; i < 6; i++) cab.add(box(0.15, 0.6, 2.62, M.black, i * (is39 ? 3 : 2.4), 0.5, 0));
    fss.add(cab); anim.arm = cab;
    fss.add(box(1.0, 8, 1.0, M.alu, 0, towerH + 4, 0));
    fss.add(box(0.6, 0.6, 0.6, M.redLamp, 0, towerH + 8.5, 0));
    g.add(fss);
    // paratoner sistemi
    const tops = [];
    if (is39) {
      g.add(trussTower(3, 150, M.lattice, M.alu, 30).translateX(-40).translateZ(-30));
      tops.push(new T.Vector3(-40, 150, -30));
      for (const [x, z] of [[45, 45], [45, -45], [-45, 45]]) { g.add(box(1.2, 60, 1.2, M.alu, x, 30, z)); tops.push(new T.Vector3(x, 60, z)); }
      const wires = [];
      for (let i = 1; i < tops.length; i++) wires.push(tops[0], tops[i]);
      g.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(wires), new T.LineBasicMaterial({ color: 0x222222 })));
    } else {
      for (const [x, z] of [[28, 28], [-28, 28], [28, -28], [-28, -28]]) { g.add(box(1.4, 95, 1.4, M.alu, x, 47.5, z)); tops.push(new T.Vector3(x, 95, z)); g.add(box(0.5, 0.5, 0.5, M.redLamp, x, 95.5, z)); }
      g.add(new T.Line(new T.BufferGeometry().setFromPoints([tops[0], tops[1], tops[3], tops[2], tops[0]]), new T.LineBasicMaterial({ color: 0x222222 })));
    }
    // yakıt tankları ve boru hatları
    g.add(mesh(new T.SphereGeometry(9, 24, 16), M.white, 70, 11, 55));
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; g.add(box(0.6, 6, 0.6, M.alu, 70 + Math.cos(a) * 6, 3, 55 + Math.sin(a) * 6)); }
    for (const z of [-50, -60]) { const t = mesh(new T.CylinderGeometry(3.5, 3.5, 30, 20), M.alu, 75, 4, z); t.rotation.z = PI / 2; g.add(t); }
    pipe(g, [[62, 1, 55], [20, 1, 20], [3, 1, 3]], 0.35, M.alu);
    pipe(g, [[60, 1, -55], [15, 1, -15], [3, 1, -3]], 0.3, M.alu);
    g.add(box(1, 40, 1, M.alu, -70, 20, 60)); g.add(mesh(new T.SphereGeometry(6, 20, 14), M.white, -70, 44, 60));
    for (const b of [[-1800, 160, 120, 140, -400], [-900, 40, 60, 25, 300], [-2400, 30, 80, 60, 900], [-600, 18, 40, 30, -700], [-350, 12, 30, 20, 220]]) g.add(box(b[2], b[1], b[3], M.alu, b[0], b[1] / 2, b[4]));
    floodLight(g, 40, 22, 15, lights, [-1, 0]); floodLight(g, 40, 22, -15, lights, [-1, 0]); floodLight(g, -40, 22, 20, lights, [1, 0]);
    return { g, lights, anim };
  }
  function landingZone() {
    const g = new T.Group();
    g.add(mesh(new T.CylinderGeometry(45, 46, 0.6, 64), M.concrete, 0, -0.25, 0));
    const ring = new T.Mesh(new T.RingGeometry(26, 29, 64), M.paint); ring.rotation.x = -PI / 2; ring.position.y = 0.07; g.add(ring);
    for (const rz of [0, PI / 2]) { const bar = new T.Mesh(new T.PlaneGeometry(3, 22), M.paint); bar.rotation.x = -PI / 2; bar.rotation.z = rz; bar.position.y = 0.08; g.add(bar); }
    for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2; g.add(box(0.5, 0.3, 0.5, i % 2 ? M.yellow : M.redLamp, Math.cos(a) * 44, 0.2, Math.sin(a) * 44)); }
    // yanık izi (kullanılmış pist)
    const scorch = new T.Mesh(new T.CircleGeometry(14, 32), new T.MeshStandardMaterial({ color: 0x2a2724, roughness: 1, transparent: true, opacity: 0.55 })); scorch.rotation.x = -PI / 2; scorch.position.y = 0.09; g.add(scorch);
    return g;
  }
  function mechazilla(armH, withMount) {
    const g = new T.Group(), lights = [];
    const tw = trussTower(12, 146, M.latticeRed, M.alu, 18); tw.position.x = -20; g.add(tw);
    g.add(box(14, 7, 14, M.alu, -20, 150, 0));
    // kasnaklar ve halatlar
    for (const z of [-4, 4]) { const p = mesh(new T.TorusGeometry(2.2, 0.35, 8, 24), M.engineDark, -20, 154.5, z); g.add(p); }
    g.add(box(1, 14, 1, M.alu, -20, 160, 0)); g.add(box(0.8, 0.8, 0.8, M.redLamp, -20, 167.5, 0));
    // taşıyıcı ve kollar (yükseklik değiştirilebilir)
    const lift = new T.Group(); g.add(lift);
    lift.add(box(15, 9, 15, M.alu, -20, armH, 0));
    const ropes = [];
    for (const z of [-4, 4]) { const rp = box(0.12, 1, 0.12, M.black, -20, 0, z); g.add(rp); ropes.push(rp); }
    const arms = [];
    for (const side of [-1, 1]) {
      const pv = new T.Group(); pv.position.set(-13.5, armH, side * 5.7);
      const truss = new T.Mesh(new T.BoxGeometry(27, 3.4, 1.6), M.latticeRed); truss.position.x = 13.5; truss.castShadow = true; pv.add(truss);
      pv.add(box(27, 0.5, 1.7, M.alu, 13.5, 1.9, 0));
      pv.add(box(10, 0.8, 1.2, M.yellow, 16, 2.1, -side * 0.9)); // yakalama rayı
      for (const x of [12, 20]) pv.add(box(1.6, 1.2, 1.0, M.engineDark, x, 2.6, -side * 1.1)); // amortisör blokları
      pv.add(mesh(new T.CylinderGeometry(0.25, 0.25, 9, 8), M.alu, 6, -1.5, 0));
      pv.userData.side = side; lift.add(pv); arms.push(pv);
    }
    // gemi QD kolu
    const qd = box(10, 2, 2, M.alu, -9, 70, 0); g.add(qd);
    if (withMount) {
      const olm = new T.Group();
      for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; olm.add(box(2.4, 17, 2.4, M.alu, Math.cos(a) * 8.6, 8.5, Math.sin(a) * 8.6)); }
      const table = new T.Mesh(new T.TorusGeometry(7.6, 1.7, 14, 48), M.alu); table.rotation.x = PI / 2; table.position.y = 18.6; table.castShadow = true; olm.add(table);
      olm.add(cyl(9.6, 9.6, 1.5, M.darkConcrete, 19.4, 48, true));
      for (let i = 0; i < 20; i++) { const a = i / 20 * PI * 2; olm.add(box(0.5, 1.2, 0.5, M.engineDark, Math.cos(a) * 6.6, 19.6, Math.sin(a) * 6.6)); }
      olm.add(mesh(new T.CylinderGeometry(12, 12, 0.6, 40), M.engineDark, 0, 0.3, 0));
      // alev saptırıcı (su soğutmalı çelik plaka)
      olm.add(mesh(new T.CylinderGeometry(9, 9, 0.8, 40), new T.MeshStandardMaterial({ color: 0x6d7378, roughness: 0.4, metalness: 0.8 }), 0, 1.0, 0));
      g.add(olm);
    }
    floodLight(g, 30, 30, 20, lights, [-1, 0]); floodLight(g, 30, 30, -20, lights, [-1, 0]);
    const setLift = h => { lift.position.y = h; for (const rp of ropes) { const top = 154, bot = armH + h + 4.5; rp.scale.y = Math.max(0.1, top - bot); rp.position.y = (top + bot) / 2; } };
    setLift(0);
    return { g, arms, lights, setLift };
  }
  function starbaseExtras() {
    const g = new T.Group();
    g.add(box(160, 1.2, 160, M.concrete, 0, -0.5, 0));
    for (let i = 0; i < 8; i++) g.add(mesh(new T.CylinderGeometry(3.5, 3.5, 25, 20), M.alu, -80 + (i % 4) * 9, 12.5, 60 + Math.floor(i / 4) * 9));
    for (let i = 0; i < 3; i++) { const t = mesh(new T.CylinderGeometry(4.5, 4.5, 30, 20), M.alu, 60 + i * 11, 5, -70); t.rotation.z = PI / 2; g.add(t); }
    pipe(g, [[-75, 1, 55], [-30, 1, 20], [-8, 1, 6]], 0.4, M.alu);
    g.add(box(60, 80, 40, M.alu, -900, 40, -500));
    g.add(box(40, 50, 30, M.alu, -820, 25, -560));
    return g;
  }
  function droneShip(name) {
    const g = new T.Group(), lights = [];
    g.add(box(91, 7, 52, M.hull, 0, -1.0, 0));
    g.add(box(91, 0.4, 52, M.deck, 0, 2.7, 0));
    const ring = new T.Mesh(new T.RingGeometry(18, 21, 64), M.paint); ring.rotation.x = -PI / 2; ring.position.y = 2.95; g.add(ring);
    const x1 = new T.Mesh(new T.PlaneGeometry(2.5, 26), M.paint); x1.rotation.x = -PI / 2; x1.rotation.z = PI / 4; x1.position.y = 2.95; g.add(x1);
    const x2 = x1.clone(); x2.rotation.z = -PI / 4; g.add(x2);
    // yan korkuluklar, kıç tarafında patlama duvarları, köşelerde azimut itici güç üniteleri
    for (const z of [-26, 26]) g.add(box(91, 3.5, 1.2, M.yellow, 0, 4.5, z));
    for (const z of [-18, -6, 6, 18]) g.add(box(1.2, 6, 9, M.hull, -45, 5.7, z));
    for (const x of [-40, 40]) for (const z of [-20, 20]) {
      g.add(box(8, 6, 8, M.alu, x, 5.5, z)); g.add(box(8.2, 0.6, 8.2, M.yellow, x, 8.6, z));
      const th = mesh(new T.CylinderGeometry(1.6, 1.6, 3, 12), M.engineDark, x, -5.5, z); g.add(th);
      lights.push({ pos: [x, 9, z] });
    }
    for (const x of [-30, 30]) g.add(box(1.2, 10, 1.2, M.alu, x, 8, -25.5));
    const t = canvasTex(1024, 128, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#e8e8e8'; c.font = 'bold 80px Arial'; c.textAlign = 'center'; c.fillText(name || 'YÖRÜNGE AĞI I', w / 2, 95); });
    const label = new T.Mesh(new T.PlaneGeometry(60, 7.5), new T.MeshBasicMaterial({ map: t, transparent: true })); label.rotation.x = -PI / 2; label.position.set(0, 2.96, 22); g.add(label);
    return { g, lights };
  }
  function shipHull(len, beam, h, mat) {
    const sh = new T.Shape();
    sh.moveTo(-len / 2, -beam / 2); sh.lineTo(len * 0.3, -beam / 2); sh.quadraticCurveTo(len / 2, -beam * 0.3, len / 2, 0); sh.quadraticCurveTo(len / 2, beam * 0.3, len * 0.3, beam / 2); sh.lineTo(-len / 2, beam / 2); sh.closePath();
    const geo = new T.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }); geo.rotateX(-PI / 2); geo.translate(0, -h * 0.6, 0);
    const m = new T.Mesh(geo, mat); m.castShadow = true; return m;
  }
  function fairingShip() {
    const g = new T.Group();
    g.add(shipHull(62, 13, 6, M.hull));
    g.add(box(40, 0.4, 12, M.deck, -6, 2.5, 0));
    g.add(box(10, 9, 11, M.white, 18, 7, 0)); g.add(box(6, 3, 9, M.white, 18, 13, 0));
    g.add(box(10.2, 1.2, 11.2, new T.MeshStandardMaterial({ color: 0x0a1520, roughness: 0.1, metalness: 0.8 }), 18, 10, 0));
    // ağ çerçevesi kolları
    for (const x of [-22, -6]) for (const s of [-1, 1]) { const a = box(0.6, 14, 0.6, M.yellow, x, 9, s * 5); a.rotation.x = s * 0.25; g.add(a); }
    const net = new T.Mesh(new T.PlaneGeometry(22, 16), M.net); net.rotation.x = -PI / 2; net.position.set(-14, 15.5, 0); g.add(net);
    g.add(box(0.5, 12, 0.5, M.alu, 22, 16, 0));
    return { g };
  }
  function tug() {
    const g = new T.Group();
    g.add(shipHull(32, 10, 5, new T.MeshStandardMaterial({ color: 0x1d2b44, roughness: 0.6 })));
    g.add(box(10, 5, 7, M.white, 2, 4.5, 0)); g.add(box(6, 2.5, 5, M.white, 2, 8, 0));
    g.add(box(1, 7, 1, M.alu, 6, 11, 0)); g.add(box(1.4, 2, 1.4, new T.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.6 }), -4, 7, 0));
    return { g };
  }
  // tesis ekipmanları
  function crane(boomL) {
    const g = new T.Group(), L = boomL || 90;
    g.add(box(10, 2, 7, M.yellow, 0, 1.2, 0)); g.add(box(7, 4, 6, M.yellow, -1, 4, 0)); g.add(box(3, 3, 3, M.white, 2.5, 7, 2));
    for (const s of [-1, 1]) g.add(box(12, 1.6, 1.6, M.engineDark, 0, 0.8, s * 3.8));
    const boom = new T.Group(); boom.position.set(2, 5, 0); boom.rotation.z = -0.35;
    const b = new T.Mesh(new T.BoxGeometry(2.2, L, 2.2), M.latticeRed); b.position.y = L / 2; boom.add(b);
    boom.add(box(0.12, L * 0.4, 0.12, M.black, 0.8, L - L * 0.2, 0));
    g.add(boom);
    return g;
  }
  function transporter() {
    const g = new T.Group();
    g.add(box(6, 3.2, 3, M.white, 0, 2.4, 0)); g.add(box(2.4, 1.2, 2.9, new T.MeshStandardMaterial({ color: 0x0a1520, roughness: 0.1, metalness: 0.8 }), 1.7, 3.2, 0));
    g.add(box(42, 1, 3.2, M.engineDark, -24, 1.4, 0));
    for (const x of [-6, -10, -38, -42]) for (const s of [-1, 1]) { const w = mesh(new T.CylinderGeometry(0.55, 0.55, 0.5, 12), M.black, x, 0.55, s * 1.4); w.rotation.x = PI / 2; g.add(w); }
    for (const x of [-12, -36]) g.add(box(1.2, 2.4, 4, M.yellow, x, 2.6, 0));
    // yatık booster (basit gövde)
    const bb = mesh(new T.CylinderGeometry(1.83, 1.83, 40, 32), M.white, -24, 4.6, 0); bb.rotation.z = PI / 2; g.add(bb);
    const it = mesh(new T.CylinderGeometry(1.84, 1.84, 6.5, 32), M.carbon, -1.8, 4.6, 0); it.rotation.z = PI / 2; g.add(it);
    return g;
  }
  function vehicle(color) {
    const g = new T.Group();
    g.add(box(5, 1.6, 2.2, new T.MeshStandardMaterial({ color: color || 0xf2f2f2, roughness: 0.5 }), 0, 1.3, 0));
    g.add(box(1.8, 1.2, 2.1, new T.MeshStandardMaterial({ color: 0x0a1520, roughness: 0.1, metalness: 0.8 }), 1.6, 2.4, 0));
    g.add(box(1.2, 0.2, 1.6, M.redLamp, 1.4, 3.1, 0));
    for (const x of [-1.6, 1.6]) for (const s of [-1, 1]) { const w = mesh(new T.CylinderGeometry(0.45, 0.45, 0.35, 12), M.black, x, 0.45, s * 1.1); w.rotation.x = PI / 2; g.add(w); }
    return g;
  }
  function parachute() {
    const g = new T.Group();
    const canopy = mesh(new T.SphereGeometry(7, 24, 10, 0, PI * 2, 0, PI / 2.4), new T.MeshStandardMaterial({ color: 0x2f6bd8, roughness: 0.8, side: T.DoubleSide }), 0, 20, 0);
    canopy.scale.set(1.6, 0.55, 0.8); g.add(canopy);
    const pts = [];
    for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; pts.push(new T.Vector3(Math.cos(a) * 10, 21.5, Math.sin(a) * 5.4), new T.Vector3(0, 2, 0)); }
    g.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0xdddddd })));
    return g;
  }

  /* ---------------- İsteğe bağlı GLB modelleri ----------------
     models/manifest.json: { "falconBooster": { "file": "models/f9.glb", "scale": 1, "rotY": 0, "y": 0 }, ... }
     Bir anahtar için GLB yüklenmişse prosedürel görünüm gizlenir, animasyon referansları korunur. */
  const GLB = {};
  function withGLB(key, fn) {
    return function () {
      const r = fn.apply(null, arguments);
      const src = GLB[key];
      if (!src) return r;
      const root = r.g || r;
      for (const c of root.children) c.visible = false;
      const cp = src.scene.clone(true);
      const bb = new T.Box3().setFromObject(cp), sz = bb.getSize(new T.Vector3());
      const want = r.len || src.height || sz.y;
      const k = src.scale || (sz.y > 0 ? want / sz.y : 1);
      cp.scale.setScalar(k); cp.rotation.y = src.rotY || 0;
      cp.position.y = -bb.min.y * k + (src.y || 0);
      cp.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
      root.add(cp);
      return r;
    };
  }

  return {
    station, M, falconBooster: withGLB('falconBooster', falconBooster), falconUpper: withGLB('falconUpper', falconUpper), fairingHalves, payloadStack,
    dragon: withGLB('dragon', dragon), superHeavy: withGLB('superHeavy', superHeavy), ship: withGLB('ship', ship), satellite, geoSat,
    falconPad: withGLB('falconPad', falconPad), landingZone, mechazilla: withGLB('mechazilla', mechazilla), starbaseExtras,
    droneShip: withGLB('droneShip', droneShip), fairingShip, tug, crane, transporter, vehicle, parachute, canvasTex, bellGeo, GLB,
  };
};
