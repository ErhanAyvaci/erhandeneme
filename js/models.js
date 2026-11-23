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
  function engineCluster(g, n, ring, re, len, y, matOuter, matInner, rot) {
    const geo = bellGeo(re * 0.34, re, len, 20);
    for (let i = 0; i < n; i++) {
      const a = i / n * PI * 2 + (rot || 0);
      const b = new T.Mesh(geo, matOuter); b.position.set(Math.cos(a) * ring, y, Math.sin(a) * ring); b.castShadow = true;
      g.add(b);
      if (matInner) { const p = cyl(re * 0.3, re * 0.36, len * 0.5, matInner, y + len * 1.1, 10); p.position.x = b.position.x; p.position.z = b.position.z; g.add(p); }
    }
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

  /* ---------------- Falcon 1. kademe ---------------- */
  function falconBooster(def, o) {
    o = o || {};
    const g = new T.Group(), ml = [];
    const r = def.dia / 2, L = def.len, f1 = def.engines === 1;
    const soot = o.flights ? Math.min(1.5, 0.35 + o.flights * 0.3) : 0;
    const body = cm(M.white, ml);
    body.map = falconBodyTex(f1 ? 'FALCON 1' : (o.side ? '' : 'FALCON 9'), soot, L);
    if (f1) { body.color.set(0xe8ebef); body.metalness = 0.4; body.roughness = 0.3; }
    const interH = o.nose ? 0 : (f1 ? 1.0 : 6.7);
    const noseH = o.nose ? 6.5 : 0;
    const bodyH = L - interH - noseH - 2.2;
    g.add(cyl(r, r, bodyH, body, 2.2 + bodyH / 2, 48));
    // oktaweb / motor bölmesi
    const eng = cm(M.engine, ml), dark = cm(M.engineDark, ml);
    g.add(cyl(r, r * 0.97, 1.0, cm(M.black, ml), 1.7, 40));
    const shield = mesh(new T.CircleGeometry(r * 0.96, 40), dark, 0, 1.2, 0); shield.rotation.x = PI / 2; g.add(shield);
    if (f1) engineCluster(g, 1, 0, 0.55, 1.2, 0, eng, M.copper);
    else { engineCluster(g, 8, r * 0.66, 0.44, 1.25, -0.05, eng, M.copper, PI / 8); engineCluster(g, 1, 0, 0.44, 1.25, -0.05, eng, M.copper); }
    // kablo kanalı (raceway)
    if (!f1) { const rw = box(0.3, bodyH * 0.92, 0.25, cm(M.alu, ml), 0, 2.2 + bodyH / 2, r + 0.1); rw.material.color.set(0xcfd2d6); g.add(rw); }
    if (o.nose) {
      const nm = cm(M.white, ml);
      const nose = mesh(new T.LatheGeometry(ogivePts(r, noseH, 16, 0), 40), nm, 0, L - noseH, 0); g.add(nose);
      g.add(cyl(r * 1.01, r * 1.01, 0.5, cm(M.black, ml), L - noseH + 0.25, 40));
    } else {
      const inter = cm(M.carbon, ml);
      g.add(cyl(r, r, interH, inter, L - interH / 2, 48));
      if (!f1) {
        g.add(cyl(r * 1.01, r * 1.01, 0.3, cm(M.alu, ml), L - interH, 40));
        // soğuk gaz iticileri
        for (const s of [-1, 1]) { const t = box(0.5, 0.6, 0.3, M.black, s * (r + 0.1), L - 1.5, 0); g.add(t); }
      }
    }
    if (o.sideAttach) { // FH bağlantı noktaları
      for (const y of [6, L - 9]) g.add(box(0.5, 1.2, 0.8, M.alu, o.sideAttach * (r + 0.2), y, 0));
    }
    const fins = [], legs = [];
    if (o.fins) {
      const finMat = o.titanium ? M.ti : M.alFin;
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * PI * 2 + PI / 4;
        const pv = new T.Group(); pv.position.set(Math.cos(a) * r, L - (o.nose ? 9 : (f1 ? 1.6 : 2.2)), Math.sin(a) * r); pv.rotation.y = -a;
        const s = f1 ? 0.6 : 1;
        const fin = new T.Mesh(new T.BoxGeometry(0.2 * s, 1.6 * s, 1.35 * s), finMat); fin.position.y = 0.8 * s; fin.castShadow = true;
        const hinge = box(0.25, 0.35, 0.35, M.engineDark, 0, 0, 0);
        pv.add(fin, hinge); g.add(pv); fins.push(pv);
      }
    }
    if (o.legs) {
      const legMat = cm(M.carbon, ml);
      const s = f1 ? 0.45 : 1;
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * PI * 2;
        const pv = new T.Group(); pv.position.set(Math.cos(a) * (r + 0.12), 2.6 * s + 0.2, Math.sin(a) * (r + 0.12)); pv.rotation.y = -a;
        const leg = new T.Mesh(new T.BoxGeometry(0.42 * s, 9.4 * s, 0.6 * s), legMat); leg.position.y = 4.7 * s; leg.castShadow = true;
        const inner = box(0.18 * s, 7 * s, 0.25 * s, M.alu, 0.18 * s, 4.2 * s, 0);
        const foot = mesh(new T.CylinderGeometry(0.55 * s, 0.6 * s, 0.25 * s, 12), M.engineDark, 0, 9.4 * s, 0);
        pv.add(leg, inner, foot); g.add(pv); legs.push(pv);
      }
    }
    return { g, mats: ml, fins, legs, len: L, r, plume: null, plumeR: f1 ? 0.55 : r * 0.92, plumeL: f1 ? 12 : 26, plumeY: -0.05, engineType: 'merlin', bodyMat: body };
  }
  function falconUpper(def, f1) {
    const g = new T.Group(), ml = [];
    const r = def.dia / 2, L = def.len;
    const body = cm(M.white, ml);
    body.map = falconBodyTex('', 0, L);
    if (f1) { body.color.set(0xe8ebef); body.metalness = 0.4; }
    g.add(cyl(r, r, L, body, L / 2, 48));
    g.add(cyl(r * 1.005, r * 1.005, 0.25, cm(M.black, ml), L - 0.2, 40));
    const nb = cm(M.niobium, ml);
    const bell = new T.Mesh(bellGeo(f1 ? 0.12 : 0.35, f1 ? 0.42 : 1.6, f1 ? 0.9 : 3.2, 32), nb);
    bell.position.y = f1 ? -0.9 : -3.2; g.add(bell);
    if (!f1) {
      g.add(cyl(0.5, 0.7, 1.0, cm(M.engine, ml), -0.2, 20));
      const aft = mesh(new T.CircleGeometry(r * 0.98, 40), cm(M.engineDark, ml), 0, 0.02, 0); aft.rotation.x = PI / 2; g.add(aft);
    }
    return { g, mats: ml, len: L, r, plumeR: f1 ? 0.4 : 1.5, plumeL: f1 ? 6 : 14, plumeY: f1 ? -0.9 : -3.2, engineType: 'merlin', bell: nb };
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
  function dragon(crew) {
    const g = new T.Group(), ml = [];
    const w = cm(M.white, ml);
    // gövde (trunk)
    const trunk = cyl(1.85, 1.85, 3.7, w, 1.85, 48); g.add(trunk);
    const sol = mesh(new T.CylinderGeometry(1.87, 1.87, 2.6, 48, 1, true, 0, PI), M.solar, 0, 2.0, 0); g.add(sol);
    for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + PI / 4; const f = box(0.08, 1.4, 0.7, w, Math.cos(a) * 1.95, 0.8, Math.sin(a) * 1.95); f.rotation.y = -a; g.add(f); }
    // kapsül
    const pts = [new T.Vector2(0.01, 0), new T.Vector2(1.85, 0.25), new T.Vector2(1.9, 0.5), new T.Vector2(1.25, 3.1), new T.Vector2(0.75, 3.6), new T.Vector2(0.01, 3.62)];
    const cap = mesh(new T.LatheGeometry(pts, 48), w, 0, 3.7, 0); g.add(cap);
    const hs = cyl(1.9, 1.86, 0.25, cm(M.black, ml), 3.82, 48); g.add(hs);
    // pencereler & SuperDraco
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * PI * 2;
      const sd = box(0.45, 0.9, 0.2, M.engineDark, Math.cos(a) * 1.45, 5.6, Math.sin(a) * 1.45); sd.rotation.y = -a + PI / 2; sd.rotation.z = 0.32; g.add(sd);
      if (crew && i % 2) { const win = box(0.35, 0.35, 0.05, M.black, Math.cos(a + 0.6) * 1.55, 5.0, Math.sin(a + 0.6) * 1.55); win.rotation.y = -a; g.add(win); }
    }
    const hinge = new T.Group(); hinge.position.set(0, 7.3, -0.75); g.add(hinge);
    const nose = mesh(new T.SphereGeometry(0.78, 24, 12, 0, PI * 2, 0, PI / 2), w, 0, 0, 0.75); hinge.add(nose);
    const port = cyl(0.45, 0.5, 0.25, M.alu, 7.35, 20); g.add(port);
    g.userData.nose = hinge;
    return { g, mats: ml, len: 8.1 };
  }

  /* ---------------- Starship ---------------- */
  function superHeavy(def, o) {
    o = o || {};
    const g = new T.Group(), ml = [];
    const r = 4.5, L = def.len;
    const st = cm(M.alu, ml);
    st.map = steelTex(L); st.color.set(o.flights ? 0xd2c8bb : 0xffffff); st.metalness = 0.92; st.roughness = 0.3; st.envMapIntensity = 1.0;
    g.add(cyl(r, r, L - 6, st, 3.5 + (L - 6) / 2, 64));
    // sıcak ayrılma halkası
    const ring = cm(M.vent, ml);
    g.add(cyl(r, r, 2.0, ring, L - 1.0, 64));
    g.add(cyl(r * 1.005, r * 1.005, 0.3, cm(M.alu, ml), L - 2.1, 64));
    // motor bölmesi
    const skirt = cm(M.engineDark, ml);
    g.add(cyl(r, r * 1.02, 3.0, skirt, 2.0, 64));
    const plate = mesh(new T.CircleGeometry(r, 48), cm(M.engineDark, ml), 0, 0.6, 0); plate.rotation.x = PI / 2; g.add(plate);
    const eng = cm(M.engine, ml);
    engineCluster(g, 3, 1.1, 0.66, 1.7, -1.1, eng, M.copper);
    engineCluster(g, 10, 2.55, 0.64, 1.7, -1.1, eng, M.copper, 0.3);
    engineCluster(g, 20, 3.85, 0.56, 1.4, -0.8, eng, null, 0.1);
    // şaseler (chines) ve yakıt transfer tüpü
    for (const s of [-1, 1]) { const ch = box(0.5, L - 14, 0.9, st, s * (r + 0.2), L / 2 - 2, 0); g.add(ch); }
    const tube = cyl(0.45, 0.45, L - 10, cm(M.alu, ml), L / 2, 12); tube.position.z = r + 0.3; g.add(tube);
    // 3 büyük ızgara kanatçık
    const fins = [];
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * PI * 2 + PI / 2;
      const pv = new T.Group(); pv.position.set(Math.cos(a) * r, L - 5.5, Math.sin(a) * r); pv.rotation.y = -a;
      const fin = new T.Mesh(new T.BoxGeometry(5.2, 0.6, 4.2), M.ti); fin.position.x = 2.5; fin.castShadow = true;
      const mount = box(1.2, 1.4, 1.6, M.engineDark, 0.3, 0, 0);
      pv.add(fin, mount); g.add(pv); fins.push(pv);
    }
    // yakalama pimleri
    for (const s of [-1, 1]) g.add(box(1.2, 0.8, 1.4, M.engineDark, 0, L - 8, s * (r + 0.6)));
    return { g, mats: ml, fins, legs: [], len: L, r, plumeR: 4.2, plumeL: 55, plumeY: -1.1, engineType: 'raptor' };
  }
  function flapGeo(w1, w2, h, t) {
    const sh = new T.Shape();
    sh.moveTo(0, 0); sh.lineTo(w1, 0); sh.lineTo(w2, h); sh.quadraticCurveTo(w2 * 0.4, h * 1.08, 0, h);
    const geo = new T.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false });
    geo.translate(0, 0, -t / 2);
    return geo;
  }
  function ship(def, o) {
    o = o || {};
    const g = new T.Group(), ml = [];
    const r = 4.5, L = def.len;
    const st = cm(M.alu, ml);
    st.map = steelTex(40); st.color.set(o.flights ? 0xd8cfc4 : 0xffffff); st.metalness = 0.92; st.roughness = 0.28;
    const tile = cm(M.tile, ml);
    g.add(cyl(r, r, 38, st, 2 + 19, 64));
    const tiles = mesh(new T.CylinderGeometry(r + 0.05, r + 0.05, 38, 64, 1, true, PI * 0.5, PI), tile, 0, 21, 0); g.add(tiles);
    const og = ogivePts(r, 12, 24, 40);
    const nose = mesh(new T.LatheGeometry(og, 64), st); g.add(nose);
    const ntile = mesh(new T.LatheGeometry(og.map(p => new T.Vector2(p.x + 0.05, p.y)), 64, PI * 0.5, PI), tile); g.add(ntile);
    g.add(cyl(r, r * 1.01, 2.2, cm(M.engineDark, ml), 1.1, 64));
    // kanatçıklar (siyah karo kaplı, tiles tarafına yakın kenarlarda)
    const flapMat = tile;
    const aftGeo = flapGeo(9.5, 6.5, 5.2, 0.5), fwdGeo = flapGeo(6.5, 3.5, 3.6, 0.4);
    const flaps = [];
    for (const s of [-1, 1]) {
      const af = new T.Group(); af.position.set(s * r, 4.5, -0.8);
      const am = new T.Mesh(aftGeo, flapMat); am.rotation.z = s > 0 ? -PI / 2 : PI / 2; am.castShadow = true;
      am.position.y = 0; af.add(am); g.add(af); flaps.push(af);
      const ff = new T.Group(); ff.position.set(s * r * 0.8, 42.5, -1.2); ff.rotation.z = s * 0.22;
      const fm = new T.Mesh(fwdGeo, flapMat); fm.rotation.z = s > 0 ? -PI / 2 : PI / 2; fm.castShadow = true;
      ff.add(fm); g.add(ff); flaps.push(ff);
    }
    // yük kapısı (PEZ) ve tank bağlantıları
    const door = box(0.2, 3.2, 6.5, cm(M.engineDark, ml), 0, 32, 0); door.position.z = -r - 0.05; door.rotation.y = PI / 2; g.add(door);
    // motorlar
    const eng = cm(M.engine, ml), nb = cm(M.niobium, ml);
    engineCluster(g, 3, 1.05, 0.66, 1.6, -1.6, eng, M.copper);
    engineCluster(g, 3, 2.85, 1.2, 2.9, -2.9, nb, null, PI / 3);
    return { g, mats: ml, fins: [], legs: [], flaps, len: L, r, plumeR: 3.3, plumeL: 30, plumeY: -2.0, engineType: 'raptor', bell: nb };
  }
  function satellite(gen) {
    const g = new T.Group();
    const big = gen === 'v2m' || gen === 'v3';
    const s = gen === 'v3' ? 2.0 : big ? 1.4 : 1;
    g.add(box(2.8 * s, 0.22 * s, 1.4 * s, M.sat));
    const arm = cyl(0.05, 0.05, 1.2, M.alu, 0, 6); arm.rotation.z = PI / 2; arm.position.x = 1.9 * s; g.add(arm);
    const panel = new T.Mesh(new T.PlaneGeometry(8 * s, 2.6 * s), M.solar); panel.rotation.x = PI / 2; panel.position.x = 5.4 * s; g.add(panel);
    if (big) { const p2 = panel.clone(); p2.position.x = -5.4 * s; g.add(p2); }
    g.userData.panels = g.children.filter(c => c.geometry && c.geometry.type === 'PlaneGeometry');
    return g;
  }

  /* ---------------- Tesisler ---------------- */
  function floodLight(g, x, y, z, lights, dir) {
    const pole = box(0.4, y, 0.4, M.alu, x, y / 2, z); g.add(pole);
    const head = box(2.2, 1.2, 0.6, M.engineDark, x, y, z); g.add(head);
    const lamp = box(2.0, 1.0, 0.1, M.lamp, x + (dir ? dir[0] * 0.35 : 0), y, z + (dir ? dir[1] * 0.35 : 0.35)); g.add(lamp);
    lights.push({ pos: [x, y, z], lamp });
  }
  function falconPad() {
    const g = new T.Group(), lights = [], anim = {};
    g.add(box(90, 1.2, 90, M.concrete, 0, -0.5, 0));
    g.add(box(16, 1.25, 50, M.darkConcrete, 0, -0.48, -30));
    // TE (transporter-erector) — geri yatar
    const te = new T.Group(); te.position.set(-5.6, 0.5, 0);
    const teMesh = new T.Mesh(new T.BoxGeometry(2.8, 62, 3.2), M.lattice); teMesh.position.y = 31; teMesh.castShadow = true; te.add(teMesh);
    for (let y = 8; y < 60; y += 12) { const arm = box(3.4, 0.5, 0.5, M.alu, 2.2, y, 0); te.add(arm); }
    g.add(te); anim.te = te;
    // sabit servis kulesi + mürettebat köprüsü
    const fss = new T.Group(); fss.position.set(-22, 0, 0);
    const tw = new T.Mesh(new T.BoxGeometry(9, 80, 9), M.lattice); tw.position.y = 40; tw.castShadow = true; fss.add(tw);
    for (let y = 12; y <= 78; y += 11) fss.add(box(9.6, 0.5, 9.6, M.darkConcrete, 0, y, 0));
    fss.add(box(14, 2.5, 2.5, M.white, 9, 66, 0));
    fss.add(box(1.0, 6, 1.0, M.alu, 0, 83, 0));
    const beacon = box(0.6, 0.6, 0.6, M.redLamp, 0, 86, 0); fss.add(beacon);
    g.add(fss);
    // paratoner direkleri ve teller
    const tops = [];
    for (const [x, z] of [[28, 28], [-28, 28], [28, -28], [-28, -28]]) {
      g.add(box(1.4, 95, 1.4, M.alu, x, 47.5, z)); tops.push(new T.Vector3(x, 95, z));
      g.add(box(0.5, 0.5, 0.5, M.redLamp, x, 95.5, z));
    }
    const wire = new T.BufferGeometry().setFromPoints([tops[0], tops[1], tops[3], tops[2], tops[0]]);
    g.add(new T.Line(wire, new T.LineBasicMaterial({ color: 0x222222 })));
    // yakıt tankları (küre LOX, yatay RP-1)
    const lox = mesh(new T.SphereGeometry(9, 24, 16), M.white, 70, 11, 55); g.add(lox);
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; g.add(box(0.6, 6, 0.6, M.alu, 70 + Math.cos(a) * 6, 3, 55 + Math.sin(a) * 6)); }
    for (const z of [-50, -60]) { const t = mesh(new T.CylinderGeometry(3.5, 3.5, 30, 20), M.alu, 75, 4, z); t.rotation.z = PI / 2; g.add(t); }
    // su kulesi
    g.add(box(1, 40, 1, M.alu, -70, 20, 60)); const wt = mesh(new T.SphereGeometry(6, 20, 14), M.white, -70, 44, 60); g.add(wt);
    // binalar
    for (const b of [[-1800, 160, 120, 140, -400], [-900, 40, 60, 25, 300], [-2400, 30, 80, 60, 900], [-600, 18, 40, 30, -700], [-350, 12, 30, 20, 220]]) g.add(box(b[2], b[1], b[3], M.alu, b[0], b[1] / 2, b[4]));
    floodLight(g, 35, 22, 15, lights, [-1, 0]); floodLight(g, 35, 22, -15, lights, [-1, 0]); floodLight(g, -35, 22, 20, lights, [1, 0]);
    return { g, lights, anim };
  }
  function landingZone() {
    const g = new T.Group();
    const disk = mesh(new T.CylinderGeometry(45, 46, 0.6, 64), M.concrete, 0, -0.25, 0); g.add(disk);
    const ring = new T.Mesh(new T.RingGeometry(26, 29, 64), M.paint); ring.rotation.x = -PI / 2; ring.position.y = 0.07; g.add(ring);
    for (const rz of [0, PI / 2]) { const bar = new T.Mesh(new T.PlaneGeometry(3, 22), M.paint); bar.rotation.x = -PI / 2; bar.rotation.z = rz; bar.position.y = 0.08; g.add(bar); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; g.add(box(0.5, 0.3, 0.5, M.yellow, Math.cos(a) * 44, 0.2, Math.sin(a) * 44)); }
    return g;
  }
  function mechazilla(armH, withMount) {
    const g = new T.Group(), lights = [];
    const tower = new T.Mesh(new T.BoxGeometry(12, 146, 12), M.latticeRed); tower.position.set(-20, 73, 0); tower.castShadow = true; g.add(tower);
    for (let y = 10; y < 146; y += 18) g.add(box(12.6, 0.6, 12.6, M.alu, -20, y, 0));
    g.add(box(14, 7, 14, M.alu, -20, 150, 0));
    g.add(box(1, 14, 1, M.alu, -20, 160, 0)); g.add(box(0.8, 0.8, 0.8, M.redLamp, -20, 167.5, 0));
    // taşıyıcı ve kollar
    const carriage = box(15, 9, 15, M.alu, -20, armH, 0); g.add(carriage);
    const arms = [];
    for (const side of [-1, 1]) {
      const pv = new T.Group(); pv.position.set(-13.5, armH, side * 5.7);
      const truss = new T.Mesh(new T.BoxGeometry(27, 3.4, 1.6), M.latticeRed); truss.position.x = 13.5; truss.castShadow = true; pv.add(truss);
      pv.add(box(27, 0.5, 1.7, M.alu, 13.5, 1.9, 0));
      const rail = box(10, 0.8, 1.2, M.black, 16, 2.1, -side * 0.9); pv.add(rail);
      pv.userData.side = side; g.add(pv); arms.push(pv);
    }
    // QD kolu
    g.add(box(10, 2, 2, M.alu, -9, 70, 0));
    if (withMount) {
      const olm = new T.Group();
      for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; olm.add(box(2.4, 17, 2.4, M.alu, Math.cos(a) * 8.6, 8.5, Math.sin(a) * 8.6)); }
      const table = new T.Mesh(new T.TorusGeometry(7.6, 1.7, 14, 48), M.alu); table.rotation.x = PI / 2; table.position.y = 18.6; table.castShadow = true; olm.add(table);
      olm.add(cyl(9.6, 9.6, 1.5, M.darkConcrete, 19.4, 48, true));
      for (let i = 0; i < 20; i++) { const a = i / 20 * PI * 2; olm.add(box(0.5, 1.2, 0.5, M.engineDark, Math.cos(a) * 6.6, 19.6, Math.sin(a) * 6.6)); }
      const plate = mesh(new T.CylinderGeometry(12, 12, 0.6, 40), M.engineDark, 0, 0.3, 0); olm.add(plate);
      g.add(olm);
    }
    floodLight(g, 30, 30, 20, lights, [-1, 0]); floodLight(g, 30, 30, -20, lights, [-1, 0]);
    return { g, arms, lights };
  }
  function starbaseExtras() {
    const g = new T.Group();
    g.add(box(160, 1.2, 160, M.concrete, 0, -0.5, 0));
    // tank çiftliği
    for (let i = 0; i < 8; i++) { const t = mesh(new T.CylinderGeometry(3.5, 3.5, 25, 20), M.alu, -80 + (i % 4) * 9, 12.5, 60 + Math.floor(i / 4) * 9); g.add(t); }
    for (let i = 0; i < 3; i++) { const t = mesh(new T.CylinderGeometry(4.5, 4.5, 30, 20), M.alu, 60 + i * 11, 4.5, -70); t.rotation.z = PI / 2; t.position.y = 5; g.add(t); }
    // high bay
    g.add(box(60, 80, 40, M.alu, -900, 40, -500));
    g.add(box(40, 50, 30, M.alu, -820, 25, -560));
    return g;
  }
  function droneShip(name) {
    const g = new T.Group(), lights = [];
    const hull = box(91, 7, 52, M.hull, 0, -1.0, 0); g.add(hull);
    g.add(box(91, 0.4, 52, M.deck, 0, 2.7, 0));
    const ring = new T.Mesh(new T.RingGeometry(18, 21, 64), M.paint); ring.rotation.x = -PI / 2; ring.position.y = 2.95; g.add(ring);
    const x1 = new T.Mesh(new T.PlaneGeometry(2.5, 26), M.paint); x1.rotation.x = -PI / 2; x1.rotation.z = PI / 4; x1.position.y = 2.95; g.add(x1);
    const x2 = x1.clone(); x2.rotation.z = -PI / 4; g.add(x2);
    for (const z of [-26, 26]) g.add(box(91, 3.5, 1.2, M.yellow, 0, 4.5, z));
    for (const x of [-40, 40]) for (const z of [-20, 20]) { g.add(box(8, 6, 8, M.alu, x, 5.5, z)); lights.push({ pos: [x, 9, z] }); }
    // Octagrabber
    const og = box(6, 1.6, 6, M.yellow, -30, 3.7, 0); g.add(og); g.userData.octa = og;
    // isim
    const t = canvasTex(1024, 128, (c, w, h) => { c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, w, h); c.fillStyle = '#e8e8e8'; c.font = 'bold 80px Arial'; c.textAlign = 'center'; c.fillText(name || 'YÖRÜNGE AĞI I', w / 2, 95); });
    const label = new T.Mesh(new T.PlaneGeometry(60, 7.5), new T.MeshBasicMaterial({ map: t, transparent: true })); label.rotation.x = -PI / 2; label.position.set(0, 2.96, 22); g.add(label);
    return { g, lights };
  }
  function fairingShip() {
    const g = new T.Group();
    g.add(box(60, 6, 12, M.white, 0, 0, 0));
    g.add(box(14, 8, 10, M.white, -18, 7, 0));
    for (const s of [-1, 1]) { const a = box(0.6, 14, 0.6, M.yellow, 14 * s * 0 + 10, 9, s * 5); a.rotation.z = -0.3; g.add(a); }
    const net = new T.Mesh(new T.PlaneGeometry(26, 14), M.net); net.rotation.x = -PI / 2.3; net.position.set(14, 11, 0); g.add(net);
    return { g };
  }
  function parachute() {
    const g = new T.Group();
    const canopy = mesh(new T.BoxGeometry(14, 0.6, 6), new T.MeshStandardMaterial({ color: 0x2f6bd8, roughness: 0.8, side: T.DoubleSide }), 0, 24, 0);
    g.add(canopy);
    const pts = [];
    for (const x of [-7, 7]) for (const z of [-3, 3]) pts.push(new T.Vector3(x, 24, z), new T.Vector3(0, 2, 0));
    g.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0xdddddd })));
    return g;
  }

  function station() {
    const g = new T.Group();
    const truss = box(2.2, 2.2, 108, M.alu, 0, 0, 0); g.add(truss);
    const arr = new T.MeshStandardMaterial({ map: solarTex, color: 0xd9b36a, roughness: 0.35, metalness: 0.6, side: T.DoubleSide, emissive: 0x1a1204 });
    for (const z of [-48, -36, 36, 48]) for (const s of [-1, 1]) {
      const p = new T.Mesh(new T.PlaneGeometry(12, 34), arr); p.position.set(0, s * 19, z); g.add(p);
    }
    for (const z of [-30, 30]) { const r = new T.Mesh(new T.PlaneGeometry(4, 14), M.paint); r.rotation.y = PI / 2; r.position.set(0, 0, z * 0.6); r.rotation.z = PI / 2; g.add(r); }
    // modüller (X ekseni boyunca)
    const mods = [[-14, 4.2, 9], [-4, 4.2, 9], [6, 4.2, 9], [15, 3.6, 7], [23, 3.6, 6]];
    for (const [x, r, l] of mods) { const m = mesh(new T.CylinderGeometry(r * 0.5, r * 0.5, l, 20), M.white, x, -4, 0); m.rotation.z = PI / 2; g.add(m); }
    const node = mesh(new T.SphereGeometry(2.4, 16, 12), M.white, 28, -4, 0); g.add(node);
    const port = cyl(0.8, 0.8, 1.5, M.alu, 0, 12); port.position.set(31, -4, 0); port.rotation.z = PI / 2; g.add(port);
    g.userData.port = new T.Vector3(32.5, -4, 0);
    return g;
  }
  return { station, M, falconBooster, falconUpper, fairingHalves, payloadStack, dragon, superHeavy, ship, satellite, falconPad, landingZone, mechazilla, starbaseExtras, droneShip, fairingShip, parachute, canvasTex, bellGeo };
};
