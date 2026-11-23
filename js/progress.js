/* =====================================================================
   İlerleme sistemi (v3): Ar-Ge (süreli, mühendisli), tesisler, haftalık tur,
   booster filosu ve geçmişi, motor/terminal üretimi, uydu kohortları
   (yörünge yükseltme, ömür, uzay çöpü, çarpışma), ağ modeli (bölgeler,
   yer istasyonu seviyeleri, lisanslar, fiyatlandırma, rakipler, gecikme primi),
   sözleşmeler + itibar, hava durumu (fırtına, sis, yağmur), olay kartları,
   FAA soruşturması, halk onayı, rampa hasarı, sigorta, yatırım turları,
   meydan okumalar, istatistik geçmişi, Ay/Mars programı, zorluk, serbest mod.
   Render'dan bağımsız (node ile test edilebilir).
   ===================================================================== */
(function (global) {
  'use strict';
  const M = 1e6;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const DEG = Math.PI / 180;

  /* ---------------- Zorluk ---------------- */
  const DIFFICULTY = {
    easy: { name: 'Kolay', money: 1.6, fail: 0.6, weather: 0.7, reward: 1.15, rival: 0.6, share: 0.5 },
    normal: { name: 'Normal', money: 1, fail: 1, weather: 1, reward: 1, rival: 1, share: 0.5 },
    hard: { name: 'Zor', money: 0.75, fail: 1.4, weather: 1.3, reward: 0.9, rival: 1.4, share: 0.42 },
  };

  /* ---------------- Uydu nesilleri ---------------- */
  const SAT_GENS = {
    v09: { name: 'Starlink v0.9', mass: 227, cap: 10, cover: 0.8, laser: false, cost: 0.6 * M, research: 'u_v09', life: 200, raiseFail: 0.05 },
    v10: { name: 'Starlink v1.0', mass: 260, cap: 18, cover: 1.0, laser: false, cost: 0.5 * M, research: 'u_v10', life: 260, raiseFail: 0.03 },
    v15: { name: 'Starlink v1.5', mass: 306, cap: 22, cover: 1.0, laser: true, cost: 0.55 * M, research: 'u_v15', life: 260, raiseFail: 0.02 },
    v2m: { name: 'Starlink V2 mini', mass: 800, cap: 96, cover: 1.5, laser: true, cost: 0.8 * M, research: 'u_v2m', life: 300, raiseFail: 0.015 },
    v3: { name: 'Starlink V3', mass: 1900, cap: 600, cover: 2.2, laser: true, cost: 1.4 * M, research: 'u_v3', life: 340, raiseFail: 0.01 },
  };
  const GEN_ORDER = ['v09', 'v10', 'v15', 'v2m', 'v3'];

  /* ---------------- Yörünge kabukları ---------------- */
  const SHELLS = {
    s53: { name: '53° kabuk (orta enlemler)', inc: 53, factor: 1.0 },
    s70: { name: '70° kabuk (yüksek enlemler)', inc: 70, factor: 0.92 },
    s97: { name: '97.6° kutup kabuğu', inc: 97.6, factor: 0.82 },
  };

  /* ---------------- Bölgeler ---------------- */
  // lic: lisans gereksinimi { cost, weeks } — yoksa serbest
  const REGIONS = [
    { id: 'na', name: 'Kuzey Amerika', lat: 40, lon: -100, r: 22, land: true, demand: 3000, sector: 'am' },
    { id: 'ca', name: 'Kanada & Alaska', lat: 62, lon: -125, r: 16, land: true, demand: 300, sector: 'am' },
    { id: 'cam', name: 'Orta Amerika & Karayipler', lat: 15, lon: -85, r: 12, land: true, demand: 600, sector: 'am', lic: { cost: 4 * M, weeks: 2 } },
    { id: 'sa', name: 'Güney Amerika', lat: -15, lon: -60, r: 20, land: true, demand: 1500, sector: 'am', lic: { cost: 8 * M, weeks: 3 } },
    { id: 'eu', name: 'Avrupa', lat: 50, lon: 12, r: 15, land: true, demand: 2500, sector: 'emea', lic: { cost: 12 * M, weeks: 3 } },
    { id: 'tr', name: 'Türkiye & Orta Doğu', lat: 35, lon: 40, r: 13, land: true, demand: 1200, sector: 'emea', lic: { cost: 10 * M, weeks: 4 } },
    { id: 'af', name: 'Afrika', lat: 3, lon: 20, r: 24, land: true, demand: 1500, sector: 'emea', lic: { cost: 6 * M, weeks: 2 } },
    { id: 'ru', name: 'Rusya & Sibirya', lat: 60, lon: 90, r: 22, land: true, demand: 600, sector: 'apac', lic: { cost: 45 * M, weeks: 12 } },
    { id: 'sas', name: 'Güney Asya', lat: 22, lon: 80, r: 13, land: true, demand: 2000, sector: 'apac', lic: { cost: 18 * M, weeks: 6 } },
    { id: 'eas', name: 'Doğu Asya', lat: 35, lon: 115, r: 15, land: true, demand: 1500, sector: 'apac', lic: { cost: 35 * M, weeks: 10 } },
    { id: 'sea', name: 'Güneydoğu Asya', lat: 5, lon: 110, r: 14, land: true, demand: 1200, sector: 'apac', lic: { cost: 8 * M, weeks: 3 } },
    { id: 'oc', name: 'Avustralya & Okyanusya', lat: -25, lon: 135, r: 17, land: true, demand: 800, sector: 'apac', lic: { cost: 5 * M, weeks: 2 } },
    { id: 'atl', name: 'Atlantik (deniz & havacılık)', lat: 20, lon: -40, r: 20, land: false, demand: 500, sector: 'am', arpu: 3 },
    { id: 'pac', name: 'Pasifik (deniz & havacılık)', lat: 0, lon: -150, r: 26, land: false, demand: 600, sector: 'apac', arpu: 3 },
    { id: 'ind', name: 'Hint Okyanusu', lat: -20, lon: 75, r: 18, land: false, demand: 300, sector: 'emea', arpu: 3 },
    { id: 'arc', name: 'Arktik', lat: 82, lon: 0, r: 10, land: false, demand: 80, sector: 'polar', arpu: 4 },
    { id: 'ant', name: 'Antarktika', lat: -80, lon: 0, r: 12, land: true, demand: 20, sector: 'polar', arpu: 5 },
  ];
  const REGION_BY_ID = Object.fromEntries(REGIONS.map(r => [r.id, r]));
  const SECTORS = { am: 'Amerika', emea: 'Avrupa-Afrika', apac: 'Asya-Pasifik' };
  const ARPU = 25; // $ / abone / hafta (~100 $/ay)
  const GBPS_PER_USER = 0.0035;
  const PRICES = { low: { name: 'Düşük', mul: 0.7, elast: 1.18 }, normal: { name: 'Normal', mul: 1, elast: 1 }, premium: { name: 'Premium', mul: 1.45, elast: 0.68 } };
  const STATION_CAP = [0, 300, 1000, 3500]; // bin abone / istasyon seviyesi
  const STATION_UP_COST = [0, 6 * M, 14 * M, 30 * M];

  /* ---------------- Roket bilgisi (ekonomi) ---------------- */
  const ROCKET_INFO = {
    f1: { name: 'Falcon 1', research: null, core: 'f1', cores: 1, upper: 1.5 * M, fairing: 0.3 * M, ops: 0.6 * M, site: 'cape', family: 'f1',
      cap: { exp: 450, ocean: 330, rtls: 120 }, gto: {}, desc: 'Tek Merlin motorlu deneme roketi. Uydu taşımaz — test uçuşları ve küçük sözleşmeler.' },
    f9: { name: 'Falcon 9', research: 'r_f9', core: 'f9', cores: 1, upper: 8 * M, fairing: 5 * M, ops: 2 * M, site: 'cape', family: 'falcon',
      cap: { exp: 18500, ocean: 16500, asds: 15600, rtls: 10400 }, gto: { exp: 8300, asds: 5500 }, desc: '9 Merlin 1D. Starlink ağının iş atı.' },
    fh: { name: 'Falcon Heavy', research: 'r_fh', core: 'fh', cores: 3, upper: 10 * M, fairing: 6 * M, ops: 6 * M, site: 'cape39a', family: 'falcon',
      cap: { exp: 30000, asds: 24700, ocean: 26000 }, capSideExp: 10000, gto: { exp: 18000, asds: 10000 }, desc: '27 Merlin. Ağır yükler, GEO röle uyduları, çift booster inişi.' },
    ss: { name: 'Starship', research: 'r_ss', core: 'ss', cores: 1, upper: 0, fairing: 0, ops: 6 * M, site: 'starbase', family: 'ss',
      cap: { exp: 120000, ocean: 105000, catch: 98000 }, capShipReturn: 0.62, gto: { exp: 27000, catch: 21000 }, desc: '33 Raptor. Tamamen yeniden kullanılabilir dev roket.' },
  };
  const CORE_INFO = {
    f1: { name: 'Falcon 1 kademesi', cost: 2.5 * M, weeks: 1, engines: { merlin: 1 } },
    f9: { name: 'Falcon 9 booster', cost: 30 * M, weeks: 3, engines: { merlin: 9 } },
    fh: { name: 'Falcon Heavy çekirdeği', cost: 34 * M, weeks: 4, engines: { merlin: 9 } },
    ss: { name: 'Super Heavy booster', cost: 55 * M, weeks: 4, engines: { raptor: 33 } },
    ship: { name: 'Ship', cost: 40 * M, weeks: 4, engines: { raptor: 6 } },
  };
  const UPPER_ENGINES = { f1: { merlin: 1 }, f9: { merlin: 1 }, fh: { merlin: 1 }, ss: {} };

  /* ---------------- Ar-Ge ağacı ---------------- */
  const RESEARCH = [
    // ROKETLER
    { id: 'r_merlin1d', br: 'rocket', name: 'Merlin 1D motoru', cost: 12 * M, req: { success: { f1: 2 } }, desc: 'Daha güçlü, daha hafif Merlin. Falcon 9 için şart.' },
    { id: 'r_f9', br: 'rocket', name: 'Falcon 9', cost: 40 * M, req: { research: ['r_merlin1d'], success: { f1: 3 } }, desc: '9 motorlu orta sınıf roket. Starlink fırlatmalarını açar.' },
    { id: 'r_fh', br: 'rocket', name: 'Falcon Heavy', cost: 110 * M, req: { research: ['r_f9', 'k_rtls'], success: { f9: 4 } }, desc: '3 çekirdekli ağır roket. LC-39A rampası gerekir.' },
    { id: 'r_raptor', br: 'rocket', name: 'Raptor motoru', cost: 140 * M, req: { research: ['r_f9'], success: { f9: 8 } }, desc: 'Tam akışlı metan motoru. Starship için şart; motor fabrikasında Raptor hattı açılır.' },
    { id: 'r_ss', br: 'rocket', name: 'Starship', cost: 220 * M, req: { research: ['r_raptor'], landings: 8 }, desc: 'Dev, tamamen yeniden kullanılabilir roket. Starbase gerekir.' },
    { id: 'r_ss2', br: 'rocket', name: 'Starship V2 (uzatılmış)', cost: 180 * M, req: { research: ['r_ss', 'm_raptor2'], success: { ss: 2 } }, desc: 'Daha uzun tanklar: +%20 yük.' },
    { id: 'r_deluge', br: 'rocket', name: 'Su püskürtmeli çelik plaka', cost: 35 * M, req: { research: ['r_ss'] }, desc: 'Starship kalkışında rampa hasarını önler.' },
    { id: 'r_safety', br: 'rocket', name: 'Uçuş güvenliği analiz merkezi', cost: 30 * M, req: { research: ['r_f9'], success: { f9: 3 } }, desc: 'Kaza soruşturmaları (FAA) 1 haftaya iner.' },
    // KURTARMA
    { id: 'k_gridfins', br: 'recovery', name: 'Izgara kanatçıkları', cost: 8 * M, req: { success: { f1: 2 } }, desc: 'Booster atmosfere dönerken yönlendirilebilir. Falcon 1 ile okyanusa kontrollü iniş testi açılır.' },
    { id: 'k_legs', br: 'recovery', name: 'İniş bacakları', cost: 12 * M, req: { research: ['k_gridfins'], splash: 1 }, desc: 'Karbon fiber açılır bacaklar.' },
    { id: 'k_rtls', br: 'recovery', name: 'Rampaya dönüş (LZ-1)', cost: 20 * M, req: { research: ['k_legs'], splash: 2 }, desc: 'Geri dönüş yanışı ile booster fırlatma alanına iner.' },
    { id: 'k_deep', br: 'recovery', name: 'Derin gaz kısma', cost: 10 * M, req: { research: ['k_rtls'], landings: 2 }, desc: 'Merlin %40\'a kadar kısılır: iniş yanışı daha affedici.' },
    { id: 'k_asds', br: 'recovery', name: 'Otonom drone gemi', cost: 30 * M, req: { research: ['k_rtls', 'r_f9'], landings: 1 }, desc: 'Okyanusta iniş: daha çok yük. Tesislerden gemi inşa et.' },
    { id: 'k_octa', br: 'recovery', name: 'Octagrabber robotu', cost: 12 * M, req: { research: ['k_asds'], landings: 4 }, desc: 'Drone gemide boosterı güverteye sabitler: sert dalgada devrilme riski %80 azalır.' },
    { id: 'k_fairing', br: 'recovery', name: 'Burun konisi kurtarma', cost: 15 * M, req: { research: ['k_asds'], landings: 3 }, desc: 'Paraşütlü burun konisi + ağlı gemi. Her F9\'da $6 M tasarruf.' },
    { id: 'k_refurb', br: 'recovery', name: 'Hızlı bakım', cost: 25 * M, req: { landings: 5 }, desc: 'Booster bakım süresi ve maliyeti azalır.' },
    { id: 'k_life', br: 'recovery', name: 'Booster ömrü: 20 uçuş', cost: 35 * M, req: { research: ['k_refurb'], landings: 12 }, desc: 'Bir booster 10 yerine 20 kez uçabilir.' },
    { id: 'k_catch', br: 'recovery', name: 'Mechazilla kule yakalama', cost: 90 * M, req: { research: ['r_ss'], success: { ss: 1 } }, desc: 'Super Heavy kuleye döner ve kollarla yakalanır.' },
    { id: 'k_shipcatch', br: 'recovery', name: 'Ship yakalama', cost: 140 * M, req: { research: ['k_catch'], catches: 2 }, desc: 'Ship yörüngeden döner, ısı kalkanıyla süzülür ve 2. kuleye yakalanır.' },
    { id: 'k_tiles', br: 'recovery', name: 'Gelişmiş ısı kalkanı karoları', cost: 60 * M, req: { research: ['k_shipcatch'] }, desc: 'Karo kaybı ve yanma riski büyük ölçüde azalır, Ship bakımı kısalır.' },
    // MOTOR / GÜVENİLİRLİK
    { id: 'm_mvac', br: 'engine', name: 'MVac nozul uzatması', cost: 18 * M, req: { research: ['r_f9'], success: { f9: 2 } }, desc: 'Üst kademe verimi artar: Falcon yükü +%6.' },
    { id: 'm_block5', br: 'engine', name: 'Block 5', cost: 45 * M, req: { research: ['m_mvac', 'k_asds'], landings: 3 }, desc: 'Yükseltilmiş Merlin, titanyum kanatçıklar: yük +%8, arıza riski azalır.' },
    { id: 'm_rel', br: 'engine', name: 'Motor güvenilirliği', cost: 20 * M, req: { research: ['r_merlin1d'], success: { f1: 3 } }, desc: 'Test standı programı: motor arıza olasılığı yarıya iner.' },
    { id: 'm_raptor2', br: 'engine', name: 'Raptor 2', cost: 90 * M, req: { research: ['r_ss'], success: { ss: 1 } }, desc: 'Daha basit ve güçlü: Starship yükü +%10, arıza azalır.' },
    { id: 'm_raptor3', br: 'engine', name: 'Raptor 3', cost: 140 * M, req: { research: ['m_raptor2'], success: { ss: 4 } }, desc: 'Kalkansız, entegre Raptor: arıza riski minimuma iner.' },
    // UYDULAR
    { id: 'u_v09', br: 'sat', name: 'Starlink v0.9', cost: 20 * M, req: { research: ['r_f9'] }, desc: 'İlk prototip uydular. Uydu ve terminal fabrikası kurulabilir.' },
    { id: 'u_v10', br: 'sat', name: 'Starlink v1.0', cost: 30 * M, req: { research: ['u_v09'], sats: 120 }, desc: 'Ka bant antenleri: daha çok kapasite, daha uzun ömür.' },
    { id: 'u_v15', br: 'sat', name: 'Starlink v1.5 (lazer)', cost: 55 * M, req: { research: ['u_v10'], sats: 400 }, desc: 'Uydular arası lazer bağlantılar: okyanus ve kutuplara yer istasyonu olmadan hizmet, düşük gecikme primi.' },
    { id: 'u_v2m', br: 'sat', name: 'Starlink V2 mini', cost: 110 * M, req: { research: ['u_v15'], sats: 900 }, desc: '4 kat kapasite, daha geniş kapsama.' },
    { id: 'u_v3', br: 'sat', name: 'Starlink V3', cost: 180 * M, req: { research: ['u_v2m', 'r_ss'], sats: 1500 }, desc: 'Dev uydular: sadece Starship taşıyabilir. Muazzam kapasite.' },
    { id: 'u_polar', br: 'sat', name: 'Yüksek eğimli yörüngeler', cost: 25 * M, req: { research: ['u_v10'] }, desc: '70° ve 97.6° kabuklara fırlatma: yüksek enlemler ve kutuplar.' },
    { id: 'u_relay', br: 'sat', name: 'GEO optik röle uydusu', cost: 50 * M, req: { research: ['u_v09'], success: { f9: 3 } }, desc: 'Yer sabit yörüngede röle: bir sektördeki tüm bölgeleri yer istasyonuna bağlar.' },
    { id: 'u_avoid', br: 'sat', name: 'Otonom çarpışmadan kaçınma', cost: 40 * M, req: { research: ['u_v10'], sats: 300 }, desc: 'Uydular enkazdan kendiliğinden kaçar: çarpışma riski %80 azalır.' },
    { id: 'u_terminal2', br: 'sat', name: 'Düz panel terminal (Gen 2)', cost: 30 * M, req: { research: ['u_v10'] }, desc: 'Terminal üretimi 2 katına çıkar, maliyet düşer.' },
    // GÖREVLER
    { id: 'g_dragon', br: 'mission', name: 'Kargo Dragon', cost: 50 * M, req: { research: ['r_f9'], success: { f9: 2 } }, desc: 'Uzay istasyonuna kargo sözleşmeleri.' },
    { id: 'g_crew', br: 'mission', name: 'Mürettebatlı Dragon', cost: 80 * M, req: { research: ['g_dragon', 'm_block5'], success: { f9: 6 } }, desc: 'Astronot taşıma sözleşmeleri — yüksek ödül, yüksek risk.' },
    { id: 'g_gto', br: 'mission', name: 'Ticari GTO uyduları', cost: 15 * M, req: { research: ['r_f9'] }, desc: 'Yer sabit transfer yörüngesine ticari uydu sözleşmeleri.' },
    { id: 'g_military', br: 'mission', name: 'Askeri iletişim paketi', cost: 40 * M, req: { research: ['u_v15'], sats: 600 }, desc: 'Starshield benzeri devlet müşterisi: haftalık sabit gelir.' },
    // UZAY PROGRAMI
    { id: 'p_refuel', br: 'space', name: 'Yörüngede yakıt aktarımı', cost: 160 * M, req: { research: ['k_catch'], success: { ss: 3 } }, desc: 'Tanker Starship\'lerle yörüngedeki depoya yakıt taşınır.' },
    { id: 'p_hls', br: 'space', name: 'Ay iniş gemisi (HLS)', cost: 220 * M, req: { research: ['p_refuel'] }, desc: 'Depo yakıtıyla Ay\'a iniş görevi (400 t yakıt gerekir).' },
    { id: 'p_mars', br: 'space', name: 'Mars taşıma sistemi', cost: 400 * M, req: { research: ['p_hls'], moon: 1 }, desc: 'Mars fırlatma pencerelerinde Mars\'a iniş (800 t yakıt).' },
  ];
  const RESEARCH_BY_ID = Object.fromEntries(RESEARCH.map(r => [r.id, r]));
  const BRANCHES = { rocket: 'Roketler', recovery: 'Kurtarma', engine: 'Motor & Güvenilirlik', sat: 'Uydular', mission: 'Görevler', space: 'Uzay programı' };

  /* ---------------- Tesisler ---------------- */
  const FACILITIES = {
    satFab: { name: 'Uydu fabrikası', desc: 'Haftalık uydu üretimi.', levels: [{ cost: 30 * M, rate: 20, up: 0.4 * M }, { cost: 60 * M, rate: 45, up: 0.8 * M }, { cost: 120 * M, rate: 90, up: 1.5 * M }, { cost: 220 * M, rate: 180, up: 2.5 * M }, { cost: 380 * M, rate: 360, up: 4 * M }], research: 'u_v09' },
    rocketFab: { name: 'Roket fabrikası', desc: 'Yeni booster üretim süresi ve maliyeti azalır.', levels: [{ cost: 0, up: 0.3 * M }, { cost: 40 * M, up: 0.6 * M }, { cost: 90 * M, up: 1.0 * M }, { cost: 160 * M, up: 1.6 * M }] },
    engineFab: { name: 'Motor fabrikası', desc: 'Haftalık Merlin (ve Raptor araştırıldıysa Raptor) üretimi.', levels: [{ cost: 20 * M, merlin: 14, raptor: 12, up: 0.3 * M }, { cost: 50 * M, merlin: 28, raptor: 30, up: 0.6 * M }, { cost: 110 * M, merlin: 50, raptor: 70, up: 1.1 * M }] },
    terminalFab: { name: 'Terminal fabrikası', desc: 'Abone terminali (anten) üretimi — yeni abone sayısını sınırlar.', levels: [{ cost: 15 * M, rate: 60, up: 0.3 * M }, { cost: 45 * M, rate: 180, up: 0.7 * M }, { cost: 110 * M, rate: 500, up: 1.4 * M }, { cost: 220 * M, rate: 1300, up: 2.5 * M }], research: 'u_v09' },
    refurb: { name: 'Bakım hangarı', desc: 'Kurtarılan boosterların yeniden uçuşa hazırlanması.', levels: [{ cost: 15 * M, up: 0.2 * M }, { cost: 40 * M, up: 0.4 * M }, { cost: 80 * M, up: 0.7 * M }], research: 'k_rtls' },
    cape39a: { name: 'LC-39A rampası', desc: 'Falcon Heavy için şart; haftada +1 fırlatma.', levels: [{ cost: 50 * M, up: 0.5 * M }], research: 'r_fh' },
    starbase: { name: 'Starbase', desc: 'Starship fırlatma kulesi (Mechazilla) ve 2. yakalama kulesi.', levels: [{ cost: 150 * M, up: 1.2 * M }], research: 'r_ss' },
    droneShip: { name: 'Drone gemi', desc: 'Okyanus inişleri için otonom gemi. 2. gemi FH merkez çekirdeği için.', levels: [{ cost: 35 * M, up: 0.3 * M }, { cost: 35 * M, up: 0.3 * M }], research: 'k_asds' },
    fairingShip: { name: 'Burun konisi gemisi', desc: 'Ağlı hızlı gemi: burun konisi yarılarını yakalar.', levels: [{ cost: 12 * M, up: 0.15 * M }], research: 'k_fairing' },
  };
  const GS_COST = 6 * M, GS_UP = 0.15 * M, RELAY_SAT_COST = 25 * M, RELAY_MASS = 4500;
  const ENGINEER_SALARY = 0.02 * M, ENGINEER_HIRE = 0.1 * M;

  /* ---------------- Rakipler ---------------- */
  const RIVALS = [
    { id: 'ow', name: 'KutupNet (OneWeb benzeri)', start: 35, growth: 9, inc: 87, color: '#c084fc', priceMul: 1.1 },
    { id: 'kp', name: 'BulutDevi (Kuiper benzeri)', start: 90, growth: 22, inc: 51, color: '#fb923c', priceMul: 0.9 },
  ];

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
    { id: 'a_manual', name: 'Pilot', desc: 'Elle iniş modunda bir boosterı indir.' },
    { id: 'a_ipo', name: 'Gong çaldı', desc: 'Halka arz ol.' },
    { id: 'a_moon', name: 'Ay\'a dönüş', desc: 'Ay\'a iniş yap.' },
    { id: 'a_mars', name: 'Kızıl gezegen', desc: 'Mars\'a iniş yap.' },
    { id: 'a_clean', name: 'Temiz yörünge', desc: '20 üst kademeyi yörüngeden indir.' },
    { id: 'a_win', name: 'Dünya bağlandı', desc: 'Nüfusun %95\'ini kapsa ve dünya nüfusunun yarısını abone yap.' },
  ];
  const GRANTS = { a_orbit: 25 * M, a_splash: 10 * M, a_land: 30 * M, a_asds: 25 * M, a_double: 30 * M, a_catch: 60 * M, a_shipcatch: 80 * M, a_100: 20 * M, a_1000: 60 * M, a_crew: 50 * M, a_fairing: 5 * M, a_veteran: 15 * M, a_engineout: 10 * M, a_manual: 8 * M, a_moon: 300 * M, a_mars: 800 * M, a_clean: 10 * M };

  /* ---------------- Yatırım turları ---------------- */
  const FUNDING = [
    { id: 'seriA', name: 'Seri A', share: 0.15, req: s => s.stats.success.f1 >= 2, reqText: '2 başarılı Falcon 1 uçuşu', base: 45 * M },
    { id: 'seriB', name: 'Seri B', share: 0.12, req: s => (s.stats.success.f9 || 0) >= 3, reqText: '3 başarılı Falcon 9 uçuşu', base: 140 * M },
    { id: 'seriC', name: 'Seri C', share: 0.10, req: () => totalSats() >= 500, reqText: 'Yörüngede 500 uydu', base: 400 * M },
    { id: 'ipo', name: 'Halka arz (IPO)', share: 0.18, req: () => network().users >= 2000, reqText: '2 milyon abone', base: 1500 * M },
  ];

  /* ---------------- Rastgele (tohumlu) ---------------- */
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  let RR = rng(12345);

  /* ---------------- Durum ---------------- */
  const SAVE_KEY = 'yorunge-agi-kayit-v3';
  const OLD_KEY = 'yorunge-agi-kayit-v2';
  function newState(diff) {
    diff = DIFFICULTY[diff] ? diff : 'normal';
    const st = {
      v: 3, difficulty: diff, money: 100 * M * DIFFICULTY[diff].money, week: 1, seed: (Math.random() * 1e9) | 0,
      research: {}, rqueue: [], engineers: 20,
      facilities: { rocketFab: 1 },
      stats: { launches: 0, success: { f1: 0, f9: 0, fh: 0, ss: 0 }, landings: 0, splash: 0, catches: 0, shipCatches: 0, fairings: 0, fails: 0, manual: 0, deorbited: 0, collisions: 0, moon: 0, mars: 0, tankers: 0 },
      fleet: [], nextSerial: { f1: 1, f9: 19, fh: 1, ss: 7, ship: 20 },
      stock: { sats: 0, gen: 'v09', fairings: 0, terminals: 0, merlin: 3, raptor: 0 },
      cohorts: [], shells: { s53: {}, s70: {}, s97: {} }, debris: { s53: 0, s70: 0, s97: 0 },
      relays: { am: 0, emea: 0, apac: 0 },
      stations: {}, licenses: {}, prices: {}, adoption: {}, rivalShare: {},
      rivals: RIVALS.map(r => ({ id: r.id, sats: 0 })),
      reputation: 50, community: 80, faaBan: {}, padDown: {}, depot: 0,
      ownership: 1, funding: {}, refurbPolicy: 'normal', military: false,
      padsUsed: {}, contracts: [], accepted: [], achievements: {}, log: [], history: [],
      challenge: null, pendingEvent: null, eventCooldown: 0,
      sel: { rocket: 'f1', payload: 'test', shell: 's53', mode: 'exp', sideMode: 'rtls', contract: null, relaySector: 'am', fairingRec: true, shipReturn: false, deorbitUpper: true, rideshare: false, insure: false, manualLanding: false },
      opts: { autopilot: true, autoLand: false, cinematic: true, quality: 'high', muted: false, voice: true, broadcast: true, tutorial: true },
      tutorial: { step: 0, done: false },
      won: false, lastWeekly: null,
    };
    st.fleet.push(newCore(st, 'f1'));
    st.weather = genWeather(st);
    st.contracts = genContracts(st);
    st.challenge = genChallenge(st);
    return st;
  }
  let state = null;
  // v2 → v3 dönüşümü
  function migrate(s) {
    const n = newState(s.difficulty || 'normal');
    const out = Object.assign(n, s);
    out.v = 3;
    out.stats = Object.assign(n.stats, s.stats || {});
    out.stock = Object.assign({ fairings: 0, terminals: 0, merlin: 3, raptor: 0 }, s.stock || {});
    if (!s.cohorts) {
      out.cohorts = [];
      for (const [sk, sh] of Object.entries(s.shells || {})) for (const [g, k] of Object.entries(sh)) if (k > 0) out.cohorts.push({ shell: sk, gen: g, n: k, week: Math.max(1, (s.week || 1) - 20), raiseUntil: 0 });
    }
    for (const [rid, v] of Object.entries(out.stations || {})) if (typeof v !== 'number' || v > 3) out.stations[rid] = 1;
    // v2 oyuncusunun istasyon kurduğu bölgelere lisans ver
    for (const rid of Object.keys(out.stations || {})) out.licenses[rid] = 'ok';
    out.opts = Object.assign(n.opts, s.opts || {});
    out.sel = Object.assign(n.sel, s.sel || {});
    for (const c of out.fleet) if (!c.history) c.history = [];
    recomputeShells(out);
    return out;
  }
  function load() {
    try {
      if (typeof localStorage !== 'undefined') {
        let raw = localStorage.getItem(SAVE_KEY);
        let s = raw && JSON.parse(raw);
        if (!s) { raw = localStorage.getItem(OLD_KEY); s = raw && JSON.parse(raw); }
        if (s && (s.v === 2 || s.v === 3) && typeof s.money === 'number') { state = migrate(s); RR = rng(state.seed + state.week); return state; }
      }
    } catch (e) { /* yok say */ }
    state = newState();
    RR = rng(state.seed);
    return state;
  }
  function save() { try { if (typeof localStorage !== 'undefined') localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* yok say */ } }
  function reset(diff) { state = newState(diff); RR = rng(state.seed); save(); return state; }
  function importState(text) {
    try { const s = typeof text === 'string' ? JSON.parse(text) : text; if (!s || (s.v !== 2 && s.v !== 3) || typeof s.money !== 'number') return false; state = migrate(s); save(); return true; } catch (e) { return false; }
  }
  function log(text, kind) { state.log.unshift({ w: state.week, text, kind: kind || '' }); if (state.log.length > 120) state.log.length = 120; }
  const yearOf = w => 2008 + Math.floor((w - 1) / 52);
  const weekLabel = w => `${yearOf(w)} · Hafta ${((w - 1) % 52) + 1}`;
  const D = () => DIFFICULTY[state.difficulty] || DIFFICULTY.normal;

  /* ---------------- Yardımcılar ---------------- */
  const has = id => !!(state.research[id]);
  const fac = id => state.facilities[id] || 0;
  function recomputeShells(st) {
    st = st || state;
    const sh = { s53: {}, s70: {}, s97: {} };
    for (const c of st.cohorts) if (!c.raiseUntil || c.raiseUntil <= st.week) sh[c.shell][c.gen] = (sh[c.shell][c.gen] || 0) + c.n;
    st.shells = sh;
  }
  function totalSats() { let n = 0; for (const s of Object.values(state.shells)) for (const v of Object.values(s)) n += v; return n; }
  function raisingSats() { return state.cohorts.filter(c => c.raiseUntil > state.week).reduce((a, c) => a + c.n, 0); }
  function currentGen() { let g = 'v09'; for (const k of GEN_ORDER) if (has(SAT_GENS[k].research)) g = k; return g; }

  function reqStatus(r) {
    const q = r.req || {}, miss = [];
    const st = state.stats;
    for (const id of q.research || []) if (!has(id)) miss.push('Araştırma: ' + RESEARCH_BY_ID[id].name);
    for (const [k, n] of Object.entries(q.success || {})) if ((st.success[k] || 0) < n) miss.push(`${ROCKET_INFO[k].name} başarılı uçuş ${st.success[k] || 0}/${n}`);
    if (q.landings && st.landings < q.landings) miss.push(`Booster inişi ${st.landings}/${q.landings}`);
    if (q.splash && st.splash < q.splash) miss.push(`Okyanus iniş testi ${st.splash}/${q.splash}`);
    if (q.catches && st.catches < q.catches) miss.push(`Kule yakalama ${st.catches}/${q.catches}`);
    if (q.sats && totalSats() < q.sats) miss.push(`Hizmetteki uydu ${totalSats()}/${q.sats}`);
    if (q.moon && st.moon < q.moon) miss.push(`Ay inişi ${st.moon}/${q.moon}`);
    return miss;
  }

  /* ---------------- Ar-Ge (süreli) ---------------- */
  const researchSlots = () => 1 + Math.floor(state.engineers / 40);
  const researchRate = () => 15 * M * Math.sqrt(state.engineers / 20);
  const researchWeeks = id => Math.max(1, Math.ceil(RESEARCH_BY_ID[id].cost / researchRate()));
  const inQueue = id => state.rqueue.some(q => q.id === id);
  function canResearch(id) {
    const r = RESEARCH_BY_ID[id];
    if (has(id)) return { ok: false, done: true, miss: [] };
    if (inQueue(id)) return { ok: false, active: true, miss: [] };
    const miss = reqStatus(r);
    const slot = state.rqueue.length < researchSlots();
    return { ok: miss.length === 0 && state.money >= r.cost && slot, miss, money: state.money >= r.cost, slot, weeks: researchWeeks(id) };
  }
  function doResearch(id) {
    const c = canResearch(id); if (!c.ok) return false;
    const r = RESEARCH_BY_ID[id];
    state.money -= r.cost;
    state.rqueue.push({ id, done: 0, total: r.cost });
    log(`Araştırma başladı: ${r.name} (~${c.weeks} hafta)`);
    save(); return true;
  }
  function finishResearch(id, rep) {
    state.research[id] = state.week;
    const r = RESEARCH_BY_ID[id];
    log('Araştırma tamamlandı: ' + r.name, 'good');
    if (rep) rep.lines.push(['🔬 Araştırma tamamlandı: ' + r.name, 0]);
    if (id === 'g_military') state.military = true;
  }
  function hireEngineers(n) {
    if (n > 0) { const c = n * ENGINEER_HIRE; if (state.money < c) return false; state.money -= c; state.engineers += n; log(`${n} mühendis işe alındı`); }
    else { state.engineers = Math.max(10, state.engineers + n); log(`${-n} mühendis ayrıldı`); }
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
  const satRate = () => (state.strike > state.week ? 0 : fac('satFab') ? FACILITIES.satFab.levels[fac('satFab') - 1].rate : 0);
  const terminalRate = () => (fac('terminalFab') ? FACILITIES.terminalFab.levels[fac('terminalFab') - 1].rate * (has('u_terminal2') ? 2 : 1) : 0);
  function engineRate() {
    const lv = fac('engineFab');
    if (!lv) return { merlin: 3, raptor: 0 };
    const L = FACILITIES.engineFab.levels[lv - 1];
    return { merlin: L.merlin, raptor: has('r_raptor') ? L.raptor : 0 };
  }
  const POLICY = { fast: { name: 'Hızlı', dw: -1, risk: 0.012, cost: 0.8 }, normal: { name: 'Normal', dw: 0, risk: 0, cost: 1 }, thorough: { name: 'Detaylı', dw: 1, risk: -0.01, cost: 1.3 } };
  const refurbWeeks = () => Math.max(1, 3 - fac('refurb') + (fac('refurb') ? 0 : 1) - (has('k_refurb') ? 1 : 0) + POLICY[state.refurbPolicy || 'normal'].dw);
  const refurbCost = type => (type === 'ss' ? 4 * M : type === 'f1' ? 0.5 * M : 2.5 * M) * (has('k_refurb') ? 0.6 : 1) * POLICY[state.refurbPolicy || 'normal'].cost;
  const maxFlights = type => (type === 'f1' ? 5 : has('k_life') ? 20 : 10);

  /* ---------------- Filo ---------------- */
  function newCore(st, type, weeks) {
    const n = st.nextSerial[type]++;
    const id = type === 'ship' ? 'S' + n : type === 'ss' ? 'B' + (n + 10) : type === 'f1' ? 'F1-' + String(n).padStart(2, '0') : 'B' + (1000 + n + (type === 'fh' ? 40 : 0));
    return { id, type, flights: 0, status: weeks ? 'building' : 'ready', weeks: weeks || 0, history: [], wear: 0, built: st.week };
  }
  function coreOrderInfo(type) {
    const lv = fac('rocketFab');
    const info = CORE_INFO[type];
    const supply = state && state.supplyCrisis > state.week ? 2 : 0;
    return { cost: info.cost * (1 - 0.1 * (lv - 1)), weeks: Math.max(1, info.weeks - (lv - 1)) + supply, engines: info.engines };
  }
  function enginesOk(req) { for (const [k, n] of Object.entries(req || {})) if ((state.stock[k] || 0) < n) return false; return true; }
  function useEngines(req) { for (const [k, n] of Object.entries(req || {})) state.stock[k] -= n; }
  function orderCore(type) {
    const o = coreOrderInfo(type);
    if (state.money < o.cost) return false;
    if (!enginesOk(o.engines)) return false;
    state.money -= o.cost; useEngines(o.engines);
    const c = newCore(state, type, o.weeks);
    state.fleet.push(c);
    log(`${CORE_INFO[type].name} siparişi: ${c.id} (${o.weeks} hafta)`);
    save(); return c;
  }
  const readyCores = type => state.fleet.filter(c => c.type === type && c.status === 'ready').sort((a, b) => b.flights - a.flights);
  function renameCore(id, name) { const c = state.fleet.find(x => x.id === id); if (c) { c.nick = String(name || '').slice(0, 24); save(); } }

  /* ---------------- Hava durumu ---------------- */
  function genWeather(st) {
    const R = rng(st.seed + st.week * 7919);
    const k = (DIFFICULTY[st.difficulty] || DIFFICULTY.normal).weather;
    const mk = (base) => {
      const jet = Math.round((12 + R() * 30 + (R() < 0.22 ? R() * 40 : 0)) * (0.8 + 0.2 * k));
      const wind = Math.round((R() * 10 + (R() < 0.2 ? R() * 8 : 0)) * k * 10) / 10;
      const waves = Math.round((0.5 + R() * 1.8 + (R() < 0.2 ? R() * 2.5 : 0)) * k * 10) / 10;
      const cloud = Math.round(R() * 100);
      const storm = R() < 0.09 * k;
      const rain = storm || (cloud > 70 && R() < 0.55);
      const hour = Math.floor(R() * 24);
      const fog = !storm && R() < 0.12 && (hour < 9 || hour > 21);
      return { jet, wind, windDir: R() < 0.5 ? -1 : 1, waves, hour, cloud, rain, fog, storm, base };
    };
    const w = { cape: mk('cape'), starbase: mk('starbase') };
    if (st.week <= 2) for (const kk of ['cape', 'starbase']) { Object.assign(w[kk], { jet: Math.min(w[kk].jet, 28), waves: Math.min(w[kk].waves, 1.4), wind: Math.min(w[kk].wind, 6), hour: 10 + st.week * 3, storm: false, rain: false, fog: false, cloud: Math.min(w[kk].cloud, 40) }); }
    return w;
  }
  function weatherRisks(w, plan) {
    const r = [];
    if (w.storm) r.push({ level: 'bad', text: 'Fırtına ve yıldırım riski — fırlatma kuralları gereği fırlatma yasak' });
    if (w.jet > 42) r.push({ level: w.jet > 55 ? 'bad' : 'warn', text: `Üst seviye jet rüzgârı ${w.jet} m/s — Max-Q'da yapısal risk` });
    if (plan && plan.mode === 'asds' && w.waves > 2.2) r.push({ level: w.waves > 3 ? 'bad' : 'warn', text: `Dalga ${w.waves} m — drone gemi güvertesi çok hareketli${has('k_octa') ? '' : ', devrilme riski'}` });
    if (plan && plan.fairingRec && w.waves > 2.5) r.push({ level: 'warn', text: 'Dalgalar burun konisi kurtarmayı zorlaştırır' });
    if (w.wind > 9 && plan && (plan.mode !== 'exp' || plan.shipReturn)) r.push({ level: w.wind > 13 ? 'bad' : 'warn', text: `Yer rüzgârı ${w.wind} m/s — iniş/yakalama riski` });
    if (w.fog) r.push({ level: 'warn', text: 'Sis — yer kameralarında görüş düşük' });
    return r;
  }

  /* ---------------- Sözleşmeler & itibar ---------------- */
  const CONTRACT_TYPES = {
    demo: { name: 'Teknoloji gösterimi (test yükü)', rockets: ['f1'], mass: [100, 180], orbit: 'leo', alt: 300000, reward: [14 * M, 19 * M], research: null },
    small: { name: 'Küçük uydu (LEO)', rockets: ['f1', 'f9'], mass: [150, 300], orbit: 'leo', alt: 500000, reward: [12 * M, 17 * M], research: 'r_merlin1d' },
    ride: { name: 'Paylaşımlı fırlatma (rideshare)', rockets: ['f9'], mass: [5000, 9000], orbit: 'leo', alt: 500000, reward: [35 * M, 50 * M], research: 'r_f9' },
    gto: { name: 'Ticari haberleşme uydusu (GTO)', rockets: ['f9', 'fh', 'ss'], mass: [3500, 6500], orbit: 'gto', reward: [70 * M, 110 * M], research: 'g_gto' },
    heavy: { name: 'Ağır askeri uydu (GTO)', rockets: ['fh', 'ss'], mass: [6000, 9500], orbit: 'gto', reward: [140 * M, 180 * M], research: 'r_fh' },
    cargo: { name: 'Kargo Dragon (uzay istasyonu)', rockets: ['f9'], mass: [11500, 12500], orbit: 'iss', alt: 410000, reward: [130 * M, 160 * M], research: 'g_dragon', dragon: true },
    crew: { name: 'Mürettebatlı Dragon (4 astronot)', rockets: ['f9'], mass: [12500, 12900], orbit: 'iss', alt: 410000, reward: [230 * M, 270 * M], research: 'g_crew', dragon: true, crew: true },
    tender: { name: 'Devlet ihalesi: ulusal güvenlik uydusu', rockets: ['f9', 'fh'], mass: [3000, 4500], orbit: 'gto', reward: [180 * M, 240 * M], research: '_event' },
  };
  const repMul = () => 0.7 + 0.6 * clamp(state.reputation, 0, 100) / 100;
  function genContracts(st) {
    const R = rng(st.seed + st.week * 104729);
    const avail = Object.entries(CONTRACT_TYPES).filter(([, t]) => t.research !== '_event' && (!t.research || st.research[t.research]));
    const out = (st.contracts || []).filter(c => c.expires >= st.week && !c.done);
    const nOffers = 2 + Math.floor(clamp(st.reputation === undefined ? 50 : st.reputation, 0, 100) / 30);
    const rm = (0.7 + 0.6 * clamp(st.reputation === undefined ? 50 : st.reputation, 0, 100) / 100) * (DIFFICULTY[st.difficulty] || DIFFICULTY.normal).reward;
    let guard = 0;
    while (out.length < nOffers && guard++ < 20 && avail.length) {
      const [type, t] = avail[Math.floor(R() * avail.length)];
      if (out.some(c => c.type === type)) continue;
      out.push(makeContract(st, type, t, R, rm));
    }
    return out;
  }
  function makeContract(st, type, t, R, rm) {
    const mass = Math.round((t.mass[0] + R() * (t.mass[1] - t.mass[0])) / 10) * 10;
    const reward = Math.round((t.reward[0] + R() * (t.reward[1] - t.reward[0])) * (rm || 1) / 1e5) * 1e5;
    return { id: 'c' + st.week + '_' + type + '_' + Math.floor(R() * 1e4), type, name: t.name, mass, reward, expires: st.week + 4 + Math.floor(R() * 5), penalty: Math.round(reward * 0.4 / 1e5) * 1e5 };
  }
  function addRep(d) { state.reputation = clamp(state.reputation + d, 0, 100); }

  /* ---------------- Ağ modeli ---------------- */
  function shellWeight(lat, inc) {
    const a = Math.abs(lat), i = inc > 90 ? 180 - inc : inc;
    if (inc > 90) return 0.7 + 0.6 * (a / 90) ** 3;
    if (a > i + 4) return 0;
    if (a > i) return 0.4;
    const s = Math.sin(a * DEG) / Math.sin(i * DEG);
    return clamp(0.65 / Math.sqrt(Math.max(0.08, 1 - s * s)), 0.6, 2.2);
  }
  function licensed(rid) {
    const R = REGION_BY_ID[rid];
    if (!R.lic) return true;
    const l = state.licenses[rid];
    if (state.licenseSuspended && state.licenseSuspended[rid] > state.week) return false;
    return l === 'ok';
  }
  function rivalCoverage(rv, R) {
    const def = RIVALS.find(x => x.id === rv.id);
    const eff = rv.sats * shellWeight(R.lat, def.inc) * 1.0;
    return 1 - Math.exp(-eff / 260);
  }
  function network() {
    const out = { regions: [], users: 0, capUsers: 0, revenue: 0, served: 0, demand: 0, laserFrac: 0, sats: totalSats(), capGbps: 0, latencyBonus: 0, military: 0 };
    let laserN = 0;
    for (const sh of Object.values(state.shells)) for (const [g, n] of Object.entries(sh)) { const G = SAT_GENS[g]; out.capGbps += n * G.cap; if (G.laser) laserN += n; }
    out.laserFrac = out.sats ? laserN / out.sats : 0;
    out.capUsers = out.capGbps / GBPS_PER_USER / 1000;
    const anyStation = Object.keys(state.stations).length > 0;
    const sectorStation = {};
    for (const rid of Object.keys(state.stations)) { const R = REGION_BY_ID[rid]; if (R) sectorStation[R.sector] = true; }
    let wantUsers = 0;
    for (const R of REGIONS) {
      let eff = 0;
      for (const [sk, sh] of Object.entries(state.shells)) {
        const w = shellWeight(R.lat, SHELLS[sk].inc);
        for (const [g, n] of Object.entries(sh)) eff += n * SAT_GENS[g].cover * w;
      }
      const cov = 1 - Math.exp(-eff / 260);
      let conn = 0, via = 'yok';
      const lic = licensed(R.id);
      if (!lic) { via = R.lic && state.licenses[R.id] && state.licenses[R.id] !== 'ok' ? 'lisans bekleniyor' : 'lisans yok'; }
      else if (state.stations[R.id]) { conn = 1; via = 'yer istasyonu'; }
      else {
        const las = anyStation ? out.laserFrac : 0;
        const rel = (state.relays[R.sector] > 0 && sectorStation[R.sector] && R.sector !== 'polar') ? Math.min(0.85, 0.6 + 0.1 * (state.relays[R.sector] - 1)) : 0;
        conn = Math.max(las, rel);
        via = conn === 0 ? 'bağlantı yok' : las >= rel ? 'lazer röle' : 'GEO röle';
      }
      const served = cov * conn;
      // rakip payı
      const pr = PRICES[state.prices[R.id] || 'normal'];
      let rivalQ = 0;
      for (const rv of state.rivals) { const def = RIVALS.find(x => x.id === rv.id); rivalQ += Math.pow(rivalCoverage(rv, R), 1.5) / def.priceMul * D().rival; }
      const ourQ = Math.pow(served, 1.5) / pr.mul;
      const share = ourQ + rivalQ > 0 ? ourQ / (ourQ + rivalQ * 0.85) : 1;
      const target = clamp(served * share * pr.elast, 0, 1);
      // istasyon kapasitesi (yerel ağ geçidi)
      let capR = Infinity;
      if (state.stations[R.id]) capR = STATION_CAP[state.stations[R.id]] * (1 + out.laserFrac * 2);
      const ad = state.adoption[R.id] || 0;
      let users = Math.min(R.demand * ad, capR);
      wantUsers += users;
      out.regions.push({ id: R.id, name: R.name, cov, conn, served, via, adoption: ad, target, share, users, demand: R.demand, station: state.stations[R.id] || 0, land: R.land, sector: R.sector, lat: R.lat, lon: R.lon, r: R.r, lic: R.lic, licensed: lic, price: state.prices[R.id] || 'normal', arpu: (R.arpu || 1) * pr.mul, capR, rivalCov: state.rivals.map(rv => rivalCoverage(rv, R)) });
      out.demand += R.demand;
      out.served += R.demand * served;
    }
    const capScale = wantUsers > out.capUsers ? out.capUsers / Math.max(1e-9, wantUsers) : 1;
    out.capLimited = capScale < 1;
    for (const r of out.regions) { r.users *= capScale; out.users += r.users; out.revenue += r.users * 1000 * ARPU * r.arpu; }
    out.latencyBonus = out.revenue * 0.15 * out.laserFrac;
    out.revenue += out.latencyBonus;
    if (state.military) { out.military = 4 * M * Math.min(1, out.sats / 1000); out.revenue += out.military; }
    out.servedFrac = out.demand ? out.served / out.demand : 0;
    out.userFrac = out.demand ? out.users / out.demand : 0;
    return out;
  }
  function buildStation(rid) {
    const R = REGION_BY_ID[rid];
    if (!R || !R.land || state.stations[rid] || state.money < GS_COST || !has('u_v09')) return false;
    state.money -= GS_COST; state.stations[rid] = 1;
    log('Yer istasyonu kuruldu: ' + R.name, 'good'); save(); return true;
  }
  function upgradeStation(rid) {
    const lv = state.stations[rid]; if (!lv || lv >= 3) return false;
    const c = STATION_UP_COST[lv + 1]; if (state.money < c) return false;
    state.money -= c; state.stations[rid] = lv + 1; log(`${REGION_BY_ID[rid].name} istasyonu seviye ${lv + 1}`); save(); return true;
  }
  function applyLicense(rid) {
    const R = REGION_BY_ID[rid]; if (!R || !R.lic || state.licenses[rid]) return false;
    if (state.money < R.lic.cost) return false;
    state.money -= R.lic.cost; state.licenses[rid] = { until: state.week + R.lic.weeks };
    log(`${R.name} için lisans başvurusu (${R.lic.weeks} hafta)`); save(); return true;
  }
  function setPrice(rid, p) { if (PRICES[p]) { state.prices[rid] = p; save(); } }

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
    if (rk === 'ss' && has('p_refuel')) t.push('tanker');
    if (rk === 'ss' && has('p_hls')) t.push('moon');
    if (rk === 'ss' && has('p_mars')) t.push('mars');
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
    return p * D().fail;
  }
  const marsWindow = w => ((w - 1) % 26) < 4;
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
    P.site = info.site;
    const padOk = info.site === 'cape' || (info.site === 'cape39a' && fac('cape39a')) || (info.site === 'starbase' && fac('starbase'));
    if (!padOk) { P.ok = false; P.reasons.push(info.site === 'starbase' ? 'Starbase kurulmadı (Tesisler)' : 'LC-39A rampası kurulmadı (Tesisler)'); }
    const padKey = info.site === 'cape' ? (fac('cape39a') && state.padsUsed.cape ? 'cape39a' : 'cape') : info.site;
    if (state.padsUsed[padKey]) { P.ok = false; P.reasons.push('Bu hafta bu rampadan zaten fırlatma yapıldı — haftayı bitir'); }
    if (state.padDown[padKey] > state.week) { P.ok = false; P.reasons.push(`Rampa onarımda (hafta ${state.padDown[padKey]}'e kadar)`); }
    if (rk === 'ss') {
      if (state.community < 20) { P.ok = false; P.reasons.push('Yerel halk onayı çok düşük — Tesisler sekmesinden topluluk yatırımı yap'); }
      else if (state.community < 40 && state.lastSS && state.week - state.lastSS < 2) { P.ok = false; P.reasons.push('Halk onayı düşük: Starship en fazla 2 haftada bir fırlatılabilir'); }
    }
    const ban = state.faaBan[info.family];
    if (ban > state.week) { P.ok = false; P.reasons.push(`Kaza soruşturması: ${info.family === 'falcon' ? 'Falcon' : info.name} fırlatmaları hafta ${ban}'e kadar yasak`); }
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
    if (!enginesOk(UPPER_ENGINES[rk])) { P.ok = false; P.reasons.push('Üst kademe için motor yok — Tesisler: Motor fabrikası'); }
    // yük kapasitesi
    const mul = payloadMul(rk);
    const capKey = rk === 'fh' && P.sideMode === 'exp' && P.mode === 'exp' ? 'exp' : P.mode;
    let leo = (info.cap[capKey] || info.cap.exp) * mul;
    if (rk === 'fh' && P.sideMode === 'exp') leo += info.capSideExp * 0.5;
    P.shipReturn = rk === 'ss' && has('k_shipcatch') && !!sel.shipReturn && P.mode === 'catch';
    if (P.shipReturn) leo *= info.capShipReturn;
    P.deorbitUpper = rk !== 'ss' && rk !== 'f1' && sel.deorbitUpper !== false;
    if (P.deorbitUpper) leo *= 0.96;
    let gto = (info.gto[P.mode] || info.gto.exp || 0) * mul;
    if (P.shipReturn) gto *= info.capShipReturn;
    P.leoCap = leo;
    const w = state.weather[info.site === 'starbase' ? 'starbase' : 'cape'];
    P.weather = w;
    if (w.storm) { P.ok = false; P.reasons.push('Fırtına: yıldırım riski nedeniyle fırlatma kuralları ihlal ediliyor — haftayı bekle'); }
    let mass = 0, targetAlt = null, targetAp = 0, fairing = true, kind = P.payload, sats = 0, reward = 0, contract = null, payloadValue = 0;
    if (P.payload === 'test') { mass = rk === 'f1' ? 180 : 2000; P.desc = 'Test yükü (kütle simülatörü)'; }
    if (P.payload === 'starlink') {
      let gen = currentGen();
      if (gen === 'v3' && rk !== 'ss') gen = 'v2m';
      const G = SAT_GENS[gen];
      const shell = sel.shell === 's53' || has('u_polar') ? sel.shell : 's53';
      P.shell = SHELLS[shell] ? shell : 's53';
      P.rideshare = !!sel.rideshare && rk !== 'ss';
      const rideKg = P.rideshare ? Math.round(leo * 0.15) : 0;
      const capN = Math.floor((leo - rideKg) * SHELLS[P.shell].factor / G.mass);
      sats = Math.min(capN, state.stock.sats);
      if (sats <= 0) { P.ok = false; P.reasons.push('Stokta uydu yok — Uydu fabrikası kur ve haftayı bitir'); }
      mass = sats * G.mass + rideKg; P.gen = gen; P.capN = capN; P.rideKg = rideKg;
      if (rideKg) { P.rideIncome = rideKg * 5000; }
      targetAlt = 300000;
      payloadValue = sats * G.cost;
      P.desc = `${sats} × ${G.name} → ${SHELLS[P.shell].name}${rideKg ? ` + ${rideKg} kg müşteri yükü` : ''}`;
    }
    if (P.payload === 'relay') {
      mass = RELAY_MASS; targetAp = 35786000; P.relaySector = sel.relaySector || 'am';
      if (gto < RELAY_MASS) { P.ok = false; P.reasons.push(`Bu yapılandırma GTO'ya en fazla ${Math.round(gto)} kg taşır (röle ${RELAY_MASS} kg)`); }
      P.cost.push(['GEO röle uydusu', RELAY_SAT_COST]); payloadValue = RELAY_SAT_COST;
      P.desc = 'GEO optik röle uydusu → ' + SECTORS[P.relaySector];
    }
    if (P.payload === 'contract') {
      const list = state.accepted.filter(c => CONTRACT_TYPES[c.type].rockets.includes(rk));
      contract = list.find(c => c.id === sel.contract) || list[0];
      P.contractList = list;
      if (contract) {
        const t = CONTRACT_TYPES[contract.type];
        mass = contract.mass; reward = contract.reward; P.contract = contract; payloadValue = reward * 0.5;
        if (t.orbit === 'gto') { targetAp = 35786000; if (gto < mass) { P.ok = false; P.reasons.push(`GTO kapasitesi yetersiz (${Math.round(gto)} kg < ${mass} kg) — daha hafif kurtarma modu seç`); } }
        else { targetAlt = t.alt; const c2 = leo * (t.alt > 400000 ? 0.9 : 1); if (c2 < mass) { P.ok = false; P.reasons.push(`Yük kapasitesi yetersiz (${Math.round(c2)} kg < ${mass} kg)`); } }
        if (t.dragon) { fairing = false; kind = 'dragon'; }
        P.desc = `${t.name} — ${mass} kg`;
      }
    }
    if (P.payload === 'tanker') {
      mass = Math.round(leo * 0.95); kind = 'tanker'; targetAlt = 300000;
      P.desc = `Tanker: yörünge deposuna ${Math.round(mass / 1000)} t yakıt (depo: ${Math.round(state.depot)} t)`;
    }
    if (P.payload === 'moon' || P.payload === 'mars') {
      const needT = P.payload === 'moon' ? 400 : 800;
      mass = 40000; kind = P.payload; targetAlt = 300000; payloadValue = P.payload === 'moon' ? 150 * M : 400 * M;
      if (state.depot < needT) { P.ok = false; P.reasons.push(`Yörünge deposunda ${needT} t yakıt gerekli (şu an ${Math.round(state.depot)} t) — tanker uçuşları yap`); }
      if (P.payload === 'mars' && !marsWindow(state.week)) { P.ok = false; P.reasons.push(`Mars fırlatma penceresi kapalı — sonraki pencere hafta ${state.week + (26 - ((state.week - 1) % 26))}`); }
      P.desc = P.payload === 'moon' ? 'Ay\'a iniş görevi (HLS)' : 'Mars\'a iniş görevi';
      P.needDepot = needT;
    }
    if (P.payload === 'test' && rk === 'f1' && leo < mass) mass = Math.max(50, Math.floor(leo));
    P.mass = mass; P.sats = sats; P.targetAlt = targetAlt; P.targetAp = targetAp; P.fairing = fairing && rk !== 'ss'; P.kind = kind; P.reward = reward;
    // maliyet
    for (const c of P.cores) P.cost.push([c.flights ? `${c.nick ? c.nick + ' / ' : ''}${c.id} (uçuş ${c.flights + 1}, yeniden kullanım)` : `${c.id} (yeni booster)`, 0]);
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
    // arıza olasılığı (aşınma + bakım politikası dahil)
    P.failChance = failChance(rk) + P.cores.reduce((a, c) => a + c.flights * 0.002 + (c.wear || 0), 0);
    // sigorta
    P.insure = !!sel.insure && rk !== 'f1';
    const launchValue = P.cost.reduce((a, c) => a + c[1], 0) + P.cores.reduce((a, c) => a + CORE_INFO[c.type].cost * (c.flights ? 0.5 : 1), 0);
    P.insValue = payloadValue + launchValue * 0.5;
    const recentFails = state.stats.launches ? state.stats.fails / state.stats.launches : 0.1;
    P.premium = Math.round((P.failChance * 1.6 + recentFails * 0.08 + 0.01) * P.insValue / 1e5) * 1e5;
    if (P.insure) P.cost.push([`Fırlatma sigortası (teminat ${(P.insValue / M).toFixed(0)} M$)`, P.premium]);
    P.total = P.cost.reduce((a, c) => a + c[1], 0);
    if (state.money < P.total) { P.ok = false; P.reasons.push('Bütçe yetersiz'); }
    P.risks = weatherRisks(w, P);
    P.engineMsg = `Motor arıza olasılığı: %${(P.failChance * 100).toFixed(1)}`;
    P.manualLanding = !!sel.manualLanding && P.mode !== 'exp';
    return P;
  }

  /* fırlatmayı başlat */
  function commit(P) {
    if (!P.ok) return null;
    const R = rng(state.seed + state.week * 31 + state.stats.launches * 977);
    state.money -= P.total;
    state.stats.launches++;
    state.padsUsed[P.pad] = true;
    for (const c of P.cores) c.status = 'flight';
    if (P.ship) P.ship.status = 'flight';
    if (P.payload === 'starlink') state.stock.sats -= P.sats;
    if (P.payload === 'moon' || P.payload === 'mars') state.depot -= P.needDepot;
    if (P.fairing && state.stock.fairings >= 2 && P.rocket !== 'f1') state.stock.fairings -= 2;
    useEngines(UPPER_ENGINES[P.rocket]);
    if (P.rocket === 'ss') { state.lastSS = state.week; state.community = clamp(state.community - 4, 0, 100); }
    let engineFail = null;
    if (R() < P.failChance) {
      const upper = P.rocket !== 'ss' && R() < 0.18;
      engineFail = { t: upper ? 200 + R() * 150 : 15 + R() * 100, part: upper ? 'upper' : 'booster', count: P.rocket === 'ss' ? 1 + Math.floor(R() * 3) : 1 };
    }
    const w = P.weather;
    // rampa hasarı (Starship), drone gemide devrilme, ısı kalkanı, geri sayım beklemesi
    const padDamage = P.rocket === 'ss' && !has('r_deluge') && R() < 0.25;
    let tipOver = false;
    if (P.mode === 'asds' && w.waves > 2.4) tipOver = R() < (w.waves - 2.4) * 0.35 * (has('k_octa') ? 0.2 : 1);
    let tileLoss = 0, burnThrough = false;
    if (P.shipReturn) { tileLoss = R() * (has('k_tiles') ? 0.35 : 1); burnThrough = tileLoss > 0.93; }
    const hold = R() < 0.07 ? { t: -8 + R() * 3, sensor: ['LOX tankı basınç sensörü', 'Motor bölmesi sıcaklık okuması', 'Menzil güvenlik telemetrisi', 'Yer destek ekipmanı valfi', 'Uçuş bilgisayarı yedek kanalı'][Math.floor(R() * 5)], risk: 0.08 + R() * 0.25 } : null;
    const ctx = {
      plan: P, week: state.week,
      simOpts: {
        mode: P.mode, sideMode: P.sideMode || 'rtls', payloadMass: P.mass, payloadKind: P.kind, fairing: P.fairing,
        targetAlt: P.targetAlt || undefined, targetAp: P.targetAp || undefined, sats: P.sats,
        shipReturn: P.shipReturn, fairingRec: P.fairingRec, waves: w.waves, wind: { s: w.wind * w.windDir, j: w.jet },
        engineFail, landMinThr: has('k_deep') ? 0.4 : undefined, tipOver, burnThrough,
        deorbitUpper: P.deorbitUpper, manualLanding: P.manualLanding,
        autopilot: state.opts.autopilot, autoLand: state.opts.autoLand && !P.manualLanding,
      },
      hour: w.hour, site: P.site, weather: w, padDamage, tileLoss, hold,
      flights: Object.fromEntries(P.cores.map(c => [c.id, c.flights])),
    };
    save();
    return ctx;
  }
  /* geri sayımda iptal: maliyetin %85'i iade, çekirdekler hazıra döner */
  function abortLaunch(ctx) {
    const P = ctx.plan;
    const refund = Math.round(P.total * 0.85 / 1e5) * 1e5;
    state.money += refund;
    state.stats.launches--;
    for (const c of P.cores) c.status = 'ready';
    if (P.ship) P.ship.status = 'ready';
    if (P.payload === 'starlink') state.stock.sats += P.sats;
    if (P.needDepot) state.depot += P.needDepot;
    log(`Fırlatma geri sayımda iptal edildi (${ctx.hold ? ctx.hold.sensor : 'manuel'}) — ${(refund / M).toFixed(1)} M$ iade`, 'bad');
    save();
    return refund;
  }

  /* sonuçları uygula */
  function applyResult(ctx, r) {
    if (ctx.sandbox) return { lines: [['Serbest mod — ekonomi etkilenmez', 0]], achievements: [], net: 0 };
    const P = ctx.plan, st = state.stats, lines = [], ach = [];
    const award = id => {
      if (state.achievements[id]) return;
      state.achievements[id] = state.week; ach.push(ACHIEVEMENTS.find(a => a.id === id).name);
      if (GRANTS[id]) { state.money += GRANTS[id]; lines.push(['Yatırımcı ödülü: ' + ACHIEVEMENTS.find(a => a.id === id).name, GRANTS[id]]); }
    };
    lines.push(['Fırlatma maliyeti', -P.total]);
    let income = 0;
    const missionName = `${ROCKET_INFO[P.rocket].name} · ${P.desc || ''}`;
    if (r.ok) {
      st.success[P.rocket] = (st.success[P.rocket] || 0) + 1;
      state.successThisWeek = (state.successThisWeek || 0) + 1;
      addRep(2);
      award('a_orbit');
      if (r.engineOut) award('a_engineout');
      if (P.payload === 'starlink') {
        // yörünge yükseltme: birkaç hafta sonra hizmete girer
        const G = SAT_GENS[P.gen];
        const raiseWeeks = 3 + Math.floor(RR() * 3);
        state.cohorts.push({ shell: P.shell, gen: P.gen, n: r.sats, week: state.week, raiseUntil: state.week + raiseWeeks });
        lines.push([`${r.sats} uydu yörüngede — iyon iticilerle ${raiseWeeks} haftada hedef kabuğa yükselecek (${SHELLS[P.shell].name})`, 0]);
        if (P.rideshare && P.rideIncome) { income += P.rideIncome; lines.push([`Müşteri yükü geliri (${P.rideKg} kg)`, P.rideIncome]); }
        void G;
      }
      if (P.payload === 'relay') { state.relays[P.relaySector] = (state.relays[P.relaySector] || 0) + 1; lines.push(['GEO röle aktif: ' + SECTORS[P.relaySector], 0]); }
      if (P.payload === 'contract' && P.contract) {
        const rest = P.contract.reward - (P.contract.advance || 0);
        income += rest; lines.push(['Sözleşme ödemesi (avans hariç): ' + P.contract.name, rest]);
        P.contract.done = true; state.accepted = state.accepted.filter(c => c.id !== P.contract.id);
        if (P.contract.type === 'crew') award('a_crew');
        addRep(3);
      }
      if (P.payload === 'test' && P.rocket === 'f1') { const g = 2.5 * M; income += g; lines.push(['Test verisi / yatırımcı güveni', g]); }
      if (P.payload === 'tanker') { const t = Math.round(P.mass / 1000); state.depot += t; st.tankers++; lines.push([`Yörünge deposuna ${t} t yakıt aktarıldı (depo ${Math.round(state.depot)} t)`, 0]); }
      if (P.payload === 'moon' || P.payload === 'mars') {
        if (r.landed) {
          const isMoon = P.payload === 'moon';
          if (isMoon) { st.moon++; award('a_moon'); } else { st.mars++; award('a_mars'); }
          const g = isMoon ? 250 * M : 600 * M; income += g;
          lines.push([isMoon ? 'Ay\'a iniş — NASA Artemis benzeri sözleşme ödemesi' : 'Mars\'a iniş — uluslararası bilim ortaklığı', g]);
          addRep(15);
        } else lines.push([P.payload === 'moon' ? 'Ay iniş gemisi kaybedildi' : 'Mars iniş gemisi kaybedildi', 0]);
      }
      if (r.partial) lines.push(['Hedef yörüngeye tam ulaşılamadı', 0]);
      if (P.deorbitUpper && P.rocket !== 'ss' && P.rocket !== 'f1') { st.deorbited++; if (st.deorbited >= 20) award('a_clean'); lines.push(['Üst kademe yörüngeden indirildi (sorumlu uzay operasyonu)', 0]); }
      else if (P.rocket === 'f9' || P.rocket === 'fh') { const sk = P.shell || 's53'; state.debris[sk] = (state.debris[sk] || 0) + 3; addRep(-1); lines.push(['Üst kademe yörüngede bırakıldı — uzay çöpü arttı', 0]); }
    } else {
      st.fails++;
      addRep(-10);
      if (P.payload === 'contract' && P.contract) {
        income -= P.contract.penalty; lines.push(['Sözleşme cezası', -P.contract.penalty]);
        state.accepted = state.accepted.filter(c => c.id !== P.contract.id);
      }
      if (P.payload === 'starlink') lines.push([`${P.sats} uydu kaybedildi`, -P.sats * SAT_GENS[P.gen].cost]);
      if (r.stackLost !== false) {
        const fam = ROCKET_INFO[P.rocket].family;
        const wk = has('r_safety') ? 1 : 2 + Math.floor(RR() * 4);
        state.faaBan[fam] = state.week + wk;
        lines.push([`Kaza soruşturması: ${fam === 'falcon' ? 'Falcon' : ROCKET_INFO[P.rocket].name} fırlatmaları ${wk} hafta durduruldu`, 0]);
        if (P.rocket === 'ss') state.community = clamp(state.community - 12, 0, 100);
      }
      if (r.orbitDebris) { const sk = P.shell || 's53'; state.debris[sk] += 20; }
    }
    if (P.insure && !r.ok) { income += P.insValue; lines.push(['Sigorta tazminatı', P.insValue]); }
    // çekirdekler
    const cores = P.cores.slice();
    const results = (r.boosters || []).slice();
    const coreRes = [];
    if (P.rocket === 'fh') {
      const byType = { side: results.filter(b => b.type === 'side'), center: results.filter(b => b.type !== 'side') };
      coreRes.push([cores[0], byType.side[0] || { result: P.sideMode === 'exp' ? 'expended' : 'lost', name: 'Yan Booster L' }]);
      coreRes.push([cores[1], byType.side[1] || { result: P.sideMode === 'exp' ? 'expended' : 'lost', name: 'Yan Booster R' }]);
      coreRes.push([cores[2], byType.center[0] || { result: P.mode === 'exp' ? 'expended' : 'lost', name: 'Merkez Çekirdek' }]);
    } else coreRes.push([cores[0], results[0] || { result: P.mode === 'exp' ? 'expended' : 'lost', name: '1. kademe' }]);
    let sidesLanded = 0;
    const pol = POLICY[state.refurbPolicy || 'normal'];
    for (const [core, b] of coreRes) {
      if (!core) continue;
      core.flights++;
      const hist = { w: state.week, m: missionName, r: b.result };
      if (b.result === 'landed' || b.result === 'caught') {
        if (b.type === 'side') sidesLanded++;
        const rc = refurbCost(core.type);
        core.wear = Math.max(0, (core.wear || 0) + pol.risk);
        if (core.flights >= maxFlights(core.type)) { core.status = 'retired'; lines.push([`${core.id}: indi — ömrünü tamamladı, müzeye`, 0]); }
        else { core.status = 'refurb'; core.weeks = refurbWeeks(); lines.push([`${core.nick || core.id}: ${b.result === 'caught' ? 'yakalandı' : 'indi'} ✓ (bakım ${core.weeks} hafta, ${pol.name.toLowerCase()})`, -rc]); income -= rc; }
        if (b.result === 'caught') { st.catches++; award('a_catch'); } else { st.landings++; award(b.kind === 'asds' ? 'a_asds' : 'a_land'); }
        if (b.manual) { st.manual++; award('a_manual'); income += 2 * M; lines.push(['Elle iniş bonusu', 2 * M]); }
        if (core.flights >= 10) award('a_veteran');
        hist.dx = b.dx;
      } else {
        core.status = 'lost';
        if (b.result === 'splash') { st.splash++; award('a_splash'); lines.push([`${core.id}: okyanusa kontrollü indi (test başarılı), battı`, 0]); }
        else if (b.result === 'tipped') lines.push([`${core.id}: drone gemiye indi ama dalgada devrildi ✗`, 0]);
        else lines.push([`${core.id}: ${b.result === 'expended' ? 'tek kullanımlık' : 'kaybedildi ✗'}`, 0]);
      }
      core.history.push(hist);
    }
    if (sidesLanded === 2) award('a_double');
    if (P.rocket === 'ss' && P.ship) {
      P.ship.flights++;
      P.ship.history = P.ship.history || [];
      if (r.ship === 'caught') {
        st.shipCatches++; award('a_shipcatch');
        const extra = Math.round((ctx.tileLoss || 0) * (has('k_tiles') ? 1 : 4));
        P.ship.status = 'refurb'; P.ship.weeks = refurbWeeks() + extra;
        lines.push([`${P.ship.id}: yörüngeden döndü ve yakalandı ✓ (karo hasarı %${Math.round((ctx.tileLoss || 0) * 100)}, bakım ${P.ship.weeks} hafta)`, -3 * M]); income -= 3 * M;
      } else { P.ship.status = 'lost'; lines.push([`${P.ship.id}: ${P.shipReturn ? (ctx.simOpts.burnThrough ? 'ısı kalkanı delindi, yeniden girişte kaybedildi ✗' : 'dönüşte kaybedildi ✗') : 'yörüngede bırakıldı (tek kullanımlık)'}`, 0]); }
      P.ship.history.push({ w: state.week, m: missionName, r: r.ship || 'expended' });
    }
    if (ctx.padDamage) { const wk = 2 + Math.floor(RR() * 3); state.padDown.starbase = state.week + wk; lines.push([`Kalkış rampaya zarar verdi — Starbase ${wk} hafta onarımda (Ar-Ge: su püskürtmeli plaka)`, -8 * M]); income -= 8 * M; }
    const fr = (r.fairings || []).filter(Boolean).length;
    if (fr) { state.stock.fairings += fr; st.fairings += fr; award('a_fairing'); lines.push([`${fr} burun konisi yarısı kurtarıldı`, 0]); }
    // meydan okuma
    const ch = state.challenge;
    if (ch && !ch.done && checkChallenge(ch, ctx, r)) { ch.done = true; income += ch.reward; lines.push(['⭐ Meydan okuma tamamlandı: ' + ch.text, ch.reward]); }
    state.launchesThisWeek = (state.launchesThisWeek || 0) + 1;
    state.money += income;
    const net = income - P.total;
    lines.push(['Net', net, 'total']);
    if (ach.length) lines.push(['🏆 Başarım: ' + ach.join(', '), 0, 'ach']);
    log((r.ok ? '✓ ' : '✗ ') + missionName + (r.ok ? '' : ' — ' + (r.reason || 'başarısız')), r.ok ? 'good' : 'bad');
    recomputeShells();
    checkWin();
    save();
    return { lines, achievements: ach, net };
  }
  function checkWin() {
    const n = network();
    if (n.userFrac >= 0.5) state.achievements.a_cov50 = state.achievements.a_cov50 || state.week;
    if (n.servedFrac >= 0.95 && n.userFrac >= D().share && !state.won) { state.won = true; state.achievements.a_win = state.week; return true; }
    return false;
  }

  /* ---------------- Meydan okumalar ---------------- */
  const CHALLENGES = [
    { id: 'night', text: 'Gece fırlatması yap (19:00–06:00)', reward: 6 * M },
    { id: 'wind', text: 'Yer rüzgârı ≥ 8 m/s iken bir booster indir', reward: 12 * M, need: 'k_rtls' },
    { id: 'precise', text: 'Bir boosterı hedefe 4 m\'den yakın indir', reward: 10 * M, need: 'k_rtls' },
    { id: 'double', text: 'Bu hafta 2 başarılı fırlatma yap', reward: 15 * M, need: 'cape39a' },
    { id: 'manual', text: 'Elle iniş modunda bir boosterı indir', reward: 14 * M, need: 'k_rtls' },
    { id: 'sats', text: 'Tek fırlatmada 50+ uydu yörüngeye çıkar', reward: 10 * M, need: 'u_v09' },
    { id: 'contract', text: 'Bir sözleşme görevini başar', reward: 8 * M },
    { id: 'reuse', text: '5+ kez uçmuş bir boosterla başarılı fırlatma', reward: 12 * M, need: 'k_rtls' },
  ];
  function genChallenge(st) {
    const R = rng(st.seed + st.week * 2111);
    const avail = CHALLENGES.filter(c => !c.need || st.research[c.need] || (st.facilities && st.facilities[c.need]));
    const c = avail[Math.floor(R() * avail.length)];
    return { id: c.id, text: c.text, reward: Math.round(c.reward * (DIFFICULTY[st.difficulty] || DIFFICULTY.normal).reward), week: st.week, done: false };
  }
  function checkChallenge(ch, ctx, r) {
    const P = ctx.plan, bs = r.boosters || [];
    const landed = bs.filter(b => b.result === 'landed' || b.result === 'caught');
    switch (ch.id) {
      case 'night': return r.ok && (ctx.hour < 6 || ctx.hour >= 19);
      case 'wind': return landed.length > 0 && ctx.weather.wind >= 8;
      case 'precise': return landed.some(b => Math.abs(b.dx || 99) < 4);
      case 'double': return r.ok && (state.successThisWeek || 0) >= 2;
      case 'manual': return landed.some(b => b.manual);
      case 'sats': return r.ok && P.payload === 'starlink' && r.sats >= 50;
      case 'contract': return r.ok && P.payload === 'contract';
      case 'reuse': return r.ok && P.cores.some(c => c.flights >= 5);
    }
    return false;
  }

  /* ---------------- Olay kartları ---------------- */
  const EVENTS = [
    { id: 'solar', w: 1, when: () => totalSats() > 100, title: '☀ Güneş fırtınası', text: 'Güçlü bir jeomanyetik fırtına bekleniyor. Atmosfer genişleyecek ve yeni fırlatılmış uydular sürüklenme riski altında.',
      choices: [{ label: 'Uyduları güvenli moda al (bu hafta gelir %40 düşer)', fx: 'solarSafe' }, { label: 'Risk al (yükselen uyduların bir kısmı kaybedilebilir)', fx: 'solarRisk' }] },
    { id: 'license', w: 1, when: () => Object.entries(state.licenses).some(([, v]) => v === 'ok'), title: '⚖ Lisans krizi', text: 'Bir ülke yayın frekansı lisansını gözden geçiriyor.',
      choices: [{ label: 'Lobi yap ($10 M, %70 başarı)', fx: 'licLobby' }, { label: 'Kabul et (bölgede 6 hafta hizmet durur)', fx: 'licAccept' }] },
    { id: 'supply', w: 1, title: '🏭 Tedarik krizi', text: 'Kritik bir alaşım tedarikçisi üretimi durdurdu. Yeni booster siparişleri 2 hafta gecikecek.',
      choices: [{ label: 'Alternatif tedarikçi ($15 M)', fx: 'supplyPay' }, { label: 'Gecikmeyi kabul et (4 hafta)', fx: 'supplyAccept' }] },
    { id: 'tender', w: 1, when: () => has('r_f9') && has('g_gto'), title: '🏛 Devlet ihalesi', text: 'Ulusal güvenlik uydusu için acil fırlatma ihalesi açıldı. Yüksek ödül, sıkı takvim.',
      choices: [{ label: 'İhaleye gir (özel sözleşme eklenir)', fx: 'tenderAccept' }, { label: 'Pas geç', fx: 'none' }] },
    { id: 'investor', w: 1, title: '💼 Melek yatırımcı', text: 'Bir yatırım fonu şirketine hızlı sermaye sunuyor.',
      choices: [{ label: 'Kabul et (+%2 hisse karşılığı nakit)', fx: 'investorAccept' }, { label: 'Reddet', fx: 'none' }] },
    { id: 'strike', w: 1, when: () => fac('satFab') > 0, title: '✊ Fabrika grevi', text: 'Uydu fabrikası çalışanları ücret artışı talep ediyor.',
      choices: [{ label: 'Zam ver ($6 M)', fx: 'strikePay' }, { label: 'Direnç göster (2 hafta üretim durur)', fx: 'strikeAccept' }] },
    { id: 'debris', w: 1, when: () => totalSats() > 200, title: '🛰 Çarpışma uyarısı', text: 'Eski bir roket gövdesi 53° kabuğuna yaklaşıyor.',
      choices: [{ label: 'Kaçınma manevrası ($2 M)', fx: 'debrisMan' }, { label: 'Riski göze al', fx: 'debrisRisk' }] },
    { id: 'media', w: 0.7, title: '📺 Medya ilgisi', text: 'Son fırlatmalarınız viral oldu! Kamuoyu desteği arttı.',
      choices: [{ label: 'Harika (+5 itibar, +5 halk onayı)', fx: 'media' }] },
    { id: 'rivalprice', w: 1, when: () => state.rivals.some(r => r.sats > 100), title: '📉 Rakip fiyat kırdı', text: 'Rakip şirket abonelik fiyatlarını %30 düşürdü.',
      choices: [{ label: 'Tüm bölgelerde fiyatı düşür', fx: 'priceCut' }, { label: 'Fiyatı koru (pazar payı düşebilir)', fx: 'none' }] },
    { id: 'talent', w: 0.8, title: '👩‍🚀 Yetenek havuzu', text: 'Kapanan bir havacılık şirketinin mühendisleri iş arıyor.',
      choices: [{ label: '15 mühendisi indirimli işe al ($0.8 M)', fx: 'talent' }, { label: 'Pas geç', fx: 'none' }] },
  ];
  function maybeEvent() {
    if (state.pendingEvent || state.week < 6) return;
    if (state.eventCooldown > state.week) return;
    if (RR() > 0.28) return;
    const pool = EVENTS.filter(e => !e.when || e.when());
    let tot = pool.reduce((a, e) => a + e.w, 0), x = RR() * tot, ev = pool[0];
    for (const e of pool) { x -= e.w; if (x <= 0) { ev = e; break; } }
    let target = null;
    if (ev.id === 'license') { const ok = Object.entries(state.licenses).filter(([, v]) => v === 'ok').map(([k]) => k); target = ok[Math.floor(RR() * ok.length)]; }
    state.pendingEvent = { id: ev.id, title: ev.title, text: ev.text + (target ? ` (${REGION_BY_ID[target].name})` : ''), choices: ev.choices.map(c => c.label), fx: ev.choices.map(c => c.fx), target };
    state.eventCooldown = state.week + 3;
  }
  function resolveEvent(i) {
    const ev = state.pendingEvent; if (!ev) return null;
    const fx = ev.fx[i]; let msg = '';
    switch (fx) {
      case 'solarSafe': state.solarSafe = state.week; msg = 'Uydular güvenli moda alındı.'; break;
      case 'solarRisk': {
        let lost = 0;
        for (const c of state.cohorts) if (c.raiseUntil > state.week) { const k = Math.round(c.n * (0.1 + RR() * 0.3)); c.n -= k; lost += k; state.debris[c.shell] += k * 0.2; }
        msg = lost ? `${lost} yükselen uydu atmosferde kaybedildi.` : 'Şans yüzümüze güldü, kayıp yok.'; break;
      }
      case 'licLobby': if (state.money >= 10 * M) { state.money -= 10 * M; if (RR() < 0.7) { msg = 'Lobi başarılı, lisans korundu.'; break; } } state.licenseSuspended = state.licenseSuspended || {}; state.licenseSuspended[ev.target] = state.week + 6; msg = 'Lobi başarısız: bölgede 6 hafta hizmet durdu.'; break;
      case 'licAccept': state.licenseSuspended = state.licenseSuspended || {}; state.licenseSuspended[ev.target] = state.week + 6; msg = 'Bölgede 6 hafta hizmet durdu.'; break;
      case 'supplyPay': if (state.money >= 15 * M) { state.money -= 15 * M; msg = 'Alternatif tedarikçi bulundu.'; } else { state.supplyCrisis = state.week + 4; msg = 'Bütçe yetmedi: siparişler 4 hafta gecikmeli.'; } break;
      case 'supplyAccept': state.supplyCrisis = state.week + 4; msg = 'Yeni booster siparişleri 4 hafta boyunca +2 hafta sürecek.'; break;
      case 'tenderAccept': { const R = rng(state.seed + state.week * 77); state.contracts.unshift(makeContract(state, 'tender', CONTRACT_TYPES.tender, R, repMul())); msg = 'İhale sözleşmesi tekliflere eklendi.'; break; }
      case 'investorAccept': { const v = valuation(); const cash = Math.round(v * 0.02 / 1e5) * 1e5; state.money += cash; state.ownership *= 0.98; msg = `+${(cash / M).toFixed(1)} M$ sermaye (hisse %${(state.ownership * 100).toFixed(1)})`; break; }
      case 'strikePay': if (state.money >= 6 * M) { state.money -= 6 * M; msg = 'Anlaşma sağlandı.'; } else { state.strike = state.week + 2; msg = 'Bütçe yetmedi, grev sürüyor.'; } break;
      case 'strikeAccept': state.strike = state.week + 2; msg = 'Uydu üretimi 2 hafta duracak.'; break;
      case 'debrisMan': if (state.money >= 2 * M) state.money -= 2 * M; msg = 'Manevra başarılı.'; break;
      case 'debrisRisk': if (RR() < 0.3) { const sh = state.cohorts.filter(c => c.shell === 's53' && c.n > 3); if (sh.length) { const c = sh[0]; const k = Math.min(c.n, 2 + Math.floor(RR() * 6)); c.n -= k; state.debris.s53 += k * 30; state.stats.collisions++; msg = `Çarpışma! ${k} uydu kaybedildi, enkaz bulutu oluştu.`; } } else msg = 'Gövde zararsız geçti.'; break;
      case 'media': addRep(5); state.community = clamp(state.community + 5, 0, 100); msg = 'İtibar arttı.'; break;
      case 'priceCut': for (const R of REGIONS) state.prices[R.id] = 'low'; msg = 'Tüm bölgelerde düşük fiyata geçildi.'; break;
      case 'talent': if (state.money >= 0.8 * M) { state.money -= 0.8 * M; state.engineers += 15; msg = '15 mühendis katıldı.'; } break;
      default: msg = 'Pas geçildi.';
    }
    log(`${ev.title}: ${msg}`, '');
    state.pendingEvent = null;
    recomputeShells();
    save();
    return msg;
  }

  /* ---------------- Finans ---------------- */
  function valuation() {
    const net = network();
    return Math.max(80 * M, net.revenue * 52 * 6 + totalSats() * 1.2 * M + Object.keys(state.research).length * 15 * M + state.fleet.filter(c => c.status !== 'lost' && c.status !== 'retired').length * 20 * M + state.stats.landings * 5 * M + state.reputation * 2 * M);
  }
  function fundingOptions() {
    return FUNDING.map(f => ({ id: f.id, name: f.name, share: f.share, done: !!state.funding[f.id], ok: !state.funding[f.id] && f.req(state), reqText: f.reqText, amount: Math.round(Math.max(f.base, valuation() * f.share) / 1e6) * 1e6 }));
  }
  function raiseFunding(id) {
    const o = fundingOptions().find(x => x.id === id); if (!o || !o.ok) return false;
    state.money += o.amount; state.ownership *= (1 - o.share); state.funding[id] = state.week;
    log(`${o.name}: +${(o.amount / M).toFixed(0)} M$, kurucu payı %${(state.ownership * 100).toFixed(1)}`, 'good');
    if (id === 'ipo') { state.achievements.a_ipo = state.week; }
    save(); return o.amount;
  }
  function communityInvest() { if (state.money < 10 * M) return false; state.money -= 10 * M; state.community = clamp(state.community + 15, 0, 100); log('Starbase topluluk yatırımı: halk onayı +15'); save(); return true; }

  /* ---------------- Haftayı bitir ---------------- */
  function endWeek() {
    if (state.pendingEvent) return { blocked: true };
    const rep = { week: state.week, lines: [] };
    // araştırma ilerlemesi
    const rate = researchRate();
    for (const q of state.rqueue) q.done += rate;
    const fin = state.rqueue.filter(q => q.done >= q.total);
    state.rqueue = state.rqueue.filter(q => q.done < q.total);
    for (const q of fin) finishResearch(q.id, rep);
    // maaşlar
    const sal = state.engineers * ENGINEER_SALARY;
    state.money -= sal; rep.lines.push([`Mühendis maaşları (${state.engineers} kişi)`, -sal]);
    // üretim: uydular
    const sr = state.prodPaused ? 0 : satRate();
    if (sr) {
      const G = SAT_GENS[currentGen()];
      const n = Math.max(0, Math.min(sr, Math.floor((state.money - 5 * M) / G.cost), stockCap() - state.stock.sats));
      if (n > 0) { state.stock.sats += n; state.money -= n * G.cost; rep.lines.push([`${n} × ${G.name} üretildi`, -n * G.cost]); }
      state.stock.gen = currentGen();
    } else if (state.strike > state.week) rep.lines.push(['Grev: uydu üretimi durdu', 0]);
    // motorlar
    const er = engineRate();
    const cap = { merlin: 120, raptor: 200 };
    for (const k of ['merlin', 'raptor']) if (er[k] && state.money > 3 * M) { const unit = (k === 'merlin' ? 0.12 : 0.35) * M; const before = state.stock[k] || 0; const d = Math.max(0, Math.min(er[k], cap[k] - before, Math.floor((state.money - 3 * M) / unit))); if (d) { state.stock[k] = before + d; const c = d * unit; state.money -= c; rep.lines.push([`${d} × ${k === 'merlin' ? 'Merlin' : 'Raptor'} motoru üretildi`, -c]); } }
    // terminaller
    const tr = terminalRate();
    if (tr) {
      const capT = Math.max(150, tr * 3);
      const unitT = (has('u_terminal2') ? 0.05 : 0.08) * M;
      const d = Math.max(0, Math.min(tr, capT - state.stock.terminals, Math.floor((state.money - 5 * M) / unitT)));
      if (d > 0) { const c = d * (has('u_terminal2') ? 0.05 : 0.08) * M; state.stock.terminals += d; state.money -= c; rep.lines.push([`${Math.round(d)} bin abone terminali üretildi`, -c]); }
    }
    // filo
    for (const c of state.fleet) if ((c.status === 'building' || c.status === 'refurb') && --c.weeks <= 0) { c.status = 'ready'; c.weeks = 0; rep.lines.push([`${c.nick || c.id} uçuşa hazır`, 0]); }
    state.fleet = state.fleet.filter(c => c.status !== 'lost');
    // lisanslar
    for (const [rid, v] of Object.entries(state.licenses)) if (v && v.until && v.until <= state.week + 1) { state.licenses[rid] = 'ok'; rep.lines.push([`Lisans onaylandı: ${REGION_BY_ID[rid].name}`, 0]); }
    // uydular: yükseltme tamamlanma, ömür, çarpışmalar
    let raisedOk = 0, raisedFail = 0, aged = 0, collided = 0;
    for (const c of state.cohorts) {
      if (c.raiseUntil && c.raiseUntil === state.week + 1) {
        const G = SAT_GENS[c.gen]; const f = Math.round(c.n * G.raiseFail * (0.5 + RR()));
        c.n -= f; raisedFail += f; raisedOk += c.n; state.debris[c.shell] += f * 0.5;
      }
      const life = SAT_GENS[c.gen].life;
      if (state.week - c.week > life) { const k = Math.max(1, Math.round(c.n * 0.12)); c.n -= Math.min(k, c.n); aged += Math.min(k, c.n + k); }
    }
    for (const sk of Object.keys(SHELLS)) {
      const n = state.cohorts.filter(c => c.shell === sk && (!c.raiseUntil || c.raiseUntil <= state.week)).reduce((a, c) => a + c.n, 0);
      const p = n * state.debris[sk] * 4e-6 * (has('u_avoid') ? 0.2 : 1);
      if (p > 0 && RR() < Math.min(0.8, p)) {
        const coh = state.cohorts.filter(c => c.shell === sk && c.n > 0);
        if (coh.length) { const c = coh[Math.floor(RR() * coh.length)]; const k = Math.min(c.n, 1 + Math.floor(RR() * 3)); c.n -= k; collided += k; state.debris[sk] += k * 15; state.stats.collisions++; }
      }
      state.debris[sk] = Math.max(0, state.debris[sk] * 0.993);
    }
    state.cohorts = state.cohorts.filter(c => c.n > 0);
    if (raisedOk) rep.lines.push([`${raisedOk} uydu hedef yörüngeye ulaştı ve hizmete girdi${raisedFail ? ` (${raisedFail} uydu yükselişte arızalandı)` : ''}`, 0]);
    if (aged) rep.lines.push([`${aged} uydu ömrünü tamamlayıp atmosferde yandı`, 0]);
    if (collided) rep.lines.push([`⚠ Çarpışma: ${collided} uydu enkazla çarpıştı`, 0]);
    recomputeShells();
    // rakipler
    for (const rv of state.rivals) {
      const def = RIVALS.find(x => x.id === rv.id);
      if (state.week >= def.start) rv.sats += Math.round(def.growth * D().rival * (0.5 + RR()));
      rv.sats = Math.round(rv.sats * 0.996);
    }
    // abone artışı (terminal sınırlı)
    const pre = network();
    let termNeed = 0;
    const grow = {};
    for (const r of pre.regions) { const a = state.adoption[r.id] || 0; const na = a + (r.target - a) * 0.3; grow[r.id] = na; if (na > a) termNeed += (na - a) * r.demand; }
    const termAvail = state.stock.terminals;
    const k = termNeed > 0 ? Math.min(1, termAvail / termNeed) : 1;
    let used = 0;
    for (const r of pre.regions) { const a = state.adoption[r.id] || 0; const na = grow[r.id]; if (na > a) { const inc = (na - a) * k; state.adoption[r.id] = a + inc; used += inc * r.demand; } else state.adoption[r.id] = na; }
    state.stock.terminals = Math.max(0, termAvail - used);
    if (k < 0.999 && termNeed > 1) rep.lines.push([`Terminal yetersiz: talebin %${Math.round(k * 100)}'ü karşılandı (Terminal fabrikası)`, 0]);
    const net = network();
    let revenue = net.revenue;
    if (state.solarSafe === state.week) revenue *= 0.6;
    if (revenue > 0) rep.lines.push([`Abonelik geliri (${(net.users / 1000).toFixed(2)} M abone${net.latencyBonus > 1e5 ? ', düşük gecikme primi dahil' : ''})`, revenue]);
    state.money += revenue;
    // giderler
    let up = 0;
    for (const [id, lv] of Object.entries(state.facilities)) { const F = FACILITIES[id]; if (F && lv) up += F.levels[lv - 1].up; }
    for (const lv of Object.values(state.stations)) up += GS_UP * lv;
    if (up) { state.money -= up; rep.lines.push(['Tesis ve istasyon giderleri', -up]); }
    for (const c of state.accepted.slice()) if (c.expires < state.week + 1) { state.money -= c.penalty; addRep(-5); rep.lines.push(['Süresi dolan sözleşme cezası: ' + c.name, -c.penalty]); state.accepted = state.accepted.filter(x => x !== c); }
    // meydan okuma (çift fırlatma)
    const ch = state.challenge;
    if (ch && !ch.done && ch.id === 'double' && (state.successThisWeek || 0) >= 2) { ch.done = true; state.money += ch.reward; rep.lines.push(['⭐ Meydan okuma: ' + ch.text, ch.reward]); }
    // halk onayı yavaşça toparlanır
    state.community = clamp(state.community + 1, 0, 100);
    // tarih
    state.history.push({ w: state.week, money: state.money, rev: revenue, users: net.users, sats: totalSats(), rep: state.reputation, rivals: state.rivals.map(r => r.sats), launches: state.stats.launches });
    if (state.history.length > 600) state.history.shift();
    // yeni hafta
    state.week++;
    recomputeShells();
    state.depot = Math.max(0, state.depot * 0.985);
    state.padsUsed = {};
    state.launchesThisWeek = 0; state.successThisWeek = 0;
    state.weather = genWeather(state);
    state.contracts = genContracts(state);
    if (!state.challenge || state.challenge.done || state.week - state.challenge.week >= 1) state.challenge = genChallenge(state);
    maybeEvent();
    if (state.money < 8 * M && state.week - (state.lastBridge || -99) >= 3) { state.lastBridge = state.week; state.money += 25 * M; state.ownership *= 0.99; rep.lines.push(['Acil yatırımcı köprü kredisi (hisse −%1)', 25 * M]); log('Kasa boşaldı — yatırımcılar $25 M köprü kredisi verdi (hisse −%1)', 'bad'); }
    rep.network = net;
    rep.event = state.pendingEvent;
    rep.won = checkWin();
    state.lastWeekly = rep;
    save();
    return rep;
  }
  function markSuccess() { state.successThisWeek = (state.successThisWeek || 0) + 1; }
  function acceptContract(id) {
    const c = state.contracts.find(x => x.id === id); if (!c) return false;
    state.contracts = state.contracts.filter(x => x !== c);
    c.advance = Math.round(c.reward * 0.3 / 1e5) * 1e5; state.money += c.advance;
    state.accepted.push(c); log('Sözleşme kabul edildi: ' + c.name + ' (avans ' + (c.advance / M).toFixed(1) + ' M$)', ''); save(); return true;
  }
  function setSel(o) { Object.assign(state.sel, o); save(); }

  /* ---------------- Danışman ---------------- */
  function advice() {
    const out = [], st = state, net = network();
    const sel = st.sel, info = ROCKET_INFO[sel.rocket];
    const ready = readyCores(info.core).length, pending = st.fleet.some(c => c.type === info.core && (c.status === 'building' || c.status === 'refurb'));
    if (st.pendingEvent) out.push(`Karar bekleyen olay: <b>${st.pendingEvent.title}</b> — haftayı bitirmeden önce yanıtla.`);
    if (!st.stats.launches) out.push('İlk adım: <b>Sözleşmeler</b> sekmesinden "Teknoloji gösterimi" teklifini kabul et (%30 avans), sonra Falcon 1 ile fırlat.');
    if (ready < info.cores && !pending) out.push(`Hazır ${CORE_INFO[info.core].name} yok — <b>Filo</b> sekmesinden ya da aşağıdaki düğmeyle sipariş ver.`);
    if (st.stats.success.f1 < 2) out.push(`Falcon 1 ile <b>${2 - st.stats.success.f1}</b> başarılı uçuş daha → Ar-Ge'de <b>Izgara kanatçıkları</b> açılır.`);
    if (!st.rqueue.length) {
      const cand = RESEARCH.filter(r => !has(r.id) && reqStatus(r).length === 0);
      if (cand.length) { const c = cand.sort((a, b) => a.cost - b.cost)[0]; out.push(`Araştırma laboratuvarı boşta: <b>${c.name}</b> (${(c.cost / M).toFixed(0)} M$, ~${researchWeeks(c.id)} hafta)${st.money < c.cost ? ' — bütçe yetmiyor' : ''}.`); }
    }
    if (has('r_f9') && !fac('engineFab')) out.push('Falcon 9 booster\'ı 9 Merlin ister: <b>Tesisler</b>\'den <b>Motor fabrikası</b> kur.');
    if (has('u_v09') && !fac('satFab')) out.push('Starlink açıldı: <b>Tesisler</b> sekmesinden <b>Uydu fabrikası</b> kur.');
    if (totalSats() > 0 && !fac('terminalFab')) out.push('Abone kazanmak için anten gerekli: <b>Terminal fabrikası</b> kur.');
    if (totalSats() > 0 && !Object.keys(st.stations).length) out.push('Uyduların hizmet verebilmesi için <b>Ağ</b> sekmesinden bir yer istasyonu kur.');
    if (net.capLimited) out.push('Ağ <b>kapasite sınırında</b>: daha çok ya da daha yeni nesil uydu fırlat.');
    const unl = net.regions.filter(r => r.lic && !st.licenses[r.id] && r.cov > 0.2);
    if (unl.length) out.push(`Kapsamada ama lisanssız: <b>${unl[0].name}</b> — Ağ sekmesinden lisans başvurusu yap.`);
    const oceanCov = net.regions.filter(r => !r.land && r.cov > 0.3 && r.conn === 0);
    if (oceanCov.length && !has('u_v15')) out.push('Okyanuslar kapsamada ama bağlantı yok: <b>Starlink v1.5 (lazer)</b> ya da <b>GEO röle</b> araştır.');
    const w = st.weather[info.site === 'starbase' ? 'starbase' : 'cape'];
    if (w.storm) out.push('Bu hafta fırtına var — fırlatma yapılamaz, haftayı bitir.');
    else if (w.jet > 50) out.push(`Bu hafta jet akımı çok güçlü (${w.jet} m/s) — fırlatmayı ertelemeyi düşün.`);
    const exp = st.accepted.filter(c => c.expires - st.week <= 1);
    if (exp.length) out.push(`Süresi dolmak üzere sözleşme: <b>${exp[0].name}</b> (hafta ${exp[0].expires}).`);
    if (!out.length) out.push('Her şey yolunda. Fırlatmaya devam et ya da haftayı bitir.');
    return out.slice(0, 3);
  }

  /* ---------------- Serbest mod ---------------- */
  function sandboxCtx(o) {
    const rk = o.rocket, info = ROCKET_INFO[rk];
    const kind = o.payload || 'test';
    const P = { rocket: rk, ok: true, reasons: [], cost: [], total: 0, mode: o.mode || 'exp', sideMode: o.sideMode || 'rtls', payload: kind, cores: [], ship: null,
      mass: o.mass || 1000, kind: kind === 'dragon' ? 'dragon' : kind, fairing: rk !== 'ss' && kind !== 'dragon', desc: 'Serbest uçuş', risks: [], weather: o.weather, site: info.site, shipReturn: !!o.shipReturn && rk === 'ss' && o.mode === 'catch' };
    const w = o.weather;
    return {
      sandbox: true, plan: P, week: 0, hour: w.hour, site: info.site, weather: w, flights: {},
      simOpts: { mode: P.mode, sideMode: P.sideMode, payloadMass: P.mass, payloadKind: P.kind, fairing: P.fairing, targetAlt: o.targetAp ? undefined : 300000, targetAp: o.targetAp || undefined, sats: kind === 'starlink' ? Math.round(P.mass / 260) : 0,
        shipReturn: P.shipReturn, fairingRec: !!o.fairingRec, waves: w.waves, wind: { s: w.wind * (w.windDir || 1), j: w.jet }, engineFail: o.engineFail ? { t: 40, part: 'booster', count: 1 } : null,
        manualLanding: !!o.manualLanding, autopilot: o.autopilot !== false, autoLand: !!o.autoLand && !o.manualLanding, tipOver: false, burnThrough: false, deorbitUpper: true },
      padDamage: false, tileLoss: 0, hold: null,
    };
  }

  /* ---------------- Eğitim ---------------- */
  function tutorialAdvance(step) { if (step > state.tutorial.step) { state.tutorial.step = step; save(); } }

  global.PROG = {
    M, DIFFICULTY, SAT_GENS, GEN_ORDER, SHELLS, REGIONS, REGION_BY_ID, SECTORS, PRICES, STATION_CAP, STATION_UP_COST, ROCKET_INFO, CORE_INFO, RESEARCH, RESEARCH_BY_ID, BRANCHES, FACILITIES, ACHIEVEMENTS, CONTRACT_TYPES, RIVALS, POLICY, FUNDING,
    GS_COST, RELAY_SAT_COST, ENGINEER_SALARY, ENGINEER_HIRE,
    get state() { return state; }, load, save, reset, importState, newState, weekLabel, yearOf,
    winShare: () => D().share, stockCap, has, fac, totalSats, raisingSats, currentGen, reqStatus, canResearch, doResearch, researchSlots, researchRate, researchWeeks, hireEngineers,
    facilityNext, buildFacility, satRate, terminalRate, engineRate, refurbWeeks, coreOrderInfo, orderCore, readyCores, renameCore, enginesOk,
    network, buildStation, upgradeStation, applyLicense, setPrice, licensed, availableModes, payloadTypes, plan, commit, abortLaunch, applyResult, endWeek, markSuccess,
    advice, acceptContract, setSel, weatherRisks, failChance, maxFlights, log, resolveEvent, valuation, fundingOptions, raiseFunding, communityInvest, marsWindow,
    sandboxCtx, tutorialAdvance, recomputeShells,
  };
})(typeof window !== 'undefined' ? window : globalThis);
