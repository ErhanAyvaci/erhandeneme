/* =====================================================================
   İlerleme sistemi: Ar-Ge ağacı, tesisler, haftalık tur, booster filosu,
   uydu ağı (bölgeler / yer istasyonları / lazer / GEO röle), sözleşmeler,
   hava durumu, başarımlar. Render'dan bağımsız (node ile test edilebilir).
   ===================================================================== */
(function (global) {
  'use strict';
  const M = 1e6;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const DEG = Math.PI / 180;

  /* ---------------- Uydu nesilleri ---------------- */
  const SAT_GENS = {
    v09: { name: 'Starlink v0.9', mass: 227, cap: 10, cover: 0.8, laser: false, cost: 0.6 * M, research: 'u_v09' },
    v10: { name: 'Starlink v1.0', mass: 260, cap: 18, cover: 1.0, laser: false, cost: 0.5 * M, research: 'u_v10' },
    v15: { name: 'Starlink v1.5', mass: 306, cap: 22, cover: 1.0, laser: true, cost: 0.55 * M, research: 'u_v15' },
    v2m: { name: 'Starlink V2 mini', mass: 800, cap: 96, cover: 1.5, laser: true, cost: 0.8 * M, research: 'u_v2m' },
    v3: { name: 'Starlink V3', mass: 1900, cap: 600, cover: 2.2, laser: true, cost: 1.4 * M, research: 'u_v3' },
  };
  const GEN_ORDER = ['v09', 'v10', 'v15', 'v2m', 'v3'];

  /* ---------------- Yörünge kabukları ---------------- */
  const SHELLS = {
    s53: { name: '53° kabuk (orta enlemler)', inc: 53, factor: 1.0 },
    s70: { name: '70° kabuk (yüksek enlemler)', inc: 70, factor: 0.92 },
    s97: { name: '97.6° kutup kabuğu', inc: 97.6, factor: 0.82 },
  };

  /* ---------------- Bölgeler ---------------- */
  const REGIONS = [
    { id: 'na', name: 'Kuzey Amerika', lat: 40, lon: -100, r: 22, land: true, demand: 3000, sector: 'am' },
    { id: 'ca', name: 'Kanada & Alaska', lat: 62, lon: -125, r: 16, land: true, demand: 300, sector: 'am' },
    { id: 'cam', name: 'Orta Amerika & Karayipler', lat: 15, lon: -85, r: 12, land: true, demand: 600, sector: 'am' },
    { id: 'sa', name: 'Güney Amerika', lat: -15, lon: -60, r: 20, land: true, demand: 1500, sector: 'am' },
    { id: 'eu', name: 'Avrupa', lat: 50, lon: 12, r: 15, land: true, demand: 2500, sector: 'emea' },
    { id: 'tr', name: 'Türkiye & Orta Doğu', lat: 35, lon: 40, r: 13, land: true, demand: 1200, sector: 'emea' },
    { id: 'af', name: 'Afrika', lat: 3, lon: 20, r: 24, land: true, demand: 1500, sector: 'emea' },
    { id: 'ru', name: 'Rusya & Sibirya', lat: 60, lon: 90, r: 22, land: true, demand: 600, sector: 'apac' },
    { id: 'sas', name: 'Güney Asya', lat: 22, lon: 80, r: 13, land: true, demand: 2000, sector: 'apac' },
    { id: 'eas', name: 'Doğu Asya', lat: 35, lon: 115, r: 15, land: true, demand: 1500, sector: 'apac' },
    { id: 'sea', name: 'Güneydoğu Asya', lat: 5, lon: 110, r: 14, land: true, demand: 1200, sector: 'apac' },
    { id: 'oc', name: 'Avustralya & Okyanusya', lat: -25, lon: 135, r: 17, land: true, demand: 800, sector: 'apac' },
    { id: 'atl', name: 'Atlantik (deniz & havacılık)', lat: 20, lon: -40, r: 20, land: false, demand: 500, sector: 'am' },
    { id: 'pac', name: 'Pasifik (deniz & havacılık)', lat: 0, lon: -150, r: 26, land: false, demand: 600, sector: 'apac' },
    { id: 'ind', name: 'Hint Okyanusu', lat: -20, lon: 75, r: 18, land: false, demand: 300, sector: 'emea' },
    { id: 'arc', name: 'Arktik', lat: 82, lon: 0, r: 10, land: false, demand: 80, sector: 'polar' },
    { id: 'ant', name: 'Antarktika', lat: -80, lon: 0, r: 12, land: true, demand: 20, sector: 'polar' },
  ];
  const SECTORS = { am: 'Amerika', emea: 'Avrupa-Afrika', apac: 'Asya-Pasifik' };
  const ARPU = 25; // $ / abone / hafta (~100 $/ay)
  const GBPS_PER_USER = 0.0035;

  /* ---------------- Roket bilgisi (ekonomi) ---------------- */
  const ROCKET_INFO = {
    f1: { name: 'Falcon 1', research: null, core: 'f1', cores: 1, upper: 1.5 * M, fairing: 0.3 * M, ops: 0.6 * M, site: 'cape',
      cap: { exp: 450, ocean: 330, rtls: 120 }, gto: {}, desc: 'Tek Merlin motorlu deneme roketi. Uydu taşımaz — test uçuşları ve küçük sözleşmeler.' },
    f9: { name: 'Falcon 9', research: 'r_f9', core: 'f9', cores: 1, upper: 8 * M, fairing: 5 * M, ops: 2 * M, site: 'cape',
      cap: { exp: 18500, ocean: 16500, asds: 15600, rtls: 10400 }, gto: { exp: 8300, asds: 5500 }, desc: '9 Merlin 1D. Starlink ağının iş atı.' },
    fh: { name: 'Falcon Heavy', research: 'r_fh', core: 'fh', cores: 3, upper: 10 * M, fairing: 6 * M, ops: 6 * M, site: 'cape39a',
      cap: { exp: 30000, asds: 24700, ocean: 26000 }, capSideExp: 10000, gto: { exp: 18000, asds: 10000 }, desc: '27 Merlin. Ağır yükler, GEO röle uyduları, çift booster inişi.' },
    ss: { name: 'Starship', research: 'r_ss', core: 'ss', cores: 1, upper: 0, fairing: 0, ops: 6 * M, site: 'starbase',
      cap: { exp: 120000, ocean: 105000, catch: 98000 }, capShipReturn: 0.62, gto: { exp: 27000, catch: 21000 }, desc: '33 Raptor. Tamamen yeniden kullanılabilir dev roket.' },
  };
  const CORE_INFO = {
    f1: { name: 'Falcon 1 kademesi', cost: 2.5 * M, weeks: 1, prefix: 'F' },
    f9: { name: 'Falcon 9 booster', cost: 30 * M, weeks: 3, prefix: 'B10' },
    fh: { name: 'Falcon Heavy çekirdeği', cost: 34 * M, weeks: 4, prefix: 'B10' },
    ss: { name: 'Super Heavy booster', cost: 55 * M, weeks: 4, prefix: 'B' },
    ship: { name: 'Ship', cost: 40 * M, weeks: 4, prefix: 'S' },
  };

  /* ---------------- Ar-Ge ağacı ---------------- */
  // req: { success:{f1:2}, landings, splash, catches, shipCatches, sats, research:[...] }
  const RESEARCH = [
    // ROKETLER
    { id: 'r_merlin1d', br: 'rocket', name: 'Merlin 1D motoru', cost: 12 * M, req: { success: { f1: 2 } }, desc: 'Daha güçlü, daha hafif Merlin. Falcon 9 için şart.' },
    { id: 'r_f9', br: 'rocket', name: 'Falcon 9', cost: 40 * M, req: { research: ['r_merlin1d'], success: { f1: 3 } }, desc: '9 motorlu orta sınıf roket. Starlink fırlatmalarını açar.' },
    { id: 'r_fh', br: 'rocket', name: 'Falcon Heavy', cost: 110 * M, req: { research: ['r_f9', 'k_rtls'], success: { f9: 4 } }, desc: '3 çekirdekli ağır roket. LC-39A rampası gerekir.' },
    { id: 'r_raptor', br: 'rocket', name: 'Raptor motoru', cost: 140 * M, req: { research: ['r_f9'], success: { f9: 8 } }, desc: 'Tam akışlı metan motoru. Starship için şart.' },
    { id: 'r_ss', br: 'rocket', name: 'Starship', cost: 220 * M, req: { research: ['r_raptor'], landings: 8 }, desc: 'Dev, tamamen yeniden kullanılabilir roket. Starbase gerekir.' },
    { id: 'r_ss2', br: 'rocket', name: 'Starship V2 (uzatılmış)', cost: 180 * M, req: { research: ['r_ss', 'm_raptor2'], success: { ss: 2 } }, desc: 'Daha uzun tanklar: +%20 yük.' },
    // KURTARMA
    { id: 'k_gridfins', br: 'recovery', name: 'Izgara kanatçıkları', cost: 8 * M, req: { success: { f1: 2 } }, desc: 'Booster atmosfere dönerken yönlendirilebilir. Falcon 1 ile okyanusa kontrollü iniş testi açılır.' },
    { id: 'k_legs', br: 'recovery', name: 'İniş bacakları', cost: 12 * M, req: { research: ['k_gridfins'], splash: 1 }, desc: 'Karbon fiber açılır bacaklar.' },
    { id: 'k_rtls', br: 'recovery', name: 'Rampaya dönüş (LZ-1)', cost: 20 * M, req: { research: ['k_legs'], splash: 2 }, desc: 'Geri dönüş yanışı ile booster fırlatma alanına iner.' },
    { id: 'k_deep', br: 'recovery', name: 'Derin gaz kısma', cost: 10 * M, req: { research: ['k_rtls'], landings: 2 }, desc: 'Merlin %40\'a kadar kısılır: iniş yanışı daha affedici.' },
    { id: 'k_asds', br: 'recovery', name: 'Otonom drone gemi', cost: 30 * M, req: { research: ['k_rtls', 'r_f9'], landings: 1 }, desc: 'Okyanusta iniş: daha çok yük. Tesislerden gemi inşa et.' },
    { id: 'k_fairing', br: 'recovery', name: 'Burun konisi kurtarma', cost: 15 * M, req: { research: ['k_asds'], landings: 3 }, desc: 'Paraşütlü burun konisi + ağlı gemi. Her F9\'da $6 M tasarruf.' },
    { id: 'k_refurb', br: 'recovery', name: 'Hızlı bakım', cost: 25 * M, req: { landings: 5 }, desc: 'Booster bakım süresi ve maliyeti azalır.' },
    { id: 'k_life', br: 'recovery', name: 'Booster ömrü: 20 uçuş', cost: 35 * M, req: { research: ['k_refurb'], landings: 12 }, desc: 'Bir booster 10 yerine 20 kez uçabilir.' },
    { id: 'k_catch', br: 'recovery', name: 'Mechazilla kule yakalama', cost: 90 * M, req: { research: ['r_ss'], success: { ss: 1 } }, desc: 'Super Heavy kuleye döner ve kollarla yakalanır.' },
    { id: 'k_shipcatch', br: 'recovery', name: 'Ship yakalama', cost: 140 * M, req: { research: ['k_catch'], catches: 2 }, desc: 'Ship yörüngeden döner, ısı kalkanıyla süzülür ve 2. kuleye yakalanır.' },
    // MOTOR / GÜVENİLİRLİK
    { id: 'm_mvac', br: 'engine', name: 'MVac nozul uzatması', cost: 18 * M, req: { research: ['r_f9'], success: { f9: 2 } }, desc: 'Üst kademe verimi artar: Falcon yükü +%6.' },
    { id: 'm_block5', br: 'engine', name: 'Block 5', cost: 45 * M, req: { research: ['m_mvac', 'k_asds'], landings: 3 }, desc: 'Yükseltilmiş Merlin, titanyum kanatçıklar: yük +%8, arıza riski azalır.' },
    { id: 'm_rel', br: 'engine', name: 'Motor güvenilirliği', cost: 20 * M, req: { research: ['r_merlin1d'], success: { f1: 3 } }, desc: 'Test standı programı: motor arıza olasılığı yarıya iner.' },
    { id: 'm_raptor2', br: 'engine', name: 'Raptor 2', cost: 90 * M, req: { research: ['r_ss'], success: { ss: 1 } }, desc: 'Daha basit ve güçlü: Starship yükü +%10, arıza azalır.' },
    { id: 'm_raptor3', br: 'engine', name: 'Raptor 3', cost: 140 * M, req: { research: ['m_raptor2'], success: { ss: 4 } }, desc: 'Kalkansız, entegre Raptor: arıza riski minimuma iner.' },
    // UYDULAR
    { id: 'u_v09', br: 'sat', name: 'Starlink v0.9', cost: 20 * M, req: { research: ['r_f9'] }, desc: 'İlk prototip uydular. Uydu fabrikası kurulabilir.' },
    { id: 'u_v10', br: 'sat', name: 'Starlink v1.0', cost: 30 * M, req: { research: ['u_v09'], sats: 120 }, desc: 'Ka bant antenleri: daha çok kapasite.' },
    { id: 'u_v15', br: 'sat', name: 'Starlink v1.5 (lazer)', cost: 55 * M, req: { research: ['u_v10'], sats: 400 }, desc: 'Uydular arası lazer bağlantılar: okyanus ve kutuplara yer istasyonu olmadan hizmet.' },
    { id: 'u_v2m', br: 'sat', name: 'Starlink V2 mini', cost: 110 * M, req: { research: ['u_v15'], sats: 900 }, desc: '4 kat kapasite, daha geniş kapsama.' },
    { id: 'u_v3', br: 'sat', name: 'Starlink V3', cost: 180 * M, req: { research: ['u_v2m', 'r_ss'], sats: 1500 }, desc: 'Dev uydular: sadece Starship taşıyabilir. Muazzam kapasite.' },
    { id: 'u_polar', br: 'sat', name: 'Yüksek eğimli yörüngeler', cost: 25 * M, req: { research: ['u_v10'] }, desc: '70° ve 97.6° kabuklara fırlatma: yüksek enlemler ve kutuplar.' },
    { id: 'u_relay', br: 'sat', name: 'GEO optik röle uydusu', cost: 50 * M, req: { research: ['u_v09'], success: { f9: 3 } }, desc: 'Yer sabit yörüngede röle: bir sektördeki tüm bölgeleri yer istasyonuna bağlar.' },
    // GÖREVLER
    { id: 'g_dragon', br: 'mission', name: 'Kargo Dragon', cost: 50 * M, req: { research: ['r_f9'], success: { f9: 2 } }, desc: 'Uzay istasyonuna kargo sözleşmeleri.' },
    { id: 'g_crew', br: 'mission', name: 'Mürettebatlı Dragon', cost: 80 * M, req: { research: ['g_dragon', 'm_block5'], success: { f9: 6 } }, desc: 'Astronot taşıma sözleşmeleri — yüksek ödül, yüksek risk.' },
    { id: 'g_gto', br: 'mission', name: 'Ticari GTO uyduları', cost: 15 * M, req: { research: ['r_f9'] }, desc: 'Yer sabit transfer yörüngesine ticari uydu sözleşmeleri.' },
  ];
  const RESEARCH_BY_ID = Object.fromEntries(RESEARCH.map(r => [r.id, r]));
  const BRANCHES = { rocket: 'Roketler', recovery: 'Kurtarma', engine: 'Motor & Güvenilirlik', sat: 'Uydular', mission: 'Görevler' };

  /* ---------------- Tesisler ---------------- */
  const FACILITIES = {
    satFab: { name: 'Uydu fabrikası', desc: 'Haftalık uydu üretimi.', levels: [{ cost: 30 * M, rate: 20, up: 0.4 * M }, { cost: 60 * M, rate: 45, up: 0.8 * M }, { cost: 120 * M, rate: 90, up: 1.5 * M }, { cost: 220 * M, rate: 180, up: 2.5 * M }, { cost: 380 * M, rate: 360, up: 4 * M }], research: 'u_v09' },
    rocketFab: { name: 'Roket fabrikası', desc: 'Yeni booster üretim süresi ve maliyeti azalır.', levels: [{ cost: 0, up: 0.3 * M }, { cost: 40 * M, up: 0.6 * M }, { cost: 90 * M, up: 1.0 * M }, { cost: 160 * M, up: 1.6 * M }] },
    refurb: { name: 'Bakım hangarı', desc: 'Kurtarılan boosterların yeniden uçuşa hazırlanması.', levels: [{ cost: 15 * M, up: 0.2 * M }, { cost: 40 * M, up: 0.4 * M }, { cost: 80 * M, up: 0.7 * M }], research: 'k_rtls' },
    cape39a: { name: 'LC-39A rampası', desc: 'Falcon Heavy için şart; haftada +1 fırlatma.', levels: [{ cost: 50 * M, up: 0.5 * M }], research: 'r_fh' },
    starbase: { name: 'Starbase', desc: 'Starship fırlatma kulesi (Mechazilla) ve 2. yakalama kulesi.', levels: [{ cost: 150 * M, up: 1.2 * M }], research: 'r_ss' },
    droneShip: { name: 'Drone gemi', desc: 'Okyanus inişleri için otonom gemi. 2. gemi FH merkez çekirdeği için.', levels: [{ cost: 35 * M, up: 0.3 * M }, { cost: 35 * M, up: 0.3 * M }], research: 'k_asds' },
    fairingShip: { name: 'Burun konisi gemisi', desc: 'Ağlı hızlı gemi: burun konisi yarılarını yakalar.', levels: [{ cost: 12 * M, up: 0.15 * M }], research: 'k_fairing' },
  };
  const GS_COST = 6 * M, GS_UP = 0.15 * M, RELAY_SAT_COST = 25 * M, RELAY_MASS = 4500;

  /* ---------------- Başarımlar ---------------- */
  const ACHIEVEMENTS = [
    { id: 'a_orbit', name: 'İlk yörünge', desc: 'Bir test yükünü yörüngeye ulaştır.' },
    { id: 'a_splash', name: 'Islak iniş', desc: 'Bir boosterı okyanusa kontrollü indir.' },
    { id: 'a_land', name: 'Tarih yazıldı', desc: 'Bir boosterı rampaya indir.' },
    { id: 'a_asds', name: 'Elbette Seni Hâlâ Seviyorum', desc: 'Drone gemiye iniş yap.' },
    { id: 'a_double', name: 'Senkronize iniş', desc: 'Falcon Heavy yan boosterlarını aynı anda indir.' },
    { id: 'a_catch', name: 'Chopstick', desc: 'Super Heavy\'yi kuleyle yakala.' },
    { id: 'a_shipcatch', name: 'Tam yeniden kullanım', desc: 'Ship\'i yörüngeden döndürüp yakala.' },
    { id: 'a_fairing', name: 'Ağa takıldı', desc: 'Bir burun konisi yarısını kurtar.' },
    { id: 'a_veteran', name: 'Emektar', desc: 'Aynı boosterla 10 uçuş yap.' },
    { id: 'a_100', name: 'Takımyıldız', desc: '100 uyduyu yörüngeye yerleştir.' },
    { id: 'a_1000', name: 'Mega takımyıldız', desc: '1000 uydu.' },
    { id: 'a_cov50', name: 'Yarı yol', desc: 'Dünya nüfusunun %50\'sine hizmet ver.' },
    { id: 'a_crew', name: 'İnsanlı uçuş', desc: 'Mürettebatlı Dragon görevini başar.' },
    { id: 'a_engineout', name: 'Motor-arızası toleransı', desc: 'Motor arızasına rağmen yörüngeye ulaş.' },
    { id: 'a_win', name: 'Dünya bağlandı', desc: 'Nüfusun %95\'ine hizmet ver.' },
  ];

  /* ---------------- Rastgele (tohumlu) ---------------- */
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  /* ---------------- Durum ---------------- */
  const SAVE_KEY = 'yorunge-agi-kayit-v2';
  function newState() {
    const st = {
      v: 2, money: 100 * M, week: 1, seed: (Math.random() * 1e9) | 0,
      research: {}, facilities: { rocketFab: 1 },
      stats: { launches: 0, success: { f1: 0, f9: 0, fh: 0, ss: 0 }, landings: 0, splash: 0, catches: 0, shipCatches: 0, fairings: 0, fails: 0 },
      fleet: [], nextSerial: { f1: 1, f9: 19, fh: 1, ss: 7, ship: 20 },
      stock: { sats: 0, gen: 'v09', relays: 0, fairings: 0 },
      shells: { s53: {}, s70: {}, s97: {} }, // gen -> adet
      relays: { am: 0, emea: 0, apac: 0 },
      stations: {}, adoption: {},
      padsUsed: {}, contracts: [], accepted: [], achievements: {}, log: [],
      sel: { rocket: 'f1', payload: 'test', shell: 's53', mode: 'exp', sideMode: 'rtls', contract: null, relaySector: 'am', fairingRec: true, shipReturn: false },
      opts: { autopilot: true, autoLand: false, cinematic: true },
      won: false, lastWeekly: null,
    };
    st.fleet.push(newCore(st, 'f1'));
    st.weather = genWeather(st);
    st.contracts = genContracts(st);
    return st;
  }
  let state = null;
  function load() {
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem(SAVE_KEY);
      const s = raw && JSON.parse(raw);
      if (s && s.v === 2) { state = Object.assign(newState(), s); return state; }
    } catch (e) { /* yok say */ }
    state = newState();
    return state;
  }
  function save() { try { if (typeof localStorage !== 'undefined') localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* yok say */ } }
  function reset() { state = newState(); save(); return state; }
  function log(text, kind) { state.log.unshift({ w: state.week, text, kind: kind || '' }); if (state.log.length > 80) state.log.length = 80; }
  const yearOf = w => 2008 + Math.floor((w - 1) / 52);
  const weekLabel = w => `${yearOf(w)} · Hafta ${((w - 1) % 52) + 1}`;

  /* ---------------- Yardımcılar ---------------- */
  const has = id => !!(state.research[id]);
  const fac = id => state.facilities[id] || 0;
  function totalSats() { let n = 0; for (const s of Object.values(state.shells)) for (const v of Object.values(s)) n += v; return n; }
  function currentGen() { let g = 'v09'; for (const k of GEN_ORDER) if (has(SAT_GENS[k].research)) g = k; return g; }

  function reqStatus(r) {
    const q = r.req || {}, miss = [];
    const st = state.stats;
    for (const id of q.research || []) if (!has(id)) miss.push('Araştırma: ' + RESEARCH_BY_ID[id].name);
    for (const [k, n] of Object.entries(q.success || {})) if ((st.success[k] || 0) < n) miss.push(`${ROCKET_INFO[k].name} başarılı uçuş ${st.success[k] || 0}/${n}`);
    if (q.landings && st.landings < q.landings) miss.push(`Booster inişi ${st.landings}/${q.landings}`);
    if (q.splash && st.splash < q.splash) miss.push(`Okyanus iniş testi ${st.splash}/${q.splash}`);
    if (q.catches && st.catches < q.catches) miss.push(`Kule yakalama ${st.catches}/${q.catches}`);
    if (q.sats && totalSats() < q.sats) miss.push(`Yörüngede uydu ${totalSats()}/${q.sats}`);
    return miss;
  }
  function canResearch(id) {
    const r = RESEARCH_BY_ID[id];
    if (has(id)) return { ok: false, done: true, miss: [] };
    const miss = reqStatus(r);
    return { ok: miss.length === 0 && state.money >= r.cost, miss, money: state.money >= r.cost };
  }
  function doResearch(id) {
    const c = canResearch(id); if (!c.ok) return false;
    const r = RESEARCH_BY_ID[id];
    state.money -= r.cost; state.research[id] = state.week;
    log('Araştırma tamamlandı: ' + r.name, 'good');
    if (id === 'u_v09') state.stock.gen = 'v09';
    save(); return true;
  }

  /* ---------------- Tesisler ---------------- */
  function facilityNext(id) {
    const f = FACILITIES[id], lv = fac(id);
    if (lv >= f.levels.length) return null;
    const ok = !f.research || has(f.research);
    return { level: lv + 1, cost: f.levels[lv].cost, ok: ok && state.money >= f.levels[lv].cost, locked: !ok };
  }
  function buildFacility(id) {
    const n = facilityNext(id); if (!n || !n.ok) return false;
    state.money -= n.cost; state.facilities[id] = n.level;
    log(FACILITIES[id].name + (n.level > 1 ? ' seviye ' + n.level : ' kuruldu'), 'good');
    save(); return true;
  }
  function stockCap() {
    let best = 0;
    for (const [k, I] of Object.entries(ROCKET_INFO)) if (k !== 'f1' && has(I.research)) best = Math.max(best, I.cap.exp * payloadMul(k));
    return Math.max(60, Math.ceil(3 * best / SAT_GENS[currentGen()].mass));
  }
  const satRate = () => (fac('satFab') ? FACILITIES.satFab.levels[fac('satFab') - 1].rate : 0);
  const refurbWeeks = () => Math.max(1, 3 - fac('refurb') + (fac('refurb') ? 0 : 1) - (has('k_refurb') ? 1 : 0));
  const refurbCost = type => (type === 'ss' ? 4 * M : type === 'f1' ? 0.5 * M : 2.5 * M) * (has('k_refurb') ? 0.6 : 1);
  const maxFlights = type => (type === 'f1' ? 5 : has('k_life') ? 20 : 10);

  /* ---------------- Filo ---------------- */
  function newCore(st, type, weeks) {
    const info = CORE_INFO[type];
    const n = st.nextSerial[type]++;
    const id = type === 'ship' ? 'S' + n : type === 'ss' ? 'B' + (n + 10) : type === 'f1' ? 'F1-' + String(n).padStart(2, '0') : 'B' + (1000 + n + (type === 'fh' ? 40 : 0));
    return { id, type, flights: 0, status: weeks ? 'building' : 'ready', weeks: weeks || 0 };
  }
  function coreOrderInfo(type) {
    const lv = fac('rocketFab');
    const info = CORE_INFO[type];
    return { cost: info.cost * (1 - 0.1 * (lv - 1)), weeks: Math.max(1, info.weeks - (lv - 1)) };
  }
  function orderCore(type) {
    const o = coreOrderInfo(type);
    if (state.money < o.cost) return false;
    state.money -= o.cost;
    const c = newCore(state, type, o.weeks);
    state.fleet.push(c);
    log(`${CORE_INFO[type].name} siparişi: ${c.id} (${o.weeks} hafta)`);
    save(); return c;
  }
  const readyCores = type => state.fleet.filter(c => c.type === type && c.status === 'ready').sort((a, b) => b.flights - a.flights);

  /* ---------------- Hava durumu ---------------- */
  function genWeather(st) {
    const R = rng(st.seed + st.week * 7919);
    const mk = (base) => {
      const jet = Math.round(12 + R() * 30 + (R() < 0.22 ? R() * 40 : 0));
      const wind = Math.round((R() * 10 + (R() < 0.2 ? R() * 8 : 0)) * 10) / 10;
      const waves = Math.round((0.5 + R() * 1.8 + (R() < 0.2 ? R() * 2.5 : 0)) * 10) / 10;
      const dirSign = R() < 0.5 ? -1 : 1;
      return { jet, wind, windDir: dirSign, waves, hour: Math.floor(R() * 24), cloud: Math.round(R() * 100), base };
    };
    return { cape: mk('cape'), starbase: mk('starbase') };
  }
  function weatherRisks(w, plan) {
    const r = [];
    if (w.jet > 42) r.push({ level: w.jet > 55 ? 'bad' : 'warn', text: `Üst seviye jet rüzgârı ${w.jet} m/s — Max-Q'da yapısal risk` });
    if (plan && (plan.mode === 'asds' || plan.fhCenter === 'asds') && w.waves > 2.2) r.push({ level: w.waves > 3 ? 'bad' : 'warn', text: `Dalga ${w.waves} m — drone gemi güvertesi çok hareketli` });
    if (plan && plan.fairingRec && w.waves > 2.5) r.push({ level: 'warn', text: 'Dalgalar burun konisi kurtarmayı zorlaştırır' });
    if (w.wind > 9 && plan && (plan.mode !== 'exp' || plan.shipReturn)) r.push({ level: w.wind > 13 ? 'bad' : 'warn', text: `Yer rüzgârı ${w.wind} m/s — iniş/yakalama riski` });
    return r;
  }

  /* ---------------- Sözleşmeler ---------------- */
  const CONTRACT_TYPES = {
    demo: { name: 'Teknoloji gösterimi (test yükü)', rockets: ['f1'], mass: [100, 180], orbit: 'leo', alt: 300000, reward: [14 * M, 19 * M], research: null },
    small: { name: 'Küçük uydu (LEO)', rockets: ['f1', 'f9'], mass: [150, 300], orbit: 'leo', alt: 500000, reward: [12 * M, 17 * M], research: 'r_merlin1d' },
    ride: { name: 'Paylaşımlı fırlatma (rideshare)', rockets: ['f9'], mass: [5000, 9000], orbit: 'leo', alt: 500000, reward: [35 * M, 50 * M], research: 'r_f9' },
    gto: { name: 'Ticari haberleşme uydusu (GTO)', rockets: ['f9', 'fh', 'ss'], mass: [3500, 6500], orbit: 'gto', reward: [70 * M, 110 * M], research: 'g_gto' },
    heavy: { name: 'Ağır askeri uydu (GTO)', rockets: ['fh', 'ss'], mass: [6000, 9500], orbit: 'gto', reward: [140 * M, 180 * M], research: 'r_fh' },
    cargo: { name: 'Kargo Dragon (uzay istasyonu)', rockets: ['f9'], mass: [11500, 12500], orbit: 'iss', alt: 410000, reward: [130 * M, 160 * M], research: 'g_dragon', dragon: true },
    crew: { name: 'Mürettebatlı Dragon (4 astronot)', rockets: ['f9'], mass: [12500, 12900], orbit: 'iss', alt: 410000, reward: [230 * M, 270 * M], research: 'g_crew', dragon: true, crew: true },
  };
  function genContracts(st) {
    const R = rng(st.seed + st.week * 104729);
    const avail = Object.entries(CONTRACT_TYPES).filter(([, t]) => !t.research || st.research[t.research]);
    const out = (st.contracts || []).filter(c => c.expires >= st.week && !c.done);
    let guard = 0;
    while (out.length < 4 && guard++ < 20 && avail.length) {
      const [type, t] = avail[Math.floor(R() * avail.length)];
      if (out.some(c => c.type === type)) continue;
      const mass = Math.round((t.mass[0] + R() * (t.mass[1] - t.mass[0])) / 10) * 10;
      const reward = Math.round((t.reward[0] + R() * (t.reward[1] - t.reward[0])) / 1e5) * 1e5;
      out.push({ id: 'c' + st.week + '_' + type + '_' + Math.floor(R() * 1000), type, name: t.name, mass, reward, expires: st.week + 4 + Math.floor(R() * 5), penalty: Math.round(reward * 0.4 / 1e5) * 1e5 });
    }
    return out;
  }

  /* ---------------- Ağ modeli ---------------- */
  function shellWeight(lat, inc) {
    const a = Math.abs(lat), i = inc > 90 ? 180 - inc : inc;
    if (inc > 90) { // kutup yörüngesi: tüm enlemler, kutuplarda yoğun
      return 0.7 + 0.6 * (a / 90) ** 3;
    }
    if (a > i + 4) return 0;
    if (a > i) return 0.4;
    const s = Math.sin(a * DEG) / Math.sin(i * DEG);
    return clamp(0.65 / Math.sqrt(Math.max(0.08, 1 - s * s)), 0.6, 2.2);
  }
  function network() {
    const out = { regions: [], users: 0, capUsers: 0, revenue: 0, served: 0, demand: 0, laserFrac: 0, sats: totalSats(), capGbps: 0 };
    let laserN = 0, coverMul = 0;
    for (const [sk, sh] of Object.entries(state.shells)) for (const [g, n] of Object.entries(sh)) {
      const G = SAT_GENS[g]; out.capGbps += n * G.cap; if (G.laser) laserN += n; coverMul += n * G.cover;
    }
    out.laserFrac = out.sats ? laserN / out.sats : 0;
    out.capUsers = out.capGbps / GBPS_PER_USER / 1000; // bin abone
    const anyStation = Object.keys(state.stations).length > 0;
    const sectorStation = {};
    for (const rid of Object.keys(state.stations)) { const R = REGIONS.find(x => x.id === rid); if (R) sectorStation[R.sector] = true; }
    let wantUsers = 0;
    for (const R of REGIONS) {
      let eff = 0;
      for (const [sk, sh] of Object.entries(state.shells)) {
        const w = shellWeight(R.lat, SHELLS[sk].inc);
        for (const [g, n] of Object.entries(sh)) eff += n * SAT_GENS[g].cover * w;
      }
      const cov = 1 - Math.exp(-eff / 260);
      let conn = 0, via = 'yok';
      if (state.stations[R.id]) { conn = 1; via = 'yer istasyonu'; }
      else {
        const las = anyStation ? out.laserFrac : 0;
        const rel = (state.relays[R.sector] > 0 && sectorStation[R.sector] && R.sector !== 'polar') ? Math.min(0.85, 0.6 + 0.1 * (state.relays[R.sector] - 1)) : 0;
        conn = Math.max(las, rel);
        via = conn === 0 ? 'bağlantı yok' : las >= rel ? 'lazer röle' : 'GEO röle';
      }
      const served = cov * conn;
      const ad = state.adoption[R.id] || 0;
      const users = R.demand * ad;
      wantUsers += users;
      out.regions.push({ id: R.id, name: R.name, cov, conn, served, via, adoption: ad, users, demand: R.demand, station: !!state.stations[R.id], land: R.land, sector: R.sector, lat: R.lat, lon: R.lon, r: R.r });
      out.demand += R.demand;
      out.served += R.demand * served;
    }
    const capScale = wantUsers > out.capUsers ? out.capUsers / wantUsers : 1;
    out.capLimited = capScale < 1;
    for (const r of out.regions) { r.users *= capScale; out.users += r.users; }
    out.revenue = out.users * 1000 * ARPU;
    out.servedFrac = out.demand ? out.served / out.demand : 0;
    out.userFrac = out.demand ? out.users / out.demand : 0;
    return out;
  }
  function buildStation(rid) {
    const R = REGIONS.find(x => x.id === rid);
    if (!R || !R.land || state.stations[rid] || state.money < GS_COST || !has('u_v09')) return false;
    state.money -= GS_COST; state.stations[rid] = state.week;
    log('Yer istasyonu kuruldu: ' + R.name, 'good'); save(); return true;
  }

  /* ---------------- Fırlatma planı ---------------- */
  function availableModes(rk) {
    const m = ['exp'];
    if (rk === 'f1') { if (has('k_gridfins')) m.push('ocean'); if (has('k_rtls')) m.push('rtls'); }
    if (rk === 'f9') { if (has('k_gridfins')) m.push('ocean'); if (has('k_rtls')) m.push('rtls'); if (has('k_asds') && fac('droneShip') >= 1) m.push('asds'); }
    if (rk === 'fh') { if (has('k_gridfins')) m.push('ocean'); if (has('k_asds') && fac('droneShip') >= 1) m.push('asds'); }
    if (rk === 'ss') { m.push('ocean'); if (has('k_catch')) m.push('catch'); }
    return m;
  }
  function payloadTypes(rk) {
    const t = [];
    if (rk === 'f1') t.push('test');
    if (rk !== 'f1' && has('u_v09')) t.push('starlink');
    if ((rk === 'f9' || rk === 'fh' || rk === 'ss') && has('u_relay')) t.push('relay');
    if (state.accepted.some(c => CONTRACT_TYPES[c.type].rockets.includes(rk))) t.push('contract');
    if (rk !== 'f1' && !t.length) t.push('test');
    return t;
  }
  function payloadMul(rk) {
    let k = 1;
    if (rk !== 'ss') { if (has('m_mvac')) k *= 1.06; if (has('m_block5')) k *= 1.08; }
    if (rk === 'ss') { if (has('m_raptor2')) k *= 1.1; if (has('r_ss2')) k *= 1.2; }
    return k;
  }
  function failChance(rk) {
    let p = { f1: 0.10, f9: 0.035, fh: 0.05, ss: 0.12 }[rk];
    if (has('m_rel')) p *= 0.5;
    if (rk !== 'ss' && has('m_block5')) p *= 0.5;
    if (rk === 'ss') { if (has('m_raptor2')) p *= 0.55; if (has('m_raptor3')) p *= 0.4; }
    return p;
  }
  function plan(sel) {
    sel = Object.assign({}, state.sel, sel || {});
    const rk = sel.rocket, info = ROCKET_INFO[rk];
    const P = { rocket: rk, ok: true, reasons: [], cost: [], total: 0 };
    const unlocked = rk === 'f1' || has(info.research);
    if (!unlocked) { P.ok = false; P.reasons.push(info.name + ' henüz araştırılmadı'); }
    const modes = availableModes(rk);
    P.modes = modes;
    P.mode = modes.includes(sel.mode) ? sel.mode : (modes.includes('asds') ? 'asds' : modes.includes('catch') ? 'catch' : modes[modes.length - 1]);
    const ptypes = payloadTypes(rk); P.ptypes = ptypes;
    P.payload = ptypes.includes(sel.payload) ? sel.payload : ptypes[0];
    P.sideMode = rk === 'fh' ? (has('k_rtls') && sel.sideMode !== 'exp' ? 'rtls' : 'exp') : null;
    // site & pad
    P.site = info.site;
    const padOk = info.site === 'cape' || (info.site === 'cape39a' && fac('cape39a')) || (info.site === 'starbase' && fac('starbase'));
    if (!padOk) { P.ok = false; P.reasons.push(info.site === 'starbase' ? 'Starbase kurulmadı (Tesisler)' : 'LC-39A rampası kurulmadı (Tesisler)'); }
    const padKey = info.site === 'cape' ? (fac('cape39a') && state.padsUsed.cape ? 'cape39a' : 'cape') : info.site;
    if (state.padsUsed[padKey]) { P.ok = false; P.reasons.push('Bu hafta bu rampadan zaten fırlatma yapıldı — haftayı bitir'); }
    P.pad = padKey;
    // çekirdekler
    const need = info.cores;
    const ready = readyCores(info.core);
    P.cores = ready.slice(0, need);
    if (ready.length < need) { P.ok = false; P.reasons.push(`Hazır ${CORE_INFO[info.core].name} yok (${ready.length}/${need}) — Filo sekmesinden sipariş ver`); }
    if (rk === 'ss') {
      const ships = readyCores('ship');
      P.ship = ships[0] || null;
      if (!P.ship) { P.ok = false; P.reasons.push('Hazır Ship yok — Filo sekmesinden sipariş ver'); }
    }
    // yük kapasitesi
    const mul = payloadMul(rk);
    const capKey = rk === 'fh' && P.sideMode === 'exp' && P.mode === 'exp' ? 'exp' : P.mode;
    let leo = (info.cap[capKey] || info.cap.exp) * mul;
    if (rk === 'fh' && P.sideMode === 'exp') leo += info.capSideExp * 0.5;
    P.shipReturn = rk === 'ss' && has('k_shipcatch') && !!sel.shipReturn && P.mode === 'catch';
    if (P.shipReturn) leo *= info.capShipReturn;
    let gto = (info.gto[P.mode] || info.gto.exp || 0) * mul;
    if (P.shipReturn) gto *= info.capShipReturn;
    P.leoCap = leo;
    // yük
    const w = state.weather[info.site === 'starbase' ? 'starbase' : 'cape'];
    P.weather = w;
    let mass = 0, targetAlt = null, targetAp = 0, fairing = true, kind = P.payload, sats = 0, reward = 0, contract = null;
    if (P.payload === 'test') { mass = rk === 'f1' ? 180 : 2000; P.desc = 'Test yükü (kütle simülatörü)'; }
    if (P.payload === 'starlink') {
      const gen = currentGen(); const G = SAT_GENS[gen];
      const shell = sel.shell === 's53' || has('u_polar') ? sel.shell : 's53';
      P.shell = SHELLS[shell] ? shell : 's53';
      const capN = Math.floor(leo * SHELLS[P.shell].factor / G.mass);
      sats = Math.min(capN, state.stock.sats);
      if (gen === 'v3' && rk !== 'ss') { sats = 0; P.reasons.push('V3 uyduları sadece Starship ile taşınabilir'); }
      if (sats <= 0) { P.ok = false; P.reasons.push('Stokta uydu yok — Uydu fabrikası kur ve haftayı bitir'); }
      mass = sats * G.mass; P.gen = gen; P.capN = capN;
      targetAlt = 300000;
      P.desc = `${sats} × ${G.name} → ${SHELLS[P.shell].name}`;
    }
    if (P.payload === 'relay') {
      mass = RELAY_MASS; targetAp = 35786000; P.relaySector = sel.relaySector || 'am';
      if (gto < RELAY_MASS) { P.ok = false; P.reasons.push(`Bu yapılandırma GTO'ya en fazla ${Math.round(gto)} kg taşır (röle ${RELAY_MASS} kg)`); }
      P.cost.push(['GEO röle uydusu', RELAY_SAT_COST]);
      P.desc = 'GEO optik röle uydusu → ' + SECTORS[P.relaySector];
    }
    if (P.payload === 'contract') {
      const list = state.accepted.filter(c => CONTRACT_TYPES[c.type].rockets.includes(rk));
      contract = list.find(c => c.id === sel.contract) || list[0];
      P.contractList = list;
      if (contract) {
        const t = CONTRACT_TYPES[contract.type];
        mass = contract.mass; reward = contract.reward; P.contract = contract;
        if (t.orbit === 'gto') { targetAp = 35786000; if (gto < mass) { P.ok = false; P.reasons.push(`GTO kapasitesi yetersiz (${Math.round(gto)} kg < ${mass} kg) — daha hafif kurtarma modu seç`); } }
        else { targetAlt = t.alt; const c2 = leo * (t.alt > 400000 ? 0.9 : 1); if (c2 < mass) { P.ok = false; P.reasons.push(`Yük kapasitesi yetersiz (${Math.round(c2)} kg < ${mass} kg)`); } }
        if (t.dragon) { fairing = false; kind = 'dragon'; }
        P.desc = `${t.name} — ${mass} kg`;
      }
    }
    if (P.payload === 'test' && rk === 'f1' && leo < mass) mass = Math.max(50, Math.floor(leo));
    P.mass = mass; P.sats = sats; P.targetAlt = targetAlt; P.targetAp = targetAp; P.fairing = fairing && rk !== 'ss'; P.kind = kind; P.reward = reward;
    // maliyet
    for (const c of P.cores) P.cost.push([c.flights ? `${c.id} (uçuş ${c.flights + 1}, yeniden kullanım)` : `${c.id} (yeni booster)`, 0]);
    if (info.upper) P.cost.push(['Üst kademe', info.upper]);
    if (P.fairing && info.fairing) {
      if (state.stock.fairings >= 2 && rk !== 'f1') P.cost.push(['Burun konisi (kurtarılmış)', 0.6 * M]);
      else P.cost.push(['Burun konisi', info.fairing]);
    }
    P.fairingRec = P.fairing && rk !== 'f1' && has('k_fairing') && fac('fairingShip') > 0 && sel.fairingRec !== false;
    if (P.fairingRec) P.cost.push(['Burun konisi gemisi operasyonu', 0.4 * M]);
    P.cost.push(['Fırlatma operasyonları & yakıt', info.ops]);
    if (P.mode === 'asds') P.cost.push(['Drone gemi operasyonu', 1 * M]);
    if (rk === 'ss' && P.ship && !P.ship.flights) P.cost.push([`${P.ship.id} (yeni Ship)`, 0]);
    P.total = P.cost.reduce((a, c) => a + c[1], 0);
    if (state.money < P.total) { P.ok = false; P.reasons.push('Bütçe yetersiz'); }
    P.failChance = failChance(rk) + P.cores.reduce((a, c) => a + c.flights * 0.002, 0);
    P.risks = weatherRisks(w, P);
    P.engineMsg = `Motor arıza olasılığı: %${(P.failChance * 100).toFixed(1)}`;
    return P;
  }

  /* fırlatmayı başlat: para düş, çekirdekleri uçuşa al, sim seçeneklerini üret */
  function commit(P) {
    if (!P.ok) return null;
    const R = rng(state.seed + state.week * 31 + state.stats.launches * 977);
    state.money -= P.total;
    state.stats.launches++;
    state.padsUsed[P.pad] = true;
    for (const c of P.cores) c.status = 'flight';
    if (P.ship) P.ship.status = 'flight';
    if (P.payload === 'starlink') state.stock.sats -= P.sats;
    if (P.fairing && state.stock.fairings >= 2 && P.rocket !== 'f1') state.stock.fairings -= 2;
    let engineFail = null;
    if (R() < P.failChance) {
      const upper = P.rocket !== 'ss' && R() < 0.18;
      engineFail = { t: upper ? 200 + R() * 150 : 15 + R() * 100, part: upper ? 'upper' : 'booster', count: P.rocket === 'ss' ? 1 + Math.floor(R() * 3) : 1 };
    }
    const w = P.weather;
    const ctx = {
      plan: P, week: state.week,
      simOpts: {
        mode: P.mode, sideMode: P.sideMode || 'rtls', payloadMass: P.mass, payloadKind: P.kind, fairing: P.fairing,
        targetAlt: P.targetAlt || undefined, targetAp: P.targetAp || undefined, sats: P.sats,
        shipReturn: P.shipReturn, fairingRec: P.fairingRec, waves: w.waves, wind: { s: w.wind * w.windDir, j: w.jet },
        engineFail, landMinThr: has('k_deep') ? 0.4 : undefined,
        autopilot: state.opts.autopilot, autoLand: state.opts.autoLand,
      },
      hour: w.hour, site: P.site,
      flights: Object.fromEntries(P.cores.map(c => [c.id, c.flights])),
    };
    save();
    return ctx;
  }

  /* sonuçları uygula: özet satırları döndür */
  function applyResult(ctx, r) {
    const P = ctx.plan, st = state.stats, lines = [], ach = [];
    const GRANTS = { a_orbit: 25 * M, a_splash: 10 * M, a_land: 30 * M, a_asds: 25 * M, a_double: 30 * M, a_catch: 60 * M, a_shipcatch: 80 * M, a_100: 20 * M, a_1000: 60 * M, a_crew: 50 * M, a_fairing: 5 * M, a_veteran: 15 * M, a_engineout: 10 * M };
    const award = id => {
      if (state.achievements[id]) return;
      state.achievements[id] = state.week; ach.push(ACHIEVEMENTS.find(a => a.id === id).name);
      if (GRANTS[id]) { state.money += GRANTS[id]; lines.push(['Yatırımcı ödülü: ' + ACHIEVEMENTS.find(a => a.id === id).name, GRANTS[id]]); }
    };
    lines.push(['Fırlatma maliyeti', -P.total]);
    let income = 0;
    if (r.ok) {
      st.success[P.rocket] = (st.success[P.rocket] || 0) + 1;
      award('a_orbit');
      if (r.engineOut) award('a_engineout');
      if (P.payload === 'starlink') {
        const sh = state.shells[P.shell]; sh[P.gen] = (sh[P.gen] || 0) + r.sats;
        lines.push([`${r.sats} uydu yörüngede (${SHELLS[P.shell].name})`, 0]);
        if (totalSats() >= 100) award('a_100');
        if (totalSats() >= 1000) award('a_1000');
      }
      if (P.payload === 'relay') { state.relays[P.relaySector] = (state.relays[P.relaySector] || 0) + 1; lines.push(['GEO röle aktif: ' + SECTORS[P.relaySector], 0]); }
      if (P.payload === 'contract' && P.contract) {
        const rest = P.contract.reward - (P.contract.advance || 0);
        income += rest; lines.push(['Sözleşme ödemesi (avans hariç): ' + P.contract.name, rest]);
        P.contract.done = true; state.accepted = state.accepted.filter(c => c.id !== P.contract.id);
        if (P.contract.type === 'crew') award('a_crew');
      }
      if (P.payload === 'test' && P.rocket === 'f1') { const g = 2.5 * M; income += g; lines.push(['Test verisi / yatırımcı güveni', g]); }
      if (r.partial) lines.push(['Hedef yörüngeye tam ulaşılamadı', 0]);
    } else {
      st.fails++;
      if (P.payload === 'contract' && P.contract) {
        income -= P.contract.penalty; lines.push(['Sözleşme cezası', -P.contract.penalty]);
        state.accepted = state.accepted.filter(c => c.id !== P.contract.id);
      }
      if (P.payload === 'starlink') lines.push([`${P.sats} uydu kaybedildi`, -P.sats * SAT_GENS[P.gen].cost]);
    }
    // çekirdekler
    const cores = P.cores.slice();
    const results = (r.boosters || []).slice();
    const coreRes = [];
    // eşleştir: FH: yanlar L,R + merkez; diğerleri tek
    if (P.rocket === 'fh') {
      const byType = { side: results.filter(b => b.type === 'side'), center: results.filter(b => b.type !== 'side') };
      coreRes.push([cores[0], byType.side[0] || { result: P.sideMode === 'exp' ? 'expended' : 'lost', name: 'Yan Booster L' }]);
      coreRes.push([cores[1], byType.side[1] || { result: P.sideMode === 'exp' ? 'expended' : 'lost', name: 'Yan Booster R' }]);
      coreRes.push([cores[2], byType.center[0] || { result: P.mode === 'exp' ? 'expended' : 'lost', name: 'Merkez Çekirdek' }]);
    } else coreRes.push([cores[0], results[0] || { result: P.mode === 'exp' ? 'expended' : 'lost', name: '1. kademe' }]);
    let landedNow = 0, sidesLanded = 0;
    for (const [core, b] of coreRes) {
      if (!core) continue;
      core.flights++;
      if (b.result === 'landed' || b.result === 'caught') {
        landedNow++;
        if (b.type === 'side') sidesLanded++;
        const rc = refurbCost(core.type);
        if (core.flights >= maxFlights(core.type)) { core.status = 'retired'; lines.push([`${core.id}: indi — ömrünü tamamladı, müzeye`, 0]); }
        else { core.status = 'refurb'; core.weeks = refurbWeeks(); lines.push([`${core.id}: ${b.result === 'caught' ? 'yakalandı' : 'indi'} ✓ (bakım ${core.weeks} hafta)`, -rc]); income -= rc; }
        if (b.result === 'caught') { st.catches++; award('a_catch'); } else { st.landings++; award(b.kind === 'asds' ? 'a_asds' : 'a_land'); }
        if (core.flights >= 10) award('a_veteran');
      } else {
        core.status = 'lost';
        if (b.result === 'splash') { st.splash++; award('a_splash'); lines.push([`${core.id}: okyanusa kontrollü indi (test başarılı), battı`, 0]); }
        else lines.push([`${core.id}: ${b.result === 'expended' ? 'tek kullanımlık' : 'kaybedildi ✗'}`, 0]);
      }
    }
    if (sidesLanded === 2) award('a_double');
    // Ship
    if (P.rocket === 'ss' && P.ship) {
      P.ship.flights++;
      if (r.ship === 'caught') { st.shipCatches++; award('a_shipcatch'); P.ship.status = 'refurb'; P.ship.weeks = refurbWeeks(); lines.push([`${P.ship.id}: yörüngeden döndü ve yakalandı ✓`, -3 * M]); income -= 3 * M; }
      else { P.ship.status = 'lost'; lines.push([`${P.ship.id}: ${P.shipReturn ? 'dönüşte kaybedildi ✗' : 'yörüngede bırakıldı (tek kullanımlık)'}`, 0]); }
    }
    // burun konisi
    const fr = (r.fairings || []).filter(Boolean).length;
    if (fr) { state.stock.fairings += fr; st.fairings += fr; award('a_fairing'); lines.push([`${fr} burun konisi yarısı kurtarıldı`, 0]); }
    state.money += income;
    const net = income - P.total;
    lines.push(['Net', net, 'total']);
    if (ach.length) lines.push(['🏆 Başarım: ' + ach.join(', '), 0, 'ach']);
    log((r.ok ? '✓ ' : '✗ ') + ROCKET_INFO[P.rocket].name + ' — ' + (P.desc || '') + (r.ok ? '' : ' — ' + (r.reason || 'başarısız')), r.ok ? 'good' : 'bad');
    checkWin();
    save();
    return { lines, achievements: ach, net };
  }
  function checkWin() {
    const n = network();
    if (n.userFrac >= 0.5) state.achievements.a_cov50 = state.achievements.a_cov50 || state.week;
    if (n.userFrac >= 0.95 && !state.won) { state.won = true; state.achievements.a_win = state.week; return true; }
    return false;
  }

  /* ---------------- Haftayı bitir ---------------- */
  function endWeek() {
    const rep = { week: state.week, lines: [] };
    // üretim
    const rate = state.prodPaused ? 0 : satRate();
    if (rate) {
      const G = SAT_GENS[currentGen()];
      const n = Math.max(0, Math.min(rate, Math.floor((state.money - 5 * M) / G.cost), stockCap() - state.stock.sats));
      if (n > 0) { state.stock.sats += n; state.money -= n * G.cost; rep.lines.push([`${n} × ${G.name} üretildi`, -n * G.cost]); }
      if (state.stock.gen !== currentGen()) state.stock.gen = currentGen();
    }
    // filo
    for (const c of state.fleet) {
      if ((c.status === 'building' || c.status === 'refurb') && --c.weeks <= 0) { c.status = 'ready'; c.weeks = 0; rep.lines.push([`${c.id} uçuşa hazır`, 0]); }
    }
    state.fleet = state.fleet.filter(c => c.status !== 'lost');
    // gelir
    const pre = network();
    for (const r of pre.regions) { const a = state.adoption[r.id] || 0; state.adoption[r.id] = a + (r.served - a) * 0.3; }
    const net = network();
    if (net.revenue > 0) rep.lines.push([`Abonelik geliri (${(net.users / 1000).toFixed(2)} M abone)`, net.revenue]);
    state.money += net.revenue;
    // giderler
    let up = 0;
    for (const [id, lv] of Object.entries(state.facilities)) { const F = FACILITIES[id]; if (F && lv) up += F.levels[lv - 1].up; }
    up += Object.keys(state.stations).length * GS_UP;
    if (up) { state.money -= up; rep.lines.push(['Tesis bakım giderleri', -up]); }
    // sözleşmeler
    for (const c of state.accepted.slice()) if (c.expires < state.week + 1) { state.money -= c.penalty; rep.lines.push(['Süresi dolan sözleşme cezası: ' + c.name, -c.penalty]); state.accepted = state.accepted.filter(x => x !== c); }
    state.week++;
    state.padsUsed = {};
    state.weather = genWeather(state);
    state.contracts = genContracts(state);
    // iflas koruması
    if (state.money < 8 * M && state.week - (state.lastBridge || -99) >= 4) { state.lastBridge = state.week; state.money += 20 * M; rep.lines.push(['Acil yatırımcı köprü kredisi', 20 * M]); log('Kasa boşaldı — yatırımcılar $20 M köprü kredisi verdi', 'bad'); }
    rep.network = net;
    rep.won = checkWin();
    state.lastWeekly = rep;
    save();
    return rep;
  }
  function acceptContract(id) {
    const c = state.contracts.find(x => x.id === id); if (!c) return false;
    state.contracts = state.contracts.filter(x => x !== c);
    c.advance = Math.round(c.reward * 0.3 / 1e5) * 1e5; state.money += c.advance;
    state.accepted.push(c); log('Sözleşme kabul edildi: ' + c.name + ' (avans ' + (c.advance / M).toFixed(1) + ' M$)', ''); save(); return true;
  }
  function setSel(o) { Object.assign(state.sel, o); save(); }

  global.PROG = {
    M, SAT_GENS, GEN_ORDER, SHELLS, REGIONS, SECTORS, ROCKET_INFO, CORE_INFO, RESEARCH, RESEARCH_BY_ID, BRANCHES, FACILITIES, ACHIEVEMENTS, CONTRACT_TYPES,
    GS_COST, RELAY_SAT_COST,
    get state() { return state; }, load, save, reset, newState, weekLabel, yearOf,
    stockCap, has, fac, totalSats, currentGen, reqStatus, canResearch, doResearch, facilityNext, buildFacility, satRate, refurbWeeks,
    coreOrderInfo, orderCore, readyCores, network, buildStation, availableModes, payloadTypes, plan, commit, applyResult, endWeek,
    acceptContract, setSel, weatherRisks, failChance, maxFlights, log,
  };
})(typeof window !== 'undefined' ? window : globalThis);
