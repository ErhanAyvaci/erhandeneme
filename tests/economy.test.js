/* Ekonomi regresyon testleri: otomatik oyuncu her zorlukta oyunu bitirebilmeli */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { play } = require('./bot.js');

for (const [diff, max] of [['easy', 260], ['normal', 260], ['hard', 320]]) {
  test(`bot ${diff} zorlukta kazanır`, () => {
    for (const seed of [1, 2]) {
      const r = play(seed, diff, max, false);
      assert.ok(r.won, `${diff} seed ${seed}: hafta ${r.week}, uydu ${r.sats}`);
    }
  });
}
test('kayıt dışa/içe aktarma', () => {
  const G = globalThis.PROG;
  G.reset('normal');
  G.state.money = 123e6;
  const txt = JSON.stringify(G.state);
  G.reset('hard');
  assert.ok(G.importState(txt));
  assert.strictEqual(G.state.money, 123e6);
});
test('geri sayım iptali %85 iade eder', () => {
  const G = globalThis.PROG;
  G.reset('normal');
  const before = G.state.money;
  const pl = G.plan();
  const ctx = G.commit(pl);
  const refund = G.abortLaunch(ctx);
  assert.ok(refund > 0);
  assert.ok(Math.abs(G.state.money - (before - pl.total + refund)) < 1);
});
