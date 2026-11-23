/* =====================================================================
   Kontrol merkezi (hangar) arayüzü v3
   Sekmeler: Fırlatma, Ar-Ge, Tesisler, Filo, Ağ, Sözleşmeler, Finans,
   İstatistik, Serbest mod, Başarımlar + olay kartı, yeni oyun, bulut kaydı
   ===================================================================== */
window.HANGAR = (function () {
  'use strict';
  const P = window.PROG, S = window.SIM;
  const $ = id => document.getElementById(id);
  const M = 1e6;
  const money = v => (v < 0 ? '-' : '') + '$' + (Math.abs(v) >= 1e9 ? (Math.abs(v) / 1e9).toFixed(2) + ' Mr' : (Math.abs(v) / 1e6).toFixed(1) + ' M');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pct = v => '%' + (v * 100).toFixed(1);
  let tab = 'launch', hooks = {}, netImg = null, selRegion = null, sandbox = null, fleetSel = null;
  const API = (location.protocol === 'http:' || location.protocol === 'https:') ? 'api/' : null;

  function init(h) {
    hooks = h || {};
    $('tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; tab = b.dataset.tab; render(); });
    $('btn-week').onclick = () => {
      if (P.state.pendingEvent) { showEvent(); return; }
      const rep = P.endWeek();
      if (rep.blocked) { showEvent(); return; }
      showReport(rep);
      render();
      hooks.onWeek && hooks.onWeek(rep);
      window.TUT && window.TUT.ping('week');
    };
    $('btn-rep-close').onclick = () => { $('report').classList.add('hidden'); if (P.state.pendingEvent) showEvent(); };
    $('btn-reset').onclick = e => { e.preventDefault(); $('newgame').classList.remove('hidden'); };
    document.querySelectorAll('#newgame [data-diff]').forEach(b => b.onclick = () => { P.reset(b.dataset.diff); $('newgame').classList.add('hidden'); render(); hooks.onWeek && hooks.onWeek(); });
    $('btn-ng-cancel').onclick = () => { $('newgame').classList.add('hidden'); render(); };
    $('btn-help').onclick = e => { e.preventDefault(); $('help').classList.remove('hidden'); };
    $('btn-export').onclick = e => {
      e.preventDefault();
      const blob = new Blob([JSON.stringify(P.state)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'yorunge-agi-kayit-hafta' + P.state.week + '.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    $('btn-import').onclick = e => { e.preventDefault(); $('file-import').click(); };
    $('file-import').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(t => { if (P.importState(t)) { render(); hooks.onWeek && hooks.onWeek(); alert('Kayıt yüklendi.'); } else alert('Geçersiz kayıt dosyası.'); });
      e.target.value = '';
    };
    $('btn-help-close').onclick = () => { $('help').classList.add('hidden'); if (!P.state.stats.launches && !P.state.tutorialAsked) { P.state.tutorialAsked = true; P.save(); $('newgame').classList.remove('hidden'); } };
    const img = new Image(); img.onload = () => { netImg = img; if (tab === 'net') render(); }; img.src = window.TEX ? window.TEX.day : '';
  }

  function header() {
    const st = P.state, net = P.network();
    $('st-week').textContent = P.weekLabel(st.week);
    $('st-money').textContent = money(st.money);
    $('st-money').style.color = st.money < 0 ? 'var(--bad)' : '';
    $('st-rev').textContent = money(net.revenue) + '/hf';
    $('st-sats').textContent = P.totalSats() + (P.raisingSats() ? ` (+${P.raisingSats()} yükselişte)` : '') + (st.stock.sats ? ` · ${st.stock.sats} stok` : '');
    $('st-cov').textContent = `${pct(net.servedFrac)} / ${pct(net.userFrac)}`;
    const share = P.winShare();
    const prog = Math.min(net.servedFrac / 0.95, net.userFrac / share);
    $('cov-fill').style.width = Math.min(100, prog * 100) + '%';
    $('cov-label').textContent = `Kapsama ${pct(net.servedFrac)} / %95 · Abone ${pct(net.userFrac)} / %${Math.round(share * 100)} (${(net.users / 1000).toFixed(2)} M)`;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('sel', b.dataset.tab === tab));
    $('btn-week').classList.toggle('pulse', !!st.pendingEvent);
    $('btn-week').textContent = st.pendingEvent ? '⚠ Olayı yanıtla' : 'Haftayı bitir ▶';
  }

  function render() {
    header();
    const body = $('tab-body');
    body.classList.toggle('wide', tab === 'research' || tab === 'stats');
    const f = { launch: tabLaunch, research: tabResearch, fac: tabFac, fleet: tabFleet, net: tabNet, contracts: tabContracts, finance: tabFinance, stats: tabStats, sandbox: tabSandbox, ach: tabAch }[tab] || tabLaunch;
    f(body);
    $('preview').classList.toggle('hidden', tab !== 'launch' && tab !== 'sandbox');
    window.TUT && window.TUT.update(tab);
  }

  /* ---------------- FIRLATMA ---------------- */
  const MODE_DESC = { exp: 'Booster kurtarılmaz', ocean: 'Okyanusa kontrollü iniş (test, booster batar)', rtls: 'Rampaya dönüş — LZ', asds: 'Drone gemiye iniş', catch: 'Kule kollarıyla yakalama' };
  const PT_NAME = { test: 'Test yükü', starlink: 'Starlink uyduları', relay: 'GEO röle uydusu', contract: 'Sözleşme yükü', tanker: 'Yakıt tankeri', moon: '🌕 Ay görevi', mars: '🔴 Mars görevi' };
  function tabLaunch(body) {
    const st = P.state, sel = st.sel;
    const rockets = Object.entries(P.ROCKET_INFO);
    const plan = P.plan();
    sel.rocket = plan.rocket;
    let h = '<div class="advisor"><div class="adv-title">🧭 Danışman</div>' + P.advice().map(t => `<div>• ${t}</div>`).join('') + '</div>';
    const ch = st.challenge;
    if (ch) h += `<div class="challenge ${ch.done ? 'done' : ''}">⭐ <b>Haftanın meydan okuması:</b> ${esc(ch.text)} — ${ch.done ? 'tamamlandı ✓' : money(ch.reward)}</div>`;
    h += '<h3>Roket</h3><div class="cards">';
    for (const [k, I] of rockets) {
      const un = k === 'f1' || P.has(I.research);
      const ready = P.readyCores(I.core).length;
      const ban = st.faaBan[I.family] > st.week;
      h += `<div class="card ${sel.rocket === k ? 'sel' : ''} ${un ? '' : 'locked'}" data-rocket="${k}"><b>${I.name}</b><small>${un ? `Hazır booster: ${ready}/${I.cores}` : '🔒 Ar-Ge gerekli'}</small><small>${ban ? '⚠ Soruşturma' : 'Başarılı: ' + (st.stats.success[k] || 0)}</small></div>`;
    }
    h += '</div>';
    h += `<p class="muted" style="font-size:12px;margin:6px 0">${esc(P.ROCKET_INFO[plan.rocket].desc)}</p>`;
    h += '<h3>Yük</h3><div class="cards">';
    for (const t of plan.ptypes) {
      const sub = t === 'starlink' ? `Stok: ${st.stock.sats} × ${P.SAT_GENS[P.currentGen()].name}` : t === 'relay' ? `Uydu ${money(P.RELAY_SAT_COST)}` : t === 'contract' ? `${st.accepted.length} kabul edilmiş` : t === 'tanker' ? `Depo: ${Math.round(st.depot)} t` : t === 'moon' ? '400 t depo yakıtı' : t === 'mars' ? (P.marsWindow(st.week) ? 'Pencere AÇIK · 800 t' : 'Pencere kapalı') : 'Kütle simülatörü';
      h += `<div class="card ${plan.payload === t ? 'sel' : ''}" data-payload="${t}"><b>${PT_NAME[t]}</b><small>${sub}</small></div>`;
    }
    h += '</div>';
    if (plan.payload === 'starlink') {
      h += '<h3>Yörünge kabuğu</h3><div class="cards">';
      for (const [k, sh] of Object.entries(P.SHELLS)) {
        const ok = k === 's53' || P.has('u_polar');
        h += `<div class="card ${plan.shell === k ? 'sel' : ''} ${ok ? '' : 'locked'}" data-shell="${k}"><b>${sh.inc}°</b><small>${esc(sh.name)}</small><small>Yük ×${sh.factor} · enkaz ${Math.round(st.debris[k])}</small></div>`;
      }
      h += '</div>';
      if (plan.rocket !== 'ss') h += `<label class="chk"><input type="checkbox" id="o-ride" ${plan.rideshare ? 'checked' : ''}> Paylaşımlı yük: kapasitenin %15'ini müşteri uydularına sat (+${money((plan.leoCap * 0.15) * 5000)})</label>`;
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
    h += '<h3>Booster kurtarma</h3><div class="cards">';
    for (const m of plan.modes) h += `<div class="card ${plan.mode === m ? 'sel' : ''}" data-mode="${m}"><b>${S.MODE_NAMES[m]}</b><small>${MODE_DESC[m]}</small></div>`;
    h += '</div>';
    if (plan.rocket === 'fh') h += `<label class="chk"><input type="checkbox" id="o-side" ${plan.sideMode === 'rtls' ? 'checked' : ''} ${P.has('k_rtls') ? '' : 'disabled'}> Yan boosterları rampaya indir (çift iniş)</label>`;
    if (plan.rocket !== 'f1' && plan.rocket !== 'ss' && P.has('k_fairing')) h += `<label class="chk"><input type="checkbox" id="o-fair" ${plan.fairingRec ? 'checked' : ''} ${P.fac('fairingShip') ? '' : 'disabled'}> Burun konisi kurtarma (paraşüt + ağlı gemi)</label>`;
    if (plan.rocket === 'ss' && P.has('k_shipcatch')) h += `<label class="chk"><input type="checkbox" id="o-ship" ${plan.shipReturn ? 'checked' : ''} ${plan.mode === 'catch' ? '' : 'disabled'}> Ship yörüngeden dönsün ve yakalansın (yük −%38)</label>`;
    if (plan.rocket === 'f9' || plan.rocket === 'fh') h += `<label class="chk"><input type="checkbox" id="o-deorb" ${plan.deorbitUpper ? 'checked' : ''}> Üst kademeyi yörüngeden indir (yük −%4, uzay çöpü oluşmaz)</label>`;
    if (plan.rocket !== 'f1') h += `<label class="chk"><input type="checkbox" id="o-ins" ${plan.insure ? 'checked' : ''}> Fırlatma sigortası — prim ${money(plan.premium)}, teminat ${money(plan.insValue)}</label>`;
    h += '<h3>Uçuş ayarları</h3>';
    h += `<label class="chk"><input type="checkbox" id="o-auto" ${st.opts.autopilot ? 'checked' : ''}> Yükseliş otopilotu</label>`;
    h += `<label class="chk"><input type="checkbox" id="o-land" ${st.opts.autoLand ? 'checked' : ''} ${plan.manualLanding ? 'disabled' : ''}> Otomatik iniş yanışı / yakalama (kapalıysa L ve C tuşlarıyla sen yaparsın)</label>`;
    if (plan.mode !== 'exp') h += `<label class="chk"><input type="checkbox" id="o-man" ${sel.manualLanding ? 'checked' : ''}> 🕹 Elle iniş modu: son 3 km'de gaz (W/S) ve yönelim (A/D) tamamen sende (+$2 M bonus)</label>`;
    h += `<label class="chk"><input type="checkbox" id="o-cam" ${st.opts.cinematic ? 'checked' : ''}> Sinematik kamera</label>`;
    h += `<label class="chk"><input type="checkbox" id="o-voice" ${st.opts.voice !== false ? 'checked' : ''}> Sesli geri sayım ve anonslar</label>`;
    h += `<label class="chk"><input type="checkbox" id="o-bc" ${st.opts.broadcast !== false ? 'checked' : ''}> Canlı yayın telemetri şeridi</label>`;
    const q = st.opts.quality || 'high';
    h += `<div class="chk">Grafik kalitesi: ${['low', 'med', 'high', 'ultra'].map(k => `<button class="btn ${q === k ? 'good' : ''}" data-q="${k}" style="padding:3px 9px">${{ low: 'Düşük', med: 'Orta', high: 'Yüksek', ultra: 'Ultra' }[k]}</button>`).join(' ')} <label style="margin-left:8px"><input type="checkbox" id="o-snd" ${st.opts.muted ? '' : 'checked'}> Ses</label></div>`;
    const w = plan.weather;
    h += '<div class="row2"><div><h3>Hava durumu — ' + (plan.site === 'starbase' ? 'Starbase' : 'Cape Canaveral') + '</h3>';
    h += `<div class="wx"><div>🕑 ${String(w.hour).padStart(2, '0')}:00 ${w.hour < 6 || w.hour >= 19 ? '(gece)' : ''}</div><div>💨 Yer ${w.wind} m/s</div><div>🌀 Jet ${w.jet} m/s</div><div>🌊 Dalga ${w.waves} m</div><div>${w.storm ? '⛈ Fırtına' : w.rain ? '🌧 Yağmur' : w.fog ? '🌫 Sis' : '☁'} %${w.cloud}</div></div>`;
    for (const r of plan.risks) h += `<div class="pill ${r.level}">${esc(r.text)}</div>`;
    if (!plan.risks.length) h += '<div class="pill good">Hava fırlatma için uygun</div>';
    else h += `<div><button class="btn" id="b-scrub" ${(st.scrubs || 0) < P.SCRUB_MAX && st.money >= P.SCRUB_COST ? '' : 'disabled'}>⏭ Pencereyi 24 saat ertele (${money(P.SCRUB_COST)} · ${P.SCRUB_MAX - (st.scrubs || 0)} hak)</button></div>`;
    h += `<div class="pill ${plan.failChance > 0.06 ? 'warn' : ''}">${plan.engineMsg}</div>`;
    h += `<div class="pill">Motor stoku: ${st.stock.merlin} Merlin${P.has('r_raptor') ? ` · ${st.stock.raptor} Raptor` : ''}</div>`;
    h += '</div><div><h3>Görev özeti</h3>';
    h += `<div class="kv"><span>Yük</span><b>${esc(plan.desc || '—')}</b></div>`;
    h += `<div class="kv"><span>Kütle / kapasite</span><b>${Math.round(plan.mass)} kg / ${Math.round(plan.leoCap)} kg LEO</b></div>`;
    for (const c of plan.cost) h += `<div class="kv"><span>${esc(c[0])}</span><b>${c[1] ? money(c[1]) : '—'}</b></div>`;
    h += `<div class="kv total"><span>Toplam</span><b>${money(plan.total)}</b></div>`;
    if (plan.reward) h += `<div class="kv"><span>Sözleşme ödülü</span><b style="color:var(--good)">${money(plan.reward)}</b></div>`;
    h += '</div></div>';
    if (plan.reasons.length) h += '<div class="reasons">' + plan.reasons.map(r => `<div>${esc(r)}</div>`).join('') + '</div>';
    const I0 = P.ROCKET_INFO[plan.rocket];
    const needCore = P.readyCores(I0.core).length < I0.cores, needShip = plan.rocket === 'ss' && !P.readyCores('ship').length;
    if (needCore || needShip) {
      const t = needCore ? I0.core : 'ship', o = P.coreOrderInfo(t);
      const eng = Object.entries(o.engines).map(([k, n]) => `${n} ${k === 'merlin' ? 'Merlin' : 'Raptor'}`).join(', ');
      h += `<button class="btn warn" id="b-order" style="margin-top:6px" ${st.money >= o.cost && P.enginesOk(o.engines) ? '' : 'disabled'}>${esc(P.CORE_INFO[t].name)} sipariş et · ${money(o.cost)} · ${o.weeks} hafta · ${eng}</button>`;
    }
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
    chk('o-ride', v => { st.sel.rideshare = v; });
    chk('o-deorb', v => { st.sel.deorbitUpper = v; });
    chk('o-ins', v => { st.sel.insure = v; });
    chk('o-man', v => { st.sel.manualLanding = v; });
    chk('o-auto', v => { st.opts.autopilot = v; });
    chk('o-land', v => { st.opts.autoLand = v; });
    chk('o-cam', v => { st.opts.cinematic = v; });
    chk('o-voice', v => { st.opts.voice = v; });
    chk('o-bc', v => { st.opts.broadcast = v; });
    chk('o-snd', v => { st.opts.muted = !v; hooks.onSettings && hooks.onSettings(); });
    body.querySelectorAll('[data-q]').forEach(e => e.onclick = () => { st.opts.quality = e.dataset.q; st.opts.autoQuality = false; P.save(); hooks.onSettings && hooks.onSettings(); render(); });
    const bs = $('b-scrub'); if (bs) bs.onclick = () => { if (P.scrubDay()) render(); };
    const bo = $('b-order');
    if (bo) bo.onclick = () => { const I1 = P.ROCKET_INFO[plan.rocket]; const t = P.readyCores(I1.core).length < I1.cores ? I1.core : 'ship'; if (P.orderCore(t)) render(); };
    const b = $('b-launch');
    if (b) b.onclick = () => {
      const pl = P.plan();
      if (!pl.ok) return;
      const bad = pl.risks.filter(r => r.level === 'bad');
      if (bad.length && !confirm('Hava koşulları riskli:\n' + bad.map(r => '• ' + r.text).join('\n') + '\n\nYine de fırlatılsın mı?')) return;
      const ctx = P.commit(pl);
      window.TUT && window.TUT.ping('launch');
      if (ctx && hooks.launch) hooks.launch(ctx);
    };
    hooks.onPreview && hooks.onPreview(plan.rocket);
  }

  /* ---------------- AR-GE ---------------- */
  function tabResearch(body) {
    const st = P.state;
    const byBr = {};
    for (const r of P.RESEARCH) (byBr[r.br] = byBr[r.br] || []).push(r);
    const depth = {};
    const dep = r => { if (depth[r.id] !== undefined) return depth[r.id]; const q = (r.req && r.req.research) || []; depth[r.id] = q.length ? 1 + Math.max(...q.map(id => dep(P.RESEARCH_BY_ID[id]))) : 0; return depth[r.id]; };
    P.RESEARCH.forEach(dep);
    const cols = Object.keys(P.BRANCHES);
    const slots = P.researchSlots();
    let h = `<div class="rhead"><div>Mühendis: <b>${st.engineers}</b> · Araştırma hızı: <b>${money(P.researchRate())}/hafta</b> · Paralel laboratuvar: <b>${st.rqueue.length}/${slots}</b> · Maaş: ${money(st.engineers * P.ENGINEER_SALARY)}/hf</div>
      <div><button class="btn" data-hire="10">+10 mühendis (${money(10 * P.ENGINEER_HIRE)})</button> <button class="btn warn" data-hire="-10" ${st.engineers <= 10 ? 'disabled' : ''}>−10</button></div></div>`;
    if (st.rqueue.length) {
      h += '<div class="rqueue">';
      for (const q of st.rqueue) { const r = P.RESEARCH_BY_ID[q.id]; const left = Math.ceil((q.total - q.done) / P.researchRate()); h += `<div><b>🔬 ${esc(r.name)}</b><div class="bar"><div style="width:${(q.done / q.total * 100).toFixed(0)}%"></div></div><small>~${left} hafta kaldı</small></div>`; }
      h += '</div>';
    }
    h += `<div class="tree" id="tree" style="grid-template-columns:repeat(${cols.length},1fr)"><svg id="tree-svg"></svg>`;
    for (const br of cols) {
      h += `<div class="tcol"><h4>${P.BRANCHES[br]}</h4>`;
      for (const r of (byBr[br] || []).sort((a, b) => depth[a.id] - depth[b.id])) {
        const c = P.canResearch(r.id);
        const cls = c.done ? 'done' : c.active ? 'active' : (c.miss.length ? 'locked' : 'avail');
        h += `<div class="tnode ${cls}" id="rn-${r.id}"><b>${esc(r.name)}</b><div class="d">${esc(r.desc)}</div>`;
        if (c.active) h += '<div class="req" style="color:var(--accent)">Araştırılıyor…</div>';
        else if (!c.done) {
          if (c.miss.length) h += `<div class="req">${c.miss.map(esc).join('<br>')}</div>`;
          h += `<button class="btn" data-res="${r.id}" ${c.ok ? '' : 'disabled'} style="margin-top:5px">Araştır · ${money(r.cost)} · ~${P.researchWeeks(r.id)} hf</button>${!c.miss.length && !c.slot ? '<div class="req">Tüm laboratuvarlar dolu</div>' : ''}`;
        }
        h += '</div>';
      }
      h += '</div>';
    }
    h += '</div>';
    body.innerHTML = h;
    body.querySelectorAll('[data-res]').forEach(b => b.onclick = () => { if (P.doResearch(b.dataset.res)) { render(); hooks.onResearch && hooks.onResearch(b.dataset.res); } });
    body.querySelectorAll('[data-hire]').forEach(b => b.onclick = () => { P.hireEngineers(+b.dataset.hire); render(); });
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
        const d = same ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} C${x1 + 30},${y1} ${x2 - 30},${y2} ${x2},${y2}`;
        paths += `<path d="${d}" fill="none" stroke="${P.has(q) ? 'rgba(62,224,143,0.55)' : 'rgba(140,180,255,0.3)'}" stroke-width="1.6" marker-end="url(#arr)"/>`;
      }
      svg.innerHTML = `<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="rgba(140,180,255,0.6)"/></marker></defs>` + paths;
    });
  }

  /* ---------------- TESİSLER ---------------- */
  function tabFac(body) {
    const st = P.state;
    let h = '<h3>Tesisler</h3><table class="tbl"><tr><th>Tesis</th><th>Seviye</th><th>Etki</th><th></th></tr>';
    const er = P.engineRate();
    for (const [id, F] of Object.entries(P.FACILITIES)) {
      const lv = P.fac(id), n = P.facilityNext(id);
      let eff = F.desc;
      if (id === 'satFab' && lv) eff = `${P.satRate()} uydu/hafta`;
      if (id === 'rocketFab') eff = `Yeni booster: ${P.coreOrderInfo('f9').weeks} hafta, −%${(lv - 1) * 10} maliyet`;
      if (id === 'refurb') eff = `Bakım süresi: ${P.refurbWeeks()} hafta`;
      if (id === 'engineFab') eff = `${er.merlin} Merlin${er.raptor ? ` + ${er.raptor} Raptor` : ''} / hafta`;
      if (id === 'terminalFab' && lv) eff = `${P.terminalRate()} bin terminal / hafta`;
      const btn = n ? `<button class="btn" data-fac="${id}" ${n.ok ? '' : 'disabled'}>${lv ? 'Yükselt' : 'Kur'} · ${money(n.cost)}</button>${n.locked ? '<div class="reasons"><div>Ar-Ge: ' + esc(P.RESEARCH_BY_ID[F.research].name) + '</div></div>' : ''}` : '<span class="pill good">Maks.</span>';
      h += `<tr><td><b>${esc(F.name)}</b><br><span class="muted">${esc(F.desc)}</span></td><td>${lv}/${F.levels.length}</td><td>${esc(eff)}</td><td>${btn}</td></tr>`;
    }
    h += '</table>';
    h += '<div class="row2"><div><h3>Stoklar</h3>';
    h += `<div class="kv"><span>Uydu (${P.SAT_GENS[P.currentGen()].name})</span><b>${st.stock.sats} / ${P.stockCap()}</b></div>`;
    h += `<div class="kv"><span>Merlin motoru</span><b>${st.stock.merlin}</b></div>`;
    if (P.has('r_raptor')) h += `<div class="kv"><span>Raptor motoru</span><b>${st.stock.raptor}</b></div>`;
    h += `<div class="kv"><span>Abone terminali</span><b>${Math.round(st.stock.terminals)} bin</b></div>`;
    h += `<div class="kv"><span>Kurtarılmış burun konisi</span><b>${st.stock.fairings} yarım</b></div>`;
    if (P.has('p_refuel')) h += `<div class="kv"><span>Yörünge yakıt deposu</span><b>${Math.round(st.depot)} t (haftada %1.5 buharlaşma)</b></div>`;
    h += `<label class="chk"><input type="checkbox" id="o-prod" ${st.prodPaused ? '' : 'checked'}> Uydu üretimi açık</label>`;
    h += '</div><div><h3>Booster bakım politikası</h3>';
    for (const [k, p] of Object.entries(P.POLICY)) h += `<label class="chk"><input type="radio" name="pol" value="${k}" ${st.refurbPolicy === k ? 'checked' : ''}> <b>${p.name}</b> — süre ${p.dw > 0 ? '+' : ''}${p.dw} hafta, maliyet ×${p.cost}, arıza riski ${p.risk > 0 ? '+' : ''}${(p.risk * 100).toFixed(1)}%/uçuş</label>`;
    if (P.fac('starbase')) {
      h += `<h3>Starbase halk onayı</h3><div class="bar"><div style="width:${st.community}%;background:${st.community < 40 ? 'var(--bad)' : 'var(--good)'}"></div></div>`;
      h += `<div class="muted" style="font-size:12px">%${Math.round(st.community)} · Her Starship fırlatması −4, patlamalar −12. %40 altında 2 haftada bir, %20 altında hiç fırlatma yok.</div>`;
      h += `<button class="btn" id="b-comm" ${st.money >= 10 * M ? '' : 'disabled'}>Topluluk yatırımı ($10 M, +15)</button>`;
    }
    for (const [k, v] of Object.entries(st.padDown || {})) if (v > st.week) h += `<div class="pill bad">${k === 'starbase' ? 'Starbase' : k} rampası onarımda — hafta ${v}</div>`;
    h += '</div></div>';
    body.innerHTML = h;
    body.querySelectorAll('[data-fac]').forEach(b => b.onclick = () => { if (P.buildFacility(b.dataset.fac)) { render(); hooks.onFacility && hooks.onFacility(b.dataset.fac); } });
    $('o-prod').onchange = e => { st.prodPaused = !e.target.checked; P.save(); };
    body.querySelectorAll('[name=pol]').forEach(r => r.onchange = () => { st.refurbPolicy = r.value; P.save(); render(); });
    const bc = $('b-comm'); if (bc) bc.onclick = () => { P.communityInvest(); render(); };
  }

  /* ---------------- FİLO ---------------- */
  const STATUS = { ready: '<span class="pill good">Hazır</span>', building: '<span class="pill warn">Üretimde</span>', refurb: '<span class="pill warn">Bakımda</span>', flight: '<span class="pill">Uçuşta</span>', retired: '<span class="pill">Emekli</span>', lost: '<span class="pill bad">Kayıp</span>' };
  const RES = { landed: '✓ indi', caught: '✓ yakalandı', splash: '🌊 okyanus testi', lost: '✗ kayıp', expended: '— tek kullanımlık', tipped: '✗ devrildi' };
  function tabFleet(body) {
    const st = P.state;
    let h = '<h3>Yeni sipariş</h3><div class="cards">';
    const types = [['f1', true], ['f9', P.has('r_f9')], ['fh', P.has('r_fh')], ['ss', P.has('r_ss')], ['ship', P.has('r_ss')]];
    for (const [t, ok] of types) {
      const o = P.coreOrderInfo(t);
      const eng = Object.entries(o.engines).map(([k, n]) => `${n} ${k === 'merlin' ? 'Merlin' : 'Raptor'}`).join(', ');
      h += `<div class="card ${ok ? '' : 'locked'}"><b>${P.CORE_INFO[t].name}</b><small>${money(o.cost)} · ${o.weeks} hafta · ${eng}</small><button class="btn" data-order="${t}" ${ok && st.money >= o.cost && P.enginesOk(o.engines) ? '' : 'disabled'} style="margin-top:6px">${P.enginesOk(o.engines) ? 'Sipariş ver' : 'Motor yetersiz'}</button></div>`;
    }
    h += '</div>';
    const all = st.fleet.concat(st.museum || []);
    const best = all.reduce((a, c) => (!a || c.flights > a.flights ? c : a), null);
    if (best && best.flights > 1) h += `<div class="challenge">🏅 Filo rekoru: <b>${esc(best.nick || best.id)}</b> — ${best.flights} uçuş</div>`;
    h += '<h3>Filo</h3><table class="tbl"><tr><th>Seri no / isim</th><th>Tip</th><th>Uçuş</th><th>Durum</th><th>Kalan</th><th></th></tr>';
    const list = st.fleet.slice().sort((a, b) => (a.status === 'retired') - (b.status === 'retired') || b.flights - a.flights);
    for (const c of list) h += `<tr class="${fleetSel === c.id ? 'selrow' : ''}"><td><b>${c.id}</b>${c.nick ? ` <span class="muted">"${esc(c.nick)}"</span>` : ''}</td><td>${P.CORE_INFO[c.type].name}</td><td>${c.flights} / ${P.maxFlights(c.type === 'ship' ? 'ss' : c.type)}</td><td>${STATUS[c.status] || c.status}</td><td>${c.weeks ? c.weeks + ' hf' : ''}</td><td><button class="btn" data-hist="${c.id}">Geçmiş</button></td></tr>`;
    h += '</table><div id="hist"></div>';
    body.innerHTML = h;
    body.querySelectorAll('[data-order]').forEach(b => b.onclick = () => { if (P.orderCore(b.dataset.order)) render(); });
    body.querySelectorAll('[data-hist]').forEach(b => b.onclick = () => { fleetSel = b.dataset.hist; render(); });
    const c = st.fleet.find(x => x.id === fleetSel);
    if (c) {
      let hh = `<h3>${c.id} geçmişi</h3><div class="row2"><div><label class="chk">İsim: <input id="nick" value="${esc(c.nick || '')}" maxlength="24" style="flex:1"> <button class="btn" id="b-nick">Kaydet</button></label></div><div class="muted" style="font-size:12px">Üretim: hafta ${c.built || '?'} · Aşınma: ${((c.wear || 0) * 100).toFixed(1)}%</div></div>`;
      hh += '<table class="tbl"><tr><th>Hafta</th><th>Görev</th><th>Sonuç</th></tr>' + (c.history || []).slice().reverse().map(x => `<tr><td>${x.w}</td><td>${esc(x.m)}</td><td>${RES[x.r] || x.r}${x.dx !== undefined && x.dx !== null ? ` (${Math.abs(x.dx).toFixed(1)} m)` : ''}</td></tr>`).join('') + '</table>';
      if (!(c.history || []).length) hh += '<div class="muted">Henüz uçmadı.</div>';
      $('hist').innerHTML = hh;
      $('b-nick').onclick = () => { P.renameCore(c.id, $('nick').value); render(); };
    }
  }

  /* ---------------- AĞ ---------------- */
  function tabNet(body) {
    const st = P.state, net = P.network();
    let h = `<div class="muted" style="font-size:12px">Haritada bir bölgeye tıkla: yer istasyonu (${money(P.GS_COST)}), lisans, fiyat. Noktalı eğriler uyduların yer izleri, parlak alanlar kapsama yoğunluğu.</div>`;
    h += '<canvas id="netmap" class="netmap" width="720" height="360"></canvas>';
    h += '<div class="legend"><span><i style="background:#3ee08f"></i>hizmet</span><span><i style="background:#ffc24a"></i>kapsama var, bağlantı/lisans eksik</span><span><i style="background:#ff5a4f"></i>hizmet yok</span><span><i style="background:#4fc3ff"></i>yer istasyonu</span>' + P.RIVALS.map(r => `<span><i style="background:${r.color}"></i>${esc(r.name)}</span>`).join('') + '</div>';
    h += '<div id="net-info"></div>';
    h += '<div class="row2"><div><h3>Takımyıldız</h3>';
    for (const [k, sh] of Object.entries(st.shells)) {
      const n = Object.values(sh).reduce((a, b) => a + b, 0);
      h += `<div class="kv"><span>${P.SHELLS[k].name}</span><b>${n} · enkaz ${Math.round(st.debris[k])}</b></div>`;
    }
    h += `<div class="kv"><span>Yükselişteki uydular</span><b>${P.raisingSats()}</b></div>`;
    h += `<div class="kv"><span>Toplam kapasite</span><b>${(net.capGbps / 1000).toFixed(1)} Tbps</b></div>`;
    h += `<div class="kv"><span>Lazer bağlantılı oran</span><b>%${(net.laserFrac * 100).toFixed(0)}</b></div>`;
    h += `<div class="kv"><span>GEO röleler</span><b>${Object.entries(st.relays).map(([k, v]) => P.SECTORS[k] + ': ' + v).join(' · ')}</b></div>`;
    h += '</div><div><h3>Abone & gelir</h3>';
    h += `<div class="kv"><span>Abone</span><b>${(net.users / 1000).toFixed(2)} M</b></div>`;
    h += `<div class="kv"><span>Haftalık gelir</span><b>${money(net.revenue)}</b></div>`;
    if (net.latencyBonus > 1e5) h += `<div class="kv"><span>— düşük gecikme primi (finans/oyun)</span><b>${money(net.latencyBonus)}</b></div>`;
    if (net.military) h += `<div class="kv"><span>— askeri iletişim paketi</span><b>${money(net.military)}</b></div>`;
    h += `<div class="kv"><span>Kapsanan nüfus</span><b>${pct(net.servedFrac)}</b></div>`;
    h += `<div class="kv"><span>Terminal stoku</span><b>${Math.round(st.stock.terminals)} bin</b></div>`;
    h += '<h3>Rakipler</h3>' + P.RIVALS.map((r, i) => `<div class="kv"><span style="color:${r.color}">${esc(r.name)}</span><b>${st.rivals[i].sats} uydu</b></div>`).join('');
    if (net.capLimited) h += '<div class="pill warn">Kapasite sınırı! Daha fazla / daha yeni nesil uydu fırlat.</div>';
    h += '</div></div>';
    h += '<h3>Bölgeler</h3><table class="tbl"><tr><th>Bölge</th><th>Kapsama</th><th>Bağlantı</th><th>Pay</th><th>Abone</th><th>Fiyat</th><th></th></tr>';
    for (const r of net.regions) {
      let act = '';
      if (r.lic && !st.licenses[r.id]) act = `<button class="btn warn" data-lic="${r.id}" ${st.money >= r.lic.cost ? '' : 'disabled'}>Lisans ${money(r.lic.cost)}</button>`;
      else if (r.lic && st.licenses[r.id] && st.licenses[r.id] !== 'ok') act = `<span class="muted">lisans: hf ${st.licenses[r.id].until}</span>`;
      else if (r.station) act = r.station < 3 ? `<button class="btn" data-up="${r.id}">📡${r.station} → ${r.station + 1} (${money(P.STATION_UP_COST[r.station + 1])})</button>` : '📡3';
      else if (r.land) act = `<button class="btn" data-gs="${r.id}" ${st.money >= P.GS_COST && P.has('u_v09') ? '' : 'disabled'}>İstasyon</button>`;
      else act = '<span class="muted">deniz</span>';
      const pr = `<select data-price="${r.id}">${Object.entries(P.PRICES).map(([k, v]) => `<option value="${k}" ${r.price === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select>`;
      h += `<tr><td>${esc(r.name)}${r.arpu > 1.5 ? ' <span class="pill">×' + r.arpu.toFixed(1) + ' ARPU</span>' : ''}</td><td>%${(r.cov * 100).toFixed(0)}</td><td>${esc(r.via)}${isFinite(r.capR) ? ` <span class="muted">(≤${(r.capR / 1000).toFixed(1)} M)</span>` : ''}</td><td>%${(r.share * 100).toFixed(0)}</td><td>${(r.users / 1000).toFixed(2)} / ${(r.demand / 1000).toFixed(1)} M</td><td>${pr}</td><td>${act}</td></tr>`;
    }
    h += '</table>';
    body.innerHTML = h;
    const re = () => { render(); hooks.onStation && hooks.onStation(); };
    body.querySelectorAll('[data-gs]').forEach(b => b.onclick = () => { if (P.buildStation(b.dataset.gs)) re(); });
    body.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { if (P.upgradeStation(b.dataset.up)) re(); });
    body.querySelectorAll('[data-lic]').forEach(b => b.onclick = () => { if (P.applyLicense(b.dataset.lic)) re(); });
    body.querySelectorAll('[data-price]').forEach(s => s.onchange = () => { P.setPrice(s.dataset.price, s.value); render(); });
    drawNetMap(net);
    const cv = $('netmap');
    cv.onclick = e => {
      const rc = cv.getBoundingClientRect();
      const lon = (e.clientX - rc.left) / rc.width * 360 - 180, lat = 90 - (e.clientY - rc.top) / rc.height * 180;
      let best = null, bd = 1e9;
      for (const r of net.regions) { const d = Math.hypot((r.lon - lon) * Math.cos(r.lat * Math.PI / 180), r.lat - lat); if (d < r.r && d < bd) { bd = d; best = r; } }
      selRegion = best ? best.id : null;
      showRegion(net); drawNetMap(net);
    };
    showRegion(net);
  }
  function showRegion(net) {
    const el = $('net-info'); if (!el) return;
    const r = net.regions.find(x => x.id === selRegion);
    if (!r) { el.innerHTML = ''; return; }
    const st = P.state;
    let act = '';
    if (r.lic && !st.licenses[r.id]) act = `<button class="btn warn" id="ri-lic">Lisans başvurusu · ${money(r.lic.cost)} · ${r.lic.weeks} hf</button>`;
    else if (!r.station && r.land) act = `<button class="btn good" id="ri-gs" ${st.money >= P.GS_COST && P.has('u_v09') ? '' : 'disabled'}>Yer istasyonu kur · ${money(P.GS_COST)}</button>`;
    else if (!r.land) act = '<b class="muted">Okyanus — lazer veya GEO röle gerekir</b>';
    el.innerHTML = `<div class="kv"><span><b>${esc(r.name)}</b> — kapsama %${(r.cov * 100).toFixed(0)}, bağlantı: ${esc(r.via)}, pazar payı %${(r.share * 100).toFixed(0)}, abone ${(r.users / 1000).toFixed(2)} M</span>${act}</div>`;
    const a = $('ri-lic'); if (a) a.onclick = () => { if (P.applyLicense(r.id)) { render(); hooks.onStation && hooks.onStation(); } };
    const b = $('ri-gs'); if (b) b.onclick = () => { if (P.buildStation(r.id)) { render(); hooks.onStation && hooks.onStation(); } };
  }
  function drawNetMap(net) {
    const cv = $('netmap'); if (!cv) return;
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    g.fillStyle = '#02060c'; g.fillRect(0, 0, W, H);
    if (netImg) { g.globalAlpha = 0.8; g.drawImage(netImg, 0, 0, W, H); g.globalAlpha = 1; }
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, 0, W, H);
    const X = lon => (lon + 180) / 360 * W, Y = lat => (90 - lat) / 180 * H;
    // kapsama ısı haritası (enlem yoğunluğu)
    const st = P.state;
    const img = g.getImageData(0, 0, W, H);
    for (let y = 0; y < H; y += 2) {
      const lat = 90 - (y / H) * 180;
      let eff = 0;
      for (const [sk, sh] of Object.entries(st.shells)) {
        const inc = P.SHELLS[sk].inc, a = Math.abs(lat), i = inc > 90 ? 180 - inc : inc;
        let w = inc > 90 ? 0.7 + 0.6 * (a / 90) ** 3 : a > i + 4 ? 0 : a > i ? 0.4 : Math.min(2.2, 0.65 / Math.sqrt(Math.max(0.08, 1 - (Math.sin(a * Math.PI / 180) / Math.sin(i * Math.PI / 180)) ** 2)));
        for (const [gk, n] of Object.entries(sh)) eff += n * P.SAT_GENS[gk].cover * w;
      }
      const c = 1 - Math.exp(-eff / 260);
      if (c < 0.01) continue;
      for (let x = 0; x < W; x++) for (let yy = y; yy < Math.min(H, y + 2); yy++) {
        const i = (yy * W + x) * 4;
        img.data[i] = img.data[i] * (1 - c * 0.35) + 60 * c * 0.35; img.data[i + 1] = img.data[i + 1] * (1 - c * 0.35) + 200 * c * 0.35; img.data[i + 2] = img.data[i + 2] * (1 - c * 0.35) + 255 * c * 0.35;
      }
    }
    g.putImageData(img, 0, 0);
    // yer izleri
    const t = P.state.week * 0.37;
    for (const [k, sh] of Object.entries(st.shells)) {
      const n = Object.values(sh).reduce((a, b) => a + b, 0); if (!n) continue;
      const inc = P.SHELLS[k].inc * Math.PI / 180;
      g.strokeStyle = 'rgba(160,220,255,0.55)'; g.lineWidth = 1; g.setLineDash([3, 3]);
      for (let p = 0; p < Math.min(6, 1 + Math.floor(n / 100)); p++) {
        g.beginPath();
        let started = false, prevX = 0;
        for (let i = 0; i <= 360; i += 2) {
          const u = i * Math.PI / 180;
          const lat = Math.asin(Math.sin(inc) * Math.sin(u)) * 180 / Math.PI;
          let lon = (Math.atan2(Math.cos(inc) * Math.sin(u), Math.cos(u)) * 180 / Math.PI) + p * 60 + t * 20 - i * 0.07;
          lon = ((lon + 540) % 360) - 180;
          const xx = X(lon), yy = Y(lat);
          if (!started || Math.abs(xx - prevX) > W / 2) { g.moveTo(xx, yy); started = true; } else g.lineTo(xx, yy);
          prevX = xx;
        }
        g.stroke();
      }
      g.setLineDash([]);
    }
    for (const r of net.regions) {
      const col = r.served > 0.5 ? '62,224,143' : r.cov > 0.15 ? '255,194,74' : '255,90,79';
      const rx = r.r / 360 * W / Math.max(0.35, Math.cos(r.lat * Math.PI / 180)), ry = r.r / 180 * H;
      g.beginPath(); g.ellipse(X(r.lon), Y(r.lat), rx, ry, 0, 0, Math.PI * 2);
      g.fillStyle = `rgba(${col},${0.1 + 0.3 * Math.max(r.served, r.cov * 0.5)})`; g.fill();
      g.strokeStyle = r.id === selRegion ? '#fff' : `rgba(${col},0.9)`; g.lineWidth = r.id === selRegion ? 2.5 : 1.2; g.stroke();
      // rakip payı yayı
      let a0 = -Math.PI / 2;
      P.RIVALS.forEach((rv, i) => { const sh = r.rivalCov[i] * 0.5; if (sh > 0.02) { g.beginPath(); g.strokeStyle = rv.color; g.lineWidth = 3; g.arc(X(r.lon), Y(r.lat), Math.min(rx, ry) * 0.5, a0, a0 + sh * Math.PI * 2); g.stroke(); a0 += sh * Math.PI * 2; } });
      if (r.station) { g.fillStyle = '#4fc3ff'; g.beginPath(); g.arc(X(r.lon), Y(r.lat), 3 + r.station * 1.5, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke(); }
      g.fillStyle = '#e6edf7'; g.font = '10px sans-serif'; g.textAlign = 'center';
      g.fillText(r.name.split(' ')[0] + (r.lic && !P.licensed(r.id) ? ' 🔒' : ''), X(r.lon), Y(r.lat) + ry + 10 > H ? Y(r.lat) - ry - 3 : Y(r.lat) + 3 + (r.station ? 12 : 0));
    }
    const relayLon = { am: -75, emea: 15, apac: 120 };
    for (const [k, n] of Object.entries(P.state.relays)) if (n) { g.fillStyle = '#ffd36b'; g.font = 'bold 13px sans-serif'; g.fillText('◆ GEO×' + n, X(relayLon[k]), 14); }
  }

  /* ---------------- SÖZLEŞMELER ---------------- */
  function tabContracts(body) {
    const st = P.state;
    let h = `<div class="kv"><span>Müşteri itibarı</span><b>${Math.round(st.reputation)}/100</b></div><div class="bar" style="margin-bottom:8px"><div style="width:${st.reputation}%"></div></div><div class="muted" style="font-size:12px">İtibar; teklif sayısını ve ödülleri belirler. Başarılı görev +2/+3, başarısızlık −10, süresi dolan sözleşme −5.</div>`;
    h += '<h3>Teklifler</h3><table class="tbl"><tr><th>Sözleşme</th><th>Roket</th><th>Kütle</th><th>Ödül</th><th>Son hafta</th><th></th></tr>';
    for (const c of st.contracts) {
      const T = P.CONTRACT_TYPES[c.type];
      h += `<tr><td><b>${esc(c.name)}</b><br><span class="muted">%30 avans, başarısızlıkta ${money(c.penalty)} ceza</span></td><td>${T.rockets.map(k => P.ROCKET_INFO[k].name).join(', ')}</td><td>${c.mass} kg${T.orbit === 'gto' ? ' GTO' : T.orbit === 'iss' ? ' ISS' : ' LEO'}</td><td>${money(c.reward)}</td><td>${c.expires}</td><td><button class="btn good" data-acc="${c.id}">Kabul et</button></td></tr>`;
    }
    if (!st.contracts.length) h += '<tr><td colspan="6" class="muted">Bu hafta teklif yok.</td></tr>';
    h += '</table><h3>Kabul edilenler</h3><table class="tbl"><tr><th>Sözleşme</th><th>Kütle</th><th>Ödül</th><th>Son hafta</th></tr>';
    for (const c of st.accepted) h += `<tr><td>${esc(c.name)}</td><td>${c.mass} kg</td><td>${money(c.reward)}</td><td>${c.expires}</td></tr>`;
    if (!st.accepted.length) h += '<tr><td colspan="4" class="muted">Yok</td></tr>';
    h += '</table><h3>Günlük</h3>' + st.log.slice(0, 30).map(l => `<div class="kv"><span>Hafta ${l.w}</span><b style="font-weight:400;color:${l.kind === 'good' ? 'var(--good)' : l.kind === 'bad' ? '#ff9a92' : 'inherit'}">${esc(l.text)}</b></div>`).join('');
    body.innerHTML = h;
    body.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => { P.acceptContract(b.dataset.acc); window.TUT && window.TUT.ping('accept'); render(); });
  }

  /* ---------------- FİNANS ---------------- */
  function tabFinance(body) {
    const st = P.state, v = P.valuation();
    let h = '<div class="row2"><div><h3>Şirket</h3>';
    h += `<div class="kv"><span>Şirket değerlemesi</span><b>${money(v)}</b></div>`;
    h += `<div class="kv"><span>Kurucu hissesi</span><b>%${(st.ownership * 100).toFixed(1)}</b></div>`;
    h += `<div class="kv"><span>Hissenin değeri</span><b>${money(v * st.ownership)}</b></div>`;
    h += `<div class="kv"><span>Zorluk</span><b>${P.DIFFICULTY[st.difficulty].name}</b></div>`;
    h += '</div><div><h3>Yatırım turları</h3>';
    for (const f of P.fundingOptions()) h += `<div class="kv"><span><b>${f.name}</b> — %${(f.share * 100).toFixed(0)} hisse<br><small class="muted">${f.done ? 'Tamamlandı' : 'Şart: ' + esc(f.reqText)}</small></span>${f.done ? '<b class="pos">✓</b>' : `<button class="btn good" data-fund="${f.id}" ${f.ok ? '' : 'disabled'}>+${money(f.amount)}</button>`}</div>`;
    h += '</div></div>';
    h += '<h3>Bulut kaydı ve sıralama</h3>';
    if (!API) h += '<div class="muted" style="font-size:12px">Bulut kaydı ve sıralama, oyun bir sunucuda (ör. Vercel) çalışırken kullanılabilir.</div>';
    else {
      h += `<div class="row2"><div><div class="muted" style="font-size:12px">İlerlemeni buluta kaydet ve başka cihazda kodla aç.</div>
        <button class="btn" id="cl-save">☁ Buluta kaydet</button> <input id="cl-code" placeholder="Kayıt kodu" style="width:120px"> <button class="btn" id="cl-load">Yükle</button><div id="cl-msg" class="muted" style="font-size:12px;margin-top:4px">${st.cloudCode ? 'Son kod: <b>' + esc(st.cloudCode) + '</b>' : ''}</div></div>
        <div><div class="muted" style="font-size:12px">Dünya bağlandıysa skorunu gönder (en az hafta + en yüksek hisse değeri).</div>
        <input id="lb-name" placeholder="Takma ad" maxlength="20" style="width:140px"> <button class="btn good" id="lb-send" ${st.won ? '' : 'disabled'}>Skoru gönder</button><div id="lb"></div></div></div>`;
    }
    body.innerHTML = h;
    body.querySelectorAll('[data-fund]').forEach(b => b.onclick = () => { P.raiseFunding(b.dataset.fund); render(); });
    if (API) {
      const msg = t => { $('cl-msg').innerHTML = t; };
      $('cl-save').onclick = () => fetch(API + 'save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: st.cloudCode || null, data: st }) }).then(r => r.json()).then(j => { if (j.code) { st.cloudCode = j.code; P.save(); msg('Kaydedildi — kod: <b>' + esc(j.code) + '</b>'); } else msg(esc(j.error || 'Hata')); }).catch(() => msg('Sunucuya ulaşılamadı'));
      $('cl-load').onclick = () => { const c = $('cl-code').value.trim().toUpperCase(); if (!c) return; fetch(API + 'save?code=' + encodeURIComponent(c)).then(r => r.json()).then(j => { if (j.data && P.importState(j.data)) { P.state.cloudCode = c; P.save(); render(); hooks.onWeek && hooks.onWeek(); msg('Yüklendi'); } else msg(esc(j.error || 'Bulunamadı')); }).catch(() => msg('Sunucuya ulaşılamadı')); };
      $('lb-send').onclick = () => fetch(API + 'leaderboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: $('lb-name').value || 'Anonim', weeks: st.achievements.a_win || st.week, difficulty: st.difficulty, value: Math.round(P.valuation() * st.ownership) }) }).then(r => r.json()).then(loadLb).catch(() => {});
      const loadLb = () => fetch(API + 'leaderboard').then(r => r.json()).then(j => { const el = $('lb'); if (!el) return; el.innerHTML = j.error ? `<div class="muted" style="font-size:12px">${esc(j.error)}</div>` : '<table class="tbl"><tr><th>#</th><th>İsim</th><th>Hafta</th><th>Zorluk</th><th>Hisse değeri</th></tr>' + (j.items || []).map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.name)}</td><td>${x.weeks}</td><td>${esc((P.DIFFICULTY[x.difficulty] || {}).name || x.difficulty)}</td><td>${money(x.value)}</td></tr>`).join('') + '</table>'; }).catch(() => {});
      loadLb();
    }
  }

  /* ---------------- İSTATİSTİK ---------------- */
  function tabStats(body) {
    const hist = P.state.history;
    let h = '<div class="charts">';
    const charts = [['money', 'Bütçe ($M)', v => v / M, '#4fc3ff'], ['rev', 'Haftalık gelir ($M)', v => v / M, '#3ee08f'], ['users', 'Abone (milyon)', v => v / 1000, '#ffd36b'], ['sats', 'Hizmetteki uydu', v => v, '#c9d4e6'], ['rep', 'İtibar', v => v, '#ff8a3d'], ['rivals', 'Rakip uyduları', v => v, '#c084fc']];
    for (const c of charts) h += `<div class="chart"><div class="ct">${c[1]}</div><canvas data-ch="${c[0]}" width="420" height="150"></canvas></div>`;
    h += '</div>';
    if (hist.length < 2) h += '<div class="muted">Grafikler birkaç hafta sonra dolacak.</div>';
    body.innerHTML = h;
    for (const c of charts) {
      const cv = body.querySelector(`[data-ch="${c[0]}"]`), g = cv.getContext('2d'), W = cv.width, H = cv.height;
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, W, H);
      if (hist.length < 2) continue;
      const series = c[0] === 'rivals' ? P.RIVALS.map((r, i) => ({ col: r.color, v: hist.map(x => (x.rivals || [])[i] || 0) })).concat([{ col: '#4fc3ff', v: hist.map(x => x.sats) }]) : [{ col: c[3], v: hist.map(x => c[2](x[c[0]] || 0)) }];
      let mn = Infinity, mx = -Infinity;
      for (const s of series) for (const v of s.v) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
      if (mx === mn) mx = mn + 1;
      mn = Math.min(0, mn);
      g.strokeStyle = 'rgba(255,255,255,0.1)'; g.beginPath(); const y0 = H - 14 - (0 - mn) / (mx - mn) * (H - 24); g.moveTo(0, y0); g.lineTo(W, y0); g.stroke();
      for (const s of series) {
        g.strokeStyle = s.col; g.lineWidth = 2; g.beginPath();
        s.v.forEach((v, i) => { const x = 6 + i / (s.v.length - 1) * (W - 12), y = H - 14 - (v - mn) / (mx - mn) * (H - 24); i ? g.lineTo(x, y) : g.moveTo(x, y); });
        g.stroke();
      }
      g.fillStyle = 'rgba(200,220,255,0.75)'; g.font = '10px sans-serif';
      g.fillText(mx.toFixed(mx < 10 ? 1 : 0), 4, 10); g.fillText('hafta ' + hist[0].w + ' → ' + hist[hist.length - 1].w, W - 110, H - 3);
    }
  }

  /* ---------------- SERBEST MOD ---------------- */
  function tabSandbox(body) {
    sandbox = sandbox || { rocket: 'f9', mode: 'asds', payload: 'starlink', mass: 15000, hour: 12, wind: 3, jet: 20, waves: 1, gto: false, shipReturn: false, fairingRec: false, manualLanding: false, autoLand: true, engineFail: false };
    const s = sandbox;
    const modes = { f1: ['exp', 'ocean', 'rtls'], f9: ['exp', 'ocean', 'rtls', 'asds'], fh: ['exp', 'ocean', 'asds'], ss: ['exp', 'ocean', 'catch'] }[s.rocket];
    if (!modes.includes(s.mode)) s.mode = modes[modes.length - 1];
    let h = '<div class="advisor"><div class="adv-title">🧪 Serbest mod</div>Para, Ar-Ge veya hafta olmadan her roketi her ayarla dene. Ekonomin etkilenmez.</div>';
    h += '<h3>Roket</h3><div class="cards">' + Object.entries(P.ROCKET_INFO).map(([k, I]) => `<div class="card ${s.rocket === k ? 'sel' : ''}" data-sb-rocket="${k}"><b>${I.name}</b></div>`).join('') + '</div>';
    h += '<h3>Kurtarma</h3><div class="cards">' + modes.map(m => `<div class="card ${s.mode === m ? 'sel' : ''}" data-sb-mode="${m}"><b>${S.MODE_NAMES[m]}</b></div>`).join('') + '</div>';
    const rng = (id, label, min, max, step, unit) => `<label class="chk sb">${label}: <input type="range" id="sb-${id}" min="${min}" max="${max}" step="${step}" value="${s[id]}"> <b id="sbv-${id}">${s[id]}${unit}</b></label>`;
    h += '<h3>Yük ve koşullar</h3>';
    h += rng('mass', 'Yük kütlesi', 0, s.rocket === 'ss' ? 150000 : s.rocket === 'f1' ? 600 : 30000, s.rocket === 'f1' ? 10 : 100, ' kg');
    h += rng('hour', 'Saat', 0, 23, 1, ':00') + rng('wind', 'Yer rüzgârı', 0, 20, 0.5, ' m/s') + rng('jet', 'Jet akımı', 0, 90, 1, ' m/s') + rng('waves', 'Dalga', 0, 5, 0.1, ' m');
    const ck = (id, label) => `<label class="chk"><input type="checkbox" id="sb-${id}" ${s[id] ? 'checked' : ''}> ${label}</label>`;
    h += ck('gto', 'GTO hedefi (35 786 km apoapsis)') + ck('engineFail', 'Motor arızası (T+40 s)') + ck('autoLand', 'Otomatik iniş') + ck('manualLanding', 'Elle iniş modu');
    if (s.rocket === 'ss') h += ck('shipReturn', 'Ship dönüşü ve yakalama');
    if (s.rocket === 'f9' || s.rocket === 'fh') h += ck('fairingRec', 'Burun konisi kurtarma');
    h += '<button class="big-btn" id="sb-go">🧪 SERBEST UÇUŞ</button>';
    body.innerHTML = h;
    body.querySelectorAll('[data-sb-rocket]').forEach(e => e.onclick = () => { s.rocket = e.dataset.sbRocket; s.mass = { f1: 180, f9: 15000, fh: 25000, ss: 90000 }[s.rocket]; render(); hooks.onPreview && hooks.onPreview(s.rocket); });
    body.querySelectorAll('[data-sb-mode]').forEach(e => e.onclick = () => { s.mode = e.dataset.sbMode; render(); });
    for (const id of ['mass', 'hour', 'wind', 'jet', 'waves']) { const el = $('sb-' + id); el.oninput = () => { s[id] = +el.value; $('sbv-' + id).textContent = el.value + { mass: ' kg', hour: ':00', wind: ' m/s', jet: ' m/s', waves: ' m' }[id]; }; }
    for (const id of ['gto', 'engineFail', 'autoLand', 'manualLanding', 'shipReturn', 'fairingRec']) { const el = $('sb-' + id); if (el) el.onchange = () => { s[id] = el.checked; }; }
    hooks.onPreview && hooks.onPreview(s.rocket);
    $('sb-go').onclick = () => {
      const ctx = P.sandboxCtx({ rocket: s.rocket, mode: s.mode, payload: s.rocket === 'f1' ? 'test' : 'starlink', mass: s.mass, targetAp: s.gto ? 35786000 : 0, shipReturn: s.shipReturn, fairingRec: s.fairingRec, manualLanding: s.manualLanding, autoLand: s.autoLand, engineFail: s.engineFail,
        weather: { hour: s.hour, wind: s.wind, windDir: 1, jet: s.jet, waves: s.waves, cloud: 30, rain: false, fog: false, storm: false } });
      hooks.launch && hooks.launch(ctx);
    };
  }

  /* ---------------- BAŞARIMLAR ---------------- */
  function tabAch(body) {
    const st = P.state;
    let h = '<div class="ach">';
    for (const a of P.ACHIEVEMENTS) h += `<div class="${st.achievements[a.id] ? 'on' : ''}"><b>${st.achievements[a.id] ? '🏆' : '🔒'} ${esc(a.name)}</b>${esc(a.desc)}${st.achievements[a.id] ? `<br><span class="muted">Hafta ${st.achievements[a.id]}</span>` : ''}</div>`;
    h += '</div><h3>İstatistikler</h3>';
    const s = st.stats;
    for (const [k, v] of [['Fırlatma', s.launches], ['Başarısız', s.fails], ['Booster inişi', s.landings], ['Elle iniş', s.manual], ['Okyanus testleri', s.splash], ['Kule yakalama', s.catches], ['Ship yakalama', s.shipCatches], ['Kurtarılan burun konisi', s.fairings], ['Yörüngeden indirilen üst kademe', s.deorbited], ['Uydu çarpışması', s.collisions], ['Tanker uçuşu', s.tankers], ['Ay inişi', s.moon], ['Mars inişi', s.mars]]) h += `<div class="kv"><span>${k}</span><b>${v || 0}</b></div>`;
    body.innerHTML = h;
  }

  /* ---------------- Olay kartı ---------------- */
  function showEvent() {
    const ev = P.state.pendingEvent; if (!ev) return;
    $('ev-title').textContent = ev.title;
    $('ev-text').textContent = ev.text;
    $('ev-choices').innerHTML = ev.choices.map((c, i) => `<button class="big-btn ev-btn" data-ev="${i}">${esc(c)}</button>`).join('');
    $('ev-result').textContent = '';
    $('event').classList.remove('hidden');
    $('ev-choices').querySelectorAll('[data-ev]').forEach(b => b.onclick = () => {
      const msg = P.resolveEvent(+b.dataset.ev);
      $('ev-choices').innerHTML = '<button class="big-btn" id="ev-ok">Tamam</button>';
      $('ev-result').textContent = msg || '';
      $('ev-ok').onclick = () => { $('event').classList.add('hidden'); render(); hooks.onWeek && hooks.onWeek(); };
    });
  }

  /* ---------------- Raporlar ---------------- */
  function showReport(rep) {
    $('rep-title').textContent = (rep.won ? '🌍 DÜNYA BAĞLANDI! — ' : '') + 'Haftalık rapor: ' + P.weekLabel(rep.week);
    const lines = rep.lines.slice();
    const net = lines.reduce((a, l) => a + l[1], 0);
    $('rep-lines').innerHTML = (lines.length ? lines : [['Sakin bir hafta', 0]]).map(l => `<div><span>${esc(l[0])}</span><b class="${l[1] > 0 ? 'pos' : l[1] < 0 ? 'neg' : ''}">${l[1] ? (l[1] > 0 ? '+' : '') + money(l[1]) : ''}</b></div>`).join('') +
      `<div class="total"><span>Net</span><b class="${net >= 0 ? 'pos' : 'neg'}">${(net >= 0 ? '+' : '') + money(net)}</b></div>` +
      (rep.event ? `<div class="pill warn" style="margin-top:8px">Yeni olay: ${esc(rep.event.title)}</div>` : '');
    $('report').classList.remove('hidden');
  }
  function showResult(r, applied, title) {
    $('res-title').textContent = title || (r.ok ? 'GÖREV BAŞARILI' : 'GÖREV BAŞARISIZ');
    $('res-title').className = r.ok ? 'good' : 'bad';
    $('res-sub').textContent = r.ok ? (r.orbit ? `Yörünge: ${(r.orbit.pe / 1000).toFixed(0)} × ${(r.orbit.ap / 1000).toFixed(0)} km` : '') : (r.reason || '');
    $('res-lines').innerHTML = applied.lines.map(l => `<div class="${l[2] === 'total' ? 'total' : ''}"><span>${esc(l[0])}</span><b class="${l[1] > 0 ? 'pos' : l[1] < 0 ? 'neg' : ''}">${l[1] ? (l[1] > 0 ? '+' : '') + money(l[1]) : ''}</b></div>`).join('');
    $('result').classList.remove('hidden');
  }

  return { init, render, showResult, showEvent, money, get tab() { return tab; } };
})();
