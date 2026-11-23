/* =====================================================================
   Kontrol merkezi (hangar) arayüzü: sekmeler, Ar-Ge ağacı, tesisler,
   filo, ağ haritası, sözleşmeler, başarımlar, haftalık rapor
   ===================================================================== */
window.HANGAR = (function () {
  'use strict';
  const P = window.PROG, S = window.SIM;
  const $ = id => document.getElementById(id);
  const M = 1e6;
  const money = v => (v < 0 ? '-' : '') + '$' + (Math.abs(v) >= 1e9 ? (Math.abs(v) / 1e9).toFixed(2) + ' Mr' : (Math.abs(v) / 1e6).toFixed(1) + ' M');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let tab = 'launch', hooks = {}, netImg = null, selRegion = null;

  function init(h) {
    hooks = h || {};
    $('tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; tab = b.dataset.tab; render(); });
    $('btn-week').onclick = () => {
      const rep = P.endWeek();
      showReport(rep);
      render();
      hooks.onWeek && hooks.onWeek(rep);
    };
    $('btn-rep-close').onclick = () => $('report').classList.add('hidden');
    $('btn-reset').onclick = e => { e.preventDefault(); if (confirm('Tüm ilerleme silinsin mi?')) { P.reset(); render(); hooks.onWeek && hooks.onWeek(); } };
    $('btn-help').onclick = e => { e.preventDefault(); $('help').classList.remove('hidden'); };
    $('btn-help-close').onclick = () => $('help').classList.add('hidden');
    const img = new Image(); img.onload = () => { netImg = img; if (tab === 'net') render(); }; img.src = window.TEX ? window.TEX.day : '';
  }

  function header() {
    const st = P.state, net = P.network();
    $('st-week').textContent = P.weekLabel(st.week);
    $('st-money').textContent = money(st.money);
    $('st-money').style.color = st.money < 0 ? 'var(--bad)' : '';
    $('st-rev').textContent = money(net.revenue) + '/hf';
    $('st-sats').textContent = P.totalSats() + (st.stock.sats ? ` (+${st.stock.sats} stok)` : '');
    $('st-cov').textContent = (net.userFrac * 100).toFixed(1) + '%';
    $('cov-fill').style.width = Math.min(100, net.userFrac / 0.95 * 100) + '%';
    $('cov-label').textContent = `${(net.users / 1000).toFixed(2)} M abone · hizmet %${(net.userFrac * 100).toFixed(1)} / %95`;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('sel', b.dataset.tab === tab));
  }

  function render() {
    header();
    const body = $('tab-body');
    body.classList.toggle('wide', tab === 'research');
    const f = { launch: tabLaunch, research: tabResearch, fac: tabFac, fleet: tabFleet, net: tabNet, contracts: tabContracts, ach: tabAch }[tab];
    f(body);
  }

  /* ---------------- FIRLATMA ---------------- */
  const MODE_DESC = { exp: 'Booster kurtarılmaz', ocean: 'Okyanusa kontrollü iniş (test, booster batar)', rtls: 'Rampaya dönüş — LZ', asds: 'Drone gemiye iniş', catch: 'Kule kollarıyla yakalama' };
  const PT_NAME = { test: 'Test yükü', starlink: 'Starlink uyduları', relay: 'GEO röle uydusu', contract: 'Sözleşme yükü' };
  function tabLaunch(body) {
    const st = P.state, sel = st.sel;
    const rockets = Object.entries(P.ROCKET_INFO);
    const plan = P.plan();
    sel.rocket = plan.rocket;
    let h = '<h3>Roket</h3><div class="cards">';
    for (const [k, I] of rockets) {
      const un = k === 'f1' || P.has(I.research);
      const ready = P.readyCores(I.core).length;
      h += `<div class="card ${sel.rocket === k ? 'sel' : ''} ${un ? '' : 'locked'}" data-rocket="${k}"><b>${I.name}</b><small>${un ? `Hazır booster: ${ready}/${I.cores}` : '🔒 Ar-Ge gerekli'}</small><small>Başarılı: ${st.stats.success[k] || 0}</small></div>`;
    }
    h += '</div>';
    h += `<p class="muted" style="font-size:12px;margin:6px 0">${esc(P.ROCKET_INFO[plan.rocket].desc)}</p>`;
    // yük
    h += '<h3>Yük</h3><div class="cards">';
    for (const t of plan.ptypes) h += `<div class="card ${plan.payload === t ? 'sel' : ''}" data-payload="${t}"><b>${PT_NAME[t]}</b><small>${t === 'starlink' ? `Stok: ${st.stock.sats} × ${P.SAT_GENS[P.currentGen()].name}` : t === 'relay' ? `Uydu ${money(P.RELAY_SAT_COST)}` : t === 'contract' ? `${st.accepted.length} kabul edilmiş` : 'Kütle simülatörü'}</small></div>`;
    h += '</div>';
    if (plan.payload === 'starlink') {
      h += '<h3>Yörünge kabuğu</h3><div class="cards">';
      for (const [k, sh] of Object.entries(P.SHELLS)) {
        const ok = k === 's53' || P.has('u_polar');
        h += `<div class="card ${plan.shell === k ? 'sel' : ''} ${ok ? '' : 'locked'}" data-shell="${k}"><b>${sh.inc}°</b><small>${esc(sh.name)}</small><small>Yük çarpanı ×${sh.factor}</small></div>`;
      }
      h += '</div>';
    }
    if (plan.payload === 'relay') {
      h += '<h3>Röle sektörü</h3><div class="cards">';
      for (const [k, n] of Object.entries(P.SECTORS)) h += `<div class="card ${plan.relaySector === k ? 'sel' : ''}" data-sector="${k}"><b>${n}</b><small>Mevcut röle: ${st.relays[k] || 0}</small></div>`;
      h += '</div>';
    }
    if (plan.payload === 'contract' && plan.contractList) {
      h += '<h3>Sözleşme</h3><div class="cards">';
      for (const c of plan.contractList) h += `<div class="card ${plan.contract && plan.contract.id === c.id ? 'sel' : ''}" data-contract="${c.id}"><b>${esc(c.name)}</b><small>${c.mass} kg · ${money(c.reward)}</small><small>Son: hafta ${c.expires}</small></div>`;
      h += '</div>';
    }
    // kurtarma
    h += '<h3>Booster kurtarma</h3><div class="cards">';
    for (const m of plan.modes) h += `<div class="card ${plan.mode === m ? 'sel' : ''}" data-mode="${m}"><b>${S.MODE_NAMES[m]}</b><small>${MODE_DESC[m]}</small></div>`;
    h += '</div>';
    if (plan.rocket === 'fh') h += `<label class="chk"><input type="checkbox" id="o-side" ${plan.sideMode === 'rtls' ? 'checked' : ''} ${P.has('k_rtls') ? '' : 'disabled'}> Yan boosterları rampaya indir (çift iniş)</label>`;
    if (plan.rocket !== 'f1' && plan.rocket !== 'ss' && P.has('k_fairing')) h += `<label class="chk"><input type="checkbox" id="o-fair" ${plan.fairingRec ? 'checked' : ''} ${P.fac('fairingShip') ? '' : 'disabled'}> Burun konisi kurtarma (paraşüt + ağlı gemi)</label>`;
    if (plan.rocket === 'ss' && P.has('k_shipcatch')) h += `<label class="chk"><input type="checkbox" id="o-ship" ${plan.shipReturn ? 'checked' : ''} ${plan.mode === 'catch' ? '' : 'disabled'}> Ship yörüngeden dönsün ve yakalansın (yük −%38)</label>`;
    h += '<h3>Uçuş ayarları</h3>';
    h += `<label class="chk"><input type="checkbox" id="o-auto" ${st.opts.autopilot ? 'checked' : ''}> Yükseliş otopilotu</label>`;
    h += `<label class="chk"><input type="checkbox" id="o-land" ${st.opts.autoLand ? 'checked' : ''}> Otomatik iniş yanışı / yakalama (kapalıysa L ve C tuşlarıyla sen yaparsın)</label>`;
    h += `<label class="chk"><input type="checkbox" id="o-cam" ${st.opts.cinematic ? 'checked' : ''}> Sinematik kamera</label>`;
    // hava & özet
    const w = plan.weather;
    h += '<div class="row2"><div><h3>Hava durumu — ' + (plan.site === 'starbase' ? 'Starbase' : 'Cape Canaveral') + '</h3>';
    h += `<div class="wx"><div>🕑 ${String(w.hour).padStart(2, '0')}:00 ${w.hour < 6 || w.hour >= 19 ? '(gece)' : ''}</div><div>💨 Yer ${w.wind} m/s</div><div>🌀 Jet ${w.jet} m/s</div><div>🌊 Dalga ${w.waves} m</div><div>☁ %${w.cloud}</div></div>`;
    for (const r of plan.risks) h += `<div class="pill ${r.level}">${esc(r.text)}</div>`;
    if (!plan.risks.length) h += '<div class="pill good">Hava fırlatma için uygun</div>';
    h += `<div class="pill ${plan.failChance > 0.06 ? 'warn' : ''}">${plan.engineMsg}</div>`;
    h += '</div><div><h3>Görev özeti</h3>';
    h += `<div class="kv"><span>Yük</span><b>${esc(plan.desc || '—')}</b></div>`;
    h += `<div class="kv"><span>Kütle / kapasite</span><b>${Math.round(plan.mass)} kg / ${Math.round(plan.leoCap)} kg LEO</b></div>`;
    for (const c of plan.cost) h += `<div class="kv"><span>${esc(c[0])}</span><b>${c[1] ? money(c[1]) : '—'}</b></div>`;
    h += `<div class="kv total"><span>Toplam</span><b>${money(plan.total)}</b></div>`;
    if (plan.reward) h += `<div class="kv"><span>Sözleşme ödülü</span><b style="color:var(--good)">${money(plan.reward)}</b></div>`;
    h += '</div></div>';
    if (plan.reasons.length) h += '<div class="reasons">' + plan.reasons.map(r => `<div>${esc(r)}</div>`).join('') + '</div>';
    h += `<button id="b-launch" class="big-btn" ${plan.ok ? '' : 'disabled'}>🚀 FIRLAT</button>`;
    body.innerHTML = h;
    body.querySelectorAll('[data-rocket]').forEach(e => e.onclick = () => { const k = e.dataset.rocket; if (k === 'f1' || P.has(P.ROCKET_INFO[k].research)) { P.setSel({ rocket: k }); render(); hooks.onSelect && hooks.onSelect(); } });
    body.querySelectorAll('[data-payload]').forEach(e => e.onclick = () => { P.setSel({ payload: e.dataset.payload }); render(); });
    body.querySelectorAll('[data-shell]').forEach(e => e.onclick = () => { if (e.classList.contains('locked')) return; P.setSel({ shell: e.dataset.shell }); render(); });
    body.querySelectorAll('[data-sector]').forEach(e => e.onclick = () => { P.setSel({ relaySector: e.dataset.sector }); render(); });
    body.querySelectorAll('[data-contract]').forEach(e => e.onclick = () => { P.setSel({ contract: e.dataset.contract }); render(); });
    body.querySelectorAll('[data-mode]').forEach(e => e.onclick = () => { P.setSel({ mode: e.dataset.mode }); render(); });
    const chk = (id, fn) => { const el = $(id); if (el) el.onchange = () => { fn(el.checked); P.save(); render(); }; };
    chk('o-side', v => { st.sel.sideMode = v ? 'rtls' : 'exp'; });
    chk('o-fair', v => { st.sel.fairingRec = v; });
    chk('o-ship', v => { st.sel.shipReturn = v; });
    chk('o-auto', v => { st.opts.autopilot = v; });
    chk('o-land', v => { st.opts.autoLand = v; });
    chk('o-cam', v => { st.opts.cinematic = v; });
    const b = $('b-launch');
    if (b) b.onclick = () => {
      const pl = P.plan();
      if (!pl.ok) return;
      const bad = pl.risks.filter(r => r.level === 'bad');
      if (bad.length && !confirm('Hava koşulları riskli:\n' + bad.map(r => '• ' + r.text).join('\n') + '\n\nYine de fırlatılsın mı?')) return;
      const ctx = P.commit(pl);
      if (ctx && hooks.launch) hooks.launch(ctx);
    };
  }

  /* ---------------- AR-GE ---------------- */
  function tabResearch(body) {
    const byBr = {};
    for (const r of P.RESEARCH) (byBr[r.br] = byBr[r.br] || []).push(r);
    // derinlik (önkoşula göre sıralama)
    const depth = {};
    const dep = r => { if (depth[r.id] !== undefined) return depth[r.id]; const q = (r.req && r.req.research) || []; depth[r.id] = q.length ? 1 + Math.max(...q.map(id => dep(P.RESEARCH_BY_ID[id]))) : 0; return depth[r.id]; };
    P.RESEARCH.forEach(dep);
    const cols = Object.keys(P.BRANCHES);
    let h = `<div class="muted" style="font-size:12px;margin-bottom:8px">Teknolojiler para ve başarı şartı ister. Ok işaretleri önkoşulları gösterir. Bütçe: <b>${money(P.state.money)}</b></div>`;
    h += `<div class="tree" id="tree" style="grid-template-columns:repeat(${cols.length},1fr)"><svg id="tree-svg"></svg>`;
    for (const br of cols) {
      h += `<div class="tcol"><h4>${P.BRANCHES[br]}</h4>`;
      for (const r of (byBr[br] || []).sort((a, b) => depth[a.id] - depth[b.id])) {
        const c = P.canResearch(r.id);
        const cls = c.done ? 'done' : (c.miss.length ? 'locked' : 'avail');
        h += `<div class="tnode ${cls}" id="rn-${r.id}"><b>${esc(r.name)}</b><div class="d">${esc(r.desc)}</div>`;
        if (!c.done) {
          if (c.miss.length) h += `<div class="req">${c.miss.map(esc).join('<br>')}</div>`;
          h += `<button class="btn" data-res="${r.id}" ${c.ok ? '' : 'disabled'} style="margin-top:5px">Araştır · ${money(r.cost)}</button>`;
        }
        h += '</div>';
      }
      h += '</div>';
    }
    h += '</div>';
    body.innerHTML = h;
    body.querySelectorAll('[data-res]').forEach(b => b.onclick = () => { if (P.doResearch(b.dataset.res)) { render(); hooks.onResearch && hooks.onResearch(b.dataset.res); } });
    // önkoşul okları
    requestAnimationFrame(() => {
      const tree = $('tree'), svg = $('tree-svg'); if (!tree || !svg) return;
      const tb = tree.getBoundingClientRect();
      svg.setAttribute('width', tb.width); svg.setAttribute('height', tb.height);
      let paths = '';
      for (const r of P.RESEARCH) for (const q of (r.req && r.req.research) || []) {
        const a = $('rn-' + q), b = $('rn-' + r.id); if (!a || !b) continue;
        const A = a.getBoundingClientRect(), B = b.getBoundingClientRect();
        const same = Math.abs(A.left - B.left) < 5;
        const x1 = same ? A.left + 14 - tb.left : A.right - tb.left, y1 = same ? A.bottom - tb.top : A.top + A.height / 2 - tb.top;
        const x2 = same ? B.left + 14 - tb.left : B.left - tb.left, y2 = same ? B.top - tb.top : B.top + 16 - tb.top;
        const done = P.has(q);
        const d = same ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} C${x1 + 30},${y1} ${x2 - 30},${y2} ${x2},${y2}`;
        paths += `<path d="${d}" fill="none" stroke="${done ? 'rgba(62,224,143,0.55)' : 'rgba(140,180,255,0.3)'}" stroke-width="1.6" marker-end="url(#arr)"/>`;
      }
      svg.innerHTML = `<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="rgba(140,180,255,0.6)"/></marker></defs>` + paths;
    });
  }

  /* ---------------- TESİSLER ---------------- */
  function tabFac(body) {
    const st = P.state;
    let h = '<h3>Tesisler</h3><table class="tbl"><tr><th>Tesis</th><th>Seviye</th><th>Etki</th><th></th></tr>';
    for (const [id, F] of Object.entries(P.FACILITIES)) {
      const lv = P.fac(id), n = P.facilityNext(id);
      let eff = F.desc;
      if (id === 'satFab' && lv) eff = `${P.satRate()} uydu/hafta`;
      if (id === 'refurb' || id === 'satFab') { /* */ }
      if (id === 'rocketFab') eff = `Yeni booster: ${P.coreOrderInfo('f9').weeks} hafta, −%${(lv - 1) * 10} maliyet`;
      if (id === 'refurb') eff = `Bakım süresi: ${P.refurbWeeks()} hafta`;
      const btn = n ? `<button class="btn" data-fac="${id}" ${n.ok ? '' : 'disabled'}>${lv ? 'Yükselt' : 'Kur'} · ${money(n.cost)}</button>${n.locked ? '<div class="reasons"><div>Ar-Ge: ' + esc(P.RESEARCH_BY_ID[F.research].name) + '</div></div>' : ''}` : '<span class="pill good">Maks.</span>';
      h += `<tr><td><b>${esc(F.name)}</b><br><span class="muted">${esc(F.desc)}</span></td><td>${lv}/${F.levels.length}</td><td>${esc(eff)}</td><td>${btn}</td></tr>`;
    }
    h += '</table>';
    h += '<h3>Uydu üretimi</h3>';
    h += `<div class="kv"><span>Nesil</span><b>${P.SAT_GENS[P.currentGen()].name}</b></div>`;
    h += `<div class="kv"><span>Stok</span><b>${st.stock.sats} / ${P.stockCap()} (depo)</b></div>`;
    h += `<div class="kv"><span>Uydu başı maliyet</span><b>${money(P.SAT_GENS[P.currentGen()].cost)}</b></div>`;
    h += `<div class="kv"><span>Kurtarılmış burun konisi</span><b>${st.stock.fairings} yarım</b></div>`;
    h += `<label class="chk"><input type="checkbox" id="o-prod" ${st.prodPaused ? '' : 'checked'}> Üretim açık (her hafta fabrikanın kapasitesi kadar uydu üretilir ve ücreti ödenir)</label>`;
    body.innerHTML = h;
    body.querySelectorAll('[data-fac]').forEach(b => b.onclick = () => { if (P.buildFacility(b.dataset.fac)) { render(); hooks.onFacility && hooks.onFacility(b.dataset.fac); } });
    $('o-prod').onchange = e => { st.prodPaused = !e.target.checked; P.save(); };
  }

  /* ---------------- FİLO ---------------- */
  const STATUS = { ready: '<span class="pill good">Hazır</span>', building: '<span class="pill warn">Üretimde</span>', refurb: '<span class="pill warn">Bakımda</span>', flight: '<span class="pill">Uçuşta</span>', retired: '<span class="pill">Emekli</span>', lost: '<span class="pill bad">Kayıp</span>' };
  function tabFleet(body) {
    const st = P.state;
    let h = '<h3>Yeni sipariş</h3><div class="cards">';
    const types = [['f1', true], ['f9', P.has('r_f9')], ['fh', P.has('r_fh')], ['ss', P.has('r_ss')], ['ship', P.has('r_ss')]];
    for (const [t, ok] of types) {
      const o = P.coreOrderInfo(t);
      h += `<div class="card ${ok ? '' : 'locked'}"><b>${P.CORE_INFO[t].name}</b><small>${money(o.cost)} · ${o.weeks} hafta</small><button class="btn" data-order="${t}" ${ok && st.money >= o.cost ? '' : 'disabled'} style="margin-top:6px">Sipariş ver</button></div>`;
    }
    h += '</div><h3>Filo</h3><table class="tbl"><tr><th>Seri no</th><th>Tip</th><th>Uçuş</th><th>Durum</th><th>Kalan</th></tr>';
    const list = st.fleet.slice().sort((a, b) => (a.status === 'retired') - (b.status === 'retired') || b.flights - a.flights);
    for (const c of list) h += `<tr><td><b>${c.id}</b></td><td>${P.CORE_INFO[c.type].name}</td><td>${c.flights} / ${P.maxFlights(c.type === 'ship' ? 'ss' : c.type)}</td><td>${STATUS[c.status] || c.status}</td><td>${c.weeks ? c.weeks + ' hf' : ''}</td></tr>`;
    h += '</table>';
    body.innerHTML = h;
    body.querySelectorAll('[data-order]').forEach(b => b.onclick = () => { if (P.orderCore(b.dataset.order)) render(); });
  }

  /* ---------------- AĞ ---------------- */
  function tabNet(body) {
    const st = P.state, net = P.network();
    let h = `<div class="muted" style="font-size:12px">Bir bölgeye tıklayarak yer istasyonu kur (${money(P.GS_COST)}). Uydular bağlantı için yer istasyonu, lazer röle (v1.5+) ya da GEO röle uydusu ister.</div>`;
    h += '<canvas id="netmap" class="netmap" width="720" height="360"></canvas>';
    h += '<div class="legend"><span><i style="background:#3ee08f"></i>hizmet</span><span><i style="background:#ffc24a"></i>kapsama var, bağlantı zayıf</span><span><i style="background:#ff5a4f"></i>hizmet yok</span><span><i style="background:#4fc3ff"></i>yer istasyonu</span></div>';
    h += '<div id="net-info"></div>';
    h += '<div class="row2"><div><h3>Takımyıldız</h3>';
    for (const [k, sh] of Object.entries(st.shells)) {
      const n = Object.values(sh).reduce((a, b) => a + b, 0);
      h += `<div class="kv"><span>${P.SHELLS[k].name}</span><b>${n}</b></div>`;
    }
    h += `<div class="kv"><span>Toplam kapasite</span><b>${(net.capGbps / 1000).toFixed(1)} Tbps</b></div>`;
    h += `<div class="kv"><span>Lazer bağlantılı oran</span><b>%${(net.laserFrac * 100).toFixed(0)}</b></div>`;
    h += `<div class="kv"><span>GEO röleler</span><b>${Object.entries(st.relays).map(([k, v]) => P.SECTORS[k] + ': ' + v).join(' · ')}</b></div>`;
    h += '</div><div><h3>Abone & gelir</h3>';
    h += `<div class="kv"><span>Abone</span><b>${(net.users / 1000).toFixed(2)} M</b></div>`;
    h += `<div class="kv"><span>Haftalık gelir</span><b>${money(net.revenue)}</b></div>`;
    h += `<div class="kv"><span>Kapsanan talep</span><b>%${(net.servedFrac * 100).toFixed(1)}</b></div>`;
    if (net.capLimited) h += '<div class="pill warn">Kapasite sınırı! Daha fazla / daha yeni nesil uydu fırlat.</div>';
    h += '</div></div>';
    h += '<h3>Bölgeler</h3><table class="tbl"><tr><th>Bölge</th><th>Kapsama</th><th>Bağlantı</th><th>Abone</th><th></th></tr>';
    for (const r of net.regions) {
      h += `<tr><td>${esc(r.name)}</td><td>%${(r.cov * 100).toFixed(0)}</td><td>${esc(r.via)}</td><td>${(r.users / 1000).toFixed(2)} M / ${(r.demand / 1000).toFixed(1)} M</td><td>${r.station ? '📡' : r.land ? `<button class="btn" data-gs="${r.id}" ${st.money >= P.GS_COST && P.has('u_v09') ? '' : 'disabled'}>İstasyon</button>` : '<span class="muted">deniz</span>'}</td></tr>`;
    }
    h += '</table>';
    body.innerHTML = h;
    body.querySelectorAll('[data-gs]').forEach(b => b.onclick = () => { if (P.buildStation(b.dataset.gs)) { render(); hooks.onStation && hooks.onStation(); } });
    drawNetMap(net);
    const cv = $('netmap');
    cv.onclick = e => {
      const rc = cv.getBoundingClientRect();
      const lon = (e.clientX - rc.left) / rc.width * 360 - 180, lat = 90 - (e.clientY - rc.top) / rc.height * 180;
      let best = null, bd = 1e9;
      for (const r of net.regions) { const d = Math.hypot((r.lon - lon) * Math.cos(r.lat * Math.PI / 180), r.lat - lat); if (d < r.r && d < bd) { bd = d; best = r; } }
      selRegion = best ? best.id : null;
      showRegion(net);
      drawNetMap(net);
    };
    showRegion(net);
  }
  function showRegion(net) {
    const el = $('net-info'); if (!el) return;
    const r = net.regions.find(x => x.id === selRegion);
    if (!r) { el.innerHTML = ''; return; }
    const st = P.state;
    el.innerHTML = `<div class="kv"><span><b>${esc(r.name)}</b> — kapsama %${(r.cov * 100).toFixed(0)}, bağlantı: ${esc(r.via)}, abone ${(r.users / 1000).toFixed(2)} M</span>${r.station ? '<b>📡 istasyon var</b>' : r.land ? `<button class="btn good" id="gs-sel" ${st.money >= P.GS_COST && P.has('u_v09') ? '' : 'disabled'}>Yer istasyonu kur · ${money(P.GS_COST)}</button>` : '<b class="muted">Okyanus — lazer veya GEO röle gerekir</b>'}</div>`;
    const b = $('gs-sel'); if (b) b.onclick = () => { if (P.buildStation(r.id)) { render(); hooks.onStation && hooks.onStation(); } };
  }
  function drawNetMap(net) {
    const cv = $('netmap'); if (!cv) return;
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    g.fillStyle = '#02060c'; g.fillRect(0, 0, W, H);
    if (netImg) { g.globalAlpha = 0.85; g.drawImage(netImg, 0, 0, W, H); g.globalAlpha = 1; }
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, W, H);
    const X = lon => (lon + 180) / 360 * W, Y = lat => (90 - lat) / 180 * H;
    // kabuk enlem sınırları
    g.setLineDash([4, 4]); g.lineWidth = 1;
    for (const [k, sh] of Object.entries(P.state.shells)) {
      const n = Object.values(sh).reduce((a, b) => a + b, 0); if (!n) continue;
      const inc = P.SHELLS[k].inc; if (inc > 90) continue;
      g.strokeStyle = 'rgba(79,195,255,0.45)';
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, Y(s * inc)); g.lineTo(W, Y(s * inc)); g.stroke(); }
    }
    g.setLineDash([]);
    for (const r of net.regions) {
      const col = r.served > 0.5 ? '62,224,143' : r.cov > 0.15 ? '255,194,74' : '255,90,79';
      const rx = r.r / 360 * W / Math.max(0.35, Math.cos(r.lat * Math.PI / 180)), ry = r.r / 180 * H;
      g.beginPath(); g.ellipse(X(r.lon), Y(r.lat), rx, ry, 0, 0, Math.PI * 2);
      g.fillStyle = `rgba(${col},${0.15 + 0.35 * Math.max(r.served, r.cov * 0.5)})`; g.fill();
      g.strokeStyle = r.id === selRegion ? '#fff' : `rgba(${col},0.9)`; g.lineWidth = r.id === selRegion ? 2.5 : 1.2; g.stroke();
      if (r.station) { g.fillStyle = '#4fc3ff'; g.beginPath(); g.arc(X(r.lon), Y(r.lat), 5, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#fff'; g.stroke(); }
      g.fillStyle = '#e6edf7'; g.font = '10px sans-serif'; g.textAlign = 'center';
      g.fillText(r.name.split(' ')[0], X(r.lon), Y(r.lat) + ry + 10 > H ? Y(r.lat) - ry - 3 : Y(r.lat) + 3 + (r.station ? 12 : 0));
    }
    // GEO röleler
    const relayLon = { am: -75, emea: 15, apac: 120 };
    for (const [k, n] of Object.entries(P.state.relays)) if (n) { g.fillStyle = '#ffd36b'; g.font = 'bold 13px sans-serif'; g.fillText('◆ GEO×' + n, X(relayLon[k]), 14); }
  }

  /* ---------------- SÖZLEŞMELER ---------------- */
  function tabContracts(body) {
    const st = P.state;
    let h = '<h3>Teklifler</h3><table class="tbl"><tr><th>Sözleşme</th><th>Roket</th><th>Kütle</th><th>Ödül</th><th>Son hafta</th><th></th></tr>';
    for (const c of st.contracts) {
      const T = P.CONTRACT_TYPES[c.type];
      h += `<tr><td><b>${esc(c.name)}</b><br><span class="muted">%30 avans, başarısızlıkta ${money(c.penalty)} ceza</span></td><td>${T.rockets.map(k => P.ROCKET_INFO[k].name).join(', ')}</td><td>${c.mass} kg${T.orbit === 'gto' ? ' GTO' : T.orbit === 'iss' ? ' ISS' : ' LEO'}</td><td>${money(c.reward)}</td><td>${c.expires}</td><td><button class="btn good" data-acc="${c.id}">Kabul et</button></td></tr>`;
    }
    if (!st.contracts.length) h += '<tr><td colspan="6" class="muted">Bu hafta teklif yok.</td></tr>';
    h += '</table><h3>Kabul edilenler</h3><table class="tbl"><tr><th>Sözleşme</th><th>Kütle</th><th>Ödül</th><th>Son hafta</th></tr>';
    for (const c of st.accepted) h += `<tr><td>${esc(c.name)}</td><td>${c.mass} kg</td><td>${money(c.reward)}</td><td>${c.expires}</td></tr>`;
    if (!st.accepted.length) h += '<tr><td colspan="4" class="muted">Yok</td></tr>';
    h += '</table><h3>Günlük</h3>' + st.log.slice(0, 25).map(l => `<div class="kv"><span>Hafta ${l.w}</span><b style="font-weight:400;color:${l.kind === 'good' ? 'var(--good)' : l.kind === 'bad' ? '#ff9a92' : 'inherit'}">${esc(l.text)}</b></div>`).join('');
    body.innerHTML = h;
    body.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => { P.acceptContract(b.dataset.acc); render(); });
  }

  /* ---------------- BAŞARIMLAR ---------------- */
  function tabAch(body) {
    const st = P.state;
    let h = '<div class="ach">';
    for (const a of P.ACHIEVEMENTS) h += `<div class="${st.achievements[a.id] ? 'on' : ''}"><b>${st.achievements[a.id] ? '🏆' : '🔒'} ${esc(a.name)}</b>${esc(a.desc)}${st.achievements[a.id] ? `<br><span class="muted">Hafta ${st.achievements[a.id]}</span>` : ''}</div>`;
    h += '</div><h3>İstatistikler</h3>';
    const s = st.stats;
    for (const [k, v] of [['Fırlatma', s.launches], ['Başarısız', s.fails], ['Booster inişi', s.landings], ['Okyanus testleri', s.splash], ['Kule yakalama', s.catches], ['Ship yakalama', s.shipCatches], ['Kurtarılan burun konisi', s.fairings]]) h += `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
    body.innerHTML = h;
  }

  /* ---------------- Raporlar ---------------- */
  function showReport(rep) {
    $('rep-title').textContent = (rep.won ? '🌍 DÜNYA BAĞLANDI! — ' : '') + 'Haftalık rapor: ' + P.weekLabel(rep.week);
    const lines = rep.lines.slice();
    const net = lines.reduce((a, l) => a + l[1], 0);
    $('rep-lines').innerHTML = (lines.length ? lines : [['Sakin bir hafta', 0]]).map(l => `<div><span>${esc(l[0])}</span><b class="${l[1] > 0 ? 'pos' : l[1] < 0 ? 'neg' : ''}">${l[1] ? (l[1] > 0 ? '+' : '') + money(l[1]) : ''}</b></div>`).join('') +
      `<div class="total"><span>Net</span><b class="${net >= 0 ? 'pos' : 'neg'}">${(net >= 0 ? '+' : '') + money(net)}</b></div>`;
    $('report').classList.remove('hidden');
  }
  function showResult(r, applied, title) {
    $('res-title').textContent = title || (r.ok ? 'GÖREV BAŞARILI' : 'GÖREV BAŞARISIZ');
    $('res-title').className = r.ok ? 'good' : 'bad';
    $('res-sub').textContent = r.ok ? (r.orbit ? `Yörünge: ${(r.orbit.pe / 1000).toFixed(0)} × ${(r.orbit.ap / 1000).toFixed(0)} km` : '') : (r.reason || '');
    $('res-lines').innerHTML = applied.lines.map(l => `<div class="${l[2] === 'total' ? 'total' : ''}"><span>${esc(l[0])}</span><b class="${l[1] > 0 ? 'pos' : l[1] < 0 ? 'neg' : ''}">${l[1] ? (l[1] > 0 ? '+' : '') + money(l[1]) : ''}</b></div>`).join('');
    $('result').classList.remove('hidden');
  }

  return { init, render, showResult, money };
})();
