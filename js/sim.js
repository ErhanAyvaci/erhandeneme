/* =====================================================================
   Roket fizik + görev simülasyonu (render'dan bağımsız)
   2B yörünge düzlemi: Dünya merkezi (0,0), fırlatma rampası (0, RE)
   Birimler: metre, saniye, kilogram, Newton
   ===================================================================== */
(function (global) {
  'use strict';
  const G0 = 9.80665;
  const MU = 3.986004418e14;
  const RE = 6371000;
  const PAD_ANG = Math.PI / 2;
  const SAT_MASS = 260; // Starlink v1.0 ~260 kg
  const DEG = Math.PI / 180;
  const W_E = 408 / RE; // Cape Canaveral'de yüzey dönüş hızı ~408 m/s
  let NOW = -10;
  const padAng = t => PAD_ANG - W_E * (t + 10);
  const GUID = { k: 0.005, cap: 1000, tau: 40, amax: 0.8 };

  const rho = h => (h > 150000 ? 0 : 1.225 * Math.exp(-Math.max(h, 0) / 8500));
  const pres = h => (h > 150000 ? 0 : Math.exp(-Math.max(h, 0) / 7800));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const wrapPi = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

  /* ---------------- Roket tanımları (gerçek verilere yakın) ---------------- */
  const ROCKETS = {
    f1: {
      key: 'f1', name: 'Falcon 1', year: 2008, engineType: 'merlin',
      targetAlt: 220000,
      stages: [
        { id: 's1', kind: 'booster', dry: 1300, prop: 21800, thrSL: 360e3, thrVac: 410e3, ispSL: 265, ispVac: 304, engines: 1, minThr: 0.7, landMinThr: 0.4, landThrFrac: 0.16, dia: 1.7, len: 15.5, recoverable: true, landEngines: 1, boostEngines: 1, entryBurn: true },
        { id: 's2', kind: 'upper', dry: 420, prop: 3700, thrSL: 22e3, thrVac: 31e3, ispSL: 250, ispVac: 330, engines: 1, minThr: 0.6, dia: 1.7, len: 5.5 },
      ],
      fairing: 150, payloadLen: 4.5,
      pitch: { pmax: 72, hp: 90000, exp: 0.55 },
      reserve: { exp: 0, ocean: 0.1, rtls: 0.2 },
    },
    f9: {
      key: 'f9', name: 'Falcon 9', year: 2010, engineType: 'merlin',
      targetAlt: 300000,
      stages: [
        { id: 's1', kind: 'booster', dry: 25600, prop: 395700, thrSL: 7607e3, thrVac: 8227e3, ispSL: 282, ispVac: 311, engines: 9, minThr: 0.57, dia: 3.66, len: 47.7, recoverable: true, landEngines: 1, boostEngines: 3, entryBurn: true },
        { id: 's2', kind: 'upper', dry: 3900, prop: 107500, thrSL: 600e3, thrVac: 981e3, ispSL: 200, ispVac: 348, engines: 1, minThr: 0.39, dia: 3.66, len: 12.6 },
      ],
      fairing: 1900, payloadLen: 13.1,
      pitch: { pmax: 68, hp: 85000, exp: 0.5 },
      reserve: { exp: 0, ocean: 0.07, rtls: 0.17, asds: 0.09 },
    },
    fh: {
      key: 'fh', name: 'Falcon Heavy', year: 2018, engineType: 'merlin',
      targetAlt: 320000,
      stages: [
        { id: 's1', kind: 'booster', dry: 25600, prop: 395700, thrSL: 7607e3, thrVac: 8227e3, ispSL: 282, ispVac: 311, engines: 9, minThr: 0.57, dia: 3.66, len: 47.7, recoverable: true, landEngines: 1, boostEngines: 3, entryBurn: true, center: true, coreThrottle: 0.62 },
        { id: 's2', kind: 'upper', dry: 3900, prop: 107500, thrSL: 600e3, thrVac: 981e3, ispSL: 200, ispVac: 348, engines: 1, minThr: 0.39, dia: 3.66, len: 12.6 },
      ],
      sides: { dry: 23500, prop: 395700, thrSL: 7607e3, thrVac: 8227e3, ispSL: 282, ispVac: 311, engines: 9, minThr: 0.57, dia: 3.66, len: 47.7, recoverable: true, landEngines: 1, boostEngines: 3, entryBurn: true, reserve: 0.17 },
      fairing: 1900, payloadLen: 13.1,
      pitch: { pmax: 66, hp: 85000, exp: 0.5 },
      reserve: { exp: 0, ocean: 0.06, asds: 0.07 },
    },
    ss: {
      key: 'ss', name: 'Starship', year: 2025, engineType: 'raptor',
      targetAlt: 300000,
      stages: [
        { id: 's1', kind: 'booster', dry: 200000, prop: 3400000, thrSL: 74.6e6, thrVac: 82.5e6, ispSL: 327, ispVac: 350, engines: 33, minThr: 0.45, dia: 9, len: 71, recoverable: true, landEngines: 3, landStart: 13, boostEngines: 13, entryBurn: false, hotStage: true },
        { id: 's2', kind: 'ship', dry: 120000, prop: 1500000, thrSL: 12e6, thrVac: 15.4e6, ispSL: 330, ispVac: 365, engines: 6, minThr: 0.4, dia: 9, len: 52, landEngines: 3, landStart: 3 },
      ],
      fairing: 0, payloadLen: 0,
      pitch: { pmax: 66, hp: 85000, exp: 0.5 },
      reserve: { exp: 0, ocean: 0.08, catch: 0.13 },
    },
  };

  const MODE_NAMES = { rtls: 'Rampaya dönüş (RTLS)', asds: 'Drone gemi (ASDS)', exp: 'Tek kullanımlık', catch: 'Kule yakalama', ocean: 'Okyanusa kontrollü iniş (test)' };
  // rüzgâr: yüzey (m/s, doğuya) + jet akımı (~11 km)
  let WIND = { s: 0, j: 0 };
  const windAt = h => WIND.s * Math.exp(-Math.max(0, h) / 3000) + WIND.j * Math.exp(-(((h - 11000) / 4500) ** 2));

  /* ---------------- Parça & Araç ---------------- */
  function makePart(def, role) {
    return { def, role, prop: def.prop, dry: def.dry, firing: false, engFrac: 1, cap: def.coreThrottle || 1, health: 1 };
  }

  let craftId = 1;
  class Craft {
    constructor(o) {
      this.id = craftId++;
      this.x = 0; this.y = RE; this.vx = 0; this.vy = 0;
      this.dir = PAD_ANG; this.dirCmd = PAD_ANG; this.rotRate = 6 * DEG;
      this.parts = []; this.extraMass = 0;
      this.throttle = 1; this.alive = true; this.held = false;
      this.state = 'idle'; this.name = ''; this.type = 'stack';
      this.aLatE = 0; this.heat = 0; this.heatLoad = 0; this.q = 0;
      this.landed = false; this.caught = false; this.result = null;
      this.area = 10; this.cd = 0.5; this.length = 50;
      this.ttl = Infinity; this.t = 0;
      Object.assign(this, o);
    }
    mass() { let m = this.extraMass; for (const p of this.parts) m += p.dry + p.prop; return m; }
    r() { return Math.hypot(this.x, this.y); }
    alt() { return this.r() - RE; }
    up() { const r = this.r(); return [this.x / r, this.y / r]; }
    east() { const u = this.up(); return [u[1], -u[0]]; }
    upAng() { return Math.atan2(this.y, this.x); }
    downrange() { return RE * wrapPi(padAng(NOW) - this.upAng()); }
    speed() { return Math.hypot(this.vx, this.vy); }
    airVel() { const r = this.r(), w = windAt(r - RE); return [this.vx - W_E * this.y - w * this.y / r, this.vy + W_E * this.x + w * this.x / r]; }
    airSpeed() { const a = this.airVel(); return Math.hypot(a[0], a[1]); }
    retroAng() { const a = this.airVel(); return Math.atan2(-a[1], -a[0]); }
    vEastIn() { const e = this.east(); return this.vx * e[0] + this.vy * e[1]; }
    vUp() { const u = this.up(); return this.vx * u[0] + this.vy * u[1]; }
    vEast() { return this.vEastIn() - W_E * this.r(); }
    pitchFromVertical() { return wrapPi(this.upAng() - this.dir); }
    setPitchCmd(p) { this.dirCmd = this.upAng() - p; }
    orbit() { return orbitOf(this.x, this.y, this.vx, this.vy); }
    firingParts() { return this.parts.filter(p => p.firing && p.prop > 0); }
    // anlık maksimum itki (gaz %100, mevcut irtifa)
    maxThrust() {
      const p = pres(this.alt()); let T = 0;
      for (const pt of this.firingParts()) {
        const d = pt.def;
        T += (d.thrVac - (d.thrVac - d.thrSL) * p) * pt.engFrac * pt.cap * pt.health;
      }
      return T;
    }
  }

  function orbitOf(x, y, vx, vy) {
    const r = Math.hypot(x, y), v2 = vx * vx + vy * vy;
    const eps = v2 / 2 - MU / r;
    const h = x * vy - y * vx;
    const e = Math.sqrt(Math.max(0, 1 + 2 * eps * h * h / (MU * MU)));
    if (eps >= 0) return { ap: Infinity, pe: (h * h / MU) / (1 + e) - RE, e };
    const a = -MU / (2 * eps);
    return { ap: a * (1 + e) - RE, pe: a * (1 - e) - RE, e, a };
  }

  /* Fizik adımı */
  function physStep(c, dt) {
    if (!c.alive) return;
    c.t += dt;
    if (c.held || c.landed || c.caught) {
      const ca = Math.cos(-W_E * dt), sa = Math.sin(-W_E * dt);
      const x = c.x * ca - c.y * sa, y = c.x * sa + c.y * ca;
      c.x = x; c.y = y; c.vx = W_E * y; c.vy = -W_E * x; c.thrust = 0;
      return;
    }
    const r = c.r(), h = r - RE;
    const ux = c.x / r, uy = c.y / r;
    // yönelim (sınırlı dönüş hızı)
    const dd = wrapPi(c.dirCmd - c.dir);
    const mx = c.rotRate * dt;
    c.dir += clamp(dd, -mx, mx);

    let m = c.mass();
    let ax = -MU * c.x / (r * r * r), ay = -MU * c.y / (r * r * r);
    // itki
    const p = pres(h);
    let T = 0;
    for (const pt of c.parts) {
      if (!pt.firing || pt.prop <= 0) continue;
      const d = pt.def;
      const f = c.throttle * pt.engFrac * pt.cap * pt.health;
      if (f <= 0) continue;
      const tv = d.thrVac * f;
      const mdot = tv / (d.ispVac * G0);
      let use = mdot * dt;
      let frac = 1;
      if (use > pt.prop) { frac = pt.prop / use; use = pt.prop; }
      pt.prop -= use;
      T += (tv - (d.thrVac - d.thrSL) * f * p) * frac;
    }
    c.thrust = T;
    if (T > 0) { ax += T / m * Math.cos(c.dir); ay += T / m * Math.sin(c.dir); }
    // sürükleme
    const av = c.airVel();
    const rr = rho(h), v = Math.hypot(av[0], av[1]);
    c.q = 0.5 * rr * v * v;
    if (v > 0.01 && rr > 0) {
      const D = c.q * c.cd * c.area / m;
      ax -= D * av[0] / v; ay -= D * av[1] / v;
    }
    // ızgara kanatçık / aerodinamik yanal kontrol (doğu yönünde)
    if (c.aLatE) { ax += c.aLatE * uy; ay += c.aLatE * -ux; }
    // ısınma
    c.heat = rr * v * v * v; c.aspd = v;
    c.heatLoad = Math.max(0, c.heatLoad + (c.heat - 2.5e7) * dt);

    c.vx += ax * dt; c.vy += ay * dt;
    c.x += c.vx * dt; c.y += c.vy * dt;
    c.acc = Math.hypot(ax + MU * c.x / (r * r * r), ay + MU * c.y / (r * r * r));
  }

  /* Balistik çarpma noktası tahmini (sürüklemeli) */
  function predictImpact(c, targetH) {
    // RK4 integrasyonu (sığ yeniden girişler çok hassas)
    let x = c.x, y = c.y, vx = c.vx, vy = c.vy;
    const m = typeof c.mass === 'function' ? c.mass() : c.mass, cdA = c.cd * c.area;
    const acc = (x, y, vx, vy) => {
      const r = Math.hypot(x, y), h = r - RE;
      let ax = -MU * x / (r * r * r), ay = -MU * y / (r * r * r);
      const rr = rho(h);
      if (rr > 0) {
        const w = windAt(h); const ux = vx - W_E * y - w * y / r, uy = vy + W_E * x + w * x / r;
        const v = Math.hypot(ux, uy); const D = 0.5 * rr * v * cdA / m; ax -= D * ux; ay -= D * uy;
      }
      return [ax, ay];
    };
    let tt = 0, hit = false;
    for (let i = 0; i < 12000; i++) {
      const h = Math.hypot(x, y) - RE;
      if (h <= (targetH || 0) && i > 0) { hit = true; break; }
      const dt = h > 150000 ? 5 : h > 30000 ? 1 : 0.5;
      const k1 = acc(x, y, vx, vy);
      const k2 = acc(x + vx * dt / 2, y + vy * dt / 2, vx + k1[0] * dt / 2, vy + k1[1] * dt / 2);
      const k3 = acc(x + (vx + k1[0] * dt / 2) * dt / 2, y + (vy + k1[1] * dt / 2) * dt / 2, vx + k2[0] * dt / 2, vy + k2[1] * dt / 2);
      const k4 = acc(x + (vx + k2[0] * dt / 2) * dt, y + (vy + k2[1] * dt / 2) * dt, vx + k3[0] * dt, vy + k3[1] * dt);
      x += dt * (vx + dt / 6 * (k1[0] + k2[0] + k3[0]));
      y += dt * (vy + dt / 6 * (k1[1] + k2[1] + k3[1]));
      vx += dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
      vy += dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      tt += dt;
    }
    if (!hit) return NaN;
    return RE * wrapPi(padAng(NOW + tt) - Math.atan2(y, x));
  }

  /* İniş yanışı: verilen itkiyle dikey durma irtifası (hedefe göre) */
  function stopAlt(c, T, hEff) {
    let h = hEff, vz = c.vUp(), m = c.mass();
    const cdA = c.cd * c.area, base = c.alt() - hEff;
    const dt = 0.05;
    for (let i = 0; i < 2400; i++) {
      if (vz >= 0) return h;
      if (h < -300) return h;
      const D = 0.5 * rho(base + h) * vz * vz * cdA / m;
      const a = T / m + D - 9.81;
      vz += a * dt; h += vz * dt;
    }
    return h;
  }

  /* ---------------- Görev ---------------- */
  class Mission {
    constructor(key, opts) {
      opts = opts || {};
      if (typeof opts === 'string') opts = { mode: opts, payloadMass: arguments[2] && arguments[2].payloadMass };
      const mode = opts.mode || 'exp';
      this.def = ROCKETS[key];
      this.key = key; this.mode = mode; this.opts = opts;
      this.sideMode = opts.sideMode || 'rtls';
      this.payloadMass = opts.payloadMass !== undefined ? opts.payloadMass : 1000;
      this.payloadKind = opts.payloadKind || 'starlink';
      this.fairingMass = opts.fairing === false ? 0 : this.def.fairing;
      this.targetAlt = opts.targetAlt || this.def.targetAlt;
      this.targetAp = opts.targetAp || 0;
      this.waves = opts.waves || 0;
      WIND = { s: (opts.wind && opts.wind.s) || 0, j: (opts.wind && opts.wind.j) || 0 };
      this.engineFail = opts.engineFail || null;
      this.autopilot = opts.autopilot !== false;
      this.autoLand = opts.autoLand !== false;
      this.listeners = [];
      this.t = -10; // T-10 geri sayım
      NOW = this.t;
      this.crafts = [];
      this.structures = [];
      this.events = [];
      this.phase = 'countdown';
      this.satsPlanned = opts.sats || 0;
      this.satsDeployed = 0; this.deployed = false;
      this.maxQ = 0; this.maxQDone = false;
      this.result = null;
      this.focusId = null;
      this.reused = !!opts.reused;
      this.fairingDone = !this.fairingMass;
      this.build();
    }
    on(fn) { this.listeners.push(fn); }
    emit(type, data) {
      this.events.push({ t: this.t, type, data });
      for (const fn of this.listeners) fn(type, data || {}, this);
    }
    build() {
      const d = this.def;
      const st = d.stages;
      const s1 = makePart(st[0], 'booster');
      const s2 = makePart(st[1], 'upper');
      const parts = [s1, s2];
      if (d.sides) {
        parts.push(makePart(d.sides, 'sideL'), makePart(d.sides, 'sideR'));
      }
      const stack = new Craft({
        name: d.name, type: 'stack', parts, extraMass: this.payloadMass + this.fairingMass,
        area: Math.PI * (st[0].dia / 2) ** 2 * (d.sides ? 3 : 1), cd: 0.45,
        length: st[0].len + st[1].len + d.payloadLen,
        held: true, rotRate: 4 * DEG,
      });
      this.mountH = this.key === 'ss' ? 20 : 0;
      stack.y = RE + this.mountH; stack.vx = W_E * stack.y;
      this.stack = stack;
      this.crafts.push(stack);
      this.focusId = stack.id;
      // yapılar (çarpışma)
      if (this.key === 'ss') {
        this.structures.push({ kind: 'mount', d: 0, r: 9, top: 20 });
        this.structures.push({ kind: 'tower', d: -20, r: 7, top: 146 });
        this.structures.push({ kind: 'tower2', d: 330, r: 7, top: 146 });
      } else {
        this.structures.push({ kind: 'pad', d: 0, r: 30, top: 0 });
      }
      this.landingTargets = {};
    }
    focus() { return this.crafts.find(c => c.id === this.focusId) || this.crafts[0]; }

    /* --- oyuncu komutları --- */
    cmd(name, arg) {
      const c = this.focus();
      switch (name) {
        case 'pitch': if (c && c.manual) { c.dirCmd = c.dir + arg; } break;
        case 'throttle': if (c && c.manual) c.throttle = clamp(c.throttle + arg, 0, 1); break;
        case 'throttleSet': if (c && c.manual) c.throttle = clamp(arg, 0, 1); break;
        case 'autopilot':
          this.autopilot = !this.autopilot;
          for (const k of this.crafts) if (k.ascent) k.manual = !this.autopilot;
          this.emit('msg', { text: this.autopilot ? 'Otopilot AÇIK' : 'Manuel kontrol' });
          break;
        case 'stage': this.manualStage(); break;
        case 'landBurn':
          if (c && c.rec && c.state === 'final' && !c.burnLit) { c.burnLit = true; c.manualBurn = true; this.emit('landingBurn', { craft: c }); }
          break;
        case 'catch':
          if (c && c.rec && (c.rec.kind === 'catch' || c.rec.kind === 'shipcatch')) this.tryCatch(c, true);
          break;
        case 'deploy': this.deploy(); break;
        case 'fts': if (c && c.alive) this.explode(c, 'Uçuş sonlandırma sistemi (FTS) tetiklendi'); break;
      }
    }

    manualStage() {
      const s = this.stack;
      if (!s || !s.alive) return;
      if (this.phase === 'ascent1' && s.parts.find(p => p.role === 'sideL')) { this.separateSides(); return; }
      if (this.phase === 'ascent1' || this.phase === 'meco') { this.meco(); this.stageSep(); return; }
      if (this.phase === 'ascent2' && !this.fairingDone && s.alt() > 60000) this.dropFairing();
    }

    /* --- ana adım --- */
    step(dt) {
      this.t += dt; NOW = this.t;
      const s = this.stack;
      if (this.phase === 'countdown') {
        if (this.t >= -3 && !s.parts[0].firing) {
          for (const p of s.parts) if (p.role !== 'upper') p.firing = true;
          s.throttle = 1;
          this.emit('ignition', { craft: s });
        }
        if (this.t >= 0) {
          s.held = false; this.phase = 'ascent1'; s.ascent = 1; s.manual = !this.autopilot;
          this.emit('liftoff', { craft: s });
        }
      }
      if (this.engineFail && !this.engineFail.done && this.t >= this.engineFail.t) this.doEngineFail();
      for (const c of this.crafts) {
        if (!c.alive) continue;
        this.control(c, dt);
        physStep(c, dt);
        this.checkCraft(c, dt);
      }
      // ölü / süresi dolanları temizle
      this.crafts = this.crafts.filter(c => !(c.ttl !== Infinity && c.t > c.ttl));
      this.updatePhase(dt);
    }

    doEngineFail() {
      const ef = this.engineFail; ef.done = true;
      const c = this.stack; if (!c || !c.alive) return;
      const p = c.parts.find(q => q.role === (ef.part || 'booster') && q.firing);
      if (!p) return;
      const n = p.def.engines;
      const out = Math.min(ef.count || 1, n);
      if (n <= out) {
        p.health = 0; p.dead = true;
        this.emit('engineOut', { craft: c, part: p, total: true });
        this.emit('msg', { text: 'MOTOR ARIZASI! ' + (p.role === 'upper' ? 'Üst kademe' : '1. kademe') + ' motoru durdu — itki kaybı!', bad: true });
      } else {
        p.health = (n - out) / n;
        this.emit('engineOut', { craft: c, part: p, total: false, n: out });
        this.emit('msg', { text: 'Motor arızası: ' + out + ' motor kapandı — kalan ' + (n - out) + ' motorla devam (motor-arızası toleransı)', bad: true });
      }
    }
    control(c, dt) {
      if (c.type === 'fairing' && c.fairingRec && !c.chute && c.alt() < 12000 && c.vUp() < 0) {
        c.chute = true; c.cd = 1.4; c.area = 700; c.dirCmd = c.upAng(); c.rotRate = 30 * DEG;
        this.emit('chute', { craft: c });
      }
      if (c.ascent === 1) this.ascent1(c, dt);
      else if (c.ascent === 2) this.ascent2(c, dt);
      if (c.rec) this.recovery(c, dt);
    }

    /* 1. kademe yükselişi */
    ascent1(c, dt) {
      const d = this.def, h = c.alt(), v = c.airSpeed();
      // Max-Q
      if (c.q > this.maxQ) this.maxQ = c.q;
      else if (!this.maxQDone && this.maxQ > 8000 && c.q < this.maxQ * 0.97) { this.maxQDone = true; this.emit('maxq', { q: this.maxQ }); }
      if (!c.manual) {
        let pitch = 0;
        if (h > 250) pitch = d.pitch.pmax * DEG * Math.pow(Math.min(1, h / d.pitch.hp), d.pitch.exp);
        if (v > 90) {
          const av0 = c.airVel(), u0 = c.up(), e0 = c.east();
          const pro = Math.atan2(av0[0] * e0[0] + av0[1] * e0[1], av0[0] * u0[0] + av0[1] * u0[1]);
          pitch = clamp(pitch, pro - 3 * DEG, pro + 3 * DEG);
        }
        c.setPitchCmd(pitch);
        // Max-Q civarı gaz kısma
        const th = c.q > 28000 ? 0.72 : 1;
        c.throttle += clamp(th - c.throttle, -0.4 * dt, 0.4 * dt);
        // ivme sınırı (~4.5 g)
        const T = c.maxThrust(); if (T > 0) c.throttle = Math.min(c.throttle, 4.5 * G0 * c.mass() / T);
      }
      // yapısal yük: dinamik basınç x hücum açısı
      if (v > 50) {
        const avv = c.airVel();
        const aoa = Math.abs(wrapPi(Math.atan2(avv[1], avv[0]) - c.dir));
        const jet = Math.abs(windAt(h) - WIND.s * Math.exp(-Math.max(0, h) / 3000));
        c.load = c.q * (Math.sin(Math.min(aoa, Math.PI / 2)) + jet / Math.max(v, 100));
        if (c.load > 3500 && c.q > 6000) {
          c.stress = (c.stress || 0) + dt;
          if (c.stress > 0.6) { this.explode(c, jet > 25 ? 'Jet akımı rüzgârı yapısal sınırı aştı — roket Max-Q\'da parçalandı' : 'Aerodinamik yük aşıldı — roket parçalandı (yüksek hücum açısı)'); return; }
        } else c.stress = 0;
      }
      // yan boosterlar
      const sideL = c.parts.find(p => p.role === 'sideL');
      if (sideL) {
        const res = (this.sideMode === 'exp' ? 0.02 : d.sides.reserve) * d.sides.prop;
        if (sideL.prop <= res) { this.separateSides(); }
      }
      // MECO
      const b = c.parts.find(p => p.role === 'booster');
      if (b) {
        const resFrac = this.mode === 'exp' ? 0 : d.reserve[this.mode];
        const reserve = resFrac * b.def.prop;
        if (b.def.hotStage) {
          if (b.prop <= reserve + 0.012 * b.def.prop && !this.hotStaging) {
            this.hotStaging = this.t;
            b.engFrac = 3 / 33;
            c.parts.find(p => p.role === 'upper').firing = true;
            this.emit('hotstage', { craft: c });
          }
          if (this.hotStaging && this.t - this.hotStaging > 2.0) { this.meco(true); this.stageSep(); }
        } else if (b.prop <= reserve + 1 && b.firing) {
          this.meco();
        }
      }
    }
    meco(silent) {
      const b = this.stack.parts.find(p => p.role === 'booster');
      if (b && b.firing) { b.firing = false; if (!silent) this.emit('meco', { craft: this.stack }); }
      if (this.phase === 'ascent1') this.phase = 'meco';
      if (!this.mecoT) this.mecoT = this.t;
    }
    separateSides() {
      const s = this.stack, d = this.def;
      const L = s.parts.find(p => p.role === 'sideL'), R = s.parts.find(p => p.role === 'sideR');
      if (!L) return;
      s.parts = s.parts.filter(p => p !== L && p !== R);
      const core = s.parts.find(p => p.role === 'booster'); if (core) core.cap = 1;
      s.area = Math.PI * (d.stages[0].dia / 2) ** 2;
      const mk = (part, side, off) => {
        part.firing = false;
        const e = s.east();
        const c = new Craft({
          name: 'Yan Booster ' + side, type: 'side', side, parts: [part],
          x: s.x + e[0] * off, y: s.y + e[1] * off, vx: s.vx + e[0] * off * 0.4, vy: s.vy + e[1] * off * 0.4,
          dir: s.dir, dirCmd: s.dir, area: 16.8, cd: 1.2, length: part.def.len, rotRate: 10 * DEG,
        });
        if (this.sideMode === 'exp') { c.state = 'expended'; c.dirCmd = c.dir + (side === 'L' ? -0.5 : 0.5); }
        else { c.rec = { kind: 'rtls', target: side === 'L' ? 1100 : 1700, entryBurn: true, boost: true }; c.state = 'coast'; c.stateT = 0; }
        this.landingTargets[c.id] = c.rec;
        this.crafts.push(c);
        return c;
      };
      const a = mk(L, 'L', -5), b = mk(R, 'R', 5);
      this.emit('sideSep', { crafts: [a, b], craft: s });
    }
    stageSep() {
      const s = this.stack, d = this.def;
      if (this.phase === 'ascent2' || this.phase === 'orbit') return;
      const b = s.parts.find(p => p.role === 'booster');
      const up = s.parts.find(p => p.role === 'upper');
      const dx = Math.cos(s.dir), dy = Math.sin(s.dir);
      const L1 = d.stages[0].len;
      // booster
      b.firing = false; b.engFrac = 1; b.cap = 1;
      const booster = new Craft({
        name: d.key === 'ss' ? 'Super Heavy' : (d.key === 'fh' ? 'Merkez Çekirdek' : '1. Kademe'),
        type: 'booster', parts: [b], x: s.x, y: s.y, vx: s.vx - dx * 1.2, vy: s.vy - dy * 1.2,
        dir: s.dir, dirCmd: s.dir, area: Math.PI * (b.def.dia / 2) ** 2 * 1.6, cd: 1.2, length: L1, rotRate: 9 * DEG,
      });
      if (this.mode !== 'exp' && b.def.recoverable) {
        let rec;
        if (this.mode === 'rtls') rec = { kind: 'rtls', target: 1400, boost: true, entryBurn: true };
        else if (this.mode === 'catch') rec = { kind: 'catch', target: 0, boost: true, entryBurn: false };
        else if (this.mode === 'ocean') { const imp = predictImpact(booster); rec = { kind: 'ocean', target: imp - 2500, boost: false, entryBurn: !!b.def.entryBurn }; }
        else {
          const imp = predictImpact(booster);
          rec = { kind: 'asds', target: imp - 2500, boost: false, entryBurn: true };
          this.shipD = rec.target;
        }
        booster.rec = rec; booster.state = 'coast'; booster.stateT = 0;
        this.landingTargets[booster.id] = rec;
      } else {
        booster.state = 'expended';
        booster.dirCmd = booster.dir + 0.6; booster.rotRate = 4 * DEG;
      }
      this.crafts.push(booster);
      // üst kademe
      s.parts = [up];
      s.type = 'upper';
      s.name = d.key === 'ss' ? 'Ship' : '2. Kademe';
      s.x += dx * L1; s.y += dy * L1; s.vx += dx * 0.8; s.vy += dy * 0.8;
      s.area = Math.PI * (d.stages[1].dia / 2) ** 2; s.length = d.stages[1].len + (this.fairingMass ? d.payloadLen : (this.payloadKind === 'dragon' ? 8.1 : 0));
      s.ascent = 2; s.manual = !this.autopilot; s.throttle = 1; s.rotRate = 5 * DEG;
      this.phase = 'ascent2'; this.sepT = this.t;
      if (!d.stages[0].hotStage) up.firing = false;
      this.emit('stageSep', { craft: s, booster });
      if (this.focusId === s.id && this.mode !== 'exp') { /* odak üst kademede kalır */ }
    }
    dropFairing() {
      if (this.fairingDone) return;
      const s = this.stack, d = this.def;
      this.fairingDone = true;
      s.extraMass -= this.fairingMass;
      const dx = Math.cos(s.dir), dy = Math.sin(s.dir), e = s.east();
      const halves = [];
      for (const side of [-1, 1]) {
        const c = new Craft({
          name: 'Burun konisi ' + (side < 0 ? 'A' : 'B'), type: 'fairing', side, parts: [], extraMass: this.fairingMass / 2,
          x: s.x + dx * (d.stages[1].len), y: s.y + dy * (d.stages[1].len),
          vx: s.vx + e[0] * side * 6, vy: s.vy + e[1] * side * 6, dir: s.dir, dirCmd: s.dir + side * 1.5, rotRate: 25 * DEG,
          area: 20, cd: 1.2, ttl: this.opts.fairingRec ? Infinity : 40, fairingRec: !!this.opts.fairingRec,
        });
        this.crafts.push(c); halves.push(c);
      }
      this.emit('fairing', { crafts: halves, craft: s });
    }

    /* 2. kademe kılavuzu (basitleştirilmiş kapalı döngü) */
    ascent2(c, dt) {
      const d = this.def, up = c.parts[0];
      if (!up) return;
      const tSep = this.t - this.sepT;
      if (!up.firing && tSep > (d.stages[0].hotStage ? 0 : 2.5) && !c.seco && up.prop > 0) {
        up.firing = true; this.emit('ses', { craft: c });
      }
      if (!this.fairingDone && c.alt() > 105000) this.dropFairing();
      const o = c.orbit();
      const Ht = this.targetAp ? 200000 : this.targetAlt;
      if (!c.manual && up.firing) {
        const h = c.alt(), r = c.r();
        const vz = c.vUp(), vh = c.vEastIn();
        const g = MU / (r * r);
        const m = c.mass();
        const aMax = Math.max(0.1, c.maxThrust() / m);
        const G = GUID;
        const vzDes = clamp((Ht - h) * G.k, -150, G.cap);
        let av = (vzDes - vz) / G.tau + g - vh * vh / r;
        av = clamp(av, -0.3 * aMax, G.amax * aMax);
        const ah = Math.sqrt(Math.max(0, aMax * aMax - av * av));
        c.setPitchCmd(Math.atan2(ah, av));
        // yörüngeye yaklaşınca gaz kıs
        const vc = Math.sqrt(MU / r);
        const dv = vc - vh;
        c.throttle = (dv < 60 && !this.targetAp) ? clamp(dv / 60, 0.4, 1) : 1;
        if (this.targetAp && o.pe > 150000) { c.setPitchCmd(Math.PI / 2 - clamp((h - Ht) / 200000, -0.3, 0.3)); }
        const Tm = c.maxThrust(); if (Tm > 0) c.throttle = Math.min(c.throttle, 4 * G0 * m / Tm);
      }
      if (up.firing && !c.seco) {
        const target = Ht - 15000;
        const done = this.targetAp ? (o.pe > 160000 && o.ap >= this.targetAp) : ((o.pe > 160000 && o.ap >= Ht - 25000) || (o.pe >= Math.min(target, c.alt() - 8000) && o.pe > 160000));
        if (done || up.prop <= 0 || up.dead) {
          this.seco(c, o);
        }
      }
      if (c.manual && up.firing && c.throttle <= 0.001 && o.pe > 140000) this.seco(c, o);
    }
    seco(c, o) {
      const up = c.parts[0];
      c.seco = true; up.firing = false; c.throttle = 0;
      o = o || c.orbit();
      if (o.pe > 140000 && (!this.targetAp || o.ap >= this.targetAp * 0.97)) {
        this.phase = 'orbit'; this.orbitT = this.t; c.ascent = 0;
        this.emit('seco', { craft: c, orbit: o, ok: true });
        this.emit('orbit', { craft: c, orbit: o });
        c.dirCmd = c.dir; c.manual = false;
      } else {
        this.emit('seco', { craft: c, orbit: o, ok: false });
        this.phase = 'failed2';
        if (o.pe > 140000) {
          // düşük yörünge: kısmi başarı
          this.phase = 'orbit'; this.orbitT = this.t; c.ascent = 0; this.partial = true;
          this.emit('msg', { text: 'Hedef yörüngeye ulaşılamadı — yük daha düşük bir yörüngede kaldı', bad: true });
          this.emit('orbit', { craft: c, orbit: o, partial: true });
          return;
        }
        this.failUpper = up.dead ? 'Üst kademe motor arızası — yörüngeye ulaşılamadı' : 'Yakıt bitti — yörünge hızına ulaşılamadı';
        this.emit('msg', { text: 'Yörünge hızına ulaşılamadı! Üst kademe atmosfere geri düşüyor.', bad: true });
        c.ascent = 0; c.state = 'falling';
      }
    }
    deploy() {
      if (this.phase !== 'orbit' || this.deployed) return;
      const c = this.stack;
      this.deployed = true;
      this.satsDeployed = this.satsPlanned;
      c.extraMass = 0;
      this.deployT = this.t;
      this.emit('deploy', { craft: c, n: this.satsPlanned, kind: this.payloadKind });
      if (this.opts.shipReturn && this.key === 'ss') {
        c.rec = { kind: 'shipcatch', target: 350, boost: false, entryBurn: false };
        c.state = 'orbitcoast'; c.stateT = 0; c.ship = true;
        c.cd = 1.1; c.area = 9 * 50;
        this.emit('msg', { text: 'Ship dönüş için yörüngeden çıkış penceresini bekliyor' });
      }
    }

    /* --- Booster kurtarma otomatı --- */
    recovery(c, dt) {
      const rec = c.rec, b = c.parts[0];
      if (!b || c.landed || c.caught) return;
      c.stateT += dt;
      const h = c.alt();
      const dr = c.downrange();
      const engs = b.def.engines;
      const lowerTarget = (rec.kind === 'catch' || rec.kind === 'shipcatch') ? 40 : rec.kind === 'asds' ? 3 : 0;
      const minThrL = b.def.landMinThr || (rec.kind === 'shipcatch' ? b.def.minThr : (this.opts.landMinThr || b.def.minThr));
      c.aLatE = 0;
      switch (c.state) {
        case 'orbitcoast': {
          // yörüngeden çıkış penceresi: ~120 m/s geri yanış sonrası çarpma noktası hedefin hemen önünde mi?
          c.dirCmd = Math.atan2(-c.vy, -c.vx); c.rotRate = 6 * DEG;
          if (!c.predT || c.t - c.predT > 2) {
            c.predT = c.t;
            const v = c.speed(), dv = 200;
            const ghost = { x: c.x, y: c.y, vx: c.vx - dv * c.vx / v, vy: c.vy - dv * c.vy / v, mass: () => c.mass(), cd: c.cd, area: c.area };
            c.deorbitMiss = predictImpact(ghost) - rec.target;
            if (c.deorbitMiss < 0 && c.deorbitMiss > -600000 && c.stateT > 20) {
              c.state = 'deorbit'; c.stateT = 0; c.v0 = v; this.emit('deorbit', { craft: c });
            }
          }
          break;
        }
        case 'deorbit': {
          c.dirCmd = Math.atan2(-c.vy, -c.vx);
          if (Math.abs(wrapPi(c.dir - c.dirCmd)) < 5 * DEG) { b.firing = true; b.engFrac = 0.5; c.throttle = 0.15; }
          if (b.firing && (!c.predT2 || c.t - c.predT2 > 0.1)) { c.predT2 = c.t; c.deorbitMiss = predictImpact(c) - rec.target; }
          if ((b.firing && c.deorbitMiss < 12000 && c.deorbitMiss > -300000) || c.v0 - c.speed() >= 260 || b.prop < b.def.prop * 0.012) {
            b.firing = false; c.state = 'reentry'; c.stateT = 0; c.rotRate = 8 * DEG;
            this.emit('deorbitEnd', { craft: c });
          }
          break;
        }
        case 'reentry': {
          // göbek üstü süzülme: gövde akışa dik
          const ra = c.retroAng();
          const a1 = ra + Math.PI / 2, a2 = ra - Math.PI / 2, ua = c.upAng();
          c.dirCmd = Math.abs(wrapPi(a1 - ua)) < Math.abs(wrapPi(a2 - ua)) ? a1 : a2;
          if (h < 80000) {
            if (!c.glT || c.t - c.glT > 0.5) { c.glT = c.t; c.glMiss = predictImpact(c, lowerTarget) - rec.target; }
            const aMax = Math.min(12, c.q / 500);
            if (isFinite(c.glMiss)) c.aLatE = clamp(-c.glMiss * 0.0006, -aMax, aMax);
          }
          if (h < 9000 && c.vUp() < 0) { c.state = 'final'; c.stateT = 0; this.emit('final', { craft: c }); }
          break;
        }
        case 'coast': {
          if (c.stateT > 0.3 && !c.finsOut) { c.finsOut = true; this.emit('gridfins', { craft: c }); }
          if (rec.boost) {
            // geri dönüş için dön (motorlar ileri)
            const e = c.east(), u = c.up();
            const tx = -e[0] * 0.97 + u[0] * 0.24, ty = -e[1] * 0.97 + u[1] * 0.24;
            c.dirCmd = Math.atan2(ty, tx);
            if (c.stateT > 3 && Math.abs(wrapPi(c.dir - c.dirCmd)) < 8 * DEG) { c.state = 'boostback'; c.stateT = 0; b.firing = true; b.engFrac = b.def.boostEngines / engs; c.throttle = 1; this.emit('boostback', { craft: c }); }
          } else {
            c.dirCmd = c.retroAng();
            if (c.stateT > 4) { c.state = 'descent'; c.stateT = 0; }
          }
          break;
        }
        case 'boostback': {
          const e = c.east(), u = c.up();
          const tx = -e[0] * 0.97 + u[0] * 0.24, ty = -e[1] * 0.97 + u[1] * 0.24;
          c.dirCmd = Math.atan2(ty, tx);
          if (!c.predT || c.t - c.predT > 0.25) { c.predT = c.t; c.pred = predictImpact(c); }
          const miss = c.pred - rec.target;
          if (miss < 600 || b.prop < b.def.prop * 0.05) {
            b.firing = false; c.state = 'descent'; c.stateT = 0;
            this.emit('boostbackEnd', { craft: c, miss });
          } else if (miss < 6000) c.throttle = clamp(miss / 6000, 0.35, 1);
          break;
        }
        case 'descent': {
          // motorlar önde (retrograde)
          c.dirCmd = c.retroAng();
          this.gridFins(c, rec, lowerTarget);
          const v = c.airSpeed();
          if (rec.entryBurn && !c.entryDone && h < 56000 && c.vUp() < 0) {
            if (v > 900) { c.state = 'entry'; c.stateT = 0; b.firing = true; b.engFrac = 3 / engs; c.throttle = 1; this.emit('entryBurn', { craft: c }); }
            else c.entryDone = true;
          }
          if (h < 9000 && c.vUp() < 0) {
            c.state = 'final'; c.stateT = 0;
            if (rec.kind === 'asds') { rec.target = predictImpact(c) + 150; this.shipD = rec.target; this.emit('shipMove', { d: rec.target }); }
            this.emit('final', { craft: c });
          }
          break;
        }
        case 'entry': {
          c.dirCmd = c.retroAng();
          if (c.airSpeed() < 600 || b.prop < b.def.prop * 0.03 || h < 18000) {
            b.firing = false; c.entryDone = true; c.state = 'descent'; c.stateT = 0; this.emit('entryBurnEnd', { craft: c });
            if (rec.kind === 'asds') { rec.target = predictImpact(c); this.shipD = rec.target; this.emit('shipMove', { d: rec.target }); }
          }
          break;
        }
        case 'final': {
          if (rec.kind === 'ocean' && c.burnLit) rec.target = dr + c.vEast() * 0.6;
          const hEff = h - lowerTarget;
          const m = c.mass();
          const g = MU / (c.r() ** 2);
          const vz = c.vUp();
          const nE1 = b.def.landEngines / engs;
          const nS = (b.def.landStart || b.def.landEngines) / engs;
          const LF = b.def.landThrFrac || 1;
          const Tl = (b.def.thrVac - (b.def.thrVac - b.def.thrSL) * pres(h)) * LF * (b.health || 1);
          if (h < 1800 && !c.legsOut && rec.kind !== 'catch' && rec.kind !== 'shipcatch') { c.legsOut = true; this.emit('legs', { craft: c }); }
          if (!c.burnLit) {
            if (c.ship) {
              const ra = c.retroAng(), a1 = ra + Math.PI / 2, a2 = ra - Math.PI / 2, ua = c.upAng();
              c.dirCmd = Math.abs(wrapPi(a1 - ua)) < Math.abs(wrapPi(a2 - ua)) ? a1 : a2;
              this.gridFins(c, rec, lowerTarget, 1.6);
            } else {
              c.dirCmd = c.retroAng();
              this.gridFins(c, rec, lowerTarget);
            }
            // durma irtifası tahmini (tam gaz / %80)
            if (!c.stopT || c.t - c.stopT > 0.1) {
              c.stopT = c.t;
              c.stop100 = stopAlt(c, Tl * nS, hEff);
              c.stop80 = stopAlt(c, Tl * nS * 0.8, hEff);
            }
            c.burnRatio = clamp(1 - c.stop80 / Math.max(50, hEff), 0, 2);
            const auto = this.autoLand || c.id !== this.focusId;
            if (auto && c.stop80 <= (c.ship ? 650 : 40) && hEff < 7000) { c.burnLit = true; this.emit('landingBurn', { craft: c }); if (c.ship) this.emit('flip', { craft: c }); }
          }
          if (c.burnLit && b.prop > 0) {
            // gerekirse 3 motorla başla, sonra tek motora düş
            if (c.landEng === undefined) c.landEng = c.stop100 < 0 ? Math.min(1, nS * 3) : nS;
            const aT1 = Tl * nE1 / m;
            if (c.landEng > nE1 && Math.abs(vz) < 0.55 * Math.sqrt(2 * Math.max(1, aT1 - g) * Math.max(1, hEff))) c.landEng = nE1;
            b.engFrac = c.landEng;
            const aT = Tl * c.landEng / m;
            const aProf = Math.max(1, 0.7 * (aT1 - g));
            const vzCmd = -(1.5 + Math.sqrt(2 * aProf * Math.max(0, hEff)));
            const dx = dr - rec.target, vh = c.vEast();
            const ff = hEff > 0 ? aProf : 0;
            let aV = g + ff + (vzCmd - vz) * 2.4 - c.q * c.cd * c.area / m * 0.5;
            const tgo = Math.max(1.2, 1.45 * (hEff - 22) / Math.max(3, -vz));
            let aH = clamp(-6 * dx / (tgo * tgo) - 4 * vh / tgo, -0.6 * aT, 0.6 * aT);
            if (hEff < 25) aH = clamp(-0.1 * dx - 2.0 * vh, -0.25 * aT, 0.25 * aT);
            if (hEff < 7) aH = clamp(-0.06 * dx - 1.5 * vh, -0.1 * aT, 0.1 * aT);
            aV = Math.max(0.2, aV);
            let thr = Math.hypot(aV, aH) / aT;
            if (thr < minThrL * 0.5 && hEff > 30) { b.firing = false; } else { b.firing = true; thr = clamp(thr, minThrL, 1); }
            c.throttle = thr * LF;
            if (c.ship && Math.abs(wrapPi(c.dir - c.dirCmd)) > 12 * DEG) c.throttle = minThrL * LF; // çevrilme sırasında
            const u = c.up(), e = c.east();
            c.dirCmd = Math.atan2(u[1] * aV + e[1] * aH, u[0] * aV + e[0] * aH); c.rotRate = c.ship ? 45 * DEG : 25 * DEG;
            // aerodinamik ızgara kanatçıkları hâlâ etkili
            this.gridFins(c, rec, lowerTarget, 0.5);
          } else if (c.burnLit && b.prop <= 0) {
            b.firing = false;
            if (!c.fuelOut) { c.fuelOut = true; this.emit('msg', { text: c.name + ': Yakıt bitti!', bad: true }); }
          }
          if (rec.kind === 'catch' || rec.kind === 'shipcatch') this.tryCatch(c, false);
          break;
        }
      }
    }
    gridFins(c, rec, lowerTarget, scale) {
      const h = c.alt();
      if (h > 70000) return;
      const vz = c.vUp();
      if (vz > -5) return;
      const tgo = Math.max(5, (h - lowerTarget) / -vz * 1.15);
      const dx = c.downrange() - rec.target;
      const vhDes = -dx / tgo;
      const aMax = Math.min(25 * Math.max(1, scale || 1), c.q / 900 * (scale || 1));
      c.aLatE = clamp((vhDes - c.vEast()) * 0.5, -aMax, aMax);
    }
    tryCatch(c, manual) {
      if (c.caught || !c.alive) return;
      const hEff = c.alt() - 40;
      const dx = c.downrange() - c.rec.target;
      const ok = hEff < 14 && hEff > -9 && Math.abs(c.vUp()) < 4.5 && Math.abs(dx) < 10 && c.burnLit;
      c.catchReady = ok;
      const auto = this.autoLand || c.id !== this.focusId;
      if (ok && (manual || (auto && hEff < 3))) {
        c.caught = true; c.parts[0].firing = false; c.throttle = 0;
        c.result = 'caught';
        this.emit('caught', { craft: c, dx, ship: !!c.ship });
      } else if (manual && !ok) {
        this.emit('msg', { text: 'Kollar kapatılamaz — booster yakalama bölgesinde değil!', bad: true });
      }
    }

    /* zemin/temas & ısınma kontrolleri */
    checkCraft(c, dt) {
      if (!c.alive || c.landed || c.caught || c.held) return;
      const h = c.alt();
      const dr = c.downrange();
      // yeniden girişte parçalanma (korumasız aşamalar)
      const heatLimit = (c.type === 'fairing' || c.ship) ? Infinity : (c.rec ? 1.4e10 : 1.6e9);
      if (c.heatLoad > heatLimit && h < 80000) {
        this.explode(c, c.name + ' yeniden girişte aşırı ısındı ve parçalandı', true);
        return;
      }
      let ground = 0;
      for (const s of this.structures) if (Math.abs(dr - s.d) < s.r) ground = Math.max(ground, s.top);
      let deckV = 0;
      if (this.shipD !== undefined && Math.abs(dr - this.shipD) < 46) {
        const ph = this.t * 2 * Math.PI / 9;
        ground = Math.max(ground, 3 + this.waves * 0.5 * Math.sin(ph));
        deckV = this.waves * 0.5 * 2 * Math.PI / 9 * Math.cos(ph);
      }
      if (h <= ground && c.t > 1 && c.vUp() <= 0) {
        const vz = c.vUp() - deckV, vh = c.vEast();
        if (c.type === 'fairing') {
          if (c.fairingRec && c.chute) {
            c.landed = true;
            const ok = Math.random() < clamp(0.88 - this.waves * 0.12, 0.2, 0.9);
            c.result = ok ? 'fairingOk' : 'fairingWet';
            this.emit('fairingRec', { craft: c, ok });
          } else c.alive = false;
          return;
        }
        const rec = c.rec;
        const tilt = Math.abs(c.pitchFromVertical());
        if (rec && rec.kind === 'ocean') {
          if (Math.abs(vz) < 9 && Math.abs(vh) < 9 && tilt < 25 * DEG) {
            c.landed = true; c.splashed = true; c.result = 'splash'; c.parts[0].firing = false; c.throttle = 0;
            this.emit('splashdown', { craft: c, vz });
          } else this.explode(c, c.name + ' okyanusa sert çarptı (' + Math.abs(vz).toFixed(0) + ' m/s)', false, true);
          return;
        }
        if (rec && rec.kind !== 'catch' && rec.kind !== 'shipcatch') {
          const dx = dr - rec.target;
          const padR = rec.kind === 'asds' ? 40 : 45;
          if (Math.abs(vz) < 8 && Math.abs(vh) < 6 && tilt < 15 * DEG && Math.abs(dx) < padR) {
            c.landed = true; c.result = 'landed'; c.parts[0].firing = false; c.throttle = 0;
            const r = RE + ground, a = c.upAng(); c.x = r * Math.cos(a); c.y = r * Math.sin(a);
            this.emit('landed', { craft: c, dx, vz });
            return;
          }
          const why = Math.abs(dx) >= padR ? 'hedefi ıskaladı (' + Math.round(dx) + ' m)' : tilt >= 15 * DEG ? 'eğik indi ve devrildi' : 'çok sert indi (' + Math.abs(vz).toFixed(1) + ' m/s dikey, ' + Math.abs(vh).toFixed(1) + ' m/s yatay)';
          this.explode(c, c.name + ' ' + why, false, true);
          return;
        }
        this.explode(c, c.name + (c.rec ? ' kuleye/rampaya çarptı' : ' yüzeye çarptı'), false, true);
      }
    }
    explode(c, why, reentry, ground) {
      if (!c.alive) return;
      c.alive = false; c.result = 'lost';
      for (const p of c.parts) p.firing = false;
      this.emit('explode', { craft: c, why, reentry: !!reentry, ground: !!ground });
      this.emit('msg', { text: why, bad: true });
      if (c === this.stack && !this.deployed) {
        this.phase = 'failed';
        this.failReason = why;
      }
    }

    updatePhase() {
      if (this.result) return;
      const s = this.stack;
      if (this.phase === 'meco' && this.mecoT && this.t - this.mecoT > 2.5) this.stageSep();
      if (this.phase === 'orbit' && !this.deployed && this.t - this.orbitT > 8 && this.autoDeploy !== false) this.deploy();
      const recs = this.crafts.filter(c => c.rec || c.fairingRec);
      const pending = recs.filter(c => c.alive && !c.landed && !c.caught);
      const done = pending.length === 0;
      if ((this.phase === 'failed' || this.phase === 'failed2') && (done || this.t - (this.failT || (this.failT = this.t)) > 25)) {
        if (this.phase === 'failed2' && s.alive && s.alt() > 0 && this.t - this.failT < 25) return;
        this.finish(false);
      }
      if (this.phase === 'orbit' && this.deployed && this.t - this.deployT > 6 && done) this.finish(true);
      // Ship dönüşü sırasında üst kademe kaybı görevi başarısız yapmaz (yük bırakıldı)
    }
    finish(ok) {
      const recs = this.allRecovered();
      const cr = this.crafts;
      this.result = {
        ok, partial: !!this.partial, sats: ok ? this.satsDeployed : 0, kind: this.payloadKind,
        recovered: recs.ok, lost: recs.lost, reason: ok ? null : (this.failReason || this.failUpper || 'Görev başarısız'),
        orbit: ok ? this.stack.orbit() : null, t: this.t,
        boosters: cr.filter(c => c.rec && !c.ship).map(c => ({ name: c.name, type: c.type, side: c.side, kind: c.rec.kind, result: c.landed && !c.splashed ? 'landed' : c.caught ? 'caught' : c.splashed ? 'splash' : 'lost' })),
        expended: cr.filter(c => c.state === 'expended').length,
        ship: this.opts.shipReturn ? (this.stack.caught ? 'caught' : 'lost') : null,
        fairings: cr.filter(c => c.fairingRec).map(c => c.result === 'fairingOk'),
        engineOut: !!(this.engineFail && this.engineFail.done),
      };
      this.emit('end', this.result);
    }
    allRecovered() {
      let ok = 0, lost = 0;
      for (const c of this.crafts) if (c.rec && !c.ship) { if ((c.landed && !c.splashed) || c.caught) ok++; else lost++; }
      // patlayanlar listeden silinmez ama alive=false
      return { ok, lost };
    }
  }

  global.SIM = { windAt, setWind: w => { WIND = w; }, W_E, padAng, now: () => NOW, GUID, G0, MU, RE, PAD_ANG, SAT_MASS, DEG, ROCKETS, MODE_NAMES, Mission, Craft, orbitOf, rho, pres, predictImpact, clamp, wrapPi };
})(typeof window !== 'undefined' ? window : globalThis);
