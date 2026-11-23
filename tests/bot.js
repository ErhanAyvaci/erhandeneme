/* Ekonomi dengesini doğrulamak için basit otomatik oyuncu.
   Fırlatma sonuçlarını olasılıksal olarak üretir (fizik simülasyonu çalıştırmaz). */
'use strict';
require('../js/progress.js');
const G = globalThis.PROG;
const M = 1e6;

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const PRIO = ['r_merlin1d', 'k_gridfins', 'r_f9', 'u_v09', 'k_legs', 'k_rtls', 'g_gto', 'm_rel', 'k_asds', 'u_v10', 'm_mvac', 'k_deep', 'r_safety', 'u_polar', 'g_dragon', 'm_block5', 'u_relay', 'k_refurb', 'u_terminal2', 'k_octa', 'k_fairing', 'u_v15', 'u_avoid', 'r_fh', 'g_crew', 'r_raptor', 'k_life', 'g_military', 'u_v2m', 'r_ss', 'r_deluge', 'k_catch', 'm_raptor2', 'k_shipcatch', 'r_ss2', 'm_raptor3', 'u_v3', 'k_tiles'];

function play(seed, diff, maxWeeks, verbose) {
  G.reset(diff || 'normal');
  const st = G.state; st.seed = seed;
  const R = rng(seed * 7 + 1);
  let L = 0;
  const fake = (P, ctx) => {
    const ok = R() < 0.93;
    const br = () => P.mode === 'exp' ? 'expended' : (R() < 0.88 ? (P.mode === 'ocean' ? 'splash' : P.mode === 'catch' ? 'caught' : (ctx.simOpts.tipOver ? 'tipped' : 'landed')) : 'lost');
    const b = P.rocket === 'fh'
      ? [{ type: 'side', result: P.sideMode === 'rtls' ? br() : 'expended', kind: 'rtls' }, { type: 'side', result: P.sideMode === 'rtls' ? br() : 'expended', kind: 'rtls' }, { type: 'booster', result: br(), kind: P.mode }]
      : (P.mode === 'exp' ? [] : [{ type: 'booster', result: br(), kind: P.mode, dx: R() * 10 }]);
    return { ok, sats: ok ? P.sats : 0, boosters: b, ship: P.shipReturn ? (R() < 0.8 && !ctx.simOpts.burnThrough ? 'caught' : 'lost') : null, fairings: P.fairingRec ? [R() < 0.8, R() < 0.8] : [], landed: R() < 0.85 };
  };
  for (let w = 0; w < maxWeeks && !st.won; w++) {
    if (st.pendingEvent) G.resolveEvent(0);
    // mühendis: gelir arttıkça büyüt
    const net0 = G.network();
    if (st.money > 150 * M && st.engineers < 20 + net0.revenue / 1.5e6) G.hireEngineers(10);
    for (const id of PRIO) { const c = G.canResearch(id); if (c.ok && st.money > G.RESEARCH_BY_ID[id].cost + (G.has('r_f9') ? 50 : 15) * M) G.doResearch(id); }
    for (const f of ['engineFab', 'satFab', 'terminalFab', 'refurb', 'droneShip', 'cape39a', 'starbase', 'fairingShip', 'rocketFab']) {
      const n = G.facilityNext(f);
      if (n && n.ok && st.money > n.cost + 35 * M && !(f === 'droneShip' && G.fac(f) >= 1 && !G.has('r_fh')) && !(f === 'satFab' && st.stock.sats > 300) && !(f === 'terminalFab' && G.totalSats() < 30 && G.raisingSats() < 30)) G.buildFacility(f);
    }
    const net = G.network();
    if (st.money > 300 * M) for (const r of net.regions) if (r.share < 0.55 && r.served > 0.5) G.setPrice(r.id, 'low');
    for (const r of net.regions.filter(r => r.land && !r.station).sort((a, b) => b.demand - a.demand)) if (st.money > 25 * M && G.totalSats() + G.raisingSats() > 40) G.buildStation(r.id);
    for (const r of net.regions.filter(r => r.lic && !st.licenses[r.id]).sort((a, b) => b.demand - a.demand)) if (st.money > 60 * M && G.totalSats() > 60) G.applyLicense(r.id);
    for (const r of net.regions.filter(r => r.station && r.station < 3 && r.users > G.STATION_CAP[r.station] * 0.8)) if (st.money > 60 * M) G.upgradeStation(r.id);
    if (G.has('r_ss') && G.fac('starbase') && st.community < 45 && st.money > 80 * M) G.communityInvest();
    for (const f of G.fundingOptions()) if (f.ok && st.money < 200 * M) G.raiseFunding(f.id);
    const rk = G.has('r_ss') && G.fac('starbase') && L % 2 === 0 ? 'ss' : G.has('r_fh') && G.fac('cape39a') && L % 4 === 3 ? 'fh' : (G.has('r_f9') && (st.money > 60 * M || st.fleet.some(c => c.type === 'f9' && ['ready', 'building', 'refurb'].includes(c.status)))) ? 'f9' : 'f1';
    for (const k of [rk, rk === 'ss' ? 'f9' : null].filter(Boolean)) {
      const info = G.ROCKET_INFO[k];
      const have = st.fleet.filter(c => c.type === info.core && ['ready', 'building', 'refurb'].includes(c.status)).length;
      for (let i = have; i < info.cores + (k === 'f1' ? 1 : 0); i++) G.orderCore(info.core);
      if (k === 'ss' && !st.fleet.some(c => c.type === 'ship' && ['ready', 'building', 'refurb'].includes(c.status))) G.orderCore('ship');
    }
    for (const c of st.contracts.slice()) if (st.accepted.length < 1 && G.CONTRACT_TYPES[c.type].rockets.includes(rk === 'ss' ? 'f9' : rk) && c.type !== 'crew') G.acceptContract(c.id);
    for (const pad of [0, 1]) {
      const rocket = pad === 0 ? rk : (G.fac('cape39a') ? (rk === 'ss' ? 'f9' : 'f9') : null);
      if (!rocket) continue;
      const modes = G.availableModes(rocket);
      const mode = rocket === 'f1' ? (modes.includes('rtls') ? 'rtls' : modes.includes('ocean') && st.stats.splash < 2 ? 'ocean' : 'exp') : (modes.includes('asds') ? 'asds' : modes.includes('catch') ? 'catch' : modes.includes('rtls') ? 'rtls' : 'exp');
      const order = (st.stock.sats >= 40 && L % 3 !== 0) ? ['starlink', 'contract', 'relay', 'test'] : ['contract', 'starlink', 'relay', 'test'];
      for (const payload of order) {
        if (payload === 'relay' && Object.values(st.relays).reduce((a, b) => a + b, 0) >= 3) continue;
        if (payload === 'test' && rocket !== 'f1') continue;
        let P;
        for (const md of [mode, ...modes.slice().reverse()]) { P = G.plan({ rocket, payload, mode: md, shell: G.has('u_polar') ? ['s53', 's53', 's70', 's97'][L % 4] : 's53', shipReturn: true, relaySector: ['am', 'emea', 'apac'][L % 3], deorbitUpper: true }); if (P.ok) break; }
        if (P.ok && P.payload === payload) { const ctx = G.commit(P); G.applyResult(ctx, fake(P, ctx)); L++; break; }
      }
    }
    const rep = G.endWeek();
    if (verbose && (w % 25 === 0 || st.won)) console.log('w', st.week, '$', (st.money / M).toFixed(0), 'sats', G.totalSats(), 'users%', (rep.network.userFrac * 100).toFixed(1), 'rev', (rep.network.revenue / M).toFixed(1), 'R', Object.keys(st.research).length, 'L', L, 'eng', st.engineers, 'rep', st.reputation, 'rivals', st.rivals.map(r => r.sats).join('/'));
  }
  return { won: st.won, week: st.week, launches: L, sats: G.totalSats() };
}
module.exports = { play };
if (require.main === module) {
  const seeds = (process.argv[2] || '1,2,3,4,5,6').split(',').map(Number);
  const diff = process.argv[3] || 'normal';
  for (const s of seeds) console.log('seed', s, JSON.stringify(play(s, diff, 520, process.argv[4] === 'v')));
}
