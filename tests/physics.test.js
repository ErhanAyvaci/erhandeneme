/* Fizik regresyon testleri: node --test tests/ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('../js/sim.js');
const S = globalThis.SIM;

function fly(key, opts, maxT) {
  const m = new S.Mission(key, Object.assign({ autopilot: true, autoLand: true }, opts));
  m.autoDeploy = true;
  let t = 0;
  while (!m.result && t < (maxT || 9000)) { m.step(0.02); t += 0.02; }
  return m.result;
}
const recovered = r => r.boosters.filter(b => b.result === 'landed' || b.result === 'caught' || b.result === 'splash').length;

test('Falcon 1 test uçuşu yörüngeye ulaşır', () => {
  const r = fly('f1', { mode: 'exp', payloadMass: 180, payloadKind: 'test', fairing: true });
  assert.ok(r && r.ok, r && r.reason);
});
test('Falcon 1 okyanus iniş testi', () => {
  const r = fly('f1', { mode: 'ocean', payloadMass: 150, payloadKind: 'test', fairing: true });
  assert.ok(r.ok, r.reason); assert.strictEqual(recovered(r), 1);
});
test('Falcon 9 rampaya dönüş (RTLS)', () => {
  const r = fly('f9', { mode: 'rtls', payloadMass: 12000, payloadKind: 'starlink', fairing: true, sats: 40 });
  assert.ok(r.ok, r.reason); assert.strictEqual(r.boosters[0].result, 'landed');
  assert.ok(Math.abs(r.boosters[0].dx) < 30, 'iniş sapması ' + r.boosters[0].dx);
});
test('Falcon 9 drone gemi (ASDS)', () => {
  const r = fly('f9', { mode: 'asds', payloadMass: 15600, payloadKind: 'starlink', fairing: true, sats: 60, waves: 1 });
  assert.ok(r.ok, r.reason); assert.strictEqual(r.boosters[0].result, 'landed');
});
test('Falcon 9 sert dalgada devrilme', () => {
  const r = fly('f9', { mode: 'asds', payloadMass: 15600, payloadKind: 'starlink', fairing: true, sats: 60, waves: 1.5, tipOver: true });
  assert.strictEqual(r.boosters[0].result, 'tipped');
});
test('Falcon Heavy yan boosterlar RTLS + merkez ASDS', () => {
  const r = fly('fh', { mode: 'asds', sideMode: 'rtls', payloadMass: 20000, payloadKind: 'contract', fairing: true });
  assert.ok(r.ok, r.reason); assert.ok(recovered(r) >= 2, JSON.stringify(r.boosters));
});
test('Starship kule yakalaması + Ship dönüşü', () => {
  const r = fly('ss', { mode: 'catch', payloadMass: 60000, payloadKind: 'starlink', sats: 50, shipReturn: true }, 12000);
  assert.ok(r.ok, r.reason); assert.strictEqual(r.boosters[0].result, 'caught');
  assert.strictEqual(r.ship, 'caught');
});
test('GTO hedefi apoapsis ~35 786 km', () => {
  const r = fly('f9', { mode: 'asds', payloadMass: 5000, payloadKind: 'contract', fairing: true, targetAp: 35786000 });
  assert.ok(r.ok, r.reason); assert.ok(r.orbit.ap > 34000000, 'ap ' + r.orbit.ap);
});
test('Isı kalkanı delinmesi Ship kaybına yol açar', () => {
  const r = fly('ss', { mode: 'catch', payloadMass: 60000, payloadKind: 'starlink', sats: 50, shipReturn: true, burnThrough: true }, 12000);
  assert.notStrictEqual(r.ship, 'caught');
});
